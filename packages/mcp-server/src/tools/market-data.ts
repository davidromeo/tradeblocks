/**
 * Market Data Tools
 *
 * MCP tools for analyzing market context (VIX, term structure, regimes)
 * and correlating with trade performance. Includes enrich_trades for
 * lag-aware trade enrichment with market data.
 *
 * Data source: DuckDB analytics database (synced from TradingView exports)
 * - market.spx_daily: Daily context (55 fields incl. highlow timing + VIX enrichment)
 * - market.spx_15min: 15-minute intraday checkpoints
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
} from "../utils/intraday-timing.js";
import {
  DEFAULT_MARKET_TICKER,
  GLOBAL_MARKET_TICKER,
  marketTickerDateKey,
  normalizeTicker,
  resolveTradeTicker,
} from "../utils/ticker.js";

// =============================================================================
// Types
// =============================================================================

/** Daily market data columns in market.spx_daily DuckDB table. Kept as documentation reference. */
export interface DailyMarketData {
  date: string; // YYYY-MM-DD
  // Core price
  Prior_Close: number;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  // Gap & movement
  Gap_Pct: number;
  Intraday_Range_Pct: number;
  Intraday_Return_Pct: number;
  Total_Return_Pct: number;
  Close_Position_In_Range: number;
  Gap_Filled: number; // 0 or 1
  // VIX
  VIX_Open: number;
  VIX_Close: number;
  VIX_Change_Pct: number;
  VIX_Spike_Pct: number;
  VIX_Percentile: number;
  Vol_Regime: number; // 1-6
  // VIX term structure
  VIX9D_Close: number;
  VIX3M_Close: number;
  VIX9D_VIX_Ratio: number;
  VIX_VIX3M_Ratio: number;
  Term_Structure_State: number; // -1, 0, 1
  // Technical
  ATR_Pct: number;
  RSI_14: number;
  Price_vs_EMA21_Pct: number;
  Price_vs_SMA50_Pct: number;
  Trend_Score: number; // 0-4
  BB_Position: number; // 0-1
  // Momentum
  Return_5D: number;
  Return_20D: number;
  Consecutive_Days: number;
  // Calendar
  Day_of_Week: number; // 2=Mon...6=Fri
  Month: number;
  Is_Opex: number; // 0 or 1
  // Prior day
  Prev_Return_Pct: number;
}

/** 15-minute intraday columns in market.spx_15min DuckDB table. Kept as documentation reference. */
export interface Intraday15MinData {
  date: string; // YYYY-MM-DD
  // OHLC
  open: number;
  high: number;
  low: number;
  close: number;
  // Checkpoint prices at each 15-min interval
  P_0930: number;
  P_0945: number;
  P_1000: number;
  P_1015: number;
  P_1030: number;
  P_1045: number;
  P_1100: number;
  P_1115: number;
  P_1130: number;
  P_1145: number;
  P_1200: number;
  P_1215: number;
  P_1230: number;
  P_1245: number;
  P_1300: number;
  P_1315: number;
  P_1330: number;
  P_1345: number;
  P_1400: number;
  P_1415: number;
  P_1430: number;
  P_1445: number;
  P_1500: number;
  P_1515: number;
  P_1530: number;
  P_1545: number;
  // Percentage moves from open
  Pct_0930_to_1000: number;
  Pct_0930_to_1200: number;
  Pct_0930_to_1500: number;
  Pct_0930_to_Close: number;
  // Market-on-close moves
  MOC_15min: number;
  MOC_30min: number;
  MOC_45min: number;
  MOC_60min: number;
  // Afternoon action
  Afternoon_Move: number;
}

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
        "Break down a block's trade performance by market regime (volatility, term structure, day of week, etc.). " +
        "Identifies which market conditions favor or hurt the strategy. " +
        "Close-derived fields (volRegime, termStructure, trendScore) use prior trading day values to prevent lookahead bias.",
      inputSchema: z.object({
        blockId: z.string().describe("Block ID to analyze"),
        segmentBy: z.enum([
          "volRegime",
          "termStructure",
          "dayOfWeek",
          "gapDirection",
          "trendScore",
        ]).describe("Market dimension to segment by"),
        strategy: z.string().optional().describe("Filter to specific strategy"),
      }),
    },
    withFullSync(baseDir, async ({ blockId, segmentBy, strategy }) => {
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
            case "trendScore": {
              const val = getNum(marketData, "prev_Trend_Score");
              if (isNaN(val)) { lagExcluded++; continue; }
              segmentValue = val;
              segmentKey = String(val);
              segmentLabel = `Trend Score ${val}`;
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
              profitFactor: Math.round(profitFactor * 100) / 100,
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

        const laggedSegments = ["volRegime", "termStructure", "trendScore"];
        const lagNote = laggedSegments.includes(segmentBy)
          ? `Segmentation by ${segmentBy} uses prior trading day values (close-derived field) to prevent lookahead bias.`
          : `Segmentation by ${segmentBy} uses same-day values (${segmentBy === "dayOfWeek" ? "static" : "open-known"} field).`;

        return createToolOutput(summary, {
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
        });
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
        "Returns actionable filter suggestions with projected impact. " +
        "Close-derived fields use prior trading day values to prevent lookahead bias.",
      inputSchema: z.object({
        blockId: z.string().describe("Block ID to analyze"),
        strategy: z.string().optional().describe("Filter to specific strategy"),
        minImprovementPct: z.number().optional().describe("Only suggest filters with >= X% win rate improvement (default: 3)"),
      }),
    },
    withFullSync(baseDir, async ({ blockId, strategy, minImprovementPct = 3 }) => {
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
          // Trend (close-derived)
          { name: "Skip when prior-day Trend_Score <= 1", field: "Trend_Score", operator: "<=", value: 1, test: (m) => getNum(m, "prev_Trend_Score") <= 1, lagged: true },
          { name: "Skip when prior-day Trend_Score >= 4", field: "Trend_Score", operator: ">=", value: 4, test: (m) => getNum(m, "prev_Trend_Score") >= 4, lagged: true },
          // Consecutive days (close-derived)
          { name: "Skip after prior-day 4+ consecutive up", field: "Consecutive_Days", operator: ">=", value: 4, test: (m) => getNum(m, "prev_Consecutive_Days") >= 4, lagged: true },
          { name: "Skip after prior-day 4+ consecutive down", field: "Consecutive_Days", operator: "<=", value: -4, test: (m) => getNum(m, "prev_Consecutive_Days") <= -4, lagged: true },
          // RSI (close-derived)
          { name: "Skip when prior-day RSI > 70", field: "RSI_14", operator: ">", value: 70, test: (m) => getNum(m, "prev_RSI_14") > 70, lagged: true },
          { name: "Skip when prior-day RSI < 30", field: "RSI_14", operator: "<", value: 30, test: (m) => getNum(m, "prev_RSI_14") < 30, lagged: true },
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

        const summary = `Filter analysis: ${blockId} | ${topSuggestions.length} suggestions found (min ${minImprovementPct}% improvement)`;

        return createToolOutput(summary, {
          blockId,
          lagNote: "Close-derived fields (VIX_Close, Vol_Regime, RSI_14, Trend_Score, Consecutive_Days, VIX_Spike_Pct, Term_Structure_State) use prior trading day values to prevent lookahead bias. Open-known fields (Gap_Pct, VIX_Open, VIX_Gap_Pct, Day_of_Week, Is_Opex) use same-day values.",
          strategy: strategy || null,
          currentStats: {
            trades: matchedTrades.length,
            winRate: Math.round(currentWinRate * 100) / 100,
            totalPl: Math.round(currentTotalPl * 100) / 100,
          },
          suggestedFilters: topSuggestions,
          minImprovementThreshold: minImprovementPct,
        });
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
        "Enrich trades with market context using correct temporal joins. " +
        "Open-known fields (Gap_Pct, VIX_Open) use same-day values. " +
        "Close-derived fields (VIX_Close, RSI_14, Vol_Regime) use prior trading day values to prevent lookahead bias. " +
        "Use includeOutcomeFields=true for post-hoc analysis (with clear warning)." +
        " Use includeIntradayContext=true for intraday SPX/VIX checkpoint data at trade entry time.",
      inputSchema: z.object({
        blockId: z.string().describe("Block ID to enrich"),
        strategy: z.string().optional().describe("Filter to specific strategy (exact match)"),
        startDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
        includeOutcomeFields: z.boolean().default(false).describe("Include same-day close values (lookahead). Defaults to false for safety."),
        includeIntradayContext: z.boolean().default(false).describe(
          "Include intraday SPX/VIX checkpoint data. Only checkpoints known at trade entry time are returned (lookahead-free). Requires 2 additional DuckDB queries."
        ),
        limit: z.number().min(1).max(500).default(50).describe("Max trades to return (default: 50, max: 500)"),
        offset: z.number().min(0).default(0).describe("Pagination offset (default: 0)"),
      }),
    },
    withFullSync(baseDir, async ({ blockId, strategy, startDate, endDate, includeOutcomeFields, includeIntradayContext, limit, offset }) => {
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

          // Query per-ticker underlying intraday data
          const spxResult = await conn.runAndReadAll(
            `WITH requested(ticker, date) AS (VALUES ${pairsClause})
             SELECT s.*
             FROM market.spx_15min s
             JOIN requested r
               ON s.ticker = r.ticker
              AND s.date = r.date`,
            pairParams
          );
          const spxRecords = resultToRecords(spxResult);
          spxIntradayMap = recordsByTickerDate(spxRecords);

          // Query VIX intraday for both ticker-specific rows and global fallback rows.
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
          const vixResult = await conn.runAndReadAll(
            `WITH requested(ticker, date) AS (VALUES ${vixPairsClause})
             SELECT v.*
             FROM market.vix_intraday v
             JOIN requested r
               ON v.ticker = r.ticker
              AND v.date = r.date`,
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
          "Entry context uses lookahead-free temporal joins on ticker+date. Same-day fields (Gap_Pct, VIX_Open, Day_of_Week, etc.) are values known at market open. Prior-day fields (VIX_Close, RSI_14, Vol_Regime, etc.) use the previous trading day's close-derived values to prevent lookahead bias.";
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
  // calculate_orb - Calculate Opening Range Breakout levels
  // ---------------------------------------------------------------------------
  server.registerTool(
    "calculate_orb",
    {
      description:
        "Calculate Opening Range Breakout (ORB) levels using 15-minute checkpoint data. " +
        "ORB is defined as the high/low range between specified start and end times. " +
        "Returns per-day ORB high, low, range percentage, and where close fell in that range.",
      inputSchema: z.object({
        ticker: z.string().optional().describe("Underlying ticker to query (default: SPX)"),
        startTime: z.string().describe("ORB start time in HHMM format (e.g., '0930' for 9:30 AM)"),
        endTime: z.string().describe("ORB end time in HHMM format (e.g., '1000' for 10:00 AM)"),
        startDate: z.string().describe("Start date (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date (YYYY-MM-DD), defaults to startDate"),
        limit: z.number().int().min(1).optional().describe("Max rows to return (default: 100)"),
      }),
    },
    withFullSync(baseDir, async ({ ticker, startTime, endTime, startDate, endDate, limit = 100 }) => {
      try {
        // Query DuckDB for intraday data in the date range
        const end = endDate || startDate;
        const normalizedTicker = normalizeTicker(ticker || "") || DEFAULT_MARKET_TICKER;
        const conn = await getConnection(baseDir);
        const result = await conn.runAndReadAll(
          `SELECT *
           FROM market.spx_15min
           WHERE ticker = $1
             AND date BETWEEN $2 AND $3
           ORDER BY date`,
          [normalizedTicker, startDate, end]
        );
        const intradayRecords = resultToRecords(result);

        if (intradayRecords.length === 0) {
          return {
            content: [{
              type: "text",
              text:
                `No 15-minute intraday data available for ticker ${normalizedTicker} ` +
                "in the specified date range",
            }],
            isError: true,
          };
        }

        // Map of available checkpoint times to their field names
        const checkpointFields: Record<string, string> = {
          "0930": "P_0930",
          "0945": "P_0945",
          "1000": "P_1000",
          "1015": "P_1015",
          "1030": "P_1030",
          "1045": "P_1045",
          "1100": "P_1100",
          "1115": "P_1115",
          "1130": "P_1130",
          "1145": "P_1145",
          "1200": "P_1200",
          "1215": "P_1215",
          "1230": "P_1230",
          "1245": "P_1245",
          "1300": "P_1300",
          "1315": "P_1315",
          "1330": "P_1330",
          "1345": "P_1345",
          "1400": "P_1400",
          "1415": "P_1415",
          "1430": "P_1430",
          "1445": "P_1445",
          "1500": "P_1500",
          "1515": "P_1515",
          "1530": "P_1530",
          "1545": "P_1545",
        };

        // Validate times
        if (!(startTime in checkpointFields)) {
          return {
            content: [{ type: "text", text: `Invalid startTime: ${startTime}. Must be one of: ${Object.keys(checkpointFields).join(", ")}` }],
            isError: true,
          };
        }
        if (!(endTime in checkpointFields)) {
          return {
            content: [{ type: "text", text: `Invalid endTime: ${endTime}. Must be one of: ${Object.keys(checkpointFields).join(", ")}` }],
            isError: true,
          };
        }

        // Get checkpoints in the ORB range
        const allTimes = Object.keys(checkpointFields).sort();
        const startIdx = allTimes.indexOf(startTime);
        const endIdx = allTimes.indexOf(endTime);

        if (startIdx >= endIdx) {
          return {
            content: [{ type: "text", text: `startTime (${startTime}) must be before endTime (${endTime})` }],
            isError: true,
          };
        }

        const orbTimes = allTimes.slice(startIdx, endIdx + 1);

        // Calculate ORB for each day in range
        interface OrbResult {
          date: string;
          ORB_High: number;
          ORB_Low: number;
          ORB_Range: number;
          ORB_Range_Pct: number;
          Close: number;
          Close_Position_In_ORB: number;
          Close_vs_ORB: "above" | "below" | "within";
        }

        const results: OrbResult[] = [];

        for (const intradayData of intradayRecords) {
          const date = intradayData["date"] as string;

          // Get prices at each checkpoint in the ORB range
          const prices: number[] = [];
          for (const time of orbTimes) {
            const field = checkpointFields[time];
            const price = getNum(intradayData, field);
            if (!isNaN(price) && price > 0) {
              prices.push(price);
            }
          }

          if (prices.length === 0) continue;

          const orbHigh = Math.max(...prices);
          const orbLow = Math.min(...prices);
          const orbRange = orbHigh - orbLow;
          const orbRangePct = (orbRange / orbLow) * 100;
          const close = getNum(intradayData, "close");
          if (isNaN(close)) continue;

          // Calculate where close is relative to ORB
          let closePositionInOrb: number;
          let closeVsOrb: "above" | "below" | "within";

          if (orbRange === 0) {
            // ORB range is zero (all checkpoint prices identical)
            closePositionInOrb = close === orbHigh ? 0.5 : close > orbHigh ? 1 : 0;
            closeVsOrb = close > orbHigh ? "above" : close < orbLow ? "below" : "within";
          } else if (close > orbHigh) {
            closePositionInOrb = 1 + (close - orbHigh) / orbRange;
            closeVsOrb = "above";
          } else if (close < orbLow) {
            closePositionInOrb = (close - orbLow) / orbRange;
            closeVsOrb = "below";
          } else {
            closePositionInOrb = (close - orbLow) / orbRange;
            closeVsOrb = "within";
          }

          results.push({
            date,
            ORB_High: Math.round(orbHigh * 100) / 100,
            ORB_Low: Math.round(orbLow * 100) / 100,
            ORB_Range: Math.round(orbRange * 100) / 100,
            ORB_Range_Pct: Math.round(orbRangePct * 1000) / 1000,
            Close: Math.round(close * 100) / 100,
            Close_Position_In_ORB: Math.round(closePositionInOrb * 1000) / 1000,
            Close_vs_ORB: closeVsOrb,
          });
        }

        // Sort by date
        results.sort((a, b) => a.date.localeCompare(b.date));

        const totalDays = results.length;

        // Apply limit
        const limitedResults = results.slice(0, limit);

        // Calculate aggregate stats
        const aboveCount = results.filter((r) => r.Close_vs_ORB === "above").length;
        const belowCount = results.filter((r) => r.Close_vs_ORB === "below").length;
        const withinCount = results.filter((r) => r.Close_vs_ORB === "within").length;
        const avgOrbRangePct = totalDays > 0
          ? results.reduce((sum, r) => sum + r.ORB_Range_Pct, 0) / totalDays
          : 0;

        const summary =
          `ORB (${normalizedTicker}, ${startTime}-${endTime}): ${startDate} to ${end} | ` +
          `${totalDays} days, avg range ${formatPercent(avgOrbRangePct)}`;

        return createToolOutput(summary, {
          query: {
            ticker: normalizedTicker,
            startTime,
            endTime,
            startDate,
            endDate: end,
            checkpointsUsed: orbTimes,
          },
          stats: {
            totalDays,
            avgOrbRangePct: Math.round(avgOrbRangePct * 1000) / 1000,
            closeAboveOrb: aboveCount,
            closeBelowOrb: belowCount,
            closeWithinOrb: withinCount,
            closeAbovePct: totalDays > 0 ? Math.round((aboveCount / totalDays) * 10000) / 100 : 0,
            closeBelowPct: totalDays > 0 ? Math.round((belowCount / totalDays) * 10000) / 100 : 0,
            closeWithinPct: totalDays > 0 ? Math.round((withinCount / totalDays) * 10000) / 100 : 0,
          },
          returned: limitedResults.length,
          days: limitedResults,
        });
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    })
  );
}
