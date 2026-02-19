/**
 * Market Data Sync
 *
 * Synchronizes market data from _marketdata/ folder to DuckDB.
 * Uses merge/preserve strategy: INSERT new (ticker, date) keys, keep existing rows.
 *
 * Supported market data CSV filename patterns:
 *   - <ticker>_daily.csv        -> market.spx_daily
 *   - <ticker>_15min.csv        -> market.spx_15min
 *   - <ticker>_vix_intraday.csv -> market.vix_intraday
 *   - vix_intraday.csv          -> market.vix_intraday (ticker = ALL)
 */

import type { DuckDBConnection } from "@duckdb/node-api";
import * as fs from "fs/promises";
import * as path from "path";
import { hashFileContent } from "./hasher.js";
import { getMarketSyncMetadata, upsertMarketSyncMetadata } from "./metadata.js";
import {
  DEFAULT_MARKET_TICKER,
  GLOBAL_MARKET_TICKER,
  normalizeTicker,
  resolveTickerFromCsvRow,
} from "../utils/ticker.js";

// =============================================================================
// Types & Configuration
// =============================================================================

interface MarketFileConfig {
  fileName: string;
  table: string;
  dateColumn: string;
  defaultTicker: string;
}

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
// File Discovery
// =============================================================================

function detectMarketFileConfig(fileName: string): MarketFileConfig | null {
  const lowerName = fileName.toLowerCase();

  const dailyMatch = lowerName.match(/^([a-z0-9._^$-]+)_daily\.csv$/i);
  if (dailyMatch) {
    return {
      fileName,
      table: "market.spx_daily",
      dateColumn: "time",
      defaultTicker: normalizeTicker(dailyMatch[1]) ?? DEFAULT_MARKET_TICKER,
    };
  }

  const intradayMatch = lowerName.match(/^([a-z0-9._^$-]+)_15min\.csv$/i);
  if (intradayMatch) {
    return {
      fileName,
      table: "market.spx_15min",
      dateColumn: "time",
      defaultTicker: normalizeTicker(intradayMatch[1]) ?? DEFAULT_MARKET_TICKER,
    };
  }

  const tickerVixMatch = lowerName.match(/^([a-z0-9._^$-]+)_vix_intraday\.csv$/i);
  if (tickerVixMatch) {
    return {
      fileName,
      table: "market.vix_intraday",
      dateColumn: "time",
      defaultTicker: normalizeTicker(tickerVixMatch[1]) ?? GLOBAL_MARKET_TICKER,
    };
  }

  if (lowerName === "vix_intraday.csv") {
    return {
      fileName,
      table: "market.vix_intraday",
      dateColumn: "time",
      defaultTicker: GLOBAL_MARKET_TICKER,
    };
  }

  return null;
}

async function discoverMarketDataFiles(marketDataPath: string): Promise<MarketFileConfig[]> {
  const entries = await fs.readdir(marketDataPath, { withFileTypes: true });
  const csvFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".csv"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const configs: MarketFileConfig[] = [];
  for (const fileName of csvFiles) {
    const config = detectMarketFileConfig(fileName);
    if (config) {
      configs.push(config);
    }
  }
  return configs;
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
  const formatted = date.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatted;
}

// =============================================================================
// CSV Parsing
// =============================================================================

/**
 * Parse CSV content into rows with header mapping
 */
function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip UTF-8 BOM if present (common in Windows/Excel CSV exports)
  const lines = content.replace(/^\uFEFF/, "").trim().split("\n");
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

interface MarketInsertRow {
  ticker: string;
  date: string;
  row: Record<string, string>;
}

/**
 * Insert market data rows using ON CONFLICT DO NOTHING.
 *
 * Uses (ticker, date) as primary key when ticker column exists:
 * - New keys are inserted
 * - Existing keys are preserved (skipped)
 *
 * @param conn - DuckDB connection
 * @param tableName - Fully qualified table name (e.g., "market.spx_daily")
 * @param rows - Parsed CSV rows with header-keyed values
 * @param headers - CSV headers (columns)
 * @param dateColumn - CSV column containing Unix timestamp
 * @param defaultTicker - Fallback ticker for rows missing ticker fields
 * @returns Count of inserted and skipped rows
 */
export async function mergeMarketDataRows(
  conn: DuckDBConnection,
  tableName: string,
  rows: Record<string, string>[],
  headers: string[],
  dateColumn: string,
  defaultTicker: string
): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const [schemaName, tableNameOnly] = tableName.split(".");
  const columnsResult = await conn.runAndReadAll(`
    SELECT column_name
    FROM duckdb_columns()
    WHERE schema_name = '${schemaName}' AND table_name = '${tableNameOnly}'
  `);
  const tableColumns = new Set(columnsResult.getRows().map((row) => String(row[0])));
  const hasTickerColumn = tableColumns.has("ticker");

  // Build column list from CSV headers that exist in table schema.
  // date/ticker are set explicitly and removed from source headers.
  const dbColumns = headers
    .filter((h) => h !== dateColumn)
    .filter((h) => !["ticker", "Ticker", "symbol", "Symbol", "underlying", "Underlying"].includes(h))
    .filter((h) => tableColumns.has(h));

  const allColumns = hasTickerColumn ? ["ticker", "date", ...dbColumns] : ["date", ...dbColumns];

  const dedupedRows = new Map<string, MarketInsertRow>();
  for (const row of rows) {
    const timestamp = parseInt(row[dateColumn], 10);
    if (isNaN(timestamp)) continue;

    const date = parseTimestampToDate(timestamp);
    const ticker = hasTickerColumn
      ? resolveTickerFromCsvRow(row, defaultTicker)
      : defaultTicker;
    const key = hasTickerColumn ? `${ticker}|${date}` : date;

    // Keep the last row for each key (latest export row wins).
    dedupedRows.set(key, { ticker, date, row });
  }

  const uniqueRows = Array.from(dedupedRows.values());
  const totalRows = uniqueRows.length;
  if (totalRows === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const beforeResult = await conn.runAndReadAll(`SELECT COUNT(*) FROM ${tableName}`);
  const beforeCount = Number(beforeResult.getRows()[0][0]);

  const BATCH_SIZE = 500;
  for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
    const batch = uniqueRows.slice(i, i + BATCH_SIZE);

    const values: (string | number | null)[] = [];
    const valuePlaceholders: string[] = [];

    for (const item of batch) {
      const rowPlaceholders: string[] = [];

      if (hasTickerColumn) {
        values.push(item.ticker);
        rowPlaceholders.push(`$${values.length}`);
      }

      values.push(item.date);
      rowPlaceholders.push(`$${values.length}`);

      for (const col of dbColumns) {
        const rawVal = item.row[col];
        if (
          rawVal === "" ||
          rawVal === "NaN" ||
          rawVal === "NA" ||
          rawVal === undefined
        ) {
          values.push(null);
        } else {
          const numVal = parseFloat(rawVal);
          values.push(isNaN(numVal) ? rawVal : numVal);
        }
        rowPlaceholders.push(`$${values.length}`);
      }

      valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
    }

    const columnList = allColumns.join(", ");
    const conflictTarget = hasTickerColumn ? "(ticker, date)" : "(date)";
    const sql =
      `INSERT INTO ${tableName} (${columnList}) VALUES ${valuePlaceholders.join(", ")} ` +
      `ON CONFLICT ${conflictTarget} DO NOTHING`;

    await conn.run(sql, values);
  }

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
 */
async function syncMarketFile(
  conn: DuckDBConnection,
  marketDataPath: string,
  config: MarketFileConfig
): Promise<SingleFileSyncResult> {
  const filePath = path.join(marketDataPath, config.fileName);

  try {
    try {
      await fs.access(filePath);
    } catch {
      return { file: config.fileName, status: "error", error: `File not found: ${filePath}` };
    }

    const contentHash = await hashFileContent(filePath);
    const existingMeta = await getMarketSyncMetadata(conn, config.fileName);

    if (existingMeta && existingMeta.content_hash === contentHash) {
      return { file: config.fileName, status: "unchanged" };
    }

    const content = await fs.readFile(filePath, "utf-8");
    const { headers, rows } = parseCSV(content);
    if (rows.length === 0) {
      return { file: config.fileName, status: "error", error: "CSV has no data rows" };
    }

    const { inserted, skipped } = await mergeMarketDataRows(
      conn,
      config.table,
      rows,
      headers,
      config.dateColumn,
      config.defaultTicker
    );

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

    await upsertMarketSyncMetadata(conn, {
      file_name: config.fileName,
      content_hash: contentHash,
      max_date: maxDate,
      synced_at: new Date(),
    });

    return {
      file: config.fileName,
      status: "synced",
      rowsInserted: inserted,
      rowsSkipped: skipped,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { file: config.fileName, status: "error", error: msg };
  }
}

// =============================================================================
// Main Sync Function
// =============================================================================

/**
 * Sync all recognized market data files from _marketdata folder.
 *
 * @param conn - DuckDB connection
 * @param baseDir - Base data directory (contains _marketdata/)
 * @returns Array of sync results for each recognized file
 */
export async function syncMarketDataInternal(
  conn: DuckDBConnection,
  baseDir: string
): Promise<SingleFileSyncResult[]> {
  const marketDataPath = path.join(baseDir, "_marketdata");

  try {
    const stats = await fs.stat(marketDataPath);
    if (!stats.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const configs = await discoverMarketDataFiles(marketDataPath);
  const results: SingleFileSyncResult[] = [];

  for (const config of configs) {
    const result = await syncMarketFile(conn, marketDataPath, config);
    results.push(result);
  }

  return results;
}
