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
 * Create market data tables for storing synced market data.
 *
 * @param conn - Active DuckDB connection
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function ensureMarketDataTables(conn: DuckDBConnection): Promise<void> {
  // TODO: Implement in Plan 03
  // This will create tables for SPX daily, intraday, VIX, etc.
}
