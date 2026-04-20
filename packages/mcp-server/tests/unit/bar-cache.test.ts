import { jest } from "@jest/globals";

/**
 * Unit tests for bar-cache.ts utilities.
 *
 * Phase 4 / D-05 / SEP-01 update: fetchBarsWithCache no longer hits the
 * provider. Cache misses return [] (silent-empty contract). The legacy
 * "calls fetchBars on cache miss + writes to the minute-bar table" tests have
 * been replaced with cache-only assertions matching the strict read/write
 * separation invariant.
 *
 * Phase 6 Wave D: legacy minute-bar view is retired; bar-cache reads now
 * target market.spot (the v3.0 ticker-first minute-bar view).
 *
 * Covers:
 * - fetchBarsWithCache: cache-read only (no API fallback)
 * - getDataTier: env var-driven Massive tier selection
 * - mergeQuoteBars: synthetic bar creation from NBBO quotes
 * - fetchBarsForLegsBulk: bulk multi-date cache reads
 */

import type { DuckDBConnection } from "@duckdb/node-api";
import {
  fetchBarsWithCache,
  fetchBarsForLegsBulk,
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
  queryFn?: (sql: string) => unknown[][] | undefined;
  throwOnQuery?: boolean;
}): DuckDBConnection {
  return {
    runAndReadAll: jest.fn(async (sql: string) => {
      if (opts.throwOnQuery) throw new Error("DuckDB error");
      const rows = opts.queryFn?.(sql);
      if (rows !== undefined) {
        return { getRows: () => rows };
      }
      // Only return cacheRows for market.spot queries, not option_quote_minutes
      if (sql.includes("SELECT") && opts.cacheRows !== undefined && !sql.includes("option_quote_minutes")) {
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
    expect(getDataTier()).toBe("ohlc");
  });

  it("reads MASSIVE_DATA_TIER env var — 'quotes'", () => {
    process.env.MASSIVE_DATA_TIER = "quotes";
    expect(getDataTier()).toBe("quotes");
  });

  it("reads MASSIVE_DATA_TIER env var — 'trades'", () => {
    process.env.MASSIVE_DATA_TIER = "trades";
    expect(getDataTier()).toBe("trades");
  });

  it("reads MASSIVE_DATA_TIER env var — 'ohlc' explicit", () => {
    process.env.MASSIVE_DATA_TIER = "ohlc";
    expect(getDataTier()).toBe("ohlc");
  });

  it("is case-insensitive for MASSIVE_DATA_TIER", () => {
    process.env.MASSIVE_DATA_TIER = "QUOTES";
    expect(getDataTier()).toBe("quotes");
  });

  it("falls back to 'ohlc' for invalid MASSIVE_DATA_TIER values", () => {
    process.env.MASSIVE_DATA_TIER = "premium";
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
  it("returns cached rows from market.spot without calling fetchBars", async () => {
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

  it("returns [] on cache miss WITHOUT calling the provider (D-05 / SEP-01)", async () => {
    const conn = makeMockConn({ cacheRows: [] });

    const result = await fetchBarsWithCache({
      ticker: "SPY",
      from: "2025-01-07",
      to: "2025-01-07",
      conn,
    });

    // Strict silent-empty contract: cache miss means [], not an API call.
    expect(result).toEqual([]);
    // CRITICAL invariant for SEP-01: NO provider fetch is triggered by reads.
    expect(fetchSpy).not.toHaveBeenCalled();
    // No INSERT — the cache-write side is gone too.
    expect(conn.run).not.toHaveBeenCalled();
  });

  it("returns [] when DuckDB throws on cache read (silent-empty)", async () => {
    const conn = makeMockConn({ throwOnQuery: true });

    const result = await fetchBarsWithCache({
      ticker: "SPX",
      from: "2025-01-07",
      to: "2025-01-07",
      assetClass: "index",
      conn,
    });

    expect(result).toEqual([]);
    // Even on DuckDB error, the function MUST NOT fall back to the provider.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never triggers a provider fetch even when timespan/assetClass are set", async () => {
    const conn = makeMockConn({ cacheRows: [] });

    const result = await fetchBarsWithCache({
      ticker: "VIX",
      from: "2025-01-07",
      to: "2025-01-07",
      timespan: "minute",
      assetClass: "index",
      conn,
    });

    expect(result).toEqual([]);
    // Phase 4: NO provider call regardless of how the caller asks for data.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("fetchBarsForLegsBulk", () => {
  it("merges quote minutes into selected legs and scopes queries by active dates", async () => {
    const conn = makeMockConn({
      queryFn: (sql) => {
        if (sql.includes("FROM market.spot")) {
          return [
            ["OPT1", 1.5, 1.5, 1.5, 1.5, null, null, "09:31", "2025-01-07"],
          ];
        }
        if (sql.includes("FROM market.option_quote_minutes")) {
          return [
            ["OPT1", "2025-01-07", "09:31", 1.4, 1.6],
            ["OPT1", "2025-01-07", "09:32", 1.5, 1.7],
            ["OPT2", "2025-01-07", "09:31", 2.0, 2.2],
          ];
        }
        return undefined;
      },
    });

    const result = await fetchBarsForLegsBulk(
      [
        { ticker: "OPT1", expiration: "2025-01-08", entryDate: "2025-01-07" },
        { ticker: "OPT2", expiration: "2025-01-08", entryDate: "2025-01-07" },
      ],
      "2025-01-01",
      conn,
    );

    const opt1 = result.get("OPT1");
    expect(opt1).toBeDefined();
    expect(opt1).toHaveLength(2);
    expect(opt1?.map(bar => bar.time)).toEqual(["09:31", "09:32"]);
    expect(opt1?.[0]?.close).toBe(1.5);
    expect(opt1?.[0]?.bid).toBe(1.4);
    expect(opt1?.[0]?.ask).toBe(1.6);
    expect(opt1?.[1]?.close).toBeCloseTo(1.6);

    const opt2 = result.get("OPT2");
    expect(opt2).toBeDefined();
    expect(opt2).toHaveLength(1);
    expect(opt2?.[0]?.time).toBe("09:31");
    expect(opt2?.[0]?.close).toBeCloseTo(2.1);

    const sqlCalls = (conn.runAndReadAll as jest.Mock).mock.calls.map(([sql]) => String(sql));
    const intradaySql = sqlCalls.find(sql => sql.includes("FROM market.spot"));
    expect(intradaySql).toBeDefined();
    expect(intradaySql).toContain("date = '2025-01-07'");
    expect(intradaySql).toContain("date = '2025-01-08'");
    expect(intradaySql).not.toContain("date >= '2025-01-01'");
  });

  it("caps active dates at activeUntilDate when a strategy has a hard replay ceiling", async () => {
    const conn = makeMockConn({ queryFn: () => [] });

    await fetchBarsForLegsBulk(
      [
        {
          ticker: "OPT1",
          expiration: "2025-01-10",
          entryDate: "2025-01-07",
          activeUntilDate: "2025-01-08",
        },
      ],
      "2025-01-01",
      conn,
    );

    const sqlCalls = (conn.runAndReadAll as jest.Mock).mock.calls.map(([sql]) => String(sql));
    const intradaySql = sqlCalls.find(sql => sql.includes("FROM market.spot"));
    expect(intradaySql).toBeDefined();
    expect(intradaySql).toContain("date = '2025-01-07'");
    expect(intradaySql).toContain("date = '2025-01-08'");
    expect(intradaySql).not.toContain("date = '2025-01-09'");
    expect(intradaySql).not.toContain("date = '2025-01-10'");
  });
});
