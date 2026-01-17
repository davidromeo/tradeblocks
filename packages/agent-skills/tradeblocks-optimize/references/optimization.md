# Optimization vs Overfitting

Understanding when parameter optimization helps and when it hurts.

## What Is Overfitting?

Overfitting occurs when a model or strategy is tuned to fit historical noise rather than real patterns.

**Symptoms:**
- Excellent backtest results
- Poor live performance
- Parameters that make no economic sense
- Extreme sensitivity to small parameter changes

**Example:**
- Backtest: "Trades at 10:42 AM have 90% win rate!"
- Reality: Random chance from small sample
- Result: Live trading at 10:42 AM performs no better than other times

## Why Overfitting Happens

### 1. Limited Data

With enough parameters and limited data, you can fit any pattern.

**Example:** 100 trades, testing 50 hourly × DTE × delta combinations = likely to find spurious "winners"

### 2. Multiple Testing

Testing many parameters inflates false positive rate.

**At 5% significance level:**
- Test 1 parameter: 5% false positive chance
- Test 10 parameters: ~40% chance of at least one false positive
- Test 50 parameters: ~92% chance

**Formula:** P(at least one false positive) = 1 - (1 - α)^n

### 3. Hindsight Bias

Looking at results THEN choosing parameters guarantees overfitting.

**Wrong approach:**
1. Look at data
2. Notice 2PM trades did well
3. "Optimize" to 2PM
4. Claim improvement

**Right approach:**
1. Hypothesize WHY 2PM might matter (e.g., post-lunch volume)
2. Test the hypothesis
3. Validate on held-out data

### 4. Degrees of Freedom

More parameters = more ways to fit noise.

**Few parameters (robust):**
- Trade any time
- Any DTE
- Any delta

**Many parameters (fragile):**
- Trade only 10-11 AM
- Only 21-28 DTE
- Only 15-17 delta
- Only when VIX > 18

The second strategy fits historical data better but is likely overfit.

## Sample Size Requirements

### Minimum Trades per Parameter Combination

| Trades | Reliability |
|--------|-------------|
| < 10 | Meaningless (random noise) |
| 10-20 | Highly suspicious |
| 20-30 | Suggestive at best |
| 30-50 | Moderate confidence |
| 50-100 | Reasonable confidence |
| 100+ | Higher confidence |

### Total Trades Needed

Rough guideline: 30+ trades per bucket for simple analysis.

**Example:** Analyzing 5 hourly buckets = need 150+ total trades

For complex multi-parameter analysis: Much more.

## Signs of Overfitting

### 1. Too Good to Be True

A Sharpe of 5 or 95% win rate is almost certainly overfit unless the strategy is trivial.

### 2. Parameter Cliff

If slight changes in parameters cause dramatic performance changes, the "optimal" value is likely noise.

**Robust:**
- 14-17 DTE: Good
- 10-20 DTE: Also good

**Fragile (likely overfit):**
- 14-17 DTE: 80% win rate
- 10-14 DTE: 30% win rate
- 17-20 DTE: 35% win rate

### 3. No Economic Explanation

If you can't explain WHY a parameter should matter, be very suspicious.

**Explainable:**
- Avoid first 30 minutes (wide spreads, volatility)
- Target 14-21 DTE (theta decay accelerates)

**Suspicious:**
- Only Tuesday and Thursday work
- Only 16 delta, not 15 or 17
- Only when SPY is between 450-455

### 4. Walk-Forward Degradation

The acid test: Does the optimized parameter work on data the optimizer never saw?

**Healthy:**
- In-sample: +$500/trade
- Out-of-sample: +$400/trade (20% degradation, normal)

**Overfit:**
- In-sample: +$500/trade
- Out-of-sample: +$50/trade (90% degradation)

## How to Avoid Overfitting

### 1. Use Fewer Parameters

The more parameters you optimize, the more you overfit.

**Better:** Robust strategy with few constraints
**Worse:** Highly tuned strategy with many constraints

### 2. Require Economic Logic

Only optimize parameters that have a reason to matter.

**Good candidates:**
- Time of day (liquidity, volatility patterns)
- DTE (option decay dynamics)
- Delta (probability distribution)

**Suspicious candidates:**
- Specific day of week (unless earnings-related)
- Exact price levels
- Arbitrary thresholds

### 3. Use Walk-Forward Validation

Split data into:
- In-sample: Find "optimal" parameters
- Out-of-sample: Test if they work

If out-of-sample significantly degrades, the optimization is overfit.

### 4. Require Adequate Sample Size

Don't trust patterns from small samples.

**Rule of thumb:** 30+ trades per bucket minimum, 50+ preferred.

### 5. Look for Robustness, Not Optimality

A parameter range that works across nearby values is more trustworthy than a single "optimal" point.

**Test:** If 14-17 DTE is "optimal," do 12-14 and 17-20 also work? If yes, pattern may be real. If only 14-17 works, likely noise.

### 6. Apply Multiple Testing Correction

If testing many parameters, adjust significance threshold.

**Bonferroni correction:** Divide α by number of tests
- Testing 10 parameters at 5% = use 0.5% per test
- Only consider results with p < 0.005

## The Right Way to Optimize

### Step 1: Form Hypothesis First

Before looking at data, decide what you're testing and why.

**Good:** "I hypothesize that avoiding the first hour reduces slippage because spreads are wider"

**Bad:** "Let me see what looks good in the data"

### Step 2: Pre-Register Your Test

Decide in advance:
- What parameters to test
- What buckets to use
- What success looks like
- Sample size requirements

### Step 3: Run the Test

Analyze the data according to your pre-specified plan.

### Step 4: Validate on Held-Out Data

If results look promising, test on data not used in step 3.

### Step 5: Be Skeptical

Even with proper process, false discoveries happen. Consider:
- Would you bet your own money on this?
- Does it make sense economically?
- Would you trust it enough to use in live trading?

## When Optimization Is Appropriate

### Appropriate

- Avoiding known bad conditions (market open volatility)
- Aligning with strategy thesis (theta decay at specific DTE)
- Confirming expected patterns
- Understanding existing strategy behavior

### Dangerous

- Mining for any edge
- Testing dozens of combinations
- Chasing "best" parameters
- Fitting to small samples

## Summary

1. **Overfitting is easy** - historical data always has patterns
2. **Most patterns are noise** - especially with limited data
3. **Require economic logic** - if you can't explain it, don't trust it
4. **Sample size matters** - 30+ trades per bucket minimum
5. **Walk-forward is essential** - test on unseen data
6. **Robustness > Optimality** - a range that works is better than a point
7. **Be skeptical by default** - assume findings are spurious until proven otherwise

The goal of optimization is to UNDERSTAND your strategy, not to fabricate an edge that doesn't exist.
