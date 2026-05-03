/**
 * Unit tests for strategy-schema.ts
 *
 * Tests Zod schema validation for StrategyDefinitionSchema, LegDefinitionSchema,
 * StrikeSpecSchema, EntryRulesSchema, and PositionSizingSchema.
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
const validCosts = {
  slippage_entry: 0.1,
  slippage_exit: 0.1,
  slippage_stop_exit: 0.1,
  opening_commission: 0.5,
  closing_commission: 0.5,
};

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
      slippage_entry: 0.1,
      slippage_exit: 0.1,
      slippage_stop_exit: 0.1,
      opening_commission: 1.78,
      closing_commission: 0.78,
    };

    const parsed = StrategyDefinitionSchema.parse(input);
    expect(parsed.strategy_name).toBe("SPX IC 45DTE");
    expect(parsed.underlying).toBe("SPX");
    expect(parsed.legs).toHaveLength(2);

    const roundTripped = JSON.parse(JSON.stringify(parsed));
    expect(roundTripped.slippage_entry).toBe(0.1);
    expect(roundTripped.slippage_exit).toBe(0.1);
    expect(roundTripped.slippage_stop_exit).toBe(0.1);
    expect(roundTripped.opening_commission).toBe(1.78);
    expect(roundTripped.closing_commission).toBe(0.78);
    // dte_tolerance is now optional (no schema default). The fixture above
    // doesn't set it, so the parsed leg has dte_tolerance undefined — which
    // signals the resolver to slide forward unbounded ("Use Exact DTE OFF"
    // OO semantics). The round-trip therefore omits the field entirely.
    expect(roundTripped.legs[0].dte_tolerance).toBeUndefined();
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
      ...validCosts,
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
      ...validCosts,
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
      ...validCosts,
    };
    const result = StrategyDefinitionSchema.safeParse(input);
    expect(result.success).toBe(false);
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
      expect(errorText).toMatch(/method|discriminator|invalid|unknown_method/i);
    }
  });

  it("rejects missing required fields in StrategyDefinitionSchema", () => {
    const result = StrategyDefinitionSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorText = JSON.stringify(result.error.issues);
      expect(errorText).toMatch(/strategy_name|underlying|legs|required/i);
    }
  });

  it("rejects missing opening_commission / closing_commission", () => {
    const noCommissions = {
      strategy_name: "Missing commissions",
      underlying: "SPX",
      legs: [validLeg],
      entry_rules: validEntryRules,
      position_sizing: validPositionSizing,
      slippage_entry: 0.1,
      slippage_exit: 0.1,
      slippage_stop_exit: 0.1,
    };
    const result = StrategyDefinitionSchema.safeParse(noCommissions);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errorText = JSON.stringify(result.error.issues);
      expect(errorText).toMatch(/opening_commission|closing_commission/);
    }
  });

  it("applies leg and entry defaults correctly", () => {
    const input = {
      strategy_name: "Minimal",
      underlying: "SPX",
      legs: [validLeg],
      entry_rules: { frequency: "daily" },
      position_sizing: { mode: "fixed_contracts", contracts: 1 },
      ...validCosts,
    };
    const parsed = StrategyDefinitionSchema.parse(input);

    expect(parsed.slippage_entry).toBe(0.1);
    expect(parsed.slippage_exit).toBe(0.1);
    expect(parsed.slippage_stop_exit).toBe(0.1);
    expect(parsed.opening_commission).toBe(0.5);
    expect(parsed.closing_commission).toBe(0.5);

    // dte_tolerance is optional with no schema default — undefined signals
    // unlimited forward slide (mirrors OO "Use Exact DTE OFF").
    expect(parsed.legs[0].dte_tolerance).toBeUndefined();
    expect(parsed.legs[0].multiplier).toBe(100);

    expect(parsed.entry_rules.entry_time).toBe("09:45");
    expect(parsed.entry_rules.max_open_trades).toBe(1);
  });

  it("defaults RSI timing to intraday_to_entry", () => {
    const input = {
      strategy_name: "RSI strategy",
      underlying: "SPX",
      legs: [validLeg],
      entry_rules: { frequency: "daily" },
      position_sizing: { mode: "fixed_contracts", contracts: 1 },
      entry_filters: [{ type: "rsi", field: "RSI_14", min: 60 }],
      ...validCosts,
    };

    const parsed = StrategyDefinitionSchema.parse(input);

    expect(parsed.entry_filters?.[0]).toMatchObject({
      type: "rsi",
      timing: "intraday_to_entry",
    });
  });

  it("offset strike spec requires parent_leg and points", () => {
    const noFields = StrikeSpecSchema.safeParse({ method: "offset" });
    expect(noFields.success).toBe(false);

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
      ...validCosts,
    };

    const parsed = StrategyDefinitionSchema.parse(input);
    const roundTripped = JSON.parse(JSON.stringify(parsed));

    const offsetLeg = roundTripped.legs[1].strike_spec;
    expect(offsetLeg.exact).toBe(false);
    expect(offsetLeg.max_width).toBe(75);
  });
});
