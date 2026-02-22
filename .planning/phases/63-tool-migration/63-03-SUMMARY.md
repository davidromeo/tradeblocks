---
phase: 63-tool-migration
plan: 03
subsystem: mcp-server/tools
tags: [schema-migration, orb, market-intraday, breakout-detection, duckdb]
dependency_graph:
  requires: [63-02]
  provides: [calculate_orb-intraday, orb-breakout-detection, orb-entry-triggered]
  affects: [market-data.ts, mcp-server/package.json]
tech_stack:
  added: []
  patterns: [sql-cte-aggregation, hhmmToSqlTime-conversion, breakout-condition-enum, entry-triggered-boolean]
key_files:
  created: []
  modified:
    - packages/mcp-server/src/tools/market-data.ts
    - packages/mcp-server/package.json
decisions:
  - hhmmToSqlTime() helper added locally in registerMarketDataTools — converts HHMM to HH:MM before SQL comparison
  - SQL CTE pattern (orb_range + breakout_events) used for aggregation-then-detection approach
  - entry_triggered is explicit boolean derived from breakout_condition != NoBreakout
  - barResolution auto-detection via time gap between first two bars on first available date
  - useHighLow toggle controls high/low vs close expressions at SQL template-interpolation time
metrics:
  duration_seconds: 176
  tasks_completed: 2
  files_modified: 2
  files_created: 0
  tests_added: 0
  completed_date: 2026-02-22
---

# Phase 63 Plan 03: ORB Tool Redesign for market.intraday Summary

Fully redesigned `calculate_orb` from checkpoint-pivot approach to SQL aggregation over `market.intraday` bars, with breakout detection (HighFirst, LowFirst, HighOnly, LowOnly, NoBreakout), explicit `entry_triggered` boolean, HHMM-to-HH:MM conversion, optional bar resolution with auto-detection, and `checkDataAvailability` integration. Bumped MCP server version to 1.5.0.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Redesign calculate_orb for market.intraday with breakout detection | b75f4d1 | market-data.ts |
| 2 | Version bump 1.5.0 and final cleanup | bd49595 | market-data.ts, package.json |

## What Was Built

### calculate_orb: New implementation

The entire `calculate_orb` tool handler was replaced. Key changes:

**Input schema (new):**
- `ticker` (optional, default: SPX)
- `startTime` / `endTime` in HHMM format (e.g., `'0930'`)
- `startDate` / `endDate` (YYYY-MM-DD)
- `useHighLow: boolean` (default: true) — controls high/low vs close expressions
- `barResolution` (optional string, e.g., `'15'`) — with auto-detection if omitted
- `limit: number` (1-500, default 100)

**`hhmmToSqlTime()` helper:**
Added local function inside `registerMarketDataTools` that converts `'0930'` → `'09:30'` with validation (throws if input is not exactly 4 digits). Called before SQL to ensure correct HH:MM format for time column comparisons.

**SQL pattern (DuckDB CTEs):**
```sql
WITH orb_range AS (
  SELECT ticker, date,
    MAX(high) AS ORB_High, MIN(low) AS ORB_Low,
    MAX(high) - MIN(low) AS ORB_Range,
    MIN(open) FILTER (WHERE time = $4) AS ORB_Open
  FROM market.intraday
  WHERE ticker = $1 AND date BETWEEN $2 AND $3
    AND time >= $4 AND time <= $5
  GROUP BY ticker, date
),
breakout_events AS (
  SELECT i.ticker, i.date,
    MIN(i.time) FILTER (WHERE i.high > r.ORB_High) AS breakout_up_time,
    MIN(i.time) FILTER (WHERE i.low < r.ORB_Low) AS breakout_down_time
  FROM market.intraday i
  JOIN orb_range r ON i.ticker = r.ticker AND i.date = r.date
  WHERE i.time > $5  -- post-ORB window bars only
  GROUP BY i.ticker, i.date
)
SELECT r.date, r.ORB_High, r.ORB_Low, r.ORB_Range,
  ..., b.breakout_up_time, b.breakout_down_time,
  CASE ... END AS breakout_condition
FROM orb_range r
LEFT JOIN breakout_events b ON r.ticker = b.ticker AND r.date = b.date
ORDER BY r.date
```

The `useHighLow` flag interpolates `MAX(high)`/`MIN(low)` vs `MAX(close)`/`MIN(close)` directly into the SQL template. Ticker, dates, and times are parameterized.

**Per-day output fields:**
```typescript
{
  date: string,
  ORB_High: number,
  ORB_Low: number,
  ORB_Range: number,
  ORB_Range_Pct: number,
  ORB_Open: number | null,
  breakout_condition: 'HighFirst' | 'LowFirst' | 'HighOnly' | 'LowOnly' | 'NoBreakout',
  breakout_up_time: string | null,   // HH:MM or null
  breakout_down_time: string | null, // HH:MM or null
  entry_triggered: boolean,          // true when breakout_condition !== 'NoBreakout'
}
```

**Aggregate stats:**
```typescript
{
  totalDays: number,
  avgOrbRangePct: number,
  breakdownByCondition: {
    HighFirst, LowFirst, HighOnly, LowOnly, NoBreakout  // counts
  }
}
```

**checkDataAvailability integration:**
Called at handler start with `{ checkIntraday: true }`. If `!availability.hasIntradayData`, returns early with structured response including warnings and empty `days: []` — not a hard error.

**barResolution auto-detection:**
If `barResolution` param is omitted, queries `DISTINCT time` from the first available date for the ticker, computes minute gap between consecutive bars (e.g., 09:30 → 09:45 = 15 min), stores as `resolvedBarResolution`. Included in response query metadata. Currently used for reporting only (bar filtering by resolution was not implemented as bars from the intraday table already reflect import resolution).

### Removed from calculate_orb:
- `checkpointFields` map (26 HHMM-to-fieldname entries)
- Old close-based ORB loop (getting checkpoint prices, computing Close_vs_ORB, Close_Position_In_ORB)
- Old `OrbResult` interface with `Close`, `Close_Position_In_ORB`, `Close_vs_ORB` fields
- Old aggregate stats: `closeAboveOrb`, `closeBelowOrb`, `closeWithinOrb`, `closeAbovePct`, etc.

### package.json version bump:
- `1.4.0` → `1.5.0` (minor bump: new ORB capabilities in calculate_orb)

### market-data.ts cleanup:
- Module docstring updated to reflect correct tool list and data sources
- Stale comment referencing `market.spx_daily` removed from tool registration block
- Zero references to `spx_daily`, `spx_15min`, or `vix_intraday` in the file

## Deviations from Plan

None — plan executed exactly as written.

## Key Decisions Made

1. **hhmmToSqlTime() placement**: Defined inside `registerMarketDataTools` (not module-level) to keep it co-located with `calculate_orb` usage and avoid polluting module exports.

2. **barResolution auto-detection approach**: Computes minute gap between first two bar times on first available date. Stored in query metadata as a string (e.g., `"15"`) or `"auto"` if detection failed. The value is informational — bar filtering by resolution interval was not added as `market.intraday` already reflects import resolution.

3. **useHighLow toggle as template interpolation**: Not a SQL parameter. The `highExpr`/`lowExpr`/`rangeExpr`/`breakupExpr`/`breakdownExpr` strings are constructed before `conn.runAndReadAll()`. This is correct because column expressions can't be parameterized in SQL.

4. **LEFT JOIN for breakout_events**: Ensures days with no post-window bars still appear in results with `NoBreakout` condition (per plan requirement).

5. **entry_triggered derivation**: `entry_triggered = breakoutCondition !== 'NoBreakout'`. Computed in TypeScript after SQL results are processed, not in SQL.

## Self-Check

Checking created files exist:
- No new files created.

Checking key modified files exist:
- FOUND: packages/mcp-server/src/tools/market-data.ts
- FOUND: packages/mcp-server/package.json

Checking commits exist:
- FOUND: b75f4d1 feat(63-03): redesign calculate_orb for market.intraday with breakout detection
- FOUND: bd49595 chore(63-03): version bump 1.5.0 and market-data.ts final cleanup

Checking verification criteria:
- build succeeded: tradeblocks-mcp@1.5.0 build returned success
- zero spx_daily/spx_15min/vix_intraday references in market-data.ts: confirmed
- breakout_condition present: confirmed (lines 1345, 1363, 1370, 1385, 1400-1404)
- entry_triggered present: confirmed (lines 1366, 1371, 1388)
- version 1.5.0 in package.json: confirmed
- hhmmToSqlTime present: confirmed (lines 1190, 1193, 1233, 1234)

## Self-Check: PASSED
