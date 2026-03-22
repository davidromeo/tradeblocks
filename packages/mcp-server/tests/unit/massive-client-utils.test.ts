import {
  massiveTimestampToETDate,
  toMassiveTicker,
  fromMassiveTicker,
  MassiveBarSchema,
  MassiveAggregateResponseSchema,
} from "../../src/utils/massive-client.js";

// ---------------------------------------------------------------------------
// Helpers — valid fixtures for reuse across tests
// ---------------------------------------------------------------------------

const VALID_BAR = { v: 1000, vw: 100.5, o: 100, c: 101, h: 102, l: 99, t: 1736253000000, n: 50 };

const VALID_RESPONSE = {
  ticker: "I:VIX",
  queryCount: 1,
  resultsCount: 1,
  adjusted: false,
  results: [VALID_BAR],
  status: "OK",
  request_id: "abc123",
};

// ---------------------------------------------------------------------------
// massiveTimestampToETDate
// ---------------------------------------------------------------------------

describe("massiveTimestampToETDate", () => {
  it("converts 9:30 AM ET bar to correct date (2025-01-07)", () => {
    // 1736253000000 = Jan 7, 2025 14:30 UTC = 9:30 AM EST (UTC-5)
    expect(massiveTimestampToETDate(1736253000000)).toBe("2025-01-07");
  });

  it("handles EST (winter) correctly — Nov 4, 2024 9:30 AM ET", () => {
    // 1730727000000 = Nov 4, 2024 14:30 UTC = 9:30 AM EST (UTC-5)
    // (DST ended Nov 3, 2024 — this is standard time)
    expect(massiveTimestampToETDate(1730727000000)).toBe("2024-11-04");
  });

  it("handles EDT (summer) correctly — Jul 10, 2024 9:30 AM ET", () => {
    // 1720615800000 = Jul 10, 2024 13:30 UTC = 9:30 AM EDT (UTC-4)
    expect(massiveTimestampToETDate(1720615800000)).toBe("2024-07-10");
  });

  it("handles late-night ET boundary — 11:59 PM ET stays on same calendar date", () => {
    // 1736312340000 = Jan 8, 2025 04:59 UTC = 11:59 PM EST Jan 7, 2025
    expect(massiveTimestampToETDate(1736312340000)).toBe("2025-01-07");
  });
});

// ---------------------------------------------------------------------------
// toMassiveTicker
// ---------------------------------------------------------------------------

describe("toMassiveTicker", () => {
  it("prepends I: for index tickers", () => {
    expect(toMassiveTicker("VIX", "index")).toBe("I:VIX");
  });

  it("does not double-prefix index tickers already formatted", () => {
    expect(toMassiveTicker("I:VIX", "index")).toBe("I:VIX");
  });

  it("prepends O: for option tickers (plain OCC format)", () => {
    expect(toMassiveTicker("SPX251219C05000000", "option")).toBe("O:SPX251219C05000000");
  });

  it("does not double-prefix option tickers already formatted", () => {
    expect(toMassiveTicker("O:SPX251219C05000000", "option")).toBe("O:SPX251219C05000000");
  });

  it("returns stock tickers unchanged", () => {
    expect(toMassiveTicker("AAPL", "stock")).toBe("AAPL");
  });

  it("VIX9D gets I: index prefix", () => {
    expect(toMassiveTicker("VIX9D", "index")).toBe("I:VIX9D");
  });

  it("SPX stock ticker is returned unchanged (no prefix for stocks)", () => {
    expect(toMassiveTicker("SPX", "stock")).toBe("SPX");
  });
});

// ---------------------------------------------------------------------------
// fromMassiveTicker
// ---------------------------------------------------------------------------

describe("fromMassiveTicker", () => {
  it("strips I: prefix from index ticker", () => {
    expect(fromMassiveTicker("I:VIX")).toBe("VIX");
  });

  it("strips I: prefix from VIX9D", () => {
    expect(fromMassiveTicker("I:VIX9D")).toBe("VIX9D");
  });

  it("strips O: prefix from options ticker", () => {
    expect(fromMassiveTicker("O:SPX251219C05000000")).toBe("SPX251219C05000000");
  });

  it("leaves plain (unprefixed) stock tickers unchanged", () => {
    expect(fromMassiveTicker("AAPL")).toBe("AAPL");
  });
});

// ---------------------------------------------------------------------------
// MassiveBarSchema
// ---------------------------------------------------------------------------

describe("MassiveBarSchema", () => {
  it("accepts a valid bar with all 8 required fields", () => {
    const result = MassiveBarSchema.safeParse(VALID_BAR);
    expect(result.success).toBe(true);
  });

  it("rejects a bar missing required field h (high)", () => {
    const withoutH = { ...VALID_BAR };
    delete (withoutH as Record<string, unknown>).h;
    const result = MassiveBarSchema.safeParse(withoutH);
    expect(result.success).toBe(false);
  });

  it("rejects a bar with string timestamp instead of number", () => {
    const result = MassiveBarSchema.safeParse({ ...VALID_BAR, t: "not-a-number" });
    expect(result.success).toBe(false);
  });

  it("rejects a bar missing multiple required fields", () => {
    const result = MassiveBarSchema.safeParse({ v: 1000, o: 100, c: 101 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MassiveAggregateResponseSchema
// ---------------------------------------------------------------------------

describe("MassiveAggregateResponseSchema", () => {
  it("accepts a valid aggregate response with one bar", () => {
    const result = MassiveAggregateResponseSchema.safeParse(VALID_RESPONSE);
    expect(result.success).toBe(true);
  });

  it("accepts a response with next_url (pagination continues)", () => {
    const withNextUrl = {
      ...VALID_RESPONSE,
      next_url: "https://api.massive.com/v2/aggs?cursor=abc123",
    };
    const result = MassiveAggregateResponseSchema.safeParse(withNextUrl);
    expect(result.success).toBe(true);
  });

  it("accepts a response with empty results array", () => {
    const result = MassiveAggregateResponseSchema.safeParse({
      ...VALID_RESPONSE,
      results: [],
      resultsCount: 0,
    });
    expect(result.success).toBe(true);
  });

  it("defaults to empty array when results field missing", () => {
    const withoutResults = { ...VALID_RESPONSE };
    delete (withoutResults as Record<string, unknown>).results;
    const result = MassiveAggregateResponseSchema.safeParse(withoutResults);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toEqual([]);
    }
  });

  it("rejects a response where results is not an array", () => {
    const result = MassiveAggregateResponseSchema.safeParse({
      ...VALID_RESPONSE,
      results: "not-an-array",
    });
    expect(result.success).toBe(false);
  });
});
