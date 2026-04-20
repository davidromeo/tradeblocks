/**
 * Unit tests for strategy-schema.ts
 *
 * Tests Zod schema validation for StrategyDefinitionSchema, LegDefinitionSchema,
 * StrikeSpecSchema, EntryRulesSchema, and PositionSizingSchema.
 *
 * Test coverage:
 *   - Valid iron condor (2-leg) round-trips through parse + JSON.stringify
 *   - All 5 strike spec methods are accepted
 *   - Max 8 legs accepted; 9 legs rejected
 *   - Unknown strike method rejected with descriptive error
 *   - Missing required fields rejected
 *   - Defaults applied correctly (dte_tolerance, multiplier, slippage, etc.)
 *   - offset strike spec requires parent_leg and points
 */

// @ts-expect-error - importing from src (not bundled output)
import { StrategyDefinitionSchema, LegDefinitionSchema, StrikeSpecSchema } from "../../src/test-exports.js";

// Minimal valid leg for test reuse
const validLeg = {
  contract_type: "put",
  direction: "sell",
  dte_target: 45,
  quantity: 1,
  strike_spec: { method: "delta", target: 0.16 },
};

const validEntryRules = { frequency: "weekly" };
const validPositionSizing = { mode: "fixed_contracts", contracts: 1 };

describe("StrategyDefinitionSchema", () => {
  it("round-trips a valid 2-leg iron condor definition", () => {
    const input = {
      strategy_name: "SPX IC 45DTE",
      underlying: "SPX",
      legs: [
        {
          contract_type: "put",
          direction: "buy",
          dte_target: 45,
          quantity: 1,
          strike_spec: { method: "otm_pct", pct: 10 },
        },
        {
          contract_type: "put",
          direction: "sell",
          dte_target: 45,
          quantity: 1,
          strike_spec: { method: "delta", target: 0.16 },
        },
      ],
      entry_rules: { frequency: "weekly", max_open_trades: 3 },
      position_sizing: { mode: "fixed_contracts", contracts: 1 },
    };

    const parsed = StrategyDefinitionSchema.parse(input);
    expect(parsed.strategy_name).toBe("SPX IC 45DTE");
    expect(parsed.underlying).toBe("SPX");
    expect(parsed.legs).toHaveLength(2);

    // Round-trip: re-parse serialized output — all defaults should be present
    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect(roundTripped.slippage_entry).toBe(0.25);
    expect(roundTripped.slippage_exit).toBe(0.25);
    expect(roundTripped.slippage_stop_exit).toBe(0.5);
    expect(roundTripped.commission_per_contract).toBe(0.50);
    expect(roundTripped.legs[0].dte_tolerance).toBe(2);
    expect(roundTripped.legs[0].multiplier).toBe(100);
    expect(roundTripped.entry_rules.entry_time).toBe("09:45");
    expect(roundTripped.entry_rules.max_open_trades).toBe(3);
  });

  it("accepts all 5 strike spec methods", () => {
    const methods = [
      { method: "delta", target: 0.3 },
      { method: "otm_pct", pct: 5 },
      { method: "atm" },
      { method: "fixed_premium", premium: 2.5 },
      { method: "offset", parent_leg: 0, points: 50 },
    ];

    for (const strike_spec of methods) {
      const result = StrikeSpecSchema.safeParse(strike_spec);
      expect(result.success).toBe(true);
    }
  });

  it("accepts a 1-leg (minimum) definition", () => {
    const input = {
      strategy_name: "Single Put",
      underlying: "SPX",
      legs: [validLeg],
      entry_rules: validEntryRules,
      position_sizing: validPositionSizing,
    };
    const result = StrategyDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts max 8 legs", () => {
    const input = {
      strategy_name: "Complex 8-Leg Strategy",
      underlying: "SPX",
      legs: Array(8).fill(validLeg),
      entry_rules: validEntryRules,
      position_sizing: validPositionSizing,
    };
    const result = StrategyDefinitionSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects 9 legs with descriptive error", () => {
    const input = {
      strategy_name: "Too Many Legs",
      underlying: "SPX",
      legs: Array(9).fill(validLeg),
      entry_rules: validEntryRules,
      position_sizing: validPositionSizing,
    };
    const result = StrategyDefinitionSchema.safeParse(input);
    expect(result.success).toBe(false);
    // Error should reference the array constraint
    if (!result.success) {
      const errorText = JSON.stringify(result.error.issues);
      expect(errorText).toMatch(/legs|too_big|max/i);
    }
  });

  it("rejects unknown strike method with descriptive error", () => {
    const result = StrikeSpecSchema.safeParse({ method: "unknown_method" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorText = JSON.stringify(result.error.issues);
      // Discriminated union error should reference the invalid value or the method field
      expect(errorText).toMatch(/method|discriminator|invalid|unknown_method/i);
    }
  });

  it("rejects missing required fields in StrategyDefinitionSchema", () => {
    const result = StrategyDefinitionSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorText = JSON.stringify(result.error.issues);
      // Should mention missing required fields
      expect(errorText).toMatch(/strategy_name|underlying|legs|required/i);
    }
  });

  it("applies defaults correctly", () => {
    const input = {
      strategy_name: "Minimal",
      underlying: "SPX",
      legs: [validLeg],
      entry_rules: { frequency: "daily" },
      position_sizing: { mode: "fixed_contracts", contracts: 1 },
    };
    const parsed = StrategyDefinitionSchema.parse(input);

    // Top-level defaults
    expect(parsed.slippage_entry).toBe(0.25);
    expect(parsed.slippage_exit).toBe(0.25);
    expect(parsed.slippage_stop_exit).toBe(0.5);
    expect(parsed.commission_per_contract).toBe(0.50);

    // Leg defaults
    expect(parsed.legs[0].dte_tolerance).toBe(2);
    expect(parsed.legs[0].multiplier).toBe(100);

    // Entry rules defaults
    expect(parsed.entry_rules.entry_time).toBe("09:45");
    expect(parsed.entry_rules.max_open_trades).toBe(1);
  });

  it("offset strike spec requires parent_leg and points", () => {
    // Missing parent_leg and points → should fail
    const noFields = StrikeSpecSchema.safeParse({ method: "offset" });
    expect(noFields.success).toBe(false);

    // Both fields present → should succeed
    const withFields = StrikeSpecSchema.safeParse({
      method: "offset",
      parent_leg: 0,
      points: 50,
    });
    expect(withFields.success).toBe(true);
  });

  it("LegDefinitionSchema rejects invalid contract_type", () => {
    const result = LegDefinitionSchema.safeParse({
      ...validLeg,
      contract_type: "futures",
    });
    expect(result.success).toBe(false);
  });

  it("LegDefinitionSchema rejects invalid direction", () => {
    const result = LegDefinitionSchema.safeParse({
      ...validLeg,
      direction: "hold",
    });
    expect(result.success).toBe(false);
  });

  // --- New field tests: exact and max_width (D-13) ---

  it("offset exact defaults to true when omitted", () => {
    const result = StrikeSpecSchema.parse({
      method: "offset",
      parent_leg: 0,
      points: 50,
    });
    expect(result.exact).toBe(true);
  });

  it("offset exact accepts false", () => {
    const result = StrikeSpecSchema.parse({
      method: "offset",
      parent_leg: 0,
      points: 50,
      exact: false,
    });
    expect(result.exact).toBe(false);
  });

  it("delta accepts max_width", () => {
    const result = StrikeSpecSchema.safeParse({
      method: "delta",
      target: 0.16,
      max_width: 75,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_width).toBe(75);
    }
  });

  it("fixed_premium accepts max_width", () => {
    const result = StrikeSpecSchema.safeParse({
      method: "fixed_premium",
      premium: 2.5,
      max_width: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_width).toBe(100);
    }
  });

  it("offset accepts max_width", () => {
    const result = StrikeSpecSchema.safeParse({
      method: "offset",
      parent_leg: 0,
      points: 50,
      max_width: 75,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_width).toBe(75);
    }
  });

  it("otm_pct accepts max_width", () => {
    const result = StrikeSpecSchema.safeParse({
      method: "otm_pct",
      pct: 5,
      max_width: 50,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_width).toBe(50);
    }
  });

  it("max_width rejects zero and negative values", () => {
    const zeroResult = StrikeSpecSchema.safeParse({
      method: "delta",
      target: 0.16,
      max_width: 0,
    });
    expect(zeroResult.success).toBe(false);

    const negativeResult = StrikeSpecSchema.safeParse({
      method: "delta",
      target: 0.16,
      max_width: -10,
    });
    expect(negativeResult.success).toBe(false);
  });

  it("max_width is optional (omitting it succeeds)", () => {
    const result = StrikeSpecSchema.safeParse({
      method: "delta",
      target: 0.16,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.max_width).toBeUndefined();
    }
  });

  it("round-trip preserves exact and max_width on offset", () => {
    const input = {
      strategy_name: "SPX Spread",
      underlying: "SPX",
      legs: [
        {
          contract_type: "put",
          direction: "sell",
          dte_target: 45,
          quantity: 1,
          strike_spec: { method: "delta", target: 0.16 },
        },
        {
          contract_type: "put",
          direction: "buy",
          dte_target: 45,
          quantity: 1,
          strike_spec: {
            method: "offset",
            parent_leg: 0,
            points: 50,
            exact: false,
            max_width: 75,
          },
        },
      ],
      entry_rules: { frequency: "weekly" },
      position_sizing: { mode: "fixed_contracts", contracts: 1 },
    };

    const parsed = StrategyDefinitionSchema.parse(input);
    const roundTripped = JSON.parse(JSON.stringify(parsed));

    const offsetLeg = roundTripped.legs[1].strike_spec;
    expect(offsetLeg.exact).toBe(false);
    expect(offsetLeg.max_width).toBe(75);
  });
});
