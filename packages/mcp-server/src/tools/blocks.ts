/**
 * Block Tools
 *
 * Tier 1 core MCP tools for block listing, statistics, and comparison.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock, listBlocks, saveMetadata, buildBlockMetadata } from "../utils/block-loader.js";
import type { CsvMappings } from "../utils/block-loader.js";
import {
  createToolOutput,
  formatCurrency,
  formatPercent,
  formatRatio,
} from "../utils/output-formatter.js";
import { PortfolioStatsCalculator } from "@lib/calculations/portfolio-stats";
import { calculateCorrelationMatrix } from "@lib/calculations/correlation";
import { performTailRiskAnalysis } from "@lib/calculations/tail-risk-analysis";
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

        // Brief summary for user display
        const summary = `Found ${blocks.length} backtest(s)${totalBeforeLimit > blocks.length ? ` (showing ${blocks.length} of ${totalBeforeLimit})` : ""}`;

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

        return createToolOutput(summary, structuredData);
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

        // Brief summary for user display
        const summary = `Block: ${blockId} | ${trades.length} trades | ${strategies.length} strategies | Daily log: ${dailyLogs?.length ? "Yes" : "No"}`;

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

        return createToolOutput(summary, structuredData);
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

        // Brief summary for user display
        const summary = `Stats: ${blockId}${strategy ? ` (${strategy})` : ""} | ${stats.totalTrades} trades | Win: ${formatPercent(stats.winRate * 100)} | Net P&L: ${formatCurrency(stats.netPl)} | Sharpe: ${formatRatio(stats.sharpeRatio)}`;

        // Cache stats if no filters applied
        if (!isFiltered && !block.metadata) {
          const blockPath = `${baseDir}/${blockId}`;

          // Build CSV mappings for cache invalidation
          const csvMappings: CsvMappings = { tradelog: "tradelog.csv" };
          if (dailyLogs && dailyLogs.length > 0) {
            csvMappings.dailylog = "dailylog.csv";
          }

          // Build and save metadata asynchronously (don't block response)
          buildBlockMetadata({
            blockId,
            blockPath,
            trades: block.trades,
            dailyLogs,
            csvMappings,
            cachedStats: {
              totalPl: stats.totalPl,
              netPl: stats.netPl,
              winRate: stats.winRate,
              sharpeRatio: stats.sharpeRatio,
              maxDrawdown: stats.maxDrawdown,
              calculatedAt: new Date().toISOString(),
            },
          })
            .then((metadata) => saveMetadata(blockPath, metadata))
            .catch((err) => console.error("Failed to save metadata:", err));
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

        return createToolOutput(summary, structuredData);
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

        // Brief summary for user display
        const summary = `Strategy Comparison: ${blockId} | ${strategies.length} strategies${totalBeforeLimit > strategies.length ? ` (of ${totalBeforeLimit})` : ""} | Sorted by ${sortBy}`;

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
          strategies: strategies.map((s) => ({
            name: s.strategyName,
            trades: s.tradeCount,
            winRate: s.winRate,
            pl: s.totalPl,
            avgWin: s.avgWin,
            avgLoss: s.avgLoss,
            profitFactor: s.profitFactor,
          })),
          totalStrategies: totalBeforeLimit,
          count: strategies.length,
        };

        return createToolOutput(summary, structuredData);
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

        // Add note about any failed blocks
        const loadedIds = blockStats.map((b) => b.blockId);
        const failedIds = blockIds.filter((id) => !loadedIds.includes(id));

        // Brief summary for user display
        const summary = `Block Comparison: ${blockStats.length} blocks loaded${failedIds.length > 0 ? ` (${failedIds.length} failed)` : ""} | Sorted by ${sortBy}`;

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

        return createToolOutput(summary, structuredData);
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

  // Tool 6: block_diff
  server.registerTool(
    "block_diff",
    {
      description:
        "Compare two blocks with strategy overlap analysis and P/L attribution. Shows which strategies are shared vs unique between blocks, and calculates performance deltas for shared strategies.",
      inputSchema: z.object({
        blockIdA: z.string().describe("First block (baseline) for comparison"),
        blockIdB: z.string().describe("Second block (comparison target)"),
        startDate: z
          .string()
          .optional()
          .describe("Optional start date filter (YYYY-MM-DD)"),
        endDate: z
          .string()
          .optional()
          .describe("Optional end date filter (YYYY-MM-DD)"),
        metricsToCompare: z
          .array(
            z.enum([
              "trades",
              "pl",
              "winRate",
              "profitFactor",
              "sharpeRatio",
              "maxDrawdown",
            ])
          )
          .optional()
          .describe(
            "Specific metrics to include in comparison (default: all). Use to focus output."
          ),
      }),
    },
    async ({ blockIdA, blockIdB, startDate, endDate, metricsToCompare }) => {
      try {
        // Load both blocks
        const [blockA, blockB] = await Promise.all([
          loadBlock(baseDir, blockIdA),
          loadBlock(baseDir, blockIdB),
        ]);

        // Apply date filters
        const tradesA = filterByDateRange(blockA.trades, startDate, endDate);
        const tradesB = filterByDateRange(blockB.trades, startDate, endDate);

        // Extract unique strategy names from each block
        const strategiesA = new Set(tradesA.map((t) => t.strategy));
        const strategiesB = new Set(tradesB.map((t) => t.strategy));

        // Categorize strategies
        const shared: string[] = [];
        const uniqueToA: string[] = [];
        const uniqueToB: string[] = [];

        for (const strategy of strategiesA) {
          if (strategiesB.has(strategy)) {
            shared.push(strategy);
          } else {
            uniqueToA.push(strategy);
          }
        }

        for (const strategy of strategiesB) {
          if (!strategiesA.has(strategy)) {
            uniqueToB.push(strategy);
          }
        }

        // Sort for consistent output
        shared.sort();
        uniqueToA.sort();
        uniqueToB.sort();

        // Calculate overlap percentage
        const totalUniqueStrategies = new Set([...strategiesA, ...strategiesB]).size;
        const overlapPercent =
          totalUniqueStrategies > 0
            ? (shared.length / totalUniqueStrategies) * 100
            : 0;

        // Calculate per-strategy stats using trade-based calculations only
        const statsA = calculator.calculateStrategyStats(tradesA);
        const statsB = calculator.calculateStrategyStats(tradesB);

        // Helper to build strategy comparison entry
        const buildStrategyEntry = (strategy: string) => {
          const blockAStats = statsA[strategy];
          const blockBStats = statsB[strategy];

          const entryA = blockAStats
            ? {
                trades: blockAStats.tradeCount,
                pl: blockAStats.totalPl,
                winRate: blockAStats.winRate,
                profitFactor: blockAStats.profitFactor,
              }
            : null;

          const entryB = blockBStats
            ? {
                trades: blockBStats.tradeCount,
                pl: blockBStats.totalPl,
                winRate: blockBStats.winRate,
                profitFactor: blockBStats.profitFactor,
              }
            : null;

          // Calculate delta only for shared strategies
          const delta =
            entryA && entryB
              ? {
                  trades: entryB.trades - entryA.trades,
                  pl: entryB.pl - entryA.pl,
                  winRate: entryB.winRate - entryA.winRate,
                }
              : null;

          return {
            strategy,
            blockA: entryA,
            blockB: entryB,
            delta,
          };
        };

        // Build per-strategy comparison for all strategies
        const perStrategyComparison = [
          ...shared.map(buildStrategyEntry),
          ...uniqueToA.map(buildStrategyEntry),
          ...uniqueToB.map(buildStrategyEntry),
        ];

        // Calculate portfolio-level totals
        // Use trade-based calculations for filtered comparison
        const portfolioStatsA = calculator.calculatePortfolioStats(
          tradesA,
          undefined, // Don't use daily logs for comparison - trades only
          true // Force trade-based calculations
        );
        const portfolioStatsB = calculator.calculatePortfolioStats(
          tradesB,
          undefined,
          true
        );

        // Build portfolio totals with all or filtered metrics
        const allMetrics = !metricsToCompare || metricsToCompare.length === 0;
        const includeMetric = (m: string) =>
          allMetrics || metricsToCompare?.includes(m as typeof metricsToCompare[number]);

        const buildPortfolioEntry = (
          stats: ReturnType<typeof calculator.calculatePortfolioStats>
        ) => {
          const entry: Record<string, number | null> = {};
          if (includeMetric("trades")) entry.totalTrades = stats.totalTrades;
          if (includeMetric("pl")) entry.netPl = stats.netPl;
          if (includeMetric("winRate")) entry.winRate = stats.winRate;
          if (includeMetric("profitFactor"))
            entry.profitFactor = stats.profitFactor;
          if (includeMetric("sharpeRatio"))
            entry.sharpeRatio = stats.sharpeRatio ?? null;
          if (includeMetric("maxDrawdown"))
            entry.maxDrawdown = stats.maxDrawdown;
          return entry;
        };

        const portfolioA = buildPortfolioEntry(portfolioStatsA);
        const portfolioB = buildPortfolioEntry(portfolioStatsB);

        // Calculate deltas for portfolio totals
        const portfolioDelta: Record<string, number | null> = {};
        for (const key of Object.keys(portfolioA)) {
          const valA = portfolioA[key];
          const valB = portfolioB[key];
          portfolioDelta[key] =
            valA !== null && valB !== null ? valB - valA : null;
        }

        // Brief summary for user display
        const summary = `Block Diff: ${blockIdA} vs ${blockIdB} | ${shared.length} shared, ${uniqueToA.length} unique to A, ${uniqueToB.length} unique to B | P/L delta: ${formatCurrency(portfolioStatsB.netPl - portfolioStatsA.netPl)}`;

        // Build structured output
        const structuredData = {
          blockA: {
            id: blockIdA,
            tradeCount: tradesA.length,
            strategies: Array.from(strategiesA).sort(),
          },
          blockB: {
            id: blockIdB,
            tradeCount: tradesB.length,
            strategies: Array.from(strategiesB).sort(),
          },
          strategyOverlap: {
            shared,
            uniqueToA,
            uniqueToB,
            overlapPercent,
          },
          perStrategyComparison,
          portfolioTotals: {
            blockA: portfolioA,
            blockB: portfolioB,
            delta: portfolioDelta,
          },
          filters: {
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            metricsToCompare: metricsToCompare ?? null,
          },
        };

        return createToolOutput(summary, structuredData);
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

  // Tool 7: stress_test
  // Define built-in stress scenarios (all post-2013 since backtests typically start there)
  const STRESS_SCENARIOS: Record<
    string,
    { startDate: string; endDate: string; description: string }
  > = {
    // Crashes & Corrections
    china_deval_2015: {
      startDate: "2015-08-11",
      endDate: "2015-08-25",
      description: "China yuan devaluation, global selloff",
    },
    brexit: {
      startDate: "2016-06-23",
      endDate: "2016-06-27",
      description: "UK Brexit vote shock",
    },
    volmageddon: {
      startDate: "2018-02-02",
      endDate: "2018-02-09",
      description: "VIX spike, XIV blowup, largest VIX jump since 1987",
    },
    q4_2018: {
      startDate: "2018-10-01",
      endDate: "2018-12-24",
      description: "Fed rate hike selloff",
    },
    covid_crash: {
      startDate: "2020-02-19",
      endDate: "2020-03-23",
      description: "COVID-19 pandemic crash, peak to trough",
    },
    bear_2022: {
      startDate: "2022-01-03",
      endDate: "2022-10-12",
      description: "Fed tightening bear market",
    },
    svb_crisis: {
      startDate: "2023-03-08",
      endDate: "2023-03-15",
      description: "Silicon Valley Bank collapse, regional bank contagion",
    },
    vix_aug_2024: {
      startDate: "2024-08-01",
      endDate: "2024-08-15",
      description: "Yen carry trade unwind, VIX spike",
    },
    liberation_day: {
      startDate: "2025-04-02",
      endDate: "2025-04-08",
      description: "Trump tariffs, largest drop since COVID",
    },
    // Recoveries
    covid_recovery: {
      startDate: "2020-03-23",
      endDate: "2020-08-18",
      description: "V-shaped recovery from COVID crash",
    },
    liberation_recovery: {
      startDate: "2025-04-09",
      endDate: "2025-05-02",
      description: "Post 90-day tariff pause rally, S&P +9.5% single day",
    },
  };

  server.registerTool(
    "stress_test",
    {
      description:
        "Analyze portfolio performance during historical market stress scenarios (COVID crash, 2022 bear, VIX spikes, etc.). Shows how the portfolio performed during named periods without manually specifying date ranges.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name to analyze"),
        scenarios: z
          .array(z.string())
          .optional()
          .describe(
            "Specific scenario names to test (e.g., 'covid_crash', 'bear_2022'). If omitted, runs all built-in scenarios."
          ),
        customScenarios: z
          .array(
            z.object({
              name: z.string().describe("Custom scenario name"),
              startDate: z.string().describe("Start date (YYYY-MM-DD)"),
              endDate: z.string().describe("End date (YYYY-MM-DD)"),
            })
          )
          .optional()
          .describe("User-defined scenarios with custom date ranges"),
      }),
    },
    async ({ blockId, scenarios, customScenarios }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        const trades = block.trades;

        // Build list of scenarios to run
        const scenariosToRun: Array<{
          name: string;
          startDate: string;
          endDate: string;
          description: string;
          isCustom: boolean;
        }> = [];

        // Add built-in scenarios
        if (scenarios && scenarios.length > 0) {
          // Validate requested scenarios exist
          const invalidScenarios = scenarios.filter(
            (s) => !STRESS_SCENARIOS[s]
          );
          if (invalidScenarios.length > 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Unknown scenario(s): ${invalidScenarios.join(", ")}. Available: ${Object.keys(STRESS_SCENARIOS).join(", ")}`,
                },
              ],
              isError: true,
            };
          }

          for (const scenarioName of scenarios) {
            const scenario = STRESS_SCENARIOS[scenarioName];
            scenariosToRun.push({
              name: scenarioName,
              startDate: scenario.startDate,
              endDate: scenario.endDate,
              description: scenario.description,
              isCustom: false,
            });
          }
        } else {
          // Run all built-in scenarios
          for (const [name, scenario] of Object.entries(STRESS_SCENARIOS)) {
            scenariosToRun.push({
              name,
              startDate: scenario.startDate,
              endDate: scenario.endDate,
              description: scenario.description,
              isCustom: false,
            });
          }
        }

        // Add custom scenarios
        if (customScenarios && customScenarios.length > 0) {
          for (const custom of customScenarios) {
            scenariosToRun.push({
              name: custom.name,
              startDate: custom.startDate,
              endDate: custom.endDate,
              description: `Custom scenario: ${custom.startDate} to ${custom.endDate}`,
              isCustom: true,
            });
          }
        }

        // Calculate stats for each scenario
        const scenarioResults: Array<{
          name: string;
          description: string;
          dateRange: { start: string; end: string };
          tradeCount: number;
          stats: {
            netPl: number;
            winRate: number;
            maxDrawdown: number;
            profitFactor: number | null;
            avgWin: number | null;
            avgLoss: number | null;
          } | null;
          isCustom: boolean;
        }> = [];

        let worstScenario: { name: string; netPl: number } | null = null;
        let bestScenario: { name: string; netPl: number } | null = null;
        let scenariosWithTrades = 0;

        for (const scenario of scenariosToRun) {
          // Filter trades to scenario date range
          const scenarioTrades = filterByDateRange(
            trades,
            scenario.startDate,
            scenario.endDate
          );

          if (scenarioTrades.length === 0) {
            // No trades in this scenario - null stats
            scenarioResults.push({
              name: scenario.name,
              description: scenario.description,
              dateRange: { start: scenario.startDate, end: scenario.endDate },
              tradeCount: 0,
              stats: null,
              isCustom: scenario.isCustom,
            });
          } else {
            // Calculate trade-based stats (no daily logs per constraining decision)
            const stats = calculator.calculatePortfolioStats(
              scenarioTrades,
              undefined, // No daily logs
              true // Force trade-based calculations
            );

            scenarioResults.push({
              name: scenario.name,
              description: scenario.description,
              dateRange: { start: scenario.startDate, end: scenario.endDate },
              tradeCount: scenarioTrades.length,
              stats: {
                netPl: stats.netPl,
                winRate: stats.winRate,
                maxDrawdown: stats.maxDrawdown,
                profitFactor: stats.profitFactor,
                avgWin: stats.avgWin,
                avgLoss: stats.avgLoss,
              },
              isCustom: scenario.isCustom,
            });

            scenariosWithTrades++;

            // Track best/worst scenarios
            if (worstScenario === null || stats.netPl < worstScenario.netPl) {
              worstScenario = { name: scenario.name, netPl: stats.netPl };
            }
            if (bestScenario === null || stats.netPl > bestScenario.netPl) {
              bestScenario = { name: scenario.name, netPl: stats.netPl };
            }
          }
        }

        // Build summary
        const summaryData = {
          totalScenarios: scenarioResults.length,
          scenariosWithTrades,
          worstScenario: worstScenario?.name ?? null,
          bestScenario: bestScenario?.name ?? null,
        };

        // Brief summary for user display
        const summary = `Stress Test: ${blockId} | ${scenariosWithTrades}/${scenarioResults.length} scenarios with trades | Worst: ${worstScenario?.name ?? "N/A"} (${worstScenario ? formatCurrency(worstScenario.netPl) : "N/A"}) | Best: ${bestScenario?.name ?? "N/A"} (${bestScenario ? formatCurrency(bestScenario.netPl) : "N/A"})`;

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          scenarios: scenarioResults,
          summary: summaryData,
          availableBuiltInScenarios: Object.keys(STRESS_SCENARIOS),
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error running stress test: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 8: drawdown_attribution
  server.registerTool(
    "drawdown_attribution",
    {
      description:
        "Identify which strategies contributed most to losses during the portfolio's maximum drawdown period. Shows drawdown period (peak to trough) and per-strategy P/L attribution.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe(
            "Optional: Filter to specific strategy before calculating drawdown"
          ),
        topN: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(5)
          .describe("Number of top contributors to return (default: 5)"),
      }),
    },
    async ({ blockId, strategy, topN }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply strategy filter if provided
        trades = filterByStrategy(trades, strategy);

        if (trades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No trades found${strategy ? ` for strategy "${strategy}"` : ""}.`,
              },
            ],
          };
        }

        // Sort trades by close date/time for equity curve
        const sortedTrades = [...trades].sort((a, b) => {
          const dateA = new Date(a.dateClosed ?? a.dateOpened);
          const dateB = new Date(b.dateClosed ?? b.dateOpened);
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
          }
          // Secondary sort by close time if dates equal
          const timeA = a.timeClosed ?? a.timeOpened ?? "";
          const timeB = b.timeClosed ?? b.timeOpened ?? "";
          return timeA.localeCompare(timeB);
        });

        // Build equity curve from trades
        // Initial capital = first trade's fundsAtClose - pl
        const firstTrade = sortedTrades[0];
        const initialCapital =
          (firstTrade.fundsAtClose ?? 10000) - firstTrade.pl;

        // Track peak equity and drawdown
        let equity = initialCapital;
        let peakEquity = initialCapital;
        let peakDate: Date = new Date(
          firstTrade.dateClosed ?? firstTrade.dateOpened
        );
        let maxDrawdown = 0;
        let maxDrawdownPct = 0;
        let troughDate: Date | null = null;
        let drawdownPeakDate: Date | null = null;

        // Track equity at each trade close
        interface EquityPoint {
          date: Date;
          equity: number;
          drawdownPct: number;
          trade: Trade;
        }
        const equityPoints: EquityPoint[] = [];

        for (const trade of sortedTrades) {
          equity += trade.pl;
          const closeDate = new Date(trade.dateClosed ?? trade.dateOpened);

          // Update peak if new high
          if (equity > peakEquity) {
            peakEquity = equity;
            peakDate = closeDate;
          }

          // Calculate current drawdown from peak
          const drawdown = peakEquity - equity;
          const drawdownPct = peakEquity > 0 ? (drawdown / peakEquity) * 100 : 0;

          equityPoints.push({
            date: closeDate,
            equity,
            drawdownPct,
            trade,
          });

          // Track max drawdown
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
            maxDrawdownPct = drawdownPct;
            troughDate = closeDate;
            drawdownPeakDate = peakDate;
          }
        }

        // Handle edge case: no drawdown (always at peak or single trade)
        if (maxDrawdown <= 0 || !troughDate || !drawdownPeakDate) {
          const summary = `Drawdown Attribution: ${blockId}${strategy ? ` (${strategy})` : ""} | No drawdown detected (equity never declined from peak)`;

          const structuredData = {
            blockId,
            filters: { strategy: strategy ?? null },
            drawdownPeriod: null,
            attribution: [],
            message: "No drawdown detected - equity never declined from peak",
          };

          return createToolOutput(summary, structuredData);
        }

        // Filter trades to the drawdown period (closed between peak and trough)
        const drawdownTrades = sortedTrades.filter((trade) => {
          const closeDate = new Date(trade.dateClosed ?? trade.dateOpened);
          return closeDate >= drawdownPeakDate! && closeDate <= troughDate!;
        });

        // Group trades by strategy and calculate attribution
        const strategyPl: Map<
          string,
          { pl: number; trades: number; wins: number; losses: number }
        > = new Map();

        let totalLossDuringDrawdown = 0;

        for (const trade of drawdownTrades) {
          const existing = strategyPl.get(trade.strategy) ?? {
            pl: 0,
            trades: 0,
            wins: 0,
            losses: 0,
          };
          existing.pl += trade.pl;
          existing.trades += 1;
          if (trade.pl > 0) existing.wins += 1;
          else if (trade.pl < 0) existing.losses += 1;
          strategyPl.set(trade.strategy, existing);

          // Track total P/L during drawdown period
          totalLossDuringDrawdown += trade.pl;
        }

        // Calculate contribution percentages and sort by P/L (most negative first)
        const attribution = Array.from(strategyPl.entries())
          .map(([strategyName, data]) => ({
            strategy: strategyName,
            pl: data.pl,
            trades: data.trades,
            wins: data.wins,
            losses: data.losses,
            // Contribution percentage: strategy's P/L as % of total loss
            // If total loss is negative, most negative strategy has highest contribution
            contributionPct:
              totalLossDuringDrawdown !== 0
                ? Math.abs((data.pl / totalLossDuringDrawdown) * 100)
                : 0,
          }))
          .sort((a, b) => a.pl - b.pl) // Most negative first
          .slice(0, topN);

        // Calculate duration in days
        const durationMs = troughDate.getTime() - drawdownPeakDate.getTime();
        const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

        // Format dates
        const formatDate = (d: Date) => d.toISOString().split("T")[0];
        const peakDateStr = formatDate(drawdownPeakDate);
        const troughDateStr = formatDate(troughDate);

        // Build summary
        const topContributor = attribution[0];
        const summary = `Drawdown Attribution: ${blockId}${strategy ? ` (${strategy})` : ""} | Max DD: ${formatPercent(maxDrawdownPct)} | ${peakDateStr} to ${troughDateStr} | Top contributor: ${topContributor?.strategy ?? "N/A"} (${formatCurrency(topContributor?.pl ?? 0)})`;

        // Build structured data
        const structuredData = {
          blockId,
          filters: { strategy: strategy ?? null, topN },
          drawdownPeriod: {
            peakDate: peakDateStr,
            troughDate: troughDateStr,
            peakEquity: peakEquity,
            troughEquity: peakEquity - maxDrawdown,
            maxDrawdown: maxDrawdown,
            maxDrawdownPct: maxDrawdownPct,
            durationDays: durationDays,
          },
          periodStats: {
            totalTrades: drawdownTrades.length,
            totalPl: totalLossDuringDrawdown,
          },
          attribution,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error calculating drawdown attribution: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 9: marginal_contribution
  server.registerTool(
    "marginal_contribution",
    {
      description:
        "Calculate how each strategy affects portfolio risk-adjusted returns (Sharpe/Sortino). Shows marginal contribution: positive means strategy IMPROVES the ratio, negative means it HURTS.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        targetStrategy: z
          .string()
          .optional()
          .describe(
            "Calculate for specific strategy only. If omitted, calculates for all strategies."
          ),
        topN: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(5)
          .describe("Number of top contributors to return when targetStrategy is omitted (default: 5)"),
      }),
    },
    async ({ blockId, targetStrategy, topN }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        const trades = block.trades;

        if (trades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No trades found in block "${blockId}".`,
              },
            ],
          };
        }

        // Get unique strategies
        const strategies = Array.from(new Set(trades.map((t) => t.strategy))).sort();

        // Validate targetStrategy if provided
        if (targetStrategy) {
          const matchedStrategy = strategies.find(
            (s) => s.toLowerCase() === targetStrategy.toLowerCase()
          );
          if (!matchedStrategy) {
            return {
              content: [
                {
                  type: "text",
                  text: `Strategy "${targetStrategy}" not found in block. Available: ${strategies.join(", ")}`,
                },
              ],
              isError: true,
            };
          }
        }

        // Edge case: single strategy portfolio
        if (strategies.length === 1) {
          const baselineStats = calculator.calculatePortfolioStats(
            trades,
            undefined, // No daily logs per Phase 17 constraint
            true // Force trade-based calculations
          );

          const summary = `Marginal Contribution: ${blockId} | Single strategy portfolio - cannot calculate marginal contribution`;

          const structuredData = {
            blockId,
            filters: { targetStrategy: targetStrategy ?? null, topN },
            baseline: {
              totalStrategies: 1,
              totalTrades: trades.length,
              sharpeRatio: baselineStats.sharpeRatio,
              sortinoRatio: baselineStats.sortinoRatio,
            },
            contributions: [
              {
                strategy: strategies[0],
                trades: trades.length,
                marginalSharpe: null,
                marginalSortino: null,
                interpretation: "only-strategy",
              },
            ],
            summary: {
              mostBeneficial: null,
              leastBeneficial: null,
            },
            message: "Single strategy portfolio - marginal contribution cannot be calculated (no 'without' comparison possible)",
          };

          return createToolOutput(summary, structuredData);
        }

        // Calculate baseline portfolio metrics using ALL trades
        const baselineStats = calculator.calculatePortfolioStats(
          trades,
          undefined, // No daily logs per Phase 17 constraint
          true // Force trade-based calculations
        );

        // Determine which strategies to analyze
        const strategiesToAnalyze = targetStrategy
          ? strategies.filter(
              (s) => s.toLowerCase() === targetStrategy.toLowerCase()
            )
          : strategies;

        // Calculate marginal contribution for each strategy
        const contributions: Array<{
          strategy: string;
          trades: number;
          marginalSharpe: number | null;
          marginalSortino: number | null;
          interpretation: string;
        }> = [];

        for (const strategy of strategiesToAnalyze) {
          // Filter OUT this strategy's trades (portfolio WITHOUT this strategy)
          const tradesWithout = trades.filter(
            (t) => t.strategy.toLowerCase() !== strategy.toLowerCase()
          );
          const strategyTrades = trades.filter(
            (t) => t.strategy.toLowerCase() === strategy.toLowerCase()
          );

          // Edge case: removing this strategy leaves nothing
          if (tradesWithout.length === 0) {
            contributions.push({
              strategy,
              trades: strategyTrades.length,
              marginalSharpe: null,
              marginalSortino: null,
              interpretation: "only-strategy",
            });
            continue;
          }

          // Calculate "without" portfolio metrics
          const withoutStats = calculator.calculatePortfolioStats(
            tradesWithout,
            undefined,
            true
          );

          // Marginal contribution = baseline - without
          // Positive = strategy IMPROVES the ratio (removing it hurts)
          // Negative = strategy HURTS the ratio (removing it helps)
          const marginalSharpe =
            baselineStats.sharpeRatio !== null &&
            baselineStats.sharpeRatio !== undefined &&
            withoutStats.sharpeRatio !== null &&
            withoutStats.sharpeRatio !== undefined
              ? baselineStats.sharpeRatio - withoutStats.sharpeRatio
              : null;

          const marginalSortino =
            baselineStats.sortinoRatio !== null &&
            baselineStats.sortinoRatio !== undefined &&
            withoutStats.sortinoRatio !== null &&
            withoutStats.sortinoRatio !== undefined
              ? baselineStats.sortinoRatio - withoutStats.sortinoRatio
              : null;

          // Determine interpretation based on marginal Sharpe
          let interpretation: string;
          if (marginalSharpe === null) {
            interpretation = "unknown";
          } else if (Math.abs(marginalSharpe) < 0.01) {
            interpretation = "negligible";
          } else if (marginalSharpe > 0) {
            interpretation = "improves";
          } else {
            interpretation = "hurts";
          }

          contributions.push({
            strategy,
            trades: strategyTrades.length,
            marginalSharpe,
            marginalSortino,
            interpretation,
          });
        }

        // Sort by marginal Sharpe (most positive/beneficial first)
        contributions.sort((a, b) => {
          // Put null values last
          if (a.marginalSharpe === null && b.marginalSharpe === null) return 0;
          if (a.marginalSharpe === null) return 1;
          if (b.marginalSharpe === null) return -1;
          return b.marginalSharpe - a.marginalSharpe; // Descending (most beneficial first)
        });

        // Apply topN limit (only when not filtering by targetStrategy)
        const limitedContributions = targetStrategy
          ? contributions
          : contributions.slice(0, topN);

        // Find most and least beneficial
        const validContributions = contributions.filter(
          (c) => c.marginalSharpe !== null
        );
        const mostBeneficial =
          validContributions.length > 0
            ? {
                strategy: validContributions[0].strategy,
                sharpe: validContributions[0].marginalSharpe,
              }
            : null;
        const leastBeneficial =
          validContributions.length > 0
            ? {
                strategy: validContributions[validContributions.length - 1].strategy,
                sharpe: validContributions[validContributions.length - 1].marginalSharpe,
              }
            : null;

        // Build summary line
        const summaryParts: string[] = [`Marginal Contribution: ${blockId}`];
        if (mostBeneficial && mostBeneficial.sharpe !== null) {
          const sharpeStr = mostBeneficial.sharpe >= 0
            ? `+${formatRatio(mostBeneficial.sharpe)}`
            : formatRatio(mostBeneficial.sharpe);
          summaryParts.push(`Top: ${mostBeneficial.strategy} (Sharpe ${sharpeStr})`);
        }
        if (leastBeneficial && leastBeneficial.sharpe !== null && leastBeneficial.strategy !== mostBeneficial?.strategy) {
          const sharpeStr = leastBeneficial.sharpe >= 0
            ? `+${formatRatio(leastBeneficial.sharpe)}`
            : formatRatio(leastBeneficial.sharpe);
          summaryParts.push(`Worst: ${leastBeneficial.strategy} (Sharpe ${sharpeStr})`);
        }
        const summary = summaryParts.join(" | ");

        // Build structured data
        const structuredData = {
          blockId,
          filters: { targetStrategy: targetStrategy ?? null, topN },
          baseline: {
            totalStrategies: strategies.length,
            totalTrades: trades.length,
            sharpeRatio: baselineStats.sharpeRatio,
            sortinoRatio: baselineStats.sortinoRatio,
          },
          contributions: limitedContributions,
          summary: {
            mostBeneficial,
            leastBeneficial,
          },
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error calculating marginal contribution: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 10: strategy_similarity
  server.registerTool(
    "strategy_similarity",
    {
      description:
        "Detect potentially redundant strategies based on correlation, tail dependence, and trading day overlap. Flags strategy pairs that may be adding risk without diversification benefit.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        correlationThreshold: z
          .number()
          .min(0)
          .max(1)
          .default(0.7)
          .describe("Minimum correlation to flag as similar (default: 0.7)"),
        tailDependenceThreshold: z
          .number()
          .min(0)
          .max(1)
          .default(0.5)
          .describe("Minimum tail dependence to flag as high joint risk (default: 0.5)"),
        method: z
          .enum(["kendall", "spearman", "pearson"])
          .default("kendall")
          .describe("Correlation method (default: kendall)"),
        minSharedDays: z
          .number()
          .int()
          .min(1)
          .default(30)
          .describe("Minimum shared trading days for valid comparison (default: 30)"),
        topN: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(5)
          .describe("Number of most similar pairs to return (default: 5)"),
      }),
    },
    async ({ blockId, correlationThreshold, tailDependenceThreshold, method, minSharedDays, topN }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        const trades = block.trades;

        if (trades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No trades found in block "${blockId}".`,
              },
            ],
          };
        }

        // Get unique strategies
        const strategies = Array.from(new Set(trades.map((t) => t.strategy))).sort();

        // Need at least 2 strategies for similarity analysis
        if (strategies.length < 2) {
          return {
            content: [
              {
                type: "text",
                text: `Strategy similarity requires at least 2 strategies. Found ${strategies.length} strategy in block "${blockId}".`,
              },
            ],
            isError: true,
          };
        }

        // Calculate correlation matrix using existing utility
        const correlationMatrix = calculateCorrelationMatrix(trades, {
          method: method,
          normalization: "raw",
          dateBasis: "opened",
          alignment: "shared",
        });

        // Calculate tail risk using existing utility
        const tailRisk = performTailRiskAnalysis(trades, {
          normalization: "raw",
          dateBasis: "opened",
          minTradingDays: minSharedDays,
        });

        // Calculate overlap scores: count shared trading days / total unique days
        // Group trades by strategy and date
        const strategyDates: Record<string, Set<string>> = {};
        for (const trade of trades) {
          if (!trade.strategy || !trade.dateOpened) continue;
          if (!strategyDates[trade.strategy]) {
            strategyDates[trade.strategy] = new Set();
          }
          // Extract date key from dateOpened
          const dateKey = trade.dateOpened.toISOString().split("T")[0];
          strategyDates[trade.strategy].add(dateKey);
        }

        // Build similarity pairs
        interface SimilarPair {
          strategyA: string;
          strategyB: string;
          correlation: number | null;
          tailDependence: number | null;
          overlapScore: number;
          compositeSimilarity: number | null;
          sharedTradingDays: number;
          flags: {
            isHighCorrelation: boolean;
            isHighTailDependence: boolean;
            isRedundant: boolean;
          };
          recommendation: string | null;
        }

        const pairs: SimilarPair[] = [];
        let redundantPairs = 0;
        let highCorrelationPairs = 0;
        let highTailDependencePairs = 0;

        // Iterate over unique strategy pairs (i < j)
        for (let i = 0; i < strategies.length; i++) {
          for (let j = i + 1; j < strategies.length; j++) {
            const strategyA = strategies[i];
            const strategyB = strategies[j];

            // Get correlation from matrix
            const idxA = correlationMatrix.strategies.indexOf(strategyA);
            const idxB = correlationMatrix.strategies.indexOf(strategyB);
            const correlation =
              idxA >= 0 && idxB >= 0 && correlationMatrix.correlationData[idxA]
                ? correlationMatrix.correlationData[idxA][idxB]
                : null;
            const sharedDaysFromCorr =
              idxA >= 0 && idxB >= 0 && correlationMatrix.sampleSizes[idxA]
                ? correlationMatrix.sampleSizes[idxA][idxB]
                : 0;

            // Get tail dependence from jointTailRiskMatrix
            const tailIdxA = tailRisk.strategies.indexOf(strategyA);
            const tailIdxB = tailRisk.strategies.indexOf(strategyB);
            let tailDependence: number | null = null;
            if (
              tailIdxA >= 0 &&
              tailIdxB >= 0 &&
              tailRisk.jointTailRiskMatrix[tailIdxA] &&
              tailRisk.jointTailRiskMatrix[tailIdxB]
            ) {
              // Average both directions since matrix can be asymmetric
              const valAB = tailRisk.jointTailRiskMatrix[tailIdxA][tailIdxB];
              const valBA = tailRisk.jointTailRiskMatrix[tailIdxB][tailIdxA];
              if (!Number.isNaN(valAB) && !Number.isNaN(valBA)) {
                tailDependence = (valAB + valBA) / 2;
              }
            }

            // Calculate overlap score
            const datesA = strategyDates[strategyA] || new Set();
            const datesB = strategyDates[strategyB] || new Set();
            const allDates = new Set([...datesA, ...datesB]);
            const sharedDates = [...datesA].filter((d) => datesB.has(d)).length;
            const overlapScore = allDates.size > 0 ? sharedDates / allDates.size : 0;

            // Use sharedDaysFromCorr or calculate from overlap
            const sharedTradingDays = sharedDaysFromCorr > 0 ? sharedDaysFromCorr : sharedDates;

            // Calculate composite similarity score (weighted average)
            // 50% correlation (absolute value), 30% tail dependence, 20% overlap score
            let compositeSimilarity: number | null = null;
            if (correlation !== null && !Number.isNaN(correlation)) {
              const corrComponent = Math.abs(correlation) * 0.5;
              const tailComponent = (tailDependence !== null ? tailDependence : 0) * 0.3;
              const overlapComponent = overlapScore * 0.2;
              compositeSimilarity = corrComponent + tailComponent + overlapComponent;
            }

            // Determine flags
            const isHighCorrelation =
              correlation !== null && !Number.isNaN(correlation) && Math.abs(correlation) >= correlationThreshold;
            const isHighTailDependence =
              tailDependence !== null && tailDependence >= tailDependenceThreshold;
            const isRedundant = isHighCorrelation && isHighTailDependence;

            // Update counters
            if (isHighCorrelation) highCorrelationPairs++;
            if (isHighTailDependence) highTailDependencePairs++;
            if (isRedundant) redundantPairs++;

            // Generate recommendation
            let recommendation: string | null = null;
            if (isRedundant) {
              recommendation = "Consider consolidating - these strategies move together and suffer losses together";
            } else if (isHighCorrelation) {
              recommendation = "Moderate redundancy - correlated returns reduce diversification benefit";
            } else if (isHighTailDependence) {
              recommendation = "Tail risk overlap - may amplify losses during market stress";
            }

            pairs.push({
              strategyA,
              strategyB,
              correlation: correlation !== null && !Number.isNaN(correlation) ? correlation : null,
              tailDependence,
              overlapScore,
              compositeSimilarity,
              sharedTradingDays,
              flags: {
                isHighCorrelation,
                isHighTailDependence,
                isRedundant,
              },
              recommendation,
            });
          }
        }

        // Sort by composite similarity (highest first), handling nulls
        pairs.sort((a, b) => {
          if (a.compositeSimilarity === null && b.compositeSimilarity === null) return 0;
          if (a.compositeSimilarity === null) return 1;
          if (b.compositeSimilarity === null) return -1;
          return b.compositeSimilarity - a.compositeSimilarity;
        });

        // Apply topN limit
        const topPairs = pairs.slice(0, topN);

        // Build recommendations list
        const recommendations: string[] = [];
        for (const pair of topPairs) {
          if (pair.flags.isRedundant) {
            recommendations.push(
              `Pair ${pair.strategyA}-${pair.strategyB} flagged as redundant: high correlation (${pair.correlation?.toFixed(2) ?? "N/A"}) + high tail dependence (${pair.tailDependence?.toFixed(2) ?? "N/A"})`
            );
            recommendations.push(
              `Consider removing one of ${pair.strategyA} or ${pair.strategyB} to reduce concentrated risk`
            );
          }
        }

        // Build summary line
        const mostSimilar = topPairs[0];
        const summary = `Strategy Similarity: ${blockId} | ${strategies.length} strategies | ${redundantPairs} redundant pairs | Most similar: ${mostSimilar ? `${mostSimilar.strategyA}-${mostSimilar.strategyB} (${mostSimilar.compositeSimilarity?.toFixed(2) ?? "N/A"})` : "N/A"}`;

        // Build structured data
        const structuredData = {
          blockId,
          options: {
            correlationThreshold,
            tailDependenceThreshold,
            method,
            minSharedDays,
            topN,
          },
          strategySummary: {
            totalStrategies: strategies.length,
            totalPairs: (strategies.length * (strategies.length - 1)) / 2,
            redundantPairs,
            highCorrelationPairs,
            highTailDependencePairs,
          },
          similarPairs: topPairs,
          recommendations,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error calculating strategy similarity: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 11: get_trades
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

        // Calculate pagination info
        const totalTrades = trades.length;
        const totalPages = Math.ceil(totalTrades / pageSize);
        const startIdx = (page - 1) * pageSize;
        const endIdx = Math.min(startIdx + pageSize, totalTrades);
        const pageTrades = trades.slice(startIdx, endIdx);

        // Brief summary for user display
        const summary = `Trades: ${blockId} | Page ${page}/${totalPages} | ${startIdx + 1}-${endIdx} of ${totalTrades} trades`;

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

        return createToolOutput(summary, structuredData);
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
