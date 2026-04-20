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
 */
export function buildReadQuotesSQL(
  underlying: string,
  occTickers: string[],
  from: string,
  to: string,
): BuiltSQL<string[]> {
  if (occTickers.length === 0) {
    throw new Error("buildReadQuotesSQL: occTickers must not be empty");
  }
  // Build $4, $5, ... for the IN list. The first three placeholders are the
  // underlying + date range; OCC ticker placeholders start at $4.
  const tickerPlaceholders = occTickers.map((_, i) => `$${i + 4}`).join(", ");
  return {
    sql: `SELECT ticker, date, time, bid, ask, mid, last_updated_ns
          FROM market.option_quote_minutes
          WHERE underlying = $1
            AND date >= $2
            AND date <= $3
            AND ticker IN (${tickerPlaceholders})
          ORDER BY ticker, date, time`,
    params: [underlying, from, to, ...occTickers],
  };
}
