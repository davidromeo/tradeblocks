/**
 * DuckDB Connection Manager
 *
 * Provides lazy singleton connection to DuckDB analytics database (analytics.duckdb)
 * with a second database (market.duckdb) ATTACHed as the `market` catalog.
 *
 * Startup sequence on first RW open:
 *   1. Open analytics.duckdb
 *   2. DROP SCHEMA IF EXISTS market CASCADE (removes legacy inline market tables,
 *      prevents DuckDB #14421 naming conflict with the upcoming ATTACH)
 *   3. ATTACH market.duckdb AS market
 *   4. ensureMarketTables() — creates market.daily/context/intraday/_sync_metadata
 *   5. ensureSyncTables() / ensureTradeDataTable() / ensureReportingDataTable()
 *
 * On close: DETACH market before closeSync() so WAL is cleanly checkpointed.
 * On RO open: ATTACH market.duckdb READ_ONLY (no table creation).
 *
 * DuckDB is single-process: only one process can open a database file at a time
 * (even read-only fails when another process holds a write lock with an active WAL).
 * Lock recovery handles stale processes from crashed Claude Code sessions by detecting
 * orphaned MCP processes (PPID=1) and terminating them before retrying.
 *
 * Configuration via environment variables:
 *   DUCKDB_MEMORY_LIMIT    - Memory limit (default: 512MB)
 *   DUCKDB_THREADS         - Number of threads (default: 2)
 *   DUCKDB_LOCK_RECOVERY   - Force-kill ANY lock-holding tradeblocks-mcp (default: false)
 *   DUCKDB_LOCK_RECOVERY_TIMEOUT_MS - Wait time for SIGTERM (default: 1500)
 *   MARKET_DB_PATH         - Path to market.duckdb (overrides default, overridden by --market-db)
 *
 * Security:
 *   - enable_external_access starts as "true" to allow local ATTACH (required for market.duckdb)
 *   - After ATTACH, SET enable_external_access = false locks down remote HTTP/HTTPS access
 *   - The SET is self-locking: cannot be re-enabled within the same session
 *
 * Schemas created on first RW connection:
 *   - trades: For block/trade data (in analytics.duckdb)
 *   - market: ATTACHed from market.duckdb (daily, context, intraday, _sync_metadata)
 */

import { DuckDBInstance, DuckDBConnection } from "@duckdb/node-api";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import { ensureSyncTables, ensureTradeDataTable, ensureReportingDataTable } from "./schemas.js";
import { ensureMarketTables } from "./market-schemas.js";

// Module-level singleton state
let instance: DuckDBInstance | null = null;
let connection: DuckDBConnection | null = null;
let connectionMode: "read_write" | "read_only" | null = null;
let storedDbPath: string | null = null;
let storedThreads: string | null = null;
let storedMemoryLimit: string | null = null;
let storedMarketDbPath: string | null = null;
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

async function getProcessParentPid(pid: number): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "ppid="]);
    const ppid = parseInt(stdout.trim(), 10);
    return Number.isFinite(ppid) ? ppid : null;
  } catch {
    return null;
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
    command.includes("packages/mcp-server/server/index.js");
  const targetsSameDb = command.includes(normalizedDbPath) || command.includes(normalizedDbDir);

  if (!isTradeblocksProcess || !targetsSameDb) {
    return false;
  }

  // Check if the lock holder is orphaned (parent died, reparented to init/launchd PID 1).
  // Orphaned processes are definitively stale — their Claude session is gone.
  // Only kill non-orphaned processes if forceRecovery is explicitly enabled.
  const ppid = await getProcessParentPid(lockHolderPid);
  const orphaned = ppid === 1;
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

/**
 * Resolve the path to market.duckdb.
 *
 * Precedence: CLI --market-db > MARKET_DB_PATH env > default (<dataDir>/market.duckdb)
 *
 * @param dataDir - Directory where analytics.duckdb lives (used as default parent)
 */
function resolveMarketDbPath(dataDir: string): string {
  // 1. CLI argument: --market-db /path/to/market.duckdb
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--market-db" && args[i + 1]) {
      return path.resolve(args[i + 1]);
    }
  }
  // 2. Environment variable
  if (process.env.MARKET_DB_PATH) {
    return path.resolve(process.env.MARKET_DB_PATH);
  }
  // 3. Default: alongside analytics.duckdb
  return path.join(dataDir, "market.duckdb");
}

/**
 * ATTACH market.duckdb to an existing connection.
 *
 * Creates the parent directory if needed. Auto-recreates market.duckdb on
 * corruption (market data is re-importable from source CSVs).
 *
 * Hard fails on any non-corruption ATTACH error — market access is required.
 */
async function attachMarketDb(
  conn: DuckDBConnection,
  marketDbPath: string,
  mode: "read_write" | "read_only"
): Promise<void> {
  await fs.mkdir(path.dirname(marketDbPath), { recursive: true });
  const readOnlyClause = mode === "read_only" ? " (READ_ONLY)" : "";
  try {
    await conn.run(`ATTACH '${marketDbPath}' AS market${readOnlyClause}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("corrupt") || msg.includes("Invalid") || msg.includes("cannot open")) {
      console.error(`market.duckdb appears corrupted at ${marketDbPath}. Recreating.`);
      try { await fs.unlink(marketDbPath); } catch { /* file may not exist */ }
      // Also try removing WAL file
      try { await fs.unlink(marketDbPath + ".wal"); } catch { /* ignore */ }
      await conn.run(`ATTACH '${marketDbPath}' AS market${readOnlyClause}`);
    } else {
      throw new Error(`Failed to attach market.duckdb at ${marketDbPath}: ${msg}`);
    }
  }
}

/**
 * DETACH market.duckdb from a connection.
 * Non-fatal: may already be detached or market was never attached.
 */
async function detachMarketDb(conn: DuckDBConnection): Promise<void> {
  try {
    await conn.run("DETACH market");
  } catch {
    // Non-fatal: may already be detached or market never attached
  }
}

async function openReadWriteConnection(
  dbPath: string,
  threads: string,
  memoryLimit: string
): Promise<DuckDBConnection> {
  // enable_external_access must be "true" at instance creation to allow ATTACH of local files.
  // DuckDB 1.4+ blocks all filesystem operations (including local ATTACH) when set to "false"
  // at the instance level. After ATTACH, we lock it down via SET to prevent remote HTTP access.
  instance = await DuckDBInstance.create(dbPath, {
    threads,
    memory_limit: memoryLimit,
    enable_external_access: "true",
  });
  connection = await instance.connect();

  // Drop legacy market schema from analytics.duckdb before ATTACH.
  // Prevents DuckDB #14421 naming conflict: having tables in both the main DB
  // and an ATTACHed DB under the same catalog name causes corruption.
  try {
    await connection.run("DROP SCHEMA IF EXISTS market CASCADE");
  } catch {
    // Non-fatal: schema may not exist (fresh DB or already dropped)
  }

  // Attach separate market.duckdb
  await attachMarketDb(connection, storedMarketDbPath!, "read_write");

  // Lock down external access after ATTACH (self-locking: cannot be re-enabled in this session).
  // This prevents remote HTTP/HTTPS data fetching while still allowing local file operations
  // on databases that are already attached.
  try {
    await connection.run("SET enable_external_access = false");
  } catch {
    // Non-fatal: may fail in some DuckDB versions or test environments
  }

  // Create schemas/tables every RW open. This keeps the process resilient if
  // analytics.duckdb is deleted/recreated while the process remains alive.
  await connection.run("CREATE SCHEMA IF NOT EXISTS trades");
  await ensureSyncTables(connection);
  await ensureTradeDataTable(connection);
  await ensureReportingDataTable(connection);
  await ensureMarketTables(connection);
  connectionMode = "read_write";

  return connection;
}

async function openReadOnlyConnection(
  dbPath: string,
  threads: string,
  memoryLimit: string
): Promise<DuckDBConnection> {
  // enable_external_access must be "true" at instance creation to allow ATTACH.
  // We lock it down via SET after attaching the market database.
  instance = await DuckDBInstance.create(dbPath, {
    threads,
    memory_limit: memoryLimit,
    enable_external_access: "true",
    access_mode: "READ_ONLY",
  });
  connection = await instance.connect();
  if (storedMarketDbPath) {
    await attachMarketDb(connection, storedMarketDbPath, "read_only");
  }
  try {
    await connection.run("SET enable_external_access = false");
  } catch {
    // Non-fatal
  }
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
 *   - Drops legacy inline market schema from analytics.duckdb
 *   - ATTACHes market.duckdb as `market` catalog
 *   - Creates 'trades' schema and market tables
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
  storedMarketDbPath = resolveMarketDbPath(dataDir);
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
 * DETACHes market.duckdb before closing to ensure WAL is checkpointed cleanly.
 * Should be called during graceful shutdown (SIGINT, SIGTERM).
 * Safe to call multiple times or when no connection exists.
 */
export async function closeConnection(): Promise<void> {
  if (connection) {
    try { await detachMarketDb(connection); } catch { /* non-fatal, log debug */ }
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
