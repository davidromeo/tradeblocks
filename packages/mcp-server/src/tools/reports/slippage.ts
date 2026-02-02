/**
 * Report Slippage Tools
 *
 * Barrel export for all slippage-related tools.
 *
 * Tools are organized in separate files:
 * - discrepancies.ts: analyze_discrepancies
 * - strategy-matches.ts: suggest_strategy_matches
 * - slippage-trends.ts: analyze_slippage_trends
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDiscrepancyTool } from "./discrepancies.js";
import { registerStrategyMatchesTool } from "./strategy-matches.js";
import { registerSlippageTrendsTool } from "./slippage-trends.js";

/**
 * Register slippage-related report tools
 */
export function registerSlippageTools(
  server: McpServer,
  baseDir: string
): void {
  registerDiscrepancyTool(server, baseDir);
  registerStrategyMatchesTool(server, baseDir);
  registerSlippageTrendsTool(server, baseDir);
}
