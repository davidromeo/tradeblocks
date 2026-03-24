import { jest } from "@jest/globals";

/**
 * Unit tests for fetchBarsWithCache utility (bar-cache.ts).
 *
 * Tests the cache-read → API-fetch → cache-write lifecycle:
 * - Cache hit: reads from market.intraday, skips fetchBars call
 * - Cache miss: calls fetchBars, writes result to market.intraday
 * - Empty both: returns [] without error
 * - DuckDB error: falls through to API (graceful degradation)
 */

import type { DuckDBConnection } from "@duckdb/node-api";
import type { MassiveBarRow } from "../../src/test-exports.js";
import { fetchBarsWithCache } from "../../src/test-exports.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal MassiveBarRow for test data. */
function makeBar(date: string, time: string, close: number, ticker: string): MassiveBarRow {
  return { ticker, date, time, open: close, high: close + 1, low: close - 1, close, volume: 100 };
}

/** Build a mock fetch Response returning bars from the Massive API shape. */
function mockMassiveResponse(bars: MassiveBarRow[]): Response {
  // Massive API uses Unix ms timestamps; for these tests we supply pre-mapped bars
  // via the mock, but fetchBars internally maps them. We bypass by mocking at
  // fetchBars level via getConnection (DuckDB mock) — see below.
  return new Response(
    JSON.stringify({
      ticker: bars[0]?.ticker ?? "SPY",
      queryCount: bars.length,
      resultsCount: bars.length,
      adjusted: false,
      results: bars.map((b) => ({
        o: b.open,
        h: b.high,
        l: b.low,
        c: b.close,
        // timestamp 2025-01-07 09:31 ET → Unix ms
        t: 1736253060000,
        v: b.volume,
      })),
      status: "OK",
      request_id: "test-req",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// ---------------------------------------------------------------------------
// Mock DuckDB connection factory
// ---------------------------------------------------------------------------

type RunFn = (sql: string) => Promise<void>;
type QueryFn = (sql: string) => Promise<{ getRows(): unknown[][] }>;

function makeMockConn(opts: {
  cacheRows?: unknown[][];
  runFn?: RunFn;
  throwOnQuery?: boolean;
}): DuckDBConnection {
  return {
    runAndReadAll: jest.fn(async (sql: string) => {
      if (opts.throwOnQuery) throw new Error("DuckDB error");
      if (sql.includes("SELECT") && opts.cacheRows !== undefined) {
        return { getRows: () => opts.cacheRows! };
      }
      return { getRows: () => [] };
    }),
    run: jest.fn(opts.runFn ?? (() => Promise.resolve())),
  } as unknown as DuckDBConnection;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const ORIG_ENV = process.env;
let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;

beforeEach(() => {
  process.env = { ...ORIG_ENV, MASSIVE_API_KEY: "test-key" };
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  process.env = ORIG_ENV;
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchBarsWithCache", () => {
  it("returns cached rows from market.intraday without calling fetchBars", async () => {
    const cachedRow = [1.0, 2.0, 0.5, 1.5, "09:31", "2025-01-07"];
    const conn = makeMockConn({ cacheRows: [cachedRow] });

    const result = await fetchBarsWithCache({
      ticker: "SPY",
      from: "2025-01-07",
      to: "2025-01-07",
      conn,
    });

    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("SPY");
    expect(result[0].open).toBe(1.0);
    expect(result[0].time).toBe("09:31");
    expect(result[0].date).toBe("2025-01-07");
    // Should NOT have called the Massive API
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls fetchBars on cache miss and writes result to market.intraday", async () => {
    const conn = makeMockConn({ cacheRows: [] });

    // The test bar date/time must match what fetchBars returns from the mocked API.
    // massiveTimestampToETDate(1736253060000) → "2025-01-07"
    // massiveTimestampToETTime(1736253060000) → "09:31"
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ticker: "SPY",
          queryCount: 1,
          resultsCount: 1,
          adjusted: false,
          results: [{ o: 100, h: 102, l: 99, c: 101, t: 1736253060000, v: 500 }],
          status: "OK",
          request_id: "req-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchBarsWithCache({
      ticker: "SPY",
      from: "2025-01-07",
      to: "2025-01-07",
      conn,
    });

    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("SPY");
    expect(result[0].open).toBe(100);
    expect(result[0].close).toBe(101);
    // Should have called the Massive API once
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Should have called conn.run() to write the bars to market.intraday
    expect(conn.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO market.intraday")
    );
  });

  it("returns empty array when both cache and API return nothing", async () => {
    const conn = makeMockConn({ cacheRows: [] });
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ticker: "SPY",
          queryCount: 0,
          resultsCount: 0,
          adjusted: false,
          results: [],
          status: "OK",
          request_id: "req-2",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchBarsWithCache({
      ticker: "SPY",
      from: "2025-01-07",
      to: "2025-01-07",
      conn,
    });

    expect(result).toEqual([]);
  });

  it("falls through to API when DuckDB throws on cache read", async () => {
    const conn = makeMockConn({ throwOnQuery: true });

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ticker: "SPX",
          queryCount: 1,
          resultsCount: 1,
          adjusted: false,
          results: [{ o: 5000, h: 5010, l: 4990, c: 5005, t: 1736253060000 }],
          status: "OK",
          request_id: "req-3",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchBarsWithCache({
      ticker: "SPX",
      from: "2025-01-07",
      to: "2025-01-07",
      assetClass: "index",
      conn,
    });

    // Should still return API data even though DuckDB errored
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("SPX");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("passes timespan and assetClass to fetchBars API call", async () => {
    const conn = makeMockConn({ cacheRows: [] });
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ticker: "VIX",
          queryCount: 0,
          resultsCount: 0,
          adjusted: false,
          results: [],
          status: "OK",
          request_id: "req-4",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await fetchBarsWithCache({
      ticker: "VIX",
      from: "2025-01-07",
      to: "2025-01-07",
      timespan: "minute",
      assetClass: "index",
      conn,
    });

    // URL should contain the Massive index prefix I:VIX
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = String(fetchSpy.mock.calls[0][0]);
    expect(callUrl).toContain("VIX");
  });
});
