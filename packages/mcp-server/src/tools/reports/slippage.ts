/**
 * Report Slippage Tools
 *
 * Tools for slippage analysis: analyze_discrepancies, suggest_strategy_matches, slippage_trends
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock, loadReportingLog } from "../../utils/block-loader.js";
import {
  createToolOutput,
  formatPercent,
  formatCurrency,
} from "../../utils/output-formatter.js";
import type { ReportingTrade } from "@tradeblocks/lib";
import {
  pearsonCorrelation,
  kendallTau,
  getRanks,
  normalCDF,
} from "@tradeblocks/lib";

/**
 * Register slippage-related report tools
 */
export function registerSlippageTools(
  server: McpServer,
  baseDir: string
): void {
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

          const getConfidence = (n: number): "low" | "moderate" | "high" => {
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
                (a) =>
                  a.hourOfDay !== null && a.hourOfDay >= 9 && a.hourOfDay < 11
              ),
              midday: tradesWithHour.filter(
                (a) =>
                  a.hourOfDay !== null && a.hourOfDay >= 11 && a.hourOfDay < 14
              ),
              afternoon: tradesWithHour.filter(
                (a) =>
                  a.hourOfDay !== null && a.hourOfDay >= 14 && a.hourOfDay <= 16
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

                if (
                  bucketRate >= patternThreshold &&
                  outlierInBucket.length >= 3
                ) {
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
              const slippagesArr = validPairs.map((p) => p.slippage);
              const fieldValues = validPairs.map((p) => p.field);

              const coefficient =
                correlationMethod === "pearson"
                  ? pearsonCorrelation(slippagesArr, fieldValues)
                  : kendallTau(slippagesArr, fieldValues);

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
          .describe(
            "Minimum overlapping trading days required for correlation (default: 5)"
          ),
        minCorrelation: z
          .number()
          .min(-1)
          .max(1)
          .optional()
          .describe(
            "Minimum correlation to include in suggestions (default: show all)"
          ),
        includeUnmatched: z
          .boolean()
          .default(true)
          .describe(
            "Include strategies with no potential matches (default: true)"
          ),
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
        const backtestStrategies = new Set(
          backtestTrades.map((t) => t.strategy)
        );
        const actualStrategies = new Set(actualTrades.map((t) => t.strategy));

        // Helper for case-insensitive strategy comparison
        const normalizeStrategyName = (name: string): string =>
          name.toLowerCase().trim();

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
          trades: Array<{
            strategy: string;
            dateOpened: Date;
            pl: number;
            numContracts: number;
          }>,
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
            const existing = strategyMap.get(dateKey) || {
              totalPl: 0,
              totalContracts: 0,
            };
            existing.totalPl += trade.pl;
            existing.totalContracts += trade.numContracts || 0;
            strategyMap.set(dateKey, existing);
          }
          return result;
        };

        const backtestDaily = buildDailyPlSeries(
          backtestTrades,
          backtestWithExactMatch
        );
        const actualDaily = buildDailyPlSeries(
          actualTrades,
          actualWithExactMatch
        );

        // Helper to get normalized daily P/L values array
        const getNormalizedDailyPl = (
          dailyMap: Map<string, DailyPL>
        ): Map<string, number> => {
          const result = new Map<string, number>();
          for (const [date, data] of dailyMap) {
            // Per-contract normalization if numContracts > 0
            const normalizedPl =
              data.totalContracts > 0
                ? data.totalPl / data.totalContracts
                : data.totalPl;
            result.set(date, normalizedPl);
          }
          return result;
        };

        // Helper to calculate correlation between two strategies
        const calculateCorrelation = (
          btDaily: Map<string, number>,
          actualDailyMap: Map<string, number>,
          method: "pearson" | "spearman" | "kendall"
        ): { correlation: number; overlapDays: number } => {
          // Find overlapping dates
          const btDates = new Set(btDaily.keys());
          const overlapDates: string[] = [];
          for (const date of actualDailyMap.keys()) {
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
            actualValues.push(actualDailyMap.get(date)!);
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
          btDailyMap: Map<string, DailyPL>,
          actualDailyMap: Map<string, DailyPL>
        ): number => {
          const btDates = new Set(btDailyMap.keys());
          const actualDates = new Set(actualDailyMap.keys());
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
        const correlationResults: Map<
          string,
          Map<string, CorrelationResult>
        > = new Map();

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
            const timingOverlap = calculateTimingOverlap(
              btRawDaily,
              actualRawDaily
            );

            rowCorrelations.push(isNaN(correlation) ? 0 : correlation);
            rowSampleSizes.push(overlapDays);
            btResults.set(actualStrategy, {
              correlation,
              overlapDays,
              timingOverlap,
            });
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
                const diff =
                  actualNormalized.get(date)! - btNormalized.get(date)!;
                differences.push(diff);
              }
              const meanDiff =
                differences.reduce((a, b) => a + b, 0) / differences.length;
              const stdDiff = Math.sqrt(
                differences.reduce(
                  (sum, d) => sum + Math.pow(d - meanDiff, 2),
                  0
                ) / differences.length
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
            if (
              minCorrelation !== undefined &&
              result.correlation < minCorrelation
            ) {
              continue;
            }

            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { actualStrategy, confidence, result };
            }
          }

          if (bestMatch) {
            const { actualStrategy, confidence, result } = bestMatch;
            const correlationDesc =
              result.correlation >= 0.7
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
        const summaryObj = {
          backtestStrategies: backtestStrategies.size,
          actualStrategies: actualStrategies.size,
          exactMatches: exactMatches.length,
          suggestedMatches: suggestedMatches.length,
          unmatchableCount: unmatchable.length,
          unmatchedBacktestOnly: unmatchedBacktestOnly.length,
          unmatchedActualOnly: unmatchedActualOnly.length,
        };

        const structuredData = {
          summary: summaryObj,
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
          .describe(
            "Include raw time series data points in output (for charting)"
          ),
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
        const aggregateByPeriod = (
          trades: MatchedTradeData[]
        ): PeriodSlippage[] => {
          const periodMap = new Map<
            string,
            { slippages: number[]; count: number }
          >();

          for (const trade of trades) {
            const periodKey = getPeriodKey(trade.date);
            const existing = periodMap.get(periodKey) || {
              slippages: [],
              count: 0,
            };
            existing.slippages.push(trade.totalSlippage);
            existing.count++;
            periodMap.set(periodKey, existing);
          }

          const periods: PeriodSlippage[] = [];
          for (const [period, data] of periodMap) {
            const totalSlippage = data.slippages.reduce((sum, s) => sum + s, 0);
            const avgSlippage = totalSlippage / data.count;
            const avgMagnitude =
              data.slippages.reduce((sum, s) => sum + Math.abs(s), 0) /
              data.count;

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
          const ssRes = y.reduce(
            (sum, yi, i) => sum + (yi - predicted[i]) ** 2,
            0
          );
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
        const totalSlippage = matchedTrades.reduce(
          (sum, t) => sum + t.totalSlippage,
          0
        );
        const avgSlippagePerTrade = totalSlippage / matchedTrades.length;
        const avgSlippagePerPeriod =
          periodSlippages.length > 0
            ? periodSlippages.reduce((sum, p) => sum + p.totalSlippage, 0) /
              periodSlippages.length
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
          filters: {
            strategy: string | null;
            dateRange: { from?: string; to?: string } | null;
          };
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
