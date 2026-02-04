/**
 * Market Data Tools
 *
 * MCP tools for analyzing market context (VIX, term structure, regimes)
 * and correlating with trade performance.
 *
 * Data source: TradingView exports in ~/backtests/_marketdata/
 * - spx_daily.csv: Daily context (35 fields)
 * - spx_15min.csv: 15-minute intraday checkpoints (primary)
 * - spx_highlow.csv: High/low timing data (optional)
 * - vix_intraday.csv: VIX intraday data (optional)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs/promises";
import * as path from "path";
import { loadBlock } from "../utils/block-loader.js";
import {
  createToolOutput,
  formatPercent,
} from "../utils/output-formatter.js";
import type { Trade } from "@tradeblocks/lib";

// =============================================================================
// Types
// =============================================================================

/**
 * Daily market data record from TradingView export
 */
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

/**
 * 15-minute intraday checkpoint data from spx_15min.csv
 */
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

/**
 * High/low timing data from spx_highlow.csv (optional)
 */
export interface HighLowTimingData {
  date: string; // YYYY-MM-DD
  // OHLC
  open: number;
  high: number;
  low: number;
  close: number;
  // Timing (in hours, e.g., 9.5 = 9:30 AM)
  High_Time: number;
  Low_Time: number;
  // Flags
  High_Before_Low: number; // 0 or 1
  High_In_First_Hour: number;
  Low_In_First_Hour: number;
  High_In_Last_Hour: number;
  Low_In_Last_Hour: number;
  // Reversal type
  Reversal_Type: number;
  // Range metrics
  High_Low_Spread: number;
  Early_Extreme: number;
  Late_Extreme: number;
  Intraday_High: number;
  Intraday_Low: number;
}

/**
 * VIX intraday data from vix_intraday.csv (optional)
 */
export interface VixIntradayData {
  date: string; // YYYY-MM-DD
  // OHLC
  open: number;
  high: number;
  low: number;
  close: number;
  // Checkpoint values
  VIX_0930: number;
  VIX_1000: number;
  VIX_1030: number;
  VIX_1100: number;
  VIX_1130: number;
  VIX_1200: number;
  VIX_1230: number;
  VIX_1300: number;
  VIX_1330: number;
  VIX_1400: number;
  VIX_1430: number;
  VIX_1500: number;
  VIX_1530: number;
  VIX_1545: number;
  // High/low
  VIX_Day_High: number;
  VIX_Day_Low: number;
  // Moves
  VIX_Morning_Move: number;
  VIX_Afternoon_Move: number;
  VIX_Power_Hour_Move: number;
  VIX_Last_30min_Move: number;
  VIX_Full_Day_Move: number;
  VIX_First_Hour_Move: number;
  // Range and spike metrics
  VIX_Intraday_Range_Pct: number;
  VIX_Spike_From_Open: number;
  VIX_Spike_Flag: number;
  VIX_Crush_From_Open: number;
  VIX_Crush_Flag: number;
  VIX_Close_In_Range: number;
}

/**
 * Legacy interface alias for backwards compatibility
 * @deprecated Use Intraday15MinData instead
 */
export type IntradayMarketData = Intraday15MinData;

/**
 * Combined market data (daily + intraday + optional highlow + optional vix)
 */
export interface MarketDataRecord extends DailyMarketData {
  intraday?: Intraday15MinData;
  highlow?: HighLowTimingData;
  vix?: VixIntradayData;
}


// =============================================================================
// Data Loading & Caching
// =============================================================================

// In-memory cache for market data
let dailyDataCache: Map<string, DailyMarketData> | null = null;
let intradayDataCache: Map<string, Intraday15MinData> | null = null;
let highlowDataCache: Map<string, HighLowTimingData> | null = null;
let vixIntradayDataCache: Map<string, VixIntradayData> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Parse TradingView timestamp to YYYY-MM-DD date string in Eastern Time.
 * Trading data is always in ET, so we must format dates in that timezone.
 */
function parseTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  // Format as YYYY-MM-DD in Eastern Time (America/New_York)
  // This handles both EST and EDT automatically
  const formatted = date.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatted; // Returns YYYY-MM-DD format
}

/**
 * Parse a numeric value, handling NaN/undefined
 */
function parseNum(value: string | undefined): number {
  if (!value || value === "NaN" || value === "NA" || value === "") {
    return NaN;
  }
  return parseFloat(value);
}

/**
 * Load daily market data CSV
 */
async function loadDailyData(baseDir: string): Promise<Map<string, DailyMarketData>> {
  const filePath = path.join(baseDir, "_marketdata", "spx_daily.csv");
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.trim().split("\n");

  if (lines.length < 2) {
    throw new Error("Daily market data file is empty or has no data rows");
  }

  const headers = lines[0].split(",");
  const data = new Map<string, DailyMarketData>();

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const timestamp = parseInt(values[0], 10);
    const date = parseTimestamp(timestamp);

    // Map columns by header name
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });

    const record: DailyMarketData = {
      date,
      Prior_Close: parseNum(row["Prior_Close"]),
      Open: parseNum(row["Open"]),
      High: parseNum(row["High"]),
      Low: parseNum(row["Low"]),
      Close: parseNum(row["Close"]),
      Gap_Pct: parseNum(row["Gap_Pct"]),
      Intraday_Range_Pct: parseNum(row["Intraday_Range_Pct"]),
      Intraday_Return_Pct: parseNum(row["Intraday_Return_Pct"]),
      Total_Return_Pct: parseNum(row["Total_Return_Pct"]),
      Close_Position_In_Range: parseNum(row["Close_Position_In_Range"]),
      Gap_Filled: parseNum(row["Gap_Filled"]),
      VIX_Open: parseNum(row["VIX_Open"]),
      VIX_Close: parseNum(row["VIX_Close"]),
      VIX_Change_Pct: parseNum(row["VIX_Change_Pct"]),
      VIX_Spike_Pct: parseNum(row["VIX_Spike_Pct"]),
      VIX_Percentile: parseNum(row["VIX_Percentile"]),
      Vol_Regime: parseNum(row["Vol_Regime"]),
      VIX9D_Close: parseNum(row["VIX9D_Close"]),
      VIX3M_Close: parseNum(row["VIX3M_Close"]),
      VIX9D_VIX_Ratio: parseNum(row["VIX9D_VIX_Ratio"]),
      VIX_VIX3M_Ratio: parseNum(row["VIX_VIX3M_Ratio"]),
      Term_Structure_State: parseNum(row["Term_Structure_State"]),
      ATR_Pct: parseNum(row["ATR_Pct"]),
      RSI_14: parseNum(row["RSI_14"]),
      Price_vs_EMA21_Pct: parseNum(row["Price_vs_EMA21_Pct"]),
      Price_vs_SMA50_Pct: parseNum(row["Price_vs_SMA50_Pct"]),
      Trend_Score: parseNum(row["Trend_Score"]),
      BB_Position: parseNum(row["BB_Position"]),
      Return_5D: parseNum(row["Return_5D"]),
      Return_20D: parseNum(row["Return_20D"]),
      Consecutive_Days: parseNum(row["Consecutive_Days"]),
      Day_of_Week: parseNum(row["Day_of_Week"]),
      Month: parseNum(row["Month"]),
      Is_Opex: parseNum(row["Is_Opex"]),
      Prev_Return_Pct: parseNum(row["Prev_Return_Pct"]),
    };

    data.set(date, record);
  }

  return data;
}

/**
 * Load 15-minute intraday market data CSV (aggregated to one row per day)
 */
async function loadIntradayData(baseDir: string): Promise<Map<string, Intraday15MinData>> {
  const filePath = path.join(baseDir, "_marketdata", "spx_15min.csv");

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");

    if (lines.length < 2) {
      return new Map();
    }

    const headers = lines[0].split(",");
    const data = new Map<string, Intraday15MinData>();

    // Process lines - take the last row for each date (has complete data)
    const dateRows = new Map<string, string[]>();

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const timestamp = parseInt(values[0], 10);
      const date = parseTimestamp(timestamp);
      dateRows.set(date, values); // Overwrites, keeping last row
    }

    // Convert to Intraday15MinData records
    for (const [date, values] of dateRows) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });

      const record: Intraday15MinData = {
        date,
        open: parseNum(row["open"]),
        high: parseNum(row["high"]),
        low: parseNum(row["low"]),
        close: parseNum(row["close"]),
        // 15-minute checkpoint prices
        P_0930: parseNum(row["P_0930"]),
        P_0945: parseNum(row["P_0945"]),
        P_1000: parseNum(row["P_1000"]),
        P_1015: parseNum(row["P_1015"]),
        P_1030: parseNum(row["P_1030"]),
        P_1045: parseNum(row["P_1045"]),
        P_1100: parseNum(row["P_1100"]),
        P_1115: parseNum(row["P_1115"]),
        P_1130: parseNum(row["P_1130"]),
        P_1145: parseNum(row["P_1145"]),
        P_1200: parseNum(row["P_1200"]),
        P_1215: parseNum(row["P_1215"]),
        P_1230: parseNum(row["P_1230"]),
        P_1245: parseNum(row["P_1245"]),
        P_1300: parseNum(row["P_1300"]),
        P_1315: parseNum(row["P_1315"]),
        P_1330: parseNum(row["P_1330"]),
        P_1345: parseNum(row["P_1345"]),
        P_1400: parseNum(row["P_1400"]),
        P_1415: parseNum(row["P_1415"]),
        P_1430: parseNum(row["P_1430"]),
        P_1445: parseNum(row["P_1445"]),
        P_1500: parseNum(row["P_1500"]),
        P_1515: parseNum(row["P_1515"]),
        P_1530: parseNum(row["P_1530"]),
        P_1545: parseNum(row["P_1545"]),
        // Percentage moves
        Pct_0930_to_1000: parseNum(row["Pct_0930_to_1000"]),
        Pct_0930_to_1200: parseNum(row["Pct_0930_to_1200"]),
        Pct_0930_to_1500: parseNum(row["Pct_0930_to_1500"]),
        Pct_0930_to_Close: parseNum(row["Pct_0930_to_Close"]),
        // Market-on-close moves
        MOC_15min: parseNum(row["MOC_15min"]),
        MOC_30min: parseNum(row["MOC_30min"]),
        MOC_45min: parseNum(row["MOC_45min"]),
        MOC_60min: parseNum(row["MOC_60min"]),
        // Afternoon action
        Afternoon_Move: parseNum(row["Afternoon_Move"]),
      };

      data.set(date, record);
    }

    return data;
  } catch {
    // Intraday file is optional
    return new Map();
  }
}

/**
 * Load high/low timing data CSV (optional, one row per day)
 */
async function loadHighLowData(baseDir: string): Promise<Map<string, HighLowTimingData>> {
  const filePath = path.join(baseDir, "_marketdata", "spx_highlow.csv");

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");

    if (lines.length < 2) {
      return new Map();
    }

    const headers = lines[0].split(",");
    const data = new Map<string, HighLowTimingData>();

    // Process lines - take the last row for each date (has complete data)
    const dateRows = new Map<string, string[]>();

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const timestamp = parseInt(values[0], 10);
      const date = parseTimestamp(timestamp);
      dateRows.set(date, values); // Overwrites, keeping last row
    }

    // Convert to HighLowTimingData records
    for (const [date, values] of dateRows) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });

      const record: HighLowTimingData = {
        date,
        open: parseNum(row["open"]),
        high: parseNum(row["high"]),
        low: parseNum(row["low"]),
        close: parseNum(row["close"]),
        High_Time: parseNum(row["High_Time"]),
        Low_Time: parseNum(row["Low_Time"]),
        High_Before_Low: parseNum(row["High_Before_Low"]),
        High_In_First_Hour: parseNum(row["High_In_First_Hour"]),
        Low_In_First_Hour: parseNum(row["Low_In_First_Hour"]),
        High_In_Last_Hour: parseNum(row["High_In_Last_Hour"]),
        Low_In_Last_Hour: parseNum(row["Low_In_Last_Hour"]),
        Reversal_Type: parseNum(row["Reversal_Type"]),
        High_Low_Spread: parseNum(row["High_Low_Spread"]),
        Early_Extreme: parseNum(row["Early_Extreme"]),
        Late_Extreme: parseNum(row["Late_Extreme"]),
        Intraday_High: parseNum(row["Intraday_High"]),
        Intraday_Low: parseNum(row["Intraday_Low"]),
      };

      data.set(date, record);
    }

    return data;
  } catch {
    // High/low file is optional - return empty Map if missing
    return new Map();
  }
}

/**
 * Load VIX intraday data CSV (optional, one row per day)
 */
async function loadVixIntradayData(baseDir: string): Promise<Map<string, VixIntradayData>> {
  const filePath = path.join(baseDir, "_marketdata", "vix_intraday.csv");

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");

    if (lines.length < 2) {
      return new Map();
    }

    const headers = lines[0].split(",");
    const data = new Map<string, VixIntradayData>();

    // Process lines - take the last row for each date (has complete data)
    const dateRows = new Map<string, string[]>();

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const timestamp = parseInt(values[0], 10);
      const date = parseTimestamp(timestamp);
      dateRows.set(date, values); // Overwrites, keeping last row
    }

    // Convert to VixIntradayData records
    for (const [date, values] of dateRows) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });

      const record: VixIntradayData = {
        date,
        open: parseNum(row["open"]),
        high: parseNum(row["high"]),
        low: parseNum(row["low"]),
        close: parseNum(row["close"]),
        VIX_0930: parseNum(row["VIX_0930"]),
        VIX_1000: parseNum(row["VIX_1000"]),
        VIX_1030: parseNum(row["VIX_1030"]),
        VIX_1100: parseNum(row["VIX_1100"]),
        VIX_1130: parseNum(row["VIX_1130"]),
        VIX_1200: parseNum(row["VIX_1200"]),
        VIX_1230: parseNum(row["VIX_1230"]),
        VIX_1300: parseNum(row["VIX_1300"]),
        VIX_1330: parseNum(row["VIX_1330"]),
        VIX_1400: parseNum(row["VIX_1400"]),
        VIX_1430: parseNum(row["VIX_1430"]),
        VIX_1500: parseNum(row["VIX_1500"]),
        VIX_1530: parseNum(row["VIX_1530"]),
        VIX_1545: parseNum(row["VIX_1545"]),
        VIX_Day_High: parseNum(row["VIX_Day_High"]),
        VIX_Day_Low: parseNum(row["VIX_Day_Low"]),
        VIX_Morning_Move: parseNum(row["VIX_Morning_Move"]),
        VIX_Afternoon_Move: parseNum(row["VIX_Afternoon_Move"]),
        VIX_Power_Hour_Move: parseNum(row["VIX_Power_Hour_Move"]),
        VIX_Last_30min_Move: parseNum(row["VIX_Last_30min_Move"]),
        VIX_Full_Day_Move: parseNum(row["VIX_Full_Day_Move"]),
        VIX_First_Hour_Move: parseNum(row["VIX_First_Hour_Move"]),
        VIX_Intraday_Range_Pct: parseNum(row["VIX_Intraday_Range_Pct"]),
        VIX_Spike_From_Open: parseNum(row["VIX_Spike_From_Open"]),
        VIX_Spike_Flag: parseNum(row["VIX_Spike_Flag"]),
        VIX_Crush_From_Open: parseNum(row["VIX_Crush_From_Open"]),
        VIX_Crush_Flag: parseNum(row["VIX_Crush_Flag"]),
        VIX_Close_In_Range: parseNum(row["VIX_Close_In_Range"]),
      };

      data.set(date, record);
    }

    return data;
  } catch {
    // VIX intraday file is optional - return empty Map if missing
    return new Map();
  }
}

/**
 * Get market data with caching
 */
async function getMarketData(baseDir: string): Promise<{
  daily: Map<string, DailyMarketData>;
  intraday: Map<string, Intraday15MinData>;
  highlow: Map<string, HighLowTimingData>;
  vixIntraday: Map<string, VixIntradayData>;
}> {
  const now = Date.now();

  // Check if cache is valid
  if (dailyDataCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return {
      daily: dailyDataCache,
      intraday: intradayDataCache || new Map(),
      highlow: highlowDataCache || new Map(),
      vixIntraday: vixIntradayDataCache || new Map(),
    };
  }

  // Load fresh data (all in parallel)
  const [daily, intraday, highlow, vixIntraday] = await Promise.all([
    loadDailyData(baseDir),
    loadIntradayData(baseDir),
    loadHighLowData(baseDir),
    loadVixIntradayData(baseDir),
  ]);

  // Update cache
  dailyDataCache = daily;
  intradayDataCache = intraday;
  highlowDataCache = highlow;
  vixIntradayDataCache = vixIntraday;
  cacheTimestamp = now;

  return { daily, intraday, highlow, vixIntraday };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format trade date to YYYY-MM-DD for matching.
 * Trades are stored in Eastern Time, so we format in that timezone.
 */
function formatTradeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Format in Eastern Time to match market data
  const formatted = d.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatted; // Returns YYYY-MM-DD format
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
 * - enrich_trades: SELECT t.*, m.* FROM trades.trade_data t JOIN market.spx_daily m ON ...
 * - find_similar_days: Use CTE with similarity conditions
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
        "Identifies which market conditions favor or hurt the strategy.",
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
    async ({ blockId, segmentBy, strategy }) => {
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

        const { daily } = await getMarketData(baseDir);

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

        for (const trade of trades) {
          const tradeDate = formatTradeDate(trade.dateOpened);
          const marketData = daily.get(tradeDate);

          if (!marketData) continue;

          totalMatched++;
          const isWin = trade.pl > 0;
          if (isWin) totalWins++;
          totalPl += trade.pl;

          // Get segment value
          let segmentKey: string;
          let segmentLabel: string;
          let segmentValue: number | string;

          switch (segmentBy) {
            case "volRegime":
              segmentValue = marketData.Vol_Regime;
              segmentKey = String(segmentValue);
              segmentLabel = getVolRegimeLabel(marketData.Vol_Regime);
              break;
            case "termStructure":
              segmentValue = marketData.Term_Structure_State;
              segmentKey = String(segmentValue);
              segmentLabel = getTermStructureLabel(marketData.Term_Structure_State);
              break;
            case "dayOfWeek":
              segmentValue = marketData.Day_of_Week;
              segmentKey = String(segmentValue);
              segmentLabel = getDayLabel(marketData.Day_of_Week);
              break;
            case "gapDirection":
              segmentValue = marketData.Gap_Pct > 0.1 ? "up" : marketData.Gap_Pct < -0.1 ? "down" : "flat";
              segmentKey = segmentValue;
              segmentLabel = `Gap ${segmentValue}`;
              break;
            case "trendScore":
              segmentValue = marketData.Trend_Score;
              segmentKey = String(segmentValue);
              segmentLabel = `Trend Score ${segmentValue}`;
              break;
            default:
              continue;
          }

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
            const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

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

        // Generate insight
        const bestSegment = segmentStats.reduce((best, seg) =>
          seg.winRate > best.winRate ? seg : best
        );
        const worstSegment = segmentStats.reduce((worst, seg) =>
          seg.winRate < worst.winRate && seg.tradeCount >= 3 ? seg : worst
        );

        let insight = "";
        if (bestSegment.tradeCount >= 3 && worstSegment.tradeCount >= 3) {
          insight = `Best performance in ${bestSegment.segment} (${formatPercent(bestSegment.winRate)} win rate, ${bestSegment.tradeCount} trades). `;
          if (worstSegment.segment !== bestSegment.segment) {
            insight += `Weakest in ${worstSegment.segment} (${formatPercent(worstSegment.winRate)} win rate, ${worstSegment.tradeCount} trades).`;
          }
        }

        const summary = `Regime analysis: ${blockId} by ${segmentBy} | ${totalMatched} trades across ${segmentStats.length} segments`;

        return createToolOutput(summary, {
          blockId,
          segmentBy,
          strategy: strategy || null,
          tradesMatched: totalMatched,
          overall: {
            winRate: Math.round(overallWinRate * 100) / 100,
            avgPl: Math.round(overallAvgPl * 100) / 100,
            totalPl: Math.round(totalPl * 100) / 100,
          },
          segments: segmentStats,
          insight,
        });
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    }
  );

  // ---------------------------------------------------------------------------
  // suggest_filters - Analyze losing trades and suggest market-based filters
  // ---------------------------------------------------------------------------
  server.registerTool(
    "suggest_filters",
    {
      description:
        "Analyze a block's losing trades and suggest market-based filters that would have improved performance. " +
        "Returns actionable filter suggestions with projected impact.",
      inputSchema: z.object({
        blockId: z.string().describe("Block ID to analyze"),
        strategy: z.string().optional().describe("Filter to specific strategy"),
        minImprovementPct: z.number().optional().describe("Only suggest filters with >= X% win rate improvement (default: 3)"),
      }),
    },
    async ({ blockId, strategy, minImprovementPct = 3 }) => {
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

        const { daily } = await getMarketData(baseDir);

        // Match trades to market data
        interface EnrichedTrade {
          trade: Trade;
          market: DailyMarketData | null;
        }

        const enrichedTrades: EnrichedTrade[] = trades.map((trade) => {
          const tradeDate = formatTradeDate(trade.dateOpened);
          return {
            trade,
            market: daily.get(tradeDate) || null,
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
          test: (m: DailyMarketData) => boolean;
        }> = [
          // Gap filters
          { name: "Skip when |Gap_Pct| > 0.5%", field: "Gap_Pct", operator: ">", value: 0.5, test: (m) => Math.abs(m.Gap_Pct) > 0.5 },
          { name: "Skip when |Gap_Pct| > 0.8%", field: "Gap_Pct", operator: ">", value: 0.8, test: (m) => Math.abs(m.Gap_Pct) > 0.8 },
          { name: "Skip when |Gap_Pct| > 1.0%", field: "Gap_Pct", operator: ">", value: 1.0, test: (m) => Math.abs(m.Gap_Pct) > 1.0 },
          // VIX filters
          { name: "Skip when VIX > 25", field: "VIX_Close", operator: ">", value: 25, test: (m) => m.VIX_Close > 25 },
          { name: "Skip when VIX > 30", field: "VIX_Close", operator: ">", value: 30, test: (m) => m.VIX_Close > 30 },
          { name: "Skip when VIX < 14", field: "VIX_Close", operator: "<", value: 14, test: (m) => m.VIX_Close < 14 },
          // VIX spike filter
          { name: "Skip when VIX_Spike_Pct > 5%", field: "VIX_Spike_Pct", operator: ">", value: 5, test: (m) => m.VIX_Spike_Pct > 5 },
          { name: "Skip when VIX_Spike_Pct > 8%", field: "VIX_Spike_Pct", operator: ">", value: 8, test: (m) => m.VIX_Spike_Pct > 8 },
          // Term structure
          { name: "Skip backwardation days", field: "Term_Structure_State", operator: "==", value: -1, test: (m) => m.Term_Structure_State === -1 },
          // Vol regime
          { name: "Skip Vol Regime 5-6 (High/Extreme)", field: "Vol_Regime", operator: "in", value: [5, 6], test: (m) => m.Vol_Regime >= 5 },
          { name: "Skip Vol Regime 1 (Very Low)", field: "Vol_Regime", operator: "==", value: 1, test: (m) => m.Vol_Regime === 1 },
          // Day of week
          { name: "Skip Fridays", field: "Day_of_Week", operator: "==", value: 6, test: (m) => m.Day_of_Week === 6 },
          { name: "Skip Mondays", field: "Day_of_Week", operator: "==", value: 2, test: (m) => m.Day_of_Week === 2 },
          // OPEX
          { name: "Skip OPEX days", field: "Is_Opex", operator: "==", value: 1, test: (m) => m.Is_Opex === 1 },
          // Trend
          { name: "Skip when Trend_Score <= 1", field: "Trend_Score", operator: "<=", value: 1, test: (m) => m.Trend_Score <= 1 },
          { name: "Skip when Trend_Score >= 4", field: "Trend_Score", operator: ">=", value: 4, test: (m) => m.Trend_Score >= 4 },
          // Consecutive days
          { name: "Skip after 4+ consecutive up days", field: "Consecutive_Days", operator: ">=", value: 4, test: (m) => m.Consecutive_Days >= 4 },
          { name: "Skip after 4+ consecutive down days", field: "Consecutive_Days", operator: "<=", value: -4, test: (m) => m.Consecutive_Days <= -4 },
          // RSI
          { name: "Skip when RSI > 70", field: "RSI_14", operator: ">", value: 70, test: (m) => m.RSI_14 > 70 },
          { name: "Skip when RSI < 30", field: "RSI_14", operator: "<", value: 30, test: (m) => m.RSI_14 < 30 },
        ];

        for (const filterDef of testFilters) {
          // Identify trades that would be removed
          const removed = matchedTrades.filter((t) => filterDef.test(t.market!));
          const remaining = matchedTrades.filter((t) => !filterDef.test(t.market!));

          if (removed.length === 0 || remaining.length < 5) continue;

          const winnersRemoved = removed.filter((t) => t.trade.pl > 0).length;
          const losersRemoved = removed.length - winnersRemoved;

          const newWins = remaining.filter((t) => t.trade.pl > 0).length;
          const newWinRate = (newWins / remaining.length) * 100;
          const newTotalPl = remaining.reduce((sum, t) => sum + t.trade.pl, 0);

          const winRateDelta = newWinRate - currentWinRate;
          const plDelta = newTotalPl - currentTotalPl;

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
    }
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
        startTime: z.string().describe("ORB start time in HHMM format (e.g., '0930' for 9:30 AM)"),
        endTime: z.string().describe("ORB end time in HHMM format (e.g., '1000' for 10:00 AM)"),
        startDate: z.string().describe("Start date (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date (YYYY-MM-DD), defaults to startDate"),
        limit: z.number().optional().describe("Max rows to return (default: 100)"),
      }),
    },
    async ({ startTime, endTime, startDate, endDate, limit = 100 }) => {
      try {
        const { intraday } = await getMarketData(baseDir);

        if (intraday.size === 0) {
          return {
            content: [{ type: "text", text: "No 15-minute intraday data available (spx_15min.csv not found)" }],
            isError: true,
          };
        }

        // Map of available checkpoint times to their field names
        const checkpointFields: Record<string, keyof Intraday15MinData> = {
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

        // Get date range
        const end = endDate || startDate;
        const startD = new Date(startDate);
        const endD = new Date(end);

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

        for (const [date, intradayData] of intraday) {
          const d = new Date(date);
          if (d < startD || d > endD) continue;

          // Get prices at each checkpoint in the ORB range
          const prices: number[] = [];
          for (const time of orbTimes) {
            const field = checkpointFields[time];
            const price = intradayData[field] as number;
            if (!isNaN(price) && price > 0) {
              prices.push(price);
            }
          }

          if (prices.length === 0) continue;

          const orbHigh = Math.max(...prices);
          const orbLow = Math.min(...prices);
          const orbRange = orbHigh - orbLow;
          const orbRangePct = (orbRange / orbLow) * 100;
          const close = intradayData.close;

          // Calculate where close is relative to ORB
          let closePositionInOrb: number;
          let closeVsOrb: "above" | "below" | "within";

          if (close > orbHigh) {
            closePositionInOrb = 1 + (close - orbHigh) / orbRange;
            closeVsOrb = "above";
          } else if (close < orbLow) {
            closePositionInOrb = (close - orbLow) / orbRange;
            closeVsOrb = "below";
          } else {
            closePositionInOrb = orbRange > 0 ? (close - orbLow) / orbRange : 0.5;
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
        const avgOrbRangePct = results.length > 0
          ? results.reduce((sum, r) => sum + r.ORB_Range_Pct, 0) / results.length
          : 0;

        const summary = `ORB (${startTime}-${endTime}): ${startDate} to ${end} | ${totalDays} days, avg range ${formatPercent(avgOrbRangePct)}`;

        return createToolOutput(summary, {
          query: {
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
            closeAbovePct: Math.round((aboveCount / totalDays) * 10000) / 100,
            closeBelowPct: Math.round((belowCount / totalDays) * 10000) / 100,
            closeWithinPct: Math.round((withinCount / totalDays) * 10000) / 100,
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
    }
  );
}
