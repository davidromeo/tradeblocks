/**
 * CLI Handler for Direct Tool Invocation
 *
 * Enables running MCP tools directly from command line:
 *   tradeblocks-mcp --call <tool-name> '<json-args>'
 *
 * This creates a mock MCP server that captures tool registrations,
 * then invokes the requested tool handler directly.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { registerBlockTools } from "./tools/blocks.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerPerformanceTools } from "./tools/performance.js";
import { registerReportTools } from "./tools/reports.js";
import { registerImportTools } from "./tools/imports.js";

// Type for captured tool handlers
type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
}>;

interface CapturedTool {
  name: string;
  description: string;
  handler: ToolHandler;
}

/**
 * Mock MCP server that captures tool registrations
 */
class ToolCapture {
  private tools = new Map<string, CapturedTool>();

  registerTool(
    name: string,
    options: { description: string; inputSchema: unknown },
    handler: ToolHandler
  ): void {
    this.tools.set(name, {
      name,
      description: options.description,
      handler,
    });
  }

  getTool(name: string): CapturedTool | undefined {
    return this.tools.get(name);
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys()).sort();
  }

  getToolList(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }
}

/**
 * Handle --call CLI invocation
 */
export async function handleDirectCall(args: string[]): Promise<void> {
  const [toolName, jsonArgs] = args;

  // Get base directory from env or default to current directory
  const baseDir = process.env.TRADEBLOCKS_DATA_DIR || process.env.BLOCKS_DIRECTORY || process.cwd();
  const resolvedDir = path.resolve(baseDir);

  // Verify directory exists
  try {
    await fs.access(resolvedDir);
  } catch {
    console.error(JSON.stringify({
      error: `Directory does not exist: ${resolvedDir}`,
      hint: "Set TRADEBLOCKS_DATA_DIR environment variable to your backtests folder",
    }, null, 2));
    process.exit(1);
  }

  // Create mock server and register all tools
  const capture = new ToolCapture();

  // Cast to unknown then to McpServer type since we're mocking it
  const mockServer = capture as unknown as Parameters<typeof registerBlockTools>[0];

  registerBlockTools(mockServer, resolvedDir);
  registerAnalysisTools(mockServer, resolvedDir);
  registerPerformanceTools(mockServer, resolvedDir);
  registerReportTools(mockServer, resolvedDir);
  registerImportTools(mockServer, resolvedDir);

  // Handle special case: list available tools
  if (!toolName || toolName === "--list" || toolName === "help") {
    const tools = capture.getToolList();
    console.log(JSON.stringify({
      availableTools: tools,
      usage: "tradeblocks-mcp --call <tool-name> '<json-args>'",
      example: "TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call list_backtests '{}'",
    }, null, 2));
    process.exit(0);
  }

  // Look up the tool
  const tool = capture.getTool(toolName);
  if (!tool) {
    const availableTools = capture.getToolNames();
    console.error(JSON.stringify({
      error: `Unknown tool: ${toolName}`,
      availableTools,
      hint: "Run with --call --list to see all available tools",
    }, null, 2));
    process.exit(1);
  }

  // Parse JSON arguments
  let parsedArgs: Record<string, unknown>;
  try {
    parsedArgs = jsonArgs ? JSON.parse(jsonArgs) : {};
  } catch (parseError) {
    console.error(JSON.stringify({
      error: "Invalid JSON arguments",
      details: parseError instanceof Error ? parseError.message : String(parseError),
      received: jsonArgs,
      hint: "Arguments must be valid JSON, e.g., '{\"blockId\":\"my-block\"}'",
    }, null, 2));
    process.exit(1);
  }

  // Invoke the tool handler
  try {
    const result = await tool.handler(parsedArgs);

    // Tools return { content: [{ type: "text", text: "summary" }, { type: "resource", resource: { text: "json" } }] }
    // We want to extract the JSON data from the resource, or fall back to text content
    if (result.content && Array.isArray(result.content)) {
      // Look for resource with JSON data first
      const resourceItem = result.content.find(
        (item): item is { type: string; resource: { text: string } } =>
          item.type === "resource" && "resource" in item && typeof (item as { resource?: { text?: string } }).resource?.text === "string"
      );

      if (resourceItem?.resource?.text) {
        try {
          const parsed = JSON.parse(resourceItem.resource.text);
          console.log(JSON.stringify(parsed, null, 2));
          return;
        } catch {
          // Fall through to text handling
        }
      }

      // Fall back to text content
      const textItem = result.content.find(
        (item): item is { type: string; text: string } =>
          item.type === "text" && "text" in item
      );

      if (textItem?.text) {
        try {
          const parsed = JSON.parse(textItem.text);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(textItem.text);
        }
        return;
      }
    }

    // Last resort: output entire result
    console.log(JSON.stringify(result, null, 2));
  } catch (toolError) {
    console.error(JSON.stringify({
      error: "Tool execution failed",
      tool: toolName,
      details: toolError instanceof Error ? toolError.message : String(toolError),
    }, null, 2));
    process.exit(1);
  }
}
