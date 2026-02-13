/**
 * DuckDB module exports
 *
 * Provides connection management and schema definitions for the analytics database.
 */

export { getConnection, closeConnection, isConnected, upgradeToReadWrite, downgradeToReadOnly, getConnectionMode } from "./connection.js";
export {
  ensureSyncTables,
  ensureTradeDataTable,
  ensureReportingDataTable,
  ensureMarketDataTables,
} from "./schemas.js";
