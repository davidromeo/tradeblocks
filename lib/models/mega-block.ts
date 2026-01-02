// lib/models/mega-block.ts
import { ProcessedBlock } from './block';

/**
 * Type guard to check if a block is a Mega Block
 */
export function isMegaBlock(block: ProcessedBlock): boolean {
  return block.isMegaBlock === true && block.megaBlockConfig !== undefined;
}

/**
 * Get source block IDs from a Mega Block
 */
export function getMegaBlockSourceIds(block: ProcessedBlock): string[] {
  if (!isMegaBlock(block)) return [];
  return block.megaBlockConfig!.sourceBlocks.map((s) => s.blockId);
}

/**
 * Get total weight across all source blocks
 */
export function getMegaBlockTotalWeight(block: ProcessedBlock): number {
  if (!isMegaBlock(block)) return 0;
  return block.megaBlockConfig!.sourceBlocks.reduce((sum, s) => sum + s.weight, 0);
}

/**
 * Source block reference with weight
 */
export interface SourceBlockRef {
  blockId: string;
  weight: number;
}

/**
 * Position sizing configuration for a block in a mega block.
 * Multiple constraints can be set - the most restrictive (smallest scale factor) wins.
 */
export interface SizingConfig {
  /** Target allocation as % of portfolio capital (margin-based) */
  allocationPct?: number;
  /** Maximum contracts per trade */
  maxContracts?: number;
  /** Maximum margin allocation in dollars per trade */
  maxAllocation?: number;
}

/**
 * Statistics used for position sizing calculations
 */
export interface BlockSizingStats {
  blockId: string;
  /** Average margin requirement across all trades */
  avgMargin: number;
  /** Average number of contracts per trade */
  avgContracts: number;
  /** Win rate (0-1) */
  winRate: number;
  /** Average return on margin (percentage) */
  avgRoM: number;
  /** Total number of trades */
  tradeCount: number;
}

/**
 * Extended source block reference with sizing configuration
 */
export interface SourceBlockWithSizing {
  blockId: string;
  name: string;
  sizingConfig: SizingConfig;
  stats?: BlockSizingStats;
  /** Computed scale factor based on sizing config and portfolio capital */
  computedScaleFactor?: number;
}

/**
 * Configuration for creating a new Mega Block
 */
export interface CreateMegaBlockConfig {
  name: string;
  description?: string;
  sourceBlocks: SourceBlockRef[];
}
