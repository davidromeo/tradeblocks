# Phase 51: PineScript Consolidation - Research

**Researched:** 2026-02-07
**Domain:** TradingView PineScript v6, CSV export consolidation
**Confidence:** HIGH

## Summary

Phase 51 consolidates 6 PineScript files down to 3 by merging highlow timing data and enriched VIX fields into the existing daily script, then deleting the standalone highlow, 30-min checkpoint, and hourly checkpoint scripts. The core technical approach has already been validated via a proof-of-concept script (`poc-highlow-daily-ltf.pine`) that uses `request.security_lower_tf()` to compute highlow timing from a daily chart. The PoC includes a Python comparison script that confirms exact match with the standalone 5-min chart approach.

The daily script currently uses 36 of 64 allowed plot counts and ~12 of 40 allowed `request.*()` calls. Adding 13 highlow fields and 7 VIX fields brings the total to 56 plot counts and ~15 request calls -- both well within TradingView limits. Most of the "new" VIX fields (VIX_Gap_Pct, VIX9D_Open, VIX9D_Change_Pct, VIX_High, VIX_Low, VIX3M_Open, VIX3M_Change_Pct) are already computed in the daily script but not exported via `plot()` -- they just need plot lines added.

**Primary recommendation:** Merge the PoC's `request.security_lower_tf()` approach into `spx-daily.pine`, add plot lines for the 7 already-computed VIX fields, delete 3 obsolete scripts, and update the README. No new libraries, no new dependencies, no changes to downstream TypeScript code in this phase.

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| PineScript | v6 | TradingView scripting language | Only option for TradingView indicators |
| `request.security_lower_tf()` | Pine v6 built-in | Fetch intrabar (5-min) data from daily chart | Only way to get LTF data on higher TF chart |
| `request.security()` | Pine v6 built-in | Fetch VIX/ES data cross-symbol | Already used for all VIX/VIX9D/VIX3M/ES requests |

### Supporting

No additional libraries or tools needed. This is pure PineScript editing.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `request.security_lower_tf()` | Keep standalone 5-min highlow script | Defeats the consolidation goal; user must manage 2 CSVs instead of 1 |
| Deleting 30-min/hourly scripts | Keep them | No downstream consumer uses them; 15-min script already covers all use cases |

## Architecture Patterns

### Current Script Layout (6 scripts)

```
scripts/
├── spx-daily.pine           # Daily data (applied to SPX daily chart) -> spx_daily.csv
├── spx-15min-checkpoints.pine  # 15-min checkpoints (applied to SPX 5-min chart) -> spx_15min.csv
├── spx-30min-checkpoints.pine  # 30-min checkpoints (applied to SPX 5-min chart) -> spx_30min.csv [TO DELETE]
├── spx-hourly-checkpoints.pine # Hourly checkpoints (applied to SPX 15-min chart) -> spx_hourly.csv [TO DELETE]
├── spx-highlow-timing.pine     # High/low timing (applied to SPX 5-min chart) -> spx_highlow.csv [TO DELETE]
├── vix-intraday.pine           # VIX intraday (applied to VIX 5-min chart) -> vix_intraday.csv
└── poc-highlow-daily-ltf.pine  # PoC script (will be deleted in Phase 54)
```

### Target Script Layout (3 scripts)

```
scripts/
├── spx-daily.pine              # Combined daily + highlow + enriched VIX -> spx_daily.csv
├── spx-15min-checkpoints.pine  # 15-min checkpoints (unchanged) -> spx_15min.csv
└── vix-intraday.pine           # VIX intraday (unchanged) -> vix_intraday.csv
```

### Pattern: Merging `request.security_lower_tf()` Into Daily Script

**What:** The PoC script (`poc-highlow-daily-ltf.pine`) demonstrates fetching 5-min intrabar data from a daily chart. The same pattern must be integrated into `spx-daily.pine`.

**Key code from the validated PoC:**
```pine
// Fetch 5-min intrabar data (arrays of values, one per 5-min bar in the day)
float[] ltfHigh = request.security_lower_tf(syminfo.tickerid, "5", high)
float[] ltfLow  = request.security_lower_tf(syminfo.tickerid, "5", low)
int[]   ltfTime = request.security_lower_tf(syminfo.tickerid, "5", time)

int ltfSize = array.size(ltfHigh)

if ltfSize > 0
    float maxH = na
    float minL = na
    int maxHTime = na
    int minLTime = na

    for i = 0 to ltfSize - 1
        float h = array.get(ltfHigh, i)
        float l = array.get(ltfLow, i)
        int t = array.get(ltfTime, i)

        if na(maxH) or h > maxH
            maxH := h
            maxHTime := t

        if na(minL) or l < minL
            minL := l
            minLTime := t

    // Extract hour/minute from timestamps
    highHour := hour(maxHTime, "America/New_York")
    highMinute := minute(maxHTime, "America/New_York")
    lowHour := hour(minLTime, "America/New_York")
    lowMinute := minute(minLTime, "America/New_York")
```

**When to use:** This exact pattern is what gets merged into spx-daily.pine. It adds 3 `request.security_lower_tf()` calls.

### Pattern: Exposing Already-Computed VIX Fields

**What:** The daily script already computes `vixGapPct`, `vix9dOpen`, `vix9dChangePct`, `vixHigh`, `vixLow`, `vix3mOpen`, `vix3mChangePct` but does not export them via `plot()`. Adding the plot lines is trivial.

**Already computed variables and their target export names:**

| Variable in spx-daily.pine | Target CSV Column Name | Line |
|----------------------------|----------------------|------|
| `vixGapPct` | `VIX_Gap_Pct` | 111 |
| `vix9dOpen` | `VIX9D_Open` | 114 |
| `vix9dChangePct` | `VIX9D_Change_Pct` | 117 |
| `vixHigh` | `VIX_High` | 104 |
| `vixLow` | `VIX_Low` | 105 |
| `vix3mOpen` | `VIX3M_Open` | 120 |
| `vix3mChangePct` | `VIX3M_Change_Pct` | 123 |

**Code to add (7 plot lines):**
```pine
plot(vixGapPct, "VIX_Gap_Pct", display=display.data_window)
plot(vix9dOpen, "VIX9D_Open", display=display.data_window)
plot(vix9dChangePct, "VIX9D_Change_Pct", display=display.data_window)
plot(vixHigh, "VIX_High", display=display.data_window)
plot(vixLow, "VIX_Low", display=display.data_window)
plot(vix3mOpen, "VIX3M_Open", display=display.data_window)
plot(vix3mChangePct, "VIX3M_Change_Pct", display=display.data_window)
```

### Anti-Patterns to Avoid

- **Adding debug plots to production script:** The PoC has `Debug_Intrabar_Count` and `Debug_NewDay` plots. Do NOT include these in the consolidated daily script. They waste plot count budget.
- **Changing existing plot names:** Existing CSV column names (e.g., `VIX_Open`, `VIX_Close`) are consumed by DuckDB schema and MCP tools. Renaming would break downstream. Keep all existing names exactly as-is.
- **Removing the visual display section:** The `hline()` and `bgcolor()` calls at the bottom of spx-daily.pine are useful for the TradingView UI. Keep them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Highlow timing on daily chart | Manual bar-by-bar tracking with `request.security("5", ...)` | `request.security_lower_tf()` array approach from PoC | The PoC is already validated; manual approach would require a separate 5-min chart |
| Date/time parsing in Pine | Custom date math | Pine's built-in `hour(time, "America/New_York")` and `minute(time, "America/New_York")` | Handles EST/EDT automatically |

**Key insight:** The PoC already solves the hard problem. This phase is mostly copy-paste from the PoC into the daily script plus adding 7 trivial plot lines.

## Common Pitfalls

### Pitfall 1: Plot Count Budget Overflow

**What goes wrong:** TradingView limits scripts to 64 plot counts. Adding too many fields without tracking the budget causes compile errors.
**Why it happens:** Plot count includes `plot()`, `hline()`, `bgcolor()`, `plotshape()`, and other display functions.
**How to avoid:** Current budget:
  - Existing daily script: 31 plots + 4 hlines + 1 bgcolor = **36 plot counts**
  - Adding highlow fields: **13 plots** (High_Time, Low_Time, High_Before_Low, High_In_First_Hour, Low_In_First_Hour, High_In_Last_Hour, Low_In_Last_Hour, Reversal_Type, High_Low_Spread, Early_Extreme, Late_Extreme, Intraday_High, Intraday_Low)
  - Adding VIX fields: **7 plots** (VIX_Gap_Pct, VIX9D_Open, VIX9D_Change_Pct, VIX_High, VIX_Low, VIX3M_Open, VIX3M_Change_Pct)
  - **New total: 56 of 64** (8 remaining for future use)
**Warning signs:** PineScript compile error "Number of plot functions is too large"

### Pitfall 2: Intrabar Data History Limits

**What goes wrong:** `request.security_lower_tf()` can only retrieve the most recent ~100K intrabars (Basic-Premium plans). For SPX with ~78 five-min bars per trading day, this means highlow timing data is only available for the most recent ~1,282 trading days (~5 years).
**Why it happens:** TradingView limits intrabar data by plan tier:
  - Basic/Essential/Plus/Premium: 100,000 intrabars (~1,282 days)
  - Expert: 125,000 intrabars (~1,602 days)
  - Ultimate: 200,000 intrabars (~2,564 days)
**How to avoid:** This is a known, accepted limitation (documented in the PoC). Older dates will have `na` (NaN) for highlow fields while other daily fields remain populated. The DuckDB schema already handles NULLable columns.
**Warning signs:** Highlow fields showing NaN for dates beyond the intrabar limit.

### Pitfall 3: Request Call Count Limit

**What goes wrong:** TradingView allows max 40 `request.*()` calls per script (64 for Ultimate).
**Why it happens:** Each unique `request.security()` or `request.security_lower_tf()` call counts toward the limit.
**How to avoid:** Current request count:
  - Existing: 10 unique `request.security()` calls (VIX OHLC+prevClose=5, VIX9D open+close=2, VIX3M open+close=2, ES close+prevClose=2... but some share the same security call context)
  - Adding: 3 `request.security_lower_tf()` calls (high, low, time)
  - **Total: ~13-15 of 40** (well within limits)
**Warning signs:** PineScript compile error about too many request calls.

### Pitfall 4: First-Occurrence vs Last-Occurrence Matching

**What goes wrong:** The PoC uses first-occurrence matching for high/low (`h > maxH` and `l < minL` -- strict greater/less), which matches the standalone script's behavior. Using `>=` or `<=` would match the last occurrence instead, causing discrepancies.
**Why it happens:** Ties in high/low prices across different 5-min bars.
**How to avoid:** Keep the exact comparison operators from the PoC: `h > maxH` (first new high) and `l < minL` (first new low). The Python comparison script verified this approach matches.

### Pitfall 5: Breaking Existing CSV Column Names

**What goes wrong:** Renaming existing plot labels changes CSV column headers, breaking DuckDB schema imports and MCP tool parsing.
**Why it happens:** The DuckDB schema in `packages/mcp-server/src/db/schemas.ts` hardcodes column names like `VIX_Open`, `VIX_Close`, etc. The sync process maps CSV headers to table columns by name.
**How to avoid:** Keep ALL existing plot labels unchanged. Only ADD new plot lines. Do not rename or reorder existing ones.

## Code Examples

### Example 1: Complete Highlow Section for Daily Script

This is the exact code to insert into `spx-daily.pine` (adapted from the validated PoC):

```pine
// -----------------------------------------------------------------------------
// HIGH/LOW TIMING (via intrabar data)
// -----------------------------------------------------------------------------
// Uses request.security_lower_tf() to get 5-min data from the daily chart
// Note: Data available for recent ~1,282 days (non-pro) to ~2,564 days (Ultimate)

float[] ltfHigh = request.security_lower_tf(syminfo.tickerid, "5", high)
float[] ltfLow  = request.security_lower_tf(syminfo.tickerid, "5", low)
int[]   ltfTime = request.security_lower_tf(syminfo.tickerid, "5", time)

int ltfSize = array.size(ltfHigh)

float intradayHighHL = na
float intradayLowHL = na
int highHourHL = na
int highMinuteHL = na
int lowHourHL = na
int lowMinuteHL = na

if ltfSize > 0
    float maxH = na
    float minL = na
    int maxHTime = na
    int minLTime = na

    for i = 0 to ltfSize - 1
        float h = array.get(ltfHigh, i)
        float l = array.get(ltfLow, i)
        int t = array.get(ltfTime, i)

        if na(maxH) or h > maxH
            maxH := h
            maxHTime := t

        if na(minL) or l < minL
            minL := l
            minLTime := t

    intradayHighHL := maxH
    intradayLowHL := minL
    highHourHL := hour(maxHTime, "America/New_York")
    highMinuteHL := minute(maxHTime, "America/New_York")
    lowHourHL := hour(minLTime, "America/New_York")
    lowMinuteHL := minute(minLTime, "America/New_York")

// Computed highlow metrics
float highTimeHL = highHourHL + highMinuteHL / 60.0
float lowTimeHL = lowHourHL + lowMinuteHL / 60.0
bool highBeforeLowHL = highTimeHL < lowTimeHL

bool highInFirstHourHL = highHourHL == 9 or (highHourHL == 10 and highMinuteHL <= 30)
bool lowInFirstHourHL = lowHourHL == 9 or (lowHourHL == 10 and lowMinuteHL <= 30)
bool highInLastHourHL = highHourHL >= 15
bool lowInLastHourHL = lowHourHL >= 15

bool highInMorningHL = highHourHL < 12
bool lowInMorningHL = lowHourHL < 12
bool highInAfternoonHL = highHourHL >= 12
bool lowInAfternoonHL = lowHourHL >= 12

int reversalTypeHL = 0
if highInMorningHL and lowInAfternoonHL
    reversalTypeHL := 1
else if lowInMorningHL and highInAfternoonHL
    reversalTypeHL := -1

float highLowSpreadHL = math.abs(highTimeHL - lowTimeHL)
bool earlyExtremeHL = (highHourHL == 9) or (lowHourHL == 9) or (highHourHL == 10 and highMinuteHL == 0) or (lowHourHL == 10 and lowMinuteHL == 0)
bool lateExtremeHL = (highHourHL == 15 and highMinuteHL >= 30) or (lowHourHL == 15 and lowMinuteHL >= 30)
```

### Example 2: New VIX Export Plot Lines

```pine
// -----------------------------------------------------------------------------
// EXPORT PLOTS - Enriched VIX Fields (already computed, now exported)
// -----------------------------------------------------------------------------
plot(vixGapPct, "VIX_Gap_Pct", display=display.data_window)
plot(vix9dOpen, "VIX9D_Open", display=display.data_window)
plot(vix9dChangePct, "VIX9D_Change_Pct", display=display.data_window)
plot(vixHigh, "VIX_High", display=display.data_window)
plot(vixLow, "VIX_Low", display=display.data_window)
plot(vix3mOpen, "VIX3M_Open", display=display.data_window)
plot(vix3mChangePct, "VIX3M_Change_Pct", display=display.data_window)
```

### Example 3: Highlow Export Plot Lines

```pine
// -----------------------------------------------------------------------------
// EXPORT PLOTS - High/Low Timing
// -----------------------------------------------------------------------------
plot(highTimeHL, "High_Time", display=display.data_window)
plot(lowTimeHL, "Low_Time", display=display.data_window)
plot(highBeforeLowHL ? 1 : 0, "High_Before_Low", display=display.data_window)
plot(highInFirstHourHL ? 1 : 0, "High_In_First_Hour", display=display.data_window)
plot(lowInFirstHourHL ? 1 : 0, "Low_In_First_Hour", display=display.data_window)
plot(highInLastHourHL ? 1 : 0, "High_In_Last_Hour", display=display.data_window)
plot(lowInLastHourHL ? 1 : 0, "Low_In_Last_Hour", display=display.data_window)
plot(reversalTypeHL, "Reversal_Type", display=display.data_window)
plot(highLowSpreadHL, "High_Low_Spread", display=display.data_window)
plot(earlyExtremeHL ? 1 : 0, "Early_Extreme", display=display.data_window)
plot(lateExtremeHL ? 1 : 0, "Late_Extreme", display=display.data_window)
plot(intradayHighHL, "Intraday_High", display=display.data_window)
plot(intradayLowHL, "Intraday_Low", display=display.data_window)
```

## Inventory of Changes

### Files to Modify

| File | Change | Requirement |
|------|--------|-------------|
| `scripts/spx-daily.pine` | Add highlow timing section (LTF computation + 13 plots) | PINE-01, PINE-02 |
| `scripts/spx-daily.pine` | Add 7 VIX export plot lines | PINE-03, PINE-04, PINE-05, PINE-06 |
| `scripts/README.md` | Rewrite for 3-script workflow | PINE-09 |

### Files to Delete

| File | Reason | Requirement |
|------|--------|-------------|
| `scripts/spx-highlow-timing.pine` | Functionality merged into daily script | PINE-07 |
| `scripts/spx-30min-checkpoints.pine` | No downstream consumer, 15-min covers all use cases | PINE-08 |
| `scripts/spx-hourly-checkpoints.pine` | No downstream consumer, 15-min covers all use cases | PINE-08 |

### Files NOT Modified in This Phase

| File | Why Not |
|------|---------|
| `packages/mcp-server/src/db/schemas.ts` | Schema changes are Phase 52 |
| `packages/mcp-server/src/sync/market-sync.ts` | Sync changes are Phase 52 |
| `packages/mcp-server/src/tools/market-data.ts` | Import consolidation is Phase 53 |
| `packages/mcp-server/src/utils/schema-metadata.ts` | Schema metadata updates are Phase 52 |
| `scripts/poc-highlow-daily-ltf.pine` | PoC cleanup is Phase 54 |
| `scripts/poc test/` | PoC cleanup is Phase 54 |

### Complete Field Inventory: New CSV Columns After Phase 51

**13 Highlow Fields (from `request.security_lower_tf()`):**
1. `High_Time` (DOUBLE) - Time of day high as decimal hours
2. `Low_Time` (DOUBLE) - Time of day low as decimal hours
3. `High_Before_Low` (INTEGER) - 1 if high occurred before low
4. `High_In_First_Hour` (INTEGER) - 1 if high was 9:30-10:30
5. `Low_In_First_Hour` (INTEGER) - 1 if low was 9:30-10:30
6. `High_In_Last_Hour` (INTEGER) - 1 if high was 15:00-16:00
7. `Low_In_Last_Hour` (INTEGER) - 1 if low was 15:00-16:00
8. `Reversal_Type` (INTEGER) - 1=morning high/afternoon low, -1=opposite, 0=same session
9. `High_Low_Spread` (DOUBLE) - Hours between high and low
10. `Early_Extreme` (INTEGER) - 1 if either extreme in first 30 min
11. `Late_Extreme` (INTEGER) - 1 if either extreme in last 30 min
12. `Intraday_High` (DOUBLE) - Intraday high price
13. `Intraday_Low` (DOUBLE) - Intraday low price

**7 VIX Fields (already computed, adding plot lines):**
1. `VIX_Gap_Pct` (DOUBLE) - VIX overnight gap percentage
2. `VIX9D_Open` (DOUBLE) - 9-day VIX open value
3. `VIX9D_Change_Pct` (DOUBLE) - 9-day VIX open-to-close change percentage
4. `VIX_High` (DOUBLE) - VIX intraday high
5. `VIX_Low` (DOUBLE) - VIX intraday low
6. `VIX3M_Open` (DOUBLE) - 3-month VIX open value
7. `VIX3M_Change_Pct` (DOUBLE) - 3-month VIX open-to-close change percentage

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate highlow script on 5-min chart | `request.security_lower_tf()` on daily chart | Pine v5 (available since 2023) | Eliminates need for separate 5-min chart export |
| Multiple checkpoint granularity scripts (15/30/60 min) | Single 15-min script only | v2.8 decision | 30-min and hourly scripts have no downstream consumer |

**Deprecated/outdated:**
- `spx-30min-checkpoints.pine`: No DuckDB table, no MCP tool, no UI consumer. Only the 15-min script is used.
- `spx-hourly-checkpoints.pine`: Same -- no downstream consumer.

## Resource Budget Summary

| Resource | Current | After Phase 51 | Limit | Headroom |
|----------|---------|----------------|-------|----------|
| Plot counts | 36 | 56 | 64 | 8 |
| `request.*()` calls | ~12 | ~15 | 40 | ~25 |
| CSV output columns | 35 | 55 | No hard limit | N/A |

## Variable Naming Convention

The existing daily script uses camelCase for internal variables (e.g., `vixGapPct`, `vix9dOpen`) and Title_Case for plot labels/CSV column names (e.g., `"VIX_Gap_Pct"`, `"VIX9D_Open"`). The highlow section should use a `HL` suffix on variable names to avoid collisions with existing variables (e.g., `intradayHighHL` instead of `intradayHigh` which could conflict with the daily bar's `high`).

## Open Questions

1. **Variable name collisions**
   - What we know: The daily script uses `high` (a Pine built-in), and the PoC uses `intradayHigh`. We need a suffix convention to avoid collisions.
   - What's unclear: Whether `HL` suffix is the best convention or if a different namespace approach is preferred.
   - Recommendation: Use `HL` suffix as shown in the code examples. This is simple, grep-friendly, and avoids all collisions.

2. **Dead code in daily script (lines 68-97)**
   - What we know: The `getIntradayPrice()` helper and "approximate checkpoint" code on lines 68-97 of spx-daily.pine appears to be dead code from an earlier attempt at intraday data on daily charts.
   - What's unclear: Whether this code is intentionally preserved for reference.
   - Recommendation: Remove it during the merge since `request.security_lower_tf()` properly replaces this approach. But mark it as a cleanup item, not a blocker.

3. **ES futures section (lines 140-150)**
   - What we know: The ES futures overnight move data is computed and uses `request.security()` calls, but it's NOT exported via `plot()`.
   - What's unclear: Whether this should be exported now or deferred.
   - Recommendation: Defer -- it's not in the requirements for Phase 51. Adding it later would only cost 2-3 plot counts.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - All 7 PineScript files read and analyzed
- **PoC validation** - `poc-highlow-daily-ltf.pine` and `compare_poc.py` confirm the approach works
- **DuckDB schema** - `packages/mcp-server/src/db/schemas.ts` confirms current column names
- **Market sync** - `packages/mcp-server/src/sync/market-sync.ts` confirms CSV-to-table mapping
- **MCP market tools** - `packages/mcp-server/src/tools/market-data.ts` confirms downstream consumers

### Secondary (MEDIUM confidence)
- **TradingView docs** - [Pine Script Limitations](https://www.tradingview.com/pine-script-docs/writing/limitations/) confirms 64 plot limit, 40 request call limit, 100K-200K intrabar limits
- **TradingView docs** - [Other Timeframes and Data](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/) confirms `request.security_lower_tf()` usage

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Pure PineScript, no external dependencies
- Architecture: HIGH - PoC validated, codebase fully inspected
- Pitfalls: HIGH - Plot count and request limits verified against official docs; variable collision risk identified and mitigated
- Field inventory: HIGH - All 20 new fields enumerated with exact types and names

**Research date:** 2026-02-07
**Valid until:** 2026-06-07 (stable -- PineScript v6 and TradingView limits change infrequently)
