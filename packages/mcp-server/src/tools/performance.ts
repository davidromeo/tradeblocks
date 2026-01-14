/**
 * Performance Tools
 *
 * Tier 3 performance MCP tools for chart data, period returns, and backtest vs actual comparison.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock, loadReportingLog } from "../utils/block-loader.js";
import {
  createToolOutput,
  formatPercent,
  formatCurrency,
} from "../utils/output-formatter.js";
import type { Trade } from "@lib/models/trade";
import type { ReportingTrade } from "@lib/models/reporting-trade";

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
 * Format date key to YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get the ISO week number
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Calculate equity curve from trades
 */
function buildEquityCurve(trades: Trade[]): Array<{
  date: string;
  equity: number;
  highWaterMark: number;
  tradeNumber: number;
}> {
  if (trades.length === 0) {
    return [];
  }

  const sortedTrades = [...trades].sort(
    (a, b) =>
      new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
  );

  // Calculate initial capital from first trade
  const firstTrade = sortedTrades[0];
  let initialCapital = firstTrade.fundsAtClose - firstTrade.pl;
  if (!isFinite(initialCapital) || initialCapital <= 0) {
    initialCapital = 100000;
  }

  let runningEquity = initialCapital;
  let highWaterMark = runningEquity;

  const curve: Array<{
    date: string;
    equity: number;
    highWaterMark: number;
    tradeNumber: number;
  }> = [
    {
      date: formatDateKey(new Date(sortedTrades[0].dateOpened)),
      equity: runningEquity,
      highWaterMark,
      tradeNumber: 0,
    },
  ];

  sortedTrades.forEach((trade, index) => {
    runningEquity += trade.pl;
    highWaterMark = Math.max(highWaterMark, runningEquity);

    curve.push({
      date: formatDateKey(new Date(trade.dateOpened)),
      equity: runningEquity,
      highWaterMark,
      tradeNumber: index + 1,
    });
  });

  return curve;
}

/**
 * Calculate drawdown series from equity curve
 */
function buildDrawdownSeries(
  equityCurve: Array<{ date: string; equity: number; highWaterMark: number }>
): Array<{ date: string; drawdownPct: number }> {
  return equityCurve.map((point) => ({
    date: point.date,
    drawdownPct:
      point.highWaterMark > 0
        ? ((point.equity - point.highWaterMark) / point.highWaterMark) * 100
        : 0,
  }));
}

/**
 * Calculate monthly returns matrix
 */
function buildMonthlyReturns(
  trades: Trade[]
): Record<number, Record<number, number>> {
  const monthlyData: Record<string, number> = {};

  trades.forEach((trade) => {
    const date = new Date(trade.dateOpened);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + trade.pl;
  });

  const monthlyReturns: Record<number, Record<number, number>> = {};
  const years = new Set<number>();

  trades.forEach((trade) => {
    years.add(new Date(trade.dateOpened).getFullYear());
  });

  Array.from(years)
    .sort()
    .forEach((year) => {
      monthlyReturns[year] = {};
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${year}-${String(month).padStart(2, "0")}`;
        monthlyReturns[year][month] = monthlyData[monthKey] || 0;
      }
    });

  return monthlyReturns;
}

/**
 * Calculate return distribution histogram
 */
function buildReturnDistribution(
  trades: Trade[],
  bucketCount: number = 20
): Array<{ rangeStart: number; rangeEnd: number; count: number }> {
  if (trades.length === 0) return [];

  const returns = trades.map((t) => t.pl);
  const minReturn = Math.min(...returns);
  const maxReturn = Math.max(...returns);
  const range = maxReturn - minReturn || 1;
  const bucketSize = range / bucketCount;

  const buckets: Array<{ rangeStart: number; rangeEnd: number; count: number }> =
    [];

  for (let i = 0; i < bucketCount; i++) {
    const rangeStart = minReturn + i * bucketSize;
    const rangeEnd = minReturn + (i + 1) * bucketSize;
    const count = returns.filter((r) => {
      if (i === bucketCount - 1) {
        return r >= rangeStart && r <= rangeEnd;
      }
      return r >= rangeStart && r < rangeEnd;
    }).length;
    buckets.push({ rangeStart, rangeEnd, count });
  }

  return buckets;
}

/**
 * Calculate day of week average P/L
 */
function buildDayOfWeekData(
  trades: Trade[]
): Array<{ day: string; count: number; avgPl: number; totalPl: number }> {
  const dayNames = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const dayData: Record<string, { count: number; totalPl: number }> = {};

  trades.forEach((trade) => {
    const date = new Date(trade.dateOpened);
    const jsDay = date.getDay();
    const pythonWeekday = jsDay === 0 ? 6 : jsDay - 1;
    const day = dayNames[pythonWeekday];

    if (!dayData[day]) {
      dayData[day] = { count: 0, totalPl: 0 };
    }
    dayData[day].count++;
    dayData[day].totalPl += trade.pl;
  });

  return dayNames.map((day) => ({
    day,
    count: dayData[day]?.count || 0,
    avgPl:
      dayData[day]?.count > 0 ? dayData[day].totalPl / dayData[day].count : 0,
    totalPl: dayData[day]?.totalPl || 0,
  }));
}

/**
 * Register all performance MCP tools
 */
export function registerPerformanceTools(
  server: McpServer,
  baseDir: string
): void {
  // Tool 1: get_performance_charts
  server.registerTool(
    "get_performance_charts",
    {
      description:
        "Get data for performance visualizations including equity curve, drawdown, monthly returns, return distribution, and day of week analysis",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        charts: z
          .array(
            z.enum([
              "equity_curve",
              "drawdown",
              "monthly_returns",
              "return_distribution",
              "day_of_week",
            ])
          )
          .default(["equity_curve", "drawdown", "monthly_returns"])
          .describe(
            "Which charts to include (default: equity_curve, drawdown, monthly_returns)"
          ),
      }),
    },
    async ({ blockId, strategy, charts }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply strategy filter
        trades = filterByStrategy(trades, strategy);

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

        // Build requested chart data
        const chartData: Record<string, unknown> = {};
        let dataPoints = 0;

        if (charts.includes("equity_curve")) {
          chartData.equityCurve = buildEquityCurve(trades);
          dataPoints += (chartData.equityCurve as unknown[]).length;
        }

        if (charts.includes("drawdown")) {
          const equityCurve =
            (chartData.equityCurve as Array<{
              date: string;
              equity: number;
              highWaterMark: number;
            }>) || buildEquityCurve(trades);
          chartData.drawdown = buildDrawdownSeries(equityCurve);
          dataPoints += (chartData.drawdown as unknown[]).length;
        }

        if (charts.includes("monthly_returns")) {
          chartData.monthlyReturns = buildMonthlyReturns(trades);
          // Count non-zero months
          const mr = chartData.monthlyReturns as Record<
            number,
            Record<number, number>
          >;
          for (const year of Object.keys(mr)) {
            for (const month of Object.keys(mr[Number(year)])) {
              if (mr[Number(year)][Number(month)] !== 0) dataPoints++;
            }
          }
        }

        if (charts.includes("return_distribution")) {
          chartData.returnDistribution = buildReturnDistribution(trades);
          dataPoints += (chartData.returnDistribution as unknown[]).length;
        }

        if (charts.includes("day_of_week")) {
          chartData.dayOfWeek = buildDayOfWeekData(trades);
          dataPoints += (chartData.dayOfWeek as unknown[]).length;
        }

        // Brief summary for user display
        const summary = `Performance: ${blockId}${strategy ? ` (${strategy})` : ""} | ${charts.length} charts | ${trades.length} trades | ${dataPoints} data points`;

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          strategy: strategy ?? null,
          tradesAnalyzed: trades.length,
          chartsIncluded: charts,
          ...chartData,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting performance charts: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 2: get_period_returns
  server.registerTool(
    "get_period_returns",
    {
      description:
        "Get P&L breakdown by period (monthly, weekly, or daily) with gross P/L, commissions, and net P/L",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        strategy: z
          .string()
          .optional()
          .describe("Filter by strategy name (case-insensitive)"),
        period: z
          .enum(["monthly", "weekly", "daily"])
          .default("monthly")
          .describe("Time period for grouping (default: monthly)"),
        year: z
          .number()
          .optional()
          .describe("Filter to specific year (optional)"),
      }),
    },
    async ({ blockId, strategy, period, year }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        let trades = block.trades;

        // Apply strategy filter
        trades = filterByStrategy(trades, strategy);

        // Apply year filter
        if (year !== undefined) {
          trades = trades.filter(
            (t) => new Date(t.dateOpened).getFullYear() === year
          );
        }

        if (trades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text:
                  strategy || year
                    ? `No trades found matching filters (strategy: ${strategy ?? "all"}, year: ${year ?? "all"}).`
                    : "No trades found in this block.",
              },
            ],
            isError: true,
          };
        }

        // Group trades by period
        const periodData: Map<
          string,
          {
            grossPl: number;
            commissions: number;
            netPl: number;
            tradeCount: number;
          }
        > = new Map();

        trades.forEach((trade) => {
          const date = new Date(trade.dateOpened);
          let periodKey: string;

          if (period === "monthly") {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, "0");
            periodKey = `${y}-${m}`;
          } else if (period === "weekly") {
            const y = date.getFullYear();
            const w = String(getISOWeekNumber(date)).padStart(2, "0");
            periodKey = `${y}-W${w}`;
          } else {
            // daily
            periodKey = formatDateKey(date);
          }

          const existing = periodData.get(periodKey) || {
            grossPl: 0,
            commissions: 0,
            netPl: 0,
            tradeCount: 0,
          };

          const totalCommissions =
            (trade.openingCommissionsFees ?? 0) +
            (trade.closingCommissionsFees ?? 0);

          existing.grossPl += trade.pl;
          existing.commissions += totalCommissions;
          existing.netPl += trade.pl - totalCommissions;
          existing.tradeCount += 1;
          periodData.set(periodKey, existing);
        });

        // Convert to sorted array
        const periods = Array.from(periodData.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([periodKey, data]) => ({
            period: periodKey,
            ...data,
          }));

        // Calculate totals
        const totals = {
          grossPl: periods.reduce((sum, p) => sum + p.grossPl, 0),
          commissions: periods.reduce((sum, p) => sum + p.commissions, 0),
          netPl: periods.reduce((sum, p) => sum + p.netPl, 0),
          tradeCount: periods.reduce((sum, p) => sum + p.tradeCount, 0),
        };

        // Brief summary for user display
        const summary = `Period Returns: ${blockId}${strategy ? ` (${strategy})` : ""} | ${period} | ${periods.length} periods | Net P/L: ${formatCurrency(totals.netPl)}`;

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          strategy: strategy ?? null,
          periodType: period,
          yearFilter: year ?? null,
          tradesAnalyzed: trades.length,
          periodCount: periods.length,
          periods,
          totals,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting period returns: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 3: compare_backtest_to_actual
  server.registerTool(
    "compare_backtest_to_actual",
    {
      description:
        "Compare backtest (tradelog.csv) results to actual reported trades (reportinglog.csv) with scaling options for fair comparison",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        scaling: z
          .enum(["raw", "perContract", "toReported"])
          .default("raw")
          .describe(
            "Scaling mode: 'raw' (no scaling), 'perContract' (divide by contracts for per-lot comparison), 'toReported' (scale backtest to match actual contract count)"
          ),
      }),
    },
    async ({ blockId, scaling }) => {
      try {
        const block = await loadBlock(baseDir, blockId);
        const backtestTrades = block.trades;

        if (backtestTrades.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No backtest trades found in tradelog.csv.",
              },
            ],
            isError: true,
          };
        }

        // Load reporting log (actual trades)
        let actualTrades: ReportingTrade[];
        try {
          actualTrades = await loadReportingLog(baseDir, blockId);
        } catch {
          return {
            content: [
              {
                type: "text",
                text: `No reportinglog.csv found in block "${blockId}". This tool requires both tradelog.csv (backtest) and reportinglog.csv (actual) to compare.`,
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
                text: "No actual trades found in reportinglog.csv.",
              },
            ],
            isError: true,
          };
        }

        // Group trades by date and strategy
        const backtestByDateStrategy = new Map<
          string,
          { trades: Trade[]; totalPl: number; contracts: number }
        >();
        const actualByDateStrategy = new Map<
          string,
          { trades: ReportingTrade[]; totalPl: number; contracts: number }
        >();

        backtestTrades.forEach((trade) => {
          const dateKey = formatDateKey(new Date(trade.dateOpened));
          const key = `${dateKey}|${trade.strategy}`;
          const existing = backtestByDateStrategy.get(key) || {
            trades: [],
            totalPl: 0,
            contracts: 0,
          };
          existing.trades.push(trade);
          existing.totalPl += trade.pl;
          existing.contracts = existing.trades[0].numContracts; // Unit size from first trade
          backtestByDateStrategy.set(key, existing);
        });

        actualTrades.forEach((trade) => {
          const dateKey = formatDateKey(new Date(trade.dateOpened));
          const key = `${dateKey}|${trade.strategy}`;
          const existing = actualByDateStrategy.get(key) || {
            trades: [],
            totalPl: 0,
            contracts: 0,
          };
          existing.trades.push(trade);
          existing.totalPl += trade.pl;
          existing.contracts = existing.trades[0].numContracts; // Unit size from first trade
          actualByDateStrategy.set(key, existing);
        });

        // Match and compare
        const comparisons: Array<{
          date: string;
          strategy: string;
          backtestPl: number;
          actualPl: number;
          scaledBacktestPl: number;
          scaledActualPl: number;
          slippage: number;
          slippagePercent: number | null;
          backtestContracts: number;
          actualContracts: number;
          matched: boolean;
        }> = [];

        const processedActual = new Set<string>();

        for (const [key, btData] of backtestByDateStrategy) {
          const [dateKey, strategy] = key.split("|");
          const actualData = actualByDateStrategy.get(key);

          if (actualData) {
            processedActual.add(key);

            // Apply scaling
            let scaledBtPl = btData.totalPl;
            let scaledActualPl = actualData.totalPl;

            if (scaling === "perContract") {
              scaledBtPl =
                btData.contracts > 0 ? btData.totalPl / btData.contracts : 0;
              scaledActualPl =
                actualData.contracts > 0
                  ? actualData.totalPl / actualData.contracts
                  : 0;
            } else if (scaling === "toReported") {
              // Scale backtest DOWN to match actual contract count
              if (btData.contracts > 0 && actualData.contracts > 0) {
                const scaleFactor = actualData.contracts / btData.contracts;
                scaledBtPl = btData.totalPl * scaleFactor;
              }
              // Actual stays as-is
            }

            const slippage = scaledActualPl - scaledBtPl;
            const slippagePercent =
              scaledBtPl !== 0
                ? (slippage / Math.abs(scaledBtPl)) * 100
                : null;

            comparisons.push({
              date: dateKey,
              strategy,
              backtestPl: btData.totalPl,
              actualPl: actualData.totalPl,
              scaledBacktestPl: scaledBtPl,
              scaledActualPl: scaledActualPl,
              slippage,
              slippagePercent,
              backtestContracts: btData.contracts,
              actualContracts: actualData.contracts,
              matched: true,
            });
          } else {
            // Unmatched backtest (no corresponding actual)
            comparisons.push({
              date: dateKey,
              strategy,
              backtestPl: btData.totalPl,
              actualPl: 0,
              scaledBacktestPl:
                scaling === "perContract" && btData.contracts > 0
                  ? btData.totalPl / btData.contracts
                  : btData.totalPl,
              scaledActualPl: 0,
              slippage: 0,
              slippagePercent: null,
              backtestContracts: btData.contracts,
              actualContracts: 0,
              matched: false,
            });
          }
        }

        // Add unmatched actual trades
        for (const [key, actualData] of actualByDateStrategy) {
          if (processedActual.has(key)) continue;

          const [dateKey, strategy] = key.split("|");
          comparisons.push({
            date: dateKey,
            strategy,
            backtestPl: 0,
            actualPl: actualData.totalPl,
            scaledBacktestPl: 0,
            scaledActualPl:
              scaling === "perContract" && actualData.contracts > 0
                ? actualData.totalPl / actualData.contracts
                : actualData.totalPl,
            slippage: 0,
            slippagePercent: null,
            backtestContracts: 0,
            actualContracts: actualData.contracts,
            matched: false,
          });
        }

        // Sort by date then strategy
        comparisons.sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date);
          if (dateCompare !== 0) return dateCompare;
          return a.strategy.localeCompare(b.strategy);
        });

        // Calculate summary statistics
        const matchedComparisons = comparisons.filter((c) => c.matched);
        const totalBacktestPl = matchedComparisons.reduce(
          (sum, c) => sum + c.scaledBacktestPl,
          0
        );
        const totalActualPl = matchedComparisons.reduce(
          (sum, c) => sum + c.scaledActualPl,
          0
        );
        const totalSlippage = totalActualPl - totalBacktestPl;
        const avgSlippage =
          matchedComparisons.length > 0
            ? totalSlippage / matchedComparisons.length
            : 0;
        const avgSlippagePercent =
          totalBacktestPl !== 0
            ? (totalSlippage / Math.abs(totalBacktestPl)) * 100
            : null;

        // Get unique strategies
        const backtestStrategies = Array.from(
          new Set(backtestTrades.map((t) => t.strategy))
        ).sort();
        const actualStrategies = Array.from(
          new Set(actualTrades.map((t) => t.strategy))
        ).sort();

        // Brief summary for user display
        const slippageDisplay =
          avgSlippagePercent !== null
            ? `${formatPercent(avgSlippagePercent)} slippage`
            : "N/A slippage";
        const summary = `Comparison: ${blockId} | ${scaling} scaling | ${matchedComparisons.length}/${comparisons.length} matched | ${slippageDisplay}`;

        // Build structured data for Claude reasoning
        const structuredData = {
          blockId,
          scalingMode: scaling,
          backtestTradeCount: backtestTrades.length,
          actualTradeCount: actualTrades.length,
          backtestStrategies,
          actualStrategies,
          summary: {
            totalComparisons: comparisons.length,
            matchedComparisons: matchedComparisons.length,
            unmatchedBacktest: comparisons.filter(
              (c) => !c.matched && c.backtestPl !== 0
            ).length,
            unmatchedActual: comparisons.filter(
              (c) => !c.matched && c.actualPl !== 0
            ).length,
            totalBacktestPl,
            totalActualPl,
            totalSlippage,
            avgSlippage,
            avgSlippagePercent,
          },
          comparisons,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error comparing backtest to actual: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
