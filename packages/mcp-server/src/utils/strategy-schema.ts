/**
 * Strategy Definition Zod Schemas
 *
 * Provides Zod-validated schema for the StrategyDefinition type used by the
 * backtesting engine (Phase 76). Supports 1-8 legs with 5 strike selection methods.
 *
 * Strike Methods:
 *   delta         - Target a specific delta (e.g., 0.16 for 16-delta put)
 *   otm_pct       - Percentage out-of-the-money (e.g., 5% OTM)
 *   atm           - At-the-money (current underlying price)
 *   fixed_premium - Target a specific premium amount
 *   offset        - Offset in points from another leg (for spreads)
 *
 * New fields (D-13):
 *   exact      (offset only) - When true (default), skip the leg if no strike exists at
 *                              exactly the offset distance. When false, snap to the nearest
 *                              directional strike within the chain.
 *   max_width  (delta, otm_pct, fixed_premium, offset) - Maximum distance in points from
 *                              the parent leg's strike. Optional constraint; leg is skipped
 *                              when the selected strike would exceed this width.
 *
 * Defaults applied on parse:
 *   LegDefinition.dte_tolerance = 2
 *   LegDefinition.multiplier    = 100
 *   EntryRules.entry_time       = "09:45"
 *   EntryRules.max_open_trades  = 1
 *   StrategyDefinition.slippage_entry         = 0.25
 *   StrategyDefinition.slippage_exit          = 0.25
 *   StrategyDefinition.slippage_stop_exit     = 0.50
 *   StrategyDefinition.commission_per_contract = 0.50
 *   StrategyDefinition.max_entry_spread_pct   = 0.20
 */

import { z } from "zod";

/**
 * Strike selection method for a leg.
 * Discriminated union — each variant has a `method` literal plus required params.
 */
export const StrikeSpecSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("delta"),
    target: z.number().max(1, "Delta target must be decimal (0-1), not percentage. Use 0.28 not 28."),
    max_width: z.number().positive().optional(),
  }),
  z.object({
    method: z.literal("otm_pct"),
    pct: z.number(),
    max_width: z.number().positive().optional(),
  }),
  z.object({ method: z.literal("atm") }),
  z.object({
    method: z.literal("fixed_premium"),
    premium: z.number(),
    max_width: z.number().positive().optional(),
  }),
  z.object({
    method: z.literal("offset"),
    parent_leg: z.number().int().nonnegative(),
    points: z.number(),
    exact: z.boolean().default(true),
    max_width: z.number().positive().optional(),
  }),
]);

/**
 * Single leg in a strategy definition.
 */
export const LegDefinitionSchema = z.object({
  contract_type: z.enum(["call", "put"]),
  direction: z.enum(["buy", "sell"]),
  dte_target: z.number().int().nonnegative(),
  dte_tolerance: z.number().int().nonnegative().default(2),
  quantity: z.number().positive(),
  strike_spec: StrikeSpecSchema,
  multiplier: z.number().positive().default(100),
});

/**
 * Entry filter discriminated union — extensible for future filter types (IVR, RSI).
 */
export const EntryFilterSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("blackout_dates"),
    dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  }),
  z.object({
    type: z.literal("vix_range"),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    type: z.literal("vix_term_ratio"),
    numerator: z.string().default("VIX9D"),
    denominator: z.string().default("VIX"),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    type: z.literal("vix_overnight_move"),
    direction: z.enum(["up", "down"]).optional(),
    unit: z.enum(["points", "pct"]).default("points"),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    type: z.literal("gap"),
    direction: z.enum(["up", "down"]).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    type: z.literal("underlying_move"),
    direction: z.enum(["up", "down"]).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    type: z.literal("rsi"),
    field: z.string().default("RSI_14"),  // column name in market.enriched
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    type: z.literal("min_sl_ratio"),
    min: z.number().positive(),
  }),
]);

/**
 * Exit trigger discriminated union.
 *
 * Each variant validates the user-facing fields for that trigger type.
 * Runtime-injected fields (entryCost, openDate, expiry, vixPrices, legs, etc.)
 * are optional so they pass through when hydrated by the simulation engine.
 * .passthrough() allows extra metadata fields and forward-compatible additions.
 *
 * Trigger types registered via registerTrigger():
 *   profitTarget, stopLoss, trailingStop, clockTimeExit, dteExit, ditExit,
 *   vixMove, vix9dMove, vix9dVixRatio, underlyingPriceMove,
 *   slRatioThreshold, slRatioMove, perLegDelta, positionDelta, profitAction
 */
const ExitTriggerUnitSchema = z.enum(["percent", "dollar"]).optional();

export const ExitTriggerSchema = z.discriminatedUnion("type", [
  // profitTarget: threshold is the profit level to target
  z.object({
    type: z.literal("profitTarget"),
    threshold: z.number(),
    unit: ExitTriggerUnitSchema,
    entryCost: z.number().optional(), // runtime-injected
  }).passthrough(),

  // stopLoss: threshold is the max loss (absolute value; sign is normalised internally)
  z.object({
    type: z.literal("stopLoss"),
    threshold: z.number(),
    unit: ExitTriggerUnitSchema,
    entryCost: z.number().optional(), // runtime-injected
  }).passthrough(),

  // trailingStop: trailAmount (preferred) or threshold as fallback
  z.object({
    type: z.literal("trailingStop"),
    trailAmount: z.number().optional(),
    threshold: z.number().optional(),
  }).passthrough(),

  // clockTimeExit: exit at a specific time of day, optionally after N days in trade
  z.object({
    type: z.literal("clockTimeExit"),
    clockTime: z.string().regex(/^\d{2}:\d{2}$/, "clockTime must be HH:MM").optional(),
    afterDit: z.number().int().nonnegative().optional(),
    openDate: z.string().optional(), // runtime-injected
  }).passthrough(),

  // dteExit: exit when calendar DTE <= threshold
  z.object({
    type: z.literal("dteExit"),
    threshold: z.number().int().nonnegative(),
    expiry: z.string().optional(), // runtime-injected
  }).passthrough(),

  // ditExit: exit when calendar DIT >= threshold
  z.object({
    type: z.literal("ditExit"),
    threshold: z.number().int().nonnegative(),
    openDate: z.string().optional(), // runtime-injected
  }).passthrough(),

  // vixMove: exit when VIX % change from entry exceeds threshold
  z.object({
    type: z.literal("vixMove"),
    threshold: z.number(),
    vixPrices: z.any().optional(), // runtime-injected Map<string, number>
  }).passthrough(),

  // vix9dMove: exit when VIX9D % change from entry exceeds threshold
  z.object({
    type: z.literal("vix9dMove"),
    threshold: z.number(),
    vix9dPrices: z.any().optional(), // runtime-injected Map<string, number>
  }).passthrough(),

  // vix9dVixRatio: exit when VIX9D/VIX ratio crosses threshold
  z.object({
    type: z.literal("vix9dVixRatio"),
    threshold: z.number(),
    vixPrices: z.any().optional(),   // runtime-injected
    vix9dPrices: z.any().optional(), // runtime-injected
  }).passthrough(),

  // underlyingPriceMove: exit when underlying % move exceeds threshold
  z.object({
    type: z.literal("underlyingPriceMove"),
    threshold: z.number(),
    underlyingPrices: z.any().optional(), // runtime-injected Map<string, number>
  }).passthrough(),

  // slRatioThreshold: exit when S/L ratio crosses exitBelow/exitAbove/threshold
  z.object({
    type: z.literal("slRatioThreshold"),
    threshold: z.number().optional(),
    exitBelow: z.number().optional(),
    exitAbove: z.number().optional(),
    legs: z.any().optional(), // runtime-injected
  }).passthrough(),

  // slRatioMove: exit when signed percent move from initial crosses threshold
  z.object({
    type: z.literal("slRatioMove"),
    threshold: z.number(),
    legs: z.any().optional(), // runtime-injected
  }).passthrough(),

  // perLegDelta: exit when a specific leg's delta crosses threshold
  z.object({
    type: z.literal("perLegDelta"),
    threshold: z.number().optional(),
    legIndex: z.number().int().nonnegative().optional(),
    exitAbove: z.number().optional(),
    exitBelow: z.number().optional(),
  }).passthrough(),

  // positionDelta: exit when net position delta crosses threshold
  z.object({
    type: z.literal("positionDelta"),
    threshold: z.number().optional(),
    exitAbove: z.number().optional(),
    exitBelow: z.number().optional(),
  }).passthrough(),

  // profitAction: stepped profit-taking with optional partial closes
  z.object({
    type: z.literal("profitAction"),
    steps: z.array(
      z.object({
        armAt: z.number(),
        stopAt: z.number(),
        closeAllocationPct: z.number().min(0).max(1).optional(),
      })
    ).min(1),
    unit: ExitTriggerUnitSchema,
    entryCost: z.number().optional(), // runtime-injected
  }).passthrough(),
]);

export type ExitTrigger = z.infer<typeof ExitTriggerSchema>;

/**
 * Position sizing configuration.
 */
export const PositionSizingSchema = z.object({
  mode: z.enum(["fixed_contracts", "margin_pct", "fixed_capital"]),
  contracts: z.number().int().positive().optional(),
  margin_pct: z.number().min(0).max(1).optional(),
  starting_capital: z.number().positive().optional(),
  max_contracts: z.number().int().positive().optional(),
  margin_per_spread: z.number().positive().optional(),
});

/**
 * Trade entry frequency and timing rules.
 */
export const EntryRulesSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  day_of_week: z.union([
    z.number().int().min(0).max(4),
    z.array(z.number().int().min(0).max(4)),
  ]).optional(),
  entry_time: z.string().default("09:45"),
  entry_time_end: z.string().optional(),  // "HH:MM" — when set, scans window from entry_time to entry_time_end
  max_open_trades: z.number().int().positive().default(1),
  at_capacity: z.enum(["skip", "prune"]).default("skip"),
});

/**
 * Complete strategy definition for the backtesting engine.
 * Supports 1–8 legs with configurable entry rules, position sizing, and cost parameters.
 */
export const StrategyDefinitionSchema = z.object({
  strategy_name: z.string().min(1),
  underlying: z.string().min(1),
  legs: z.array(LegDefinitionSchema).min(1).max(8),
  entry_rules: EntryRulesSchema,
  position_sizing: PositionSizingSchema,
  slippage_entry: z.number().min(0).default(0.25),
  slippage_exit: z.number().min(0).default(0.25),
  slippage_stop_exit: z.number().min(0).default(0.5),
  commission_per_contract: z.number().min(0).default(0.50),
  opening_commission: z.number().min(0).optional(),
  closing_commission: z.number().min(0).optional(),
  max_entry_spread_pct: z.number().min(0).max(1).default(0.20),
  entry_filters: z.array(EntryFilterSchema).optional(),
  exit_triggers: z.array(ExitTriggerSchema).optional(),
});

// TypeScript type exports
export type StrategyDefinition = z.infer<typeof StrategyDefinitionSchema>;
export type LegDefinition = z.infer<typeof LegDefinitionSchema>;
export type StrikeSpec = z.infer<typeof StrikeSpecSchema>;
export type PositionSizing = z.infer<typeof PositionSizingSchema>;
export type EntryRules = z.infer<typeof EntryRulesSchema>;
export type EntryFilter = z.infer<typeof EntryFilterSchema>;
