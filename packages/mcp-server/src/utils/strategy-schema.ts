/**
 * Strategy Definition Zod Schemas
 *
 * Provides Zod-validated schema for the StrategyDefinition type used by the
 * strategy engine. Supports 1-8 legs with 5 strike selection methods.
 *
 * Strike Methods:
 *   delta         - Target a specific delta (e.g., 0.16 for 16-delta put)
 *   otm_pct       - Percentage out-of-the-money (e.g., 5% OTM)
 *   atm           - At-the-money (current underlying price)
 *   fixed_premium - Target a specific premium amount
 *   offset        - Offset in points from another leg (for spreads)
 *
 * Commissions and slippage are modeled per-side (Option Omega convention):
 * opening_commission + closing_commission are applied per contract × leg
 * quantity, and slippage_entry / slippage_exit are applied at fill.
 *
 * Blackout days use named shared lists referenced by slug (e.g.
 * "shw-tuesdays") from {dataRoot}/blackouts/{ref}.json.
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
  /**
   * DTE selection policy. Mirrors OO's "Use Exact DTE" toggle:
   *   - omitted/undefined → "Use Exact DTE = OFF" (default): slide forward to
   *     the next available expiry at or after `dte_target`. No upper cap —
   *     OO docs: "If Exact DTE is toggled off, then the next available
   *     expiration further out in time is used; there is no limit to how far
   *     it will look".
   *   - 0 → "Use Exact DTE = ON": only the exact `dte_target` expiry is
   *     accepted; if not in the chain, skip the date.
   *   - N > 0 → cap forward roll at `dte_target + N`. Less common; useful when
   *     a strategy wants slide behavior but with a sanity cap.
   */
  dte_tolerance: z.number().int().nonnegative().optional(),
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
    // Reference to a shared blackout list under {dataRoot}/blackouts/{ref}.json
    // (or an array of such refs, combined via union).
    ref: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
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
    timing: z.enum(["intraday_to_entry", "prior_close"]).default("intraday_to_entry"),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    // Mirrors OO's "Below/Above N-Day SMA" entry condition.
    // SMA computed from the last N daily closes prior to entry; spot from
    // intraday at-or-before entry (default) or prior close.
    type: z.literal("sma"),
    field: z.string().default("SMA_9"),  // SMA_<N> determines the period
    timing: z.enum(["intraday_to_entry", "prior_close"]).default("intraday_to_entry"),
    direction: z.enum(["below", "above"]),
  }),
  z.object({
    type: z.literal("min_sl_ratio"),
    min: z.number().positive(),
  }),
  z.object({
    // Mirrors OO's "Use Min/Max Entry Premium" with credit/debit polarity.
    // Computed post-strike as the net entry mark (sells receive, buys pay) per
    // contract — including the multiplier — so a 1-lot SPX DC priced at $1.50
    // net debit yields entry_premium = -150. `direction: "debit"` flips the
    // sign so positive thresholds map to debit values; `direction: "credit"`
    // keeps the natural positive sign for credits.
    type: z.literal("entry_premium"),
    direction: z.enum(["credit", "debit"]),
    min: z.number().optional(),
    max: z.number().optional(),
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
    requiredHits: z.number().int().positive().optional(),
    capProfits: z.boolean().optional(), // default false; clamps pnlAtFire to target after 09:32 when true
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
 * Complete strategy definition for the strategy engine.
 * Supports 1–8 legs with configurable entry rules, position sizing, and cost parameters.
 */
export const StrategyDefinitionSchema = z.object({
  strategy_name: z.string().min(1),
  underlying: z.string().min(1),
  legs: z.array(LegDefinitionSchema).min(1).max(8),
  entry_rules: EntryRulesSchema,
  position_sizing: PositionSizingSchema,
  slippage_entry: z.number().min(0),
  slippage_exit: z.number().min(0),
  slippage_stop_exit: z.number().min(0),
  opening_commission: z.number().min(0),
  closing_commission: z.number().min(0),
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
