# Walk-Forward Analysis (WFA) Guide

Deep guide for TradeBlocks' Walk-Forward Analysis feature. Use this when users ask about WFA configuration, interpretation, or troubleshooting.

## What is Walk-Forward Analysis?

Walk-forward analysis tests whether optimized strategy parameters work on data the optimizer never saw. It's the gold standard for detecting overfitting.

**How it works:**
1. Split historical data into rolling windows
2. Each window has an **In-Sample (IS)** training period and **Out-of-Sample (OOS)** test period
3. Optimize parameters on IS data
4. Test those parameters on OOS data (the strategy sees this data for the first time)
5. Repeat across multiple windows
6. Compare IS vs OOS performance to measure robustness

**Why it matters:** A strategy that looks great on historical data might be overfit—finding patterns that don't repeat. WFA reveals this by measuring how much performance degrades when tested on unseen data.

## UI Layout Overview

The WFA page has two main sections:

### Configuration Panel (Left Side)
- **Window Configuration** — IS/OOS days, step size, trade requirements
- **Optimization Target** — Which metric to optimize (Sharpe, Sortino, etc.)
- **Parameter Sweeps** — Collapsible sections for each parameter family
- **Diversification Constraints** — Optional correlation/tail risk constraints
- **Strategy Weight Sweeps** — Per-strategy weight ranges (for multi-strategy)

### Results Panel (Right Side)
Four tabs after analysis completes:
- **Analysis** — Plain-language interpretation with verdict, red flags, insights
- **Details** — Numeric metrics with explanations
- **Charts** — Visual performance comparisons
- **Windows** — Per-window breakdown with IS/OOS metrics

## Configuration Parameters

### Window Settings

| Parameter | What it does | UI Location | Recommended | Why |
|-----------|--------------|-------------|-------------|-----|
| **In-Sample Days** | Days used for optimization | Window Configuration section | 30-60 days | Shorter = noisier optimization; longer = stale patterns |
| **Out-of-Sample Days** | Days used for testing | Window Configuration section | 14-30 days | Needs enough trades for statistical significance |
| **Step Size Days** | How far windows advance | Window Configuration section | Equal to OOS days | Creates non-overlapping OOS periods |
| **Window Mode** | Rolling vs Anchored | Dropdown in Window Configuration | Rolling (default) | Rolling adapts to regime changes; Anchored uses all prior data |

**IS/OOS Ratio guidance:**
- 2:1 to 4:1 is typical (e.g., 60 IS / 30 OOS)
- Higher ratios give optimizer more data but test less rigorously
- Lower ratios (like 1:1) are more demanding—may produce lower efficiency scores even for robust strategies

### Trade Requirements

| Parameter | What it does | UI Location | Recommended | Why |
|-----------|--------------|-------------|-------------|-----|
| **Min IS Trades** | Minimum trades for optimization | Window Configuration section | 10-15+ | Fewer = statistically unreliable optimization |
| **Min OOS Trades** | Minimum trades for validation | Window Configuration section | 5-10+ | Fewer = noisy out-of-sample results |

### Optimization Target

The dropdown in the Configuration panel lets users select which metric to optimize. **Important:** Only these targets work correctly:

**Working targets:**
- Sharpe Ratio (default, recommended)
- Sortino Ratio
- Return to Max Drawdown
- Profit Factor
- Win Rate
- Average Return
- Total Return
- Kelly Criterion

**Not available:** Diversification-based targets (minAvgCorrelation, minTailRisk, maxEffectiveFactors) were removed because they can't be computed efficiently per parameter combination.

### Parameter Sweeps (Collapsible Sections)

Each parameter family has a collapsible section that's **disabled by default** (opt-in model). When expanded:

- **Checkbox** — Enable/disable that parameter for optimization
- **Min/Max inputs** — Range boundaries for the sweep
- **Step input** — Increment between values

**Parameter families:**
- **Sizing** — Kelly multiplier, position multiplier, max contracts
- **Risk** — Max portfolio DD, stop loss %, profit target %
- **Timing** — DTE min/max, VIX thresholds
- **Exit** — Days before expiry, profit/loss targets

**Combination count:** The UI shows real-time estimate of total parameter combinations. Watch for warning colors:
- Green: Reasonable (<1,000)
- Yellow: Large (1,000-10,000)
- Red: Very large (>10,000) — will be slow

### Diversification Constraints (Optional)

Separate from optimization targets—these are **constraints** that filter which parameter combinations are valid:

- **Max Average Correlation** — Reject combos where strategy correlations exceed threshold
- **Min Tail Risk Score** — Reject combos with poor tail risk diversification
- **Max Effective Factors** — Reject combos too concentrated in few risk factors

These work correctly as constraints, just not as optimization targets.

## Configuration Warnings

The UI shows configuration notes when settings may produce suboptimal results:

**Short windows (<21 days):** May amplify noise over signal. The optimizer finds patterns that don't persist.

**Aggressive ratio (<2:1):** Using nearly equal training/testing is more demanding. May produce lower efficiency scores even for robust strategies.

**Long windows (>90 days):** May include stale market regimes. Parameters optimized over long periods might not reflect current conditions.

**Low trade requirements (<10 IS, <5 OOS):** Results will be statistically unreliable.

**Many combinations (>5,000):** Analysis will take longer. Consider reducing parameter ranges or step sizes.

## Understanding Results

### The Verdict Banner

At the top of results, a colored banner shows the overall assessment:
- **Robust** (green) — Strategy held up well across windows
- **Mixed** (yellow) — Some concerns but not critical
- **Concerning** (red) — Significant issues detected

This is calculated from three component metrics below.

### Key Metrics

#### Efficiency (Walk-Forward Efficiency)
**What it measures:** How much performance the strategy retains when moving from training to testing data.

**Formula:** OOS Performance / IS Performance (as percentage)

**Interpretation:**
- **80%+** = Good — Strategy held up well, optimization found real patterns
- **60-80%** = Moderate — Some decay is normal, strategy may be fragile
- **50-60%** = Concerning — Lost about half the edge, likely fragile in live trading
- **<50%** = Poor — Strategy performed much worse on new data, likely overfit

**UI Location:** Prominent badge in Details tab, explained in Analysis tab

**Reference:** Based on Pardo's 50-60% WFE threshold, elevated for ratio metrics (Sharpe, profit factor) which should degrade less than raw returns.

#### Stability (Parameter Stability)
**What it measures:** How consistent the optimal parameters were across windows.

**Interpretation:**
- **70%+** = Good — Optimal settings stayed similar, found genuine patterns
- **50-70%** = Moderate — Some variation, normal for adaptive strategies
- **<50%** = Concerning — Settings varied widely, may be chasing noise

**Technical note:** Uses coefficient of variation (CV) with sample standard deviation (N-1). 70% stability = ~30% CV.

**UI Location:** Badge in Details tab with HoverCard explanation

#### Consistency (OOS Win Rate)
**What it measures:** What percentage of windows were profitable out-of-sample.

**Interpretation:**
- **70%+** = Good — Worked across different market conditions
- **50-70%** = Moderate — Mixed results, may be regime-dependent
- **<50%** = Concerning — Failed more often than succeeded

**Reference:** 50% is random chance. Based on MultiCharts Walk Forward Optimization robustness criteria.

**UI Location:** Badge in Details tab

### Overall Verdict Calculation

The overall verdict combines all three metrics:
- Each metric scores: Good = 2, Moderate = 1, Concerning = 0
- Total 5+ = "Robust" (green)
- Total 3-4 = "Mixed" (yellow)
- Total 0-2 = "Concerning" (red)

### The Analysis Tab

This tab provides plain-language interpretation:

**Verdict Explanation** — Why the strategy received its verdict, referencing each metric's contribution

**Red Flags** — Specific concerns detected, categorized as:
- ⚠️ Warning (yellow) — Worth noting but not critical
- 🚨 Concern (red) — Significant issue that needs attention

**Configuration Notes** — Feedback on the settings used (short windows, aggressive ratios, etc.)

**Key Insights** — What the results suggest about the strategy

### Red Flags to Watch For

| Red Flag | What it means |
|----------|---------------|
| **Low efficiency (<50%)** | Strategy lost more than half its performance on unseen data. Strong overfitting signal. |
| **Unusually high efficiency (>120%)** | OOS beat IS—unusual. Check for data overlap between windows. |
| **Inconsistent efficiency (CV >50%)** | Performance varied wildly between windows. Strategy is regime-dependent. |
| **More losing than winning windows** | Failed in most periods. Strategy needs refinement. |
| **Parameter instability (<50%)** | Optimal settings changed dramatically. May be chasing noise. |
| **Performance degradation over time** | Recent windows worse than earlier ones. Edge may have decayed. |

## Interpreting Common Scenarios

### "My efficiency is low but some windows look good"
The strategy may work in specific market conditions but not broadly. Look at:
- Which windows performed well vs poorly (Windows tab)
- Were there market regime differences (volatility, trend)?
- Consider adding regime filters rather than abandoning the strategy

### "Parameters are unstable across windows"
Could mean:
- Strategy is flexible/adaptive (not necessarily bad)
- Optimizer is finding different local optima (reduce parameter ranges)
- Strategy is fitting to noise (concerning if combined with low efficiency)

### "Efficiency is good but consistency is low"
The strategy works sometimes but not reliably. This suggests:
- Strong performance in favorable conditions
- Poor performance otherwise
- May need filtering for market conditions

### "Everything looks good but I'm still worried"
Consider:
- How many windows were tested? (4+ is minimum, 8+ is better)
- What was the date range? (Did it include different market regimes?)
- Are the IS/OOS windows long enough for your trade frequency?

## Recommendations for Different Situations

### Low-frequency trading (<20 trades/month)
- Use longer windows (60+ IS days, 30+ OOS days)
- Accept lower minimum trade requirements (may need 5-10 IS, 3-5 OOS)
- Expect fewer total windows
- Consider rolling mode to maximize data usage

### High-frequency trading (50+ trades/month)
- Shorter windows work fine (30 IS, 14 OOS)
- Higher minimum trades (15+ IS, 10+ OOS)
- More windows = more confidence
- Both rolling and anchored work well

### Multi-strategy portfolios
- Run WFA per strategy first to identify weak links
- Then run on combined portfolio
- Poor individual WFA + good portfolio WFA = diversification benefit
- Good individual WFA + poor portfolio WFA = correlation problem

## Common Questions

**Q: What's a good IS/OOS ratio?**
A: 2:1 to 4:1 is typical. Higher gives optimizer more data but tests less rigorously. Lower (like 1:1) is more demanding but may produce artificially low efficiency scores.

**Q: Should I use Rolling or Anchored mode?**
A: Rolling adapts better to regime changes. Anchored uses more data per window but may include stale patterns. Start with Rolling.

**Q: My efficiency dropped after adding more data**
A: This is actually good information—it means the original results may have been regime-specific. The broader test is more realistic.

**Q: How many windows do I need?**
A: Minimum 4 for any confidence. 8+ is better. Fewer windows = more noise in overall assessment.

**Q: The results are different each time I run it**
A: Check if your window settings produce a consistent number of windows. Small changes in date range can shift window boundaries and produce different results.

**Q: Why can't I select diversification targets?**
A: Diversification metrics (correlation, tail risk, effective factors) require computing relationships across all strategies for each parameter combination. This is computationally prohibitive. Use diversification constraints instead—they work as filters on valid combinations.

**Q: The "Run Analysis" button is disabled**
A: You need at least one parameter sweep enabled OR diversification constraints active OR strategy weight sweeps configured. With nothing to optimize, there's no analysis to run.

**Q: What does "Avg Performance Delta" mean?**
A: It's the average difference between IS and OOS performance across all windows. A negative delta (like -15%) means OOS typically underperformed IS by that amount—this is normal and expected.

**Q: How do I get help interpreting my specific results?**
A: After running analysis, click the "Export for Assistant" button that appears below the summary. This downloads a JSON file with your complete results. Upload that file to the TradeBlocks Assistant for personalized interpretation guidance.

## Technical Reference

### Calculation Details

**Degradation Factor (Efficiency):**
```
degradationFactor = mean(OOS_metric / IS_metric) across all windows
```
Uses the selected target metric (default: Sharpe ratio).

**Parameter Stability:**
```
stability = 1 - CV(parameter_values_across_windows)
```
Uses sample standard deviation (N-1) for small sample accuracy.

**Robustness Score:**
```
robustnessScore = (efficiency * 0.4) + (stability * 0.3) + (consistency * 0.3)
```
TradeBlocks-specific composite. Not an industry standard—use individual components for detailed analysis.

### Threshold Sources

- **Efficiency thresholds:** Based on Pardo's "Evaluation and Optimization of Trading Strategies" (2008), elevated for ratio metrics
- **Stability thresholds:** Standard statistical CV thresholds (<30% CV = low variability)
- **Consistency thresholds:** MultiCharts Walk Forward Optimization robustness criteria
