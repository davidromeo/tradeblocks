---
name: tradeblocks-health-check
description: Strategy health check for trading backtests. Analyzes performance metrics, runs stress tests, and surfaces risk indicators. Use when evaluating a strategy's historical performance and stress characteristics.
---

# Strategy Health Check

Surface key performance metrics and stress test results to help understand a strategy's characteristics.

## Prerequisites

- TradeBlocks MCP server must be running
- At least one block with trade data loaded

## Process

### Step 1: Select Strategy

List available blocks and help the user choose what to analyze.

```
Use list_backtests to show available options.
```

Ask clarifying questions:
- "Which backtest would you like to analyze?"
- "Do you want to analyze the full portfolio or a specific strategy within it?"

If analyzing a specific strategy, note it for filtering in subsequent steps.

### Step 2: Gather Basic Metrics

Run `get_statistics` for the selected block (with strategy filter if specified).

Present key metrics with context:

| Metric | What It Measures |
|--------|------------------|
| Sharpe Ratio | Risk-adjusted return (higher = better return per unit risk) |
| Sortino Ratio | Downside risk-adjusted return (focuses only on losses) |
| Max Drawdown | Largest peak-to-trough decline (lower = less historical pain) |
| Win Rate | Percentage of trades that were profitable |
| Profit Factor | Gross wins / gross losses (>1 means profitable overall) |
| Net P&L | Total profit after commissions |

**Key insight:** A strategy can have low win rate but high profit factor if average wins exceed average losses significantly. Neither metric alone tells the full story.

### Step 3: Stress Testing

Run `run_monte_carlo` to project performance under uncertainty.

Key parameters to understand:
- `resampleMethod`: "trades" resamples individual trade P&L (default)
- `includeWorstCase`: Injects synthetic worst-case scenarios (default: true)
- `worstCasePercentage`: How much of simulation is worst-case (default: 5%)

Focus on these outputs:
- **5th percentile outcome**: What the data suggests in a bad scenario (1 in 20 chance of worse)
- **Probability of profit**: How often simulations ended profitable
- **Mean max drawdown**: Typical drawdown across simulations

Present these as "what the historical data suggests could happen" - not predictions.

### Step 4: Risk Metrics

Run complementary risk analysis:

1. **Position Sizing** via `get_position_sizing`:
   - Kelly criterion calculation based on win rate and payoff ratio
   - Shows full Kelly, half Kelly (0.5x), and quarter Kelly (0.25x) fractions
   - Note: Kelly assumes independent trades, which may not apply

2. **Tail Risk** via `get_tail_risk` (if multiple strategies):
   - Joint tail dependence between strategies
   - Effective factors (how many independent risk sources exist)
   - High values indicate strategies may fail together

Key outputs to surface:
- Kelly percentage (what the formula suggests given historical win rate and payoff)
- Warnings in the output (e.g., "Portfolio Kelly exceeds 25%", "negative Kelly")
- Tail risk level (LOW/MODERATE/HIGH based on average joint tail risk)

### Step 5: Summary

Synthesize findings into a clear picture of what the data shows:

**Metrics Summary:**
- Sharpe Ratio: [value] - [context: >1.0 considered acceptable by many, >2.0 considered excellent]
- Max Drawdown: [value] - [context: <20% relatively low, >40% significant]
- Profit Factor: [value] - [context: >1.5 considered good, >2.0 excellent]
- Kelly: [value] - [context: what historical data suggests; negative means losses > wins]

**Stress Test Insights:**
- 5th percentile scenario: [value]
- Monte Carlo probability of profit: [value]

**What stands out:**
- [Highlight any notably strong or weak metrics]
- [Note any warnings from the tools]
- [Mention if multiple strategies show high tail correlation]

Let the user draw their own conclusions about whether this fits their risk tolerance.

## Interpretation Reference

For detailed explanations of each metric, see [references/metrics.md](references/metrics.md).

## Related Skills

After health check, the user may want to:
- `/tradeblocks-wfa` - Test if optimized parameters hold up on unseen data
- `/tradeblocks-risk` - Deep dive into position sizing and tail risk analysis

## Notes

- Always use trade-based calculations when filtering by strategy (daily logs represent full portfolio)
- Historical performance doesn't guarantee future results
- Kelly criterion assumes independent trades and known edge - real trading may differ
