# MCP Server Market Data Update Plan

## Goal
Update the MCP server to load the new modular market data files and support dynamic ORB calculation.

## New File Structure
```
~/backtests/_marketdata/
├── spx_daily.csv      # Daily context (existing, unchanged)
├── spx_15min.csv      # 15-min checkpoints (NEW)
├── spx_30min.csv      # 30-min checkpoints (NEW, optional)
├── spx_hourly.csv     # Hourly checkpoints (NEW, optional)
├── spx_highlow.csv    # High/low timing (NEW, optional)
└── vix_intraday.csv   # VIX checkpoints (NEW, optional)
```

## Tasks

### 1. Update Types (market-data.ts)
- [ ] Replace `IntradayMarketData` interface with `Intraday15MinData` matching new fields:
  - `P_0930` through `P_1545` (26 checkpoints)
  - `MOC_15min`, `MOC_30min`, `MOC_45min`, `MOC_60min`
  - `Afternoon_Move`, `Pct_0930_to_*` fields
- [ ] Add `HighLowTimingData` interface for spx_highlow.csv
- [ ] Add `VixIntradayData` interface for vix_intraday.csv

### 2. Update Loaders (market-data.ts)
- [ ] Update `loadIntradayData()` to load `spx_15min.csv` with new field names
- [ ] Add `loadHighLowData()` for spx_highlow.csv (optional file)
- [ ] Add `loadVixIntradayData()` for vix_intraday.csv (optional file)
- [ ] Update `loadMarketData()` to call all loaders and merge on date

### 3. Add Dynamic ORB Tool
- [ ] Add `calculate_orb` tool with parameters:
  - `startTime`: string (e.g., "09:30", "10:00")
  - `endTime`: string (e.g., "10:00", "15:30")
  - `startDate`, `endDate`: date range
- [ ] Calculate ORB by finding min/max of checkpoints in time range
- [ ] Return: ORB_High, ORB_Low, ORB_Range_Pct, breakout stats

### 4. Update Existing Tools
- [ ] Update `get_market_context` to expose new intraday fields
- [ ] Update field lists in tool schemas

### 5. Test
- [ ] Verify data loads correctly
- [ ] Test ORB calculation with different time ranges

## File Changes
- `packages/mcp-server/src/tools/market-data.ts` - Main changes

## Notes
- All files optional except spx_daily.csv
- Graceful handling if files missing
- Join all data on date field
