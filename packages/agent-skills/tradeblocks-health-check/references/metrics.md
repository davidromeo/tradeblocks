# Trading Performance Metrics Reference

Detailed explanations of key metrics used in strategy health assessment.

## Risk-Adjusted Return Metrics

### Sharpe Ratio

**Formula:** (Average Return - Risk-Free Rate) / Standard Deviation of Returns

**What it measures:** Return per unit of total risk (volatility).

**Interpretation:**
| Value | Rating | Meaning |
|-------|--------|---------|
| < 0 | Poor | Losing money on average |
| 0 - 0.5 | Weak | Returns don't justify the volatility |
| 0.5 - 1.0 | Acceptable | Marginal edge |
| 1.0 - 2.0 | Good | Solid risk-adjusted returns |
| > 2.0 | Excellent | Strong edge relative to risk |

**Limitations:**
- Penalizes upside volatility equally with downside
- Assumes normally distributed returns
- Can be manipulated by infrequent trading

### Sortino Ratio

**Formula:** (Average Return - Target Return) / Downside Deviation

**What it measures:** Return per unit of downside risk only.

**Why it matters:** Unlike Sharpe, Sortino only penalizes negative volatility. A strategy with large winning trades but controlled losses will have a higher Sortino than Sharpe.

**Interpretation:**
| Value | Rating |
|-------|--------|
| < 1.0 | Weak |
| 1.0 - 1.5 | Acceptable |
| 1.5 - 2.5 | Good |
| > 2.5 | Excellent |

### Calmar Ratio

**Formula:** CAGR / Maximum Drawdown

**What it measures:** Annual return relative to worst historical loss.

**Why it matters:** Directly addresses the question "How much do I earn per unit of pain?"

**Interpretation:**
| Value | Rating |
|-------|--------|
| < 0.5 | Poor |
| 0.5 - 1.0 | Acceptable |
| 1.0 - 2.0 | Good |
| > 2.0 | Excellent |

## Win/Loss Metrics

### Win Rate

**Formula:** Winning Trades / Total Trades

**Interpretation:** Context-dependent. A 30% win rate with 3:1 reward-to-risk can be highly profitable.

**Common misconception:** High win rate = good strategy. In reality, win rate must be evaluated alongside profit factor and average win/loss.

### Profit Factor

**Formula:** Gross Profit / Gross Loss (absolute value)

**What it measures:** How much you make for every dollar you lose.

**Interpretation:**
| Value | Rating |
|-------|--------|
| < 1.0 | Losing money |
| 1.0 - 1.2 | Marginal (commissions may erode) |
| 1.2 - 1.5 | Acceptable |
| 1.5 - 2.0 | Good |
| > 2.0 | Excellent |

**Why it matters:** Profit factor combines win rate and average win/loss into a single number. A profit factor of 2.0 means you make $2 for every $1 lost.

## Drawdown Metrics

### Maximum Drawdown

**Formula:** (Peak Value - Trough Value) / Peak Value

**What it measures:** Largest peak-to-trough decline in portfolio value.

**Interpretation:**
| Value | Risk Level | Notes |
|-------|------------|-------|
| < 10% | Very Low | Conservative strategy |
| 10-20% | Low | Typical for good strategies |
| 20-30% | Moderate | Expect emotional challenge |
| 30-40% | High | Difficult to recover from psychologically |
| > 40% | Very High | May take years to recover |

**Recovery math:** A 50% drawdown requires 100% gain to recover. A 20% drawdown only requires 25% gain.

### Time in Drawdown

**What it measures:** Percentage of time the portfolio spent below its previous peak.

**Why it matters:** A strategy might have a 15% max drawdown but spend 80% of its time in drawdown, which is psychologically challenging.

## Position Sizing Metrics

### Kelly Criterion

**Formula:** (Win Rate × Average Win - Loss Rate × Average Loss) / Average Win

Or simplified: Win Rate - (Loss Rate / Payoff Ratio)

**What it measures:** Theoretically optimal bet size to maximize long-term growth.

**Interpretation:**
| Value | Recommendation |
|-------|----------------|
| Negative | Do not trade |
| 0-5% | Edge may not justify risk |
| 5-15% | Use half-Kelly (2.5-7.5%) |
| 15-25% | Use quarter-Kelly (4-6%) |
| > 25% | Likely overfit; use max 10% |

**Why half-Kelly:** Full Kelly assumes perfect knowledge of edge. In practice, we estimate from historical data. Half-Kelly provides ~75% of Kelly growth with ~50% of the volatility.

**Caveats:**
- Kelly assumes independent bets
- Doesn't account for correlation between positions
- Historical edge may not persist

## Statistical Properties

### Kurtosis (Tail Risk)

**What it measures:** How "fat" the tails of the return distribution are.

**Interpretation:**
- Kurtosis = 3: Normal distribution (mesokurtic)
- Kurtosis > 3: Fat tails (leptokurtic) - extreme events more likely
- Kurtosis < 3: Thin tails (platykurtic) - extreme events less likely

**Why it matters:** High kurtosis means occasional extreme losses are more likely than a normal distribution would suggest. Position sizing should be more conservative.

### Skewness

**What it measures:** Asymmetry of the return distribution.

**Interpretation:**
- Skewness = 0: Symmetric
- Skewness > 0: Positive skew (more large wins than losses)
- Skewness < 0: Negative skew (more large losses than wins)

**Why it matters:** Negative skewness combined with high kurtosis (common in premium-selling strategies) means rare catastrophic losses.

## Monte Carlo Metrics

### Probability of Profit

**What it measures:** Percentage of simulated paths that end profitable.

**Target:** > 90% for conservative strategies, > 80% for aggressive.

### Value at Risk (VaR)

**What it measures:** The worst expected loss at a given confidence level.

**Example:** 5% VaR of -30% means there's a 5% chance of losing 30% or more.

### Percentile Bands

**What they show:** Range of outcomes across simulations.

- 5th percentile: Worst 1-in-20 outcome
- 25th percentile: Below-average outcome
- 50th percentile: Median outcome
- 75th percentile: Above-average outcome
- 95th percentile: Best 1-in-20 outcome

**How to use:** If you wouldn't be comfortable with the 5th percentile outcome, reduce position size or don't trade the strategy.
