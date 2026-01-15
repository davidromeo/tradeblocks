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
        "Import a CSV file into the blocks directory. Creates a new block from any CSV path. Use for ad-hoc analysis without pre-configured block directories.",
      inputSchema: z.object({
        csvPath: z
          .string()
          .describe("Absolute path to the CSV file to import"),
        blockName: z
          .string()
          .optional()
          .describe(
            "Custom name for the block (defaults to filename without extension). Will be converted to kebab-case."
          ),
        csvType: z
          .enum(["tradelog", "dailylog", "reportinglog"])
          .default("tradelog")
          .describe(
            "Type of CSV: 'tradelog' (default) for trade records, 'dailylog' for daily portfolio values, 'reportinglog' for actual/reported trades"
          ),
      }),
    },
    async ({ csvPath, blockName, csvType }) => {
      try {
        const result = await importCsv(baseDir, csvPath, {
          blockName,
          csvType,
        });

        // Brief summary for user display
        const summary = `Imported ${result.recordCount} records to block "${result.blockId}" (${csvType})`;

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId: result.blockId,
          name: result.name,
          csvType,
          sourcePath: csvPath,
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
