/**
 * DuckDB module exports
 *
 * Provides connection management and schema definitions for the analytics database
 * (analytics.duckdb) and the market database (market.duckdb).
 */

export { getConnection, closeConnection, isConnected, upgradeToReadWrite, downgradeToReadOnly, getConnectionMode } from "./connection.js";
export {
  ensureSyncTables,
  ensureTradeDataTable,
  ensureReportingDataTable,
  tableExists,
} from "./schemas.js";
export { ensureMarketTables } from "./market-schemas.js";
