/**
 * Market Data Importer
 *
 * Core ingestion logic for importing market data from CSV files and external DuckDB databases
 * into the normalized market schema tables (market.daily, market.context, market.intraday).
 *
 * Design principles:
 * - Validate column mapping BEFORE any writes (fail-clean semantics)
 * - ON CONFLICT DO NOTHING for idempotent merges
 * - ATTACH/DETACH lifecycle for external DBs
 * - normalizeTicker() called at import boundary before any DB write
 * - No withFullSync usage (DB-09: market writes must not be wrapped in analytics.duckdb transactions)
 * - No upsertMarketSyncMetadata (old schema) — only upsertMarketImportMetadata (Phase 60 schema)
 */

import type { DuckDBConnection } from "@duckdb/node-api";
import * as fs from "fs/promises";
import { normalizeTicker } from "./ticker.js";
import { upsertMarketImportMetadata } from "../sync/metadata.js";

// =============================================================================
// Constants
// =============================================================================

const REQUIRED_SCHEMA_FIELDS: Record<string, string[]> = {
  daily: ["date", "open", "high", "low", "close"],
  context: ["date"],
  intraday: ["date", "time", "open", "high", "low", "close"],
};

// PK conflict target per table
const CONFLICT_TARGETS: Record<string, string> = {
  daily: "(ticker, date)",
  context: "(date)",
  intraday: "(ticker, date, time)",
};

// =============================================================================
// Types
// =============================================================================

export interface ImportMarketCsvOptions {
  filePath: string;
  ticker: string;
  targetTable: "daily" | "context" | "intraday";
  columnMapping: Record<string, string>; // { csvColumn: schemaColumn }
  dryRun?: boolean;
  skipEnrichment?: boolean;
}

export interface ImportFromDatabaseOptions {
  dbPath: string;
  query: string;
  ticker: string;
  targetTable: "daily" | "context" | "intraday";
  columnMapping: Record<string, string>; // { queryColumn: schemaColumn }
  dryRun?: boolean;
  skipEnrichment?: boolean;
}

export interface ImportResult {
  rowsInserted: number;
  rowsSkipped: number;
  inputRowCount: number;
  dateRange: { min: string; max: string } | null;
  enrichment: { status: "pending" | "complete" | "skipped" | "error"; message: string };
}

// =============================================================================
// Column Mapping Validation
// =============================================================================

/**
 * Validate that the column mapping covers all required schema fields for the target table.
 *
 * @param columnMapping - Mapping from source columns to schema columns
 * @param targetTable - The target market table
 * @returns Validation result with missing field names
 */
export function validateColumnMapping(
  columnMapping: Record<string, string>,
  targetTable: "daily" | "context" | "intraday"
): { valid: boolean; missingFields: string[] } {
  const schemaValues = Object.values(columnMapping);
  const required = REQUIRED_SCHEMA_FIELDS[targetTable] ?? [];
  const missing = required.filter((field) => !schemaValues.includes(field));
  return { valid: missing.length === 0, missingFields: missing };
}

// =============================================================================
// Private CSV Parsing Helpers
// =============================================================================

/**
 * Parse CSV content into rows with header mapping.
 * Strips UTF-8 BOM if present. Handles \r\n line endings.
 */
function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.replace(/^\uFEFF/, "").trim().split("\n");
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].trim().split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a date value flexibly:
 * - If numeric AND > 1e8: treat as Unix timestamp (seconds), convert to ET date
 * - If YYYY-MM-DD string: return as-is
 * - Otherwise: return null
 */
function parseFlexibleDate(value: string): string | null {
  const numeric = Number(value);
  if (!isNaN(numeric) && numeric > 1e8) {
    // Unix timestamp in seconds — convert to Eastern Time date
    return new Date(numeric * 1000).toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  // Check YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return null;
}

// =============================================================================
// Private Column Mapping Helper
// =============================================================================

/**
 * Apply column mapping to raw rows, performing date parsing and numeric coercion.
 *
 * @param rows - Raw rows from CSV or query result
 * @param columnMapping - { sourceCol: schemaCol } mapping
 * @param ticker - Ticker to inject for daily/intraday tables
 * @param targetTable - Target table (controls whether ticker is injected)
 * @returns Mapped rows with schema column names, invalid date rows dropped
 */
function applyColumnMapping(
  rows: Record<string, string>[],
  columnMapping: Record<string, string>,
  ticker: string,
  targetTable: "daily" | "context" | "intraday"
): Array<Record<string, unknown>> {
  const normalizedTicker = normalizeTicker(ticker) ?? ticker.toUpperCase();
  const result: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const mapped: Record<string, unknown> = {};
    let hasNullDate = false;

    for (const [sourceCol, schemaCol] of Object.entries(columnMapping)) {
      const rawValue = row[sourceCol] ?? "";

      if (schemaCol === "date") {
        const parsedDate = parseFlexibleDate(rawValue);
        if (parsedDate === null) {
          // Log a warning and skip this row
          console.warn(`[market-importer] Skipping row with unparseable date value: "${rawValue}"`);
          hasNullDate = true;
          break;
        }
        mapped[schemaCol] = parsedDate;
      } else {
        // Numeric coercion for non-date, non-ticker fields
        if (rawValue === "" || rawValue === "NaN" || rawValue === "NA") {
          mapped[schemaCol] = null;
        } else {
          const numVal = parseFloat(rawValue);
          mapped[schemaCol] = isNaN(numVal) ? rawValue : numVal;
        }
      }
    }

    if (hasNullDate) continue;
    if (!("date" in mapped)) continue;

    // Inject ticker for daily and intraday tables (context PK is date-only)
    if (targetTable === "daily" || targetTable === "intraday") {
      mapped["ticker"] = normalizedTicker;
    }

    result.push(mapped);
  }

  return result;
}

// =============================================================================
// Private Insert Helper
// =============================================================================

/**
 * Insert mapped rows into the target market table using ON CONFLICT DO NOTHING.
 * Batches inserts in groups of 500.
 *
 * @returns Count of inserted and skipped rows
 */
async function insertMappedRows(
  conn: DuckDBConnection,
  targetTable: "daily" | "context" | "intraday",
  mappedRows: Array<Record<string, unknown>>
): Promise<{ inserted: number; skipped: number }> {
  if (mappedRows.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const tableName = `market.${targetTable}`;
  const conflictTarget = CONFLICT_TARGETS[targetTable];

  // Collect all distinct schema column names across all rows
  const columnSet = new Set<string>();
  for (const row of mappedRows) {
    for (const key of Object.keys(row)) {
      columnSet.add(key);
    }
  }
  const columns = Array.from(columnSet);

  // COUNT(*) before insert
  const beforeResult = await conn.runAndReadAll(`SELECT COUNT(*) FROM ${tableName}`);
  const beforeCount = Number(beforeResult.getRows()[0][0]);

  const BATCH_SIZE = 500;
  for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
    const batch = mappedRows.slice(i, i + BATCH_SIZE);
    const values: unknown[] = [];
    const valuePlaceholders: string[] = [];

    for (const row of batch) {
      const rowPlaceholders: string[] = [];
      for (const col of columns) {
        values.push(row[col] ?? null);
        rowPlaceholders.push(`$${values.length}`);
      }
      valuePlaceholders.push(`(${rowPlaceholders.join(", ")})`);
    }

    const columnList = columns.join(", ");
    const sql =
      `INSERT INTO ${tableName} (${columnList}) VALUES ${valuePlaceholders.join(", ")} ` +
      `ON CONFLICT ${conflictTarget} DO NOTHING`;

    await conn.run(sql, values as (string | number | boolean | null | bigint)[]);
  }

  // COUNT(*) after insert
  const afterResult = await conn.runAndReadAll(`SELECT COUNT(*) FROM ${tableName}`);
  const afterCount = Number(afterResult.getRows()[0][0]);

  const inserted = afterCount - beforeCount;
  const skipped = mappedRows.length - inserted;
  return { inserted, skipped };
}

// =============================================================================
// Private Date Range Helper
// =============================================================================

/**
 * Compute min/max date range from mapped rows.
 */
function computeDateRange(
  rows: Array<Record<string, unknown>>
): { min: string; max: string } | null {
  const dates: string[] = [];
  for (const row of rows) {
    const d = row["date"];
    if (typeof d === "string" && d) {
      dates.push(d);
    }
  }
  if (dates.length === 0) return null;
  dates.sort();
  return { min: dates[0], max: dates[dates.length - 1] };
}

// =============================================================================
// Enrichment Stub
// =============================================================================

/**
 * Trigger market data enrichment (Phase 62 stub).
 *
 * Currently returns a pending status without performing any work.
 * Phase 62 will replace this with real enrichment logic.
 */
export async function triggerEnrichment(
  _conn: DuckDBConnection,
  ticker: string,
  targetTable: string,
  dateRange: { min: string; max: string } | null,
  skipEnrichment: boolean
): Promise<{ status: "pending" | "complete" | "skipped" | "error"; message: string }> {
  if (skipEnrichment) {
    return {
      status: "skipped",
      message: "skip_enrichment=true; call enrich_market_data to populate computed fields.",
    };
  }

  const rangeStr = dateRange ? ` (${dateRange.min} to ${dateRange.max})` : "";
  return {
    status: "pending",
    message: `Enrichment for ${ticker} in market.${targetTable}${rangeStr} is queued. Run enrich_market_data to populate computed fields.`,
  };
}

// =============================================================================
// importMarketCsvFile
// =============================================================================

/**
 * Import market data from a CSV file into the target market table.
 *
 * Steps:
 * 1. Validate column mapping (fail-clean before any writes)
 * 2. Read CSV file
 * 3. Parse and map columns
 * 4. Insert with ON CONFLICT DO NOTHING (or return preview if dry_run=true)
 * 5. Upsert import metadata
 * 6. Trigger enrichment stub
 *
 * @param conn - Active DuckDB connection with market catalog attached
 * @param options - Import options including file path, ticker, and column mapping
 * @returns Import result with row counts, date range, and enrichment status
 */
export async function importMarketCsvFile(
  conn: DuckDBConnection,
  options: ImportMarketCsvOptions
): Promise<ImportResult> {
  const { filePath, ticker, targetTable, columnMapping, dryRun = false, skipEnrichment = false } =
    options;

  // 1. Validate column mapping first
  const validation = validateColumnMapping(columnMapping, targetTable);
  if (!validation.valid) {
    throw new Error(
      `Column mapping missing required fields for market.${targetTable}: ${validation.missingFields.join(", ")}`
    );
  }

  // 2. Read file
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read CSV file at "${filePath}": ${msg}`);
  }

  // 3. Parse CSV
  const { rows } = parseCSV(content);
  if (rows.length === 0) {
    throw new Error(`CSV file "${filePath}" has no data rows`);
  }

  // 4. Map columns
  const mappedRows = applyColumnMapping(rows, columnMapping, ticker, targetTable);
  if (mappedRows.length === 0) {
    throw new Error(
      `After applying column mapping, 0 valid rows remain from CSV file "${filePath}"`
    );
  }

  const normalizedTicker = normalizeTicker(ticker) ?? ticker.toUpperCase();
  const dateRange = computeDateRange(mappedRows);

  // 5. Dry run: return preview without writing
  if (dryRun) {
    return {
      rowsInserted: 0,
      rowsSkipped: 0,
      inputRowCount: mappedRows.length,
      dateRange,
      enrichment: {
        status: "skipped",
        message: `dry_run=true; no data written. Would import ${mappedRows.length} rows.`,
      },
    };
  }

  // 6. Insert rows
  const { inserted, skipped } = await insertMappedRows(conn, targetTable, mappedRows);

  // 7. Upsert import metadata
  await upsertMarketImportMetadata(conn, {
    source: `import_market_csv:${filePath}`,
    ticker: normalizedTicker,
    target_table: targetTable,
    max_date: dateRange?.max ?? null,
    enriched_through: null,
    synced_at: new Date(),
  });

  // 8. Trigger enrichment
  const enrichment = await triggerEnrichment(conn, normalizedTicker, targetTable, dateRange, skipEnrichment);

  return {
    rowsInserted: inserted,
    rowsSkipped: skipped,
    inputRowCount: mappedRows.length,
    dateRange,
    enrichment,
  };
}

// =============================================================================
// importFromDatabase
// =============================================================================

/**
 * Import market data from an external DuckDB database into the target market table.
 *
 * ATTACHes the external database as READ_ONLY, queries it, maps columns, and inserts
 * into market tables. DETACHes the external DB in a finally block regardless of outcome.
 *
 * @param conn - Active DuckDB connection with market catalog attached
 * @param options - Import options including DB path, query, ticker, and column mapping
 * @returns Import result with row counts, date range, and enrichment status
 */
export async function importFromDatabase(
  conn: DuckDBConnection,
  options: ImportFromDatabaseOptions
): Promise<ImportResult> {
  const { dbPath, query, ticker, targetTable, columnMapping, dryRun = false, skipEnrichment = false } =
    options;

  // 1. Validate column mapping first
  const validation = validateColumnMapping(columnMapping, targetTable);
  if (!validation.valid) {
    throw new Error(
      `Column mapping missing required fields for market.${targetTable}: ${validation.missingFields.join(", ")}`
    );
  }

  const EXT_ALIAS = "ext_import_source";

  // 2. Attach external DB as READ_ONLY
  await conn.run(`ATTACH '${dbPath}' AS ${EXT_ALIAS} (READ_ONLY)`);

  try {
    // 3. Execute query against external DB
    const rawResult = await conn.runAndReadAll(query);

    // 4. Convert result to Record<string, string>[]
    // Use columnNames() for column name strings — getColumns() returns column data arrays,
    // not column descriptor objects with .name properties.
    const resultColumnNames = rawResult.columnNames();
    const resultRows = rawResult.getRows();

    const rows: Record<string, string>[] = resultRows.map((row) => {
      const obj: Record<string, string> = {};
      resultColumnNames.forEach((colName, idx) => {
        const val = row[idx];
        obj[colName] = val === null || val === undefined ? "" : String(val);
      });
      return obj;
    });

    // 5. Map columns
    const mappedRows = applyColumnMapping(rows, columnMapping, ticker, targetTable);

    const normalizedTicker = normalizeTicker(ticker) ?? ticker.toUpperCase();
    const dateRange = computeDateRange(mappedRows);

    // 6. Dry run: return preview without writing
    if (dryRun) {
      return {
        rowsInserted: 0,
        rowsSkipped: 0,
        inputRowCount: mappedRows.length,
        dateRange,
        enrichment: {
          status: "skipped",
          message: `dry_run=true; no data written. Would import ${mappedRows.length} rows.`,
        },
      };
    }

    // 7. Insert rows
    const { inserted, skipped } = await insertMappedRows(conn, targetTable, mappedRows);

    // 8. Upsert import metadata
    await upsertMarketImportMetadata(conn, {
      source: `import_from_database:${dbPath}`,
      ticker: normalizedTicker,
      target_table: targetTable,
      max_date: dateRange?.max ?? null,
      enriched_through: null,
      synced_at: new Date(),
    });

    // 9. Trigger enrichment
    const enrichment = await triggerEnrichment(conn, normalizedTicker, targetTable, dateRange, skipEnrichment);

    return {
      rowsInserted: inserted,
      rowsSkipped: skipped,
      inputRowCount: mappedRows.length,
      dateRange,
      enrichment,
    };
  } finally {
    // Always detach external DB regardless of success or failure
    try {
      await conn.run(`DETACH ${EXT_ALIAS}`);
    } catch {
      // Non-fatal: detach failure should not mask the original error
    }
  }
}
