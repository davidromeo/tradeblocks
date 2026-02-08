/**
 * Test exports for MCP server utilities
 *
 * This file re-exports functions needed for testing.
 * The main index.ts is an MCP server entry point that doesn't export these utilities.
 */

export {
  loadBlock,
  listBlocks,
  loadMetadata,
  saveMetadata,
  loadReportingLog,
  loadReportingLogStats,
  importCsv,
  type BlockInfo,
  type LoadedBlock,
  type BlockMetadata,
  type CsvMappings,
  type ImportCsvResult,
  type ImportCsvOptions,
} from './utils/block-loader.js';

// Export PortfolioStatsCalculator for testing block_diff logic
export { PortfolioStatsCalculator } from '@tradeblocks/lib';

// Export correlation and tail-risk utilities for testing strategy_similarity
export { calculateCorrelationMatrix, performTailRiskAnalysis } from '@tradeblocks/lib';

// Export sync layer for integration testing
export {
  syncAllBlocks,
  syncBlock,
  syncMarketData,
  type SyncResult,
  type MarketSyncResult,
  type BlockSyncResult,
} from './sync/index.js';

// Export DuckDB connection utilities for integration testing
export { getConnection, closeConnection, isConnected } from './db/connection.js';
