/**
 * Integration test: D-30 half-quote scenario for utils/sql-pnl.ts.
 *
 * Verifies post-Phase-4-04 behavior where buildSqlPnlQuery generates a
 * `FROM market.option_quote_minutes WHERE underlying = ...` query with a
 * COALESCE((bid+ask)/2, LAG (bid+ask)/2 IGNORE NULLS, mid) mark fallback —
 * specifically the `mid` fallback (not `close` — column doesn't exist on
 * option_quote_minutes per Pitfall 10).
 *
 * Two cases:
 *   1. Half-quote: a minute with bid=NULL, ask=NULL, mid=4.50 must fall through
 *      the COALESCE and produce mark=4.50 for that minute. P&L math does NOT crash.
 *   2. Normal: every minute has bid+ask present → mark = (bid+ask)/2.
 */

import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import {
  buildSqlPnlQuery,
  type SqlPnlParams,
} from "../../src/test-exports.js";

// ---------------------------------------------------------------------------
// Fixture: in-memory DuckDB with market.option_quote_minutes (post-04-04 schema)
// ---------------------------------------------------------------------------

const TICKER = "SPXW250110P05900000";
const UNDERLYING = "SPX";

async function createTestDb(): Promise<{ db: DuckDBInstance; conn: DuckDBConnection }> {
  const db = await DuckDBInstance.create(":memory:");
  const conn = await db.connect();

  await conn.run(`CREATE SCHEMA IF NOT EXISTS market`);
  // Match the production schema in market-schemas.ts for option_quote_minutes —
  // PK (underlying, date, ticker, time); columns include `mid` (D-30 fallback).
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

interface QuoteRow {
  time: string;
  bid: number | null;
  ask: number | null;
  mid: number;
}

async function insertQuotes(
  conn: DuckDBConnection,
  date: string,
  rows: QuoteRow[],
): Promise<void> {
  for (const r of rows) {
    const bid = r.bid != null ? String(r.bid) : "NULL";
    const ask = r.ask != null ? String(r.ask) : "NULL";
    await conn.run(`
      INSERT INTO market.option_quote_minutes
        (underlying, date, ticker, time, bid, ask, mid, last_updated_ns, source)
      VALUES
        ('${UNDERLYING}', '${date}', '${TICKER}', '${r.time}',
         ${bid}, ${ask}, ${r.mid}, NULL, 'fixture')
    `);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sql-pnl.ts — D-30 half-quote scenario (post-04-04)", () => {
  let db: DuckDBInstance;
  let conn: DuckDBConnection;

  beforeAll(async () => {
    ({ db, conn } = await createTestDb());
  });

  afterAll(async () => {
    conn.closeSync();
    db.closeSync();
  });

  it("normal case: every minute has bid/ask → mark = (bid+ask)/2", async () => {
    const date = "2025-01-06";
    await insertQuotes(conn, date, [
      { time: "09:30", bid: 14.00, ask: 15.00, mid: 14.50 },
      { time: "09:31", bid: 13.80, ask: 14.20, mid: 14.00 },
      { time: "09:32", bid: 13.60, ask: 14.00, mid: 13.80 },
      { time: "09:33", bid: 13.40, ask: 13.80, mid: 13.60 },
      { time: "09:34", bid: 13.20, ask: 13.60, mid: 13.40 },
    ]);

    const params: SqlPnlParams = {
      legs: [
        {
          ticker: TICKER,
          underlying: UNDERLYING,
          entryPrice: 15.0,
          quantity: -1,
          multiplier: 100,
        },
      ],
      fromDate: date,
      toDate: date,
    };

    const sql = buildSqlPnlQuery(params);
    // Sanity: query references option_quote_minutes + underlying filter (Pitfall 10).
    expect(sql).toContain("FROM market.option_quote_minutes");
    expect(sql).toContain(`underlying = '${UNDERLYING}'`);
    // Sanity: the `close` fallback is gone (column doesn't exist post-Phase-4).
    expect(sql).not.toMatch(/,\s*close\s*\)\s*AS mark/);

    const reader = await conn.runAndReadAll(sql);
    const rows = reader.getRows() as unknown[][];
    expect(rows.length).toBe(5);
    // First minute: mark = (14+15)/2 = 14.50; pnl = (14.50 - 15) * -1 * 100 = 50
    const firstPnl = Number(rows[0][1]);
    expect(firstPnl).toBeCloseTo(50, 1);
  });

  it("half-quote case: bid=NULL, ask=NULL on one minute → mark falls through to `mid` column", async () => {
    const date = "2025-01-07";
    // Five minutes; minute 09:32 has NULL bid + NULL ask but mid is still
    // present (e.g. carried forward from the source feed). The COALESCE chain
    // is: (bid+ask)/2 → LAG → mid. Since bid+ask is NULL on 09:32 AND the
    // prior LAG'd value is from 09:31 (mid 14.00), the LAG step would fire
    // first. To force fall-through to `mid` we make the FIRST minute be the
    // half-quote — no prior LAG value exists.
    await insertQuotes(conn, date, [
      { time: "09:30", bid: null, ask: null, mid: 4.50 },  // half-quote (D-30)
      { time: "09:31", bid: 4.30, ask: 4.50, mid: 4.40 },
      { time: "09:32", bid: 4.40, ask: 4.60, mid: 4.50 },
    ]);

    const params: SqlPnlParams = {
      legs: [
        {
          ticker: TICKER,
          underlying: UNDERLYING,
          entryPrice: 4.50,
          quantity: 1,
          multiplier: 100,
        },
      ],
      fromDate: date,
      toDate: date,
    };

    const sql = buildSqlPnlQuery(params);
    const reader = await conn.runAndReadAll(sql);
    const rows = reader.getRows() as unknown[][];

    expect(rows.length).toBe(3);
    // First row at 09:30 — half-quote with no prior LAG value; mark falls
    // through to `mid` = 4.50. P&L = (4.50 - 4.50) * 1 * 100 = 0. CRITICAL:
    // the math does NOT crash on the NULL bid/ask.
    const firstMark = (4.50 - 4.50) * 1 * 100;
    expect(Number(rows[0][1])).toBeCloseTo(firstMark, 1);

    // Sanity — third row gets mark from (4.40+4.60)/2 = 4.50; pnl = 0.
    expect(Number(rows[2][1])).toBeCloseTo(0, 1);
  });
});
