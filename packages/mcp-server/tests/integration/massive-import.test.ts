import { jest } from "@jest/globals";

/**
 * Integration tests for importFromApi()
 *
 * Tests the full import pipeline:
 *   Mocked fetch → fetchBars() → importFromApi() → real DuckDB → enrichment
 *
 * Uses real DuckDB (in-memory) with jest.spyOn(globalThis, 'fetch') to intercept
 * HTTP calls. Tests three import paths: daily, context, intraday.
 *
 * Requirements: TST-02, IMP-04
 */

import { DuckDBInstance, DuckDBConnection } from "@duckdb/node-api";
import { importFromApi } from "../../src/utils/market-importer.js";
import { ensureMarketTables } from "../../src/db/market-schemas.js";
import type { MassiveAggregateResponse } from "../../src/utils/providers/massive.js";

// =============================================================================
// Test helpers
// =============================================================================

/**
 * Build a valid Massive API response for a ticker.
 * Each bar must have all required fields: v, vw, o, c, h, l, t, n.
 */
function buildMassiveResponse(
  ticker: string,
  bars: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>
): MassiveAggregateResponse {
  return {
    ticker,
    queryCount: bars.length,
    resultsCount: bars.length,
    adjusted: false,
    results: bars.map((b) => ({
      t: b.t,
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
      v: b.v,
      vw: (b.h + b.l) / 2,
      n: 100,
    })),
    status: "OK",
    request_id: "test-req-id",
  };
}

/**
 * Mock fetch — intercepts calls and routes by ticker pattern in URL.
 * Unmatched URLs return HTTP 404.
 */
function mockFetch(responses: Map<string, MassiveAggregateResponse>): jest.SpiedFunction<typeof globalThis.fetch> {
  return jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [tickerPattern, response] of responses) {
      if (url.includes(tickerPattern)) {
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response("Not Found", { status: 404, statusText: "Not Found" });
  });
}

/**
 * Generate N trading-day-like bars starting from a base Unix ms timestamp.
 * Each bar is offset by 1 day (86_400_000 ms). Timestamps are at noon ET
 * (17:00 UTC) to ensure unambiguous date conversion.
 *
 * Bars use realistic prices between minPrice and maxPrice.
 */
function generateBars(
  count: number,
  startMs: number,
  minPrice: number,
  maxPrice: number
): Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> {
  const bars = [];
  const DAY_MS = 86_400_000;
  let price = (minPrice + maxPrice) / 2;
  for (let i = 0; i < count; i++) {
    const t = startMs + i * DAY_MS;
    // Simulate small random-ish price movement using index
    const variation = Math.sin(i * 0.3) * ((maxPrice - minPrice) * 0.1);
    const open = price;
    const close = Math.max(minPrice, Math.min(maxPrice, price + variation));
    const high = Math.max(open, close) + Math.abs(variation) * 0.5;
    const low = Math.min(open, close) - Math.abs(variation) * 0.5;
    bars.push({ t, o: open, h: high, l: low, c: close, v: 1_000_000 });
    price = close;
  }
  return bars;
}

// Five specific SPX-like bars for Jan 2–8, 2024 (noon ET = 17:00 UTC)
// 2024-01-02 12:00 ET = 1704218400000 ms
const SPX_BARS_5 = [
  { t: 1704218400000, o: 4745, h: 4800, l: 4730, c: 4790, v: 1_500_000 },
  { t: 1704304800000, o: 4790, h: 4820, l: 4770, c: 4810, v: 1_400_000 },
  { t: 1704391200000, o: 4810, h: 4850, l: 4795, c: 4840, v: 1_600_000 },
  { t: 1704477600000, o: 4840, h: 4860, l: 4820, c: 4835, v: 1_300_000 },
  { t: 1704736800000, o: 4835, h: 4880, l: 4810, c: 4860, v: 1_450_000 },
];

// Five intraday minute bars for 2024-01-02, at HH:MM ET
// 2024-01-02 is in EST (UTC-5): 09:30 ET = 14:30 UTC = 1704205800000 ms
const INTRADAY_BARS = [
  { t: 1704205800000, o: 4745, h: 4750, l: 4740, c: 4748, v: 100_000 }, // 09:30 ET
  { t: 1704205860000, o: 4748, h: 4752, l: 4745, c: 4750, v: 80_000 },  // 09:31 ET
  { t: 1704205920000, o: 4750, h: 4755, l: 4748, c: 4753, v: 70_000 },  // 09:32 ET
];

// =============================================================================
// Test suite
// =============================================================================

describe("import_from_api integration", () => {
  let db: DuckDBInstance;
  let conn: DuckDBConnection;

  beforeEach(async () => {
    // Use in-memory analytics + in-memory market attachment
    db = await DuckDBInstance.create(":memory:", { enable_external_access: "true" });
    conn = await db.connect();
    await conn.run(`ATTACH ':memory:' AS market`);
    await ensureMarketTables(conn);
    process.env.MASSIVE_API_KEY = "test-key-integration";
  });

  afterEach(async () => {
    delete process.env.MASSIVE_API_KEY;
    jest.restoreAllMocks();
    conn.closeSync();
    // db.close() is handled by GC for in-memory instances
  });

  // ---------------------------------------------------------------------------
  // Daily import tests
  // ---------------------------------------------------------------------------

  describe("daily import", () => {
    test("inserts 5 OHLCV rows into market.daily with correct values", async () => {
      const spxResponse = buildMassiveResponse("I:SPX", SPX_BARS_5);
      mockFetch(new Map([["I%3ASPX", spxResponse]]));

      const result = await importFromApi(conn, {
        ticker: "SPX",
        from: "2024-01-02",
        to: "2024-01-08",
        targetTable: "daily",
        skipEnrichment: true,
      });

      expect(result.rowsInserted).toBe(5);
      expect(result.inputRowCount).toBe(5);

      // Verify rows in DuckDB
      const countResult = await conn.runAndReadAll(
        "SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'"
      );
      expect(Number(countResult.getRows()[0][0])).toBe(5);

      // Verify specific OHLCV values for Jan 2
      const row = await conn.runAndReadAll(
        "SELECT open, high, low, close FROM market.daily WHERE ticker = 'SPX' AND date = '2024-01-02'"
      );
      const rows = row.getRows();
      expect(rows).toHaveLength(1);
      expect(Number(rows[0][0])).toBeCloseTo(4745, 0);
      expect(Number(rows[0][1])).toBeCloseTo(4800, 0);
      expect(Number(rows[0][2])).toBeCloseTo(4730, 0);
      expect(Number(rows[0][3])).toBeCloseTo(4790, 0);
    });

    test("upsert does not duplicate rows on re-import of same dates", async () => {
      const spxResponse = buildMassiveResponse("I:SPX", SPX_BARS_5);
      mockFetch(new Map([["I%3ASPX", spxResponse]]));

      // First import
      const result1 = await importFromApi(conn, {
        ticker: "SPX",
        from: "2024-01-02",
        to: "2024-01-08",
        targetTable: "daily",
        skipEnrichment: true,
      });
      expect(result1.rowsInserted).toBe(5);

      // Re-import same dates
      jest.restoreAllMocks();
      mockFetch(new Map([["I%3ASPX", spxResponse]]));

      const result2 = await importFromApi(conn, {
        ticker: "SPX",
        from: "2024-01-02",
        to: "2024-01-08",
        targetTable: "daily",
        skipEnrichment: true,
      });

      // Rows updated, not duplicated
      expect(result2.rowsInserted).toBe(0);
      expect(result2.rowsUpdated).toBe(5);

      // DB count stays at 5, not 10
      const countResult = await conn.runAndReadAll(
        "SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'"
      );
      expect(Number(countResult.getRows()[0][0])).toBe(5);
    });

    test("auto-enrichment populates Tier 1 fields after import (skipEnrichment=false)", async () => {
      // Need enough bars for RSI (14+ bars). Generate 20 SPX bars.
      const bars20 = generateBars(20, 1704218400000, 4700, 4800);
      const spxResponse = buildMassiveResponse("I:SPX", bars20);
      mockFetch(new Map([["I%3ASPX", spxResponse]]));

      const result = await importFromApi(conn, {
        ticker: "SPX",
        from: "2024-01-02",
        to: "2024-01-31",
        targetTable: "daily",
        skipEnrichment: false,
      });

      expect(result.enrichment.status).toBe("complete");
      expect(result.rowsInserted).toBe(20);

      // Verify enrichment ran — RSI_14 should be populated on the last bar
      const enriched = await conn.runAndReadAll(
        "SELECT RSI_14 FROM market.daily WHERE ticker = 'SPX' AND RSI_14 IS NOT NULL ORDER BY date DESC LIMIT 1"
      );
      expect(enriched.getRows().length).toBeGreaterThan(0);
      const rsi = Number(enriched.getRows()[0][0]);
      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThan(100);
    });

    test("skipEnrichment=true leaves enrichment.status as skipped", async () => {
      const spxResponse = buildMassiveResponse("I:SPX", SPX_BARS_5);
      mockFetch(new Map([["I%3ASPX", spxResponse]]));

      const result = await importFromApi(conn, {
        ticker: "SPX",
        from: "2024-01-02",
        to: "2024-01-08",
        targetTable: "daily",
        skipEnrichment: true,
      });

      expect(result.enrichment.status).toBe("skipped");
    });

    test("dry_run=true returns inputRowCount > 0 but writes no rows to DuckDB", async () => {
      const spxResponse = buildMassiveResponse("I:SPX", SPX_BARS_5);
      mockFetch(new Map([["I%3ASPX", spxResponse]]));

      const result = await importFromApi(conn, {
        ticker: "SPX",
        from: "2024-01-02",
        to: "2024-01-08",
        targetTable: "daily",
        dryRun: true,
      });

      expect(result.rowsInserted).toBe(0);
      expect(result.inputRowCount).toBe(5);
      expect(result.enrichment.status).toBe("skipped");

      // Verify nothing written
      const countResult = await conn.runAndReadAll(
        "SELECT COUNT(*) FROM market.daily WHERE ticker = 'SPX'"
      );
      expect(Number(countResult.getRows()[0][0])).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Context import tests
  // ---------------------------------------------------------------------------

  describe("context import", () => {
    test("makes 3 fetch calls (VIX, VIX9D, VIX3M) and merges rows by date", async () => {
      const vixBars = SPX_BARS_5.map((b) => ({
        ...b,
        o: 14 + (b.o - 4745) / 200,
        h: 15 + (b.h - 4800) / 200,
        l: 13 + (b.l - 4730) / 200,
        c: 14.5 + (b.c - 4790) / 200,
      }));
      const vix9dBars = vixBars.map((b) => ({ ...b, o: b.o * 0.9, h: b.h * 0.9, l: b.l * 0.9, c: b.c * 0.9 }));
      const vix3mBars = vixBars.map((b) => ({ ...b, o: b.o * 1.1, h: b.h * 1.1, l: b.l * 1.1, c: b.c * 1.1 }));

      const fetchSpy = mockFetch(
        new Map([
          ["I%3AVIX9D", buildMassiveResponse("I:VIX9D", vix9dBars)],
          ["I%3AVIX3M", buildMassiveResponse("I:VIX3M", vix3mBars)],
          ["I%3AVIX", buildMassiveResponse("I:VIX", vixBars)],
        ])
      );

      const result = await importFromApi(conn, {
        ticker: "VIX",
        from: "2024-01-02",
        to: "2024-01-08",
        targetTable: "context",
        skipEnrichment: true,
      });

      // Should have made exactly 3 fetch calls
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      // Phase 75: VIX/VIX9D/VIX3M stored as separate ticker rows in market.daily (5 dates * 3 tickers = 15)
      expect(result.rowsInserted).toBe(15);

      // Verify each ticker has a row for 2024-01-02 with open/close values
      const vixRow = await conn.runAndReadAll(
        "SELECT open, close FROM market.daily WHERE ticker = 'VIX' AND date = '2024-01-02'"
      );
      const vix9dRow = await conn.runAndReadAll(
        "SELECT open, close FROM market.daily WHERE ticker = 'VIX9D' AND date = '2024-01-02'"
      );
      const vix3mRow = await conn.runAndReadAll(
        "SELECT open, close FROM market.daily WHERE ticker = 'VIX3M' AND date = '2024-01-02'"
      );
      expect(vixRow.getRows()).toHaveLength(1);
      expect(vix9dRow.getRows()).toHaveLength(1);
      expect(vix3mRow.getRows()).toHaveLength(1);
      // All rows should have non-null, positive open/close values
      for (const result of [vixRow, vix9dRow, vix3mRow]) {
        const row = result.getRows()[0];
        expect(Number(row[0])).toBeGreaterThan(0); // open
        expect(Number(row[1])).toBeGreaterThan(0); // close
      }
    });

    test("context import with 260 bars: IVR/IVP columns populated after enrichment", async () => {
      // IVR and IVP require a 252-bar lookback window, so we need 252+ bars
      const COUNT = 260;
      // Generate 260 days starting from 2023-01-03 (first trading day 2023)
      // 2023-01-03 12:00 ET = 1672758000000 ms (approx)
      const START_MS = 1672758000000;

      const vixBars = generateBars(COUNT, START_MS, 12, 25);
      const vix9dBars = generateBars(COUNT, START_MS, 10, 22);
      const vix3mBars = generateBars(COUNT, START_MS, 14, 27);

      mockFetch(
        new Map([
          ["I%3AVIX9D", buildMassiveResponse("I:VIX9D", vix9dBars)],
          ["I%3AVIX3M", buildMassiveResponse("I:VIX3M", vix3mBars)],
          ["I%3AVIX", buildMassiveResponse("I:VIX", vixBars)],
        ])
      );

      const result = await importFromApi(conn, {
        ticker: "VIX",
        from: "2023-01-03",
        to: "2023-12-29",
        targetTable: "context",
        skipEnrichment: false,
      });

      expect(result.enrichment.status).toBe("complete");
      // Phase 75: VIX/VIX9D/VIX3M stored as separate ticker rows (COUNT * 3 tickers)
      expect(result.rowsInserted).toBe(COUNT * 3);

      // VIX ivr/ivp should be populated for at least one row (the 252nd+ bar) in market.daily
      const ivrRows = await conn.runAndReadAll(
        "SELECT ticker, ivr, ivp FROM market.daily WHERE ivr IS NOT NULL AND ticker IN ('VIX', 'VIX9D', 'VIX3M') LIMIT 6"
      );
      expect(ivrRows.getRows().length).toBeGreaterThan(0);

      const firstRow = ivrRows.getRows()[0];
      // IVR/IVP values should be between 0 and 100
      const ivr = Number(firstRow[1]);
      const ivp = Number(firstRow[2]);
      expect(ivr).toBeGreaterThanOrEqual(0);
      expect(ivr).toBeLessThanOrEqual(100);
      expect(ivp).toBeGreaterThanOrEqual(0);
      expect(ivp).toBeLessThanOrEqual(100);

      // VIX9D and VIX3M IVR also populated
      const vix9dIvrRows = await conn.runAndReadAll(
        "SELECT ivr FROM market.daily WHERE ticker = 'VIX9D' AND ivr IS NOT NULL LIMIT 1"
      );
      const vix3mIvrRows = await conn.runAndReadAll(
        "SELECT ivr FROM market.daily WHERE ticker = 'VIX3M' AND ivr IS NOT NULL LIMIT 1"
      );
      expect(vix9dIvrRows.getRows().length).toBeGreaterThan(0);
      expect(vix3mIvrRows.getRows().length).toBeGreaterThan(0);
    });

    test("context dry_run writes no rows to DuckDB", async () => {
      const vixBars = SPX_BARS_5.map((b) => ({ ...b, o: 14, h: 15, l: 13, c: 14.5 }));
      mockFetch(
        new Map([
          ["I%3AVIX9D", buildMassiveResponse("I:VIX9D", vixBars)],
          ["I%3AVIX3M", buildMassiveResponse("I:VIX3M", vixBars)],
          ["I%3AVIX", buildMassiveResponse("I:VIX", vixBars)],
        ])
      );

      const result = await importFromApi(conn, {
        ticker: "VIX",
        from: "2024-01-02",
        to: "2024-01-08",
        targetTable: "context",
        dryRun: true,
      });

      expect(result.rowsInserted).toBe(0);
      // Phase 75: 5 dates * 3 tickers (VIX, VIX9D, VIX3M) = 15 input rows
      expect(result.inputRowCount).toBe(15);

      // No rows written to market.daily for VIX tickers
      const countResult = await conn.runAndReadAll(
        "SELECT COUNT(*) FROM market.daily WHERE ticker IN ('VIX', 'VIX9D', 'VIX3M')"
      );
      expect(Number(countResult.getRows()[0][0])).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Intraday import tests
  // ---------------------------------------------------------------------------

  describe("intraday import", () => {
    test("inserts bars into market.intraday with time field in HH:MM format", async () => {
      const spxIntradayResponse = buildMassiveResponse("I:SPX", INTRADAY_BARS);
      mockFetch(new Map([["I%3ASPX", spxIntradayResponse]]));

      const result = await importFromApi(conn, {
        ticker: "SPX",
        from: "2024-01-02",
        to: "2024-01-02",
        targetTable: "intraday",
        timespan: "minute",
        multiplier: 1,
      });

      expect(result.rowsInserted).toBe(3);

      // Verify time field is HH:MM format
      const timeRows = await conn.runAndReadAll(
        "SELECT time FROM market.intraday WHERE ticker = 'SPX' AND date = '2024-01-02' ORDER BY time"
      );
      const rows = timeRows.getRows();
      expect(rows).toHaveLength(3);
      // time should be in HH:MM format (ET) — 09:30, 09:31, 09:32
      for (const row of rows) {
        const time = String(row[0]);
        expect(time).toMatch(/^\d{2}:\d{2}$/);
      }
      // First bar should be 09:30 ET
      expect(String(rows[0][0])).toBe("09:30");
    });

    test("intraday enrichment.status is skipped (intraday table not enriched)", async () => {
      const spxIntradayResponse = buildMassiveResponse("I:SPX", INTRADAY_BARS);
      mockFetch(new Map([["I%3ASPX", spxIntradayResponse]]));

      const result = await importFromApi(conn, {
        ticker: "SPX",
        from: "2024-01-02",
        to: "2024-01-02",
        targetTable: "intraday",
        timespan: "minute",
      });

      // Intraday never triggers enrichment
      expect(result.enrichment.status).toBe("skipped");
    });

    test("intraday dry_run writes no rows", async () => {
      const spxIntradayResponse = buildMassiveResponse("I:SPX", INTRADAY_BARS);
      mockFetch(new Map([["I%3ASPX", spxIntradayResponse]]));

      const result = await importFromApi(conn, {
        ticker: "SPX",
        from: "2024-01-02",
        to: "2024-01-02",
        targetTable: "intraday",
        dryRun: true,
      });

      expect(result.rowsInserted).toBe(0);
      expect(result.inputRowCount).toBe(3);

      const countResult = await conn.runAndReadAll(
        "SELECT COUNT(*) FROM market.intraday WHERE ticker = 'SPX'"
      );
      expect(Number(countResult.getRows()[0][0])).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe("error handling", () => {
    test("missing MASSIVE_API_KEY returns clear error", async () => {
      delete process.env.MASSIVE_API_KEY;

      await expect(
        importFromApi(conn, {
          ticker: "SPX",
          from: "2024-01-02",
          to: "2024-01-08",
          targetTable: "daily",
        })
      ).rejects.toThrow(/MASSIVE_API_KEY/i);
    });
  });
});
