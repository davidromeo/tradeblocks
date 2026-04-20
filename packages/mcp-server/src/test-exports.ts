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
export { getConnection, closeConnection, isConnected, getConnectionMode, upgradeToReadWrite, downgradeToReadOnly, getCurrentConnection } from './db/connection.js';
export { setDataRoot, getDataRoot, resetDataRoot } from './db/data-root.js';
export {
  resolveCanonicalMarketFile,
  resolveCanonicalMarketPartitionDir,
  resolveCanonicalMarketPartitionPath,
  resolveCanonicalMarketPartitionFile,
  canonicalMarketTableName,
} from './db/market-datasets.js';

// Export market schema utilities for integration testing
export { ensureMutableMarketTables, ensureMarketDataTables } from './db/market-schemas.js';

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
  buildVixJoinClause,
} from './utils/field-timing.js';

// Export data availability helper for testing
export {
  checkDataAvailability,
  type DataAvailabilityReport,
} from './utils/data-availability.js';
export {
  queryCoverage,
  scoreDataQuality,
  formatCoverageReport,
  type DataQualityInput,
  type CoverageResult,
} from './utils/data-quality.js';

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
  parseCsvToBars,
  parseDatabaseRowsToBars,
  type ImportMarketCsvParams,
  type ImportFromDatabaseParams,
  type ImportSpotResult,
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
export {
  resolveMassiveDataTier,
  resolveProviderCapabilities,
  getResolvedProviderCapabilities,
  type MassiveDataTier,
  type ResolvedProviderCapabilities,
} from './utils/provider-capabilities.js';

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

// Export parquet-writer utility functions for unit testing (Phase 02-01)
export { isParquetMode, writeParquetAtomic, writeParquetPartition, resolveMarketDir } from './db/parquet-writer.js';

// Export json-store utility for unit testing (Phase 03-01)
export {
  readJsonFile,
  writeJsonFile,
  deleteJsonFile,
  listJsonFiles,
  toFileSlug,
} from './db/json-store.js';

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

// Export shared bar fetch+cache utility for unit testing.
//
// Phase 4 / D-05 / SEP-01: `fetchBarsWithCache` is now CACHE-ONLY (no API
// fallback) — the provider-side enrichment helper has been removed. The
// remaining symbols stay re-exported until plans 04-02 (replay.ts +
// market-data-loader.ts) and 04-04 (orchestrator + quote-minute-cache)
// finish migrating their callers; at that point this entire block goes
// away along with `utils/bar-cache.ts` itself.
export {
  fetchBarsWithCache,
  type FetchBarsWithCacheOptions,
  mergeQuoteBars,
  getDataTier,
  readCachedBars,
  fetchEntryBarsForCandidates,
  fetchBarsForLegsBulk,
  type DataTier,
  type ReadCachedBarsOptions,
} from './utils/bar-cache.js';

// Export quote enricher pure functions for unit testing
export { shouldSkipEnrichment, buildEnrichmentPlan } from './utils/quote-enricher.js';
export type { EnrichmentPlanInput } from './utils/quote-enricher.js';

// Contract selector pure functions (unit testing)
export {
  selectByDelta,
  selectByOtmPct,
  selectAtm,
  selectByFixedPremium,
  selectByOffset,
  selectStrike,
} from './utils/contract-selector.js';
export type { SelectionOptions, SelectionResult } from './utils/contract-selector.js';

// Greeks attribution (v2.3)
export {
  collapseFactors,
  computeAttribution,
  computeGrossAttributionFlow,
  assessPrecision,
  type AttributionEntry,
  type AttributionSummaryResult,
  type AttributionInstanceResult,
  type AttributionStepEntry,
} from './tools/greeks-attribution.js';

export {
  handleGetGreeksAttribution,
  getGreeksAttributionSchema,
  filterSparseSteps,
} from './tools/greeks-attribution.js';

// Export json-adapters for integration testing (Phase 03-01)
export {
  upsertProfileJson,
  getProfileJson,
  listProfilesJson,
  deleteProfileJson,
  getSyncMetadataJson,
  upsertSyncMetadataJson,
  deleteSyncMetadataJson,
  getAllSyncedBlockIdsJson,
  getMarketImportMetadataJson,
  upsertMarketImportMetadataJson,
  getFlatImportLogJson,
  upsertFlatImportLogJson,
} from './db/json-adapters.js';
export type { FlatImportLogEntry } from './db/json-adapters.js';

// Export json-migration for integration testing (Phase 03-03)
export { migrateMetadataToJson, type MigrationResult } from './db/json-migration.js';

// ============================================================================
// Market Data 3.0 — Phase 1 exports (MUST appear BEFORE the ext.ts wildcard below)
//
// Per CONTEXT.md D-19: all Phase 1 modules are SHARED code; they re-export here.
// Adding new symbols AFTER the `export * from './test-exports.ext.js'` line
// silently masks them (RESEARCH.md Pitfall 9).
// ============================================================================

// Store interfaces + factory (Plan 01)
export {
  SpotStore,
  EnrichedStore,
  ChainStore,
  QuoteStore,
  createMarketStores,
} from './market/stores/index.js';
export type {
  StoreContext,
  MarketStores,
  EnrichedReadOpts,
  QuoteRow,
  CoverageReport,
} from './market/stores/index.js';
export type { BarRow as MarketStoreBarRow, ContractRow } from './market/stores/index.js';

// Ticker registry + resolver + loader + schemas (Plan 02)
export { extractRoot, rootToUnderlying } from './market/tickers/resolver.js';
export { TickerRegistry } from './market/tickers/registry.js';
export type { TickerEntry, EntrySource } from './market/tickers/registry.js';
export { loadRegistry, saveUserOverride } from './market/tickers/loader.js';
export {
  UnderlyingsFileSchema,
  registerUnderlyingSchema,
  unregisterUnderlyingSchema,
  listUnderlyingsSchema,
  resolveRootSchema,
  TICKER_RE,
} from './market/tickers/schemas.js';

// Parquet writer new multi-level options type (Plan 03)
// Note: the existing value-level parquet-writer re-exports above at line ~277
// already cover the runtime symbols; here we only add the new type alias for
// the multi-level overload so tests can type-check against the V3 shape.
export type { WriteParquetPartitionOptsV3 } from './db/parquet-writer.js';

// 3.0 Dataset registry + per-dataset helpers (Plan 04)
export {
  DATASETS_V3,
  writeSpotPartition,
  writeChainPartition,
  writeQuoteMinutesPartition,
  writeEnrichedTickerFile,
  writeEnrichedContext,
} from './db/market-datasets.js';
export type { DatasetDef } from './db/market-datasets.js';

// Ticker MCP tool handlers (Plan 05) — schemas re-exported from tickers/schemas.ts above
export {
  registerTickerTools,
  handleRegisterUnderlying,
  handleUnregisterUnderlying,
  handleListUnderlyings,
  handleResolveRoot,
} from './tools/tickers.js';

// ============================================================================
// End of Phase 1 block
// ============================================================================

// ============================================================================
// Market Data 3.0 — Phase 2 Wave 1 exports (pure helpers + watermark adapter)
//
// Wave 1 deliverables: pure SQL builders, RTH aggregation helper, partition
// enumerator, and the enrichment watermark JSON adapter. Concrete store
// classes ship in Waves 2-3 and will re-export below in later plans.
//
// MUST appear BEFORE the './test-exports.ext.js' wildcard (Pitfall 10).
// ============================================================================

// Pure SQL builders (Plan 02-01)
export {
  buildReadBarsSQL,
  buildReadDailyBarsSQL,
  buildReadRthOpensSQL,
} from './market/stores/spot-sql.js';
export type { BuiltSQL } from './market/stores/spot-sql.js';
export { buildReadEnrichedSQL } from './market/stores/enriched-sql.js';
export type { BuildReadEnrichedArgs } from './market/stores/enriched-sql.js';
export { buildReadChainSQL } from './market/stores/chain-sql.js';
export { buildReadQuotesSQL } from './market/stores/quote-sql.js';
export { rthDailyAggregateSubquery } from './market/stores/rth-aggregation.js';
export type { RthWindowOpts } from './market/stores/rth-aggregation.js';

// Shared coverage helper (Plan 02-01)
export { listPartitionValues } from './market/stores/coverage.js';

// Enrichment watermark adapter (Plan 02-01)
export {
  EnrichmentWatermarksSchema,
  loadEnrichmentWatermarks,
  getEnrichedThrough,
  upsertEnrichedThrough,
} from './db/json-adapters.js';
export type { EnrichmentWatermarks } from './db/json-adapters.js';

// Schema ensure functions (consumed by Plan 02-02 schemas.test.ts and views.test.ts).
// These functions exist today in src/db/market-schemas.ts; Plan 02-02 modifies their
// bodies (removes data_coverage CREATE, adds spot/enriched tables, drops+recreates
// option_quote_minutes). They are already re-exported earlier in this file (see
// the `ensureMutableMarketTables, ensureMarketDataTables` line near the top); we
// intentionally do NOT re-export them here to avoid duplicate-export errors. Plan
// 02-02 will rely on the existing top-of-file export.

// ============================================================================
// End of Phase 2 Wave 1 block
// ============================================================================

// ============================================================================
// Market Data 3.0 — Phase 2 Wave 2 exports (concrete Spot/Chain/Quote stores)
//
// Concrete classes ship one task at a time per Plan 02-03. Each task's
// subset of exports is added here so tests can import the concrete class
// names directly via `../../../src/test-exports.js`.
//
// MUST appear BEFORE the './test-exports.ext.js' wildcard (Pitfall 10).
// ============================================================================

// Concrete Spot store pair (Plan 02-03 Task 1)
export { ParquetSpotStore } from './market/stores/parquet-spot-store.js';
export { DuckdbSpotStore } from './market/stores/duckdb-spot-store.js';

// Concrete Chain store pair (Plan 02-03 Task 2)
export { ParquetChainStore } from './market/stores/parquet-chain-store.js';
export { DuckdbChainStore } from './market/stores/duckdb-chain-store.js';

// Concrete Quote store pair (Plan 02-03 Task 3)
export { ParquetQuoteStore } from './market/stores/parquet-quote-store.js';
export { DuckdbQuoteStore } from './market/stores/duckdb-quote-store.js';

// ============================================================================
// End of Phase 2 Wave 2 block
// ============================================================================

// ============================================================================
// Market Data 3.0 — Phase 2 Wave 3 exports (concrete Enriched stores)
//
// Plan 02-04 delivers the EnrichedStore pair as thin wrappers around the
// existing runEnrichment pipeline (D-14 / D-15). Both classes extend the
// Phase 1 abstract EnrichedStore and accept an injected SpotStore in their
// constructors so that the enricher's IO boundaries (minute-bar reads,
// watermark get/upsert) are satisfied without reimplementing the math.
//
// MUST appear BEFORE the './test-exports.ext.js' wildcard (Pitfall 10).
// ============================================================================

// Concrete Enriched store pair (Plan 02-04 Task 2)
export { ParquetEnrichedStore } from './market/stores/parquet-enriched-store.js';
export { DuckdbEnrichedStore } from './market/stores/duckdb-enriched-store.js';

// ============================================================================
// End of Phase 2 Wave 3 block
// ============================================================================

// ============================================================================
// Market Data 3.0 — Ingestor exports (Plan 01-06)
//
// Market ingestor class + types exposed for integration tests that import from dist/
// ============================================================================

// Market ingestor — exposed for integration tests that import from dist/
export { MarketIngestor } from "./market/ingestor/index.js";
export type { MarketIngestorDeps } from "./market/ingestor/index.js";
export type {
  IngestStatus,
  IngestResult,
  IngestBarsOptions,
  IngestQuotesOptions,
  IngestChainOptions,
  IngestFlatFileOptions,
  ComputeVixContextOptions,
  RefreshOptions,
  RefreshResult,
} from "./market/ingestor/index.js";

// ============================================================================
// End of Ingestor block
// ============================================================================

// ============================================================================
// Market Data 3.0 — Phase 3 exports (migration helpers)
//
// Plan 03-01 delivers pure helpers for the in-place option-data migration script.
// The .mjs script itself is NOT re-exported (CONTEXT.md D-26 — scripts with
// filesystem effects cannot be unit-tested cleanly via test-exports; unit tests
// target the pure helpers).
//
// MUST appear BEFORE the './test-exports.ext.js' wildcard (RESEARCH §Pitfall 7).
// ============================================================================

export {
  groupTickersByUnderlying,
  buildOptionChainSelectQuery,
  buildOptionQuoteSelectQuery,
  LEVERAGED_ETFS,
} from './utils/migrate-option-data-helpers.js';
export type { GroupResult } from './utils/migrate-option-data-helpers.js';

// ============================================================================
// End of Phase 3 block
// ============================================================================

// ============================================================================
// Market Data 3.0 — Phase 4 exports (Consumer Migration)
//
// RESOLVE-02: Tool Dependency Registry
// SEP-01: pipeline-side backfill helper (plan 04-06)
//
// MUST appear BEFORE the './test-exports.ext.js' wildcard (PATTERNS.md Pattern 6 / Pitfall 10).
// ============================================================================
export { TOOL_TICKER_DEPS, unionTickerDeps } from './utils/tool-ticker-deps.js';
// ============================================================================

// ============================================================================
// Market Data 3.0 — Phase 5 exports (Spot Backfill + Enrichment Rebuild)
//
// D-17/D-19: verification helper, sample-date selector, calibration probe.
// MUST appear BEFORE the './test-exports.ext.js' wildcard (PATTERNS.md Pitfall 10).
// ============================================================================
export {
  selectVerificationSampleDates,
  PHASE_5_FIXTURE_SEED,
  PHASE_5_KNOWN_EVENTS,
  PHASE_5_STRUCTURAL_DATES,
} from './utils/sample-date-selector.js';
export type { SampleDate } from './utils/sample-date-selector.js';
export {
  compareFields,
  compareRow,
  DOUBLE_EPSILON,
  ENRICHED_FIELD_TYPES,
  CONTEXT_FIELD_TYPES,
} from './utils/enrichment-verification.js';
export type {
  FieldType,
  FieldDiff,
  RowDiff,
} from './utils/enrichment-verification.js';
export { calibrateProviderFetch } from './utils/calibration-probe.js';
// ============================================================================

// Extension point: additional test exports provided by the optional private extension.
export * from './test-exports.ext.js';
