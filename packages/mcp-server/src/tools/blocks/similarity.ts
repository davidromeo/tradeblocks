/**
 * Block Similarity Tools
 *
 * Tools for strategy similarity analysis: strategy_similarity, what_if_scaling
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock } from "../../utils/block-loader.js";
import {
  createToolOutput,
  formatPercent,
  formatRatio,
} from "../../utils/output-formatter.js";
import {
  PortfolioStatsCalculator,
  calculateCorrelationMatrix,
  performTailRiskAnalysis,
} from "@tradeblocks/lib";
import type { Trade } from "@tradeblocks/lib";
import { filterByDateRange } from "../shared/filters.js";
import { withSyncedBlock } from "../middleware/sync-middleware.js";

const SIMILARITY_DEFAULTS = {
  correlationThreshold: 0.7,
  tailDependenceThreshold: 0.5,
  method: "kendall" as const,
  minSharedDays: 30,
  topN: 5,
};

/**
 * Register similarity block tools
 */
export function registerSimilarityBlockTools(
  server: McpServer,
  baseDir: string
): void {
  const calculator = new PortfolioStatsCalculator();

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
          .default(SIMILARITY_DEFAULTS.correlationThreshold)
          .describe(
            `Minimum correlation to flag as similar (default: ${SIMILARITY_DEFAULTS.correlationThreshold})`
          ),
        tailDependenceThreshold: z
          .number()
          .min(0)
          .max(1)
          .default(SIMILARITY_DEFAULTS.tailDependenceThreshold)
          .describe(
            `Minimum tail dependence to flag as high joint risk (default: ${SIMILARITY_DEFAULTS.tailDependenceThreshold})`
          ),
        method: z
          .enum(["kendall", "spearman", "pearson"])
          .default(SIMILARITY_DEFAULTS.method)
          .describe(`Correlation method (default: ${SIMILARITY_DEFAULTS.method})`),
        minSharedDays: z
          .number()
          .int()
          .min(1)
          .default(SIMILARITY_DEFAULTS.minSharedDays)
          .describe(
            `Minimum shared trading days for valid comparison (default: ${SIMILARITY_DEFAULTS.minSharedDays})`
          ),
        topN: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(SIMILARITY_DEFAULTS.topN)
          .describe(
            `Number of most similar pairs to return (default: ${SIMILARITY_DEFAULTS.topN})`
          ),
      }),
    },
    withSyncedBlock(
      baseDir,
      async ({
        blockId,
        correlationThreshold,
        tailDependenceThreshold,
        method,
        minSharedDays,
        topN,
      }) => {
        // Apply defaults for optional parameters (zod defaults may not apply through MCP CLI)
        const corrThreshold =
          correlationThreshold ?? SIMILARITY_DEFAULTS.correlationThreshold;
        const tailThreshold =
          tailDependenceThreshold ??
          SIMILARITY_DEFAULTS.tailDependenceThreshold;
        const corrMethod = method ?? SIMILARITY_DEFAULTS.method;
        const minDays = minSharedDays ?? SIMILARITY_DEFAULTS.minSharedDays;
        const limit = topN ?? SIMILARITY_DEFAULTS.topN;

        try {
          const block = await loadBlock(baseDir, blockId);
          const trades = block.trades;

          if (trades.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No trades found in block "${blockId}".`,
                },
              ],
            };
          }

        // Get unique strategies
        const strategies = Array.from(
          new Set(trades.map((t) => t.strategy))
        ).sort();

        // Need at least 2 strategies for similarity analysis
          if (strategies.length < 2) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Strategy similarity requires at least 2 strategies. Found ${strategies.length} strategy in block "${blockId}".`,
                },
              ],
              isError: true as const,
            };
          }

        // Calculate correlation matrix using existing utility
        const correlationMatrix = calculateCorrelationMatrix(trades, {
          method: corrMethod,
          normalization: "raw",
          dateBasis: "opened",
          alignment: "shared",
        });

        // Calculate tail risk using existing utility
        const tailRisk = performTailRiskAnalysis(trades, {
          normalization: "raw",
          dateBasis: "opened",
          minTradingDays: minDays,
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
            const overlapScore =
              allDates.size > 0 ? sharedDates / allDates.size : 0;

            // Use sharedDaysFromCorr or calculate from overlap
            const sharedTradingDays =
              sharedDaysFromCorr > 0 ? sharedDaysFromCorr : sharedDates;

            // Calculate composite similarity score (weighted average)
            // 50% correlation (absolute value), 30% tail dependence, 20% overlap score
            let compositeSimilarity: number | null = null;
            if (correlation !== null && !Number.isNaN(correlation)) {
              const corrComponent = Math.abs(correlation) * 0.5;
              const tailComponent =
                (tailDependence !== null ? tailDependence : 0) * 0.3;
              const overlapComponent = overlapScore * 0.2;
              compositeSimilarity =
                corrComponent + tailComponent + overlapComponent;
            }

            // Determine flags
            const isHighCorrelation =
              correlation !== null &&
              !Number.isNaN(correlation) &&
              Math.abs(correlation) >= corrThreshold;
            const isHighTailDependence =
              tailDependence !== null && tailDependence >= tailThreshold;
            const isRedundant = isHighCorrelation && isHighTailDependence;

            // Only include pairs that meet minDays requirement
            if (sharedTradingDays >= minDays) {
              // Update counters (only for included pairs)
              if (isHighCorrelation) highCorrelationPairs++;
              if (isHighTailDependence) highTailDependencePairs++;
              if (isRedundant) redundantPairs++;

              pairs.push({
                strategyA,
                strategyB,
                correlation:
                  correlation !== null && !Number.isNaN(correlation)
                    ? correlation
                    : null,
                tailDependence,
                overlapScore,
                compositeSimilarity,
                sharedTradingDays,
                flags: {
                  isHighCorrelation,
                  isHighTailDependence,
                  isRedundant,
                },
              });
            }
          }
        }

        // Sort by composite similarity (highest first), handling nulls
        pairs.sort((a, b) => {
          if (a.compositeSimilarity === null && b.compositeSimilarity === null)
            return 0;
          if (a.compositeSimilarity === null) return 1;
          if (b.compositeSimilarity === null) return -1;
          return b.compositeSimilarity - a.compositeSimilarity;
        });

        // Apply limit
        const topPairs = pairs.slice(0, limit);

        // Build summary line
        const mostSimilar = topPairs[0];
        const summary = `Strategy Similarity: ${blockId} | ${strategies.length} strategies | ${redundantPairs} redundant pairs | Most similar: ${mostSimilar ? `${mostSimilar.strategyA}-${mostSimilar.strategyB} (${mostSimilar.compositeSimilarity?.toFixed(2) ?? "N/A"})` : "N/A"}`;

        // Build structured data
        const structuredData = {
          blockId,
          options: {
            correlationThreshold: corrThreshold,
            tailDependenceThreshold: tailThreshold,
            method: corrMethod,
            minSharedDays: minDays,
            topN: limit,
          },
          strategySummary: {
            totalStrategies: strategies.length,
            totalPairs: (strategies.length * (strategies.length - 1)) / 2,
            redundantPairs,
            highCorrelationPairs,
            highTailDependencePairs,
          },
          similarPairs: topPairs,
        };

          return createToolOutput(summary, structuredData);
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error calculating strategy similarity: ${(error as Error).message}`,
              },
            ],
            isError: true as const,
          };
        }
      }
    )
  );

  // Tool 11: what_if_scaling
  server.registerTool(
    "what_if_scaling",
    {
      description:
        "Explore strategy weight combinations within a portfolio. Answer 'what if I scaled strategy X to 0.5x?' questions. Shows before/after comparison with per-strategy breakdown.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategyWeights: z
          .record(z.string(), z.number().min(0).max(2))
          .optional()
          .describe(
            'Weight per strategy, e.g., {"5/7 17Δ": 0.5}. Unspecified strategies default to 1.0. Weight 0 = exclude strategy entirely. Max weight: 2.0'
          ),
        startDate: z
          .string()
          .optional()
          .describe("Start date filter (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
      }),
    },
    withSyncedBlock(
      baseDir,
      async ({ blockId, strategyWeights, startDate, endDate }) => {
        try {
          const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply date range filter
        trades = filterByDateRange(trades, startDate, endDate);

        if (trades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No trades found in block "${blockId}"${startDate || endDate ? " for the specified date range" : ""}.`,
              },
            ],
            isError: true,
          };
        }

        // Get all unique strategies
        const strategies = Array.from(
          new Set(trades.map((t) => t.strategy))
        ).sort();

        // Build applied weights (default 1.0 for unspecified)
        const appliedWeights: Record<string, number> = {};
        const unknownStrategies: string[] = [];

        // Initialize all strategies to 1.0
        for (const strategy of strategies) {
          appliedWeights[strategy] = 1.0;
        }

        // Apply user-specified weights
        if (strategyWeights) {
          for (const [strategy, weight] of Object.entries(strategyWeights)) {
            // Find matching strategy (case-insensitive)
            const matchedStrategy = strategies.find(
              (s) => s.toLowerCase() === strategy.toLowerCase()
            );
            if (matchedStrategy) {
              appliedWeights[matchedStrategy] = weight;
            } else {
              unknownStrategies.push(strategy);
            }
          }
        }

        // Check if all strategies have weight 0 (empty scaled portfolio)
        const allZeroWeight = Object.values(appliedWeights).every(
          (w) => w === 0
        );
        if (allZeroWeight) {
          return {
            content: [
              {
                type: "text",
                text: `Error: All strategies have weight 0. This would result in an empty portfolio.`,
              },
            ],
            isError: true,
          };
        }

        // Calculate original (baseline) portfolio metrics using trade-based calculations
        const baselineStats = calculator.calculatePortfolioStats(
          trades,
          undefined, // No daily logs per Phase 17 constraint
          true // Force trade-based calculations
        );

        // Build scaled trades: scale P/L and commissions proportionally
        type ScaledTrade = Trade & {
          scaledPl: number;
          scaledOpeningComm: number;
          scaledClosingComm: number;
          weight: number;
        };

        const scaledTrades: ScaledTrade[] = [];
        for (const trade of trades) {
          const weight = appliedWeights[trade.strategy];
          if (weight === 0) {
            // Exclude trade entirely
            continue;
          }

          scaledTrades.push({
            ...trade,
            scaledPl: trade.pl * weight,
            scaledOpeningComm: trade.openingCommissionsFees * weight,
            scaledClosingComm: trade.closingCommissionsFees * weight,
            weight,
          } as ScaledTrade);
        }

        // Create modified trades for scaled portfolio calculation
        // We need to modify pl, commissions, AND fundsAtClose for the calculator.
        // fundsAtClose must be recalculated to reflect the scaled equity curve,
        // otherwise drawdown calculations will use unscaled equity values.

        // First, get original initial capital from trades
        const sortedOriginal = [...trades]
          .filter((t) => t.dateClosed && t.fundsAtClose !== undefined)
          .sort((a, b) => {
            const dateA = new Date(a.dateClosed!);
            const dateB = new Date(b.dateClosed!);
            const cmp = dateA.getTime() - dateB.getTime();
            if (cmp !== 0) return cmp;
            return (a.timeClosed || "").localeCompare(b.timeClosed || "");
          });
        const originalInitialCapital =
          sortedOriginal.length > 0
            ? PortfolioStatsCalculator.calculateInitialCapital(sortedOriginal)
            : 1000000; // Fallback

        // Sort scaled trades by close date to build equity curve
        const sortedScaled = [...scaledTrades]
          .filter((t) => t.dateClosed)
          .sort((a, b) => {
            const dateA = new Date(a.dateClosed!);
            const dateB = new Date(b.dateClosed!);
            const cmp = dateA.getTime() - dateB.getTime();
            if (cmp !== 0) return cmp;
            return (a.timeClosed || "").localeCompare(b.timeClosed || "");
          });

        // Build a map of trade index -> scaled fundsAtClose
        // by accumulating scaled P&L from initial capital
        let runningEquity = originalInitialCapital;
        const scaledFundsAtCloseMap = new Map<number, number>();
        for (const st of sortedScaled) {
          runningEquity += st.scaledPl;
          // Find the index of this trade in the original scaledTrades array
          const idx = scaledTrades.indexOf(st);
          scaledFundsAtCloseMap.set(idx, runningEquity);
        }

        const modifiedTrades: Trade[] = scaledTrades.map((st, idx) => ({
          ...st,
          pl: st.scaledPl,
          openingCommissionsFees: st.scaledOpeningComm,
          closingCommissionsFees: st.scaledClosingComm,
          // Use the recalculated fundsAtClose based on scaled P&L
          fundsAtClose: scaledFundsAtCloseMap.get(idx) ?? st.fundsAtClose,
        }));

        // Calculate scaled portfolio metrics
        const scaledStats = calculator.calculatePortfolioStats(
          modifiedTrades,
          undefined,
          true
        );

        // Calculate comparison deltas
        const calcDelta = (
          original: number | null,
          scaled: number | null
        ): {
          original: number | null;
          scaled: number | null;
          delta: number | null;
          deltaPct: number | null;
        } => {
          if (original === null || scaled === null) {
            return { original, scaled, delta: null, deltaPct: null };
          }
          const delta = scaled - original;
          const deltaPct =
            original !== 0 ? (delta / Math.abs(original)) * 100 : null;
          return { original, scaled, delta, deltaPct };
        };

        const comparison = {
          sharpeRatio: calcDelta(
            baselineStats.sharpeRatio ?? null,
            scaledStats.sharpeRatio ?? null
          ),
          sortinoRatio: calcDelta(
            baselineStats.sortinoRatio ?? null,
            scaledStats.sortinoRatio ?? null
          ),
          maxDrawdown: calcDelta(
            baselineStats.maxDrawdown,
            scaledStats.maxDrawdown
          ),
          netPl: calcDelta(baselineStats.netPl, scaledStats.netPl),
          totalTrades: {
            original: baselineStats.totalTrades,
            scaled: scaledStats.totalTrades, // Scaled excludes weight=0 trades
          },
        };

        // Calculate per-strategy breakdown
        interface StrategyBreakdown {
          strategy: string;
          weight: number;
          original: {
            trades: number;
            netPl: number;
            plContributionPct: number;
          };
          scaled: {
            trades: number;
            netPl: number;
            plContributionPct: number;
          };
          delta: {
            netPl: number;
            netPlPct: number;
          };
        }

        const perStrategy: StrategyBreakdown[] = [];

        // Calculate total P/L for contribution percentages
        let totalOriginalPl = 0;
        let totalScaledPl = 0;

        // Group trades by strategy for original stats
        const originalByStrategy: Record<
          string,
          { trades: number; netPl: number }
        > = {};
        for (const trade of trades) {
          if (!originalByStrategy[trade.strategy]) {
            originalByStrategy[trade.strategy] = { trades: 0, netPl: 0 };
          }
          originalByStrategy[trade.strategy].trades++;
          const netPl =
            trade.pl -
            trade.openingCommissionsFees -
            trade.closingCommissionsFees;
          originalByStrategy[trade.strategy].netPl += netPl;
          totalOriginalPl += netPl;
        }

        // Group scaled trades by strategy
        const scaledByStrategy: Record<
          string,
          { trades: number; netPl: number }
        > = {};
        for (const st of scaledTrades) {
          if (!scaledByStrategy[st.strategy]) {
            scaledByStrategy[st.strategy] = { trades: 0, netPl: 0 };
          }
          scaledByStrategy[st.strategy].trades++;
          const netPl =
            st.scaledPl - st.scaledOpeningComm - st.scaledClosingComm;
          scaledByStrategy[st.strategy].netPl += netPl;
          totalScaledPl += netPl;
        }

        // Build per-strategy breakdown for ALL strategies
        for (const strategy of strategies) {
          const weight = appliedWeights[strategy];
          const orig = originalByStrategy[strategy] ?? { trades: 0, netPl: 0 };
          const scaled = scaledByStrategy[strategy] ?? { trades: 0, netPl: 0 };

          const origContributionPct =
            totalOriginalPl !== 0
              ? (orig.netPl / Math.abs(totalOriginalPl)) * 100
              : 0;
          const scaledContributionPct =
            totalScaledPl !== 0
              ? (scaled.netPl / Math.abs(totalScaledPl)) * 100
              : 0;

          const deltaNetPl = scaled.netPl - orig.netPl;
          const deltaNetPlPct =
            orig.netPl !== 0 ? (deltaNetPl / Math.abs(orig.netPl)) * 100 : 0;

          perStrategy.push({
            strategy,
            weight,
            original: {
              trades: orig.trades,
              netPl: orig.netPl,
              plContributionPct: origContributionPct,
            },
            scaled: {
              trades: weight === 0 ? 0 : scaled.trades, // 0 trades if excluded
              netPl: scaled.netPl,
              plContributionPct: scaledContributionPct,
            },
            delta: {
              netPl: deltaNetPl,
              netPlPct: deltaNetPlPct,
            },
          });
        }

        // Sort by original net P/L descending (highest contributors first)
        perStrategy.sort((a, b) => b.original.netPl - a.original.netPl);

        // Build summary line
        const sharpeDelta = comparison.sharpeRatio.deltaPct;
        const mddDelta = comparison.maxDrawdown.deltaPct;
        const summary = `What-If Scaling: ${blockId} | Sharpe ${formatRatio(baselineStats.sharpeRatio)} -> ${formatRatio(scaledStats.sharpeRatio)} (${sharpeDelta !== null ? (sharpeDelta >= 0 ? "+" : "") + sharpeDelta.toFixed(1) + "%" : "N/A"}) | MDD ${formatPercent(baselineStats.maxDrawdown)} -> ${formatPercent(scaledStats.maxDrawdown)} (${mddDelta !== null ? (mddDelta >= 0 ? "+" : "") + mddDelta.toFixed(1) + "%" : "N/A"})`;

        // Build structured data
        const structuredData = {
          blockId,
          strategyWeights: appliedWeights,
          dateRange: {
            start: startDate ?? null,
            end: endDate ?? null,
          },
          unknownStrategies:
            unknownStrategies.length > 0 ? unknownStrategies : undefined,
          comparison,
          perStrategy,
        };

          return createToolOutput(summary, structuredData);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error calculating what-if scaling: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      }
    )
  );
}
