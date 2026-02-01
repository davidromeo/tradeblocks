/**
 * Report Builder Tools
 *
 * MCP tools for flexible trade filtering, field statistics, and aggregation.
 * Enables AI-driven analysis and custom report generation.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock, loadReportingLog } from "../utils/block-loader.js";
import { createToolOutput, formatPercent, formatCurrency } from "../utils/output-formatter.js";
import type { Trade, FieldInfo, FieldCategory, FilterOperator, ReportingTrade } from "@tradeblocks/lib";
import { REPORT_FIELDS, FIELD_CATEGORY_ORDER, pearsonCorrelation, kendallTau, getRanks, normalCDF } from "@tradeblocks/lib";

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
      targetField,
      minSamples,
      includeCustomFields,
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

  // Tool 6: filter_curve
  server.registerTool(
    "filter_curve",
    {
      description:
        "Sweep filter thresholds for a field and show performance at each threshold. Use after find_predictive_fields to determine optimal filter values. Returns outcome curves and identifies sweet spots where filtering improves performance.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        field: z
          .string()
          .describe(
            "Field to sweep thresholds on (e.g., 'openingVix', 'durationHours')"
          ),
        mode: z
          .enum(["lt", "gt", "both"])
          .default("both")
          .describe(
            "Direction of filter: 'lt' (field < threshold), 'gt' (field > threshold), 'both' (show both directions)"
          ),
        thresholds: z
          .array(z.number())
          .optional()
          .describe(
            "Custom threshold values to test. If omitted, auto-generates from field percentiles."
          ),
        percentileSteps: z
          .array(z.number())
          .default([5, 10, 25, 50, 75, 90, 95])
          .describe(
            "Percentiles to use for auto-generated thresholds (default: [5, 10, 25, 50, 75, 90, 95])"
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
      }),
    },
    async ({
      blockId,
      field,
      mode,
      thresholds,
      percentileSteps,
      strategy,
      startDate,
      endDate,
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
        const fieldValues: number[] = [];
        const tradesWithField: EnrichedTrade[] = [];

        for (const trade of enrichedTrades) {
          const value = getTradeFieldValue(trade, field);
          if (value !== null) {
            fieldValues.push(value);
            tradesWithField.push(trade);
          }
        }

        if (fieldValues.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `Field "${field}" has no valid numeric values in the filtered trades.`,
              },
            ],
          };
        }

        // Calculate baseline metrics (all trades with valid field values)
        const baselinePls = tradesWithField.map((t) => t.pl);
        const baselineTotalPl = baselinePls.reduce((a, b) => a + b, 0);
        const baselineAvgPl = baselineTotalPl / tradesWithField.length;
        const baselineWinners = tradesWithField.filter((t) => t.pl > 0).length;
        const baselineWinRate = baselineWinners / tradesWithField.length;

        const baseline = {
          count: tradesWithField.length,
          winRate: Math.round(baselineWinRate * 10000) / 10000,
          avgPl: Math.round(baselineAvgPl * 100) / 100,
          totalPl: Math.round(baselineTotalPl * 100) / 100,
        };

        // Generate thresholds
        let thresholdsToTest: number[];

        if (thresholds && thresholds.length > 0) {
          // Use custom thresholds
          thresholdsToTest = [...thresholds].sort((a, b) => a - b);
        } else {
          // Auto-generate from percentiles
          const sorted = [...fieldValues].sort((a, b) => a - b);
          thresholdsToTest = [];

          for (const p of percentileSteps) {
            const value = percentile(sorted, p);
            // Round to 2 decimal places for cleaner output
            const rounded = Math.round(value * 100) / 100;
            // Avoid duplicates
            if (!thresholdsToTest.includes(rounded)) {
              thresholdsToTest.push(rounded);
            }
          }

          thresholdsToTest.sort((a, b) => a - b);
        }

        // Minimum sample size for reliable statistics
        const MIN_SAMPLE_SIZE = 30;

        // Helper to calculate metrics for a filtered set of trades
        function calculateMetrics(filteredTrades: EnrichedTrade[]): {
          count: number;
          percentOfTrades: number;
          winRate: number;
          avgPl: number;
          totalPl: number;
          winRateDelta: number;
          avgPlDelta: number;
          lowSampleWarning?: string;
        } {
          if (filteredTrades.length === 0) {
            return {
              count: 0,
              percentOfTrades: 0,
              winRate: 0,
              avgPl: 0,
              totalPl: 0,
              winRateDelta: -baseline.winRate,
              avgPlDelta: -baseline.avgPl,
            };
          }

          const pls = filteredTrades.map((t) => t.pl);
          const totalPl = pls.reduce((a, b) => a + b, 0);
          const avgPl = totalPl / filteredTrades.length;
          const winners = filteredTrades.filter((t) => t.pl > 0).length;
          const winRate = winners / filteredTrades.length;
          const percentOfTrades =
            (filteredTrades.length / tradesWithField.length) * 100;

          const result: ReturnType<typeof calculateMetrics> = {
            count: filteredTrades.length,
            percentOfTrades: Math.round(percentOfTrades * 100) / 100,
            winRate: Math.round(winRate * 10000) / 10000,
            avgPl: Math.round(avgPl * 100) / 100,
            totalPl: Math.round(totalPl * 100) / 100,
            winRateDelta:
              Math.round((winRate - baseline.winRate) * 10000) / 10000,
            avgPlDelta: Math.round((avgPl - baseline.avgPl) * 100) / 100,
          };

          // Add warning for small sample sizes
          if (filteredTrades.length < MIN_SAMPLE_SIZE && filteredTrades.length > 0) {
            result.lowSampleWarning = `${filteredTrades.length} trades may be insufficient for reliable statistics (recommend >= ${MIN_SAMPLE_SIZE})`;
          }

          return result;
        }

        // Analyze each threshold
        interface ThresholdResult {
          threshold: number;
          lt?: ReturnType<typeof calculateMetrics>;
          gt?: ReturnType<typeof calculateMetrics>;
        }

        const thresholdResults: ThresholdResult[] = [];

        for (const threshold of thresholdsToTest) {
          const result: ThresholdResult = { threshold };

          if (mode === "lt" || mode === "both") {
            const ltTrades = tradesWithField.filter((trade) => {
              const value = getTradeFieldValue(trade, field);
              return value !== null && value < threshold;
            });
            result.lt = calculateMetrics(ltTrades);
          }

          if (mode === "gt" || mode === "both") {
            const gtTrades = tradesWithField.filter((trade) => {
              const value = getTradeFieldValue(trade, field);
              return value !== null && value > threshold;
            });
            result.gt = calculateMetrics(gtTrades);
          }

          thresholdResults.push(result);
        }

        // Identify sweet spots
        interface SweetSpot {
          threshold: number;
          direction: "lt" | "gt";
          winRateDelta: number;
          avgPlDelta: number;
          percentOfTrades: number;
          score: number;
          recommendation: string;
        }

        const sweetSpots: SweetSpot[] = [];

        for (const result of thresholdResults) {
          // Check lt direction
          if (result.lt) {
            const { winRateDelta, avgPlDelta, percentOfTrades } = result.lt;
            if (
              winRateDelta > 0 &&
              avgPlDelta > 0 &&
              percentOfTrades >= 20
            ) {
              const score = winRateDelta * avgPlDelta;
              sweetSpots.push({
                threshold: result.threshold,
                direction: "lt",
                winRateDelta,
                avgPlDelta,
                percentOfTrades,
                score: Math.round(score * 10000) / 10000,
                recommendation: `Consider filtering ${field} < ${result.threshold}`,
              });
            }
          }

          // Check gt direction
          if (result.gt) {
            const { winRateDelta, avgPlDelta, percentOfTrades } = result.gt;
            if (
              winRateDelta > 0 &&
              avgPlDelta > 0 &&
              percentOfTrades >= 20
            ) {
              const score = winRateDelta * avgPlDelta;
              sweetSpots.push({
                threshold: result.threshold,
                direction: "gt",
                winRateDelta,
                avgPlDelta,
                percentOfTrades,
                score: Math.round(score * 10000) / 10000,
                recommendation: `Consider filtering ${field} > ${result.threshold}`,
              });
            }
          }
        }

        // Sort sweet spots by score (highest first)
        sweetSpots.sort((a, b) => b.score - a.score);

        // Build summary
        const summary = `Filter curve for ${field}: ${thresholdsToTest.length} thresholds analyzed | ${sweetSpots.length} sweet spots found`;

        const structuredData = {
          blockId,
          field,
          mode,
          filters: {
            strategy: strategy ?? null,
            startDate: startDate ?? null,
            endDate: endDate ?? null,
          },
          tradesAnalyzed: tradesWithField.length,
          baseline,
          thresholds: thresholdResults,
          sweetSpots,
          sweetSpotCriteria: {
            winRateDelta: "> 0 (win rate improves)",
            avgPlDelta: "> 0 (average P/L improves)",
            percentOfTrades: ">= 20% (retains meaningful sample)",
            scoreFormula: "winRateDelta * avgPlDelta (higher = better)",
          },
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating filter curve: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 7: analyze_discrepancies
  server.registerTool(
    "analyze_discrepancies",
    {
      description:
        "Analyze slippage patterns between backtest and actual trades. Detects systematic biases (direction, time-of-day) and correlates slippage with market conditions (VIX, gap, movement). Matches trades by date+strategy+time (minute precision). Requires both tradelog.csv (backtest) and reportinglog.csv (actual). Limitation: If multiple trades share the same date+strategy+minute, matching is order-dependent.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter to specific strategy name"),
        dateRange: z
          .object({
            from: z.string().optional().describe("Start date YYYY-MM-DD"),
            to: z.string().optional().describe("End date YYYY-MM-DD"),
          })
          .optional()
          .describe("Filter trades to date range"),
        scaling: z
          .enum(["raw", "perContract", "toReported"])
          .default("toReported")
          .describe("Scaling mode for P/L comparison (default: toReported)"),
        correlationMethod: z
          .enum(["pearson", "kendall"])
          .default("pearson")
          .describe("Correlation method for market condition analysis"),
        minSamples: z
          .number()
          .min(5)
          .default(10)
          .describe("Minimum samples required for pattern detection"),
        patternThreshold: z
          .number()
          .min(0.5)
          .max(0.95)
          .default(0.7)
          .describe(
            "Threshold for detecting systematic patterns (0.7 = 70% consistency)"
          ),
      }),
    },
    async ({
      blockId,
      strategy,
      dateRange,
      scaling,
      correlationMethod,
      minSamples,
      patternThreshold,
    }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let backtestTrades = block.trades;

        // Load reporting log (actual trades)
        let actualTrades: ReportingTrade[];
        try {
          actualTrades = await loadReportingLog(baseDir, blockId);
        } catch {
          return {
            content: [
              {
                type: "text",
                text: `No reportinglog.csv found in block "${blockId}". This tool requires both tradelog.csv (backtest) and reportinglog.csv (actual).`,
              },
            ],
            isError: true,
          };
        }

        // Apply strategy filter to both
        if (strategy) {
          backtestTrades = backtestTrades.filter(
            (t) => t.strategy.toLowerCase() === strategy.toLowerCase()
          );
          actualTrades = actualTrades.filter(
            (t) => t.strategy.toLowerCase() === strategy.toLowerCase()
          );
        }

        // Apply date range filter to both
        if (dateRange) {
          if (dateRange.from || dateRange.to) {
            const formatDateKeyLocal = (d: Date): string => {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              return `${year}-${month}-${day}`;
            };

            backtestTrades = backtestTrades.filter((t) => {
              const tradeDate = formatDateKeyLocal(new Date(t.dateOpened));
              if (dateRange.from && tradeDate < dateRange.from) return false;
              if (dateRange.to && tradeDate > dateRange.to) return false;
              return true;
            });
            actualTrades = actualTrades.filter((t) => {
              const tradeDate = formatDateKeyLocal(new Date(t.dateOpened));
              if (dateRange.from && tradeDate < dateRange.from) return false;
              if (dateRange.to && tradeDate > dateRange.to) return false;
              return true;
            });
          }
        }

        if (backtestTrades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No backtest trades found in tradelog.csv matching filters.",
              },
            ],
            isError: true,
          };
        }

        if (actualTrades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No actual trades found in reportinglog.csv matching filters.",
              },
            ],
            isError: true,
          };
        }

        // Helper to format date key
        const formatDateKey = (d: Date): string => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        // Helper to truncate time to minute precision for matching
        const truncateTimeToMinute = (time: string | undefined): string => {
          if (!time) return "00:00";
          const parts = time.split(":");
          if (parts.length >= 2) {
            return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
          }
          return "00:00";
        };

        // Helper to parse hour from time string
        const parseHourFromTime = (
          timeOpened: string | undefined
        ): number | null => {
          if (!timeOpened || typeof timeOpened !== "string") return null;
          const parts = timeOpened.split(":");
          if (parts.length < 1) return null;
          const hour = parseInt(parts[0], 10);
          if (isNaN(hour) || hour < 0 || hour > 23) return null;
          return hour;
        };

        // Matched trade data for slippage analysis
        interface MatchedTradeData {
          date: string;
          strategy: string;
          timeOpened: string;
          totalSlippage: number;
          // Context for correlation analysis
          openingVix?: number;
          closingVix?: number;
          gap?: number;
          movement?: number;
          hourOfDay: number | null;
          contracts: number;
        }

        // Pattern insight interface
        interface PatternInsight {
          pattern: string;
          metric: string;
          value: number;
          sampleSize: number;
          confidence: "low" | "moderate" | "high";
        }

        // Build lookup for actual trades
        const actualByKey = new Map<string, ReportingTrade[]>();
        actualTrades.forEach((trade) => {
          const dateKey = formatDateKey(new Date(trade.dateOpened));
          const timeKey = truncateTimeToMinute(trade.timeOpened);
          const key = `${dateKey}|${trade.strategy}|${timeKey}`;
          const existing = actualByKey.get(key) || [];
          existing.push(trade);
          actualByKey.set(key, existing);
        });

        const matchedTrades: MatchedTradeData[] = [];
        let unmatchedBacktestCount = 0;
        let unmatchedActualCount = actualTrades.length; // Will decrement as we match

        // Match backtest trades to actual trades by date+strategy+time
        for (const btTrade of backtestTrades) {
          const dateKey = formatDateKey(new Date(btTrade.dateOpened));
          const timeKey = truncateTimeToMinute(btTrade.timeOpened);
          const key = `${dateKey}|${btTrade.strategy}|${timeKey}`;

          const actualMatches = actualByKey.get(key);
          const actualTrade = actualMatches?.[0];

          if (actualTrade) {
            unmatchedActualCount--;
            // Remove the matched trade from the list
            if (actualMatches && actualMatches.length > 1) {
              actualByKey.set(key, actualMatches.slice(1));
            } else {
              actualByKey.delete(key);
            }

            // Calculate scaled P/L values
            const btContracts = btTrade.numContracts;
            const actualContracts = actualTrade.numContracts;
            let scaledBtPl = btTrade.pl;
            let scaledActualPl = actualTrade.pl;

            if (scaling === "perContract") {
              scaledBtPl = btContracts > 0 ? btTrade.pl / btContracts : 0;
              scaledActualPl =
                actualContracts > 0 ? actualTrade.pl / actualContracts : 0;
            } else if (scaling === "toReported") {
              if (btContracts > 0 && actualContracts > 0) {
                const scalingFactor = actualContracts / btContracts;
                scaledBtPl = btTrade.pl * scalingFactor;
              } else if (btContracts === 0) {
                scaledBtPl = 0;
              }
            }

            // Total slippage = actual P/L - backtest P/L (after scaling)
            const totalSlippage = scaledActualPl - scaledBtPl;

            matchedTrades.push({
              date: dateKey,
              strategy: btTrade.strategy,
              timeOpened: timeKey,
              totalSlippage,
              openingVix: btTrade.openingVix,
              closingVix: btTrade.closingVix,
              gap: btTrade.gap,
              movement: btTrade.movement,
              hourOfDay: parseHourFromTime(btTrade.timeOpened),
              contracts: actualContracts,
            });
          } else {
            unmatchedBacktestCount++;
          }
        }

        if (matchedTrades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No matching trades found between backtest and actual data. Cannot perform slippage analysis.",
              },
            ],
            isError: true,
          };
        }

        // Calculate date range from matched trades
        const dates = matchedTrades.map((t) => t.date).sort();
        const dateRangeResult = {
          from: dates[0],
          to: dates[dates.length - 1],
        };

        // Calculate summary statistics
        const slippages = matchedTrades.map((t) => t.totalSlippage);
        const totalSlippage = slippages.reduce((sum, s) => sum + s, 0);
        const avgSlippagePerTrade = totalSlippage / matchedTrades.length;

        // Pattern detection function
        const detectPatterns = (
          trades: MatchedTradeData[]
        ): PatternInsight[] => {
          const patterns: PatternInsight[] = [];

          if (trades.length < minSamples) {
            return patterns;
          }

          const getConfidence = (
            n: number
          ): "low" | "moderate" | "high" => {
            if (n < 10) return "low";
            if (n < 30) return "moderate";
            return "high";
          };

          // 1. Direction bias - if >patternThreshold of slippages are same sign
          const tradeSlippages = trades.map((t) => t.totalSlippage);
          const positiveCount = tradeSlippages.filter((s) => s > 0).length;
          const negativeCount = tradeSlippages.filter((s) => s < 0).length;
          const positiveRate = positiveCount / tradeSlippages.length;
          const negativeRate = negativeCount / tradeSlippages.length;

          if (positiveRate >= patternThreshold) {
            patterns.push({
              pattern: `Direction bias: ${formatPercent(positiveRate * 100)} of trades have positive slippage (actual > backtest)`,
              metric: "positive_slippage_rate",
              value: positiveRate,
              sampleSize: tradeSlippages.length,
              confidence: getConfidence(tradeSlippages.length),
            });
          } else if (negativeRate >= patternThreshold) {
            patterns.push({
              pattern: `Direction bias: ${formatPercent(negativeRate * 100)} of trades have negative slippage (actual < backtest)`,
              metric: "negative_slippage_rate",
              value: negativeRate,
              sampleSize: tradeSlippages.length,
              confidence: getConfidence(tradeSlippages.length),
            });
          }

          // 2. Time-of-day clustering - if >patternThreshold of outlier trades occur in same time bucket
          const tradesWithHour = trades.filter((t) => t.hourOfDay !== null);
          if (tradesWithHour.length >= minSamples) {
            // Define time buckets: morning (9-11), midday (11-14), afternoon (14-16)
            const buckets = {
              morning: tradesWithHour.filter(
                (a) => a.hourOfDay !== null && a.hourOfDay >= 9 && a.hourOfDay < 11
              ),
              midday: tradesWithHour.filter(
                (a) => a.hourOfDay !== null && a.hourOfDay >= 11 && a.hourOfDay < 14
              ),
              afternoon: tradesWithHour.filter(
                (a) => a.hourOfDay !== null && a.hourOfDay >= 14 && a.hourOfDay <= 16
              ),
            };

            // Find outliers (beyond 1.5 * IQR)
            const sorted = [...slippages].sort((a, b) => a - b);
            const q1 = sorted[Math.floor(sorted.length * 0.25)];
            const q3 = sorted[Math.floor(sorted.length * 0.75)];
            const iqr = q3 - q1;
            const outlierThresholdLow = q1 - 1.5 * iqr;
            const outlierThresholdHigh = q3 + 1.5 * iqr;

            const outlierTrades = tradesWithHour.filter(
              (a) =>
                a.totalSlippage < outlierThresholdLow ||
                a.totalSlippage > outlierThresholdHigh
            );

            if (outlierTrades.length >= 3) {
              for (const [bucketName, bucketTrades] of Object.entries(buckets)) {
                const outlierInBucket = outlierTrades.filter((o) =>
                  bucketTrades.includes(o)
                );
                const bucketRate = outlierInBucket.length / outlierTrades.length;

                if (bucketRate >= patternThreshold && outlierInBucket.length >= 3) {
                  patterns.push({
                    pattern: `Time clustering: ${formatPercent(bucketRate * 100)} of outlier trades occur during ${bucketName} hours`,
                    metric: "time_clustering_rate",
                    value: bucketRate,
                    sampleSize: outlierTrades.length,
                    confidence: getConfidence(outlierTrades.length),
                  });
                  break; // Only report strongest time pattern
                }
              }
            }
          }

          // 3. VIX sensitivity - correlation with openingVix if available
          const vixTrades = trades.filter(
            (t) => t.openingVix !== undefined && t.openingVix !== null
          );
          if (vixTrades.length >= minSamples) {
            const vixValues = vixTrades.map((t) => t.openingVix!);
            const vixSlippages = vixTrades.map((t) => t.totalSlippage);

            const correlation =
              correlationMethod === "pearson"
                ? pearsonCorrelation(vixSlippages, vixValues)
                : kendallTau(vixSlippages, vixValues);

            const absCorr = Math.abs(correlation);
            if (absCorr >= 0.3) {
              // Only report if moderate or stronger
              const direction = correlation > 0 ? "positive" : "negative";
              patterns.push({
                pattern: `VIX sensitivity: ${direction} correlation (${correlation.toFixed(3)}) between slippage and opening VIX`,
                metric: "vix_correlation",
                value: correlation,
                sampleSize: vixTrades.length,
                confidence: getConfidence(vixTrades.length),
              });
            }
          }

          return patterns;
        };

        // Calculate correlations (only returns significant correlations with |r| >= 0.3)
        const calculateCorrelations = (
          trades: MatchedTradeData[]
        ): Array<{
          field: string;
          coefficient: number;
          sampleSize: number;
          interpretation: string;
        }> => {
          const results: Array<{
            field: string;
            coefficient: number;
            sampleSize: number;
            interpretation: string;
          }> = [];

          const correlationFields: Array<{
            name: string;
            getValue: (t: MatchedTradeData) => number | undefined | null;
          }> = [
            { name: "openingVix", getValue: (t) => t.openingVix },
            { name: "closingVix", getValue: (t) => t.closingVix },
            { name: "gap", getValue: (t) => t.gap },
            { name: "movement", getValue: (t) => t.movement },
            { name: "hourOfDay", getValue: (t) => t.hourOfDay },
            { name: "contracts", getValue: (t) => t.contracts },
          ];

          const getInterpretation = (coeff: number): string => {
            const abs = Math.abs(coeff);
            const direction = coeff >= 0 ? "positive" : "negative";
            if (abs >= 0.7) return `strong ${direction}`;
            if (abs >= 0.4) return `moderate ${direction}`;
            return `weak ${direction}`;
          };

          for (const { name, getValue } of correlationFields) {
            const validPairs: Array<{ slippage: number; field: number }> = [];

            for (const trade of trades) {
              const fieldValue = getValue(trade);
              if (
                fieldValue !== undefined &&
                fieldValue !== null &&
                isFinite(fieldValue)
              ) {
                validPairs.push({
                  slippage: trade.totalSlippage,
                  field: fieldValue,
                });
              }
            }

            if (validPairs.length >= minSamples) {
              const slippages = validPairs.map((p) => p.slippage);
              const fieldValues = validPairs.map((p) => p.field);

              const coefficient =
                correlationMethod === "pearson"
                  ? pearsonCorrelation(slippages, fieldValues)
                  : kendallTau(slippages, fieldValues);

              // Only include significant correlations (|r| >= 0.3)
              if (Math.abs(coefficient) >= 0.3) {
                results.push({
                  field: name,
                  coefficient: Math.round(coefficient * 10000) / 10000,
                  sampleSize: validPairs.length,
                  interpretation: getInterpretation(coefficient),
                });
              }
            }
          }

          // Sort by absolute coefficient descending
          results.sort(
            (a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient)
          );

          return results;
        };

        // Portfolio-wide patterns and correlations
        const portfolioPatterns = detectPatterns(matchedTrades);
        const portfolioCorrelations = calculateCorrelations(matchedTrades);

        // Per-strategy breakdown (always included, simplified output)
        const byStrategy = new Map<string, MatchedTradeData[]>();
        for (const trade of matchedTrades) {
          const existing = byStrategy.get(trade.strategy) ?? [];
          existing.push(trade);
          byStrategy.set(trade.strategy, existing);
        }

        const perStrategy: Array<{
          strategy: string;
          tradeCount: number;
          totalSlippage: number;
          avgSlippage: number;
        }> = [];

        for (const [strategyName, trades] of byStrategy) {
          const stratSlippages = trades.map((t) => t.totalSlippage);
          const stratTotal = stratSlippages.reduce((sum, s) => sum + s, 0);
          const stratAvg = trades.length > 0 ? stratTotal / trades.length : 0;

          perStrategy.push({
            strategy: strategyName,
            tradeCount: trades.length,
            totalSlippage: stratTotal,
            avgSlippage: stratAvg,
          });
        }

        // Sort by absolute total slippage descending
        perStrategy.sort(
          (a, b) => Math.abs(b.totalSlippage) - Math.abs(a.totalSlippage)
        );

        // Build summary string
        const summaryParts = [
          `Slippage analysis: ${matchedTrades.length} matched trades`,
          `Total slippage: ${formatCurrency(totalSlippage)}`,
          `Avg per trade: ${formatCurrency(avgSlippagePerTrade)}`,
        ];

        if (portfolioPatterns.length > 0) {
          summaryParts.push(`${portfolioPatterns.length} patterns detected`);
        }

        const summary = summaryParts.join(" | ");

        const structuredData = {
          summary: {
            matchedTrades: matchedTrades.length,
            unmatchedBacktest: unmatchedBacktestCount,
            unmatchedActual: unmatchedActualCount,
            totalSlippage,
            avgSlippagePerTrade,
            dateRange: dateRangeResult,
          },
          patterns: portfolioPatterns,
          correlations: {
            method: correlationMethod,
            results: portfolioCorrelations,
            note:
              portfolioCorrelations.length === 0
                ? "No significant correlations found (|r| >= 0.3)"
                : undefined,
          },
          perStrategy,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing discrepancies: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 8: suggest_strategy_matches
  server.registerTool(
    "suggest_strategy_matches",
    {
      description:
        "Suggest matches between backtest and actual strategies based on P/L correlation when names don't align. Returns confidence scores (0-100), flags unmatchable strategies (systematic divergence), and lists unmatched strategies. Exact name matches auto-confirm at 100% confidence.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        dateRange: z
          .object({
            from: z.string().optional().describe("Start date YYYY-MM-DD"),
            to: z.string().optional().describe("End date YYYY-MM-DD"),
          })
          .optional()
          .describe("Filter trades to date range"),
        correlationMethod: z
          .enum(["pearson", "spearman", "kendall"])
          .default("pearson")
          .describe("Correlation method (default: pearson)"),
        minOverlapDays: z
          .number()
          .min(2)
          .default(5)
          .describe("Minimum overlapping trading days required for correlation (default: 5)"),
        minCorrelation: z
          .number()
          .min(-1)
          .max(1)
          .optional()
          .describe("Minimum correlation to include in suggestions (default: show all)"),
        includeUnmatched: z
          .boolean()
          .default(true)
          .describe("Include strategies with no potential matches (default: true)"),
      }),
    },
    async ({
      blockId,
      dateRange,
      correlationMethod,
      minOverlapDays,
      minCorrelation,
      includeUnmatched,
    }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let backtestTrades = block.trades;

        // Load reporting log (actual trades)
        let actualTrades: ReportingTrade[];
        try {
          actualTrades = await loadReportingLog(baseDir, blockId);
        } catch {
          return {
            content: [
              {
                type: "text",
                text: `No reportinglog.csv found in block "${blockId}". This tool requires both tradelog.csv (backtest) and reportinglog.csv (actual).`,
              },
            ],
            isError: true,
          };
        }

        // Helper to format date key for daily aggregation
        const formatDateKey = (d: Date): string => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        // Apply date range filter to both
        if (dateRange) {
          if (dateRange.from || dateRange.to) {
            backtestTrades = backtestTrades.filter((t) => {
              const tradeDate = formatDateKey(new Date(t.dateOpened));
              if (dateRange.from && tradeDate < dateRange.from) return false;
              if (dateRange.to && tradeDate > dateRange.to) return false;
              return true;
            });
            actualTrades = actualTrades.filter((t) => {
              const tradeDate = formatDateKey(new Date(t.dateOpened));
              if (dateRange.from && tradeDate < dateRange.from) return false;
              if (dateRange.to && tradeDate > dateRange.to) return false;
              return true;
            });
          }
        }

        if (backtestTrades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No backtest trades found in tradelog.csv matching filters.",
              },
            ],
            isError: true,
          };
        }

        if (actualTrades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No actual trades found in reportinglog.csv matching filters.",
              },
            ],
            isError: true,
          };
        }

        // Extract unique strategy names
        const backtestStrategies = new Set(backtestTrades.map((t) => t.strategy));
        const actualStrategies = new Set(actualTrades.map((t) => t.strategy));

        // Helper for case-insensitive strategy comparison
        const normalizeStrategyName = (name: string): string => name.toLowerCase().trim();

        // Build maps for case-insensitive matching
        const backtestStrategyMap = new Map<string, string>();
        for (const s of backtestStrategies) {
          backtestStrategyMap.set(normalizeStrategyName(s), s);
        }
        const actualStrategyMap = new Map<string, string>();
        for (const s of actualStrategies) {
          actualStrategyMap.set(normalizeStrategyName(s), s);
        }

        // Identify exact name matches (case-insensitive)
        interface ExactMatch {
          strategy: string;
          confidence: number;
        }
        const exactMatches: ExactMatch[] = [];
        const backtestWithExactMatch = new Set<string>();
        const actualWithExactMatch = new Set<string>();

        for (const [btNorm, btOriginal] of backtestStrategyMap) {
          const actualOriginal = actualStrategyMap.get(btNorm);
          if (actualOriginal) {
            exactMatches.push({
              strategy: btOriginal,
              confidence: 100,
            });
            backtestWithExactMatch.add(btOriginal);
            actualWithExactMatch.add(actualOriginal);
          }
        }

        // Build daily P/L series for strategies that don't have exact matches
        interface DailyPL {
          totalPl: number;
          totalContracts: number;
        }
        type StrategyDailyMap = Map<string, Map<string, DailyPL>>; // strategy -> date -> DailyPL

        const buildDailyPlSeries = (
          trades: Array<{ strategy: string; dateOpened: Date; pl: number; numContracts: number }>,
          excludeStrategies: Set<string>
        ): StrategyDailyMap => {
          const result: StrategyDailyMap = new Map();
          for (const trade of trades) {
            if (excludeStrategies.has(trade.strategy)) continue;
            const dateKey = formatDateKey(new Date(trade.dateOpened));
            if (!result.has(trade.strategy)) {
              result.set(trade.strategy, new Map());
            }
            const strategyMap = result.get(trade.strategy)!;
            const existing = strategyMap.get(dateKey) || { totalPl: 0, totalContracts: 0 };
            existing.totalPl += trade.pl;
            existing.totalContracts += trade.numContracts || 0;
            strategyMap.set(dateKey, existing);
          }
          return result;
        };

        const backtestDaily = buildDailyPlSeries(backtestTrades, backtestWithExactMatch);
        const actualDaily = buildDailyPlSeries(actualTrades, actualWithExactMatch);

        // Helper to get normalized daily P/L values array
        const getNormalizedDailyPl = (dailyMap: Map<string, DailyPL>): Map<string, number> => {
          const result = new Map<string, number>();
          for (const [date, data] of dailyMap) {
            // Per-contract normalization if numContracts > 0
            const normalizedPl = data.totalContracts > 0
              ? data.totalPl / data.totalContracts
              : data.totalPl;
            result.set(date, normalizedPl);
          }
          return result;
        };

        // Helper to calculate correlation between two strategies
        const calculateCorrelation = (
          btDaily: Map<string, number>,
          actualDaily: Map<string, number>,
          method: "pearson" | "spearman" | "kendall"
        ): { correlation: number; overlapDays: number } => {
          // Find overlapping dates
          const btDates = new Set(btDaily.keys());
          const overlapDates: string[] = [];
          for (const date of actualDaily.keys()) {
            if (btDates.has(date)) {
              overlapDates.push(date);
            }
          }

          if (overlapDates.length < 2) {
            return { correlation: NaN, overlapDays: overlapDates.length };
          }

          const btValues: number[] = [];
          const actualValues: number[] = [];
          for (const date of overlapDates) {
            btValues.push(btDaily.get(date)!);
            actualValues.push(actualDaily.get(date)!);
          }

          let correlation: number;
          if (method === "pearson") {
            correlation = pearsonCorrelation(btValues, actualValues);
          } else if (method === "spearman") {
            // Spearman: rank the values, then calculate Pearson on ranks
            const btRanks = getRanks(btValues);
            const actualRanks = getRanks(actualValues);
            correlation = pearsonCorrelation(btRanks, actualRanks);
          } else {
            // Kendall
            correlation = kendallTau(btValues, actualValues);
          }

          return { correlation, overlapDays: overlapDates.length };
        };

        // Calculate trade timing overlap
        const calculateTimingOverlap = (
          btDaily: Map<string, DailyPL>,
          actualDaily: Map<string, DailyPL>
        ): number => {
          const btDates = new Set(btDaily.keys());
          const actualDates = new Set(actualDaily.keys());
          let bothCount = 0;
          for (const date of btDates) {
            if (actualDates.has(date)) {
              bothCount++;
            }
          }
          const minDays = Math.min(btDates.size, actualDates.size);
          return minDays > 0 ? bothCount / minDays : 0;
        };

        // Build correlation matrix
        const backtestStrategyList = Array.from(backtestDaily.keys()).sort();
        const actualStrategyList = Array.from(actualDaily.keys()).sort();

        interface CorrelationResult {
          correlation: number;
          overlapDays: number;
          timingOverlap: number;
        }

        // Matrix: rows = backtest strategies, cols = actual strategies
        const correlationMatrix: number[][] = [];
        const sampleSizeMatrix: number[][] = [];
        const correlationResults: Map<string, Map<string, CorrelationResult>> = new Map();

        for (const btStrategy of backtestStrategyList) {
          const btRawDaily = backtestDaily.get(btStrategy)!;
          const btNormalized = getNormalizedDailyPl(btRawDaily);
          const rowCorrelations: number[] = [];
          const rowSampleSizes: number[] = [];
          const btResults: Map<string, CorrelationResult> = new Map();

          for (const actualStrategy of actualStrategyList) {
            const actualRawDaily = actualDaily.get(actualStrategy)!;
            const actualNormalized = getNormalizedDailyPl(actualRawDaily);

            const { correlation, overlapDays } = calculateCorrelation(
              btNormalized,
              actualNormalized,
              correlationMethod
            );
            const timingOverlap = calculateTimingOverlap(btRawDaily, actualRawDaily);

            rowCorrelations.push(isNaN(correlation) ? 0 : correlation);
            rowSampleSizes.push(overlapDays);
            btResults.set(actualStrategy, { correlation, overlapDays, timingOverlap });
          }

          correlationMatrix.push(rowCorrelations);
          sampleSizeMatrix.push(rowSampleSizes);
          correlationResults.set(btStrategy, btResults);
        }

        // Compute confidence scores and suggested matches
        interface SuggestedMatch {
          backtestStrategy: string;
          actualStrategy: string;
          confidence: number;
          correlation: number;
          correlationMethod: string;
          overlapDays: number;
          timingOverlap: number;
          reasoning: string;
        }

        interface UnmatchableEntry {
          backtestStrategy: string;
          potentialActual: string;
          correlation: number;
          reason: string;
        }

        const suggestedMatches: SuggestedMatch[] = [];
        const unmatchable: UnmatchableEntry[] = [];

        // Weights for confidence score
        const CORRELATION_WEIGHT = 70;
        const TIMING_WEIGHT = 30;
        const SAMPLE_SIZE_PENALTY_THRESHOLD = 20;

        // Unmatchable thresholds
        const NEGATIVE_CORRELATION_THRESHOLD = -0.2;
        const SYSTEMATIC_BIAS_THRESHOLD = 2; // std deviations

        for (const btStrategy of backtestStrategyList) {
          const btResults = correlationResults.get(btStrategy)!;
          const btRawDaily = backtestDaily.get(btStrategy)!;
          const btNormalized = getNormalizedDailyPl(btRawDaily);

          // Find best match for this backtest strategy
          let bestMatch: {
            actualStrategy: string;
            confidence: number;
            result: CorrelationResult;
          } | null = null;

          for (const actualStrategy of actualStrategyList) {
            const result = btResults.get(actualStrategy)!;

            // Skip if insufficient overlap
            if (result.overlapDays < minOverlapDays) {
              continue;
            }

            // Skip NaN correlations
            if (isNaN(result.correlation)) {
              continue;
            }

            // Check for unmatchable: negative correlation
            if (result.correlation < NEGATIVE_CORRELATION_THRESHOLD) {
              unmatchable.push({
                backtestStrategy: btStrategy,
                potentialActual: actualStrategy,
                correlation: result.correlation,
                reason: "Negative correlation - strategies move opposite",
              });
              continue;
            }

            // Check for systematic P/L difference (bias detection)
            const actualRawDaily = actualDaily.get(actualStrategy)!;
            const actualNormalized = getNormalizedDailyPl(actualRawDaily);
            const overlapDates: string[] = [];
            const btDates = new Set(btNormalized.keys());
            for (const date of actualNormalized.keys()) {
              if (btDates.has(date)) {
                overlapDates.push(date);
              }
            }

            if (overlapDates.length >= minOverlapDays) {
              const differences: number[] = [];
              for (const date of overlapDates) {
                const diff = actualNormalized.get(date)! - btNormalized.get(date)!;
                differences.push(diff);
              }
              const meanDiff = differences.reduce((a, b) => a + b, 0) / differences.length;
              const stdDiff = Math.sqrt(
                differences.reduce((sum, d) => sum + Math.pow(d - meanDiff, 2), 0) / differences.length
              );
              const bias = stdDiff > 0 ? Math.abs(meanDiff) / stdDiff : 0;

              if (bias > SYSTEMATIC_BIAS_THRESHOLD) {
                unmatchable.push({
                  backtestStrategy: btStrategy,
                  potentialActual: actualStrategy,
                  correlation: result.correlation,
                  reason: `Systematic P/L difference - bias ratio: ${bias.toFixed(2)}`,
                });
                continue;
              }
            }

            // Calculate confidence score
            // Positive correlation contributes positively to confidence
            // Map correlation [0, 1] to [0, CORRELATION_WEIGHT]
            const absCorrelation = Math.abs(result.correlation);
            const correlationContribution = absCorrelation * CORRELATION_WEIGHT;
            const timingContribution = result.timingOverlap * TIMING_WEIGHT;
            let confidence = correlationContribution + timingContribution;

            // Apply sample size penalty
            if (result.overlapDays < SAMPLE_SIZE_PENALTY_THRESHOLD) {
              const penalty = result.overlapDays / SAMPLE_SIZE_PENALTY_THRESHOLD;
              confidence *= penalty;
            }

            // Clamp to 0-100
            confidence = Math.min(100, Math.max(0, confidence));

            // Apply minCorrelation filter if specified
            if (minCorrelation !== undefined && result.correlation < minCorrelation) {
              continue;
            }

            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { actualStrategy, confidence, result };
            }
          }

          if (bestMatch) {
            const { actualStrategy, confidence, result } = bestMatch;
            const correlationDesc = result.correlation >= 0.7
              ? "High"
              : result.correlation >= 0.4
                ? "Moderate"
                : "Low";

            suggestedMatches.push({
              backtestStrategy: btStrategy,
              actualStrategy,
              confidence: Math.round(confidence),
              correlation: Math.round(result.correlation * 1000) / 1000,
              correlationMethod,
              overlapDays: result.overlapDays,
              timingOverlap: Math.round(result.timingOverlap * 100) / 100,
              reasoning: `${correlationDesc} P/L correlation (${result.correlation.toFixed(2)}) with ${result.overlapDays} overlapping days`,
            });
          }
        }

        // Sort suggested matches by confidence descending
        suggestedMatches.sort((a, b) => b.confidence - a.confidence);

        // Identify unmatched strategies
        const matchedBacktest = new Set([
          ...backtestWithExactMatch,
          ...suggestedMatches.map((m) => m.backtestStrategy),
        ]);
        const matchedActual = new Set([
          ...actualWithExactMatch,
          ...suggestedMatches.map((m) => m.actualStrategy),
        ]);

        const unmatchedBacktestOnly: string[] = [];
        const unmatchedActualOnly: string[] = [];

        if (includeUnmatched) {
          for (const s of backtestStrategies) {
            if (!matchedBacktest.has(s)) {
              unmatchedBacktestOnly.push(s);
            }
          }
          for (const s of actualStrategies) {
            if (!matchedActual.has(s)) {
              unmatchedActualOnly.push(s);
            }
          }
          unmatchedBacktestOnly.sort();
          unmatchedActualOnly.sort();
        }

        // Build output
        const summary = {
          backtestStrategies: backtestStrategies.size,
          actualStrategies: actualStrategies.size,
          exactMatches: exactMatches.length,
          suggestedMatches: suggestedMatches.length,
          unmatchableCount: unmatchable.length,
          unmatchedBacktestOnly: unmatchedBacktestOnly.length,
          unmatchedActualOnly: unmatchedActualOnly.length,
        };

        const structuredData = {
          summary,
          exactMatches,
          suggestedMatches,
          unmatchable,
          unmatched: {
            backtestOnly: unmatchedBacktestOnly,
            actualOnly: unmatchedActualOnly,
          },
          correlationMatrix: {
            rows: backtestStrategyList,
            cols: actualStrategyList,
            values: correlationMatrix,
            sampleSizes: sampleSizeMatrix,
          },
        };

        const summaryText = `Strategy matching: ${exactMatches.length} exact matches, ${suggestedMatches.length} suggested matches | ${backtestStrategies.size} backtest strategies, ${actualStrategies.size} actual strategies`;

        return createToolOutput(summaryText, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error suggesting strategy matches: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 9: analyze_slippage_trends
  server.registerTool(
    "analyze_slippage_trends",
    {
      description:
        "Analyze slippage trends over time with statistical significance testing. Detects improvement/degradation patterns using linear regression on time-aggregated slippage data. Provides slope, R-squared, p-value, and interpretation. Requires both tradelog.csv (backtest) and reportinglog.csv (actual). Limitation: Trade matching uses minute precision; if multiple trades share the same date+strategy+minute, matching is order-dependent.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter to specific strategy name"),
        dateRange: z
          .object({
            from: z.string().optional().describe("Start date YYYY-MM-DD"),
            to: z.string().optional().describe("End date YYYY-MM-DD"),
          })
          .optional()
          .describe("Filter trades to date range"),
        scaling: z
          .enum(["raw", "perContract", "toReported"])
          .default("toReported")
          .describe("Scaling mode for P/L comparison (default: toReported)"),
        granularity: z
          .enum(["daily", "weekly", "monthly"])
          .default("weekly")
          .describe("Time period granularity for trend analysis"),
        includeTimeSeries: z
          .boolean()
          .default(false)
          .describe("Include raw time series data points in output (for charting)"),
        correlationMethod: z
          .enum(["pearson", "kendall"])
          .default("pearson")
          .describe("Correlation method for external factor analysis"),
        minSamples: z
          .number()
          .min(5)
          .default(10)
          .describe("Minimum samples required for reliable statistics"),
      }),
    },
    async ({
      blockId,
      strategy,
      dateRange,
      scaling,
      granularity,
      includeTimeSeries,
      correlationMethod,
      minSamples,
    }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let backtestTrades = block.trades;

        // Load reporting log (actual trades)
        let actualTrades: ReportingTrade[];
        try {
          actualTrades = await loadReportingLog(baseDir, blockId);
        } catch {
          return {
            content: [
              {
                type: "text",
                text: `No reportinglog.csv found in block "${blockId}". This tool requires both tradelog.csv (backtest) and reportinglog.csv (actual).`,
              },
            ],
            isError: true,
          };
        }

        // Apply strategy filter to both
        if (strategy) {
          backtestTrades = backtestTrades.filter(
            (t) => t.strategy.toLowerCase() === strategy.toLowerCase()
          );
          actualTrades = actualTrades.filter(
            (t) => t.strategy.toLowerCase() === strategy.toLowerCase()
          );
        }

        // Helper to format date key
        const formatDateKey = (d: Date): string => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        // Apply date range filter to both
        if (dateRange) {
          if (dateRange.from || dateRange.to) {
            backtestTrades = backtestTrades.filter((t) => {
              const tradeDate = formatDateKey(new Date(t.dateOpened));
              if (dateRange.from && tradeDate < dateRange.from) return false;
              if (dateRange.to && tradeDate > dateRange.to) return false;
              return true;
            });
            actualTrades = actualTrades.filter((t) => {
              const tradeDate = formatDateKey(new Date(t.dateOpened));
              if (dateRange.from && tradeDate < dateRange.from) return false;
              if (dateRange.to && tradeDate > dateRange.to) return false;
              return true;
            });
          }
        }

        if (backtestTrades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No backtest trades found in tradelog.csv matching filters.",
              },
            ],
            isError: true,
          };
        }

        if (actualTrades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No actual trades found in reportinglog.csv matching filters.",
              },
            ],
            isError: true,
          };
        }

        // Helper to truncate time to minute precision for matching
        const truncateTimeToMinute = (time: string | undefined): string => {
          if (!time) return "00:00";
          const parts = time.split(":");
          if (parts.length >= 2) {
            return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
          }
          return "00:00";
        };

        // Helper to parse hour from time string
        const parseHourFromTime = (
          timeOpened: string | undefined
        ): number | null => {
          if (!timeOpened || typeof timeOpened !== "string") return null;
          const parts = timeOpened.split(":");
          if (parts.length < 1) return null;
          const hour = parseInt(parts[0], 10);
          if (isNaN(hour) || hour < 0 || hour > 23) return null;
          return hour;
        };

        // Helper to get ISO week key (YYYY-Www format)
        const getIsoWeekKey = (dateStr: string): string => {
          const [yearStr, monthStr, dayStr] = dateStr.split("-");
          const year = Number(yearStr);
          const month = Number(monthStr) - 1;
          const day = Number(dayStr);
          const date = new Date(Date.UTC(year, month, day));
          const thursday = new Date(date.getTime());
          const dayOfWeek = thursday.getUTCDay() || 7;
          thursday.setUTCDate(thursday.getUTCDate() + (4 - dayOfWeek));
          const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
          const weekNum = Math.ceil(
            ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
          );
          return `${thursday.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
        };

        // Helper to get month key (YYYY-MM format)
        const getMonthKey = (dateStr: string): string => {
          return dateStr.substring(0, 7);
        };

        // Helper to get period key based on granularity
        const getPeriodKey = (dateStr: string): string => {
          if (granularity === "daily") return dateStr;
          if (granularity === "weekly") return getIsoWeekKey(dateStr);
          return getMonthKey(dateStr);
        };

        // Matched trade data for slippage analysis
        interface MatchedTradeData {
          date: string;
          strategy: string;
          timeOpened: string;
          totalSlippage: number;
          openingVix?: number;
          hourOfDay: number | null;
          contracts: number;
        }

        // Build lookup for actual trades
        const actualByKey = new Map<string, ReportingTrade[]>();
        actualTrades.forEach((trade) => {
          const dateKey = formatDateKey(new Date(trade.dateOpened));
          const timeKey = truncateTimeToMinute(trade.timeOpened);
          const key = `${dateKey}|${trade.strategy}|${timeKey}`;
          const existing = actualByKey.get(key) || [];
          existing.push(trade);
          actualByKey.set(key, existing);
        });

        const matchedTrades: MatchedTradeData[] = [];

        // Match backtest trades to actual trades by date+strategy+time
        for (const btTrade of backtestTrades) {
          const dateKey = formatDateKey(new Date(btTrade.dateOpened));
          const timeKey = truncateTimeToMinute(btTrade.timeOpened);
          const key = `${dateKey}|${btTrade.strategy}|${timeKey}`;

          const actualMatches = actualByKey.get(key);
          const actualTrade = actualMatches?.[0];

          if (actualTrade) {
            // Remove the matched trade from the list
            if (actualMatches && actualMatches.length > 1) {
              actualByKey.set(key, actualMatches.slice(1));
            } else {
              actualByKey.delete(key);
            }

            // Calculate scaled P/L values
            const btContracts = btTrade.numContracts;
            const actualContracts = actualTrade.numContracts;
            let scaledBtPl = btTrade.pl;
            let scaledActualPl = actualTrade.pl;

            if (scaling === "perContract") {
              scaledBtPl = btContracts > 0 ? btTrade.pl / btContracts : 0;
              scaledActualPl =
                actualContracts > 0 ? actualTrade.pl / actualContracts : 0;
            } else if (scaling === "toReported") {
              if (btContracts > 0 && actualContracts > 0) {
                const scalingFactor = actualContracts / btContracts;
                scaledBtPl = btTrade.pl * scalingFactor;
              } else if (btContracts === 0) {
                scaledBtPl = 0;
              }
            }

            // Total slippage = actual P/L - backtest P/L (after scaling)
            const totalSlippage = scaledActualPl - scaledBtPl;

            matchedTrades.push({
              date: dateKey,
              strategy: btTrade.strategy,
              timeOpened: timeKey,
              totalSlippage,
              openingVix: btTrade.openingVix,
              hourOfDay: parseHourFromTime(btTrade.timeOpened),
              contracts: actualContracts,
            });
          }
        }

        if (matchedTrades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No matching trades found between backtest and actual data. Cannot perform trend analysis.",
              },
            ],
            isError: true,
          };
        }

        // Period slippage interface
        interface PeriodSlippage {
          period: string;
          totalSlippage: number;
          avgSlippage: number;
          tradeCount: number;
          avgMagnitude: number;
        }

        // Aggregate matched trades by period
        const aggregateByPeriod = (trades: MatchedTradeData[]): PeriodSlippage[] => {
          const periodMap = new Map<string, { slippages: number[]; count: number }>();

          for (const trade of trades) {
            const periodKey = getPeriodKey(trade.date);
            const existing = periodMap.get(periodKey) || { slippages: [], count: 0 };
            existing.slippages.push(trade.totalSlippage);
            existing.count++;
            periodMap.set(periodKey, existing);
          }

          const periods: PeriodSlippage[] = [];
          for (const [period, data] of periodMap) {
            const totalSlippage = data.slippages.reduce((sum, s) => sum + s, 0);
            const avgSlippage = totalSlippage / data.count;
            const avgMagnitude = data.slippages.reduce((sum, s) => sum + Math.abs(s), 0) / data.count;

            periods.push({
              period,
              totalSlippage,
              avgSlippage,
              tradeCount: data.count,
              avgMagnitude,
            });
          }

          // Sort by period chronologically
          periods.sort((a, b) => a.period.localeCompare(b.period));

          return periods;
        };

        // Trend result interface
        interface TrendResult {
          slope: number;
          intercept: number;
          rSquared: number;
          pValue: number;
          stderr: number;
          interpretation: "improving" | "stable" | "degrading";
          confidence: "high" | "moderate" | "low";
        }

        // Linear regression with statistics
        const linearRegression = (y: number[]): TrendResult | null => {
          const n = y.length;
          if (n < 2) return null;

          // X values are period indices (0, 1, 2, ...)
          const x = y.map((_, i) => i);

          // Calculate means
          const meanX = x.reduce((a, b) => a + b, 0) / n;
          const meanY = y.reduce((a, b) => a + b, 0) / n;

          // OLS: slope = sum((xi-meanX)(yi-meanY)) / sum((xi-meanX)^2)
          let sumXY = 0;
          let sumX2 = 0;
          for (let i = 0; i < n; i++) {
            sumXY += (x[i] - meanX) * (y[i] - meanY);
            sumX2 += (x[i] - meanX) ** 2;
          }
          const slope = sumX2 > 0 ? sumXY / sumX2 : 0;
          const intercept = meanY - slope * meanX;

          // R-squared = 1 - SSres/SStot
          const predicted = x.map((xi) => slope * xi + intercept);
          const ssRes = y.reduce((sum, yi, i) => sum + (yi - predicted[i]) ** 2, 0);
          const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
          const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

          // Standard error and t-statistic for p-value
          const mse = n > 2 ? ssRes / (n - 2) : 0;
          const stderr = sumX2 > 0 ? Math.sqrt(mse / sumX2) : 0;
          const tStat = stderr > 0 ? slope / stderr : 0;

          // Two-tailed p-value using normal approximation
          const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));

          // Interpretation
          const isSignificant = pValue < 0.05;
          let interpretation: "improving" | "stable" | "degrading";
          if (!isSignificant) {
            interpretation = "stable";
          } else if (slope < 0) {
            interpretation = "improving"; // Slippage decreasing over time
          } else {
            interpretation = "degrading"; // Slippage increasing over time
          }

          return {
            slope: Math.round(slope * 10000) / 10000,
            intercept: Math.round(intercept * 100) / 100,
            rSquared: Math.round(rSquared * 10000) / 10000,
            pValue: Math.round(pValue * 10000) / 10000,
            stderr: Math.round(stderr * 10000) / 10000,
            interpretation,
            confidence: n >= 30 ? "high" : n >= 10 ? "moderate" : "low",
          };
        };

        // Helper for correlation interpretation
        const getCorrelationInterpretation = (r: number): string => {
          const abs = Math.abs(r);
          const direction = r >= 0 ? "positive" : "negative";
          if (abs >= 0.7) return `strong ${direction}`;
          if (abs >= 0.4) return `moderate ${direction}`;
          if (abs >= 0.2) return `weak ${direction}`;
          return "negligible";
        };

        // Aggregate all matched trades by period
        const periodSlippages = aggregateByPeriod(matchedTrades);

        // Calculate date range from matched trades
        const dates = matchedTrades.map((t) => t.date).sort();
        const dateRangeResult = {
          from: dates[0],
          to: dates[dates.length - 1],
        };

        // Calculate summary statistics
        const totalSlippage = matchedTrades.reduce((sum, t) => sum + t.totalSlippage, 0);
        const avgSlippagePerTrade = totalSlippage / matchedTrades.length;
        const avgSlippagePerPeriod =
          periodSlippages.length > 0
            ? periodSlippages.reduce((sum, p) => sum + p.totalSlippage, 0) / periodSlippages.length
            : 0;

        // Calculate block-level trend (only if enough samples)
        const periodAvgSlippages = periodSlippages.map((p) => p.avgSlippage);
        const blockTrend =
          matchedTrades.length >= minSamples
            ? linearRegression(periodAvgSlippages)
            : null;

        // Per-strategy breakdown
        const byStrategy = new Map<string, MatchedTradeData[]>();
        for (const trade of matchedTrades) {
          const existing = byStrategy.get(trade.strategy) ?? [];
          existing.push(trade);
          byStrategy.set(trade.strategy, existing);
        }

        const perStrategy: Array<{
          strategy: string;
          matchedTrades: number;
          periodsAnalyzed: number;
          totalSlippage: number;
          trend: TrendResult | null;
        }> = [];

        for (const [strategyName, trades] of byStrategy) {
          if (trades.length < minSamples) {
            perStrategy.push({
              strategy: strategyName,
              matchedTrades: trades.length,
              periodsAnalyzed: 0,
              totalSlippage: trades.reduce((sum, t) => sum + t.totalSlippage, 0),
              trend: null,
            });
            continue;
          }

          const strategyPeriods = aggregateByPeriod(trades);
          const strategyTrend =
            strategyPeriods.length >= 2
              ? linearRegression(strategyPeriods.map((p) => p.avgSlippage))
              : null;

          perStrategy.push({
            strategy: strategyName,
            matchedTrades: trades.length,
            periodsAnalyzed: strategyPeriods.length,
            totalSlippage: trades.reduce((sum, t) => sum + t.totalSlippage, 0),
            trend: strategyTrend,
          });
        }

        // Sort by absolute total slippage descending
        perStrategy.sort(
          (a, b) => Math.abs(b.totalSlippage) - Math.abs(a.totalSlippage)
        );

        // External factor correlation (VIX)
        interface ExternalFactorResult {
          factor: string;
          coefficient: number;
          interpretation: string;
          sampleSize: number;
        }

        let externalFactors:
          | { method: string; results: ExternalFactorResult[] }
          | undefined;

        const vixTrades = matchedTrades.filter(
          (t) => t.openingVix !== undefined && t.openingVix !== null
        );

        if (vixTrades.length >= minSamples) {
          const vixValues = vixTrades.map((t) => t.openingVix!);
          const slippageValues = vixTrades.map((t) => t.totalSlippage);

          const coefficient =
            correlationMethod === "pearson"
              ? pearsonCorrelation(slippageValues, vixValues)
              : kendallTau(slippageValues, vixValues);

          // Only include if meaningful (|r| >= 0.1)
          if (Math.abs(coefficient) >= 0.1) {
            externalFactors = {
              method: correlationMethod,
              results: [
                {
                  factor: "openingVix",
                  coefficient: Math.round(coefficient * 10000) / 10000,
                  interpretation: getCorrelationInterpretation(coefficient),
                  sampleSize: vixTrades.length,
                },
              ],
            };
          }
        }

        // Build summary text
        const summaryParts = [
          `Slippage trends (${granularity}): ${periodSlippages.length} periods, ${matchedTrades.length} trades`,
          `Total: ${formatCurrency(totalSlippage)}`,
        ];

        if (blockTrend) {
          summaryParts.push(
            `Trend: ${blockTrend.interpretation} (p=${blockTrend.pValue.toFixed(3)})`
          );
        }

        const summary = summaryParts.join(" | ");

        // Build structured output
        const structuredData: {
          blockId: string;
          filters: { strategy: string | null; dateRange: { from?: string; to?: string } | null };
          scaling: string;
          granularity: string;
          dateRange: { from: string; to: string };
          summary: {
            matchedTrades: number;
            periodsAnalyzed: number;
            totalSlippage: number;
            avgSlippagePerTrade: number;
            avgSlippagePerPeriod: number;
          };
          trend: TrendResult | null;
          timeSeries?: PeriodSlippage[];
          perStrategy: typeof perStrategy;
          externalFactors?: typeof externalFactors;
        } = {
          blockId,
          filters: {
            strategy: strategy ?? null,
            dateRange: dateRange ?? null,
          },
          scaling,
          granularity,
          dateRange: dateRangeResult,
          summary: {
            matchedTrades: matchedTrades.length,
            periodsAnalyzed: periodSlippages.length,
            totalSlippage: Math.round(totalSlippage * 100) / 100,
            avgSlippagePerTrade: Math.round(avgSlippagePerTrade * 100) / 100,
            avgSlippagePerPeriod: Math.round(avgSlippagePerPeriod * 100) / 100,
          },
          trend: blockTrend,
          perStrategy,
        };

        // Add optional time series data
        if (includeTimeSeries) {
          structuredData.timeSeries = periodSlippages.map((p) => ({
            ...p,
            totalSlippage: Math.round(p.totalSlippage * 100) / 100,
            avgSlippage: Math.round(p.avgSlippage * 100) / 100,
            avgMagnitude: Math.round(p.avgMagnitude * 100) / 100,
          }));
        }

        // Add external factors if available
        if (externalFactors) {
          structuredData.externalFactors = externalFactors;
        }

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing slippage trends: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
