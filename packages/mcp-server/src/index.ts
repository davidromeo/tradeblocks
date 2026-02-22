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
import { registerSQLTools } from "./tools/sql.js";
import { registerSchemaTools } from "./tools/schema.js";
import { registerEdgeDecayTools } from "./tools/edge-decay.js";
import { registerGuideTools } from "./tools/guides.js";
import {
  installSkills,
  uninstallSkills,
  checkInstallation,
  getTargetPath,
  type Platform,
} from "./skill-installer.js";
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
  --market-db <path> Path to market.duckdb (default: <folder>/market.duckdb)

Environment:
  BLOCKS_DIRECTORY  Default backtests folder if not specified
  MARKET_DB_PATH    Path to market.duckdb (overrides default, overridden by --market-db)

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

// Parse CLI arguments for skill commands
function parseSkillArgs(): { platform: Platform; force: boolean } {
  const args = process.argv.slice(3);
  let platform: Platform = "claude";
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--platform" && args[i + 1]) {
      const p = args[i + 1].toLowerCase();
      if (p === "claude" || p === "codex" || p === "gemini") {
        platform = p;
      } else {
        console.error(`Unknown platform: ${args[i + 1]}`);
        console.error("Valid platforms: claude, codex, gemini");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--force") {
      force = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return { platform, force };
}

// Parse CLI arguments for MCP server mode
function parseServerArgs(): {
  http: boolean;
  port: number;
  directory: string | undefined;
} {
  const args = process.argv.slice(2);
  let http = false;
  let port = 3100;
  let directory: string | undefined;

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
    } else if (!arg.startsWith("-") && !arg.startsWith("--")) {
      // Non-flag argument is the directory
      directory = arg;
    }
  }

  // Also check environment variable
  if (!directory) {
    directory = process.env.BLOCKS_DIRECTORY;
  }

  return { http, port, directory };
}

// Handle skill CLI commands
async function handleSkillCommand(command: string): Promise<void> {
  const { platform, force } = parseSkillArgs();
  const targetPath = getTargetPath(platform);

  switch (command) {
    case "install-skills": {
      console.log(`Installing TradeBlocks skills to ${platform}...`);
      console.log(`Target: ${targetPath}\n`);

      const result = await installSkills(platform, { force });

      if (result.installed.length > 0) {
        console.log(`✓ Installed ${result.installed.length} skill(s):`);
        result.installed.forEach((s) => console.log(`  - ${s}`));
      }

      if (result.skipped.length > 0) {
        console.log(`⏭ Skipped ${result.skipped.length} skill(s) (already installed):`);
        result.skipped.forEach((s) => console.log(`  - ${s}`));
        if (!force) {
          console.log("\n  Use --force to reinstall existing skills.");
        }
      }

      if (result.errors.length > 0) {
        console.error(`\n✗ Errors (${result.errors.length}):`);
        result.errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
      }

      console.log("\nDone.");
      process.exit(0);
    }

    case "uninstall-skills": {
      console.log(`Removing TradeBlocks skills from ${platform}...`);
      console.log(`Target: ${targetPath}\n`);

      const removed = await uninstallSkills(platform);

      if (removed.length > 0) {
        console.log(`✓ Removed ${removed.length} skill(s):`);
        removed.forEach((s) => console.log(`  - ${s}`));
      } else {
        console.log("No skills were installed.");
      }

      console.log("\nDone.");
      process.exit(0);
    }

    case "check-skills": {
      console.log(`Checking TradeBlocks skills for ${platform}...`);
      console.log(`Target: ${targetPath}\n`);

      const status = await checkInstallation(platform);

      if (status.installed.length > 0) {
        console.log(`✓ Installed (${status.installed.length}):`);
        status.installed.forEach((s) => console.log(`  - ${s}`));
      }

      if (status.missing.length > 0) {
        console.log(`\n✗ Missing (${status.missing.length}):`);
        status.missing.forEach((s) => console.log(`  - ${s}`));
        console.log("\n  Run 'tradeblocks-mcp install-skills' to install.");
      }

      if (status.missing.length === 0 && status.installed.length > 0) {
        console.log("\nAll skills installed.");
      } else if (status.installed.length === 0 && status.missing.length > 0) {
        console.log("\nNo skills installed.");
      }

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
  const { http, port, directory: backtestDir } = parseServerArgs();

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

  // Factory function to create configured MCP server instances
  // Used by HTTP transport which needs fresh instances per request (stateless mode)
  const createServer = (): McpServer => {
    const server = new McpServer(
      { name: "tradeblocks-mcp", version: "1.2.0" },
      { capabilities: { tools: {} } }
    );
    registerBlockTools(server, resolvedDir);
    registerAnalysisTools(server, resolvedDir);
    registerPerformanceTools(server, resolvedDir);
    registerReportTools(server, resolvedDir);
    registerImportTools(server, resolvedDir);
    registerMarketImportTools(server, resolvedDir);
    registerMarketDataTools(server, resolvedDir);
    registerSQLTools(server, resolvedDir);
    registerSchemaTools(server, resolvedDir);
    registerEdgeDecayTools(server, resolvedDir);
    registerGuideTools(server);
    return server;
  };

  if (http) {
    // HTTP transport for web platforms - dynamically import to avoid bundling
    // CommonJS deps (express, raw-body) that don't work in MCPB bundle
    const { startHttpServer } = await import("./http-server.js");
    await startHttpServer(createServer, { port });
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
