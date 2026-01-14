/**
 * TradeBlocks MCP Server
 *
 * Provides options trading analysis capabilities via Model Context Protocol.
 * Exposes portfolio statistics, strategy comparisons, and trade data
 * to Claude Desktop, Cowork, and other MCP clients.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from "fs/promises";
import * as path from "path";
import { registerBlockTools } from "./tools/blocks.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerPerformanceTools } from "./tools/performance.js";

// Parse command line for backtest directory
const backtestDir = process.argv[2];
if (!backtestDir) {
  console.error("Usage: tradeblocks-mcp <backtests-folder>");
  console.error("Example: tradeblocks-mcp ~/backtests");
  console.error("");
  console.error("The backtests folder should contain block folders, each with:");
  console.error("  - tradelog.csv (required): Trade records");
  console.error("  - dailylog.csv (optional): Daily portfolio values");
  process.exit(1);
}

const resolvedDir = path.resolve(backtestDir);

// Create server instance
const server = new McpServer(
  { name: "tradeblocks-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// Register all tools
registerBlockTools(server, resolvedDir);
registerAnalysisTools(server, resolvedDir);
registerPerformanceTools(server, resolvedDir);

async function main() {
  // Verify directory exists
  try {
    await fs.access(resolvedDir);
  } catch {
    console.error(`Error: Directory does not exist: ${resolvedDir}`);
    process.exit(1);
  }

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`TradeBlocks MCP ready. Watching: ${resolvedDir}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
