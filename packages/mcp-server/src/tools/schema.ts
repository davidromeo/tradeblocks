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
  DAILY_OPEN_FIELDS,
  DAILY_STATIC_FIELDS,
  CONTEXT_OPEN_FIELDS,
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
  };
}

// ============================================================================
// Constants
// ============================================================================

// (MARKET_TABLE_FILE_PATTERNS removed — purge_market_table now uses target_table column directly)

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
  // Qualify daily-sourced fields with d., context-sourced with c.
  const dailyOpenCols = [...DAILY_OPEN_FIELDS].map(f => `    d.${f}`).join(',\n');
  const contextOpenCols = [...CONTEXT_OPEN_FIELDS].map(f => `    c.${f}`).join(',\n');
  const staticCols = [...DAILY_STATIC_FIELDS].map(f => `    d.${f}`).join(',\n');

  const sql = `-- Lookahead-free CTE template for market.daily + market.context (dual-table JOIN)
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
joined AS (
  -- Scan full ticker history so LAG sees correct prior trading day
  SELECT d.ticker, d.date,
    -- Open-known fields from daily (safe same-day)
${dailyOpenCols},
    -- Open-known fields from context (safe same-day)
${contextOpenCols},
    -- Static fields (safe same-day)
${staticCols},
    -- Close-derived fields from both tables (will be LAGged below)
    d.high, d.low, d.close, d.RSI_14, d.ATR_Pct, d.BB_Position, d.BB_Width,
    d.Realized_Vol_5D, d.Realized_Vol_20D, d.Return_5D, d.Return_20D,
    d.Intraday_Range_Pct, d.Intraday_Return_Pct, d.Close_Position_In_Range,
    d.Gap_Filled, d.Consecutive_Days,
    c.VIX_Close, c.VIX_High, c.VIX_Low, c.VIX_Change_Pct,
    c.VIX9D_Close, c.VIX3M_Close, c.Vol_Regime, c.Term_Structure_State,
    c.VIX_Percentile, c.VIX_Spike_Pct
  FROM market.daily d
  LEFT JOIN market.context c ON d.date = c.date
  WHERE d.ticker IN (SELECT ticker FROM requested)
),
lagged AS (
  SELECT *,
    -- Close-derived fields (prior trading day via LAG)
    LAG(high) OVER (PARTITION BY ticker ORDER BY date) AS prev_high,
    LAG(RSI_14) OVER (PARTITION BY ticker ORDER BY date) AS prev_RSI_14,
    LAG(BB_Width) OVER (PARTITION BY ticker ORDER BY date) AS prev_BB_Width,
    LAG(Realized_Vol_20D) OVER (PARTITION BY ticker ORDER BY date) AS prev_Realized_Vol_20D,
    LAG(VIX_Close) OVER (PARTITION BY ticker ORDER BY date) AS prev_VIX_Close,
    LAG(Vol_Regime) OVER (PARTITION BY ticker ORDER BY date) AS prev_Vol_Regime,
    LAG(Term_Structure_State) OVER (PARTITION BY ticker ORDER BY date) AS prev_Term_Structure_State
  FROM joined
)
SELECT t.*, m.*
FROM trades.trade_data t
JOIN lagged m
  ON COALESCE(NULLIF(t.ticker, ''), 'SPX') = m.ticker
 AND CAST(t.date_opened AS VARCHAR) = m.date
WHERE t.block_id = 'my-block'`;

  return {
    description:
      'Reusable LAG() CTE for lookahead-free queries joining trades to market.daily + market.context. ' +
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
    withFullSync(baseDir, async (_, { blockSyncResult }) => {
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
        "After purging, re-import with import_market_csv and re-run enrich_market_data. " +
        "Valid tables: daily, context, intraday",
      inputSchema: z.object({
        table: z
          .enum(["daily", "context", "intraday"])
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

        // Get current row count before deletion
        const countResult = await conn.runAndReadAll(
          `SELECT COUNT(*) FROM ${fullTableName}`
        );
        const rowsBefore = Number(countResult.getRows()[0][0]);

        // Delete table data and sync metadata atomically
        try {
          await conn.run(`BEGIN TRANSACTION`);
          await conn.run(`DELETE FROM ${fullTableName}`);
          await conn.run(
            `DELETE FROM market._sync_metadata WHERE target_table = '${table}'`
          );
          await conn.run(`COMMIT`);
        } catch (e) {
          await conn.run(`ROLLBACK`).catch(() => {});
          throw e;
        }

        const result = {
          table: fullTableName,
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
