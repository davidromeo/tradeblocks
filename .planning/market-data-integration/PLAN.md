# Market Data Integration Plan

## Vision

Enable an iterative loop where Claude can help generate and refine options strategy hypotheses by combining:
1. **Existing backtest results** (via TradeBlocks MCP server)
2. **Market context data** (exported from TradingView)
3. **LLM reasoning** (pattern recognition, hypothesis generation)

The goal is to move from "analyze what I traded" to "suggest what I should trade."

---

## Current State

### Completed

1. **Daily Market Data Script** - `scripts/strategy-research-export.pine`
   - Exports 35 fields per trading day
   - VIX term structure (VIX, VIX9D, VIX3M) with ratios
   - Gap, momentum, volatility regime, calendar context
   - Apply to SPX **daily** chart → export as `spx_daily.csv`

2. **Intraday Checkpoints Script** - `scripts/intraday-checkpoints-export.pine`
   - Exports 32 fields with intraday price checkpoints
   - Key times: 9:35, 10:00, 12:00, 15:00, 15:30, 15:45
   - ORB (Opening Range Breakout) metrics
   - Power hour analysis
   - Apply to SPX **5-minute** chart → export as `spx_intraday.csv`

3. **Documentation**
   - `scripts/MARKET_DATA_EXPORT.md` - Field reference and usage guide
   - `packages/mcp-server/docs/MARKET_DATA_TOOLS_SPEC.md` - MCP tool specifications

4. **Data Exported**
   - `~/backtests/_marketdata/spx_daily.csv` - 2,344 trading days (2016-2026)
   - `~/backtests/_marketdata/spx_intraday.csv` - Intraday checkpoints (2025+)

### In Progress

- None

### MCP Tools Built (v0.5.0)

Five new market data tools are now available:

1. **`get_market_context`** - Query market conditions for date(s) with filters
2. **`enrich_trades`** - Join market data to existing block trades
3. **`analyze_regime_performance`** - Break down performance by vol regime, term structure, day of week, etc.
4. **`suggest_filters`** - Auto-suggest market-based filters to improve strategy
5. **`find_similar_days`** - Find historically similar market days

All tools handle Eastern Time correctly for date matching.

---

## Two-File Architecture

### Why Two Files?

1. **Daily file** - Context that applies to the whole day (VIX regime, term structure, technicals)
2. **Intraday file** - Price checkpoints for entry/exit timing analysis

Join on date when analyzing trades. MCP server handles the merge.

### File Locations

```
~/backtests/_marketdata/
├── spx_daily.csv      # From daily chart - 35 fields
└── spx_intraday.csv   # From 5-min chart - 32 fields
```

---

## Daily Fields (35 total)

### Core Price (5)
- Prior_Close, Open, High, Low, Close

### Gap & Movement (6)
- Gap_Pct, Intraday_Range_Pct, Intraday_Return_Pct, Total_Return_Pct
- Close_Position_In_Range, Gap_Filled

### VIX (6)
- VIX_Open, VIX_Close, VIX_Change_Pct, VIX_Spike_Pct
- VIX_Percentile, Vol_Regime (1-6 classification)

### VIX Term Structure (5)
- VIX9D_Close, VIX3M_Close
- VIX9D_VIX_Ratio, VIX_VIX3M_Ratio
- Term_Structure_State (-1=backwardation, 0=flat, 1=contango)

### Technical Indicators (6)
- ATR_Pct, RSI_14
- Price_vs_EMA21_Pct, Price_vs_SMA50_Pct
- Trend_Score (0-4), BB_Position (0-1)

### Momentum (3)
- Return_5D, Return_20D, Consecutive_Days

### Calendar (3)
- Day_of_Week (2=Mon...6=Fri), Month, Is_Opex

### Prior Day (1)
- Prev_Return_Pct

---

## Intraday Fields (32 total)

### Checkpoint Prices (12)
- Day_Open, Price_0935, Price_1000, Price_1030, Price_1100, Price_1200
- Price_1300, Price_1400, Price_1500, Price_1530, Price_1545, Price_1555

### ORB Metrics (4)
- ORB_High, ORB_Low - Opening range (9:30-10:00) bounds
- ORB_Range_Pct - Size of opening range as % of open
- ORB_Position - Where current price is vs ORB (0-1, can exceed)

### Intraday Moves from Open (6)
- Pct_Open_to_0935, Pct_Open_to_1000, Pct_Open_to_1200
- Pct_Open_to_1500, Pct_Open_to_1530, Pct_Open_to_1545

### Power Hour (2)
- Afternoon_Move_Pct - Move from 15:00 to close
- Power_Hour_Move_Pct - Move from 15:00 to 15:45

### High/Low Timing (3)
- High_Time - Decimal time when daily high occurred (15.5 = 3:30 PM)
- Low_Time - Decimal time when daily low occurred
- High_Before_Low - 1 if high came before low (bearish pattern)

### VIX Intraday (5)
- VIX_0935, VIX_1000, VIX_1500, VIX_1545
- VIX_Power_Hour_Pct - VIX change during 15:00-15:45

---

## Next Steps

### Phase 1: Get Data Flowing

1. **User exports CSV from TradingView**
   - Apply indicator to SPX daily chart
   - Set date range (2022-01-01 to present recommended)
   - Export via right-click → "Export chart data..."
   - Save to `~/backtests/_marketdata/spx_daily.csv`

2. **Validate export format**
   - Confirm all 35 columns populated
   - Check for NA handling (VIX9D/VIX3M may have gaps)
   - Verify date parsing works

### Phase 2: MCP Server Tools (Priority Order)

#### Tool 1: `load_market_data`
Internal tool to parse and cache the CSV.
- Parse TradingView's timestamp format
- Handle NA values
- Index by date for O(1) lookups

#### Tool 2: `get_market_context`
Query market conditions for date(s).
```typescript
get_market_context({
  startDate: "2025-01-08",
  endDate: "2025-01-08",
  fields: ["VIX_Close", "Gap_Pct", "Vol_Regime"]
})
```

#### Tool 3: `enrich_trades`
Join market data to existing block trades.
```typescript
enrich_trades({
  blockId: "dumpy dump"
})
// Returns trades with market context attached
```

#### Tool 4: `analyze_regime_performance`
Break down strategy performance by market condition.
```typescript
analyze_regime_performance({
  blockId: "dumpy dump",
  segmentBy: "volRegime"  // or "termStructure", "dayOfWeek", etc.
})
```

#### Tool 5: `suggest_filters`
Auto-suggest filters to improve strategy.
```typescript
suggest_filters({
  blockId: "dumpy dump"
})
// Returns: "Skip when |Gap_Pct| > 0.8% would improve win rate by 6%"
```

### Phase 3: Hypothesis Generation

Once tools are built, the workflow becomes:

```
User: "Analyze why my double diagonal lost in September"

Claude: [calls get_market_context for Sep 2024]
        [calls enrich_trades for the block]
        [calls analyze_regime_performance segmented by term structure]

Response: "Your September losses occurred during term structure
          inversion (VIX9D > VIX). Win rate drops from 75% to 40%
          in backwardation. Suggest: skip entries when
          Term_Structure_State = -1"

User: "What days in Q4 would have been good entries?"

Claude: [calls get_market_context with filters]

Response: "Found 12 days matching your typical entry conditions
          (VIX 16-22, contango, Mon-Wed) where you didn't trade.
          Market context suggests 8 would have been favorable."
```

---

## File Locations

```
tradeblocks/
├── scripts/
│   ├── strategy-research-export.pine    # TradingView indicator
│   └── MARKET_DATA_EXPORT.md            # Usage documentation
├── packages/mcp-server/
│   ├── docs/
│   │   └── MARKET_DATA_TOOLS_SPEC.md    # Tool specifications
│   └── src/
│       └── tools/
│           └── market-data.ts           # (TO BUILD) New tools
└── .planning/
    └── market-data-integration/
        └── PLAN.md                       # This file
```

---

## Implementation Notes

### CSV Parsing Considerations

TradingView export format:
- First column: Unix timestamp (milliseconds)
- Headers match plot names
- NA for missing data (especially VIX9D/VIX3M pre-2018)

Need to:
- Convert timestamp to YYYY-MM-DD string
- Match trade dates (dateOpened) to market data dates
- Handle timezone (both should be ET)

### What We Can't Do (Without Options Chain Data)

- Precise P&L simulation for hypothetical trades
- Delta/strike calculations
- IV surface analysis
- Greeks estimation

The tools provide **qualitative** regime analysis, not quantitative backtesting. For actual P&L simulation, user must run tests in OptionOmega.

---

## Success Criteria

1. Can query "what was VIX on Jan 8, 2025?" via MCP
2. Can see "Dumpy Dump wins 85% in Vol Regime 2-3, only 60% in Regime 5"
3. Can get suggestion "Skip large gap days to improve Sharpe by 15%"
4. Can find "Days matching your entry criteria that you didn't trade"

---

## Open Questions

1. **VIX9D/VIX3M availability**: Does user's TradingView subscription include these? May need fallback.

2. **Historical depth**: How far back does user need? VIX9D data starts ~2011, but quality improves after 2016.

3. **Intraday data**: Current export is daily only. For 0DTE strategies, intraday checkpoints (3:30, 3:45, 4:00 prices) would be valuable but require separate 5-min export.

4. **Update frequency**: One-time export or periodic updates? Could build a refresh workflow.
