/**
 * Market Data Sync
 *
 * Synchronizes market data from _marketdata/ folder to DuckDB.
 * Uses merge/preserve strategy: INSERT new dates, keep existing dates.
 *
 * Market data CSV files:
 *   - spx_daily.csv    -> market.spx_daily
 *   - spx_15min.csv    -> market.spx_15min
 *   - spx_highlow.csv  -> market.spx_highlow
 *   - vix_intraday.csv -> market.vix_intraday
 */

import type { DuckDBConnection } from "@duckdb/node-api";
import * as fs from "fs/promises";
import * as path from "path";
import { hashFileContent } from "./hasher.js";
import { getMarketSyncMetadata, upsertMarketSyncMetadata } from "./metadata.js";

// =============================================================================
// Types & Configuration
// =============================================================================

/**
 * Map CSV filenames to table names and CSV date column
 */
const MARKET_DATA_FILES: Record<string, { table: string; dateColumn: string }> = {
  "spx_daily.csv": { table: "market.spx_daily", dateColumn: "time" },
  "spx_15min.csv": { table: "market.spx_15min", dateColumn: "time" },
  "spx_highlow.csv": { table: "market.spx_highlow", dateColumn: "time" },
  "vix_intraday.csv": { table: "market.vix_intraday", dateColumn: "time" },
};

/**
 * Result of syncing a single market data file
 */
export interface SingleFileSyncResult {
  file: string;
  status: "synced" | "unchanged" | "error";
  rowsInserted?: number;
  rowsSkipped?: number;
  error?: string;
}

// =============================================================================
// Date Parsing
// =============================================================================

/**
 * Parse Unix timestamp (seconds since epoch) to YYYY-MM-DD in Eastern Time.
 *
 * TradingView exports use Unix timestamps in the "time" column.
 * Trading data is always in Eastern Time, so we format in that timezone.
 */
function parseTimestampToDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  // Format as YYYY-MM-DD in Eastern Time (America/New_York)
  // This handles both EST and EDT automatically
  const formatted = date.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatted; // Returns YYYY-MM-DD format
}

// =============================================================================
// CSV Parsing
// =============================================================================

/**
 * Parse CSV content into rows with header mapping
 */
function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.trim().split("\n");
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

// =============================================================================
// Row Merging
// =============================================================================

/**
 * Insert market data rows using ON CONFLICT DO NOTHING.
 *
 * Uses date as the primary key for conflict detection:
 * - New dates are inserted
 * - Existing dates are preserved (skipped)
 *
 * @param conn - DuckDB connection
 * @param tableName - Fully qualified table name (e.g., "market.spx_daily")
 * @param rows - Parsed CSV rows with header-keyed values
 * @param headers - CSV headers (columns)
 * @param dateColumn - CSV column containing Unix timestamp
 * @returns Count of inserted and skipped rows
 */
export async function mergeMarketDataRows(
  conn: DuckDBConnection,
  tableName: string,
  rows: Record<string, string>[],
  headers: string[],
  dateColumn: string
): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Get actual table columns from DuckDB schema
  // This filters out CSV columns that don't exist in the table (e.g., marker columns)
  const [schemaName, tableNameOnly] = tableName.split(".");
  const columnsResult = await conn.runAndReadAll(`
    SELECT column_name
    FROM duckdb_columns()
    WHERE schema_name = '${schemaName}' AND table_name = '${tableNameOnly}'
  `);
  const tableColumns = new Set(
    columnsResult.getRows().map((row) => String(row[0]))
  );

  // Build column list: only include CSV columns that exist in the table schema
  // Replace date column with 'date', exclude original date column
  const dbColumns = headers
    .filter((h) => h !== dateColumn)
    .filter((h) => tableColumns.has(h)) // Only include columns that exist in table
    .map((h) => {
      // Column names are used as-is (they match CSV headers)
      return h;
    });

  // Add 'date' as first column
  const allColumns = ["date", ...dbColumns];

  // Track dates we're inserting to calculate skips
  const dateRows = new Map<string, Record<string, string>>();

  // Deduplicate by date: keep last row for each date (most complete data)
  for (const row of rows) {
    const timestamp = parseInt(row[dateColumn], 10);
    if (isNaN(timestamp)) continue;
    const date = parseTimestampToDate(timestamp);
    dateRows.set(date, row);
  }

  const uniqueRows = Array.from(dateRows.entries());
  const totalRows = uniqueRows.length;

  // Get current row count (COUNT returns BigInt, convert to number)
  const beforeResult = await conn.runAndReadAll(`SELECT COUNT(*) FROM ${tableName}`);
  const beforeCount = Number(beforeResult.getRows()[0][0]);

  // Process in batches of 500
  const BATCH_SIZE = 500;

  for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
    const batch = uniqueRows.slice(i, i + BATCH_SIZE);

    // Build VALUES clause with parameterized placeholders
    // DuckDB uses $1, $2, ... for parameters
    const values: (string | number | null)[] = [];
    const valuePlaceholders: string[] = [];

    for (const [date, row] of batch) {
      const rowPlaceholders: string[] = [];

      // Add date
      values.push(date);
      rowPlaceholders.push(`$${values.length}`);

      // Add other columns
      for (const col of dbColumns) {
        const val = row[col];
        if (val === "" || val === "NaN" || val === "NA" || val === undefined) {
          values.push(null);
        } else {
          // Try to parse as number, otherwise keep as string
          const numVal = parseFloat(val);
          values.push(isNaN(numVal) ? val : numVal);
        }
        rowPlaceholders.push(`$${values.length}`);
      }

      valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
    }

    // Build and execute INSERT with ON CONFLICT DO NOTHING
    const columnList = allColumns.join(", ");
    const sql = `INSERT INTO ${tableName} (${columnList}) VALUES ${valuePlaceholders.join(", ")} ON CONFLICT (date) DO NOTHING`;

    await conn.run(sql, values);
  }

  // Get new row count to calculate actual insertions (COUNT returns BigInt, convert to number)
  const afterResult = await conn.runAndReadAll(`SELECT COUNT(*) FROM ${tableName}`);
  const afterCount = Number(afterResult.getRows()[0][0]);

  const inserted = afterCount - beforeCount;
  const skipped = totalRows - inserted;

  return { inserted, skipped };
}

// =============================================================================
// Single File Sync
// =============================================================================

/**
 * Sync a single market data file to DuckDB.
 *
 * Flow:
 * 1. Hash the file content
 * 2. Compare with stored metadata hash
 * 3. If unchanged, return early
 * 4. If changed, parse CSV and merge rows
 * 5. Update metadata with new hash and max date
 */
async function syncMarketFile(
  conn: DuckDBConnection,
  marketDataPath: string,
  fileName: string
): Promise<SingleFileSyncResult> {
  const config = MARKET_DATA_FILES[fileName];
  if (!config) {
    return { file: fileName, status: "error", error: `Unknown market data file: ${fileName}` };
  }

  const filePath = path.join(marketDataPath, fileName);

  try {
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return { file: fileName, status: "error", error: `File not found: ${filePath}` };
    }

    // Hash the file
    const contentHash = await hashFileContent(filePath);

    // Get existing metadata
    const existingMeta = await getMarketSyncMetadata(conn, fileName);

    // If hash matches, file is unchanged
    if (existingMeta && existingMeta.content_hash === contentHash) {
      return { file: fileName, status: "unchanged" };
    }

    // Parse CSV
    const content = await fs.readFile(filePath, "utf-8");
    const { headers, rows } = parseCSV(content);

    if (rows.length === 0) {
      return { file: fileName, status: "error", error: "CSV has no data rows" };
    }

    // Merge rows into table
    const { inserted, skipped } = await mergeMarketDataRows(
      conn,
      config.table,
      rows,
      headers,
      config.dateColumn
    );

    // Calculate max date from the data
    let maxDate: string | null = null;
    for (const row of rows) {
      const timestamp = parseInt(row[config.dateColumn], 10);
      if (!isNaN(timestamp)) {
        const date = parseTimestampToDate(timestamp);
        if (!maxDate || date > maxDate) {
          maxDate = date;
        }
      }
    }

    // Update metadata
    await upsertMarketSyncMetadata(conn, {
      file_name: fileName,
      content_hash: contentHash,
      max_date: maxDate,
      synced_at: new Date(),
    });

    return {
      file: fileName,
      status: "synced",
      rowsInserted: inserted,
      rowsSkipped: skipped,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { file: fileName, status: "error", error: msg };
  }
}

// =============================================================================
// Main Sync Function
// =============================================================================

/**
 * Sync all market data files from _marketdata folder.
 *
 * @param conn - DuckDB connection
 * @param baseDir - Base data directory (contains _marketdata/)
 * @returns Array of sync results for each file
 */
export async function syncMarketDataInternal(
  conn: DuckDBConnection,
  baseDir: string
): Promise<SingleFileSyncResult[]> {
  const marketDataPath = path.join(baseDir, "_marketdata");

  // Check if _marketdata directory exists
  try {
    const stats = await fs.stat(marketDataPath);
    if (!stats.isDirectory()) {
      return [];
    }
  } catch {
    // Directory doesn't exist - return empty results
    return [];
  }

  // Sync each known market data file
  const results: SingleFileSyncResult[] = [];

  for (const fileName of Object.keys(MARKET_DATA_FILES)) {
    const result = await syncMarketFile(conn, marketDataPath, fileName);
    results.push(result);
  }

  return results;
}
