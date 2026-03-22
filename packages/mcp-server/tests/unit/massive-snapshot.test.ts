import { jest } from "@jest/globals";

/**
 * Unit tests for fetchOptionSnapshot() in massive-snapshot.ts.
 *
 * All HTTP calls are mocked via jest.spyOn(globalThis, 'fetch').
 * BS fallback uses real computeLegGreeks for higher fidelity.
 */

import {
  fetchOptionSnapshot,
  MassiveSnapshotResponseSchema,
} from "../../src/utils/massive-snapshot.js";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const ORIG_ENV = process.env;
let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;

beforeEach(() => {
  process.env = { ...ORIG_ENV };
  process.env.MASSIVE_API_KEY = "test-key-abc123";
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  process.env = ORIG_ENV;
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockResponse(
  body: unknown,
  status = 200,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Build a valid contract for the Massive snapshot response. */
function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    break_even_price: 5050.0,
    implied_volatility: 0.18,
    open_interest: 1500,
    greeks: {
      delta: 0.45,
      gamma: 0.012,
      theta: -0.85,
      vega: 2.5,
    },
    day: {
      open: 12.0,
      high: 14.0,
      low: 11.5,
      close: 13.0,
      change: 1.0,
      change_percent: 8.33,
      volume: 500,
      vwap: 12.8,
      previous_close: 12.0,
      last_updated: 1736253000000000000,
    },
    last_quote: {
      bid: 12.5,
      ask: 13.5,
      midpoint: 13.0,
      bid_size: 10,
      ask_size: 15,
      last_updated: 1736253000000000000,
      timeframe: "REAL-TIME",
    },
    last_trade: {
      price: 13.0,
      size: 5,
      sip_timestamp: 1736253000000000000,
      conditions: [1],
      timeframe: "REAL-TIME",
    },
    details: {
      ticker: "O:SPX251219C05000000",
      contract_type: "call",
      strike_price: 5000,
      expiration_date: "2025-12-19",
      exercise_style: "european",
      shares_per_contract: 100,
    },
    underlying_asset: {
      ticker: "I:SPX",
      price: 5050.0,
      change_to_break_even: 0.0,
      last_updated: 1736253000000000000,
      timeframe: "REAL-TIME",
    },
    ...overrides,
  };
}

function makeSnapshotResponse(
  contracts: unknown[] = [makeContract()],
  nextUrl?: string,
) {
  return {
    request_id: "req-snap-001",
    status: "OK",
    results: contracts,
    ...(nextUrl ? { next_url: nextUrl } : {}),
  };
}

// ---------------------------------------------------------------------------
// Test 1: Single-page response returns flat array
// ---------------------------------------------------------------------------

describe("single-page response", () => {
  it("returns flat array of OptionContract objects with all fields mapped", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(makeSnapshotResponse()));

    const result = await fetchOptionSnapshot({ underlying: "SPX" });

    expect(result.contracts).toHaveLength(1);
    const c = result.contracts[0];
    expect(c.ticker).toBe("SPX251219C05000000");
    expect(c.underlying_ticker).toBe("SPX");
    expect(c.underlying_price).toBe(5050.0);
    expect(c.contract_type).toBe("call");
    expect(c.strike).toBe(5000);
    expect(c.expiration).toBe("2025-12-19");
    expect(c.exercise_style).toBe("european");
    expect(c.delta).toBe(0.45);
    expect(c.gamma).toBe(0.012);
    expect(c.theta).toBe(-0.85);
    expect(c.vega).toBe(2.5);
    expect(c.iv).toBe(0.18);
    expect(c.greeks_source).toBe("massive");
    expect(c.bid).toBe(12.5);
    expect(c.ask).toBe(13.5);
    expect(c.midpoint).toBe(13.0);
    expect(c.last_price).toBe(13.0);
    expect(c.open_interest).toBe(1500);
    expect(c.volume).toBe(500);
    expect(c.break_even).toBe(5050.0);
    expect(result.underlying_price).toBe(5050.0);
    expect(result.underlying_ticker).toBe("SPX");
  });
});

// ---------------------------------------------------------------------------
// Test 2: Auto-pagination
// ---------------------------------------------------------------------------

describe("pagination", () => {
  it("auto-paginates when next_url is present, accumulating all contracts", async () => {
    const page1 = makeSnapshotResponse(
      [makeContract()],
      "https://api.massive.com/v3/snapshot/options/next?cursor=page2cursor",
    );
    const page2 = makeSnapshotResponse([
      makeContract({
        details: {
          ticker: "O:SPX251219P05000000",
          contract_type: "put",
          strike_price: 5000,
          expiration_date: "2025-12-19",
          exercise_style: "european",
          shares_per_contract: 100,
        },
      }),
    ]);

    fetchSpy
      .mockResolvedValueOnce(mockResponse(page1))
      .mockResolvedValueOnce(mockResponse(page2));

    const result = await fetchOptionSnapshot({ underlying: "SPX" });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.contracts).toHaveLength(2);
    expect(result.contracts[0].contract_type).toBe("call");
    expect(result.contracts[1].contract_type).toBe("put");
  });

  // ---------------------------------------------------------------------------
  // Test 3: Seen-cursor guard
  // ---------------------------------------------------------------------------

  it("throws on repeated pagination cursor", async () => {
    const repeating = makeSnapshotResponse(
      [makeContract()],
      "https://api.massive.com/v3/snapshot/options/next?cursor=same-cursor",
    );

    fetchSpy
      .mockResolvedValueOnce(mockResponse(repeating))
      .mockResolvedValueOnce(mockResponse(repeating));

    await expect(
      fetchOptionSnapshot({ underlying: "SPX" }),
    ).rejects.toThrow("Pagination loop detected");
  });
});

// ---------------------------------------------------------------------------
// Test 4: BS fallback when greeks are null/missing
// ---------------------------------------------------------------------------

describe("greeks fallback", () => {
  it("uses BS fallback when greeks object is null", async () => {
    const noGreeks = makeContract({
      greeks: undefined,
      // Use realistic values for BS computation
      implied_volatility: 0.20,
      last_trade: { price: 50.0, size: 5, sip_timestamp: 1736253000000000000, timeframe: "REAL-TIME" },
      details: {
        ticker: "O:SPX251219C05000000",
        contract_type: "call",
        strike_price: 5000,
        expiration_date: "2026-12-19", // far out for BS to work well
        exercise_style: "european",
        shares_per_contract: 100,
      },
      underlying_asset: {
        ticker: "I:SPX",
        price: 5050.0,
        change_to_break_even: 0.0,
        last_updated: 1736253000000000000,
        timeframe: "REAL-TIME",
      },
    });

    fetchSpy.mockResolvedValueOnce(
      mockResponse(makeSnapshotResponse([noGreeks])),
    );

    const result = await fetchOptionSnapshot({ underlying: "SPX" });
    const c = result.contracts[0];

    expect(c.greeks_source).toBe("computed");
    // BS should compute some non-null greeks for an ATM-ish option far from expiry
    expect(c.delta).not.toBeNull();
    expect(c.iv).not.toBeNull();
  });

  it("uses midpoint when last_trade is missing for BS fallback", async () => {
    const noGreeksNoTrade = makeContract({
      greeks: undefined,
      implied_volatility: 0.20,
      last_trade: undefined,
      last_quote: {
        bid: 48.0,
        ask: 52.0,
        midpoint: 50.0,
        bid_size: 10,
        ask_size: 15,
        last_updated: 1736253000000000000,
        timeframe: "REAL-TIME",
      },
      details: {
        ticker: "O:SPX251219C05000000",
        contract_type: "call",
        strike_price: 5000,
        expiration_date: "2026-12-19",
        exercise_style: "european",
        shares_per_contract: 100,
      },
      underlying_asset: {
        ticker: "I:SPX",
        price: 5050.0,
        change_to_break_even: 0.0,
        last_updated: 1736253000000000000,
        timeframe: "REAL-TIME",
      },
    });

    fetchSpy.mockResolvedValueOnce(
      mockResponse(makeSnapshotResponse([noGreeksNoTrade])),
    );

    const result = await fetchOptionSnapshot({ underlying: "SPX" });
    expect(result.contracts[0].greeks_source).toBe("computed");
    expect(result.contracts[0].delta).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 5: API greeks pass through
// ---------------------------------------------------------------------------

describe("API greeks", () => {
  it("passes through API greeks with greeks_source='massive'", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(makeSnapshotResponse()));

    const result = await fetchOptionSnapshot({ underlying: "SPX" });
    const c = result.contracts[0];

    expect(c.greeks_source).toBe("massive");
    expect(c.delta).toBe(0.45);
    expect(c.gamma).toBe(0.012);
    expect(c.theta).toBe(-0.85);
    expect(c.vega).toBe(2.5);
    expect(c.iv).toBe(0.18);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Zod validation rejects malformed responses
// ---------------------------------------------------------------------------

describe("Zod validation", () => {
  it("rejects response with missing required fields", async () => {
    const malformed = {
      request_id: "req-001",
      status: "OK",
      results: [
        {
          // Missing details, day, last_quote, underlying_asset
          break_even_price: 100,
          implied_volatility: 0.2,
          open_interest: 50,
        },
      ],
    };

    fetchSpy.mockResolvedValueOnce(mockResponse(malformed));

    await expect(
      fetchOptionSnapshot({ underlying: "SPX" }),
    ).rejects.toThrow("validation failed");
  });

  it("schema validates a well-formed response", () => {
    const good = makeSnapshotResponse();
    const parsed = MassiveSnapshotResponseSchema.safeParse(good);
    expect(parsed.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Missing API key
// ---------------------------------------------------------------------------

describe("API key handling", () => {
  it("throws descriptive error when MASSIVE_API_KEY is not set", async () => {
    delete process.env.MASSIVE_API_KEY;

    await expect(
      fetchOptionSnapshot({ underlying: "SPX" }),
    ).rejects.toThrow("MASSIVE_API_KEY");
  });
});

// ---------------------------------------------------------------------------
// Test 8: HTTP errors — 401 and 429
// ---------------------------------------------------------------------------

describe("HTTP errors", () => {
  it("throws auth error on 401", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse({ error: "Unauthorized" }, 401));

    await expect(
      fetchOptionSnapshot({ underlying: "SPX" }),
    ).rejects.toThrow("rejected");
  });

  it("retries on 429 with backoff then succeeds", async () => {
    jest.useFakeTimers();

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "rate limited" }), {
          status: 429,
          statusText: "Too Many Requests",
          headers: { "Content-Type": "application/json", "Retry-After": "1" },
        }),
      )
      .mockResolvedValueOnce(mockResponse(makeSnapshotResponse()));

    const promise = fetchOptionSnapshot({ underlying: "SPX" });
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.contracts).toHaveLength(1);

    jest.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Test 9: Filter params in URL
// ---------------------------------------------------------------------------

describe("filter params", () => {
  it("includes strike_price and expiration_date filters in URL query", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(makeSnapshotResponse()));

    await fetchOptionSnapshot({
      underlying: "SPX",
      strike_price_gte: 4900,
      strike_price_lte: 5100,
      expiration_date_gte: "2025-12-01",
      expiration_date_lte: "2025-12-31",
    });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("strike_price.gte=4900");
    expect(url).toContain("strike_price.lte=5100");
    expect(url).toContain("expiration_date.gte=2025-12-01");
    expect(url).toContain("expiration_date.lte=2025-12-31");
  });
});

// ---------------------------------------------------------------------------
// Test 10: contract_type filter
// ---------------------------------------------------------------------------

describe("contract_type filter", () => {
  it("includes contract_type filter in URL query when provided", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(makeSnapshotResponse()));

    await fetchOptionSnapshot({
      underlying: "SPX",
      contract_type: "call",
    });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("contract_type=call");
  });
});

// ---------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------

describe("URL construction", () => {
  it("uses I: prefix for index tickers (SPX)", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(makeSnapshotResponse()));

    await fetchOptionSnapshot({ underlying: "SPX" });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/v3/snapshot/options/I%3ASPX");
  });

  it("uses plain ticker for stock tickers (AAPL)", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(makeSnapshotResponse()));

    await fetchOptionSnapshot({ underlying: "AAPL" });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/v3/snapshot/options/AAPL");
    expect(url).not.toContain("I%3A");
  });

  it("includes limit=250 in query string", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(makeSnapshotResponse()));

    await fetchOptionSnapshot({ underlying: "SPX" });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("limit=250");
  });
});
