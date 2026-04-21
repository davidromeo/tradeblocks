/**
 * Pure SQL builder for ChainStore reads (Market Data 3.0 — Phase 2 Wave 1).
 *
 * Option chains are partitioned by (underlying, date). A single `readChain`
 * call targets exactly one partition, so the builder binds two positional
 * parameters: $1=underlying, $2=date.
 *
 * Purity contract (CONTEXT.md D-05): no `this`, no `ctx`, no DuckDB value-level
 * imports. Tests in `tests/unit/market/stores/chain-sql.test.ts`.
 */
import type { BuiltSQL } from "./spot-sql.js";

/**
 * Build the `SELECT ... FROM market.option_chain` SQL for a single underlying +
 * date partition. Results are ordered by `ticker` so consumer iteration is
 * deterministic across backends.
 */
export function buildReadChainSQL(
  underlying: string,
  date: string,
): BuiltSQL<[string, string]> {
  return {
    sql: `SELECT underlying, date, ticker, contract_type, strike, expiration, dte, exercise_style
          FROM market.option_chain
          WHERE underlying = $1 AND date = $2
          ORDER BY ticker`,
    params: [underlying, date],
  };
}

/**
 * Build a bulk read for N dates under the same underlying via `date IN (...)`.
 *
 * DuckDB's `market.option_chain` view glob-expands `option_chain/**\/*.parquet`
 * on every call — a ~430ms fixed cost even for a single-partition read. Issuing
 * one IN-list query instead of N per-date queries collapses that overhead.
 * Measured: 12 per-date reads = ~5.2s, one IN(12) read = ~0.43s (12x speedup).
 *
 * Throws when `dates` is empty (prevents `IN ()` which DuckDB rejects).
 */
export function buildReadChainDatesSQL(
  underlying: string,
  dates: string[],
): BuiltSQL<string[]> {
  if (dates.length === 0) {
    throw new Error("buildReadChainDatesSQL: dates must not be empty");
  }
  const placeholders = dates.map((_, i) => `$${i + 2}`).join(", ");
  return {
    sql: `SELECT underlying, date, ticker, contract_type, strike, expiration, dte, exercise_style
          FROM market.option_chain
          WHERE underlying = $1 AND date IN (${placeholders})
          ORDER BY date, ticker`,
    params: [underlying, ...dates],
  };
}
