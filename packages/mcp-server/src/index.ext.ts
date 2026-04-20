/**
 * Extension point for additional tool registrations.
 * Override this file to register extra tools (e.g., backtest, data pipeline).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MarketStores } from "./market/stores/index.js";

type ToolRegistrar = (server: McpServer, dir: string, stores: MarketStores) => void;

export const extraToolRegistrations: ToolRegistrar[] = [];
