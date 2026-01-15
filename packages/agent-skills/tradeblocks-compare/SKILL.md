---
name: tradeblocks-compare
description: Performance comparison for trading strategies. Compare backtest vs actual results, strategy vs strategy metrics, or period vs period performance. Use when exploring differences between theoretical and live execution, understanding how two strategies relate, or analyzing performance across time periods.
---

# Performance Comparison

Explore differences between strategies, execution modes, or time periods.

## Prerequisites

- TradeBlocks MCP server running
- At least one block with trade data loaded
- For backtest vs actual: Both trade log and reporting log for the same strategy
- For strategy vs strategy: Two blocks or multiple strategies in one block

## Process

### Step 1: Identify Comparison Type

Ask the user what they want to compare:

| Type | Use Case | Required Data |
|------|----------|---------------|
| Backtest vs Actual | Explore theoretical vs live execution | Trade log + reporting log |
| Strategy vs Strategy | Understand how two strategies relate | Two blocks or multi-strategy block |
| Period vs Period | Analyze same strategy across different time ranges | One block with sufficient history |

Ask: "What would you like to compare?"

### Step 2a: Backtest vs Actual Comparison

Use `compare_backtest_to_actual` to explore how theoretical performance compares to live execution.

**Key parameters:**
- `blockId`: Block folder name
- `scaling`: How to compare P&L fairly (see below)
- `strategy`: Optional filter to specific strategy
- `dateRange`: Optional date filter
- `matchedOnly`: Only include trades where both backtest and actual exist

**Scaling modes** (see [references/scaling.md](references/scaling.md)):

| Mode | What It Does | Use When |
|------|--------------|----------|
| `raw` | Shows P&L as-is | Contract sizes match between backtest and actual |
| `perContract` | Divides each P&L by contract count | Comparing per-lot performance regardless of size |
| `toReported` | Scales backtest DOWN to match actual contract count | Backtest uses more contracts than actual |

**Tool returns:**
- Per-date comparison with backtest vs actual P&L
- Slippage calculation (actual minus backtest)
- Match status (whether both sides exist for each date)
- Summary totals and average slippage percentage

Present findings from the data:
- **Total backtest P&L** vs **Total actual P&L** (at selected scaling)
- **Matched trade count** (how many dates have both)
- **Average slippage** (percentage deviation from backtest)
- **Unmatched trades** (missed fills or extra trades)

### Step 2b: Strategy vs Strategy Comparison

For comparing two different strategies:

1. Use `get_statistics` on each block (or with `strategy` filter)
2. Use `get_correlation_matrix` to understand how they move together

**Key parameters for correlation:**
- `method`: "kendall" (robust, rank-based), "spearman" (rank), "pearson" (linear)
- `alignment`: "shared" (only days both traded) or "zero-pad" (fill missing with 0)
- `timePeriod`: "daily", "weekly", or "monthly" aggregation

Present side-by-side metrics:

| Metric | Strategy A | Strategy B |
|--------|------------|------------|
| Net P&L | | |
| Sharpe Ratio | | |
| Max Drawdown | | |
| Win Rate | | |
| Profit Factor | | |

**Correlation context:**
- Very low (<0.2): Strategies move independently
- Low (0.2-0.4): Some independence
- Moderate (0.4-0.6): Shared behavior
- High (>0.6): Similar movements, less diversification

### Step 2c: Period vs Period Comparison

For analyzing performance across time:

Use `get_period_returns` with period type and optional date filters.

**Key parameters:**
- `period`: "monthly", "weekly", or "daily"
- `dateRange`: Optional filter to specific time range
- `normalizeTo1Lot`: Normalize for fair comparison across different position sizes

Present period breakdown:
- Performance by month/quarter/year
- Best and worst periods
- Trends or regime changes

Questions to explore:
- "How does recent performance compare to earlier results?"
- "Are there periods that stand out?"
- "Does performance vary by time of year?"

### Step 3: Present Findings

Synthesize the data into what stands out:

**Comparison Summary:**
- What was compared: [backtest vs actual / strategy A vs B / period X vs Y]
- Key observation: [Most notable difference from the data]
- Magnitude: [Size of the divergence]

**What the data shows:**
- [Notable finding 1 from tool output]
- [Notable finding 2 from tool output]
- [Any patterns or anomalies]

**Context for interpretation:**
- [Possible explanations for observed differences]
- [Factors that may affect the comparison]

Present these as observations from the historical data. The user can decide what meaning to draw from the findings.

## Interpretation Reference

For detailed explanation of scaling modes, see [references/scaling.md](references/scaling.md).

## Related Skills

After comparison analysis:
- `/tradeblocks-health-check` - Deep dive into either strategy
- `/tradeblocks-portfolio` - Explore correlation and diversification
- `/tradeblocks-wfa` - Test parameter robustness

## Notes

- Backtest results typically look better than live (ideal fills, no slippage)
- Some degradation from backtest to live is expected
- High correlation between strategies means they may draw down together
- Short comparison periods have more noise than signal
- Scaling mode choice affects what story the data tells
