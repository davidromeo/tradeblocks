---
name: tradeblocks-portfolio
description: Portfolio addition decision helper. Analyzes whether adding a new strategy would improve or degrade portfolio performance. Use when evaluating a candidate strategy for inclusion, assessing diversification benefits, or deciding which strategies to combine.
---

# Portfolio Addition Decision

Evaluate whether adding a candidate strategy improves or degrades your portfolio.

## What This Skill Does

Helps answer the question: "Should I add this strategy to my portfolio?"

The analysis considers:
- **Correlation**: Does it move differently from existing strategies?
- **Standalone merit**: Is it profitable on its own?
- **Combined impact**: Does it improve the overall portfolio?

## Prerequisites

- TradeBlocks MCP server running
- Existing portfolio block(s) loaded
- Candidate strategy block loaded

## Process

### Step 1: Identify Context

Understand the current situation:

Ask:
- "Which strategy are you considering adding?"
- "What strategies are currently in your portfolio?"

Use `list_backtests` to show available blocks.

Clarify:
- Which block is the candidate?
- Which blocks represent the current portfolio?

### Step 2: Correlation Analysis

Use `calculate_correlation` to assess how the candidate moves relative to existing strategies.

**Interpreting correlation values:**

| Correlation | Meaning | Diversification |
|-------------|---------|-----------------|
| < 0.2 | Very low | Excellent diversification potential |
| 0.2 - 0.4 | Low | Good diversification |
| 0.4 - 0.6 | Moderate | Some shared behavior |
| 0.6 - 0.8 | High | Limited diversification |
| > 0.8 | Very high | Essentially the same strategy |

**Key insight:** The tool uses Kendall's tau correlation, which is more robust for trading returns than Pearson correlation. See [references/correlation.md](references/correlation.md) for details.

Present correlation of candidate vs each existing strategy.

### Step 3: Assess Candidate Standalone

Use `get_statistics` on the candidate strategy.

Key metrics to evaluate:

| Metric | Minimum for ADD | Ideal |
|--------|-----------------|-------|
| Sharpe Ratio | > 0.5 | > 1.0 |
| Profit Factor | > 1.2 | > 1.5 |
| Max Drawdown | < 40% | < 25% |

**Important:** A strategy doesn't need to be excellent standalone if it provides strong diversification. A mediocre strategy with -0.2 correlation to the portfolio may improve overall Sharpe more than an excellent strategy with +0.8 correlation.

### Step 4: Combined Impact Assessment

Synthesize the analysis:

**Diversification benefit:**
- Would adding this reduce portfolio max drawdown?
- Low correlation = drawdowns may not align
- High correlation = drawdowns compound

**Risk-adjusted return impact:**
- Calculate implied portfolio Sharpe improvement
- A low-correlation strategy can improve Sharpe even with lower standalone metrics

**Red flags:**
- High correlation to existing strategies (>0.7)
- Negative Sharpe on its own
- Max drawdown > 50%
- Same underlying exposure as existing strategy

### Step 5: Recommendation

Based on the analysis, provide a clear recommendation:

#### ADD

Recommend adding when:
- Correlation to existing strategies < 0.4
- Standalone Sharpe > 0.5 or strong diversification benefit
- Max drawdown acceptable
- No duplicate exposure

**Example recommendation:**
> **ADD** - Low correlation (0.15) to existing portfolio with solid standalone metrics (Sharpe 0.9). Adding this should improve portfolio diversification without adding correlated risk.

#### CONSIDER

Mixed signals warrant further analysis:
- Moderate correlation (0.4-0.6) but strong standalone metrics
- Low correlation but marginal standalone performance
- Some overlap with existing strategies

**Example recommendation:**
> **CONSIDER** - Strong standalone metrics (Sharpe 1.4) but moderate correlation (0.52) to Strategy A. Diversification benefit exists but is limited. Consider allocation size carefully.

#### SKIP

Recommend skipping when:
- High correlation to existing strategies (>0.7)
- Poor standalone metrics (negative Sharpe, PF < 1.0)
- Excessive max drawdown
- Duplicates existing exposure

**Example recommendation:**
> **SKIP** - High correlation (0.82) to existing Strategy B indicates these are essentially the same trade. Adding would increase concentration risk without diversification benefit.

## Interpretation References

- [references/correlation.md](references/correlation.md) - Understanding correlation types
- [references/diversification.md](references/diversification.md) - Why diversification matters

## Related Skills

After portfolio analysis:
- `/tradeblocks-compare` - Deep comparison of specific strategies
- `/tradeblocks-risk` - Tail risk analysis for the combined portfolio
- `/tradeblocks-health-check` - Full metrics on any strategy

## Common Scenarios

### "I have two similar strategies - which one?"

1. Run correlation between them
2. If correlation > 0.7, pick the better performer
3. If correlation < 0.5, consider keeping both

### "Should I add a losing strategy for diversification?"

Generally no. Diversification doesn't overcome negative expected value. Look for strategies that are:
- At least marginally profitable (PF > 1.0)
- Uncorrelated to current holdings

### "My new strategy has better metrics - replace or add?"

1. Check correlation
2. If correlated (>0.6): Consider replacing
3. If uncorrelated (<0.4): Consider adding both
4. If moderate: Depends on capital constraints

## Notes

- Correlation is measured on daily returns, not trade-by-trade
- Past correlation may not hold in future market conditions
- Tail correlation (crisis behavior) often higher than normal correlation
- Consider position sizing implications when adding strategies
