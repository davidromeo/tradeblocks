/**
 * Block Tools
 *
 * Tier 1 core MCP tools for block listing, statistics, and comparison.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock, listBlocks, saveMetadata } from "../utils/block-loader.js";
import type { BlockMetadata } from "../utils/block-loader.js";
import {
  formatBlockList,
  formatBlockInfo,
  formatStatsTable,
  formatStrategyComparison,
  formatBlocksComparison,
  formatTradesTable,
} from "../utils/output-formatter.js";
import { PortfolioStatsCalculator } from "@lib/calculations/portfolio-stats";
import type { Trade } from "@lib/models/trade";

/**
 * Filter trades by strategy
 */
function filterByStrategy(trades: Trade[], strategy?: string): Trade[] {
  if (!strategy) return trades;
  return trades.filter(
    (t) => t.strategy.toLowerCase() === strategy.toLowerCase()
  );
}

/**
 * Filter trades by date range
 */
function filterByDateRange(
  trades: Trade[],
  startDate?: string,
  endDate?: string
): Trade[] {
  let filtered = trades;

  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      filtered = filtered.filter((t) => new Date(t.dateOpened) >= start);
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      // Include entire end date
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((t) => new Date(t.dateOpened) <= end);
    }
  }

  return filtered;
}

/**
 * Register all block-related MCP tools
 */
export function registerBlockTools(server: McpServer, baseDir: string): void {
  const calculator = new PortfolioStatsCalculator();

  // Tool 1: list_backtests
  server.registerTool(
    "list_backtests",
    {
      description:
        "List all available backtest blocks with summary stats (trade count, date range, P&L)",
    },
    async () => {
      try {
        const blocks = await listBlocks(baseDir);
        const output = formatBlockList(blocks);

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing backtests: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 2: get_block_info
  server.registerTool(
    "get_block_info",
    {
      description:
        "Get detailed info for a specific block (trade count, date range, strategies, daily log status)",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
      }),
    },
    async ({ blockId }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        const trades = block.trades;
        const dailyLogs = block.dailyLogs;

        const strategies = Array.from(
          new Set(trades.map((t) => t.strategy))
        ).sort();
        const dates = trades.map((t) => new Date(t.dateOpened).getTime());
        const dateRange = {
          start: dates.length > 0 ? new Date(Math.min(...dates)) : null,
          end: dates.length > 0 ? new Date(Math.max(...dates)) : null,
        };

        const output = formatBlockInfo(
          blockId,
          trades.length,
          dailyLogs?.length ?? 0,
          dateRange,
          strategies
        );

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error loading block: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 3: get_statistics
  server.registerTool(
    "get_statistics",
    {
      description:
        "Get full portfolio statistics with optional strategy and date filters",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        startDate: z
          .string()
          .optional()
          .describe("Start date filter (YYYY-MM-DD)"),
        endDate: z
          .string()
          .optional()
          .describe("End date filter (YYYY-MM-DD)"),
      }),
    },
    async ({ blockId, strategy, startDate, endDate }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;
        const dailyLogs = block.dailyLogs;

        // Apply filters
        const isFiltered = !!(strategy || startDate || endDate);
        trades = filterByStrategy(trades, strategy);
        trades = filterByDateRange(trades, startDate, endDate);

        if (trades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No trades found matching the specified filters.`,
              },
            ],
          };
        }

        // When strategy filter is applied, we MUST use trade-based calculations
        // because daily logs represent the FULL portfolio, not per-strategy
        const isStrategyFiltered = !!strategy;
        const stats = calculator.calculatePortfolioStats(
          trades,
          isStrategyFiltered ? undefined : dailyLogs,
          isStrategyFiltered
        );

        // Build header showing applied filters
        const filterInfo: string[] = [];
        if (strategy) filterInfo.push(`Strategy: ${strategy}`);
        if (startDate) filterInfo.push(`From: ${startDate}`);
        if (endDate) filterInfo.push(`To: ${endDate}`);

        const header =
          filterInfo.length > 0
            ? `## Block: ${blockId}\n\n**Filters:** ${filterInfo.join(", ")}\n\n`
            : `## Block: ${blockId}\n\n`;

        const output = header + formatStatsTable(stats);

        // Cache stats if no filters applied
        if (!isFiltered && !block.metadata) {
          const strategies = Array.from(
            new Set(block.trades.map((t) => t.strategy))
          ).sort();
          const dates = block.trades.map((t) =>
            new Date(t.dateOpened).getTime()
          );
          const metadata: BlockMetadata = {
            blockId,
            name: blockId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tradeCount: block.trades.length,
            dailyLogCount: dailyLogs?.length ?? 0,
            dateRange: {
              start:
                dates.length > 0
                  ? new Date(Math.min(...dates)).toISOString()
                  : null,
              end:
                dates.length > 0
                  ? new Date(Math.max(...dates)).toISOString()
                  : null,
            },
            strategies,
            cachedStats: {
              totalPl: stats.totalPl,
              netPl: stats.netPl,
              winRate: stats.winRate,
              sharpeRatio: stats.sharpeRatio,
              maxDrawdown: stats.maxDrawdown,
              calculatedAt: new Date().toISOString(),
            },
          };
          // Save metadata asynchronously (don't block response)
          saveMetadata(`${baseDir}/${blockId}`, metadata).catch((err) =>
            console.error("Failed to save metadata:", err)
          );
        }

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error calculating statistics: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 4: get_strategy_comparison
  server.registerTool(
    "get_strategy_comparison",
    {
      description:
        "Compare all strategies within a block (sorted by total P&L)",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
      }),
    },
    async ({ blockId }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        const trades = block.trades;

        if (trades.length === 0) {
          return {
            content: [{ type: "text", text: "No trades found in this block." }],
          };
        }

        // Calculate stats per strategy - always use trade-based calculations
        // because daily logs represent full portfolio
        const strategyStats = calculator.calculateStrategyStats(trades);

        const header = `## Block: ${blockId}\n\n`;
        const output = header + formatStrategyComparison(strategyStats);

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error comparing strategies: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 5: compare_blocks
  server.registerTool(
    "compare_blocks",
    {
      description: "Compare statistics across multiple blocks (max 5)",
      inputSchema: z.object({
        blockIds: z
          .array(z.string())
          .min(1)
          .max(5)
          .describe("Array of block folder names to compare (max 5)"),
      }),
    },
    async ({ blockIds }) => {
      try {
        const blockStats: Array<{
          blockId: string;
          stats: ReturnType<typeof calculator.calculatePortfolioStats>;
        }> = [];

        for (const blockId of blockIds) {
          try {
            const block = await loadBlock(baseDir, blockId);
            const stats = calculator.calculatePortfolioStats(
              block.trades,
              block.dailyLogs
            );
            blockStats.push({ blockId, stats });
          } catch (error) {
            // Include error info in output but continue with other blocks
            console.error(`Failed to load block ${blockId}:`, error);
          }
        }

        if (blockStats.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to load any of the specified blocks: ${blockIds.join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        const output = formatBlocksComparison(blockStats);

        // Add note about any failed blocks
        const loadedIds = blockStats.map((b) => b.blockId);
        const failedIds = blockIds.filter((id) => !loadedIds.includes(id));
        const footer =
          failedIds.length > 0
            ? `\n\n*Note: Failed to load: ${failedIds.join(", ")}*`
            : "";

        return {
          content: [{ type: "text", text: output + footer }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error comparing blocks: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 6: get_trades
  server.registerTool(
    "get_trades",
    {
      description:
        "Get trades with optional filtering and pagination (default 50 per page, max 100)",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        startDate: z
          .string()
          .optional()
          .describe("Start date filter (YYYY-MM-DD)"),
        endDate: z
          .string()
          .optional()
          .describe("End date filter (YYYY-MM-DD)"),
        page: z.number().int().positive().optional().describe("Page number (default: 1)"),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Trades per page (default: 50, max: 100)"),
      }),
    },
    async ({ blockId, strategy, startDate, endDate, page = 1, pageSize = 50 }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply filters
        trades = filterByStrategy(trades, strategy);
        trades = filterByDateRange(trades, startDate, endDate);

        // Build header showing applied filters
        const filterInfo: string[] = [];
        if (strategy) filterInfo.push(`Strategy: ${strategy}`);
        if (startDate) filterInfo.push(`From: ${startDate}`);
        if (endDate) filterInfo.push(`To: ${endDate}`);

        const header =
          filterInfo.length > 0
            ? `## Block: ${blockId}\n\n**Filters:** ${filterInfo.join(", ")}\n\n`
            : `## Block: ${blockId}\n\n`;

        const output = header + formatTradesTable(trades, page, pageSize);

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error loading trades: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
