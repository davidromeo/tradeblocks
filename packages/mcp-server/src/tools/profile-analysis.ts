/**
 * Profile Analysis Tools
 *
 * MCP tools that use stored strategy profiles for targeted analysis:
 * - portfolio_structure_map: Vol_Regime x Trend_Direction matrix across strategies
 *
 * Plan 02 tools (analyze_structure_fit, validate_entry_filters) are registered
 * separately if present; this file provides registerProfileAnalysisTools() which
 * wires all profile analysis tools into the server.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock } from "../utils/block-loader.js";
import { createToolOutput } from "../utils/output-formatter.js";
import type { Trade } from "@tradeblocks/lib";
import { getConnection } from "../db/connection.js";
import { listProfiles } from "../db/profile-schemas.js";
import { filterByStrategy } from "./shared/filters.js";
import {
  buildLookaheadFreeQuery,
  type MarketLookupKey,
} from "../utils/field-timing.js";
import {
  DEFAULT_MARKET_TICKER,
  marketTickerDateKey,
  resolveTradeTicker,
} from "../utils/ticker.js";
import { computeSliceStats, type SliceStats } from "../utils/analysis-stats.js";
import {
  upgradeToReadWrite,
  downgradeToReadOnly,
  getConnectionMode,
} from "../db/connection.js";
import { syncAllBlocks } from "../sync/index.js";

// =============================================================================
// Utility Functions (local to this module)
// =============================================================================

/**
 * Format trade date to YYYY-MM-DD for market data matching.
 */
function formatTradeDate(date: Date | string): string {
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTradeLookupKey(trade: Trade): MarketLookupKey {
  return {
    date: formatTradeDate(trade.dateOpened),
    ticker: resolveTradeTicker(trade, DEFAULT_MARKET_TICKER),
  };
}

function uniqueTradeLookupKeys(trades: Trade[]): MarketLookupKey[] {
  const byKey = new Map<string, MarketLookupKey>();
  for (const trade of trades) {
    const lookup = getTradeLookupKey(trade);
    byKey.set(marketTickerDateKey(lookup.ticker, lookup.date), lookup);
  }
  return Array.from(byKey.values());
}

function resultToRecords(result: {
  columnCount: number;
  columnName(i: number): string;
  getRows(): Iterable<unknown[]>;
}): Record<string, unknown>[] {
  const columnCount = result.columnCount;
  const colNames: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    colNames.push(result.columnName(i));
  }
  const records: Record<string, unknown>[] = [];
  for (const row of result.getRows()) {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < columnCount; i++) {
      const val = row[i];
      record[colNames[i]] = typeof val === "bigint" ? Number(val) : val;
    }
    records.push(record);
  }
  return records;
}

function recordsByTickerDate(
  records: Record<string, unknown>[]
): Map<string, Record<string, unknown>> {
  const mapped = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    const date = String(record["date"] || "");
    const ticker = String(record["ticker"] || DEFAULT_MARKET_TICKER);
    mapped.set(marketTickerDateKey(ticker, date), record);
  }
  return mapped;
}

function getNum(record: Record<string, unknown>, field: string): number {
  const val = record[field];
  if (val === null || val === undefined) return NaN;
  if (typeof val === "bigint") return Number(val);
  return val as number;
}

// =============================================================================
// Vol Regime Labels
// =============================================================================

const VOL_REGIME_LABELS: Record<number, string> = {
  1: "very_low",
  2: "low",
  3: "below_avg",
  4: "above_avg",
  5: "high",
  6: "extreme",
};

const TREND_LABELS = ["up", "down", "flat"] as const;
type TrendLabel = (typeof TREND_LABELS)[number];

// =============================================================================
// portfolio_structure_map Schema and Handler
// =============================================================================

export const portfolioStructureMapSchema = z.object({
  blockId: z
    .string()
    .optional()
    .describe("Block ID to analyze. When omitted, aggregate across all blocks."),
  minTrades: z
    .number()
    .optional()
    .default(10)
    .describe("Thin-data warning threshold (default: 10)"),
});

export async function handlePortfolioStructureMap(
  input: z.infer<typeof portfolioStructureMapSchema>,
  baseDir: string
): Promise<ReturnType<typeof createToolOutput> | { content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    const { blockId, minTrades } = portfolioStructureMapSchema.parse(input);
    const conn = await getConnection(baseDir);

    // Load profiles
    const profiles = await listProfiles(conn, blockId);
    if (profiles.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: blockId
              ? `No strategy profiles found for block '${blockId}'. Use profile_strategy to create profiles first.`
              : "No strategy profiles found. Use profile_strategy to create profiles first.",
          },
        ],
      };
    }

    // Collect all trades per strategy, matched to market data
    interface StrategyTradeMarket {
      strategyName: string;
      trade: Trade;
      market: Record<string, unknown>;
    }

    const allTradeMarkets: StrategyTradeMarket[] = [];
    const warnings: string[] = [];

    for (const profile of profiles) {
      let block;
      try {
        block = await loadBlock(baseDir, profile.blockId);
      } catch {
        warnings.push(`Could not load block '${profile.blockId}' for strategy '${profile.strategyName}'`);
        continue;
      }

      const trades = filterByStrategy(block.trades, profile.strategyName);
      if (trades.length === 0) {
        warnings.push(`No trades found for strategy '${profile.strategyName}' in block '${profile.blockId}'`);
        continue;
      }

      // Query market data for trade dates
      const tradeKeys = uniqueTradeLookupKeys(trades);
      const { sql, params } = buildLookaheadFreeQuery(tradeKeys);
      const dailyResult = await conn.runAndReadAll(sql, params);
      const dailyRecords = resultToRecords(dailyResult);
      const daily = recordsByTickerDate(dailyRecords);

      for (const trade of trades) {
        const lookup = getTradeLookupKey(trade);
        const marketKey = marketTickerDateKey(lookup.ticker, lookup.date);
        const market = daily.get(marketKey);
        if (market) {
          allTradeMarkets.push({
            strategyName: profile.strategyName,
            trade,
            market,
          });
        }
      }
    }

    if (allTradeMarkets.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No trades could be matched to market data. Ensure market data is imported and enriched.",
          },
        ],
      };
    }

    // Build the 18-cell matrix: Vol_Regime (6) x Trend_Direction (3)
    // Use prev_ prefix for both fields (both are close-derived, need LAG)
    const strategyNames = [...new Set(allTradeMarkets.map((t) => t.strategyName))];

    // Collect PLs per cell per strategy
    type CellKey = string; // "regime:trend"
    const cellPls = new Map<CellKey, Map<string, number[]>>();

    let unknownTrendCount = 0;
    const unknownTrendPls = new Map<string, number[]>(); // strategy -> pls for unknown trend

    for (const { strategyName, trade, market } of allTradeMarkets) {
      const volRegime = getNum(market, "prev_Vol_Regime");
      const trendRaw = market["prev_Trend_Direction"];

      // Handle missing Vol_Regime
      if (isNaN(volRegime) || volRegime < 1 || volRegime > 6) continue;

      // Handle missing Trend_Direction
      let trend: TrendLabel | null = null;
      if (
        trendRaw === null ||
        trendRaw === undefined ||
        trendRaw === ""
      ) {
        unknownTrendCount++;
        if (!unknownTrendPls.has(strategyName)) {
          unknownTrendPls.set(strategyName, []);
        }
        unknownTrendPls.get(strategyName)!.push(trade.pl);
        continue;
      }
      const trendStr = String(trendRaw).toLowerCase();
      if (trendStr === "up" || trendStr === "down" || trendStr === "flat") {
        trend = trendStr as TrendLabel;
      } else {
        unknownTrendCount++;
        if (!unknownTrendPls.has(strategyName)) {
          unknownTrendPls.set(strategyName, []);
        }
        unknownTrendPls.get(strategyName)!.push(trade.pl);
        continue;
      }

      const regimeLabel = VOL_REGIME_LABELS[volRegime] || `regime_${volRegime}`;
      const cellKey = `${regimeLabel}:${trend}`;

      if (!cellPls.has(cellKey)) {
        cellPls.set(cellKey, new Map());
      }
      const cellMap = cellPls.get(cellKey)!;
      if (!cellMap.has(strategyName)) {
        cellMap.set(strategyName, []);
      }
      cellMap.get(strategyName)!.push(trade.pl);
    }

    // Build matrix output
    const matrix: Record<string, Record<string, Record<string, SliceStats>>> = {};
    const overlaps: Array<{
      regime: string;
      trend: string;
      strategies: string[];
      totalTrades: number;
    }> = [];
    const blindSpots: Array<{ regime: string; trend: string }> = [];
    let coveredCells = 0;
    let overlapCells = 0;

    for (const [, regimeLabel] of Object.entries(VOL_REGIME_LABELS)) {
      matrix[regimeLabel] = {};
      for (const trend of TREND_LABELS) {
        const cellKey = `${regimeLabel}:${trend}`;
        const cellMap = cellPls.get(cellKey);

        if (!cellMap || cellMap.size === 0) {
          blindSpots.push({ regime: regimeLabel, trend });
          matrix[regimeLabel][trend] = {};
          continue;
        }

        coveredCells++;
        const cellStats: Record<string, SliceStats> = {};
        const strategiesInCell: string[] = [];
        let totalTradesInCell = 0;

        for (const [stratName, pls] of cellMap) {
          cellStats[stratName] = computeSliceStats(pls);
          strategiesInCell.push(stratName);
          totalTradesInCell += pls.length;

          // Thin-data warning
          if (pls.length > 0 && pls.length < minTrades) {
            warnings.push(
              `Thin data: '${stratName}' has only ${pls.length} trades in ${regimeLabel}/${trend} (threshold: ${minTrades})`
            );
          }
        }

        matrix[regimeLabel][trend] = cellStats;

        // Overlap detection: 2+ strategies in same cell
        if (strategiesInCell.length >= 2) {
          overlapCells++;
          overlaps.push({
            regime: regimeLabel,
            trend,
            strategies: strategiesInCell,
            totalTrades: totalTradesInCell,
          });
        }
      }
    }

    const blindSpotCells = blindSpots.length;

    // Handle unknown trend trades
    if (unknownTrendCount > 0) {
      warnings.push(
        `${unknownTrendCount} trades had missing or unknown Trend_Direction. Consider running enrich_market_data to populate Trend_Direction.`
      );
    }

    // Build unknown trend stats if any
    const unknownTrendStats: Record<string, SliceStats> | undefined =
      unknownTrendPls.size > 0
        ? Object.fromEntries(
            [...unknownTrendPls.entries()].map(([name, pls]) => [
              name,
              computeSliceStats(pls),
            ])
          )
        : undefined;

    const coverageSummary = {
      totalCells: 18,
      coveredCells,
      blindSpotCells,
      overlapCells,
    };

    const summary = `Portfolio structure map: ${strategyNames.length} strategies | ${coveredCells}/18 cells covered | ${overlapCells} overlaps | ${blindSpotCells} blind spots`;

    const structuredData: Record<string, unknown> = {
      strategies: strategyNames,
      matrix,
      overlaps,
      blind_spots: blindSpots,
      coverage_summary: coverageSummary,
      warnings,
    };

    if (unknownTrendStats) {
      structuredData.unknown_trend = unknownTrendStats;
    }

    return createToolOutput(summary, structuredData);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error building portfolio structure map: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

// =============================================================================
// Registration
// =============================================================================

/**
 * Register all profile analysis tools.
 * This includes portfolio_structure_map (from Plan 03) and
 * analyze_structure_fit + validate_entry_filters (from Plan 02, if present).
 */
export function registerProfileAnalysisTools(
  server: McpServer,
  baseDir: string
): void {
  // portfolio_structure_map: optional blockId means we can't always use withSyncedBlock.
  // When blockId is provided, sync that block. When omitted, sync all blocks.
  server.registerTool(
    "portfolio_structure_map",
    {
      description:
        "Build a Vol_Regime x Trend_Direction matrix (18 cells) across all profiled strategies. " +
        "Shows per-strategy stats in each cell, detects overlap (2+ strategies in same cell), " +
        "blind spots (cells with zero trades), and thin-data warnings. " +
        "Optionally filter to a single block or aggregate across all blocks.",
      inputSchema: portfolioStructureMapSchema,
    },
    async (input) => {
      // Manual sync: if blockId provided, sync just that block; otherwise sync all
      await upgradeToReadWrite(baseDir, { fallbackToReadOnly: true });
      if (getConnectionMode() === "read_write") {
        try {
          if (input.blockId) {
            const { syncBlock } = await import("../sync/index.js");
            await syncBlock(input.blockId, baseDir);
          } else {
            await syncAllBlocks(baseDir);
          }
        } finally {
          await downgradeToReadOnly(baseDir);
        }
      }

      return handlePortfolioStructureMap(input, baseDir);
    }
  );

  // NOTE: analyze_structure_fit and validate_entry_filters are registered by Plan 02.
  // If Plan 02 has already added them to this file, they will be registered above.
  // If Plan 02 runs after Plan 03, it will add its tools and update this registration function.
}
