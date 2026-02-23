/**
 * Market Import Tools
 *
 * MCP tools for importing OHLCV market data into market.daily, market.context,
 * or market.intraday. Delegates all core logic to market-importer.ts.
 *
 * Tools registered:
 *   - import_market_csv    — Import from a local CSV file
 *   - import_from_database — Import from an external DuckDB database
 *
 * Both tools follow the RW lifecycle:
 *   upgradeToReadWrite → core import logic → downgradeToReadOnly (in finally)
 */

import { z } from "zod";
import * as path from "path";
import * as os from "os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConnection, upgradeToReadWrite, downgradeToReadOnly } from "../db/connection.js";
import { createToolOutput } from "../utils/output-formatter.js";
import { importMarketCsvFile, importFromDatabase } from "../utils/market-importer.js";

/**
 * Register market import MCP tools on the given server.
 *
 * @param server  - McpServer instance to register tools on
 * @param baseDir - Base data directory (passed to connection helpers)
 */
export function registerMarketImportTools(server: McpServer, baseDir: string): void {
  // ---------------------------------------------------------------------------
  // Tool: import_market_csv
  // ---------------------------------------------------------------------------
  server.registerTool(
    "import_market_csv",
    {
      description:
        "Import OHLCV market data from a CSV file into market.daily, market.context, or market.intraday. " +
        "Requires an explicit column_mapping object mapping CSV header names to schema column names. " +
        "Required schema fields: daily=[date,open,high,low,close], context=[date], intraday=[date,time,open,high,low,close]. " +
        "ticker is injected automatically (not required in mapping). " +
        "For intraday imports from TradingView CSVs: the 'time' column is a Unix timestamp encoding both date and time. " +
        "Map it to 'date' and the HH:MM ET time will be auto-extracted automatically — no separate time mapping needed. " +
        "Example intraday mapping: { \"time\": \"date\", \"open\": \"open\", \"high\": \"high\", \"low\": \"low\", \"close\": \"close\" }. " +
        "Supports dry_run=true to validate without writing. " +
        "Use ~ for home directory in file_path.",
      inputSchema: z.object({
        file_path: z
          .string()
          .describe("Absolute path to the CSV file. May use ~ for home directory."),
        ticker: z
          .string()
          .describe("Ticker symbol to assign to imported rows (e.g., 'SPX', 'QQQ'). Normalized to uppercase."),
        target_table: z
          .enum(["daily", "context", "intraday"])
          .describe("Target market table: daily (OHLCV), context (VIX/regime), or intraday (bar data)."),
        column_mapping: z
          .record(z.string(), z.string())
          .describe(
            "Maps CSV column names (keys) to schema column names (values). " +
            "Example: { \"time\": \"date\", \"open\": \"open\", \"high\": \"high\", \"low\": \"low\", \"close\": \"close\" }"
          ),
        dry_run: z
          .boolean()
          .default(false)
          .describe("If true, validates and previews import without writing any data."),
        skip_enrichment: z
          .boolean()
          .default(false)
          .describe("If true, skips automatic enrichment after import. Re-run enrich_market_data later to compute derived fields."),
      }),
    },
    async ({ file_path, ticker, target_table, column_mapping, dry_run, skip_enrichment }) => {
      // Expand ~ to home directory, then resolve to absolute path
      let resolvedPath = file_path;
      if (resolvedPath.startsWith("~")) {
        resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
      }
      resolvedPath = path.resolve(resolvedPath);

      await upgradeToReadWrite(baseDir);
      try {
        const conn = await getConnection(baseDir);

        const result = await importMarketCsvFile(conn, {
          filePath: resolvedPath,
          ticker,
          targetTable: target_table,
          columnMapping: column_mapping,
          dryRun: dry_run,
          skipEnrichment: skip_enrichment,
        });

        const summary = dry_run
          ? `[DRY RUN] Would import ${result.inputRowCount} rows into market.${target_table} (${ticker.toUpperCase()}) — no data written`
          : `Imported ${result.rowsInserted} of ${result.inputRowCount} rows into market.${target_table} (${ticker.toUpperCase()}); ${result.rowsSkipped} skipped (already exist)`;

        return createToolOutput(summary, {
          ticker: ticker.toUpperCase(),
          targetTable: target_table,
          inputRowCount: result.inputRowCount,
          rowsInserted: result.rowsInserted,
          rowsSkipped: result.rowsSkipped,
          dateRange: result.dateRange,
          enrichment: result.enrichment,
          dryRun: dry_run,
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error importing market CSV: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      } finally {
        await downgradeToReadOnly(baseDir);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Tool: import_from_database
  // ---------------------------------------------------------------------------
  server.registerTool(
    "import_from_database",
    {
      description:
        "Import market data from an external DuckDB database into market.daily, market.context, or market.intraday. " +
        "The external database is ATTACHed read-only with alias 'ext_import_source'. " +
        "Your query must reference tables using this alias, e.g.: SELECT date, open, high, low, close FROM ext_import_source.my_table. " +
        "Supports JOINs and CTEs. " +
        "Requires an explicit column_mapping object mapping query column names to schema column names. " +
        "Required schema fields: daily=[date,open,high,low,close], context=[date], intraday=[date,time,open,high,low,close]. " +
        "ticker is injected automatically. " +
        "For intraday imports: if the source has a single Unix timestamp column, map it to 'date' and HH:MM ET time will be auto-extracted. " +
        "Supports dry_run=true to validate without writing.",
      inputSchema: z.object({
        db_path: z
          .string()
          .describe("Absolute path to the external DuckDB file. May use ~ for home directory."),
        query: z
          .string()
          .describe(
            "DuckDB SELECT query to execute against the external database. " +
            "Must reference tables with the alias 'ext_import_source', e.g.: SELECT date, open, high FROM ext_import_source.spx_data"
          ),
        ticker: z
          .string()
          .describe("Ticker symbol to assign to imported rows (e.g., 'SPX', 'QQQ'). Normalized to uppercase."),
        target_table: z
          .enum(["daily", "context", "intraday"])
          .describe("Target market table."),
        column_mapping: z
          .record(z.string(), z.string())
          .describe(
            "Maps query column names (keys) to schema column names (values). " +
            "Example: { \"date\": \"date\", \"spx_open\": \"open\", \"spx_high\": \"high\", \"spx_low\": \"low\", \"spx_close\": \"close\" }"
          ),
        dry_run: z
          .boolean()
          .default(false)
          .describe("If true, validates and previews import without writing any data."),
        skip_enrichment: z
          .boolean()
          .default(false)
          .describe("If true, skips automatic enrichment after import."),
      }),
    },
    async ({ db_path, query, ticker, target_table, column_mapping, dry_run, skip_enrichment }) => {
      // Expand ~ to home directory, then resolve to absolute path
      let resolvedDbPath = db_path;
      if (resolvedDbPath.startsWith("~")) {
        resolvedDbPath = path.join(os.homedir(), resolvedDbPath.slice(1));
      }
      resolvedDbPath = path.resolve(resolvedDbPath);

      await upgradeToReadWrite(baseDir);
      try {
        const conn = await getConnection(baseDir);

        const result = await importFromDatabase(conn, {
          dbPath: resolvedDbPath,
          query,
          ticker,
          targetTable: target_table,
          columnMapping: column_mapping,
          dryRun: dry_run,
          skipEnrichment: skip_enrichment,
        });

        const summary = dry_run
          ? `[DRY RUN] Would import ${result.inputRowCount} rows into market.${target_table} (${ticker.toUpperCase()}) — no data written`
          : `Imported ${result.rowsInserted} of ${result.inputRowCount} rows into market.${target_table} (${ticker.toUpperCase()}); ${result.rowsSkipped} skipped (already exist)`;

        return createToolOutput(summary, {
          ticker: ticker.toUpperCase(),
          targetTable: target_table,
          inputRowCount: result.inputRowCount,
          rowsInserted: result.rowsInserted,
          rowsSkipped: result.rowsSkipped,
          dateRange: result.dateRange,
          enrichment: result.enrichment,
          dryRun: dry_run,
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error importing from database: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      } finally {
        await downgradeToReadOnly(baseDir);
      }
    }
  );
}
