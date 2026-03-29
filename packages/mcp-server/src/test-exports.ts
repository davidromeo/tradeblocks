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
  importFromApi,
  triggerEnrichment,
  type ImportMarketCsvOptions,
  type ImportFromDatabaseOptions,
  type ImportFromApiOptions,
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
  computeRealizedVol,
  computeConsecutiveDays,
  isGapFilled,
  isOpex,
  computeVIXDerivedFields,
  classifyVolRegime,
  classifyTrendDirection,
  classifyTermStructure,
  computeIVR,
  computeIVP,
  type ContextRow,
  type EnrichedContextRow,
} from './utils/market-enricher.js';

// Export market enrichment utilities for integration testing
export {
  runEnrichment,
  runContextEnrichment,
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

// Export market data provider interface and types
export {
  getProvider,
  _resetProvider,
  type BarRow,
  type AssetClass,
  type OptionContract,
  type FetchBarsOptions,
  type FetchSnapshotOptions,
  type FetchSnapshotResult,
  type MarketDataProvider,
} from './utils/market-provider.js';

// Export Massive provider internals for provider-specific tests
export {
  MassiveProvider,
  toMassiveTicker,
  fromMassiveTicker,
  massiveTimestampToETDate,
  massiveTimestampToETTime,
  nanosToETMinuteKey,
  MassiveBarSchema,
  MassiveAggregateResponseSchema,
  MassiveQuoteSchema,
  MassiveQuotesResponseSchema,
  MASSIVE_BASE_URL,
  MASSIVE_MAX_LIMIT,
  MASSIVE_MAX_PAGES,
  type MassiveBar,
  type MassiveAggregateResponse,
  type MassiveQuote,
  type MassiveQuotesResponse,
} from './utils/providers/massive.js';

// Export trade replay utilities for unit testing (Phase 68)
export {
  parseLegsString,
  buildOccTicker,
  computeStrategyPnlPath,
  computeReplayMfeMae,
  findNearestTimestamp,
  markPrice,
  type ReplayLeg,
  type ReplayResult,
  type PnlPoint,
  type ParsedLeg,
  type ParsedLegOO,
  type GreeksConfig,
} from './utils/trade-replay.js';

// Export trade replay tool handler and schema for integration testing (Phase 68)
export {
  handleReplayTrade,
  replayTradeSchema,
  resolveOODateRange,
} from './tools/replay.js';

// Export Black-Scholes and Bachelier greeks computation for unit testing (Phase 69 / Phase 73-01)
export {
  pdf,
  cdf,
  bsPrice,
  bsDelta,
  bsGamma,
  bsTheta,
  bsVega,
  solveIV,
  bachelierPrice,
  bachelierDelta,
  bachelierGamma,
  bachelierTheta,
  bachelierVega,
  solveNormalIV,
  BACHELIER_DTE_THRESHOLD,
  computeLegGreeks,
  type GreeksResult,
} from './utils/black-scholes.js';

// Export Massive snapshot schemas for unit testing (Phase 70)
export {
  MassiveSnapshotResponseSchema,
  MassiveSnapshotContractSchema,
} from './utils/providers/massive.js';

// Export snapshot tool handler and schema for integration testing (Phase 70)
export {
  handleGetOptionSnapshot,
  getOptionSnapshotSchema,
} from './tools/snapshot.js';

// Export greeks decomposition utilities for unit testing (Phase 71)
export {
  decomposeGreeks,
  computeTimeDeltaDays,
  type GreeksDecompositionConfig,
  type GreeksDecompositionResult,
  type FactorContribution,
  type LegGroupVega,
  type LegGroupDef,
  type FactorName,
} from './utils/greeks-decomposition.js';

// Export exit trigger analysis utilities for unit testing (Phase 71)
export {
  evaluateTrigger,
  analyzeExitTriggers,
  type ExitTriggerConfig,
  type ExitTriggerResult,
  type TriggerFireEvent,
  type TriggerType,
  type LegGroupConfig,
  type LegGroupResult,
} from './utils/exit-triggers.js';

// Export exit analysis tool handlers and schemas for integration testing (Phase 71)
export {
  handleAnalyzeExitTriggers,
  handleDecomposeGreeks,
  analyzeExitTriggersSchema,
  decomposeGreeksSchema,
} from './tools/exit-analysis.js';

// Export batch exit analysis engine for unit testing (Phase 72)
export {
  analyzeBatch,
  computeAggregateStats,
  computeTriggerAttribution,
  type BatchExitConfig,
  type BatchExitResult,
  type TradeExitResult,
  type TradeInput,
  type AggregateStats,
  type TriggerAttribution,
  type BaselineMode,
} from './utils/batch-exit-analysis.js';

// Export batch exit analysis tool handler and schema for integration testing (Phase 72)
export {
  handleBatchExitAnalysis,
  batchExitAnalysisSchema,
} from './tools/batch-exit-analysis.js';

// Export shared bar fetch+cache utility for unit testing (Phase 74-02)
export {
  fetchBarsWithCache,
  type FetchBarsWithCacheOptions,
} from './utils/bar-cache.js';
