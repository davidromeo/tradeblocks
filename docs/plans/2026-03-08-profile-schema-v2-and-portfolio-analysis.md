# Profile Schema V2 + Portfolio Analysis Tools

**Date**: 2026-03-08
**Status**: Approved
**Goal**: Upgrade strategy profile schema and build analysis tools for portfolio allocation optimization, gap detection, and regime-aware recommendations.

---

## Background & Motivation

We profiled all 18 strategies in main-port plus their standalone backtest blocks (total ~30 profiles). During this process, several schema limitations became clear:

1. **Backtest vs live allocation is the most important number for portfolio analysis, and it's a free-text string.** Every strategy has two allocations — the backtest block runs at a higher % (e.g. 10%) while main-port runs the same strategy at a lower % (e.g. 1%). Currently both are crammed into `positionSizing.description`. Any tool trying to reason about allocation scaling must parse prose.

2. **Strike selection method varies across strategies and affects vol sensitivity.** Most strategies use delta-based strikes (e.g. "25-delta"), but Vol Crush Special uses dollar-price strikes ("$3.50 premium") and ITM SPS uses percentage ("0.1%"). This distinction is critical for understanding how strategies behave when VIX spikes — dollar-priced strikes move to different deltas in high vol, fundamentally changing the risk profile. Currently this is a free-text string in `legs[].strike`.

3. **Stop loss mechanics differ and affect drawdown modeling.** Some strategies use S/L ratio stops (most DCs), some use dollar stops (Vol Crush at $4.50), some use debit percentage stops (Gap N Crap at 50%). Vol Crush also has a separate stop loss slippage (0.3) vs regular exit slippage (0.2), and uses intra-minute NBBO monitoring. All of this is currently free text in `exitRules[].trigger` and `keyMetrics`.

4. **Behavioral flags are buried in keyMetrics or thesis.** Several strategies have important execution characteristics — re-entry after exit (Vol Crush), cap profits/losses, require two prices for profit target, close trades on completion, ignore margin requirements. These affect trade count, P/L distribution, and sizing feasibility. Currently they're unstructured.

5. **Underlying is not stored.** 17 of 18 strategies trade SPX, but Tuesday 2/3 DC QQQ trades QQQ. For correlation analysis, knowing the underlying is essential. Currently it's only in the thesis text.

6. **Asymmetric leg sizing is implicit.** The 2/3 DCs have 2 puts and 3 calls. Vol Crush has 1 put and 2 calls. This is captured in individual leg quantities but there's no summary field for quick querying of directional bias.

### What This Unlocks

The schema upgrades are not cosmetic — they're the foundation for three analysis capabilities:

- **Static gap analysis**: "Where is my portfolio blind? Which days, regimes, or market conditions have zero coverage?"
- **What-if allocation modeling**: "If I double the 9/23 DC and halve the 2/3 DC, how does my drawdown profile change?"
- **Regime-aware allocation**: "In high vol environments, which strategies should I lean into vs pull back?"

None of these work well when the tool has to parse free text to understand strategy characteristics.

---

## Phase 1: Schema Upgrades

### 1.1 Position Sizing — Split backtest vs live

**Why**: Every strategy has two allocations. Analysis tools need both numbers:
- `backtestAllocationPct` is what the standalone block uses (e.g. 10% for 2/3 DC). This represents the "full power" P/L curve.
- `liveAllocationPct` is what main-port uses (e.g. 2% for 2/3 DC). This represents actual capital at risk.
- The ratio between them (5:1 in this case) is the scaling factor. Outliers in this ratio (afternoon ORB is 100:1) flag strategies where live sizing is especially conservative.
- `maxContractsPerTrade` is distinct from `maxContracts` — Vol Crush allows max 2 contracts per entry but can re-enter, so total exposure can exceed 2.

**Changes to `PositionSizing`**:
```typescript
interface PositionSizing {
  method: string;                    // "pct_of_portfolio", "fixed_contracts", "fixed_dollar", "discretionary"
  backtestAllocationPct?: number;    // NEW - what the backtest block uses
  liveAllocationPct?: number;        // NEW - what main-port / live trading uses
  allocationPct?: number;            // DEPRECATED but kept for backward compat
  maxContracts?: number;             // max total open contracts
  maxContractsPerTrade?: number;     // NEW - max per individual entry (Vol Crush = 2)
  maxAllocationDollar?: number;
  maxOpenPositions?: number;
  description?: string;
}
```

**Backward compat**: Tools check `backtestAllocationPct`/`liveAllocationPct` first, fall back to `allocationPct` if not present.

### 1.2 Legs — Structured strike selection

**Why**: Vol Crush's dollar-priced strikes behave fundamentally differently from delta-based strikes in changing vol environments. When VIX goes from 15 to 30, a "$3.50 premium" strike moves much closer to ATM (higher delta), while a "25-delta" strike stays at 25 delta by definition (just at a wider dollar distance). Tools modeling vol regime impact need to know this distinction without parsing strings.

**Changes to `LegDetail`**:
```typescript
interface LegDetail {
  type: string;                      // "long_put", "short_call", etc.
  strike: string;                    // KEEP as human-readable label
  strikeMethod?: 'delta' | 'dollar_price' | 'offset' | 'percentage';  // NEW
  strikeValue?: number;              // NEW - the numeric part (25, 3.50, 0.1, 80)
  expiry: string;                    // "0-DTE", "2-DTE", "7-DTE", etc.
  quantity: number;                  // positive=long, negative=short
}
```

**Examples**:
- `{ strike: "25-delta", strikeMethod: "delta", strikeValue: 25 }` — most DCs
- `{ strike: "$3.50 premium", strikeMethod: "dollar_price", strikeValue: 3.50 }` — Vol Crush short put
- `{ strike: "100-strike offset lower", strikeMethod: "offset", strikeValue: -100 }` — Vol Crush long put
- `{ strike: "0.1% (near ATM)", strikeMethod: "percentage", strikeValue: 0.1 }` — ITM SPS

### 1.3 Exit Rules — Structured stop loss

**Why**: Analysis tools modeling drawdown need to understand stop mechanics programmatically. A $4.50 dollar stop on Vol Crush behaves differently from a 50% debit stop on Gap N Crap or a 0.2 S/L ratio stop on the DCs. The monitoring granularity also matters — Vol Crush's intra-minute NBBO stop triggers more frequently than an end-of-bar check, affecting fill quality and slippage modeling.

**Changes to `ExitRule`**:
```typescript
interface ExitRule {
  type: string;                      // "stop_loss", "profit_target", "time_exit", "conditional"
  trigger: string;                   // KEEP as human-readable
  description?: string;
  stopLossType?: 'percentage' | 'dollar' | 'sl_ratio' | 'debit_percentage';  // NEW
  stopLossValue?: number;            // NEW - numeric threshold (4.50, 0.2, 50)
  monitoring?: {                     // NEW
    granularity?: 'intra_minute' | 'candle_close' | 'end_of_bar';
    priceSource?: 'nbbo' | 'mid' | 'last';
  };
  slippage?: number;                 // NEW - per-rule slippage override
}
```

### 1.4 Top-level profile flags

**Why**: These flags affect trade generation, P/L distribution, and sizing feasibility. They need to be queryable for portfolio-level analysis.

**New fields on `StrategyProfile`**:
```typescript
interface StrategyProfile {
  // ... all existing fields ...
  underlying?: string;               // "SPX", "QQQ" — critical for correlation analysis
  reEntry?: boolean;                  // Vol Crush re-enters after stop, generating multiple trades/day
  capProfits?: boolean;              // Caps profit at PT level (several DCs, Vol Crush)
  capLosses?: boolean;               // Caps loss at SL level (Vol Crush)
  requireTwoPricesPT?: boolean;      // Requires two consecutive prices at PT to exit
  closeOnCompletion?: boolean;       // Closes all legs when one side hits target
  ignoreMarginReq?: boolean;         // Backtest ignores margin (Vol Crush)
}
```

**Database**: Add nullable columns to `profiles.strategy_profiles` via ALTER TABLE. JSON columns (legs, exit_rules, position_sizing) don't need migration — new nested fields appear naturally.

### 1.5 Zod Schema Updates

Update `profileStrategySchema` in `packages/mcp-server/src/tools/profiles.ts` to validate all new fields. All new fields are optional with no defaults to maintain backward compatibility.

### 1.6 Migration & Backward Compatibility

- **Schema version check**: Add a version marker. On startup, if new columns don't exist, run ALTER TABLE.
- **No breaking changes**: All new fields are optional. Existing profiles continue to work.
- **Graceful degradation**: Analysis tools check for new fields and skip enhanced analysis when absent.
- **Re-profiling**: After schema ships, re-profile all 30+ strategies to populate new fields. Most data is already captured in thesis/keyMetrics — just needs to move to structured fields. This can be done programmatically by parsing existing profiles.

---

## Phase 2: Analysis Tools

### 2.1 Enhanced `portfolio_health_check` — Static Gap Analysis

**File**: Enhance existing tool in `packages/mcp-server/src/tools/`

**What it does now**: Basic portfolio health metrics.

**What it should do with profiles**:

1. **Regime coverage matrix**: Load all profiles' `expectedRegimes`. Cross-reference with actual trade performance grouped by `Vol_Regime` and `Trend_Direction` (from enriched market data). Flag regimes with zero strategy coverage.

2. **Day-of-week coverage heatmap**: Parse `entryFilters` for day-of-week filters across all strategies. Show which days have heavy coverage (Tuesday has 2/3 DC, DC 2/7 Tues, 8/10 DC, QQQ DC) vs thin coverage. Flag single-strategy days.

3. **Allocation concentration**: Using `liveAllocationPct`, calculate:
   - Total live allocation across all strategies
   - Allocation by structure type (double_calendar vs iron_condor vs vertical_spread vs reverse_iron_condor)
   - Allocation by underlying (SPX vs QQQ)
   - Allocation by DTE bucket (0-DTE, 1-2 DTE, 5-7 DTE, 21-28 DTE)

4. **Correlation risk flags**: Strategies on the same underlying with overlapping entry days and similar DTE ranges are likely correlated. Flag clusters where >30% of total allocation is in correlated strategies.

5. **Backtest-to-live scaling ratios**: Calculate `backtestAllocationPct / liveAllocationPct` for each strategy. Flag outliers (afternoon ORB at 100:1 vs typical 5-10:1). These may indicate either extreme conservatism or strategies where the user is still gaining confidence.

### 2.2 Enhanced `what_if_scaling` — Allocation Optimization

**File**: Enhance existing tool in `packages/mcp-server/src/tools/`

**What it does now**: Basic P/L scaling simulation.

**Enhancements with profiles**:

1. **Profile-aware scaling**: Instead of naive linear P/L scaling, use `backtestAllocationPct` to understand the base, then model what `liveAllocationPct` changes mean. A strategy backtested at 5% and currently at 1% has a known P/L curve at 5x current size — use the backtest block's actual data for that scenario.

2. **Margin-aware constraints**: When `ignoreMarginReq: true`, flag that scaling up may hit margin limits the backtest didn't model. Include a margin reality check.

3. **Max contracts ceiling**: `maxContractsPerTrade` sets an upper bound. If scaling from 1% to 3% would require 4 contracts but max is 2, flag the constraint.

4. **Multi-strategy what-if**: Accept an array of `{ strategyName, newAllocationPct }` changes. Simulate the combined impact on:
   - Portfolio drawdown (max DD, average DD)
   - Sharpe ratio
   - Win rate (weighted)
   - Daily P/L correlation between strategies

### 2.3 New: `regime_allocation_advisor`

**File**: New tool, likely in `packages/mcp-server/src/tools/profile-analysis.ts` or new file.

**Purpose**: Cross-reference regime performance with current allocations to recommend regime-specific sizing.

**Input**:
```typescript
{
  blockId: string;          // "main-port"
  regime?: string;          // Optional filter: "high_vol", "low_vol", etc.
  lookbackDays?: number;    // Default 252 (1 year)
}
```

**Process**:
1. Load all strategy profiles for the block
2. Query actual trade performance grouped by regime (Vol_Regime from enriched market data)
3. For each strategy + regime combination, calculate: win rate, avg P/L, Sharpe, max loss
4. Cross-reference with profile's `expectedRegimes` — flag mismatches
5. Calculate optimal allocation weight per regime using risk-adjusted returns

**Output**:
```typescript
{
  regimes: {
    [regime: string]: {
      currentTotalAllocation: number;      // sum of liveAllocationPct for strategies active in this regime
      strategies: {
        strategyName: string;
        currentAllocation: number;         // liveAllocationPct
        regimeWinRate: number;
        regimeAvgPL: number;
        regimeSharpe: number;
        expectedToTradeHere: boolean;      // from profile.expectedRegimes
        recommendation: 'increase' | 'maintain' | 'decrease' | 'pause';
        suggestedAllocation?: number;
      }[];
      blindSpots: string[];                // regime conditions with no strategy coverage
      overconcentration: string[];         // regime conditions with >X% in correlated strategies
    }
  };
  thesisViolations: {                      // strategies underperforming in their expected regimes
    strategyName: string;
    expectedRegime: string;
    actualPerformance: { winRate: number; avgPL: number; sharpe: number };
    recommendation: string;
  }[];
  hiddenEdges: {                           // strategies performing well in unexpected regimes
    strategyName: string;
    unexpectedRegime: string;
    performance: { winRate: number; avgPL: number; sharpe: number };
    suggestion: string;
  }[];
}
```

---

## Multi-User Considerations: Tiered Profile Depth

Not all users will provide the same level of detail. The schema is designed so every new field is optional, but the analysis tools need to know what they can and can't do based on what's present.

### Tier 1: Minimal Profile
**Fields set**: `structureType`, `greeksBias`, maybe `legs` and `thesis`.
**What works**: Basic `portfolio_structure_map` (structure type distribution). `list_profiles` for documentation. Simple comparisons via `compare_blocks`.
**What doesn't work**: No allocation analysis, no regime recommendations, no gap detection.

### Tier 2: Standard Profile
**Fields set**: Tier 1 + `entryFilters`, `exitRules`, `expectedRegimes`, `positionSizing.allocationPct` (single number), `underlying`.
**What works**: Everything in Tier 1 plus `validate_entry_filters`, `analyze_structure_fit`, `portfolio_health_check` (day-of-week coverage, regime coverage, allocation concentration), basic `regime_allocation_advisor` (using single allocation + regime performance).
**What doesn't work**: No backtest-vs-live scaling analysis, no margin-aware what-if, no stop loss modeling.

### Tier 3: Full Profile (power users)
**Fields set**: Tier 2 + `backtestAllocationPct`/`liveAllocationPct`, `strikeMethod`/`strikeValue` on legs, structured stop loss fields, behavioral flags (`reEntry`, `capProfits`, `capLosses`, `ignoreMarginReq`, etc.).
**What works**: Everything. Full `what_if_scaling` with margin constraints and contract ceilings. Drawdown modeling that accounts for stop mechanics. Scaling ratio analysis. Vol-regime sensitivity based on strike method.

### Implementation Rule
Every analysis tool must check which tier of data is available and:
1. **Run what it can** with the data present — never fail because optional fields are missing
2. **Report what it skipped** — e.g. "Skipped scaling ratio analysis: backtestAllocationPct not set for 3 strategies"
3. **Suggest upgrades** — e.g. "Add `underlying` to profiles for correlation analysis"

This way a casual user gets value from a 30-second profile, while a power user who fills everything out gets the full suite.

---

## Implementation Order

### Phase 1: Schema (do first, foundation for everything)
1. Update TypeScript interfaces in `models/strategy-profile.ts`
2. Update Zod schema in `tools/profiles.ts`
3. Add DB migration in `db/profile-schemas.ts`
4. Update `profile_strategy` tool to accept new fields
5. Update `get_strategy_profile` / `list_profiles` to return new fields
6. Test with a manual profile upsert
7. Re-profile existing strategies with new structured fields (can be scripted by reading existing profiles and extracting data from thesis/keyMetrics)

### Phase 2: Analysis Tools (builds on schema)
1. Enhance `portfolio_health_check` with profile-aware gap analysis
2. Enhance `what_if_scaling` with profile-aware constraints
3. Build `regime_allocation_advisor` as new tool
4. Register new tool in `index.ts`
5. Test all three against main-port block

---

## Strategy Profiles Reference

For context, here are all 18 main-port strategies and their key characteristics that drove this design:

| Strategy | Underlying | Structure | Live % | Backtest % | DTE | Entry Days | Notable |
|----------|-----------|-----------|--------|------------|-----|------------|---------|
| 2/3 DC - v2 | SPX | double_calendar | 2% | 10% | 2/3 | Tue | 2:3 put:call ratio, VIX9D/VIX filter |
| 21/28 30 Delta | SPX | double_calendar | 1% | 5.5% | 21/28 | Daily | RSI >= 60 |
| 8/10 DC - v2 | SPX | double_calendar | 2% | 3.5% | 8/10 | Tue | VIX 11-35 |
| 9/23 DC | SPX | double_calendar | 1% | 8.5% | 9/23 | Mon/Wed/Thu/Fri | RSI >= 60 |
| Afternoon Low ORB DC Bounce | SPX | double_calendar | 1% | 100% | 1/10 | Mon/Tue/Wed | ORB filter, day-open strikes |
| DC 2/7 Tues | SPX | double_calendar | 1% | 10% | 2/7 | Tue | 25/10 delta skew |
| DC 2/7 Mon, Wed - v2 | SPX | double_calendar | 2% | 9% | 2/7 | Mon/Wed | 20/15 delta |
| DC long put inside 7/14 MWF | SPX | double_calendar | 1% | 5% | 7/14 | Mon/Wed/Fri | RSI >= 60, offset strikes |
| Friday DC 5/7 25D - v2 | SPX | double_calendar | 1% | 5.6% | 5/7 | Fri | VIX9D exit, profit target 60% |
| Friday Happy Hour Calendar 6/7 | SPX | double_calendar | 1% | 7% | 6/7 | Fri | 25/15 delta, profit target 70% |
| Hump Day Half-Baked 1/2 | SPX | double_calendar | 1% | 7.5% | 1/2 | Wed | VIX9D/VIX >= 0.85, profit target 90% |
| ITM SPS everyday | SPX | short_put_spread | 0.5% | 2.2% | 0 | Mon/Tue/Thu/Fri | Dollar-price strike, VIX overnight filter |
| Monday 2/4 DC - v2 | SPX | double_calendar | 1% | 13.5% | 2/4 | Mon | Blackout days, profit target 50% |
| Pickle RIC v2 | SPX | reverse_iron_condor | 0.5% | 2.75% | 0 | Tue-Fri | Separate put/call exits, VIX move filter |
| Slow Burn Calendar 21/28 | SPX | double_calendar | 2% | 5.5% | 21/28 | Daily | VIX max 23, 14 DIT exit |
| Thursday Gap N Crap | SPX | vertical_spread | 0.5% | 2% | 1 | Thu | Gap-up filter, bearish bet |
| Tuesday 2/3 DC QQQ | QQQ | double_calendar | 2% | 10% | 2/3 | Tue | Only QQQ strategy, 2:3 ratio |
| Vol Crush Special v1.5 | SPX | iron_condor | 1% | 100% | 0 | Daily | Dollar-price strikes, re-entry, asymmetric 1:2, intra-minute NBBO stop, separate stop slippage |

### Standalone Backtest Blocks

| Block | Maps to Main-Port Strategy | Backtest % |
|-------|---------------------------|------------|
| 2_3 dc | 2/3 DC - v2 | 10% |
| 2_7 dc mon, wed | DC 2/7 Mon, Wed - v2 | 9% |
| 2_7 dc tues | DC 2/7 Tues | 10% |
| 21_28 30 Delta | 21/28 30 Delta | 5.5% |
| 7_14 dc mwf | DC long put inside 7/14 MWF | 5% |
| 5_7 25D dc | Friday DC 5/7 25D - v2 | 5.6% |
| 6_7 dc | Friday Happy Hour Calendar 6/7 | 7% |
| 1_2 dc wednesday | Hump Day Half-Baked 1/2 | 7.5% |
| 8_10 dc | 8/10 DC - v2 | 3.5% |
| 9_23 dc | 9/23 DC | 8.5% |
| afternoon low orb dc bounce | Afternoon Low ORB DC Bounce | 100% |
| itm sps | ITM SPS everyday | 2.2% |
| monday 2_4 dc | Monday 2/4 DC - v2 | 13.5% |
| pickle ric | Pickle RIC v2 | 2.75% |
| slow burn 21_28 | Slow Burn Calendar 21/28 | 5.5% |
| thursday gap n crap | Thursday Gap N Crap | 2% |
| 2_3 qqq dc | Tuesday 2/3 DC QQQ | 10% |
| vol crush special | Vol Crush Special v1.5 | 100% |
| btfd special | (no main-port equivalent) | TBD |
