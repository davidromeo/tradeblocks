import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  readOptionQuoteSnapshotsWindow,
} from "../../../src/utils/option-quote-snapshots.js";

let tmpDir: string;
let db: DuckDBInstance;
let conn: DuckDBConnection;

beforeEach(async () => {
  tmpDir = join(
    tmpdir(),
    `option-quote-snapshots-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  db = await DuckDBInstance.create(":memory:");
  conn = await db.connect();
});

afterEach(() => {
  try {
    conn.closeSync();
  } catch {
    /* ignore */
  }
  try {
    db.closeSync();
  } catch {
    /* ignore */
  }
  rmSync(tmpDir, { recursive: true, force: true });
});

async function writeQuoteAndChainFixtures(): Promise<void> {
  const quoteDir = join(
    tmpDir,
    "market",
    "option_quote_minutes",
    "underlying=SPX",
    "date=2025-01-06",
  );
  const chainDir = join(
    tmpDir,
    "market",
    "option_chain",
    "underlying=SPX",
    "date=2025-01-06",
  );
  mkdirSync(quoteDir, { recursive: true });
  mkdirSync(chainDir, { recursive: true });

  await conn.run(`
    COPY (
      SELECT 'SPX'::VARCHAR AS underlying,
             '2025-01-06'::VARCHAR AS date,
             'SPXW250108C05000000'::VARCHAR AS ticker,
             '14:30'::VARCHAR AS time,
             10.0 AS bid,
             10.4 AS ask,
             10.2 AS mid
      UNION ALL
      SELECT 'SPX'::VARCHAR AS underlying,
             '2025-01-06'::VARCHAR AS date,
             'SPXW250206C05000000'::VARCHAR AS ticker,
             '14:30'::VARCHAR AS time,
             20.0 AS bid,
             20.4 AS ask,
             20.2 AS mid
    ) TO '${join(quoteDir, "data.parquet")}' (FORMAT PARQUET);
  `);

  await conn.run(`
    COPY (
      SELECT 'SPX'::VARCHAR AS underlying,
             '2025-01-06'::VARCHAR AS date,
             'SPXW250108C05000000'::VARCHAR AS ticker,
             'call'::VARCHAR AS contract_type,
             5000.0 AS strike,
             '2025-01-08'::VARCHAR AS expiration
      UNION ALL
      SELECT 'SPX'::VARCHAR AS underlying,
             '2025-01-06'::VARCHAR AS date,
             'SPXW250108C05000000'::VARCHAR AS ticker,
             'call'::VARCHAR AS contract_type,
             5000.0 AS strike,
             '2025-01-08'::VARCHAR AS expiration
      UNION ALL
      SELECT 'SPX'::VARCHAR AS underlying,
             '2025-01-06'::VARCHAR AS date,
             'SPXW250206C05000000'::VARCHAR AS ticker,
             'call'::VARCHAR AS contract_type,
             5000.0 AS strike,
             '2025-02-06'::VARCHAR AS expiration
    ) TO '${join(chainDir, "data.parquet")}' (FORMAT PARQUET);
  `);
}

async function writeMultiStrikeFixtures(): Promise<void> {
  const quoteDir = join(
    tmpDir,
    "market",
    "option_quote_minutes",
    "underlying=SPX",
    "date=2025-01-06",
  );
  const chainDir = join(
    tmpDir,
    "market",
    "option_chain",
    "underlying=SPX",
    "date=2025-01-06",
  );
  mkdirSync(quoteDir, { recursive: true });
  mkdirSync(chainDir, { recursive: true });

  await conn.run(`
    COPY (
      SELECT * FROM (VALUES
        ('SPX', '2025-01-06', 'SPXW250108P05700000', '14:30', 2.0, 2.2, 2.1),
        ('SPX', '2025-01-06', 'SPXW250108P05800000', '14:30', 3.0, 3.2, 3.1),
        ('SPX', '2025-01-06', 'SPXW250108P05850000', '14:30', 4.0, 4.2, 4.1),
        ('SPX', '2025-01-06', 'SPXW250108C05950000', '14:30', 5.0, 5.2, 5.1),
        ('SPX', '2025-01-06', 'SPXW250108C06050000', '14:30', 1.0, 1.2, 1.1),
        ('SPX', '2025-01-06', 'SPXW250108C06200000', '14:30', 0.2, 0.4, 0.3)
      ) AS t(underlying, date, ticker, time, bid, ask, mid)
    ) TO '${join(quoteDir, "data.parquet")}' (FORMAT PARQUET);
  `);

  await conn.run(`
    COPY (
      SELECT * FROM (VALUES
        ('SPX', '2025-01-06', 'SPXW250108P05700000', 'put',  5700.0, '2025-01-08'),
        ('SPX', '2025-01-06', 'SPXW250108P05800000', 'put',  5800.0, '2025-01-08'),
        ('SPX', '2025-01-06', 'SPXW250108P05850000', 'put',  5850.0, '2025-01-08'),
        ('SPX', '2025-01-06', 'SPXW250108C05950000', 'call', 5950.0, '2025-01-08'),
        ('SPX', '2025-01-06', 'SPXW250108C06050000', 'call', 6050.0, '2025-01-08'),
        ('SPX', '2025-01-06', 'SPXW250108C06200000', 'call', 6200.0, '2025-01-08')
      ) AS t(underlying, date, ticker, contract_type, strike, expiration)
    ) TO '${join(chainDir, "data.parquet")}' (FORMAT PARQUET);
  `);
}

describe("readOptionQuoteSnapshotsWindow", () => {
  it("deduplicates duplicate chain rows and keeps only requested DTE window", async () => {
    await writeQuoteAndChainFixtures();

    const rowsByTicker = await readOptionQuoteSnapshotsWindow({
      conn,
      dataDir: tmpDir,
      underlying: "SPX",
      dates: ["2025-01-06"],
      timeStart: "14:30",
      timeEnd: "14:30",
      dteMin: 1,
      dteMax: 5,
      contractTypes: ["call"],
    });

    expect([...rowsByTicker.keys()]).toEqual(["SPXW250108C05000000"]);
    expect(rowsByTicker.get("SPXW250108C05000000")).toHaveLength(1);
    expect(rowsByTicker.get("SPXW250108C05000000")?.[0]).toMatchObject({
      date: "2025-01-06",
      time: "14:30",
      expiration: "2025-01-08",
      delta: null,
      iv: null,
    });
  });

  it("narrows to strikeMin/strikeMax when provided on the flat-filter path", async () => {
    await writeMultiStrikeFixtures();

    const rowsByTicker = await readOptionQuoteSnapshotsWindow({
      conn,
      dataDir: tmpDir,
      underlying: "SPX",
      dates: ["2025-01-06"],
      timeStart: "14:30",
      timeEnd: "14:30",
      dteMin: 1,
      dteMax: 3,
      strikeMin: 5800,
      strikeMax: 6100,
    });

    expect(new Set(rowsByTicker.keys())).toEqual(
      new Set([
        "SPXW250108P05800000",
        "SPXW250108P05850000",
        "SPXW250108C05950000",
        "SPXW250108C06050000",
      ]),
    );
  });

  it("readOptionQuoteSnapshotsWindow with neededGreeks=['delta'] round-trips delta from parquet but NULLs gamma/theta/vega/iv", async () => {
    // Write a self-contained parquet fixture with ALL greek columns populated
    // so the test can distinguish "delta round-tripped" from "gamma was NULLed".
    // The shared writeQuoteAndChainFixtures helper omits greek columns
    // entirely, which would make the assertions vacuous (parquet column absent
    // -> quoteParquetColumnExpr emits NULL::DOUBLE regardless of needed-set).
    const quoteDir = join(
      tmpDir,
      "market",
      "option_quote_minutes",
      "underlying=SPX",
      "date=2025-01-06",
    );
    mkdirSync(quoteDir, { recursive: true });
    await conn.run(`
      COPY (
        SELECT 'SPX'::VARCHAR AS underlying,
               '2025-01-06'::VARCHAR AS date,
               'SPXW250108C05000000'::VARCHAR AS ticker,
               '09:35'::VARCHAR AS time,
               10.0::DOUBLE AS bid, 10.4::DOUBLE AS ask, 10.2::DOUBLE AS mid,
               0.45::DOUBLE AS delta, 0.03::DOUBLE AS gamma,
               (-0.10)::DOUBLE AS theta, 0.20::DOUBLE AS vega, 0.15::DOUBLE AS iv
      ) TO '${join(quoteDir, "data.parquet")}' (FORMAT PARQUET);
    `);

    // Also need a chain file so the DTE join does not drop the row.
    const chainDir = join(
      tmpDir,
      "market",
      "option_chain",
      "underlying=SPX",
      "date=2025-01-06",
    );
    mkdirSync(chainDir, { recursive: true });
    await conn.run(`
      COPY (
        SELECT 'SPX'::VARCHAR AS underlying,
               '2025-01-06'::VARCHAR AS date,
               'SPXW250108C05000000'::VARCHAR AS ticker,
               'call'::VARCHAR AS contract_type,
               5000.0::DOUBLE AS strike,
               '2025-01-08'::VARCHAR AS expiration
      ) TO '${join(chainDir, "data.parquet")}' (FORMAT PARQUET);
    `);

    const rows = await readOptionQuoteSnapshotsWindow({
      conn,
      dataDir: tmpDir,
      underlying: "SPX",
      dates: ["2025-01-06"],
      timeStart: "09:35",
      timeEnd: "09:35",
      contractTypes: ["call"],
      dteMin: 0,
      dteMax: 30,
      neededGreeks: ["delta"],
    });

    let rowsChecked = 0;
    for (const ticker of rows.keys()) {
      for (const row of rows.get(ticker) ?? []) {
        rowsChecked++;
        // delta must round-trip: this would be null if the projection
        // accidentally NULLed it despite delta being in needed.
        expect(row.delta).not.toBeNull();
        expect(row.delta).toBeCloseTo(0.45, 5);
        // gamma/theta/vega/iv must be null even though parquet has values:
        // this would round-trip the parquet value if neededGreeks were
        // not threaded through to quoteParquetGreekProjection.
        expect(row.gamma).toBeNull();
        expect(row.theta).toBeNull();
        expect(row.vega).toBeNull();
        expect(row.iv).toBeNull();
      }
    }
    expect(rowsChecked).toBeGreaterThan(0);
  });

  it("applies per-leg OR-combined predicates when legFilters is supplied", async () => {
    await writeMultiStrikeFixtures();

    // Two independent-delta leg shapes: puts with strikes [5800, 5900] and
    // calls with strikes [5950, 6100]. Rows outside either leg's strike
    // window must be dropped.
    const rowsByTicker = await readOptionQuoteSnapshotsWindow({
      conn,
      dataDir: tmpDir,
      underlying: "SPX",
      dates: ["2025-01-06"],
      timeStart: "14:30",
      timeEnd: "14:30",
      legFilters: [
        { contractType: "put", dteMin: 1, dteMax: 3, strikeMin: 5800, strikeMax: 5900 },
        { contractType: "call", dteMin: 1, dteMax: 3, strikeMin: 5950, strikeMax: 6100 },
      ],
    });

    const tickers = new Set(rowsByTicker.keys());
    expect(tickers.has("SPXW250108P05800000")).toBe(true);
    expect(tickers.has("SPXW250108P05850000")).toBe(true);
    expect(tickers.has("SPXW250108C05950000")).toBe(true);
    expect(tickers.has("SPXW250108C06050000")).toBe(true);
    // Outside either leg's strike window:
    expect(tickers.has("SPXW250108P05700000")).toBe(false);
    expect(tickers.has("SPXW250108C06200000")).toBe(false);
  });
});

