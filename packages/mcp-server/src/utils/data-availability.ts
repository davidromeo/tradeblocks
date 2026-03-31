/**
 * Data Availability Helper
 *
 * Checks whether market data (daily, context, intraday) is available for a
 * given ticker and returns actionable warnings when data is missing.
 *
 * Used at the start of every market tool call to surface missing data with
 * clear import instructions rather than returning silent NULLs or cryptic errors.
 */

import type { DuckDBConnection } from "@duckdb/node-api";

export interface DataAvailabilityReport {
  /** Whether market.daily has rows for the requested ticker */
  hasDailyData: boolean;
  /** Whether market.daily has VIX ticker data (normalized schema — replaces market.context check) */
  hasContextData: boolean;
  /** Whether market.intraday has rows for the requested ticker */
  hasIntradayData: boolean;
  /** Date range available in market.daily for the ticker, or null if no data */
  dailyDateRange: { min: string; max: string } | null;
  /** Date range of VIX data in market.daily, or null if no data */
  contextDateRange: { min: string; max: string } | null;
  /** Date range available in market.intraday for the ticker, or null if no data */
  intradayDateRange: { min: string; max: string } | null;
  /** Actionable warning messages for any missing data sources */
  warnings: string[];
}

/**
 * Checks data availability in market tables for the specified ticker.
 *
 * Queries COUNT, MIN(date), and MAX(date) from each relevant table.
 * Returns a report with boolean flags, date ranges, and actionable warning messages.
 *
 * @param conn - Active DuckDB connection with market catalog attached
 * @param ticker - Ticker symbol to check (e.g., 'SPX')
 * @param options.checkIntraday - Whether to also check market.intraday (default: false)
 */
export async function checkDataAvailability(
  conn: DuckDBConnection,
  ticker: string,
  options?: { checkIntraday?: boolean }
): Promise<DataAvailabilityReport> {
  const warnings: string[] = [];

  // Check market.daily for ticker
  let hasDailyData = false;
  let dailyDateRange: { min: string; max: string } | null = null;
  try {
    const dailyResult = await conn.runAndReadAll(
      `SELECT COUNT(*) as cnt, MIN(date) as min_date, MAX(date) as max_date
       FROM market.daily WHERE ticker = $1`,
      [ticker]
    );
    const rows = dailyResult.getRowObjectsJson();
    if (rows.length > 0) {
      const row = rows[0] as { cnt: number | string; min_date: string | null; max_date: string | null };
      const cnt = typeof row.cnt === 'string' ? parseInt(row.cnt, 10) : Number(row.cnt);
      hasDailyData = cnt > 0;
      if (hasDailyData && row.min_date && row.max_date) {
        dailyDateRange = { min: row.min_date, max: row.max_date };
      }
    }
  } catch {
    // market.daily table doesn't exist yet — treat as no data
  }

  if (!hasDailyData) {
    warnings.push(
      `No market.daily data for ticker ${ticker}. ` +
      `Import daily OHLCV with import_market_csv (target_table: "daily", ticker: "${ticker}") ` +
      `then run enrich_market_data.`
    );
  }

  // Check for VIX data in market.daily (normalized schema)
  let hasContextData = false;
  let contextDateRange: { min: string; max: string } | null = null;
  try {
    const contextResult = await conn.runAndReadAll(
      `SELECT COUNT(*) as cnt, MIN(date) as min_date, MAX(date) as max_date
       FROM market.daily WHERE ticker = 'VIX'`
    );
    const rows = contextResult.getRowObjectsJson();
    if (rows.length > 0) {
      const row = rows[0] as { cnt: number | string; min_date: string | null; max_date: string | null };
      const cnt = typeof row.cnt === 'string' ? parseInt(row.cnt, 10) : Number(row.cnt);
      hasContextData = cnt > 0;
      if (hasContextData && row.min_date && row.max_date) {
        contextDateRange = { min: row.min_date, max: row.max_date };
      }
    }
  } catch {
    // market.daily may not exist yet
  }

  if (!hasContextData) {
    warnings.push(
      `No VIX data in market.daily. ` +
      `Import VIX data with import_from_api (ticker: "VIX", target_table: "daily") ` +
      `or import_market_csv (target_table: "context") ` +
      `then run enrich_market_data for IVR/IVP enrichment.`
    );
  }

  // Optionally check market.intraday for ticker
  let hasIntradayData = false;
  let intradayDateRange: { min: string; max: string } | null = null;
  if (options?.checkIntraday) {
    try {
      const intradayResult = await conn.runAndReadAll(
        `SELECT COUNT(*) as cnt, MIN(date) as min_date, MAX(date) as max_date
         FROM market.intraday WHERE ticker = $1`,
        [ticker]
      );
      const rows = intradayResult.getRowObjectsJson();
      if (rows.length > 0) {
        const row = rows[0] as { cnt: number | string; min_date: string | null; max_date: string | null };
        const cnt = typeof row.cnt === 'string' ? parseInt(row.cnt, 10) : Number(row.cnt);
        hasIntradayData = cnt > 0;
        if (hasIntradayData && row.min_date && row.max_date) {
          intradayDateRange = { min: row.min_date, max: row.max_date };
        }
      }
    } catch {
      // market.intraday table doesn't exist yet — treat as no data
    }

    if (!hasIntradayData) {
      warnings.push(
        `No market.intraday data for ticker ${ticker}. ` +
        `Import intraday bars with import_market_csv (target_table: "intraday", ticker: "${ticker}").`
      );
    }
  }

  return {
    hasDailyData,
    hasContextData,
    hasIntradayData,
    dailyDateRange,
    contextDateRange,
    intradayDateRange,
    warnings,
  };
}
