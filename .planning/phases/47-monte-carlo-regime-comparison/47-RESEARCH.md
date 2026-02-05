# Phase 47: Monte Carlo Regime Comparison - Research

**Researched:** 2026-02-05
**Domain:** Dual Monte Carlo simulation for regime divergence detection in options trading
**Confidence:** HIGH

## Summary

Phase 47 builds a Monte Carlo regime comparison engine that runs two simulations -- one sampling from the full trade history and one sampling from only the recent window -- then compares their statistical profiles and classifies the divergence severity. The existing codebase already has everything needed: `runMonteCarloSimulation()` in `packages/lib/calculations/monte-carlo.ts` supports percentage-based resampling (MCRG-01), the `resampleWindow` parameter already implements the "sample from recent N trades" concept (MCRG-02), and `SimulationStatistics` returns all four comparison metrics (P(Profit), expected return, Sharpe, median max drawdown) specified in MCRG-03. The only new logic is: (1) a wrapper that runs the simulation twice with different pools, (2) a comparison function that computes deltas, and (3) a classification function that maps metric divergences to severity levels (MCRG-04).

The recent window concept is already established in Phase 46's rolling metrics engine (`calculateDefaultRecentWindow` = `max(20% of trades, 200)`). Phase 47 should reuse this same default formula for consistency across the edge decay analysis pipeline. The existing MCP tool `run_monte_carlo` already exposes `resampleWindow` as a parameter, so the regime comparison tool can call the underlying engine directly rather than the MCP wrapper.

**Primary recommendation:** Create a thin calculation engine (`packages/lib/calculations/mc-regime-comparison.ts`) that calls `runMonteCarloSimulation` twice, computes comparison metrics, and classifies divergence. Register a single MCP tool (`analyze_regime_comparison`) in the existing `edge-decay.ts` file alongside the Phase 46 tools. No new dependencies needed.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mathjs | ^15.1.0 | Statistical calculations if needed | Already used throughout; ensures numpy parity |
| zod | ^4.0.0 | MCP tool input schema validation | Already used by all MCP tools |
| @modelcontextprotocol/sdk | ^1.11.0 | MCP server tool registration | Foundation of MCP server |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| monte-carlo.ts (internal) | n/a | `runMonteCarloSimulation`, `MonteCarloParams`, `SimulationStatistics` | Core simulation engine |
| rolling-metrics.ts (internal) | n/a | `calculateDefaultRecentWindow` formula | Consistent recent window default |
| output-formatter.ts (internal) | n/a | `createToolOutput`, `formatPercent`, `formatRatio` | MCP tool output formatting |
| sync-middleware.ts (internal) | n/a | `withSyncedBlock` wrapper | Auto-sync before tool execution |

### No New Dependencies Needed
| Considered | Reason Not Needed |
|-----------|-------------------|
| Any statistics library | `runMonteCarloSimulation` already computes all needed metrics (P(Profit), Sharpe, drawdown, returns) |
| Any classification library | Regime classification is a simple threshold-based function (~30 lines) |
| jstat / simple-statistics | mathjs already available; Monte Carlo engine handles all statistical heavy lifting |

## Architecture Patterns

### Recommended Project Structure

```
packages/lib/calculations/
  mc-regime-comparison.ts    # NEW: Dual MC comparison engine + classification
  monte-carlo.ts             # EXISTING: Core simulation (reuse as-is)
  rolling-metrics.ts         # EXISTING: calculateDefaultRecentWindow (import for defaults)
  index.ts                   # EXISTING: Add new exports

packages/mcp-server/src/tools/
  edge-decay.ts              # EXISTING: Add analyze_regime_comparison tool here

tests/unit/
  mc-regime-comparison.test.ts  # NEW: Tests for comparison + classification logic
```

### Pattern 1: Thin Wrapper Over Existing Engine

**What:** The new calculation engine calls `runMonteCarloSimulation` twice (full pool, recent pool) and compares results
**When to use:** This entire phase
**Why:** The existing Monte Carlo engine already handles all simulation complexity (percentage resampling, worst-case injection, seeded RNG). The new code only needs to orchestrate two runs and compare their outputs.

```typescript
// Source: Derived from packages/lib/calculations/monte-carlo.ts
import { runMonteCarloSimulation, MonteCarloParams, MonteCarloResult, SimulationStatistics } from './monte-carlo'
import type { Trade } from '../models/trade'

export interface MCRegimeComparisonResult {
  fullHistory: {
    statistics: SimulationStatistics
    parameters: MonteCarloParams
    actualResamplePoolSize: number
  }
  recentWindow: {
    statistics: SimulationStatistics
    parameters: MonteCarloParams
    actualResamplePoolSize: number
    tradeCount: number  // How many trades were in the recent window
  }
  comparison: MCRegimeComparison
  classification: RegimeDivergenceClassification
}

export function compareMCRegimes(
  trades: Trade[],
  options: MCRegimeComparisonOptions
): MCRegimeComparisonResult {
  // Run full history simulation
  const fullResult = runMonteCarloSimulation(trades, fullParams)

  // Run recent window simulation
  const recentTrades = trades.slice(-recentWindowSize)
  const recentResult = runMonteCarloSimulation(recentTrades, recentParams)

  // Compare and classify
  const comparison = buildComparison(fullResult.statistics, recentResult.statistics)
  const classification = classifyDivergence(comparison)

  return { fullHistory: ..., recentWindow: ..., comparison, classification }
}
```

### Pattern 2: Reuse Recent Window Default from Phase 46

**What:** Import the same default formula for recent window sizing as rolling metrics uses
**When to use:** When user doesn't specify a custom recent window size
**Why:** Consistency across the edge decay pipeline -- all tools use the same "recent" definition

```typescript
// The formula from rolling-metrics.ts:
// max(20% of trades, 200), capped at total trades
// For MC regime comparison, we need at least 10 trades in the recent window
// (Monte Carlo engine requires minimum 10 trades)
function calculateDefaultRecentWindow(tradeCount: number): number {
  const twentyPercent = Math.round(tradeCount * 0.2)
  const defaultN = Math.max(twentyPercent, 200)
  return Math.min(defaultN, tradeCount)
}
```

**IMPORTANT:** This function is currently private in `rolling-metrics.ts`. For Phase 47, either:
- (a) Export it from rolling-metrics.ts and import it (cleanest), or
- (b) Duplicate the formula in mc-regime-comparison.ts with a comment referencing rolling-metrics.ts

Recommendation: (a) -- export from rolling-metrics.ts

### Pattern 3: Classification as Pure Threshold Function

**What:** Regime divergence classification is a simple threshold-based categorization of metric deltas
**When to use:** MCRG-04 -- classifying the severity of divergence between full and recent simulations
**Why:** Follows the codebase pattern from `assessResults()` in walk-forward-verdict.ts, which uses threshold ranges to classify walk-forward quality

```typescript
// Source: Pattern from packages/lib/calculations/walk-forward-verdict.ts
export type DivergenceSeverity = 'aligned' | 'mild_divergence' | 'significant_divergence' | 'regime_break'

export interface RegimeDivergenceClassification {
  severity: DivergenceSeverity
  /** Individual metric assessments that fed into classification */
  signals: Array<{
    metric: string
    fullValue: number
    recentValue: number
    delta: number
    /** Normalized divergence (0 = aligned, 1+ = severe) */
    divergenceScore: number
  }>
  /** Aggregate divergence score across all metrics */
  overallDivergenceScore: number
}
```

### Pattern 4: MCP Tool in edge-decay.ts with withSyncedBlock

**What:** Register the new tool in the existing `edge-decay.ts` file alongside `analyze_period_metrics` and `analyze_rolling_metrics`
**When to use:** Tool registration
**Why:** All edge decay tools belong together. Phase 46 established this file as the home for edge decay MCP tools.

```typescript
// Source: packages/mcp-server/src/tools/edge-decay.ts
server.registerTool(
  "analyze_regime_comparison",
  {
    description: "Compare Monte Carlo forward projections between full trade history and recent window to detect regime divergence",
    inputSchema: z.object({
      blockId: z.string().describe("Block folder name"),
      strategy: z.string().optional().describe("Filter by strategy name (case-insensitive)"),
      recentWindowSize: z.number().min(10).optional()
        .describe("Number of recent trades to use for recent window (default: auto-calculated)"),
      numSimulations: z.number().min(100).max(10000).default(1000)
        .describe("Number of simulation paths per run (default: 1000)"),
      simulationLength: z.number().min(10).optional()
        .describe("Trades to project forward (default: recent window size)"),
      initialCapital: z.number().positive().optional()
        .describe("Starting capital (default: inferred from trades)"),
      randomSeed: z.number().optional()
        .describe("Random seed for reproducibility"),
    }),
  },
  withSyncedBlock(baseDir, async ({ blockId, ... }) => {
    // ...
  })
);
```

### Anti-Patterns to Avoid

- **Do NOT run the full `run_monte_carlo` MCP tool handler:** Call `runMonteCarloSimulation()` from lib directly. The MCP tool handler adds blockId loading and output formatting that the comparison engine handles itself.
- **Do NOT return full simulation paths (equityCurve arrays) in MCP output:** Each simulation produces an equity curve of `simulationLength` points. With 1000 simulations x 200 points = 200,000 numbers. Return only `statistics` and `percentiles` summaries.
- **Do NOT include worst-case injection by default:** The comparison should isolate the signal from the trade distributions, not from synthetic worst-case events. Worst-case can be an optional parameter.
- **Do NOT reimplement the "percentage" resample method:** The existing `runMonteCarloSimulation` with `resampleMethod: "percentage"` already handles this correctly. Just pass the parameter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monte Carlo simulation engine | Custom bootstrap resampling | `runMonteCarloSimulation(trades, params)` from monte-carlo.ts | 1200 lines of battle-tested simulation with 11 test files |
| Percentage-based resampling | Custom capital tracking | `resampleMethod: "percentage"` parameter on MonteCarloParams | Already handles compounding, capital inference, filtered strategies |
| Recent window calculation | Custom trade slicing | `calculateDefaultRecentWindow()` from rolling-metrics.ts | Same default used by rolling metrics for consistency |
| Sharpe ratio calculation | Custom annualization | Part of `SimulationStatistics.meanSharpeRatio` | Already annualized using tradesPerYear |
| Probability of profit | Custom counting | Part of `SimulationStatistics.probabilityOfProfit` | Already computed as ratio of profitable simulations |
| Percentile calculations | Custom sorting | Part of `SimulationStatistics.valueAtRisk` | Already computed at p5, p10, p25 |
| Initial capital inference | Custom logic | MonteCarloParams.initialCapital with fallback | Engine already infers from first trade's fundsAtClose |

**Key insight:** The entire Monte Carlo calculation for each regime is already a single function call. Phase 47's new logic is primarily: (1) splitting trades into full and recent pools, (2) running the existing simulation on each, (3) computing deltas, and (4) applying thresholds for classification. This is a ~200-line calculation module, not a major engine.

## Common Pitfalls

### Pitfall 1: Insufficient Trades in Recent Window for Monte Carlo
**What goes wrong:** Monte Carlo requires at least 10 trades/samples. If the recent window is small (e.g., strategy filter narrows to 15 trades and recent window is 200), the recent pool may be too small.
**Why it happens:** Auto-calculated recent window size is `max(20%, 200)` which can exceed the actual number of strategy-filtered trades.
**How to avoid:** After filtering, check if recent window exceeds filtered trade count. If so, fall back to `Math.min(recentWindowSize, filteredTrades.length)`. If remaining recent trades < 10, return an error with a descriptive message rather than crashing.
**Warning signs:** `MonteCarloParams.resampleWindow` being larger than the actual trade array

### Pitfall 2: Different Simulation Lengths Invalidating Comparison
**What goes wrong:** Running full-history MC with simulationLength=500 and recent-window MC with simulationLength=200 makes P(Profit) and drawdown incomparable -- longer paths have more opportunity for both profit and drawdown.
**Why it happens:** The default simulationLength in existing MC tool equals `trades.length`, which differs between full and recent pools.
**How to avoid:** Use the SAME simulationLength for both simulations. Default should be `recentWindowSize` (the smaller pool) to ensure fair comparison. Both simulations project the same number of trades forward.
**Warning signs:** Very different P(Profit) values driven by path length rather than distribution quality

### Pitfall 3: Capital Inference Difference Between Full and Recent
**What goes wrong:** Full-history simulation infers initial capital from the first-ever trade, while recent-window simulation infers from a much later trade, leading to very different capital bases.
**Why it happens:** `initialCapital` default is `firstTrade.fundsAtClose - firstTrade.pl`. A portfolio that started at $100k is now at $500k, giving very different percentage contexts.
**How to avoid:** Explicitly pass the SAME `initialCapital` to both simulations. Use the full-history inferred capital for both. For percentage mode, this is critical because percentage returns are scale-invariant, so both should use the same capital base for apples-to-apples comparison.
**Warning signs:** Mean return percentages being wildly different between full and recent despite similar trade quality

### Pitfall 4: tradesPerYear Mismatch Between Full and Recent
**What goes wrong:** `tradesPerYear` is calculated from historical trade density. If the strategy traded 200/year historically but 300/year recently, annualized metrics will be different even with identical trade quality.
**Why it happens:** The MC engine calculates `tradesPerYear = (trades.length / daySpan) * 365` from the specific trade set.
**How to avoid:** Calculate `tradesPerYear` from the FULL history and pass it to both simulations. This ensures consistent annualization.
**Warning signs:** Sharpe ratios differing by sqrt(frequency_ratio) factor between full and recent

### Pitfall 5: Classification Thresholds That Don't Scale
**What goes wrong:** Hard-coded threshold like "if P(Profit) delta > 10%, it's a regime break" fails because a strategy with P(Profit) = 90% vs 80% is very different from 55% vs 45%.
**Why it happens:** Absolute deltas don't capture the context of the baseline metric value.
**How to avoid:** Use a multi-signal approach: combine normalized divergences across multiple metrics. A single metric crossing doesn't mean regime break. Consider: (1) absolute delta, (2) percentage change relative to full-history baseline, (3) whether critical thresholds are crossed (e.g., P(Profit) < 50%). Assign divergence scores per metric, then aggregate.
**Warning signs:** Classifying normal variance as "regime break" for high-frequency strategies, or missing real breaks in low-frequency strategies

### Pitfall 6: Stochastic Noise in Monte Carlo Output
**What goes wrong:** Running MC with 1000 simulations produces noisy statistics. Two identical runs with different seeds give different P(Profit), masking real divergence.
**Why it happens:** MC inherent randomness at finite simulation counts.
**How to avoid:** (1) Use a deterministic `randomSeed` for reproducibility. (2) Use 1000+ simulations (the default) to reduce noise. (3) Focus on metrics that are stable across runs (median is more stable than mean, P(Profit) is stable at 1000+ sims). (4) Consider the magnitude of differences -- a 2% P(Profit) difference at 1000 sims is noise; a 15% difference is signal.
**Warning signs:** Classification flipping between "aligned" and "mild divergence" on repeated runs with no data changes

### Pitfall 7: Including Synthetic Worst-Case Trades in Regime Comparison
**What goes wrong:** Worst-case injection adds synthetic max-loss trades to the resample pool. If enabled, these synthetic trades dominate the comparison signal because they're identical in both pools.
**Why it happens:** The existing MC engine supports worst-case injection via `worstCaseEnabled`.
**How to avoid:** Default `worstCaseEnabled: false` for regime comparison. The point of this analysis is to compare the actual trade distribution between full and recent windows, not to stress-test. Worst-case can be offered as an optional parameter for users who want it.
**Warning signs:** Both simulations showing nearly identical statistics because worst-case trades dominate the pool

## Code Examples

### Core Comparison Engine

```typescript
// Source: Derived from existing monte-carlo.ts patterns
import { runMonteCarloSimulation } from './monte-carlo'
import type { MonteCarloParams, MonteCarloResult, SimulationStatistics } from './monte-carlo'
import type { Trade } from '../models/trade'

export interface MCRegimeComparisonOptions {
  /** Number of recent trades for the recent window (default: auto-calculated) */
  recentWindowSize?: number
  /** Number of simulation paths (default: 1000) */
  numSimulations?: number
  /** Trades to project forward (default: recentWindowSize) */
  simulationLength?: number
  /** Starting capital (default: inferred) */
  initialCapital?: number
  /** Random seed for reproducibility */
  randomSeed?: number
  /** Trades per year for annualization (default: calculated from full history) */
  tradesPerYear?: number
}

export function compareMCRegimes(
  trades: Trade[],
  options?: MCRegimeComparisonOptions
): MCRegimeComparisonResult {
  // Sort trades chronologically
  const sorted = [...trades].sort(
    (a, b) => new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
  )

  // Calculate recent window size
  const recentWindowSize = options?.recentWindowSize
    ?? calculateDefaultRecentWindow(sorted.length)

  // Split into full and recent pools
  const recentTrades = sorted.slice(-recentWindowSize)

  // Calculate shared parameters for fair comparison
  const simulationLength = options?.simulationLength ?? recentWindowSize
  const initialCapital = options?.initialCapital ?? inferInitialCapital(sorted)
  const tradesPerYear = options?.tradesPerYear ?? calculateTradesPerYear(sorted)

  // Build common params
  const baseParams: Partial<MonteCarloParams> = {
    numSimulations: options?.numSimulations ?? 1000,
    simulationLength,
    resampleMethod: 'percentage',
    initialCapital,
    tradesPerYear,
    randomSeed: options?.randomSeed,
    worstCaseEnabled: false,
  }

  // Run full history MC
  const fullResult = runMonteCarloSimulation(sorted, {
    ...baseParams as MonteCarloParams,
  })

  // Run recent window MC
  const recentResult = runMonteCarloSimulation(recentTrades, {
    ...baseParams as MonteCarloParams,
  })

  // Compare statistics
  const comparison = buildComparison(fullResult.statistics, recentResult.statistics)
  const classification = classifyDivergence(comparison)

  return { fullHistory: ..., recentWindow: ..., comparison, classification }
}
```

### Metric Comparison

```typescript
export interface MCRegimeComparison {
  metrics: Array<{
    metric: string
    fullValue: number
    recentValue: number
    delta: number       // recent - full
    percentChange: number | null  // (recent - full) / |full| * 100
  }>
}

function buildComparison(
  full: SimulationStatistics,
  recent: SimulationStatistics
): MCRegimeComparison {
  const pairs: [string, number, number][] = [
    ['probabilityOfProfit', full.probabilityOfProfit, recent.probabilityOfProfit],
    ['expectedReturn', full.meanTotalReturn, recent.meanTotalReturn],
    ['sharpeRatio', full.meanSharpeRatio, recent.meanSharpeRatio],
    ['medianMaxDrawdown', full.medianMaxDrawdown, recent.medianMaxDrawdown],
  ]

  return {
    metrics: pairs.map(([metric, fullVal, recentVal]) => ({
      metric,
      fullValue: fullVal,
      recentValue: recentVal,
      delta: recentVal - fullVal,
      percentChange: fullVal !== 0
        ? ((recentVal - fullVal) / Math.abs(fullVal)) * 100
        : null,
    })),
  }
}
```

### Divergence Classification (MCRG-04)

```typescript
// Source: Pattern from walk-forward-verdict.ts assessResults()
export type DivergenceSeverity =
  | 'aligned'
  | 'mild_divergence'
  | 'significant_divergence'
  | 'regime_break'

export interface RegimeDivergenceClassification {
  severity: DivergenceSeverity
  overallScore: number  // 0 = perfectly aligned, 1+ = severe divergence
  signals: Array<{
    metric: string
    score: number         // Individual divergence score for this metric
    direction: 'improving' | 'deteriorating' | 'neutral'
  }>
}

/**
 * Classify divergence severity based on normalized metric deltas.
 *
 * Each metric contributes a divergence score:
 * - P(Profit): normalized by 0.10 (a 10pp drop = score of 1.0)
 * - Expected return: relative change / 50% (a 50% drop = score of 1.0)
 * - Sharpe: absolute delta / 0.50 (a 0.5 Sharpe drop = score of 1.0)
 * - Median MDD: relative change / 50% (a 50% increase = score of 1.0)
 *
 * Overall score = weighted average of individual scores.
 *
 * Classification thresholds:
 * - aligned: score < 0.30
 * - mild_divergence: 0.30 <= score < 0.60
 * - significant_divergence: 0.60 <= score < 1.00
 * - regime_break: score >= 1.00
 */
function classifyDivergence(comparison: MCRegimeComparison): RegimeDivergenceClassification {
  // ... compute per-metric scores
  // ... aggregate
  // ... classify
}
```

### Exporting calculateDefaultRecentWindow from rolling-metrics.ts

```typescript
// Current (packages/lib/calculations/rolling-metrics.ts):
function calculateDefaultRecentWindow(tradeCount: number): number {
  // ...
}

// Change to:
export function calculateDefaultRecentWindow(tradeCount: number): number {
  // ...
}

// Then in mc-regime-comparison.ts:
import { calculateDefaultRecentWindow } from './rolling-metrics'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single MC simulation | Dual MC (full vs recent) for regime detection | Phase 47 (this phase) | Detects when recent trading behavior diverges from historical |
| Manual `resampleWindow` parameter | Auto-calculated recent window with same formula as rolling metrics | Phase 47 | Consistent "recent" definition across all edge decay tools |
| No regime classification | Threshold-based severity classification | Phase 47 | Structured output for Phase 50 verdict synthesis |

**Note on Phase 46 factual output principle:** Phase 46 CONTEXT.md established "no interpretive labels" for period segmentation and rolling metrics. However, MCRG-04 explicitly requires classification labels ("aligned", "mild divergence", "significant divergence", "regime break"). The classification is mechanistic (threshold-based scores), not interpretive -- it's the same pattern as `assessResults()` in walk-forward-verdict.ts which uses similar categorical outputs. The classification is derived deterministically from numerical scores, so it IS factual data (a computed category), not an opinion. The raw scores should also be included so consumers can apply their own thresholds.

## Open Questions

1. **Should percentage resampling always be forced, or should resampleMethod be configurable?**
   - What we know: MCRG-01 says "percentage-based resampling." The existing MC engine supports 'trades', 'daily', and 'percentage' modes.
   - What's unclear: Whether some users might want to compare using trade-level P&L resampling instead.
   - Recommendation: Default to `percentage` per requirements but allow override. The percentage mode is more appropriate for edge decay because it normalizes for position size changes over time.

2. **What are the right divergence score normalization constants?**
   - What we know: We need to normalize different metric scales (P(Profit) is 0-1, Sharpe is unbounded, MDD is 0-1) into comparable scores.
   - What's unclear: The exact normalization constants (e.g., "10pp P(Profit) drop = score 1.0") are somewhat arbitrary.
   - Recommendation: Start with the proposed constants and validate against real portfolios using the CLI test mode. The constants can be tuned in Phase 50 when the full verdict synthesis combines all signals. Document the normalization approach clearly so it's adjustable.

3. **Should the tool expose worst-case injection as an option?**
   - What we know: Existing MC supports worst-case injection. For regime comparison, worst-case muddies the signal.
   - What's unclear: Whether there's a use case for "regime comparison under stress."
   - Recommendation: Default to `worstCaseEnabled: false` but expose it as an optional parameter for advanced users. Phase 50's unified tool will likely always use the default.

4. **How should historicalInitialCapital interact with regime comparison?**
   - What we know: `historicalInitialCapital` is needed when filtering strategies from multi-strategy portfolios where `fundsAtClose` reflects the combined portfolio.
   - What's unclear: Should the user explicitly provide this, or can we infer it?
   - Recommendation: Expose `initialCapital` as optional parameter (same as existing MC tool). When provided, use it for both simulations. When not provided, infer from full history's first trade. Document this clearly.

## Sources

### Primary (HIGH confidence)
- `packages/lib/calculations/monte-carlo.ts` - Full MC engine source: MonteCarloParams, runMonteCarloSimulation, SimulationStatistics interfaces
- `packages/lib/calculations/rolling-metrics.ts` - calculateDefaultRecentWindow formula, recent window concept
- `packages/mcp-server/src/tools/analysis.ts` - Existing run_monte_carlo MCP tool registration pattern
- `packages/mcp-server/src/tools/edge-decay.ts` - Phase 46 edge decay tool registration pattern with withSyncedBlock
- `packages/lib/calculations/walk-forward-verdict.ts` - assessResults() threshold classification pattern
- `packages/lib/calculations/index.ts` - Barrel export pattern for new modules
- `tests/unit/monte-carlo.test.ts` and related test files (11 total) - Existing MC test patterns
- `tests/unit/rolling-metrics.test.ts` - Phase 46 test patterns with generateTrades helper

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` - MCRG-01 through MCRG-04 requirement definitions
- `.planning/ROADMAP.md` - Phase dependency graph, success criteria
- `.planning/phases/46-core-calculation-engines/46-CONTEXT.md` - "Factual output" principle and recent window concept
- `.planning/phases/46-core-calculation-engines/46-RESEARCH.md` - Phase 46 research patterns and architecture decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; all libraries already in use
- Architecture: HIGH - Direct composition of existing engines following established patterns
- Pitfalls: HIGH - Based on actual MC engine analysis and real edge cases discovered in codebase
- Classification thresholds: MEDIUM - Constants are reasonable estimates but need validation against real data

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (stable domain, no moving targets)

**Key files that will be modified/created:**
- `packages/lib/calculations/mc-regime-comparison.ts` (NEW) - Core comparison engine
- `packages/lib/calculations/rolling-metrics.ts` (MODIFIED) - Export calculateDefaultRecentWindow
- `packages/lib/calculations/index.ts` (MODIFIED) - Add barrel exports
- `packages/mcp-server/src/tools/edge-decay.ts` (MODIFIED) - Register MCP tool
- `packages/mcp-server/src/index.ts` (VERIFY) - edge-decay.ts already imported, no change needed
- `tests/unit/mc-regime-comparison.test.ts` (NEW) - Tests for comparison and classification

**Existing MonteCarloParams fields relevant to this phase:**
- `resampleMethod: "percentage"` - Required by MCRG-01
- `resampleWindow?: number` - Controls pool size (but we'll pass full/recent trades separately)
- `numSimulations: number` - Default 1000
- `simulationLength: number` - Must be same for both runs
- `initialCapital: number` - Must be same for both runs
- `tradesPerYear: number` - Must be same for both runs
- `randomSeed?: number` - For reproducibility
- `normalizeTo1Lot?: boolean` - Available but not default
- `worstCaseEnabled?: boolean` - Default FALSE for regime comparison

**SimulationStatistics fields used for comparison (MCRG-03):**
- `probabilityOfProfit: number` - P(Profit) as decimal 0-1
- `meanTotalReturn: number` - Expected return as decimal
- `meanSharpeRatio: number` - Annualized Sharpe
- `medianMaxDrawdown: number` - Median MDD as decimal 0-1
