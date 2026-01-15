# Kelly Criterion Guide

The Kelly criterion determines the optimal fraction of capital to risk on a bet with positive expected value.

## The Kelly Formula

### Basic Formula (Binary Outcomes)

```
f* = p - (1-p)/b
```

Where:
- f* = fraction of capital to bet
- p = probability of winning (win rate)
- b = payoff ratio (average win / average loss)

### Trading Version

For trading with variable win/loss sizes:

```
f* = (W × avgWin - L × avgLoss) / avgWin
```

Or equivalently:
```
f* = W - (L / R)
```

Where:
- W = win rate
- L = loss rate (1 - W)
- R = reward-to-risk ratio (avgWin / avgLoss)

## Why Kelly?

### The Goal: Maximize Long-Term Growth

Kelly maximizes the expected logarithm of wealth, which:
- Maximizes long-term compound growth rate
- Never risks total ruin (in theory)
- Balances return vs. risk optimally

### Example Calculation

Strategy statistics:
- Win rate: 55%
- Average win: $200
- Average loss: $100
- Payoff ratio: 2.0

```
Kelly = 0.55 - (0.45 / 2.0)
Kelly = 0.55 - 0.225
Kelly = 0.325 or 32.5%
```

This suggests betting 32.5% of capital on each trade.

## Full Kelly vs. Fractional Kelly

### Why Full Kelly Is Too Aggressive

Full Kelly assumes:
- You know the exact edge
- Outcomes are independent
- You can tolerate extreme volatility

In practice:
- Edge is estimated, not known
- Trades may be correlated
- Psychological limits matter

### Half-Kelly: The Recommended Approach

Half-Kelly (0.5 × full Kelly) provides:
- ~75% of the growth rate
- ~50% of the volatility
- Much lower probability of ruin

**Why this works:** The Kelly curve is relatively flat near the peak. Going from 100% Kelly to 50% Kelly barely reduces growth but dramatically reduces risk.

| Kelly Fraction | Growth Rate | Volatility | Drawdown Risk |
|----------------|-------------|------------|---------------|
| Full (100%) | 100% | 100% | High |
| Half (50%) | 75% | 50% | Moderate |
| Quarter (25%) | 50% | 25% | Low |

### When to Use Each Fraction

**Full Kelly:**
- Very confident in edge estimate
- Can handle 50%+ drawdowns
- Long time horizon

**Half Kelly (recommended):**
- Reasonable confidence
- Moderate drawdown tolerance
- Most traders should use this

**Quarter Kelly:**
- Uncertain about edge
- Low drawdown tolerance
- Capital preservation priority

## Interpreting Kelly Results

### Positive Kelly

| Kelly % | Interpretation | Action |
|---------|----------------|--------|
| 0-5% | Marginal edge | May not be worth trading after costs |
| 5-15% | Moderate edge | Trade with half-Kelly (2.5-7.5%) |
| 15-25% | Strong edge | Use half-Kelly; likely robust |
| >25% | Very high | Probably overfit; use cautiously |

### Negative Kelly

A negative Kelly means the strategy has negative expected value:
- Lose money on average
- **Do not trade**

Possible causes:
- Bad strategy
- High costs not factored in
- Insufficient sample size

### Implausibly High Kelly

Kelly > 40% usually indicates:
- Overfit parameters
- Favorable sample
- Data errors

**Rule of thumb:** Cap Kelly at 25% regardless of calculation. Use half of that (12.5%) maximum.

## Kelly Limitations

### Assumption Violations

**Independence:**
- Kelly assumes each trade is independent
- Multiple concurrent positions violate this
- Correlated strategies amplify risk

**Known Probabilities:**
- We estimate win rate from data
- True probability may differ
- Small samples = high estimation error

**Constant Edge:**
- Kelly assumes stable edge
- Markets change; edge may decay
- Recent performance may not predict future

### Estimation Error

With N trades, win rate estimate has standard error:
```
SE = sqrt(p(1-p)/N)
```

Example with 50 trades, 60% win rate:
```
SE = sqrt(0.6 × 0.4 / 50) = 0.069 or 6.9%
```

True win rate could be 53% to 67%. This uncertainty justifies fractional Kelly.

### Minimum Sample Size

| Trades | Confidence in Kelly |
|--------|---------------------|
| <20 | Very low |
| 20-50 | Low |
| 50-100 | Moderate |
| 100-200 | Good |
| >200 | High |

With fewer than 50 trades, Kelly estimates are unreliable. Use quarter-Kelly or smaller.

## Multi-Strategy Kelly

When trading multiple strategies:

### Independent Strategies

If strategies are uncorrelated, sum individual Kelly allocations:
```
Total = Kelly_A + Kelly_B + Kelly_C
```

But this often exceeds 100%, so:
1. Calculate individual Kellys
2. Scale proportionally to fit capital
3. Or use mean-variance optimization instead

### Correlated Strategies

If strategies are correlated:
- Simple addition overestimates optimal allocation
- Need portfolio-level Kelly
- Consider correlation in position sizing

**Rule of thumb:** If correlation > 0.5, treat as single strategy for Kelly purposes.

## Practical Application

### Step-by-Step Position Sizing

1. **Calculate raw Kelly** from win rate and payoff ratio
2. **Apply fraction** (half-Kelly recommended)
3. **Apply cap** (max 15-20% per strategy)
4. **Check total exposure** (sum shouldn't exceed 100%)
5. **Cross-validate** with Monte Carlo

### Example

Strategy stats:
- Win rate: 60%
- Payoff ratio: 1.5
- Raw Kelly: 60% - 40%/1.5 = 33.3%

Position sizing:
- Half-Kelly: 16.7%
- With 20% cap: 16.7% (no cap applied)
- Final recommendation: 16-17% of capital

### Red Flags

Be cautious if:
- Kelly > 40%: Likely overfit
- Kelly < 0%: Losing strategy
- Kelly highly variable across periods
- Win rate or payoff ratio seems too good

## Summary

1. **Use half-Kelly** as default position size
2. **Cap at 15-20%** per strategy
3. **Need 50+ trades** for reliable estimates
4. **Negative Kelly = don't trade**
5. **Very high Kelly = probably overfit**

Kelly is a guide, not a prescription. Combine with Monte Carlo and drawdown analysis for robust position sizing.
