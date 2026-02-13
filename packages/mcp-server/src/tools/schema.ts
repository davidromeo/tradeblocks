/**
 * Schema Discovery Tools
 *
 * Provides MCP tools for discovering the DuckDB database schema.
 * Claude should call describe_database BEFORE using run_sql to understand
 * what tables and columns are available for analysis.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConnection, upgradeToReadWrite, downgradeToReadOnly, getConnectionMode } from "../db/connection.js";
import { withFullSync } from "./middleware/sync-middleware.js";
import { createToolOutput } from "../utils/output-formatter.js";
import {
  SCHEMA_DESCRIPTIONS,
  EXAMPLE_QUERIES,
  type ColumnDescription,
} from "../utils/schema-metadata.js";
import {
  OPEN_KNOWN_FIELDS,
  CLOSE_KNOWN_FIELDS,
  STATIC_FIELDS,
} from "../utils/field-timing.js";

// ============================================================================
// Types for output structure
// ============================================================================

interface ColumnInfo {
  name: string;
  type: string;
  description: string;
  nullable: boolean;
  hypothesis: boolean;
  timing?: 'open' | 'close' | 'static';
}

interface BlockBreakdown {
  blockId: string;
  rowCount: number;
}

interface TableInfo {
  description: string;
  keyColumns: string[];
  rowCount: number;
  blockBreakdown?: BlockBreakdown[];
  columns: ColumnInfo[];
}

interface SchemaInfo {
  description: string;
  tables: Record<string, TableInfo>;
}

interface DatabaseSchemaOutput {
  schemas: Record<string, SchemaInfo>;
  examples: typeof EXAMPLE_QUERIES;
  lagTemplate: {
    description: string;
    sql: string;
    fieldCounts: {
      openKnown: number;
      static: number;
      closeDerived: number;
    };
  };
  syncInfo: {
    blocksProcessed: number;
    marketFilesSynced: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid market tables and their corresponding CSV file names.
 * Used for purge_market_table validation.
 */
const MARKET_TABLE_FILE_PATTERNS: Record<string, string[]> = {
  spx_daily: ["%_daily.csv"],
  spx_15min: ["%_15min.csv"],
  vix_intraday: ["%_vix_intraday.csv", "vix_intraday.csv"],
};

// ============================================================================
// LAG Template Generator
// ============================================================================

/**
 * Generate a reusable LAG() CTE template for lookahead-free queries.
 * Dynamically built from OPEN_KNOWN_FIELDS, CLOSE_KNOWN_FIELDS, STATIC_FIELDS
 * so it stays in sync with field-timing classifications automatically.
 */
function generateLagTemplate(): {
  description: string;
  sql: string;
  fieldCounts: { openKnown: number; static: number; closeDerived: number };
} {
  const openCols = [...OPEN_KNOWN_FIELDS].map(f => `    ${f}`).join(',\n');
  const staticCols = [...STATIC_FIELDS].map(f => `    ${f}`).join(',\n');
  const lagCols = [...CLOSE_KNOWN_FIELDS]
    .map(f => `    LAG(${f}) OVER (PARTITION BY ticker ORDER BY date) AS prev_${f}`)
    .join(',\n');

  const sql = `-- Lookahead-free CTE template for market.spx_daily
-- Open-known fields: safe to use same-day (known at/before market open)
-- Static fields: safe to use same-day (calendar facts)
-- Close-derived fields: use LAG() for prior trading day values
--
-- Copy this CTE into your query, then JOIN on (ticker, date)
WITH requested AS (
  SELECT DISTINCT
    COALESCE(NULLIF(ticker, ''), 'SPX') AS ticker,
    CAST(date_opened AS VARCHAR) AS date
  FROM trades.trade_data
  WHERE block_id = 'my-block'
),
WITH lagged AS (
  SELECT ticker, date,
    -- Open-known fields (safe same-day)
${openCols},
    -- Static fields (safe same-day)
${staticCols},
    -- Close-derived fields (prior trading day via LAG)
${lagCols}
  FROM market.spx_daily
  WHERE ticker IN (SELECT ticker FROM requested)
)
SELECT t.*, m.*
FROM trades.trade_data t
JOIN lagged m
  ON COALESCE(NULLIF(t.ticker, ''), 'SPX') = m.ticker
 AND CAST(t.date_opened AS VARCHAR) = m.date
WHERE t.block_id = 'my-block'`;

  return {
    description:
      'Reusable LAG() CTE for lookahead-free queries joining trades to spx_daily by ticker+date. ' +
      'Close-derived fields (VIX_Close, Vol_Regime, RSI_14, etc.) use LAG() to get the prior trading day value, ' +
      'preventing lookahead bias. Open-known and static fields are safe to use same-day.',
    sql,
    fieldCounts: {
      openKnown: OPEN_KNOWN_FIELDS.size,
      static: STATIC_FIELDS.size,
      closeDerived: CLOSE_KNOWN_FIELDS.size,
    },
  };
}

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Register schema discovery tools with the MCP server.
 *
 * @param server - MCP server instance
 * @param baseDir - Base directory for data files
 */
export function registerSchemaTools(server: McpServer, baseDir: string): void {
  server.registerTool(
    "describe_database",
    {
      description:
        "Get complete database schema: all tables, columns, types, row counts, and example queries. " +
        "Call this BEFORE using run_sql to understand available data and query patterns. " +
        "Returns schema organized by namespace (trades.*, market.*), with descriptions, " +
        "row counts, block breakdowns for trades, and example SQL queries.",
      inputSchema: z.object({}),
    },
    withFullSync(baseDir, async (_, { blockSyncResult, marketSyncResult }) => {
      const conn = await getConnection(baseDir);

      // Get all user tables in trades/market schemas (excluding sync metadata)
      const tablesResult = await conn.runAndReadAll(`
        SELECT schema_name, table_name, column_count
        FROM duckdb_tables()
        WHERE internal = false
          AND schema_name IN ('trades', 'market')
          AND table_name NOT LIKE '%_sync_metadata'
        ORDER BY schema_name, table_name
      `);

      const tables = tablesResult.getRows() as Array<[string, string, number]>;

      // Build schema output structure
      const schemas: Record<string, SchemaInfo> = {};
      let totalRows = 0;

      for (const [schemaName, tableName] of tables) {
        // Initialize schema if first table in it
        if (!schemas[schemaName]) {
          const schemaDesc = SCHEMA_DESCRIPTIONS[schemaName as keyof typeof SCHEMA_DESCRIPTIONS];
          schemas[schemaName] = {
            description: schemaDesc?.description || `${schemaName} schema`,
            tables: {},
          };
        }

        // Get columns from DuckDB introspection
        const columnsResult = await conn.runAndReadAll(`
          SELECT column_name, data_type, is_nullable
          FROM duckdb_columns()
          WHERE schema_name = '${schemaName}' AND table_name = '${tableName}'
          ORDER BY column_index
        `);

        const columnsData = columnsResult.getRows() as Array<[string, string, boolean]>;

        // Get row count
        const countResult = await conn.runAndReadAll(
          `SELECT COUNT(*) FROM ${schemaName}.${tableName}`
        );
        const rowCount = Number(countResult.getRows()[0][0]);
        totalRows += rowCount;

        // Get hardcoded descriptions for this table
        const schemaDesc = SCHEMA_DESCRIPTIONS[schemaName as keyof typeof SCHEMA_DESCRIPTIONS];
        const tableDesc = schemaDesc?.tables?.[tableName];

        // Build column info with merged descriptions
        const columns: ColumnInfo[] = columnsData.map(
          ([columnName, dataType, isNullable]) => {
            const colDesc: ColumnDescription | undefined =
              tableDesc?.columns?.[columnName];
            return {
              name: columnName,
              type: dataType,
              description: colDesc?.description || "",
              nullable: isNullable,
              hypothesis: colDesc?.hypothesis || false,
              timing: colDesc?.timing,
            };
          }
        );

        // Build table info
        const tableInfo: TableInfo = {
          description: tableDesc?.description || `${tableName} table`,
          keyColumns: tableDesc?.keyColumns || [],
          rowCount,
          columns,
        };

        // For trades.trade_data, add block breakdown
        if (schemaName === "trades" && tableName === "trade_data" && rowCount > 0) {
          const blockResult = await conn.runAndReadAll(`
            SELECT block_id, COUNT(*) as row_count
            FROM trades.trade_data
            GROUP BY block_id
            ORDER BY block_id
          `);
          const blockRows = blockResult.getRows() as Array<[string, bigint]>;
          tableInfo.blockBreakdown = blockRows.map(([blockId, count]) => ({
            blockId,
            rowCount: Number(count),
          }));
        }

        schemas[schemaName].tables[tableName] = tableInfo;
      }

      // Build output
      const result: DatabaseSchemaOutput = {
        schemas,
        examples: EXAMPLE_QUERIES,
        lagTemplate: generateLagTemplate(),
        syncInfo: {
          blocksProcessed: blockSyncResult.blocksProcessed,
          marketFilesSynced: marketSyncResult.filesSynced,
        },
      };

      const tableCount = tables.length;
      const schemaCount = Object.keys(schemas).length;
      const summary = `Database schema: ${tableCount} tables across ${schemaCount} schemas. ${totalRows} total rows.`;

      return createToolOutput(summary, result);
    })
  );

  // --------------------------------------------------------------------------
  // purge_market_table - Delete all data from a market table for re-sync
  // --------------------------------------------------------------------------
  server.registerTool(
    "purge_market_table",
    {
      description:
        "Delete all data from a market table and clear its sync metadata. " +
        "Use when market data is corrupted and needs to be re-imported from CSV. " +
        "After purging, the next query will trigger a fresh sync from the CSV file. " +
        "Valid tables: spx_daily, spx_15min, vix_intraday",
      inputSchema: z.object({
        table: z
          .enum(["spx_daily", "spx_15min", "vix_intraday"])
          .describe("Market table to purge (without 'market.' prefix)"),
      }),
    },
    async ({ table }) => {
      const conn = await upgradeToReadWrite(baseDir);
      if (getConnectionMode() !== "read_write") {
        throw new Error(
          "Cannot purge market table: another session holds the database write lock. " +
          "Close other Claude Code sessions or wait for their sync to complete."
        );
      }
      try {
        const fullTableName = `market.${table}`;
        const filePatterns = MARKET_TABLE_FILE_PATTERNS[table];

        // Get current row count before deletion
        const countResult = await conn.runAndReadAll(
          `SELECT COUNT(*) FROM ${fullTableName}`
        );
        const rowsBefore = Number(countResult.getRows()[0][0]);

        // Delete table data and sync metadata atomically
        try {
          await conn.run(`BEGIN TRANSACTION`);
          await conn.run(`DELETE FROM ${fullTableName}`);
          const whereClause = filePatterns
            .map((_, idx) => `LOWER(file_name) LIKE $${idx + 1}`)
            .join(" OR ");
          await conn.run(
            `DELETE FROM market._sync_metadata WHERE ${whereClause}`,
            filePatterns.map((p) => p.toLowerCase())
          );
          await conn.run(`COMMIT`);
        } catch (e) {
          await conn.run(`ROLLBACK`).catch(() => {});
          throw e;
        }

        const result = {
          table: fullTableName,
          filePatterns,
          rowsDeleted: rowsBefore,
          syncMetadataCleared: true,
          nextStep: "Next query will trigger fresh import from CSV",
        };

        return createToolOutput(
          `Purged ${rowsBefore} rows from ${fullTableName}. Sync metadata cleared for matching market files.`,
          result
        );
      } finally {
        await downgradeToReadOnly(baseDir);
      }
    }
  );
}
