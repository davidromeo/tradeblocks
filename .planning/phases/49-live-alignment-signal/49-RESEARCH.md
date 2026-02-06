# Phase 49: Live Alignment Signal - Research

**Researched:** 2026-02-06
**Domain:** Derived alignment metrics from backtest vs actual trade comparison for edge decay verdict synthesis
**Confidence:** HIGH

## Summary

Phase 49 builds a calculation engine that derives higher-level alignment signals from backtest vs actual trade comparisons. The existing `compare_backtest_to_actual` MCP tool already handles trade matching, scaling, slippage calculation, and outlier detection at the individual trade level. Phase 49 computes **aggregate derived metrics** specifically designed for Phase 50's verdict synthesis: direction agreement rate, per-strategy execution efficiency, and alignment trend analysis.

The architecture follows the exact pattern established in Phases 46-48: a pure function calculation engine in `packages/lib/calculations/` consumed by a new MCP tool in `packages/mcp-server/src/tools/edge-decay.ts`. The key difference from other edge decay tools is that this one requires **both** backtest trades (Trade[]) and actual trades (ReportingTrade[]) as inputs, plus it must gracefully handle the absence of a reporting log (LIVE-04).

The existing `slippage-helpers.ts` module provides battle-tested trade matching logic (`matchTrades`) and scaling functions (`calculateScaledPl`) that the calculation engine should import directly rather than reimplementing. The `loadReportingLog` function in `block-loader.ts` provides reporting log loading with fallback discovery. The `linearRegression` and `computeTrends` functions from `trend-detection.ts` handle trend detection on the alignment time series.

**Primary recommendation:** Create a `live-alignment.ts` calculation engine in `packages/lib/calculations/` that takes Trade[] and ReportingTrade[] as inputs, uses `matchTrades` from slippage-helpers for matching, computes direction agreement, per-strategy execution efficiency, and alignment trends. Register as the fifth edge decay tool (`analyze_live_alignment`) in `edge-decay.ts`. Return `{ available: false, reason: 'no reporting log' }` when reporting log is absent.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **No Reporting Log Handling:** When a block has no reporting log (no actual trades to compare):
  - Return explicit skip object: `{ available: false, reason: 'no reporting log' }`
  - Phase 50 can include this information in the verdict narrative
  - Do NOT fail or throw -- graceful degradation
- **Output Structure:** Data for LLM consumption, not hard recommendations. Raw metrics and derived signals without predetermined "good/bad" thresholds. Phase 50 (verdict synthesis) interprets the signals, not this module.

### Claude's Discretion
- **Derived Metrics:** Claude will select appropriate derived metrics based on what Phase 50 needs, what the existing `compare_backtest_to_actual` provides, and patterns from Phase 46-48.
- **Architecture:** Claude determines whether to reuse existing matching/scaling logic, create independent engine, or hybrid. Decision should be based on consistency with Phase 46-48 patterns, code reuse vs coupling tradeoffs, cleanest API for Phase 50.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mathjs | ^15.1.0 | Statistical calculations (mean, std) | Already used throughout portfolio-stats.ts |
| zod | ^4.0.0 | MCP tool input schema validation | Already used by all MCP tools |
| @modelcontextprotocol/sdk | ^1.11.0 | MCP server tool registration | Foundation of MCP server |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| slippage-helpers.ts (internal) | n/a | `matchTrades`, `calculateScaledPl`, `applyStrategyFilter`, `applyDateRangeFilter` | Trade matching and slippage calculation |
| trend-detection.ts (internal) | n/a | `linearRegression`, `computeTrends` | Alignment trend detection over time |
| block-loader.ts (internal) | n/a | `loadBlock`, `loadReportingLog` | Loading block trades and reporting log |
| output-formatter.ts (internal) | n/a | `createToolOutput`, `formatPercent` | MCP tool output formatting |
| sync-middleware.ts (internal) | n/a | `withSyncedBlock` wrapper | Auto-sync before tool execution |

### No New Dependencies Needed
| Considered | Reason Not Needed |
|-----------|-------------------|
| Any statistics library | mathjs + inline calculations sufficient for direction agreement and efficiency ratios |
| Any matching library | `matchTrades` in slippage-helpers.ts already handles trade matching with scaling |

## Architecture Patterns

### Recommended Project Structure

```
packages/lib/calculations/
  live-alignment.ts              # NEW: Core live alignment engine
  trend-detection.ts             # EXISTING: linearRegression, computeTrends (reuse)
  index.ts                       # EXISTING: Add new export

packages/mcp-server/src/tools/
  edge-decay.ts                  # MODIFY: Add 5th tool (analyze_live_alignment)
  reports/slippage-helpers.ts    # EXISTING: matchTrades, calculateScaledPl (import from)

tests/unit/
  live-alignment.test.ts         # NEW: Tests for alignment calculation engine
```

### Pattern 1: Calculation Engine as Pure Functions (Consistent with Phase 46-48)

**What:** The live alignment engine is a set of pure exported functions in `packages/lib/calculations/live-alignment.ts`, not a class.
**When to use:** All new calculations in this phase.
**Why:** Phases 46-48 all established this pattern: `segmentByPeriod`, `computeRollingMetrics`, `runRegimeComparison`, `analyzeWalkForwardDegradation` are all pure function exports.

```typescript
// Source: Pattern from packages/lib/calculations/walk-forward-degradation.ts
export interface LiveAlignmentResult {
  available: true
  directionAgreement: DirectionAgreementResult
  executionEfficiency: ExecutionEfficiencyResult
  alignmentTrend: AlignmentTrendResult
  dataQuality: AlignmentDataQuality
}

export interface LiveAlignmentSkipped {
  available: false
  reason: string
}

export type LiveAlignmentOutput = LiveAlignmentResult | LiveAlignmentSkipped

export function analyzeLiveAlignment(
  backtestTrades: Trade[],
  actualTrades: ReportingTrade[],
  options?: LiveAlignmentOptions
): LiveAlignmentResult {
  // Pure calculation, no I/O
}
```

### Pattern 2: Reuse matchTrades from slippage-helpers

**What:** Import and reuse the existing `matchTrades` function from slippage-helpers.ts rather than reimplementing trade matching logic.
**When to use:** Matching backtest trades to actual trades for alignment comparison.
**Why:** `matchTrades` already handles date+strategy+time matching at minute precision, contract scaling, and slippage calculation. It is well-tested and used by both `analyze_slippage_trends` and `analyze_discrepancies`.

**Architecture consideration:** `matchTrades` lives in `packages/mcp-server/src/tools/reports/slippage-helpers.ts`, which is in the MCP server package, not the lib package. The calculation engine should live in `packages/lib/calculations/`. Two approaches:

**Option A (Recommended): Duplicate matching logic in lib.** Move/copy the core matching functions to a lib module. This keeps the calculation engine self-contained in `packages/lib/` with no dependency on the MCP server package. The MCP tool handler then uses `loadReportingLog` + passes both trade arrays to the lib engine.

**Option B: Keep matching in MCP tool handler.** The MCP tool handler does the matching/scaling and passes pre-matched data to the lib engine. This creates a thinner lib layer but couples the data preparation to the tool handler.

**Recommendation: Option A -- the lib calculation engine should own matching.** The matching logic is core to the alignment calculation, not MCP-specific. The functions in slippage-helpers.ts are pure functions with no I/O and can be moved to lib. However, to minimize disruption to existing tools, the simplest approach is to **inline the matching logic** in the new calculation engine (it is approximately 40 lines of code) rather than moving slippage-helpers.ts. The existing slippage-helpers consumers remain unaffected.

### Pattern 3: Daily Aggregation for Direction Agreement

**What:** Direction agreement is calculated at the daily level: for each trading day where both backtest and actual trades exist, determine whether both agree on overall direction (net positive or net negative P&L for the day).
**When to use:** LIVE-01 (direction agreement rate)
**Why:** Daily aggregation aligns with how `compare_backtest_to_actual` works in summary mode (aggregation by date+strategy). Individual trade matching at minute precision may over-fragment the comparison.

```typescript
export interface DirectionAgreementResult {
  /** Overall % of days where backtest and actual agree on direction */
  overallRate: number
  /** Total trading days with both backtest and actual data */
  totalDays: number
  /** Days where both agree on win/loss direction */
  agreementDays: number
  /** Per-strategy direction agreement */
  byStrategy: Array<{
    strategy: string
    rate: number
    totalDays: number
    agreementDays: number
  }>
}
```

### Pattern 4: Per-Strategy Execution Efficiency

**What:** For each strategy, calculate actual total P&L as a percentage of backtest total P&L (using perContract scaling for fair comparison). This answers "how much of the theoretical edge is actually captured?"
**When to use:** LIVE-02 (per-contract gap) and LIVE-03 (underperformance identification)
**Why:** Phase 50 needs to know which strategies are leaking edge and by how much.

```typescript
export interface ExecutionEfficiencyResult {
  /** Overall efficiency across all strategies (actual total PL / backtest total PL) */
  overallEfficiency: number | null
  /** Total actual PL (perContract scaled) */
  totalActualPl: number
  /** Total backtest PL (perContract scaled) */
  totalBacktestPl: number
  /** Per-strategy breakdown */
  byStrategy: Array<{
    strategy: string
    /** Actual PL / Backtest PL ratio */
    efficiency: number | null
    /** Absolute per-contract gap */
    perContractGap: number
    /** Actual per-contract P&L */
    actualPerContract: number
    /** Backtest per-contract P&L */
    backtestPerContract: number
    /** Number of matched trades */
    matchedTrades: number
    /** Number of unmatched backtest trades (backtest had trades, actual didn't) */
    unmatchedBacktest: number
    /** Number of unmatched actual trades */
    unmatchedActual: number
    /** Whether actual significantly underperforms backtest */
    underperforming: boolean
    /** Standard deviation of per-trade slippage for this strategy */
    slippageStdDev: number | null
  }>
}
```

### Pattern 5: Alignment Trend Over Time

**What:** Group matched trades by month, compute monthly direction agreement rate and monthly efficiency ratio, then run linear regression on these time series to detect whether alignment quality is improving or degrading.
**When to use:** Trend analysis for Phase 50 verdict synthesis
**Why:** A static snapshot of alignment may miss that execution quality is actively deteriorating (or improving after a broker change).

```typescript
export interface AlignmentTrendResult {
  /** Monthly time series of alignment metrics */
  monthlySeries: Array<{
    month: string  // YYYY-MM
    directionAgreementRate: number | null
    efficiency: number | null
    matchedTrades: number
    totalBacktestPl: number
    totalActualPl: number
  }>
  /** Trend regression on direction agreement rate */
  directionTrend: TrendResult | null
  /** Trend regression on efficiency ratio */
  efficiencyTrend: TrendResult | null
  /** Whether enough monthly data points for meaningful trends */
  sufficientForTrends: boolean
}
```

### Pattern 6: MCP Tool in edge-decay.ts with Reporting Log Loading

**What:** Register `analyze_live_alignment` as the fifth edge decay tool, but unlike tools 1-4, this one must also load the reporting log via `loadReportingLog`.
**When to use:** MCP tool registration.
**Why:** The other edge decay tools only need backtest trades (from `loadBlock`). Live alignment also needs actual trades from the reporting log.

```typescript
// Key difference from other edge decay tools: needs reporting log
server.registerTool(
  "analyze_live_alignment",
  {
    description: "...",
    inputSchema: z.object({
      blockId: z.string().describe("Block folder name"),
      strategy: z.string().optional()
        .describe("Filter by strategy name (case-insensitive)"),
      scaling: z.enum(["raw", "perContract", "toReported"]).optional()
        .describe("Scaling mode for P/L comparison (default: perContract)"),
    }),
  },
  withSyncedBlock(baseDir, async ({ blockId, strategy }) => {
    try {
      const block = await loadBlock(baseDir, blockId);

      // Load reporting log -- gracefully skip if missing (LIVE-04)
      let actualTrades: ReportingTrade[];
      try {
        actualTrades = await loadReportingLog(baseDir, blockId);
      } catch {
        // No reporting log -- return skip object per CONTEXT.md decision
        const skipResult: LiveAlignmentSkipped = {
          available: false,
          reason: "no reporting log"
        };
        return createToolOutput(
          `Live alignment for ${blockId}: skipped (no reporting log)`,
          { blockId, strategy: strategy ?? null, ...skipResult }
        );
      }

      // Apply strategy filter to both sets
      let backtestTrades = filterByStrategy(block.trades, strategy);
      actualTrades = filterByStrategy(actualTrades, strategy);

      // Call pure calculation engine
      const result = analyzeLiveAlignment(backtestTrades, actualTrades, {
        scaling: scaling ?? "perContract",
      });

      return createToolOutput(summary, structuredData);
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ...` }], isError: true };
    }
  })
);
```

### Anti-Patterns to Avoid

- **Do NOT duplicate trade matching logic unnecessarily:** If inlining matching in the lib engine, keep it minimal. The core logic is ~40 lines (date+strategy+time key matching with contract scaling).
- **Do NOT include interpretive labels or thresholds:** Per CONTEXT.md, output raw metrics. Do NOT label strategies as "healthy" or "concerning." Phase 50 interprets.
- **Do NOT fail on missing reporting log:** Per CONTEXT.md locked decision, return `{ available: false, reason: 'no reporting log' }` instead of throwing.
- **Do NOT use `toISOString()` for date keys:** Per CLAUDE.md, use `date.getFullYear()` and `date.getMonth()` (local time methods) to avoid UTC conversion issues.
- **Do NOT import from MCP server package into lib:** The calculation engine in `packages/lib/` should not depend on `packages/mcp-server/`. Inline the matching logic if needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Linear regression on alignment trends | Custom OLS implementation | `linearRegression()` from `trend-detection.ts` | Already used by all other edge decay engines |
| Multi-metric trend computation | Custom loop | `computeTrends()` from `trend-detection.ts` | Batch regression computation |
| Date key formatting | Custom date formatter | Pattern: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` | Established pattern preserving Eastern Time |
| Month key extraction | `toISOString().substring(0,7)` | `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` | Avoids UTC conversion |
| MCP tool output | Custom formatter | `createToolOutput(summary, structuredData)` | Established pattern across all tools |
| Strategy filtering | Custom filter | Reuse `filterByStrategy` from edge-decay.ts (MCP layer) | Already handles case-insensitive matching |

**Key insight:** The heavy lifting (trade matching, scaling, trend detection) is already implemented. This engine's unique contribution is (1) direction agreement computation, (2) per-strategy efficiency aggregation, and (3) monthly trend decomposition. The core new logic is approximately 150-200 lines.

## Common Pitfalls

### Pitfall 1: Unmatched Trades Distorting Efficiency
**What goes wrong:** If backtest has 500 trades and only 300 match to actual, computing efficiency as `sum(actual PL) / sum(backtest PL)` using only matched trades ignores the 200 unmatched backtest trades (theoretical edge that was never executed).
**Why it happens:** Natural mismatch between backtest coverage and actual execution.
**How to avoid:** Report both: (a) matched-only efficiency (apples-to-apples for matched trades), and (b) coverage rate (what % of backtest trades had actual counterparts). Phase 50 can weight these appropriately in the verdict.
**Warning signs:** Matched-only efficiency is 95% but coverage is only 40% -- looks great but most of the backtest isn't being executed.

### Pitfall 2: Direction Agreement Sensitive to Near-Zero P&L Days
**What goes wrong:** A day where backtest P&L is +$2 and actual P&L is -$3 counts as "disagreement" even though both are essentially flat.
**Why it happens:** Sign-based direction comparison treats any positive as "win" and any negative as "loss."
**How to avoid:** Consider a small threshold for "flat" days (e.g., |PL| < $5 or configurable). Mark days where either side is near-zero as "inconclusive" rather than forcing agreement/disagreement. This is a Claude's Discretion item -- research recommendation is to include a `neutralThreshold` parameter with default 0 (strict sign comparison) so the tool is simple by default but can be adjusted.
**Warning signs:** Direction agreement drops sharply when many days have small P&L values on one side.

### Pitfall 3: Per-Contract Scaling When Contract Counts Differ Wildly
**What goes wrong:** Backtest trades 10 contracts per trade, actual trades 1 contract. Per-contract P&L comparison is the right approach, but if the strategy has different fill behavior at different sizes, per-contract may still not be directly comparable.
**Why it happens:** Position sizing differences between backtest and live execution.
**How to avoid:** Use `perContract` scaling as the default (normalizes to per-lot comparison). Report the contract ratio so Phase 50 can note the scaling context. The `toReported` scaling mode scales backtest DOWN to match actual contract counts, which is another valid approach.
**Warning signs:** Strategies with high contract count ratios (>5:1) may have different market impact characteristics.

### Pitfall 4: Strategy Name Mismatches Between Backtest and Reporting Log
**What goes wrong:** Backtest has strategy "Iron Condor" but reporting log has "IC" or "iron condor" (different casing/abbreviation), causing zero matches.
**Why it happens:** Different export systems may use different strategy naming conventions.
**How to avoid:** The existing `matchTrades` function matches by exact strategy name (case-sensitive within the key). The MCP tool applies case-insensitive strategy filtering via `filterByStrategy` before passing to the engine. For the per-strategy breakdown, use the strategy names as they appear in the data. If there are zero matches for a strategy, include it in the output with `matchedTrades: 0` so Phase 50 can flag the mismatch.
**Warning signs:** High unmatched trade count for specific strategies, or strategies appearing in one set but not the other.

### Pitfall 5: Monthly Trend With Insufficient Data Points
**What goes wrong:** A block with 3 months of reporting log data yields only 3 monthly data points for trend regression, which is statistically meaningless.
**Why it happens:** Reporting logs are often started well after the backtest begins.
**How to avoid:** Set `sufficientForTrends = monthlyPoints >= 4` (matching the threshold used in period-segmentation and walk-forward-degradation). Return null for trend results when insufficient. Include the month count in dataQuality.
**Warning signs:** Linear regression returning extreme slopes or low p-values from 2-3 data points.

### Pitfall 6: Reporting Log Date Range Not Covering Full Backtest Period
**What goes wrong:** Backtest spans 2022-2025 but reporting log only covers 2024-2025. Overall efficiency appears poor because 2 years of unmatched backtest trades are included.
**Why it happens:** Reporting log typically starts later than backtest.
**How to avoid:** Report the overlap date range (the period where both backtest and reporting log have data). Compute efficiency metrics only within the overlap period. Include `overlapDateRange` and `backtestDateRange` and `actualDateRange` in the output so Phase 50 can contextualize.
**Warning signs:** Very high unmatched backtest count with all unmatched trades concentrated in early dates.

## Code Examples

### Core Engine Interface

```typescript
// Source: Derived from Phase 46-48 patterns
import type { Trade } from '../models/trade'
import type { ReportingTrade } from '../models/reporting-trade'
import type { TrendResult } from './trend-detection'

export interface LiveAlignmentOptions {
  /** Scaling mode for P/L comparison (default: 'perContract') */
  scaling?: 'raw' | 'perContract' | 'toReported'
}

export interface LiveAlignmentResult {
  available: true
  /** Date range where both backtest and actual data overlap */
  overlapDateRange: { start: string; end: string } | null
  /** Direction agreement metrics */
  directionAgreement: DirectionAgreementResult
  /** Per-strategy execution efficiency */
  executionEfficiency: ExecutionEfficiencyResult
  /** Alignment trend over time */
  alignmentTrend: AlignmentTrendResult
  /** Data quality indicators */
  dataQuality: AlignmentDataQuality
}

export interface LiveAlignmentSkipped {
  available: false
  reason: string
}

export type LiveAlignmentOutput = LiveAlignmentResult | LiveAlignmentSkipped
```

### Direction Agreement Calculation

```typescript
// Source: New, but uses established date key pattern from period-segmentation.ts
function computeDirectionAgreement(
  backtestTrades: Trade[],
  actualTrades: ReportingTrade[],
): DirectionAgreementResult {
  // Group by date+strategy and sum P&L
  const backtestByDay = groupByDateStrategy(backtestTrades)
  const actualByDay = groupByDateStrategy(actualTrades)

  let totalDays = 0
  let agreementDays = 0
  const byStrategy = new Map<string, { total: number; agreed: number }>()

  for (const [key, btPl] of backtestByDay) {
    const actPl = actualByDay.get(key)
    if (actPl === undefined) continue  // No actual data for this day+strategy

    totalDays++
    const btDirection = btPl >= 0  // true = win
    const actDirection = actPl >= 0
    const agreed = btDirection === actDirection

    if (agreed) agreementDays++

    // Track per-strategy
    const strategy = key.split('|')[1]
    const existing = byStrategy.get(strategy) ?? { total: 0, agreed: 0 }
    existing.total++
    if (agreed) existing.agreed++
    byStrategy.set(strategy, existing)
  }

  return {
    overallRate: totalDays > 0 ? agreementDays / totalDays : 0,
    totalDays,
    agreementDays,
    byStrategy: Array.from(byStrategy.entries()).map(([strategy, data]) => ({
      strategy,
      rate: data.total > 0 ? data.agreed / data.total : 0,
      totalDays: data.total,
      agreementDays: data.agreed,
    })),
  }
}
```

### Per-Strategy Execution Efficiency

```typescript
// Source: Uses calculateScaledPl pattern from slippage-helpers.ts
function computeExecutionEfficiency(
  backtestTrades: Trade[],
  actualTrades: ReportingTrade[],
  scaling: 'raw' | 'perContract' | 'toReported',
): ExecutionEfficiencyResult {
  // Match trades (inline matching logic)
  const matched = matchTradesForAlignment(backtestTrades, actualTrades, scaling)

  // Group matched pairs by strategy
  const byStrategy = new Map<string, MatchedStrategyData>()

  for (const pair of matched.pairs) {
    const data = byStrategy.get(pair.strategy) ?? createEmptyStrategyData()
    data.scaledBacktestPl += pair.scaledBacktestPl
    data.scaledActualPl += pair.scaledActualPl
    data.matchedCount++
    data.slippages.push(pair.slippage)
    byStrategy.set(pair.strategy, data)
  }

  // Compute efficiency per strategy
  const strategies = Array.from(byStrategy.entries()).map(([strategy, data]) => {
    const efficiency = data.scaledBacktestPl !== 0
      ? data.scaledActualPl / data.scaledBacktestPl
      : null

    return {
      strategy,
      efficiency,
      perContractGap: data.matchedCount > 0
        ? (data.scaledActualPl - data.scaledBacktestPl) / data.matchedCount
        : 0,
      actualPerContract: data.matchedCount > 0 ? data.scaledActualPl / data.matchedCount : 0,
      backtestPerContract: data.matchedCount > 0 ? data.scaledBacktestPl / data.matchedCount : 0,
      matchedTrades: data.matchedCount,
      unmatchedBacktest: matched.unmatchedByStrategy.get(strategy)?.backtest ?? 0,
      unmatchedActual: matched.unmatchedByStrategy.get(strategy)?.actual ?? 0,
      underperforming: efficiency !== null && efficiency < 1.0,
      slippageStdDev: computeStdDev(data.slippages),
    }
  })

  return {
    overallEfficiency: /* computed from totals */,
    totalActualPl: /* sum */,
    totalBacktestPl: /* sum */,
    byStrategy: strategies,
  }
}
```

### Monthly Alignment Trend

```typescript
// Source: Uses computeTrends from trend-detection.ts
import { computeTrends } from './trend-detection'

function computeAlignmentTrend(
  matched: MatchedPairData[],
  backtestTrades: Trade[],
  actualTrades: ReportingTrade[],
): AlignmentTrendResult {
  // Group matched pairs by month
  const monthlyData = groupByMonth(matched)

  // Build monthly series
  const months = Array.from(monthlyData.keys()).sort()
  const monthlySeries = months.map(month => {
    const data = monthlyData.get(month)!
    return {
      month,
      directionAgreementRate: data.totalDays > 0
        ? data.agreementDays / data.totalDays : null,
      efficiency: data.backtestPl !== 0
        ? data.actualPl / data.backtestPl : null,
      matchedTrades: data.matchedCount,
      totalBacktestPl: data.backtestPl,
      totalActualPl: data.actualPl,
    }
  })

  // Run trend detection on non-null series
  const directionValues = monthlySeries
    .filter(m => m.directionAgreementRate !== null)
    .map(m => m.directionAgreementRate!)
  const efficiencyValues = monthlySeries
    .filter(m => m.efficiency !== null && Number.isFinite(m.efficiency))
    .map(m => m.efficiency!)

  const trends = computeTrends({
    directionAgreement: directionValues,
    efficiency: efficiencyValues,
  })

  return {
    monthlySeries,
    directionTrend: trends.directionAgreement ?? null,
    efficiencyTrend: trends.efficiency ?? null,
    sufficientForTrends: directionValues.length >= 4,
  }
}
```

### Data Quality Assessment

```typescript
// Source: Pattern from walk-forward-degradation.ts
export interface AlignmentDataQuality {
  backtestTradeCount: number
  actualTradeCount: number
  matchedTradeCount: number
  matchRate: number  // matched / min(backtest, actual)
  overlapMonths: number
  backtestDateRange: { start: string; end: string }
  actualDateRange: { start: string; end: string }
  overlapDateRange: { start: string; end: string } | null
  sufficientForTrends: boolean
  warnings: string[]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual backtest vs actual comparison | Automated `compare_backtest_to_actual` tool | Phase 36 (v2.5) | Comprehensive trade-level comparison |
| Slippage as only alignment metric | Direction agreement + efficiency + trends | Phase 49 (this phase) | Multi-dimensional alignment signal for verdict synthesis |
| Fail when no reporting log | Graceful skip with explicit reason | Phase 49 | Phase 50 can handle missing signals |

**Relevant existing tools that overlap (but don't replace this phase):**
- `compare_backtest_to_actual` -- raw trade-level comparison. This phase derives aggregate metrics from that comparison data.
- `analyze_slippage_trends` -- slippage trends over time with statistical testing. This phase adds direction agreement and efficiency metrics.
- `analyze_discrepancies` -- pattern analysis (directional bias, time-of-day patterns). This phase focuses on per-strategy efficiency for verdict synthesis.

The live alignment signal adds a layer that the existing tools don't provide: a single, structured output format designed specifically for Phase 50's verdict synthesis, with the same shape and conventions as the other edge decay signal outputs.

## Open Questions

1. **Should matching use summary mode or trade-level mode?**
   - What we know: The existing `compare_backtest_to_actual` supports both `summary` mode (aggregate by date+strategy) and `trades` mode (individual trade matching by date+strategy+time). Summary mode is simpler and sufficient for daily P&L direction agreement. Trade-level mode is more precise for per-trade slippage statistics.
   - What's unclear: Whether daily aggregation loses meaningful signal.
   - Recommendation: Use trade-level matching (date+strategy+time at minute precision) for per-trade slippage/efficiency, but aggregate to daily level for direction agreement. This gives the best of both worlds. The matching logic is already proven in slippage-helpers.ts.

2. **Should the lib engine import from MCP server package or inline the matching?**
   - What we know: `matchTrades` lives in `packages/mcp-server/src/tools/reports/slippage-helpers.ts`. The lib package should not depend on the MCP server package.
   - What's unclear: Whether to move `matchTrades` to lib (affects existing consumers) or inline it.
   - Recommendation: Inline a simplified version in the lib engine. The core matching is ~40 lines (build key map, iterate, match by key, compute scaled P&L). This avoids cross-package dependencies and keeps the engine self-contained. The MCP server's slippage-helpers remains untouched.

3. **What scaling mode should be the default?**
   - What we know: `compare_backtest_to_actual` defaults to `raw`. `analyze_slippage_trends` defaults to `toReported`. REQUIREMENTS.md says "per-contract gap" (LIVE-02).
   - What's unclear: Whether perContract or toReported is better for this use case.
   - Recommendation: Default to `perContract` since LIVE-02 explicitly asks for "per-contract gap between backtest and actual." This normalizes both sides independently and is the most intuitive for efficiency comparison. Expose as a configurable parameter.

## Sources

### Primary (HIGH confidence)
- `packages/mcp-server/src/tools/performance.ts` (lines 1780-2593) -- Full `compare_backtest_to_actual` implementation, matching logic, scaling modes, output structure
- `packages/mcp-server/src/tools/reports/slippage-helpers.ts` -- `matchTrades`, `calculateScaledPl`, `applyStrategyFilter`, `applyDateRangeFilter`
- `packages/mcp-server/src/tools/edge-decay.ts` -- All 4 existing edge decay tools (pattern to follow for 5th)
- `packages/lib/calculations/trend-detection.ts` -- `linearRegression`, `computeTrends` (reuse for alignment trends)
- `packages/lib/calculations/index.ts` -- Barrel export pattern
- `packages/lib/models/reporting-trade.ts` -- ReportingTrade interface
- `packages/lib/models/trade.ts` -- Trade interface
- `packages/mcp-server/src/utils/block-loader.ts` -- `loadBlock`, `loadReportingLog`, `BlockInfo.hasReportingLog`
- `packages/mcp-server/src/tools/middleware/sync-middleware.ts` -- `withSyncedBlock` pattern
- `.planning/phases/46-core-calculation-engines/46-RESEARCH.md` -- Established patterns for calculation engines
- `.planning/phases/48-walk-forward-degradation/48-RESEARCH.md` -- Most recent calculation engine pattern
- `.planning/phases/48-walk-forward-degradation/48-02-SUMMARY.md` -- MCP tool registration pattern

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` -- LIVE-01 through LIVE-04 requirement definitions
- `.planning/ROADMAP.md` -- Phase 50 success criteria (what this output feeds)
- `.planning/phases/49-live-alignment-signal/49-CONTEXT.md` -- User decisions constraining implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; all libraries already in use
- Architecture: HIGH -- Follows exact pattern from Phases 46-48; trade matching logic already exists
- Pitfalls: HIGH -- Based on analysis of existing `compare_backtest_to_actual` edge cases and reporting log characteristics
- Output structure: HIGH -- Phase 50 requirements clearly specify what signals are needed (component grades for "live alignment" category)

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable domain, all dependencies are internal to the project)

**Key files that will be created/modified:**
- `packages/lib/calculations/live-alignment.ts` (NEW) -- Core calculation engine (~200-250 lines)
- `packages/lib/calculations/index.ts` (MODIFIED) -- Add barrel export
- `packages/mcp-server/src/tools/edge-decay.ts` (MODIFIED) -- Add 5th tool (analyze_live_alignment)
- `packages/mcp-server/package.json` (MODIFIED) -- Version bump
- `tests/unit/live-alignment.test.ts` (NEW) -- Comprehensive tests

**Key interfaces consumed from existing code:**
- `Trade` from `packages/lib/models/trade.ts` -- `dateOpened`, `timeOpened`, `strategy`, `pl`, `numContracts`
- `ReportingTrade` from `packages/lib/models/reporting-trade.ts` -- `dateOpened`, `timeOpened`, `strategy`, `pl`, `numContracts`
- `TrendResult` from `packages/lib/calculations/trend-detection.ts` -- slope, rSquared, pValue, sampleSize
- `loadReportingLog` from `packages/mcp-server/src/utils/block-loader.ts` -- throws when no reporting log exists
