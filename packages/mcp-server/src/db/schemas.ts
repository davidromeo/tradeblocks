/**
 * DuckDB Schema Definitions
 *
 * Creates and manages table schemas for sync metadata and trade data.
 * Called during connection initialization to ensure tables exist.
 */

import type { DuckDBConnection } from "@duckdb/node-api";

/**
 * Create sync metadata tables in both trades and market schemas.
 *
 * trades._sync_metadata: Tracks sync state for each block
 * market._sync_metadata: Tracks sync state for market data files
 *
 * @param conn - Active DuckDB connection
 */
export async function ensureSyncTables(conn: DuckDBConnection): Promise<void> {
  // Block sync metadata - tracks which blocks are synced and their file hashes
  await conn.run(`
    CREATE TABLE IF NOT EXISTS trades._sync_metadata (
      block_id VARCHAR PRIMARY KEY,
      tradelog_hash VARCHAR NOT NULL,
      dailylog_hash VARCHAR,
      reportinglog_hash VARCHAR,
      synced_at TIMESTAMP NOT NULL,
      sync_version INTEGER DEFAULT 1
    )
  `);

  // Market data sync metadata - tracks file sync state and max date
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market._sync_metadata (
      file_name VARCHAR PRIMARY KEY,
      content_hash VARCHAR NOT NULL,
      max_date VARCHAR,
      synced_at TIMESTAMP NOT NULL
    )
  `);
}

/**
 * Create the trade data table for storing synced trade records.
 *
 * Note: No PRIMARY KEY constraint - trades can have duplicates per day
 * (e.g., multiple trades opened at same time with same strategy).
 *
 * @param conn - Active DuckDB connection
 */
export async function ensureTradeDataTable(conn: DuckDBConnection): Promise<void> {
  await conn.run(`
    CREATE TABLE IF NOT EXISTS trades.trade_data (
      block_id VARCHAR NOT NULL,
      date_opened DATE NOT NULL,
      time_opened VARCHAR,
      strategy VARCHAR,
      legs VARCHAR,
      premium DOUBLE,
      num_contracts INTEGER,
      pl DOUBLE NOT NULL,
      date_closed DATE,
      time_closed VARCHAR,
      reason_for_close VARCHAR,
      margin_req DOUBLE,
      opening_commissions DOUBLE,
      closing_commissions DOUBLE
    )
  `);
}

/**
 * Create the reporting data table for storing synced reporting log records.
 *
 * Note: No PRIMARY KEY constraint - trades can have duplicates per day
 * (same pattern as trade_data).
 *
 * @param conn - Active DuckDB connection
 */
export async function ensureReportingDataTable(conn: DuckDBConnection): Promise<void> {
  await conn.run(`
    CREATE TABLE IF NOT EXISTS trades.reporting_data (
      block_id VARCHAR NOT NULL,
      date_opened DATE NOT NULL,
      time_opened VARCHAR,
      strategy VARCHAR,
      legs VARCHAR,
      initial_premium DOUBLE,
      num_contracts INTEGER,
      pl DOUBLE NOT NULL,
      date_closed DATE,
      time_closed VARCHAR,
      closing_price DOUBLE,
      avg_closing_cost DOUBLE,
      reason_for_close VARCHAR,
      opening_price DOUBLE
    )
  `);
}

/**
 * Create market data tables for storing synced market data.
 *
 * Tables use date as PRIMARY KEY for merge/preserve strategy:
 * - New dates are inserted
 * - Existing dates are preserved (ON CONFLICT DO NOTHING)
 *
 * @param conn - Active DuckDB connection
 */
export async function ensureMarketDataTables(conn: DuckDBConnection): Promise<void> {
  // SPX daily market context data (35 fields)
  // Note: open/high/low/close are lowercase to match TradingView's default export columns
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market.spx_daily (
      date VARCHAR PRIMARY KEY,
      Prior_Close DOUBLE,
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      Gap_Pct DOUBLE,
      Intraday_Range_Pct DOUBLE,
      Intraday_Return_Pct DOUBLE,
      Total_Return_Pct DOUBLE,
      Close_Position_In_Range DOUBLE,
      Gap_Filled INTEGER,
      VIX_Open DOUBLE,
      VIX_Close DOUBLE,
      VIX_Change_Pct DOUBLE,
      VIX_Spike_Pct DOUBLE,
      VIX_Percentile DOUBLE,
      Vol_Regime INTEGER,
      VIX9D_Close DOUBLE,
      VIX3M_Close DOUBLE,
      VIX9D_VIX_Ratio DOUBLE,
      VIX_VIX3M_Ratio DOUBLE,
      Term_Structure_State INTEGER,
      ATR_Pct DOUBLE,
      RSI_14 DOUBLE,
      Price_vs_EMA21_Pct DOUBLE,
      Price_vs_SMA50_Pct DOUBLE,
      Trend_Score INTEGER,
      BB_Position DOUBLE,
      Return_5D DOUBLE,
      Return_20D DOUBLE,
      Consecutive_Days INTEGER,
      Day_of_Week INTEGER,
      Month INTEGER,
      Is_Opex INTEGER,
      Prev_Return_Pct DOUBLE
    )
  `);

  // SPX 15-minute intraday checkpoint data
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market.spx_15min (
      date VARCHAR PRIMARY KEY,
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      P_0930 DOUBLE,
      P_0945 DOUBLE,
      P_1000 DOUBLE,
      P_1015 DOUBLE,
      P_1030 DOUBLE,
      P_1045 DOUBLE,
      P_1100 DOUBLE,
      P_1115 DOUBLE,
      P_1130 DOUBLE,
      P_1145 DOUBLE,
      P_1200 DOUBLE,
      P_1215 DOUBLE,
      P_1230 DOUBLE,
      P_1245 DOUBLE,
      P_1300 DOUBLE,
      P_1315 DOUBLE,
      P_1330 DOUBLE,
      P_1345 DOUBLE,
      P_1400 DOUBLE,
      P_1415 DOUBLE,
      P_1430 DOUBLE,
      P_1445 DOUBLE,
      P_1500 DOUBLE,
      P_1515 DOUBLE,
      P_1530 DOUBLE,
      P_1545 DOUBLE,
      Pct_0930_to_1000 DOUBLE,
      Pct_0930_to_1200 DOUBLE,
      Pct_0930_to_1500 DOUBLE,
      Pct_0930_to_Close DOUBLE,
      MOC_15min DOUBLE,
      MOC_30min DOUBLE,
      MOC_45min DOUBLE,
      MOC_60min DOUBLE,
      Afternoon_Move DOUBLE
    )
  `);

  // SPX high/low timing data
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market.spx_highlow (
      date VARCHAR PRIMARY KEY,
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      High_Time DOUBLE,
      Low_Time DOUBLE,
      High_Before_Low INTEGER,
      High_In_First_Hour INTEGER,
      Low_In_First_Hour INTEGER,
      High_In_Last_Hour INTEGER,
      Low_In_Last_Hour INTEGER,
      Reversal_Type INTEGER,
      High_Low_Spread DOUBLE,
      Early_Extreme INTEGER,
      Late_Extreme INTEGER,
      Intraday_High DOUBLE,
      Intraday_Low DOUBLE
    )
  `);

  // VIX intraday data
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market.vix_intraday (
      date VARCHAR PRIMARY KEY,
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      VIX_0930 DOUBLE,
      VIX_1000 DOUBLE,
      VIX_1030 DOUBLE,
      VIX_1100 DOUBLE,
      VIX_1130 DOUBLE,
      VIX_1200 DOUBLE,
      VIX_1230 DOUBLE,
      VIX_1300 DOUBLE,
      VIX_1330 DOUBLE,
      VIX_1400 DOUBLE,
      VIX_1430 DOUBLE,
      VIX_1500 DOUBLE,
      VIX_1530 DOUBLE,
      VIX_1545 DOUBLE,
      VIX_Day_High DOUBLE,
      VIX_Day_Low DOUBLE,
      VIX_Morning_Move DOUBLE,
      VIX_Afternoon_Move DOUBLE,
      VIX_Power_Hour_Move DOUBLE,
      VIX_Last_30min_Move DOUBLE,
      VIX_Full_Day_Move DOUBLE,
      VIX_First_Hour_Move DOUBLE,
      VIX_Intraday_Range_Pct DOUBLE,
      VIX_Spike_From_Open DOUBLE,
      VIX_Spike_Flag INTEGER,
      VIX_Crush_From_Open DOUBLE,
      VIX_Crush_Flag INTEGER,
      VIX_Close_In_Range DOUBLE
    )
  `);
}
