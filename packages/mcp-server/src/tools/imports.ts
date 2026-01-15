/**
 * Import Tools
 *
 * MCP tools for importing CSV files into the blocks directory.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { importCsv } from "../utils/block-loader.js";
import { createToolOutput } from "../utils/output-formatter.js";

/**
 * Register import-related MCP tools
 */
export function registerImportTools(server: McpServer, baseDir: string): void {
  // Tool: import_csv
  server.registerTool(
    "import_csv",
    {
      description:
        "Import a CSV file into the blocks directory. Creates a new block from CSV data. " +
        "Use csvContent when working in sandboxed environments (Claude.ai, Cowork) where file paths are not accessible. " +
        "Use csvPath when running locally (Claude Desktop, Claude Code) with direct filesystem access.",
      inputSchema: z.object({
        csvPath: z
          .string()
          .optional()
          .describe(
            "Absolute path to the CSV file (for local filesystem access). Either csvPath or csvContent is required."
          ),
        csvContent: z
          .string()
          .optional()
          .describe(
            "CSV content as a string (for sandboxed environments like Claude.ai/Cowork). Either csvPath or csvContent is required."
          ),
        blockName: z
          .string()
          .optional()
          .describe(
            "Custom name for the block. Required when using csvContent. Defaults to filename when using csvPath. Will be converted to kebab-case."
          ),
        csvType: z
          .enum(["tradelog", "dailylog", "reportinglog"])
          .default("tradelog")
          .describe(
            "Type of CSV: 'tradelog' (default) for trade records, 'dailylog' for daily portfolio values, 'reportinglog' for actual/reported trades"
          ),
      }),
    },
    async ({ csvPath, csvContent, blockName, csvType }) => {
      try {
        // Validate that either csvPath or csvContent is provided
        if (!csvPath && !csvContent) {
          throw new Error(
            "Either csvPath or csvContent is required. Use csvContent when working in sandboxed environments."
          );
        }

        // When using csvContent, blockName is required
        if (csvContent && !blockName) {
          throw new Error(
            "blockName is required when using csvContent (no filename to derive name from)"
          );
        }

        const result = await importCsv(baseDir, {
          csvPath,
          csvContent,
          blockName,
          csvType,
        });

        // Brief summary for user display
        const source = csvPath ? `path: ${csvPath}` : "content";
        const summary = `Imported ${result.recordCount} records to block "${result.blockId}" (${csvType}) from ${source}`;

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId: result.blockId,
          name: result.name,
          csvType,
          source: csvPath ? "path" : "content",
          sourcePath: csvPath || null,
          recordCount: result.recordCount,
          dateRange: result.dateRange,
          strategies: result.strategies,
          blockPath: result.blockPath,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error importing CSV: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
