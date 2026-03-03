/**
 * Market DuckDB Schema Definitions
 *
 * Creates and manages table schemas for the separate market.duckdb database.
 * Called after ATTACH in openReadWriteConnection() to ensure market tables exist.
 *
 * Tables use CREATE TABLE IF NOT EXISTS for idempotency — safe to call on
 * every RW open regardless of whether market.duckdb already exists.
 *
 * Table naming: market.daily resolves to catalog=market, schema=main, table=daily
 * after ATTACH '...' AS market. Do NOT create a schema within market.duckdb.
 */

import type { DuckDBConnection } from "@duckdb/node-api";

/**
 * Ensure all four market tables exist in the attached market.duckdb.
 *
 * Must be called AFTER `ATTACH '...' AS market` in openReadWriteConnection.
 * Creates all columns upfront so later phases can write data without ALTER TABLE.
 *
 * @param conn - Active DuckDB connection with market catalog attached
 */
export async function ensureMarketTables(conn: DuckDBConnection): Promise<void> {
  // Daily OHLCV + enrichment data for each ticker
  // PK: (ticker, date) — one row per ticker per trading day
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market.daily (
      ticker VARCHAR NOT NULL,
      date VARCHAR NOT NULL,

      -- Raw OHLCV
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      Prior_Close DOUBLE,

      -- Tier 1 enrichment (all DOUBLE unless noted)
      Gap_Pct DOUBLE,
      ATR_Pct DOUBLE,
      RSI_14 DOUBLE,
      Price_vs_EMA21_Pct DOUBLE,
      Price_vs_SMA50_Pct DOUBLE,
      BB_Position DOUBLE,
      BB_Width DOUBLE,
      Realized_Vol_5D DOUBLE,
      Realized_Vol_20D DOUBLE,
      Return_5D DOUBLE,
      Return_20D DOUBLE,
      Intraday_Range_Pct DOUBLE,
      Intraday_Return_Pct DOUBLE,
      Close_Position_In_Range DOUBLE,
      Gap_Filled INTEGER,
      Consecutive_Days INTEGER,
      Prev_Return_Pct DOUBLE,
      Prior_Range_vs_ATR DOUBLE,

      -- Tier 3 intraday timing
      High_Time DOUBLE,
      Low_Time DOUBLE,
      High_Before_Low INTEGER,
      Reversal_Type INTEGER,
      Opening_Drive_Strength DOUBLE,
      Intraday_Realized_Vol DOUBLE,

      -- Calendar fields
      Day_of_Week INTEGER,
      Month INTEGER,
      Is_Opex INTEGER,

      PRIMARY KEY (ticker, date)
    )
  `);

  // Migration: drop Trend_Score column (removed — not in any backtester, was an invented composite)
  try {
    await conn.run(`ALTER TABLE market.daily DROP COLUMN Trend_Score`);
  } catch {
    // Column already gone — ignore
  }

  // Migration: add Tier 3 columns that were added after initial schema
  for (const col of [
    { name: "Opening_Drive_Strength", type: "DOUBLE" },
    { name: "Intraday_Realized_Vol", type: "DOUBLE" },
  ]) {
    try {
      await conn.run(`ALTER TABLE market.daily ADD COLUMN ${col.name} ${col.type}`);
    } catch {
      // Column already exists — ignore
    }
  }

  // VIX and volatility term structure context per trading day
  // PK: (date) — one row per trading day, shared across tickers
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market.context (
      date VARCHAR NOT NULL,

      VIX_Open DOUBLE,
      VIX_Close DOUBLE,
      VIX_High DOUBLE,
      VIX_Low DOUBLE,
      VIX_RTH_Open DOUBLE,
      VIX_Change_Pct DOUBLE,
      VIX_Gap_Pct DOUBLE,
      VIX9D_Open DOUBLE,
      VIX9D_Close DOUBLE,
      VIX9D_Change_Pct DOUBLE,
      VIX3M_Open DOUBLE,
      VIX3M_Close DOUBLE,
      VIX3M_Change_Pct DOUBLE,
      VIX9D_VIX_Ratio DOUBLE,
      VIX_VIX3M_Ratio DOUBLE,
      Vol_Regime INTEGER,
      Term_Structure_State INTEGER,
      VIX_Percentile DOUBLE,
      VIX_Spike_Pct DOUBLE,

      PRIMARY KEY (date)
    )
  `);

  // Migration: add VIX_RTH_Open column to existing databases
  try {
    await conn.run(`ALTER TABLE market.context ADD COLUMN VIX_RTH_Open DOUBLE`);
  } catch {
    // Column already exists
  }

  // Raw intraday bars per ticker, per day, per time slot (Eastern Time "HH:MM")
  // PK: (ticker, date, time)
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market.intraday (
      ticker VARCHAR NOT NULL,
      date VARCHAR NOT NULL,
      time VARCHAR NOT NULL,

      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,

      PRIMARY KEY (ticker, date, time)
    )
  `);

  // Sync state tracking for market data imports
  // PK: (source, ticker, target_table) — tracks per-source, per-ticker, per-table sync state
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market._sync_metadata (
      source VARCHAR NOT NULL,
      ticker VARCHAR NOT NULL,
      target_table VARCHAR NOT NULL,

      content_hash VARCHAR,
      max_date VARCHAR,
      enriched_through VARCHAR,
      wilder_state JSON,
      synced_at TIMESTAMP NOT NULL,

      PRIMARY KEY (source, ticker, target_table)
    )
  `);
}
