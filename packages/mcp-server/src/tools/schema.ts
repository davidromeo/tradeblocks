/**
 * Schema Discovery Tools
 *
 * Provides MCP tools for discovering the DuckDB database schema.
 * Claude should call describe_database BEFORE using run_sql to understand
 * what tables and columns are available for analysis.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConnection } from "../db/connection.js";
import { withFullSync } from "./middleware/sync-middleware.js";
import { createToolOutput } from "../utils/output-formatter.js";
import {
  SCHEMA_DESCRIPTIONS,
  EXAMPLE_QUERIES,
  type ColumnDescription,
} from "../utils/schema-metadata.js";

// ============================================================================
// Types for output structure
// ============================================================================

interface ColumnInfo {
  name: string;
  type: string;
  description: string;
  nullable: boolean;
  hypothesis: boolean;
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
  syncInfo: {
    blocksProcessed: number;
    marketFilesSynced: number;
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
}
