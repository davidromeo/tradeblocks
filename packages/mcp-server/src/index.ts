import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from "fs/promises";
import * as path from "path";

// Parse command line for backtest directory
const backtestDir = process.argv[2];
if (!backtestDir) {
  console.error("Usage: tradeblocks-mcp <backtests-folder>");
  console.error("Example: tradeblocks-mcp ~/backtests");
  process.exit(1);
}

const resolvedDir = path.resolve(backtestDir);

// Create server instance using the new McpServer API
const server = new McpServer(
  { name: "tradeblocks-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// Register list_backtests tool
server.registerTool(
  "list_backtests",
  {
    description:
      "List all CSV files available for analysis in the backtests folder",
  },
  async () => {
    try {
      const files = await fs.readdir(resolvedDir);
      const csvFiles = files.filter((f) => f.toLowerCase().endsWith(".csv"));

      if (csvFiles.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No CSV files found in ${resolvedDir}\n\nDrop your backtest CSV files in this folder and try again.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Found ${csvFiles.length} backtest file(s):\n${csvFiles.map((f) => `  - ${f}`).join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error reading directory: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  // Verify directory exists
  try {
    await fs.access(resolvedDir);
  } catch {
    console.error(`Error: Directory does not exist: ${resolvedDir}`);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`TradeBlocks MCP ready. Watching: ${resolvedDir}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
