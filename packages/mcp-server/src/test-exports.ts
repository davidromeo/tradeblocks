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
  type SyncResult,
  type BlockSyncResult,
} from './sync/index.js';

// Export DuckDB connection utilities for integration testing
export { getConnection, closeConnection, isConnected } from './db/connection.js';

// Export shared filter utilities for testing
export {
  filterByStrategy,
  filterByDateRange,
  filterDailyLogsByDateRange,
} from './tools/shared/filters.js';

// Export field timing utilities for testing
export {
  OPEN_KNOWN_FIELDS,
  CLOSE_KNOWN_FIELDS,
  STATIC_FIELDS,
  DAILY_OPEN_FIELDS,
  DAILY_CLOSE_FIELDS,
  DAILY_STATIC_FIELDS,
  CONTEXT_OPEN_FIELDS,
  CONTEXT_CLOSE_FIELDS,
  buildLookaheadFreeQuery,
  buildOutcomeQuery,
} from './utils/field-timing.js';

// Export data availability helper for testing
export {
  checkDataAvailability,
  type DataAvailabilityReport,
} from './utils/data-availability.js';

// Export intraday timing utilities for testing (Plan 64-03)
export { computeIntradayTimingFields } from './utils/market-enricher.js';

// Export schema metadata for classification completeness tests
export { SCHEMA_DESCRIPTIONS } from './utils/schema-metadata.js';
export type { ColumnDescription } from './utils/schema-metadata.js';

// Export market import utilities for integration testing
export {
  validateColumnMapping,
  importMarketCsvFile,
  importFromDatabase,
  triggerEnrichment,
  type ImportMarketCsvOptions,
  type ImportFromDatabaseOptions,
  type ImportResult,
} from './utils/market-importer.js';

// Export Phase 60 market import metadata helpers for integration testing
export {
  type MarketImportMetadata,
  getMarketImportMetadata,
  upsertMarketImportMetadata,
} from './sync/metadata.js';

// Export Phase 62 market enricher indicator functions for unit testing
export {
  computeRSI,
  computeATR,
  computeEMA,
  computeSMA,
  computeBollingerBands,
  computeRealizedVol,
  computeConsecutiveDays,
  isGapFilled,
  isOpex,
  computeVIXDerivedFields,
  classifyVolRegime,
  classifyTermStructure,
  computeVIXPercentile,
  type BollingerBandRow,
  type ContextRow,
  type EnrichedContextRow,
} from './utils/market-enricher.js';

// Export market enrichment utilities for integration testing
export {
  runEnrichment,
  type EnrichmentResult,
  type EnrichmentOptions,
  type TierStatus,
} from './utils/market-enricher.js';
