/**
 * Sync Metadata Operations
 *
 * CRUD operations for sync metadata stored in DuckDB.
 * Used to track which blocks/files are synced and their content hashes.
 */

import type { DuckDBConnection } from "@duckdb/node-api";

/**
 * Sync metadata for a block (trades._sync_metadata)
 */
export interface BlockSyncMetadata {
  block_id: string;
  tradelog_hash: string;
  dailylog_hash: string | null;
  reportinglog_hash: string | null;
  synced_at: Date;
  sync_version: number;
}

/**
 * Sync metadata for a market data file (market._sync_metadata)
 */
export interface MarketSyncMetadata {
  file_name: string;
  content_hash: string;
  max_date: string | null;
  synced_at: Date;
}

/**
 * Get sync metadata for a block.
 *
 * @param conn - DuckDB connection
 * @param blockId - Block identifier
 * @returns Metadata if block is synced, null otherwise
 */
export async function getSyncMetadata(
  conn: DuckDBConnection,
  blockId: string
): Promise<BlockSyncMetadata | null> {
  const reader = await conn.runAndReadAll(
    `SELECT block_id, tradelog_hash, dailylog_hash, reportinglog_hash, synced_at, sync_version
     FROM trades._sync_metadata
     WHERE block_id = $1`,
    [blockId]
  );

  const rows = reader.getRows();
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    block_id: row[0] as string,
    tradelog_hash: row[1] as string,
    dailylog_hash: row[2] as string | null,
    reportinglog_hash: row[3] as string | null,
    synced_at: new Date(row[4] as string),
    sync_version: row[5] as number,
  };
}

/**
 * Insert or update sync metadata for a block.
 *
 * @param conn - DuckDB connection
 * @param metadata - Block sync metadata to upsert
 */
export async function upsertSyncMetadata(
  conn: DuckDBConnection,
  metadata: BlockSyncMetadata
): Promise<void> {
  await conn.run(
    `INSERT OR REPLACE INTO trades._sync_metadata
     (block_id, tradelog_hash, dailylog_hash, reportinglog_hash, synced_at, sync_version)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      metadata.block_id,
      metadata.tradelog_hash,
      metadata.dailylog_hash,
      metadata.reportinglog_hash,
      metadata.synced_at.toISOString(),
      metadata.sync_version,
    ]
  );
}

/**
 * Delete sync metadata for a block.
 *
 * @param conn - DuckDB connection
 * @param blockId - Block identifier to delete
 */
export async function deleteSyncMetadata(
  conn: DuckDBConnection,
  blockId: string
): Promise<void> {
  await conn.run(
    `DELETE FROM trades._sync_metadata WHERE block_id = $1`,
    [blockId]
  );
}

/**
 * Get all synced block IDs.
 *
 * @param conn - DuckDB connection
 * @returns Array of block IDs that have sync metadata
 */
export async function getAllSyncedBlockIds(
  conn: DuckDBConnection
): Promise<string[]> {
  const reader = await conn.runAndReadAll(
    `SELECT block_id FROM trades._sync_metadata`
  );

  const rows = reader.getRows();
  return rows.map((row) => row[0] as string);
}

/**
 * Get sync metadata for a market data file.
 *
 * @param conn - DuckDB connection
 * @param fileName - File name or source identifier
 * @returns Metadata if file is synced, null otherwise
 */
export async function getMarketSyncMetadata(
  conn: DuckDBConnection,
  fileName: string
): Promise<MarketSyncMetadata | null> {
  const reader = await conn.runAndReadAll(
    `SELECT file_name, content_hash, max_date, synced_at
     FROM market._sync_metadata
     WHERE file_name = $1`,
    [fileName]
  );

  const rows = reader.getRows();
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    file_name: row[0] as string,
    content_hash: row[1] as string,
    max_date: row[2] as string | null,
    synced_at: new Date(row[3] as string),
  };
}

/**
 * Insert or update sync metadata for a market data file.
 *
 * @param conn - DuckDB connection
 * @param metadata - Market sync metadata to upsert
 */
export async function upsertMarketSyncMetadata(
  conn: DuckDBConnection,
  metadata: MarketSyncMetadata
): Promise<void> {
  await conn.run(
    `INSERT OR REPLACE INTO market._sync_metadata
     (file_name, content_hash, max_date, synced_at)
     VALUES ($1, $2, $3, $4)`,
    [
      metadata.file_name,
      metadata.content_hash,
      metadata.max_date,
      metadata.synced_at.toISOString(),
    ]
  );
}

// =============================================================================
// Phase 60 Market Import Metadata Helpers
// =============================================================================

/**
 * Market import metadata aligned to Phase 60 market._sync_metadata schema.
 * PK: (source, ticker, target_table)
 *
 * Distinct from MarketSyncMetadata which uses the old file_name-based schema.
 * Use these helpers for all Phase 61+ import tool calls.
 */
export interface MarketImportMetadata {
  source: string;       // e.g., "import_market_csv:/abs/path/to/file.csv"
  ticker: string;       // Normalized ticker e.g. "SPX"
  target_table: string; // "daily" | "context" | "intraday"
  max_date: string | null;
  enriched_through: string | null;
  synced_at: Date;
}

/**
 * Get market import metadata for a specific source/ticker/table combination.
 */
export async function getMarketImportMetadata(
  conn: DuckDBConnection,
  source: string,
  ticker: string,
  targetTable: string
): Promise<MarketImportMetadata | null> {
  const reader = await conn.runAndReadAll(
    `SELECT source, ticker, target_table, max_date, enriched_through, synced_at
     FROM market._sync_metadata
     WHERE source = $1 AND ticker = $2 AND target_table = $3`,
    [source, ticker, targetTable]
  );
  const rows = reader.getRows();
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    source: row[0] as string,
    ticker: row[1] as string,
    target_table: row[2] as string,
    max_date: row[3] as string | null,
    enriched_through: row[4] as string | null,
    synced_at: new Date(row[5] as string),
  };
}

/**
 * Upsert market import metadata using the Phase 60 schema PK (source, ticker, target_table).
 * Updates max_date, enriched_through, and synced_at on conflict.
 */
export async function upsertMarketImportMetadata(
  conn: DuckDBConnection,
  metadata: MarketImportMetadata
): Promise<void> {
  await conn.run(
    `INSERT INTO market._sync_metadata
       (source, ticker, target_table, max_date, enriched_through, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (source, ticker, target_table) DO UPDATE SET
       max_date = EXCLUDED.max_date,
       enriched_through = EXCLUDED.enriched_through,
       synced_at = EXCLUDED.synced_at`,
    [
      metadata.source,
      metadata.ticker,
      metadata.target_table,
      metadata.max_date,
      metadata.enriched_through,
      metadata.synced_at.toISOString(),
    ]
  );
}
