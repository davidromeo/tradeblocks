/**
 * Output Formatter
 *
 * Utilities for formatting MCP tool output as structured markdown.
 * All output is designed for Claude parsing and user display.
 *
 * Dual Output Pattern:
 * All tools return BOTH markdown (for display) AND structured JSON (for Claude reasoning).
 * This enables Claude to parse numerical values without regex extraction from markdown tables.
 */

import type { Trade } from "@lib/models/trade";
import type { PortfolioStats, StrategyStats } from "@lib/models/portfolio-stats";
import type { BlockInfo } from "./block-loader.js";

/**
 * MCP content item types
 */
export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpResourceContent {
  type: "resource";
  resource: {
    uri: string;
    mimeType: string;
    text: string;
  };
}

export type McpContent = McpTextContent | McpResourceContent;

export interface DualOutput {
  content: McpContent[];
}

/**
 * Create dual output for MCP tools - both markdown display and structured JSON for reasoning.
 *
 * This pattern enables Claude to:
 * 1. Display formatted markdown tables to users
 * 2. Parse structured numerical values for calculations and comparisons
 *
 * @param markdown - Formatted markdown string for display
 * @param data - Structured data object for Claude reasoning
 * @returns MCP-compatible response with both text and resource content
 */
export function createDualOutput(markdown: string, data: object): DualOutput {
  return {
    content: [
      { type: "text", text: markdown },
      {
        type: "resource",
        resource: {
          uri: "data:application/json",
          mimeType: "application/json",
          text: JSON.stringify(data),
        },
      },
    ],
  };
}

/**
 * Format a number as currency ($1,234.56)
 */
export function formatCurrency(value: number): string {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format a number as percentage (12.34%)
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a ratio with specified decimals
 */
export function formatRatio(
  value: number | undefined,
  decimals: number = 2
): string {
  if (value === undefined || value === null || !isFinite(value)) {
    return "N/A";
  }
  return value.toFixed(decimals);
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format portfolio stats as a markdown table
 */
export function formatStatsTable(stats: PortfolioStats): string {
  const lines: string[] = [
    "## Portfolio Statistics",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Total Trades | ${stats.totalTrades} |`,
    `| Winning Trades | ${stats.winningTrades} |`,
    `| Losing Trades | ${stats.losingTrades} |`,
    `| Break-Even Trades | ${stats.breakEvenTrades} |`,
    `| Win Rate | ${formatPercent(stats.winRate * 100)} |`,
    "",
    "### P&L Summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Gross P/L | ${formatCurrency(stats.totalPl)} |`,
    `| Total Commissions | ${formatCurrency(stats.totalCommissions)} |`,
    `| Net P/L | ${formatCurrency(stats.netPl)} |`,
    `| Average Win | ${formatCurrency(stats.avgWin)} |`,
    `| Average Loss | ${formatCurrency(stats.avgLoss)} |`,
    `| Max Win | ${formatCurrency(stats.maxWin)} |`,
    `| Max Loss | ${formatCurrency(stats.maxLoss)} |`,
    `| Profit Factor | ${formatRatio(stats.profitFactor)} |`,
    "",
    "### Risk Metrics",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Sharpe Ratio | ${formatRatio(stats.sharpeRatio)} |`,
    `| Sortino Ratio | ${formatRatio(stats.sortinoRatio)} |`,
    `| Calmar Ratio | ${formatRatio(stats.calmarRatio)} |`,
    `| Max Drawdown | ${formatPercent(stats.maxDrawdown)} |`,
    `| Time in Drawdown | ${stats.timeInDrawdown !== undefined ? formatPercent(stats.timeInDrawdown) : "N/A"} |`,
    `| Kelly % | ${stats.kellyPercentage !== undefined ? formatPercent(stats.kellyPercentage) : "N/A"} |`,
    "",
    "### Growth & Streaks",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| CAGR | ${stats.cagr !== undefined ? formatPercent(stats.cagr) : "N/A"} |`,
    `| Initial Capital | ${formatCurrency(stats.initialCapital)} |`,
    `| Average Daily P/L | ${formatCurrency(stats.avgDailyPl)} |`,
    `| Max Win Streak | ${stats.maxWinStreak ?? "N/A"} |`,
    `| Max Loss Streak | ${stats.maxLossStreak ?? "N/A"} |`,
    `| Current Streak | ${stats.currentStreak ?? "N/A"} |`,
    `| Monthly Win Rate | ${stats.monthlyWinRate !== undefined ? formatPercent(stats.monthlyWinRate) : "N/A"} |`,
    `| Weekly Win Rate | ${stats.weeklyWinRate !== undefined ? formatPercent(stats.weeklyWinRate) : "N/A"} |`,
  ];

  return lines.join("\n");
}

/**
 * Format strategy stats as a comparison table
 */
export function formatStrategyComparison(
  strategyStats: Record<string, StrategyStats>
): string {
  const strategies = Object.values(strategyStats).sort(
    (a, b) => b.totalPl - a.totalPl
  );

  if (strategies.length === 0) {
    return "No strategies found.";
  }

  const lines: string[] = [
    "## Strategy Comparison",
    "",
    "| Strategy | Trades | Win Rate | Total P/L | Avg Win | Avg Loss | Profit Factor |",
    "|----------|--------|----------|-----------|---------|----------|---------------|",
  ];

  for (const s of strategies) {
    lines.push(
      `| ${s.strategyName} | ${s.tradeCount} | ${formatPercent(s.winRate * 100)} | ${formatCurrency(s.totalPl)} | ${formatCurrency(s.avgWin)} | ${formatCurrency(s.avgLoss)} | ${formatRatio(s.profitFactor)} |`
    );
  }

  return lines.join("\n");
}

/**
 * Format trades as a paginated table
 */
export function formatTradesTable(
  trades: Trade[],
  page: number = 1,
  pageSize: number = 50
): string {
  const totalTrades = trades.length;
  const totalPages = Math.ceil(totalTrades / pageSize);
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalTrades);
  const pageTrades = trades.slice(startIdx, endIdx);

  if (pageTrades.length === 0) {
    return "No trades found.";
  }

  const lines: string[] = [
    `## Trades (Page ${page}/${totalPages})`,
    "",
    `Showing ${startIdx + 1}-${endIdx} of ${totalTrades} trades`,
    "",
    "| Date | Time | Strategy | Legs | P/L | Contracts | Commissions |",
    "|------|------|----------|------|-----|-----------|-------------|",
  ];

  for (const t of pageTrades) {
    const date = formatDate(t.dateOpened);
    const commissions = t.openingCommissionsFees + t.closingCommissionsFees;
    // Truncate legs for display
    const legs =
      t.legs.length > 30 ? t.legs.substring(0, 27) + "..." : t.legs;

    lines.push(
      `| ${date} | ${t.timeOpened} | ${t.strategy} | ${legs} | ${formatCurrency(t.pl)} | ${t.numContracts} | ${formatCurrency(commissions)} |`
    );
  }

  if (totalPages > 1) {
    lines.push("");
    lines.push(`*Use page parameter (1-${totalPages}) to see more trades*`);
  }

  return lines.join("\n");
}

/**
 * Format block info as a summary for listing
 */
export function formatBlockSummary(block: BlockInfo): string {
  const dateRange =
    block.dateRange.start && block.dateRange.end
      ? `${formatDate(block.dateRange.start)} to ${formatDate(block.dateRange.end)}`
      : "N/A";

  return [
    `### ${block.name}`,
    `- **ID:** \`${block.blockId}\``,
    `- **Trades:** ${block.tradeCount}`,
    `- **Date Range:** ${dateRange}`,
    `- **Daily Log:** ${block.hasDailyLog ? "Yes" : "No"}`,
    `- **Strategies:** ${block.strategies.join(", ") || "None"}`,
    `- **Total P/L:** ${formatCurrency(block.totalPl)}`,
    `- **Net P/L:** ${formatCurrency(block.netPl)}`,
  ].join("\n");
}

/**
 * Format a list of blocks for the list_backtests tool
 */
export function formatBlockList(blocks: BlockInfo[]): string {
  if (blocks.length === 0) {
    return [
      "## Available Backtests",
      "",
      "No backtest blocks found.",
      "",
      "Create a block by adding a folder with a `tradelog.csv` file.",
    ].join("\n");
  }

  const lines: string[] = [
    "## Available Backtests",
    "",
    `Found ${blocks.length} backtest block(s):`,
    "",
  ];

  for (const block of blocks) {
    lines.push(formatBlockSummary(block));
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format detailed block info
 */
export function formatBlockInfo(
  blockId: string,
  tradeCount: number,
  dailyLogCount: number,
  dateRange: { start: Date | null; end: Date | null },
  strategies: string[]
): string {
  const dateRangeStr =
    dateRange.start && dateRange.end
      ? `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}`
      : "N/A";

  return [
    `## Block: ${blockId}`,
    "",
    "### Overview",
    "",
    "| Property | Value |",
    "|----------|-------|",
    `| Block ID | \`${blockId}\` |`,
    `| Trade Count | ${tradeCount} |`,
    `| Daily Log Entries | ${dailyLogCount} |`,
    `| Date Range | ${dateRangeStr} |`,
    `| Strategies | ${strategies.length} |`,
    "",
    "### Strategies Found",
    "",
    strategies.map((s) => `- ${s}`).join("\n") || "No strategies found",
  ].join("\n");
}

/**
 * Format multiple blocks comparison table
 */
export function formatBlocksComparison(
  blocks: Array<{
    blockId: string;
    stats: PortfolioStats;
  }>
): string {
  if (blocks.length === 0) {
    return "No blocks to compare.";
  }

  const lines: string[] = [
    "## Block Comparison",
    "",
    "| Block | Trades | Win Rate | Net P/L | Sharpe | Sortino | Max DD |",
    "|-------|--------|----------|---------|--------|---------|--------|",
  ];

  for (const { blockId, stats } of blocks) {
    lines.push(
      `| ${blockId} | ${stats.totalTrades} | ${formatPercent(stats.winRate * 100)} | ${formatCurrency(stats.netPl)} | ${formatRatio(stats.sharpeRatio)} | ${formatRatio(stats.sortinoRatio)} | ${formatPercent(stats.maxDrawdown)} |`
    );
  }

  return lines.join("\n");
}
