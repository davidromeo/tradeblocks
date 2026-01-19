/**
 * Report Builder Tools
 *
 * MCP tools for flexible trade filtering, field statistics, and aggregation.
 * Enables AI-driven analysis and custom report generation.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock } from "../utils/block-loader.js";
import { createToolOutput, formatPercent } from "../utils/output-formatter.js";
import type { Trade, FieldInfo, FieldCategory, FilterOperator } from "@tradeblocks/lib";
import { REPORT_FIELDS, FIELD_CATEGORY_ORDER, pearsonCorrelation } from "@tradeblocks/lib";

// =============================================================================
// Inline Trade Enrichment (can't import enrichTrades due to browser deps)
// =============================================================================

/**
 * Simplified enriched trade interface for MCP server
 * Contains base Trade fields plus commonly used derived fields
 */
interface EnrichedTrade extends Trade {
  // Return metrics
  rom?: number;
  plPct?: number;
  netPlPct?: number;
  // Timing
  durationHours?: number;
  dayOfWeek?: number;
  hourOfDay?: number;
  timeOfDayMinutes?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  weekOfYear?: number;
  dateOpenedTimestamp?: number;
  // Costs & Net
  totalFees?: number;
  netPl?: number;
  // VIX changes
  vixChange?: number;
  vixChangePct?: number;
  // MFE/MAE (simplified - computed from maxProfit/maxLoss if available)
  mfePercent?: number;
  maePercent?: number;
  profitCapturePercent?: number;
  excursionRatio?: number;
  rMultiple?: number;
  // Other
  isWinner?: number;
  tradeNumber?: number;
}

/**
 * Computes duration of a trade in hours
 */
function computeDurationHours(trade: Trade): number | undefined {
  if (!trade.dateClosed || !trade.timeClosed) return undefined;
  try {
    const openingDate = new Date(trade.dateOpened);
    const [openHours, openMinutes, openSeconds] = trade.timeOpened.split(":").map(Number);
    openingDate.setHours(openHours, openMinutes, openSeconds || 0, 0);

    const closingDate = new Date(trade.dateClosed);
    const [closeHours, closeMinutes, closeSeconds] = trade.timeClosed.split(":").map(Number);
    closingDate.setHours(closeHours, closeMinutes, closeSeconds || 0, 0);

    const diffMs = closingDate.getTime() - openingDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 0 ? diffHours : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract hour of day from time string
 */
function extractHourOfDay(timeOpened: string): number | undefined {
  try {
    const [hours] = timeOpened.split(":").map(Number);
    return !isNaN(hours) && hours >= 0 && hours <= 23 ? hours : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract time of day as minutes since midnight
 */
function extractTimeOfDayMinutes(timeOpened: string): number | undefined {
  try {
    const [hours, minutes] = timeOpened.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return undefined;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
    return hours * 60 + minutes;
  } catch {
    return undefined;
  }
}

/**
 * Calculate ISO week number for a date
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Enrich trades with derived fields (simplified inline version)
 * Does not include full MFE/MAE calculation (requires browser deps)
 * but computes approximations from maxProfit/maxLoss if available
 */
function enrichTrades(trades: Trade[]): EnrichedTrade[] {
  return trades.map((trade, index) => {
    const dateOpened = new Date(trade.dateOpened);
    const totalFees = trade.openingCommissionsFees + (trade.closingCommissionsFees ?? 0);
    const netPl = trade.pl - totalFees;

    // VIX changes
    const hasVixData = trade.openingVix != null && trade.closingVix != null;
    const vixChange = hasVixData ? trade.closingVix! - trade.openingVix! : undefined;
    const vixChangePct = hasVixData && trade.openingVix !== 0
      ? ((trade.closingVix! - trade.openingVix!) / trade.openingVix!) * 100
      : undefined;

    // Return metrics
    const rom = trade.marginReq > 0 ? (trade.pl / trade.marginReq) * 100 : undefined;
    const totalPremium = trade.premium * trade.numContracts;
    const plPct = totalPremium !== 0 ? (trade.pl / Math.abs(totalPremium)) * 100 : undefined;
    const netPlPct = totalPremium !== 0 ? (netPl / Math.abs(totalPremium)) * 100 : undefined;

    // MFE/MAE approximation from maxProfit/maxLoss (if available in trade data)
    let mfePercent: number | undefined;
    let maePercent: number | undefined;
    let profitCapturePercent: number | undefined;
    let excursionRatio: number | undefined;
    let rMultiple: number | undefined;

    if (trade.maxProfit !== undefined && totalPremium !== 0) {
      mfePercent = (trade.maxProfit / Math.abs(totalPremium)) * 100;
    }
    if (trade.maxLoss !== undefined && totalPremium !== 0) {
      maePercent = (Math.abs(trade.maxLoss) / Math.abs(totalPremium)) * 100;
    }
    if (mfePercent !== undefined && trade.maxProfit && trade.maxProfit > 0) {
      profitCapturePercent = (trade.pl / trade.maxProfit) * 100;
    }
    if (mfePercent !== undefined && maePercent !== undefined && maePercent > 0) {
      excursionRatio = mfePercent / maePercent;
    }
    if (trade.maxLoss !== undefined && Math.abs(trade.maxLoss) > 0) {
      rMultiple = trade.pl / Math.abs(trade.maxLoss);
    }

    return {
      ...trade,
      // Return metrics
      rom,
      plPct,
      netPlPct,
      // Timing
      durationHours: computeDurationHours(trade),
      dayOfWeek: dateOpened.getDay(),
      hourOfDay: extractHourOfDay(trade.timeOpened),
      timeOfDayMinutes: extractTimeOfDayMinutes(trade.timeOpened),
      dayOfMonth: dateOpened.getDate(),
      monthOfYear: dateOpened.getMonth() + 1,
      weekOfYear: getISOWeekNumber(dateOpened),
      dateOpenedTimestamp: dateOpened.getTime(),
      // Costs & Net
      totalFees,
      netPl,
      // VIX changes
      vixChange,
      vixChangePct,
      // MFE/MAE (approximations)
      mfePercent,
      maePercent,
      profitCapturePercent,
      excursionRatio,
      rMultiple,
      // Other
      isWinner: trade.pl > 0 ? 1 : 0,
      tradeNumber: index + 1,
    };
  });
}

// =============================================================================
// Filter Logic (inline implementation - can't import due to browser deps)
// =============================================================================

/**
 * Get the value of a field from an enriched trade
 * Returns null if the field doesn't exist or has no value
 */
function getTradeFieldValue(trade: EnrichedTrade, field: string): number | null {
  // Guard against undefined or non-string field
  if (typeof field !== 'string') {
    return null;
  }

  let value: unknown;

  // Handle custom trade fields (custom.fieldName)
  if (field.startsWith("custom.")) {
    const customFieldName = field.slice(7);
    value = trade.customFields?.[customFieldName];
  }
  // Handle daily custom fields (daily.fieldName)
  else if (field.startsWith("daily.")) {
    const dailyFieldName = field.slice(6);
    value = trade.dailyCustomFields?.[dailyFieldName];
  }
  // Handle static dataset fields (datasetName.column)
  else if (field.includes(".")) {
    const dotIndex = field.indexOf(".");
    const datasetName = field.substring(0, dotIndex);
    const columnName = field.substring(dotIndex + 1);
    value = trade.staticDatasetFields?.[datasetName]?.[columnName];
  }
  // Handle standard fields
  else {
    value = (trade as unknown as Record<string, unknown>)[field];
  }

  if (typeof value === "number" && isFinite(value)) {
    return value;
  }
  return null;
}

/**
 * Evaluate an operator comparison
 */
function evaluateOperator(
  value: number,
  operator: FilterOperator,
  compareValue: number,
  compareValue2?: number
): boolean {
  switch (operator) {
    case "eq":
      return value === compareValue;
    case "neq":
      return value !== compareValue;
    case "gt":
      return value > compareValue;
    case "gte":
      return value >= compareValue;
    case "lt":
      return value < compareValue;
    case "lte":
      return value <= compareValue;
    case "between":
      if (compareValue2 === undefined) return false;
      return value >= compareValue && value <= compareValue2;
    default:
      return false;
  }
}

/**
 * Filter condition for run_filtered_query
 */
interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: number;
  value2?: number;
}

/**
 * Apply filter conditions to trades
 */
function applyFilterConditions(
  trades: EnrichedTrade[],
  conditions: FilterCondition[],
  logic: "and" | "or"
): EnrichedTrade[] {
  if (conditions.length === 0) {
    return trades;
  }

  return trades.filter((trade) => {
    if (logic === "and") {
      return conditions.every((cond) => {
        const value = getTradeFieldValue(trade, cond.field);
        if (value === null) return false;
        return evaluateOperator(value, cond.operator, cond.value, cond.value2);
      });
    } else {
      return conditions.some((cond) => {
        const value = getTradeFieldValue(trade, cond.field);
        if (value === null) return false;
        return evaluateOperator(value, cond.operator, cond.value, cond.value2);
      });
    }
  });
}

// =============================================================================
// Shared Filtering Functions
// =============================================================================

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
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((t) => new Date(t.dateOpened) <= end);
    }
  }

  return filtered;
}

// =============================================================================
// Statistics Helpers
// =============================================================================

/**
 * Calculate percentile value from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/**
 * Calculate standard deviation
 */
function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Generate histogram buckets for a set of values
 */
function generateHistogram(
  values: number[],
  bucketCount: number = 10
): Array<{ min: number; max: number; count: number }> {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const bucketSize = range / bucketCount || 1;

  const buckets: Array<{ min: number; max: number; count: number }> = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketMin = min + i * bucketSize;
    const bucketMax = i === bucketCount - 1 ? max + 0.001 : min + (i + 1) * bucketSize;
    buckets.push({ min: bucketMin, max: bucketMax, count: 0 });
  }

  for (const value of values) {
    const bucketIndex = Math.min(
      Math.floor((value - min) / bucketSize),
      bucketCount - 1
    );
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex].count++;
    }
  }

  return buckets;
}

// =============================================================================
// Tool Registration
// =============================================================================

/**
 * Register all report builder MCP tools
 */
export function registerReportTools(server: McpServer, baseDir: string): void {
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
        const totalFields =
          REPORT_FIELDS.length + customFieldNames.size;
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
              field: z.string().describe("Field name to filter on (e.g., 'openingVix', 'pl', 'rom')"),
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
          .describe("How to combine conditions: 'and' (all must match) or 'or' (any can match)"),
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
          .describe("Include sample matching trades in response (default: true)"),
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
    async ({ blockId, field, strategy, startDate, endDate, histogramBuckets }) => {
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
          .describe("Metrics to calculate for each bucket (default: count, winRate, avgPl, totalPl)"),
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
          .describe("Include trades that fall outside bucket edges in separate buckets (default: true)"),
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
        const totalAssigned = bucketResults.reduce((sum, b) => sum + b.count, 0);
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

  // Tool 5: find_predictive_fields
  server.registerTool(
    "find_predictive_fields",
    {
      description:
        "Identify which trade entry conditions predict profitability by calculating Pearson correlations between all numeric fields and a target field (usually P/L). Returns fields ranked by predictive strength.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
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
        targetField: z
          .string()
          .default("pl")
          .describe("Field to correlate against (default: 'pl' for profit/loss)"),
        minSamples: z
          .number()
          .min(10)
          .default(30)
          .describe("Minimum trades with valid values for reliable correlation (default: 30, min: 10)"),
        includeCustomFields: z
          .boolean()
          .default(true)
          .describe("Include custom fields from CSV (default: true)"),
      }),
    },
    async ({
      blockId,
      strategy,
      startDate,
      endDate,
      targetField: rawTargetField,
      minSamples: rawMinSamples,
      includeCustomFields: rawIncludeCustomFields,
    }) => {
      try {
        // Apply defaults (Zod defaults don't always apply in MCP SDK)
        const targetField = rawTargetField ?? "pl";
        const minSamples = rawMinSamples ?? 30;
        const includeCustomFields = rawIncludeCustomFields ?? true;

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

        // Build list of fields to analyze
        const fieldsToAnalyze: Array<{ field: string; label: string }> = [];

        // Add static fields from REPORT_FIELDS (excluding target field)
        for (const fieldInfo of REPORT_FIELDS) {
          // Skip if field info is invalid or matches target
          if (!fieldInfo || !fieldInfo.field) {
            continue;
          }
          if (fieldInfo.field !== targetField) {
            fieldsToAnalyze.push({
              field: fieldInfo.field,
              label: fieldInfo.label,
            });
          }
        }

        // Add custom fields if requested
        if (includeCustomFields) {
          const customFieldNames = new Set<string>();
          for (const trade of enrichedTrades) {
            if (trade.customFields) {
              for (const key of Object.keys(trade.customFields)) {
                customFieldNames.add(key);
              }
            }
          }

          for (const fieldName of customFieldNames) {
            const fullFieldName = `custom.${fieldName}`;
            if (fullFieldName !== targetField) {
              fieldsToAnalyze.push({
                field: fullFieldName,
                label: `Custom: ${fieldName}`,
              });
            }
          }
        }

        // Calculate correlations
        interface FieldCorrelationResult {
          field: string;
          label: string;
          correlation: number;
          absCorrelation: number;
          sampleSize: number;
          interpretation: "strong" | "moderate" | "weak" | "negligible";
          direction: "positive" | "negative";
        }

        interface SkippedField {
          field: string;
          label: string;
          reason: "insufficient_samples" | "no_variance";
          sampleSize: number;
        }

        const rankedFields: FieldCorrelationResult[] = [];
        const skippedFields: SkippedField[] = [];

        for (const { field, label } of fieldsToAnalyze) {
          // Extract (fieldValue, targetValue) pairs where both are valid
          const pairs: Array<{ x: number; y: number }> = [];

          for (const trade of enrichedTrades) {
            const fieldValue = getTradeFieldValue(trade, field);
            const targetValue = getTradeFieldValue(trade, targetField);

            if (fieldValue !== null && targetValue !== null) {
              pairs.push({ x: fieldValue, y: targetValue });
            }
          }

          // Check minimum sample size
          if (pairs.length < minSamples) {
            skippedFields.push({
              field,
              label,
              reason: "insufficient_samples",
              sampleSize: pairs.length,
            });
            continue;
          }

          // Extract arrays for correlation
          const xValues = pairs.map((p) => p.x);
          const yValues = pairs.map((p) => p.y);

          // Check for variance (pearsonCorrelation returns 0 if no variance)
          const xMin = Math.min(...xValues);
          const xMax = Math.max(...xValues);
          if (xMin === xMax) {
            skippedFields.push({
              field,
              label,
              reason: "no_variance",
              sampleSize: pairs.length,
            });
            continue;
          }

          // Calculate Pearson correlation
          const correlation = pearsonCorrelation(xValues, yValues);
          const absCorrelation = Math.abs(correlation);

          // Determine interpretation
          let interpretation: "strong" | "moderate" | "weak" | "negligible";
          if (absCorrelation >= 0.7) {
            interpretation = "strong";
          } else if (absCorrelation >= 0.4) {
            interpretation = "moderate";
          } else if (absCorrelation >= 0.2) {
            interpretation = "weak";
          } else {
            interpretation = "negligible";
          }

          rankedFields.push({
            field,
            label,
            correlation: Math.round(correlation * 10000) / 10000, // Round to 4 decimal places
            absCorrelation: Math.round(absCorrelation * 10000) / 10000,
            sampleSize: pairs.length,
            interpretation,
            direction: correlation >= 0 ? "positive" : "negative",
          });
        }

        // Sort by absolute correlation (descending)
        rankedFields.sort((a, b) => b.absCorrelation - a.absCorrelation);

        // Build summary
        const fieldsWithData = rankedFields.length;
        const totalAnalyzed = fieldsToAnalyze.length;
        const strongFields = rankedFields.filter((f) => f.interpretation === "strong").length;
        const moderateFields = rankedFields.filter((f) => f.interpretation === "moderate").length;

        const summary = `Found ${fieldsWithData} predictive fields out of ${totalAnalyzed} analyzed${
          strongFields > 0 ? ` | ${strongFields} strong` : ""
        }${moderateFields > 0 ? ` | ${moderateFields} moderate` : ""}`;

        const structuredData = {
          blockId,
          targetField,
          filters: {
            strategy: strategy ?? null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            minSamples,
            includeCustomFields,
          },
          totalFieldsAnalyzed: totalAnalyzed,
          fieldsWithSufficientData: fieldsWithData,
          rankedFields,
          fieldsSkipped: skippedFields,
          interpretationGuide: {
            strong: "|r| >= 0.7 - Strong linear relationship",
            moderate: "|r| >= 0.4 - Moderate linear relationship",
            weak: "|r| >= 0.2 - Weak linear relationship",
            negligible: "|r| < 0.2 - No meaningful linear relationship",
          },
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error finding predictive fields: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
