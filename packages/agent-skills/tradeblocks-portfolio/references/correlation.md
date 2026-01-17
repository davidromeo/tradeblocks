# Understanding Correlation in Trading

How to interpret correlation metrics for portfolio construction.

## Correlation Types

### Pearson Correlation

**What it measures:** Linear relationship between two variables.

**Formula:** Covariance(X,Y) / (StdDev(X) × StdDev(Y))

**Range:** -1 to +1

**Limitations for trading:**
- Assumes normal distribution
- Sensitive to outliers
- Can miss non-linear relationships
- Trading returns often violate normality assumption

### Kendall's Tau

**What it measures:** Rank-based correlation - how often pairs move in same direction.

**Why it's better for trading:**
- No distribution assumptions
- Robust to outliers
- Captures any monotonic relationship
- Better for fat-tailed distributions

**TradeBlocks uses Kendall's tau for correlation calculations.**

### Spearman's Rho

**What it measures:** Correlation of ranks (not values).

**Similar to Kendall's tau but:**
- Slightly different formula
- Both are robust non-parametric alternatives
- Kendall's tau is often preferred for smaller samples

## Interpreting Correlation Values

| Value | Relationship | Portfolio Impact |
|-------|--------------|------------------|
| -1.0 to -0.5 | Strong negative | Excellent hedge |
| -0.5 to -0.2 | Weak negative | Good diversification |
| -0.2 to +0.2 | No correlation | Independent strategies |
| +0.2 to +0.5 | Weak positive | Moderate diversification |
| +0.5 to +0.8 | Moderate positive | Limited diversification |
| +0.8 to +1.0 | Strong positive | Minimal diversification |

## Correlation vs Causation

Low correlation does NOT mean:
- Strategies are truly independent
- They won't fail together
- One hedges the other

It DOES mean:
- Historically, returns didn't move together
- Daily return patterns were different
- There's POTENTIAL for diversification

## Tail Correlation Problem

**Normal correlation** measures average behavior.

**Tail correlation** measures crisis behavior.

The problem: Strategies that appear uncorrelated in normal markets often become highly correlated during crashes.

**Example:**
- Strategy A (momentum): +0.2 correlation to Strategy B normally
- During 2008: +0.9 correlation (both crashed together)

**Why this happens:**
- Liquidity dries up for everyone
- Forced selling affects all assets
- Risk-off behavior is universal

**Implication:** Don't assume correlation stays constant. Use `/tradeblocks-risk` for tail risk analysis.

## Correlation Stability

Correlation changes over time:

**Rolling correlation** can reveal:
- Whether relationship is stable
- Regime-dependent behavior
- Recent divergence from historical

**If correlation is unstable:**
- Be more conservative in diversification assumptions
- Position size for worst-case correlation
- Monitor correlation drift

## Practical Application

### Minimum Correlation for Diversification Benefit

To meaningfully reduce portfolio volatility:
- Correlation should be < 0.5
- Ideally < 0.3
- Zero or negative is rare and valuable

### Same Underlying Exposure

Two strategies can have low correlation but still be exposed to the same risk:

**Example:**
- Strategy A: Long VIX futures
- Strategy B: Long VIX options

Correlation might be 0.4 (different instruments), but both lose if VIX drops.

**Check for hidden overlap:**
- Same underlying (SPY, VIX, etc.)
- Same market direction (both bullish)
- Same volatility bet (both short vol)

### Correlation Matrix Interpretation

When comparing multiple strategies:

```
       A     B     C     D
A    1.00  0.65  0.12  -0.05
B    0.65  1.00  0.22   0.08
C    0.12  0.22  1.00   0.35
D   -0.05  0.08  0.35   1.00
```

**Reading:**
- A and B are highly correlated (0.65) - limited benefit from both
- C and D are moderately correlated (0.35) - some shared behavior
- A and D are uncorrelated (-0.05) - good diversification pair

## Common Mistakes

### 1. Assuming Zero Correlation Is Risk-Free

Zero correlation means returns don't move together ON AVERAGE. Both can still lose money simultaneously.

### 2. Using Too Short a Period

Correlation measured over 20 trades is unreliable. Need at least 100+ data points for stable estimate.

### 3. Ignoring Regime Changes

Correlation from 2019 may not apply in 2024. Markets change.

### 4. Correlation of Levels vs Returns

Always correlate RETURNS, not prices/values. Price correlation is misleading because both series trend over time.

### 5. Confusing Low Correlation with Hedging

Low correlation ≠ hedge. A hedge specifically profits when the other loses. Low correlation just means no relationship.

## Summary

1. **Kendall's tau** is preferred for trading returns
2. **Correlation < 0.4** provides meaningful diversification
3. **Tail correlation** is higher than normal correlation
4. **Check for hidden exposure** beyond pure correlation
5. **Correlation is unstable** - don't assume it persists
6. **Low correlation ≠ hedge** - they're different concepts
