/**
 * TradeBlocks MCP Server
 *
 * Provides options trading analysis capabilities via Model Context Protocol.
 * Exposes portfolio statistics, strategy comparisons, and trade data
 * to Claude Desktop, Cowork, and other MCP clients.
 *
 * CLI Commands:
 *   install-skills    Install TradeBlocks skills to AI platform
 *   uninstall-skills  Remove TradeBlocks skills from AI platform
 *   check-skills      Check skill installation status
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from "fs/promises";
import * as path from "path";
import { registerBlockTools } from "./tools/blocks.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerPerformanceTools } from "./tools/performance.js";
import { registerReportTools } from "./tools/reports.js";
import { registerImportTools } from "./tools/imports.js";
import { registerMarketDataTools } from "./tools/market-data.js";
import { registerMarketImportTools } from "./tools/market-imports.js";
import { registerMarketEnrichmentTools } from "./tools/market-enrichment.js";
import { registerSQLTools } from "./tools/sql.js";
import { registerSchemaTools } from "./tools/schema.js";
import { registerEdgeDecayTools } from "./tools/edge-decay.js";
import { registerGuideTools } from "./tools/guides.js";
import { registerProfileTools } from "./tools/profiles.js";
import { registerProfileAnalysisTools } from "./tools/profile-analysis.js";
import { registerRegimeAdvisorTools } from "./tools/regime-advisor.js";
import { registerReplayTools } from "./tools/replay.js";
import { registerSnapshotTools } from "./tools/snapshot.js";
import { registerExitAnalysisTools } from "./tools/exit-analysis.js";
import { registerBatchExitAnalysisTools } from "./tools/batch-exit-analysis.js";
import { handleDirectCall } from "./cli-handler.js";
import { closeConnection } from "./db/index.js";

// CLI usage help
function printUsage(): void {
  console.log(`TradeBlocks MCP Server

Usage: tradeblocks-mcp [options] <backtests-folder>
       tradeblocks-mcp <command> [command-options]

MCP Server Modes:
  tradeblocks-mcp <folder>                    stdio transport (Claude Desktop, Codex CLI)
  tradeblocks-mcp --http <folder>             HTTP transport on port 3100
  tradeblocks-mcp --http --port 8080 <folder> HTTP transport on custom port

Options:
  --http             Start HTTP server instead of stdio (for web platforms)
  --port <number>    HTTP server port (default: 3100, requires --http)
  --blocks-dir <path> Directory containing CSV block folders (default: same as <folder>)
  --market-db <path> Path to market.duckdb (default: <folder>/market.duckdb)
  --no-auth          Disable authentication (only use behind an auth proxy)

Environment:
  BLOCKS_DIRECTORY    Default backtests folder if not specified
  TRADEBLOCKS_BLOCKS_DIR  Directory for CSV block folders (overrides default, overridden by --blocks-dir)
  MARKET_DB_PATH      Path to market.duckdb (overrides default, overridden by --market-db)

Commands:
  install-skills    Install TradeBlocks skills to AI platform
  uninstall-skills  Remove TradeBlocks skills from AI platform
  check-skills      Check skill installation status
  --call <tool> '<args>'  Directly invoke an MCP tool (for testing)

Skill Command Options:
  --platform <name>  Target platform: claude, codex, gemini (default: claude)
  --force            Reinstall even if skills exist (install only)

Direct Tool Invocation:
  TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call list_blocks '{}'

Examples:
  tradeblocks-mcp ~/backtests
  tradeblocks-mcp --http ~/backtests
  tradeblocks-mcp --http --port 8080 ~/Trading/backtests
  tradeblocks-mcp install-skills --platform codex
`);
}

// Parse CLI arguments for MCP server mode
function parseServerArgs(): {
  http: boolean;
  port: number;
  noAuth: boolean;
  directory: string | undefined;
  blocksDir: string | undefined;
  marketDb: string | undefined;
} {
  const args = process.argv.slice(2);
  let http = false;
  let port = 3100;
  let noAuth = false;
  let directory: string | undefined;
  let blocksDir: string | undefined;
  let marketDb: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--http") {
      http = true;
    } else if (arg === "--port" && args[i + 1]) {
      const parsedPort = parseInt(args[i + 1], 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
        port = parsedPort;
      }
      i++; // Skip next arg (the port value)
    } else if (arg === "--blocks-dir" && args[i + 1]) {
      blocksDir = args[i + 1];
      i++; // Skip next arg (the path value)
    } else if (arg === "--market-db" && args[i + 1]) {
      marketDb = args[i + 1];
      i++; // Skip next arg (the path value)
    } else if (arg === "--no-auth") {
      noAuth = true;
    } else if (!arg.startsWith("-") && !arg.startsWith("--")) {
      // Non-flag argument is the directory
      directory = arg;
    }
  }

  // Also check environment variables
  if (!directory) {
    directory = process.env.BLOCKS_DIRECTORY;
  }
  if (!blocksDir) {
    blocksDir = process.env.TRADEBLOCKS_BLOCKS_DIR;
  }
  if (!marketDb) {
    marketDb = process.env.MARKET_DB_PATH;
  }

  return { http, port, noAuth, directory, blocksDir, marketDb };
}

// Handle skill CLI commands (deprecated — now use plugin)
async function handleSkillCommand(command: string): Promise<void> {
  console.log("Skills have moved to a standalone plugin:");
  console.log("  https://github.com/davidromeo/tradeblocks-skills");
  console.log("");
  console.log("Install via Claude Code:");
  console.log("  /plugin marketplace add davidromeo/tradeblocks-skills");
  console.log("  /plugin install tradeblocks@tradeblocks-skills");

  switch (command) {
    case "install-skills":
    case "uninstall-skills":
    case "check-skills": {
      process.exit(0);
    }

    default:
      printUsage();
      process.exit(1);
  }
}

// Main entry point - handles both skill CLI commands and MCP server mode
async function main(): Promise<void> {
  const command = process.argv[2];

  // Handle --call mode for direct tool invocation
  if (command === "--call") {
    await handleDirectCall(process.argv.slice(3));
    return;
  }

  // Handle skill commands (exit after handling)
  if (
    command === "install-skills" ||
    command === "uninstall-skills" ||
    command === "check-skills"
  ) {
    await handleSkillCommand(command);
    return; // handleSkillCommand calls process.exit, but return for safety
  }

  // Handle help flag
  if (command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  // MCP Server mode - parse arguments
  const { http, port, noAuth, directory: backtestDir, blocksDir } = parseServerArgs();

  if (!backtestDir) {
    printUsage();
    process.exit(1);
  }

  const resolvedDir = path.resolve(backtestDir);

  // Verify directory exists
  try {
    await fs.access(resolvedDir);
  } catch {
    console.error(`Error: Directory does not exist: ${resolvedDir}`);
    process.exit(1);
  }

  // Configure separate blocks directory if specified
  if (blocksDir) {
    const resolvedBlocksDir = path.resolve(blocksDir);
    try {
      await fs.access(resolvedBlocksDir);
    } catch {
      console.error(`Error: Blocks directory does not exist: ${resolvedBlocksDir}`);
      process.exit(1);
    }
    const { setBlocksDir } = await import("./sync/index.js");
    setBlocksDir(resolvedBlocksDir);
  }

  // Factory function to create configured MCP server instances
  // Used by HTTP transport which needs fresh instances per request (stateless mode)
  const createServer = (): McpServer => {
    const server = new McpServer(
      { name: "tradeblocks-mcp", version: "2.0.0" },
      {
        capabilities: { tools: {} },
        instructions: "Call list_blocks first to discover available block IDs. All other block tools require a blockId returned by list_blocks. For SQL queries, call describe_database first to discover block_ids and column names, then filter trades with WHERE block_id = '...'.",
      }
    );
    registerBlockTools(server, resolvedDir);
    registerAnalysisTools(server, resolvedDir);
    registerPerformanceTools(server, resolvedDir);
    registerReportTools(server, resolvedDir);
    registerImportTools(server, resolvedDir);
    registerMarketImportTools(server, resolvedDir);
    registerMarketEnrichmentTools(server, resolvedDir);
    registerMarketDataTools(server, resolvedDir);
    registerSQLTools(server, resolvedDir);
    registerSchemaTools(server, resolvedDir);
    registerEdgeDecayTools(server, resolvedDir);
    registerGuideTools(server);
    registerProfileTools(server, resolvedDir);
    registerProfileAnalysisTools(server, resolvedDir);
    registerRegimeAdvisorTools(server, resolvedDir);
    registerReplayTools(server, resolvedDir);
    registerSnapshotTools(server);
    registerExitAnalysisTools(server, resolvedDir);
    registerBatchExitAnalysisTools(server, resolvedDir);
    return server;
  };

  if (http) {
    // Load auth config for HTTP mode
    const { loadAuthConfig } = await import("./auth/config.js");
    let auth;
    try {
      auth = loadAuthConfig({ noAuth });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }

    const { startHttpServer } = await import("./http-server.js");
    await startHttpServer(createServer, { port, auth });
  } else {
    // Stdio transport for Claude Desktop, Codex CLI, etc.
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`TradeBlocks MCP ready (stdio). Watching: ${resolvedDir}`);

    // The MCP SDK's StdioServerTransport doesn't listen for stdin close/end.
    // When the parent process (Claude Code) crashes or is force-quit, stdin EOF's
    // but this process lingers — holding the DuckDB write lock indefinitely.
    // Exit cleanly on stdin close so the lock is released.
    process.stdin.on("end", async () => {
      await closeConnection();
      process.exit(0);
    });
  }

  // Graceful shutdown for DuckDB connection
  // The connection is lazily initialized, so this only does work if a tool
  // actually opened the database during this session
  const shutdown = async () => {
    await closeConnection();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
