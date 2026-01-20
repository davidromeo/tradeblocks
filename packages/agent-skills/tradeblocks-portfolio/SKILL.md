---
name: tradeblocks-portfolio
description: Portfolio analysis for trading strategies. Explores correlation, diversification, and combined performance characteristics. Use when understanding how strategies relate, exploring diversification effects, or analyzing portfolio composition.
---

# Portfolio Analysis

Explore how strategies relate and what combining them might mean for portfolio characteristics.

## What This Skill Does

Surfaces data to help understand portfolio dynamics:
- **Correlation**: How do strategies move relative to each other?
- **Standalone metrics**: What are each strategy's individual characteristics?
- **Diversification context**: What do the numbers suggest about combining them?

## Prerequisites

- TradeBlocks MCP server running
- Multiple strategy blocks or a multi-strategy block loaded

## Process

### Step 1: Identify Context

Understand the current situation:

Ask:
- "Which strategies would you like to analyze together?"
- "What aspect of portfolio composition interests you?"

Use `list_blocks` to show available blocks.

### Step 2: Correlation Analysis

Use `get_correlation_matrix` to understand how strategies move relative to each other.

**Key parameters:**
- `blockId`: Block folder name
- `method`: "kendall" (robust, rank-based, default), "spearman" (rank), "pearson" (linear)
- `alignment`: "shared" (only days both traded) or "zero-pad" (fill missing with 0)
- `timePeriod`: "daily", "weekly", or "monthly" aggregation
- `normalization`: "raw" (absolute P&L), "margin" (P&L/margin), "notional" (P&L/notional)
- `minSamples`: Minimum shared periods for valid calculation (default: 10)

**Tool returns:**
- Correlation matrix between all strategies
- Sample sizes for each pair
- Analytics (average correlation, strongest/weakest pairs)
- Highly correlated pairs above threshold

**Interpreting correlation values:**

| Correlation | What It Indicates |
|-------------|-------------------|
| < 0.2 | Very low - strategies move independently |
| 0.2 - 0.4 | Low - mostly independent movement |
| 0.4 - 0.6 | Moderate - some shared behavior |
| 0.6 - 0.8 | High - significant shared movement |
| > 0.8 | Very high - strategies behave similarly |

See [references/correlation.md](references/correlation.md) for why Kendall's tau is often more informative than Pearson for trading returns.

### Step 3: Standalone Strategy Metrics

Use `get_statistics` on each strategy to understand individual characteristics.

**Key metrics to surface:**
- Sharpe Ratio (risk-adjusted return)
- Profit Factor (gross wins / gross losses)
- Max Drawdown (worst peak-to-trough decline)
- Win Rate (percentage of profitable trades)
- Trade count (sample size for confidence)

Present each strategy's profile:

| Metric | Strategy A | Strategy B | Strategy C |
|--------|------------|------------|------------|
| Sharpe Ratio | | | |
| Profit Factor | | | |
| Max Drawdown | | | |
| Win Rate | | | |
| Trade Count | | | |

### Step 4: Tail Risk Analysis (Optional)

For deeper understanding, use `get_tail_risk` to explore extreme co-movement.

**Key parameters:**
- `tailThreshold`: What defines "extreme" (0.1 = worst 10% of days)
- `varianceThreshold`: For effective factors calculation (0.8 = 80% variance explained)

**Tool returns:**
- Joint tail risk matrix (do strategies fail together in extremes?)
- Effective factors (how many independent risk sources exist)
- Copula correlation (statistical dependency structure)

**Risk level context:**
- Average joint tail risk <0.3: Lower shared extreme risk
- Average joint tail risk 0.3-0.5: Moderate shared extreme risk
- Average joint tail risk >0.5: Higher shared extreme risk

See [references/diversification.md](references/diversification.md) for why tail correlation often exceeds normal correlation.

### Step 5: Present Findings

Synthesize the data into what the numbers reveal:

**Correlation Findings:**
- Average correlation across pairs: [value]
- Highest correlation pair: [pair] at [value]
- Lowest correlation pair: [pair] at [value]
- Sample sizes: [range or note any insufficient data]

**Strategy Profiles:**
- [Strategy A]: [key characteristic - e.g., "highest Sharpe but also highest drawdown"]
- [Strategy B]: [key characteristic]
- [Note any strategies with limited trade counts]

**Tail Risk (if analyzed):**
- Average joint tail risk: [value] ([context])
- Effective factors: [X] of [Y] strategies
- [Note any pairs with high extreme co-movement]

**What stands out:**
- [Notable pattern 1]
- [Notable pattern 2]
- [Any data quality considerations]

Present these as insights from the historical data. The user can decide what fits their risk tolerance and portfolio goals.

## Interpretation References

- [references/correlation.md](references/correlation.md) - Understanding correlation methods
- [references/diversification.md](references/diversification.md) - Diversification concepts and tail risks

## Related Skills

After portfolio analysis:
- `/tradeblocks-compare` - Deep comparison of specific strategy pairs
- `/tradeblocks-risk` - Position sizing and Kelly analysis
- `/tradeblocks-health-check` - Full metrics on any strategy

## Common Scenarios

### "How do my strategies relate to each other?"

1. Run `get_correlation_matrix` to see pairwise relationships
2. Note the average correlation and any high-correlation pairs
3. Consider sample sizes - low overlap means less reliable correlation

### "What would happen if these strategies draw down together?"

1. Run `get_tail_risk` to explore extreme co-movement
2. Check joint tail risk matrix for pairs that fail together
3. Effective factors < strategy count suggests shared risk sources

### "I'm comparing two similar strategies"

1. Check correlation - if >0.7, they behave similarly
2. Compare standalone metrics to see performance differences
3. High correlation means drawdowns likely compound, not diversify

## Notes

- Correlation is measured on aggregated returns, not trade-by-trade
- Past correlation patterns may not persist in future market conditions
- Tail correlation (crisis behavior) is often higher than normal correlation
- Low correlation doesn't guarantee protection - both can lose for different reasons
- Sample size matters - 10 shared data points is minimum, more is better
