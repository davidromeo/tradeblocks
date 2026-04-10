/**
 * bar-cache.ts
 *
 * Shared fetch+cache utility for Massive.com bar data.
 *
 * Implements the cache-read → API-fetch → cache-write lifecycle for intraday bars:
 *   1. Cache-read: query market.intraday first (avoids redundant API calls)
 *   2. API fetch: call fetchBars on cache miss
 *   3. Cache-write: write fetched bars to market.intraday (best-effort, batched)
 *
 * Per D-02/D-03/D-04: Eliminates duplicated cache logic in replay.ts.
 * Historical option and underlying bars are immutable — cached bars are always valid.
 */

import type { BarRow, AssetClass } from './market-provider.js';
import { getProvider } from './market-provider.js';
import { getConnection, getIntradayWriteTable } from '../db/connection.js';
import type { DuckDBConnection } from '@duckdb/node-api';

/**
 * Data tier for the market data provider. Controls which API endpoints are available.
 *   - "ohlc":   Trade-based OHLCV minute bars only (basic tier, all providers)
 *   - "trades": Tick-level trades available (mid tier)
 *   - "quotes": NBBO quotes available — enables synthetic quote bars (top tier)
 *
 * Reads MASSIVE_DATA_TIER env var. Falls back to legacy MASSIVE_QUOTES_ENABLED
 * for backwards compatibility. Default: "ohlc".
 */
export type DataTier = "ohlc" | "trades" | "quotes";

export function getDataTier(): DataTier {
  const tier = (process.env.MASSIVE_DATA_TIER ?? '').toLowerCase();
  if (tier === 'quotes' || tier === 'trades' || tier === 'ohlc') return tier;
  // Legacy fallback
  if (process.env.MASSIVE_QUOTES_ENABLED === 'true' || process.env.MASSIVE_QUOTES_ENABLED === '1') return 'quotes';
  return 'ohlc';
}

function quotesEnabled(): boolean {
  return getDataTier() === 'quotes';
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
    if (quote.bid <= 0 && quote.ask <= 0) continue; // invalid quote
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
 * Fetch NBBO quotes and merge into trade bars, creating dense minute-level
 * bars for option tickers. Degrades gracefully: returns original bars if
 * quotes are disabled, provider doesn't support them, or fetch fails.
 */
async function enrichWithQuotes(
  bars: BarRow[],
  ticker: string,
  from: string,
  to: string,
): Promise<{ bars: BarRow[]; newBars: BarRow[] }> {
  const provider = getProvider();
  if (!provider.fetchQuotes) return { bars, newBars: [] };

  let quotesMap: Map<string, { bid: number; ask: number }>;
  try {
    quotesMap = await provider.fetchQuotes(ticker, from, to);
  } catch {
    return { bars, newBars: [] };
  }
  if (quotesMap.size === 0) return { bars, newBars: [] };

  const merged = mergeQuoteBars(bars, quotesMap, ticker);
  const originalKeys = new Set(bars.map(b => `${b.date} ${b.time}`));
  const added = merged.filter(b => !originalKeys.has(`${b.date} ${b.time}`));

  return { bars: merged, newBars: added };
}

/**
 * Persist synthetic quote-derived bars to market.intraday cache.
 * Best-effort — errors are swallowed.
 */
async function cacheNewBars(
  newBars: BarRow[],
  ticker: string,
  conn: DuckDBConnection | undefined,
  baseDir: string | undefined,
): Promise<void> {
  if (newBars.length === 0) return;
  try {
    const c = conn ?? await getConnection(baseDir ?? '.');
    const escaped = ticker.replace(/'/g, "''");
    const values = newBars
      .filter(b => b.time)
      .map(b =>
        `('${escaped}', '${b.date}', '${b.time}', ${b.open}, ${b.high}, ${b.low}, ${b.close}, ${b.bid ?? 'NULL'}, ${b.ask ?? 'NULL'})`
      );
    for (let i = 0; i < values.length; i += 500) {
      const chunk = values.slice(i, i + 500);
      await c.run(
        `INSERT OR REPLACE INTO ${getIntradayWriteTable()} (ticker, date, time, open, high, low, close, bid, ask) VALUES ${chunk.join(', ')}`
      );
    }
  } catch { /* best-effort */ }
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
 * Read bars from market.intraday cache. Returns whatever is cached, even if
 * partial. Never calls the API. For data preparation only. Use readCachedBars()
 * when API fallback is not desired — use for pre-cached data workflows where
 * data is prepared in advance.
 */
export async function readCachedBars(opts: ReadCachedBarsOptions): Promise<BarRow[]> {
  const { ticker, from, to, conn } = opts;
  try {
    const escaped = ticker.replace(/'/g, "''");
    const cached = await conn.runAndReadAll(
      `SELECT open, high, low, close, bid, ask, time, date
       FROM market.intraday
       WHERE ticker = '${escaped}'
         AND date >= '${from}'
         AND date <= '${to}'
       ORDER BY date, time`
    );
    const rows = cached.getRows() as unknown[][];
    return rows.map((row) => ({
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
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchBarsWithCache — data prep path (cache + API fallback)
// ---------------------------------------------------------------------------

/**
 * Fetch minute bars for a ticker over a date range, using market.intraday as a cache.
 *
 * **For data preparation only.** Use readCachedBars() when API fallback is not desired.
 *
 * Steps:
 *   1. Try to read bars from market.intraday (cache hit → return immediately)
 *   2. On cache miss, call fetchBars (Massive API)
 *   3. Write fetched bars back to market.intraday in batches of 500 (best-effort)
 *
 * DuckDB errors in steps 1 or 3 are swallowed — step 2 is always attempted on miss.
 * Returns [] when both cache and API return no bars (or API throws).
 */
export async function fetchBarsWithCache(opts: FetchBarsWithCacheOptions): Promise<BarRow[]> {
  const { ticker, from, to, timespan, assetClass, baseDir } = opts;

  // 1. Cache-read from market.intraday
  try {
    const conn = opts.conn ?? await getConnection(baseDir ?? '.');
    const escaped = ticker.replace(/'/g, "''");
    const cached = await conn.runAndReadAll(
      `SELECT open, high, low, close, bid, ask, time, date
       FROM market.intraday
       WHERE ticker = '${escaped}'
         AND date >= '${from}'
         AND date <= '${to}'
       ORDER BY date, time`
    );
    const rows = cached.getRows() as unknown[][];
    // Check for partial cache: if multi-date range requested but cached dates cover
    // fewer than 70% of expected trading days, the cache is incomplete (e.g.,
    // only entry+expiry days from IV prefetch). Fall through to API fetch for
    // the full range so replay paths have bars for all intermediate trading days.
    const cachedDates = new Set((rows as unknown[][]).map(r => String(r[7])));
    const calendarDays = Math.round(
      (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000
    );
    const expectedTradingDays = Math.max(1, Math.ceil(calendarDays * 5 / 7));
    const isPartialHit = rows.length > 0 && from !== to
      && cachedDates.size < expectedTradingDays * 0.7;
    // When skipQuotes is set, caller wants cached data only — don't reject partial hits.
    // Options often have sparse coverage (traded days only), so the 70% heuristic
    // wrongly rejects valid data and falls through to the API for expired contracts.
    if (rows.length > 0 && (!isPartialHit || opts.skipQuotes)) {
      const bars = rows.map((row) => ({
        open:   Number(row[0]),
        high:   Number(row[1]),
        low:    Number(row[2]),
        close:  Number(row[3]),
        bid:    row[4] != null ? Number(row[4]) : undefined,
        ask:    row[5] != null ? Number(row[5]) : undefined,
        time:   String(row[6]),
        date:   String(row[7]),
        ticker,
        volume: 0,  // market.intraday has no volume column
      }));

      // Enrich with NBBO quotes: fill gaps + backfill bid/ask on existing bars.
      // Skip if bars are already dense AND have quote data (bid/ask populated).
      // Dense trade-only caches (pre-enrichment) still need quote backfill.
      if (assetClass === "option" && quotesEnabled() && !opts.skipQuotes) {
        const dates = new Set(bars.map(b => b.date));
        const barsPerDay = dates.size > 0 ? bars.length / dates.size : 0;
        const hasQuotes = bars.some(b => b.bid != null && b.ask != null);
        if (barsPerDay < 200 || !hasQuotes) {
          const { bars: enriched, newBars } = await enrichWithQuotes(bars, ticker, from, to);
          await cacheNewBars(newBars, ticker, opts.conn, baseDir);
          return enriched;
        }
      }

      return bars;
    }
  } catch {
    // Cache miss or table not available — fall through to API fetch
  }

  // 2. API fetch on cache miss
  let bars: BarRow[] = [];
  try {
    bars = await getProvider().fetchBars({
      ticker,
      from,
      to,
      timespan: timespan ?? 'minute',
      assetClass,
    });
  } catch {
    return [];
  }
  if (bars.length === 0) return [];

  // 3. Enrich with NBBO quotes before caching (fills gaps + adds bid/ask)
  if (assetClass === "option" && quotesEnabled() && !opts.skipQuotes) {
    const { bars: enriched } = await enrichWithQuotes(bars, ticker, from, to);
    // Cache ALL bars (trade + synthetic) in one pass
    const allBars = enriched;
    try {
      const conn = opts.conn ?? await getConnection(baseDir ?? '.');
      const escaped = ticker.replace(/'/g, "''");
      const values = allBars
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
    } catch { /* best-effort */ }
    return enriched;
  }

  // 3. Cache-write to market.intraday (best-effort, batched) — non-option or quotes disabled
  try {
    const conn = opts.conn ?? await getConnection(baseDir ?? '.');
    const escaped = ticker.replace(/'/g, "''");
    const values = bars
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
  } catch {
    // Cache-write is best-effort — don't fail the fetch
  }

  return bars;
}

// ---------------------------------------------------------------------------
// fetchEntryBarsForCandidates — bulk single-date fetch for IV computation
// ---------------------------------------------------------------------------

/**
 * Fetch entry-date bars for many option tickers in a single DuckDB query.
 *
 * Returns a Map<ticker, BarRow[]> with all bars on `entryDate` for each ticker.
 * Tickers not found in cache are fetched individually from the API and cached.
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
    const cached = await conn.runAndReadAll(
      `SELECT ticker, open, high, low, close, bid, ask, time, date
       FROM market.intraday
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
    // Cache read failed — fall through to individual fetches
  }

  // Cache misses are expected — not all option tickers have cached bars.
  // Returns only cached data — never calls the API.

  return result;
}

// ---------------------------------------------------------------------------
// fetchBarsForLegsBulk — bulk multi-date-range fetch for selected leg bars
// ---------------------------------------------------------------------------

/**
 * Fetch full-range bars for multiple selected leg tickers in a single DuckDB query.
 *
 * All legs share the same fromDate (entry date). Uses the max expiration across all
 * legs as the toDate to avoid multiple queries with slightly different ranges.
 * Returns a Map<ticker, BarRow[]> grouped by ticker.
 *
 * Returns only cached data — never calls the API.
 */
export async function fetchBarsForLegsBulk(
  legs: Array<{ ticker: string; expiration: string }>,
  fromDate: string,
  conn: DuckDBConnection,
): Promise<Map<string, BarRow[]>> {
  const result = new Map<string, BarRow[]>();
  if (legs.length === 0) return result;

  // Single bulk query: all tickers, from entry date to max expiration.
  // Much faster than N individual readCachedBars calls (1 query vs 68).
  const maxExpiry = legs.reduce((max, l) => l.expiration > max ? l.expiration : max, fromDate);
  const escaped = legs.map(l => `'${l.ticker.replace(/'/g, "''")}'`).join(', ');
  try {
    const cached = await conn.runAndReadAll(
      `SELECT ticker, open, high, low, close, bid, ask, time, date
       FROM market.intraday
       WHERE ticker IN (${escaped})
         AND date >= '${fromDate}'
         AND date <= '${maxExpiry}'
       ORDER BY ticker, date, time`
    );
    for (const row of cached.getRows() as unknown[][]) {
      const ticker = String(row[0]);
      const bar: BarRow = {
        ticker,
        open: Number(row[1]), high: Number(row[2]), low: Number(row[3]),
        close: Number(row[4]),
        bid: row[5] != null ? Number(row[5]) : undefined,
        ask: row[6] != null ? Number(row[6]) : undefined,
        time: String(row[7]), date: String(row[8]), volume: 0,
      };
      const existing = result.get(ticker);
      if (existing) existing.push(bar);
      else result.set(ticker, [bar]);
    }
  } catch {
    // Fallback to individual queries
    await Promise.all(legs.map(async (leg) => {
      const bars = await readCachedBars({ ticker: leg.ticker, from: fromDate, to: leg.expiration, conn });
      if (bars.length > 0) result.set(leg.ticker, bars);
    }));
  }

  return result;
}
