---
name: tradeblocks-compare
description: Performance comparison for trading strategies. Compare backtest vs actual results, strategy vs strategy metrics, or period vs period performance. Use when evaluating differences between theoretical and live execution, comparing two strategies, or analyzing performance across time periods.
---

# Performance Comparison

Compare strategies, execution modes, or time periods to understand performance differences.

## Prerequisites

- TradeBlocks MCP server running
- At least one block with trade data loaded
- For backtest vs actual: Both trade log and strategy log for the same strategy
- For strategy vs strategy: Two blocks to compare

## Process

### Step 1: Identify Comparison Type

Ask the user what they want to compare:

| Type | Use Case | Required Data |
|------|----------|---------------|
| Backtest vs Actual | Compare theoretical results to live execution | Trade log + strategy log |
| Strategy vs Strategy | Compare two different strategies | Two blocks |
| Period vs Period | Analyze same strategy across different time ranges | One block with sufficient history |

Ask: "What would you like to compare?"
- "I want to see how my live trades compare to the backtest"
- "I want to compare strategy A to strategy B"
- "I want to see how performance changed over time"

### Step 2a: Backtest vs Actual Comparison

Use `compare_backtest_vs_actual` to see how theoretical performance compares to live execution.

**Understanding Scaling Modes:**

The tool offers three scaling approaches (see [references/scaling.md](references/scaling.md) for details):

| Mode | What It Does | When to Use |
|------|--------------|-------------|
| `raw` | Shows P&L as-is | When contract sizes match |
| `perContract` | Divides by contract count | Per-lot comparison |
| `toReported` | Scales backtest down to match actual | When backtest uses more contracts |

Run the comparison and present:
- **Backtest P&L** vs **Actual P&L** (using selected scaling)
- **Trade count** differences
- **Win rate** comparison
- **Timing differences** (if trades diverged)

Common divergences to highlight:
- Slippage (actual underperforms backtest)
- Missed fills (fewer actual trades)
- Timing drift (actual trades at different times)

### Step 2b: Strategy vs Strategy Comparison

For comparing two different strategies:

1. Use `get_statistics` on each block
2. Use `calculate_correlation` to assess how they move together

Present side-by-side:

| Metric | Strategy A | Strategy B |
|--------|------------|------------|
| Net P&L | | |
| Sharpe Ratio | | |
| Max Drawdown | | |
| Win Rate | | |
| Profit Factor | | |

**Correlation insight:**
- Low correlation (<0.3): Strategies may diversify well together
- Moderate correlation (0.3-0.6): Some shared behavior
- High correlation (>0.6): Strategies may fail together

### Step 2c: Period vs Period Comparison

For analyzing performance across time:

Use `get_period_returns` or `run_filtered_query` with date filters.

Present period breakdown:
- Performance by month/quarter/year
- Identify best and worst periods
- Look for regime changes

Questions to explore:
- "Did performance change after a specific date?"
- "How does recent performance compare to early results?"
- "Are there seasonal patterns?"

### Step 3: Interpret Differences

For each comparison type, help the user understand WHY differences exist:

**Backtest vs Actual divergence causes:**
- **Slippage**: Market moved between signal and fill
- **Liquidity**: Couldn't get filled at backtest price
- **Timing**: Position entered at different time than modeled
- **Position sizing**: Different contract counts
- **Commissions**: Different fee structures

**Strategy vs Strategy differences:**
- **Market exposure**: Different deltas, timeframes
- **Risk profile**: One strategy more aggressive
- **Trade frequency**: Different number of opportunities
- **Correlation to market**: One benefits in conditions that hurt the other

**Period vs Period changes:**
- **Market regime**: Volatility, trend, or mean-reverting environment
- **Strategy adaptation**: Changes to parameters over time
- **Sample size**: Earlier periods may have fewer trades

### Step 4: Summary

Present findings clearly:

**Comparison Summary:**
- What was compared: [backtest vs actual / strategy A vs B / period X vs Y]
- Key finding: [Most important difference]
- Magnitude: [How significant is the divergence]

**What stands out:**
- [Notable observation 1]
- [Notable observation 2]
- [Any concerns or positive signals]

**Possible explanations:**
- [Hypothesis for why differences exist]

Let the user decide what action, if any, to take based on the findings.

## Interpretation Reference

For detailed explanation of scaling modes, see [references/scaling.md](references/scaling.md).

## Related Skills

After comparison analysis:
- `/tradeblocks-health-check` - Deep dive into either strategy
- `/tradeblocks-portfolio` - Assess if strategies combine well
- `/tradeblocks-wfa` - Test parameter robustness

## Notes

- Backtest results typically look better than live (survivorship bias, perfect fills)
- A 10-20% degradation from backtest to live is common and expected
- High correlation between strategies reduces diversification benefits
- Short comparison periods may not be statistically meaningful
