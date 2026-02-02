/**
 * Report Field Tools
 *
 * Tools for field listing and statistics: list_available_fields, get_field_statistics
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock } from "../../utils/block-loader.js";
import { createToolOutput } from "../../utils/output-formatter.js";
import type { FieldInfo, FieldCategory } from "@tradeblocks/lib";
import { REPORT_FIELDS, FIELD_CATEGORY_ORDER } from "@tradeblocks/lib";
import { filterByStrategy, filterByDateRange } from "../shared/filters.js";
import {
  enrichTrades,
  getTradeFieldValue,
  percentile,
  stdDev,
  generateHistogram,
} from "./helpers.js";

/**
 * Register field-related report tools
 */
export function registerFieldTools(server: McpServer, baseDir: string): void {
  // Tool 1: list_available_fields
  server.registerTool(
    "list_available_fields",
    {
      description:
        "List all fields available for filtering and analysis, grouped by category (market, returns, risk, trade, timing)",
      inputSchema: z.object({
        blockId: z
          .string()
          .describe(
            "Block folder name. Used to detect any custom fields present in the trade data."
          ),
      }),
    },
    async ({ blockId }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        const trades = block.trades;

        // Group static fields by category
        const fieldsByCategory = new Map<FieldCategory, FieldInfo[]>();
        for (const category of FIELD_CATEGORY_ORDER) {
          fieldsByCategory.set(category, []);
        }
        for (const field of REPORT_FIELDS) {
          fieldsByCategory.get(field.category)?.push(field);
        }

        // Extract custom field names from trades
        const customFieldNames = new Set<string>();
        for (const trade of trades) {
          if (trade.customFields) {
            for (const key of Object.keys(trade.customFields)) {
              customFieldNames.add(key);
            }
          }
        }

        // Build structured output
        const categories: Array<{
          category: string;
          label: string;
          fields: Array<{
            field: string;
            label: string;
            unit?: string;
            description?: string;
          }>;
        }> = [];

        const categoryLabels: Record<FieldCategory, string> = {
          market: "Market",
          returns: "Returns",
          risk: "Risk (MFE/MAE)",
          trade: "Trade Details",
          timing: "Timing",
        };

        for (const category of FIELD_CATEGORY_ORDER) {
          const fields = fieldsByCategory.get(category) ?? [];
          categories.push({
            category,
            label: categoryLabels[category],
            fields: fields.map((f) => ({
              field: f.field,
              label: f.label,
              unit: f.unit,
              description: f.description,
            })),
          });
        }

        // Add custom fields category if present
        if (customFieldNames.size > 0) {
          categories.push({
            category: "custom",
            label: "Custom (Trade)",
            fields: Array.from(customFieldNames).map((name) => ({
              field: `custom.${name}`,
              label: name,
              description: "Custom field from trade CSV",
            })),
          });
        }

        // Brief summary
        const totalFields = REPORT_FIELDS.length + customFieldNames.size;
        const summary = `Available fields: ${totalFields} fields across ${categories.length} categories`;

        const structuredData = {
          blockId,
          totalFields,
          categories,
          tradeCount: trades.length,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing fields: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 3: get_field_statistics
  server.registerTool(
    "get_field_statistics",
    {
      description:
        "Get detailed statistics for a specific field including min/max/avg/median/stdDev, percentiles, and histogram",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        field: z
          .string()
          .describe(
            "Field name to analyze (e.g., 'openingVix', 'pl', 'rom', 'mfePercent')"
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
        histogramBuckets: z
          .number()
          .min(3)
          .max(50)
          .default(10)
          .describe("Number of histogram buckets (default: 10)"),
      }),
    },
    async ({
      blockId,
      field,
      strategy,
      startDate,
      endDate,
      histogramBuckets,
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

        // Extract field values
        const values: number[] = [];
        for (const trade of enrichedTrades) {
          const value = getTradeFieldValue(trade, field);
          if (value !== null) {
            values.push(value);
          }
        }

        if (values.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `Field "${field}" has no valid numeric values in the filtered trades.`,
              },
            ],
          };
        }

        // Calculate statistics
        const sorted = [...values].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const median = percentile(sorted, 50);
        const standardDev = stdDev(values, avg);

        // Calculate percentiles
        const percentiles = {
          p5: percentile(sorted, 5),
          p10: percentile(sorted, 10),
          p25: percentile(sorted, 25),
          p50: median,
          p75: percentile(sorted, 75),
          p90: percentile(sorted, 90),
          p95: percentile(sorted, 95),
        };

        // Generate histogram
        const histogram = generateHistogram(values, histogramBuckets);

        // Brief summary
        const summary = `Field "${field}": ${values.length} values | Range: ${min.toFixed(2)} to ${max.toFixed(2)} | Avg: ${avg.toFixed(2)} | Median: ${median.toFixed(2)}`;

        const structuredData = {
          blockId,
          field,
          filters: {
            strategy: strategy ?? null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
          },
          statistics: {
            count: values.length,
            min,
            max,
            sum,
            avg,
            median,
            stdDev: standardDev,
          },
          percentiles,
          histogram,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting field statistics: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
