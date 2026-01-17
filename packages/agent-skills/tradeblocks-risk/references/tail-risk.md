# Tail Risk Guide

Understanding extreme events and their impact on trading strategies.

## What Are Fat Tails?

### Normal Distribution (Thin Tails)

The normal (Gaussian) distribution assumes:
- Most returns cluster around the mean
- Extreme events are very rare
- 99.7% of data within 3 standard deviations

A "3-sigma" event should occur about once every 740 trades.

### Fat-Tailed Distributions

Real trading returns often have fat tails:
- Extreme events happen more often than normal predicts
- 3-sigma events may occur every 50-100 trades
- Occasional catastrophic losses

**Why this matters:** Standard risk metrics (Sharpe, VaR) assume normality and underestimate tail risk.

## Measuring Fat Tails

### Kurtosis

**Definition:** The fourth moment of a distribution, measuring "tailedness."

**Interpretation:**
| Kurtosis | Name | Meaning |
|----------|------|---------|
| = 3 | Mesokurtic | Normal distribution |
| > 3 | Leptokurtic | Fat tails (common in trading) |
| < 3 | Platykurtic | Thin tails (rare in trading) |

**Common values in trading:**
- Stock returns: 4-6
- Options strategies: 5-15
- Trend-following: 3-5

**Action:**
- Kurtosis 3-5: Mild fat tails; reduce position size slightly
- Kurtosis 5-10: Moderate fat tails; use half of calculated size
- Kurtosis >10: Severe fat tails; very conservative sizing

### Skewness

**Definition:** Asymmetry of the return distribution.

**Interpretation:**
| Skewness | Meaning | Example |
|----------|---------|---------|
| = 0 | Symmetric | Equal chance of big wins/losses |
| > 0 | Right skew | Occasional large wins |
| < 0 | Left skew | Occasional large losses |

**Trading context:**
- Trend-following: Typically positive skew (small losses, occasional big wins)
- Premium selling: Typically negative skew (many small wins, rare big losses)

**The danger combo:** Negative skew + high kurtosis = frequent small profits, rare catastrophic losses.

### Joint Tail Dependence

**Definition:** The probability that two strategies have extreme losses simultaneously.

**Why it matters:**
- Diversification fails when you need it most
- Portfolio risk is much higher than individual risks suggest
- "Uncorrelated" strategies may become correlated in crises

**Measuring:**
- Copula-based tail dependence coefficient
- Values range from 0 (independent tails) to 1 (perfect tail dependence)

**Thresholds:**
| Joint Tail Risk | Rating | Action |
|-----------------|--------|--------|
| < 0.2 | Low | Good diversification |
| 0.2 - 0.4 | Moderate | Some shared risk |
| 0.4 - 0.6 | High | Reduce combined position |
| > 0.6 | Very High | Effectively same strategy |

## Why Tail Risk Matters

### Black Swan Events

Rare events that:
- Are unpredictable
- Have massive impact
- Seem obvious in hindsight

Examples:
- 1987 crash: S&P 500 down 20% in one day
- 2008 financial crisis: Correlations spiked to 1
- 2020 pandemic: VIX from 12 to 82 in weeks

### The Problem with Historical Data

Historical samples may not include:
- Market structure changes
- Unprecedented events
- Regime shifts

**Solution:** Assume tails are fatter than historical data suggests.

### Leverage Amplifies Tail Risk

Even small fat tails become dangerous with leverage:
- 2x leverage on a fat-tailed strategy
- A 10% "tail event" becomes 20%
- With margin calls, could be forced to liquidate at worst prices

## Adjusting for Tail Risk

### Position Sizing Adjustments

| Kurtosis | Kelly Adjustment |
|----------|------------------|
| 3-4 | Use full calculated Kelly |
| 4-6 | Use 75% of Kelly |
| 6-10 | Use 50% of Kelly |
| >10 | Use 25% of Kelly or less |

### Portfolio Adjustments

For high joint tail dependence:
1. Treat correlated strategies as one for sizing
2. Reduce total exposure
3. Add truly uncorrelated assets

### Stop Losses and Tail Risk

Stop losses may not protect against tail risk:
- Gaps can blow past stops
- Liquidity dries up during crashes
- Execution at much worse prices

**Alternative protections:**
- Options hedges (put purchases)
- Smaller base position
- Cash reserves

## Tail Risk in Different Strategies

### Trend Following

**Typical profile:**
- Positive skew
- Moderate kurtosis (4-6)
- Occasional large wins offset many small losses

**Tail risk:** Whipsaws during ranging markets can compound into large drawdowns.

### Premium Selling (Options)

**Typical profile:**
- Negative skew
- High kurtosis (6-15)
- Many small wins, rare catastrophic losses

**Tail risk:** Black swan events can wipe out years of profits in days. The strategy appears safe until it isn't.

### Mean Reversion

**Typical profile:**
- Variable skew
- Moderate to high kurtosis
- Works until it doesn't (trend continues)

**Tail risk:** Catching a falling knife; losses can accelerate as position size increases.

## Analyzing Tail Risk in TradeBlocks

### Using get_tail_risk

The tool calculates:
- **Joint tail risk matrix:** Tail dependence between strategy pairs
- **Effective factors:** How many independent risk sources
- **Marginal contributions:** Which strategies drive portfolio tail risk

### Interpreting Results

**Good diversification:**
- Low joint tail risk (<0.3 average)
- Multiple effective factors (>3)
- No single strategy dominates tail risk

**Poor diversification:**
- High joint tail risk (>0.5 average)
- Few effective factors (1-2)
- Single strategy dominates

### Example Interpretation

```
Joint Tail Risk Matrix:
       Strat A  Strat B  Strat C
Strat A  1.0     0.6      0.2
Strat B  0.6     1.0      0.3
Strat C  0.2     0.3      1.0

Effective Factors: 2.1
```

**Reading:**
- A and B have high tail dependence (0.6): likely to fail together
- C is relatively independent
- Only 2.1 effective factors despite 3 strategies
- A and B should be treated as one strategy for sizing

## Practical Recommendations

### For New Strategies

1. Measure kurtosis and skewness from backtest
2. If kurtosis > 5, apply 50% Kelly reduction
3. If negative skew, expect occasional large drawdowns
4. Run Monte Carlo with worst-case injection

### For Portfolios

1. Calculate joint tail dependence
2. Reduce position if joint risk > 0.4
3. Seek truly uncorrelated additions
4. Maintain cash reserves for opportunities after crashes

### General Rules

- **Assume fatter tails** than data suggests
- **Size for the 99th percentile** loss, not average
- **Correlation increases in crises**: plan for it
- **Negative skew strategies** require extra caution

## Summary

1. **Fat tails are normal** in trading; thin tails are rare
2. **Kurtosis > 5** requires position size reduction
3. **Negative skew + high kurtosis** = dangerous combination
4. **Joint tail risk** can destroy portfolio diversification
5. **Historical data underestimates** future extremes
6. **Size conservatively** and maintain cash reserves

The goal is not to avoid tail risk entirely (that's impossible) but to survive it and potentially profit from it.
