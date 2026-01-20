/**
 * HTTP Server for MCP
 *
 * Provides HTTP transport for web platforms (ChatGPT, Google AI Studio, Julius)
 * that cannot connect to stdio-based MCP servers.
 *
 * Uses Streamable HTTP transport (MCP spec 2025-03-26) with stateless mode.
 */

import { createServer, type Server } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { Express } from "express";

export interface HttpServerOptions {
  port: number;
  host?: string;
}

/**
 * Creates and starts an HTTP server for MCP.
 *
 * @param server - The configured MCP server instance
 * @param options - HTTP server options (port, host)
 * @returns Promise that resolves when server is listening
 */
export async function startHttpServer(
  server: McpServer,
  options: HttpServerOptions
): Promise<Server> {
  const { port, host = "0.0.0.0" } = options;

  // Create Express app with DNS rebinding protection
  const app: Express = createMcpExpressApp({ host });

  // Create stateless transport (no session tracking needed for analysis queries)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  // Handle MCP requests on /mcp endpoint
  app.all("/mcp", async (req, res) => {
    await transport.handleRequest(req, res);
  });

  // Connect server to transport
  await server.connect(transport);

  // Start HTTP server
  const httpServer = createServer(app);

  return new Promise((resolve, reject) => {
    httpServer.on("error", reject);
    httpServer.listen(port, host, () => {
      console.error(`TradeBlocks MCP HTTP server listening on http://${host}:${port}/mcp`);
      console.error(`For web platforms, expose via: ngrok http ${port}`);
      resolve(httpServer);
    });
  });
}
