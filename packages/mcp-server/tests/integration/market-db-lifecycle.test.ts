/**
 * Integration tests for Market DB Lifecycle
 *
 * Verifies the dual-DB connection lifecycle introduced in Phase 60:
 *   - market.duckdb created on first getConnection()
 *   - Four market tables (daily, context, intraday, _sync_metadata) created
 *   - Primary key constraints enforced
 *   - DETACH on close + re-ATTACH on reconnect preserves data
 *   - Legacy market schema in analytics.duckdb dropped before ATTACH
 *   - MARKET_DB_PATH env var overrides default path
 */
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { DuckDBInstance } from "@duckdb/node-api";

// @ts-expect-error - importing from bundled output
import { getConnection, closeConnection } from "../../dist/test-exports.js";

describe("Market DB Lifecycle", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), "market-lifecycle-"));
  });

  afterEach(async () => {
    // Always close connection and clean up env var
    delete process.env.MARKET_DB_PATH;
    await closeConnection();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("creates market.duckdb file on first connection", async () => {
    await getConnection(testDir);

    const marketDbPath = path.join(testDir, "market.duckdb");
    // fs.access throws if file does not exist
    await expect(fs.access(marketDbPath)).resolves.toBeUndefined();
  });

  it("creates all four market tables on first connection", async () => {
    const conn = await getConnection(testDir);

    // Verify all four tables exist and are queryable
    const tables = ["market.daily", "market.context", "market.intraday", "market._sync_metadata"];
    for (const table of tables) {
      // runAndReadAll throws if table doesn't exist
      await expect(
        conn.runAndReadAll(`SELECT COUNT(*) FROM ${table} WHERE 1=0`)
      ).resolves.toBeDefined();
    }

    // Verify market.daily is writable (basic INSERT)
    await conn.run(
      `INSERT INTO market.daily (ticker, date, open) VALUES ('SPX', '2025-01-01', 100.0)`
    );
    const result = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'`
    );
    expect(Number(result.getRows()[0][0])).toBe(1);
  });

  it("market tables have correct primary key constraints", async () => {
    const conn = await getConnection(testDir);

    // market.daily: PK (ticker, date)
    await conn.run(`INSERT INTO market.daily (ticker, date) VALUES ('SPX', '2025-01-02')`);
    await expect(
      conn.run(`INSERT INTO market.daily (ticker, date) VALUES ('SPX', '2025-01-02')`)
    ).rejects.toThrow();

    // market.context: PK (date)
    await conn.run(`INSERT INTO market.context (date) VALUES ('2025-01-02')`);
    await expect(
      conn.run(`INSERT INTO market.context (date) VALUES ('2025-01-02')`)
    ).rejects.toThrow();

    // market.intraday: PK (ticker, date, time)
    await conn.run(
      `INSERT INTO market.intraday (ticker, date, time) VALUES ('SPX', '2025-01-02', '09:30')`
    );
    await expect(
      conn.run(
        `INSERT INTO market.intraday (ticker, date, time) VALUES ('SPX', '2025-01-02', '09:30')`
      )
    ).rejects.toThrow();

    // market._sync_metadata: PK (source, ticker, target_table)
    await conn.run(
      `INSERT INTO market._sync_metadata (source, ticker, target_table, synced_at) VALUES ('test-source', 'SPX', 'daily', NOW())`
    );
    await expect(
      conn.run(
        `INSERT INTO market._sync_metadata (source, ticker, target_table, synced_at) VALUES ('test-source', 'SPX', 'daily', NOW())`
      )
    ).rejects.toThrow();
  });

  it("DETACHes on close and re-ATTACHes on reconnect preserving data", async () => {
    // First connection: insert data
    const conn1 = await getConnection(testDir);
    await conn1.run(
      `INSERT INTO market.daily (ticker, date, open) VALUES ('SPX', '2025-01-02', 200.0)`
    );

    // Close triggers DETACH
    await closeConnection();

    // Second connection: re-ATTACH happens in getConnection
    const conn2 = await getConnection(testDir);

    // Verify data persisted across close/reopen cycle
    const result = await conn2.runAndReadAll(
      `SELECT open FROM market.daily WHERE ticker = 'SPX' AND date = '2025-01-02'`
    );
    const rows = result.getRows();
    expect(rows.length).toBe(1);
    expect(Number(rows[0][0])).toBe(200.0);
  });

  it("drops legacy market schema from analytics.duckdb on connection", async () => {
    // Simulate pre-Phase-60 state: analytics.duckdb has inline market schema
    const analyticsDbPath = path.join(testDir, "analytics.duckdb");
    const rawInst = await DuckDBInstance.create(analyticsDbPath);
    const rawConn = await rawInst.connect();
    await rawConn.run("CREATE SCHEMA IF NOT EXISTS market");
    await rawConn.run(
      "CREATE TABLE market.spx_daily (date VARCHAR PRIMARY KEY, close DOUBLE)"
    );
    rawConn.closeSync();

    // Now call getConnection — it should drop the old schema and ATTACH market.duckdb
    const conn = await getConnection(testDir);

    // New table from market.duckdb should exist and be queryable
    await expect(
      conn.runAndReadAll(`SELECT * FROM market.daily WHERE 1=0`)
    ).resolves.toBeDefined();

    // Old inline table should be gone: query duckdb_tables() for market schema
    // tables that are NOT in the market.duckdb catalog — should be zero
    const legacyResult = await conn.runAndReadAll(
      `SELECT COUNT(*) FROM duckdb_tables() WHERE database_name != 'market' AND schema_name = 'market'`
    );
    expect(Number(legacyResult.getRows()[0][0])).toBe(0);
  });

  it("respects MARKET_DB_PATH environment variable", async () => {
    const customDir = path.join(testDir, "custom", "market");
    const customDbPath = path.join(customDir, "my-market.duckdb");

    // Set env var before calling getConnection so resolveMarketDbPath picks it up
    process.env.MARKET_DB_PATH = customDbPath;

    await getConnection(testDir);

    // Verify market.duckdb created at custom path
    await expect(fs.access(customDbPath)).resolves.toBeUndefined();

    // Default path should NOT have been created
    const defaultPath = path.join(testDir, "market.duckdb");
    await expect(fs.access(defaultPath)).rejects.toThrow();
  });
});
