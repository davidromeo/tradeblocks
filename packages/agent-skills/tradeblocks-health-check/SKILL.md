---
name: tradeblocks-health-check
description: Comprehensive strategy health check for trading backtests. Analyzes performance metrics, runs stress tests, and provides risk assessment. Use when evaluating a strategy's robustness, reviewing backtest performance, or deciding if a strategy is worth trading live.
---

# Strategy Health Check

Evaluate a trading strategy's health and robustness before committing capital.

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

| Metric | Value | Interpretation |
|--------|-------|----------------|
| Sharpe Ratio | [value] | >1.0 acceptable, >2.0 excellent |
| Sortino Ratio | [value] | >1.5 good (focuses on downside) |
| Max Drawdown | [value] | <20% low risk, >40% high risk |
| Win Rate | [value] | Context-dependent with profit factor |
| Profit Factor | [value] | >1.5 good, >2.0 excellent |
| Net P&L | [value] | Total profit after commissions |

**Key insight:** A strategy can have low win rate but high profit factor if average wins exceed average losses significantly.

### Step 3: Stress Testing

Run `run_monte_carlo` to project future performance under uncertainty.

Default parameters are usually appropriate. Focus on:

- **5th percentile outcome**: Worst realistic case (1 in 20 chance of worse)
- **Probability of profit**: Chance the strategy remains profitable
- **Mean max drawdown**: Typical drawdown to expect

Ask yourself: "Would I be comfortable with the 5th percentile outcome?"

### Step 4: Risk Assessment

Run complementary risk analysis:

1. **Position Sizing** via `get_position_sizing`:
   - Kelly criterion recommendation
   - Use half-Kelly (safer than full Kelly)
   - Check if Kelly suggests a reasonable allocation

2. **Tail Risk** via `get_tail_risk` (if multiple strategies):
   - Check for fat tails (unexpected large losses)
   - Look at kurtosis and skewness

Warning signs:
- Kelly < 5%: Strategy may not be worth the risk
- Kelly negative: Do not trade this strategy
- High kurtosis: Expect occasional extreme losses

### Step 5: Summary and Verdict

Synthesize findings into a clear recommendation:

**HEALTHY** - Strategy is robust and tradeable:
- Sharpe > 1.5
- Max drawdown < 25%
- Kelly > 10% (suggests reasonable edge)
- Monte Carlo 5th percentile still profitable

**CONCERNS** - Proceed with caution:
- Sharpe 0.5-1.5
- Max drawdown 25-40%
- Kelly 5-10%
- Monte Carlo shows significant loss scenarios

**AVOID** - Do not trade:
- Sharpe < 0.5
- Max drawdown > 40%
- Kelly < 5% or negative
- Monte Carlo shows high probability of ruin

## Interpretation Reference

For detailed explanations of each metric, see [references/metrics.md](references/metrics.md).

## Next Steps

After health check, the user may want to:
- `/tradeblocks-wfa` - Validate that parameters aren't overfit
- `/tradeblocks-risk` - Deep dive into position sizing and tail risk
- `/tradeblocks-compare` - Compare against other strategies

## Notes

- Always use trade-based calculations when filtering by strategy (daily logs represent full portfolio)
- Consider the strategy's time in market when interpreting drawdown
- Historical performance doesn't guarantee future results
