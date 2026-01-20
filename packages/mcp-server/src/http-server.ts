/**
 * HTTP Server for MCP
 *
 * Provides HTTP transport for web platforms (ChatGPT, Google AI Studio, Julius, Claude.ai)
 * that cannot connect to stdio-based MCP servers.
 *
 * Uses Streamable HTTP transport (MCP spec 2025-03-26) with stateless mode.
 * Each request gets a fresh server+transport instance for proper isolation.
 */

import { createServer, type Server } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Express, type Request, type Response } from "express";

export interface HttpServerOptions {
  port: number;
  host?: string;
}

/** Factory function type for creating configured MCP servers */
export type ServerFactory = () => McpServer;

/**
 * Creates and starts an HTTP server for MCP with stateless request handling.
 *
 * @param serverFactory - Factory function that creates a fresh MCP server instance
 * @param options - HTTP server options (port, host)
 * @returns Promise that resolves when server is listening
 */
export async function startHttpServer(
  serverFactory: ServerFactory,
  options: HttpServerOptions
): Promise<Server> {
  const { port, host = "0.0.0.0" } = options;

  const app: Express = express();
  app.use(express.json());

  // Health check endpoint (required by ChatGPT for connector validation)
  app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
      name: "tradeblocks-mcp",
      status: "ok",
      mcp_endpoint: "/mcp",
    });
  });

  // Also serve MCP at root for platforms that expect it there
  app.post("/", handleMcpRequest(serverFactory));

  // MCP endpoint - POST for client requests
  app.post("/mcp", handleMcpRequest(serverFactory));

  // MCP endpoint - GET for SSE streams (server-initiated messages)
  app.get("/mcp", (_req: Request, res: Response) => {
    // We don't support server-initiated SSE streams in stateless mode
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32601, message: "Method not allowed. Use POST for MCP requests." },
      id: null,
    });
  });

  // MCP endpoint - DELETE for session termination
  app.delete("/mcp", (_req: Request, res: Response) => {
    // Stateless mode - no sessions to terminate
    res.status(202).send();
  });

  const httpServer = createServer(app);

  return new Promise((resolve, reject) => {
    httpServer.on("error", reject);
    httpServer.listen(port, host, () => {
      console.error(`TradeBlocks MCP HTTP server listening on http://${host}:${port}/mcp`);
      console.error(`Health check available at http://${host}:${port}/`);
      console.error(`For web platforms, expose via: ngrok http ${port}`);
      resolve(httpServer);
    });
  });
}

/**
 * Creates a request handler that instantiates fresh server+transport per request.
 * This is the correct stateless pattern per MCP SDK examples.
 */
function handleMcpRequest(serverFactory: ServerFactory) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Create fresh server and transport for each request (stateless pattern)
      const server = serverFactory();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode - no session tracking
      });

      // Clean up when connection closes
      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });

      // Connect and handle
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  };
}
