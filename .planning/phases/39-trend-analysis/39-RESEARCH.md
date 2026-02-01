# Phase 39: Trend Analysis - Research

**Researched:** 2026-02-01
**Domain:** Time-series slippage analysis with linear regression for trend detection
**Confidence:** HIGH

## Summary

This phase implements an MCP tool (`analyze_slippage_trends`) that analyzes slippage trends over time and detects improvement/degradation patterns. The codebase already contains most of the infrastructure needed:

1. **Trade matching**: `analyze_discrepancies` (Phase 37) and `compare_backtest_to_actual` (Phase 36) provide robust trade matching between backtest (tradelog.csv) and actual (reportinglog.csv) trades
2. **Statistical utilities**: `packages/lib/calculations/statistical-utils.ts` provides Kendall tau, Pearson correlation, and normal distribution functions
3. **Math library**: mathjs v15.1.0 is already installed for mean, std operations
4. **Correlation patterns**: `packages/lib/calculations/correlation.ts` provides time-period aggregation (daily/weekly/monthly)

The primary new work is implementing linear regression with p-value/R-squared calculations for trend detection. This should be implemented from scratch using the existing mathjs primitives (mean, std) since mathjs does not have a built-in linear regression function.

**Primary recommendation:** Implement a new `analyze_slippage_trends` tool in `reports.ts` that leverages existing trade matching from `analyze_discrepancies` and adds time-series trend analysis with linear regression.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mathjs | 15.1.0 | Statistical calculations (mean, std) | Already used for all portfolio stats |
| zod | 4.0.0 | Schema validation for MCP tool inputs | Standard across all MCP tools |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| statistical-utils.ts | local | Kendall tau, Pearson correlation, normalCDF | For correlation calculations |
| correlation.ts | local | Time-period aggregation (daily/weekly/monthly) | For grouping slippage by period |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom linear regression | regression-js library | Adds external dependency; simple OLS is easy to implement with mathjs primitives |
| Custom p-value | jstat library | Adds external dependency; t-distribution approximation is straightforward |

**Installation:**
```bash
# No new packages required - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/mcp-server/src/tools/
├── reports.ts              # Add analyze_slippage_trends tool here
└── ...

packages/lib/calculations/
├── statistical-utils.ts    # May add linear regression helpers
└── ...
```

### Pattern 1: MCP Tool Data Flow
**What:** Follow existing `analyze_discrepancies` pattern for trade matching and slippage calculation
**When to use:** Always for Phase 39 implementation
**Example:**
```typescript
// Source: packages/mcp-server/src/tools/reports.ts (analyze_discrepancies)
// 1. Load block and reporting log
const block = await loadBlock(baseDir, blockId);
const actualTrades = await loadReportingLog(baseDir, blockId);

// 2. Apply filters (strategy, date range)
// 3. Match trades by date+strategy+time
// 4. Calculate slippage per matched trade
// 5. Aggregate by time period for trend analysis
```

### Pattern 2: Time Period Aggregation
**What:** Group trades by day/week/month using existing correlation.ts patterns
**When to use:** For building time-series slippage data
**Example:**
```typescript
// Source: packages/lib/calculations/correlation.ts
function getIsoWeekKey(dateStr: string): string {
  // Returns YYYY-Www format
}

function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7); // YYYY-MM from YYYY-MM-DD
}

function aggregateByPeriod(
  dailyReturns: Record<string, number>,
  period: "daily" | "weekly" | "monthly"
): Record<string, number>
```

### Pattern 3: Statistical Confidence Reporting
**What:** Use existing RunsTest pattern for returning statistics with confidence levels
**When to use:** For reporting trend significance
**Example:**
```typescript
// Source: packages/lib/calculations/streak-analysis.ts
interface RunsTestResult {
  zScore: number;           // Standardized test statistic
  pValue: number;           // Two-tailed p-value
  isNonRandom: boolean;     // p < 0.05
  interpretation: string;   // Human-readable explanation
  sampleSize: number;
  isSufficientSample: boolean; // n >= 20 for reliable results
}
```

### Anti-Patterns to Avoid
- **Direct UI/store imports in MCP**: MCP tools must not import from stores or browser-dependent code
- **New external dependencies**: Avoid adding regression-js or jstat when simple implementations work
- **Mixing concerns**: Keep trend analysis separate from slippage attribution (Phase 37 already handles attribution)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trade matching | Custom matcher | `analyze_discrepancies` matching logic | Already handles date+strategy+time matching with minute precision |
| Scaling modes | New scaling logic | Existing `scaling` parameter | raw/perContract/toReported already implemented |
| Correlation methods | New correlation code | `pearsonCorrelation`, `kendallTau` from statistical-utils | Battle-tested, handles edge cases |
| Time aggregation | Custom date grouping | `aggregateByPeriod` from correlation.ts | Already handles daily/weekly/monthly |
| Normal CDF | Custom implementation | `normalCDF` from statistical-utils | Used by existing p-value calculations |

**Key insight:** The analyze_discrepancies tool already does 90% of the work - matching trades, calculating slippage, handling scaling. Phase 39 adds the time-series layer on top.

## Common Pitfalls

### Pitfall 1: Insufficient Data for Trend Detection
**What goes wrong:** Linear regression on 2-3 data points gives meaningless p-values
**Why it happens:** User filters down to small date range or single strategy
**How to avoid:**
- Enforce minimum 2 periods for ANY trend output
- Add warning when sample size < 10 periods
- Return `null` for statistics that can't be computed reliably
**Warning signs:** p-value always 0 or 1, R-squared always 1

### Pitfall 2: Mixing Magnitude and Direction
**What goes wrong:** Trend shows "improving" but slippage is still large negative
**Why it happens:** Only tracking direction without magnitude context
**How to avoid:**
- Track BOTH slippage magnitude (|actual - backtest|) AND directional bias (actual - backtest)
- Slope labels: negative slope = improving (slippage getting smaller/less negative)
- Include average slippage in output for context
**Warning signs:** Confusing interpretation when slippage is consistently negative

### Pitfall 3: Not Accounting for Contract Scaling
**What goes wrong:** Trends appear when contract sizing changed, not actual slippage
**Why it happens:** Raw slippage includes contract count variations
**How to avoid:**
- Default to `toReported` scaling like `analyze_discrepancies`
- Document scaling mode clearly in output
- Consider per-contract slippage for trend detection
**Warning signs:** Large trend changes coinciding with strategy sizing changes

### Pitfall 4: External Factor Correlation Without Data
**What goes wrong:** Claiming VIX correlation when VIX data is sparse
**Why it happens:** Many trades missing openingVix/closingVix fields
**How to avoid:**
- Skip correlation section entirely if factor data unavailable (per CONTEXT.md)
- Don't return nulls with explanations - just omit the section
- Require minimum samples (e.g., 10) for any correlation
**Warning signs:** N/A or null values in correlation output

## Code Examples

Verified patterns from official sources:

### Linear Regression with Statistics
```typescript
// Source: Custom implementation based on trade-sequence-chart.tsx pattern
// Note: mathjs does not have built-in regression, implement from scratch

import { mean, std } from 'mathjs';

interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  pValue: number;
  stderr: number;
  interpretation: 'improving' | 'stable' | 'degrading';
  confidence: 'high' | 'moderate' | 'low';
}

function linearRegression(x: number[], y: number[]): LinearRegressionResult {
  const n = x.length;
  if (n < 2) throw new Error('Need at least 2 points');

  // Calculate means
  const meanX = mean(x) as number;
  const meanY = mean(y) as number;

  // Calculate slope and intercept (OLS)
  let sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumXY += (x[i] - meanX) * (y[i] - meanY);
    sumX2 += (x[i] - meanX) ** 2;
  }

  const slope = sumX2 > 0 ? sumXY / sumX2 : 0;
  const intercept = meanY - slope * meanX;

  // Calculate R-squared
  const predicted = x.map(xi => slope * xi + intercept);
  const ssRes = y.reduce((sum, yi, i) => sum + (yi - predicted[i]) ** 2, 0);
  const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

  // Calculate standard error and t-statistic for p-value
  const mse = ssRes / (n - 2);
  const stderr = Math.sqrt(mse / sumX2);
  const tStat = stderr > 0 ? slope / stderr : 0;

  // Two-tailed p-value using t-distribution approximation via normal
  // For large n, t converges to normal
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));

  // Interpretation
  const isSignificant = pValue < 0.05;
  let interpretation: 'improving' | 'stable' | 'degrading';
  if (!isSignificant) {
    interpretation = 'stable';
  } else if (slope < 0) {
    interpretation = 'improving'; // Slippage decreasing
  } else {
    interpretation = 'degrading'; // Slippage increasing
  }

  return {
    slope,
    intercept,
    rSquared,
    pValue,
    stderr,
    interpretation,
    confidence: n >= 30 ? 'high' : n >= 10 ? 'moderate' : 'low'
  };
}
```

### Time Series Aggregation
```typescript
// Source: Based on packages/lib/calculations/correlation.ts

interface PeriodSlippage {
  period: string;           // YYYY-MM-DD, YYYY-Www, or YYYY-MM
  totalSlippage: number;    // Sum of slippage in period
  avgSlippage: number;      // Mean slippage
  tradeCount: number;       // Number of matched trades
  avgMagnitude: number;     // Mean |slippage|
  positiveRate: number;     // % of trades with positive slippage
}

function aggregateSlippageByPeriod(
  matchedTrades: MatchedTradeData[],
  granularity: 'daily' | 'weekly' | 'monthly'
): PeriodSlippage[] {
  // Group by period key
  const byPeriod = new Map<string, MatchedTradeData[]>();

  for (const trade of matchedTrades) {
    const periodKey = granularity === 'daily'
      ? trade.date
      : granularity === 'weekly'
      ? getIsoWeekKey(trade.date)
      : getMonthKey(trade.date);

    const existing = byPeriod.get(periodKey) ?? [];
    existing.push(trade);
    byPeriod.set(periodKey, existing);
  }

  // Calculate stats per period
  return Array.from(byPeriod.entries())
    .map(([period, trades]) => ({
      period,
      totalSlippage: trades.reduce((sum, t) => sum + t.totalSlippage, 0),
      avgSlippage: trades.reduce((sum, t) => sum + t.totalSlippage, 0) / trades.length,
      tradeCount: trades.length,
      avgMagnitude: trades.reduce((sum, t) => sum + Math.abs(t.totalSlippage), 0) / trades.length,
      positiveRate: trades.filter(t => t.totalSlippage > 0).length / trades.length
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}
```

### External Factor Correlation Pattern
```typescript
// Source: Based on analyze_discrepancies pattern

interface FactorCorrelation {
  factor: string;
  coefficient: number;
  interpretation: 'strong positive' | 'moderate positive' | 'weak positive' |
                  'negligible' | 'weak negative' | 'moderate negative' | 'strong negative';
  sampleSize: number;
}

function correlateSlippageWithFactors(
  matchedTrades: MatchedTradeData[],
  correlationMethod: 'pearson' | 'kendall',
  minSamples: number = 10
): FactorCorrelation[] | null {
  const results: FactorCorrelation[] = [];

  const factors = [
    { name: 'openingVix', getValue: (t: MatchedTradeData) => t.openingVix },
    { name: 'hourOfDay', getValue: (t: MatchedTradeData) => t.hourOfDay },
    // Add other factors as data allows
  ];

  for (const { name, getValue } of factors) {
    const pairs = matchedTrades
      .filter(t => getValue(t) !== undefined && getValue(t) !== null)
      .map(t => ({ slippage: t.totalSlippage, factor: getValue(t)! }));

    if (pairs.length < minSamples) continue;

    const slippages = pairs.map(p => p.slippage);
    const factorValues = pairs.map(p => p.factor);

    const coefficient = correlationMethod === 'pearson'
      ? pearsonCorrelation(slippages, factorValues)
      : kendallTau(slippages, factorValues);

    // Only include if meaningful (|r| >= 0.2)
    if (Math.abs(coefficient) < 0.2) continue;

    results.push({
      factor: name,
      coefficient,
      interpretation: getCorrelationInterpretation(coefficient),
      sampleSize: pairs.length
    });
  }

  // Return null if no correlations found (per CONTEXT.md)
  return results.length > 0 ? results : null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| First vs Last period comparison | Linear regression over all periods | Phase 39 | More robust trend detection with statistical significance |
| Single granularity | Configurable daily/weekly/monthly | Phase 39 | AI can choose appropriate granularity |
| Pearson only | Kendall or Pearson choice | Phase 37 | Better for non-normal distributions |

**Deprecated/outdated:**
- Simple "is slippage better now?" comparison: Replaced with proper statistical trend analysis

## Open Questions

Things that couldn't be fully resolved:

1. **t-distribution vs normal approximation for p-value**
   - What we know: For n >= 30, t-distribution approximates normal well
   - What's unclear: Should we implement proper t-distribution for small samples?
   - Recommendation: Use normal approximation (existing normalCDF) with clear confidence level warnings for small samples. Sufficient for AI interpretation.

2. **VIX data availability**
   - What we know: Trade data may or may not have openingVix/closingVix populated
   - What's unclear: What % of real user data has VIX fields?
   - Recommendation: Skip external factors section entirely if insufficient data (per CONTEXT.md decision)

3. **Rolling vs Fixed Calendar Periods**
   - What we know: CONTEXT.md says provide BOTH rolling windows AND fixed calendar periods
   - What's unclear: Exact parameters for rolling windows (7-day? 30-day?)
   - Recommendation: Claude's discretion per CONTEXT.md. Suggest: fixed calendar (daily/weekly/monthly) plus optional 7/14/30-day rolling windows as parameter.

## Sources

### Primary (HIGH confidence)
- `packages/mcp-server/src/tools/reports.ts` - analyze_discrepancies implementation
- `packages/lib/calculations/statistical-utils.ts` - normalCDF, Kendall tau, Pearson correlation
- `packages/lib/calculations/correlation.ts` - time period aggregation, correlation matrix
- `packages/lib/calculations/streak-analysis.ts` - p-value calculation pattern (runs test)
- `components/performance-charts/trade-sequence-chart.tsx` - linear regression pattern

### Secondary (MEDIUM confidence)
- [W3Schools Linear Regression P-Value](https://www.w3schools.com/datascience/ds_linear_regression_pvalue.asp) - P-value interpretation
- [Statistics By Jim R-squared](https://statisticsbyjim.com/regression/interpret-r-squared-regression/) - R-squared interpretation

### Tertiary (LOW confidence)
- [regression-js GitHub](https://github.com/Tom-Alexander/regression-js) - Alternative library (not recommended)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use
- Architecture: HIGH - Following existing MCP tool patterns exactly
- Statistical methods: MEDIUM - Linear regression well-understood, but t-distribution approximation is pragmatic choice
- Pitfalls: HIGH - Based on actual codebase patterns and Phase 37 experience

**Research date:** 2026-02-01
**Valid until:** 60 days (stable statistical methods, existing infrastructure)
