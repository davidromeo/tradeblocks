/**
 * Block Tools Module
 *
 * Barrel export for all block-related MCP tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCoreBlockTools } from "./core.js";
import { registerComparisonBlockTools } from "./comparison.js";
import { registerAnalysisBlockTools } from "./analysis.js";
import { registerSimilarityBlockTools } from "./similarity.js";
import { registerHealthBlockTools } from "./health.js";

/**
 * Register all block-related MCP tools
 */
export function registerBlockTools(server: McpServer, baseDir: string): void {
  registerCoreBlockTools(server, baseDir);
  registerComparisonBlockTools(server, baseDir);
  registerAnalysisBlockTools(server, baseDir);
  registerSimilarityBlockTools(server, baseDir);
  registerHealthBlockTools(server, baseDir);
}
