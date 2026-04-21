/**
 * Unit tests for the root-to-underlying resolver.
 *
 * Covers:
 *   - extractRoot bare-root passthrough
 *   - extractRoot OCC tail-strip
 *   - extractRoot error on no leading alpha
 *   - rootToUnderlying across SPX family, QQQ family
 *   - Identity fallback for leveraged ETFs (D-05 correctness rule)
 *   - Identity fallback for arbitrary unknown roots
 *
 * Tests will run once Plan 01-06 wires test-exports for the tickers module.
 * Until then `npm run build` must succeed and imports must compile cleanly.
 */
import { describe, it, expect } from "@jest/globals";
import {
  extractRoot,
  rootToUnderlying,
  TickerRegistry,
} from "../../../../src/test-exports.js";

// A registry seeded with D-07 defaults (the one the production loader builds).
const defaults = [
  { underlying: "SPX", roots: ["SPX", "SPXW", "SPXQ"] },
  { underlying: "QQQ", roots: ["QQQ", "QQQX"] },
  { underlying: "VIX", roots: ["VIX"] },
  { underlying: "VIX9D", roots: ["VIX9D"] },
  { underlying: "VIX3M", roots: ["VIX3M"] },
  { underlying: "ES", roots: ["ES"] },
  { underlying: "NDX", roots: ["NDX", "NDXP"] },
  { underlying: "RUT", roots: ["RUT", "RUTW"] },
];

describe("extractRoot — bare root", () => {
  it("returns the input for a bare root", () => {
    expect(extractRoot("SPXW")).toBe("SPXW");
    expect(extractRoot("QQQ")).toBe("QQQ");
    expect(extractRoot("VIX9D")).toBe("VIX9D");
  });
});

describe("extractRoot — OCC ticker", () => {
  it("strips the OCC tail", () => {
    expect(extractRoot("SPXW251219C05000000")).toBe("SPXW");
    expect(extractRoot("QQQ241227P00500000")).toBe("QQQ");
  });
  it("throws when no leading alpha run", () => {
    expect(() => extractRoot("123ABC")).toThrow(/Cannot extract root/);
    expect(() => extractRoot("")).toThrow(/Cannot extract root/);
  });
});

describe("rootToUnderlying — SPX family", () => {
  const registry = new TickerRegistry(defaults);
  it("resolves SPX / SPXW / SPXQ to SPX", () => {
    expect(rootToUnderlying("SPX", registry)).toBe("SPX");
    expect(rootToUnderlying("SPXW", registry)).toBe("SPX");
    expect(rootToUnderlying("SPXQ", registry)).toBe("SPX");
  });
  it("resolves OCC SPXW ticker to SPX", () => {
    expect(rootToUnderlying("SPXW251219C05000000", registry)).toBe("SPX");
  });
});

describe("rootToUnderlying — QQQ family", () => {
  const registry = new TickerRegistry(defaults);
  it("resolves QQQ and QQQX to QQQ", () => {
    expect(rootToUnderlying("QQQ", registry)).toBe("QQQ");
    expect(rootToUnderlying("QQQX", registry)).toBe("QQQ");
  });
});

describe("rootToUnderlying — leveraged ETFs (identity fallback, per D-05)", () => {
  const registry = new TickerRegistry(defaults);
  it("returns SPXL / SPXS / SPXU / SPXC as themselves — never folded into SPX", () => {
    expect(rootToUnderlying("SPXL", registry)).toBe("SPXL");
    expect(rootToUnderlying("SPXS", registry)).toBe("SPXS");
    expect(rootToUnderlying("SPXU", registry)).toBe("SPXU");
    expect(rootToUnderlying("SPXC", registry)).toBe("SPXC");
  });
});

describe("rootToUnderlying — unknown root identity fallback", () => {
  const registry = new TickerRegistry(defaults);
  it("returns the root itself for any unregistered symbol", () => {
    expect(rootToUnderlying("XYZ", registry)).toBe("XYZ");
    expect(rootToUnderlying("IBM", registry)).toBe("IBM");
  });
});
