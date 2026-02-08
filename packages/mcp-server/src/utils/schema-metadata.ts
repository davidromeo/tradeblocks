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
  /** When this field's value is known relative to market open.
   *  - 'open': Known at/before market open (Prior_Close, Gap_Pct, VIX_Open, etc.)
   *  - 'close': Only known after market close (RSI_14, Vol_Regime, Close, etc.)
   *  - 'static': Calendar/metadata facts known before the day (Day_of_Week, Month, Is_Opex)
   *  Only applicable to market.spx_daily columns. Omit for non-market tables.
   */
  timing?: 'open' | 'close' | 'static';
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
      "Trading data synced from CSV files. Contains trade records from all portfolio blocks, including both backtest (trade_data) and actual/reported (reporting_data) trades.",
    tables: {
      trade_data: {
        description:
          "Individual backtest trade records. Each row = one trade with entry/exit details, P&L, and strategy. Filter by block_id to query specific portfolios.",
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
      reporting_data: {
        description:
          "Actual/reported trade records from reportinglog.csv. Each row = one live trade executed. Compare with trade_data (backtest) to analyze slippage and execution differences. Filter by block_id to query specific portfolios.",
        keyColumns: ["block_id", "date_opened", "strategy", "legs", "pl"],
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
            description: "Option legs description with strikes (e.g., 'SPY 450P/445P') - compare with trade_data.legs to identify strike differences",
            hypothesis: true,
          },
          initial_premium: {
            description: "Credit received (+) or debit paid (-) at entry",
            hypothesis: false,
          },
          num_contracts: {
            description: "Number of contracts traded (often fewer than backtest)",
            hypothesis: false,
          },
          pl: {
            description: "Actual P&L realized (DOUBLE)",
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
          closing_price: {
            description: "Price at exit",
            hypothesis: false,
          },
          avg_closing_cost: {
            description: "Average cost to close the position",
            hypothesis: false,
          },
          reason_for_close: {
            description: "Exit reason (e.g., 'Target', 'Stop', 'Expiration')",
            hypothesis: true,
          },
          opening_price: {
            description: "Price at entry",
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
          "Daily SPX data with technical indicators, VIX context, highlow timing, and regime classifications. JOIN with trades on date_opened = date.",
        keyColumns: ["date", "Vol_Regime", "VIX_Close", "Total_Return_Pct", "Trend_Score", "High_Time", "Reversal_Type"],
        columns: {
          date: {
            description: "Trading date (VARCHAR, format YYYY-MM-DD). Primary key.",
            hypothesis: true,
          },
          Prior_Close: {
            description: "Previous day's SPX close price",
            hypothesis: false,
            timing: 'open',
          },
          open: {
            description: "SPX open price (lowercase to match TradingView export)",
            hypothesis: false,
            timing: 'open',
          },
          high: {
            description: "SPX high price (lowercase to match TradingView export)",
            hypothesis: false,
            timing: 'close',
          },
          low: {
            description: "SPX low price (lowercase to match TradingView export)",
            hypothesis: false,
            timing: 'close',
          },
          close: {
            description: "SPX close price (lowercase to match TradingView export)",
            hypothesis: false,
            timing: 'close',
          },
          Gap_Pct: {
            description: "Overnight gap percentage ((Open - Prior_Close) / Prior_Close * 100)",
            hypothesis: true,
            timing: 'open',
          },
          Intraday_Range_Pct: {
            description: "Intraday range as percentage ((High - Low) / Open * 100)",
            hypothesis: true,
            timing: 'close',
          },
          Intraday_Return_Pct: {
            description: "Open to close return percentage ((Close - Open) / Open * 100)",
            hypothesis: true,
            timing: 'close',
          },
          Total_Return_Pct: {
            description: "Prior close to close return percentage",
            hypothesis: true,
            timing: 'close',
          },
          Close_Position_In_Range: {
            description: "Where close is in day's range (0 = low, 1 = high)",
            hypothesis: true,
            timing: 'close',
          },
          Gap_Filled: {
            description: "Whether overnight gap was filled (1 = yes, 0 = no)",
            hypothesis: true,
            timing: 'close',
          },
          VIX_Open: {
            description: "VIX open value",
            hypothesis: false,
            timing: 'open',
          },
          VIX_Close: {
            description: "VIX close value - key volatility indicator",
            hypothesis: true,
            timing: 'close',
          },
          VIX_Change_Pct: {
            description: "VIX percentage change from prior close",
            hypothesis: true,
            timing: 'close',
          },
          VIX_Spike_Pct: {
            description: "VIX spike from open to high as percentage",
            hypothesis: true,
            timing: 'close',
          },
          VIX_Percentile: {
            description: "VIX percentile rank (0-100) vs historical",
            hypothesis: true,
            timing: 'close',
          },
          Vol_Regime: {
            description:
              "Volatility regime classification (1=low, 2=normal, 3=elevated, 4=high, 5=extreme)",
            hypothesis: true,
            timing: 'close',
          },
          VIX9D_Close: {
            description: "9-day VIX close",
            hypothesis: false,
            timing: 'close',
          },
          VIX3M_Close: {
            description: "3-month VIX close",
            hypothesis: false,
            timing: 'close',
          },
          VIX9D_VIX_Ratio: {
            description: "VIX9D/VIX ratio - term structure indicator",
            hypothesis: true,
            timing: 'close',
          },
          VIX_VIX3M_Ratio: {
            description: "VIX/VIX3M ratio - term structure indicator",
            hypothesis: true,
            timing: 'close',
          },
          Term_Structure_State: {
            description:
              "VIX term structure state (1=backwardation, 0=flat, -1=contango)",
            hypothesis: true,
            timing: 'close',
          },
          ATR_Pct: {
            description: "Average True Range as percentage of price",
            hypothesis: true,
            timing: 'close',
          },
          RSI_14: {
            description: "14-day RSI (0-100, >70 overbought, <30 oversold)",
            hypothesis: true,
            timing: 'close',
          },
          Price_vs_EMA21_Pct: {
            description: "Price vs 21-day EMA as percentage",
            hypothesis: true,
            timing: 'close',
          },
          Price_vs_SMA50_Pct: {
            description: "Price vs 50-day SMA as percentage",
            hypothesis: true,
            timing: 'close',
          },
          Trend_Score: {
            description:
              "Trend strength indicator (-5 to +5, negative=downtrend, positive=uptrend)",
            hypothesis: true,
            timing: 'close',
          },
          BB_Position: {
            description:
              "Bollinger Band position (0=lower band, 0.5=middle, 1=upper band)",
            hypothesis: true,
            timing: 'close',
          },
          Return_5D: {
            description: "5-day cumulative return percentage",
            hypothesis: true,
            timing: 'close',
          },
          Return_20D: {
            description: "20-day cumulative return percentage",
            hypothesis: true,
            timing: 'close',
          },
          Consecutive_Days: {
            description: "Consecutive up/down days (positive=up, negative=down)",
            hypothesis: true,
            timing: 'close',
          },
          Day_of_Week: {
            description: "Day of week (1=Monday through 5=Friday)",
            hypothesis: true,
            timing: 'static',
          },
          Month: {
            description: "Month number (1-12)",
            hypothesis: true,
            timing: 'static',
          },
          Is_Opex: {
            description: "Options expiration day flag (1=opex, 0=not)",
            hypothesis: true,
            timing: 'static',
          },
          Prev_Return_Pct: {
            description: "Previous day's total return percentage",
            hypothesis: true,
            timing: 'open',
          },
          // Highlow timing columns (13)
          High_Time: {
            description: "Time of day high as decimal hours (e.g., 10.5 = 10:30 AM)",
            hypothesis: true,
            timing: 'close',
          },
          Low_Time: {
            description: "Time of day low as decimal hours (e.g., 14.25 = 2:15 PM)",
            hypothesis: true,
            timing: 'close',
          },
          High_Before_Low: {
            description: "Did high occur before low? (1=yes, 0=no)",
            hypothesis: true,
            timing: 'close',
          },
          High_In_First_Hour: {
            description: "Did high occur in first hour? (1=yes, 0=no)",
            hypothesis: true,
            timing: 'close',
          },
          Low_In_First_Hour: {
            description: "Did low occur in first hour? (1=yes, 0=no)",
            hypothesis: true,
            timing: 'close',
          },
          High_In_Last_Hour: {
            description: "Did high occur in last hour? (1=yes, 0=no)",
            hypothesis: true,
            timing: 'close',
          },
          Low_In_Last_Hour: {
            description: "Did low occur in last hour? (1=yes, 0=no)",
            hypothesis: true,
            timing: 'close',
          },
          Reversal_Type: {
            description:
              "Reversal pattern type (1=morning reversal up, -1=morning reversal down, 0=trend day)",
            hypothesis: true,
            timing: 'close',
          },
          High_Low_Spread: {
            description: "Time spread between high and low in hours",
            hypothesis: true,
            timing: 'close',
          },
          Early_Extreme: {
            description: "Was either extreme in first 30 min? (1=yes, 0=no)",
            hypothesis: true,
            timing: 'close',
          },
          Late_Extreme: {
            description: "Was either extreme in last 30 min? (1=yes, 0=no)",
            hypothesis: true,
            timing: 'close',
          },
          Intraday_High: {
            description: "Intraday high price (may differ from daily high on gap days)",
            hypothesis: false,
            timing: 'close',
          },
          Intraday_Low: {
            description: "Intraday low price (may differ from daily low on gap days)",
            hypothesis: false,
            timing: 'close',
          },
          // VIX enrichment columns (7)
          VIX_Gap_Pct: {
            description: "VIX overnight gap percentage ((VIX_Open - prior VIX_Close) / prior VIX_Close * 100)",
            hypothesis: true,
            timing: 'open',
          },
          VIX9D_Open: {
            description: "9-day VIX open value",
            hypothesis: false,
            timing: 'open',
          },
          VIX9D_Change_Pct: {
            description: "9-day VIX open-to-close change percentage",
            hypothesis: true,
            timing: 'close',
          },
          VIX_High: {
            description: "VIX intraday high",
            hypothesis: false,
            timing: 'close',
          },
          VIX_Low: {
            description: "VIX intraday low",
            hypothesis: false,
            timing: 'close',
          },
          VIX3M_Open: {
            description: "3-month VIX open value",
            hypothesis: false,
            timing: 'open',
          },
          VIX3M_Change_Pct: {
            description: "3-month VIX open-to-close change percentage",
            hypothesis: true,
            timing: 'close',
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
    {
      description: "Filter and paginate trades (replaces get_trades)",
      sql: `SELECT date_opened, time_opened, strategy, legs, pl, num_contracts
FROM trades.trade_data
WHERE block_id = 'my-block'
  AND strategy ILIKE '%iron%'
  AND pl > 0
ORDER BY date_opened DESC
LIMIT 50 OFFSET 0`,
    },
    {
      description: "Market data query (replaces get_market_context)",
      sql: `SELECT date, VIX_Close, Vol_Regime, Term_Structure_State, Gap_Pct
FROM market.spx_daily
WHERE date BETWEEN '2024-01-01' AND '2024-06-30'
  AND VIX_Close > 20
ORDER BY date`,
    },
    {
      description: "Compare backtest vs actual trades by date/strategy",
      sql: `SELECT
  t.date_opened, t.strategy, t.legs as bt_legs, r.legs as actual_legs,
  t.pl as bt_pl, r.pl as actual_pl, r.pl - t.pl as slippage
FROM trades.trade_data t
JOIN trades.reporting_data r
  ON t.block_id = r.block_id
  AND t.date_opened = r.date_opened
  AND t.strategy = r.strategy
WHERE t.block_id = 'my-block'
ORDER BY t.date_opened`,
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
  m.Reversal_Type, m.High_Before_Low, m.High_In_First_Hour
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE m.Reversal_Type != 0
  AND t.block_id = 'my-block'`,
    },
    {
      description: "Enrich trades with market data (replaces enrich_trades)",
      sql: `SELECT t.date_opened, t.strategy, t.pl,
       m.VIX_Close, m.Vol_Regime, m.Gap_Pct
FROM trades.trade_data t
LEFT JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'`,
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
    {
      description: "Aggregate by VIX buckets (replaces aggregate_by_field)",
      sql: `SELECT
  CASE
    WHEN m.VIX_Close < 15 THEN '10-15'
    WHEN m.VIX_Close < 20 THEN '15-20'
    WHEN m.VIX_Close < 25 THEN '20-25'
    ELSE '25+'
  END as vix_bucket,
  COUNT(*) as trades,
  SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate,
  SUM(t.pl) as total_pl
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
GROUP BY vix_bucket
ORDER BY vix_bucket`,
    },
    {
      description: "Find similar days by conditions (replaces find_similar_days)",
      sql: `WITH ref AS (
  SELECT VIX_Close, Vol_Regime, Term_Structure_State
  FROM market.spx_daily WHERE date = '2024-01-15'
)
SELECT m.date, m.VIX_Close, m.Vol_Regime, m.Term_Structure_State
FROM market.spx_daily m, ref
WHERE m.date != '2024-01-15'
  AND m.Vol_Regime = ref.Vol_Regime
  AND ABS(m.VIX_Close - ref.VIX_Close) < 3
ORDER BY ABS(m.VIX_Close - ref.VIX_Close)
LIMIT 20`,
    },
  ],
};
