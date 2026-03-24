/**
 * Market Import Tools
 *
 * MCP tools for importing OHLCV market data into market.daily or market.intraday.
 * Delegates all core logic to market-importer.ts.
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
import { importMarketCsvFile, importFromDatabase, importFromMassive } from "../utils/market-importer.js";

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
        "Import OHLCV market data from a CSV file into market.daily or market.intraday (target_table: 'context' imports VIX/VIX9D/VIX3M into market.daily). " +
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
          : `Imported ${result.rowsInserted} of ${result.inputRowCount} rows into market.${target_table} (${ticker.toUpperCase()})${result.rowsUpdated ? `; ${result.rowsUpdated} merged into existing rows` : ""}${result.rowsSkipped ? `; ${result.rowsSkipped} skipped` : ""}`;

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
        "Import market data from an external DuckDB database into market.daily or market.intraday (target_table: 'context' imports VIX/VIX9D/VIX3M into market.daily). " +
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
          : `Imported ${result.rowsInserted} of ${result.inputRowCount} rows into market.${target_table} (${ticker.toUpperCase()})${result.rowsUpdated ? `; ${result.rowsUpdated} merged into existing rows` : ""}${result.rowsSkipped ? `; ${result.rowsSkipped} skipped` : ""}`;

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

  // ---------------------------------------------------------------------------
  // Tool: import_from_massive
  // ---------------------------------------------------------------------------
  server.registerTool(
    "import_from_massive",
    {
      description:
        "Import market data from Massive.com API into market.daily or market.intraday. " +
        "Requires MASSIVE_API_KEY environment variable. " +
        "For daily: fetches OHLCV bars for any stock/index ticker. " +
        "For context: imports VIX + VIX9D + VIX3M as ticker rows in market.daily (convenience shorthand), then runs enrichment to populate market._context_derived. " +
        "For intraday: fetches minute or hour bars (use timespan param). " +
        "Supports OCC option tickers (e.g., SPX251219C05000000). " +
        "Upserts on conflict — safe to re-import overlapping date ranges.",
      inputSchema: z.object({
        ticker: z.string().describe(
          "Ticker symbol (e.g., 'SPX', 'AAPL', 'VIX'). For context imports, this is ignored (VIX/VIX9D/VIX3M fetched automatically). For options, use OCC format (e.g., 'SPX251219C05000000')."
        ),
        from: z.string().describe("Start date YYYY-MM-DD"),
        to: z.string().describe("End date YYYY-MM-DD"),
        target_table: z.enum(["daily", "context", "intraday"]).describe(
          "Target table: 'daily' for OHLCV, 'context' for VIX term structure (auto-fetches VIX+VIX9D+VIX3M), 'intraday' for minute/hour bars."
        ),
        timespan: z.enum(["1m", "5m", "15m", "1h"]).optional().describe(
          "Bar timespan for intraday imports. Maps to Massive API: '1m'→1 minute, '5m'→5 minute, '15m'→15 minute, '1h'→1 hour. Ignored for daily/context."
        ),
        asset_class: z.enum(["stock", "index", "option"]).optional().describe(
          "Asset class for ticker prefix. Auto-detected if omitted: VIX/SPX/NDX→index, OCC format→option, else stock."
        ),
        dry_run: z.boolean().default(false).describe(
          "If true, validates parameters and shows what would be imported without writing."
        ),
        skip_enrichment: z.boolean().default(false).describe(
          "If true, skips automatic enrichment after import."
        ),
      }),
    },
    async ({ ticker, from, to, target_table, timespan, asset_class, dry_run, skip_enrichment }) => {
      // Parse timespan string to { timespan, multiplier } for Massive API
      let parsedTimespan: "minute" | "hour" | undefined;
      let parsedMultiplier: number | undefined;
      if (timespan) {
        if (timespan === "1m") {
          parsedTimespan = "minute";
          parsedMultiplier = 1;
        } else if (timespan === "5m") {
          parsedTimespan = "minute";
          parsedMultiplier = 5;
        } else if (timespan === "15m") {
          parsedTimespan = "minute";
          parsedMultiplier = 15;
        } else if (timespan === "1h") {
          parsedTimespan = "hour";
          parsedMultiplier = 1;
        }
      }

      await upgradeToReadWrite(baseDir);
      try {
        const conn = await getConnection(baseDir);

        const result = await importFromMassive(conn, {
          ticker: ticker.toUpperCase(),
          from,
          to,
          targetTable: target_table,
          timespan: parsedTimespan,
          multiplier: parsedMultiplier,
          assetClass: asset_class,
          dryRun: dry_run,
          skipEnrichment: skip_enrichment,
        });

        const tickerDisplay = target_table === "context" ? "VIX/VIX9D/VIX3M" : ticker.toUpperCase();
        const summary = dry_run
          ? `[DRY RUN] Would import ${result.inputRowCount} rows into market.${target_table} (${tickerDisplay}) — no data written`
          : `Imported ${result.rowsInserted} of ${result.inputRowCount} rows into market.${target_table} (${tickerDisplay})${result.rowsUpdated ? `; ${result.rowsUpdated} merged into existing rows` : ""}${result.rowsSkipped ? `; ${result.rowsSkipped} skipped` : ""}`;

        return createToolOutput(summary, {
          ticker: tickerDisplay,
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
              text: `Error importing from Massive.com: ${(error as Error).message}`,
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
