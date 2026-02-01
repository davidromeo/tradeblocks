# Phase 37: Discrepancy Analysis - Research

**Researched:** 2026-01-31
**Domain:** MCP Tool Development (Slippage Classification & Pattern Detection)
**Confidence:** HIGH

## Summary

This phase adds analytical capabilities on top of Phase 36's trade-level comparison. The goal is to help Claude classify slippage sources, identify systematic patterns, and correlate slippage with market conditions - all surfaced as insights for user interpretation, not as judgments or recommendations.

The codebase has established patterns for all required functionality:
- `DetailedComparison` interface from Phase 36 provides the data foundation (date, strategy, slippage, field differences, VIX/gap/movement context)
- `pearsonCorrelation()` and `kendallTau()` from `statistical-utils.ts` for market correlations
- `aggregate_by_field` pattern from `reports.ts` for bucket analysis
- `createToolOutput()` for JSON-first MCP responses

**Primary recommendation:** Create one or two new MCP tools that consume Phase 36's comparison data to provide slippage attribution, pattern detection, and market correlation analysis. The tools should surface patterns without assigning risk levels or making recommendations.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| math.js | (existing) | Statistical calculations | Already used for mean, std throughout codebase |
| zod | (existing) | Input schema validation | Already used in all MCP tools |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tradeblocks/lib | workspace | Trade models, correlation utils | Already imported in all MCP tools |
| statistical-utils.ts | workspace | pearsonCorrelation, kendallTau, getRanks | Available for correlation calculations |

### No New Dependencies

All functionality uses existing libraries. The `statistical-utils.ts` module provides correlation functions (`pearsonCorrelation`, `kendallTau`) already used by correlation analysis tools.

## Architecture Patterns

### Pattern 1: Slippage Attribution

**What:** Decompose total slippage into component sources based on field differences
**When to use:** When providing slippage category breakdown

The attribution logic uses available fields from `DetailedComparison`:

```typescript
// Source: Phase 36 DetailedComparison has field differences
interface SlippageAttribution {
  // Trade identification
  date: string
  strategy: string
  timeOpened: string
  totalSlippage: number

  // Attribution breakdown (in dollars)
  entryPriceSlippage: number    // (actual.openingPrice - bt.openingPrice) * contracts
  exitPriceSlippage: number     // (actual.closingPrice - bt.closingPrice) * contracts
  sizeSlippage: number          // P&L difference attributable to contract count difference
  timingSlippage: number        // Difference when reasonForClose differs
  unexplainedResidual: number   // Remaining slippage after attribution

  // Context for correlation
  openingVix?: number
  closingVix?: number
  gap?: number
  movement?: number
  hourOfDay: number             // Parsed from timeOpened
}

function attributeSlippage(
  comparison: DetailedComparison,
  btTrade: Trade,
  actualTrade: ReportingTrade
): SlippageAttribution {
  const contracts = actualTrade.numContracts  // Use actual contracts as basis

  // Entry price attribution
  const entryDelta = comparison.differences.find(d => d.field === 'openingPrice')?.delta ?? 0
  const entryPriceSlippage = entryDelta * contracts * 100  // Price * 100 for options

  // Exit price attribution
  const exitDelta = comparison.differences.find(d => d.field === 'closingPrice')?.delta ?? 0
  const exitPriceSlippage = exitDelta * contracts * 100

  // Size attribution: difference in P&L due to contract count
  // If bt had 10 contracts at $50 P/L each, actual had 1 contract
  // Size slippage = -$450 (loss due to fewer contracts)
  const btContracts = comparison.backtestContracts
  const actualContracts = comparison.actualContracts
  const perContractPl = btContracts > 0 ? comparison.backtestPl / btContracts : 0
  const sizeSlippage = (actualContracts - btContracts) * perContractPl

  // Timing attribution: flag when reasonForClose differs
  const hasTimingDiff = comparison.differences.some(d => d.field === 'reasonForClose')
  const timingSlippage = hasTimingDiff ? /* TBD: how to quantify */ 0 : 0

  // Residual
  const explained = entryPriceSlippage + exitPriceSlippage + sizeSlippage + timingSlippage
  const unexplainedResidual = comparison.slippage - explained

  return {
    date: comparison.date,
    strategy: comparison.strategy,
    timeOpened: comparison.timeOpened,
    totalSlippage: comparison.slippage,
    entryPriceSlippage,
    exitPriceSlippage,
    sizeSlippage,
    timingSlippage,
    unexplainedResidual,
    openingVix: comparison.context?.openingVix,
    closingVix: comparison.context?.closingVix,
    gap: comparison.context?.gap,
    movement: comparison.context?.movement,
    hourOfDay: parseHourFromTime(comparison.timeOpened)
  }
}
```

### Pattern 2: Pattern Detection

**What:** Identify systematic patterns across multiple comparisons
**When to use:** When analyzing strategy-level or portfolio-level patterns

```typescript
// Source: find_predictive_fields pattern from reports.ts
interface PatternDetection {
  pattern: string
  description: string
  evidence: {
    metric: string
    value: number
    sampleSize: number
    significance?: 'strong' | 'moderate' | 'weak'
  }
}

// Pattern types based on CONTEXT.md decisions:
// 1. Direction bias - consistent positive or negative slippage
function detectDirectionBias(attributions: SlippageAttribution[]): PatternDetection | null {
  const slippages = attributions.map(a => a.totalSlippage)
  if (slippages.length < 10) return null

  const mean = slippages.reduce((a, b) => a + b, 0) / slippages.length
  const positiveCount = slippages.filter(s => s > 0).length
  const negativeCount = slippages.filter(s => s < 0).length

  // Check if skew is significant (>70% in one direction)
  const positiveRate = positiveCount / slippages.length
  const hasDirectionBias = positiveRate > 0.7 || positiveRate < 0.3

  if (!hasDirectionBias) return null

  return {
    pattern: 'direction_bias',
    description: positiveRate > 0.5
      ? `${Math.round(positiveRate * 100)}% of trades have positive slippage (actual > backtest)`
      : `${Math.round((1 - positiveRate) * 100)}% of trades have negative slippage (actual < backtest)`,
    evidence: {
      metric: 'direction_skew',
      value: positiveRate,
      sampleSize: slippages.length,
      significance: positiveRate > 0.8 || positiveRate < 0.2 ? 'strong' : 'moderate'
    }
  }
}

// 2. Category concentration - majority of slippage in one category
function detectCategoryConcentration(attributions: SlippageAttribution[]): PatternDetection | null {
  const totalAbsSlippage = attributions.reduce((sum, a) => sum + Math.abs(a.totalSlippage), 0)
  if (totalAbsSlippage === 0) return null

  const categories = [
    { name: 'entry_price', total: attributions.reduce((s, a) => s + Math.abs(a.entryPriceSlippage), 0) },
    { name: 'exit_price', total: attributions.reduce((s, a) => s + Math.abs(a.exitPriceSlippage), 0) },
    { name: 'size', total: attributions.reduce((s, a) => s + Math.abs(a.sizeSlippage), 0) },
    { name: 'unexplained', total: attributions.reduce((s, a) => s + Math.abs(a.unexplainedResidual), 0) }
  ]

  const dominant = categories.reduce((max, c) => c.total > max.total ? c : max)
  const dominantPercent = dominant.total / totalAbsSlippage

  if (dominantPercent < 0.5) return null  // No dominant category

  return {
    pattern: 'category_concentration',
    description: `${Math.round(dominantPercent * 100)}% of slippage attributed to ${dominant.name.replace('_', ' ')}`,
    evidence: {
      metric: 'dominant_category_percent',
      value: dominantPercent,
      sampleSize: attributions.length,
      significance: dominantPercent > 0.7 ? 'strong' : 'moderate'
    }
  }
}
```

### Pattern 3: Market Correlation Analysis

**What:** Correlate slippage with available numeric fields
**When to use:** When analyzing slippage drivers

```typescript
// Source: find_predictive_fields and correlation.ts patterns
import { pearsonCorrelation, kendallTau } from '@tradeblocks/lib'

interface CorrelationResult {
  field: string
  coefficient: number
  method: 'pearson' | 'kendall'
  sampleSize: number
  interpretation: 'strong' | 'moderate' | 'weak' | 'negligible'
  direction: 'positive' | 'negative'
}

function correlateSlippageWithField(
  attributions: SlippageAttribution[],
  fieldName: keyof SlippageAttribution,
  method: 'pearson' | 'kendall' = 'pearson'
): CorrelationResult | null {
  // Extract valid pairs
  const pairs: Array<{ slippage: number; field: number }> = []

  for (const attr of attributions) {
    const fieldValue = attr[fieldName]
    if (typeof fieldValue === 'number' && isFinite(fieldValue)) {
      pairs.push({ slippage: attr.totalSlippage, field: fieldValue })
    }
  }

  if (pairs.length < 10) return null  // Insufficient data

  const slippages = pairs.map(p => p.slippage)
  const fieldValues = pairs.map(p => p.field)

  const coefficient = method === 'pearson'
    ? pearsonCorrelation(slippages, fieldValues)
    : kendallTau(slippages, fieldValues)

  const absCoeff = Math.abs(coefficient)
  const interpretation = absCoeff >= 0.7 ? 'strong'
    : absCoeff >= 0.4 ? 'moderate'
    : absCoeff >= 0.2 ? 'weak'
    : 'negligible'

  return {
    field: fieldName,
    coefficient: Math.round(coefficient * 10000) / 10000,
    method,
    sampleSize: pairs.length,
    interpretation,
    direction: coefficient >= 0 ? 'positive' : 'negative'
  }
}

// Correlate with all available market fields
function analyzeMarketCorrelations(
  attributions: SlippageAttribution[],
  method: 'pearson' | 'kendall' = 'pearson'
): CorrelationResult[] {
  const fields: (keyof SlippageAttribution)[] = [
    'openingVix',
    'closingVix',
    'gap',
    'movement',
    'hourOfDay'
  ]

  return fields
    .map(field => correlateSlippageWithField(attributions, field, method))
    .filter((r): r is CorrelationResult => r !== null)
    .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
}
```

### Pattern 4: Per-Strategy Breakdown

**What:** Group analysis by strategy name
**When to use:** When providing strategy-level insights

```typescript
// Source: aggregate_by_field pattern from reports.ts
interface StrategyAnalysis {
  strategy: string
  tradeCount: number
  totalSlippage: number
  avgSlippage: number
  slippageStdDev: number

  // Attribution breakdown (totals for this strategy)
  totalEntrySlippage: number
  totalExitSlippage: number
  totalSizeSlippage: number
  totalUnexplained: number

  // Detected patterns for this strategy
  patterns: PatternDetection[]

  // Market correlations for this strategy
  correlations: CorrelationResult[]
}

function analyzeByStrategy(
  attributions: SlippageAttribution[]
): Map<string, StrategyAnalysis> {
  // Group by strategy
  const byStrategy = new Map<string, SlippageAttribution[]>()

  for (const attr of attributions) {
    const existing = byStrategy.get(attr.strategy) ?? []
    existing.push(attr)
    byStrategy.set(attr.strategy, existing)
  }

  const results = new Map<string, StrategyAnalysis>()

  for (const [strategy, attrs] of byStrategy) {
    const slippages = attrs.map(a => a.totalSlippage)
    const mean = slippages.reduce((a, b) => a + b, 0) / slippages.length
    const variance = slippages.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / slippages.length

    results.set(strategy, {
      strategy,
      tradeCount: attrs.length,
      totalSlippage: slippages.reduce((a, b) => a + b, 0),
      avgSlippage: mean,
      slippageStdDev: Math.sqrt(variance),
      totalEntrySlippage: attrs.reduce((s, a) => s + a.entryPriceSlippage, 0),
      totalExitSlippage: attrs.reduce((s, a) => s + a.exitPriceSlippage, 0),
      totalSizeSlippage: attrs.reduce((s, a) => s + a.sizeSlippage, 0),
      totalUnexplained: attrs.reduce((s, a) => s + a.unexplainedResidual, 0),
      patterns: [
        detectDirectionBias(attrs),
        detectCategoryConcentration(attrs)
      ].filter((p): p is PatternDetection => p !== null),
      correlations: analyzeMarketCorrelations(attrs)
    })
  }

  return results
}
```

### Anti-Patterns to Avoid

- **Making decisions for the user:** Tools should surface patterns and data, not assign risk levels or make recommendations. Use neutral language.
- **Redundant data loading:** The analysis tools should consume Phase 36's comparison data directly, not re-load and re-compare trades.
- **Over-engineering attribution:** The attribution method should be simple and transparent. Complex pro-rata allocation is unnecessary when the goal is insight, not precision.
- **Threshold hardcoding:** Use configurable thresholds (pattern significance, minimum samples) to allow Claude flexibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Correlation calculation | Manual covariance loops | `pearsonCorrelation()`, `kendallTau()` from statistical-utils.ts | Battle-tested, handles edge cases |
| Statistical mean/std | Custom reduce loops | `mean()`, `std()` from mathjs | Consistent with codebase |
| Time parsing | Regex on time strings | Simple split on ':' for hour extraction | Sufficient for hour-of-day analysis |
| Output formatting | Custom JSON structure | `createToolOutput()` | Standard MCP pattern |

## Common Pitfalls

### Pitfall 1: Over-attributing Slippage
**What goes wrong:** Attribution categories don't sum to total slippage due to interaction effects
**Why it happens:** Entry/exit price slippage depends on contract count, creating circular dependencies
**How to avoid:** Use sequential attribution (entry first, then exit, then size, then residual) and always include "unexplained residual" category
**Warning signs:** Attribution totals consistently exceed or fall short of total slippage

### Pitfall 2: Spurious Correlations with Small Samples
**What goes wrong:** High correlation coefficients from 5-10 data points appear significant
**Why it happens:** Small samples have high variance in correlation estimates
**How to avoid:** Require minimum 10 samples for correlation, 30+ for "strong" designation. Flag sample size prominently.
**Warning signs:** "Strong" correlations with n < 20

### Pitfall 3: Missing VIX Data Skewing Analysis
**What goes wrong:** VIX correlation based on subset of trades (those with VIX data)
**Why it happens:** Not all backtest trades have openingVix/closingVix populated
**How to avoid:** Report sample size separately for each correlation, note when it differs from total trades
**Warning signs:** VIX correlation sample size << total trade count

### Pitfall 4: Hour-of-Day Parsing Failures
**What goes wrong:** timeOpened values in unexpected format cause parsing errors
**Why it happens:** Time format varies ("09:34:00" vs "9:34" vs empty string)
**How to avoid:** Defensive parsing with fallback to null, exclude from correlation if unparseable
**Warning signs:** NaN or undefined hourOfDay values

### Pitfall 5: Timing Slippage Over-attribution
**What goes wrong:** Attributing large amounts to "timing" when reasonForClose differs
**Why it happens:** Different close reasons don't directly quantify P&L impact
**How to avoid:** For this phase, flag timing differences in patterns but don't attempt dollar attribution. Mark timingSlippage = 0 with note.
**Warning signs:** Timing category dominates attribution without clear methodology

## Code Examples

### Tool Input Schema

```typescript
// Source: existing MCP tool patterns
inputSchema: z.object({
  blockId: z.string().describe("Block folder name"),
  strategy: z
    .string()
    .optional()
    .describe("Filter to specific strategy name"),
  dateRange: z
    .object({
      from: z.string().optional().describe("Start date YYYY-MM-DD"),
      to: z.string().optional().describe("End date YYYY-MM-DD"),
    })
    .optional()
    .describe("Filter trades to date range"),
  scaling: z
    .enum(["raw", "perContract", "toReported"])
    .default("toReported")
    .describe("Scaling mode for P&L comparison (default: toReported)"),
  correlationMethod: z
    .enum(["pearson", "kendall"])
    .default("pearson")
    .describe("Correlation method: 'pearson' (linear) or 'kendall' (rank-based, robust)"),
  minSamples: z
    .number()
    .min(5)
    .default(10)
    .describe("Minimum samples required for correlation (default: 10)"),
  patternThreshold: z
    .number()
    .min(0.5)
    .max(0.95)
    .default(0.7)
    .describe("Threshold for pattern detection (default: 0.7 = 70%)"),
  includePerStrategy: z
    .boolean()
    .default(true)
    .describe("Include per-strategy breakdown (default: true)"),
})
```

### Response Structure

```typescript
// Source: createToolOutput pattern
const structuredData = {
  blockId,
  filters: {
    strategy: strategy ?? null,
    dateRange: dateRange ?? null,
    scaling,
    correlationMethod,
    minSamples,
    patternThreshold,
  },

  // Portfolio-wide summary
  portfolio: {
    tradeCount: attributions.length,
    matchedCount: matchedAttributions.length,
    totalSlippage,
    avgSlippage,
    slippageStdDev,

    // Attribution totals
    attribution: {
      entryPrice: totalEntrySlippage,
      exitPrice: totalExitSlippage,
      size: totalSizeSlippage,
      timing: 0,  // Not quantified this phase
      unexplained: totalUnexplained,
    },

    // Detected patterns
    patterns: portfolioPatterns,

    // Market correlations
    correlations: portfolioCorrelations,
  },

  // Per-strategy breakdown (if requested)
  byStrategy: includePerStrategy ? strategyAnalyses : null,

  // Notes/caveats
  notes: [
    "Timing slippage flagged but not quantified (requires trade-by-trade review)",
    vixSampleSize < tradeCount ? `VIX correlation based on ${vixSampleSize}/${tradeCount} trades with VIX data` : null,
  ].filter(Boolean),
}
```

### Hour Parsing Helper

```typescript
// Defensive hour extraction
function parseHourFromTime(timeOpened: string | undefined): number | null {
  if (!timeOpened || typeof timeOpened !== 'string') return null

  const parts = timeOpened.split(':')
  if (parts.length < 1) return null

  const hour = parseInt(parts[0], 10)
  if (isNaN(hour) || hour < 0 || hour > 23) return null

  return hour
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual review of slippage trades | Automated classification by source | This phase | Faster diagnosis of slippage causes |
| Ad-hoc correlation analysis | Systematic correlation with all market fields | This phase | Discover unexpected slippage drivers |
| Per-trade review | Pattern detection across trade populations | This phase | Surface systematic issues |

## Open Questions

1. **Attribution Method Complexity**
   - What we know: CONTEXT.md leaves attribution method to Claude's discretion (sequential vs pro-rata)
   - What's unclear: Whether interaction effects between entry/exit/size are material
   - Recommendation: Start with sequential attribution (simpler, transparent). Add note that categories may have interaction effects. Can refine in future phase if users request more sophisticated attribution.

2. **Timing Slippage Quantification**
   - What we know: Different reasonForClose indicates timing difference, but dollar impact unclear
   - What's unclear: How to quantify P&L difference attributable to different exit timing
   - Recommendation: For this phase, flag timing differences as a pattern but set timingSlippage = 0 with explicit note. The unexplained residual will capture any timing impact.

3. **Tool Design (One vs Multiple)**
   - What we know: CONTEXT.md leaves tool design to Claude's discretion
   - What's unclear: Whether one comprehensive tool or multiple focused tools is better
   - Recommendation: Start with one tool (`analyze_slippage_patterns`) that provides full analysis. Can factor into specialized tools later if output becomes unwieldy. Single tool is simpler for users and reduces MCP overhead.

## Sources

### Primary (HIGH confidence)
- `/Users/davidromeo/Code/tradeblocks/packages/mcp-server/src/tools/performance.ts` (lines 1956-2142) - DetailedComparison interface and compare_backtest_to_actual implementation
- `/Users/davidromeo/Code/tradeblocks/packages/lib/calculations/statistical-utils.ts` - pearsonCorrelation, kendallTau functions
- `/Users/davidromeo/Code/tradeblocks/packages/mcp-server/src/tools/reports.ts` - find_predictive_fields and aggregate_by_field patterns
- `/Users/davidromeo/Code/tradeblocks/packages/lib/models/trade.ts` - Trade interface with VIX, gap, movement fields
- `/Users/davidromeo/Code/tradeblocks/packages/lib/models/reporting-trade.ts` - ReportingTrade interface

### Secondary (MEDIUM confidence)
- `.planning/phases/37-discrepancy-analysis/37-CONTEXT.md` - User decisions on categories, patterns, correlations
- `.planning/phases/36-enhanced-comparison/36-RESEARCH.md` - Phase 36 patterns and implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses existing codebase libraries (math.js, statistical-utils.ts)
- Architecture: HIGH - Extends existing patterns from Phase 36 and reports.ts
- Pitfalls: HIGH - Based on actual codebase edge cases and statistical best practices

**Research date:** 2026-01-31
**Valid until:** 60 days (stable codebase patterns, no external dependencies)
