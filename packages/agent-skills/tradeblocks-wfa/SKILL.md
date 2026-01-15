---
name: tradeblocks-wfa
description: Walk-forward analysis for trading strategies. Validates optimization robustness by testing parameters on out-of-sample data. Use when checking if optimized parameters will work in the future, detecting overfitting, or validating a backtest.
---

# Walk-Forward Analysis

Validate that strategy parameters haven't been overfit to historical data.

## What is Walk-Forward Analysis?

Walk-forward analysis (WFA) tests whether optimized parameters work on unseen data:

1. **Divide history into segments**
2. **In-Sample (IS):** Optimize parameters on this portion
3. **Out-of-Sample (OOS):** Test those parameters on data the optimizer never saw
4. **Roll forward:** Repeat across the entire history

If OOS performance matches IS performance, the strategy is robust. If OOS significantly underperforms, the parameters are likely overfit.

```
|------ IS Period 1 ------|-- OOS 1 --|
              |------ IS Period 2 ------|-- OOS 2 --|
                            |------ IS Period 3 ------|-- OOS 3 --|
```

## Prerequisites

- TradeBlocks MCP server running
- Block with sufficient trade history (50+ trades recommended)
- Strategy should have been optimized on historical data

## Process

### Step 1: Select Strategy

Use `list_backtests` to show available blocks.

Ask:
- "Which backtest contains the strategy you want to validate?"
- "Do you want to test a specific strategy or the full portfolio?"

Note the block ID and optional strategy filter for subsequent steps.

### Step 2: Understand User Goals

Walk-forward analysis answers different questions:

| Goal | What to Check |
|------|---------------|
| Validate existing parameters | Overall WF efficiency, OOS vs IS performance |
| Detect overfitting | Degradation factor, consistency across windows |
| Find optimal windows | Try different IS/OOS ratios |
| Check for regime changes | Look at individual period performance |

Ask: "What are you trying to understand about this strategy?"

### Step 3: Run Analysis

Call `run_walk_forward` with the selected block.

**Default parameters (usually appropriate):**
- 5 in-sample windows, 1 out-of-sample window
- Optimize for Sharpe ratio
- Minimum 10 IS trades, 3 OOS trades

**For short histories (< 100 trades):**
- Reduce to 3 IS windows
- Lower minimum trade counts

**For long histories (> 500 trades):**
- Increase to 7+ IS windows
- Consider explicit day parameters for more control

### Step 4: Interpret Results

Key metrics from the analysis:

**Walk-Forward Efficiency (WFE):**
- Measures how well IS performance transfers to OOS
- WFE = OOS Performance / IS Performance

| WFE | Rating | Interpretation |
|-----|--------|----------------|
| > 75% | Excellent | Parameters transfer well to unseen data |
| 50-75% | Good | Reasonable robustness |
| 25-50% | Marginal | Some overfitting; use with caution |
| < 25% | Poor | Likely overfit; don't trade these parameters |

**Parameter Stability:**
- Do optimal parameters stay consistent across periods?
- High variance = parameters are sensitive to data window

**Consistency Score:**
- How often does OOS beat a random baseline?
- >60% is good; <40% suggests luck in backtesting

### Step 5: Provide Recommendations

Based on the analysis:

**If WFE > 50% and stable parameters:**
- Strategy appears robust
- Proceed with live trading (paper trade first)
- Use half-Kelly position sizing

**If WFE 25-50%:**
- Marginal robustness
- Consider averaging parameters across windows
- Use quarter-Kelly or smaller position sizing
- Monitor closely for degradation

**If WFE < 25%:**
- Strong evidence of overfitting
- Do NOT trade with current parameters
- Consider re-optimizing with fewer parameters
- Or use a simpler strategy variant

## Interpretation Reference

For detailed walk-forward concepts, see [references/wfa-guide.md](references/wfa-guide.md).

## Next Steps

After walk-forward analysis:
- `/tradeblocks-health-check` - Full health assessment if WFA passes
- `/tradeblocks-risk` - Position sizing recommendations

## Common Issues

**"Insufficient trades for walk-forward analysis"**
- Need at least 20 trades total
- Reduce window count or use larger date range

**Low consistency but good WFE:**
- Small sample size may cause noise
- Run with more windows if data permits

**Individual periods show huge variance:**
- Market regime changes during history
- Consider regime-aware parameter selection
