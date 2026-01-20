---
name: tradeblocks-optimize
description: Parameter exploration for trading backtests. Analyzes trade data to find patterns across parameters like time of day, DTE, delta ranges, and market conditions. Use when exploring which parameters performed differently or understanding strategy behavior across conditions.
---

# Parameter Exploration

Explore trade data to understand how performance varies across different parameters.

## What This Skill Does

Uses the Report Builder tools to analyze trade data and answer questions like:
- "How does performance vary by time of day?"
- "What do the numbers look like across DTE ranges?"
- "Is there a delta range that stands out?"
- "How does VIX level correlate with results?"

**Important:** This skill helps surface patterns in historical data. Past patterns may not persist. See [references/optimization.md](references/optimization.md) for overfitting context.

## Prerequisites

- TradeBlocks MCP server running
- Block with enriched trade data (includes fields like hourOfDay, dte, delta, etc.)
- Sufficient trade count for meaningful analysis (50+ trades for better signal)

## Process

### Step 1: Identify Exploration Goal

Ask what the user wants to explore:

| Goal | Fields to Analyze |
|------|-------------------|
| Entry timing | hourOfDay, dayOfWeek |
| DTE patterns | dte (days to expiration) |
| Delta behavior | delta |
| Market conditions | vix, spyLevel |
| Entry pricing | entryCredit, entryDebit |

Ask: "What aspect of your strategy would you like to explore?"

Use `list_blocks` to identify the target block.

### Step 2: Explore Available Fields

Use `list_available_fields` to show what data exists for analysis.

**Key parameters:**
- `blockId`: Block folder name
- `strategy`: Optional filter to specific strategy

**Tool returns:**
- Available fields grouped by category
- Field types (numeric, string, date)
- Sample values and coverage

Present available fields:
- **Timing:** hourOfDay, dayOfWeek, dateOpened
- **Position:** dte, delta, strike, underlying
- **Price:** entryCredit, entryDebit
- **Market:** vix, spyLevel (if available)
- **Outcome:** pl, plPct, result

### Step 3: Understand Distribution

Use `get_field_statistics` on the target field to understand the data shape.

**Key parameters:**
- `blockId`: Block folder name
- `field`: Field name to analyze
- `strategy`: Optional filter

**Tool returns:**
- Range (min/max values)
- Distribution statistics (mean, median, std dev)
- Value counts or histogram buckets
- Missing value count

This reveals:
- Where the data concentrates
- Whether there are outliers
- How trades spread across values

### Step 4: Aggregate Analysis

Use `aggregate_by_field` to bucket trades and compare performance across parameter values.

**Key parameters:**
- `blockId`: Block folder name
- `field`: Field to group by
- `strategy`: Optional filter
- `buckets`: For continuous fields, define ranges (e.g., `[0, 7, 14, 21, 30]` for DTE)
- `metrics`: Which statistics to calculate

**For continuous fields (DTE, delta):**
- Define meaningful buckets based on the distribution
- Example DTE buckets: [0-7, 7-14, 14-21, 21-30, 30+]

**For discrete fields (hourOfDay, dayOfWeek):**
- Each unique value becomes a bucket automatically

**Tool returns per bucket:**
- `count`: Number of trades (sample size)
- `winRate`: Percentage of winners
- `avgPl`: Average P&L per trade
- `totalPl`: Sum of P&L
- `profitFactor`: Gross wins / gross losses

Present results:

| Bucket | Count | Win Rate | Avg P&L | Total P&L | Profit Factor |
|--------|-------|----------|---------|-----------|---------------|
| ... | ... | ... | ... | ... | ... |

### Step 5: Consider Sample Size

**Critical context for any pattern:**

| Trades per Bucket | Interpretation |
|-------------------|----------------|
| < 10 | Very high variance - likely noise |
| 10-30 | Wide confidence intervals |
| 30-50 | Moderate reliability |
| 50+ | More meaningful comparison |

**Multiple testing note:** When exploring many parameters, some will appear significant by chance. Testing 10 buckets at 5% significance = ~40% chance of one false positive. See [references/optimization.md](references/optimization.md).

### Step 6: Present Findings

Synthesize what the data shows:

**Exploration Results:**
- Field analyzed: [field name]
- Total trades: [count]
- Buckets examined: [number]

**Distribution Overview:**
- [How trades spread across buckets]
- [Any concentration or gaps]

**Performance by Bucket:**
| Best performing | [bucket] | [key metrics] | [sample size] |
| Worst performing | [bucket] | [key metrics] | [sample size] |

**Sample Size Context:**
- [Note which buckets have sufficient data]
- [Flag any with <30 trades]

**What the data shows:**
- [Observable pattern 1]
- [Observable pattern 2]
- [Any caveats about the data]

**For further validation:**
- Run walk-forward analysis to test if pattern persists on unseen data
- Collect more trades to increase sample sizes
- Check if pattern aligns with strategy thesis

Present these as patterns in the historical data. The user can decide what weight to give these observations.

## Interpretation Reference

For detailed guidance on interpreting optimization results and avoiding overfitting, see [references/optimization.md](references/optimization.md).

## Related Skills

After parameter exploration:
- `/tradeblocks-wfa` - Test if patterns hold on out-of-sample data
- `/tradeblocks-health-check` - Full metrics review
- `/tradeblocks-compare` - Compare different parameter settings

## Common Scenarios

### "How does performance vary by entry time?"

1. Check hourOfDay distribution with `get_field_statistics`
2. Aggregate P&L by hour with `aggregate_by_field`
3. Note sample size per hour
4. Present hours with notably different metrics

### "What do DTE ranges look like?"

1. Get DTE statistics to see range and distribution
2. Create meaningful buckets (e.g., 0-14, 14-30, 30-45, 45+)
3. Aggregate by bucket
4. Note any bucket with few trades

### "Is there a delta pattern?"

1. Check delta distribution
2. Create buckets (e.g., 10-15, 15-20, 20-25, etc.)
3. Aggregate by bucket
4. Consider whether differences exceed noise

## Data Quality Notes

- **Historical patterns may not persist** - markets and conditions change
- **Small sample sizes are noisy** - 30+ trades per bucket for meaningful comparison
- **Multiple testing inflates apparent significance** - be skeptical of "best" findings
- **Validate with walk-forward** - use `/tradeblocks-wfa` for out-of-sample testing
- **Consider why** - patterns with logical explanations are more likely to persist

## Notes

- Exploration surfaces patterns; it doesn't prove causation
- The "best" parameter from historical data often regresses toward average
- Robustness across parameters often matters more than optimization to one value
- Consider the trading thesis - does the pattern make sense?
