---
name: tradeblocks-risk
description: Risk analysis for trading strategies including Kelly criterion calculations, tail risk metrics, and Monte Carlo projections. Use when exploring position sizing, capital allocation, or understanding worst-case characteristics.
---

# Risk Analysis

Explore risk characteristics and position sizing metrics for trading strategies.

## Prerequisites

- TradeBlocks MCP server running
- Block with trade data (10+ trades minimum for meaningful metrics)

## Process

### Step 1: Understand User Goals

Risk analysis serves different purposes. Ask what the user wants to understand:

| Goal | Primary Analysis | Also Consider |
|------|------------------|---------------|
| "What does Kelly suggest?" | Position sizing | Monte Carlo for drawdown context |
| "What are worst-case scenarios?" | Monte Carlo with worst-case | Tail risk metrics |
| "How correlated are my strategies?" | Tail risk, correlation | Position sizing per strategy |
| "How much drawdown might I see?" | Monte Carlo | Historical max drawdown from stats |

Ask: "What aspect of risk would you like to explore?"

Then use `list_backtests` to identify the target block.

### Step 2: Run Appropriate Analysis

Based on the user's goal:

**For Position Sizing (Kelly Criterion):**

Call `get_position_sizing` with the user's capital base.

Key parameters:
- `capitalBase`: Starting capital (required)
- `kellyFraction`: "full", "half" (default), or "quarter"
- `maxAllocationPct`: Cap per strategy (default: 25%)
- `minTrades`: Minimum trades for valid calculation (default: 10)

The tool returns:
- Win rate and payoff ratio (inputs to Kelly formula)
- Raw Kelly percentage (what the formula suggests)
- Adjusted allocations at full/half/quarter Kelly
- Per-strategy breakdown if multiple strategies exist
- Warnings (e.g., "Portfolio Kelly exceeds 25%", "negative Kelly")

**Important context for Kelly:**
- Full Kelly is mathematically optimal but assumes perfect knowledge of edge
- Half Kelly is commonly used to account for estimation uncertainty
- Negative Kelly indicates historical losses exceeded wins (Kelly formula doesn't apply)

**For Worst-Case Projections:**

Call `run_monte_carlo` with worst-case injection:
- `includeWorstCase: true` (default)
- `worstCasePercentage: 5` (default - 5% of simulation is worst-case)
- `worstCaseMode: "pool"` (adds synthetic losses) or `"guarantee"` (ensures worst appears)

Focus on:
- 5th percentile outcome (valueAtRisk.p5)
- Probability of profit
- Mean and median max drawdown

**For Tail Risk (Multi-Strategy):**

Call `get_tail_risk` (requires 2+ strategies).

Key parameters:
- `tailThreshold`: Percentile for "tail" events (default: 0.1 = worst 10%)
- `varianceThreshold`: For effective factors calculation (default: 0.8)

The tool returns:
- Joint tail risk matrix (do strategies fail together?)
- Effective factors (how many independent risk sources exist)
- Risk level: LOW (<0.3), MODERATE (0.3-0.5), HIGH (>0.5)
- Copula correlation (statistical dependency structure)

### Step 3: Cross-Reference

Risk analysis benefits from multiple perspectives:

| Primary Analysis | Also Run |
|------------------|----------|
| Position sizing | Monte Carlo to see drawdown projections |
| Monte Carlo | Position sizing to see Kelly metrics |
| Tail risk | Position sizing for per-strategy Kelly |

This surfaces different facets of the same underlying data.

### Step 4: Present Findings

Synthesize findings into what the data reveals:

**Position Sizing Metrics:**
- Win rate: [value]% | Payoff ratio: [value]
- Kelly formula suggests: [value]% (based on historical data)
- At half Kelly: [dollar amount] of [capital base]
- [Any warnings from the tool]

**Monte Carlo Projections (if run):**
- 5th percentile return: [value]
- Probability of profit: [value]%
- Mean max drawdown: [value]%

**Tail Risk (if applicable):**
- Average joint tail risk: [value] ([LOW/MODERATE/HIGH])
- Effective factors: [value] of [strategy count]
- [Note any high-risk pairs]

**What stands out:**
- [Highlight notable findings]
- [Surface any warnings from the tools]
- [Note relationships between metrics]

Present these as insights from the historical data, letting the user decide what fits their situation.

## Interpretation References

- [references/kelly-guide.md](references/kelly-guide.md) - Kelly criterion explained
- [references/tail-risk.md](references/tail-risk.md) - Understanding fat tails

## Common Scenarios

### "I have $100,000 - what does Kelly suggest?"

1. Run position sizing with `capitalBase: 100000`
2. Review the Kelly percentages and warnings
3. Surface both raw Kelly and half-Kelly figures
4. Note that Kelly assumes independent trades and known edge

### "Do my strategies fail together?"

1. Run tail risk analysis
2. Look at joint tail risk matrix for high values
3. Check effective factors (closer to 1 = more correlated risk)
4. High correlation means drawdowns may compound

### "What's the worst realistic outcome?"

1. Run Monte Carlo with worst-case injection
2. Focus on 5th percentile (1 in 20 scenario based on resampled history)
3. Look at max drawdown distribution
4. Note this resamples historical data - unknown risks aren't captured

## Related Skills

After risk analysis:
- `/tradeblocks-health-check` - Full metrics overview
- `/tradeblocks-wfa` - Test parameter robustness

## Notes

- Kelly assumes independent trades; real trades may be correlated
- Historical volatility may underestimate future extremes
- Monte Carlo resamples history - it can't predict unknown risks
- Negative Kelly means the formula doesn't apply (no positive edge in historical data)
