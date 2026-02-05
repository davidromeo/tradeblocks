/**
 * Edge Decay Analysis Tools
 *
 * MCP tools for period segmentation and rolling metrics analysis.
 * Foundation for edge decay detection in trading strategies.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock } from "../utils/block-loader.js";
import { createToolOutput } from "../utils/output-formatter.js";
import { withSyncedBlock } from "./middleware/sync-middleware.js";
import {
  segmentByPeriod,
  computeRollingMetrics,
  runRegimeComparison,
} from "@tradeblocks/lib";
import type { Trade } from "@tradeblocks/lib";

/**
 * Filter trades by strategy (case-insensitive)
 */
function filterByStrategy(trades: Trade[], strategy?: string): Trade[] {
  if (!strategy) return trades;
  return trades.filter(
    (t) => t.strategy.toLowerCase() === strategy.toLowerCase()
  );
}

/**
 * Register edge decay analysis MCP tools
 */
export function registerEdgeDecayTools(
  server: McpServer,
  baseDir: string
): void {
  // Tool 1: analyze_period_metrics
  server.registerTool(
    "analyze_period_metrics",
    {
      description:
        "Segment a block's trades by year, quarter, and month with per-period statistics, trend detection via linear regression, and worst consecutive losing month identification. Foundation for edge decay analysis.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
      }),
    },
    withSyncedBlock(baseDir, async ({ blockId, strategy }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply strategy filter
        trades = filterByStrategy(trades, strategy);

        if (trades.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: strategy
                  ? `No trades found for strategy "${strategy}" in block "${blockId}".`
                  : `No trades found in block "${blockId}".`,
              },
            ],
            isError: true as const,
          };
        }

        const result = segmentByPeriod(trades);

        // Build summary
        const yearCount = result.yearly.length;
        const quarterCount = result.quarterly.length;
        const winRateSlope =
          result.trends.yearly.winRate?.slope !== undefined
            ? result.trends.yearly.winRate.slope.toFixed(4)
            : "N/A";
        const worstStretch = result.worstConsecutiveLosingMonths.allTime;
        const worstDesc = worstStretch
          ? `${worstStretch.months} months (${worstStretch.startMonth} to ${worstStretch.endMonth})`
          : "none";

        const summary = `Period metrics for ${blockId}${strategy ? ` (${strategy})` : ""}: ${result.dataQuality.totalTrades} trades across ${yearCount} years\nYearly trend (win rate slope): ${winRateSlope}, Quarterly periods: ${quarterCount}\nWorst losing streak: ${worstDesc}`;

        const structuredData = {
          blockId,
          strategy: strategy ?? null,
          yearly: result.yearly,
          quarterly: result.quarterly,
          monthly: result.monthly,
          trends: result.trends,
          worstConsecutiveLosingMonths: result.worstConsecutiveLosingMonths,
          dataQuality: result.dataQuality,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error analyzing period metrics: ${(error as Error).message}`,
            },
          ],
          isError: true as const,
        };
      }
    })
  );

  // Tool 2: analyze_rolling_metrics
  server.registerTool(
    "analyze_rolling_metrics",
    {
      description:
        "Compute rolling window statistics, quarterly seasonal averages, and recent-vs-historical comparison with structural flags for a block's trades. Foundation for edge decay analysis.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        windowSize: z
          .number()
          .min(5)
          .optional()
          .describe(
            "Rolling window size in trades (default: auto-calculated based on trade count)"
          ),
        recentWindowSize: z
          .number()
          .min(10)
          .optional()
          .describe(
            "Recent window size in trades for comparison (default: auto-calculated)"
          ),
        recentWindowDays: z
          .number()
          .min(7)
          .optional()
          .describe(
            "Override: recent window as calendar days instead of trade count"
          ),
      }),
    },
    withSyncedBlock(
      baseDir,
      async ({
        blockId,
        strategy,
        windowSize,
        recentWindowSize,
        recentWindowDays,
      }) => {
        try {
          const block = await loadBlock(baseDir, blockId);
          let trades = block.trades;

          // Apply strategy filter
          trades = filterByStrategy(trades, strategy);

          if (trades.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: strategy
                    ? `No trades found for strategy "${strategy}" in block "${blockId}".`
                    : `No trades found in block "${blockId}".`,
                },
              ],
              isError: true as const,
            };
          }

          const result = computeRollingMetrics(trades, {
            windowSize,
            recentWindowSize,
            recentWindowDays,
          });

          // Build summary
          const seriesLength = result.series.length;
          const flags = result.recentVsHistorical.structuralFlags;
          const flagCount = flags.length;
          const flagNames =
            flagCount > 0
              ? flags.map((f) => f.metric).join(", ")
              : "none";

          const recentMetrics = result.recentVsHistorical.metrics;
          const recentWR =
            recentMetrics.find((m) => m.metric === "winRate")?.recentValue;
          const histWR =
            recentMetrics.find((m) => m.metric === "winRate")?.historicalValue;
          const recentPF =
            recentMetrics.find((m) => m.metric === "profitFactor")
              ?.recentValue;
          const histPF =
            recentMetrics.find((m) => m.metric === "profitFactor")
              ?.historicalValue;

          const fmtPct = (v: number | undefined) =>
            v !== undefined ? `${(v * 100).toFixed(1)}%` : "N/A";
          const fmtRatio = (v: number | undefined) =>
            v !== undefined ? v.toFixed(2) : "N/A";

          const summary = `Rolling metrics for ${blockId}${strategy ? ` (${strategy})` : ""}: ${result.dataQuality.totalTrades} trades, window=${result.windowSize}\nRolling series: ${seriesLength} data points\nStructural flags: ${flagCount} (${flagNames})\nRecent vs historical: win rate ${fmtPct(recentWR)} vs ${fmtPct(histWR)}, PF ${fmtRatio(recentPF)} vs ${fmtRatio(histPF)}`;

          const structuredData = {
            blockId,
            strategy: strategy ?? null,
            windowSize: result.windowSize,
            series: result.series,
            seasonalAverages: result.seasonalAverages,
            recentVsHistorical: result.recentVsHistorical,
            dataQuality: result.dataQuality,
          };

          return createToolOutput(summary, structuredData);
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error analyzing rolling metrics: ${(error as Error).message}`,
              },
            ],
            isError: true as const,
          };
        }
      }
    )
  );

  // Tool 3: analyze_regime_comparison
  server.registerTool(
    "analyze_regime_comparison",
    {
      description:
        "Run dual Monte Carlo simulations comparing full trade history vs recent window to detect regime divergence. Compares P(Profit), expected return, Sharpe ratio, and median max drawdown between the two periods. Classifies divergence severity as aligned, mild_divergence, significant_divergence, or regime_break.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        recentWindowSize: z
          .number()
          .min(20)
          .optional()
          .describe(
            "Number of recent trades for the recent window simulation (default: auto-calculated, typically max(20% of trades, 200))"
          ),
        numSimulations: z
          .number()
          .min(50)
          .max(10000)
          .optional()
          .describe(
            "Number of Monte Carlo simulation paths (default: 1000)"
          ),
        simulationLength: z
          .number()
          .min(10)
          .optional()
          .describe(
            "Number of trades to project forward per simulation (default: recentWindowSize)"
          ),
        randomSeed: z
          .number()
          .optional()
          .describe("Random seed for reproducibility (default: 42)"),
      }),
    },
    withSyncedBlock(
      baseDir,
      async ({
        blockId,
        strategy,
        recentWindowSize,
        numSimulations,
        simulationLength,
        randomSeed,
      }) => {
        try {
          const block = await loadBlock(baseDir, blockId);
          let trades = block.trades;

          // Apply strategy filter
          trades = filterByStrategy(trades, strategy);

          if (trades.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: strategy
                    ? `No trades found for strategy "${strategy}" in block "${blockId}".`
                    : `No trades found in block "${blockId}".`,
                },
              ],
              isError: true as const,
            };
          }

          const result = runRegimeComparison(trades, {
            recentWindowSize,
            numSimulations,
            simulationLength,
            randomSeed,
            strategy: undefined, // Already filtered above
          });

          // Build summary
          const fullPProfit = (
            result.fullHistory.statistics.probabilityOfProfit * 100
          ).toFixed(1);
          const recentPProfit = (
            result.recentWindow.statistics.probabilityOfProfit * 100
          ).toFixed(1);
          const fullSharpe =
            result.fullHistory.statistics.meanSharpeRatio.toFixed(2);
          const recentSharpe =
            result.recentWindow.statistics.meanSharpeRatio.toFixed(2);
          const severity = result.divergence.severity.replace(/_/g, " ");
          const score = result.divergence.compositeScore.toFixed(2);

          const summary = `Regime comparison for ${blockId}${strategy ? ` (${strategy})` : ""}: ${result.fullHistory.tradeCount} full / ${result.recentWindow.tradeCount} recent trades\nP(Profit): ${fullPProfit}% (full) vs ${recentPProfit}% (recent) | Sharpe: ${fullSharpe} (full) vs ${recentSharpe} (recent)\nDivergence: ${severity} (score: ${score})`;

          const structuredData = {
            blockId,
            strategy: strategy ?? null,
            fullHistory: {
              tradeCount: result.fullHistory.tradeCount,
              dateRange: result.fullHistory.dateRange,
              statistics: {
                probabilityOfProfit:
                  result.fullHistory.statistics.probabilityOfProfit,
                meanTotalReturn:
                  result.fullHistory.statistics.meanTotalReturn,
                meanSharpeRatio:
                  result.fullHistory.statistics.meanSharpeRatio,
                medianMaxDrawdown:
                  result.fullHistory.statistics.medianMaxDrawdown,
                meanFinalValue:
                  result.fullHistory.statistics.meanFinalValue,
                medianFinalValue:
                  result.fullHistory.statistics.medianFinalValue,
              },
            },
            recentWindow: {
              tradeCount: result.recentWindow.tradeCount,
              dateRange: result.recentWindow.dateRange,
              statistics: {
                probabilityOfProfit:
                  result.recentWindow.statistics.probabilityOfProfit,
                meanTotalReturn:
                  result.recentWindow.statistics.meanTotalReturn,
                meanSharpeRatio:
                  result.recentWindow.statistics.meanSharpeRatio,
                medianMaxDrawdown:
                  result.recentWindow.statistics.medianMaxDrawdown,
                meanFinalValue:
                  result.recentWindow.statistics.meanFinalValue,
                medianFinalValue:
                  result.recentWindow.statistics.medianFinalValue,
              },
            },
            comparison: result.comparison,
            divergence: result.divergence,
            parameters: result.parameters,
          };

          return createToolOutput(summary, structuredData);
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error analyzing regime comparison: ${(error as Error).message}`,
              },
            ],
            isError: true as const,
          };
        }
      }
    )
  );
}
