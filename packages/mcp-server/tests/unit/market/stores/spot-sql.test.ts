/**
 * Unit tests for spot SQL builders (Phase 2 Wave 1 — Plan 02-01).
 *
 * These builders are pure: they emit `{ sql, params }` and never touch a
 * DuckDB connection. Tests therefore exercise string assertions and
 * positional-parameter equality only — no fixture is instantiated.
 */
import { describe, it, expect } from "@jest/globals";
import {
  buildReadBarsSQL,
  buildReadDailyBarsSQL,
  buildReadRthOpensSQL,
} from "../../../../src/test-exports.js";

describe("spot-sql builders", () => {
  describe("buildReadBarsSQL", () => {
    it("binds ticker/from/to positionally and queries market.spot", () => {
      const { sql, params } = buildReadBarsSQL("SPX", "2025-01-01", "2025-01-06");
      expect(sql).toContain("FROM market.spot");
      expect(sql).toContain("WHERE ticker = $1");
      expect(sql).toContain("date >= $2");
      expect(sql).toContain("date <= $3");
      expect(params).toEqual(["SPX", "2025-01-01", "2025-01-06"]);
    });

    it("orders results deterministically by (date, time)", () => {
      const { sql } = buildReadBarsSQL("SPX", "2025-01-01", "2025-01-06");
      expect(sql).toContain("ORDER BY date, time");
    });

    it("selects the expected column set", () => {
      const { sql } = buildReadBarsSQL("SPX", "2025-01-01", "2025-01-06");
      // Spot bars contain OHLCV-ish columns + bid/ask minute-level quotes.
      for (const col of ["ticker", "date", "time", "open", "high", "low", "close", "bid", "ask"]) {
        expect(sql).toContain(col);
      }
    });
  });

  describe("buildReadDailyBarsSQL", () => {
    it("uses DuckDB aggregate first/last with ORDER BY (NOT window FIRST_VALUE)", () => {
      const { sql } = buildReadDailyBarsSQL("SPX", "2025-01-01", "2025-01-06");
      expect(sql).toContain("first(open  ORDER BY time)");
      expect(sql).toContain("last(close  ORDER BY time)");
      expect(sql).toContain("max(high)");
      expect(sql).toContain("min(low)");
      expect(sql).not.toMatch(/FIRST_VALUE/i);
      expect(sql).not.toMatch(/LAST_VALUE/i);
    });

    it("groups by ticker/date and filters to the RTH window", () => {
      const { sql, params } = buildReadDailyBarsSQL("SPX", "2025-01-01", "2025-01-06");
      expect(sql).toContain("GROUP BY ticker, date");
      expect(sql).toContain("time >= '09:30'");
      expect(sql).toContain("time <= '16:00'");
      expect(params).toEqual(["SPX", "2025-01-01", "2025-01-06"]);
    });

    it("queries from market.spot (single source of truth)", () => {
      const { sql } = buildReadDailyBarsSQL("SPX", "2025-01-01", "2025-01-06");
      expect(sql).toContain("FROM market.spot");
    });
  });

  describe("buildReadRthOpensSQL", () => {
    it("projects date+open aggregate over RTH window", () => {
      const { sql, params } = buildReadRthOpensSQL("VIX", "2025-01-01", "2025-01-31");
      expect(sql).toContain("first(open ORDER BY time)");
      expect(sql).toContain("FROM market.spot");
      expect(sql).toContain("GROUP BY date");
      expect(sql).toContain("time >= '09:30'");
      expect(sql).toContain("time <= '16:00'");
      expect(params).toEqual(["VIX", "2025-01-01", "2025-01-31"]);
    });

    it("binds positional $1 $2 $3 placeholders", () => {
      const { sql } = buildReadRthOpensSQL("VIX", "2025-01-01", "2025-01-31");
      expect(sql).toContain("$1");
      expect(sql).toContain("$2");
      expect(sql).toContain("$3");
    });
  });
});
