/**
 * Sync Layer Public API
 *
 * Provides synchronization between CSV files and DuckDB analytics database.
 * Exports hashing utilities, metadata operations, and sync functions.
 */

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

// --- Result Types ---

/**
 * Result of syncing a single block
 */
export interface BlockSyncResult {
  blockId: string;
  status: "synced" | "unchanged" | "error" | "deleted";
  tradeCount?: number;
  error?: string;
}

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

// --- Sync Functions (Placeholders) ---

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
  // TODO: Implement in Plan 02
  void baseDir; // Suppress unused parameter warning
  throw new Error("Not implemented - see Plan 42-02");
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
  // TODO: Implement in Plan 02
  void blockId;
  void baseDir;
  throw new Error("Not implemented - see Plan 42-02");
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
  // TODO: Implement in Plan 03
  void baseDir;
  throw new Error("Not implemented - see Plan 42-03");
}
