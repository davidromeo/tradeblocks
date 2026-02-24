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
import { runEnrichment } from "./market-enricher.js";

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
  rowsUpdated: number;
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
 * Special case for intraday: if `date` is mapped but `time` is not, the `time` field
 * will be auto-derived from the Unix timestamp in the date source column. In this case,
 * the missing `time` mapping is allowed — validation passes without it.
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
  let missing = required.filter((field) => !schemaValues.includes(field));

  // For intraday: allow missing `time` if `date` is mapped — time will be auto-derived
  // from the Unix timestamp in the date source column during applyColumnMapping.
  if (targetTable === "intraday" && missing.includes("time") && schemaValues.includes("date")) {
    missing = missing.filter((f) => f !== "time");
  }

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

/**
 * Extract HH:MM time from a value in Eastern Time.
 * - If numeric AND > 1e8: treat as Unix timestamp (seconds), extract HH:MM ET
 * - If already HH:MM: return as-is
 * - If HHMM (4 digits): convert to HH:MM
 * - Otherwise: return null
 */
function parseFlexibleTime(value: string): string | null {
  const numeric = Number(value);
  if (!isNaN(numeric) && numeric > 1e8) {
    // Unix timestamp in seconds — convert to Eastern Time HH:MM
    const d = new Date(numeric * 1000);
    return d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  // Already in HH:MM format
  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  // HHMM format (4 digits), e.g. "0930"
  if (/^\d{4}$/.test(value)) {
    return `${value.slice(0, 2)}:${value.slice(2)}`;
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
      } else if (schemaCol === "time") {
        const parsedTime = parseFlexibleTime(rawValue);
        if (parsedTime === null) {
          console.warn(`[market-importer] Skipping row with unparseable time value: "${rawValue}"`);
          hasNullDate = true; // Reuse the skip mechanism
          break;
        }
        mapped[schemaCol] = parsedTime;
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

    // Auto-extract time from the date source column's Unix timestamp for intraday imports.
    // This allows users to map a single Unix timestamp column to "date" and get "time"
    // (HH:MM ET) auto-populated — no need to specify a separate time column in the mapping.
    if (targetTable === "intraday" && !("time" in mapped)) {
      const dateSourceCol = Object.entries(columnMapping).find(([, schema]) => schema === "date")?.[0];
      if (dateSourceCol) {
        const rawDateValue = row[dateSourceCol] ?? "";
        const numericDate = Number(rawDateValue);
        if (!isNaN(numericDate) && numericDate > 1e8) {
          const parsedTime = parseFlexibleTime(rawDateValue);
          if (parsedTime) {
            mapped["time"] = parsedTime;
          }
        }
      }
    }

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
): Promise<{ inserted: number; updated: number; skipped: number }> {
  if (mappedRows.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 };
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

  // Build ON CONFLICT clause: merge non-key columns into existing rows
  // (e.g., importing VIX9D_Close into a context row that already has VIX_Close)
  const conflictKeys = new Set(
    CONFLICT_TARGETS[targetTable].replace(/[()]/g, "").split(",").map((s: string) => s.trim())
  );
  const updateCols = columns.filter((c) => !conflictKeys.has(c));
  const conflictAction =
    updateCols.length > 0
      ? `DO UPDATE SET ${updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`
      : "DO NOTHING";

  const columnList = columns.join(", ");
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

    const sql =
      `INSERT INTO ${tableName} (${columnList}) VALUES ${valuePlaceholders.join(", ")} ` +
      `ON CONFLICT ${conflictTarget} ${conflictAction}`;

    await conn.run(sql, values as (string | number | boolean | null | bigint)[]);
  }

  // COUNT(*) after insert — net new rows
  const afterResult = await conn.runAndReadAll(`SELECT COUNT(*) FROM ${tableName}`);
  const afterCount = Number(afterResult.getRows()[0][0]);

  const inserted = afterCount - beforeCount;
  // With DO UPDATE, non-inserted rows are updated (not skipped).
  // With DO NOTHING (updateCols empty), non-inserted rows are skipped.
  const updated = updateCols.length > 0 ? mappedRows.length - inserted : 0;
  const skipped = updateCols.length > 0 ? 0 : mappedRows.length - inserted;
  return { inserted, updated, skipped };
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
// Enrichment Trigger
// =============================================================================

/**
 * Trigger market data enrichment after an import.
 *
 * Calls runEnrichment() for daily table imports. Context and intraday imports
 * are source data, not enrichment targets, so they are skipped here.
 *
 * Returns "complete", "skipped", or "error" — never "pending".
 */
export async function triggerEnrichment(
  conn: DuckDBConnection,
  ticker: string,
  targetTable: string,
  _dateRange: { min: string; max: string } | null,
  skipEnrichment: boolean
): Promise<{ status: "pending" | "complete" | "skipped" | "error"; message: string }> {
  // Only enrich daily table imports — context and intraday are source data, not enrichment targets
  if (skipEnrichment) {
    return {
      status: "skipped",
      message: "skip_enrichment=true; call enrich_market_data to populate computed fields.",
    };
  }
  if (targetTable !== "daily") {
    return {
      status: "skipped",
      message: `Enrichment only runs for daily table imports; skipping for ${targetTable}.`,
    };
  }

  try {
    const result = await runEnrichment(conn, ticker, {});
    const summaryParts = [
      `Tier 1: ${result.tier1.status}${result.tier1.fieldsWritten !== undefined ? ` (${result.tier1.fieldsWritten} fields)` : ""}${result.tier1.reason ? ` — ${result.tier1.reason}` : ""}`,
      `Tier 2: ${result.tier2.status}${result.tier2.fieldsWritten !== undefined ? ` (${result.tier2.fieldsWritten} fields)` : ""}${result.tier2.reason ? ` — ${result.tier2.reason}` : ""}`,
      `Tier 3: ${result.tier3.status}${result.tier3.reason ? ` — ${result.tier3.reason}` : ""}`,
    ];
    return {
      status: "complete",
      message: `Enriched ${result.rowsEnriched} rows for ${ticker} through ${result.enrichedThrough ?? "N/A"}. ${summaryParts.join("; ")}`,
    };
  } catch (err) {
    return {
      status: "error",
      message: `Enrichment failed for ${ticker}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
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
      rowsUpdated: 0,
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
  const { inserted, updated, skipped } = await insertMappedRows(conn, targetTable, mappedRows);

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
    rowsUpdated: updated,
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
        rowsUpdated: 0,
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
    const { inserted, updated, skipped } = await insertMappedRows(conn, targetTable, mappedRows);

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
      rowsUpdated: updated,
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
