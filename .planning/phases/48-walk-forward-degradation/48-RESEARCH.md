# Phase 48: Walk-Forward Degradation - Research

**Researched:** 2026-02-05
**Domain:** Walk-forward efficiency tracking, IS/OOS performance degradation over time
**Confidence:** HIGH

## Summary

Walk-Forward Degradation (WFD) measures how out-of-sample performance evolves relative to in-sample performance across progressive time windows. The key output is an OOS efficiency time series (OOS metric / IS metric per period), with trend detection and recent-vs-historical comparison.

After deep analysis of the existing codebase, the **recommended approach is to build a lightweight, purpose-built progressive walk-forward engine** rather than reusing the existing `WalkForwardAnalyzer`. The existing WFA is fundamentally an optimization engine -- it iterates parameter combinations, applies position scaling, computes Kelly metrics, and evaluates diversification constraints. WFD needs none of this. WFD simply slices trades into IS/OOS windows, computes portfolio stats on each slice, and tracks the ratio over time.

**Primary recommendation:** Build a new `walk-forward-degradation.ts` calculation module (~200-250 lines) that reuses the existing windowing concept from WFA but computes raw IS/OOS metrics without optimization. Expose via a new `analyze_walk_forward_degradation` MCP tool following the established edge decay tool pattern.

### Critical Question: Unique Value-Add vs Existing Tools

The WFD framing provides signal that rolling_metrics and period_metrics do NOT provide:

1. **Structural IS/OOS pairing**: Rolling metrics slide a single window across trades. Period metrics segment by calendar boundaries. Neither creates paired IS/OOS windows where IS directly precedes OOS. The IS/OOS pairing is the core insight -- it answers "did performance in the preceding training period predict performance in the subsequent test period?" Rolling metrics answer "how is performance changing over time?" which is a different question.

2. **Efficiency ratio as a diagnostic**: An OOS efficiency of 0.3 (Sharpe 0.8 IS, 0.24 OOS) means something different from a rolling Sharpe declining from 0.8 to 0.24. The efficiency ratio tells you the strategy's edge *relative to what it showed in-sample*, not just that absolute performance declined. A strategy could have declining absolute metrics but stable efficiency (both IS and OOS declining together, suggesting market conditions changed but the strategy still captures its edge).

3. **Overfitting detection over time**: If efficiency was 0.9 early in history and is now 0.3, that's a degradation signal distinct from just "recent metrics are worse." It means the strategy used to generalize well and now doesn't -- suggesting the market regime the strategy was designed for may have fundamentally shifted.

4. **Complementary to regime_comparison**: MC regime comparison tells you if recent behavior diverges from historical. WFD tells you if the *generalization quality* has degraded over time. These are orthogonal signals.

## Standard Stack

### Core (all already in the project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `PortfolioStatsCalculator` | existing | Compute Sharpe, win rate, PF for each IS/OOS window | Already the standard for all per-window stats |
| `linearRegression` from `trend-detection.ts` | existing | Trend detection on efficiency time series | Already used by period-segmentation for same purpose |
| `computeTrends` from `trend-detection.ts` | existing | Multi-metric trend computation | Established pattern from Phase 46 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `calculateKellyMetrics` | existing | Kelly % per window (optional additional metric) | If we track more than 3 metrics per period |
| `normalCDF` from `statistical-utils.ts` | existing | p-value for trend significance | Used indirectly via linearRegression |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New lightweight engine | Existing `WalkForwardAnalyzer` | WFA has ~900 lines of optimization machinery (parameter grids, scaling, Kelly baselines, diversification constraints) we don't need. Using it would require passing dummy parameterRanges and ignoring most of the output. Building fresh is cleaner and ~200 lines. |
| Per-trade windows | Calendar-based windows (365d/90d) | Calendar-based matches the WFA mental model and the CONTEXT.md defaults. Per-trade would require converting between trade counts and time periods. Calendar-based is the right choice. |

**Installation:** No new packages needed. All dependencies exist in the project.

## Architecture Patterns

### Recommended Project Structure

```
packages/lib/calculations/
  walk-forward-degradation.ts          # NEW: Core WFD engine
packages/mcp-server/src/tools/
  edge-decay.ts                        # MODIFY: Add analyze_walk_forward_degradation tool
tests/unit/
  walk-forward-degradation.test.ts     # NEW: Comprehensive tests
```

### Pattern 1: Lightweight Progressive Walk-Forward

**What:** Build IS/OOS windows using calendar-based sliding, compute full PortfolioStats on each IS and OOS window, track efficiency ratios over time.

**When to use:** Always -- this is the core pattern for Phase 48.

**Key design decisions:**

```typescript
// Window structure (reuses same concept as WFA buildWindows)
interface WFDWindow {
  periodIndex: number
  inSampleStart: string    // YYYY-MM-DD
  inSampleEnd: string
  outOfSampleStart: string
  outOfSampleEnd: string
  inSampleTradeCount: number
  outOfSampleTradeCount: number
}

// Per-period result with IS, OOS, and efficiency for multiple metrics
interface WFDPeriodResult {
  window: WFDWindow
  metrics: {
    sharpe: { inSample: number | null; outOfSample: number | null; efficiency: number | null }
    winRate: { inSample: number; outOfSample: number; efficiency: number | null }
    profitFactor: { inSample: number; outOfSample: number; efficiency: number | null }
  }
  // Whether this period had sufficient data
  sufficient: boolean
  warnings: string[]
}

// Full result with time series, trends, and comparison
interface WFDResult {
  periods: WFDPeriodResult[]
  efficiencyTrends: {
    sharpe: TrendResult | null
    winRate: TrendResult | null
    profitFactor: TrendResult | null
  }
  recentVsHistorical: {
    recentPeriodCount: number
    recentAvgEfficiency: { sharpe: number | null; winRate: number | null; profitFactor: number | null }
    historicalAvgEfficiency: { sharpe: number | null; winRate: number | null; profitFactor: number | null }
    delta: { sharpe: number | null; winRate: number | null; profitFactor: number | null }
  }
  config: WFDConfig
  dataQuality: {
    totalTrades: number
    totalPeriods: number
    sufficientPeriods: number
    skippedPeriods: number
    sufficientForTrends: boolean
    warnings: string[]
  }
}
```

### Pattern 2: Efficiency Ratio Computation with Division Safety

**What:** OOS metric / IS metric, with safe handling of edge cases.

**When to use:** Every period's efficiency calculation.

```typescript
// Source: codebase pattern analysis
function computeEfficiency(
  oosValue: number | null,
  isValue: number | null,
  metricName: string
): number | null {
  // Both must be non-null
  if (oosValue === null || isValue === null) return null

  // Division by near-zero: if |IS| < epsilon, efficiency is undefined
  // Use absolute value threshold because IS Sharpe could be negative
  const EPSILON = 0.01  // Minimum meaningful IS value
  if (Math.abs(isValue) < EPSILON) return null

  // Standard ratio
  return oosValue / isValue
}
```

### Pattern 3: Recent vs Historical OOS Comparison

**What:** Compare average OOS efficiency in recent periods vs all historical periods.

**When to use:** Final summary computation.

**Design:** "Recent" = last N WF periods (not recentWindowSize from rolling metrics, which is trade-count-based). Default: last 3 WF periods (approximately 270 days with default 90d step). This maps naturally to the WF period structure.

```typescript
// Recent = last N WF periods, configurable, default 3
const recentCount = config.recentPeriodCount ?? 3
const recentPeriods = validPeriods.slice(-recentCount)
const historicalPeriods = validPeriods.slice(0, -recentCount)
```

### Pattern 4: MCP Tool Following Edge Decay Convention

**What:** Register tool matching the pattern of analyze_period_metrics, analyze_rolling_metrics, analyze_regime_comparison.

**When to use:** MCP tool registration.

```typescript
// Same pattern as other edge decay tools:
// 1. z.object schema with blockId + strategy + optional config params
// 2. withSyncedBlock middleware
// 3. filterByStrategy helper
// 4. createToolOutput(summary, structuredData)
server.registerTool(
  "analyze_walk_forward_degradation",
  {
    description: "...",
    inputSchema: z.object({
      blockId: z.string(),
      strategy: z.string().optional(),
      inSampleDays: z.number().min(30).optional(),  // default 365
      outOfSampleDays: z.number().min(7).optional(), // default 90
      stepSizeDays: z.number().min(7).optional(),    // default 90
      metric: z.enum(['sharpe', 'winRate', 'profitFactor']).optional(), // default 'sharpe'
      minTradesPerPeriod: z.number().min(1).optional(), // default 10
      recentPeriodCount: z.number().min(1).optional(),  // default 3
    }),
  },
  withSyncedBlock(baseDir, async (params) => { /* ... */ })
)
```

### Anti-Patterns to Avoid

- **Reusing WalkForwardAnalyzer class:** The existing WFA class is tightly coupled to parameter optimization. It would require passing empty parameterRanges `{}` and ignoring 80% of its output (optimal parameters, scaling, Kelly baselines, diversification). A fresh lightweight engine is cleaner and more maintainable.
- **Using trade-count-based windows:** WFD windows should be calendar-based (days) to match the WFA mental model and allow direct IS/OOS comparison across different market conditions. Trade-count windows would vary in calendar duration based on trading frequency.
- **Classifying/labeling efficiency levels:** Per CONTEXT.md, TradeBlocks provides insight, not recommendations. Return raw ratios and trend data. No "good/moderate/concerning" labels.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Portfolio stats per window | Custom win rate/PF/Sharpe calculation | `PortfolioStatsCalculator.calculatePortfolioStats(trades)` | Handles risk-free rates, commission separation, edge cases correctly |
| Linear regression on efficiency series | Custom OLS implementation | `linearRegression()` from `trend-detection.ts` | Already handles p-value, R-squared, stderr, small sample sizes |
| Multi-metric trend analysis | Custom loop over metrics | `computeTrends()` from `trend-detection.ts` | Already handles null filtering and batch computation |
| Trade sorting | Custom sort | Follow existing pattern from `rolling-metrics.ts` `sortTradesChronologically()` | Handles local time correctly per CLAUDE.md timezone rules |
| Date formatting | `toISOString()` | `formatLocalDate()` pattern or `toLocalISODate()` from period-segmentation | Preserves Eastern Time per CLAUDE.md |

**Key insight:** All the statistical and metrics computation infrastructure already exists. WFD is primarily a windowing + ratio computation + trend detection orchestration layer that composes existing primitives.

## Common Pitfalls

### Pitfall 1: Division by Near-Zero IS Metrics

**What goes wrong:** When the IS Sharpe ratio is 0.001, efficiency becomes 1000x the OOS Sharpe, creating meaningless extreme values that corrupt trend detection.
**Why it happens:** Short IS windows with mixed win/loss days can produce near-zero Sharpe ratios that aren't truly "zero performance" but are unstable denominators.
**How to avoid:** Return `null` for efficiency when `|IS metric| < epsilon`. Use epsilon of 0.01 for Sharpe (below which the metric is statistically meaningless anyway), 0.01 for profit factor. Win rate denominator is always 1.0 (it's a proportion, not a ratio), so division by near-zero only applies to Sharpe and PF.
**Warning signs:** Efficiency values exceeding 10.0 or below -10.0 in any period.

### Pitfall 2: Negative IS Sharpe Creating Misleading Efficiency

**What goes wrong:** If IS Sharpe is -0.5 and OOS Sharpe is -0.3, efficiency = 0.6 -- which looks "good" but both periods were negative.
**Why it happens:** The ratio of two negative numbers is positive.
**How to avoid:** Always include raw IS and OOS values alongside efficiency. The consuming LLM needs both the ratio AND the raw values to interpret correctly. Consider flagging periods where IS metric is negative, as efficiency is less meaningful when the baseline is already losing.

### Pitfall 3: Too Few WF Periods for Meaningful Trend

**What goes wrong:** With 3 years of history and default settings (365d IS + 90d OOS + 90d step), you get approximately 7-8 WF periods. Linear regression on 7-8 points has very low statistical power.
**Why it happens:** The IS window is large (365d) and trade history is typically 3-5 years.
**How to avoid:**
1. Return the p-value from linear regression so consumers know when the trend is statistically weak.
2. Set `sufficientForTrends: boolean` based on period count >= 4 (matching period-segmentation's threshold).
3. With 10-15 data points and low variance, linear regression CAN detect meaningful trends (research shows N >= 8 is sufficient for tight data patterns). But flag when R-squared is low and p-value is high.
4. Document in dataQuality.warnings when period count is borderline.

### Pitfall 4: Overlapping IS Windows Inflating Stability

**What goes wrong:** With 365d IS and 90d step, consecutive IS windows overlap by 275 days (75%). This means adjacent efficiency values are highly correlated, making trend detection appear smoother than reality.
**Why it happens:** The step size is much smaller than the IS window.
**How to avoid:** This is expected behavior for walk-forward analysis and matches Pardo's methodology. The overlap IS intentional -- it provides progressive insight rather than independent samples. However, p-values from trend regression should be interpreted cautiously as data points are not independent. Document this in the tool description.

### Pitfall 5: Partial First/Last Periods

**What goes wrong:** The first IS window and last OOS window may have fewer trades than expected because trade history doesn't start/end on window boundaries.
**Why it happens:** Calendar-based windows don't align with actual trading start/end dates.
**How to avoid:** Use minTradesPerPeriod threshold (default 10) to skip periods with insufficient data. Report skipped period count in dataQuality. This matches the existing WFA pattern (`minInSampleTrades`, `minOutOfSampleTrades`).

### Pitfall 6: Infinity Profit Factor Breaking Efficiency

**What goes wrong:** If IS or OOS period has zero losses, profit factor is Infinity. Efficiency calculation breaks.
**Why it happens:** Common in short windows or strongly directional strategies.
**How to avoid:** When profit factor is Infinity, treat efficiency as null for that metric in that period. This is already the pattern in `period-segmentation.ts` where Infinity PF is converted to 0 for trend detection. For WFD, null is more appropriate than 0 since the period should simply be excluded from PF efficiency tracking.

## Code Examples

### Window Building (adapted from existing WFA pattern)

```typescript
// Source: walk-forward-analyzer.ts buildWindows(), adapted for WFD
function buildDegradationWindows(
  firstTradeDate: Date,
  lastTradeDate: Date,
  config: WFDConfig
): WFDWindow[] {
  const DAY_MS = 24 * 60 * 60 * 1000
  const windows: WFDWindow[] = []

  const firstMs = floorToLocalDate(firstTradeDate).getTime()
  const lastMs = floorToLocalDate(lastTradeDate).getTime()
  let cursor = firstMs
  let periodIndex = 0

  while (cursor < lastMs) {
    const isStart = new Date(cursor)
    const isEnd = new Date(cursor + (config.inSampleDays - 1) * DAY_MS)
    const oosStart = new Date(isEnd.getTime() + DAY_MS)
    const oosEnd = new Date(oosStart.getTime() + (config.outOfSampleDays - 1) * DAY_MS)

    // Stop if OOS starts beyond last trade
    if (oosStart.getTime() > lastMs) break

    windows.push({
      periodIndex,
      inSampleStart: formatLocalDate(isStart),
      inSampleEnd: formatLocalDate(isEnd),
      outOfSampleStart: formatLocalDate(oosStart),
      outOfSampleEnd: formatLocalDate(oosEnd),
      inSampleTradeCount: 0,  // Filled later
      outOfSampleTradeCount: 0,
    })

    cursor += config.stepSizeDays * DAY_MS
    periodIndex++
  }

  return windows
}
```

### Efficiency Computation with Safety

```typescript
// Source: Pattern derived from existing WFA degradationFactor calculation (line 806)
const EFFICIENCY_EPSILON: Record<string, number> = {
  sharpe: 0.01,
  profitFactor: 0.01,
  winRate: 0,  // Win rate IS is always > 0 if there are trades
}

function computeEfficiency(
  oosValue: number | null,
  isValue: number | null,
  metric: string
): number | null {
  if (oosValue === null || isValue === null) return null
  if (!Number.isFinite(oosValue) || !Number.isFinite(isValue)) return null

  const eps = EFFICIENCY_EPSILON[metric] ?? 0.01
  if (Math.abs(isValue) < eps) return null

  return oosValue / isValue
}
```

### MCP Tool Summary Construction (following established pattern)

```typescript
// Source: Pattern from edge-decay.ts analyze_rolling_metrics tool
const summary = `Walk-forward degradation for ${blockId}${strategy ? ` (${strategy})` : ""}: ` +
  `${result.dataQuality.totalTrades} trades, ${result.dataQuality.sufficientPeriods} periods\n` +
  `IS=${config.inSampleDays}d / OOS=${config.outOfSampleDays}d / step=${config.stepSizeDays}d\n` +
  `Avg efficiency: sharpe=${fmtRatio(avgEff.sharpe)}, ` +
  `winRate=${fmtRatio(avgEff.winRate)}, PF=${fmtRatio(avgEff.profitFactor)}\n` +
  `Trend (Sharpe eff): slope=${fmtSlope(trends.sharpe?.slope)}, ` +
  `p=${fmtP(trends.sharpe?.pValue)}`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-split train/test | Progressive walk-forward (Pardo 2008) | 2008+ | Standard for strategy validation |
| WFE on raw P&L only | WFE on normalized metrics (Sharpe, PF) | N/A (TradeBlocks design) | Better for ratio comparisons across different period lengths |
| Classification labels (good/bad) | Raw data + LLM interpretation | TradeBlocks design principle | Flexible, context-aware analysis |

**Relevant research (Dec 2025):** arXiv paper "Interpretable Hypothesis-Driven Trading" extends Pardo's walk-forward methodology with modern statistical adjustments. Key finding: over 90% of academic strategies fail when implemented with real capital due to overfitting. WFD directly addresses this by tracking whether a strategy's generalization quality degrades over time.

**Deprecated/outdated:**
- Fixed single-split validation (replaced by progressive walk-forward)
- WFE > 50% as binary pass/fail (better to track as continuous time series)

## Open Questions

1. **Efficiency interpretation when both IS and OOS are negative**
   - What we know: Ratio of two negatives is positive, which could be misleading
   - What's unclear: Whether to special-case this or let the LLM handle it with the raw IS/OOS values
   - Recommendation: Include raw IS and OOS values in every period result. Flag periods where IS metric is negative in the warnings array. Let the LLM interpret. This aligns with the "insight, not recommendations" principle.

2. **Optimal epsilon for near-zero division**
   - What we know: 0.01 is reasonable for Sharpe (a Sharpe of 0.01 is essentially zero signal). Profit factor below 0.01 is similarly meaningless.
   - What's unclear: Whether different strategies might need different thresholds.
   - Recommendation: Use 0.01 as a sensible default. This is a Claude's Discretion item from CONTEXT.md. Making it configurable adds complexity for minimal gain -- LLMs can re-run with different params if needed.

3. **Whether 1-2 WF periods provide useful output**
   - What we know: With very short trade history, you might get 1-2 WF periods. No trend detection is possible. But the individual period efficiency values are still meaningful data points.
   - What's unclear: Whether to return results or refuse with a warning.
   - Recommendation: Return results with warnings. Set `sufficientForTrends: false`. Return null for trend regression results. The individual period efficiency data is still useful for an LLM to reason about, even without trend analysis.

## Sources

### Primary (HIGH confidence)
- **Existing codebase analysis:** `walk-forward-analyzer.ts`, `rolling-metrics.ts`, `period-segmentation.ts`, `trend-detection.ts`, `edge-decay.ts` -- all read and analyzed in detail
- **WalkForwardAnalyzer.calculateSummary()** (line 783) -- documents Pardo's WFE methodology with detailed JSDoc
- **WalkForwardAnalyzer.buildWindows()** (line 313) -- calendar-based windowing logic to adapt

### Secondary (MEDIUM confidence)
- [Walk Forward Optimization - Wikipedia](https://en.wikipedia.org/wiki/Walk_forward_optimization) -- WFE definition and methodology
- [QuantInsti - Walk Forward Optimization](https://blog.quantinsti.com/walk-forward-optimization-introduction/) -- Practical WFO implementation guidance
- [Towards Data Science - Minimum Sample Size for Linear Regression](https://towardsdatascience.com/what-is-the-minimum-sample-size-required-to-perform-a-meaningful-linear-regression-945c0edf1d0/) -- N >= 8 for low-variance, N >= 25 for high-variance
- [PMC - A Solution to Minimum Sample Size for Regressions](https://pmc.ncbi.nlm.nih.gov/articles/PMC7034864/) -- Statistical validity with small sample sizes

### Tertiary (LOW confidence)
- [arXiv - Interpretable Hypothesis-Driven Trading (Dec 2025)](https://arxiv.org/html/2512.12924v1) -- Recent WF validation framework research; cited for context only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already exist in the codebase; no new dependencies needed
- Architecture: HIGH -- follows established patterns from existing edge decay tools; windowing logic directly adapted from existing WFA
- Pitfalls: HIGH -- identified through direct code analysis and understanding of ratio mathematics; division-by-zero handling informed by existing codebase patterns (WFA line 806)
- Unique value-add analysis: HIGH -- based on deep comparison of all three existing tools (period_metrics, rolling_metrics, regime_comparison) against WFD's IS/OOS framing

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (stable -- all dependencies are internal to the project)
