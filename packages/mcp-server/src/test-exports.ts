/**
 * Test exports for MCP server utilities
 *
 * This file re-exports functions needed for testing.
 * The main index.ts is an MCP server entry point that doesn't export these utilities.
 */

export {
  loadBlock,
  listBlocks,
  loadReportingLog,
  importCsv,
  type BlockInfo,
  type LoadedBlock,
  type CsvMappings,
  type ImportCsvResult,
  type ImportCsvOptions,
} from './utils/block-loader.js';

// Export CSV discovery utilities for unit testing (Phase 63)
export { detectCsvType, discoverCsvFiles, logCsvDiscoveryWarning, type CsvType } from './utils/csv-discovery.js';

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
  classifyTrendDirection,
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

// Export strategy profile types and CRUD functions for integration testing (Phase 60)
export type {
  StrategyProfile,
  StrategyProfileRow,
  LegDetail,
  EntryFilter,
  ExitRule,
  KeyMetrics,
  PositionSizing,
} from './models/strategy-profile.js';
export {
  ensureProfilesSchema,
  upsertProfile,
  getProfile,
  listProfiles,
  deleteProfile,
} from './db/profile-schemas.js';

// Export Phase 62 analysis utility modules for unit testing
export { computeSliceStats, type SliceStats } from './utils/analysis-stats.js';
export { buildFilterPredicate, type FilterPredicate } from './utils/filter-predicates.js';

// Export Phase 61 profile tool handlers and schemas for integration testing
export {
  handleProfileStrategy,
  handleGetStrategyProfile,
  handleListProfiles,
  handleDeleteProfile,
  profileStrategySchema,
  getStrategyProfileSchema,
  listProfilesSchema,
  deleteProfileSchema,
} from './tools/profiles.js';

// Export Phase 62 profile analysis tool handlers and schemas for integration testing
export {
  handleAnalyzeStructureFit,
  handleValidateEntryFilters,
  handlePortfolioStructureMap,
  analyzeStructureFitSchema,
  validateEntryFiltersSchema,
  portfolioStructureMapSchema,
} from './tools/profile-analysis.js';

// Export Phase 65 regime advisor tool handler and schema for integration testing
export {
  handleRegimeAllocationAdvisor,
  regimeAllocationAdvisorSchema,
} from './tools/regime-advisor.js';

// Export Massive.com API client utilities for unit testing (Phase 66)
export {
  fetchBars,
  toMassiveTicker,
  fromMassiveTicker,
  massiveTimestampToETDate,
  MassiveBarSchema,
  MassiveAggregateResponseSchema,
  MASSIVE_BASE_URL,
  MASSIVE_MAX_LIMIT,
  MASSIVE_MAX_PAGES,
  type MassiveBar,
  type MassiveAggregateResponse,
  type MassiveBarRow,
  type MassiveAssetClass,
  type FetchBarsOptions,
} from './utils/massive-client.js';
