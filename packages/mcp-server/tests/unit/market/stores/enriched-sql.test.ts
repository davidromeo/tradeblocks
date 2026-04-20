/**
 * Unit tests for enriched SQL builder (Phase 2 Wave 1 — Plan 02-01).
 *
 * Confirms the four include-flag combinations emit the correct set of
 * JOINs + columns without ever changing the positional parameters.
 */
import { describe, it, expect } from "@jest/globals";
import { buildReadEnrichedSQL } from "../../../../src/test-exports.js";

describe("buildReadEnrichedSQL", () => {
  const base = { ticker: "SPX", from: "2025-01-01", to: "2025-01-06" } as const;

  it("queries market.enriched aliased as `e` and orders by date", () => {
    const { sql } = buildReadEnrichedSQL({ ...base, includeOhlcv: false, includeContext: false });
    expect(sql).toContain("FROM market.enriched e");
    expect(sql).toContain("WHERE e.ticker = $1");
    expect(sql).toContain("e.date >= $2");
    expect(sql).toContain("e.date <= $3");
    expect(sql).toContain("ORDER BY e.date");
  });

  it("always binds exactly [ticker, from, to] regardless of include flags", () => {
    const variants = [
      { includeOhlcv: false, includeContext: false },
      { includeOhlcv: true, includeContext: false },
      { includeOhlcv: false, includeContext: true },
      { includeOhlcv: true, includeContext: true },
    ] as const;

    for (const v of variants) {
      const { params } = buildReadEnrichedSQL({ ...base, ...v });
      expect(params).toEqual(["SPX", "2025-01-01", "2025-01-06"]);
    }
  });

  it("omits the OHLCV join subquery when includeOhlcv=false", () => {
    const { sql } = buildReadEnrichedSQL({ ...base, includeOhlcv: false, includeContext: false });
    expect(sql).not.toContain("s_daily");
    expect(sql).not.toContain("first(open  ORDER BY time)");
  });

  it("adds the RTH daily-aggregate subquery when includeOhlcv=true", () => {
    const { sql } = buildReadEnrichedSQL({ ...base, includeOhlcv: true, includeContext: false });
    expect(sql).toContain("LEFT JOIN");
    expect(sql).toContain("first(open  ORDER BY time)");
    expect(sql).toContain("last(close  ORDER BY time)");
    expect(sql).toContain("s_daily");
    expect(sql).toContain("s_daily.ticker = e.ticker");
    expect(sql).toContain("s_daily.date = e.date");
    // The OHLCV columns are projected alongside e.*
    expect(sql).toContain("s_daily.open");
    expect(sql).toContain("s_daily.high");
    expect(sql).toContain("s_daily.low");
    expect(sql).toContain("s_daily.close");
    // Must NOT use window FIRST_VALUE
    expect(sql).not.toMatch(/FIRST_VALUE/i);
  });

  it("omits the enriched_context join when includeContext=false", () => {
    const { sql } = buildReadEnrichedSQL({ ...base, includeOhlcv: false, includeContext: false });
    expect(sql).not.toContain("market.enriched_context");
    expect(sql).not.toContain("Vol_Regime");
  });

  it("adds the enriched_context join + selected context columns when includeContext=true", () => {
    const { sql } = buildReadEnrichedSQL({ ...base, includeOhlcv: false, includeContext: true });
    expect(sql).toContain("LEFT JOIN market.enriched_context c");
    expect(sql).toContain("c.date = e.date");
    expect(sql).toContain("c.Vol_Regime");
    expect(sql).toContain("c.Term_Structure_State");
    expect(sql).toContain("c.Trend_Direction");
  });

  it("combines both JOINs when both flags are true", () => {
    const { sql } = buildReadEnrichedSQL({ ...base, includeOhlcv: true, includeContext: true });
    expect(sql).toContain("s_daily");
    expect(sql).toContain("market.enriched_context");
    expect(sql).toContain("s_daily.open");
    expect(sql).toContain("c.Vol_Regime");
  });

  it("reuses $1/$2/$3 inside the OHLCV subquery (does not duplicate params)", () => {
    const { sql, params } = buildReadEnrichedSQL({
      ...base,
      includeOhlcv: true,
      includeContext: false,
    });
    // The subquery and outer WHERE must both reference $1/$2/$3; no $4.
    expect(sql).toContain("$1");
    expect(sql).toContain("$2");
    expect(sql).toContain("$3");
    expect(sql).not.toContain("$4");
    expect(params).toEqual(["SPX", "2025-01-01", "2025-01-06"]);
  });
});
