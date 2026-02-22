/**
 * Market Data Tools
 *
 * MCP tools for analyzing market context (VIX, term structure, regimes)
 * and correlating with trade performance. Includes enrich_trades for
 * lag-aware trade enrichment with market data.
 *
 * Data source: DuckDB analytics database (synced from TradingView exports)
 * - market.daily: Per-ticker OHLCV + technical indicators (normalized schema)
 * - market.context: Global VIX/regime data (LEFT JOIN on date with market.daily)
 * - market.intraday: Raw 15-minute bars (ticker, date, time HH:MM, OHLCV)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock } from "../utils/block-loader.js";
import {
  createToolOutput,
  formatPercent,
} from "../utils/output-formatter.js";
import type { Trade } from "@tradeblocks/lib";
import { getConnection } from "../db/connection.js";
import { withFullSync } from "./middleware/sync-middleware.js";
import {
  buildLookaheadFreeQuery,
  buildOutcomeQuery,
  type MarketLookupKey,
  OPEN_KNOWN_FIELDS,
  CLOSE_KNOWN_FIELDS,
  STATIC_FIELDS,
} from "../utils/field-timing.js";
import { filterByStrategy, filterByDateRange } from "./shared/filters.js";
import {
  buildIntradayContext,
  SPX_15MIN_OUTCOME_FIELDS,
  VIX_OUTCOME_FIELDS,
  VIX_OHLC_OUTCOME_FIELDS,
  SPX_CHECKPOINTS,
  VIX_CHECKPOINTS,
} from "../utils/intraday-timing.js";
import {
  DEFAULT_MARKET_TICKER,
  GLOBAL_MARKET_TICKER,
  marketTickerDateKey,
  normalizeTicker,
  resolveTradeTicker,
} from "../utils/ticker.js";
import { checkDataAvailability } from "../utils/data-availability.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Daily market data columns sourced from market.daily + market.context (normalized schema).
 * Kept as documentation reference for the new dual-table JOIN pattern.
 *
 * market.daily: Per-ticker OHLCV + technical indicators (Gap_Pct, ATR_Pct, RSI_14, BB_Width, etc.)
 * market.context: Global VIX/regime data (VIX_Open, VIX_Close, Vol_Regime, Term_Structure_State, etc.)
 *
 * Field timing:
 * - Open-known (safe for trade-entry analysis): Prior_Close, Gap_Pct, VIX_Open, VIX_Gap_Pct, Prior_Range_vs_ATR
 * - Close-derived (use LAG for trade-entry queries): Close, RSI_14, BB_Width, Realized_Vol_5D/20D,
 *   VIX_Close, Vol_Regime, Term_Structure_State, VIX_Spike_Pct, etc.
 * - Static (calendar facts): Day_of_Week, Month, Is_Opex
 */
export interface DailyMarketData {
  date: string; // YYYY-MM-DD
  ticker: string;
  // Core price (market.daily)
  Prior_Close: number; // open-known
  Open: number;
  High: number;
  Low: number;
  Close: number;
  // Gap & movement (market.daily)
  Gap_Pct: number; // open-known
  Prior_Range_vs_ATR: number; // open-known: prior day's (high-low)/ATR
  Intraday_Range_Pct: number;
  Intraday_Return_Pct: number;
  Close_Position_In_Range: number;
  Gap_Filled: number; // 0 or 1
  // New enrichment fields (market.daily)
  BB_Width: number; // (upper - lower) / middle
  BB_Position: number; // 0-1
  Realized_Vol_5D: number;
  Realized_Vol_20D: number;
  // Technical (market.daily)
  ATR_Pct: number;
  RSI_14: number;
  Price_vs_EMA21_Pct: number;
  Price_vs_SMA50_Pct: number;
  // Momentum (market.daily)
  Return_5D: number;
  Return_20D: number;
  Consecutive_Days: number;
  Prev_Return_Pct: number;
  // Calendar (market.daily, static)
  Day_of_Week: number; // 2=Mon...6=Fri
  Month: number;
  Is_Opex: number; // 0 or 1
  // VIX (market.context)
  VIX_Open: number; // open-known
  VIX_Gap_Pct: number; // open-known
  VIX_Close: number;
  VIX_Change_Pct: number;
  VIX_Spike_Pct: number;
  VIX_Percentile: number;
  Vol_Regime: number; // 1-6
  // VIX term structure (market.context)
  VIX9D_Close: number;
  VIX3M_Close: number;
  VIX9D_VIX_Ratio: number;
  VIX_VIX3M_Ratio: number;
  Term_Structure_State: number; // -1, 0, 1
}

/**
 * Intraday data is now stored in market.intraday (normalized: one row per bar).
 * Schema: (ticker VARCHAR, date DATE, time VARCHAR -- HH:MM format, open, high, low, close, volume)
 * Primary key: (ticker, date, time)
 *
 * To query as wide-format checkpoints for a specific date, pivot using CASE WHEN:
 *   SELECT date,
 *     MAX(CASE WHEN time = '09:30' THEN close END) AS P_0930,
 *     MAX(CASE WHEN time = '09:45' THEN close END) AS P_0945,
 *     ... etc ...
 *   FROM market.intraday
 *   WHERE ticker = 'SPX' AND date = '2024-01-15'
 *   GROUP BY date
 *
 * Note: Intraday data import is blocked by format incompatibility (separate date/time
 * columns required but current export CSVs use a single Unix timestamp column).
 * Tools that use intraday context will return null for all trades until resolved.
 */

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format trade date to YYYY-MM-DD for matching.
 * Trades are stored in Eastern Time, so we format in that timezone.
 */
function formatTradeDate(date: Date | string): string {
  if (typeof date === "string") {
    // String dates are already in YYYY-MM-DD or similar calendar-date format.
    // Parse components directly to avoid UTC-to-ET timezone shift.
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = typeof date === "string" ? new Date(date) : date;
  // For Date objects, use local date components (trades are stored in ET)
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert DuckDB query result to an array of Record objects.
 * Handles BigInt to Number conversion for JSON compatibility.
 */
function resultToRecords(result: { columnCount: number; columnName(i: number): string; getRows(): Iterable<unknown[]> }): Record<string, unknown>[] {
  const columnCount = result.columnCount;
  const colNames: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    colNames.push(result.columnName(i));
  }
  const records: Record<string, unknown>[] = [];
  for (const row of result.getRows()) {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < columnCount; i++) {
      const val = row[i];
      record[colNames[i]] = typeof val === "bigint" ? Number(val) : val;
    }
    records.push(record);
  }
  return records;
}

/**
 * Get a numeric value from a DuckDB record, handling null/undefined/BigInt.
 * Returns NaN for null/undefined (matching behavior of parseNum for missing CSV values).
 */
function getNum(record: Record<string, unknown>, field: string): number {
  const val = record[field];
  if (val === null || val === undefined) return NaN;
  if (typeof val === "bigint") return Number(val);
  return val as number;
}

function getTradeLookupKey(trade: Trade): MarketLookupKey {
  return {
    date: formatTradeDate(trade.dateOpened),
    ticker: resolveTradeTicker(trade, DEFAULT_MARKET_TICKER),
  };
}

function uniqueTradeLookupKeys(trades: Trade[]): MarketLookupKey[] {
  const byKey = new Map<string, MarketLookupKey>();
  for (const trade of trades) {
    const lookup = getTradeLookupKey(trade);
    byKey.set(marketTickerDateKey(lookup.ticker, lookup.date), lookup);
  }
  return Array.from(byKey.values());
}

function recordsByTickerDate(
  records: Record<string, unknown>[]
): Map<string, Record<string, unknown>> {
  const mapped = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    const date = String(record["date"] || "");
    const ticker = String(record["ticker"] || DEFAULT_MARKET_TICKER);
    mapped.set(marketTickerDateKey(ticker, date), record);
  }
  return mapped;
}

function buildRequestedPairsClause(
  keys: MarketLookupKey[]
): { valuesClause: string; params: string[] } {
  const params: string[] = [];
  const rows = keys.map((key) => {
    params.push(key.ticker, key.date);
    return `($${params.length - 1}, $${params.length})`;
  });
  return { valuesClause: rows.join(", "), params };
}

/**
 * Get volatility regime label
 */
function getVolRegimeLabel(regime: number): string {
  const labels: Record<number, string> = {
    1: "Very Low (VIX < 13)",
    2: "Low (VIX 13-16)",
    3: "Normal (VIX 16-20)",
    4: "Elevated (VIX 20-25)",
    5: "High (VIX 25-30)",
    6: "Extreme (VIX > 30)",
  };
  return labels[regime] || `Unknown (${regime})`;
}

/**
 * Get term structure label
 */
function getTermStructureLabel(state: number): string {
  if (state === -1) return "Backwardation";
  if (state === 0) return "Flat";
  if (state === 1) return "Contango";
  return `Unknown (${state})`;
}

/**
 * Get day of week label
 */
function getDayLabel(dow: number): string {
  const labels: Record<number, string> = {
    2: "Monday",
    3: "Tuesday",
    4: "Wednesday",
    5: "Thursday",
    6: "Friday",
  };
  return labels[dow] || `Day ${dow}`;
}

// =============================================================================
// Tool Registration
// =============================================================================

/**
 * Register market data analysis tools.
 *
 * Note: The following tools were REMOVED in v0.6.0 - use run_sql instead:
 * - get_market_context: SELECT ... FROM market.spx_daily WHERE ...
 * - find_similar_days: Use CTE with similarity conditions
 *
 * Restored in v1.1.0 with lookahead-free temporal joins:
 * - enrich_trades: Returns trades enriched with lag-aware market context
 *
 * Kept tools (require TradeBlocks library computation):
 * - analyze_regime_performance: Statistical breakdown by regime
 * - suggest_filters: Complex filter testing with projected impact
 * - calculate_orb: Opening Range Breakout calculation from 15min checkpoints
 */
export function registerMarketDataTools(server: McpServer, baseDir: string): void {
  // ---------------------------------------------------------------------------
  // analyze_regime_performance - Break down performance by market regime
  // ---------------------------------------------------------------------------
  server.registerTool(
    "analyze_regime_performance",
    {
      description:
        "Break down a block's trade performance by market regime using market.daily and market.context. " +
        "Identifies which market conditions favor or hurt the strategy. " +
        "Close-derived fields (volRegime, termStructure) use prior trading day values to prevent lookahead bias. " +
        "Vol_Regime and Term_Structure_State come from market.context via the JOIN. " +
        "Returns warnings when market data is partially missing.",
      inputSchema: z.object({
        blockId: z.string().describe("Block ID to analyze"),
        segmentBy: z.enum([
          "volRegime",
          "termStructure",
          "dayOfWeek",
          "gapDirection",
        ]).describe("Market dimension to segment by"),
        strategy: z.string().optional().describe("Filter to specific strategy"),
        ticker: z.string().optional().describe("Underlying ticker symbol (default: SPX)"),
      }),
    },
    withFullSync(baseDir, async ({ blockId, segmentBy, strategy, ticker }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        if (strategy) {
          trades = trades.filter(
            (t) => t.strategy.toLowerCase() === strategy.toLowerCase()
          );
        }

        if (trades.length === 0) {
          return {
            content: [{ type: "text", text: "No trades found" }],
            isError: true,
          };
        }

        // Collect unique trade keys (ticker+date) and query DuckDB for market data
        const tradeKeys = uniqueTradeLookupKeys(trades);

        const conn = await getConnection(baseDir);

        // Check data availability and collect warnings
        const resolvedTicker = normalizeTicker(ticker || '') || DEFAULT_MARKET_TICKER;
        const availability = await checkDataAvailability(conn, resolvedTicker);

        const { sql: lagSql, params: lagParams } = buildLookaheadFreeQuery(tradeKeys);
        const dailyResult = await conn.runAndReadAll(lagSql, lagParams);
        const dailyRecords = resultToRecords(dailyResult);
        const daily = recordsByTickerDate(dailyRecords);

        // Match trades to market data and segment
        interface SegmentStats {
          segment: string;
          segmentValue: number | string;
          trades: { pl: number; isWin: boolean }[];
        }

        const segments = new Map<string, SegmentStats>();
        let totalMatched = 0;
        let totalWins = 0;
        let totalPl = 0;
        let lagExcluded = 0;
        const unmatchedDates: string[] = [];

        for (const trade of trades) {
          const lookup = getTradeLookupKey(trade);
          const marketData = daily.get(marketTickerDateKey(lookup.ticker, lookup.date));

          if (!marketData) {
            unmatchedDates.push(`${lookup.date}|${lookup.ticker}`);
            continue;
          }

          // Get segment value (must resolve before counting in totals,
          // since lagged fields may be NaN and cause continue)
          const isWin = trade.pl > 0;
          let segmentKey: string;
          let segmentLabel: string;
          let segmentValue: number | string;

          switch (segmentBy) {
            case "volRegime": {
              const val = getNum(marketData, "prev_Vol_Regime");
              if (isNaN(val)) { lagExcluded++; continue; }
              segmentValue = val;
              segmentKey = String(val);
              segmentLabel = getVolRegimeLabel(val);
              break;
            }
            case "termStructure": {
              const val = getNum(marketData, "prev_Term_Structure_State");
              if (isNaN(val)) { lagExcluded++; continue; }
              segmentValue = val;
              segmentKey = String(val);
              segmentLabel = getTermStructureLabel(val);
              break;
            }
            case "dayOfWeek":
              segmentValue = getNum(marketData, "Day_of_Week");
              segmentKey = String(segmentValue);
              segmentLabel = getDayLabel(getNum(marketData, "Day_of_Week"));
              break;
            case "gapDirection": {
              const gapPct = getNum(marketData, "Gap_Pct");
              if (isNaN(gapPct)) { lagExcluded++; continue; }
              segmentValue = gapPct > 0.1 ? "up" : gapPct < -0.1 ? "down" : "flat";
              segmentKey = segmentValue;
              segmentLabel = `Gap ${segmentValue}`;
              break;
            }
            default:
              continue;
          }

          // Count in totals only after segment resolved (NaN-lag trades excluded)
          totalMatched++;
          if (isWin) totalWins++;
          totalPl += trade.pl;

          if (!segments.has(segmentKey)) {
            segments.set(segmentKey, {
              segment: segmentLabel,
              segmentValue,
              trades: [],
            });
          }

          segments.get(segmentKey)!.trades.push({ pl: trade.pl, isWin });
        }

        if (totalMatched === 0) {
          return {
            content: [{ type: "text", text: "No trades matched to market data" }],
            isError: true,
          };
        }

        // Calculate overall stats
        const overallWinRate = (totalWins / totalMatched) * 100;
        const overallAvgPl = totalPl / totalMatched;

        // Calculate segment stats
        const segmentStats = Array.from(segments.values())
          .map((seg) => {
            const wins = seg.trades.filter((t) => t.isWin).length;
            const losses = seg.trades.length - wins;
            const winRate = (wins / seg.trades.length) * 100;
            const totalSegPl = seg.trades.reduce((sum, t) => sum + t.pl, 0);
            const avgPl = totalSegPl / seg.trades.length;

            const winningTrades = seg.trades.filter((t) => t.isWin);
            const losingTrades = seg.trades.filter((t) => !t.isWin);
            const avgWin = winningTrades.length > 0
              ? winningTrades.reduce((sum, t) => sum + t.pl, 0) / winningTrades.length
              : 0;
            const avgLoss = losingTrades.length > 0
              ? losingTrades.reduce((sum, t) => sum + t.pl, 0) / losingTrades.length
              : 0;

            const grossWins = winningTrades.reduce((sum, t) => sum + t.pl, 0);
            const grossLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pl, 0));
            const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? null : 0;

            return {
              segment: seg.segment,
              segmentValue: seg.segmentValue,
              tradeCount: seg.trades.length,
              wins,
              losses,
              winRate: Math.round(winRate * 100) / 100,
              totalPl: Math.round(totalSegPl * 100) / 100,
              avgPl: Math.round(avgPl * 100) / 100,
              avgWin: Math.round(avgWin * 100) / 100,
              avgLoss: Math.round(avgLoss * 100) / 100,
              profitFactor: profitFactor !== null ? Math.round(profitFactor * 100) / 100 : null,
              vsOverallWinRate: Math.round((winRate - overallWinRate) * 100) / 100,
              vsOverallAvgPl: Math.round((avgPl - overallAvgPl) * 100) / 100,
            };
          })
          .sort((a, b) => {
            // Sort by segment value for consistent ordering
            if (typeof a.segmentValue === "number" && typeof b.segmentValue === "number") {
              return a.segmentValue - b.segmentValue;
            }
            return String(a.segmentValue).localeCompare(String(b.segmentValue));
          });

        const sortedUnmatchedDates = [...new Set(unmatchedDates)].sort();

        const summary = `Regime analysis: ${blockId} by ${segmentBy} | ${totalMatched} trades across ${segmentStats.length} segments`;

        const laggedSegments = ["volRegime", "termStructure"];
        const lagNote = laggedSegments.includes(segmentBy)
          ? `Segmentation by ${segmentBy} uses prior trading day values (close-derived field from market.context) to prevent lookahead bias.`
          : `Segmentation by ${segmentBy} uses same-day values (${segmentBy === "dayOfWeek" ? "static" : "open-known"} field).`;

        // Future: BB_Width quartile and Realized_Vol regime segmentation dimensions can be added here

        const responseData: Record<string, unknown> = {
          blockId,
          segmentBy,
          lagNote,
          strategy: strategy || null,
          tradesTotal: trades.length,
          tradesMatched: totalMatched,
          tradesUnmatched: unmatchedDates.length,
          tradesLagExcluded: lagExcluded,
          unmatchedDates: sortedUnmatchedDates,
          overall: {
            winRate: Math.round(overallWinRate * 100) / 100,
            avgPl: Math.round(overallAvgPl * 100) / 100,
            totalPl: Math.round(totalPl * 100) / 100,
          },
          segments: segmentStats,
        };

        if (availability.warnings.length > 0) {
          responseData.warnings = availability.warnings;
        }

        return createToolOutput(summary, responseData);
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    })
  );

  // ---------------------------------------------------------------------------
  // suggest_filters - Analyze losing trades and suggest market-based filters
  // ---------------------------------------------------------------------------
  server.registerTool(
    "suggest_filters",
    {
      description:
        "Analyze a block's losing trades and suggest market-based filters that would have improved performance. " +
        "Returns actionable standalone filter suggestions plus composite filters where cross-field correlations are strong. " +
        "Close-derived fields (VIX_Close, Vol_Regime, RSI_14, BB_Width, Realized_Vol_5D/20D, BB_Position) use prior trading day values. " +
        "Open-known fields (Gap_Pct, VIX_Open, VIX_Gap_Pct, Prior_Range_vs_ATR, Day_of_Week, Is_Opex) use same-day values. " +
        "Uses market.daily and market.context via JOIN. Returns warnings when market data is partially missing.",
      inputSchema: z.object({
        blockId: z.string().describe("Block ID to analyze"),
        strategy: z.string().optional().describe("Filter to specific strategy"),
        minImprovementPct: z.number().optional().describe("Only suggest filters with >= X% win rate improvement (default: 3)"),
        ticker: z.string().optional().describe("Underlying ticker symbol (default: SPX)"),
      }),
    },
    withFullSync(baseDir, async ({ blockId, strategy, minImprovementPct = 3, ticker }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        if (strategy) {
          trades = trades.filter(
            (t) => t.strategy.toLowerCase() === strategy.toLowerCase()
          );
        }

        if (trades.length === 0) {
          return {
            content: [{ type: "text", text: "No trades found" }],
            isError: true,
          };
        }

        // Collect unique trade keys (ticker+date) and query DuckDB for market data
        const tradeKeys = uniqueTradeLookupKeys(trades);

        const conn = await getConnection(baseDir);

        // Check data availability and collect warnings
        const resolvedTickerSF = normalizeTicker(ticker || '') || DEFAULT_MARKET_TICKER;
        const availabilitySF = await checkDataAvailability(conn, resolvedTickerSF);

        const { sql, params } = buildLookaheadFreeQuery(tradeKeys);
        const dailyResult = await conn.runAndReadAll(sql, params);
        const dailyRecords = resultToRecords(dailyResult);
        const daily = recordsByTickerDate(dailyRecords);

        // Match trades to market data
        interface EnrichedTrade {
          trade: Trade;
          market: Record<string, unknown> | null;
        }

        const enrichedTrades: EnrichedTrade[] = trades.map((trade) => {
          const lookup = getTradeLookupKey(trade);
          return {
            trade,
            market:
              daily.get(marketTickerDateKey(lookup.ticker, lookup.date)) || null,
          };
        });

        const matchedTrades = enrichedTrades.filter((t) => t.market !== null);

        if (matchedTrades.length < 10) {
          return {
            content: [{ type: "text", text: "Not enough trades matched to market data for analysis (need at least 10)" }],
            isError: true,
          };
        }

        // Calculate current stats
        const currentWins = matchedTrades.filter((t) => t.trade.pl > 0).length;
        const currentWinRate = (currentWins / matchedTrades.length) * 100;
        const currentTotalPl = matchedTrades.reduce((sum, t) => sum + t.trade.pl, 0);

        // Test various filters
        interface FilterSuggestion {
          filter: string;
          condition: {
            field: string;
            operator: string;
            value: number | number[] | string;
            lagged: boolean;
          };
          tradesRemoved: number;
          winnersRemoved: number;
          losersRemoved: number;
          newWinRate: number;
          newTotalPl: number;
          winRateDelta: number;
          plDelta: number;
          confidence: "high" | "medium" | "low";
        }

        const suggestions: FilterSuggestion[] = [];

        // Test filter functions
        const testFilters: Array<{
          name: string;
          field: string;
          operator: string;
          value: number | number[] | string;
          test: (m: Record<string, unknown>) => boolean;
          lagged: boolean;
        }> = [
          // Open-known filters (same-day values)
          // Gap filters
          { name: "Skip when |Gap_Pct| > 0.5%", field: "Gap_Pct", operator: ">", value: 0.5, test: (m) => Math.abs(getNum(m, "Gap_Pct")) > 0.5, lagged: false },
          { name: "Skip when |Gap_Pct| > 0.8%", field: "Gap_Pct", operator: ">", value: 0.8, test: (m) => Math.abs(getNum(m, "Gap_Pct")) > 0.8, lagged: false },
          { name: "Skip when |Gap_Pct| > 1.0%", field: "Gap_Pct", operator: ">", value: 1.0, test: (m) => Math.abs(getNum(m, "Gap_Pct")) > 1.0, lagged: false },
          // Day of week
          { name: "Skip Fridays", field: "Day_of_Week", operator: "==", value: 6, test: (m) => getNum(m, "Day_of_Week") === 6, lagged: false },
          { name: "Skip Mondays", field: "Day_of_Week", operator: "==", value: 2, test: (m) => getNum(m, "Day_of_Week") === 2, lagged: false },
          // OPEX
          { name: "Skip OPEX days", field: "Is_Opex", operator: "==", value: 1, test: (m) => getNum(m, "Is_Opex") === 1, lagged: false },
          // VIX_Open filters (new, BIAS-05)
          { name: "Skip when VIX_Open > 25", field: "VIX_Open", operator: ">", value: 25, test: (m) => getNum(m, "VIX_Open") > 25, lagged: false },
          { name: "Skip when VIX_Open > 30", field: "VIX_Open", operator: ">", value: 30, test: (m) => getNum(m, "VIX_Open") > 30, lagged: false },
          // VIX_Gap_Pct filters (new, BIAS-05)
          { name: "Skip when |VIX_Gap_Pct| > 10%", field: "VIX_Gap_Pct", operator: ">", value: 10, test: (m) => Math.abs(getNum(m, "VIX_Gap_Pct")) > 10, lagged: false },
          { name: "Skip when |VIX_Gap_Pct| > 15%", field: "VIX_Gap_Pct", operator: ">", value: 15, test: (m) => Math.abs(getNum(m, "VIX_Gap_Pct")) > 15, lagged: false },

          // Close-derived filters (prior trading day values via LAG CTE)
          // VIX (close-derived)
          { name: "Skip when prior-day VIX > 25", field: "VIX_Close", operator: ">", value: 25, test: (m) => getNum(m, "prev_VIX_Close") > 25, lagged: true },
          { name: "Skip when prior-day VIX > 30", field: "VIX_Close", operator: ">", value: 30, test: (m) => getNum(m, "prev_VIX_Close") > 30, lagged: true },
          { name: "Skip when prior-day VIX < 14", field: "VIX_Close", operator: "<", value: 14, test: (m) => getNum(m, "prev_VIX_Close") < 14, lagged: true },
          // VIX spike (close-derived)
          { name: "Skip when prior-day VIX_Spike > 5%", field: "VIX_Spike_Pct", operator: ">", value: 5, test: (m) => getNum(m, "prev_VIX_Spike_Pct") > 5, lagged: true },
          { name: "Skip when prior-day VIX_Spike > 8%", field: "VIX_Spike_Pct", operator: ">", value: 8, test: (m) => getNum(m, "prev_VIX_Spike_Pct") > 8, lagged: true },
          // Term structure (close-derived)
          { name: "Skip prior-day backwardation", field: "Term_Structure_State", operator: "==", value: -1, test: (m) => getNum(m, "prev_Term_Structure_State") === -1, lagged: true },
          // Vol regime (close-derived)
          { name: "Skip prior-day Vol Regime 5-6 (High/Extreme)", field: "Vol_Regime", operator: "in", value: [5, 6], test: (m) => getNum(m, "prev_Vol_Regime") >= 5, lagged: true },
          { name: "Skip prior-day Vol Regime 1 (Very Low)", field: "Vol_Regime", operator: "==", value: 1, test: (m) => getNum(m, "prev_Vol_Regime") === 1, lagged: true },
          // Consecutive days (close-derived)
          { name: "Skip after prior-day 4+ consecutive up", field: "Consecutive_Days", operator: ">=", value: 4, test: (m) => getNum(m, "prev_Consecutive_Days") >= 4, lagged: true },
          { name: "Skip after prior-day 4+ consecutive down", field: "Consecutive_Days", operator: "<=", value: -4, test: (m) => getNum(m, "prev_Consecutive_Days") <= -4, lagged: true },
          // RSI (close-derived)
          { name: "Skip when prior-day RSI > 70", field: "RSI_14", operator: ">", value: 70, test: (m) => getNum(m, "prev_RSI_14") > 70, lagged: true },
          { name: "Skip when prior-day RSI < 30", field: "RSI_14", operator: "<", value: 30, test: (m) => getNum(m, "prev_RSI_14") < 30, lagged: true },

          // NEW: BB_Width filters (close-derived, from market.daily)
          { name: "Skip when prior-day BB_Width > 0.05 (wide bands = high vol)", field: "BB_Width", operator: ">", value: 0.05, test: (m) => getNum(m, "prev_BB_Width") > 0.05, lagged: true },
          { name: "Skip when prior-day BB_Width < 0.02 (narrow bands = compression)", field: "BB_Width", operator: "<", value: 0.02, test: (m) => getNum(m, "prev_BB_Width") < 0.02, lagged: true },

          // NEW: Realized Vol filters (close-derived, from market.daily)
          { name: "Skip when prior-day 5D realized vol > 1.5%", field: "Realized_Vol_5D", operator: ">", value: 1.5, test: (m) => getNum(m, "prev_Realized_Vol_5D") > 1.5, lagged: true },
          { name: "Skip when prior-day 20D realized vol > 1.2%", field: "Realized_Vol_20D", operator: ">", value: 1.2, test: (m) => getNum(m, "prev_Realized_Vol_20D") > 1.2, lagged: true },

          // NEW: BB_Position filters (close-derived, from market.daily)
          { name: "Skip when prior-day BB_Position > 0.9 (near upper band)", field: "BB_Position", operator: ">", value: 0.9, test: (m) => getNum(m, "prev_BB_Position") > 0.9, lagged: true },
          { name: "Skip when prior-day BB_Position < 0.1 (near lower band)", field: "BB_Position", operator: "<", value: 0.1, test: (m) => getNum(m, "prev_BB_Position") < 0.1, lagged: true },

          // NEW: Prior_Range_vs_ATR filter (open-known, from market.daily — same-day value)
          { name: "Skip when Prior_Range_vs_ATR > 1.5 (prior day had outsized range)", field: "Prior_Range_vs_ATR", operator: ">", value: 1.5, test: (m) => getNum(m, "Prior_Range_vs_ATR") > 1.5, lagged: false },
          { name: "Skip when Prior_Range_vs_ATR < 0.5 (prior day had compressed range)", field: "Prior_Range_vs_ATR", operator: "<", value: 0.5, test: (m) => getNum(m, "Prior_Range_vs_ATR") < 0.5, lagged: false },
        ];

        for (const filterDef of testFilters) {
          // For lagged filters, exclude trades with NaN lag values from evaluation
          // (prevents NaN comparisons from silently passing all tests and biasing results)
          let pool = matchedTrades;
          if (filterDef.lagged) {
            const prevField = `prev_${filterDef.field}`;
            pool = matchedTrades.filter((t) => {
              const val = getNum(t.market as Record<string, unknown>, prevField);
              return !isNaN(val);
            });
          }

          if (pool.length < 10) continue;

          // Identify trades that would be removed
          const removed = pool.filter((t) => filterDef.test(t.market as Record<string, unknown>));
          const remaining = pool.filter((t) => !filterDef.test(t.market as Record<string, unknown>));

          if (removed.length === 0 || remaining.length < 5) continue;

          const poolWins = pool.filter((t) => t.trade.pl > 0).length;
          const poolWinRate = (poolWins / pool.length) * 100;
          const poolTotalPl = pool.reduce((sum, t) => sum + t.trade.pl, 0);

          const winnersRemoved = removed.filter((t) => t.trade.pl > 0).length;
          const losersRemoved = removed.length - winnersRemoved;

          const newWins = remaining.filter((t) => t.trade.pl > 0).length;
          const newWinRate = (newWins / remaining.length) * 100;
          const newTotalPl = remaining.reduce((sum, t) => sum + t.trade.pl, 0);

          const winRateDelta = newWinRate - poolWinRate;
          const plDelta = newTotalPl - poolTotalPl;

          // Only include if improvement meets threshold
          if (winRateDelta >= minImprovementPct) {
            // Determine confidence based on sample size
            let confidence: "high" | "medium" | "low" = "low";
            if (removed.length >= 10 && remaining.length >= 20) {
              confidence = "high";
            } else if (removed.length >= 5 && remaining.length >= 10) {
              confidence = "medium";
            }

            suggestions.push({
              filter: filterDef.name,
              condition: {
                field: filterDef.field,
                operator: filterDef.operator,
                value: filterDef.value,
                lagged: filterDef.lagged,
              },
              tradesRemoved: removed.length,
              winnersRemoved,
              losersRemoved,
              newWinRate: Math.round(newWinRate * 100) / 100,
              newTotalPl: Math.round(newTotalPl * 100) / 100,
              winRateDelta: Math.round(winRateDelta * 100) / 100,
              plDelta: Math.round(plDelta * 100) / 100,
              confidence,
            });
          }
        }

        // Sort by win rate improvement
        suggestions.sort((a, b) => b.winRateDelta - a.winRateDelta);

        // Take top 10
        const topSuggestions = suggestions.slice(0, 10);

        // Generate composite filter suggestions from pairs of top-performing standalone filters
        const baseWinRate = currentWinRate;
        const significantFilters = suggestions.filter(s => s.winRateDelta > 3);

        interface CompositeSuggestion {
          name: string;
          type: "composite";
          projectedWinRate: number;
          projectedAvgPl: number;
          tradesAffected: number;
          improvement: number;
        }

        const compositeSuggestions: CompositeSuggestion[] = [];

        // Build a map from filter name to the original test function and lagged flag
        const filterTestMap = new Map<string, { test: (m: Record<string, unknown>) => boolean; lagged: boolean; field: string }>();
        for (const fd of testFilters) {
          filterTestMap.set(fd.name, { test: fd.test, lagged: fd.lagged, field: fd.field });
        }

        for (let i = 0; i < significantFilters.length; i++) {
          for (let j = i + 1; j < significantFilters.length; j++) {
            const filterA = significantFilters[i];
            const filterB = significantFilters[j];

            const testA = filterTestMap.get(filterA.filter);
            const testB = filterTestMap.get(filterB.filter);
            if (!testA || !testB) continue;

            // Build pool: exclude NaN-lag trades for lagged fields in either filter
            let pool = matchedTrades;
            if (testA.lagged) {
              const prevField = `prev_${testA.field}`;
              pool = pool.filter((t) => !isNaN(getNum(t.market as Record<string, unknown>, prevField)));
            }
            if (testB.lagged) {
              const prevField = `prev_${testB.field}`;
              pool = pool.filter((t) => !isNaN(getNum(t.market as Record<string, unknown>, prevField)));
            }

            // Find trades that match BOTH filters (would be skipped by both)
            const bothMatchTrades = pool.filter(t => {
              const m = t.market as Record<string, unknown>;
              return testA.test(m) && testB.test(m);
            });

            if (bothMatchTrades.length < 5) continue;

            const compositeWinRate = bothMatchTrades.filter(t => t.trade.pl > 0).length / bothMatchTrades.length * 100;
            const compositeAvgPl = bothMatchTrades.reduce((sum, t) => sum + t.trade.pl, 0) / bothMatchTrades.length;

            // Only surface if composite win rate is materially better than either standalone filter alone
            const improvement = compositeWinRate - Math.max(filterA.winRateDelta + baseWinRate, filterB.winRateDelta + baseWinRate);
            if (improvement > 2) {
              compositeSuggestions.push({
                name: `${filterA.filter} AND ${filterB.filter}`,
                type: "composite",
                projectedWinRate: Math.round(compositeWinRate * 100) / 100,
                projectedAvgPl: Math.round(compositeAvgPl * 100) / 100,
                tradesAffected: bothMatchTrades.length,
                improvement: Math.round(improvement * 100) / 100,
              });
            }
          }
        }

        // Sort composites by improvement, take top 5
        compositeSuggestions.sort((a, b) => b.improvement - a.improvement);
        const topCompositeSuggestions = compositeSuggestions.slice(0, 5);

        const summary = `Filter analysis: ${blockId} | ${topSuggestions.length} standalone, ${topCompositeSuggestions.length} composite suggestions (min ${minImprovementPct}% improvement)`;

        const sfResponseData: Record<string, unknown> = {
          blockId,
          lagNote: "Close-derived fields (VIX_Close, Vol_Regime, RSI_14, Consecutive_Days, VIX_Spike_Pct, Term_Structure_State, BB_Width, Realized_Vol_5D, Realized_Vol_20D, BB_Position) use prior trading day values to prevent lookahead bias. Open-known fields (Gap_Pct, VIX_Open, VIX_Gap_Pct, Prior_Range_vs_ATR, Day_of_Week, Is_Opex) use same-day values.",
          strategy: strategy || null,
          currentStats: {
            trades: matchedTrades.length,
            winRate: Math.round(currentWinRate * 100) / 100,
            totalPl: Math.round(currentTotalPl * 100) / 100,
          },
          suggestedFilters: topSuggestions,
          compositeSuggestions: topCompositeSuggestions,
          minImprovementThreshold: minImprovementPct,
        };

        if (availabilitySF.warnings.length > 0) {
          sfResponseData.warnings = availabilitySF.warnings;
        }

        return createToolOutput(summary, sfResponseData);
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    })
  );

  // ---------------------------------------------------------------------------
  // enrich_trades - Return trades enriched with lag-aware market context
  // ---------------------------------------------------------------------------
  server.registerTool(
    "enrich_trades",
    {
      description:
        "Enrich trades with market context from market.daily and market.context using correct temporal joins. " +
        "Open-known fields (Gap_Pct, VIX_Open, Prior_Range_vs_ATR) use same-day values. " +
        "Close-derived fields (VIX_Close, RSI_14, Vol_Regime, BB_Width, Realized_Vol_5D/20D, BB_Position) use prior trading day values to prevent lookahead bias. " +
        "New enrichment fields: BB_Width, Realized_Vol_5D, Realized_Vol_20D, BB_Position, Prior_Range_vs_ATR. " +
        "Use includeOutcomeFields=true for post-hoc analysis (with clear warning). " +
        "Use includeIntradayContext=true for intraday SPX/VIX checkpoint data at trade entry time. " +
        "Returns warnings when market data is partially missing.",
      inputSchema: z.object({
        blockId: z.string().describe("Block ID to enrich"),
        strategy: z.string().optional().describe("Filter to specific strategy (exact match)"),
        startDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
        ticker: z.string().optional().describe("Underlying ticker symbol (default: SPX)"),
        includeOutcomeFields: z.boolean().default(false).describe("Include same-day close values (lookahead). Defaults to false for safety."),
        includeIntradayContext: z.boolean().default(false).describe(
          "Include intraday SPX/VIX checkpoint data. Only checkpoints known at trade entry time are returned (lookahead-free). Requires 2 additional DuckDB queries."
        ),
        limit: z.number().min(1).max(500).default(50).describe("Max trades to return (default: 50, max: 500)"),
        offset: z.number().min(0).default(0).describe("Pagination offset (default: 0)"),
      }),
    },
    withFullSync(baseDir, async ({ blockId, strategy, startDate, endDate, ticker, includeOutcomeFields, includeIntradayContext, limit, offset }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Filter before paginate
        trades = filterByStrategy(trades, strategy);
        trades = filterByDateRange(trades, startDate, endDate);

        if (trades.length === 0) {
          return {
            content: [{ type: "text", text: "No trades found matching filters" }],
            isError: true,
          };
        }

        const totalTrades = trades.length;
        const paginated = trades.slice(offset, offset + limit);

        // Short-circuit if offset is past the end (empty page)
        if (paginated.length === 0) {
          return createToolOutput(
            `Enriched trades: ${blockId} | 0/0 matched | offset ${offset}, limit ${limit}`,
            {
              blockId,
              strategy: strategy || null,
              lagNote: "",
              tradesTotal: totalTrades,
              returned: 0,
              offset,
              hasMore: false,
              tradesMatched: 0,
              unmatchedDates: [],
              trades: [],
            }
          );
        }

        // Collect unique ticker+date keys from paginated trades only.
        const tradeKeys = uniqueTradeLookupKeys(paginated);

        // Query DuckDB for lookahead-free market data
        const conn = await getConnection(baseDir);

        // Check data availability and collect warnings
        const resolvedTickerET = normalizeTicker(ticker || '') || DEFAULT_MARKET_TICKER;
        const availabilityET = await checkDataAvailability(conn, resolvedTickerET, { checkIntraday: includeIntradayContext });

        const { sql: lagSql, params: lagParams } = buildLookaheadFreeQuery(tradeKeys);
        const dailyResult = await conn.runAndReadAll(lagSql, lagParams);
        const dailyRecords = resultToRecords(dailyResult);
        const daily = recordsByTickerDate(dailyRecords);

        // Optionally query outcome (same-day close) data
        let outcomeMap: Map<string, Record<string, unknown>> | null = null;
        if (includeOutcomeFields) {
          const { sql: outcomeSql, params: outcomeParams } = buildOutcomeQuery(tradeKeys);
          const outcomeResult = await conn.runAndReadAll(outcomeSql, outcomeParams);
          const outcomeRecords = resultToRecords(outcomeResult);
          outcomeMap = recordsByTickerDate(outcomeRecords);
        }

        // Optionally query intraday checkpoint data
        let spxIntradayMap: Map<string, Record<string, unknown>> | null = null;
        let vixIntradayMap: Map<string, Record<string, unknown>> | null = null;

        if (includeIntradayContext) {
          const { valuesClause: pairsClause, params: pairParams } = buildRequestedPairsClause(tradeKeys);

          // Query per-ticker SPX intraday data from market.intraday (normalized: one row per bar).
          // Pivot bars into wide-format checkpoint columns (P_0930, P_0945, ...) that
          // buildIntradayContext expects. market.intraday uses HH:MM time format.
          // TODO: Intraday import is blocked by format incompatibility (STATE.md blocker):
          // source CSVs use a single Unix timestamp column; market.intraday requires separate
          // date + time HH:MM columns. Until fixed, these queries return empty results
          // and intradayContext will be null for all trades (graceful degradation).
          const spxCheckpointCases = SPX_CHECKPOINTS
            .map(cp => {
              const hhmm = String(cp).padStart(4, '0');
              const timeStr = `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
              return `MAX(CASE WHEN i.time = '${timeStr}' THEN i.close END) AS "P_${hhmm}"`;
            })
            .join(',\n            ');
          const spxResult = await conn.runAndReadAll(
            `WITH requested(ticker, date) AS (VALUES ${pairsClause})
             SELECT i.ticker, i.date,
               MIN(CASE WHEN i.time = (
                 SELECT MIN(i2.time) FROM market.intraday i2
                 WHERE i2.ticker = i.ticker AND i2.date = i.date
               ) THEN i.open END) AS "open",
               ${spxCheckpointCases}
             FROM market.intraday i
             JOIN requested r ON i.ticker = r.ticker AND i.date = r.date
             GROUP BY i.ticker, i.date`,
            pairParams
          );
          const spxRecords = resultToRecords(spxResult);
          spxIntradayMap = recordsByTickerDate(spxRecords);

          // Query VIX intraday for both ticker-specific rows and global fallback rows.
          // VIX data is stored in market.intraday with ticker='VIX'.
          // Pivot into wide-format VIX_HHMM columns that buildIntradayContext expects.
          const byVixKey = new Map<string, MarketLookupKey>();
          for (const key of tradeKeys) {
            byVixKey.set(marketTickerDateKey(key.ticker, key.date), key);
            byVixKey.set(
              marketTickerDateKey(GLOBAL_MARKET_TICKER, key.date),
              { ticker: GLOBAL_MARKET_TICKER, date: key.date }
            );
          }
          const vixKeys = Array.from(byVixKey.values());
          const { valuesClause: vixPairsClause, params: vixPairParams } =
            buildRequestedPairsClause(vixKeys);
          const vixCheckpointCases = VIX_CHECKPOINTS
            .map(cp => {
              const hhmm = String(cp).padStart(4, '0');
              const timeStr = `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
              return `MAX(CASE WHEN i.time = '${timeStr}' THEN i.close END) AS "VIX_${hhmm}"`;
            })
            .join(',\n            ');
          const vixResult = await conn.runAndReadAll(
            `WITH requested(ticker, date) AS (VALUES ${vixPairsClause})
             SELECT i.ticker, i.date,
               MIN(CASE WHEN i.time = (
                 SELECT MIN(i2.time) FROM market.intraday i2
                 WHERE i2.ticker = i.ticker AND i2.date = i.date
               ) THEN i.open END) AS "open",
               ${vixCheckpointCases}
             FROM market.intraday i
             JOIN requested r ON i.ticker = r.ticker AND i.date = r.date
             GROUP BY i.ticker, i.date`,
            vixPairParams
          );
          const vixRecords = resultToRecords(vixResult);
          vixIntradayMap = recordsByTickerDate(vixRecords);
        }

        // Helper: clean numeric value (BigInt -> Number, NaN -> null)
        const cleanVal = (val: unknown): unknown => {
          if (typeof val === "bigint") return Number(val);
          if (typeof val === "number" && isNaN(val)) return null;
          return val === undefined ? null : val;
        };

        // Build enriched trades
        const unmatchedDates: string[] = [];
        let matched = 0;

        const enrichedTrades = paginated.map(trade => {
          const lookup = getTradeLookupKey(trade);
          const marketKey = marketTickerDateKey(lookup.ticker, lookup.date);
          const marketData = daily.get(marketKey);

          const commissions = trade.openingCommissionsFees + trade.closingCommissionsFees;

          const baseTrade: Record<string, unknown> = {
            dateOpened: lookup.date,
            ticker: lookup.ticker,
            timeOpened: trade.timeOpened,
            strategy: trade.strategy,
            legs: trade.legs,
            pl: trade.pl,
            numContracts: trade.numContracts,
            premium: trade.premium,
            reasonForClose: trade.reasonForClose || null,
            commissions,
          };

          if (!marketData) {
            unmatchedDates.push(`${lookup.date}|${lookup.ticker}`);
            baseTrade.entryContext = null;
            return baseTrade;
          }

          matched++;

          // Build sameDay: open-known + static fields
          const sameDay: Record<string, unknown> = {};
          for (const field of OPEN_KNOWN_FIELDS) {
            sameDay[field] = cleanVal(marketData[field]);
          }
          for (const field of STATIC_FIELDS) {
            sameDay[field] = cleanVal(marketData[field]);
          }

          // Build priorDay: close-derived fields (read prev_* columns)
          const priorDay: Record<string, unknown> = {};
          for (const field of CLOSE_KNOWN_FIELDS) {
            priorDay[field] = cleanVal(marketData[`prev_${field}`]);
          }

          baseTrade.entryContext = { sameDay, priorDay };

          // Outcome fields (opt-in, same-day close values)
          if (includeOutcomeFields && outcomeMap) {
            const outcomeData = outcomeMap.get(marketKey);
            if (outcomeData) {
              const outcomeFields: Record<string, unknown> = {};
              for (const field of CLOSE_KNOWN_FIELDS) {
                outcomeFields[field] = cleanVal(outcomeData[field]);
              }
              baseTrade.outcomeFields = outcomeFields;
            }
          }

          // Intraday context (opt-in, per-trade checkpoint filtering)
          if (includeIntradayContext && spxIntradayMap && vixIntradayMap) {
            const spxIntraday = spxIntradayMap.get(marketKey) || null;
            const vixIntraday =
              vixIntradayMap.get(marketKey) ||
              vixIntradayMap.get(
                marketTickerDateKey(GLOBAL_MARKET_TICKER, lookup.date)
              ) ||
              null;
            baseTrade.intradayContext = buildIntradayContext(
              trade.timeOpened,
              spxIntraday,
              vixIntraday,
            );

            // Intraday outcome fields (day-level aggregates, requires BOTH flags)
            if (includeOutcomeFields) {
              const intradayOutcome: Record<string, unknown> = {};

              if (spxIntraday) {
                for (const field of SPX_15MIN_OUTCOME_FIELDS) {
                  intradayOutcome[`spx_${field}`] = cleanVal(spxIntraday[field]);
                }
              }

              if (vixIntraday) {
                for (const field of VIX_OUTCOME_FIELDS) {
                  intradayOutcome[field] = cleanVal(vixIntraday[field]);
                }
                for (const field of VIX_OHLC_OUTCOME_FIELDS) {
                  intradayOutcome[`vix_${field}`] = cleanVal(vixIntraday[field]);
                }
              }

              if (Object.keys(intradayOutcome).length > 0) {
                baseTrade.intradayOutcomeFields = intradayOutcome;
              }
            }
          }

          return baseTrade;
        });

        const sortedUnmatchedDates = [...new Set(unmatchedDates)].sort();

        // Build lagNote
        let lagNote =
          "Entry context uses lookahead-free temporal joins on ticker+date via market.daily LEFT JOIN market.context. " +
          "Same-day (open-known) fields: Gap_Pct, VIX_Open, VIX_Gap_Pct, Prior_Range_vs_ATR, Day_of_Week, Month, Is_Opex. " +
          "Prior-day (close-derived) fields: VIX_Close, RSI_14, Vol_Regime, BB_Width, Realized_Vol_5D, Realized_Vol_20D, BB_Position, Term_Structure_State, etc. — " +
          "use the previous trading day's close-derived values to prevent lookahead bias.";
        if (includeOutcomeFields) {
          lagNote += " Outcome fields contain same-day close-derived values and represent information NOT available at trade entry time.";
        }
        if (includeIntradayContext) {
          lagNote += " Intraday context shows SPX/VIX checkpoint values known at trade entry time (filtered by timeOpened). Checkpoints after entry time are excluded to prevent lookahead bias.";
          if (includeOutcomeFields) {
            lagNote += " intradayOutcomeFields contain end-of-day intraday metrics (MOC moves, VIX spike/crush flags, etc.) NOT available at trade entry time.";
          }
        }

        // Build response data
        const responseData: Record<string, unknown> = {
          blockId,
          strategy: strategy || null,
          lagNote,
          tradesTotal: totalTrades,
          returned: paginated.length,
          offset,
          hasMore: offset + limit < totalTrades,
          tradesMatched: matched,
          unmatchedDates: sortedUnmatchedDates,
          trades: enrichedTrades,
        };

        if (includeOutcomeFields) {
          responseData.lookaheadWarning =
            "WARNING: outcomeFields contain same-day close-derived values that were NOT available at trade entry time. Do not use these for entry signal analysis.";
        }

        if (availabilityET.warnings.length > 0) {
          responseData.warnings = availabilityET.warnings;
        }

        const summary = `Enriched trades: ${blockId} | ${matched}/${paginated.length} matched | offset ${offset}, limit ${limit}`;

        return createToolOutput(summary, responseData);
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    })
  );

  // ---------------------------------------------------------------------------
  // calculate_orb - Calculate Opening Range Breakout levels from market.intraday
  // ---------------------------------------------------------------------------

  /**
   * Convert a 4-digit HHMM string (e.g., '0930') to HH:MM format (e.g., '09:30').
   * Throws if the input is not exactly 4 digits.
   */
  function hhmmToSqlTime(hhmm: string): string {
    if (!/^\d{4}$/.test(hhmm)) {
      throw new Error(`Invalid HHMM format: ${hhmm}. Expected 4 digits like '0930'.`);
    }
    return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
  }

  server.registerTool(
    "calculate_orb",
    {
      description:
        "Calculate Opening Range Breakout (ORB) levels from market.intraday bar data. " +
        "ORB range defined by high/low (or close) within the specified time window. " +
        "Returns per-day ORB levels plus breakout events (direction, time, condition). " +
        "Supports any bar resolution and any ticker with intraday data.",
      inputSchema: z.object({
        ticker: z.string().optional().describe("Underlying ticker (default: SPX)"),
        startTime: z.string().describe("ORB window start time in HHMM format (e.g., '0930')"),
        endTime: z.string().describe("ORB window end time in HHMM format (e.g., '1000')"),
        startDate: z.string().describe("Start date (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date (YYYY-MM-DD), defaults to startDate"),
        useHighLow: z.boolean().default(true).describe(
          "If true, ORB range uses bar high/low values. If false, uses bar close values only. Default: true."
        ),
        barResolution: z.string().optional().describe(
          "Bar resolution to use (e.g., '15', '5'). Default: finest available resolution in market.intraday for the ticker."
        ),
        limit: z.number().int().min(1).max(500).default(100).describe("Max days to return (default: 100)"),
      }),
    },
    withFullSync(baseDir, async ({ ticker, startTime, endTime, startDate, endDate, useHighLow, barResolution, limit }) => {
      try {
        const end = endDate || startDate;
        const normalizedTicker = normalizeTicker(ticker || "") || DEFAULT_MARKET_TICKER;
        const conn = await getConnection(baseDir);

        // Validate and convert HHMM inputs to HH:MM for SQL comparison
        let sqlStartTime: string;
        let sqlEndTime: string;
        try {
          sqlStartTime = hhmmToSqlTime(startTime);
          sqlEndTime = hhmmToSqlTime(endTime);
        } catch (e) {
          return {
            content: [{ type: "text", text: (e as Error).message }],
            isError: true,
          };
        }

        if (sqlStartTime >= sqlEndTime) {
          return {
            content: [{ type: "text", text: `startTime (${startTime}) must be before endTime (${endTime})` }],
            isError: true,
          };
        }

        // Check intraday data availability first
        const availability = await checkDataAvailability(conn, normalizedTicker, { checkIntraday: true });
        if (!availability.hasIntradayData) {
          return createToolOutput(
            `ORB: No intraday data for ${normalizedTicker}`,
            {
              query: { ticker: normalizedTicker, startTime, endTime, startDate, endDate: end },
              warnings: availability.warnings,
              days: [],
              stats: { totalDays: 0 },
            }
          );
        }

        // Determine bar resolution: use provided value or auto-detect from first available date
        let resolvedBarResolution: number | null = null;
        if (barResolution !== undefined && barResolution !== null) {
          const parsed = parseInt(barResolution, 10);
          if (!isNaN(parsed) && parsed > 0) {
            resolvedBarResolution = parsed;
          }
        } else {
          // Auto-detect: find the first date with data and compute time gap between consecutive bars
          try {
            const sampleResult = await conn.runAndReadAll(
              `SELECT DISTINCT time FROM market.intraday
               WHERE ticker = $1 AND date = (SELECT MIN(date) FROM market.intraday WHERE ticker = $1)
               ORDER BY time
               LIMIT 10`,
              [normalizedTicker]
            );
            const sampleRows = resultToRecords(sampleResult);
            if (sampleRows.length >= 2) {
              // Parse HH:MM times and compute minute gap between first two bars
              const t1 = String(sampleRows[0]["time"]);
              const t2 = String(sampleRows[1]["time"]);
              const [h1, m1] = t1.split(":").map(Number);
              const [h2, m2] = t2.split(":").map(Number);
              const gap = (h2 * 60 + m2) - (h1 * 60 + m1);
              if (gap > 0) {
                resolvedBarResolution = gap;
              }
            }
          } catch {
            // If auto-detection fails, proceed without resolution filtering
          }
        }

        // Build the ORB SQL query using DuckDB CTEs with parameterized ticker, dates, times.
        // useHighLow is a template-time toggle (not a SQL parameter) controlling which expressions are used.
        const highExpr = useHighLow ? "MAX(high)" : "MAX(close)";
        const lowExpr = useHighLow ? "MIN(low)" : "MIN(close)";
        const rangeExpr = useHighLow ? "MAX(high) - MIN(low)" : "MAX(close) - MIN(close)";
        const breakupExpr = useHighLow ? "i.high > r.ORB_High" : "i.close > r.ORB_High";
        const breakdownExpr = useHighLow ? "i.low < r.ORB_Low" : "i.close < r.ORB_Low";

        const orbSql = `
WITH orb_range AS (
  SELECT
    ticker, date,
    ${highExpr} AS ORB_High,
    ${lowExpr} AS ORB_Low,
    ${rangeExpr} AS ORB_Range,
    MIN(open) FILTER (WHERE time = $4) AS ORB_Open
  FROM market.intraday
  WHERE ticker = $1
    AND date BETWEEN $2 AND $3
    AND time >= $4
    AND time <= $5
  GROUP BY ticker, date
),
breakout_events AS (
  SELECT
    i.ticker, i.date,
    MIN(i.time) FILTER (WHERE ${breakupExpr}) AS breakout_up_time,
    MIN(i.time) FILTER (WHERE ${breakdownExpr}) AS breakout_down_time
  FROM market.intraday i
  JOIN orb_range r ON i.ticker = r.ticker AND i.date = r.date
  WHERE i.time > $5
  GROUP BY i.ticker, i.date
)
SELECT
  r.date,
  r.ORB_High,
  r.ORB_Low,
  r.ORB_Range,
  CASE WHEN r.ORB_Low > 0 THEN r.ORB_Range / r.ORB_Low * 100 ELSE 0 END AS ORB_Range_Pct,
  r.ORB_Open,
  b.breakout_up_time,
  b.breakout_down_time,
  CASE
    WHEN b.breakout_up_time IS NOT NULL AND b.breakout_down_time IS NOT NULL THEN
      CASE WHEN b.breakout_up_time < b.breakout_down_time THEN 'HighFirst' ELSE 'LowFirst' END
    WHEN b.breakout_up_time IS NOT NULL THEN 'HighOnly'
    WHEN b.breakout_down_time IS NOT NULL THEN 'LowOnly'
    ELSE 'NoBreakout'
  END AS breakout_condition
FROM orb_range r
LEFT JOIN breakout_events b ON r.ticker = b.ticker AND r.date = b.date
ORDER BY r.date`;

        const orbResult = await conn.runAndReadAll(orbSql, [normalizedTicker, startDate, end, sqlStartTime, sqlEndTime]);
        const orbRows = resultToRecords(orbResult);

        // Process results into typed day records
        type BreakoutCondition = "HighFirst" | "LowFirst" | "HighOnly" | "LowOnly" | "NoBreakout";

        interface OrbDayResult {
          date: string;
          ORB_High: number;
          ORB_Low: number;
          ORB_Range: number;
          ORB_Range_Pct: number;
          ORB_Open: number | null;
          breakout_condition: BreakoutCondition;
          breakout_up_time: string | null;
          breakout_down_time: string | null;
          entry_triggered: boolean;
        }

        const days: OrbDayResult[] = orbRows.map((row) => {
          const breakoutCondition = (row["breakout_condition"] ?? "NoBreakout") as BreakoutCondition;
          const entry_triggered = breakoutCondition !== "NoBreakout";

          const orbOpen = row["ORB_Open"];
          const orbOpenVal = (orbOpen === null || orbOpen === undefined)
            ? null
            : typeof orbOpen === "bigint" ? Number(orbOpen) : (orbOpen as number);

          return {
            date: String(row["date"]),
            ORB_High: Math.round(getNum(row, "ORB_High") * 100) / 100,
            ORB_Low: Math.round(getNum(row, "ORB_Low") * 100) / 100,
            ORB_Range: Math.round(getNum(row, "ORB_Range") * 100) / 100,
            ORB_Range_Pct: Math.round(getNum(row, "ORB_Range_Pct") * 10000) / 10000,
            ORB_Open: orbOpenVal !== null ? Math.round(orbOpenVal * 100) / 100 : null,
            breakout_condition: breakoutCondition,
            breakout_up_time: row["breakout_up_time"] ? String(row["breakout_up_time"]) : null,
            breakout_down_time: row["breakout_down_time"] ? String(row["breakout_down_time"]) : null,
            entry_triggered,
          };
        });

        const totalDays = days.length;

        // Compute aggregate stats
        const avgOrbRangePct = totalDays > 0
          ? days.reduce((sum, d) => sum + d.ORB_Range_Pct, 0) / totalDays
          : 0;

        const breakdownByCondition = {
          HighFirst: days.filter((d) => d.breakout_condition === "HighFirst").length,
          LowFirst: days.filter((d) => d.breakout_condition === "LowFirst").length,
          HighOnly: days.filter((d) => d.breakout_condition === "HighOnly").length,
          LowOnly: days.filter((d) => d.breakout_condition === "LowOnly").length,
          NoBreakout: days.filter((d) => d.breakout_condition === "NoBreakout").length,
        };

        // Apply limit
        const limitedDays = days.slice(0, limit);

        const summary =
          `ORB (${normalizedTicker}, ${startTime}-${endTime}): ${startDate} to ${end} | ` +
          `${totalDays} days, avg range ${formatPercent(avgOrbRangePct)}`;

        const responseData: Record<string, unknown> = {
          query: {
            ticker: normalizedTicker,
            startTime,
            endTime,
            sqlStartTime,
            sqlEndTime,
            startDate,
            endDate: end,
            useHighLow,
            barResolution: resolvedBarResolution !== null ? String(resolvedBarResolution) : "auto",
          },
          stats: {
            totalDays,
            avgOrbRangePct: Math.round(avgOrbRangePct * 10000) / 10000,
            breakdownByCondition,
          },
          returned: limitedDays.length,
          days: limitedDays,
        };

        if (availability.warnings.length > 0) {
          responseData.warnings = availability.warnings;
        }

        return createToolOutput(summary, responseData);
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    })
  );
}
