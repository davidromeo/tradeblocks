# Phase 9: Calculation Robustness - Research

**Researched:** 2026-01-11
**Domain:** Walk-Forward Analysis mathematical methodology
**Confidence:** HIGH

<research_summary>
## Summary

Researched Walk-Forward Analysis (WFA) calculation standards as established by Robert Pardo and implemented by major trading platforms (TradeStation, MultiCharts, AmiBroker). The core metric is Walk Forward Efficiency (WFE), which compares annualized OOS returns to annualized IS returns.

Key findings: The current implementation uses "degradationFactor" which IS the efficiency ratio (OOS/IS). The formula is correct but not annualized. The robustness score calculation (averaging efficiency, stability, consistency) is a reasonable composite but not an industry standard — it's a TradeBlocks-specific metric. Parameter stability using coefficient of variation is a valid approach.

**Primary recommendation:** Annualize the efficiency ratio calculation to match WFA standards, verify threshold values against Pardo's 50-60% guideline, and ensure test coverage for all core calculations.

</research_summary>

<standard_stack>
## Standard Stack

This phase involves validating existing calculations against standards — no new libraries needed.

### Core Reference Sources
| Source | Authority | Topics |
|--------|-----------|--------|
| Robert Pardo - "The Evaluation and Optimization of Trading Strategies" (2008) | Gold standard | WFE formula, thresholds, methodology |
| TradeStation Walk-Forward Optimizer documentation | Major platform | WFE calculation, R/R ratio |
| MultiCharts Walk-Forward documentation | Major platform | Efficiency calculation, robustness criteria |
| AmiBroker Walk-Forward documentation | Major platform | Custom metric aggregation methods |

### Industry-Standard Metrics
| Metric | Formula | Threshold | Source |
|--------|---------|-----------|--------|
| Walk Forward Efficiency (WFE) | `Annualized OOS Return / Annualized IS Return` | ≥50-60% | Pardo |
| Risk/Reward Ratio | `Annualized Profit / Max Drawdown` | Higher is better | TradeStation |
| Consistency (% Profitable Periods) | `Profitable OOS Periods / Total OOS Periods` | ≥50% | MultiCharts |
| Max Drawdown | Standard calculation | <40% | Various |

### No Additional Dependencies
This phase validates existing code — no new npm packages required.

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Current Implementation Structure
```
lib/calculations/walk-forward-analyzer.ts
├── Window building (buildWindows)
├── Trade filtering (filterTrades)
├── Parameter grid search (buildCombinationIterator)
├── Scaling application (applyScenario)
├── Summary calculation (calculateSummary)
│   ├── degradationFactor = avgOOS / avgIS  ← This IS the efficiency ratio
│   ├── parameterStability (coefficient of variation)
│   └── robustnessScore (composite)
└── Stats calculation
    ├── consistencyScore = profitable periods / total periods
    └── averagePerformanceDelta = avg(OOS - IS)
```

### Pattern 1: Efficiency Ratio (WFE)
**What:** Compare annualized returns, not raw values
**Current:** `degradationFactor = avgOutSample / avgInSample` (not annualized)
**Standard:**
```typescript
// Annualize before comparing
const annualizedIS = rawIS * (365 / inSampleDays)
const annualizedOOS = rawOOS * (365 / outOfSampleDays)
const WFE = annualizedOOS / annualizedIS
```
**Why it matters:** IS and OOS periods have different lengths. A 100-day IS period with $10k profit vs a 30-day OOS with $2k profit looks like 20% efficiency, but annualized it's actually 24.3% — still concerning, but more accurate.

### Pattern 2: Composite Robustness Score
**What:** Combine multiple metrics into single score
**Current:** `robustnessScore = (efficiency + stability + consistency) / 3`
**Assessment:** This is reasonable but not an industry standard. It's a TradeBlocks-specific composite.
**Industry approach:** MultiCharts uses configurable weights and thresholds for multiple criteria rather than a single composite.

### Pattern 3: Parameter Stability
**What:** Measure how much optimal parameters vary across periods
**Current:** Uses coefficient of variation (stdDev / mean), inverted to 0-1 scale
**Assessment:** Valid statistical approach. Population variance vs sample variance is a minor concern noted in audit.

### Anti-Patterns to Avoid
- **Comparing raw values across different time periods:** Always annualize
- **Single-metric decisions:** WFE alone isn't sufficient — check consistency and stability too
- **Magic number thresholds without reference:** Document where thresholds come from

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Efficiency ratio formula | Custom interpretation | Standard WFE formula (annualized) | Industry consensus, Pardo standard |
| Annualization | Ad-hoc period scaling | `value * (365 / periodDays)` | Standard financial calculation |
| Statistical measures | Custom implementations | Existing `math.js` patterns in codebase | Already established in portfolio-stats.ts |
| Threshold values | Arbitrary numbers | Document source (Pardo: 50-60%) | Credibility and maintainability |

**Key insight:** The formulas themselves are simple. The value is in using the SAME formulas as the rest of the industry so results are comparable and interpretable.

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Non-Annualized Comparison
**What goes wrong:** IS period is 90 days, OOS is 30 days. Raw comparison penalizes shorter OOS periods unfairly.
**Why it happens:** Intuitive to just divide OOS/IS values directly.
**How to avoid:** Annualize both values before comparison: `annualized = raw * (365 / days)`
**Warning signs:** WFE seems artificially low for short OOS periods, artificially high for long OOS periods.

### Pitfall 2: Using Wrong Metric as "Target"
**What goes wrong:** Optimizing on Net P&L but calculating WFE on Sharpe Ratio, or vice versa.
**Why it happens:** Mixing metrics between optimization target and efficiency calculation.
**How to avoid:** WFE should be calculated on the SAME metric used for optimization target.
**Warning signs:** WFE doesn't correlate with perceived strategy quality.

### Pitfall 3: Single Large Win Invalidation
**What goes wrong:** One huge winning trade in OOS inflates WFE artificially.
**Why it happens:** Not checking for outlier contribution.
**How to avoid:** TradeStation guidance: "analysis can be invalidated by any unusually large win... that contributes more than 50% of total net profit"
**Warning signs:** WFE jumps dramatically when one period has outlier trade.

### Pitfall 4: Too Few Periods
**What goes wrong:** WFE calculated on 2-3 periods isn't statistically meaningful.
**Why it happens:** Short data history or aggressive window sizing.
**How to avoid:** Require minimum number of periods (e.g., 5+) for meaningful WFE.
**Warning signs:** High variance in per-period efficiency, small sample warnings.

### Pitfall 5: Meta-Overfitting
**What goes wrong:** Adjusting WFA parameters (window sizes, step size) until results look good.
**Why it happens:** WFA process itself becomes another optimization target.
**How to avoid:** Set WFA parameters based on reoptimization frequency, not results.
**Warning signs:** Tiny changes to window size dramatically change WFE.

</common_pitfalls>

<code_examples>
## Code Examples

### Standard WFE Calculation
```typescript
// Source: Pardo methodology, TradeStation implementation
function calculateWalkForwardEfficiency(
  inSampleReturn: number,
  outOfSampleReturn: number,
  inSampleDays: number,
  outOfSampleDays: number
): number {
  // Annualize both returns
  const annualizedIS = inSampleReturn * (365 / inSampleDays)
  const annualizedOOS = outOfSampleReturn * (365 / outOfSampleDays)

  // Avoid division by zero
  if (annualizedIS === 0) return 0

  // WFE = OOS / IS (as percentage)
  return (annualizedOOS / annualizedIS) * 100
}

// Interpretation (Pardo thresholds)
// WFE >= 60%: Good - strategy is robust
// WFE 50-60%: Acceptable - monitor closely
// WFE < 50%: Concerning - likely overfit
```

### Consistency Score Calculation
```typescript
// Source: MultiCharts "% Profitable Runs"
function calculateConsistencyScore(periods: Period[]): number {
  if (periods.length === 0) return 0

  const profitablePeriods = periods.filter(p =>
    p.outOfSampleReturn > 0 // or >= 0 depending on definition
  )

  return profitablePeriods.length / periods.length
}

// Interpretation
// >= 0.7 (70%): Strong consistency
// >= 0.5 (50%): Acceptable
// < 0.5: Concerning - more losing than winning periods
```

### Parameter Stability (Coefficient of Variation)
```typescript
// Source: Standard statistical approach
function calculateParameterStability(parameterValues: number[]): number {
  if (parameterValues.length <= 1) return 1 // Perfect stability with 1 value

  const mean = parameterValues.reduce((a, b) => a + b, 0) / parameterValues.length

  // Use sample variance (N-1) for small samples
  const variance = parameterValues.reduce(
    (sum, val) => sum + Math.pow(val - mean, 2),
    0
  ) / (parameterValues.length - 1)  // Note: sample variance

  const stdDev = Math.sqrt(variance)

  // Coefficient of variation (CV)
  const cv = mean !== 0 ? stdDev / Math.abs(mean) : stdDev

  // Convert to 0-1 stability score (lower CV = higher stability)
  // Cap CV at 1 for scoring purposes
  return Math.max(0, 1 - Math.min(cv, 1))
}
```

### Outlier Detection for Invalidation
```typescript
// Source: TradeStation guidance
function checkForInvalidatingOutliers(trades: Trade[]): {
  isValid: boolean
  warningTrade?: Trade
  contributionPct?: number
} {
  const totalProfit = trades
    .filter(t => t.pl > 0)
    .reduce((sum, t) => sum + t.pl, 0)

  if (totalProfit <= 0) return { isValid: true }

  // Find largest single contributor
  const largestWin = trades.reduce(
    (max, t) => t.pl > max.pl ? t : max,
    { pl: 0 } as Trade
  )

  const contributionPct = (largestWin.pl / totalProfit) * 100

  // TradeStation threshold: 50% from single trade invalidates analysis
  if (contributionPct > 50) {
    return {
      isValid: false,
      warningTrade: largestWin,
      contributionPct
    }
  }

  return { isValid: true }
}
```

</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple OOS/IS ratio | Annualized OOS/IS ratio | Standard since Pardo 1992 | More accurate comparison |
| Single WFE threshold | Multiple robustness criteria | MultiCharts, StrategyQuant modern | More nuanced assessment |
| Rolling windows only | Anchored + Rolling options | Long-standing | Different use cases |

**New considerations:**
- **Machine Learning integration:** Some platforms now use ML models (LSTM, XGBoost) for optimization within WFA framework
- **Monte Carlo extensions:** Combining WFA with Monte Carlo simulation for additional robustness testing
- **Regime-aware WFA:** Adjusting window sizes based on detected market regimes

**Still standard:**
- WFE formula (annualized OOS/IS) unchanged since Pardo
- 50-60% threshold still widely cited
- Consistency score (% profitable periods) remains common

**Deprecated/outdated:**
- Nothing in core WFA methodology is deprecated — it's mature and stable

</sota_updates>

<open_questions>
## Open Questions

1. **Sample vs Population Variance**
   - What we know: Current implementation uses population variance (N) for parameter stability
   - What's unclear: With few periods (5-10), sample variance (N-1) may be more appropriate
   - Recommendation: Use sample variance for small sample sizes, document the choice

2. **Composite Robustness Score Weights**
   - What we know: Current uses equal weights (1/3 each for efficiency, stability, consistency)
   - What's unclear: No industry standard for weighting these components
   - Recommendation: Keep equal weights but document that this is TradeBlocks-specific, not an industry formula

3. **Threshold Configurability**
   - What we know: Hardcoded thresholds (80%, 60%, etc.) in verdict logic
   - What's unclear: Should users be able to adjust these?
   - Recommendation: Keep hardcoded for simplicity, but reference Pardo in comments

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [TradeStation Walk-Forward Summary Documentation](https://help.tradestation.com/09_01/tswfo/topics/walk-forward_summary_out-of-sample.htm) - WFE definition, R/R ratio formula, 50% threshold
- [Unger Academy - How to Use Walk Forward Analysis](https://ungeracademy.com/posts/how-to-use-walk-forward-analysis-you-may-be-doing-it-wrong) - WFE formula, 50-60% threshold, annualization requirement
- [AmiBroker Walk-Forward Testing](https://www.amibroker.com/guide/h_walkforward.html) - Aggregation methods, Howard Bandy reference
- Robert Pardo "The Evaluation and Optimization of Trading Strategies" (2008) - Original WFA methodology (referenced in multiple sources)

### Secondary (MEDIUM confidence)
- [MultiCharts Walk Forward Optimization](https://www.multicharts.com/trading-software/index.php?title=Walk_Forward_Optimization) - Efficiency calculation example, robustness criteria (403 blocked, used cached/search results)
- [Wikipedia - Walk Forward Optimization](https://en.wikipedia.org/wiki/Walk_forward_optimization) - General methodology overview
- [ForexFactory Discussion](https://www.forexfactory.com/thread/487506-how-to-calculate-walk-forward-efficiency-and-more) - Community validation of WFE formula
- [Build Alpha Robustness Testing Guide](https://www.buildalpha.com/robustness-testing-guide/) - Parameter stability concepts

### Tertiary (LOW confidence - needs validation)
- [FasterCapital articles](https://www.fastercapital.com/content/Performance-Metrics--Measuring-Mastery--Performance-Metrics-in-Walk-Forward-Optimization.html) - General concepts (aggregator content, verify against primary sources)

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Walk-Forward Analysis mathematical methodology
- Ecosystem: Trading platform implementations (TradeStation, MultiCharts, AmiBroker)
- Patterns: WFE calculation, robustness scoring, consistency metrics
- Pitfalls: Non-annualization, single trade invalidation, meta-overfitting

**Confidence breakdown:**
- WFE formula: HIGH - multiple authoritative sources agree
- 50-60% threshold: HIGH - Pardo standard, widely cited
- Robustness score composite: MEDIUM - TradeBlocks-specific, not industry standard
- Parameter stability approach: HIGH - standard statistical method

**Research date:** 2026-01-11
**Valid until:** 2026-04-11 (90 days - WFA methodology is stable/mature)
</metadata>

---

*Phase: 09-calculation-robustness*
*Research completed: 2026-01-11*
*Ready for planning: yes*
