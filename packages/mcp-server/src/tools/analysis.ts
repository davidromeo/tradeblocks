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
        // Window count mode (convenience parameters)
        isWindowCount: z
          .number()
          .min(2)
          .default(5)
          .describe(
            "Number of in-sample windows (default: 5). Used to calculate inSampleDays if not explicitly provided."
          ),
        oosWindowCount: z
          .number()
          .min(1)
          .default(1)
          .describe(
            "Number of out-of-sample windows (default: 1). Used to calculate outOfSampleDays if not explicitly provided."
          ),
        // Explicit days mode (overrides window count calculations)
        inSampleDays: z
          .number()
          .min(7)
          .optional()
          .describe(
            "Explicit in-sample period in days. Overrides isWindowCount calculation if provided."
          ),
        outOfSampleDays: z
          .number()
          .min(1)
          .optional()
          .describe(
            "Explicit out-of-sample period in days. Overrides oosWindowCount calculation if provided."
          ),
        stepSizeDays: z
          .number()
          .min(1)
          .optional()
          .describe(
            "Days to slide forward each period. If not provided, equals outOfSampleDays."
          ),
        // Optimization settings
        optimizationTarget: z
          .enum([
            "netPl",
            "profitFactor",
            "sharpeRatio",
            "sortinoRatio",
            "calmarRatio",
            "cagr",
            "avgDailyPl",
            "winRate",
          ])
          .default("sharpeRatio")
          .describe("Metric to optimize for (default: sharpeRatio)"),
        // Trade constraints
        minInSampleTrades: z
          .number()
          .min(5)
          .default(10)
          .describe("Minimum trades required in in-sample period (default: 10)"),
        minOutOfSampleTrades: z
          .number()
          .min(1)
          .default(3)
          .describe("Minimum trades required in out-of-sample period (default: 3)"),
        // Data handling
        normalizeTo1Lot: z
          .boolean()
          .default(false)
          .describe("Normalize trades to 1-lot by dividing P&L by contract count"),
        selectedStrategies: z
          .array(z.string())
          .optional()
          .describe("Filter to specific strategies only (default: all strategies)"),
      }),
    },
    async ({
      blockId,
      strategy,
      isWindowCount,
      oosWindowCount,
      inSampleDays: explicitInSampleDays,
      outOfSampleDays: explicitOutOfSampleDays,
      stepSizeDays: explicitStepSizeDays,
      optimizationTarget,
      minInSampleTrades,
      minOutOfSampleTrades,
      normalizeTo1Lot,
      selectedStrategies,
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

        // Apply selectedStrategies filter if provided (in addition to single strategy filter)
        if (selectedStrategies && selectedStrategies.length > 0) {
          const strategySet = new Set(
            selectedStrategies.map((s) => s.toLowerCase())
          );
          trades = trades.filter((t) =>
            strategySet.has(t.strategy.toLowerCase())
          );
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

        // Determine window sizes: explicit days override window count calculations
        let inSampleDays: number;
        let outOfSampleDays: number;
        let stepSizeDays: number;

        if (explicitInSampleDays !== undefined && explicitOutOfSampleDays !== undefined) {
          // Use explicit day values
          inSampleDays = explicitInSampleDays;
          outOfSampleDays = explicitOutOfSampleDays;
          stepSizeDays = explicitStepSizeDays ?? outOfSampleDays;
        } else {
          // Calculate from window counts (original behavior)
          const totalWindows = isWindowCount + oosWindowCount;
          const daysPerWindow = Math.floor(totalDays / totalWindows);
          inSampleDays = daysPerWindow * isWindowCount;
          outOfSampleDays = daysPerWindow * oosWindowCount;
          stepSizeDays = explicitStepSizeDays ?? daysPerWindow;
        }

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
            minInSampleTrades,
            minOutOfSampleTrades,
            normalizeTo1Lot,
            selectedStrategies,
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
          "### Configuration",
          "",
          `| Parameter | Value |`,
          `|-----------|-------|`,
          `| In-Sample Days | ${inSampleDays} |`,
          `| Out-of-Sample Days | ${outOfSampleDays} |`,
          `| Step Size Days | ${stepSizeDays} |`,
          `| Optimization Target | ${optimizationTarget} |`,
          `| Min IS Trades | ${minInSampleTrades} |`,
          `| Min OOS Trades | ${minOutOfSampleTrades} |`,
          `| Normalize to 1-Lot | ${normalizeTo1Lot ? "Yes" : "No"} |`,
          "",
          "### Summary",
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
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
            minInSampleTrades,
            minOutOfSampleTrades,
            normalizeTo1Lot,
            selectedStrategies: selectedStrategies ?? null,
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
        simulationLength: z
          .number()
          .min(10)
          .optional()
          .describe(
            "Number of trades/days to project forward. If not specified, uses the number of historical trades."
          ),
        resampleWindow: z
          .number()
          .min(5)
          .optional()
          .describe(
            "Size of resample pool (how many recent trades/days to sample from). If not specified, uses all available data."
          ),
        resampleMethod: z
          .enum(["trades", "daily", "percentage"])
          .default("trades")
          .describe(
            "What to resample: 'trades' (individual trade P&L), 'daily' (daily aggregated returns), 'percentage' (percentage returns for compounding strategies)"
          ),
        initialCapital: z
          .number()
          .positive()
          .optional()
          .describe(
            "Starting capital for simulations. If not specified, inferred from first trade."
          ),
        tradesPerYear: z
          .number()
          .min(1)
          .optional()
          .describe(
            "Expected trades per year for annualization. If not specified, calculated from historical data."
          ),
        randomSeed: z
          .number()
          .optional()
          .describe("Random seed for reproducibility. Enables deterministic results across runs."),
        normalizeTo1Lot: z
          .boolean()
          .default(false)
          .describe(
            "Normalize trades to 1-lot by dividing P&L by contract count. Useful for comparing different position sizes."
          ),
        includeWorstCase: z
          .boolean()
          .default(true)
          .describe("Enable worst-case scenario injection (default: true)"),
        worstCasePercentage: z
          .number()
          .min(0)
          .max(100)
          .default(5)
          .describe(
            "Percentage of simulation length that should be max-loss scenarios (0-100, default: 5)"
          ),
        worstCaseMode: z
          .enum(["pool", "guarantee"])
          .default("pool")
          .describe(
            "How to inject worst-case: 'pool' adds synthetic losses to resample pool, 'guarantee' ensures worst-case appears in every simulation"
          ),
        worstCaseSizing: z
          .enum(["absolute", "relative"])
          .default("relative")
          .describe(
            "Worst-case sizing: 'absolute' uses historical dollar amounts, 'relative' scales to account capital ratio"
          ),
        worstCaseBasedOn: z
          .enum(["simulation", "historical"])
          .default("simulation")
          .describe(
            "What to base worst-case percentage on: 'simulation' (simulation length) or 'historical' (historical data size)"
          ),
        historicalInitialCapital: z
          .number()
          .positive()
          .optional()
          .describe(
            "Historical initial capital for percentage return calculation. Only needed when filtering strategies from multi-strategy portfolios where fundsAtClose reflects combined portfolio."
          ),
      }),
    },
    async ({
      blockId,
      strategy,
      numSimulations,
      simulationLength: simulationLengthParam,
      resampleWindow,
      resampleMethod,
      initialCapital: initialCapitalParam,
      tradesPerYear: tradesPerYearParam,
      randomSeed,
      normalizeTo1Lot,
      includeWorstCase,
      worstCasePercentage,
      worstCaseMode,
      worstCaseSizing,
      worstCaseBasedOn,
      historicalInitialCapital,
    }) => {
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

        // Calculate initial capital and trades per year if not provided
        const sortedTrades = [...trades].sort(
          (a, b) =>
            new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
        );
        const firstTrade = sortedTrades[0];
        const lastTrade = sortedTrades[sortedTrades.length - 1];

        // Use provided initial capital or infer from first trade
        const inferredCapital = firstTrade.fundsAtClose - firstTrade.pl;
        const initialCapital =
          initialCapitalParam ?? (inferredCapital > 0 ? inferredCapital : 100000);

        // Use provided trades per year or calculate from data
        const daySpan =
          (new Date(lastTrade.dateOpened).getTime() -
            new Date(firstTrade.dateOpened).getTime()) /
          (24 * 60 * 60 * 1000);
        const calculatedTradesPerYear =
          daySpan > 0 ? (trades.length / daySpan) * 365 : 252;
        const tradesPerYear = tradesPerYearParam ?? calculatedTradesPerYear;

        // Use provided simulation length or default to trade count
        const simulationLength = simulationLengthParam ?? trades.length;

        // Configure Monte Carlo parameters
        const params: MonteCarloParams = {
          numSimulations,
          simulationLength,
          resampleWindow,
          resampleMethod,
          initialCapital,
          historicalInitialCapital,
          tradesPerYear,
          strategy,
          randomSeed,
          normalizeTo1Lot,
          worstCaseEnabled: includeWorstCase,
          worstCasePercentage: includeWorstCase ? worstCasePercentage : 0,
          worstCaseMode,
          worstCaseBasedOn,
          worstCaseSizing,
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
          `| Resample Method | ${params.resampleMethod} |`,
          `| Resample Window | ${params.resampleWindow ? `${params.resampleWindow} items` : "All data"} |`,
          `| Initial Capital | ${formatCurrency(params.initialCapital)} |`,
          `| Trades Per Year | ${Math.round(params.tradesPerYear)} |`,
          `| Normalize to 1-Lot | ${params.normalizeTo1Lot ? "Yes" : "No"} |`,
          `| Worst-Case Testing | ${includeWorstCase ? "Enabled" : "Disabled"} |`,
          ...(includeWorstCase
            ? [
                `| Worst-Case Percentage | ${worstCasePercentage}% |`,
                `| Worst-Case Mode | ${worstCaseMode} |`,
                `| Worst-Case Based On | ${worstCaseBasedOn} |`,
                `| Worst-Case Sizing | ${worstCaseSizing} |`,
              ]
            : []),
          ...(historicalInitialCapital
            ? [`| Historical Initial Capital | ${formatCurrency(historicalInitialCapital)} |`]
            : []),
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
            resampleWindow: params.resampleWindow ?? null,
            resampleMethod: params.resampleMethod,
            initialCapital: params.initialCapital,
            historicalInitialCapital: params.historicalInitialCapital ?? null,
            tradesPerYear: params.tradesPerYear,
            randomSeed: params.randomSeed ?? null,
            normalizeTo1Lot: params.normalizeTo1Lot ?? false,
            worstCaseEnabled: includeWorstCase,
            worstCasePercentage: params.worstCasePercentage ?? 0,
            worstCaseMode: params.worstCaseMode ?? "pool",
            worstCaseBasedOn: params.worstCaseBasedOn ?? "simulation",
            worstCaseSizing: params.worstCaseSizing ?? "relative",
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
          .describe(
            "Correlation method: 'kendall' (robust, rank-based), 'spearman' (rank), 'pearson' (linear)"
          ),
        alignment: z
          .enum(["shared", "zero-pad"])
          .default("shared")
          .describe(
            "How to handle missing dates: 'shared' uses only days both strategies traded, 'zero-pad' fills missing days with 0"
          ),
        normalization: z
          .enum(["raw", "margin", "notional"])
          .default("raw")
          .describe(
            "How to normalize returns: 'raw' absolute P&L, 'margin' P&L/margin, 'notional' P&L/notional"
          ),
        dateBasis: z
          .enum(["opened", "closed"])
          .default("opened")
          .describe("Which trade date to use for grouping: 'opened' or 'closed'"),
        timePeriod: z
          .enum(["daily", "weekly", "monthly"])
          .default("daily")
          .describe("Time period for return aggregation before correlation calculation"),
      }),
    },
    async ({ blockId, method, alignment, normalization, dateBasis, timePeriod }) => {
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

        // Calculate correlation matrix with all options
        const matrix = calculateCorrelationMatrix(trades, {
          method,
          alignment,
          normalization,
          dateBasis,
          timePeriod,
        });
        const analytics = calculateCorrelationAnalytics(matrix);

        // Build markdown output
        const lines: string[] = [
          `## Correlation Matrix: ${blockId}`,
          "",
          "### Configuration",
          "",
          `| Parameter | Value |`,
          `|-----------|-------|`,
          `| Method | ${method.charAt(0).toUpperCase() + method.slice(1)} |`,
          `| Alignment | ${alignment} |`,
          `| Normalization | ${normalization} |`,
          `| Date Basis | ${dateBasis} |`,
          `| Time Period | ${timePeriod} |`,
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
          options: {
            method,
            alignment,
            normalization,
            dateBasis,
            timePeriod,
          },
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
        tailThreshold: z
          .number()
          .min(0.01)
          .max(0.5)
          .default(0.1)
          .describe(
            "Percentile threshold for tail events (0.1 = worst 10% of days). Lower = more extreme events only."
          ),
        minTradingDays: z
          .number()
          .min(10)
          .default(30)
          .describe("Minimum shared trading days required for valid analysis"),
        normalization: z
          .enum(["raw", "margin", "notional"])
          .default("raw")
          .describe(
            "How to normalize returns: 'raw' absolute P&L, 'margin' P&L/margin, 'notional' P&L/notional"
          ),
        dateBasis: z
          .enum(["opened", "closed"])
          .default("opened")
          .describe("Which trade date to use for grouping"),
        strategyFilter: z
          .array(z.string())
          .optional()
          .describe("Filter to specific strategies only (default: all strategies)"),
        tickerFilter: z
          .string()
          .optional()
          .describe("Filter trades by underlying ticker symbol (e.g., 'SPY', 'AAPL')"),
        dateRangeFrom: z
          .string()
          .optional()
          .describe("Start date for analysis (ISO format: YYYY-MM-DD). Only include trades on or after this date."),
        dateRangeTo: z
          .string()
          .optional()
          .describe("End date for analysis (ISO format: YYYY-MM-DD). Only include trades on or before this date."),
        varianceThreshold: z
          .number()
          .min(0.5)
          .max(0.99)
          .default(0.8)
          .describe(
            "Variance threshold for determining effective factors (0.8 = 80% variance explained)"
          ),
      }),
    },
    async ({
      blockId,
      tailThreshold,
      minTradingDays,
      normalization,
      dateBasis,
      strategyFilter,
      tickerFilter,
      dateRangeFrom,
      dateRangeTo,
      varianceThreshold,
    }) => {
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

        // Build date range if provided
        const dateRange = dateRangeFrom || dateRangeTo
          ? {
              from: dateRangeFrom ? new Date(dateRangeFrom) : undefined,
              to: dateRangeTo ? new Date(dateRangeTo) : undefined,
            }
          : undefined;

        // Perform tail risk analysis with all options
        const result = performTailRiskAnalysis(trades, {
          tailThreshold,
          minTradingDays,
          normalization,
          dateBasis,
          strategyFilter,
          tickerFilter,
          dateRange,
          varianceThreshold,
        });

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
          `| Tail Threshold | ${formatPercent(result.tailThreshold * 100)} (worst ${formatPercent(result.tailThreshold * 100)}) |`,
          `| Min Trading Days | ${minTradingDays} |`,
          `| Normalization | ${normalization} |`,
          `| Date Basis | ${dateBasis} |`,
          `| Strategy Filter | ${strategyFilter?.length ? strategyFilter.join(", ") : "All strategies"} |`,
          `| Ticker Filter | ${tickerFilter ?? "All tickers"} |`,
          `| Date Range | ${dateRangeFrom || dateRangeTo ? `${dateRangeFrom ?? "start"} to ${dateRangeTo ?? "end"}` : "All dates"} |`,
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
          options: {
            tailThreshold,
            minTradingDays,
            normalization,
            dateBasis,
            strategyFilter: strategyFilter ?? null,
            tickerFilter: tickerFilter ?? null,
            dateRangeFrom: dateRangeFrom ?? null,
            dateRangeTo: dateRangeTo ?? null,
            varianceThreshold,
          },
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
        strategy: z
          .string()
          .optional()
          .describe("Filter to a specific strategy name (case-insensitive). If provided, only calculates Kelly for that strategy."),
        kellyFraction: z
          .enum(["full", "half", "quarter"])
          .default("half")
          .describe(
            "Kelly fraction to use: 'full' (100%), 'half' (50%, recommended), 'quarter' (25%, conservative)"
          ),
        maxAllocationPct: z
          .number()
          .min(1)
          .max(100)
          .default(25)
          .describe("Maximum allocation per strategy as percentage (default: 25%)"),
        includeNegativeKelly: z
          .boolean()
          .default(true)
          .describe(
            "Include strategies with negative Kelly in output (useful for identifying loss-reduction opportunities)"
          ),
        useMarginReturns: z
          .boolean()
          .default(false)
          .describe(
            "Prefer percentage returns based on margin requirement instead of absolute P&L. More appropriate for compounding strategies with variable position sizes."
          ),
        minTrades: z
          .number()
          .min(1)
          .default(10)
          .describe("Minimum trades required per strategy for valid Kelly calculation (default: 10)"),
        sortBy: z
          .enum(["name", "kelly", "winRate", "payoffRatio", "allocation"])
          .default("kelly")
          .describe("Sort strategies by: 'name', 'kelly' percentage, 'winRate', 'payoffRatio', or 'allocation' amount"),
        sortOrder: z
          .enum(["asc", "desc"])
          .default("desc")
          .describe("Sort direction: 'asc' (ascending) or 'desc' (descending)"),
      }),
    },
    async ({
      blockId,
      capitalBase,
      strategy,
      kellyFraction,
      maxAllocationPct,
      includeNegativeKelly,
      useMarginReturns,
      minTrades,
      sortBy,
      sortOrder,
    }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply strategy filter if provided
        if (strategy) {
          trades = filterByStrategy(trades, strategy);
        }

        if (trades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: strategy
                  ? `No trades found for strategy "${strategy}" in this block.`
                  : "No trades found in this block.",
              },
            ],
            isError: true,
          };
        }

        // Calculate Kelly metrics for portfolio (filtered or full)
        const portfolioKelly = calculateKellyMetrics(trades, capitalBase);

        // Calculate per-strategy Kelly metrics
        const strategyKelly = calculateStrategyKellyMetrics(trades, capitalBase);

        // Filter out strategies with insufficient trades
        const filteredStrategyKelly = new Map<string, ReturnType<typeof calculateKellyMetrics>>();
        const skippedStrategies: string[] = [];
        for (const [strategyName, kelly] of strategyKelly.entries()) {
          const strategyTrades = trades.filter(
            (t) => t.strategy.toLowerCase() === strategyName.toLowerCase()
          );
          if (strategyTrades.length >= minTrades) {
            filteredStrategyKelly.set(strategyName, kelly);
          } else {
            skippedStrategies.push(`${strategyName} (${strategyTrades.length} trades)`);
          }
        }

        // Calculate Kelly multiplier based on fraction choice
        const kellyMultiplier =
          kellyFraction === "full" ? 1.0 : kellyFraction === "half" ? 0.5 : 0.25;
        const maxAllocationFraction = maxAllocationPct / 100;

        // Build markdown output
        const lines: string[] = [
          `## Position Sizing: ${blockId}`,
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
          `| Capital Base | ${formatCurrency(capitalBase)} |`,
          `| Kelly Fraction | ${kellyFraction} (${formatPercent(kellyMultiplier * 100)} multiplier) |`,
          `| Max Allocation | ${formatPercent(maxAllocationPct)} |`,
          `| Include Negative Kelly | ${includeNegativeKelly ? "Yes" : "No"} |`,
          `| Use Margin Returns | ${useMarginReturns ? "Yes" : "No"} |`,
          `| Min Trades | ${minTrades} |`,
          `| Sort By | ${sortBy} (${sortOrder}) |`,
          ""
        );
        lines.push(
          "### Portfolio-Level Kelly",
          "",
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Win Rate | ${formatPercent(portfolioKelly.winRate * 100)} |`,
          `| Avg Win | ${formatCurrency(portfolioKelly.avgWin)} |`,
          `| Avg Loss | ${formatCurrency(portfolioKelly.avgLoss)} |`,
          `| Payoff Ratio | ${formatRatio(portfolioKelly.payoffRatio)} |`,
          `| Kelly Fraction | ${portfolioKelly.hasValidKelly ? formatPercent(portfolioKelly.percent) : "N/A"} |`,
          `| Recommended Allocation | ${portfolioKelly.hasValidKelly ? formatCurrency(capitalBase * Math.max(0, portfolioKelly.fraction)) : "N/A"} |`
        );

        // Add margin-based returns info if available and requested
        if (useMarginReturns && portfolioKelly.avgWinPct !== undefined) {
          lines.push(
            `| Avg Win (% of Margin) | ${formatPercent(portfolioKelly.avgWinPct)} |`,
            `| Avg Loss (% of Margin) | ${formatPercent(portfolioKelly.avgLossPct ?? 0)} |`,
            `| Normalized Kelly | ${portfolioKelly.normalizedKellyPct !== undefined ? formatPercent(portfolioKelly.normalizedKellyPct) : "N/A"} |`
          );
        }

        if (portfolioKelly.hasUnrealisticValues) {
          lines.push(
            `| ⚠️ Unrealistic Values | Yes (likely from compounding backtest) |`
          );
        }

        lines.push("");

        if (!portfolioKelly.hasValidKelly) {
          lines.push("*Kelly fraction cannot be calculated (insufficient wins/losses or zero avg loss).*", "");
        }

        if (skippedStrategies.length > 0) {
          lines.push(`*Skipped ${skippedStrategies.length} strategies with < ${minTrades} trades: ${skippedStrategies.join(", ")}*`, "");
        }

        // Per-strategy Kelly
        lines.push("### Per-Strategy Kelly", "");

        // Add extra column for margin-based Kelly if requested
        if (useMarginReturns) {
          lines.push(
            `| Strategy | Win Rate | Payoff | Kelly % | Norm Kelly | Allocation |`,
            `|----------|----------|--------|---------|------------|------------|`
          );
        } else {
          lines.push(
            `| Strategy | Win Rate | Payoff | Kelly % | Allocation |`,
            `|----------|----------|--------|---------|------------|`
          );
        }

        const strategyResults: Array<{
          name: string;
          kelly: ReturnType<typeof calculateKellyMetrics>;
          rawAllocation: number;
          adjustedAllocation: number;
          tradeCount: number;
        }> = [];

        for (const [strategyName, kelly] of filteredStrategyKelly.entries()) {
          // Skip negative Kelly strategies if not included
          if (!includeNegativeKelly && kelly.hasValidKelly && kelly.fraction < 0) {
            continue;
          }

          // Calculate raw allocation (full Kelly)
          const rawAllocation = kelly.hasValidKelly
            ? capitalBase * Math.max(0, kelly.fraction)
            : 0;

          // Apply Kelly multiplier and cap
          const adjustedFraction = Math.min(
            kelly.fraction * kellyMultiplier,
            maxAllocationFraction
          );
          const adjustedAllocation = kelly.hasValidKelly
            ? capitalBase * Math.max(0, adjustedFraction)
            : 0;

          const tradeCount = trades.filter(
            (t) => t.strategy.toLowerCase() === strategyName.toLowerCase()
          ).length;

          strategyResults.push({
            name: strategyName,
            kelly,
            rawAllocation,
            adjustedAllocation,
            tradeCount,
          });
        }

        // Sort strategy results
        strategyResults.sort((a, b) => {
          let comparison = 0;
          switch (sortBy) {
            case "name":
              comparison = a.name.localeCompare(b.name);
              break;
            case "kelly":
              comparison = (a.kelly.percent || 0) - (b.kelly.percent || 0);
              break;
            case "winRate":
              comparison = a.kelly.winRate - b.kelly.winRate;
              break;
            case "payoffRatio":
              comparison = a.kelly.payoffRatio - b.kelly.payoffRatio;
              break;
            case "allocation":
              comparison = a.adjustedAllocation - b.adjustedAllocation;
              break;
          }
          return sortOrder === "desc" ? -comparison : comparison;
        });

        // Output sorted results
        for (const { name, kelly, adjustedAllocation } of strategyResults) {
          if (useMarginReturns) {
            lines.push(
              `| ${name} | ${formatPercent(kelly.winRate * 100)} | ${formatRatio(kelly.payoffRatio)} | ${kelly.hasValidKelly ? formatPercent(kelly.percent) : "N/A"} | ${kelly.normalizedKellyPct !== undefined ? formatPercent(kelly.normalizedKellyPct) : "N/A"} | ${kelly.hasValidKelly ? formatCurrency(adjustedAllocation) : "N/A"} |`
            );
          } else {
            lines.push(
              `| ${name} | ${formatPercent(kelly.winRate * 100)} | ${formatRatio(kelly.payoffRatio)} | ${kelly.hasValidKelly ? formatPercent(kelly.percent) : "N/A"} | ${kelly.hasValidKelly ? formatCurrency(adjustedAllocation) : "N/A"} |`
            );
          }
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
          const fullKellyAlloc = Math.min(portfolioKelly.fraction, maxAllocationFraction);
          const halfKellyAlloc = Math.min(portfolioKelly.fraction / 2, maxAllocationFraction);
          const quarterKellyAlloc = Math.min(portfolioKelly.fraction / 4, maxAllocationFraction);

          const selectedLabel = kellyFraction === "full" ? " (selected)" : "";
          const halfLabel = kellyFraction === "half" ? " (selected)" : "";
          const quarterLabel = kellyFraction === "quarter" ? " (selected)" : "";

          lines.push(`- **Full Kelly:** ${formatPercent(fullKellyAlloc * 100)} (${formatCurrency(capitalBase * fullKellyAlloc)})${selectedLabel}`);
          lines.push(`- **Half Kelly:** ${formatPercent(halfKellyAlloc * 100)} (${formatCurrency(capitalBase * halfKellyAlloc)}) - recommended for most traders${halfLabel}`);
          lines.push(`- **Quarter Kelly:** ${formatPercent(quarterKellyAlloc * 100)} (${formatCurrency(capitalBase * quarterKellyAlloc)}) - conservative approach${quarterLabel}`);

          if (portfolioKelly.fraction > maxAllocationFraction) {
            lines.push(`\n*Note: Full Kelly (${formatPercent(portfolioKelly.percent)}) exceeds max allocation cap (${formatPercent(maxAllocationPct)})*`);
          }
        } else {
          lines.push("- Strategy does not have a positive edge based on historical data.");
          lines.push("- Consider paper trading or further optimization before allocating capital.");
        }

        lines.push("");

        const output = lines.join("\n");

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          options: {
            capitalBase,
            strategy: strategy ?? null,
            kellyFraction,
            kellyMultiplier,
            maxAllocationPct,
            maxAllocationFraction,
            includeNegativeKelly,
            useMarginReturns,
            minTrades,
            sortBy,
            sortOrder,
          },
          portfolio: {
            winRate: portfolioKelly.winRate,
            avgWin: portfolioKelly.avgWin,
            avgLoss: portfolioKelly.avgLoss,
            payoffRatio: portfolioKelly.payoffRatio,
            rawKellyFraction: portfolioKelly.fraction,
            rawKellyPercent: portfolioKelly.percent,
            hasValidKelly: portfolioKelly.hasValidKelly,
            adjustedKellyFraction: portfolioKelly.hasValidKelly
              ? Math.min(portfolioKelly.fraction * kellyMultiplier, maxAllocationFraction)
              : null,
            recommendedAllocation: portfolioKelly.hasValidKelly
              ? capitalBase *
                Math.max(0, Math.min(portfolioKelly.fraction * kellyMultiplier, maxAllocationFraction))
              : null,
            fullKelly: portfolioKelly.hasValidKelly
              ? Math.min(portfolioKelly.fraction, maxAllocationFraction)
              : null,
            halfKelly: portfolioKelly.hasValidKelly
              ? Math.min(portfolioKelly.fraction / 2, maxAllocationFraction)
              : null,
            quarterKelly: portfolioKelly.hasValidKelly
              ? Math.min(portfolioKelly.fraction / 4, maxAllocationFraction)
              : null,
            // Margin-based metrics
            avgWinPct: portfolioKelly.avgWinPct ?? null,
            avgLossPct: portfolioKelly.avgLossPct ?? null,
            normalizedKellyPct: portfolioKelly.normalizedKellyPct ?? null,
            calculationMethod: portfolioKelly.calculationMethod ?? null,
            hasUnrealisticValues: portfolioKelly.hasUnrealisticValues ?? false,
          },
          strategies: strategyResults.map(({ name, kelly, rawAllocation, adjustedAllocation, tradeCount }) => ({
            name,
            tradeCount,
            winRate: kelly.winRate,
            avgWin: kelly.avgWin,
            avgLoss: kelly.avgLoss,
            payoffRatio: kelly.payoffRatio,
            rawKellyFraction: kelly.fraction,
            rawKellyPercent: kelly.percent,
            hasValidKelly: kelly.hasValidKelly,
            rawAllocation,
            adjustedAllocation,
            // Margin-based metrics
            avgWinPct: kelly.avgWinPct ?? null,
            avgLossPct: kelly.avgLossPct ?? null,
            normalizedKellyPct: kelly.normalizedKellyPct ?? null,
            calculationMethod: kelly.calculationMethod ?? null,
            hasUnrealisticValues: kelly.hasUnrealisticValues ?? false,
          })),
          skippedStrategies,
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
