/**
 * Unit tests for quote SQL builder (Phase 2 Wave 1 — Plan 02-01).
 *
 * The quote builder emits a multi-ticker IN (...) clause with positional
 * placeholders. Tests exercise placeholder math (N=1, N=2, N=5), empty-array
 * guard, and params ordering.
 */
import { describe, it, expect } from "@jest/globals";
import { buildReadQuotesSQL } from "../../../../src/test-exports.js";

describe("buildReadQuotesSQL", () => {
  it("queries market.option_quote_minutes and filters underlying + date range", () => {
    const { sql, params } = buildReadQuotesSQL(
      "SPX",
      ["SPXW251219C05000000"],
      "2025-01-01",
      "2025-01-02",
    );
    expect(sql).toContain("FROM market.option_quote_minutes");
    expect(sql).toContain("WHERE underlying = $1");
    expect(sql).toContain("date >= $2");
    expect(sql).toContain("date <= $3");
    expect(sql).toContain("ticker IN ($4)");
    expect(params).toEqual(["SPX", "2025-01-01", "2025-01-02", "SPXW251219C05000000"]);
  });

  it("emits positional placeholders $4 and $5 for two OCC tickers", () => {
    const { sql, params } = buildReadQuotesSQL(
      "SPX",
      ["SPXW251219C05000000", "SPXW251219P05000000"],
      "2025-01-01",
      "2025-01-02",
    );
    expect(sql).toContain("ticker IN ($4, $5)");
    expect(params).toEqual([
      "SPX",
      "2025-01-01",
      "2025-01-02",
      "SPXW251219C05000000",
      "SPXW251219P05000000",
    ]);
  });

  it("scales placeholders correctly for a five-ticker basket", () => {
    const occTickers = [
      "SPXW251219C05000000",
      "SPXW251219C05100000",
      "SPXW251219C05200000",
      "SPXW251219P04900000",
      "SPXW251219P04800000",
    ];
    const { sql, params } = buildReadQuotesSQL("SPX", occTickers, "2025-01-01", "2025-01-02");
    expect(sql).toContain("ticker IN ($4, $5, $6, $7, $8)");
    expect(params).toEqual(["SPX", "2025-01-01", "2025-01-02", ...occTickers]);
  });

  it("orders results by (ticker, date, time) for grouped-series consumers", () => {
    const { sql } = buildReadQuotesSQL("SPX", ["SPXW251219C05000000"], "2025-01-01", "2025-01-02");
    expect(sql).toContain("ORDER BY ticker, date, time");
  });

  it("projects quote columns the QuoteRow shape expects", () => {
    const { sql } = buildReadQuotesSQL("SPX", ["SPXW251219C05000000"], "2025-01-01", "2025-01-02");
    for (const col of ["ticker", "date", "time", "bid", "ask"]) {
      expect(sql).toContain(col);
    }
  });

  it("throws when occTickers is empty (avoids emitting invalid `ticker IN ()`)", () => {
    expect(() => buildReadQuotesSQL("SPX", [], "2025-01-01", "2025-01-02")).toThrow(
      /must not be empty/,
    );
  });
});
