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
