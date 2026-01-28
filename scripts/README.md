# TradingView Export Scripts

Pine Script indicators for exporting SPX/VIX market data. Export CSVs to `~/backtests/_marketdata/` for use with the TradeBlocks MCP server.

## Script Overview

### Daily Data (apply to SPX daily chart)

| Script | Purpose | Output |
|--------|---------|--------|
| `spx-daily.pine` | Comprehensive daily market context | `spx_daily.csv` |

Includes: OHLC, gap/return metrics, VIX term structure, vol regime, RSI, ATR, trend score, calendar context.

### Intraday Price Checkpoints (apply to SPX 5-min chart)

| Script | Granularity | Checkpoints/Day | Best For |
|--------|-------------|-----------------|----------|
| `spx-15min-checkpoints.pine` | 15 min | 26 | MOC analysis, granular intraday |
| `spx-30min-checkpoints.pine` | 30 min | 13 | Session analysis |
| `spx-hourly-checkpoints.pine` | 1 hour | 7 | Long-term patterns |

### Specialized Metrics

| Script | Apply To | Chart | Purpose |
|--------|----------|-------|---------|
| `spx-highlow-timing.pine` | SPX | 5-min | When daily high/low occurred |
| `vix-intraday.pine` | VIX | 5-min | VIX checkpoints and session moves |

> **Note:** ORB (Opening Range Breakout) is calculated dynamically by the MCP server from checkpoint data, allowing flexible start/end times.

## Quick Start

1. **Open TradingView** and load the appropriate chart (SPX or VIX)
2. **Set timeframe**: Use 5-min chart for best accuracy
3. **Add indicator**: Pine Editor → paste script → Add to Chart
4. **Set date range**: Click calendar icon, select range (2022+ recommended)
5. **Export**: Right-click indicator pane → "Export chart data..."
6. **Save**: Place CSV in `~/backtests/_marketdata/`

## Output Filenames

| Script | Output Filename |
|--------|-----------------|
| `spx-daily.pine` | `spx_daily.csv` |
| `spx-15min-checkpoints.pine` | `spx_15min.csv` |
| `spx-30min-checkpoints.pine` | `spx_30min.csv` |
| `spx-hourly-checkpoints.pine` | `spx_hourly.csv` |
| `spx-highlow-timing.pine` | `spx_highlow.csv` |
| `vix-intraday.pine` | `vix_intraday.csv` |

## Data Fields

### Daily Market Data (`spx_daily.csv`)

**Price & Movement**:
- `Prior_Close`, `Open`, `High`, `Low`, `Close`
- `Gap_Pct`, `Intraday_Range_Pct`, `Intraday_Return_Pct`, `Total_Return_Pct`
- `Close_Position_In_Range` - Where close is in day's range (0-1)
- `Gap_Filled` - Did price fill the gap?

**VIX & Volatility**:
- `VIX_Open`, `VIX_Close`, `VIX_Change_Pct`, `VIX_Spike_Pct`
- `VIX_Percentile` - VIX vs last 252 days
- `Vol_Regime` - 1=Very Low, 2=Low, 3=Normal, 4=Elevated, 5=High, 6=Extreme

**VIX Term Structure**:
- `VIX9D_Close`, `VIX3M_Close`
- `VIX9D_VIX_Ratio`, `VIX_VIX3M_Ratio`
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

### 15-Minute Checkpoints (`spx_15min.csv`)

**Prices**: `P_0930` through `P_1545` (26 checkpoints)

**MOC Metrics**:
- `MOC_15min` - 3:45 → close
- `MOC_30min` - 3:30 → close
- `MOC_45min` - 3:15 → close
- `MOC_60min` - 3:00 → close
- `Afternoon_Move` - 12:00 → close

### 30-Minute Checkpoints (`spx_30min.csv`)

**Prices**: `P_0930` through `P_1530` (13 checkpoints)

**Session Metrics**:
- `Morning_Move` - 9:30 → 12:00
- `Midday_Move` - 12:00 → 14:00
- `Afternoon_Move` - 14:00 → close
- `Power_Hour` - 15:00 → close
- `First_Hour`, `Last_Hour`
- `AM_vs_PM` - Morning minus afternoon

### Hourly Checkpoints (`spx_hourly.csv`)

**Prices**: `P_0930` through `P_1500` (7 checkpoints)

**Hourly Returns**: `Hour1_Return` through `Hour7_Return`

**Session Metrics**: `Morning`, `Midday`, `Afternoon`, `Reversal_Score`

### High/Low Timing (`spx_highlow.csv`)

- `High_Time`, `Low_Time` - Decimal hours (15.5 = 3:30 PM)
- `High_Before_Low` - 1 if high came first
- `High_In_First_Hour`, `Low_In_First_Hour`
- `High_In_Last_Hour`, `Low_In_Last_Hour`
- `Reversal_Type` - 1=morning high/afternoon low, -1=opposite

### VIX Intraday (`vix_intraday.csv`)

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

The market data tools can load and join these files on date. Example query after exporting:

```typescript
// Analyze MOC patterns Oct 2024 vs Oct 2025
await get_market_context({
  startDate: "2024-10-01",
  endDate: "2025-10-31",
  fields: ["MOC_15min", "MOC_30min", "Power_Hour"]
})
```

## Tips

1. **Chart timeframe**: Use 5-min for all scripts (most accurate checkpoint capture)

2. **Date range limits**: TradingView may limit export rows. For long history, export in yearly chunks.

3. **Missing data**: Holidays and early closes will have `na` values for some checkpoints.

4. **Timezone**: All times are US Eastern (ET). Scripts handle EST/EDT automatically.

5. **Combining data**: The MCP server joins all files on date, so you can export multiple scripts and query across them.
