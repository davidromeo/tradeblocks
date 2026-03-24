/**
 * SQL Query Tool
 *
 * Provides direct SQL query access to the DuckDB analytics database.
 * Enables ad-hoc analysis, hypothesis testing, and data exploration
 * across trades and market data.
 *
 * Security:
 *   - SELECT queries run freely; DELETE/UPDATE require confirm=true
 *   - No file access functions (read_csv, write_csv, etc.)
 *   - No schema modifications (CREATE, ALTER, DROP)
 *   - 30-second query timeout with clear error message
 *
 * Available tables:
 *   - trades.trade_data: Trade records from all blocks (includes inferred ticker)
 *   - trades.reporting_data: Reporting/actual trade records from strategy logs
 *   - market.daily: Daily OHLCV + enriched indicators keyed by (ticker, date); VIX tickers stored here too
 *   - market.context: Global market conditions (VIX, regime) keyed by (date) — LEGACY, prefer market._context_derived
 *   - market._context_derived: Cross-ticker derived fields (Vol_Regime, Term_Structure_State, etc.) keyed by (date)
 *   - market.intraday: Intraday bars at any resolution keyed by (ticker, date, time)
 *   - market._sync_metadata: Import/enrichment tracking metadata
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DuckDBConnection } from "@duckdb/node-api";
import { getConnection, upgradeToReadWrite, downgradeToReadOnly } from "../db/connection.js";
import { withFullSync } from "./middleware/sync-middleware.js";
import { createToolOutput } from "../utils/output-formatter.js";

/**
 * Available tables for reference in error messages
 */
const AVAILABLE_TABLES = [
  "trades.trade_data",
  "trades.reporting_data",
  "market.daily",
  "market.context",         // Legacy — kept for backward compat
  "market._context_derived", // Phase 75: cross-ticker derived fields (Vol_Regime, Term_Structure_State, etc.)
  "market.intraday",
  "market._sync_metadata",
];

/**
 * Always-blocked SQL patterns — external access and config changes.
 */
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; operation: string }> = [
  // External access
  { pattern: /\bCOPY\b/i, operation: "COPY" },
  { pattern: /\bEXPORT\b/i, operation: "EXPORT" },
  { pattern: /\bATTACH\b/i, operation: "ATTACH" },
  { pattern: /\bDETACH\b/i, operation: "DETACH" },

  // File functions
  { pattern: /\bread_csv\s*\(/i, operation: "read_csv()" },
  { pattern: /\bread_parquet\s*\(/i, operation: "read_parquet()" },
  { pattern: /\bread_json\s*\(/i, operation: "read_json()" },
  { pattern: /\bread_text\s*\(/i, operation: "read_text()" },
  { pattern: /\bwrite_csv\s*\(/i, operation: "write_csv()" },

  // Configuration changes (standalone SET, not UPDATE ... SET)
  { pattern: /^\s*SET\b/i, operation: "SET" },
];

/**
 * Default and maximum query timeout in milliseconds
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Maximum rows that can be returned
 */
const MAX_ROWS = 1000;

/**
 * Mutating patterns that require confirm=true.
 * Without confirm, returns a preview of what would be affected.
 */
const CONFIRM_REQUIRED_PATTERNS: Array<{ pattern: RegExp; operation: string }> = [
  { pattern: /\bDELETE\b/i, operation: "DELETE" },
  { pattern: /\bUPDATE\b/i, operation: "UPDATE" },
  { pattern: /\bINSERT\b/i, operation: "INSERT" },
  { pattern: /\bTRUNCATE\b/i, operation: "TRUNCATE" },
  { pattern: /\bDROP\b/i, operation: "DROP" },
  { pattern: /\bCREATE\b/i, operation: "CREATE" },
  { pattern: /\bALTER\b/i, operation: "ALTER" },
];

/**
 * Validate SQL query for dangerous patterns.
 * Returns null if valid, or an error message if invalid.
 */
function validateQuery(sql: string): string | null {
  for (const { pattern, operation } of BLOCKED_PATTERNS) {
    if (pattern.test(sql)) {
      return `${operation} operations are not allowed.`;
    }
  }
  return null;
}

/**
 * Check if a query is destructive (DELETE/UPDATE) and needs confirmation.
 */
function isDestructiveQuery(sql: string): { destructive: boolean; operation: string } {
  for (const { pattern, operation } of CONFIRM_REQUIRED_PATTERNS) {
    if (pattern.test(sql)) {
      return { destructive: true, operation };
    }
  }
  return { destructive: false, operation: "" };
}

/**
 * Convert a DELETE/UPDATE statement to a SELECT COUNT(*) preview query.
 * DELETE FROM table WHERE ... → SELECT COUNT(*) as affected_rows FROM table WHERE ...
 * UPDATE table SET ... WHERE ... → SELECT COUNT(*) as affected_rows FROM table WHERE ...
 */
function toPreviewQuery(sql: string): string {
  const trimmed = sql.trim().replace(/;$/, "");

  // DELETE FROM table WHERE ...
  const deleteMatch = trimmed.match(/^\s*DELETE\s+FROM\s+(.+?)(?:\s+WHERE\s+(.+))?$/is);
  if (deleteMatch) {
    const table = deleteMatch[1].trim();
    const where = deleteMatch[2] ? ` WHERE ${deleteMatch[2]}` : "";
    return `SELECT COUNT(*) as affected_rows FROM ${table}${where}`;
  }

  // UPDATE table SET ... WHERE ...
  const updateMatch = trimmed.match(/^\s*UPDATE\s+(\S+)\s+.*?(?:WHERE\s+(.+))?$/is);
  if (updateMatch) {
    const table = updateMatch[1].trim();
    const where = updateMatch[2] ? ` WHERE ${updateMatch[2]}` : "";
    return `SELECT COUNT(*) as affected_rows FROM ${table}${where}`;
  }

  return `SELECT 'Could not generate preview' as warning`;
}

/**
 * Check if query already has a LIMIT clause
 */
function hasLimitClause(sql: string): boolean {
  // Match LIMIT at word boundary, not inside a string literal
  // This is a simple check - complex queries with LIMIT in subqueries
  // will still pass, which is fine (better to let DuckDB handle it)
  return /\bLIMIT\s+\d+/i.test(sql);
}

/**
 * Query result with column metadata
 */
interface QueryResult {
  rows: Record<string, unknown>[];
  columns: Array<{ name: string; type: string }>;
  totalRows: number;
}

/**
 * Execute a SQL query with timeout protection.
 *
 * @param conn - DuckDB connection
 * @param sql - SQL query to execute
 * @param limit - Maximum rows to return
 * @param timeoutMs - Timeout in milliseconds
 * @returns Query results with column metadata
 */
async function executeWithTimeout(
  conn: DuckDBConnection,
  sql: string,
  limit: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<QueryResult> {
  // Add LIMIT if not present
  let finalSql = sql.trim();
  if (finalSql.endsWith(";")) {
    finalSql = finalSql.slice(0, -1);
  }

  if (!hasLimitClause(finalSql)) {
    finalSql = `${finalSql} LIMIT ${limit}`;
  }

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          "Query exceeded 30s timeout. Consider adding LIMIT or filtering by block_id."
        )
      );
    }, timeoutMs);
  });

  // Execute query with timeout
  const queryPromise = (async (): Promise<QueryResult> => {
    const result = await conn.runAndReadAll(finalSql);

    // Extract column metadata
    const columnCount = result.columnCount;
    const columns: Array<{ name: string; type: string }> = [];

    for (let i = 0; i < columnCount; i++) {
      columns.push({
        name: result.columnName(i),
        type: result.columnType(i).toString(),
      });
    }

    // Convert rows to objects
    const rows: Record<string, unknown>[] = [];
    for (const row of result.getRows()) {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columnCount; i++) {
        const value = row[i];
        // Convert BigInt to Number for JSON serialization
        obj[columns[i].name] = typeof value === "bigint" ? Number(value) : value;
      }
      rows.push(obj);
    }

    return {
      rows,
      columns,
      totalRows: rows.length,
    };
  })();

  return Promise.race([queryPromise, timeoutPromise]);
}

/**
 * Enhance error messages with helpful suggestions.
 *
 * @param error - Original error
 * @returns Enhanced error message
 */
function enhanceError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // Table not found - suggest available tables
  if (
    message.toLowerCase().includes("table") &&
    (message.toLowerCase().includes("not found") ||
      message.toLowerCase().includes("does not exist") ||
      message.toLowerCase().includes("catalog error"))
  ) {
    return `${message}\n\nAvailable tables:\n${AVAILABLE_TABLES.map((t) => `  - ${t}`).join("\n")}`;
  }

  // Column not found - suggest DESCRIBE
  if (
    message.toLowerCase().includes("column") &&
    (message.toLowerCase().includes("not found") ||
      message.toLowerCase().includes("does not exist") ||
      message.toLowerCase().includes("binder error"))
  ) {
    return `${message}\n\nTip: Use DESCRIBE trades.trade_data; to see available columns.`;
  }

  // Timeout messages are already helpful
  if (message.includes("timeout")) {
    return message;
  }

  // Pass through other errors (syntax errors include line/column info from DuckDB)
  return message;
}

/**
 * Register SQL query tools with the MCP server.
 *
 * @param server - MCP server instance
 * @param baseDir - Base directory for data files
 */
export function registerSQLTools(server: McpServer, baseDir: string): void {
  server.registerTool(
    "run_sql",
    {
      description:
        "Execute a SQL query against the DuckDB analytics database. " +
        "SELECT runs freely. All mutating operations (DELETE, UPDATE, INSERT, CREATE, ALTER, DROP, TRUNCATE) " +
        "require confirm=true — without it, returns a preview or confirmation prompt. " +
        "Query trades (trades.trade_data, trades.reporting_data) and market data " +
        "(market.daily, market.context, market._context_derived, market.intraday, market._sync_metadata). " +
        "Trade queries should filter by block_id (e.g. WHERE block_id = 'my-strategy'). " +
        "Call describe_database first to discover available block_ids and column names. " +
        "Returns up to 1000 rows for SELECT queries.",
      inputSchema: z.object({
        query: z.string().describe("SQL query to execute"),
        limit: z
          .number()
          .min(1)
          .max(MAX_ROWS)
          .default(100)
          .describe(`Maximum rows to return (default: 100, max: ${MAX_ROWS})`),
        confirm: z
          .boolean()
          .default(false)
          .describe("Required for all mutating operations (DELETE, UPDATE, INSERT, CREATE, ALTER, DROP, TRUNCATE). Without it, returns a preview or prompt."),
      }),
    },
    withFullSync(baseDir, async ({ query, limit, confirm }) => {
      // Validate query for dangerous patterns
      const validationError = validateQuery(query);
      if (validationError) {
        return {
          content: [{ type: "text" as const, text: validationError }],
          isError: true as const,
        };
      }

      // Check if mutating — require confirm
      const { destructive, operation } = isDestructiveQuery(query);
      if (destructive && !confirm) {
        // For DELETE/UPDATE, try to preview affected row count
        if (operation === "DELETE" || operation === "UPDATE") {
          try {
            const conn = await getConnection(baseDir);
            const previewSql = toPreviewQuery(query);
            const result = await executeWithTimeout(conn, previewSql, 1);
            const count = result.rows[0]?.affected_rows ?? "unknown";
            return createToolOutput(
              `⚠️ ${operation} would affect ${count} row(s). Re-run with confirm=true to execute.`,
              { operation, affectedRows: count, query, preview: true },
            );
          } catch (error) {
            return createToolOutput(
              `⚠️ ${operation} requires confirm=true. Could not preview: ${error instanceof Error ? error.message : String(error)}`,
              { operation, query, preview: true },
            );
          }
        }
        // For other mutating ops (INSERT, CREATE, ALTER, DROP, TRUNCATE) — no preview, just gate
        return createToolOutput(
          `⚠️ ${operation} requires confirm=true to execute.`,
          { operation, query, preview: true },
        );
      }

      try {
        // Get DuckDB connection
        const conn = await getConnection(baseDir);

        if (destructive && confirm) {
          // Upgrade to read-write for mutations
          await upgradeToReadWrite(baseDir);
          try {
            const rwConn = await getConnection(baseDir);
            const result = await rwConn.run(query);
            const changed = Number(result.rowsChanged);
            return createToolOutput(
              `${operation} completed: ${changed} row(s) affected.`,
              { operation, rowsAffected: changed },
            );
          } finally {
            await downgradeToReadOnly();
          }
        }

        // Execute SELECT query with timeout
        const result = await executeWithTimeout(conn, query, limit);

        // Determine if results were truncated
        const returnedRows = result.rows.length;
        const truncated = returnedRows >= limit;

        // Create summary
        const summary = `Query returned ${returnedRows} row(s)${truncated ? ` (limited to ${limit})` : ""}`;

        // Return structured output
        return createToolOutput(summary, {
          rows: result.rows,
          columns: result.columns,
          totalRows: result.totalRows,
          returnedRows,
          truncated,
        });
      } catch (error) {
        const enhancedMessage = enhanceError(error);
        return {
          content: [{ type: "text" as const, text: enhancedMessage }],
          isError: true as const,
        };
      }
    })
  );
}
