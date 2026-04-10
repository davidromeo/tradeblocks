/**
 * Extension point for additional tool registrations.
 * Override this file to register extra tools (e.g., backtest, data pipeline).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type ToolRegistrar = (server: McpServer, dir: string) => void;

export const extraToolRegistrations: ToolRegistrar[] = [];
