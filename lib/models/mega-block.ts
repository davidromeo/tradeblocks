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
 * Configuration for creating a new Mega Block
 */
export interface CreateMegaBlockConfig {
  name: string;
  description?: string;
  sourceBlocks: SourceBlockRef[];
}
