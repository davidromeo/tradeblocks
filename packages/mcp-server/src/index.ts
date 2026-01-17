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
import { registerResources } from "./resources/index.js";
import {
  installSkills,
  uninstallSkills,
  checkInstallation,
  getTargetPath,
  type Platform,
} from "./skill-installer.js";

// CLI usage help
function printUsage(): void {
  console.log(`TradeBlocks MCP Server

Usage: tradeblocks-mcp <command|backtests-folder>

Commands:
  install-skills    Install TradeBlocks skills to AI platform
  uninstall-skills  Remove TradeBlocks skills from AI platform
  check-skills      Check skill installation status

Options for skill commands:
  --platform <name>  Target platform: claude, codex, gemini (default: claude)
  --force            Reinstall even if skills exist (install only)

MCP Server:
  tradeblocks-mcp <backtests-folder>
  BLOCKS_DIRECTORY=/path tradeblocks-mcp

Examples:
  tradeblocks-mcp install-skills
  tradeblocks-mcp install-skills --platform codex
  tradeblocks-mcp check-skills
  tradeblocks-mcp ~/backtests
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

  // MCP Server mode - get backtest directory from environment variable or command line
  const backtestDir = process.env.BLOCKS_DIRECTORY || process.argv[2];
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

  // Create server instance
  const server = new McpServer(
    { name: "tradeblocks-mcp", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  // Register all tools and resources
  registerBlockTools(server, resolvedDir);
  registerAnalysisTools(server, resolvedDir);
  registerPerformanceTools(server, resolvedDir);
  registerReportTools(server, resolvedDir);
  registerImportTools(server, resolvedDir);
  registerResources(server);

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`TradeBlocks MCP ready. Watching: ${resolvedDir}`);
}

main().catch((error) => {
  console.error("Error:", error.message || error);
  process.exit(1);
});
