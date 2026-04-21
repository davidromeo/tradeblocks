/**
 * bar-cache.ts
 *
 * Cache-only minute-bar reader for the Market Data 3.0 transition.
 *
 * Phase 4 / D-05 / SEP-01: the API fallback that previously lived in
 * `fetchBarsWithCache` is GONE — reads NEVER trigger a provider fetch any
 * more. The function is now a thin wrapper over the cache-read path only;
 * cache misses return `[]` (the D-09 silent-empty contract). The provider-
 * side quote write helper (`enrichWithQuotes`) is also gone — that behavior
 * moves into `quote-backfill.ts` in plan 04-06 (Wave 6) where it lives next
 * to the rest of the pipeline-side backfill orchestration.
 *
 * Surviving public surface (Wave A — transitional):
 *   - `fetchBarsWithCache` — cache-read only; will be deleted in plan 04-02
 *     once `tools/replay.ts` is on the spot store.
 *   - `readCachedBars` — pure cache read; consumed by `market-data-loader.ts`
 *     until plan 04-02 migrates the underlying-bar load to `stores.spot`.
 *   - `fetchBarsForLegsBulk` / `fetchEntryBarsForCandidates` — bulk cache
 *     reads consumed by `backtest/orchestrator.ts`; deleted in plan 04-04.
 *   - `mergeQuoteBars` — pure helper; will move to a tiny utility module in
 *     plan 04-04 once the last callers are gone.
 *   - `getDataTier` — provider capability passthrough; unchanged.
 *
 * Surviving private surface (still required by `fetchBarsForLegsBulk`):
 *   - `intradayDateSource` / `optionQuoteMinuteSource` — partition-source
 *     helpers; duplicated in `market-data-loader.ts` (D-11) and deleted there
 *     by plan 04-02. Once both that copy and `fetchBarsForLegsBulk` migrate,
 *     this duplicate goes too (plan 04-04).
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BarRow, AssetClass } from './market-provider.js';
import { getDataRoot } from '../db/data-root.js';
import { resolveCanonicalMarketPartitionFile } from '../db/market-datasets.js';
import type { DuckDBConnection } from '@duckdb/node-api';
import { getConnection } from '../db/connection.js';
import { resolveMassiveDataTier, type MassiveDataTier } from './provider-capabilities.js';

/**
 * Massive.com acquisition tier. Default is "ohlc" when MASSIVE_DATA_TIER is unset.
 */
export function getDataTier(): MassiveDataTier {
  return resolveMassiveDataTier();
}

export type DataTier = MassiveDataTier;

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function enumerateTradingDates(fromDate: string, toDate: string): string[] {
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  if (from > to) return [];

  const dates: string[] = [];
  const current = new Date(from);
  while (current <= to) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const date = String(current.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${date}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * @internal — duplicated in market-data-loader.ts (D-11). Plan 04-02 deletes
 * the loader copy; plan 04-04 deletes this one once `fetchBarsForLegsBulk`
 * is gone.
 */
function intradayDateSourceLocal(date: string, dataDir?: string): string {
  // Phase 6 Wave D: legacy date-partitioned intraday directory support is
  // gone alongside the retired legacy minute-bar view. Fall through to market.spot
  // (the v3.0 canonical minute-bar view, ticker-first Hive-partitioned).
  const partitionDir = resolve(getDataRoot(dataDir ?? '.'), 'market', 'intraday', `date=${date}`);
  if (existsSync(partitionDir)) {
    return `read_parquet('${escapeSqlLiteral(resolve(partitionDir, '*.parquet'))}', hive_partitioning=true)`;
  }
  return 'market.spot';
}

/** @internal — companion to intradayDateSourceLocal. Same lifecycle. */
function optionQuoteMinuteSourceLocal(date: string, dataDir?: string): string {
  const parquetPath = resolveCanonicalMarketPartitionFile(getDataRoot(dataDir ?? '.'), 'option_quote_minutes', date);
  if (existsSync(parquetPath)) {
    return `read_parquet('${escapeSqlLiteral(parquetPath)}', hive_partitioning=true)`;
  }
  return 'market.option_quote_minutes';
}

function buildDateScopedTickerQuery(params: {
  columns: string;
  source: string | ((date: string) => string);
  tickersByDate: Map<string, Set<string>>;
}): string | null {
  const { columns, source, tickersByDate } = params;
  const selects: string[] = [];

  for (const [date, tickers] of tickersByDate) {
    if (tickers.size === 0) continue;
    const escapedTickers = [...tickers].map(ticker => `'${escapeSqlLiteral(ticker)}'`).join(', ');
    const sourceExpr = typeof source === 'function' ? source(date) : source;
    selects.push(
      `SELECT ${columns}
       FROM ${sourceExpr}
       WHERE date = '${escapeSqlLiteral(date)}'
         AND ticker IN (${escapedTickers})`
    );
  }

  if (selects.length === 0) return null;
  if (selects.length === 1) return selects[0];
  return `SELECT *
          FROM (
            ${selects.join('\n            UNION ALL\n            ')}
          ) scoped`;
}

function buildActiveTickerDates(
  legs: Array<{ ticker: string; expiration: string; entryDate?: string; activeUntilDate?: string }>,
  fromDate: string,
): Map<string, Set<string>> {
  const tickersByDate = new Map<string, Set<string>>();

  for (const leg of legs) {
    const activeFrom = leg.entryDate ?? fromDate;
    const activeTo = leg.activeUntilDate && leg.activeUntilDate < leg.expiration
      ? leg.activeUntilDate
      : leg.expiration;
    for (const date of enumerateTradingDates(activeFrom, activeTo)) {
      let tickers = tickersByDate.get(date);
      if (!tickers) {
        tickers = new Set<string>();
        tickersByDate.set(date, tickers);
      }
      tickers.add(leg.ticker);
    }
  }

  return tickersByDate;
}

// ---------------------------------------------------------------------------
// Quote bar merging (pure)
// ---------------------------------------------------------------------------

/**
 * Merge trade bars with NBBO quote data, creating synthetic bars for minutes
 * where quotes exist but no trades occurred.
 *
 * Trade bars always take precedence — quotes only fill gaps. Synthetic bars
 * have bid/ask from NBBO and OHLC set to the mid price, with volume=0.
 *
 * This is the key function that turns sparse trade data into dense minute bars
 * for illiquid options. When quotes aren't available, callers get back the
 * original trade bars unchanged.
 */
export function mergeQuoteBars(
  tradeBars: BarRow[],
  quotesMap: Map<string, { bid: number; ask: number }>,
  ticker: string,
): BarRow[] {
  if (quotesMap.size === 0) return tradeBars;

  // Index existing trade bars by "date time" key
  const tradeBarKeys = new Set<string>();
  for (const bar of tradeBars) {
    if (bar.time) tradeBarKeys.add(`${bar.date} ${bar.time}`);
  }

  // Create synthetic bars for quote-only minutes
  const syntheticBars: BarRow[] = [];
  for (const [key, quote] of quotesMap) {
    if (tradeBarKeys.has(key)) continue; // trade bar exists — skip
    // Keep rows where ask > 0 — "bid=0, ask=pennies" is a valid quote for
    // deep-OTM options near expiry (no bidders, but still quoted to close).
    // Drop only when there's genuinely no market.
    if (quote.ask <= 0 || quote.bid < 0) continue;
    const mid = (quote.bid + quote.ask) / 2;
    const [date, time] = key.split(' ');
    if (!date || !time) continue;
    syntheticBars.push({
      date,
      time,
      open: mid,
      high: mid,
      low: mid,
      close: mid,
      bid: quote.bid,
      ask: quote.ask,
      volume: 0,
      ticker,
    });
  }

  if (syntheticBars.length === 0) {
    // Still enrich existing trade bars with bid/ask where missing
    for (const bar of tradeBars) {
      if (bar.time && bar.bid == null && bar.ask == null) {
        const quote = quotesMap.get(`${bar.date} ${bar.time}`);
        if (quote) { bar.bid = quote.bid; bar.ask = quote.ask; }
      }
    }
    return tradeBars;
  }

  // Enrich existing trade bars with bid/ask where missing
  for (const bar of tradeBars) {
    if (bar.time && bar.bid == null && bar.ask == null) {
      const quote = quotesMap.get(`${bar.date} ${bar.time}`);
      if (quote) { bar.bid = quote.bid; bar.ask = quote.ask; }
    }
  }

  // Merge and sort by date+time
  const merged = [...tradeBars, ...syntheticBars];
  merged.sort((a, b) => {
    const ka = `${a.date} ${a.time ?? ''}`;
    const kb = `${b.date} ${b.time ?? ''}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  return merged;
}

/**
 * Read backfilled quotes from market.option_quote_minutes (Parquet view).
 * Returns a quotes map compatible with mergeQuoteBars(). Returns empty map
 * if the table doesn't exist or the query fails.
 */
async function readCachedQuotes(
  conn: DuckDBConnection,
  ticker: string,
  from: string,
  to: string,
): Promise<Map<string, { bid: number; ask: number }>> {
  const quotes = new Map<string, { bid: number; ask: number }>();
  try {
    const escaped = ticker.replace(/'/g, "''");
    const result = await conn.runAndReadAll(
      `SELECT date, time, bid, ask
       FROM market.option_quote_minutes
       WHERE ticker = '${escaped}'
         AND date >= '${from}'
         AND date <= '${to}'`
    );
    for (const row of result.getRows() as unknown[][]) {
      const date = String(row[0]);
      const time = String(row[1]);
      const bid = Number(row[2]);
      const ask = Number(row[3]);
      if (time && (bid > 0 || ask > 0)) {
        quotes.set(`${date} ${time}`, { bid, ask });
      }
    }
  } catch {
    // Table doesn't exist or query failed — no cached quotes available
  }
  return quotes;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchBarsWithCacheOptions {
  ticker: string;
  from: string;
  to: string;
  timespan?: "day" | "minute" | "hour";
  assetClass?: AssetClass;
  /** Pre-opened DuckDB connection (avoids re-opening in hot paths). */
  conn?: DuckDBConnection;
  /** Base directory for getConnection (used when conn is not provided). */
  baseDir?: string;
  /** Skip NBBO quote enrichment even when data tier supports it. Use for
   *  hot paths like strike selection where quotes add latency but no value. */
  skipQuotes?: boolean;
}

// ---------------------------------------------------------------------------
// readCachedBars — pure cache read, no API calls
// ---------------------------------------------------------------------------

export interface ReadCachedBarsOptions {
  ticker: string;
  from: string;
  to: string;
  conn: DuckDBConnection;
}

/**
 * Read bars from the market.spot cache. Returns whatever is cached, even if
 * partial. Never calls the API. For data preparation only. Use readCachedBars()
 * when API fallback is not desired — use for pre-cached data workflows where
 * data is prepared in advance.
 */
export async function readCachedBars(opts: ReadCachedBarsOptions): Promise<BarRow[]> {
  const { ticker, from, to, conn } = opts;
  try {
    const escaped = ticker.replace(/'/g, "''");
    // Phase 6 Wave D: legacy minute-bar view FROM clause rewritten to
    // `FROM market.spot` (v3.0 ticker-first minute-bar view; schema unchanged).
    const cached = await conn.runAndReadAll(
      `SELECT open, high, low, close, bid, ask, time, date
       FROM market.spot
       WHERE ticker = '${escaped}'
         AND date >= '${from}'
         AND date <= '${to}'
       ORDER BY date, time`
    );
    const rows = cached.getRows() as unknown[][];
    let bars: BarRow[] = rows.map((row) => ({
      open:   Number(row[0]),
      high:   Number(row[1]),
      low:    Number(row[2]),
      close:  Number(row[3]),
      bid:    row[4] != null ? Number(row[4]) : undefined,
      ask:    row[5] != null ? Number(row[5]) : undefined,
      time:   String(row[6]),
      date:   String(row[7]),
      ticker,
      volume: 0,
    }));

    // Enrich with backfilled quotes from option_quote_minutes (Parquet cache).
    // This fills gaps in sparse trade-bar data with dense NBBO minute bars.
    const cachedQuotes = await readCachedQuotes(conn, ticker, from, to);
    if (cachedQuotes.size > 0) {
      bars = mergeQuoteBars(bars, cachedQuotes, ticker);
    }

    return bars;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchBarsWithCache — cache-only (Phase 4 / SEP-01: NO API fallback)
// ---------------------------------------------------------------------------

/**
 * Read minute bars for a ticker over a date range from `market.spot` +
 * `market.option_quote_minutes`.
 *
 * Phase 4 / D-05 / SEP-01: this function NEVER calls the provider any more.
 * Cache misses return `[]`. Callers that need to trigger a hydration must use
 * the data-pipeline tools (`prepare_backtest`, `import_flat_files`,
 * `enrich_quotes`) explicitly — strict read/write separation.
 *
 * Plan 04-02 deletes this function entirely once `tools/replay.ts` is on the
 * `stores.spot` read path.
 */
export async function fetchBarsWithCache(opts: FetchBarsWithCacheOptions): Promise<BarRow[]> {
  const { ticker, from, to, assetClass, baseDir } = opts;

  try {
    const conn = opts.conn ?? await getConnection(baseDir ?? '.');
    const escaped = ticker.replace(/'/g, "''");
    // Phase 6 Wave D: legacy minute-bar view FROM clause rewritten to
    // `FROM market.spot` (v3.0 ticker-first minute-bar view; schema unchanged).
    const cached = await conn.runAndReadAll(
      `SELECT open, high, low, close, bid, ask, time, date
       FROM market.spot
       WHERE ticker = '${escaped}'
         AND date >= '${from}'
         AND date <= '${to}'
       ORDER BY date, time`
    );
    const rows = cached.getRows() as unknown[][];

    const bars: BarRow[] = rows.map((row) => ({
      open:   Number(row[0]),
      high:   Number(row[1]),
      low:    Number(row[2]),
      close:  Number(row[3]),
      bid:    row[4] != null ? Number(row[4]) : undefined,
      ask:    row[5] != null ? Number(row[5]) : undefined,
      time:   String(row[6]),
      date:   String(row[7]),
      ticker,
      volume: 0,
    }));

    if (assetClass === "option" || rows.length === 0) {
      const cachedQuotes = await readCachedQuotes(conn, ticker, from, to);
      if (cachedQuotes.size > 0) {
        return mergeQuoteBars(bars, cachedQuotes, ticker);
      }
    }

    return bars;
  } catch {
    // Strict silent-empty: cache miss or table not available → empty array.
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchEntryBarsForCandidates — bulk single-date fetch for IV computation
// ---------------------------------------------------------------------------

/**
 * Fetch entry-date bars for many option tickers in a single DuckDB query.
 *
 * Returns a Map<ticker, BarRow[]> with all bars on `entryDate` for each ticker.
 * Tickers not found in cache are simply absent — no API fallback (D-05).
 */
export async function fetchEntryBarsForCandidates(
  tickers: string[],
  entryDate: string,
  conn: DuckDBConnection,
): Promise<Map<string, BarRow[]>> {
  const result = new Map<string, BarRow[]>();
  if (tickers.length === 0) return result;

  // 1. Bulk cache-read: single query for all tickers on entry date
  const escapedTickers = tickers.map(t => `'${t.replace(/'/g, "''")}'`);
  try {
    // Phase 6 Wave D: legacy minute-bar view FROM clause rewritten to
    // `FROM market.spot` (v3.0 ticker-first minute-bar view; schema unchanged).
    const cached = await conn.runAndReadAll(
      `SELECT ticker, open, high, low, close, bid, ask, time, date
       FROM market.spot
       WHERE ticker IN (${escapedTickers.join(', ')})
         AND date = '${entryDate}'
       ORDER BY ticker, time`
    );
    const rows = cached.getRows() as unknown[][];
    for (const row of rows) {
      const ticker = String(row[0]);
      const bar: BarRow = {
        ticker,
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        bid: row[5] != null ? Number(row[5]) : undefined,
        ask: row[6] != null ? Number(row[6]) : undefined,
        time: String(row[7]),
        date: String(row[8]),
        volume: 0,
      };
      const existing = result.get(ticker);
      if (existing) existing.push(bar);
      else result.set(ticker, [bar]);
    }
  } catch {
    // Cache read failed — return whatever we have (empty map is fine)
  }

  return result;
}

// ---------------------------------------------------------------------------
// fetchBarsForLegsBulk — bulk multi-date-range fetch for selected leg bars
// ---------------------------------------------------------------------------

/**
 * Fetch full-range bars for multiple selected leg tickers in a single DuckDB query.
 *
 * Reads only the active trading dates for each selected leg, then merges cached
 * quote minutes into every ticker so replay paths see dense mark data rather than
 * sparse trade bars.
 *
 * Returns only cached data — never calls the API (D-05).
 *
 * NB: still uses the local `intradayDateSourceLocal` /
 * `optionQuoteMinuteSourceLocal` helpers because the canonical store layer
 * doesn't yet expose a "many tickers across many dates" bulk read. Plan 04-04
 * replaces this entire function with grouped `stores.spot.readBars` /
 * `stores.quote.readQuotes` calls.
 */
export async function fetchBarsForLegsBulk(
  legs: Array<{ ticker: string; expiration: string; entryDate?: string; activeUntilDate?: string }>,
  fromDate: string,
  conn: DuckDBConnection,
  opts?: { dataDir?: string },
): Promise<Map<string, BarRow[]>> {
  const result = new Map<string, BarRow[]>();
  if (legs.length === 0) return result;

  const activeTickerDates = buildActiveTickerDates(legs, fromDate);
  if (activeTickerDates.size === 0) return result;

  const uniqueTickers = [...new Set(legs.map(leg => leg.ticker))];

  try {
    const tradeQuery = buildDateScopedTickerQuery({
      columns: 'ticker, open, high, low, close, bid, ask, time, date',
      source: (date) => intradayDateSourceLocal(date, opts?.dataDir),
      tickersByDate: activeTickerDates,
    });

    if (tradeQuery) {
      const cached = await conn.runAndReadAll(`${tradeQuery}\nORDER BY ticker, date, time`);
      for (const row of cached.getRows() as unknown[][]) {
        const ticker = String(row[0]);
        const bar: BarRow = {
          ticker,
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          bid: row[5] != null ? Number(row[5]) : undefined,
          ask: row[6] != null ? Number(row[6]) : undefined,
          time: String(row[7]),
          date: String(row[8]),
          volume: 0,
        };
        const existing = result.get(ticker);
        if (existing) existing.push(bar);
        else result.set(ticker, [bar]);
      }
    }

    const quoteQuery = buildDateScopedTickerQuery({
      columns: 'ticker, date, time, bid, ask',
      source: (date) => optionQuoteMinuteSourceLocal(date, opts?.dataDir),
      tickersByDate: activeTickerDates,
    });

    if (quoteQuery) {
      const quotesByTicker = new Map<string, Map<string, { bid: number; ask: number }>>();
      const quoteRows = await conn.runAndReadAll(`${quoteQuery}\nORDER BY ticker, date, time`);
      for (const row of quoteRows.getRows() as unknown[][]) {
        const ticker = String(row[0]);
        const date = String(row[1]);
        const time = String(row[2]);
        const bid = Number(row[3]);
        const ask = Number(row[4]);
        if (!time || (!Number.isFinite(bid) && !Number.isFinite(ask))) continue;

        let quotes = quotesByTicker.get(ticker);
        if (!quotes) {
          quotes = new Map<string, { bid: number; ask: number }>();
          quotesByTicker.set(ticker, quotes);
        }
        quotes.set(`${date} ${time}`, {
          bid: Number.isFinite(bid) ? bid : 0,
          ask: Number.isFinite(ask) ? ask : 0,
        });
      }

      for (const ticker of uniqueTickers) {
        const quotes = quotesByTicker.get(ticker);
        if (!quotes || quotes.size === 0) continue;
        const merged = mergeQuoteBars(result.get(ticker) ?? [], quotes, ticker);
        if (merged.length > 0) result.set(ticker, merged);
      }
    }

    return result;
  } catch {
    // Fall through to per-ticker cache reads if the bulk query path fails.
  }

  const fallbackRanges = new Map<string, { from: string; to: string }>();
  for (const leg of legs) {
    const activeFrom = leg.entryDate ?? fromDate;
    const activeTo = leg.activeUntilDate && leg.activeUntilDate < leg.expiration
      ? leg.activeUntilDate
      : leg.expiration;
    const existing = fallbackRanges.get(leg.ticker);
    if (!existing) {
      fallbackRanges.set(leg.ticker, { from: activeFrom, to: activeTo });
      continue;
    }
    if (activeFrom < existing.from) existing.from = activeFrom;
    if (activeTo > existing.to) existing.to = activeTo;
  }

  await Promise.all([...fallbackRanges.entries()].map(async ([ticker, range]) => {
    const bars = await readCachedBars({ ticker, from: range.from, to: range.to, conn });
    if (bars.length > 0) result.set(ticker, bars);
  }));

  return result;
}
