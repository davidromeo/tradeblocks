/**
 * Field Timing Utilities
 *
 * Derived sets and LAG CTE builder for lookahead-free market analytics.
 * All field classifications are derived from SCHEMA_DESCRIPTIONS timing annotations
 * in schema-metadata.ts -- no hardcoded column names.
 *
 * The new normalized schema splits market data into two tables:
 *   - market.daily: per-ticker OHLCV + technical indicators
 *   - market.context: global VIX/regime data (LEFT JOIN on date)
 *
 * buildLookaheadFreeQuery JOINs both tables inside a CTE before applying LAG,
 * ensuring LAG operates on the full ticker history (not just trade dates).
 * This guarantees Monday LAG returns Friday's values, not the previous trade day.
 *
 * Used by downstream tools (suggest_filters, analyze_regime_performance, etc.)
 * to ensure trade-entry queries only use data available at the time of trade entry.
 */

import { DEFAULT_MARKET_TICKER } from "./ticker.js";
import { SCHEMA_DESCRIPTIONS } from "./schema-metadata.js";

const dailyColumns = SCHEMA_DESCRIPTIONS.market.tables.daily.columns;
const contextColumns = SCHEMA_DESCRIPTIONS.market.tables.context.columns;

export interface MarketLookupKey {
  date: string;
  ticker: string;
}

// ============================================================================
// Table-specific field sets (needed by CTE builder to know which table to alias)
// ============================================================================

/**
 * Open-known fields from market.daily (use as d.{field} in JOIN CTE)
 */
export const DAILY_OPEN_FIELDS: ReadonlySet<string> = new Set(
  Object.entries(dailyColumns)
    .filter(([, desc]) => desc.timing === 'open')
    .map(([name]) => name)
);

/**
 * Close-derived fields from market.daily (apply LAG as d.{field} in JOIN CTE)
 */
export const DAILY_CLOSE_FIELDS: ReadonlySet<string> = new Set(
  Object.entries(dailyColumns)
    .filter(([, desc]) => desc.timing === 'close')
    .map(([name]) => name)
);

/**
 * Static fields from market.daily (use as d.{field} in JOIN CTE — calendar facts)
 */
export const DAILY_STATIC_FIELDS: ReadonlySet<string> = new Set(
  Object.entries(dailyColumns)
    .filter(([, desc]) => desc.timing === 'static')
    .map(([name]) => name)
);

/**
 * Open-known fields from market.context (use as c.{field} in JOIN CTE)
 */
export const CONTEXT_OPEN_FIELDS: ReadonlySet<string> = new Set(
  Object.entries(contextColumns)
    .filter(([, desc]) => desc.timing === 'open')
    .map(([name]) => name)
);

/**
 * Close-derived fields from market.context (apply LAG as c.{field} in JOIN CTE)
 */
export const CONTEXT_CLOSE_FIELDS: ReadonlySet<string> = new Set(
  Object.entries(contextColumns)
    .filter(([, desc]) => desc.timing === 'close')
    .map(([name]) => name)
);

// ============================================================================
// Combined field sets (for callers that don't need to know origin table)
// ============================================================================

/**
 * Fields known at or before market open (Prior_Close, Gap_Pct, VIX_Open, etc.)
 * Union of open-known fields from both market.daily and market.context.
 * Safe to use as same-day values in trade-entry queries.
 */
export const OPEN_KNOWN_FIELDS: ReadonlySet<string> = new Set([
  ...DAILY_OPEN_FIELDS,
  ...CONTEXT_OPEN_FIELDS,
]);

/**
 * Fields only known after market close (RSI_14, Vol_Regime, Close, etc.)
 * Union of close-derived fields from both market.daily and market.context.
 * Must use LAG() to get prior trading day's value in trade-entry queries.
 */
export const CLOSE_KNOWN_FIELDS: ReadonlySet<string> = new Set([
  ...DAILY_CLOSE_FIELDS,
  ...CONTEXT_CLOSE_FIELDS,
]);

/**
 * Calendar/metadata facts known before the trading day (Day_of_Week, Month, Is_Opex).
 * Only from market.daily (context has no static fields).
 * Safe to use as same-day values in trade-entry queries.
 */
export const STATIC_FIELDS: ReadonlySet<string> = new Set([
  ...DAILY_STATIC_FIELDS,
]);

// ============================================================================
// Query Builders
// ============================================================================

/**
 * Builds a SQL query that joins trade keys to market.daily + market.context
 * with lookahead bias prevention:
 * - Open-known fields: used as-is (same-day values, known before market open)
 * - Static fields: used as-is (calendar facts, known in advance)
 * - Close-derived fields: LAG(field) OVER (PARTITION BY ticker ORDER BY date)
 *   gives prior trading day's value
 *
 * The JOIN pattern is: market.daily d LEFT JOIN market.context c ON d.date = c.date
 * LAG operates on the FULL ticker history (all trading days for the ticker),
 * NOT just the requested dates. This ensures LAG sees the correct prior trading day
 * across weekends, holidays, and sparse trading strategies.
 *
 * @param tradeDatesOrKeys - Array of dates (legacy string[] overload) or ticker+date keys
 * @returns Object with `sql` (the query string) and `params` (the parameter values)
 */
export function buildLookaheadFreeQuery(tradeDates: string[]): { sql: string; params: string[] };
export function buildLookaheadFreeQuery(tradeKeys: MarketLookupKey[]): { sql: string; params: string[] };
export function buildLookaheadFreeQuery(
  tradeDatesOrKeys: string[] | MarketLookupKey[]
): { sql: string; params: string[] } {
  if (tradeDatesOrKeys.length === 0) {
    return { sql: `SELECT * FROM market.daily WHERE 1=0`, params: [] };
  }

  // Build field lists for the joined CTE
  const dailyOpenCols = [...DAILY_OPEN_FIELDS].map((f) => `d."${f}"`).join(", ");
  const dailyStaticCols = [...DAILY_STATIC_FIELDS].map((f) => `d."${f}"`).join(", ");
  const contextOpenCols = [...CONTEXT_OPEN_FIELDS].map((f) => `c."${f}"`).join(", ");

  // LAG columns — all close-derived fields from both tables
  const dailyLagCols = [...DAILY_CLOSE_FIELDS]
    .map((field) => `LAG("${field}") OVER (PARTITION BY ticker ORDER BY date) AS "prev_${field}"`)
    .join(",\n        ");
  const contextLagCols = [...CONTEXT_CLOSE_FIELDS]
    .map((field) => `LAG("${field}") OVER (PARTITION BY ticker ORDER BY date) AS "prev_${field}"`)
    .join(",\n        ");

  // Pass-through columns for the lagged CTE (unaliased, from joined CTE output)
  const dailyOpenPassthrough = [...DAILY_OPEN_FIELDS].map((f) => `"${f}"`).join(", ");
  const dailyStaticPassthrough = [...DAILY_STATIC_FIELDS].map((f) => `"${f}"`).join(", ");
  const contextOpenPassthrough = [...CONTEXT_OPEN_FIELDS].map((f) => `"${f}"`).join(", ");

  // Legacy path for existing date-only callers (single ticker = DEFAULT_MARKET_TICKER)
  if (typeof tradeDatesOrKeys[0] === "string") {
    const tradeDates = tradeDatesOrKeys as string[];
    const placeholders = tradeDates.map((_, i) => `$${i + 1}`).join(", ");

    const sql = `WITH joined AS (
      SELECT
        d.ticker,
        d.date,
        ${dailyOpenCols},
        ${dailyStaticCols},
        ${contextOpenCols},
        ${[...DAILY_CLOSE_FIELDS].map((f) => `d."${f}"`).join(", ")},
        ${[...CONTEXT_CLOSE_FIELDS].map((f) => `c."${f}"`).join(", ")}
      FROM market.daily d
      LEFT JOIN market.context c ON d.date = c.date
      WHERE d.ticker = $${tradeDates.length + 1}
    ),
    lagged AS (
      SELECT
        ticker,
        date,
        ${dailyOpenPassthrough},
        ${dailyStaticPassthrough},
        ${contextOpenPassthrough},
        ${dailyLagCols},
        ${contextLagCols}
      FROM joined
    )
    SELECT * FROM lagged
    WHERE date IN (${placeholders})`;

    return { sql, params: [...tradeDates, DEFAULT_MARKET_TICKER] };
  }

  const tradeKeys = tradeDatesOrKeys as MarketLookupKey[];
  const normalizedKeys = tradeKeys.map((k) => ({
    date: k.date,
    ticker: k.ticker || DEFAULT_MARKET_TICKER,
  }));

  const values: string[] = [];
  const valuePlaceholders = normalizedKeys.map((key) => {
    values.push(key.ticker, key.date);
    return `($${values.length - 1}, $${values.length})`;
  });

  const sql = `WITH requested(ticker, date) AS (
      VALUES ${valuePlaceholders.join(", ")}
    ),
    joined AS (
      SELECT
        d.ticker,
        d.date,
        ${dailyOpenCols},
        ${dailyStaticCols},
        ${contextOpenCols},
        ${[...DAILY_CLOSE_FIELDS].map((f) => `d."${f}"`).join(", ")},
        ${[...CONTEXT_CLOSE_FIELDS].map((f) => `c."${f}"`).join(", ")}
      FROM market.daily d
      LEFT JOIN market.context c ON d.date = c.date
      WHERE d.ticker IN (SELECT DISTINCT ticker FROM requested)
    ),
    lagged AS (
      SELECT
        ticker,
        date,
        ${dailyOpenPassthrough},
        ${dailyStaticPassthrough},
        ${contextOpenPassthrough},
        ${dailyLagCols},
        ${contextLagCols}
      FROM joined
    )
    SELECT lagged.*
    FROM lagged
    JOIN requested
      ON lagged.ticker = requested.ticker
     AND lagged.date = requested.date`;

  return { sql, params: values };
}

/**
 * Builds a SQL query that returns same-day close-derived values (no LAG).
 * Used for outcome/post-hoc analysis when includeOutcomeFields=true.
 *
 * These are values that were NOT available at trade entry time --
 * they represent the end-of-day result for the trade date itself.
 * Sources from both market.daily and market.context via LEFT JOIN.
 *
 * @param tradeDatesOrKeys - Array of dates or ticker+date keys
 * @returns Object with `sql` (the query string) and `params` (the date values)
 */
export function buildOutcomeQuery(tradeDates: string[]): { sql: string; params: string[] };
export function buildOutcomeQuery(tradeKeys: MarketLookupKey[]): { sql: string; params: string[] };
export function buildOutcomeQuery(
  tradeDatesOrKeys: string[] | MarketLookupKey[]
): { sql: string; params: string[] } {
  if (tradeDatesOrKeys.length === 0) {
    return { sql: `SELECT * FROM market.daily WHERE 1=0`, params: [] };
  }

  const dailyCloseCols = [...DAILY_CLOSE_FIELDS].map((f) => `d."${f}"`).join(", ");
  const contextCloseCols = [...CONTEXT_CLOSE_FIELDS].map((f) => `c."${f}"`).join(", ");

  if (typeof tradeDatesOrKeys[0] === "string") {
    const tradeDates = tradeDatesOrKeys as string[];
    const placeholders = tradeDates.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `SELECT d.date, ${dailyCloseCols}, ${contextCloseCols}
    FROM market.daily d
    LEFT JOIN market.context c ON d.date = c.date
    WHERE d.ticker = $${tradeDates.length + 1}
      AND d.date IN (${placeholders})`;
    return { sql, params: [...tradeDates, DEFAULT_MARKET_TICKER] };
  }

  const tradeKeys = tradeDatesOrKeys as MarketLookupKey[];
  const normalizedKeys = tradeKeys.map((k) => ({
    date: k.date,
    ticker: k.ticker || DEFAULT_MARKET_TICKER,
  }));

  const values: string[] = [];
  const valuePlaceholders = normalizedKeys.map((key) => {
    values.push(key.ticker, key.date);
    return `($${values.length - 1}, $${values.length})`;
  });

  const sql = `WITH requested(ticker, date) AS (
      VALUES ${valuePlaceholders.join(", ")}
    )
    SELECT m.ticker, m.date, ${dailyCloseCols}, ${contextCloseCols}
    FROM market.daily m
    LEFT JOIN market.context c ON m.date = c.date
    JOIN requested
      ON m.ticker = requested.ticker
     AND m.date = requested.date`;

  return { sql, params: values };
}
