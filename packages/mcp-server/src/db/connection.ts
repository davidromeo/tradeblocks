/**
 * DuckDB Connection Manager
 *
 * Provides lazy singleton connection to DuckDB analytics database.
 * The connection is created on first getConnection() call and reused
 * for subsequent calls until closeConnection() is called.
 *
 * DuckDB is single-process: only one process can open a database file at a time
 * (even read-only fails when another process holds a write lock with an active WAL).
 * Lock recovery handles stale processes from crashed Claude Code sessions by detecting
 * orphaned MCP processes (PPID=1) and terminating them before retrying.
 *
 * Configuration via environment variables:
 *   DUCKDB_MEMORY_LIMIT - Memory limit (default: 512MB)
 *   DUCKDB_THREADS      - Number of threads (default: 2)
 *   DUCKDB_LOCK_RECOVERY - Force-kill ANY lock-holding tradeblocks-mcp (default: false)
 *   DUCKDB_LOCK_RECOVERY_TIMEOUT_MS - Wait time for SIGTERM (default: 1500)
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
let storedDbPath: string | null = null;
let storedThreads: string | null = null;
let storedMemoryLimit: string | null = null;
const execFileAsync = promisify(execFile);
const isWindows = process.platform === "win32";

function isLockError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("could not set lock on file") ||
    lower.includes("conflicting lock is held") ||
    lower.includes("io error: could not set lock") ||
    lower.includes("being used by another process") // Windows OS error
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

async function getProcessParentPid(pid: number): Promise<number | null> {
  try {
    if (isWindows) {
      const { stdout } = await execFileAsync("wmic", [
        "process", "where", `ProcessId=${pid}`, "get", "ParentProcessId", "/value",
      ]);
      const match = stdout.match(/ParentProcessId=(\d+)/);
      if (!match) return null;
      const ppid = parseInt(match[1], 10);
      return Number.isFinite(ppid) ? ppid : null;
    }
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "ppid="]);
    const ppid = parseInt(stdout.trim(), 10);
    return Number.isFinite(ppid) ? ppid : null;
  } catch {
    return null;
  }
}

async function getProcessCommand(pid: number): Promise<string | null> {
  try {
    if (isWindows) {
      const { stdout } = await execFileAsync("wmic", [
        "process", "where", `ProcessId=${pid}`, "get", "CommandLine", "/value",
      ]);
      const match = stdout.match(/CommandLine=(.+)/);
      if (!match) return null;
      const command = match[1].trim();
      return command.length > 0 ? command : null;
    }
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
  dbPath: string,
  forceRecovery: boolean
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
    command.includes("packages/mcp-server/server/index.js") ||
    command.includes("\\mcp-server\\server\\index.js") ||
    command.includes("packages\\mcp-server\\server\\index.js");
  // Normalize command paths for consistent comparison (Windows backslashes → forward slashes)
  const normalizedCommand = command.replace(/\\/g, "/");
  const targetsSameDb = normalizedCommand.includes(normalizedDbPath) || normalizedCommand.includes(normalizedDbDir);

  if (!isTradeblocksProcess || !targetsSameDb) {
    return false;
  }

  // Check if the lock holder is orphaned (parent session is gone).
  // Unix: orphaned processes get reparented to PID 1 (init/launchd).
  // Windows: child keeps original PPID even after parent dies — check if parent is still alive.
  // Only kill non-orphaned processes if forceRecovery is explicitly enabled.
  const ppid = await getProcessParentPid(lockHolderPid);
  const orphaned = isWindows
    ? (ppid !== null && !isProcessAlive(ppid))
    : ppid === 1;
  if (!orphaned && !forceRecovery) {
    return false;
  }

  const reason = orphaned ? "orphaned" : "force-recovery";
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
      `Recovered DuckDB lock at ${dbPath} by stopping ${reason} tradeblocks-mcp process PID ${lockHolderPid}.`
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
  // Create schemas/tables every RW open. This keeps the process resilient if
  // analytics.duckdb is deleted/recreated while the process remains alive.
  await connection.run("CREATE SCHEMA IF NOT EXISTS trades");
  await connection.run("CREATE SCHEMA IF NOT EXISTS market");
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

  // Store config for reuse by upgrade/downgrade
  storedDbPath = dbPath;
  storedThreads = threads;
  storedMemoryLimit = memoryLimit;
  // DUCKDB_LOCK_RECOVERY=true force-kills ANY lock-holding tradeblocks-mcp process.
  // Without it, only orphaned processes (PPID=1, parent died) are auto-killed.
  const forceRecovery = (process.env.DUCKDB_LOCK_RECOVERY ?? "false") !== "false";

  try {
    return await openReadWriteConnection(dbPath, threads, memoryLimit);
  } catch (error) {
    // Provide clear error message for common issues
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Lock recovery: auto-kill orphaned tradeblocks-mcp processes (PPID=1) that hold the lock.
    // With DUCKDB_LOCK_RECOVERY=true, also kills non-orphaned holders (force mode).
    if (isLockError(errorMessage)) {
      const recovered = await tryRecoverLockByTerminatingStaleProcess(errorMessage, dbPath, forceRecovery);
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
 * Upgrade the connection to read-write mode for sync/write operations.
 * No-op if already in read-write mode.
 * Retries with backoff if another session briefly holds the write lock (during sync).
 * Falls back to read-only if the lock can't be acquired (another session is active).
 * Callers should check getConnectionMode() to determine if sync should be skipped.
 */
export async function upgradeToReadWrite(dataDir: string): Promise<DuckDBConnection> {
  if (connectionMode === "read_write" && connection) return connection;
  await closeConnection();

  // Try RW with retries — another session may briefly hold the lock during its own sync
  const maxRetries = 2;
  const retryDelayMs = 500;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await getConnection(dataDir);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!isLockError(msg)) throw error;
      lastError = error instanceof Error ? error : new Error(msg);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
  }

  // RW retries exhausted — fall back to read-only (skip sync, use existing data)
  if (storedDbPath && storedThreads && storedMemoryLimit) {
    try {
      await openReadOnlyConnection(storedDbPath, storedThreads, storedMemoryLimit);
      if (connection) return connection;
    } catch {
      // RO also failed (WAL may still exist from active writer)
    }
  }

  throw lastError || new Error("Failed to upgrade DuckDB connection to read-write");
}

/**
 * Downgrade the connection to read-only mode after sync/write operations.
 * No-op if already in read-only mode.
 * Closes the RW connection (checkpoints WAL, releases write lock) and reopens as RO.
 * Multiple processes can hold RO connections simultaneously.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function downgradeToReadOnly(dataDir: string): Promise<void> {
  if (connectionMode === "read_only") return;
  if (!connection) return;
  await closeConnection();
  if (storedDbPath && storedThreads && storedMemoryLimit) {
    await openReadOnlyConnection(storedDbPath, storedThreads, storedMemoryLimit);
  }
}

/**
 * Get the current connection mode.
 * Used by middleware to determine if sync should be skipped (RO fallback).
 */
export function getConnectionMode(): "read_write" | "read_only" | null {
  return connectionMode;
}

/**
 * Check if a connection is currently active.
 * Useful for diagnostics and testing.
 */
export function isConnected(): boolean {
  return connection !== null;
}
