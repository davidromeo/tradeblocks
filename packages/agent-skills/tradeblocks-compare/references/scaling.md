# Scaling Modes for Backtest vs Actual Comparison

Understanding how to compare performance when contract sizes differ.

## The Problem

Backtests often use different position sizes than live trading:

- **Backtest:** 10 contracts per trade (to see strategy behavior at scale)
- **Actual:** 1 contract per trade (starting small, managing risk)

Comparing raw P&L is misleading:
- Backtest: +$5,000 (10 contracts)
- Actual: +$400 (1 contract)

Is actual underperforming? Or just smaller?

## Scaling Modes

### Raw Mode

**What it does:** Shows P&L values exactly as recorded.

**When to use:**
- Contract sizes are the same
- You want to see absolute dollar differences
- Comparing total account performance

**Example:**
```
Backtest: +$5,000 (10 contracts)
Actual:   +$500   (1 contract)
```

### Per-Contract Mode

**What it does:** Divides each P&L by its contract count.

**When to use:**
- Contract sizes differ
- You want per-lot comparison
- Evaluating execution quality

**Example:**
```
Backtest: +$500/contract (5000 / 10)
Actual:   +$500/contract (500 / 1)
```

Here, both perform identically per-contract. The raw difference was purely position sizing.

### To-Reported Mode

**What it does:** Scales backtest DOWN to match actual contract counts.

**Formula:** `scaledBacktestPl = backtestPl × (actualContracts / backtestContracts)`

**When to use:**
- You want to see "what if backtest had used my actual size"
- Comparing strategies with known size differences
- The actual results are your reference point

**Example:**
```
Backtest: +$5,000 (10 contracts) → Scaled: +$500 (to match 1 contract)
Actual:   +$500   (1 contract)   → Stays:  +$500
```

## Why Backtest Has More Contracts

Common reasons:

1. **Position sizing for signals:** Backtest uses larger size to test full strategy
2. **Risk management:** Live trading starts small
3. **Capital constraints:** Can't fund full backtest size
4. **Psychological comfort:** Starting conservatively

This is normal. Scaling modes let you compare fairly.

## Which Mode to Choose

| Situation | Mode | Rationale |
|-----------|------|-----------|
| Same contract sizes | Raw | No adjustment needed |
| Different sizes, evaluating execution | Per-Contract | Shows per-lot efficiency |
| Different sizes, comparing overall | To-Reported | Normalizes to actual size |
| Unsure | Per-Contract | Most universally comparable |

## Common Comparison Pitfalls

### 1. Ignoring Fill Quality

Backtest assumes perfect fills. Reality has:
- Slippage (worse price than signal)
- Partial fills
- Missed fills entirely

Per-contract mode reveals this: if backtest shows +$50/contract but actual shows +$40/contract, that $10 difference is execution quality.

### 2. Survivorship Bias

Backtests only see strategies that survived to be tested. Live trading has no such filter.

### 3. Look-Ahead Bias

Some backtests accidentally use future data. Live trading can never do this.

### 4. Different Commission Structures

Backtest may use different commission assumptions. Always verify net P&L includes realistic costs.

### 5. Market Impact

At scale, your own trades move the market. Backtests don't model this. Live trading with large size will underperform.

## Interpreting Divergence

**Expected degradation:** 10-20% from backtest to live is normal.

| Degradation | Assessment |
|-------------|------------|
| < 10% | Excellent execution |
| 10-20% | Normal, expected |
| 20-30% | Some issues worth investigating |
| 30-50% | Significant problems |
| > 50% | Backtest may be unrealistic |

**Positive divergence (actual > backtest):**
- Rare but possible
- May indicate favorable timing or luck
- Don't assume it will continue

## Practical Example

**Scenario:** Evaluating an iron condor strategy

```
Backtest (10 lots):
- 48 trades
- +$12,000 total
- +$250/trade average
- +$25/contract average

Actual (1 lot):
- 45 trades
- +$900 total
- +$20/trade average
- +$20/contract average
```

**Analysis using Per-Contract mode:**
- Backtest: $25/contract
- Actual: $20/contract
- Degradation: 20%

**Interpretation:** 20% degradation is in the normal range. The 3 missed trades and $5/contract difference likely reflect:
- Slippage on entry/exit
- Fills at worse prices
- Possibly skipped trades during fast markets

This is reasonable real-world performance.

## Summary

1. **Choose the right scaling mode** for your comparison
2. **Per-contract is safest** for apples-to-apples comparison
3. **10-20% degradation is normal** - don't expect backtest perfection
4. **Look beyond raw P&L** at trade count, win rate, and timing
5. **Consistent degradation is okay** - it's unpredictable divergence that's concerning
