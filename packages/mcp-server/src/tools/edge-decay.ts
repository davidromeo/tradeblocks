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
}
