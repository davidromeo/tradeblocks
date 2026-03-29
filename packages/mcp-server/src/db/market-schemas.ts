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

// =============================================================================
// Migration: Legacy context → normalized schema (Phase 75 — VTS-01)
// =============================================================================

/**
 * Migrate VIX data from legacy market.context to normalized schema.
 * Copies OHLCV + IVR/IVP for VIX/VIX9D/VIX3M into market.daily rows,
 * and derived fields into market._context_derived.
 * Uses INSERT OR IGNORE — safe to re-run.
 */
export async function migrateContextToNormalized(conn: DuckDBConnection): Promise<{ rowsMigrated: number }> {
  // Check if migration already ran (tracked in _sync_metadata)
  try {
    const migrationCheck = await conn.runAndReadAll(
      `SELECT 1 FROM market._sync_metadata WHERE source = 'migration:context_to_normalized'`
    );
    if (migrationCheck.getRows().length > 0) return { rowsMigrated: 0 }; // Already migrated
  } catch {
    // _sync_metadata may not exist yet — continue with migration
  }

  // Check if market.context has data to migrate
  let contextCount = 0;
  try {
    const r = await conn.runAndReadAll(`SELECT COUNT(*) FROM market.context`);
    contextCount = Number(r.getRows()[0]?.[0] ?? 0);
  } catch {
    return { rowsMigrated: 0 }; // No context table
  }
  if (contextCount === 0) return { rowsMigrated: 0 };

  let totalMigrated = 0;

  // Migrate VIX OHLCV + IVR/IVP
  const vixResult = await conn.run(`
    INSERT OR IGNORE INTO market.daily (ticker, date, open, high, low, close, ivr, ivp)
    SELECT 'VIX', date, VIX_Open, VIX_High, VIX_Low, VIX_Close, VIX_IVR, VIX_IVP
    FROM market.context
    WHERE VIX_Close IS NOT NULL
  `);
  totalMigrated += Number(vixResult.rowsChanged);

  // Migrate VIX9D OHLCV + IVR/IVP (VIX9D has Open/Close only, no High/Low in context)
  const vix9dResult = await conn.run(`
    INSERT OR IGNORE INTO market.daily (ticker, date, open, close, ivr, ivp)
    SELECT 'VIX9D', date, VIX9D_Open, VIX9D_Close, VIX9D_IVR, VIX9D_IVP
    FROM market.context
    WHERE VIX9D_Close IS NOT NULL
  `);
  totalMigrated += Number(vix9dResult.rowsChanged);

  // Migrate VIX3M OHLCV + IVR/IVP (VIX3M has Open/Close only)
  const vix3mResult = await conn.run(`
    INSERT OR IGNORE INTO market.daily (ticker, date, open, close, ivr, ivp)
    SELECT 'VIX3M', date, VIX3M_Open, VIX3M_Close, VIX3M_IVR, VIX3M_IVP
    FROM market.context
    WHERE VIX3M_Close IS NOT NULL
  `);
  totalMigrated += Number(vix3mResult.rowsChanged);

  // Migrate derived fields to market._context_derived
  await conn.run(`
    INSERT OR IGNORE INTO market._context_derived (date, Vol_Regime, Term_Structure_State, Trend_Direction, VIX_Spike_Pct, VIX_Gap_Pct)
    SELECT date, Vol_Regime, Term_Structure_State, Trend_Direction, VIX_Spike_Pct, VIX_Gap_Pct
    FROM market.context
    WHERE Vol_Regime IS NOT NULL OR Term_Structure_State IS NOT NULL
  `);

  // Mark migration as complete so it doesn't re-run
  try {
    await conn.run(`
      INSERT OR REPLACE INTO market._sync_metadata (source, ticker, target_table, max_date, enriched_through, synced_at)
      VALUES ('migration:context_to_normalized', '_system', '_system', NULL, NULL, CURRENT_TIMESTAMP)
    `);
  } catch {
    // _sync_metadata may not exist yet on first run — non-fatal
  }

  return { rowsMigrated: totalMigrated };
}

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

  // Migration: drop Bollinger Band columns (Phase 67 — ENR-04)
  for (const col of ["BB_Position", "BB_Width"]) {
    try {
      await conn.run(`ALTER TABLE market.daily DROP COLUMN ${col}`);
    } catch {
      // Column already gone — ignore
    }
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

  // Migration: add IVR/IVP columns for VIX-family tickers (Phase 75 — VTS-01)
  for (const col of [
    { name: "ivr", type: "DOUBLE" },
    { name: "ivp", type: "DOUBLE" },
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
      VIX_IVR DOUBLE,
      VIX_IVP DOUBLE,
      VIX9D_IVR DOUBLE,
      VIX9D_IVP DOUBLE,
      VIX3M_IVR DOUBLE,
      VIX3M_IVP DOUBLE,
      VIX_Spike_Pct DOUBLE,
      Trend_Direction VARCHAR,

      PRIMARY KEY (date)
    )
  `);

  // Cross-ticker derived fields (Vol_Regime, Term_Structure_State, etc.)
  // PK: (date) — one row per trading day
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market._context_derived (
      date VARCHAR NOT NULL PRIMARY KEY,
      Vol_Regime INTEGER,
      Term_Structure_State INTEGER,
      Trend_Direction VARCHAR,
      VIX_Spike_Pct DOUBLE,
      VIX_Gap_Pct DOUBLE
    )
  `);

  // Migration: add VIX_RTH_Open column to existing databases
  try {
    await conn.run(`ALTER TABLE market.context ADD COLUMN VIX_RTH_Open DOUBLE`);
  } catch {
    // Column already exists
  }

  // Migration: add Trend_Direction column to existing databases
  try {
    await conn.run(`ALTER TABLE market.context ADD COLUMN Trend_Direction VARCHAR`);
  } catch {
    // Column already exists
  }

  // Migration: rename VIX_Percentile → VIX_IVP (Phase 67 — D-08)
  try {
    await conn.run(`ALTER TABLE market.context RENAME COLUMN VIX_Percentile TO VIX_IVP`);
  } catch {
    // Column already renamed or doesn't exist — ignore
  }

  // Migration: add IVR/IVP columns (Phase 67 — D-09)
  for (const col of ["VIX_IVR", "VIX9D_IVR", "VIX9D_IVP", "VIX3M_IVR", "VIX3M_IVP"]) {
    try {
      await conn.run(`ALTER TABLE market.context ADD COLUMN ${col} DOUBLE`);
    } catch {
      // Column already exists — ignore
    }
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
      bid DOUBLE,
      ask DOUBLE,

      PRIMARY KEY (ticker, date, time)
    )
  `);

  // Migration: add bid/ask columns to existing market.intraday (Phase 75 / 260329-nqf)
  for (const col of ["bid", "ask"]) {
    try {
      await conn.run(`ALTER TABLE market.intraday ADD COLUMN ${col} DOUBLE`);
    } catch {
      // Column already exists — ignore
    }
  }

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

  // Phase 75: migrate legacy context data to normalized schema
  await migrateContextToNormalized(conn);
}
