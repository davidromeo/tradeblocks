/**
 * Schema Metadata
 *
 * Hardcoded descriptions for DuckDB tables and columns, plus example queries.
 * Used by describe_database tool to provide context for SQL query writing.
 *
 * Tables are organized by schema:
 *   - trades: Trade data from CSV files
 *   - market: Market context data — daily (per-ticker OHLCV + indicators),
 *             context (global VIX/regime), intraday (raw bar data)
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
   *  Only applicable to market.daily and market.context columns. Omit for non-market tables.
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
      "Market context data for hypothesis testing. Normalized into three tables: daily (per-ticker OHLCV + technical indicators), context (global VIX/regime per trading day), and intraday (raw bar data). Source: CSV files in market/ folder.",
    tables: {
      daily: {
        description:
          "Per-ticker daily OHLCV with Tier 1 enrichment indicators and calendar fields. One row per ticker per trading day. JOIN with trades on ticker+date (e.g., d.ticker = 'SPX' AND t.date_opened = d.date). For trade-entry queries, use LAG() on close-derived fields or JOIN market.context with LEFT JOIN for global VIX/regime data.",
        keyColumns: ["ticker", "date", "RSI_14", "ATR_Pct", "BB_Position", "BB_Width", "Realized_Vol_20D"],
        columns: {
          ticker: {
            description: "Underlying ticker symbol (part of composite primary key with date).",
            hypothesis: true,
          },
          date: {
            description: "Trading date (VARCHAR, format YYYY-MM-DD). Composite primary key with ticker.",
            hypothesis: true,
          },
          // Raw OHLCV
          open: {
            description: "Underlying open price",
            hypothesis: false,
            timing: 'open',
          },
          high: {
            description: "Underlying high price",
            hypothesis: false,
            timing: 'close',
          },
          low: {
            description: "Underlying low price",
            hypothesis: false,
            timing: 'close',
          },
          close: {
            description: "Underlying close price",
            hypothesis: false,
            timing: 'close',
          },
          Prior_Close: {
            description: "Previous day's close price",
            hypothesis: false,
            timing: 'open',
          },
          // Tier 1 enrichment — open-known
          Gap_Pct: {
            description: "Overnight gap percentage ((Open - Prior_Close) / Prior_Close * 100)",
            hypothesis: true,
            timing: 'open',
          },
          Prev_Return_Pct: {
            description: "Previous day's total return percentage (prior close to prior close)",
            hypothesis: true,
            timing: 'open',
          },
          Prior_Range_vs_ATR: {
            description: "Prior trading day's (high - low) / ATR ratio, measures prior day's range relative to average true range",
            hypothesis: true,
            timing: 'open',
          },
          // Tier 1 enrichment — close-derived
          ATR_Pct: {
            description: "Average True Range as percentage of price (14-day Wilder smoothing)",
            hypothesis: true,
            timing: 'close',
          },
          RSI_14: {
            description: "14-day RSI (0-100, >70 overbought, <30 oversold)",
            hypothesis: true,
            timing: 'close',
          },
          Price_vs_EMA21_Pct: {
            description: "Price vs 21-day EMA as percentage ((close - EMA21) / EMA21 * 100)",
            hypothesis: true,
            timing: 'close',
          },
          Price_vs_SMA50_Pct: {
            description: "Price vs 50-day SMA as percentage ((close - SMA50) / SMA50 * 100)",
            hypothesis: true,
            timing: 'close',
          },
          BB_Position: {
            description: "Bollinger Band position (0=lower band, 0.5=middle, 1=upper band)",
            hypothesis: true,
            timing: 'close',
          },
          BB_Width: {
            description: "Bollinger Band width (upper - lower) / middle, measures volatility compression",
            hypothesis: true,
            timing: 'close',
          },
          Realized_Vol_5D: {
            description: "5-day realized volatility (annualized standard deviation of log returns)",
            hypothesis: true,
            timing: 'close',
          },
          Realized_Vol_20D: {
            description: "20-day realized volatility (annualized standard deviation of log returns)",
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
          Consecutive_Days: {
            description: "Consecutive up/down days (positive=up, negative=down)",
            hypothesis: true,
            timing: 'close',
          },
          // Tier 3 intraday timing (columns exist in schema, enrichment deferred)
          High_Time: {
            description: "Time of day high as decimal hours (e.g., 10.5 = 10:30 AM ET)",
            hypothesis: true,
            timing: 'close',
          },
          Low_Time: {
            description: "Time of day low as decimal hours (e.g., 14.25 = 2:15 PM ET)",
            hypothesis: true,
            timing: 'close',
          },
          High_Before_Low: {
            description: "Did high occur before low? (1=yes, 0=no)",
            hypothesis: true,
            timing: 'close',
          },
          Reversal_Type: {
            description: "Reversal pattern type (1=morning reversal up, -1=morning reversal down, 0=trend day)",
            hypothesis: true,
            timing: 'close',
          },
          Opening_Drive_Strength: {
            description: "First-30-min range / full-day range ratio (0-1); higher = strong opening drive",
            hypothesis: true,
            timing: 'close',
          },
          Intraday_Realized_Vol: {
            description: "Annualized realized volatility from intraday bar returns (decimal, e.g., 0.15 = 15%)",
            hypothesis: true,
            timing: 'close',
          },
          // Calendar fields — static
          Day_of_Week: {
            description: "Day of week (2=Monday through 6=Friday)",
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
        },
      },
      context: {
        description:
          "Global VIX and volatility term structure data per trading day. One row per trading day, shared across all tickers. JOIN with market.daily on date to get VIX/regime context alongside per-ticker indicators. Always use LEFT JOIN (context data may not be populated yet).",
        keyColumns: ["date", "Vol_Regime", "VIX_Close", "Term_Structure_State", "VIX_Percentile"],
        columns: {
          date: {
            description: "Trading date (VARCHAR, format YYYY-MM-DD). Primary key.",
            hypothesis: true,
          },
          // Open-known context fields
          VIX_Open: {
            description: "VIX open value",
            hypothesis: true,
            timing: 'open',
          },
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
          VIX3M_Open: {
            description: "3-month VIX open value",
            hypothesis: false,
            timing: 'open',
          },
          // Close-derived context fields
          VIX_Close: {
            description: "VIX close value — key volatility indicator",
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
          VIX_RTH_Open: {
            description: "VIX RTH (Regular Trading Hours) open from first intraday bar in 09:30-09:32 ET window. NULL if no intraday bar available; derived fields fall back to VIX_Open.",
            hypothesis: true,
            timing: 'open',
          },
          VIX_Change_Pct: {
            description: "VIX percentage change from prior close",
            hypothesis: true,
            timing: 'close',
          },
          VIX9D_Close: {
            description: "9-day VIX close",
            hypothesis: false,
            timing: 'close',
          },
          VIX9D_Change_Pct: {
            description: "9-day VIX open-to-close change percentage",
            hypothesis: true,
            timing: 'close',
          },
          VIX3M_Close: {
            description: "3-month VIX close",
            hypothesis: false,
            timing: 'close',
          },
          VIX3M_Change_Pct: {
            description: "3-month VIX open-to-close change percentage",
            hypothesis: true,
            timing: 'close',
          },
          VIX9D_VIX_Ratio: {
            description: "VIX9D/VIX ratio (<1 = contango/normal, >1 = backwardation/fear)",
            hypothesis: true,
            timing: 'close',
          },
          VIX_VIX3M_Ratio: {
            description: "VIX/VIX3M ratio (<1 = contango/normal, >1 = backwardation/fear)",
            hypothesis: true,
            timing: 'close',
          },
          Vol_Regime: {
            description: "Volatility regime classification (1=very low, 2=low, 3=normal, 4=elevated, 5=high, 6=extreme)",
            hypothesis: true,
            timing: 'close',
          },
          Term_Structure_State: {
            description: "VIX term structure state (-1=backwardation/inverted, 0=flat, 1=contango/normal)",
            hypothesis: true,
            timing: 'close',
          },
          VIX_Percentile: {
            description: "VIX percentile rank (0-100) vs historical",
            hypothesis: true,
            timing: 'close',
          },
          VIX_Spike_Pct: {
            description: "VIX spike from open to high as percentage",
            hypothesis: true,
            timing: 'close',
          },
        },
      },
      intraday: {
        description:
          "Raw intraday bars per ticker. One row per bar (any resolution). Use for ORB calculations and intraday context enrichment. Time column is Eastern Time HH:MM format (e.g., '09:30'). Filter by ticker='VIX' to get VIX intraday data.",
        keyColumns: ["ticker", "date", "time"],
        columns: {
          ticker: {
            description: "Underlying ticker symbol (part of composite primary key with date and time).",
            hypothesis: true,
          },
          date: {
            description: "Trading date (VARCHAR, format YYYY-MM-DD). Part of composite primary key.",
            hypothesis: true,
          },
          time: {
            description: "Bar time in HH:MM Eastern Time format (e.g., '09:30', '10:00'). Part of composite primary key.",
            hypothesis: false,
          },
          open: {
            description: "Bar open price",
            hypothesis: false,
          },
          high: {
            description: "Bar high price",
            hypothesis: false,
          },
          low: {
            description: "Bar low price",
            hypothesis: false,
          },
          close: {
            description: "Bar close price",
            hypothesis: false,
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
      sql: `SELECT d.date, d.close, d.RSI_14, d.ATR_Pct, d.BB_Width,
  c.VIX_Close, c.Vol_Regime, c.Term_Structure_State
FROM market.daily d
LEFT JOIN market.context c ON d.date = c.date
WHERE d.ticker = 'SPX'
ORDER BY d.date DESC
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
      description: "Market data query with VIX context",
      sql: `SELECT d.date, d.close, d.Gap_Pct, c.VIX_Close, c.Vol_Regime, c.Term_Structure_State
FROM market.daily d
LEFT JOIN market.context c ON d.date = c.date
WHERE d.ticker = 'SPX'
  AND d.date BETWEEN '2024-01-01' AND '2024-06-30'
  AND c.VIX_Close > 20
ORDER BY d.date`,
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
      description: "Trade P&L with market context (lag-aware: dual-table JOIN before LAG for correctness)",
      sql: `WITH joined AS (
  SELECT d.ticker, d.date,
    d.Gap_Pct, d.Prior_Close, d.Prev_Return_Pct,
    c.VIX_Open,
    d.RSI_14, d.BB_Width, d.Realized_Vol_20D,
    c.VIX_Close, c.Vol_Regime, c.Term_Structure_State
  FROM market.daily d
  LEFT JOIN market.context c ON d.date = c.date
  WHERE d.ticker = 'SPX'
),
lagged AS (
  SELECT *,
    LAG(RSI_14) OVER (PARTITION BY ticker ORDER BY date) AS prev_RSI_14,
    LAG(BB_Width) OVER (PARTITION BY ticker ORDER BY date) AS prev_BB_Width,
    LAG(VIX_Close) OVER (PARTITION BY ticker ORDER BY date) AS prev_VIX_Close,
    LAG(Vol_Regime) OVER (PARTITION BY ticker ORDER BY date) AS prev_Vol_Regime
  FROM joined
)
SELECT
  t.date_opened, t.strategy, t.pl,
  m.Gap_Pct, m.VIX_Open,
  m.prev_RSI_14, m.prev_BB_Width, m.prev_VIX_Close, m.prev_Vol_Regime
FROM trades.trade_data t
JOIN lagged m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
ORDER BY t.date_opened DESC`,
    },
    {
      description: "Trades with ORB context (opening range breakout from intraday bars)",
      sql: `WITH orb_range AS (
  SELECT ticker, date,
    MAX(high) AS ORB_High,
    MIN(low)  AS ORB_Low,
    MAX(high) - MIN(low) AS ORB_Range
  FROM market.intraday
  WHERE ticker = 'SPX'
    AND time >= '09:30' AND time <= '09:45'
  GROUP BY ticker, date
)
SELECT
  t.date_opened, t.strategy, t.pl,
  r.ORB_High, r.ORB_Low, r.ORB_Range
FROM trades.trade_data t
LEFT JOIN orb_range r ON t.date_opened = r.date
WHERE t.block_id = 'my-block'
ORDER BY t.date_opened`,
    },
    {
      description: "VIX intraday data for a specific date (VIX bars are in market.intraday with ticker='VIX')",
      sql: `SELECT time, open, high, low, close
FROM market.intraday
WHERE ticker = 'VIX'
  AND date = '2024-03-15'
ORDER BY time`,
    },
    {
      description: "Trades on reversal days (lag-aware: Reversal_Type uses prior trading day via LAG)",
      sql: `WITH joined AS (
  SELECT d.ticker, d.date,
    d.High_Before_Low, d.Reversal_Type
  FROM market.daily d
  WHERE d.ticker = 'SPX'
),
lagged AS (
  SELECT *,
    LAG(Reversal_Type) OVER (PARTITION BY ticker ORDER BY date) AS prev_Reversal_Type,
    LAG(High_Before_Low) OVER (PARTITION BY ticker ORDER BY date) AS prev_High_Before_Low
  FROM joined
)
SELECT
  t.date_opened, t.strategy, t.pl,
  m.prev_Reversal_Type, m.prev_High_Before_Low
FROM trades.trade_data t
JOIN lagged m ON t.date_opened = m.date
WHERE m.prev_Reversal_Type != 0
  AND t.block_id = 'my-block'`,
    },
    {
      description: "Enrich trades with market data (lag-aware: use enrich_trades tool for full enrichment)",
      sql: `WITH joined AS (
  SELECT d.ticker, d.date,
    d.Gap_Pct, d.Prior_Close,
    c.VIX_Open,
    d.RSI_14, d.ATR_Pct,
    c.VIX_Close, c.Vol_Regime
  FROM market.daily d
  LEFT JOIN market.context c ON d.date = c.date
  WHERE d.ticker = 'SPX'
),
lagged AS (
  SELECT *,
    LAG(VIX_Close) OVER (PARTITION BY ticker ORDER BY date) AS prev_VIX_Close,
    LAG(Vol_Regime) OVER (PARTITION BY ticker ORDER BY date) AS prev_Vol_Regime
  FROM joined
)
SELECT t.date_opened, t.strategy, t.pl,
  m.Gap_Pct, m.VIX_Open, m.prev_VIX_Close, m.prev_Vol_Regime
FROM trades.trade_data t
LEFT JOIN lagged m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'`,
    },
  ],
  hypothesis: [
    {
      description: "Win rate by VIX regime (lag-aware: uses prior day's Vol_Regime from market.context)",
      sql: `WITH joined AS (
  SELECT d.ticker, d.date, c.Vol_Regime
  FROM market.daily d
  LEFT JOIN market.context c ON d.date = c.date
  WHERE d.ticker = 'SPX'
),
lagged AS (
  SELECT *,
    LAG(Vol_Regime) OVER (PARTITION BY ticker ORDER BY date) AS prev_Vol_Regime
  FROM joined
)
SELECT
  m.prev_Vol_Regime AS vol_regime,
  COUNT(*) as trades,
  SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) as winners,
  ROUND(100.0 * SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate,
  SUM(t.pl) as total_pl
FROM trades.trade_data t
JOIN lagged m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
  AND m.prev_Vol_Regime IS NOT NULL
GROUP BY m.prev_Vol_Regime
ORDER BY m.prev_Vol_Regime`,
    },
    {
      description: "P&L by day of week",
      sql: `SELECT
  d.Day_of_Week,
  COUNT(*) as trades,
  SUM(t.pl) as total_pl,
  ROUND(AVG(t.pl), 2) as avg_pl
FROM trades.trade_data t
JOIN market.daily d ON t.date_opened = d.date AND d.ticker = 'SPX'
WHERE t.block_id = 'my-block'
GROUP BY d.Day_of_Week
ORDER BY d.Day_of_Week`,
    },
    {
      description: "Performance by VIX term structure (lag-aware: uses prior day's Term_Structure_State)",
      sql: `WITH joined AS (
  SELECT d.ticker, d.date, c.Term_Structure_State
  FROM market.daily d
  LEFT JOIN market.context c ON d.date = c.date
  WHERE d.ticker = 'SPX'
),
lagged AS (
  SELECT *,
    LAG(Term_Structure_State) OVER (PARTITION BY ticker ORDER BY date) AS prev_Term_Structure_State
  FROM joined
)
SELECT
  CASE WHEN m.prev_Term_Structure_State = -1 THEN 'Backwardation'
       WHEN m.prev_Term_Structure_State = 1 THEN 'Contango'
       ELSE 'Flat' END as term_structure,
  COUNT(*) as trades,
  SUM(t.pl) as total_pl,
  ROUND(AVG(t.pl), 2) as avg_pl,
  ROUND(100.0 * SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate
FROM trades.trade_data t
JOIN lagged m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
  AND m.prev_Term_Structure_State IS NOT NULL
GROUP BY term_structure`,
    },
    {
      description: "Aggregate by VIX buckets (lag-aware: uses prior day's VIX_Close from market.context)",
      sql: `WITH joined AS (
  SELECT d.ticker, d.date, c.VIX_Close
  FROM market.daily d
  LEFT JOIN market.context c ON d.date = c.date
  WHERE d.ticker = 'SPX'
),
lagged AS (
  SELECT *,
    LAG(VIX_Close) OVER (PARTITION BY ticker ORDER BY date) AS prev_VIX_Close
  FROM joined
)
SELECT
  CASE
    WHEN m.prev_VIX_Close < 15 THEN '10-15'
    WHEN m.prev_VIX_Close < 20 THEN '15-20'
    WHEN m.prev_VIX_Close < 25 THEN '20-25'
    ELSE '25+'
  END as vix_bucket,
  COUNT(*) as trades,
  SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate,
  SUM(t.pl) as total_pl
FROM trades.trade_data t
JOIN lagged m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
  AND m.prev_VIX_Close IS NOT NULL
GROUP BY vix_bucket
ORDER BY vix_bucket`,
    },
    {
      description: "Find similar days by conditions",
      sql: `WITH ref AS (
  SELECT d.close, c.VIX_Close, c.Vol_Regime, c.Term_Structure_State
  FROM market.daily d
  LEFT JOIN market.context c ON d.date = c.date
  WHERE d.ticker = 'SPX' AND d.date = '2024-01-15'
)
SELECT d.date, d.close, c.VIX_Close, c.Vol_Regime, c.Term_Structure_State
FROM market.daily d
LEFT JOIN market.context c ON d.date = c.date, ref
WHERE d.ticker = 'SPX'
  AND d.date != '2024-01-15'
  AND c.Vol_Regime = ref.Vol_Regime
  AND ABS(c.VIX_Close - ref.VIX_Close) < 3
ORDER BY ABS(c.VIX_Close - ref.VIX_Close)
LIMIT 20`,
    },
  ],
};
