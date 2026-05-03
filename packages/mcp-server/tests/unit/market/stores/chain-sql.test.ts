/**
 * Unit tests for chain SQL builder (Phase 2 Wave 1 — Plan 02-01).
 *
 * The chain builder is a single underlying + single date read (one partition
 * per call). Verifies positional parameter binding and column projection.
 */
import { describe, it, expect } from "@jest/globals";
import { buildReadChainSQL } from "../../../../src/test-exports.js";

describe("buildReadChainSQL", () => {
  it("queries market.option_chain with positional underlying/date params", () => {
    const { sql, params } = buildReadChainSQL("SPX", "2025-01-06");
    expect(sql).toContain("FROM market.option_chain");
    expect(sql).toContain("WHERE underlying = $1");
    expect(sql).toContain("AND date = $2");
    expect(params).toEqual(["SPX", "2025-01-06"]);
  });

  it("projects the contract columns the ContractRow shape expects", () => {
    const { sql } = buildReadChainSQL("SPX", "2025-01-06");
    for (const col of [
      "underlying",
      "date",
      "ticker",
      "contract_type",
      "strike",
      "expiration",
      "dte",
      "exercise_style",
    ]) {
      expect(sql).toContain(col);
    }
  });

  it("orders results by ticker for deterministic consumer iteration", () => {
    const { sql } = buildReadChainSQL("SPX", "2025-01-06");
    expect(sql).toContain("ORDER BY ticker");
  });

  it("handles non-SPX underlyings without SPX-specific hardcoding", () => {
    const { sql, params } = buildReadChainSQL("QQQ", "2025-06-20");
    expect(sql).toContain("FROM market.option_chain");
    expect(params).toEqual(["QQQ", "2025-06-20"]);
  });
});
