/**
 * RTH (Regular Trading Hours) aggregation helper.
 *
 * Emits a scalar subquery / derived table that rolls up minute bars in
 * `market.spot` into daily OHLCV rows over [09:30, 16:00].
 *
 * DuckDB idiom note (PATTERNS.md "rth-aggregation.ts"; RESEARCH.md Pitfall 3):
 * the canonical way to get first/last per group is the `first(col ORDER BY ...)`
 * aggregate — NEVER the window-function equivalents (which cannot be combined
 * with `GROUP BY`).
 *
 * Used by:
 *   - `enriched-sql.ts::buildReadEnrichedSQL` when `includeOhlcv=true`
 */

export interface RthWindowOpts {
  /** Index of the positional placeholder bound to the ticker (e.g. 1 → $1). */
  tickerParamIdx: number;
  /** Index of the placeholder bound to the `from` date. */
  fromParamIdx: number;
  /** Index of the placeholder bound to the `to` date. */
  toParamIdx: number;
}

/**
 * Emit a derived-table expression that produces daily OHLCV rows by aggregating
 * minute bars in `market.spot` within the RTH window.
 *
 * The caller supplies the positional `$N` indices so the subquery can share the
 * same parameters as the surrounding query (avoiding duplicate bindings when
 * embedded in, e.g., `buildReadEnrichedSQL`).
 */
export function rthDailyAggregateSubquery(opts: RthWindowOpts): string {
  const { tickerParamIdx, fromParamIdx, toParamIdx } = opts;
  return `(
    SELECT ticker, date,
           first(open  ORDER BY time) AS open,
           max(high)                  AS high,
           min(low)                   AS low,
           last(close  ORDER BY time) AS close
    FROM market.spot
    WHERE ticker = $${tickerParamIdx}
      AND date >= $${fromParamIdx} AND date <= $${toParamIdx}
      AND time >= '09:30' AND time <= '16:00'
    GROUP BY ticker, date
  )`;
}
