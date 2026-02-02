/**
 * Sync Layer Public API
 *
 * Provides synchronization between CSV files and DuckDB analytics database.
 * Exports hashing utilities, metadata operations, and sync functions.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { getConnection } from "../db/connection.js";
import {
  syncBlockInternal,
  detectBlockChanges,
  cleanupDeletedBlocks,
  type BlockSyncResult,
} from "./block-sync.js";
import { getSyncMetadata } from "./metadata.js";
import { syncMarketDataInternal } from "./market-sync.js";

// Re-export hasher utilities
export { hashFileContent } from "./hasher.js";

// Re-export metadata operations and types
export {
  getSyncMetadata,
  upsertSyncMetadata,
  deleteSyncMetadata,
  getAllSyncedBlockIds,
  getMarketSyncMetadata,
  upsertMarketSyncMetadata,
  type BlockSyncMetadata,
  type MarketSyncMetadata,
} from "./metadata.js";

// Re-export block sync types and internal functions (for testing)
export { type BlockSyncResult } from "./block-sync.js";

// --- Result Types ---

/**
 * Result of syncing all blocks
 */
export interface SyncResult {
  blocksProcessed: number;
  blocksSynced: number;
  blocksUnchanged: number;
  blocksDeleted: number;
  errors: Array<{ blockId: string; error: string }>;
  results: BlockSyncResult[];
}

/**
 * Result of syncing market data
 */
export interface MarketSyncResult {
  filesProcessed: number;
  filesSynced: number;
  filesUnchanged: number;
  rowsInserted: number;
  errors: Array<{ fileName: string; error: string }>;
}

// --- Sync Functions ---

/**
 * Sync all blocks from the data directory to DuckDB.
 *
 * Scans all block folders, computes content hashes, and syncs
 * blocks that have changed since last sync. Also removes data
 * for blocks that no longer exist.
 *
 * @param baseDir - Base data directory containing block folders
 * @returns Sync result with counts and any errors
 */
export async function syncAllBlocks(baseDir: string): Promise<SyncResult> {
  const conn = await getConnection(baseDir);
  const results: BlockSyncResult[] = [];
  const errors: Array<{ blockId: string; error: string }> = [];

  // 1. Detect changes
  const { toSync, toDelete } = await detectBlockChanges(conn, baseDir);

  // 2. Delete orphaned blocks
  for (const blockId of toDelete) {
    try {
      await cleanupDeletedBlocks(conn, [blockId]);
      results.push({ blockId, status: "deleted" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ blockId, error: `Failed to delete: ${errorMsg}` });
    }
  }

  // 3. Sync changed/new blocks
  for (const blockId of toSync) {
    const blockPath = path.join(baseDir, blockId);
    const result = await syncBlockInternal(conn, blockId, blockPath);
    results.push(result);
    if (result.status === "error" && result.error) {
      errors.push({ blockId, error: result.error });
    }
  }

  return {
    blocksProcessed: results.length,
    blocksSynced: results.filter((r) => r.status === "synced").length,
    blocksUnchanged: results.filter((r) => r.status === "unchanged").length,
    blocksDeleted: results.filter((r) => r.status === "deleted").length,
    errors,
    results,
  };
}

/**
 * Sync a single block to DuckDB.
 *
 * Computes content hash for the block's CSV files and syncs
 * if changes are detected. Used for lazy per-block syncing.
 *
 * @param blockId - Block identifier (folder name)
 * @param baseDir - Base data directory containing block folders
 * @returns Sync result for the block
 */
export async function syncBlock(
  blockId: string,
  baseDir: string
): Promise<BlockSyncResult> {
  const conn = await getConnection(baseDir);
  const blockPath = path.join(baseDir, blockId);

  // Check if folder exists
  try {
    await fs.access(blockPath);
  } catch {
    // Block folder doesn't exist - if it was synced before, clean it up
    const existing = await getSyncMetadata(conn, blockId);
    if (existing) {
      await cleanupDeletedBlocks(conn, [blockId]);
      return { blockId, status: "deleted" };
    }
    return { blockId, status: "error", error: `Block folder not found: ${blockId}` };
  }

  return syncBlockInternal(conn, blockId, blockPath);
}

/**
 * Sync market data from _marketdata folder to DuckDB.
 *
 * Uses merge strategy to preserve historical data while
 * adding new dates from updated CSV exports.
 *
 * @param baseDir - Base data directory containing _marketdata folder
 * @returns Sync result with file and row counts
 */
export async function syncMarketData(
  baseDir: string
): Promise<MarketSyncResult> {
  const conn = await getConnection(baseDir);
  const results = await syncMarketDataInternal(conn, baseDir);

  // Aggregate results
  const errors: Array<{ fileName: string; error: string }> = [];
  let totalRowsInserted = 0;

  for (const result of results) {
    if (result.status === "error" && result.error) {
      errors.push({ fileName: result.file, error: result.error });
    }
    if (result.rowsInserted) {
      totalRowsInserted += result.rowsInserted;
    }
  }

  return {
    filesProcessed: results.length,
    filesSynced: results.filter((r) => r.status === "synced").length,
    filesUnchanged: results.filter((r) => r.status === "unchanged").length,
    rowsInserted: totalRowsInserted,
    errors,
  };
}
