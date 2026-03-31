/**
 * Field Timing Utilities
 *
 * Derived sets and LAG CTE builder for lookahead-free market analytics.
 * All field classifications are derived from SCHEMA_DESCRIPTIONS timing annotations
 * in schema-metadata.ts -- no hardcoded column names.
 *
 * The normalized schema splits market data into:
 *   - market.daily: per-ticker OHLCV + technical indicators (+ ivr/ivp for VIX-family)
 *   - market._context_derived: derived cross-ticker fields (Vol_Regime, Term_Structure_State, etc.)
 *   - market.context: LEGACY — preserved for backward compat but no longer the primary source
 *
 * buildLookaheadFreeQuery JOINs market.daily VIX ticker rows + market._context_derived inside a CTE
 * before applying LAG, ensuring LAG operates on the full ticker history (not just trade dates).
 * This guarantees Monday LAG returns Friday's values, not the previous trade day.
 *
 * Used by downstream tools (suggest_filters, analyze_regime_performance, etc.)
 * to ensure trade-entry queries only use data available at the time of trade entry.
 */

import { DEFAULT_MARKET_TICKER } from "./ticker.js";
import { SCHEMA_DESCRIPTIONS } from "./schema-metadata.js";

const dailyColumns = SCHEMA_DESCRIPTIONS.market.tables.daily.columns;
const derivedColumns = SCHEMA_DESCRIPTIONS.market.tables._context_derived.columns;

export interface MarketLookupKey {
  date: string;
  ticker: string;
}

// ============================================================================
// VIX field mapping — normalized schema
// ============================================================================

/**
 * VIX field mapping: column alias -> { table alias, source column, ticker, timing }
 * These are the VIX fields that downstream queries expect, mapped to the normalized schema.
 */
interface VixFieldMapping {
  alias: string;       // Column name in query output (e.g., "VIX_Close")
  tableAlias: string;  // SQL table alias (e.g., "vix")
  sourceCol: string;   // Source column in market.daily (e.g., "close")
  ticker: string;      // Ticker to join on (e.g., "VIX")
  timing: 'open' | 'close';
}

const VIX_FIELD_MAPPINGS: VixFieldMapping[] = [
  // VIX fields
  { alias: "VIX_Open",  tableAlias: "vix",  sourceCol: "open",  ticker: "VIX",  timing: "open" },
  { alias: "VIX_Close", tableAlias: "vix",  sourceCol: "close", ticker: "VIX",  timing: "close" },
  { alias: "VIX_High",  tableAlias: "vix",  sourceCol: "high",  ticker: "VIX",  timing: "close" },
  { alias: "VIX_Low",   tableAlias: "vix",  sourceCol: "low",   ticker: "VIX",  timing: "close" },
  { alias: "VIX_IVR",   tableAlias: "vix",  sourceCol: "ivr",   ticker: "VIX",  timing: "close" },
  { alias: "VIX_IVP",   tableAlias: "vix",  sourceCol: "ivp",   ticker: "VIX",  timing: "close" },
  // VIX9D fields
  { alias: "VIX9D_Open",  tableAlias: "vix9d", sourceCol: "open",  ticker: "VIX9D", timing: "open" },
  { alias: "VIX9D_Close", tableAlias: "vix9d", sourceCol: "close", ticker: "VIX9D", timing: "close" },
  { alias: "VIX9D_IVR",   tableAlias: "vix9d", sourceCol: "ivr",   ticker: "VIX9D", timing: "close" },
  { alias: "VIX9D_IVP",   tableAlias: "vix9d", sourceCol: "ivp",   ticker: "VIX9D", timing: "close" },
  // VIX3M fields
  { alias: "VIX3M_Open",  tableAlias: "vix3m", sourceCol: "open",  ticker: "VIX3M", timing: "open" },
  { alias: "VIX3M_Close", tableAlias: "vix3m", sourceCol: "close", ticker: "VIX3M", timing: "close" },
  { alias: "VIX3M_IVR",   tableAlias: "vix3m", sourceCol: "ivr",   ticker: "VIX3M", timing: "close" },
  { alias: "VIX3M_IVP",   tableAlias: "vix3m", sourceCol: "ivp",   ticker: "VIX3M", timing: "close" },
];

// Unique VIX table aliases needed for the JOIN clause
const VIX_TABLE_ALIASES = [...new Set(VIX_FIELD_MAPPINGS.map(m => m.tableAlias))];
const VIX_TICKER_FOR_ALIAS = Object.fromEntries(
  VIX_FIELD_MAPPINGS.map(m => [m.tableAlias, m.ticker])
);

// Derived fields from _context_derived
const DERIVED_OPEN_FIELDS: ReadonlySet<string> = new Set(
  Object.entries(derivedColumns)
    .filter(([, desc]) => desc.timing === 'open')
    .map(([name]) => name)
);

const DERIVED_CLOSE_FIELDS: ReadonlySet<string> = new Set(
  Object.entries(derivedColumns)
    .filter(([, desc]) => desc.timing === 'close')
    .map(([name]) => name)
);

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
 * Open-known fields from VIX tickers + _context_derived (backward-compat alias of context open fields)
 */
export const CONTEXT_OPEN_FIELDS: ReadonlySet<string> = new Set([
  ...VIX_FIELD_MAPPINGS.filter(m => m.timing === 'open').map(m => m.alias),
  ...DERIVED_OPEN_FIELDS,
]);

/**
 * Close-derived fields from VIX tickers + _context_derived (backward-compat alias of context close fields)
 */
export const CONTEXT_CLOSE_FIELDS: ReadonlySet<string> = new Set([
  ...VIX_FIELD_MAPPINGS.filter(m => m.timing === 'close').map(m => m.alias),
  ...DERIVED_CLOSE_FIELDS,
]);

// ============================================================================
// Combined field sets (for callers that don't need to know origin table)
// ============================================================================

/**
 * Fields known at or before market open (Prior_Close, Gap_Pct, VIX_Open, etc.)
 * Union of open-known fields from market.daily, VIX tickers, and _context_derived.
 * Safe to use as same-day values in trade-entry queries.
 */
export const OPEN_KNOWN_FIELDS: ReadonlySet<string> = new Set([
  ...DAILY_OPEN_FIELDS,
  ...CONTEXT_OPEN_FIELDS,
]);

/**
 * Fields only known after market close (RSI_14, Vol_Regime, Close, etc.)
 * Union of close-derived fields from market.daily, VIX tickers, and _context_derived.
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

// Build the VIX JOIN clause (three LEFT JOINs: vix, vix9d, vix3m)
function buildVixJoins(baseAlias: string = "d"): string {
  return VIX_TABLE_ALIASES
    .map(alias => `LEFT JOIN market.daily ${alias} ON ${alias}.date = ${baseAlias}.date AND ${alias}.ticker = '${VIX_TICKER_FOR_ALIAS[alias]}'`)
    .join("\n      ");
}

// SELECT columns from VIX tables: "vix"."close" AS "VIX_Close", ...
function buildVixSelectCols(): string {
  return VIX_FIELD_MAPPINGS.map(m => `${m.tableAlias}."${m.sourceCol}" AS "${m.alias}"`).join(", ");
}

// SELECT columns from _context_derived: cd."Vol_Regime", ...
function buildDerivedSelectCols(): string {
  return [...DERIVED_OPEN_FIELDS, ...DERIVED_CLOSE_FIELDS].map(f => `cd."${f}"`).join(", ");
}

/**
 * Builds a SQL query that joins trade keys to market.daily + market._context_derived + VIX tickers
 * with lookahead bias prevention:
 * - Open-known fields: used as-is (same-day values, known before market open)
 * - Static fields: used as-is (calendar facts, known in advance)
 * - Close-derived fields: LAG(field) OVER (PARTITION BY ticker ORDER BY date)
 *   gives prior trading day's value
 *
 * The JOIN pattern is:
 *   market.daily d
 *   LEFT JOIN market.daily vix ON vix.date = d.date AND vix.ticker = 'VIX'
 *   LEFT JOIN market.daily vix9d ON vix9d.date = d.date AND vix9d.ticker = 'VIX9D'
 *   LEFT JOIN market.daily vix3m ON vix3m.date = d.date AND vix3m.ticker = 'VIX3M'
 *   LEFT JOIN market._context_derived cd ON cd.date = d.date
 *
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
  const vixSelectCols = buildVixSelectCols();
  const derivedSelectCols = buildDerivedSelectCols();
  const vixJoins = buildVixJoins();

  // LAG columns — all close-derived fields from daily and VIX/derived
  const dailyLagCols = [...DAILY_CLOSE_FIELDS]
    .map((field) => `LAG("${field}") OVER (PARTITION BY ticker ORDER BY date) AS "prev_${field}"`)
    .join(",\n        ");
  const vixLagCols = VIX_FIELD_MAPPINGS
    .filter(m => m.timing === 'close')
    .map(m => `LAG("${m.alias}") OVER (PARTITION BY ticker ORDER BY date) AS "prev_${m.alias}"`)
    .join(",\n        ");
  const derivedLagCols = [...DERIVED_CLOSE_FIELDS]
    .map(f => `LAG("${f}") OVER (PARTITION BY ticker ORDER BY date) AS "prev_${f}"`)
    .join(",\n        ");

  // Pass-through columns for the lagged CTE (unaliased, from joined CTE output)
  const dailyOpenPassthrough = [...DAILY_OPEN_FIELDS].map((f) => `"${f}"`).join(", ");
  const dailyStaticPassthrough = [...DAILY_STATIC_FIELDS].map((f) => `"${f}"`).join(", ");
  const vixOpenPassthrough = VIX_FIELD_MAPPINGS
    .filter(m => m.timing === 'open')
    .map(m => `"${m.alias}"`)
    .join(", ");
  const derivedOpenPassthrough = [...DERIVED_OPEN_FIELDS].map(f => `"${f}"`).join(", ");

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
        ${vixSelectCols},
        ${derivedSelectCols ? derivedSelectCols + "," : ""}
        ${[...DAILY_CLOSE_FIELDS].map((f) => `d."${f}"`).join(", ")}
      FROM market.daily d
      ${vixJoins}
      LEFT JOIN market._context_derived cd ON cd.date = d.date
      WHERE d.ticker = $${tradeDates.length + 1}
    ),
    lagged AS (
      SELECT
        ticker,
        date,
        ${dailyOpenPassthrough},
        ${dailyStaticPassthrough},
        ${vixOpenPassthrough ? vixOpenPassthrough + "," : ""}
        ${derivedOpenPassthrough ? derivedOpenPassthrough + "," : ""}
        ${dailyLagCols},
        ${vixLagCols ? vixLagCols + "," : ""}
        ${derivedLagCols}
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
        ${vixSelectCols},
        ${derivedSelectCols ? derivedSelectCols + "," : ""}
        ${[...DAILY_CLOSE_FIELDS].map((f) => `d."${f}"`).join(", ")}
      FROM market.daily d
      ${vixJoins}
      LEFT JOIN market._context_derived cd ON cd.date = d.date
      WHERE d.ticker IN (SELECT DISTINCT ticker FROM requested)
    ),
    lagged AS (
      SELECT
        ticker,
        date,
        ${dailyOpenPassthrough},
        ${dailyStaticPassthrough},
        ${vixOpenPassthrough ? vixOpenPassthrough + "," : ""}
        ${derivedOpenPassthrough ? derivedOpenPassthrough + "," : ""}
        ${dailyLagCols},
        ${vixLagCols ? vixLagCols + "," : ""}
        ${derivedLagCols}
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
 * Sources from market.daily, VIX ticker rows, and market._context_derived via LEFT JOIN.
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

  const vixCloseCols = VIX_FIELD_MAPPINGS
    .filter(m => m.timing === 'close')
    .map(m => `${m.tableAlias}."${m.sourceCol}" AS "${m.alias}"`)
    .join(", ");
  const derivedCloseCols = [...DERIVED_CLOSE_FIELDS].map(f => `cd."${f}"`).join(", ");

  if (typeof tradeDatesOrKeys[0] === "string") {
    return buildOutcomeQueryForDates(tradeDatesOrKeys as string[], vixCloseCols, derivedCloseCols);
  }

  return buildOutcomeQueryForKeys(tradeDatesOrKeys as MarketLookupKey[], vixCloseCols, derivedCloseCols);
}

function buildOutcomeQueryForDates(
  tradeDates: string[], vixCloseCols: string, derivedCloseCols: string
): { sql: string; params: string[] } {
  const a = "d";
  const dailyCloseCols = [...DAILY_CLOSE_FIELDS].map((f) => `${a}."${f}"`).join(", ");
  const placeholders = tradeDates.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `SELECT ${a}.date, ${dailyCloseCols}, ${vixCloseCols}, ${derivedCloseCols}
    FROM market.daily ${a}
    ${buildVixJoins(a)}
    LEFT JOIN market._context_derived cd ON cd.date = ${a}.date
    WHERE ${a}.ticker = $${tradeDates.length + 1}
      AND ${a}.date IN (${placeholders})`;
  return { sql, params: [...tradeDates, DEFAULT_MARKET_TICKER] };
}

function buildOutcomeQueryForKeys(
  tradeKeys: MarketLookupKey[], vixCloseCols: string, derivedCloseCols: string
): { sql: string; params: string[] } {
  const a = "m";
  const dailyCloseCols = [...DAILY_CLOSE_FIELDS].map((f) => `${a}."${f}"`).join(", ");
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
    SELECT ${a}.ticker, ${a}.date, ${dailyCloseCols}, ${vixCloseCols}, ${derivedCloseCols}
    FROM market.daily ${a}
    ${buildVixJoins(a)}
    LEFT JOIN market._context_derived cd ON cd.date = ${a}.date
    JOIN requested
      ON ${a}.ticker = requested.ticker
     AND ${a}.date = requested.date`;

  return { sql, params: values };
}
