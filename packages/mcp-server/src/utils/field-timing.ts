/**
 * Field Timing Utilities
 *
 * Derived sets and LAG CTE builder for lookahead-free market analytics.
 * All field classifications are derived from SCHEMA_DESCRIPTIONS timing annotations
 * in schema-metadata.ts -- no hardcoded column names.
 *
 * Used by downstream tools (suggest_filters, analyze_regime_performance, etc.)
 * to ensure trade-entry queries only use data available at the time of trade entry.
 */

import { SCHEMA_DESCRIPTIONS } from './schema-metadata.js';

const spxColumns = SCHEMA_DESCRIPTIONS.market.tables.spx_daily.columns;

/**
 * Fields known at or before market open (Prior_Close, Gap_Pct, VIX_Open, etc.)
 * Safe to use as same-day values in trade-entry queries.
 */
export const OPEN_KNOWN_FIELDS: ReadonlySet<string> = new Set(
  Object.entries(spxColumns)
    .filter(([, desc]) => desc.timing === 'open')
    .map(([name]) => name)
);

/**
 * Fields only known after market close (RSI_14, Vol_Regime, Close, etc.)
 * Must use LAG() to get prior trading day's value in trade-entry queries.
 */
export const CLOSE_KNOWN_FIELDS: ReadonlySet<string> = new Set(
  Object.entries(spxColumns)
    .filter(([, desc]) => desc.timing === 'close')
    .map(([name]) => name)
);

/**
 * Calendar/metadata facts known before the trading day (Day_of_Week, Month, Is_Opex).
 * Safe to use as same-day values in trade-entry queries.
 */
export const STATIC_FIELDS: ReadonlySet<string> = new Set(
  Object.entries(spxColumns)
    .filter(([, desc]) => desc.timing === 'static')
    .map(([name]) => name)
);

/**
 * Builds a SQL query that joins trade dates to spx_daily market data
 * with lookahead bias prevention:
 * - Open-known fields: used as-is (same-day values, known before market open)
 * - Static fields: used as-is (calendar facts, known in advance)
 * - Close-derived fields: LAG(field) OVER (ORDER BY date) gives prior trading day's value
 *
 * The LAG() operates on spx_daily row order, NOT calendar-day arithmetic.
 * This correctly handles weekends and holidays because spx_daily only contains
 * trading days -- Monday's LAG is Friday, post-holiday LAG is the last trading day.
 *
 * @param tradeDates - Array of trade dates in 'YYYY-MM-DD' format
 * @returns Object with `sql` (the query string) and `params` (the date values)
 */
export function buildLookaheadFreeQuery(tradeDates: string[]): { sql: string; params: string[] } {
  if (tradeDates.length === 0) {
    return { sql: `SELECT * FROM market.spx_daily WHERE 1=0`, params: [] };
  }

  // Quote all column names for safety (prevents reserved word conflicts)
  const openColumns = [...OPEN_KNOWN_FIELDS].map(f => `"${f}"`).join(', ');
  const staticColumns = [...STATIC_FIELDS].map(f => `"${f}"`).join(', ');
  const lagColumns = [...CLOSE_KNOWN_FIELDS]
    .map(field => `LAG("${field}") OVER (ORDER BY date) AS "prev_${field}"`)
    .join(',\n        ');

  const placeholders = tradeDates.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `WITH lagged AS (
      SELECT
        date,
        ${openColumns},
        ${staticColumns},
        ${lagColumns}
      FROM market.spx_daily
    )
    SELECT * FROM lagged
    WHERE date IN (${placeholders})`;

  return { sql, params: tradeDates };
}

/**
 * Builds a SQL query that returns same-day close-derived values (no LAG).
 * Used for outcome/post-hoc analysis when includeOutcomeFields=true.
 *
 * These are values that were NOT available at trade entry time --
 * they represent the end-of-day result for the trade date itself.
 *
 * @param tradeDates - Array of trade dates in 'YYYY-MM-DD' format
 * @returns Object with `sql` (the query string) and `params` (the date values)
 */
export function buildOutcomeQuery(tradeDates: string[]): { sql: string; params: string[] } {
  if (tradeDates.length === 0) {
    return { sql: `SELECT * FROM market.spx_daily WHERE 1=0`, params: [] };
  }

  const closeColumns = [...CLOSE_KNOWN_FIELDS].map(f => `"${f}"`).join(', ');
  const placeholders = tradeDates.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `SELECT date, ${closeColumns} FROM market.spx_daily WHERE date IN (${placeholders})`;
  return { sql, params: tradeDates };
}
