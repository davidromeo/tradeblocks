# Why Diversification Matters

Understanding the benefits and limitations of portfolio diversification.

## The Core Idea

Diversification reduces portfolio risk without necessarily reducing expected return.

**Mathematical basis:** If two strategies have the same expected return but imperfect correlation, combining them produces:
- Same expected return (average of both)
- Lower volatility (correlation effect)
- Higher Sharpe ratio

## How Diversification Works

### Perfect Correlation (+1.0)

Two perfectly correlated strategies:
- Move identically
- Drawdowns happen simultaneously
- No diversification benefit
- Portfolio volatility = weighted average

### Zero Correlation (0.0)

Two uncorrelated strategies:
- Move independently
- Drawdowns may offset
- Good diversification benefit
- Portfolio volatility < weighted average

### Perfect Negative Correlation (-1.0)

Two perfectly negatively correlated strategies:
- Move opposite
- Drawdowns of one = gains of other
- Maximum diversification benefit
- Portfolio volatility can approach zero

**Reality:** Perfect negative correlation with positive returns doesn't exist. It would be arbitrage.

## Quantifying Diversification Benefit

### Portfolio Volatility Formula

For two strategies with correlation ρ:

```
σ_portfolio² = w1²σ1² + w2²σ2² + 2w1w2ρσ1σ2
```

Where:
- w = weight
- σ = volatility
- ρ = correlation

**Key insight:** The 2w1w2ρσ1σ2 term is what makes diversification work. When ρ < 1, portfolio volatility is less than weighted average.

### Diversification Ratio

```
Diversification Ratio = Weighted Average Volatility / Portfolio Volatility
```

- Ratio = 1.0: No diversification benefit
- Ratio = 1.5: Portfolio is 50% less volatile than average
- Higher = better diversification

## Common Diversification Mistakes

### 1. Diversification Across Correlated Strategies

Having 5 strategies that all sell SPY puts is NOT diversification. They're all:
- Short volatility
- Long the same underlying
- Exposed to the same tail risk

**True diversification** requires different:
- Underlyings (not just SPY)
- Directional bets (long and short)
- Risk exposures (vol, rates, direction)

### 2. Confusing Number with Diversity

10 strategies ≠ diversified portfolio.

What matters is the correlation structure, not the count.

**Example:**
- 3 uncorrelated strategies: Well diversified
- 10 highly correlated strategies: Poorly diversified

### 3. Ignoring Tail Behavior

Strategies uncorrelated in normal markets may become correlated in crashes.

**During 2008:**
- Equity long/short: Lost
- Credit spreads: Lost
- Volatility selling: Lost
- "Diversified" portfolios: Lost together

### 4. Assuming Correlation Is Stable

Correlation changes over time:
- Bull market: Lower correlations
- Crisis: Higher correlations
- Rate hikes: Changed relationships

Build portfolios for stressed correlation, not average correlation.

## When Diversification Fails

### Liquidity Crises

When everyone needs to sell:
- Correlations spike to 1
- All "diversifying" strategies lose
- No buyer for any asset

### Common Factor Exposure

Strategies may seem uncorrelated but share:
- Leverage dependency
- Volatility exposure
- Liquidity premium

During stress, the common factor dominates.

### Concentrated Drawdown Timing

Two strategies with 0.3 correlation:
- Can still have overlapping worst month
- Diversification is about probability, not guarantee
- 0.3 correlation = 65% chance of same direction

## Practical Diversification Checklist

### Before Adding a Strategy, Check:

- [ ] Correlation to existing strategies < 0.5
- [ ] Different underlying exposures
- [ ] Different market direction bets
- [ ] Different volatility exposures
- [ ] No shared tail risk

### Portfolio Construction Guidelines:

1. **Start with correlation matrix**
   - Identify highly correlated pairs
   - Look for negative correlations (rare)

2. **Check exposure overlap**
   - Same underlyings?
   - Same volatility bet?
   - Same time horizon?

3. **Stress test together**
   - What happens in 2008-like event?
   - What if VIX spikes to 50?
   - What if rates move 200bps?

4. **Size for crisis correlation**
   - Assume correlation doubles in crisis
   - Reduce position sizes accordingly

## Effective Number of Strategies

**Effective diversification = number of independent bets**

Use effective factors from tail risk analysis:

| Strategies | Effective Factors | Interpretation |
|------------|-------------------|----------------|
| 5 | 5.0 | Perfect independence |
| 5 | 3.0 | Moderate correlation |
| 5 | 1.5 | High correlation |
| 5 | 1.0 | All the same bet |

**Target:** Effective factors should be at least 50% of strategy count.

## Position Sizing with Diversification

### Equal Volatility Weighting

Instead of equal dollar allocation:
- Weight inversely to volatility
- Higher vol strategies get smaller weight
- Equalizes contribution to portfolio risk

### Correlation-Aware Sizing

Highly correlated strategies should:
- Be treated as ONE strategy for sizing
- Share a combined max allocation
- Not exceed single-strategy limits together

**Example:**
- Strategy A and B: 0.8 correlation
- Treat as one strategy
- Combined max allocation: 25% (not 25% each)

## Summary

1. **Diversification works** when correlation < 1
2. **Correlation of 0.3-0.4** is achievable and valuable
3. **Tail correlation** is higher - plan for it
4. **Number of strategies ≠ diversification**
5. **Check underlying exposures**, not just correlation
6. **Size for stressed conditions**, not average
7. **Effective factors** measure true diversification

The goal is to build a portfolio where:
- Strategies profit in different conditions
- Drawdowns don't all happen together
- The whole is more stable than the parts
