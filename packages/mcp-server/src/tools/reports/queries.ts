/**
 * Report Query Tools
 *
 * Tools for running filtered queries and aggregations: run_filtered_query, aggregate_by_field
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock } from "../../utils/block-loader.js";
import { createToolOutput, formatPercent } from "../../utils/output-formatter.js";
import { filterByStrategy, filterByDateRange } from "../shared/filters.js";
import {
  enrichTrades,
  getTradeFieldValue,
  applyFilterConditions,
  type EnrichedTrade,
} from "./helpers.js";

/**
 * Register query-related report tools
 */
export function registerQueryTools(server: McpServer, baseDir: string): void {
  // Tool 2: run_filtered_query
  server.registerTool(
    "run_filtered_query",
    {
      description:
        "Apply filter conditions to trades and return matching count, statistics, and sample trades",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        conditions: z
          .array(
            z.object({
              field: z
                .string()
                .describe(
                  "Field name to filter on (e.g., 'openingVix', 'pl', 'rom')"
                ),
              operator: z
                .enum(["eq", "neq", "gt", "gte", "lt", "lte", "between"])
                .describe("Comparison operator"),
              value: z.number().describe("Primary comparison value"),
              value2: z
                .number()
                .optional()
                .describe("Secondary value for 'between' operator"),
            })
          )
          .describe("Array of filter conditions to apply"),
        logic: z
          .enum(["and", "or"])
          .default("and")
          .describe(
            "How to combine conditions: 'and' (all must match) or 'or' (any can match)"
          ),
        strategy: z
          .string()
          .optional()
          .describe("Pre-filter by strategy name (case-insensitive)"),
        startDate: z
          .string()
          .optional()
          .describe("Pre-filter by start date (YYYY-MM-DD)"),
        endDate: z
          .string()
          .optional()
          .describe("Pre-filter by end date (YYYY-MM-DD)"),
        includeSampleTrades: z
          .boolean()
          .default(true)
          .describe(
            "Include sample matching trades in response (default: true)"
          ),
        sampleSize: z
          .number()
          .min(1)
          .max(20)
          .default(5)
          .describe("Number of sample trades to include (default: 5, max: 20)"),
      }),
    },
    async ({
      blockId,
      conditions,
      logic,
      strategy,
      startDate,
      endDate,
      includeSampleTrades,
      sampleSize,
    }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply pre-filters
        trades = filterByStrategy(trades, strategy);
        trades = filterByDateRange(trades, startDate, endDate);

        const totalBeforeConditions = trades.length;

        // Enrich trades for filtering
        const enrichedTrades = enrichTrades(trades);

        // Apply filter conditions
        const matchingTrades = applyFilterConditions(
          enrichedTrades,
          conditions,
          logic
        );

        const matchCount = matchingTrades.length;
        const matchPercent =
          totalBeforeConditions > 0
            ? (matchCount / totalBeforeConditions) * 100
            : 0;

        // Calculate basic stats on matching trades
        const pls = matchingTrades.map((t) => t.pl);
        const totalPl = pls.reduce((a, b) => a + b, 0);
        const avgPl = matchCount > 0 ? totalPl / matchCount : 0;
        const winningTrades = matchingTrades.filter((t) => t.pl > 0).length;
        const winRate = matchCount > 0 ? winningTrades / matchCount : 0;

        // Build sample trades if requested
        let sampleTradesData: Array<{
          dateOpened: string;
          strategy: string;
          pl: number;
          rom?: number;
          openingVix?: number;
        }> = [];

        if (includeSampleTrades && matchCount > 0) {
          const samples = matchingTrades.slice(0, sampleSize);
          sampleTradesData = samples.map((t) => ({
            dateOpened: new Date(t.dateOpened).toISOString().split("T")[0],
            strategy: t.strategy,
            pl: t.pl,
            rom: t.rom,
            openingVix: t.openingVix,
          }));
        }

        // Brief summary
        const summary = `Filter results: ${matchCount}/${totalBeforeConditions} trades (${formatPercent(matchPercent)}) | Total P/L: $${totalPl.toFixed(2)} | Win Rate: ${formatPercent(winRate * 100)}`;

        const structuredData = {
          blockId,
          filters: {
            strategy: strategy ?? null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            conditions,
            logic,
          },
          results: {
            totalCount: totalBeforeConditions,
            matchCount,
            matchPercent,
          },
          stats: {
            totalPl,
            avgPl,
            winningTrades,
            losingTrades: matchCount - winningTrades,
            winRate,
          },
          sampleTrades: includeSampleTrades ? sampleTradesData : null,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error running filtered query: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 4: aggregate_by_field
  server.registerTool(
    "aggregate_by_field",
    {
      description:
        "Bucket trades by a field using custom edges and calculate aggregate metrics for each bucket",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        groupByField: z
          .string()
          .describe(
            "Field to bucket trades by (e.g., 'openingVix', 'dayOfWeek', 'hourOfDay')"
          ),
        bucketEdges: z
          .array(z.number())
          .min(2)
          .describe(
            "Array of bucket edge values. Creates N-1 buckets from N edges. Example: [10, 15, 20, 25] creates buckets: 10-15, 15-20, 20-25"
          ),
        metrics: z
          .array(
            z.enum([
              "count",
              "winRate",
              "avgPl",
              "totalPl",
              "avgRom",
              "avgMfePercent",
              "avgMaePercent",
            ])
          )
          .default(["count", "winRate", "avgPl", "totalPl"])
          .describe(
            "Metrics to calculate for each bucket (default: count, winRate, avgPl, totalPl)"
          ),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        startDate: z
          .string()
          .optional()
          .describe("Filter by start date (YYYY-MM-DD)"),
        endDate: z
          .string()
          .optional()
          .describe("Filter by end date (YYYY-MM-DD)"),
        includeOutOfRange: z
          .boolean()
          .default(true)
          .describe(
            "Include trades that fall outside bucket edges in separate buckets (default: true)"
          ),
      }),
    },
    async ({
      blockId,
      groupByField,
      bucketEdges,
      metrics,
      strategy,
      startDate,
      endDate,
      includeOutOfRange,
    }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply pre-filters
        trades = filterByStrategy(trades, strategy);
        trades = filterByDateRange(trades, startDate, endDate);

        if (trades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No trades found matching the specified filters.",
              },
            ],
          };
        }

        // Enrich trades
        const enrichedTrades = enrichTrades(trades);

        // Sort bucket edges
        const sortedEdges = [...bucketEdges].sort((a, b) => a - b);

        // Define bucket structure
        interface BucketData {
          label: string;
          min: number | null;
          max: number | null;
          trades: EnrichedTrade[];
        }

        // Create buckets
        const buckets: BucketData[] = [];

        // Add "below" bucket if includeOutOfRange
        if (includeOutOfRange) {
          buckets.push({
            label: `< ${sortedEdges[0]}`,
            min: null,
            max: sortedEdges[0],
            trades: [],
          });
        }

        // Add main buckets
        for (let i = 0; i < sortedEdges.length - 1; i++) {
          buckets.push({
            label: `${sortedEdges[i]} - ${sortedEdges[i + 1]}`,
            min: sortedEdges[i],
            max: sortedEdges[i + 1],
            trades: [],
          });
        }

        // Add "above" bucket if includeOutOfRange
        if (includeOutOfRange) {
          buckets.push({
            label: `>= ${sortedEdges[sortedEdges.length - 1]}`,
            min: sortedEdges[sortedEdges.length - 1],
            max: null,
            trades: [],
          });
        }

        // Assign trades to buckets
        for (const trade of enrichedTrades) {
          const value = getTradeFieldValue(trade, groupByField);
          if (value === null) continue;

          // Find the appropriate bucket
          let assigned = false;

          // Check main buckets (between edges)
          for (let i = 0; i < sortedEdges.length - 1; i++) {
            const bucketIndex = includeOutOfRange ? i + 1 : i;
            if (value >= sortedEdges[i] && value < sortedEdges[i + 1]) {
              buckets[bucketIndex].trades.push(trade);
              assigned = true;
              break;
            }
          }

          // Handle edge cases if not assigned
          if (!assigned && includeOutOfRange) {
            if (value < sortedEdges[0]) {
              buckets[0].trades.push(trade);
            } else if (value >= sortedEdges[sortedEdges.length - 1]) {
              buckets[buckets.length - 1].trades.push(trade);
            }
          }
        }

        // Calculate metrics for each bucket
        const bucketResults: Array<{
          label: string;
          min: number | null;
          max: number | null;
          count: number;
          winRate?: number;
          avgPl?: number;
          totalPl?: number;
          avgRom?: number;
          avgMfePercent?: number;
          avgMaePercent?: number;
        }> = [];

        for (const bucket of buckets) {
          const result: (typeof bucketResults)[0] = {
            label: bucket.label,
            min: bucket.min,
            max: bucket.max,
            count: bucket.trades.length,
          };

          if (bucket.trades.length > 0) {
            const bucketPls = bucket.trades.map((t) => t.pl);
            const totalPl = bucketPls.reduce((a, b) => a + b, 0);
            const winningTrades = bucket.trades.filter((t) => t.pl > 0).length;

            if (metrics.includes("winRate")) {
              result.winRate = winningTrades / bucket.trades.length;
            }
            if (metrics.includes("avgPl")) {
              result.avgPl = totalPl / bucket.trades.length;
            }
            if (metrics.includes("totalPl")) {
              result.totalPl = totalPl;
            }
            if (metrics.includes("avgRom")) {
              const romValues = bucket.trades
                .map((t) => t.rom)
                .filter((v): v is number => v !== undefined);
              result.avgRom =
                romValues.length > 0
                  ? romValues.reduce((a, b) => a + b, 0) / romValues.length
                  : undefined;
            }
            if (metrics.includes("avgMfePercent")) {
              const mfeValues = bucket.trades
                .map((t) => t.mfePercent)
                .filter((v): v is number => v !== undefined);
              result.avgMfePercent =
                mfeValues.length > 0
                  ? mfeValues.reduce((a, b) => a + b, 0) / mfeValues.length
                  : undefined;
            }
            if (metrics.includes("avgMaePercent")) {
              const maeValues = bucket.trades
                .map((t) => t.maePercent)
                .filter((v): v is number => v !== undefined);
              result.avgMaePercent =
                maeValues.length > 0
                  ? maeValues.reduce((a, b) => a + b, 0) / maeValues.length
                  : undefined;
            }
          }

          bucketResults.push(result);
        }

        // Calculate totals
        const totalAssigned = bucketResults.reduce(
          (sum, b) => sum + b.count,
          0
        );
        const totalUnassigned = enrichedTrades.length - totalAssigned;

        // Brief summary
        const nonEmptyBuckets = bucketResults.filter((b) => b.count > 0).length;
        const summary = `Aggregation by "${groupByField}": ${nonEmptyBuckets} buckets with data | ${totalAssigned} trades assigned`;

        const structuredData = {
          blockId,
          groupByField,
          bucketEdges: sortedEdges,
          filters: {
            strategy: strategy ?? null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
          },
          metrics,
          buckets: bucketResults,
          summary: {
            totalTrades: enrichedTrades.length,
            assignedTrades: totalAssigned,
            unassignedTrades: totalUnassigned,
            bucketsWithData: nonEmptyBuckets,
            totalBuckets: bucketResults.length,
          },
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error aggregating by field: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
