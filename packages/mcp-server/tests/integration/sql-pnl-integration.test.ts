/**
 * Integration test: SQL P&L path (via buildSqlPnlQuery) matches JS P&L path
 * (via computeStrategyPnlPath) against a real in-memory DuckDB instance.
 *
 * Also verifies NBBO mark interpolation: when bid/ask is null, SQL uses
 * LAG((bid+ask)/2 IGNORE NULLS) to carry forward the last mid price.
 *
 * Phase 83-03
 */

import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import {
  buildSqlPnlQuery,
  type SqlPnlParams,
  computeStrategyPnlPath,
  type ReplayLeg,
  type BarRow,
} from "../../src/test-exports.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestDb(): Promise<{ db: DuckDBInstance; conn: DuckDBConnection }> {
  const db = await DuckDBInstance.create(":memory:");
  const conn = await db.connect();

  await conn.run(`CREATE SCHEMA IF NOT EXISTS market`);
  // Phase 4 Plan 04-04: buildSqlPnlQuery now reads from
  // market.option_quote_minutes with `mid` fallback (Pitfall 10).
  await conn.run(`
    CREATE TABLE IF NOT EXISTS market.option_quote_minutes (
      underlying      VARCHAR NOT NULL,
      date            VARCHAR NOT NULL,
      ticker          VARCHAR NOT NULL,
      time            VARCHAR NOT NULL,
      bid             DOUBLE,
      ask             DOUBLE,
      mid             DOUBLE,
      last_updated_ns BIGINT,
      source          VARCHAR,
      PRIMARY KEY (underlying, date, ticker, time)
    )
  `);

  return { db, conn };
}

async function insertBar(
  conn: DuckDBConnection,
  ticker: string,
  date: string,
  time: string,
  close: number,
  bid?: number,
  ask?: number,
): Promise<void> {
  const bidVal = bid != null ? bid : "NULL";
  const askVal = ask != null ? ask : "NULL";
  // Pre-compute the `mid` fallback column from `close` (the legacy fixture
  // bars all have well-defined closes that approximate the NBBO mid).
  // Underlying is hard-coded to 'SPX' since both fixture tickers are SPXW.
  await conn.run(`
    INSERT INTO market.option_quote_minutes
      (underlying, date, ticker, time, bid, ask, mid, last_updated_ns, source)
    VALUES
      ('SPX', '${date}', '${ticker}', '${time}', ${bidVal}, ${askVal}, ${close}, NULL, 'fixture')
  `);
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const LEG0_TICKER = "SPXW250110P05900000"; // short put
const LEG1_TICKER = "SPXW250110P05850000"; // long put

const ENTRY_PRICE_0 = 15.0; // short put entry
const ENTRY_PRICE_1 = 8.5;  // long put entry

// Bars at 3 timestamps for both legs
// 09:31 — both legs have bid/ask (quoted)
// 09:32 — both legs have bid/ask (quoted)
// 09:33 — leg 0 has bid/ask, leg 1 has NULL bid/ask (tests NBBO interpolation)
const BARS = [
  // Leg 0: short put
  { ticker: LEG0_TICKER, date: "2025-01-06", time: "09:31", close: 14.50, bid: 14.00, ask: 15.00 },
  { ticker: LEG0_TICKER, date: "2025-01-06", time: "09:32", close: 13.80, bid: 13.50, ask: 14.10 },
  { ticker: LEG0_TICKER, date: "2025-01-06", time: "09:33", close: 13.20, bid: 12.90, ask: 13.50 },
  // Leg 1: long put
  { ticker: LEG1_TICKER, date: "2025-01-06", time: "09:31", close: 8.00, bid: 7.50, ask: 8.50 },
  { ticker: LEG1_TICKER, date: "2025-01-06", time: "09:32", close: 7.60, bid: 7.30, ask: 7.90 },
  // 09:33: bid/ask NULL — SQL should use LAG'd mid from 09:32 = (7.30+7.90)/2 = 7.60
  { ticker: LEG1_TICKER, date: "2025-01-06", time: "09:33", close: 7.40 },
];

// ReplayLegs for JS path (matching the SQL params)
const REPLAY_LEGS: ReplayLeg[] = [
  { occTicker: LEG0_TICKER, entryPrice: ENTRY_PRICE_0, quantity: -1, multiplier: 100 },
  { occTicker: LEG1_TICKER, entryPrice: ENTRY_PRICE_1, quantity: 1, multiplier: 100 },
];

// SqlPnlParams for SQL path — Phase 4 Plan 04-04: each leg now requires
// `underlying` for partition pruning (Pitfall 10).
const SQL_PARAMS: SqlPnlParams = {
  legs: [
    { ticker: LEG0_TICKER, underlying: 'SPX', entryPrice: ENTRY_PRICE_0, quantity: -1, multiplier: 100 },
    { ticker: LEG1_TICKER, underlying: 'SPX', entryPrice: ENTRY_PRICE_1, quantity: 1, multiplier: 100 },
  ],
  fromDate: "2025-01-06",
  toDate: "2025-01-10", // covers full expiration
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SQL P&L integration: SQL matches JS output", () => {
  let db: DuckDBInstance;
  let conn: DuckDBConnection;

  beforeAll(async () => {
    ({ db, conn } = await createTestDb());
    for (const bar of BARS) {
      await insertBar(conn, bar.ticker, bar.date, bar.time, bar.close, bar.bid, bar.ask);
    }
  });

  afterAll(async () => {
    conn.closeSync();
    db.closeSync();
  });

  test("SQL strategy_pnl matches JS computeStrategyPnlPath on quoted bars", async () => {
    // Compare only timestamps where ALL legs have bid/ask (quoted bars).
    // At 09:33, leg 1 has null bid/ask: JS uses close (7.40), SQL uses LAG'd mid (7.60).
    // That divergence is INTENDED (NBBO interpolation) — tested separately below.

    // --- JS path ---
    const leg0Bars: BarRow[] = BARS
      .filter(b => b.ticker === LEG0_TICKER)
      .map(b => ({
        ticker: b.ticker, date: b.date, time: b.time,
        open: b.close, high: b.close, low: b.close, close: b.close,
        bid: b.bid, ask: b.ask, volume: 0,
      }));
    const leg1Bars: BarRow[] = BARS
      .filter(b => b.ticker === LEG1_TICKER)
      .map(b => ({
        ticker: b.ticker, date: b.date, time: b.time,
        open: b.close, high: b.close, low: b.close, close: b.close,
        bid: b.bid, ask: b.ask, volume: 0,
      }));

    const jsPnlPath = computeStrategyPnlPath(REPLAY_LEGS, [leg0Bars, leg1Bars]);
    expect(jsPnlPath.length).toBe(3);

    // --- SQL path ---
    const sql = buildSqlPnlQuery(SQL_PARAMS);
    const result = await conn.runAndReadAll(sql);
    const rows = result.getRows() as unknown[][];

    expect(rows.length).toBe(3);

    // Compare first 2 timestamps (both legs fully quoted — SQL and JS identical)
    for (let i = 0; i < 2; i++) {
      const sqlPnl = Number(rows[i][1]);
      const jsPnl = jsPnlPath[i].strategyPnl;
      expect(Math.abs(sqlPnl - jsPnl)).toBeLessThan(0.02);
    }
  });

  test("SQL uses NBBO interpolation: null bid/ask falls back to LAG'd mid", async () => {
    const sql = buildSqlPnlQuery(SQL_PARAMS);
    const result = await conn.runAndReadAll(sql);
    const rows = result.getRows() as unknown[][];

    // Row at 09:33: leg 1 has null bid/ask, SQL should use LAG'd mid = 7.60
    // Leg 0 mid at 09:33 = (12.90+13.50)/2 = 13.20
    // Leg 0 P&L = (13.20 - 15.00) * -1 * 100 = 180.00
    // Leg 1 mid at 09:33 (via LAG) = (7.30+7.90)/2 = 7.60
    // Leg 1 P&L = (7.60 - 8.50) * 1 * 100 = -90.00
    // Strategy P&L = 180.00 + (-90.00) = 90.00
    const lastRow = rows[2];
    const sqlPnl = Number(lastRow[1]);

    // Verify with known values
    const expectedLeg0Pnl = (13.20 - ENTRY_PRICE_0) * -1 * 100; // 180.00
    const expectedLeg1Pnl = (7.60 - ENTRY_PRICE_1) * 1 * 100;   // -90.00
    const expectedTotal = expectedLeg0Pnl + expectedLeg1Pnl;     // 90.00

    expect(Math.abs(sqlPnl - expectedTotal)).toBeLessThan(0.02);
  });

  test("SQL all_sync correctly flags timestamps where not all legs have data", async () => {
    // All 3 timestamps have data for both legs (even null bid/ask has a row)
    const sql = buildSqlPnlQuery(SQL_PARAMS);
    const result = await conn.runAndReadAll(sql);
    const rows = result.getRows() as unknown[][];

    for (const row of rows) {
      const legsPresent = Number(row[2]);
      const allSync = Boolean(row[3]);
      expect(legsPresent).toBe(2);
      expect(allSync).toBe(true);
    }
  });

  test("SQL query executes in under 100ms per run (perf baseline)", async () => {
    const sql = buildSqlPnlQuery(SQL_PARAMS);

    // Warm run
    await conn.runAndReadAll(sql);

    // Timed run
    const start = performance.now();
    await conn.runAndReadAll(sql);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  test("partial sync: timestamps with missing leg data reduce legs_present", async () => {
    // Create a fresh DB with an extra timestamp for leg 0 only
    const { db: db2, conn: conn2 } = await createTestDb();

    // Seed both legs at 09:31
    await insertBar(conn2, LEG0_TICKER, "2025-01-07", "09:31", 14.50, 14.00, 15.00);
    await insertBar(conn2, LEG1_TICKER, "2025-01-07", "09:31", 8.00, 7.50, 8.50);
    // Only leg 0 at 09:32
    await insertBar(conn2, LEG0_TICKER, "2025-01-07", "09:32", 13.80, 13.50, 14.10);

    const params: SqlPnlParams = {
      legs: SQL_PARAMS.legs,
      fromDate: "2025-01-07",
      toDate: "2025-01-10",
    };
    const sql = buildSqlPnlQuery(params);
    const result = await conn2.runAndReadAll(sql);
    const rows = result.getRows() as unknown[][];

    // 09:31: both legs present, 09:32: only leg 0 present (leg 1 forward-filled)
    expect(rows.length).toBe(2);

    // At 09:31: legs_present=2, all_sync=true
    expect(Number(rows[0][2])).toBe(2);
    expect(Boolean(rows[0][3])).toBe(true);

    // At 09:32: sync_0=1 (real data), sync_1=0 (forward-filled) → legs_present=1
    expect(Number(rows[1][2])).toBe(1);
    expect(Boolean(rows[1][3])).toBe(false);

    conn2.closeSync();
    db2.closeSync();
  });
});
