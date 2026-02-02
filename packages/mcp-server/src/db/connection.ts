/**
 * DuckDB Connection Manager
 *
 * Provides lazy singleton connection to DuckDB analytics database.
 * The connection is created on first getConnection() call and reused
 * for subsequent calls until closeConnection() is called.
 *
 * Configuration via environment variables:
 *   DUCKDB_MEMORY_LIMIT - Memory limit (default: 512MB)
 *   DUCKDB_THREADS      - Number of threads (default: 2)
 *
 * Security:
 *   - enable_external_access is disabled to prevent remote URL fetching
 *   - This setting self-locks when disabled
 *
 * Schemas created on first connection:
 *   - trades: For block/trade data
 *   - market: For market data (SPY, VIX, etc.)
 */

import { DuckDBInstance, DuckDBConnection } from "@duckdb/node-api";
import * as path from "path";
import { ensureSyncTables, ensureTradeDataTable, ensureMarketDataTables } from "./schemas.js";

// Module-level singleton state
let instance: DuckDBInstance | null = null;
let connection: DuckDBConnection | null = null;

/**
 * Get or create a DuckDB connection.
 *
 * On first call:
 *   - Creates DuckDBInstance at `<dataDir>/analytics.duckdb`
 *   - Applies memory, thread, and security configuration
 *   - Creates 'trades' and 'market' schemas
 *   - Stores connection for reuse
 *
 * Subsequent calls return the existing connection.
 *
 * @param dataDir - Directory where analytics.duckdb will be stored
 * @returns Promise<DuckDBConnection> - The DuckDB connection
 * @throws Error if database is corrupted or cannot be opened
 */
export async function getConnection(dataDir: string): Promise<DuckDBConnection> {
  // Return existing connection if available (singleton pattern)
  if (connection) {
    return connection;
  }

  const dbPath = path.join(dataDir, "analytics.duckdb");

  // Configuration from environment with sensible defaults
  const threads = process.env.DUCKDB_THREADS || "2";
  const memoryLimit = process.env.DUCKDB_MEMORY_LIMIT || "512MB";

  try {
    // Create DuckDB instance with configuration
    // enable_external_access: false prevents DuckDB from fetching remote URLs
    // This is a security measure that self-locks when disabled
    instance = await DuckDBInstance.create(dbPath, {
      threads,
      memory_limit: memoryLimit,
      enable_external_access: "false",
    });

    // Establish connection
    connection = await instance.connect();

    // Create schemas for organizing tables
    // trades schema: block data, trade records, daily logs
    // market schema: SPY prices, VIX data, market context
    await connection.run("CREATE SCHEMA IF NOT EXISTS trades");
    await connection.run("CREATE SCHEMA IF NOT EXISTS market");

    // Ensure sync metadata and data tables exist
    await ensureSyncTables(connection);
    await ensureTradeDataTable(connection);
    await ensureMarketDataTables(connection);

    return connection;
  } catch (error) {
    // Reset state on failure
    connection = null;
    instance = null;

    // Provide clear error message for common issues
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for corruption indicators
    if (
      errorMessage.includes("corrupt") ||
      errorMessage.includes("Invalid") ||
      errorMessage.includes("cannot open")
    ) {
      throw new Error(
        `DuckDB database appears corrupted at ${dbPath}. ` +
          `Please delete the file manually and restart. ` +
          `Original error: ${errorMessage}`
      );
    }

    throw new Error(`Failed to initialize DuckDB at ${dbPath}: ${errorMessage}`);
  }
}

/**
 * Close the DuckDB connection and release resources.
 *
 * Should be called during graceful shutdown (SIGINT, SIGTERM).
 * Safe to call multiple times or when no connection exists.
 */
export async function closeConnection(): Promise<void> {
  if (connection) {
    try {
      // closeSync is the synchronous close method for DuckDB connections
      connection.closeSync();
    } catch (error) {
      // Log but don't throw during shutdown
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Warning: Error closing DuckDB connection: ${msg}`);
    }
    connection = null;
  }

  // Clear instance reference
  // DuckDB instance doesn't have explicit close - releasing reference is sufficient
  instance = null;
}

/**
 * Check if a connection is currently active.
 * Useful for diagnostics and testing.
 */
export function isConnected(): boolean {
  return connection !== null;
}
