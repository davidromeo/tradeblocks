/**
 * Analysis Tools
 *
 * Tier 2 advanced analysis MCP tools for walk-forward analysis, Monte Carlo simulation,
 * correlation analysis, tail risk, and position sizing.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock } from "../utils/block-loader.js";
import {
  createDualOutput,
  formatPercent,
  formatRatio,
  formatCurrency,
} from "../utils/output-formatter.js";
import { WalkForwardAnalyzer } from "@lib/calculations/walk-forward-analyzer";
import {
  assessResults,
  getRecommendedParameters,
  formatParameterName,
} from "@lib/calculations/walk-forward-verdict";
import {
  runMonteCarloSimulation,
  type MonteCarloParams,
} from "@lib/calculations/monte-carlo";
import {
  calculateCorrelationMatrix,
  calculateCorrelationAnalytics,
} from "@lib/calculations/correlation";
import { performTailRiskAnalysis } from "@lib/calculations/tail-risk-analysis";
import {
  calculateKellyMetrics,
  calculateStrategyKellyMetrics,
} from "@lib/calculations/kelly";
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
 * Register all analysis MCP tools
 */
export function registerAnalysisTools(
  server: McpServer,
  baseDir: string
): void {
  // Tool 1: run_walk_forward
  server.registerTool(
    "run_walk_forward",
    {
      description:
        "Execute walk-forward analysis to test parameter robustness across time windows",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        isWindowCount: z
          .number()
          .min(2)
          .default(5)
          .describe("Number of in-sample windows (default: 5)"),
        oosWindowCount: z
          .number()
          .min(1)
          .default(1)
          .describe("Number of out-of-sample windows (default: 1)"),
        optimizationTarget: z
          .enum([
            "netPl",
            "sharpeRatio",
            "sortinoRatio",
            "calmarRatio",
            "winRate",
          ])
          .default("sharpeRatio")
          .describe("Metric to optimize for (default: sharpeRatio)"),
      }),
    },
    async ({
      blockId,
      strategy,
      isWindowCount,
      oosWindowCount,
      optimizationTarget,
    }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply strategy filter
        trades = filterByStrategy(trades, strategy);

        if (trades.length < 20) {
          return {
            content: [
              {
                type: "text",
                text: `Insufficient trades for walk-forward analysis. Found ${trades.length} trades, need at least 20.`,
              },
            ],
            isError: true,
          };
        }

        // Calculate date range and window sizes
        const sortedTrades = [...trades].sort(
          (a, b) =>
            new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
        );
        const firstDate = new Date(sortedTrades[0].dateOpened);
        const lastDate = new Date(
          sortedTrades[sortedTrades.length - 1].dateOpened
        );
        const totalDays = Math.ceil(
          (lastDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000)
        );

        // Calculate window sizes dynamically
        const totalWindows = isWindowCount + oosWindowCount;
        const daysPerWindow = Math.floor(totalDays / totalWindows);
        const inSampleDays = daysPerWindow * isWindowCount;
        const outOfSampleDays = daysPerWindow * oosWindowCount;
        const stepSizeDays = daysPerWindow;

        // Run walk-forward analysis
        const analyzer = new WalkForwardAnalyzer();
        const computation = await analyzer.analyze({
          trades,
          config: {
            inSampleDays,
            outOfSampleDays,
            stepSizeDays,
            optimizationTarget,
            parameterRanges: {},
          },
        });

        const { results } = computation;
        const verdict = assessResults(results);
        const recommended = getRecommendedParameters(results.periods);

        // Build markdown output
        const lines: string[] = [
          `## Walk-Forward Analysis: ${blockId}`,
          "",
        ];

        if (strategy) {
          lines.push(`**Strategy Filter:** ${strategy}`, "");
        }

        lines.push(
          "### Summary",
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Optimization Target | ${optimizationTarget} |`,
          `| Total Periods | ${results.stats.totalPeriods} |`,
          `| Evaluated Periods | ${results.stats.evaluatedPeriods} |`,
          `| Skipped Periods | ${results.stats.skippedPeriods} |`,
          `| Analyzed Trades | ${results.stats.analyzedTrades} |`,
          "",
          "### Performance Metrics",
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Avg In-Sample Performance | ${formatRatio(results.summary.avgInSamplePerformance)} |`,
          `| Avg Out-of-Sample Performance | ${formatRatio(results.summary.avgOutOfSamplePerformance)} |`,
          `| Efficiency (WFE) | ${formatPercent(results.summary.degradationFactor * 100)} |`,
          `| Parameter Stability | ${formatPercent(results.summary.parameterStability * 100)} |`,
          `| Consistency Score | ${formatPercent(results.stats.consistencyScore * 100)} |`,
          `| Robustness Score | ${formatPercent(results.summary.robustnessScore * 100)} |`,
          "",
          "### Verdict",
          "",
          `**${verdict.title}**`,
          "",
          verdict.description,
          "",
          `| Component | Assessment |`,
          `|-----------|------------|`,
          `| Efficiency | ${verdict.efficiency} |`,
          `| Stability | ${verdict.stability} |`,
          `| Consistency | ${verdict.consistency} |`,
          `| **Overall** | **${verdict.overall}** |`,
          ""
        );

        // Add recommended parameters if available
        if (recommended.hasSuggestions) {
          lines.push("### Recommended Parameters", "");
          lines.push(
            `| Parameter | Value | Range | Stable |`,
            `|-----------|-------|-------|--------|`
          );
          for (const [key, suggestion] of Object.entries(recommended.params)) {
            lines.push(
              `| ${formatParameterName(key)} | ${suggestion.value} | ${suggestion.range[0]} - ${suggestion.range[1]} | ${suggestion.stable ? "Yes" : "No"} |`
            );
          }
          lines.push("");
        }

        const output = lines.join("\n");

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          strategy: strategy ?? null,
          config: {
            inSampleDays,
            outOfSampleDays,
            stepSizeDays,
            optimizationTarget,
            isWindowCount,
            oosWindowCount,
          },
          summary: {
            avgInSamplePerformance: results.summary.avgInSamplePerformance,
            avgOutOfSamplePerformance:
              results.summary.avgOutOfSamplePerformance,
            degradationFactor: results.summary.degradationFactor,
            parameterStability: results.summary.parameterStability,
            robustnessScore: results.summary.robustnessScore,
          },
          stats: {
            totalPeriods: results.stats.totalPeriods,
            evaluatedPeriods: results.stats.evaluatedPeriods,
            skippedPeriods: results.stats.skippedPeriods,
            analyzedTrades: results.stats.analyzedTrades,
            consistencyScore: results.stats.consistencyScore,
            durationMs: results.stats.durationMs,
          },
          verdict: {
            overall: verdict.overall,
            efficiency: verdict.efficiency,
            stability: verdict.stability,
            consistency: verdict.consistency,
            title: verdict.title,
          },
          recommendedParameters: recommended.params,
          periods: results.periods.map((p) => ({
            inSampleStart: p.inSampleStart.toISOString(),
            inSampleEnd: p.inSampleEnd.toISOString(),
            outOfSampleStart: p.outOfSampleStart.toISOString(),
            outOfSampleEnd: p.outOfSampleEnd.toISOString(),
            targetMetricInSample: p.targetMetricInSample,
            targetMetricOutOfSample: p.targetMetricOutOfSample,
          })),
        };

        return createDualOutput(output, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error running walk-forward analysis: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 2: run_monte_carlo
  server.registerTool(
    "run_monte_carlo",
    {
      description:
        "Run Monte Carlo simulation to project future performance and calculate risk metrics",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        numSimulations: z
          .number()
          .min(100)
          .max(10000)
          .default(1000)
          .describe("Number of simulation paths (default: 1000, max: 10000)"),
        includeWorstCase: z
          .boolean()
          .default(true)
          .describe("Include worst-case scenario testing (default: true)"),
      }),
    },
    async ({ blockId, strategy, numSimulations, includeWorstCase }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply strategy filter
        trades = filterByStrategy(trades, strategy);

        if (trades.length < 10) {
          return {
            content: [
              {
                type: "text",
                text: `Insufficient trades for Monte Carlo simulation. Found ${trades.length} trades, need at least 10.`,
              },
            ],
            isError: true,
          };
        }

        // Calculate initial capital and trades per year
        const sortedTrades = [...trades].sort(
          (a, b) =>
            new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
        );
        const firstTrade = sortedTrades[0];
        const lastTrade = sortedTrades[sortedTrades.length - 1];

        const initialCapital = firstTrade.fundsAtClose - firstTrade.pl;
        const daySpan =
          (new Date(lastTrade.dateOpened).getTime() -
            new Date(firstTrade.dateOpened).getTime()) /
          (24 * 60 * 60 * 1000);
        const tradesPerYear =
          daySpan > 0 ? (trades.length / daySpan) * 365 : 252;

        // Configure Monte Carlo parameters
        const params: MonteCarloParams = {
          numSimulations,
          simulationLength: trades.length,
          resampleMethod: "trades",
          initialCapital: initialCapital > 0 ? initialCapital : 100000,
          tradesPerYear,
          worstCaseEnabled: includeWorstCase,
          worstCasePercentage: includeWorstCase ? 5 : 0,
          worstCaseMode: "pool",
        };

        // Run simulation
        const result = runMonteCarloSimulation(trades, params);
        const stats = result.statistics;

        // Build markdown output
        const lines: string[] = [
          `## Monte Carlo Simulation: ${blockId}`,
          "",
        ];

        if (strategy) {
          lines.push(`**Strategy Filter:** ${strategy}`, "");
        }

        lines.push(
          "### Configuration",
          "",
          `| Parameter | Value |`,
          `|-----------|-------|`,
          `| Simulations | ${numSimulations.toLocaleString()} |`,
          `| Simulation Length | ${params.simulationLength} trades |`,
          `| Initial Capital | ${formatCurrency(params.initialCapital)} |`,
          `| Worst-Case Testing | ${includeWorstCase ? "Enabled" : "Disabled"} |`,
          "",
          "### Return Statistics",
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Mean Total Return | ${formatPercent(stats.meanTotalReturn * 100)} |`,
          `| Median Total Return | ${formatPercent(stats.medianTotalReturn * 100)} |`,
          `| Mean Annualized Return | ${formatPercent(stats.meanAnnualizedReturn * 100)} |`,
          `| Probability of Profit | ${formatPercent(stats.probabilityOfProfit * 100)} |`,
          "",
          "### Risk Metrics",
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Mean Max Drawdown | ${formatPercent(stats.meanMaxDrawdown * 100)} |`,
          `| Median Max Drawdown | ${formatPercent(stats.medianMaxDrawdown * 100)} |`,
          `| Mean Sharpe Ratio | ${formatRatio(stats.meanSharpeRatio)} |`,
          "",
          "### Value at Risk (VaR)",
          "",
          `| Percentile | Return |`,
          `|------------|--------|`,
          `| 5th (95% VaR) | ${formatPercent(stats.valueAtRisk.p5 * 100)} |`,
          `| 10th (90% VaR) | ${formatPercent(stats.valueAtRisk.p10 * 100)} |`,
          `| 25th | ${formatPercent(stats.valueAtRisk.p25 * 100)} |`,
          "",
          "### Percentile Bands (Final Values)",
          "",
          `| Percentile | Value |`,
          `|------------|-------|`,
          `| 5th | ${formatCurrency(params.initialCapital * (1 + result.percentiles.p5[result.percentiles.p5.length - 1]))} |`,
          `| 25th | ${formatCurrency(params.initialCapital * (1 + result.percentiles.p25[result.percentiles.p25.length - 1]))} |`,
          `| 50th (Median) | ${formatCurrency(params.initialCapital * (1 + result.percentiles.p50[result.percentiles.p50.length - 1]))} |`,
          `| 75th | ${formatCurrency(params.initialCapital * (1 + result.percentiles.p75[result.percentiles.p75.length - 1]))} |`,
          `| 95th | ${formatCurrency(params.initialCapital * (1 + result.percentiles.p95[result.percentiles.p95.length - 1]))} |`,
          ""
        );

        const output = lines.join("\n");

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          strategy: strategy ?? null,
          parameters: {
            numSimulations,
            simulationLength: params.simulationLength,
            initialCapital: params.initialCapital,
            tradesPerYear,
            worstCaseEnabled: includeWorstCase,
          },
          statistics: {
            meanFinalValue: stats.meanFinalValue,
            medianFinalValue: stats.medianFinalValue,
            stdFinalValue: stats.stdFinalValue,
            meanTotalReturn: stats.meanTotalReturn,
            medianTotalReturn: stats.medianTotalReturn,
            meanAnnualizedReturn: stats.meanAnnualizedReturn,
            medianAnnualizedReturn: stats.medianAnnualizedReturn,
            meanMaxDrawdown: stats.meanMaxDrawdown,
            medianMaxDrawdown: stats.medianMaxDrawdown,
            meanSharpeRatio: stats.meanSharpeRatio,
            probabilityOfProfit: stats.probabilityOfProfit,
          },
          valueAtRisk: {
            p5: stats.valueAtRisk.p5,
            p10: stats.valueAtRisk.p10,
            p25: stats.valueAtRisk.p25,
          },
          percentileBands: {
            p5: result.percentiles.p5[result.percentiles.p5.length - 1],
            p25: result.percentiles.p25[result.percentiles.p25.length - 1],
            p50: result.percentiles.p50[result.percentiles.p50.length - 1],
            p75: result.percentiles.p75[result.percentiles.p75.length - 1],
            p95: result.percentiles.p95[result.percentiles.p95.length - 1],
          },
          actualResamplePoolSize: result.actualResamplePoolSize,
        };

        return createDualOutput(output, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error running Monte Carlo simulation: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 3: get_correlation_matrix
  server.registerTool(
    "get_correlation_matrix",
    {
      description:
        "Calculate correlation matrix between strategies to identify diversification",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        method: z
          .enum(["kendall", "spearman", "pearson"])
          .default("kendall")
          .describe("Correlation method (default: kendall)"),
      }),
    },
    async ({ blockId, method }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        const trades = block.trades;

        // Get unique strategies
        const strategies = Array.from(
          new Set(trades.map((t) => t.strategy))
        ).filter(Boolean);

        if (strategies.length < 2) {
          return {
            content: [
              {
                type: "text",
                text: `Correlation analysis requires at least 2 strategies. Found ${strategies.length} strategy.`,
              },
            ],
            isError: true,
          };
        }

        // Calculate correlation matrix
        const matrix = calculateCorrelationMatrix(trades, { method });
        const analytics = calculateCorrelationAnalytics(matrix);

        // Build markdown output
        const lines: string[] = [
          `## Correlation Matrix: ${blockId}`,
          "",
          `**Method:** ${method.charAt(0).toUpperCase() + method.slice(1)}`,
          "",
          "### Matrix",
          "",
        ];

        // Build table header
        const header = ["| Strategy |", ...matrix.strategies.map((s) => ` ${s} |`)].join("");
        lines.push(header);
        lines.push("|" + "-".repeat(10) + "|" + matrix.strategies.map(() => "-".repeat(8) + "|").join(""));

        // Build table rows
        for (let i = 0; i < matrix.strategies.length; i++) {
          const row = [`| ${matrix.strategies[i]} |`];
          for (let j = 0; j < matrix.strategies.length; j++) {
            const val = matrix.correlationData[i][j];
            row.push(` ${Number.isNaN(val) ? "N/A" : val.toFixed(2)} |`);
          }
          lines.push(row.join(""));
        }

        lines.push("");
        lines.push("### Analytics", "");
        lines.push(`| Metric | Value |`);
        lines.push(`|--------|-------|`);
        lines.push(`| Average Correlation | ${Number.isNaN(analytics.averageCorrelation) ? "N/A" : formatRatio(analytics.averageCorrelation)} |`);
        lines.push(`| Strongest Correlation | ${Number.isNaN(analytics.strongest.value) ? "N/A" : formatRatio(analytics.strongest.value)} (${analytics.strongest.pair.join(" / ")}) |`);
        lines.push(`| Weakest Correlation | ${Number.isNaN(analytics.weakest.value) ? "N/A" : formatRatio(analytics.weakest.value)} (${analytics.weakest.pair.join(" / ")}) |`);
        lines.push(`| Strategy Count | ${analytics.strategyCount} |`);

        if (analytics.insufficientDataPairs > 0) {
          lines.push(`| Insufficient Data Pairs | ${analytics.insufficientDataPairs} |`);
        }

        lines.push("");

        // Add warnings for highly correlated pairs
        const highlyCorrelated: Array<{ pair: [string, string]; value: number }> = [];
        for (let i = 0; i < matrix.strategies.length; i++) {
          for (let j = i + 1; j < matrix.strategies.length; j++) {
            const val = matrix.correlationData[i][j];
            if (!Number.isNaN(val) && Math.abs(val) > 0.7) {
              highlyCorrelated.push({
                pair: [matrix.strategies[i], matrix.strategies[j]],
                value: val,
              });
            }
          }
        }

        if (highlyCorrelated.length > 0) {
          lines.push("### Warnings", "");
          lines.push("**Highly correlated pairs (|r| > 0.7):**", "");
          for (const { pair, value } of highlyCorrelated) {
            lines.push(`- ${pair[0]} / ${pair[1]}: ${formatRatio(value)}`);
          }
          lines.push("");
        }

        const output = lines.join("\n");

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          method,
          strategies: matrix.strategies,
          correlationMatrix: matrix.correlationData,
          sampleSizes: matrix.sampleSizes,
          analytics: {
            averageCorrelation: analytics.averageCorrelation,
            strongest: {
              value: analytics.strongest.value,
              pair: analytics.strongest.pair,
              sampleSize: analytics.strongest.sampleSize,
            },
            weakest: {
              value: analytics.weakest.value,
              pair: analytics.weakest.pair,
              sampleSize: analytics.weakest.sampleSize,
            },
            strategyCount: analytics.strategyCount,
            insufficientDataPairs: analytics.insufficientDataPairs,
          },
          highlyCorrelatedPairs: highlyCorrelated,
        };

        return createDualOutput(output, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error calculating correlation matrix: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 4: get_tail_risk
  server.registerTool(
    "get_tail_risk",
    {
      description:
        "Calculate Gaussian copula tail dependence to identify extreme co-movement risk",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
      }),
    },
    async ({ blockId }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        const trades = block.trades;

        // Get unique strategies
        const strategies = Array.from(
          new Set(trades.map((t) => t.strategy))
        ).filter(Boolean);

        if (strategies.length < 2) {
          return {
            content: [
              {
                type: "text",
                text: `Tail risk analysis requires at least 2 strategies. Found ${strategies.length} strategy.`,
              },
            ],
            isError: true,
          };
        }

        // Perform tail risk analysis
        const result = performTailRiskAnalysis(trades);

        // Build markdown output
        const lines: string[] = [
          `## Tail Risk Analysis: ${blockId}`,
          "",
          "### Configuration",
          "",
          `| Parameter | Value |`,
          `|-----------|-------|`,
          `| Strategies | ${result.strategies.length} |`,
          `| Trading Days | ${result.tradingDaysUsed} |`,
          `| Tail Threshold | ${formatPercent(result.tailThreshold * 100)} |`,
          `| Variance Threshold | ${formatPercent(result.varianceThreshold * 100)} |`,
          "",
          "### Analytics",
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Highest Joint Tail Risk | ${formatRatio(result.analytics.highestJointTailRisk.value)} (${result.analytics.highestJointTailRisk.pair.join(" / ")}) |`,
          `| Lowest Joint Tail Risk | ${formatRatio(result.analytics.lowestJointTailRisk.value)} (${result.analytics.lowestJointTailRisk.pair.join(" / ")}) |`,
          `| Average Joint Tail Risk | ${formatRatio(result.analytics.averageJointTailRisk)} |`,
          `| High Risk Pairs | ${formatPercent(result.analytics.highRiskPairsPct * 100)} |`,
          `| Effective Factors | ${result.effectiveFactors} of ${result.strategies.length} |`,
          "",
          "### Marginal Contributions",
          "",
          `| Strategy | Risk Contribution | Concentration | Avg Tail Dependence |`,
          `|----------|-------------------|---------------|---------------------|`,
        ];

        for (const mc of result.marginalContributions) {
          lines.push(
            `| ${mc.strategy} | ${formatPercent(mc.tailRiskContribution)} | ${formatRatio(mc.concentrationScore)} | ${formatRatio(mc.avgTailDependence)} |`
          );
        }

        lines.push("");

        // Add interpretation
        lines.push("### Interpretation", "");
        if (result.analytics.averageJointTailRisk > 0.5) {
          lines.push("**High tail dependence detected.** Strategies tend to have extreme losses together.");
          lines.push("Consider reducing position sizes or diversifying into less correlated strategies.");
        } else if (result.analytics.averageJointTailRisk > 0.3) {
          lines.push("**Moderate tail dependence.** Some co-movement during extreme events.");
          lines.push("Monitor during high volatility periods.");
        } else {
          lines.push("**Low tail dependence.** Good diversification during extreme events.");
          lines.push("Strategies appear to provide independent risk profiles.");
        }

        lines.push("");

        if (result.insufficientDataPairs > 0) {
          lines.push(
            `*Note: ${result.insufficientDataPairs} strategy pairs had insufficient data for tail risk calculation.*`,
            ""
          );
        }

        const output = lines.join("\n");

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          strategies: result.strategies,
          tradingDaysUsed: result.tradingDaysUsed,
          dateRange: {
            start: result.dateRange.start.toISOString(),
            end: result.dateRange.end.toISOString(),
          },
          tailThreshold: result.tailThreshold,
          varianceThreshold: result.varianceThreshold,
          analytics: {
            highestJointTailRisk: result.analytics.highestJointTailRisk,
            lowestJointTailRisk: result.analytics.lowestJointTailRisk,
            averageJointTailRisk: result.analytics.averageJointTailRisk,
            highRiskPairsPct: result.analytics.highRiskPairsPct,
          },
          effectiveFactors: result.effectiveFactors,
          eigenvalues: result.eigenvalues,
          explainedVariance: result.explainedVariance,
          marginalContributions: result.marginalContributions,
          insufficientDataPairs: result.insufficientDataPairs,
          jointTailRiskMatrix: result.jointTailRiskMatrix,
          copulaCorrelationMatrix: result.copulaCorrelationMatrix,
        };

        return createDualOutput(output, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error calculating tail risk: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 5: get_position_sizing
  server.registerTool(
    "get_position_sizing",
    {
      description:
        "Calculate Kelly criterion position sizing for optimal capital allocation",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        capitalBase: z
          .number()
          .positive()
          .describe("Starting capital in dollars"),
      }),
    },
    async ({ blockId, capitalBase }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        const trades = block.trades;

        if (trades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No trades found in this block.",
              },
            ],
            isError: true,
          };
        }

        // Calculate Kelly metrics for entire portfolio
        const portfolioKelly = calculateKellyMetrics(trades, capitalBase);

        // Calculate per-strategy Kelly metrics
        const strategyKelly = calculateStrategyKellyMetrics(trades, capitalBase);

        // Build markdown output
        const lines: string[] = [
          `## Position Sizing: ${blockId}`,
          "",
          `**Capital Base:** ${formatCurrency(capitalBase)}`,
          "",
          "### Portfolio-Level Kelly",
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Win Rate | ${formatPercent(portfolioKelly.winRate * 100)} |`,
          `| Avg Win | ${formatCurrency(portfolioKelly.avgWin)} |`,
          `| Avg Loss | ${formatCurrency(portfolioKelly.avgLoss)} |`,
          `| Payoff Ratio | ${formatRatio(portfolioKelly.payoffRatio)} |`,
          `| Kelly Fraction | ${portfolioKelly.hasValidKelly ? formatPercent(portfolioKelly.percent) : "N/A"} |`,
          `| Recommended Allocation | ${portfolioKelly.hasValidKelly ? formatCurrency(capitalBase * Math.max(0, portfolioKelly.fraction)) : "N/A"} |`,
          "",
        ];

        if (!portfolioKelly.hasValidKelly) {
          lines.push("*Kelly fraction cannot be calculated (insufficient wins/losses or zero avg loss).*", "");
        }

        // Per-strategy Kelly
        lines.push("### Per-Strategy Kelly", "");
        lines.push(
          `| Strategy | Win Rate | Payoff | Kelly % | Allocation |`,
          `|----------|----------|--------|---------|------------|`
        );

        const strategyResults: Array<{
          name: string;
          kelly: ReturnType<typeof calculateKellyMetrics>;
          allocation: number;
        }> = [];

        for (const [strategyName, kelly] of strategyKelly.entries()) {
          const allocation = kelly.hasValidKelly
            ? capitalBase * Math.max(0, kelly.fraction)
            : 0;
          strategyResults.push({
            name: strategyName,
            kelly,
            allocation,
          });
          lines.push(
            `| ${strategyName} | ${formatPercent(kelly.winRate * 100)} | ${formatRatio(kelly.payoffRatio)} | ${kelly.hasValidKelly ? formatPercent(kelly.percent) : "N/A"} | ${kelly.hasValidKelly ? formatCurrency(allocation) : "N/A"} |`
          );
        }

        lines.push("");

        // Add warnings
        const warnings: string[] = [];
        if (portfolioKelly.hasValidKelly && portfolioKelly.fraction > 0.25) {
          warnings.push("Portfolio Kelly exceeds 25% - consider using half-Kelly or quarter-Kelly for safety.");
        }

        for (const { name, kelly } of strategyResults) {
          if (kelly.hasValidKelly && kelly.fraction > 0.5) {
            warnings.push(`${name} has Kelly > 50% - likely unrealistic, verify data quality.`);
          }
          if (kelly.hasValidKelly && kelly.fraction < 0) {
            warnings.push(`${name} has negative Kelly - strategy has negative edge, consider removing.`);
          }
        }

        if (warnings.length > 0) {
          lines.push("### Warnings", "");
          for (const warning of warnings) {
            lines.push(`- ${warning}`);
          }
          lines.push("");
        }

        // Add recommendations
        lines.push("### Recommendations", "");
        if (portfolioKelly.hasValidKelly && portfolioKelly.fraction > 0) {
          const halfKelly = portfolioKelly.fraction / 2;
          const quarterKelly = portfolioKelly.fraction / 4;
          lines.push(`- **Full Kelly:** ${formatPercent(portfolioKelly.percent)} (${formatCurrency(capitalBase * portfolioKelly.fraction)})`);
          lines.push(`- **Half Kelly:** ${formatPercent(halfKelly * 100)} (${formatCurrency(capitalBase * halfKelly)}) - recommended for most traders`);
          lines.push(`- **Quarter Kelly:** ${formatPercent(quarterKelly * 100)} (${formatCurrency(capitalBase * quarterKelly)}) - conservative approach`);
        } else {
          lines.push("- Strategy does not have a positive edge based on historical data.");
          lines.push("- Consider paper trading or further optimization before allocating capital.");
        }

        lines.push("");

        const output = lines.join("\n");

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          capitalBase,
          portfolio: {
            winRate: portfolioKelly.winRate,
            avgWin: portfolioKelly.avgWin,
            avgLoss: portfolioKelly.avgLoss,
            payoffRatio: portfolioKelly.payoffRatio,
            kellyFraction: portfolioKelly.fraction,
            kellyPercent: portfolioKelly.percent,
            hasValidKelly: portfolioKelly.hasValidKelly,
            recommendedAllocation: portfolioKelly.hasValidKelly
              ? capitalBase * Math.max(0, portfolioKelly.fraction)
              : null,
            halfKelly: portfolioKelly.hasValidKelly
              ? portfolioKelly.fraction / 2
              : null,
            quarterKelly: portfolioKelly.hasValidKelly
              ? portfolioKelly.fraction / 4
              : null,
          },
          strategies: strategyResults.map(({ name, kelly, allocation }) => ({
            name,
            winRate: kelly.winRate,
            avgWin: kelly.avgWin,
            avgLoss: kelly.avgLoss,
            payoffRatio: kelly.payoffRatio,
            kellyFraction: kelly.fraction,
            kellyPercent: kelly.percent,
            hasValidKelly: kelly.hasValidKelly,
            allocation,
          })),
          warnings,
        };

        return createDualOutput(output, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error calculating position sizing: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
