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
import { getConnection } from '../db/connection.js';
import type { DuckDBConnection } from '@duckdb/node-api';

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
}

// ---------------------------------------------------------------------------
// fetchBarsWithCache
// ---------------------------------------------------------------------------

/**
 * Fetch minute bars for a ticker over a date range, using market.intraday as a cache.
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
    if (rows.length > 0) {
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
        volume: 0,  // market.intraday has no volume column
      }));
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

  // 3. Cache-write to market.intraday (best-effort, batched)
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
        `INSERT OR REPLACE INTO market.intraday (ticker, date, time, open, high, low, close, bid, ask) VALUES ${chunk.join(', ')}`
      );
    }
  } catch {
    // Cache-write is best-effort — don't fail the fetch
  }

  return bars;
}
