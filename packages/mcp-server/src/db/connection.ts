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
import { execFile } from "child_process";
import * as path from "path";
import { promisify } from "util";
import { ensureSyncTables, ensureTradeDataTable, ensureReportingDataTable, ensureMarketDataTables } from "./schemas.js";

// Module-level singleton state
let instance: DuckDBInstance | null = null;
let connection: DuckDBConnection | null = null;
let connectionMode: "read_write" | "read_only" | null = null;
const execFileAsync = promisify(execFile);

function isLockError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("could not set lock on file") ||
    lower.includes("conflicting lock is held") ||
    lower.includes("io error: could not set lock")
  );
}

function parseLockHolderPid(message: string): number | null {
  const match = message.match(/PID\s+(\d+)/i);
  if (!match) return null;
  const pid = Number.parseInt(match[1], 10);
  return Number.isFinite(pid) ? pid : null;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function getProcessCommand(pid: number): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="]);
    const command = stdout.trim();
    return command.length > 0 ? command : null;
  } catch {
    return null;
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return !isProcessAlive(pid);
}

async function tryRecoverLockByTerminatingStaleProcess(
  errorMessage: string,
  dbPath: string
): Promise<boolean> {
  const lockHolderPid = parseLockHolderPid(errorMessage);
  if (!lockHolderPid || lockHolderPid === process.pid) {
    return false;
  }

  const command = await getProcessCommand(lockHolderPid);
  if (!command) {
    return false;
  }

  // Only terminate lock holders that look like another tradeblocks-mcp session for this data dir.
  const normalizedDbPath = dbPath.replace(/\\/g, "/");
  const normalizedDbDir = path.dirname(normalizedDbPath);
  const isTradeblocksProcess =
    command.includes("tradeblocks-mcp") ||
    command.includes("/mcp-server/server/index.js") ||
    command.includes("packages/mcp-server/server/index.js");
  const targetsSameDb = command.includes(normalizedDbPath) || command.includes(normalizedDbDir);

  if (!isTradeblocksProcess || !targetsSameDb) {
    return false;
  }

  const timeoutMs = Number.parseInt(process.env.DUCKDB_LOCK_RECOVERY_TIMEOUT_MS || "1500", 10);

  try {
    process.kill(lockHolderPid, "SIGTERM");
  } catch {
    return false;
  }

  const exited = await waitForProcessExit(
    lockHolderPid,
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 1500
  );

  if (exited) {
    console.error(
      `Recovered DuckDB lock at ${dbPath} by stopping stale tradeblocks-mcp process PID ${lockHolderPid}.`
    );
  }

  return exited;
}

async function openReadWriteConnection(
  dbPath: string,
  threads: string,
  memoryLimit: string
): Promise<DuckDBConnection> {
  instance = await DuckDBInstance.create(dbPath, {
    threads,
    memory_limit: memoryLimit,
    enable_external_access: "false",
  });
  connection = await instance.connect();

  // Create schemas for organizing tables
  // trades schema: block data, trade records, daily logs
  // market schema: SPY prices, VIX data, market context
  await connection.run("CREATE SCHEMA IF NOT EXISTS trades");
  await connection.run("CREATE SCHEMA IF NOT EXISTS market");

  // Ensure sync metadata and data tables exist
  await ensureSyncTables(connection);
  await ensureTradeDataTable(connection);
  await ensureReportingDataTable(connection);
  await ensureMarketDataTables(connection);
  connectionMode = "read_write";

  return connection;
}

async function openReadOnlyConnection(
  dbPath: string,
  threads: string,
  memoryLimit: string
): Promise<DuckDBConnection> {
  instance = await DuckDBInstance.create(dbPath, {
    threads,
    memory_limit: memoryLimit,
    enable_external_access: "false",
    access_mode: "READ_ONLY",
  });
  connection = await instance.connect();
  connectionMode = "read_only";
  return connection;
}

function resetConnectionState(): void {
  connection = null;
  instance = null;
  connectionMode = null;
}

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
  const readOnlyFallbackEnabled = (process.env.DUCKDB_READONLY_FALLBACK ?? "true") !== "false";
  const lockRecoveryEnabled = (process.env.DUCKDB_LOCK_RECOVERY ?? "true") !== "false";

  try {
    return await openReadWriteConnection(dbPath, threads, memoryLimit);
  } catch (error) {
    // Provide clear error message for common issues
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Optional lock recovery: if another stale tradeblocks-mcp process is holding the DB lock,
    // terminate it and retry once in read-write mode.
    if (lockRecoveryEnabled && isLockError(errorMessage)) {
      const recovered = await tryRecoverLockByTerminatingStaleProcess(errorMessage, dbPath);
      if (recovered) {
        try {
          return await openReadWriteConnection(dbPath, threads, memoryLimit);
        } catch (recoveryError) {
          resetConnectionState();
          const recoveryMessage =
            recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
          throw new Error(
            `Failed to initialize DuckDB at ${dbPath} after lock recovery: ${recoveryMessage}`
          );
        }
      }
    }

    // Optional lock fallback: allow concurrent read access across multiple MCP processes
    if (readOnlyFallbackEnabled && isLockError(errorMessage)) {
      try {
        await openReadOnlyConnection(dbPath, threads, memoryLimit);

        console.error(
          `DuckDB lock detected at ${dbPath}; opened in READ_ONLY fallback mode. ` +
            `Sync/update operations will be skipped in this process.`
        );
        return connection as DuckDBConnection;
      } catch (readOnlyError) {
        // Fall through to normal error handling with the read-only failure context
        const readOnlyErrorMessage =
          readOnlyError instanceof Error ? readOnlyError.message : String(readOnlyError);
        resetConnectionState();
        throw new Error(
          `Failed to initialize DuckDB at ${dbPath}: ${errorMessage}. ` +
            `Read-only fallback also failed: ${readOnlyErrorMessage}`
        );
      }
    }

    // Reset state on failure
    resetConnectionState();

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
  connectionMode = null;
}

/**
 * Check if a connection is currently active.
 * Useful for diagnostics and testing.
 */
export function isConnected(): boolean {
  return connection !== null;
}

/**
 * Returns whether the active connection is in read-only fallback mode.
 * Useful for disabling sync/write operations when a lock conflict occurs.
 */
export function isReadOnlyConnection(): boolean {
  return connectionMode === "read_only";
}
