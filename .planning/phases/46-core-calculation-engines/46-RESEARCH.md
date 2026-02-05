# Phase 46: Core Calculation Engines - Research

**Researched:** 2026-02-05
**Domain:** Period segmentation, trend detection, and rolling metrics for options trading performance analysis
**Confidence:** HIGH

## Summary

This phase builds foundational calculation engines for edge decay analysis. The calculations are pure TypeScript functions in `packages/lib/calculations/` that will be consumed by a new MCP tool (or tools) and later by the unified `analyze_edge_decay` tool in Phase 50. The codebase already has strong patterns for every building block needed: `PortfolioStatsCalculator` for per-period metrics, inline `linearRegression()` from Phase 39 for trend detection, `PerformanceCalculator.calculateRollingSharpe()` for rolling windows, and `calculateStreakDistributions()` for streak analysis.

The primary work is composing existing calculation primitives into three new engines: (1) period segmentation engine that groups trades by year/quarter/month and computes metrics per segment, (2) trend detection that runs linear regression on the period-segmented metrics, and (3) rolling metrics engine that computes rolling windows of key metrics with seasonal averages and recent-vs-historical comparison with structural flags.

**Primary recommendation:** Build all calculations as pure functions in new files under `packages/lib/calculations/`, following the existing pattern of exporting from `calculations/index.ts`. No new dependencies needed -- math.js, normalCDF, and OLS regression are all available in the codebase. The MCP tool registration follows the established `registerXTools(server, baseDir)` pattern.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mathjs | ^15.1.0 | Statistical calculations (mean, std, min, max) | Already used throughout portfolio-stats.ts; ensures numpy parity |
| zod | ^4.0.0 | MCP tool input schema validation | Already used by all MCP tools |
| @modelcontextprotocol/sdk | ^1.11.0 | MCP server tool registration | Already the foundation of the MCP server |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| normalCDF (statistical-utils.ts) | n/a (internal) | p-value calculation for linear regression | Trend detection p-values |
| getRiskFreeRate (risk-free-rate.ts) | n/a (internal) | Historical Treasury rates for Sharpe calculation | Rolling Sharpe per period |

### No New Dependencies Needed
| Considered | Reason Not Needed |
|-----------|-------------------|
| simple-statistics | math.js already provides mean/std; OLS regression is a ~30-line implementation already in codebase |
| regression-js | Phase 39 research explicitly decided against it; inline OLS is simpler |
| date-fns | Quarter/year grouping is trivial with `Date.getMonth()` and `Date.getFullYear()`; no existing usage in packages/ |

## Architecture Patterns

### Recommended Project Structure

```
packages/lib/calculations/
  period-segmentation.ts      # NEW: Period grouping + per-period metrics
  trend-detection.ts          # NEW: Linear regression on period metrics (extracted from slippage-trends)
  rolling-metrics.ts          # NEW: Rolling window metrics + seasonal averages + recent comparison
  portfolio-stats.ts          # EXISTING: PortfolioStatsCalculator (reuse for per-period calculations)
  statistical-utils.ts        # EXISTING: normalCDF (reuse for p-values)
  kelly.ts                    # EXISTING: calculateKellyMetrics (reuse for per-period Kelly)
  index.ts                    # EXISTING: Add new exports

packages/mcp-server/src/tools/
  edge-decay.ts               # NEW: MCP tool(s) that wire up the calculation engines
  OR
  analysis.ts                 # EXISTING: Could add new tools here (but edge-decay.ts is cleaner)
```

### Pattern 1: Pure Calculation Functions (Not Classes)

**What:** New calculation engines should be pure exported functions, not class-based
**When to use:** All new calculations in this phase
**Why:** The existing codebase uses both patterns -- `PortfolioStatsCalculator` is class-based, but newer calculations (kelly.ts, streak-analysis.ts, correlation.ts, tail-risk-analysis.ts) are all pure function exports. The pure function pattern is simpler, more testable, and matches the direction the codebase is moving.

```typescript
// Source: Existing pattern from packages/lib/calculations/kelly.ts
export interface PeriodSegmentResult {
  periods: PeriodStats[];
  trends: Record<string, TrendResult>;
  consecutiveMonthStretch: ConsecutiveStretchResult;
}

export function calculatePeriodSegmentation(
  trades: Trade[],
  options?: PeriodSegmentOptions
): PeriodSegmentResult {
  // ...
}
```

### Pattern 2: Reuse PortfolioStatsCalculator for Per-Period Metrics

**What:** For each period (year/quarter/month), filter trades to that period, then call existing `PortfolioStatsCalculator.calculatePortfolioStats(periodTrades)` to get all metrics
**When to use:** Computing win rate, profit factor, Sharpe, etc. per period
**Why:** Avoids reimplementing calculation logic. The calculator already handles edge cases (empty arrays, single trade, commission separation, date-based risk-free rates for Sharpe).

```typescript
// Source: packages/lib/calculations/portfolio-stats.ts
const calculator = new PortfolioStatsCalculator();
const periodStats = calculator.calculatePortfolioStats(periodTrades);
// periodStats.winRate, periodStats.profitFactor, periodStats.sharpeRatio, etc.
```

**CRITICAL:** Kelly % calculation uses the formula `(W * R - L) / R` where W=winRate, R=avgWin/avgLoss, L=1-winRate. This is already in `calculateKellyPercentage()` (private method) and `calculateKellyMetrics()` (public). For consistency, use the existing `calculateKellyMetrics()` from kelly.ts for per-period Kelly.

### Pattern 3: MCP Tool Registration with createToolOutput

**What:** All MCP tools follow the pattern: Zod schema -> handler -> `createToolOutput(summary, structuredData)`
**When to use:** Registering the new edge decay tools
**Example:**

```typescript
// Source: packages/mcp-server/src/tools/analysis.ts (all tools follow this)
server.registerTool(
  "tool_name",
  {
    description: "...",
    inputSchema: z.object({ ... }),
  },
  async (params) => {
    try {
      const block = await loadBlock(baseDir, params.blockId);
      // ... calculation ...
      const summary = `Brief: ${blockId} | key metrics`;
      const structuredData = { ... };
      return createToolOutput(summary, structuredData);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);
```

### Pattern 4: Inline Linear Regression (Existing Pattern)

**What:** OLS linear regression is implemented inline, not via external library
**When to use:** Trend detection on period metrics
**Source:** Already implemented in `packages/mcp-server/src/tools/reports/slippage-trends.ts` (lines 226-284)

The existing implementation computes: slope, intercept, R-squared, p-value, stderr, and interpretation. For Phase 46, we adapt this but **remove the interpretation labels** (per CONTEXT.md decision: "No interpretive labels -- direction is implicit in the slope sign"). The function should be extracted to `packages/lib/calculations/trend-detection.ts` so it can be reused across the project.

### Anti-Patterns to Avoid

- **Do NOT add interpretive labels:** CONTEXT.md explicitly states "No interpretive labels (no 'improving/stable/deteriorating')." Return only slope, R-squared, p-value, sample size. The sign of the slope IS the direction.
- **Do NOT duplicate calculation logic:** Reuse `PortfolioStatsCalculator` for per-period stats rather than reimplementing win rate, profit factor, etc.
- **Do NOT use daily-log-based calculations:** CONTEXT.md specifies these are trade-based calculations. The `calculatePortfolioStats(trades, undefined, true)` pattern (isStrategyFiltered=true) or simply not passing daily logs will force trade-based calculations.
- **Do NOT add UI components:** This phase is calculations only. No React components, no charts. Phase 50 handles the MCP tool API.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-period win rate, PF, Sharpe | Custom calculation per metric | `PortfolioStatsCalculator.calculatePortfolioStats(periodTrades)` | 840 lines of battle-tested calculation with edge cases handled |
| Kelly Criterion per period | Custom Kelly formula | `calculateKellyMetrics(periodTrades)` from kelly.ts | Handles edge cases (no wins, no losses, zero denominator) |
| p-value for regression slope | t-distribution library | `normalCDF(Math.abs(tStat))` from statistical-utils.ts | Normal approximation already validated in Phase 39 |
| Date grouping by month key | date-fns or complex logic | `date.getFullYear() + '-' + (date.getMonth()+1).padStart(2,'0')` | Already used in PerformanceCalculator.getDateKey() |
| Win/loss streaks | Custom streak counting | Adapt from `calculateStreaks()` in portfolio-stats.ts | Already handles edge cases (breakeven, single trade) |
| Trade sorting by date | Custom sort | `[...trades].sort((a, b) => new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime())` | Pattern used consistently throughout codebase |
| Rolling Sharpe | Custom implementation | Adapt from `PerformanceCalculator.calculateRollingSharpe()` | Already uses date-based Treasury rates correctly |

**Key insight:** Almost every calculation needed for this phase already exists somewhere in the codebase. The work is composing these into coherent engines with proper interfaces, not inventing new math.

## Common Pitfalls

### Pitfall 1: Partial Period Bias
**What goes wrong:** A period with 3 trades shows wildly different metrics than one with 100 trades, making trend detection misleading
**Why it happens:** Year/quarter boundaries create partial periods at the start and end of the data
**How to avoid:** CONTEXT.md requires partial periods to be "included but annotated" (e.g., "Q1 2024 (partial: 14 days)"). Include a `tradeCount` and `isPartial` flag in each period. A period is partial if it spans less than 75% of its expected duration.
**Warning signs:** Regression slope dominated by a single partial period with extreme metrics

### Pitfall 2: Avg Monthly Return as % of Equity Requires Initial Capital
**What goes wrong:** Can't compute "avg monthly return as % of equity" without knowing the portfolio value at each month
**Why it happens:** Trade data has `fundsAtClose` per trade, but calculating monthly return as a percentage requires the portfolio value at the START of each month
**How to avoid:** Build a running equity curve from `initialCapital + cumulative P&L`. Use `PortfolioStatsCalculator.calculateInitialCapital(trades)` to get starting capital, then compute monthly returns as `monthPL / startOfMonthEquity * 100`. This is already done in `PerformanceCalculator.calculateMonthlyReturns()`.
**Warning signs:** Division by zero or negative equity values for months after large drawdowns

### Pitfall 3: Rolling Window Edge Cases
**What goes wrong:** Rolling metrics return empty or NaN when the window size exceeds available trades
**Why it happens:** Auto-calculated window size may be too large for small datasets, or a configurable window may exceed trade count
**How to avoid:** Return a clear "insufficient data" indicator when `trades.length < windowSize`. For auto-calculation, use `Math.max(20, Math.round(trades.length * 0.2))` as the smart default (20% of trades, minimum 20). This ensures enough data for meaningful rolling metrics while covering ~80% of history.
**Warning signs:** Window size equals or exceeds total trade count

### Pitfall 4: Consecutive Month Losing Stretch Requires Monthly Aggregation First
**What goes wrong:** Counting consecutive losing TRADES instead of consecutive losing MONTHS
**Why it happens:** Confusing trade-level streaks (already computed) with month-level streaks (new requirement)
**How to avoid:** First aggregate trades by month (YYYY-MM key), compute net P&L per month, THEN find the longest consecutive run of months with negative P&L. This is different from `calculateStreaks()` which operates on individual trades.
**Warning signs:** Getting "worst streak: 15" when it should be "worst streak: 3 months"

### Pitfall 5: Sharpe Ratio Per Period Needs Sufficient Data
**What goes wrong:** Sharpe ratio for a period with 2-3 trades returns extreme values
**Why it happens:** Sharpe requires daily returns with meaningful variance; a period with few trades produces meaningless Sharpe
**How to avoid:** Return `undefined` for Sharpe when a period has fewer than 5 trading days (already the behavior of `calculateSharpeRatio()` which returns undefined for < 2 daily returns). Include the trade count in the period output so consumers can judge reliability.
**Warning signs:** Sharpe ratios > 10 or < -10 for short periods

### Pitfall 6: Regression on Too Few Points
**What goes wrong:** Linear regression with 2-3 data points gives meaningless R-squared and p-values
**Why it happens:** Yearly breakdown of a 2-year dataset gives only 2 points for regression
**How to avoid:** The existing Phase 39 regression implementation handles n < 2 by returning null. For this phase, include `sampleSize` in all trend outputs so consumers can assess reliability. A regression with n < 4 should still be computed but the low sample size makes it unreliable -- the p-value will naturally be high.
**Warning signs:** Very low p-values from regressions on 3-4 data points (possible overfitting to noise)

### Pitfall 7: Timezone Issues with Period Boundaries
**What goes wrong:** A trade opened at 11pm ET on Dec 31 gets grouped into January because `new Date()` interprets in UTC
**Why it happens:** The CLAUDE.md explicitly warns about timezone handling: "All dates and times are processed and displayed as US Eastern Time"
**How to avoid:** Use `date.getFullYear()`, `date.getMonth()`, `date.getDate()` (local time methods, not `toISOString()` which converts to UTC). The existing codebase already follows this convention. Since trade dates are parsed as local dates via `parseDatePreservingCalendarDay()`, the getMonth/getFullYear methods return the correct calendar month/year.
**Warning signs:** Off-by-one month errors at month boundaries, especially around DST transitions

## Code Examples

### Period Grouping (Year/Quarter/Month)

```typescript
// Source: Adapted from existing PerformanceCalculator.getDateKey() pattern
type PeriodGranularity = 'yearly' | 'quarterly' | 'monthly';

function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1; // 1-4
}

function getPeriodKey(date: Date, granularity: PeriodGranularity): string {
  const year = date.getFullYear();
  switch (granularity) {
    case 'yearly':
      return `${year}`;
    case 'quarterly':
      return `${year}-Q${getQuarter(date)}`;
    case 'monthly':
      return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

function groupTradesByPeriod(
  trades: Trade[],
  granularity: PeriodGranularity
): Map<string, Trade[]> {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) {
    const key = getPeriodKey(new Date(trade.dateOpened), granularity);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(trade);
  }
  return groups;
}
```

### Linear Regression for Trend Detection (Extract from Phase 39)

```typescript
// Source: packages/mcp-server/src/tools/reports/slippage-trends.ts lines 226-284
// MODIFIED per CONTEXT.md: no interpretive labels
import { normalCDF } from './statistical-utils';

export interface TrendResult {
  slope: number;
  intercept: number;
  rSquared: number;
  pValue: number;
  stderr: number;
  sampleSize: number;
}

export function linearRegression(y: number[]): TrendResult | null {
  const n = y.length;
  if (n < 2) return null;

  const x = y.map((_, i) => i);
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumXY += (x[i] - meanX) * (y[i] - meanY);
    sumX2 += (x[i] - meanX) ** 2;
  }
  const slope = sumX2 > 0 ? sumXY / sumX2 : 0;
  const intercept = meanY - slope * meanX;

  const predicted = x.map((xi) => slope * xi + intercept);
  const ssRes = y.reduce((sum, yi, i) => sum + (yi - predicted[i]) ** 2, 0);
  const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const mse = n > 2 ? ssRes / (n - 2) : 0;
  const stderr = sumX2 > 0 ? Math.sqrt(mse / sumX2) : 0;
  const tStat = stderr > 0 ? slope / stderr : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));

  return { slope, intercept, rSquared, pValue, stderr, sampleSize: n };
}
```

### Rolling Metrics Window Calculation

```typescript
// Source: Adapted from PerformanceCalculator.calculateRollingSharpe() pattern
// Uses trade-count-based windows instead of day-based
export function calculateRollingMetrics(
  sortedTrades: Trade[],
  windowSize: number
): RollingMetricPoint[] {
  if (sortedTrades.length < windowSize) return [];

  const calculator = new PortfolioStatsCalculator();
  const results: RollingMetricPoint[] = [];

  for (let i = windowSize - 1; i < sortedTrades.length; i++) {
    const windowTrades = sortedTrades.slice(i - windowSize + 1, i + 1);
    const stats = calculator.calculatePortfolioStats(windowTrades);
    const kelly = calculateKellyMetrics(windowTrades);

    results.push({
      tradeIndex: i,
      date: new Date(sortedTrades[i].dateOpened).toISOString(),
      sharpe: stats.sharpeRatio ?? null,
      winRate: stats.winRate,
      profitFactor: stats.profitFactor,
      kellyPercent: kelly.hasValidKelly ? kelly.percent : null,
      avgReturn: /* computed per period */ null,
      netPl: stats.netPl,
      tradeCount: windowTrades.length,
    });
  }

  return results;
}
```

### Consecutive Month Losing Stretch

```typescript
// Source: New, but logic adapted from calculateStreaks() in portfolio-stats.ts
function findConsecutiveMonthLosingStretch(
  trades: Trade[]
): { worstStretch: number; currentStretch: number; worstStartMonth: string; worstEndMonth: string } {
  // Group by month
  const monthlyPl = new Map<string, number>();
  for (const trade of trades) {
    const date = new Date(trade.dateOpened);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyPl.set(key, (monthlyPl.get(key) || 0) + trade.pl);
  }

  // Sort months chronologically
  const sortedMonths = Array.from(monthlyPl.keys()).sort();

  let worstStretch = 0;
  let currentStretch = 0;
  let worstStart = '';
  let worstEnd = '';
  let currentStart = '';

  for (const month of sortedMonths) {
    const pl = monthlyPl.get(month)!;
    if (pl < 0) {
      if (currentStretch === 0) currentStart = month;
      currentStretch++;
      if (currentStretch > worstStretch) {
        worstStretch = currentStretch;
        worstStart = currentStart;
        worstEnd = month;
      }
    } else {
      currentStretch = 0;
    }
  }

  return {
    worstStretch,
    currentStretch,
    worstStartMonth: worstStart,
    worstEndMonth: worstEnd,
  };
}
```

### Smart Default for Rolling Window Size (Claude's Discretion)

```typescript
// Recommendation: 20% of total trades, clamped to [20, 200]
// Rationale:
// - 20% gives enough history coverage while showing meaningful recent trends
// - Minimum 20 ensures statistical significance for Sharpe/win rate
// - Maximum 200 prevents rolling windows from being so large they wash out changes
// - This matches the "auto-calculated default" from REQUIREMENTS.md which says "~20% of total trades or last 200"
function calculateDefaultWindowSize(tradeCount: number): number {
  const twentyPercent = Math.round(tradeCount * 0.2);
  return Math.max(20, Math.min(200, twentyPercent));
}
```

### Smart Default for Recent Window (Claude's Discretion)

```typescript
// Recommendation: Same formula as rolling window -- 20% of trades, clamped to [20, 200]
// CONTEXT.md says "Default to trade-count-based with auto-calculated N"
// REQUIREMENTS.md API-02 says "~20% of total trades or last 200, whichever is larger"
// Interpretation: max(20% of trades, 200) but capped at total trades
function calculateDefaultRecentWindow(tradeCount: number): number {
  const twentyPercent = Math.round(tradeCount * 0.2);
  // "whichever is larger" means max of the two
  const defaultN = Math.max(twentyPercent, 200);
  // But can't exceed total trades
  return Math.min(defaultN, tradeCount);
}
```

### Edge Handling for Insufficient Data (Claude's Discretion)

```typescript
// Recommendation: Return result with null/undefined metrics and a `dataQuality` field
// rather than throwing errors or returning empty results
interface DataQuality {
  sufficientForPeriodSegmentation: boolean;  // Need >= 2 periods (months) of data
  sufficientForTrends: boolean;              // Need >= 3 periods for meaningful regression
  sufficientForRolling: boolean;             // Need >= windowSize trades
  sufficientForRecentComparison: boolean;    // Need > recentWindow trades
  warnings: string[];                        // e.g., "Only 15 trades -- rolling metrics may be unreliable"
}
```

### Comparison Output Format (Claude's Discretion)

```typescript
// Recommendation: Side-by-side with deltas (not ratios)
// Rationale: Deltas are easier to interpret at a glance ("+5%" vs "1.05x")
// Threshold markers are additive annotations, not replacements
interface RecentVsHistoricalComparison {
  metric: string;
  recentValue: number;
  historicalValue: number;
  delta: number;                    // recent - historical
  thresholdBreached: boolean;       // true if structural flag triggered
  thresholdDescription: string | null; // e.g., "below 1.0" for profit factor
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed risk-free rate for Sharpe | Per-day Treasury rate lookup | v2.2 (Phase 25) | More accurate Sharpe ratios per period |
| Class-based calculations | Pure function exports | v2.1+ (Phase 17+) | Simpler, more testable calculation modules |
| Separate markdown + JSON output | JSON-first with brief text summary | v2.0 | Optimized for AI reasoning |
| Inline linear regression per tool | Shared utility (proposed this phase) | Phase 46 | Reusable across trend detection, avoid code duplication |

**Note on the existing `linearRegression` implementation:** It currently lives inline in `slippage-trends.ts`. This phase should extract it to `packages/lib/calculations/trend-detection.ts` so both slippage-trends and period-segmentation can share it. The slippage-trends tool can then import from lib.

## Open Questions

1. **Should period segmentation include monthly granularity in the default output?**
   - What we know: CONTEXT.md says "Three granularity levels: yearly, quarterly, and monthly breakdowns." REQUIREMENTS.md mentions "yearly and quarterly" for PSEG-01.
   - What's unclear: Should monthly be computed always, or only when requested? Monthly can produce many periods (100+ for a multi-year strategy).
   - Recommendation: Compute all three granularities always. The engine is consumed by Phase 50 which will select what to surface. The calculation cost is minimal since we're just grouping trades and running existing calculators.

2. **Where should the new calculations live -- lib or MCP server?**
   - What we know: Existing calculation patterns are split -- PortfolioStatsCalculator is in `packages/lib/calculations/`, but slippage-trends regression is inline in `packages/mcp-server/src/tools/reports/`. The CLAUDE.md says calculations go in `lib/`.
   - What's unclear: Whether extracting the linear regression utility from slippage-trends is in scope.
   - Recommendation: New calculation engines go in `packages/lib/calculations/`. Extract `linearRegression` to `trend-detection.ts` in lib as well, then update slippage-trends to import from lib. This follows the architecture principle that `packages/lib/` is for business logic and `packages/mcp-server/` is for tool wiring.

3. **Should quarterly seasonal averages operate on rolling metric points or on period-grouped data?**
   - What we know: CONTEXT.md says "Quarterly seasonal averages (Q1/Q2/Q3/Q4) computed in this phase for each rolling metric." ROLL-02 says "quarterly averages of rolling metrics to identify seasonal patterns."
   - What's unclear: "Quarterly averages of rolling metrics" could mean (a) average of all rolling-metric values that fall within Q1 across all years, or (b) compute rolling metrics then group them by quarter.
   - Recommendation: (a) is the intended meaning -- for each quarter label (Q1, Q2, Q3, Q4), average all rolling metric values from points that fall in that quarter across all years. This reveals seasonal patterns like "Q4 is consistently weak."

## Sources

### Primary (HIGH confidence)
- `packages/lib/calculations/portfolio-stats.ts` - Existing PortfolioStatsCalculator with all per-period metric calculations
- `packages/lib/calculations/kelly.ts` - Existing Kelly criterion calculation
- `packages/lib/calculations/streak-analysis.ts` - Existing streak detection with runs test
- `packages/lib/calculations/statistical-utils.ts` - normalCDF for p-value calculation
- `packages/lib/calculations/performance.ts` - Existing calculateRollingSharpe, calculateMonthlyReturns, getDateKey pattern
- `packages/mcp-server/src/tools/reports/slippage-trends.ts` - Existing inline linearRegression implementation (lines 226-284)
- `packages/mcp-server/src/tools/analysis.ts` - MCP tool registration pattern
- `packages/mcp-server/src/utils/output-formatter.ts` - createToolOutput pattern
- `packages/mcp-server/src/utils/block-loader.ts` - loadBlock pattern
- `packages/lib/models/trade.ts` - Trade interface with all available fields

### Secondary (MEDIUM confidence)
- `.planning/phases/39-trend-analysis/39-RESEARCH.md` - Prior research on linear regression approach
- `.planning/REQUIREMENTS.md` - PSEG-01 through ROLL-04 requirement definitions
- `.planning/ROADMAP.md` - Phase dependency graph and success criteria
- `.planning/phases/46-core-calculation-engines/46-CONTEXT.md` - User decisions constraining implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Follows established codebase patterns exactly
- Pitfalls: HIGH - Based on actual codebase analysis, not theoretical concerns
- Linear regression: HIGH - Exact implementation already exists in Phase 39

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (stable domain, no moving targets)

**Key Trade interface fields available for segmentation:**
- `dateOpened: Date` - Primary grouping field for period segmentation
- `pl: number` - Gross P&L for win rate, PF, net P&L calculations
- `strategy: string` - Not used in Phase 46 (deferred per CONTEXT.md)
- `fundsAtClose: number` - For equity curve / monthly return as % of equity
- `openingCommissionsFees` + `closingCommissionsFees` - For net P&L
- `numContracts: number` - Available but not required for Phase 46
- `marginReq: number` - For Kelly percentage-based calculations

**Existing rolling metric pattern (PerformanceCalculator.calculateRollingSharpe):**
- Uses day-based windows (windowDays parameter)
- This phase needs TRADE-COUNT-based windows per CONTEXT.md decision
- Adaptation: replace day-based windowing with trade-index-based windowing
- The Sharpe calculation logic (date-based Treasury rates, excess returns, std) can be reused
