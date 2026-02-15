/**
 * Block Sync Logic
 *
 * Core synchronization logic for syncing block CSV data to DuckDB.
 * Handles hash-based change detection, atomic transactions, and error recovery.
 */

import type { DuckDBConnection } from "@duckdb/node-api";
import * as fs from "fs/promises";
import * as path from "path";
import { hashFileContent } from "./hasher.js";
import {
  getSyncMetadata,
  upsertSyncMetadata,
  deleteSyncMetadata,
  getAllSyncedBlockIds,
  type BlockSyncMetadata,
} from "./metadata.js";
import { resolveTickerFromCsvRow } from "../utils/ticker.js";

/**
 * Result of syncing a single block
 */
export interface BlockSyncResult {
  blockId: string;
  status: "synced" | "unchanged" | "deleted" | "error";
  tradeCount?: number;
  error?: string;
}

/**
 * CSV file mappings from block.json
 */
interface CsvMappings {
  tradelog?: string;
  dailylog?: string;
  reportinglog?: string;
}

/**
 * Block.json metadata structure (minimal for our needs)
 */
interface BlockJson {
  csvMappings?: CsvMappings;
}

/**
 * Read block.json metadata if present.
 */
async function readBlockJson(blockPath: string): Promise<BlockJson | null> {
  try {
    const blockJsonPath = path.join(blockPath, "block.json");
    const blockJsonContent = await fs.readFile(blockJsonPath, "utf-8");
    return JSON.parse(blockJsonContent) as BlockJson;
  } catch {
    return null;
  }
}

// --- CSV Parsing Helpers (copied from block-loader.ts to avoid circular imports) ---

/**
 * Parse CSV content into array of record objects
 */
function parseCSV(content: string): Record<string, string>[] {
  // Strip UTF-8 BOM if present (common in Windows/Excel CSV exports)
  const lines = content.replace(/^\uFEFF/, "").trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] || "";
    });
    records.push(record);
  }

  return records;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Normalize CSV date strings into DuckDB-friendly YYYY-MM-DD format.
 *
 * Supports:
 * - YYYY-MM-DD (already normalized)
 * - M/D/YY, MM/DD/YY
 * - M/D/YYYY, MM/DD/YYYY
 */
function normalizeCsvDate(value: string | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const mdyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!mdyMatch) return raw;

  const month = Number(mdyMatch[1]);
  const day = Number(mdyMatch[2]);
  let year = Number(mdyMatch[3]);

  if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) {
    return raw;
  }
  if (year < 100) {
    year += year >= 70 ? 1900 : 2000;
  }

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return raw;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// --- Tradelog Discovery ---

/**
 * Find the tradelog CSV file for a block.
 * Priority: block.json csvMappings > "tradelog.csv" > first *.csv file
 */
async function findTradelogFile(
  blockPath: string,
  blockJson?: BlockJson | null
): Promise<string | null> {
  // 1. Check block.json for csvMappings
  if (blockJson?.csvMappings?.tradelog) {
    const mappedPath = path.join(blockPath, blockJson.csvMappings.tradelog);
    try {
      await fs.access(mappedPath);
      return blockJson.csvMappings.tradelog;
    } catch {
      // Mapped file doesn't exist, continue to fallbacks
    }
  }

  // 2. Check for standard "tradelog.csv"
  try {
    await fs.access(path.join(blockPath, "tradelog.csv"));
    return "tradelog.csv";
  } catch {
    // No standard tradelog.csv
  }

  // 3. Find first CSV file (simple discovery)
  try {
    const entries = await fs.readdir(blockPath, { withFileTypes: true });
    const csvFiles = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".csv"))
      .map((e) => e.name);
    const candidateTradeCsvFiles = csvFiles
      .filter((name) => {
        const lower = name.toLowerCase();
        return lower !== "dailylog.csv" && lower !== "reportinglog.csv";
      });
    if (candidateTradeCsvFiles.length > 0) {
      return candidateTradeCsvFiles[0];
    }
  } catch {
    // Can't read directory
  }

  return null;
}

/**
 * Find optional log files (dailylog, reportinglog) for a block
 */
async function findOptionalLogFiles(
  blockPath: string,
  blockJson?: BlockJson | null
): Promise<{ dailylog: string | null; reportinglog: string | null }> {
  const result = { dailylog: null as string | null, reportinglog: null as string | null };

  // Check block.json first
  if (blockJson?.csvMappings?.dailylog) {
    const mappedPath = path.join(blockPath, blockJson.csvMappings.dailylog);
    try {
      await fs.access(mappedPath);
      result.dailylog = blockJson.csvMappings.dailylog;
    } catch {
      // Mapped file doesn't exist
    }
  }
  if (blockJson?.csvMappings?.reportinglog) {
    const mappedPath = path.join(blockPath, blockJson.csvMappings.reportinglog);
    try {
      await fs.access(mappedPath);
      result.reportinglog = blockJson.csvMappings.reportinglog;
    } catch {
      // Mapped file doesn't exist
    }
  }

  // Check for standard names if not found in mappings
  if (!result.dailylog) {
    try {
      await fs.access(path.join(blockPath, "dailylog.csv"));
      result.dailylog = "dailylog.csv";
    } catch {
      // No standard dailylog.csv
    }
  }

  if (!result.reportinglog) {
    try {
      await fs.access(path.join(blockPath, "reportinglog.csv"));
      result.reportinglog = "reportinglog.csv";
    } catch {
      // No standard reportinglog.csv
    }
  }

  return result;
}

// --- Database Operations ---

/**
 * Insert trades in batches to avoid parameter limits.
 *
 * @param conn - DuckDB connection
 * @param blockId - Block identifier
 * @param records - Parsed CSV records
 * @param startIdx - Starting index in records array
 * @param batchSize - Number of records per batch
 */
async function insertTradeBatch(
  conn: DuckDBConnection,
  blockId: string,
  records: Record<string, string>[],
  startIdx: number,
  batchSize: number
): Promise<void> {
  const batch = records.slice(startIdx, startIdx + batchSize);
  if (batch.length === 0) return;

  // Build VALUES placeholders: ($1, $2, $3, ...), ($15, $16, $17, ...), ...
  // Each row has 15 columns: block_id + 13 trade fields + ticker
  const columnsPerRow = 15;
  const placeholders: string[] = [];
  const params: (string | number | null)[] = [];

  for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
    const record = batch[rowIdx];
    const baseParam = rowIdx * columnsPerRow + 1;
    const rowPlaceholders = Array.from(
      { length: columnsPerRow },
      (_, i) => `$${baseParam + i}`
    );
    placeholders.push(`(${rowPlaceholders.join(", ")})`);

    // Parse numeric values safely
    const premium = parseFloat(record["Premium"]);
    const numContracts = parseInt(record["No. of Contracts"], 10);
    const pl = parseFloat(record["P/L"]);
    const marginReq = parseFloat(record["Margin Req."]);
    const openingCommissions = parseFloat(record["Opening Commissions + Fees"]);
    const closingCommissions = parseFloat(record["Closing Commissions + Fees"]);
    const ticker = resolveTickerFromCsvRow(record);

    // Map CSV record to column values
    params.push(
      blockId, // block_id
      normalizeCsvDate(record["Date Opened"]), // date_opened
      record["Time Opened"] || null, // time_opened
      record["Strategy"] || null, // strategy
      record["Legs"] || null, // legs
      isNaN(premium) ? null : premium, // premium
      isNaN(numContracts) ? 1 : numContracts, // num_contracts
      isNaN(pl) ? 0 : pl, // pl
      normalizeCsvDate(record["Date Closed"]), // date_closed
      record["Time Closed"] || null, // time_closed
      record["Reason For Close"] || null, // reason_for_close
      isNaN(marginReq) ? null : marginReq, // margin_req
      isNaN(openingCommissions) ? 0 : openingCommissions, // opening_commissions
      isNaN(closingCommissions) ? 0 : closingCommissions, // closing_commissions
      ticker // ticker
    );
  }

  const sql = `
    INSERT INTO trades.trade_data (
      block_id, date_opened, time_opened, strategy, legs, premium,
      num_contracts, pl, date_closed, time_closed, reason_for_close,
      margin_req, opening_commissions, closing_commissions, ticker
    ) VALUES ${placeholders.join(", ")}
  `;

  await conn.run(sql, params);
}

/**
 * Insert reporting log records in batches to avoid parameter limits.
 *
 * @param conn - DuckDB connection
 * @param blockId - Block identifier
 * @param records - Parsed CSV records
 * @param startIdx - Starting index in records array
 * @param batchSize - Number of records per batch
 */
async function insertReportingBatch(
  conn: DuckDBConnection,
  blockId: string,
  records: Record<string, string>[],
  startIdx: number,
  batchSize: number
): Promise<void> {
  const batch = records.slice(startIdx, startIdx + batchSize);
  if (batch.length === 0) return;

  // Build VALUES placeholders: ($1, $2, $3, ...), ($15, $16, $17, ...), ...
  // Each row has 15 columns: block_id + 13 reporting fields + ticker
  const columnsPerRow = 15;
  const placeholders: string[] = [];
  const params: (string | number | null)[] = [];

  for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
    const record = batch[rowIdx];
    const baseParam = rowIdx * columnsPerRow + 1;
    const rowPlaceholders = Array.from(
      { length: columnsPerRow },
      (_, i) => `$${baseParam + i}`
    );
    placeholders.push(`(${rowPlaceholders.join(", ")})`);

    // Parse numeric values safely
    const initialPremium = parseFloat(record["Initial Premium"]);
    const numContracts = parseInt(record["No. of Contracts"], 10);
    const pl = parseFloat(record["P/L"]);
    const closingPrice = parseFloat(record["Closing Price"]);
    const avgClosingCost = parseFloat(record["Avg. Closing Cost"]);
    const openingPrice = parseFloat(record["Opening Price"]);
    const ticker = resolveTickerFromCsvRow(record);

    // Map CSV record to column values
    params.push(
      blockId, // block_id
      normalizeCsvDate(record["Date Opened"]), // date_opened
      record["Time Opened"] || null, // time_opened
      record["Strategy"] || null, // strategy
      record["Legs"] || null, // legs
      isNaN(initialPremium) ? null : initialPremium, // initial_premium
      isNaN(numContracts) ? 1 : numContracts, // num_contracts
      isNaN(pl) ? 0 : pl, // pl
      normalizeCsvDate(record["Date Closed"]), // date_closed
      record["Time Closed"] || null, // time_closed
      isNaN(closingPrice) ? null : closingPrice, // closing_price
      isNaN(avgClosingCost) ? null : avgClosingCost, // avg_closing_cost
      record["Reason For Close"] || null, // reason_for_close
      isNaN(openingPrice) ? null : openingPrice, // opening_price
      ticker // ticker
    );
  }

  const sql = `
    INSERT INTO trades.reporting_data (
      block_id, date_opened, time_opened, strategy, legs, initial_premium,
      num_contracts, pl, date_closed, time_closed, closing_price,
      avg_closing_cost, reason_for_close, opening_price, ticker
    ) VALUES ${placeholders.join(", ")}
  `;

  await conn.run(sql, params);
}

// --- Core Sync Functions ---

/**
 * Sync a single block's trade data to DuckDB.
 *
 * Performs hash-based change detection and atomic insert:
 * 1. Find and hash the tradelog CSV
 * 2. Compare with stored hash
 * 3. If changed: DELETE old + INSERT new in transaction
 * 4. Update sync metadata
 *
 * @param conn - DuckDB connection
 * @param blockId - Block identifier (folder name)
 * @param blockPath - Absolute path to block folder
 * @returns Sync result with status
 */
export async function syncBlockInternal(
  conn: DuckDBConnection,
  blockId: string,
  blockPath: string
): Promise<BlockSyncResult> {
  try {
    // Get existing metadata early (needed for missing-file cleanup logic)
    const existingMetadata = await getSyncMetadata(conn, blockId);
    const blockJson = await readBlockJson(blockPath);

    // Find the tradelog file
    const tradelogFilename = await findTradelogFile(blockPath, blockJson);
    if (!tradelogFilename) {
      // Previously-synced block lost its tradelog: remove stale data/metadata
      if (existingMetadata) {
        await conn.run("BEGIN TRANSACTION");
        try {
          await conn.run(
            "DELETE FROM trades.trade_data WHERE block_id = $1",
            [blockId]
          );
          await conn.run(
            "DELETE FROM trades.reporting_data WHERE block_id = $1",
            [blockId]
          );
          await deleteSyncMetadata(conn, blockId);
          await conn.run("COMMIT");
          return { blockId, status: "deleted" };
        } catch (err) {
          await conn.run("ROLLBACK");
          throw err;
        }
      }

      return {
        blockId,
        status: "error",
        error: "No tradelog CSV found in block",
      };
    }

    const tradelogPath = path.join(blockPath, tradelogFilename);

    // Hash the tradelog file
    const tradelogHash = await hashFileContent(tradelogPath);

    // Check if hash matches (unchanged)
    // Also check if reportinglog exists but hasn't been synced yet
    if (existingMetadata && existingMetadata.tradelog_hash === tradelogHash) {
      // Check if reporting log needs to be synced (new file or changed)
      const optionalLogs = await findOptionalLogFiles(blockPath, blockJson);
      if (optionalLogs.reportinglog) {
        const reportinglogPath = path.join(blockPath, optionalLogs.reportinglog);
        const reportinglogHash = await hashFileContent(reportinglogPath);
        if (existingMetadata.reportinglog_hash !== reportinglogHash) {
          // Reportinglog changed or was never synced - fall through to sync
        } else {
          return { blockId, status: "unchanged" };
        }
      } else {
        // Reporting log was removed after previously being synced - clear stale data
        if (existingMetadata.reportinglog_hash !== null) {
          // Fall through to sync path, which will delete reporting_data and write null hash
        } else {
          return { blockId, status: "unchanged" };
        }
      }
    }

    // Hash differs or no metadata - need to sync
    // Start transaction for atomic update
    await conn.run("BEGIN TRANSACTION");

    try {
      // Delete old trade data for this block
      await conn.run(
        "DELETE FROM trades.trade_data WHERE block_id = $1",
        [blockId]
      );

      // Read and parse CSV
      const csvContent = await fs.readFile(tradelogPath, "utf-8");
      const records = parseCSV(csvContent);

      // Insert trades in batches of 500
      const batchSize = 500;
      for (let i = 0; i < records.length; i += batchSize) {
        await insertTradeBatch(conn, blockId, records, i, batchSize);
      }

      // Hash optional log files if they exist
      const optionalLogs = await findOptionalLogFiles(blockPath, blockJson);
      let dailylogHash: string | null = null;
      let reportinglogHash: string | null = null;

      if (optionalLogs.dailylog) {
        try {
          dailylogHash = await hashFileContent(
            path.join(blockPath, optionalLogs.dailylog)
          );
        } catch {
          // Dailylog file can't be read, leave hash null
        }
      }

      if (optionalLogs.reportinglog) {
        try {
          reportinglogHash = await hashFileContent(
            path.join(blockPath, optionalLogs.reportinglog)
          );
        } catch {
          // Reportinglog file can't be read, leave hash null
        }
      }

      // Sync reporting log if it exists and has changed
      // Always delete old reporting data for this block (same pattern as trade_data)
      await conn.run(
        "DELETE FROM trades.reporting_data WHERE block_id = $1",
        [blockId]
      );

      if (optionalLogs.reportinglog && reportinglogHash) {
        // Read and parse reporting CSV
        const reportingPath = path.join(blockPath, optionalLogs.reportinglog);
        const reportingContent = await fs.readFile(reportingPath, "utf-8");
        const reportingRecords = parseCSV(reportingContent);

        // Insert reporting trades in batches of 500
        for (let i = 0; i < reportingRecords.length; i += batchSize) {
          await insertReportingBatch(conn, blockId, reportingRecords, i, batchSize);
        }
      }

      // Update sync metadata
      const newMetadata: BlockSyncMetadata = {
        block_id: blockId,
        tradelog_hash: tradelogHash,
        dailylog_hash: dailylogHash,
        reportinglog_hash: reportinglogHash,
        synced_at: new Date(),
        sync_version: (existingMetadata?.sync_version ?? 0) + 1,
      };
      await upsertSyncMetadata(conn, newMetadata);

      // Commit transaction
      await conn.run("COMMIT");

      return {
        blockId,
        status: "synced",
        tradeCount: records.length,
      };
    } catch (err) {
      // Rollback on any error
      await conn.run("ROLLBACK");

      // If this block was previously synced, remove its data to avoid stale state
      // (Per CONTEXT.md: "If sync fails for a previously-synced block, REMOVE its data")
      if (existingMetadata) {
        try {
          await conn.run("BEGIN TRANSACTION");
          await conn.run(
            "DELETE FROM trades.trade_data WHERE block_id = $1",
            [blockId]
          );
          await conn.run(
            "DELETE FROM trades.reporting_data WHERE block_id = $1",
            [blockId]
          );
          await deleteSyncMetadata(conn, blockId);
          await conn.run("COMMIT");
        } catch {
          // Best effort cleanup failed, but we'll report the original error
          try {
            await conn.run("ROLLBACK");
          } catch {
            // Ignore rollback errors
          }
        }
      }

      throw err;
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      blockId,
      status: "error",
      error: errorMsg,
    };
  }
}

/**
 * Detect which blocks need syncing and which should be deleted.
 *
 * Compares filesystem folders with sync metadata:
 * - toSync: Folders that exist but aren't synced or have changed
 * - toDelete: Block IDs in metadata but folder no longer exists
 *
 * @param conn - DuckDB connection
 * @param baseDir - Base data directory
 * @returns Object with toSync and toDelete arrays
 */
export async function detectBlockChanges(
  conn: DuckDBConnection,
  baseDir: string
): Promise<{ toSync: string[]; toDelete: string[] }> {
  const toSync: string[] = [];
  const toDelete: string[] = [];

  // Get all synced block IDs from metadata
  const syncedBlockIds = new Set(await getAllSyncedBlockIds(conn));

  // List all directories in baseDir
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const folderNames = new Set<string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue; // Skip hidden folders
    if (entry.name === "_marketdata") continue; // Skip market data folder

    const blockId = entry.name;
    folderNames.add(blockId);

    const blockPath = path.join(baseDir, blockId);

    // Check if this is a new block (not in metadata)
    if (!syncedBlockIds.has(blockId)) {
      toSync.push(blockId);
      continue;
    }

    // Block exists in metadata - check if hash changed
    const blockJson = await readBlockJson(blockPath);
    const tradelogFilename = await findTradelogFile(blockPath, blockJson);
    if (!tradelogFilename) {
      // Previously-synced block lost tradelog: mark for cleanup
      toDelete.push(blockId);
      continue;
    }

    try {
      const tradelogPath = path.join(blockPath, tradelogFilename);
      const currentHash = await hashFileContent(tradelogPath);
      const metadata = await getSyncMetadata(conn, blockId);

      if (!metadata || metadata.tradelog_hash !== currentHash) {
        toSync.push(blockId);
      } else {
        // Tradelog unchanged - check if reportinglog needs syncing
        const optionalLogs = await findOptionalLogFiles(blockPath, blockJson);
        if (optionalLogs.reportinglog) {
          const reportinglogPath = path.join(blockPath, optionalLogs.reportinglog);
          const reportingHash = await hashFileContent(reportinglogPath);
          if (metadata.reportinglog_hash !== reportingHash) {
            // Reportinglog changed or was never synced
            toSync.push(blockId);
          }
        } else if (metadata?.reportinglog_hash !== null) {
          // Reportinglog was removed after being previously synced
          toSync.push(blockId);
        }
      }
    } catch {
      // Can't hash file - mark for sync (will fail during sync with proper error)
      toSync.push(blockId);
    }
  }

  // Find deleted blocks (in metadata but folder doesn't exist)
  for (const syncedBlockId of syncedBlockIds) {
    if (!folderNames.has(syncedBlockId)) {
      toDelete.push(syncedBlockId);
    }
  }

  return { toSync, toDelete };
}

/**
 * Remove data for deleted blocks from DuckDB.
 *
 * Performs atomic cleanup: deletes trade data and sync metadata.
 *
 * @param conn - DuckDB connection
 * @param deletedBlockIds - Array of block IDs to clean up
 */
export async function cleanupDeletedBlocks(
  conn: DuckDBConnection,
  deletedBlockIds: string[]
): Promise<void> {
  for (const blockId of deletedBlockIds) {
    await conn.run("BEGIN TRANSACTION");
    try {
      await conn.run(
        "DELETE FROM trades.trade_data WHERE block_id = $1",
        [blockId]
      );
      await conn.run(
        "DELETE FROM trades.reporting_data WHERE block_id = $1",
        [blockId]
      );
      await deleteSyncMetadata(conn, blockId);
      await conn.run("COMMIT");
    } catch (err) {
      await conn.run("ROLLBACK");
      throw err;
    }
  }
}
