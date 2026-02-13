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

import { DEFAULT_MARKET_TICKER } from "./ticker.js";
import { SCHEMA_DESCRIPTIONS } from "./schema-metadata.js";

const spxColumns = SCHEMA_DESCRIPTIONS.market.tables.spx_daily.columns;

export interface MarketLookupKey {
  date: string;
  ticker: string;
}

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
 * Builds a SQL query that joins trade keys to spx_daily market data
 * with lookahead bias prevention:
 * - Open-known fields: used as-is (same-day values, known before market open)
 * - Static fields: used as-is (calendar facts, known in advance)
 * - Close-derived fields: LAG(field) OVER (ORDER BY date) gives prior trading day's value
 *
 * The LAG() operates on spx_daily row order, NOT calendar-day arithmetic.
 * For ticker-aware calls, LAG is partitioned by ticker.
 * This correctly handles weekends and holidays because spx_daily only contains
 * trading days -- Monday's LAG is Friday, post-holiday LAG is the last trading day.
 *
 * @param tradeDatesOrKeys - Array of dates or ticker+date keys
 * @returns Object with `sql` (the query string) and `params` (the date values)
 */
export function buildLookaheadFreeQuery(tradeDates: string[]): { sql: string; params: string[] };
export function buildLookaheadFreeQuery(tradeKeys: MarketLookupKey[]): { sql: string; params: string[] };
export function buildLookaheadFreeQuery(
  tradeDatesOrKeys: string[] | MarketLookupKey[]
): { sql: string; params: string[] } {
  if (tradeDatesOrKeys.length === 0) {
    return { sql: `SELECT * FROM market.spx_daily WHERE 1=0`, params: [] };
  }

  const openColumns = [...OPEN_KNOWN_FIELDS].map((f) => `"${f}"`).join(", ");
  const staticColumns = [...STATIC_FIELDS].map((f) => `"${f}"`).join(", ");

  // Legacy path for existing date-only callers.
  if (typeof tradeDatesOrKeys[0] === "string") {
    const tradeDates = tradeDatesOrKeys as string[];
    const lagColumns = [...CLOSE_KNOWN_FIELDS]
      .map((field) => `LAG("${field}") OVER (ORDER BY date) AS "prev_${field}"`)
      .join(",\n        ");

    const placeholders = tradeDates.map((_, i) => `$${i + 1}`).join(", ");
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

  const lagColumns = [...CLOSE_KNOWN_FIELDS]
    .map(
      (field) =>
        `LAG("${field}") OVER (PARTITION BY ticker ORDER BY date) AS "prev_${field}"`
    )
    .join(",\n        ");

  const sql = `WITH requested(ticker, date) AS (
      VALUES ${valuePlaceholders.join(", ")}
    ),
    lagged AS (
      SELECT
        ticker,
        date,
        ${openColumns},
        ${staticColumns},
        ${lagColumns}
      FROM market.spx_daily
      WHERE ticker IN (SELECT DISTINCT ticker FROM requested)
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
    return { sql: `SELECT * FROM market.spx_daily WHERE 1=0`, params: [] };
  }

  const closeColumns = [...CLOSE_KNOWN_FIELDS].map((f) => `"${f}"`).join(", ");

  if (typeof tradeDatesOrKeys[0] === "string") {
    const tradeDates = tradeDatesOrKeys as string[];
    const placeholders = tradeDates.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `SELECT date, ${closeColumns} FROM market.spx_daily WHERE date IN (${placeholders})`;
    return { sql, params: tradeDates };
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
    SELECT m.ticker, m.date, ${closeColumns}
    FROM market.spx_daily m
    JOIN requested
      ON m.ticker = requested.ticker
     AND m.date = requested.date`;

  return { sql, params: values };
}
