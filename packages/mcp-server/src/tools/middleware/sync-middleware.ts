/**
 * Sync Middleware
 *
 * Higher-order functions that wrap MCP tool handlers with automatic
 * sync-before-query behavior. Eliminates sync boilerplate from tools.
 */

import {
  syncBlock,
  syncAllBlocks,
  syncMarketData,
  type BlockSyncResult,
  type SyncResult,
  type MarketSyncResult,
} from "../../sync/index.js";

// MCP tool response types
interface ToolError {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
}

export interface SingleBlockContext {
  syncResult: BlockSyncResult;
  baseDir: string;
}

export interface MultiBlockContext {
  syncResults: Map<string, BlockSyncResult>;
  baseDir: string;
}

export interface FullSyncContext {
  blockSyncResult: SyncResult;
  marketSyncResult: MarketSyncResult;
  baseDir: string;
}

/**
 * Middleware for tools that operate on a single block.
 * Syncs the block before calling the handler.
 * Returns error response if block was deleted.
 */
export function withSyncedBlock<TInput extends { blockId: string }, TOutput>(
  baseDir: string,
  handler: (input: TInput, ctx: SingleBlockContext) => Promise<TOutput>
): (input: TInput) => Promise<TOutput | ToolError> {
  return async (input: TInput) => {
    const syncResult = await syncBlock(input.blockId, baseDir);

    if (syncResult.status === "deleted") {
      return {
        content: [
          {
            type: "text" as const,
            text: `Block '${input.blockId}' no longer exists (folder was deleted)`,
          },
        ],
        isError: true as const,
      };
    }

    if (syncResult.status === "error" && syncResult.error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Sync error for block '${input.blockId}': ${syncResult.error}`,
          },
        ],
        isError: true as const,
      };
    }

    return handler(input, { syncResult, baseDir });
  };
}

/**
 * Middleware for tools that compare multiple blocks.
 * Syncs all specified blocks before calling the handler.
 * Returns error response if any block was deleted.
 */
export function withSyncedBlocks<
  TInput extends { blockIds?: string[]; blockIdA?: string; blockIdB?: string },
  TOutput,
>(
  baseDir: string,
  handler: (input: TInput, ctx: MultiBlockContext) => Promise<TOutput>
): (input: TInput) => Promise<TOutput | ToolError> {
  return async (input: TInput) => {
    // Collect block IDs from various input patterns
    const blockIds: string[] =
      input.blockIds ??
      [input.blockIdA, input.blockIdB].filter((id): id is string => !!id);

    const syncResults = new Map<string, BlockSyncResult>();

    for (const blockId of blockIds) {
      const result = await syncBlock(blockId, baseDir);
      syncResults.set(blockId, result);

      if (result.status === "deleted") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Block '${blockId}' no longer exists (folder was deleted)`,
            },
          ],
          isError: true as const,
        };
      }

      if (result.status === "error" && result.error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Sync error for block '${blockId}': ${result.error}`,
            },
          ],
          isError: true as const,
        };
      }
    }

    return handler(input, { syncResults, baseDir });
  };
}

/**
 * Middleware for tools that need a full sync of all blocks and market data.
 * Used by list_blocks which needs to see all available blocks.
 */
export function withFullSync<TInput, TOutput>(
  baseDir: string,
  handler: (input: TInput, ctx: FullSyncContext) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput) => {
    const blockSyncResult = await syncAllBlocks(baseDir);
    const marketSyncResult = await syncMarketData(baseDir);

    return handler(input, { blockSyncResult, marketSyncResult, baseDir });
  };
}
