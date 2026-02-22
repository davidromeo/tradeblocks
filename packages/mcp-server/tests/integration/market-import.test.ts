/**
 * Integration tests for Market Import Utilities
 *
 * Validates all IMP-* requirements satisfied by the Phase 61 import implementation:
 *   - validateColumnMapping: rejects missing required fields for all three target tables
 *   - importMarketCsvFile: CSV parsing, idempotency, ticker normalization, dry_run, metadata upsert
 *   - importFromDatabase: ATTACH lifecycle, query execution, dry_run, validation fail-clean
 *   - Numeric Unix timestamp date handling vs YYYY-MM-DD strings
 */
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { DuckDBInstance } from "@duckdb/node-api";

// @ts-expect-error - importing from bundled output
import {
  validateColumnMapping,
  importMarketCsvFile,
  importFromDatabase,
  getConnection,
  closeConnection,
} from "../../dist/test-exports.js";

// =============================================================================
// validateColumnMapping — pure function, no DB needed
// =============================================================================

describe("validateColumnMapping", () => {
  describe("daily table", () => {
    it("accepts valid daily mapping with all required fields", () => {
      const mapping = {
        time: "date",
        open: "open",
        high: "high",
        low: "low",
        close: "close",
      };
      const result = validateColumnMapping(mapping, "daily");
      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it("rejects daily mapping missing open, high, low, close", () => {
      const mapping = { time: "date" }; // only date mapped
      const result = validateColumnMapping(mapping, "daily");
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("open");
      expect(result.missingFields).toContain("high");
      expect(result.missingFields).toContain("low");
      expect(result.missingFields).toContain("close");
    });

    it("rejects daily mapping missing only the date field", () => {
      const mapping = { o: "open", h: "high", l: "low", c: "close" };
      const result = validateColumnMapping(mapping, "daily");
      expect(result.valid).toBe(false);
      expect(result.missingFields).toEqual(["date"]);
    });
  });

  describe("context table", () => {
    it("accepts valid context mapping with only date", () => {
      const mapping = { trade_date: "date", vix: "VIX_Close" };
      const result = validateColumnMapping(mapping, "context");
      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it("rejects context mapping missing date", () => {
      const mapping = { vix: "VIX_Close" }; // no date mapped
      const result = validateColumnMapping(mapping, "context");
      expect(result.valid).toBe(false);
      expect(result.missingFields).toEqual(["date"]);
    });
  });

  describe("intraday table", () => {
    it("accepts valid intraday mapping with all required fields", () => {
      const mapping = {
        ts: "date",
        t: "time",
        o: "open",
        h: "high",
        l: "low",
        c: "close",
      };
      const result = validateColumnMapping(mapping, "intraday");
      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it("rejects intraday mapping missing time field", () => {
      const mapping = {
        ts: "date",
        o: "open",
        h: "high",
        l: "low",
        c: "close",
        // time is missing
      };
      const result = validateColumnMapping(mapping, "intraday");
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain("time");
    });
  });
});

// =============================================================================
// importMarketCsvFile
// =============================================================================

describe("importMarketCsvFile", () => {
  let testDir: string;

  // Minimal CSV with YYYY-MM-DD date strings
  const CSV_HEADER = "time,open,high,low,close\n";
  const CSV_ROWS =
    "2024-01-02,4745.00,4800.00,4730.00,4790.00\n" +
    "2024-01-03,4790.00,4820.00,4770.00,4810.00\n";

  // Column mapping: CSV columns -> schema columns
  const columnMapping: Record<string, string> = {
    time: "date",
    open: "open",
    high: "high",
    low: "low",
    close: "close",
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), "market-import-csv-"));
  });

  afterEach(async () => {
    await closeConnection();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("inserts rows on first import (rowsInserted = N)", async () => {
    const csvPath = path.join(testDir, "spx.csv");
    await fs.writeFile(csvPath, CSV_HEADER + CSV_ROWS);

    const conn = await getConnection(testDir);
    const result = await importMarketCsvFile(conn, {
      filePath: csvPath,
      ticker: "SPX",
      targetTable: "daily",
      columnMapping,
    });

    expect(result.rowsInserted).toBe(2);
    expect(result.inputRowCount).toBe(2);
    expect(result.rowsSkipped).toBe(0);

    // Verify rows actually in DB
    const dbResult = await conn.runAndReadAll(
      "SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'"
    );
    expect(Number(dbResult.getRows()[0][0])).toBe(2);
  });

  it("idempotency: second import of same data inserts 0 rows", async () => {
    const csvPath = path.join(testDir, "spx.csv");
    await fs.writeFile(csvPath, CSV_HEADER + CSV_ROWS);

    const conn = await getConnection(testDir);

    // First import
    const result1 = await importMarketCsvFile(conn, {
      filePath: csvPath,
      ticker: "SPX",
      targetTable: "daily",
      columnMapping,
    });
    expect(result1.rowsInserted).toBe(2);

    // Second import — same data, should be ON CONFLICT DO NOTHING
    const result2 = await importMarketCsvFile(conn, {
      filePath: csvPath,
      ticker: "SPX",
      targetTable: "daily",
      columnMapping,
    });
    expect(result2.rowsInserted).toBe(0);
    expect(result2.rowsSkipped).toBe(2);

    // DB count still 2, not 4
    const dbResult = await conn.runAndReadAll(
      "SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'"
    );
    expect(Number(dbResult.getRows()[0][0])).toBe(2);
  });

  it("normalizes ticker to uppercase (spx -> SPX in market.daily)", async () => {
    const csvPath = path.join(testDir, "spx.csv");
    await fs.writeFile(csvPath, CSV_HEADER + CSV_ROWS);

    const conn = await getConnection(testDir);
    await importMarketCsvFile(conn, {
      filePath: csvPath,
      ticker: "spx", // lowercase input
      targetTable: "daily",
      columnMapping,
    });

    // Verify ticker was normalized to uppercase
    const dbResult = await conn.runAndReadAll(
      "SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'"
    );
    expect(Number(dbResult.getRows()[0][0])).toBe(2);

    // Verify lowercase ticker does NOT have a row
    const lcResult = await conn.runAndReadAll(
      "SELECT COUNT(*) FROM market.daily WHERE ticker = 'spx'"
    );
    expect(Number(lcResult.getRows()[0][0])).toBe(0);
  });

  it("dateRange.min and dateRange.max match CSV input dates", async () => {
    const csvPath = path.join(testDir, "spx.csv");
    await fs.writeFile(csvPath, CSV_HEADER + CSV_ROWS);

    const conn = await getConnection(testDir);
    const result = await importMarketCsvFile(conn, {
      filePath: csvPath,
      ticker: "SPX",
      targetTable: "daily",
      columnMapping,
    });

    expect(result.dateRange).not.toBeNull();
    expect(result.dateRange!.min).toBe("2024-01-02");
    expect(result.dateRange!.max).toBe("2024-01-03");
  });

  it("dry_run=true returns inputRowCount > 0 but rowsInserted = 0 and no rows written", async () => {
    const csvPath = path.join(testDir, "spx.csv");
    await fs.writeFile(csvPath, CSV_HEADER + CSV_ROWS);

    const conn = await getConnection(testDir);
    const result = await importMarketCsvFile(conn, {
      filePath: csvPath,
      ticker: "SPX",
      targetTable: "daily",
      columnMapping,
      dryRun: true,
    });

    expect(result.rowsInserted).toBe(0);
    expect(result.inputRowCount).toBe(2);

    // Verify nothing was written to DB
    const dbResult = await conn.runAndReadAll(
      "SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'"
    );
    expect(Number(dbResult.getRows()[0][0])).toBe(0);
  });

  it("throws on missing required field before any DB write", async () => {
    const csvPath = path.join(testDir, "spx.csv");
    await fs.writeFile(csvPath, CSV_HEADER + CSV_ROWS);

    const conn = await getConnection(testDir);

    // Mapping missing 'open', 'high', 'low', 'close'
    const badMapping = { time: "date" };

    await expect(
      importMarketCsvFile(conn, {
        filePath: csvPath,
        ticker: "SPX",
        targetTable: "daily",
        columnMapping: badMapping,
      })
    ).rejects.toThrow(/missing required fields/i);

    // DB should be empty — no writes happened
    const dbResult = await conn.runAndReadAll(
      "SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'"
    );
    expect(Number(dbResult.getRows()[0][0])).toBe(0);
  });

  it("updates market._sync_metadata after successful import", async () => {
    const csvPath = path.join(testDir, "spx.csv");
    await fs.writeFile(csvPath, CSV_HEADER + CSV_ROWS);

    const conn = await getConnection(testDir);
    await importMarketCsvFile(conn, {
      filePath: csvPath,
      ticker: "SPX",
      targetTable: "daily",
      columnMapping,
    });

    // Check _sync_metadata row exists with correct source/ticker/target_table
    const metaResult = await conn.runAndReadAll(
      "SELECT source, ticker, target_table FROM market._sync_metadata WHERE ticker = 'SPX' AND target_table = 'daily'"
    );
    const rows = metaResult.getRows();
    expect(rows.length).toBe(1);
    expect(String(rows[0][1])).toBe("SPX");
    expect(String(rows[0][2])).toBe("daily");
    // Source should reference the file path
    expect(String(rows[0][0])).toContain("import_market_csv");
  });

  it("enrichment status is 'pending' (not 'error') for normal import", async () => {
    const csvPath = path.join(testDir, "spx.csv");
    await fs.writeFile(csvPath, CSV_HEADER + CSV_ROWS);

    const conn = await getConnection(testDir);
    const result = await importMarketCsvFile(conn, {
      filePath: csvPath,
      ticker: "SPX",
      targetTable: "daily",
      columnMapping,
    });

    expect(result.enrichment.status).toBe("pending");
    expect(result.enrichment.status).not.toBe("error");
  });

  it("handles YYYY-MM-DD date column directly (stored as-is)", async () => {
    const csvPath = path.join(testDir, "spx_date.csv");
    await fs.writeFile(
      csvPath,
      "date,open,high,low,close\n2024-06-15,5300.00,5350.00,5290.00,5340.00\n"
    );

    const conn = await getConnection(testDir);
    const result = await importMarketCsvFile(conn, {
      filePath: csvPath,
      ticker: "SPX",
      targetTable: "daily",
      columnMapping: { date: "date", open: "open", high: "high", low: "low", close: "close" },
    });

    expect(result.rowsInserted).toBe(1);
    expect(result.dateRange!.min).toBe("2024-06-15");

    // Verify the date stored in DB is unchanged
    const dbResult = await conn.runAndReadAll(
      "SELECT date FROM market.daily WHERE ticker = 'SPX' AND date = '2024-06-15'"
    );
    expect(dbResult.getRows().length).toBe(1);
  });

  it("handles Unix timestamp date column (1704196800 = 2024-01-02 ET)", async () => {
    // 1704196800 = 2024-01-02 12:00:00 UTC — safely 2024-01-02 in any timezone including ET
    const csvPath = path.join(testDir, "spx_unix.csv");
    await fs.writeFile(
      csvPath,
      "time,open,high,low,close\n1704196800,4745.00,4800.00,4730.00,4790.00\n"
    );

    const conn = await getConnection(testDir);
    const result = await importMarketCsvFile(conn, {
      filePath: csvPath,
      ticker: "SPX",
      targetTable: "daily",
      columnMapping,
    });

    expect(result.rowsInserted).toBe(1);
    expect(result.dateRange!.min).toBe("2024-01-02");
    expect(result.dateRange!.max).toBe("2024-01-02");

    // Verify date in DB
    const dbResult = await conn.runAndReadAll(
      "SELECT date FROM market.daily WHERE ticker = 'SPX' AND date = '2024-01-02'"
    );
    expect(dbResult.getRows().length).toBe(1);
  });
});

// =============================================================================
// importFromDatabase
// =============================================================================

describe("importFromDatabase", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), "market-import-db-"));
  });

  afterEach(async () => {
    await closeConnection();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("imports rows from external DuckDB query into market.daily", async () => {
    // Create external DuckDB with test data
    const extDbPath = path.join(testDir, "external.duckdb");
    const extInst = await DuckDBInstance.create(extDbPath);
    const extConn = await extInst.connect();
    await extConn.run(
      "CREATE TABLE spx_data (trade_date VARCHAR, spx_open DOUBLE, spx_high DOUBLE, spx_low DOUBLE, spx_close DOUBLE)"
    );
    await extConn.run(
      "INSERT INTO spx_data VALUES ('2024-01-02', 4745.0, 4800.0, 4730.0, 4790.0)"
    );
    extConn.closeSync();
    // DuckDBInstance GC handles close

    const conn = await getConnection(testDir);
    const result = await importFromDatabase(conn, {
      dbPath: extDbPath,
      query:
        "SELECT trade_date, spx_open, spx_high, spx_low, spx_close FROM ext_import_source.spx_data",
      ticker: "SPX",
      targetTable: "daily",
      columnMapping: {
        trade_date: "date",
        spx_open: "open",
        spx_high: "high",
        spx_low: "low",
        spx_close: "close",
      },
    });

    expect(result.rowsInserted).toBe(1);
    expect(result.inputRowCount).toBe(1);

    // Verify row in DB
    const dbResult = await conn.runAndReadAll(
      "SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'"
    );
    expect(Number(dbResult.getRows()[0][0])).toBe(1);
  });

  it("external DB is properly DETACHed after import (no lingering ATTACH)", async () => {
    const extDbPath = path.join(testDir, "external2.duckdb");
    const extInst = await DuckDBInstance.create(extDbPath);
    const extConn = await extInst.connect();
    await extConn.run(
      "CREATE TABLE data (trade_date VARCHAR, o DOUBLE, h DOUBLE, l DOUBLE, c DOUBLE)"
    );
    await extConn.run("INSERT INTO data VALUES ('2024-02-01', 4900.0, 4950.0, 4880.0, 4930.0)");
    extConn.closeSync();

    const conn = await getConnection(testDir);
    await importFromDatabase(conn, {
      dbPath: extDbPath,
      query: "SELECT trade_date, o, h, l, c FROM ext_import_source.data",
      ticker: "SPX",
      targetTable: "daily",
      columnMapping: {
        trade_date: "date",
        o: "open",
        h: "high",
        l: "low",
        c: "close",
      },
    });

    // After import, ext_import_source should be detached — querying it should fail
    await expect(
      conn.runAndReadAll("SELECT * FROM ext_import_source.data")
    ).rejects.toThrow();
  });

  it("dry_run=true returns preview with inputRowCount > 0 but no rows written to DB", async () => {
    const extDbPath = path.join(testDir, "external3.duckdb");
    const extInst = await DuckDBInstance.create(extDbPath);
    const extConn = await extInst.connect();
    await extConn.run(
      "CREATE TABLE data2 (trade_date VARCHAR, o DOUBLE, h DOUBLE, l DOUBLE, c DOUBLE)"
    );
    await extConn.run("INSERT INTO data2 VALUES ('2024-03-01', 5100.0, 5150.0, 5080.0, 5130.0)");
    extConn.closeSync();

    const conn = await getConnection(testDir);
    const result = await importFromDatabase(conn, {
      dbPath: extDbPath,
      query: "SELECT trade_date, o, h, l, c FROM ext_import_source.data2",
      ticker: "SPX",
      targetTable: "daily",
      columnMapping: {
        trade_date: "date",
        o: "open",
        h: "high",
        l: "low",
        c: "close",
      },
      dryRun: true,
    });

    expect(result.rowsInserted).toBe(0);
    expect(result.inputRowCount).toBe(1);

    // DB should be empty
    const dbResult = await conn.runAndReadAll(
      "SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'"
    );
    expect(Number(dbResult.getRows()[0][0])).toBe(0);
  });

  it("throws on validation error before ATTACHing external DB", async () => {
    // The external DB doesn't even need to exist for this test —
    // validation should fire first before any ATTACH attempt
    const conn = await getConnection(testDir);

    const badMapping = { o: "open" }; // missing date, high, low, close

    await expect(
      importFromDatabase(conn, {
        dbPath: "/nonexistent/path.duckdb",
        query: "SELECT * FROM ext_import_source.data",
        ticker: "SPX",
        targetTable: "daily",
        columnMapping: badMapping,
      })
    ).rejects.toThrow(/missing required fields/i);
  });
});
