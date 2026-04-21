/**
 * DuckDB module exports
 *
 * Provides connection management and schema definitions for the analytics database
 * (analytics.duckdb) and the market database (market.duckdb).
 */

export { getConnection, closeConnection, isConnected, upgradeToReadWrite, downgradeToReadOnly, getConnectionMode, getCurrentConnection } from "./connection.js";
export {
  ensureSyncTables,
  ensureTradeDataTable,
  ensureReportingDataTable,
  tableExists,
} from "./schemas.js";
export { ensureMutableMarketTables, ensureMarketDataTables } from "./market-schemas.js";
export { ensureProfilesSchema, upsertProfile, getProfile, listProfiles, deleteProfile } from "./profile-schemas.js";
export { isParquetMode, writeParquetAtomic, writeParquetPartition, resolveMarketDir } from "./parquet-writer.js";
export {
  resolveCanonicalMarketFile,
  resolveCanonicalMarketPartitionDir,
  resolveCanonicalMarketPartitionPath,
  resolveCanonicalMarketPartitionFile,
  canonicalMarketTableName,
} from "./market-datasets.js";
export { readJsonFile, writeJsonFile, deleteJsonFile, listJsonFiles, toFileSlug } from "./json-store.js";
