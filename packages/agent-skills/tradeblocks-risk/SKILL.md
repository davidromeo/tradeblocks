---
name: tradeblocks-risk
description: Risk assessment for trading strategies including Kelly criterion position sizing, tail risk analysis, and Monte Carlo worst-case scenarios. Use when determining position size, evaluating capital allocation, or assessing worst-case outcomes.
---

# Risk Assessment

Evaluate risk and determine appropriate position sizing for trading strategies.

## Prerequisites

- TradeBlocks MCP server running
- Block with trade data (10+ trades minimum for reliable metrics)

## Process

### Step 1: Understand User Goals

Risk assessment serves different purposes. Ask what the user wants to understand:

| Goal | Primary Analysis | Supplemental |
|------|------------------|--------------|
| "How much capital to allocate?" | Position sizing (Kelly) | Monte Carlo |
| "What's the worst that could happen?" | Monte Carlo worst-case | Tail risk |
| "Is this strategy too risky?" | Tail risk, Kelly | Drawdown analysis |
| "How should I size across strategies?" | Per-strategy Kelly | Correlation |

Ask: "What would you like to understand about risk?"

Then use `list_backtests` to identify the target block.

### Step 2: Run Appropriate Analysis

Based on the user's goal:

**For Position Sizing:**

Call `get_position_sizing` with the user's capital base.

Present results with context:
- Full Kelly: Theoretical maximum (too aggressive for most)
- Half Kelly: 50% of full Kelly (recommended)
- Quarter Kelly: 25% of full Kelly (conservative)

**Key metrics to highlight:**
- Win rate and payoff ratio (inputs to Kelly)
- Recommended allocation as dollar amount
- Warnings if Kelly is negative or very high

**For Worst-Case Scenarios:**

Call `run_monte_carlo` with worst-case injection enabled:
- `includeWorstCase: true`
- `worstCasePercentage: 5` (default)
- `worstCaseMode: "pool"` or `"guarantee"` for stress testing

Focus on:
- 5th percentile outcome (worst 1-in-20 scenario)
- Probability of profit
- Mean max drawdown

**For Tail Risk:**

Call `get_tail_risk` (requires multiple strategies in block).

Examine:
- Joint tail risk between strategies
- Effective factors (diversification)
- Kurtosis and skewness indicators

### Step 3: Complementary Checks

Risk assessment benefits from multiple perspectives:

| Primary Analysis | Also Run |
|------------------|----------|
| Position sizing | Monte Carlo to validate drawdown tolerance |
| Monte Carlo | Position sizing to right-size the allocation |
| Tail risk | Position sizing to see Kelly per strategy |

This cross-validation catches issues a single analysis might miss.

### Step 4: Provide Recommendations

Synthesize findings into actionable guidance:

**Position Size Recommendation:**
- State the recommended allocation (half-Kelly)
- Provide dollar amount and percentage of capital
- Note any warnings (negative Kelly, high risk)

**Risk Warnings (if applicable):**
- Fat tails detected: "Reduce position size by 25-50%"
- High correlation: "Strategies may fail together"
- Negative Kelly: "Do not trade this strategy"

**Comparison to Guidelines:**
- Conservative: Risk 1-2% per trade
- Moderate: Risk 2-5% per trade
- Aggressive: Risk 5-10% per trade (not recommended)

## Interpretation References

- [references/kelly-guide.md](references/kelly-guide.md) - Kelly criterion explained
- [references/tail-risk.md](references/tail-risk.md) - Understanding fat tails

## Common Scenarios

### "I have $100,000 to allocate"

1. Run position sizing with capitalBase: 100000
2. Review per-strategy Kelly recommendations
3. Apply half-Kelly for recommended position
4. Cross-check with Monte Carlo 5th percentile

### "Should I add this strategy to my portfolio?"

1. Check if strategy has positive Kelly
2. Run correlation against existing strategies
3. Check tail risk (do strategies fail together?)
4. If low correlation and positive Kelly, likely additive

### "This strategy has high drawdowns"

1. Run Monte Carlo worst-case analysis
2. Check tail risk metrics
3. If drawdowns are isolated events: may be tolerable
4. If drawdowns correlate with market stress: reduce size

## Next Steps

After risk assessment:
- `/tradeblocks-health-check` - Full strategy evaluation
- `/tradeblocks-wfa` - Validate parameters aren't overfit

## Notes

- Kelly assumes independent bets; real trades may be correlated
- Historical volatility may underestimate future extremes
- Always paper trade before risking real capital
