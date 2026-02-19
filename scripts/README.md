# TradingView Export Scripts

Pine Script indicators for exporting market data. Export CSVs to `~/backtests/_marketdata/` for use with the TradeBlocks MCP server.

## Script Overview

### Daily Data (apply to your underlying's daily chart)

| Script | Purpose | Output |
|--------|---------|--------|
| `spx-daily.pine` | Daily market context with highlow timing and enriched VIX | `<ticker>_daily.csv` (example: `spx_daily.csv`, `msft_daily.csv`) |

Includes: OHLC, gap/return metrics, VIX term structure, vol regime, RSI, ATR, trend score, calendar context, highlow timing (via `request.security_lower_tf`), and enriched VIX fields (gap, 9D/3M opens, high/low).

### 15-Minute Checkpoints (apply to your underlying's 5-min chart)

| Script | Granularity | Checkpoints/Day | Best For |
|--------|-------------|-----------------|----------|
| `spx-15min-checkpoints.pine` | 15 min | 26 | MOC analysis, granular intraday |

### VIX Intraday (apply to VIX 5-min chart)

| Script | Purpose | Output |
|--------|---------|--------|
| `vix-intraday.pine` | VIX checkpoints and session moves | `vix_intraday.csv` (global) or `<scope>_vix_intraday.csv` |

> **Note:** ORB (Opening Range Breakout) is calculated dynamically by the MCP server from checkpoint data, allowing flexible start/end times.

## Quick Start

1. **Open TradingView** and load the appropriate chart (underlying or VIX)
2. **Set timeframe**: Daily for spx-daily, 5-min for others
3. **Add indicator**: Pine Editor → paste script → Add to Chart
4. **Set date range**: Click calendar icon, select range (2022+ recommended)
5. **Export**: Right-click indicator pane → "Export chart data..."
6. **Save**: Place CSV in `~/backtests/_marketdata/`

## Output Filenames

| Script | Output Filename Pattern |
|--------|-----------------|
| `spx-daily.pine` | `<ticker>_daily.csv` |
| `spx-15min-checkpoints.pine` | `<ticker>_15min.csv` |
| `vix-intraday.pine` | `vix_intraday.csv` or `<scope>_vix_intraday.csv` |

### Naming Conventions (Required for Auto-Sync)

The MCP server auto-discovers market files in `_marketdata` using these patterns:

- `<ticker>_daily.csv` → `market.spx_daily`
- `<ticker>_15min.csv` → `market.spx_15min`
- `<scope>_vix_intraday.csv` → `market.vix_intraday`
- `vix_intraday.csv` → `market.vix_intraday` with global scope `ALL`

For VIX files, `<scope>` is a join namespace key (not a literal VIX ticker). In most cases, use the global `vix_intraday.csv`.

Examples:

```text
_marketdata/
  spx_daily.csv
  spx_15min.csv
  msft_daily.csv
  msft_15min.csv
  vix_intraday.csv
```

## Data Fields

### Daily Market Data (`<ticker>_daily.csv`)

**Price & Movement**:
- `Prior_Close`, `Open`, `High`, `Low`, `Close`
- `Gap_Pct`, `Intraday_Range_Pct`, `Intraday_Return_Pct`, `Total_Return_Pct`
- `Close_Position_In_Range` - Where close is in day's range (0-1)
- `Gap_Filled` - Did price fill the gap?

**VIX & Volatility**:
- `VIX_Open`, `VIX_Close`, `VIX_Change_Pct`, `VIX_Spike_Pct`
- `VIX_Percentile` - VIX vs last 252 days
- `Vol_Regime` - 1=Very Low, 2=Low, 3=Normal, 4=Elevated, 5=High, 6=Extreme

**Enriched VIX Fields**:
- `VIX_Gap_Pct` - VIX open vs prior close gap (%)
- `VIX9D_Open`, `VIX9D_Change_Pct` - 9-day VIX open and daily change
- `VIX_High`, `VIX_Low` - Intraday VIX extremes
- `VIX3M_Open`, `VIX3M_Change_Pct` - 3-month VIX open and daily change

**VIX Term Structure**:
- `VIX9D_Close`, `VIX3M_Close`
- `VIX9D_VIX_Ratio`, `VIX_VIX3M_Ratio` - short/long ratios (<1 = contango, >1 = backwardation)
- `Term_Structure_State` - -1=backwardation, 0=flat, 1=contango

**Technical**:
- `ATR_Pct`, `RSI_14`
- `Price_vs_EMA21_Pct`, `Price_vs_SMA50_Pct`
- `Trend_Score` - 0-4 (above 9/21 EMA, 50/200 SMA)
- `BB_Position` - Position in Bollinger Bands (0-1)

**Momentum**:
- `Return_5D`, `Return_20D`
- `Consecutive_Days` - Consecutive up/down days

**Calendar**:
- `Day_of_Week` - 2=Mon...6=Fri
- `Month` - 1-12
- `Is_Opex` - 1 if monthly options expiration
- `Prev_Return_Pct` - Prior day's return

**Highlow Timing**:
- `High_Time`, `Low_Time` - Decimal hours (15.5 = 3:30 PM)
- `High_Before_Low` - 1 if high came first
- `High_In_First_Hour`, `Low_In_First_Hour`
- `High_In_Last_Hour`, `Low_In_Last_Hour`
- `Reversal_Type` - 1=morning high/afternoon low, -1=opposite
- `High_Low_Spread` - Time spread between high and low (hours)
- `Early_Extreme` - 1 if both high and low in first 2 hours
- `Late_Extreme` - 1 if both high and low in last 2 hours
- `Intraday_High`, `Intraday_Low` - Intrabar high/low prices

Note: Highlow timing fields use intrabar data and are available for the most recent ~5 years. Older dates will have na values for these fields.

### 15-Minute Checkpoints (`<ticker>_15min.csv`)

**Prices**: `P_0930` through `P_1545` (26 checkpoints)

**MOC Metrics**:
- `MOC_15min` - 3:45 → close
- `MOC_30min` - 3:30 → close
- `MOC_45min` - 3:15 → close
- `MOC_60min` - 3:00 → close
- `Afternoon_Move` - 12:00 → close

### VIX Intraday (`vix_intraday.csv` or `<scope>_vix_intraday.csv`)

**Prices**: `VIX_0930` through `VIX_1545` (14 checkpoints)

**Session Moves**:
- `VIX_Morning_Move`, `VIX_Afternoon_Move`
- `VIX_Power_Hour_Move`, `VIX_Last_30min_Move`
- `VIX_First_Hour_Move`, `VIX_Full_Day_Move`

**Spike/Crush Detection**:
- `VIX_Spike_From_Open` - Max rise from open (%)
- `VIX_Spike_Flag` - 1 if >10% spike
- `VIX_Crush_From_Open` - Max drop from open (%)
- `VIX_Crush_Flag` - 1 if >10% crush

## MCP Server Integration

After exporting, the MCP server automatically syncs CSVs into DuckDB. Use `run_sql` to query market data and join with trades:

```sql
-- Win rate by VIX regime (ticker-aware join)
SELECT m.Vol_Regime, COUNT(*) as trades,
  ROUND(100.0 * SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate
FROM trades.trade_data t
JOIN market.spx_daily m
  ON COALESCE(NULLIF(t.ticker, ''), 'SPX') = m.ticker
 AND CAST(t.date_opened AS VARCHAR) = m.date
WHERE t.block_id = 'my-strategy'
GROUP BY m.Vol_Regime ORDER BY m.Vol_Regime
```

Dedicated tools (`analyze_regime_performance`, `suggest_filters`, `calculate_orb`) also query this data automatically.

## Tips

1. **Chart timeframe**: Use Daily for `spx-daily`, 5-min for checkpoint and VIX scripts.

2. **Date range limits**: TradingView may limit export rows. For long history, export in yearly chunks.

3. **Missing data**: Holidays and early closes will have `na` values for some checkpoints.

4. **Timezone**: All times are US Eastern (ET). Scripts handle EST/EDT automatically.

5. **Ticker naming**: Keep ticker prefixes consistent across files (`msft_daily.csv` with `msft_15min.csv`) so joins are accurate.
