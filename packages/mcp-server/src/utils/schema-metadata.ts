/**
 * Schema Metadata
 *
 * Hardcoded descriptions for DuckDB tables and columns, plus example queries.
 * Used by describe_database tool to provide context for SQL query writing.
 *
 * Tables are organized by schema:
 *   - trades: Trade data from CSV files
 *   - market: Market context data (SPX, VIX)
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface ColumnDescription {
  /** Human-readable description of what this column contains */
  description: string;
  /** True if this column is useful for hypothesis testing (filtering, grouping, analysis) */
  hypothesis: boolean;
}

export interface TableDescription {
  /** Human-readable description of this table's purpose */
  description: string;
  /** Key columns that are most important for analysis */
  keyColumns: string[];
  /** Column descriptions by column name */
  columns: Record<string, ColumnDescription>;
}

export interface SchemaDescription {
  /** Human-readable description of this schema's purpose */
  description: string;
  /** Tables in this schema */
  tables: Record<string, TableDescription>;
}

export interface SchemaMetadata {
  trades: SchemaDescription;
  market: SchemaDescription;
}

export interface ExampleQuery {
  /** What this query does */
  description: string;
  /** The SQL query */
  sql: string;
}

export interface ExampleQueries {
  /** Basic single-table queries */
  basic: ExampleQuery[];
  /** JOIN queries between trades and market data */
  joins: ExampleQuery[];
  /** Hypothesis testing patterns */
  hypothesis: ExampleQuery[];
}

// ============================================================================
// Schema Descriptions
// ============================================================================

export const SCHEMA_DESCRIPTIONS: SchemaMetadata = {
  trades: {
    description:
      "Trading data synced from CSV files. Contains trade records from all portfolio blocks.",
    tables: {
      trade_data: {
        description:
          "Individual trade records. Each row = one trade with entry/exit details, P&L, and strategy. Filter by block_id to query specific portfolios.",
        keyColumns: ["block_id", "date_opened", "strategy", "pl"],
        columns: {
          block_id: {
            description: "Portfolio block ID - filter by this to query specific portfolios",
            hypothesis: true,
          },
          date_opened: {
            description: "Trade entry date (DATE format, use for joins with market data)",
            hypothesis: true,
          },
          time_opened: {
            description: "Trade entry time in Eastern Time (e.g., '09:35:00')",
            hypothesis: false,
          },
          strategy: {
            description: "Strategy name (e.g., 'IronCondor', 'PutSpread')",
            hypothesis: true,
          },
          legs: {
            description: "Option legs description (e.g., 'SPY 450P/445P')",
            hypothesis: false,
          },
          premium: {
            description: "Credit received (+) or debit paid (-)",
            hypothesis: false,
          },
          num_contracts: {
            description: "Number of contracts traded",
            hypothesis: false,
          },
          pl: {
            description: "Gross P&L before commissions (DOUBLE)",
            hypothesis: true,
          },
          date_closed: {
            description: "Trade exit date (NULL if still open)",
            hypothesis: false,
          },
          time_closed: {
            description: "Trade exit time in Eastern Time",
            hypothesis: false,
          },
          reason_for_close: {
            description: "Exit reason (e.g., 'Target', 'Stop', 'Expiration')",
            hypothesis: true,
          },
          margin_req: {
            description: "Margin requirement for the position ($)",
            hypothesis: false,
          },
          opening_commissions: {
            description: "Commissions paid at entry ($)",
            hypothesis: false,
          },
          closing_commissions: {
            description: "Commissions paid at exit ($)",
            hypothesis: false,
          },
        },
      },
    },
  },
  market: {
    description:
      "Market context data for hypothesis testing. SPX prices, VIX levels, technical indicators. Source: CSV files in market/ folder.",
    tables: {
      spx_daily: {
        description:
          "Daily SPX data with technical indicators, VIX context, and regime classifications. JOIN with trades on date_opened = date.",
        keyColumns: ["date", "Vol_Regime", "VIX_Close", "Total_Return_Pct", "Trend_Score"],
        columns: {
          date: {
            description: "Trading date (VARCHAR, format YYYY-MM-DD). Primary key.",
            hypothesis: true,
          },
          Prior_Close: {
            description: "Previous day's SPX close price",
            hypothesis: false,
          },
          Open: {
            description: "SPX open price",
            hypothesis: false,
          },
          High: {
            description: "SPX high price",
            hypothesis: false,
          },
          Low: {
            description: "SPX low price",
            hypothesis: false,
          },
          Close: {
            description: "SPX close price",
            hypothesis: false,
          },
          Gap_Pct: {
            description: "Overnight gap percentage ((Open - Prior_Close) / Prior_Close * 100)",
            hypothesis: true,
          },
          Intraday_Range_Pct: {
            description: "Intraday range as percentage ((High - Low) / Open * 100)",
            hypothesis: true,
          },
          Intraday_Return_Pct: {
            description: "Open to close return percentage ((Close - Open) / Open * 100)",
            hypothesis: true,
          },
          Total_Return_Pct: {
            description: "Prior close to close return percentage",
            hypothesis: true,
          },
          Close_Position_In_Range: {
            description: "Where close is in day's range (0 = low, 1 = high)",
            hypothesis: true,
          },
          Gap_Filled: {
            description: "Whether overnight gap was filled (1 = yes, 0 = no)",
            hypothesis: true,
          },
          VIX_Open: {
            description: "VIX open value",
            hypothesis: false,
          },
          VIX_Close: {
            description: "VIX close value - key volatility indicator",
            hypothesis: true,
          },
          VIX_Change_Pct: {
            description: "VIX percentage change from prior close",
            hypothesis: true,
          },
          VIX_Spike_Pct: {
            description: "VIX spike from open to high as percentage",
            hypothesis: true,
          },
          VIX_Percentile: {
            description: "VIX percentile rank (0-100) vs historical",
            hypothesis: true,
          },
          Vol_Regime: {
            description:
              "Volatility regime classification (1=low, 2=normal, 3=elevated, 4=high, 5=extreme)",
            hypothesis: true,
          },
          VIX9D_Close: {
            description: "9-day VIX close",
            hypothesis: false,
          },
          VIX3M_Close: {
            description: "3-month VIX close",
            hypothesis: false,
          },
          VIX9D_VIX_Ratio: {
            description: "VIX9D/VIX ratio - term structure indicator",
            hypothesis: true,
          },
          VIX_VIX3M_Ratio: {
            description: "VIX/VIX3M ratio - term structure indicator",
            hypothesis: true,
          },
          Term_Structure_State: {
            description:
              "VIX term structure state (1=backwardation, 0=flat, -1=contango)",
            hypothesis: true,
          },
          ATR_Pct: {
            description: "Average True Range as percentage of price",
            hypothesis: true,
          },
          RSI_14: {
            description: "14-day RSI (0-100, >70 overbought, <30 oversold)",
            hypothesis: true,
          },
          Price_vs_EMA21_Pct: {
            description: "Price vs 21-day EMA as percentage",
            hypothesis: true,
          },
          Price_vs_SMA50_Pct: {
            description: "Price vs 50-day SMA as percentage",
            hypothesis: true,
          },
          Trend_Score: {
            description:
              "Trend strength indicator (-5 to +5, negative=downtrend, positive=uptrend)",
            hypothesis: true,
          },
          BB_Position: {
            description:
              "Bollinger Band position (0=lower band, 0.5=middle, 1=upper band)",
            hypothesis: true,
          },
          Return_5D: {
            description: "5-day cumulative return percentage",
            hypothesis: true,
          },
          Return_20D: {
            description: "20-day cumulative return percentage",
            hypothesis: true,
          },
          Consecutive_Days: {
            description: "Consecutive up/down days (positive=up, negative=down)",
            hypothesis: true,
          },
          Day_of_Week: {
            description: "Day of week (1=Monday through 5=Friday)",
            hypothesis: true,
          },
          Month: {
            description: "Month number (1-12)",
            hypothesis: true,
          },
          Is_Opex: {
            description: "Options expiration day flag (1=opex, 0=not)",
            hypothesis: true,
          },
          Prev_Return_Pct: {
            description: "Previous day's total return percentage",
            hypothesis: true,
          },
        },
      },
      spx_15min: {
        description:
          "15-minute SPX intraday checkpoint data. Includes price at each 15-min interval and MOC (market-on-close) moves.",
        keyColumns: ["date", "MOC_30min", "Afternoon_Move"],
        columns: {
          date: {
            description: "Trading date (VARCHAR, format YYYY-MM-DD). Primary key.",
            hypothesis: true,
          },
          open: {
            description: "Day open price",
            hypothesis: false,
          },
          high: {
            description: "Day high price",
            hypothesis: false,
          },
          low: {
            description: "Day low price",
            hypothesis: false,
          },
          close: {
            description: "Day close price",
            hypothesis: false,
          },
          P_0930: {
            description: "Price at 9:30 AM ET",
            hypothesis: false,
          },
          P_0945: {
            description: "Price at 9:45 AM ET",
            hypothesis: false,
          },
          P_1000: {
            description: "Price at 10:00 AM ET",
            hypothesis: false,
          },
          P_1015: {
            description: "Price at 10:15 AM ET",
            hypothesis: false,
          },
          P_1030: {
            description: "Price at 10:30 AM ET",
            hypothesis: false,
          },
          P_1045: {
            description: "Price at 10:45 AM ET",
            hypothesis: false,
          },
          P_1100: {
            description: "Price at 11:00 AM ET",
            hypothesis: false,
          },
          P_1115: {
            description: "Price at 11:15 AM ET",
            hypothesis: false,
          },
          P_1130: {
            description: "Price at 11:30 AM ET",
            hypothesis: false,
          },
          P_1145: {
            description: "Price at 11:45 AM ET",
            hypothesis: false,
          },
          P_1200: {
            description: "Price at 12:00 PM ET",
            hypothesis: false,
          },
          P_1215: {
            description: "Price at 12:15 PM ET",
            hypothesis: false,
          },
          P_1230: {
            description: "Price at 12:30 PM ET",
            hypothesis: false,
          },
          P_1245: {
            description: "Price at 12:45 PM ET",
            hypothesis: false,
          },
          P_1300: {
            description: "Price at 1:00 PM ET",
            hypothesis: false,
          },
          P_1315: {
            description: "Price at 1:15 PM ET",
            hypothesis: false,
          },
          P_1330: {
            description: "Price at 1:30 PM ET",
            hypothesis: false,
          },
          P_1345: {
            description: "Price at 1:45 PM ET",
            hypothesis: false,
          },
          P_1400: {
            description: "Price at 2:00 PM ET",
            hypothesis: false,
          },
          P_1415: {
            description: "Price at 2:15 PM ET",
            hypothesis: false,
          },
          P_1430: {
            description: "Price at 2:30 PM ET",
            hypothesis: false,
          },
          P_1445: {
            description: "Price at 2:45 PM ET",
            hypothesis: false,
          },
          P_1500: {
            description: "Price at 3:00 PM ET",
            hypothesis: false,
          },
          P_1515: {
            description: "Price at 3:15 PM ET",
            hypothesis: false,
          },
          P_1530: {
            description: "Price at 3:30 PM ET",
            hypothesis: false,
          },
          P_1545: {
            description: "Price at 3:45 PM ET",
            hypothesis: false,
          },
          Pct_0930_to_1000: {
            description: "Percent move from 9:30 to 10:00 AM",
            hypothesis: true,
          },
          Pct_0930_to_1200: {
            description: "Percent move from 9:30 AM to 12:00 PM",
            hypothesis: true,
          },
          Pct_0930_to_1500: {
            description: "Percent move from 9:30 AM to 3:00 PM",
            hypothesis: true,
          },
          Pct_0930_to_Close: {
            description: "Percent move from 9:30 AM to close",
            hypothesis: true,
          },
          MOC_15min: {
            description: "Market-on-close move: last 15 minutes percent change",
            hypothesis: true,
          },
          MOC_30min: {
            description: "Market-on-close move: last 30 minutes percent change",
            hypothesis: true,
          },
          MOC_45min: {
            description: "Market-on-close move: last 45 minutes percent change",
            hypothesis: true,
          },
          MOC_60min: {
            description: "Market-on-close move: last 60 minutes percent change",
            hypothesis: true,
          },
          Afternoon_Move: {
            description: "Afternoon session move (12:00 PM to close) percent",
            hypothesis: true,
          },
        },
      },
      spx_highlow: {
        description:
          "SPX high/low timing data. When did the day's high and low occur? Useful for reversal pattern analysis.",
        keyColumns: ["date", "High_Time", "Low_Time", "Reversal_Type"],
        columns: {
          date: {
            description: "Trading date (VARCHAR, format YYYY-MM-DD). Primary key.",
            hypothesis: true,
          },
          open: {
            description: "Day open price",
            hypothesis: false,
          },
          high: {
            description: "Day high price",
            hypothesis: false,
          },
          low: {
            description: "Day low price",
            hypothesis: false,
          },
          close: {
            description: "Day close price",
            hypothesis: false,
          },
          High_Time: {
            description: "Time of day high as decimal (e.g., 10.5 = 10:30 AM)",
            hypothesis: true,
          },
          Low_Time: {
            description: "Time of day low as decimal (e.g., 14.25 = 2:15 PM)",
            hypothesis: true,
          },
          High_Before_Low: {
            description: "Did high occur before low? (1=yes, 0=no)",
            hypothesis: true,
          },
          High_In_First_Hour: {
            description: "Did high occur in first hour? (1=yes, 0=no)",
            hypothesis: true,
          },
          Low_In_First_Hour: {
            description: "Did low occur in first hour? (1=yes, 0=no)",
            hypothesis: true,
          },
          High_In_Last_Hour: {
            description: "Did high occur in last hour? (1=yes, 0=no)",
            hypothesis: true,
          },
          Low_In_Last_Hour: {
            description: "Did low occur in last hour? (1=yes, 0=no)",
            hypothesis: true,
          },
          Reversal_Type: {
            description:
              "Reversal pattern type (1=morning reversal up, -1=morning reversal down, 0=trend day)",
            hypothesis: true,
          },
          High_Low_Spread: {
            description: "Time spread between high and low in hours",
            hypothesis: true,
          },
          Early_Extreme: {
            description: "Was either extreme in first hour? (1=yes, 0=no)",
            hypothesis: true,
          },
          Late_Extreme: {
            description: "Was either extreme in last hour? (1=yes, 0=no)",
            hypothesis: true,
          },
          Intraday_High: {
            description: "Intraday high price (may differ from daily high on gap days)",
            hypothesis: false,
          },
          Intraday_Low: {
            description: "Intraday low price (may differ from daily low on gap days)",
            hypothesis: false,
          },
        },
      },
      vix_intraday: {
        description:
          "VIX intraday data. 30-minute VIX checkpoints throughout the day plus movement metrics.",
        keyColumns: ["date", "VIX_Spike_Flag", "VIX_Crush_Flag", "VIX_Full_Day_Move"],
        columns: {
          date: {
            description: "Trading date (VARCHAR, format YYYY-MM-DD). Primary key.",
            hypothesis: true,
          },
          open: {
            description: "VIX open value",
            hypothesis: false,
          },
          high: {
            description: "VIX high value",
            hypothesis: false,
          },
          low: {
            description: "VIX low value",
            hypothesis: false,
          },
          close: {
            description: "VIX close value",
            hypothesis: false,
          },
          VIX_0930: {
            description: "VIX at 9:30 AM ET",
            hypothesis: false,
          },
          VIX_1000: {
            description: "VIX at 10:00 AM ET",
            hypothesis: false,
          },
          VIX_1030: {
            description: "VIX at 10:30 AM ET",
            hypothesis: false,
          },
          VIX_1100: {
            description: "VIX at 11:00 AM ET",
            hypothesis: false,
          },
          VIX_1130: {
            description: "VIX at 11:30 AM ET",
            hypothesis: false,
          },
          VIX_1200: {
            description: "VIX at 12:00 PM ET",
            hypothesis: false,
          },
          VIX_1230: {
            description: "VIX at 12:30 PM ET",
            hypothesis: false,
          },
          VIX_1300: {
            description: "VIX at 1:00 PM ET",
            hypothesis: false,
          },
          VIX_1330: {
            description: "VIX at 1:30 PM ET",
            hypothesis: false,
          },
          VIX_1400: {
            description: "VIX at 2:00 PM ET",
            hypothesis: false,
          },
          VIX_1430: {
            description: "VIX at 2:30 PM ET",
            hypothesis: false,
          },
          VIX_1500: {
            description: "VIX at 3:00 PM ET",
            hypothesis: false,
          },
          VIX_1530: {
            description: "VIX at 3:30 PM ET",
            hypothesis: false,
          },
          VIX_1545: {
            description: "VIX at 3:45 PM ET",
            hypothesis: false,
          },
          VIX_Day_High: {
            description: "Intraday VIX high",
            hypothesis: true,
          },
          VIX_Day_Low: {
            description: "Intraday VIX low",
            hypothesis: true,
          },
          VIX_Morning_Move: {
            description: "VIX move from open to noon (percent)",
            hypothesis: true,
          },
          VIX_Afternoon_Move: {
            description: "VIX move from noon to close (percent)",
            hypothesis: true,
          },
          VIX_Power_Hour_Move: {
            description: "VIX move during power hour 3-4 PM (percent)",
            hypothesis: true,
          },
          VIX_Last_30min_Move: {
            description: "VIX move in last 30 minutes (percent)",
            hypothesis: true,
          },
          VIX_Full_Day_Move: {
            description: "VIX move from open to close (percent)",
            hypothesis: true,
          },
          VIX_First_Hour_Move: {
            description: "VIX move in first hour 9:30-10:30 (percent)",
            hypothesis: true,
          },
          VIX_Intraday_Range_Pct: {
            description: "VIX intraday range as percent of open",
            hypothesis: true,
          },
          VIX_Spike_From_Open: {
            description: "Max VIX spike from open (percent)",
            hypothesis: true,
          },
          VIX_Spike_Flag: {
            description: "VIX spike detected (1=yes, 0=no) - spike > 10% from open",
            hypothesis: true,
          },
          VIX_Crush_From_Open: {
            description: "Max VIX crush from open (percent, negative)",
            hypothesis: true,
          },
          VIX_Crush_Flag: {
            description: "VIX crush detected (1=yes, 0=no) - crush > 10% from open",
            hypothesis: true,
          },
          VIX_Close_In_Range: {
            description: "Where VIX closed in day's range (0=low, 1=high)",
            hypothesis: true,
          },
        },
      },
    },
  },
};

// ============================================================================
// Example Queries
// ============================================================================

export const EXAMPLE_QUERIES: ExampleQueries = {
  basic: [
    {
      description: "Count trades by strategy with total P&L",
      sql: `SELECT strategy, COUNT(*) as trades, SUM(pl) as total_pl
FROM trades.trade_data
GROUP BY strategy
ORDER BY total_pl DESC`,
    },
    {
      description: "Daily P&L for a specific block",
      sql: `SELECT date_opened, SUM(pl) as daily_pl
FROM trades.trade_data
WHERE block_id = 'my-block'
GROUP BY date_opened
ORDER BY date_opened`,
    },
    {
      description: "Recent market conditions (last 20 days)",
      sql: `SELECT date, Close, VIX_Close, Vol_Regime, Total_Return_Pct
FROM market.spx_daily
ORDER BY date DESC
LIMIT 20`,
    },
    {
      description: "Win/loss summary by block",
      sql: `SELECT
  block_id,
  COUNT(*) as total_trades,
  SUM(CASE WHEN pl > 0 THEN 1 ELSE 0 END) as winners,
  SUM(CASE WHEN pl <= 0 THEN 1 ELSE 0 END) as losers,
  ROUND(100.0 * SUM(CASE WHEN pl > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate
FROM trades.trade_data
GROUP BY block_id
ORDER BY block_id`,
    },
  ],
  joins: [
    {
      description: "Trade P&L with market context (VIX, regime)",
      sql: `SELECT
  t.date_opened, t.strategy, t.pl,
  m.VIX_Close, m.Vol_Regime, m.Total_Return_Pct
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
ORDER BY t.date_opened DESC`,
    },
    {
      description: "Trades with intraday SPX context (MOC moves)",
      sql: `SELECT
  t.date_opened, t.time_opened, t.strategy, t.pl,
  s.MOC_30min, s.Afternoon_Move
FROM trades.trade_data t
JOIN market.spx_15min s ON t.date_opened = s.date
WHERE t.block_id = 'my-block'`,
    },
    {
      description: "Trades on VIX spike days",
      sql: `SELECT
  t.date_opened, t.strategy, t.pl,
  v.VIX_Spike_From_Open, v.VIX_Full_Day_Move
FROM trades.trade_data t
JOIN market.vix_intraday v ON t.date_opened = v.date
WHERE v.VIX_Spike_Flag = 1
  AND t.block_id = 'my-block'
ORDER BY t.date_opened`,
    },
    {
      description: "Trades on reversal days (high/low timing)",
      sql: `SELECT
  t.date_opened, t.strategy, t.pl,
  h.Reversal_Type, h.High_Before_Low, h.High_In_First_Hour
FROM trades.trade_data t
JOIN market.spx_highlow h ON t.date_opened = h.date
WHERE h.Reversal_Type != 0
  AND t.block_id = 'my-block'`,
    },
  ],
  hypothesis: [
    {
      description: "Win rate by VIX regime",
      sql: `SELECT
  m.Vol_Regime,
  COUNT(*) as trades,
  SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) as winners,
  ROUND(100.0 * SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate,
  SUM(t.pl) as total_pl
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
GROUP BY m.Vol_Regime
ORDER BY m.Vol_Regime`,
    },
    {
      description: "P&L by day of week",
      sql: `SELECT
  m.Day_of_Week,
  COUNT(*) as trades,
  SUM(t.pl) as total_pl,
  ROUND(AVG(t.pl), 2) as avg_pl
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
GROUP BY m.Day_of_Week
ORDER BY m.Day_of_Week`,
    },
    {
      description: "Performance in trending vs range-bound markets",
      sql: `SELECT
  CASE WHEN m.Trend_Score >= 3 THEN 'Uptrend'
       WHEN m.Trend_Score <= -3 THEN 'Downtrend'
       ELSE 'Range' END as market_condition,
  COUNT(*) as trades,
  SUM(t.pl) as total_pl,
  ROUND(AVG(t.pl), 2) as avg_pl
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
GROUP BY market_condition`,
    },
    {
      description: "Performance by VIX term structure",
      sql: `SELECT
  CASE WHEN m.Term_Structure_State = 1 THEN 'Backwardation'
       WHEN m.Term_Structure_State = -1 THEN 'Contango'
       ELSE 'Flat' END as term_structure,
  COUNT(*) as trades,
  SUM(t.pl) as total_pl,
  ROUND(AVG(t.pl), 2) as avg_pl,
  ROUND(100.0 * SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
GROUP BY term_structure`,
    },
  ],
};
