---
name: tradeblocks-optimize
description: Parameter optimization for trading backtests. Explores trade data to find patterns and optimal parameters like time of day, DTE, delta ranges, and market conditions. Use when analyzing which parameters performed best or exploring ways to improve a strategy.
---

# Backtest Optimization

Explore trade data to find patterns and identify optimal parameters.

## What This Skill Does

Uses the Report Builder tools to analyze trade data and answer questions like:
- "What time of day works best?"
- "Which DTE range performs best?"
- "What delta sweet spot should I target?"
- "Does market volatility (VIX) affect results?"

**Important:** This skill helps you find patterns in historical data. It does NOT guarantee those patterns will persist. See [references/optimization.md](references/optimization.md) for overfitting warnings.

## Prerequisites

- TradeBlocks MCP server running
- Block with enriched trade data (includes fields like hourOfDay, dte, delta, etc.)
- Sufficient trade count for meaningful analysis (50+ trades recommended)

## Process

### Step 1: Identify Optimization Goal

Ask what the user wants to optimize:

| Goal | Fields to Analyze |
|------|-------------------|
| Best entry time | hourOfDay, dayOfWeek |
| Optimal DTE | dte (days to expiration) |
| Delta sweet spot | delta |
| Market conditions | vix, spyLevel |
| Entry price filtering | entryCredit, entryDebit |

Ask: "What aspect of your strategy would you like to analyze?"

Use `list_backtests` to identify the target block.

### Step 2: Explore Available Fields

Use `list_available_fields` to show what data is available for analysis.

Present the available fields grouped by category:
- **Timing:** hourOfDay, dayOfWeek, dateOpened
- **Position:** dte, delta, strike, underlying
- **Price:** entryCredit, entryDebit
- **Market:** vix, spyLevel (if available)
- **Outcome:** pl, plPct, result

Note which fields are relevant to the user's goal.

### Step 3: Understand Distribution

Use `get_field_statistics` on the target field.

This reveals:
- **Range:** Min/max values in the data
- **Distribution:** How trades spread across values
- **Outliers:** Unusual values that may skew analysis

Example output for hourOfDay:
```
Min: 9, Max: 15
Mean: 11.5
Count by value: {9: 45, 10: 120, 11: 95, ...}
```

This tells you where to look for patterns.

### Step 4: Aggregate Analysis

Use `aggregate_by_field` to bucket trades by the parameter.

**For continuous fields (DTE, delta):**
- Define meaningful buckets
- Example: dte buckets [0-7, 7-14, 14-21, 21-30, 30+]

**For discrete fields (hourOfDay, dayOfWeek):**
- Each value becomes a bucket

Key metrics to request:
- `count`: Number of trades (sample size)
- `winRate`: Percentage of winners
- `avgPl`: Average P&L per trade
- `totalPl`: Sum of P&L
- `profitFactor`: Gross wins / gross losses

Present results as a table:

| Bucket | Count | Win Rate | Avg P&L | Total P&L |
|--------|-------|----------|---------|-----------|
| ... | ... | ... | ... | ... |

Highlight the best-performing bucket(s).

### Step 5: Validate Findings

**CRITICAL:** Before recommending parameter changes, validate:

#### Sample Size Check

| Trades per Bucket | Reliability |
|-------------------|-------------|
| < 10 | Unreliable (noise) |
| 10-30 | Suggestive only |
| 30-50 | Moderate confidence |
| 50+ | More reliable |

**If sample size is small:** "The best bucket has only 12 trades. This could be random chance rather than a real pattern."

#### Statistical Significance

Large differences with small samples are likely noise:
- 80% win rate from 10 trades = unreliable
- 55% win rate from 100 trades = meaningful

#### Multiple Testing Warning

When you test many parameters, some will look good by chance.

**Example:** Testing 10 hourly buckets at 5% significance level = 50% chance of one false positive.

See [references/optimization.md](references/optimization.md) for details.

### Step 6: Present Findings

Synthesize the analysis with appropriate caveats:

**Optimization Results:**
- Field analyzed: [field name]
- Best bucket: [value range]
- Performance: [key metrics]
- Sample size: [count] trades

**What the data shows:**
- [Observation about best-performing range]
- [Observation about worst-performing range]
- [Notable patterns]

**Confidence assessment:**
- Sample size: [adequate / limited]
- Effect size: [large / moderate / small]
- Multiple testing concern: [yes / no]

**Recommendation:**
- If high confidence: "The data suggests [X] may be worth exploring"
- If low confidence: "Interesting pattern but sample size is too small to rely on"
- If unclear: "No clear pattern emerges; parameters may not matter"

**Next step suggestion:**
- Run walk-forward analysis to test if finding holds on unseen data
- Collect more trades to increase sample size
- Test on different time period to check persistence

## Interpretation Reference

For detailed guidance on avoiding overfitting, see [references/optimization.md](references/optimization.md).

## Related Skills

After optimization analysis:
- `/tradeblocks-wfa` - Test if optimized parameters hold on out-of-sample data
- `/tradeblocks-health-check` - Full metrics review
- `/tradeblocks-compare` - Compare optimized vs original

## Common Scenarios

### "What's the best time to enter?"

1. Check hourOfDay distribution
2. Aggregate P&L by hour
3. Note sample size per hour
4. If one hour stands out with 50+ trades, it may be meaningful

### "Which DTE should I target?"

1. Get DTE statistics to see range
2. Create buckets (e.g., 0-14, 14-30, 30-45, 45+)
3. Aggregate by bucket
4. Check if pattern is consistent with strategy thesis

### "Is there a delta sweet spot?"

1. Check delta distribution
2. Create buckets (e.g., 10-15, 15-20, 20-25, etc.)
3. Aggregate by bucket
4. Consider whether "best" delta aligns with risk goals

## Warnings

- **Historical patterns may not persist** - markets change
- **Overfitting is the biggest risk** - see references
- **Small sample sizes lie** - require 30+ trades per bucket
- **Multiple testing inflates false positives** - be skeptical of "best" findings
- **Always validate with walk-forward** - use `/tradeblocks-wfa`

## Notes

- Optimization should enhance understanding, not define the strategy
- The "best" parameter from backtest often underperforms live
- Consider WHY a pattern might exist before relying on it
- Robustness across parameters is better than optimization to one value
