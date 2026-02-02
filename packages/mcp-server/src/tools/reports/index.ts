/**
 * Report Tools Module
 *
 * Barrel export for all report-related MCP tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFieldTools } from "./fields.js";
import { registerQueryTools } from "./queries.js";
import { registerPredictiveTools } from "./predictive.js";
import { registerSlippageTools } from "./slippage.js";

/**
 * Register all report-related MCP tools
 */
export function registerReportTools(server: McpServer, baseDir: string): void {
  registerFieldTools(server, baseDir);
  registerQueryTools(server, baseDir);
  registerPredictiveTools(server, baseDir);
  registerSlippageTools(server, baseDir);
}
