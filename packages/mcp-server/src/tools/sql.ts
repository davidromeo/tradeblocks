/**
 * SQL Query Tool
 *
 * Provides direct SQL query access to the DuckDB analytics database.
 * Enables ad-hoc analysis, hypothesis testing, and data exploration
 * across trades and market data.
 *
 * Security:
 *   - Only SELECT queries allowed (validated via pattern blocklist)
 *   - No file access functions (read_csv, write_csv, etc.)
 *   - No schema modifications (CREATE, ALTER, DROP)
 *   - 30-second query timeout with clear error message
 *
 * Available tables:
 *   - trades.trade_data: Trade records from all blocks (includes inferred ticker)
 *   - market.spx_daily: Daily market context keyed by (ticker, date)
 *   - market.spx_15min: 15-minute intraday checkpoints keyed by (ticker, date)
 *   - market.vix_intraday: VIX intraday data keyed by (ticker, date)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DuckDBConnection } from "@duckdb/node-api";
import { getConnection } from "../db/connection.js";
import { withFullSync } from "./middleware/sync-middleware.js";
import { createToolOutput } from "../utils/output-formatter.js";

/**
 * Available tables for reference in error messages
 */
const AVAILABLE_TABLES = [
  "trades.trade_data",
  "market.spx_daily",
  "market.spx_15min",
  "market.vix_intraday",
];

/**
 * Dangerous SQL patterns that are blocked.
 * Each pattern includes the operation name for error messages.
 */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; operation: string }> = [
  // Write operations
  { pattern: /\bINSERT\b/i, operation: "INSERT" },
  { pattern: /\bUPDATE\b/i, operation: "UPDATE" },
  { pattern: /\bDELETE\b/i, operation: "DELETE" },
  { pattern: /\bTRUNCATE\b/i, operation: "TRUNCATE" },

  // Schema modifications
  { pattern: /\bDROP\b/i, operation: "DROP" },
  { pattern: /\bCREATE\b/i, operation: "CREATE" },
  { pattern: /\bALTER\b/i, operation: "ALTER" },

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

  // Configuration changes
  { pattern: /\bSET\b/i, operation: "SET" },
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
 * Validate SQL query for dangerous patterns.
 * Returns null if valid, or an error message if invalid.
 */
function validateQuery(sql: string): string | null {
  for (const { pattern, operation } of DANGEROUS_PATTERNS) {
    if (pattern.test(sql)) {
      return `${operation} operations are not allowed. This tool only supports SELECT queries for read-only data analysis.`;
    }
  }
  return null;
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
        "Execute a SQL SELECT query against the DuckDB analytics database. " +
        "Query trades (trades.trade_data) and market data (market.spx_daily, " +
        "market.spx_15min, market.vix_intraday). " +
        "Returns up to 1000 rows.",
      inputSchema: z.object({
        query: z.string().describe("SQL SELECT query to execute"),
        limit: z
          .number()
          .min(1)
          .max(MAX_ROWS)
          .default(100)
          .describe(`Maximum rows to return (default: 100, max: ${MAX_ROWS})`),
      }),
    },
    withFullSync(baseDir, async ({ query, limit }) => {
      // Validate query for dangerous patterns
      const validationError = validateQuery(query);
      if (validationError) {
        return {
          content: [{ type: "text" as const, text: validationError }],
          isError: true as const,
        };
      }

      try {
        // Get DuckDB connection
        const conn = await getConnection(baseDir);

        // Execute query with timeout
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
