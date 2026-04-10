/**
 * quote-enricher.ts
 *
 * Targeted NBBO quote enrichment for specific option tickers.
 *
 * Purpose: Quote enrichment is expensive (~391 calls per ticker per day on Massive).
 * This module provides a standalone enrichment function that separates quote fetching
 * from the analytics pipeline — users enrich only the specific leg tickers they need.
 *
 * Key functions:
 *   - shouldSkipEnrichment: pure density check (>= threshold bars → already dense)
 *   - buildEnrichmentPlan: pure planner that groups ticker+date combos needing enrichment
 *   - enrichQuotesForTickers: I/O function that fetches quotes and merges into cache
 *
 * The enrichment interface supports both per-ticker (Massive) and bulk-by-root
 * (ThetaData) patterns via the provider abstraction.
 */

import type { DuckDBConnection } from '@duckdb/node-api';
import { getProvider } from './market-provider.js';
import { mergeQuoteBars } from './bar-cache.js';
import { getIntradayWriteTable } from '../db/connection.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichmentPlanItem {
  ticker: string;
  date: string;
  existingBarCount: number;
}

export interface QuoteEnrichmentResult {
  tickersProcessed: number;
  tickersSkipped: number;  // already dense
  newBarsAdded: number;
  errors: Array<{ ticker: string; date: string; error: string }>;
}

export interface EnrichmentPlanInput {
  tickers: Array<{ ticker: string; fromDate: string; toDate: string }>;
  existingCoverage: Map<string, number>;  // "ticker:date" → barCount
  providerSupportsQuotes: boolean;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Returns true if ticker/date already has dense enough data (>= densityThreshold bars).
 * Default threshold is 200 bars/day — roughly half the 390 market minutes, indicating
 * that quote enrichment has already been applied.
 */
export function shouldSkipEnrichment(barCount: number, densityThreshold = 200): boolean {
  return barCount >= densityThreshold;
}

/**
 * Build a list of ticker+date combos that need enrichment.
 *
 * Rules:
 *   - Returns empty if provider doesn't support quotes
 *   - Returns empty if tickers list is empty
 *   - Expands each ticker's fromDate→toDate range into individual dates
 *   - Skips dates where existing coverage is already dense (>= 200 bars)
 *
 * This is a pure function — no I/O, takes coverage as a pre-fetched Map.
 */
export function buildEnrichmentPlan(input: EnrichmentPlanInput): EnrichmentPlanItem[] {
  if (!input.providerSupportsQuotes) return [];
  if (input.tickers.length === 0) return [];

  const plan: EnrichmentPlanItem[] = [];

  for (const tickerSpec of input.tickers) {
    const dates = expandDateRange(tickerSpec.fromDate, tickerSpec.toDate);
    for (const date of dates) {
      const key = `${tickerSpec.ticker}:${date}`;
      const existingBarCount = input.existingCoverage.get(key) ?? 0;
      if (!shouldSkipEnrichment(existingBarCount)) {
        plan.push({
          ticker: tickerSpec.ticker,
          date,
          existingBarCount,
        });
      }
    }
  }

  return plan;
}

// ---------------------------------------------------------------------------
// I/O enrichment function
// ---------------------------------------------------------------------------

/**
 * Enrich specific option tickers with NBBO quotes for a date range.
 *
 * For each ticker+date that needs enrichment:
 *   1. Reads existing trade bars from market.intraday
 *   2. Fetches NBBO quotes from provider
 *   3. Merges via mergeQuoteBars (trade bars take precedence, quotes fill gaps)
 *   4. Writes new synthetic bars back to market.intraday via INSERT OR REPLACE
 *
 * Skips dates where bars are already dense (>= 200 bars/day).
 * Returns aggregated results including per-error details.
 */
export async function enrichQuotesForTickers(
  tickers: string[],
  fromDate: string,
  toDate: string,
  conn: DuckDBConnection,
): Promise<QuoteEnrichmentResult> {
  const result: QuoteEnrichmentResult = {
    tickersProcessed: 0,
    tickersSkipped: 0,
    newBarsAdded: 0,
    errors: [],
  };

  if (tickers.length === 0) return result;

  const provider = getProvider();
  const caps = provider.capabilities();

  if (!caps.quotes) {
    // Provider doesn't support quotes — skip all tickers
    result.tickersSkipped = tickers.length;
    return result;
  }

  // Build the enrichment plan for each ticker
  const tickerSpecs = tickers.map(ticker => ({ ticker, fromDate, toDate }));
  const existingCoverage = await fetchExistingCoverage(tickers, fromDate, toDate, conn);

  const plan = buildEnrichmentPlan({
    tickers: tickerSpecs,
    existingCoverage,
    providerSupportsQuotes: true,
  });

  // Track per-ticker skip count (tickers where all dates are dense)
  const tickersWithPlanItems = new Set(plan.map(p => p.ticker));
  for (const ticker of tickers) {
    if (!tickersWithPlanItems.has(ticker)) {
      result.tickersSkipped++;
    }
  }

  // Process plan items with concurrency (parallel API fetches, serial DB writes)
  const CONCURRENCY = 5;
  const fetchQuotesFn = provider.fetchQuotes;
  if (!fetchQuotesFn) {
    for (const item of plan) {
      result.errors.push({ ticker: item.ticker, date: item.date, error: 'Provider fetchQuotes not available' });
    }
    return result;
  }

  for (let i = 0; i < plan.length; i += CONCURRENCY) {
    const batch = plan.slice(i, i + CONCURRENCY);

    // Parallel: fetch quotes + read existing bars for each item
    const fetched = await Promise.all(batch.map(async (item) => {
      try {
        const [quotesMap, tradeBars] = await Promise.all([
          fetchQuotesFn.call(provider, item.ticker, item.date, item.date) as Promise<Map<string, { bid: number; ask: number }>>,
          readTradeBarFromCache(item.ticker, item.date, conn),
        ]);
        if (quotesMap.size === 0) return null;

        const merged = mergeQuoteBars(tradeBars, quotesMap, item.ticker);
        const originalKeys = new Set(tradeBars.map(b => `${b.date} ${b.time}`));
        const newBars = merged.filter(b => !originalKeys.has(`${b.date} ${b.time}`));

        return { item, newBars };
      } catch (err) {
        result.errors.push({
          ticker: item.ticker,
          date: item.date,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    }));

    // Serial: write new bars to DB
    for (const f of fetched) {
      if (!f) continue;
      if (f.newBars.length > 0) {
        await writeNewBarsToCache(f.newBars, f.item.ticker, conn);
        result.newBarsAdded += f.newBars.length;
      }
      result.tickersProcessed++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Expand a date range into individual YYYY-MM-DD dates (inclusive, calendar days).
 */
function expandDateRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const from = new Date(fromDate + 'T00:00:00Z');
  const to = new Date(toDate + 'T00:00:00Z');
  const current = new Date(from);
  while (current <= to) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Query market.intraday for existing bar counts per ticker+date.
 * Returns Map<"ticker:date", barCount>.
 */
async function fetchExistingCoverage(
  tickers: string[],
  fromDate: string,
  toDate: string,
  conn: DuckDBConnection,
): Promise<Map<string, number>> {
  const coverage = new Map<string, number>();
  if (tickers.length === 0) return coverage;

  try {
    const escaped = tickers.map(t => `'${t.replace(/'/g, "''")}'`);
    const rows = await conn.runAndReadAll(`
      SELECT ticker, date, COUNT(*) as bar_count
      FROM market.intraday
      WHERE ticker IN (${escaped.join(', ')})
        AND date >= '${fromDate}'
        AND date <= '${toDate}'
      GROUP BY ticker, date
    `);
    const rawRows = rows.getRows() as unknown[][];
    for (const row of rawRows) {
      const key = `${row[0]}:${row[1]}`;
      coverage.set(key, Number(row[2]));
    }
  } catch {
    // Table may not exist yet — return empty coverage (all dates need enrichment)
  }

  return coverage;
}

/**
 * Read existing trade bars for a ticker+date from market.intraday.
 */
async function readTradeBarFromCache(
  ticker: string,
  date: string,
  conn: DuckDBConnection,
) {
  try {
    const escaped = ticker.replace(/'/g, "''");
    const rows = await conn.runAndReadAll(`
      SELECT open, high, low, close, bid, ask, time, date
      FROM market.intraday
      WHERE ticker = '${escaped}' AND date = '${date}'
      ORDER BY time
    `);
    const rawRows = rows.getRows() as unknown[][];
    return rawRows.map(row => ({
      open: Number(row[0]),
      high: Number(row[1]),
      low: Number(row[2]),
      close: Number(row[3]),
      bid: row[4] != null ? Number(row[4]) : undefined,
      ask: row[5] != null ? Number(row[5]) : undefined,
      time: String(row[6]),
      date: String(row[7]),
      ticker,
      volume: 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Write new synthetic bars to market.intraday via INSERT OR REPLACE.
 */
async function writeNewBarsToCache(
  newBars: Array<{
    date: string;
    time?: string;
    open: number;
    high: number;
    low: number;
    close: number;
    bid?: number;
    ask?: number;
  }>,
  ticker: string,
  conn: DuckDBConnection,
): Promise<void> {
  const escaped = ticker.replace(/'/g, "''");
  const values = newBars
    .filter(b => b.time)
    .map(b =>
      `('${escaped}', '${b.date}', '${b.time}', ${b.open}, ${b.high}, ${b.low}, ${b.close}, ${b.bid ?? 'NULL'}, ${b.ask ?? 'NULL'})`
    );

  for (let i = 0; i < values.length; i += 500) {
    const chunk = values.slice(i, i + 500);
    await conn.run(
      `INSERT OR REPLACE INTO ${getIntradayWriteTable()} (ticker, date, time, open, high, low, close, bid, ask) VALUES ${chunk.join(', ')}`
    );
  }
}
