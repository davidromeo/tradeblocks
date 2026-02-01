# Phase 36: Enhanced Comparison - Research

**Researched:** 2026-01-31
**Domain:** MCP Tool Enhancement (Statistical Comparison & Grouping)
**Confidence:** HIGH

## Summary

This phase enhances the existing `compare_backtest_to_actual` MCP tool with three capabilities: (1) trade-level detail comparison with field-by-field differences, (2) statistical outlier detection using z-score methodology, and (3) flexible grouping by strategy or date.

The codebase already has established patterns for all required functionality:
- math.js with `mean()` and `std()` for statistical calculations
- Z-score calculation pattern from `streak-analysis.ts`
- GroupBy patterns from `reports.ts` (bucket aggregation) and `block-loader.ts` (byStrategy structure)
- `createToolOutput()` for JSON-first MCP responses

**Primary recommendation:** Extend the existing tool with new parameters (`detailLevel`, `outliersOnly`, `outliersThreshold`, `groupBy`) while preserving backward compatibility with current behavior as defaults.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| math.js | (existing) | Statistical calculations | Already used codebase-wide for mean, std, consistent with numpy |
| zod | (existing) | Input schema validation | Already used in all MCP tools |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tradeblocks/lib | workspace | Trade/ReportingTrade models | Already imported in performance.ts |

### No New Dependencies

All functionality uses existing libraries. math.js provides `mean()` and `std()` already imported in the lib package.

## Architecture Patterns

### Current Tool Structure (lines 1781-2141 of performance.ts)

The existing tool already:
1. Loads both backtest trades and reporting log trades
2. Applies strategy and date range filters
3. Groups by `date|strategy` key (day-level aggregation)
4. Calculates scaled P&L and slippage
5. Returns summary stats + comparisons array

### Pattern 1: Extend Input Schema Additively

**What:** Add new optional parameters with defaults that preserve existing behavior
**When to use:** Enhancing existing tools without breaking current callers

```typescript
// Source: existing pattern in performance.ts
inputSchema: z.object({
  // ... existing params
  detailLevel: z
    .enum(["summary", "trades"])
    .default("summary")
    .describe("'summary' (default): aggregate by date+strategy. 'trades': individual trade comparison"),
  outliersOnly: z
    .boolean()
    .default(false)
    .describe("Only return high-slippage outliers (>2 std from mean)"),
  outliersThreshold: z
    .number()
    .default(2)
    .describe("Z-score threshold for outlier detection (default: 2 = ~95% confidence)"),
  groupBy: z
    .enum(["none", "strategy", "date", "week", "month"])
    .default("none")
    .describe("Group results: 'none' (flat list), 'strategy', 'date', 'week', 'month'"),
})
```

### Pattern 2: Z-Score Outlier Detection

**What:** Use standard deviation-based outlier flagging
**When to use:** Identifying unusual slippage values that need investigation

```typescript
// Source: streak-analysis.ts pattern (lines 84-89)
import { mean, std } from 'mathjs'

function detectOutliers(slippages: number[], threshold: number = 2): {
  mean: number
  stdDev: number
  outliers: Array<{ value: number; zScore: number; severity: 'low' | 'medium' | 'high' }>
} {
  const meanSlippage = mean(slippages) as number
  const stdDev = std(slippages, 'uncorrected') as number  // Sample std (N-1)

  // Calculate z-scores and classify severity
  return slippages.map(value => {
    const zScore = stdDev > 0 ? (value - meanSlippage) / stdDev : 0
    const absZ = Math.abs(zScore)

    return {
      value,
      zScore,
      isOutlier: absZ >= threshold,
      severity: absZ >= 3 ? 'high' : absZ >= 2 ? 'medium' : 'low'
    }
  })
}
```

### Pattern 3: Grouping with Aggregation

**What:** Group comparisons and calculate aggregate stats per group
**When to use:** When groupBy parameter is set

```typescript
// Source: block-loader.ts byStrategy pattern (lines 1096-1149)
interface GroupedResult {
  groupKey: string
  count: number
  matchedCount: number
  totalSlippage: number
  avgSlippage: number
  outlierCount: number
  comparisons: DetailedComparison[]  // Individual trades in group
}

function groupComparisons(
  comparisons: DetailedComparison[],
  groupBy: 'strategy' | 'date' | 'week' | 'month'
): GroupedResult[] {
  const groups = new Map<string, DetailedComparison[]>()

  for (const comp of comparisons) {
    const key = getGroupKey(comp, groupBy)
    const existing = groups.get(key) ?? []
    existing.push(comp)
    groups.set(key, existing)
  }

  return Array.from(groups.entries()).map(([groupKey, items]) => ({
    groupKey,
    count: items.length,
    matchedCount: items.filter(c => c.matched).length,
    totalSlippage: items.reduce((sum, c) => sum + c.slippage, 0),
    avgSlippage: items.length > 0 ? items.reduce((sum, c) => sum + c.slippage, 0) / items.length : 0,
    outlierCount: items.filter(c => c.isOutlier).length,
    comparisons: items
  }))
}
```

### Pattern 4: Trade-Level Detail Comparison

**What:** Match individual trades (not day aggregates) and compare field-by-field
**When to use:** When detailLevel='trades'

```typescript
// Individual trade matching key
const tradeKey = `${formatDateKey(trade.dateOpened)}|${trade.strategy}|${trade.timeOpened}`

interface DetailedComparison {
  // Matching info
  date: string
  strategy: string
  timeOpened: string
  matched: boolean

  // Core P&L
  backtestPl: number
  actualPl: number
  scaledBacktestPl: number
  slippage: number
  slippagePercent: number | null

  // Contract info
  backtestContracts: number
  actualContracts: number
  scalingFactor: number

  // Field differences (only include if different)
  differences: {
    field: string
    backtest: number | string | null
    actual: number | string | null
    delta?: number
  }[]

  // Outlier detection
  isOutlier: boolean
  outlierSeverity?: 'low' | 'medium' | 'high'
  zScore?: number

  // Context (from backtest trade)
  context?: {
    openingVix?: number
    closingVix?: number
    gap?: number
    movement?: number
    reasonForClose?: string
  }
}
```

### Anti-Patterns to Avoid
- **Breaking existing callers:** Adding required parameters or changing default behavior would break existing workflows. All new params must have sensible defaults.
- **N+1 filtering:** Don't filter outliers by re-iterating. Flag inline during comparison, filter once at the end.
- **Memory explosion:** When `detailLevel='trades'` with large datasets, ensure response doesn't include redundant nested data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mean/std calculation | Manual reduce loops | `mean()`, `std()` from mathjs | Consistent with codebase, handles edge cases |
| Z-score threshold | Custom percentile logic | Standard z-score formula | Well-understood, configurable threshold |
| Date key formatting | Custom date string logic | `formatDateKey()` already in codebase | Consistent date handling across MCP |
| Tool output structure | Custom JSON formatting | `createToolOutput()` from output-formatter.ts | Standard pattern for all MCP tools |

## Common Pitfalls

### Pitfall 1: Breaking Backward Compatibility
**What goes wrong:** New parameters change default behavior, breaking existing callers
**Why it happens:** Developer forgets to add sensible defaults
**How to avoid:** All new params use `.default()` and existing behavior is the default
**Warning signs:** Test existing call patterns before and after changes

### Pitfall 2: Z-Score on Small Samples
**What goes wrong:** Z-score is meaningless with <3 data points
**Why it happens:** Standard deviation approaches zero, z-scores explode
**How to avoid:** Check `slippages.length >= 3` before computing, return null/skip outlier detection otherwise
**Warning signs:** Infinite or NaN z-scores in output

### Pitfall 3: Time Matching Precision
**What goes wrong:** Backtest time "09:34:00" vs actual time "09:34:06.5809432" don't match
**Why it happens:** Actual trades have sub-second precision from live execution
**How to avoid:** For trade-level matching, use date+strategy first, then try time rounded to minute
**Warning signs:** Many unmatched trades that should match by date+strategy

### Pitfall 4: Scaling Factor Division by Zero
**What goes wrong:** `actualContracts / backtestContracts` fails when backtestContracts=0
**Why it happens:** Edge case of unmatched trades or zero-contract positions
**How to avoid:** Guard with `if (btContracts > 0)` before division
**Warning signs:** NaN or Infinity in scalingFactor field

### Pitfall 5: Grouping Key Consistency
**What goes wrong:** Week/month grouping uses inconsistent date logic
**Why it happens:** JavaScript Date edge cases with week numbers
**How to avoid:** Use `getISOWeekNumber()` from reports.ts for week grouping
**Warning signs:** Trades appearing in wrong week groups at year boundaries

## Code Examples

### Z-Score Calculation with Severity Levels

```typescript
// Source: streak-analysis.ts pattern + project conventions
import { mean, std } from 'mathjs'

interface OutlierStats {
  meanSlippage: number
  stdDevSlippage: number
  threshold: number
  outlierCount: number
  outlierPercent: number
  outlierTotalSlippage: number
  outlierAvgSlippage: number
}

function calculateOutlierStats(
  comparisons: Array<{ slippage: number; matched: boolean }>,
  threshold: number = 2
): OutlierStats | null {
  // Only use matched comparisons for slippage analysis
  const matchedSlippages = comparisons
    .filter(c => c.matched)
    .map(c => c.slippage)

  if (matchedSlippages.length < 3) {
    return null  // Insufficient data for meaningful outlier detection
  }

  const meanSlippage = mean(matchedSlippages) as number
  const stdDevSlippage = std(matchedSlippages, 'uncorrected') as number

  // Avoid division by zero
  if (stdDevSlippage < 1e-10) {
    return null  // All values essentially the same
  }

  const outliers = matchedSlippages.filter(s => {
    const zScore = Math.abs((s - meanSlippage) / stdDevSlippage)
    return zScore >= threshold
  })

  return {
    meanSlippage,
    stdDevSlippage,
    threshold,
    outlierCount: outliers.length,
    outlierPercent: (outliers.length / matchedSlippages.length) * 100,
    outlierTotalSlippage: outliers.reduce((sum, s) => sum + s, 0),
    outlierAvgSlippage: outliers.length > 0 ? outliers.reduce((sum, s) => sum + s, 0) / outliers.length : 0
  }
}
```

### Week/Month Grouping Keys

```typescript
// Source: reports.ts getISOWeekNumber pattern
function getGroupKey(date: Date, groupBy: 'date' | 'week' | 'month'): string {
  switch (groupBy) {
    case 'date':
      return formatDateKey(date)  // "2026-01-30"
    case 'week':
      const year = date.getFullYear()
      const week = getISOWeekNumber(date)
      return `${year}-W${String(week).padStart(2, '0')}`  // "2026-W05"
    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`  // "2026-01"
    default:
      return 'all'
  }
}

// From reports.ts (line 105-112)
function getISOWeekNumber(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayNum = d.getDay() || 7
  d.setDate(d.getDate() + 4 - dayNum)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return weekNo
}
```

### Field Difference Detection

```typescript
// Compare backtest Trade to ReportingTrade field by field
interface FieldDifference {
  field: string
  backtest: number | string | null
  actual: number | string | null
  delta?: number  // Only for numeric fields
  significant: boolean  // Flag meaningful differences
}

function compareTradeFields(
  backtest: Trade,
  actual: ReportingTrade
): FieldDifference[] {
  const differences: FieldDifference[] = []

  // Contract count
  if (backtest.numContracts !== actual.numContracts) {
    differences.push({
      field: 'numContracts',
      backtest: backtest.numContracts,
      actual: actual.numContracts,
      delta: actual.numContracts - backtest.numContracts,
      significant: true
    })
  }

  // Opening price
  if (Math.abs(backtest.openingPrice - actual.openingPrice) > 0.01) {
    differences.push({
      field: 'openingPrice',
      backtest: backtest.openingPrice,
      actual: actual.openingPrice,
      delta: actual.openingPrice - backtest.openingPrice,
      significant: Math.abs(actual.openingPrice - backtest.openingPrice) > 1
    })
  }

  // Closing price (if both have it)
  if (backtest.closingPrice !== undefined && actual.closingPrice !== undefined) {
    if (Math.abs(backtest.closingPrice - actual.closingPrice) > 0.01) {
      differences.push({
        field: 'closingPrice',
        backtest: backtest.closingPrice,
        actual: actual.closingPrice,
        delta: actual.closingPrice - backtest.closingPrice,
        significant: Math.abs(actual.closingPrice - backtest.closingPrice) > 1
      })
    }
  }

  // Reason for close
  if (backtest.reasonForClose !== actual.reasonForClose) {
    differences.push({
      field: 'reasonForClose',
      backtest: backtest.reasonForClose ?? null,
      actual: actual.reasonForClose ?? null,
      significant: true
    })
  }

  return differences
}
```

### Response Structure Pattern

```typescript
// Source: existing compare_backtest_to_actual output pattern
const structuredData = {
  blockId,
  filters: {
    strategy: strategy ?? null,
    dateRange: dateRange ?? null,
    scaling,
    matchedOnly,
    detailLevel,
    groupBy: groupBy ?? 'none',
    outliersOnly,
    outliersThreshold
  },
  summary: {
    totalComparisons: comparisons.length,
    matchedComparisons: matchedCount,
    totalSlippage,
    avgSlippage,
    avgSlippagePercent,
    // New: outlier summary
    outlierStats: outlierStats ?? null  // null if insufficient data
  },
  // Conditional: either flat list or grouped
  ...(groupBy === 'none'
    ? { comparisons }  // Flat list of comparisons
    : { groups }       // Grouped results with nested comparisons
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Day-level aggregation only | Support individual trade comparison | This phase | More granular discrepancy analysis |
| No outlier detection | Z-score based outlier flagging | This phase | Auto-surface high-slippage trades |
| Flat comparison list | Optional grouping by strategy/date | This phase | Better organized analysis |

## Open Questions

1. **Time Matching Granularity**
   - What we know: Backtest has second precision (HH:mm:ss), actual has sub-second (HH:mm:ss.SSSSSSS)
   - What's unclear: Should we match to minute, second, or use fallback matching?
   - Recommendation: Match by date+strategy first (current behavior), add time comparison as metadata difference, not as matching key. The existing day+strategy matching is proven to work.

2. **Large Dataset Performance**
   - What we know: Tool already handles thousands of trades in current implementation
   - What's unclear: Will trade-level comparison with full field diff significantly slow down?
   - Recommendation: Implement and test with sample data (`~/backtests/main-port-2026-ytd/`). The dataset is ~200 trades which should be fast. Add pagination if needed in future phase.

## Sources

### Primary (HIGH confidence)
- `/Users/davidromeo/Code/tradeblocks/packages/mcp-server/src/tools/performance.ts` (lines 1781-2141) - Current compare_backtest_to_actual implementation
- `/Users/davidromeo/Code/tradeblocks/packages/lib/calculations/streak-analysis.ts` - Z-score and statistical pattern
- `/Users/davidromeo/Code/tradeblocks/packages/mcp-server/src/tools/reports.ts` - GroupBy and aggregation patterns
- `/Users/davidromeo/Code/tradeblocks/packages/lib/models/trade.ts` - Backtest Trade interface
- `/Users/davidromeo/Code/tradeblocks/packages/lib/models/reporting-trade.ts` - ReportingTrade interface
- `/Users/davidromeo/Code/tradeblocks/packages/mcp-server/src/utils/output-formatter.ts` - createToolOutput pattern

### Secondary (MEDIUM confidence)
- Sample data at `~/backtests/main-port-2026-ytd/` - Real trade data for testing
- CONTEXT.md decisions - User delegated implementation choices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing codebase libraries (math.js, zod)
- Architecture: HIGH - Extends existing patterns from performance.ts, reports.ts, streak-analysis.ts
- Pitfalls: HIGH - Based on actual codebase edge cases and existing implementations

**Research date:** 2026-01-31
**Valid until:** 60 days (stable codebase patterns, no external dependencies)
