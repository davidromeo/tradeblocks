/**
 * Block Health Tools
 *
 * Portfolio health assessment: portfolio_health_check
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
  runMonteCarloSimulation,
  WalkForwardAnalyzer,
} from "@tradeblocks/lib";
import type { MonteCarloParams } from "@tradeblocks/lib";
import { withSyncedBlock } from "../middleware/sync-middleware.js";

const HEALTH_CHECK_DEFAULTS = {
  correlationThreshold: 0.5,
  tailDependenceThreshold: 0.5,
  profitProbabilityThreshold: 0.95,
  wfeThreshold: -0.15,
  mddMultiplierThreshold: 3.0,
};

/**
 * Register health block tools
 */
export function registerHealthBlockTools(
  server: McpServer,
  baseDir: string
): void {
  const calculator = new PortfolioStatsCalculator();

  // Tool 13: portfolio_health_check
  server.registerTool(
    "portfolio_health_check",
    {
      description:
        "Run comprehensive portfolio health assessment combining correlation, tail risk, Monte Carlo, and walk-forward analysis. Returns unified 4-layer report: verdict -> grades -> flags -> key numbers.",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        correlationThreshold: z
          .number()
          .min(0)
          .max(1)
          .default(HEALTH_CHECK_DEFAULTS.correlationThreshold)
          .describe(
            `Flag correlation pairs above this (default: ${HEALTH_CHECK_DEFAULTS.correlationThreshold})`
          ),
        tailDependenceThreshold: z
          .number()
          .min(0)
          .max(1)
          .default(HEALTH_CHECK_DEFAULTS.tailDependenceThreshold)
          .describe(
            `Flag tail dependence pairs above this (default: ${HEALTH_CHECK_DEFAULTS.tailDependenceThreshold})`
          ),
        profitProbabilityThreshold: z
          .number()
          .min(0)
          .max(1)
          .default(HEALTH_CHECK_DEFAULTS.profitProbabilityThreshold)
          .describe(
            `Monte Carlo profit probability warning threshold (default: ${HEALTH_CHECK_DEFAULTS.profitProbabilityThreshold})`
          ),
        wfeThreshold: z
          .number()
          .default(HEALTH_CHECK_DEFAULTS.wfeThreshold)
          .describe(
            `Walk-forward efficiency warning threshold (default: ${HEALTH_CHECK_DEFAULTS.wfeThreshold})`
          ),
        mddMultiplierThreshold: z
          .number()
          .min(1)
          .default(HEALTH_CHECK_DEFAULTS.mddMultiplierThreshold)
          .describe(
            `MC median MDD vs historical MDD multiplier warning threshold (default: ${HEALTH_CHECK_DEFAULTS.mddMultiplierThreshold})`
          ),
      }),
    },
    withSyncedBlock(
      baseDir,
      async ({
        blockId,
        correlationThreshold,
        tailDependenceThreshold,
        profitProbabilityThreshold,
        wfeThreshold,
        mddMultiplierThreshold,
      }) => {
        // Apply defaults for optional parameters
        const corrThreshold =
          correlationThreshold ?? HEALTH_CHECK_DEFAULTS.correlationThreshold;
        const tailThreshold =
          tailDependenceThreshold ??
          HEALTH_CHECK_DEFAULTS.tailDependenceThreshold;
        const profitThreshold =
          profitProbabilityThreshold ??
          HEALTH_CHECK_DEFAULTS.profitProbabilityThreshold;
        const wfeThresh = wfeThreshold ?? HEALTH_CHECK_DEFAULTS.wfeThreshold;
        const mddMultThresh =
          mddMultiplierThreshold ??
          HEALTH_CHECK_DEFAULTS.mddMultiplierThreshold;

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
              isError: true as const,
            };
          }

        // Get unique strategies
        const strategies = Array.from(
          new Set(trades.map((t) => t.strategy))
        ).sort();

        // Require at least 2 strategies and 20 trades
          if (strategies.length < 2) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Portfolio health check requires at least 2 strategies. Found ${strategies.length} strategy in block "${blockId}".`,
                },
              ],
              isError: true as const,
            };
          }

          if (trades.length < 20) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Portfolio health check requires at least 20 trades. Found ${trades.length} trades in block "${blockId}".`,
                },
              ],
              isError: true as const,
            };
          }

        // Calculate portfolio stats
        const stats = calculator.calculatePortfolioStats(
          trades,
          undefined, // No daily logs per Phase 17 constraint
          true // Force trade-based calculations
        );

        // Calculate correlation matrix (kendall, raw, opened)
        const correlationMatrix = calculateCorrelationMatrix(trades, {
          method: "kendall",
          normalization: "raw",
          dateBasis: "opened",
          alignment: "shared",
        });

        // Calculate tail risk (0.1 threshold)
        const tailRisk = performTailRiskAnalysis(trades, {
          tailThreshold: 0.1,
          normalization: "raw",
          dateBasis: "opened",
          minTradingDays: 10, // Lower requirement for health check
        });

        // Run Monte Carlo (1000 sims, trades method)
        const sortedTrades = [...trades].sort(
          (a, b) =>
            new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
        );
        const firstTrade = sortedTrades[0];
        const lastTrade = sortedTrades[sortedTrades.length - 1];
        const inferredCapital = firstTrade.fundsAtClose - firstTrade.pl;
        const initialCapital = inferredCapital > 0 ? inferredCapital : 100000;
        const daySpan =
          (new Date(lastTrade.dateOpened).getTime() -
            new Date(firstTrade.dateOpened).getTime()) /
          (24 * 60 * 60 * 1000);
        const calculatedTradesPerYear =
          daySpan > 0 ? (trades.length / daySpan) * 365 : 252;

        const mcParams: MonteCarloParams = {
          numSimulations: 1000,
          simulationLength: trades.length,
          resampleMethod: "trades",
          initialCapital,
          tradesPerYear: calculatedTradesPerYear,
          worstCaseEnabled: true,
          worstCasePercentage: 5,
          worstCaseMode: "pool",
          worstCaseBasedOn: "simulation",
          worstCaseSizing: "relative",
        };

        const mcResult = runMonteCarloSimulation(trades, mcParams);
        const mcStats = mcResult.statistics;

        // Run WFA if possible (try 5 IS windows, 1 OOS)
        let wfeResult: number | null = null;
        let wfaSkipped = false;
        try {
          const totalDays = Math.ceil(
            (new Date(lastTrade.dateOpened).getTime() -
              new Date(firstTrade.dateOpened).getTime()) /
              (24 * 60 * 60 * 1000)
          );
          const isWindowCount = 5;
          const oosWindowCount = 1;
          const totalWindows = isWindowCount + oosWindowCount;
          const daysPerWindow = Math.floor(totalDays / totalWindows);
          const inSampleDays = daysPerWindow * isWindowCount;
          const outOfSampleDays = daysPerWindow * oosWindowCount;
          const stepSizeDays = daysPerWindow;

          // Only run if we have enough data
          if (
            inSampleDays >= 7 &&
            outOfSampleDays >= 1 &&
            trades.length >= 20
          ) {
            const analyzer = new WalkForwardAnalyzer();
            const computation = await analyzer.analyze({
              trades,
              config: {
                inSampleDays,
                outOfSampleDays,
                stepSizeDays,
                optimizationTarget: "sharpeRatio",
                parameterRanges: {},
                minInSampleTrades: 10,
                minOutOfSampleTrades: 3,
              },
            });
            wfeResult = computation.results.summary.degradationFactor;
          } else {
            wfaSkipped = true;
          }
        } catch {
          wfaSkipped = true;
        }

        // Calculate average correlation and tail dependence
        let totalCorrelation = 0;
        let correlationCount = 0;
        for (let i = 0; i < correlationMatrix.strategies.length; i++) {
          for (let j = i + 1; j < correlationMatrix.strategies.length; j++) {
            const val = correlationMatrix.correlationData[i][j];
            if (!Number.isNaN(val) && val !== null) {
              totalCorrelation += Math.abs(val);
              correlationCount++;
            }
          }
        }
        const avgCorrelation =
          correlationCount > 0 ? totalCorrelation / correlationCount : 0;

        let totalTailDependence = 0;
        let tailCount = 0;
        for (let i = 0; i < tailRisk.strategies.length; i++) {
          for (let j = i + 1; j < tailRisk.strategies.length; j++) {
            const valAB = tailRisk.jointTailRiskMatrix[i]?.[j];
            const valBA = tailRisk.jointTailRiskMatrix[j]?.[i];
            if (
              valAB !== undefined &&
              valBA !== undefined &&
              !Number.isNaN(valAB) &&
              !Number.isNaN(valBA)
            ) {
              totalTailDependence += (valAB + valBA) / 2;
              tailCount++;
            }
          }
        }
        const avgTailDependence =
          tailCount > 0 ? totalTailDependence / tailCount : 0;

        // Build flags array
        type Flag = {
          type: "warning" | "pass";
          dimension:
            | "diversification"
            | "tailRisk"
            | "robustness"
            | "consistency";
          message: string;
        };
        const flags: Flag[] = [];

        // High correlation pairs
        const highCorrPairs: string[] = [];
        for (let i = 0; i < correlationMatrix.strategies.length; i++) {
          for (let j = i + 1; j < correlationMatrix.strategies.length; j++) {
            const val = correlationMatrix.correlationData[i][j];
            if (!Number.isNaN(val) && Math.abs(val) > corrThreshold) {
              const sampleSize = correlationMatrix.sampleSizes[i][j];
              highCorrPairs.push(
                `${correlationMatrix.strategies[i]} & ${correlationMatrix.strategies[j]} (${val.toFixed(2)}, n=${sampleSize})`
              );
            }
          }
        }
        if (highCorrPairs.length > 0) {
          flags.push({
            type: "warning",
            dimension: "diversification",
            message: `High correlation pairs (>${corrThreshold}): ${highCorrPairs.join(", ")}`,
          });
        } else {
          flags.push({
            type: "pass",
            dimension: "diversification",
            message: `No correlation pairs above ${corrThreshold} threshold`,
          });
        }

        // High tail dependence pairs
        // Build strategy-to-correlation-index map for per-pair sample sizes
        const corrStrategyIndex = new Map<string, number>();
        correlationMatrix.strategies.forEach((s, i) =>
          corrStrategyIndex.set(s, i)
        );

        const highTailPairs: string[] = [];
        for (let i = 0; i < tailRisk.strategies.length; i++) {
          for (let j = i + 1; j < tailRisk.strategies.length; j++) {
            const valAB = tailRisk.jointTailRiskMatrix[i]?.[j];
            const valBA = tailRisk.jointTailRiskMatrix[j]?.[i];
            if (
              valAB !== undefined &&
              valBA !== undefined &&
              !Number.isNaN(valAB) &&
              !Number.isNaN(valBA)
            ) {
              const avgTail = (valAB + valBA) / 2;
              if (avgTail > tailThreshold) {
                // Look up per-pair sample size from correlation matrix
                const corrI = corrStrategyIndex.get(tailRisk.strategies[i]);
                const corrJ = corrStrategyIndex.get(tailRisk.strategies[j]);
                const pairSampleSize =
                  corrI !== undefined && corrJ !== undefined
                    ? correlationMatrix.sampleSizes[corrI][corrJ]
                    : null;
                highTailPairs.push(
                  `${tailRisk.strategies[i]} & ${tailRisk.strategies[j]} (${avgTail.toFixed(2)}${pairSampleSize !== null ? `, n=${pairSampleSize}` : ""})`
                );
              }
            }
          }
        }
        if (highTailPairs.length > 0) {
          flags.push({
            type: "warning",
            dimension: "tailRisk",
            message: `High tail dependence pairs (>${tailThreshold}): ${highTailPairs.join(", ")}`,
          });
        } else {
          flags.push({
            type: "pass",
            dimension: "tailRisk",
            message: `No tail dependence pairs above ${tailThreshold} threshold`,
          });
        }

        // MC profit probability below threshold
        if (mcStats.probabilityOfProfit < profitThreshold) {
          flags.push({
            type: "warning",
            dimension: "consistency",
            message: `Monte Carlo profit probability (${formatPercent(mcStats.probabilityOfProfit * 100)}) below ${formatPercent(profitThreshold * 100)} threshold`,
          });
        } else {
          flags.push({
            type: "pass",
            dimension: "consistency",
            message: `Monte Carlo profit probability (${formatPercent(mcStats.probabilityOfProfit * 100)}) meets ${formatPercent(profitThreshold * 100)} threshold`,
          });
        }

        // MC median MDD vs historical MDD multiplier
        // mcStats.medianMaxDrawdown is a decimal (0.12 = 12%)
        // stats.maxDrawdown is a percentage (12 = 12%)
        // Convert stats.maxDrawdown to decimal for comparison
        const historicalMddDecimal = stats.maxDrawdown / 100;
        const mcMddMultiplier =
          historicalMddDecimal > 0
            ? mcStats.medianMaxDrawdown / historicalMddDecimal
            : null;
        if (mcMddMultiplier !== null && mcMddMultiplier > mddMultThresh) {
          flags.push({
            type: "warning",
            dimension: "consistency",
            message: `Monte Carlo median MDD (${formatPercent(mcStats.medianMaxDrawdown * 100)}) is ${mcMddMultiplier.toFixed(1)}x historical MDD (${formatPercent(stats.maxDrawdown)}) - exceeds ${mddMultThresh}x threshold`,
          });
        } else if (mcMddMultiplier !== null) {
          flags.push({
            type: "pass",
            dimension: "consistency",
            message: `Monte Carlo median MDD (${formatPercent(mcStats.medianMaxDrawdown * 100)}) is ${mcMddMultiplier.toFixed(1)}x historical MDD - within ${mddMultThresh}x threshold`,
          });
        }

        // WFE below threshold (only if WFA ran)
        if (!wfaSkipped && wfeResult !== null) {
          if (wfeResult < wfeThresh) {
            flags.push({
              type: "warning",
              dimension: "robustness",
              message: `Walk-forward efficiency (${formatPercent(wfeResult * 100)}) below ${formatPercent(wfeThresh * 100)} threshold`,
            });
          } else {
            flags.push({
              type: "pass",
              dimension: "robustness",
              message: `Walk-forward efficiency (${formatPercent(wfeResult * 100)}) meets ${formatPercent(wfeThresh * 100)} threshold`,
            });
          }
        }

        // Build grades
        type Grade = "A" | "B" | "C" | "F";

        // Diversification grade based on avg correlation (A: <0.2, B: <0.4, C: <0.6, F: >=0.6)
        let diversificationGrade: Grade;
        if (avgCorrelation < 0.2) diversificationGrade = "A";
        else if (avgCorrelation < 0.4) diversificationGrade = "B";
        else if (avgCorrelation < 0.6) diversificationGrade = "C";
        else diversificationGrade = "F";

        // Tail risk grade based on avg joint tail risk (A: <0.3, B: <0.5, C: <0.7, F: >=0.7)
        let tailRiskGrade: Grade;
        if (avgTailDependence < 0.3) tailRiskGrade = "A";
        else if (avgTailDependence < 0.5) tailRiskGrade = "B";
        else if (avgTailDependence < 0.7) tailRiskGrade = "C";
        else tailRiskGrade = "F";

        // Robustness grade based on WFE (A: >0, B: >-0.1, C: >-0.2, F: <=-0.2), null if WFA skipped
        let robustnessGrade: Grade | null;
        if (wfaSkipped || wfeResult === null) {
          robustnessGrade = null;
        } else if (wfeResult > 0) {
          robustnessGrade = "A";
        } else if (wfeResult > -0.1) {
          robustnessGrade = "B";
        } else if (wfeResult > -0.2) {
          robustnessGrade = "C";
        } else {
          robustnessGrade = "F";
        }

        // Consistency grade based on MC profit probability (A: >=0.98, B: >=0.90, C: >=0.70, F: <0.70)
        let consistencyGrade: Grade;
        if (mcStats.probabilityOfProfit >= 0.98) consistencyGrade = "A";
        else if (mcStats.probabilityOfProfit >= 0.9) consistencyGrade = "B";
        else if (mcStats.probabilityOfProfit >= 0.7) consistencyGrade = "C";
        else consistencyGrade = "F";

        // Build verdict
        const warningFlags = flags.filter((f) => f.type === "warning");
        const flagCount = warningFlags.length;
        let verdict: "HEALTHY" | "MODERATE_CONCERNS" | "ISSUES_DETECTED";
        let oneLineSummary: string;

        if (flagCount === 0) {
          verdict = "HEALTHY";
          oneLineSummary =
            "Portfolio shows strong diversification, controlled tail risk, and consistent Monte Carlo outcomes.";
        } else if (flagCount <= 2) {
          verdict = "MODERATE_CONCERNS";
          const concernDimensions = [
            ...new Set(warningFlags.map((f) => f.dimension)),
          ];
          oneLineSummary = `Portfolio has ${flagCount} warning(s) in ${concernDimensions.join(", ")} - review flagged items.`;
        } else {
          verdict = "ISSUES_DETECTED";
          const concernDimensions = [
            ...new Set(warningFlags.map((f) => f.dimension)),
          ];
          oneLineSummary = `Portfolio has ${flagCount} warnings across ${concernDimensions.join(", ")} - significant review recommended.`;
        }

        // Build key numbers
        // Note: stats.maxDrawdown is already in percentage form (e.g., 5.66 = 5.66%)
        const keyNumbers = {
          strategies: strategies.length,
          trades: trades.length,
          sharpe: stats.sharpeRatio,
          sortino: stats.sortinoRatio,
          maxDrawdownPct: stats.maxDrawdown, // Already a percentage
          netPl: stats.netPl,
          avgCorrelation,
          avgTailDependence,
          mcProbabilityOfProfit: mcStats.probabilityOfProfit,
          mcMedianMdd: mcStats.medianMaxDrawdown,
          mcMddMultiplier,
          wfe: wfeResult,
        };

        // Build grades object
        const grades = {
          diversification: diversificationGrade,
          tailRisk: tailRiskGrade,
          robustness: robustnessGrade,
          consistency: consistencyGrade,
        };

        // Brief summary for user display
        const summary = `Health Check: ${blockId} | ${verdict} | ${flagCount} flags | Sharpe: ${formatRatio(stats.sharpeRatio)}`;

        // Build structured data
        const structuredData = {
          blockId,
          thresholds: {
            correlationThreshold: corrThreshold,
            tailDependenceThreshold: tailThreshold,
            profitProbabilityThreshold: profitThreshold,
            wfeThreshold: wfeThresh,
            mddMultiplierThreshold: mddMultThresh,
          },
          verdict: {
            status: verdict,
            oneLineSummary,
            flagCount,
          },
          grades,
          flags,
          keyNumbers,
        };

          return createToolOutput(summary, structuredData);
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error running portfolio health check: ${(error as Error).message}`,
              },
            ],
            isError: true as const,
          };
        }
      }
    )
  );
}
