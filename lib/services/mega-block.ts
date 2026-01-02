// lib/services/mega-block.ts
import { Trade } from '../models/trade';
import { ProcessedBlock } from '../models/block';
import {
  SourceBlockRef,
  isMegaBlock,
  SizingConfig,
  BlockSizingStats,
} from '../models/mega-block';
import { createBlock, addTrades, getTradesByBlock, getBlock } from '../db';
import { buildPerformanceSnapshot, SnapshotChartData } from './performance-snapshot';
import { PortfolioStats } from '../models/portfolio-stats';
import { deriveGroupedLegOutcomes, GroupedLegOutcomes } from '../utils/performance-helpers';

/**
 * Scale a trade's monetary and quantity values by a weight factor.
 * Used when combining blocks with different allocations.
 *
 * Scaled fields:
 * - pl, premium, fundsAtClose, marginReq
 * - numContracts
 * - openingCommissionsFees, closingCommissionsFees
 * - maxProfit, maxLoss (if present)
 *
 * Preserved fields:
 * - All dates and times
 * - strategy, legs, reasonForClose
 * - Prices (openingPrice, closingPrice, avgClosingCost)
 * - Ratios (openingShortLongRatio, closingShortLongRatio)
 * - VIX values
 * - gap, movement
 */
export function scaleTradeByWeight(trade: Trade, weight: number): Trade {
  // Handle premium conversion: if in cents, convert to dollars
  // Weight scaling affects total exposure (via numContracts), not per-contract premium
  let scaledPremium = trade.premium
  let newPremiumPrecision = trade.premiumPrecision
  if (trade.premium !== undefined && trade.premiumPrecision === 'cents') {
    scaledPremium = trade.premium / 100  // Convert to dollars per contract
    newPremiumPrecision = 'dollars' as const
  }

  return {
    ...trade,
    // Scale monetary values
    pl: trade.pl * weight,
    fundsAtClose: trade.fundsAtClose * weight,
    marginReq: trade.marginReq * weight,
    openingCommissionsFees: trade.openingCommissionsFees * weight,
    closingCommissionsFees: trade.closingCommissionsFees * weight,
    // Scale quantity
    numContracts: trade.numContracts * weight,
    // Premium per contract stays the same (just converted from cents to dollars if needed)
    ...(scaledPremium !== undefined && {
      premium: scaledPremium,
      premiumPrecision: newPremiumPrecision,
    }),
    // NOTE: maxProfit and maxLoss are PERCENTAGES, not dollar amounts.
    // They represent % of initial premium and should NOT be scaled.
  };
}

/**
 * Merge trades from multiple blocks, scaling each by its weight,
 * and sort chronologically.
 *
 * @param tradesMap - Map of blockId to trades array
 * @param sourceBlocks - Source block references with weights
 * @returns Merged and scaled trades, sorted by dateOpened/timeOpened
 */
export function mergeAndScaleTrades(
  tradesMap: Record<string, Trade[]>,
  sourceBlocks: SourceBlockRef[]
): Trade[] {
  const allTrades: Trade[] = [];

  for (const source of sourceBlocks) {
    const trades = tradesMap[source.blockId];
    if (!trades) continue;

    for (const trade of trades) {
      allTrades.push(scaleTradeByWeight(trade, source.weight));
    }
  }

  // Sort chronologically
  return allTrades.sort((a, b) => {
    const dateA = new Date(a.dateOpened).getTime();
    const dateB = new Date(b.dateOpened).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return a.timeOpened.localeCompare(b.timeOpened);
  });
}

/**
 * Result of staleness check
 */
export interface StalenessResult {
  isStale: boolean;
  updatedBlocks: string[]; // Block IDs that have been updated since materialization
  missingBlocks: string[]; // Block IDs that no longer exist
}

/**
 * Check if a Mega Block needs to be refreshed.
 * Compares source block lastModified timestamps against recorded versions.
 *
 * @param megaBlock - The mega block to check
 * @param sourceBlocks - Current source blocks from database
 * @returns Staleness result with details
 */
export function checkMegaBlockStaleness(
  megaBlock: ProcessedBlock,
  sourceBlocks: ProcessedBlock[]
): StalenessResult {
  // Regular blocks are never stale
  if (!isMegaBlock(megaBlock)) {
    return { isStale: false, updatedBlocks: [], missingBlocks: [] };
  }

  const config = megaBlock.megaBlockConfig!;
  const updatedBlocks: string[] = [];
  const missingBlocks: string[] = [];

  // Build lookup map for current blocks
  const blockMap = new Map<string, ProcessedBlock>();
  for (const block of sourceBlocks) {
    blockMap.set(block.id, block);
  }

  // Check each source block
  for (const source of config.sourceBlocks) {
    const currentBlock = blockMap.get(source.blockId);

    if (!currentBlock) {
      missingBlocks.push(source.blockId);
      continue;
    }

    const recordedVersion = config.sourceBlockVersions[source.blockId];
    const currentVersion = new Date(currentBlock.lastModified).getTime();

    if (currentVersion > recordedVersion) {
      updatedBlocks.push(source.blockId);
    }
  }

  return {
    isStale: updatedBlocks.length > 0 || missingBlocks.length > 0,
    updatedBlocks,
    missingBlocks,
  };
}

/**
 * Input for building mega block data
 */
export interface BuildMegaBlockInput {
  name: string;
  description?: string;
  sourceBlocks: SourceBlockRef[];
  sourceBlocksData: ProcessedBlock[]; // Full block data for version tracking
  tradesMap: Record<string, Trade[]>; // blockId -> trades
}

/**
 * Result of building mega block data
 */
export interface MegaBlockBuildResult {
  block: Omit<ProcessedBlock, 'id' | 'created' | 'lastModified'>;
  trades: Trade[];
}

/**
 * Build the data for a new Mega Block.
 * Does NOT save to database - that's handled by the caller.
 *
 * @param input - Configuration and source data
 * @returns Block data and merged trades ready for storage
 */
export function buildMegaBlockData(input: BuildMegaBlockInput): MegaBlockBuildResult {
  const { name, description, sourceBlocks, sourceBlocksData, tradesMap } = input;

  // Merge and scale trades
  const trades = mergeAndScaleTrades(tradesMap, sourceBlocks);

  // Build source block versions map
  const sourceBlockVersions: Record<string, number> = {};
  for (const block of sourceBlocksData) {
    sourceBlockVersions[block.id] = new Date(block.lastModified).getTime();
  }

  // Calculate date range from merged trades
  let dateRange: { start: Date; end: Date } | undefined;
  if (trades.length > 0) {
    const dates = trades.map((t) => new Date(t.dateOpened).getTime());
    dateRange = {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
    };
  }

  // Build the block (without id, created, lastModified - those are added on save)
  const block: Omit<ProcessedBlock, 'id' | 'created' | 'lastModified'> = {
    name,
    description,
    isActive: false,
    tradeLog: {
      fileName: 'materialized-mega-block.csv',
      fileSize: 0, // Not a real file
      originalRowCount: trades.length,
      processedRowCount: trades.length,
      uploadedAt: new Date(),
    },
    dateRange,
    processingStatus: 'completed',
    dataReferences: {
      tradesStorageKey: '', // Will be set when saving
    },
    analysisConfig: {
      riskFreeRate: 2.0,
      useBusinessDaysOnly: true,
      annualizationFactor: 252,
      confidenceLevel: 0.95,
    },
    isMegaBlock: true,
    megaBlockConfig: {
      sourceBlocks,
      lastMaterializedAt: new Date(),
      sourceBlockVersions,
    },
  };

  return { block, trades };
}

/**
 * Create and save a Mega Block to the database.
 * This is the main entry point for creating mega blocks from the UI.
 *
 * @param config - Configuration for the mega block
 * @returns The created ProcessedBlock
 */
export async function saveMegaBlock(config: {
  name: string;
  description?: string;
  sourceBlocks: SourceBlockRef[];
}): Promise<ProcessedBlock> {
  const { name, description, sourceBlocks } = config;

  // Validate inputs
  if (!name || name.trim().length === 0) {
    throw new Error('Mega block name is required');
  }

  if (sourceBlocks.length < 2) {
    throw new Error('At least 2 source blocks are required');
  }

  // Load source block data and trades
  const sourceBlocksData: ProcessedBlock[] = [];
  const tradesMap: Record<string, Trade[]> = {};

  for (const source of sourceBlocks) {
    const block = await getBlock(source.blockId);
    if (!block) {
      throw new Error(`Source block not found: ${source.blockId}`);
    }
    sourceBlocksData.push(block);

    const trades = await getTradesByBlock(source.blockId);
    tradesMap[source.blockId] = trades;
  }

  // Build the mega block data
  const { block: blockData, trades: mergedTrades } = buildMegaBlockData({
    name: name.trim(),
    description,
    sourceBlocks,
    sourceBlocksData,
    tradesMap,
  });

  // Create the block in the database
  const createdBlock = await createBlock(blockData);

  // Add the merged trades with the new block's ID
  await addTrades(createdBlock.id, mergedTrades);

  return createdBlock;
}

/**
 * Result of loading mega block performance data.
 * Compatible with usePerformanceStore's data shape.
 */
export interface MegaBlockPerformanceData extends SnapshotChartData {
  trades: Trade[];
  allTrades: Trade[];
  allRawTrades: Trade[];
  portfolioStats: PortfolioStats | null;
  groupedLegOutcomes: GroupedLegOutcomes | null;
}

/**
 * Source block with sizing configuration for performance loading
 */
export interface SourceBlockInput {
  blockId: string;
  /** Direct weight multiplier (legacy mode) */
  weight?: number;
  /** Sizing configuration (new mode) */
  sizingConfig?: SizingConfig;
  /** Pre-computed stats for sizing calculations */
  stats?: BlockSizingStats;
}

/**
 * Input for loading mega block performance
 */
export interface LoadMegaBlockPerformanceInput {
  sourceBlocks: SourceBlockInput[];
  /** Portfolio capital for sizing calculations (required if using sizingConfig) */
  portfolioCapital?: number;
  normalizeTo1Lot?: boolean;
  riskFreeRate?: number;
}

/**
 * Load and compute performance data for a virtual mega block.
 * Merges trades from source blocks, scales by weights or sizing config, and builds
 * a complete performance snapshot suitable for all performance charts.
 *
 * This function does NOT save anything to the database - it computes
 * everything in memory for preview/analysis purposes.
 *
 * Supports two modes:
 * 1. Weight mode: Use `weight` property for direct multiplier
 * 2. Sizing mode: Use `sizingConfig` with `portfolioCapital` and `stats`
 *
 * @param input - Source blocks with weights/sizing and optional settings
 * @returns Performance data compatible with usePerformanceStore
 */
export async function loadMegaBlockPerformance(
  input: LoadMegaBlockPerformanceInput
): Promise<MegaBlockPerformanceData> {
  const {
    sourceBlocks,
    portfolioCapital = 100000,
    normalizeTo1Lot = false,
    riskFreeRate = 2.0,
  } = input;

  // Load trades from each source block
  const tradesMap: Record<string, Trade[]> = {};

  for (const source of sourceBlocks) {
    const trades = await getTradesByBlock(source.blockId);
    tradesMap[source.blockId] = trades;
  }

  // Process each block's trades based on sizing config
  // maxContracts uses per-trade normalization, others use block-wide scaling
  const { normalizeTradesToContracts } = await import('../utils/trade-normalization');
  const sourceBlockRefs: SourceBlockRef[] = [];

  for (const source of sourceBlocks) {
    let weight = 1.0;
    const config = source.sizingConfig;

    if (source.weight !== undefined) {
      // Legacy weight mode
      weight = source.weight;
    } else if (config?.maxContracts !== undefined && config.maxContracts > 0) {
      // Per-trade normalization for maxContracts
      // Normalize all trades in this block to target contract count
      const normalizedTrades = normalizeTradesToContracts(
        tradesMap[source.blockId],
        config.maxContracts
      );
      tradesMap[source.blockId] = normalizedTrades;
      // Weight is 1.0 since normalization already applied
      weight = 1.0;

      // If other constraints exist, apply them as additional scaling
      if (source.stats && (config.allocationPct !== undefined || config.maxAllocation !== undefined)) {
        // Create a config without maxContracts for additional scaling
        const additionalConfig = {
          allocationPct: config.allocationPct,
          maxAllocation: config.maxAllocation,
        };
        // Recalculate stats for normalized trades
        const normalizedStats = {
          ...source.stats,
          avgContracts: config.maxContracts, // After normalization, all trades have this count
          avgMargin: source.stats.avgMargin, // Margin per contract stays the same
        };
        weight = calculateBlockScaleFactor(normalizedStats, portfolioCapital, additionalConfig);
      }
    } else if (config && source.stats) {
      // Block-wide scaling for allocationPct and maxAllocation
      weight = calculateBlockScaleFactor(source.stats, portfolioCapital, config);
    }

    sourceBlockRefs.push({
      blockId: source.blockId,
      weight,
    });
  }

  // Merge and scale trades
  const mergedTrades = mergeAndScaleTrades(tradesMap, sourceBlockRefs);

  // Optionally normalize to 1 lot (applies after all other processing)
  let processedTrades = mergedTrades;
  if (normalizeTo1Lot) {
    const { normalizeTradesToOneLot } = await import('../utils/trade-normalization');
    processedTrades = normalizeTradesToOneLot(mergedTrades);
  }

  // CRITICAL: Recalculate fundsAtClose for merged trades.
  // Each trade's original fundsAtClose comes from its source block's equity curve,
  // which is meaningless for a combined portfolio. We need to rebuild the equity
  // curve starting from portfolioCapital using cumulative P/L.
  const sortedTrades = [...processedTrades].sort((a, b) => {
    const dateA = new Date(a.dateClosed ?? a.dateOpened).getTime();
    const dateB = new Date(b.dateClosed ?? b.dateOpened).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a.timeClosed || '').localeCompare(b.timeClosed || '');
  });

  let runningEquity = portfolioCapital;
  for (const trade of sortedTrades) {
    runningEquity += trade.pl;
    trade.fundsAtClose = runningEquity;
  }

  // Build performance snapshot (no daily logs for mega blocks)
  const snapshot = await buildPerformanceSnapshot({
    trades: sortedTrades,
    dailyLogs: [], // Trade-based calculations only
    riskFreeRate,
    normalizeTo1Lot: false, // Already normalized above if needed
  });

  // Derive grouped leg outcomes from raw trades
  const groupedLegOutcomes = deriveGroupedLegOutcomes(mergedTrades);

  return {
    trades: snapshot.filteredTrades,
    allTrades: sortedTrades,
    allRawTrades: mergedTrades,
    portfolioStats: snapshot.portfolioStats,
    groupedLegOutcomes,
    ...snapshot.chartData,
  };
}

/**
 * Calculate sizing statistics for a block.
 * Used for position sizing calculations in Portfolio Builder.
 *
 * Average margin is normalized to per-contract to allow fair comparison
 * between blocks tested with different position sizes.
 *
 * @param blockId - The block ID to calculate stats for
 * @returns Sizing statistics including avg margin per contract, avg contracts, win rate, RoM
 */
export async function getBlockSizingStats(blockId: string): Promise<BlockSizingStats> {
  const trades = await getTradesByBlock(blockId);

  if (trades.length === 0) {
    return {
      blockId,
      avgMargin: 0,
      avgContracts: 0,
      winRate: 0,
      avgRoM: 0,
      tradeCount: 0,
    };
  }

  // Calculate averages
  // For margin, normalize to per-contract to allow fair comparison
  // between blocks tested with different position sizes
  let totalMarginPerContract = 0;
  let marginTradeCount = 0;
  let totalContracts = 0;
  let totalRoM = 0;
  let winCount = 0;

  for (const trade of trades) {
    totalContracts += trade.numContracts;

    // Calculate margin per contract for this trade
    if (trade.numContracts > 0 && trade.marginReq > 0) {
      totalMarginPerContract += trade.marginReq / trade.numContracts;
      marginTradeCount++;
    }

    // Calculate return on margin for this trade
    if (trade.marginReq > 0) {
      totalRoM += (trade.pl / trade.marginReq) * 100;
    }

    if (trade.pl > 0) {
      winCount++;
    }
  }

  const tradeCount = trades.length;

  return {
    blockId,
    // Average margin per contract (normalized)
    avgMargin: marginTradeCount > 0 ? totalMarginPerContract / marginTradeCount : 0,
    avgContracts: totalContracts / tradeCount,
    winRate: winCount / tradeCount,
    avgRoM: totalRoM / tradeCount,
    tradeCount,
  };
}

/**
 * Calculate the scale factor for a block based on sizing constraints.
 * When multiple constraints are set, the most restrictive (smallest factor) wins.
 *
 * Note: stats.avgMargin is per-contract (normalized), so we calculate
 * target contracts from margin constraints and compare to historical avg contracts.
 *
 * @param stats - Block sizing statistics (avgMargin is per-contract)
 * @param portfolioCapital - Total portfolio capital
 * @param config - Sizing configuration with optional constraints
 * @returns Scale factor to apply to trades (1.0 = no scaling)
 */
export function calculateBlockScaleFactor(
  stats: BlockSizingStats,
  portfolioCapital: number,
  config: SizingConfig
): number {
  const factors: number[] = [];

  // % of capital constraint (margin-based)
  // targetMargin / avgMarginPerContract = target contracts
  // scale factor = target contracts / historical avg contracts
  if (config.allocationPct !== undefined && config.allocationPct > 0) {
    const targetMargin = portfolioCapital * (config.allocationPct / 100);
    if (stats.avgMargin > 0 && stats.avgContracts > 0) {
      const targetContracts = targetMargin / stats.avgMargin;
      factors.push(targetContracts / stats.avgContracts);
    }
  }

  // Max contracts constraint
  if (config.maxContracts !== undefined && config.maxContracts > 0) {
    if (stats.avgContracts > 0) {
      factors.push(config.maxContracts / stats.avgContracts);
    }
  }

  // Max allocation $ constraint
  // maxAllocation / avgMarginPerContract = max contracts
  // scale factor = max contracts / historical avg contracts
  if (config.maxAllocation !== undefined && config.maxAllocation > 0) {
    if (stats.avgMargin > 0 && stats.avgContracts > 0) {
      const maxContracts = config.maxAllocation / stats.avgMargin;
      factors.push(maxContracts / stats.avgContracts);
    }
  }

  // Use most restrictive (smallest) factor, default to 1.0 if no constraints
  return factors.length > 0 ? Math.min(...factors) : 1.0;
}
