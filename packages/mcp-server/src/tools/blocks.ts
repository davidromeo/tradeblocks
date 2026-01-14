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
  createDualOutput,
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
      inputSchema: z.object({
        sortBy: z
          .enum(["name", "tradeCount", "netPl", "dateRange"])
          .default("name")
          .describe("Sort results by field (default: name)"),
        sortOrder: z
          .enum(["asc", "desc"])
          .default("asc")
          .describe("Sort direction (default: asc)"),
        containsStrategy: z
          .string()
          .optional()
          .describe("Filter to blocks containing this strategy name (case-insensitive)"),
        minTrades: z
          .number()
          .min(1)
          .optional()
          .describe("Filter to blocks with at least this many trades"),
        hasDailyLog: z
          .boolean()
          .optional()
          .describe("Filter to blocks with (true) or without (false) daily log data"),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe("Limit number of results returned (default: all)"),
      }),
    },
    async ({ sortBy, sortOrder, containsStrategy, minTrades, hasDailyLog, limit }) => {
      try {
        let blocks = await listBlocks(baseDir);

        // Apply filters
        if (containsStrategy) {
          const strategyLower = containsStrategy.toLowerCase();
          blocks = blocks.filter((b) =>
            b.strategies.some((s) => s.toLowerCase().includes(strategyLower))
          );
        }
        if (minTrades !== undefined) {
          blocks = blocks.filter((b) => b.tradeCount >= minTrades);
        }
        if (hasDailyLog !== undefined) {
          blocks = blocks.filter((b) => b.hasDailyLog === hasDailyLog);
        }

        // Sort blocks based on parameters
        const multiplier = sortOrder === "asc" ? 1 : -1;
        blocks = [...blocks].sort((a, b) => {
          switch (sortBy) {
            case "tradeCount":
              return (a.tradeCount - b.tradeCount) * multiplier;
            case "netPl":
              return ((a.netPl ?? 0) - (b.netPl ?? 0)) * multiplier;
            case "dateRange": {
              const aTime = a.dateRange.end?.getTime() ?? 0;
              const bTime = b.dateRange.end?.getTime() ?? 0;
              return (aTime - bTime) * multiplier;
            }
            case "name":
            default:
              return a.name.localeCompare(b.name) * multiplier;
          }
        });

        // Apply limit
        const totalBeforeLimit = blocks.length;
        if (limit !== undefined && limit < blocks.length) {
          blocks = blocks.slice(0, limit);
        }

        const output = formatBlockList(blocks);

        // Build structured data for Claude reasoning
        const structuredData = {
          options: {
            sortBy,
            sortOrder,
            containsStrategy: containsStrategy ?? null,
            minTrades: minTrades ?? null,
            hasDailyLog: hasDailyLog ?? null,
            limit: limit ?? null,
          },
          totalMatching: totalBeforeLimit,
          blocks: blocks.map((b) => ({
            id: b.blockId,
            name: b.name,
            tradeCount: b.tradeCount,
            dateRange: {
              start: b.dateRange.start?.toISOString() ?? null,
              end: b.dateRange.end?.toISOString() ?? null,
            },
            strategies: b.strategies,
            totalPl: b.totalPl,
            netPl: b.netPl,
            hasDailyLog: b.hasDailyLog,
          })),
          count: blocks.length,
        };

        return createDualOutput(output, structuredData);
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

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          tradeCount: trades.length,
          dailyLogCount: dailyLogs?.length ?? 0,
          strategies,
          dateRange: {
            start: dateRange.start?.toISOString() ?? null,
            end: dateRange.end?.toISOString() ?? null,
          },
        };

        return createDualOutput(output, structuredData);
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
        "Get full portfolio statistics with optional strategy, ticker, and date filters",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        tickerFilter: z
          .string()
          .optional()
          .describe("Filter trades by underlying ticker symbol (e.g., 'SPY', 'AAPL')"),
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
    async ({ blockId, strategy, tickerFilter, startDate, endDate }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;
        const dailyLogs = block.dailyLogs;

        // Apply filters
        const isFiltered = !!(strategy || tickerFilter || startDate || endDate);
        trades = filterByStrategy(trades, strategy);
        trades = filterByDateRange(trades, startDate, endDate);

        // Apply ticker filter
        if (tickerFilter) {
          const tickerLower = tickerFilter.toLowerCase();
          trades = trades.filter(
            (t) => t.ticker?.toLowerCase() === tickerLower
          );
        }

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
        if (tickerFilter) filterInfo.push(`Ticker: ${tickerFilter}`);
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

        // Build structured data for Claude reasoning - include full PortfolioStats
        const structuredData = {
          blockId,
          filters: {
            strategy: strategy ?? null,
            tickerFilter: tickerFilter ?? null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
          },
          stats: {
            totalTrades: stats.totalTrades,
            winningTrades: stats.winningTrades,
            losingTrades: stats.losingTrades,
            breakEvenTrades: stats.breakEvenTrades,
            winRate: stats.winRate,
            totalPl: stats.totalPl,
            netPl: stats.netPl,
            totalCommissions: stats.totalCommissions,
            avgWin: stats.avgWin,
            avgLoss: stats.avgLoss,
            maxWin: stats.maxWin,
            maxLoss: stats.maxLoss,
            profitFactor: stats.profitFactor,
            sharpeRatio: stats.sharpeRatio,
            sortinoRatio: stats.sortinoRatio,
            calmarRatio: stats.calmarRatio,
            maxDrawdown: stats.maxDrawdown,
            timeInDrawdown: stats.timeInDrawdown,
            kellyPercentage: stats.kellyPercentage,
            cagr: stats.cagr,
            initialCapital: stats.initialCapital,
            avgDailyPl: stats.avgDailyPl,
            maxWinStreak: stats.maxWinStreak,
            maxLossStreak: stats.maxLossStreak,
            currentStreak: stats.currentStreak,
            monthlyWinRate: stats.monthlyWinRate,
            weeklyWinRate: stats.weeklyWinRate,
          },
        };

        return createDualOutput(output, structuredData);
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
        "Compare all strategies within a block with optional filtering and sorting",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        startDate: z
          .string()
          .optional()
          .describe("Start date filter (YYYY-MM-DD)"),
        endDate: z
          .string()
          .optional()
          .describe("End date filter (YYYY-MM-DD)"),
        tickerFilter: z
          .string()
          .optional()
          .describe("Filter trades by underlying ticker symbol"),
        minTrades: z
          .number()
          .min(1)
          .optional()
          .describe("Minimum trades per strategy to include in comparison"),
        sortBy: z
          .enum(["pl", "winRate", "trades", "profitFactor", "name"])
          .default("pl")
          .describe("Sort strategies by metric (default: pl for total P&L)"),
        sortOrder: z
          .enum(["asc", "desc"])
          .default("desc")
          .describe("Sort direction (default: desc for highest first)"),
        limit: z
          .number()
          .min(1)
          .optional()
          .describe("Limit number of strategies shown"),
      }),
    },
    async ({ blockId, startDate, endDate, tickerFilter, minTrades, sortBy, sortOrder, limit }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply date filter
        trades = filterByDateRange(trades, startDate, endDate);

        // Apply ticker filter
        if (tickerFilter) {
          const tickerLower = tickerFilter.toLowerCase();
          trades = trades.filter(
            (t) => t.ticker?.toLowerCase() === tickerLower
          );
        }

        if (trades.length === 0) {
          return {
            content: [{ type: "text", text: "No trades found matching the filters." }],
          };
        }

        // Calculate stats per strategy - always use trade-based calculations
        // because daily logs represent full portfolio
        const strategyStats = calculator.calculateStrategyStats(trades);

        // Convert to array for filtering and sorting
        let strategies = Object.values(strategyStats);

        // Apply minTrades filter
        if (minTrades !== undefined) {
          strategies = strategies.filter((s) => s.tradeCount >= minTrades);
        }

        // Apply sorting
        const multiplier = sortOrder === "asc" ? 1 : -1;
        strategies.sort((a, b) => {
          switch (sortBy) {
            case "winRate":
              return (a.winRate - b.winRate) * multiplier;
            case "trades":
              return (a.tradeCount - b.tradeCount) * multiplier;
            case "profitFactor":
              return ((a.profitFactor ?? 0) - (b.profitFactor ?? 0)) * multiplier;
            case "name":
              return a.strategyName.localeCompare(b.strategyName) * multiplier;
            case "pl":
            default:
              return (a.totalPl - b.totalPl) * multiplier;
          }
        });

        // Apply limit
        const totalBeforeLimit = strategies.length;
        if (limit !== undefined && limit < strategies.length) {
          strategies = strategies.slice(0, limit);
        }

        // Build header showing applied filters
        const filterInfo: string[] = [];
        if (startDate) filterInfo.push(`From: ${startDate}`);
        if (endDate) filterInfo.push(`To: ${endDate}`);
        if (tickerFilter) filterInfo.push(`Ticker: ${tickerFilter}`);
        if (minTrades) filterInfo.push(`Min trades: ${minTrades}`);

        const header = filterInfo.length > 0
          ? `## Block: ${blockId}\n\n**Filters:** ${filterInfo.join(", ")}\n**Sort:** ${sortBy} (${sortOrder})\n\n`
          : `## Block: ${blockId}\n\n**Sort:** ${sortBy} (${sortOrder})\n\n`;

        // Rebuild stats object for formatter
        const filteredStats: Record<string, typeof strategies[0]> = {};
        for (const s of strategies) {
          filteredStats[s.strategyName] = s;
        }
        const output = header + formatStrategyComparison(filteredStats);

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          options: {
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            tickerFilter: tickerFilter ?? null,
            minTrades: minTrades ?? null,
            sortBy,
            sortOrder,
            limit: limit ?? null,
          },
          strategies: structuredStrategies.map((s) => ({
            name: s.strategyName,
            trades: s.tradeCount,
            winRate: s.winRate,
            pl: s.totalPl,
            avgWin: s.avgWin,
            avgLoss: s.avgLoss,
            profitFactor: s.profitFactor,
          })),
          totalStrategies: totalBeforeLimit,
          count: structuredStrategies.length,
        };

        return createDualOutput(output, structuredData);
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
        metrics: z
          .array(
            z.enum([
              "totalTrades",
              "winRate",
              "netPl",
              "sharpeRatio",
              "sortinoRatio",
              "maxDrawdown",
              "profitFactor",
              "calmarRatio",
            ])
          )
          .optional()
          .describe(
            "Specific metrics to include in comparison (default: all). Use to focus on key metrics."
          ),
        sortBy: z
          .enum([
            "name",
            "totalTrades",
            "winRate",
            "netPl",
            "sharpeRatio",
            "sortinoRatio",
            "maxDrawdown",
            "profitFactor",
            "calmarRatio",
          ])
          .default("name")
          .describe("Sort blocks by metric (default: name)"),
        sortOrder: z
          .enum(["asc", "desc"])
          .default("asc")
          .describe("Sort direction (default: asc)"),
      }),
    },
    async ({ blockIds, metrics, sortBy, sortOrder }) => {
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

        // Sort blocks by specified metric
        const multiplier = sortOrder === "asc" ? 1 : -1;
        blockStats.sort((a, b) => {
          switch (sortBy) {
            case "totalTrades":
              return (a.stats.totalTrades - b.stats.totalTrades) * multiplier;
            case "winRate":
              return ((a.stats.winRate ?? 0) - (b.stats.winRate ?? 0)) * multiplier;
            case "netPl":
              return ((a.stats.netPl ?? 0) - (b.stats.netPl ?? 0)) * multiplier;
            case "sharpeRatio":
              return ((a.stats.sharpeRatio ?? 0) - (b.stats.sharpeRatio ?? 0)) * multiplier;
            case "sortinoRatio":
              return ((a.stats.sortinoRatio ?? 0) - (b.stats.sortinoRatio ?? 0)) * multiplier;
            case "maxDrawdown":
              return ((a.stats.maxDrawdown ?? 0) - (b.stats.maxDrawdown ?? 0)) * multiplier;
            case "profitFactor":
              return ((a.stats.profitFactor ?? 0) - (b.stats.profitFactor ?? 0)) * multiplier;
            case "calmarRatio":
              return ((a.stats.calmarRatio ?? 0) - (b.stats.calmarRatio ?? 0)) * multiplier;
            case "name":
            default:
              return a.blockId.localeCompare(b.blockId) * multiplier;
          }
        });

        const output = formatBlocksComparison(blockStats);

        // Add note about any failed blocks
        const loadedIds = blockStats.map((b) => b.blockId);
        const failedIds = blockIds.filter((id) => !loadedIds.includes(id));
        const footer =
          failedIds.length > 0
            ? `\n\n*Note: Failed to load: ${failedIds.join(", ")}*`
            : "";

        // Build structured data for Claude reasoning
        // If specific metrics requested, filter to those only
        const allMetrics = {
          totalTrades: true,
          winRate: true,
          netPl: true,
          sharpeRatio: true,
          sortinoRatio: true,
          maxDrawdown: true,
          profitFactor: true,
          calmarRatio: true,
        };
        const requestedMetrics = metrics
          ? Object.fromEntries(metrics.map((m) => [m, true]))
          : allMetrics;

        const structuredData = {
          options: {
            metrics: metrics ?? null,
            sortBy,
            sortOrder,
          },
          comparisons: blockStats.map(({ blockId, stats }) => {
            const filteredStats: Record<string, number | null> = {};
            if (requestedMetrics.totalTrades) filteredStats.totalTrades = stats.totalTrades;
            if (requestedMetrics.winRate) filteredStats.winRate = stats.winRate;
            if (requestedMetrics.netPl) filteredStats.netPl = stats.netPl;
            if (requestedMetrics.sharpeRatio) filteredStats.sharpeRatio = stats.sharpeRatio;
            if (requestedMetrics.sortinoRatio) filteredStats.sortinoRatio = stats.sortinoRatio;
            if (requestedMetrics.maxDrawdown) filteredStats.maxDrawdown = stats.maxDrawdown;
            if (requestedMetrics.profitFactor) filteredStats.profitFactor = stats.profitFactor;
            if (requestedMetrics.calmarRatio) filteredStats.calmarRatio = stats.calmarRatio;
            return {
              blockId,
              stats: filteredStats,
            };
          }),
          failedBlocks: failedIds,
        };

        return createDualOutput(output + footer, structuredData);
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
        "Get trades with optional filtering, sorting, and pagination (default 50 per page, max 100)",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        tickerFilter: z
          .string()
          .optional()
          .describe("Filter trades by underlying ticker symbol (e.g., 'SPY', 'AAPL')"),
        startDate: z
          .string()
          .optional()
          .describe("Start date filter (YYYY-MM-DD)"),
        endDate: z
          .string()
          .optional()
          .describe("End date filter (YYYY-MM-DD)"),
        minPl: z
          .number()
          .optional()
          .describe("Filter trades with P&L >= this value"),
        maxPl: z
          .number()
          .optional()
          .describe("Filter trades with P&L <= this value"),
        outcome: z
          .enum(["all", "winners", "losers", "breakeven"])
          .default("all")
          .describe("Filter by trade outcome: 'all', 'winners' (P&L > 0), 'losers' (P&L < 0), 'breakeven' (P&L = 0)"),
        sortBy: z
          .enum(["date", "pl", "strategy", "ticker"])
          .default("date")
          .describe("Sort trades by field (default: date)"),
        sortOrder: z
          .enum(["asc", "desc"])
          .default("desc")
          .describe("Sort direction (default: desc for most recent first)"),
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
    async ({
      blockId,
      strategy,
      tickerFilter,
      startDate,
      endDate,
      minPl,
      maxPl,
      outcome,
      sortBy,
      sortOrder,
      page = 1,
      pageSize = 50,
    }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply filters
        trades = filterByStrategy(trades, strategy);
        trades = filterByDateRange(trades, startDate, endDate);

        // Apply ticker filter
        if (tickerFilter) {
          const tickerLower = tickerFilter.toLowerCase();
          trades = trades.filter(
            (t) => t.ticker?.toLowerCase() === tickerLower
          );
        }

        // Apply P&L filters
        if (minPl !== undefined) {
          trades = trades.filter((t) => t.pl >= minPl);
        }
        if (maxPl !== undefined) {
          trades = trades.filter((t) => t.pl <= maxPl);
        }

        // Apply outcome filter
        if (outcome !== "all") {
          switch (outcome) {
            case "winners":
              trades = trades.filter((t) => t.pl > 0);
              break;
            case "losers":
              trades = trades.filter((t) => t.pl < 0);
              break;
            case "breakeven":
              trades = trades.filter((t) => t.pl === 0);
              break;
          }
        }

        // Apply sorting
        const multiplier = sortOrder === "asc" ? 1 : -1;
        trades = [...trades].sort((a, b) => {
          switch (sortBy) {
            case "pl":
              return (a.pl - b.pl) * multiplier;
            case "strategy":
              return a.strategy.localeCompare(b.strategy) * multiplier;
            case "ticker":
              return (a.ticker ?? "").localeCompare(b.ticker ?? "") * multiplier;
            case "date":
            default:
              return (
                (new Date(a.dateOpened).getTime() -
                  new Date(b.dateOpened).getTime()) *
                multiplier
              );
          }
        });

        // Build header showing applied filters
        const filterInfo: string[] = [];
        if (strategy) filterInfo.push(`Strategy: ${strategy}`);
        if (tickerFilter) filterInfo.push(`Ticker: ${tickerFilter}`);
        if (startDate) filterInfo.push(`From: ${startDate}`);
        if (endDate) filterInfo.push(`To: ${endDate}`);
        if (minPl !== undefined) filterInfo.push(`Min P&L: $${minPl}`);
        if (maxPl !== undefined) filterInfo.push(`Max P&L: $${maxPl}`);
        if (outcome !== "all") filterInfo.push(`Outcome: ${outcome}`);

        const header =
          filterInfo.length > 0
            ? `## Block: ${blockId}\n\n**Filters:** ${filterInfo.join(", ")}\n**Sort:** ${sortBy} (${sortOrder})\n\n`
            : `## Block: ${blockId}\n\n**Sort:** ${sortBy} (${sortOrder})\n\n`;

        const output = header + formatTradesTable(trades, page, pageSize);

        // Calculate pagination info
        const totalTrades = trades.length;
        const totalPages = Math.ceil(totalTrades / pageSize);
        const startIdx = (page - 1) * pageSize;
        const endIdx = Math.min(startIdx + pageSize, totalTrades);
        const pageTrades = trades.slice(startIdx, endIdx);

        // Build structured data for Claude reasoning
        const structuredData = {
          options: {
            strategy: strategy ?? null,
            tickerFilter: tickerFilter ?? null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            minPl: minPl ?? null,
            maxPl: maxPl ?? null,
            outcome,
            sortBy,
            sortOrder,
          },
          trades: pageTrades.map((t) => ({
            dateOpened: t.dateOpened.toISOString(),
            timeOpened: t.timeOpened,
            strategy: t.strategy,
            legs: t.legs,
            pl: t.pl,
            numContracts: t.numContracts,
            commissions: t.openingCommissionsFees + t.closingCommissionsFees,
          })),
          pagination: {
            page,
            pageSize,
            totalPages,
            totalTrades,
          },
        };

        return createDualOutput(output, structuredData);
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
