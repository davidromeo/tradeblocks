/**
 * Pure SQL builder for QuoteStore reads (Market Data 3.0 — Phase 2 Wave 1).
 *
 * Emits the multi-ticker grouped-series read pattern (CONTEXT.md D-06): one
 * partition targeted by underlying + date range, with an `IN (...)` filter over
 * the OCC ticker list. Callers are responsible for having validated that every
 * OCC ticker resolves to the same underlying (D-07); this builder trusts its
 * caller on that front.
 *
 * Param layout:
 *   $1        → underlying
 *   $2        → from (date)
 *   $3        → to   (date)
 *   $4..$N    → occTickers (variable-length IN list)
 *
 * Purity contract (CONTEXT.md D-05): pure function, no DuckDB value-level
 * imports. Tests in `tests/unit/market/stores/quote-sql.test.ts`.
 */
import type { BuiltSQL } from "./spot-sql.js";

/**
 * Build the bulk quote read. Throws if `occTickers` is empty (prevents emitting
 * an invalid `ticker IN ()` clause).
 *
 * Optional `timeStart`/`timeEnd` push an `AND time BETWEEN …` filter into SQL.
 * This is critical for prefetch where the entry-time window is often a single
 * minute: without the filter, DuckDB returns every minute bar in the
 * [from, to] range per ticker, blowing JS heap when bulking across many dates.
 */
export function buildReadQuotesSQL(
  underlying: string,
  occTickers: string[],
  from: string,
  to: string,
  opts?: { timeStart?: string; timeEnd?: string },
): BuiltSQL<string[]> {
  if (occTickers.length === 0) {
    throw new Error("buildReadQuotesSQL: occTickers must not be empty");
  }
  const timeStart = opts?.timeStart;
  const timeEnd = opts?.timeEnd;
  const hasTimeFilter = timeStart != null && timeEnd != null;
  // $1..$3: underlying + date range. Optional time filter consumes $4/$5
  // when present. OCC ticker IN-list placeholders follow.
  const timeOffset = hasTimeFilter ? 2 : 0;
  const tickerPlaceholders = occTickers
    .map((_, i) => `$${i + 4 + timeOffset}`)
    .join(", ");
  const params: string[] = [underlying, from, to];
  if (hasTimeFilter) params.push(timeStart!, timeEnd!);
  params.push(...occTickers);
  const timeClause = hasTimeFilter
    ? `AND time >= $4 AND time <= $5\n           `
    : "";
  return {
    sql: `SELECT ticker, date, time, bid, ask, mid, last_updated_ns,
                 delta, gamma, theta, vega, iv, greeks_source, greeks_revision
          FROM market.option_quote_minutes
          WHERE underlying = $1
            AND date >= $2
            AND date <= $3
            ${timeClause}AND ticker IN (${tickerPlaceholders})
          ORDER BY ticker, date, time`,
    params,
  };
}
