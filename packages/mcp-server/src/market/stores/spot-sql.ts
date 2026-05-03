/**
 * Pure SQL builders for SpotStore reads (Market Data 3.0 — Phase 2 Wave 1).
 *
 * Every export is a pure function: given primitive inputs, it returns
 * `{ sql, params }` where `params` are positional bindings for DuckDB's
 * `$1`/`$2`/`$3` placeholders.
 *
 * Purity contract (CONTEXT.md D-05, PATTERNS.md "Pure SQL builders"):
 *   - No `this` / no `ctx` / no DB-connection value-level import
 *   - No side effects; no IO
 *   - Composable — concrete stores in Waves 2-3 feed the result to `conn.run()`
 *
 * Security note (T-2-02): user-controlled values (ticker, from, to) are bound
 * positionally. The SQL strings never interpolate untrusted text. Partition-
 * value whitelisting + positional binding together mitigate SQL injection.
 */

/**
 * Shape returned by every SQL builder: the SQL text plus the positional params
 * in $1/$2/$... order. Generic `P` lets tests assert exact tuple types when
 * useful.
 */
export interface BuiltSQL<P extends unknown[] = unknown[]> {
  sql: string;
  params: P;
}

/**
 * Read raw minute bars from `market.spot` for a ticker over a date range.
 * Results are ordered by (date, time) so callers receive a deterministic stream.
 */
export function buildReadBarsSQL(
  ticker: string,
  from: string,
  to: string,
): BuiltSQL<[string, string, string]> {
  return {
    sql: `SELECT ticker, date, time, open, high, low, close, bid, ask
          FROM market.spot
          WHERE ticker = $1 AND date >= $2 AND date <= $3
          ORDER BY date, time`,
    params: [ticker, from, to],
  };
}

/**
 * Aggregate minute bars in `market.spot` into RTH daily OHLCV rows.
 *
 * Uses DuckDB aggregate `first(col ORDER BY time)` / `last(col ORDER BY time)`
 * idioms (PATTERNS.md "rth-aggregation.ts"; RESEARCH.md Pitfall 3). Window-
 * function equivalents are explicitly avoided — they do NOT coexist with
 * `GROUP BY` and are a common source of incorrect ordering.
 */
export function buildReadDailyBarsSQL(
  ticker: string,
  from: string,
  to: string,
): BuiltSQL<[string, string, string]> {
  return {
    sql: `SELECT
            ticker,
            date,
            first(open  ORDER BY time) AS open,
            max(high)                  AS high,
            min(low)                   AS low,
            last(close  ORDER BY time) AS close,
            first(bid   ORDER BY time) AS bid,
            last(ask    ORDER BY time) AS ask
          FROM market.spot
          WHERE ticker = $1
            AND date >= $2 AND date <= $3
            AND time >= '09:30' AND time <= '16:00'
            -- Defense-in-depth: drop minute bars with zero/null OHLC
            -- before aggregating. Mirrors market.spot_daily and the direct-
            -- parquet daily-agg path. Without it, min(low) collapses to 0
            -- on contaminated minutes and propagates into enriched indicators.
            AND open  IS NOT NULL AND open  > 0
            AND high  IS NOT NULL AND high  > 0
            AND low   IS NOT NULL AND low   > 0
            AND close IS NOT NULL AND close > 0
          GROUP BY ticker, date
          ORDER BY date`,
    params: [ticker, from, to],
  };
}

/**
 * Project `(date, open)` using the RTH first-open aggregate.
 *
 * Used by the enricher Tier 2 VIX RTH open call site (RESEARCH.md "Enricher IO
 * Refactor Surface" call site 5) where only the opening tick of the VIX family
 * is needed for term-structure context computation.
 */
export function buildReadRthOpensSQL(
  ticker: string,
  from: string,
  to: string,
): BuiltSQL<[string, string, string]> {
  return {
    sql: `SELECT date, first(open ORDER BY time) AS open
          FROM market.spot
          WHERE ticker = $1
            AND date >= $2 AND date <= $3
            AND time >= '09:30' AND time <= '16:00'
            -- Defense-in-depth: drop bars with zero/null open before
            -- aggregating; first(open) could otherwise return 0 if a bad
            -- minute bar is the earliest in the session.
            AND open IS NOT NULL AND open > 0
          GROUP BY date
          ORDER BY date`,
    params: [ticker, from, to],
  };
}
