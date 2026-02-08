/**
 * DuckDB module exports
 *
 * Provides connection management and schema definitions for the analytics database.
 */

export { getConnection, closeConnection, isConnected, isReadOnlyConnection } from "./connection.js";
export {
  ensureSyncTables,
  ensureTradeDataTable,
  ensureReportingDataTable,
  ensureMarketDataTables,
} from "./schemas.js";
