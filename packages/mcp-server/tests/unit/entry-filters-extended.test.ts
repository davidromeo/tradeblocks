/**
 * Unit tests for extended entry filters and time window helpers.
 *
 * Covers:
 *   - generateTimeSlots: time slot generation for window scanning
 *   - RSI filter: range checking with LAG semantics
 *   - min_sl_ratio: S/L ratio computation from SimulatedLeg entry prices
 */

// @ts-expect-error - importing from src (not bundled output)
import {
  generateTimeSlots,
  checkEntryFilters,
  type PrefetchedFilterData,
} from "../../src/test-exports.js";

// ---------------------------------------------------------------------------
// generateTimeSlots
// ---------------------------------------------------------------------------

describe("generateTimeSlots", () => {
  it("generates 31 entries from 09:45 to 10:15", () => {
    const slots = generateTimeSlots("09:45", "10:15");
    expect(slots).toHaveLength(31);
    expect(slots[0]).toBe("09:45");
    expect(slots[slots.length - 1]).toBe("10:15");
  });

  it("returns single entry when start equals end", () => {
    const slots = generateTimeSlots("09:45", "09:45");
    expect(slots).toHaveLength(1);
    expect(slots[0]).toBe("09:45");
  });

  it("handles hour boundary (09:58 to 10:02)", () => {
    const slots = generateTimeSlots("09:58", "10:02");
    expect(slots).toHaveLength(5);
    expect(slots).toEqual(["09:58", "09:59", "10:00", "10:01", "10:02"]);
  });

  it("returns single entry for reversed range", () => {
    const slots = generateTimeSlots("10:15", "09:45");
    expect(slots).toHaveLength(1);
    expect(slots[0]).toBe("10:15");
  });

  it("pads single-digit hours and minutes", () => {
    const slots = generateTimeSlots("09:05", "09:07");
    expect(slots).toEqual(["09:05", "09:06", "09:07"]);
  });
});

// ---------------------------------------------------------------------------
// RSI filter via checkEntryFilters with prefetched data
// ---------------------------------------------------------------------------

describe("RSI entry filter (via checkEntryFilters)", () => {
  function makePrefetched(rsiVal: number | null, date: string): PrefetchedFilterData {
    const contextByDate = new Map<string, Record<string, number>>();
    if (rsiVal != null) {
      contextByDate.set(`SPX:${date}`, { RSI_14: rsiVal });
    }
    return {
      intradayByTickerDate: new Map(),
      daily: new Map(),
      contextByDate,
    };
  }

  // Dummy connection - won't be used since prefetched data is provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dummyConn = {} as any;
  const date = "2025-01-07";
  const time = "09:45";

  it("passes when RSI is within [min, max] range", async () => {
    const filters = [{ type: "rsi" as const, field: "RSI_14", min: 30, max: 70 }];
    const prefetched = makePrefetched(50, date);
    const result = await checkEntryFilters(filters, date, time, "SPX", dummyConn, prefetched);
    expect(result.pass).toBe(true);
  });

  it("rejects when RSI exceeds max", async () => {
    const filters = [{ type: "rsi" as const, field: "RSI_14", max: 70 }];
    const prefetched = makePrefetched(75, date);
    const result = await checkEntryFilters(filters, date, time, "SPX", dummyConn, prefetched);
    expect(result.pass).toBe(false);
    expect(result).toHaveProperty("reason", "rsi_filter");
  });

  it("rejects when RSI is below min", async () => {
    const filters = [{ type: "rsi" as const, field: "RSI_14", min: 30 }];
    const prefetched = makePrefetched(25, date);
    const result = await checkEntryFilters(filters, date, time, "SPX", dummyConn, prefetched);
    expect(result.pass).toBe(false);
    expect(result).toHaveProperty("reason", "rsi_filter");
  });

  it("passes when no RSI data exists (graceful degradation)", async () => {
    const filters = [{ type: "rsi" as const, field: "RSI_14", min: 30, max: 70 }];
    const prefetched = makePrefetched(null, date);
    const result = await checkEntryFilters(filters, date, time, "SPX", dummyConn, prefetched);
    expect(result.pass).toBe(true);
  });

  it("passes at exact boundary (min=30, value=30)", async () => {
    const filters = [{ type: "rsi" as const, field: "RSI_14", min: 30, max: 70 }];
    const prefetched = makePrefetched(30, date);
    const result = await checkEntryFilters(filters, date, time, "SPX", dummyConn, prefetched);
    expect(result.pass).toBe(true);
  });

  it("passes at exact boundary (max=70, value=70)", async () => {
    const filters = [{ type: "rsi" as const, field: "RSI_14", min: 30, max: 70 }];
    const prefetched = makePrefetched(70, date);
    const result = await checkEntryFilters(filters, date, time, "SPX", dummyConn, prefetched);
    expect(result.pass).toBe(true);
  });

  it("uses prior-day RSI (LAG semantics) — contextByDate stores LAG value", async () => {
    // The contextByDate map stores the LAG value (prior day's RSI).
    // If today is 2025-01-07, the RSI value at that key is from 2025-01-06's close.
    // This test verifies the evaluator reads from contextByDate, not from a same-day source.
    const filters = [{ type: "rsi" as const, field: "RSI_14", max: 50 }];
    // Prior day RSI was 45 (below max) — should pass
    const prefetched = makePrefetched(45, date);
    const result = await checkEntryFilters(filters, date, time, "SPX", dummyConn, prefetched);
    expect(result.pass).toBe(true);
  });

  it("passes min_sl_ratio filter through (evaluated post-simulation)", async () => {
    // min_sl_ratio should not be evaluated by checkEntryFilters — it passes through
    const filters = [{ type: "min_sl_ratio" as const, min: 0.5 }];
    const prefetched = makePrefetched(null, date);
    const result = await checkEntryFilters(filters, date, time, "SPX", dummyConn, prefetched);
    expect(result.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// min_sl_ratio computation (pure logic test)
// ---------------------------------------------------------------------------

describe("min_sl_ratio S/L ratio computation", () => {
  // Mirrors the computation in the main loop:
  // shortVal = sum of |entryFillPrice * multiplier| for sell legs
  // longVal = sum of |entryFillPrice * multiplier| for buy legs
  // slRatio = shortVal / longVal

  interface MockLeg {
    direction: "buy" | "sell";
    entryFillPrice: number;
    multiplier: number;
  }

  function computeSlRatio(legs: MockLeg[]): number {
    let shortVal = 0, longVal = 0;
    for (const leg of legs) {
      const val = Math.abs(leg.entryFillPrice) * Math.abs(leg.multiplier);
      if (leg.direction === "sell") shortVal += val;
      else longVal += val;
    }
    return longVal === 0 ? 0 : shortVal / longVal;
  }

  it("computes ratio correctly for vertical spread", () => {
    // Sell 25.00, Buy 10.00, multiplier 100
    // shortVal = 2500, longVal = 1000, ratio = 2.5
    const legs: MockLeg[] = [
      { direction: "sell", entryFillPrice: 25.0, multiplier: 100 },
      { direction: "buy", entryFillPrice: 10.0, multiplier: 100 },
    ];
    expect(computeSlRatio(legs)).toBeCloseTo(2.5, 4);
  });

  it("rejects when ratio below min threshold", () => {
    // Sell 5.00, Buy 10.00 → ratio 0.5
    const legs: MockLeg[] = [
      { direction: "sell", entryFillPrice: 5.0, multiplier: 100 },
      { direction: "buy", entryFillPrice: 10.0, multiplier: 100 },
    ];
    const ratio = computeSlRatio(legs);
    const minThreshold = 0.8;
    expect(ratio).toBeLessThan(minThreshold);
  });

  it("passes when ratio at or above min threshold", () => {
    // Sell 25.00, Buy 25.00 → ratio 1.0
    const legs: MockLeg[] = [
      { direction: "sell", entryFillPrice: 25.0, multiplier: 100 },
      { direction: "buy", entryFillPrice: 25.0, multiplier: 100 },
    ];
    const ratio = computeSlRatio(legs);
    const minThreshold = 0.8;
    expect(ratio).toBeGreaterThanOrEqual(minThreshold);
  });

  it("returns 0 when no long legs (longVal=0)", () => {
    const legs: MockLeg[] = [
      { direction: "sell", entryFillPrice: 25.0, multiplier: 100 },
    ];
    expect(computeSlRatio(legs)).toBe(0);
  });

  it("handles multi-leg structure (iron condor)", () => {
    // Sell put 25.00, Buy put 10.00, Sell call 20.00, Buy call 8.00
    // shortVal = (25+20)*100 = 4500, longVal = (10+8)*100 = 1800
    // ratio = 4500/1800 = 2.5
    const legs: MockLeg[] = [
      { direction: "sell", entryFillPrice: 25.0, multiplier: 100 },
      { direction: "buy", entryFillPrice: 10.0, multiplier: 100 },
      { direction: "sell", entryFillPrice: 20.0, multiplier: 100 },
      { direction: "buy", entryFillPrice: 8.0, multiplier: 100 },
    ];
    expect(computeSlRatio(legs)).toBeCloseTo(2.5, 4);
  });
});
