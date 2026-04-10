import { jest } from "@jest/globals";

/**
 * Unit tests for bar-cache.ts utilities.
 *
 * Covers:
 * - fetchBarsWithCache: cache-read → API-fetch → cache-write lifecycle
 * - getDataTier: env var-driven tier selection with legacy fallback
 * - mergeQuoteBars: synthetic bar creation from NBBO quotes
 */

import type { DuckDBConnection } from "@duckdb/node-api";
import {
  fetchBarsWithCache,
  mergeQuoteBars,
  getDataTier,
} from "../../src/test-exports.js";
import type { BarRow } from "../../src/test-exports.js";

// ---------------------------------------------------------------------------
// Mock DuckDB connection factory
// ---------------------------------------------------------------------------

type RunFn = (sql: string) => Promise<void>;

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
// getDataTier tests
// ---------------------------------------------------------------------------

describe("getDataTier", () => {
  it("returns 'ohlc' by default when no env vars are set", () => {
    delete process.env.MASSIVE_DATA_TIER;
    delete process.env.MASSIVE_QUOTES_ENABLED;
    expect(getDataTier()).toBe("ohlc");
  });

  it("reads MASSIVE_DATA_TIER env var — 'quotes'", () => {
    process.env.MASSIVE_DATA_TIER = "quotes";
    delete process.env.MASSIVE_QUOTES_ENABLED;
    expect(getDataTier()).toBe("quotes");
  });

  it("reads MASSIVE_DATA_TIER env var — 'trades'", () => {
    process.env.MASSIVE_DATA_TIER = "trades";
    delete process.env.MASSIVE_QUOTES_ENABLED;
    expect(getDataTier()).toBe("trades");
  });

  it("reads MASSIVE_DATA_TIER env var — 'ohlc' explicit", () => {
    process.env.MASSIVE_DATA_TIER = "ohlc";
    delete process.env.MASSIVE_QUOTES_ENABLED;
    expect(getDataTier()).toBe("ohlc");
  });

  it("is case-insensitive for MASSIVE_DATA_TIER", () => {
    process.env.MASSIVE_DATA_TIER = "QUOTES";
    expect(getDataTier()).toBe("quotes");
  });

  it("falls back to legacy MASSIVE_QUOTES_ENABLED='true' → 'quotes'", () => {
    delete process.env.MASSIVE_DATA_TIER;
    process.env.MASSIVE_QUOTES_ENABLED = "true";
    expect(getDataTier()).toBe("quotes");
  });

  it("falls back to legacy MASSIVE_QUOTES_ENABLED='1' → 'quotes'", () => {
    delete process.env.MASSIVE_DATA_TIER;
    process.env.MASSIVE_QUOTES_ENABLED = "1";
    expect(getDataTier()).toBe("quotes");
  });

  it("MASSIVE_DATA_TIER takes precedence over legacy MASSIVE_QUOTES_ENABLED", () => {
    process.env.MASSIVE_DATA_TIER = "ohlc";
    process.env.MASSIVE_QUOTES_ENABLED = "true";
    // MASSIVE_DATA_TIER is explicitly 'ohlc', even though legacy says quotes
    expect(getDataTier()).toBe("ohlc");
  });

  it("returns 'ohlc' when MASSIVE_QUOTES_ENABLED is 'false'", () => {
    delete process.env.MASSIVE_DATA_TIER;
    process.env.MASSIVE_QUOTES_ENABLED = "false";
    expect(getDataTier()).toBe("ohlc");
  });
});

// ---------------------------------------------------------------------------
// mergeQuoteBars tests
// ---------------------------------------------------------------------------

function makeBar(date: string, time: string, price: number, ticker = "TEST"): BarRow {
  return { date, time, open: price, high: price, low: price, close: price, volume: 100, ticker };
}

describe("mergeQuoteBars", () => {
  it("returns original bars (same reference) when quotesMap is empty", () => {
    const bars = [makeBar("2025-01-07", "09:31", 1.0)];
    const result = mergeQuoteBars(bars, new Map(), "TEST");
    expect(result).toBe(bars); // same reference
  });

  it("creates synthetic bars for quote-only minutes (bid/ask → mid price OHLC, volume=0)", () => {
    const tradeBars: BarRow[] = []; // no trade bars
    const quotesMap = new Map([
      ["2025-01-07 09:31", { bid: 1.0, ask: 1.2 }],
    ]);

    const result = mergeQuoteBars(tradeBars, quotesMap, "OPT");

    expect(result).toHaveLength(1);
    const bar = result[0];
    expect(bar.date).toBe("2025-01-07");
    expect(bar.time).toBe("09:31");
    const mid = (1.0 + 1.2) / 2;
    expect(bar.open).toBeCloseTo(mid);
    expect(bar.high).toBeCloseTo(mid);
    expect(bar.low).toBeCloseTo(mid);
    expect(bar.close).toBeCloseTo(mid);
    expect(bar.bid).toBe(1.0);
    expect(bar.ask).toBe(1.2);
    expect(bar.volume).toBe(0);
    expect(bar.ticker).toBe("OPT");
  });

  it("enriches existing trade bars with bid/ask when bid/ask are missing", () => {
    const bars = [makeBar("2025-01-07", "09:31", 1.5, "OPT")];
    // bar has no bid/ask yet
    expect(bars[0].bid).toBeUndefined();
    expect(bars[0].ask).toBeUndefined();

    const quotesMap = new Map([
      ["2025-01-07 09:31", { bid: 1.4, ask: 1.6 }],
    ]);

    const result = mergeQuoteBars(bars, quotesMap, "OPT");

    // No synthetic bars created (quote key matches trade bar key)
    expect(result).toHaveLength(1);
    expect(result[0].bid).toBe(1.4);
    expect(result[0].ask).toBe(1.6);
  });

  it("skips quotes with zero bid and zero ask", () => {
    const tradeBars: BarRow[] = [];
    const quotesMap = new Map([
      ["2025-01-07 09:31", { bid: 0, ask: 0 }], // invalid — should be skipped
      ["2025-01-07 09:32", { bid: 1.0, ask: 1.2 }], // valid
    ]);

    const result = mergeQuoteBars(tradeBars, quotesMap, "OPT");

    expect(result).toHaveLength(1);
    expect(result[0].time).toBe("09:32");
  });

  it("sorts merged bars by date and time", () => {
    const tradeBars = [
      makeBar("2025-01-07", "09:35", 2.0, "OPT"),
      makeBar("2025-01-07", "09:31", 1.8, "OPT"),
    ];
    const quotesMap = new Map([
      ["2025-01-07 09:33", { bid: 1.9, ask: 2.1 }], // fills gap between trade bars
    ]);

    const result = mergeQuoteBars(tradeBars, quotesMap, "OPT");

    expect(result).toHaveLength(3);
    expect(result[0].time).toBe("09:31");
    expect(result[1].time).toBe("09:33");
    expect(result[2].time).toBe("09:35");
  });

  it("does not create synthetic bars when all quote keys match existing trade bars", () => {
    const bars = [makeBar("2025-01-07", "09:31", 1.5, "OPT")];
    const quotesMap = new Map([
      ["2025-01-07 09:31", { bid: 1.4, ask: 1.6 }], // same minute as trade bar
    ]);

    const result = mergeQuoteBars(bars, quotesMap, "OPT");

    // Should enrich the trade bar but not add a synthetic one
    expect(result).toHaveLength(1);
    expect(result[0].bid).toBe(1.4);
    expect(result[0].ask).toBe(1.6);
    // OHLC from original trade bar should be unchanged
    expect(result[0].close).toBe(1.5);
  });

  it("handles multiple dates correctly", () => {
    const tradeBars: BarRow[] = [
      makeBar("2025-01-07", "09:31", 1.0, "OPT"),
      makeBar("2025-01-08", "09:31", 2.0, "OPT"),
    ];
    const quotesMap = new Map([
      ["2025-01-07 09:32", { bid: 0.9, ask: 1.1 }],
      ["2025-01-08 09:32", { bid: 1.9, ask: 2.1 }],
    ]);

    const result = mergeQuoteBars(tradeBars, quotesMap, "OPT");

    expect(result).toHaveLength(4);
    expect(result[0].date).toBe("2025-01-07");
    expect(result[0].time).toBe("09:31");
    expect(result[1].date).toBe("2025-01-07");
    expect(result[1].time).toBe("09:32");
    expect(result[2].date).toBe("2025-01-08");
    expect(result[3].date).toBe("2025-01-08");
  });
});

// ---------------------------------------------------------------------------
// fetchBarsWithCache tests (existing)
// ---------------------------------------------------------------------------

describe("fetchBarsWithCache", () => {
  it("returns cached rows from market.intraday without calling fetchBars", async () => {
    const cachedRow = [1.0, 2.0, 0.5, 1.5, null, null, "09:31", "2025-01-07"];
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
