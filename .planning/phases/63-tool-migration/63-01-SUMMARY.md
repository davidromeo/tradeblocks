---
phase: 63-tool-migration
plan: 01
subsystem: mcp-server/utils
tags: [schema-migration, field-timing, market-data, duckdb, sql]
dependency_graph:
  requires: [62-03]
  provides: [buildLookaheadFreeQuery-dual-table, checkDataAvailability, schema-metadata-normalized]
  affects: [market-data.ts tools, enrich_trades, analyze_regime_performance, suggest_filters, calculate_orb]
tech_stack:
  added: []
  patterns: [dual-table-join-before-lag, field-origin-tracking, data-availability-helper]
key_files:
  created:
    - packages/mcp-server/src/utils/data-availability.ts
  modified:
    - packages/mcp-server/src/db/market-schemas.ts
    - packages/mcp-server/src/utils/schema-metadata.ts
    - packages/mcp-server/src/utils/field-timing.ts
    - packages/mcp-server/src/test-exports.ts
    - packages/mcp-server/tests/unit/field-timing.test.ts
decisions:
  - Tier 3 columns (High_Time, Low_Time, High_Before_Low, Reversal_Type) included in daily schema-metadata because columns exist in market.daily even though enrichment is deferred
  - Legacy string[] overload of buildLookaheadFreeQuery still uses DEFAULT_MARKET_TICKER but now queries market.daily JOIN market.context instead of spx_daily
  - buildLookaheadFreeQuery string[] overload: ticker appended as last param to avoid shifting date placeholder numbering
metrics:
  duration_seconds: 401
  tasks_completed: 3
  files_modified: 5
  files_created: 1
  tests_added: 38
  completed_date: 2026-02-22
---

# Phase 63 Plan 01: Query Foundation Rewrite Summary

Rewrote shared query foundation (schema-metadata, field-timing, data-availability) to support the new normalized market schema — split from one wide `spx_daily` table into `market.daily` (per-ticker OHLCV + indicators) and `market.context` (global VIX/regime). The `buildLookaheadFreeQuery` CTE builder now JOINs both tables before applying LAG, ensuring temporal correctness across weekends and holidays.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite schema-metadata.ts with new table structure | 4a3e634 | market-schemas.ts, schema-metadata.ts |
| 2 | Rewrite field-timing.ts with dual-table derivation + create data-availability.ts | 6cd7d38 | field-timing.ts, data-availability.ts, test-exports.ts |
| 3 | Update field-timing.test.ts for new schema counts and build + test | 19be8f3 | field-timing.test.ts |

## What Was Built

### schema-metadata.ts (full rewrite)
Replaced three old tables (`spx_daily`, `spx_15min`, `vix_intraday`) with three new normalized tables:
- **`daily`**: Per-ticker OHLCV + Tier 1 enrichment + Tier 3 timing columns. 5 open-known, 22 close-derived, 3 static columns.
- **`context`**: Global VIX/regime data. 4 open-known, 14 close-derived columns.
- **`intraday`**: Raw bar data (ticker, date, time HH:MM, ohlcv). No timing annotations.

All timing annotations are present and correct. Example queries updated to use dual-table JOIN pattern.

### market-schemas.ts (minor addition)
Added `Prior_Range_vs_ATR DOUBLE` column to `market.daily` CREATE TABLE (after `Prev_Return_Pct`). This was a documented schema gap from Phase 62 — the field was designed but never added. It is `timing: 'open'` because it uses the prior day's high/low/ATR, all known at market open.

### field-timing.ts (full rewrite)
- Derives field sets from both `daily` and `context` columns in schema-metadata
- Exports table-specific sets: `DAILY_OPEN_FIELDS`, `DAILY_CLOSE_FIELDS`, `DAILY_STATIC_FIELDS`, `CONTEXT_OPEN_FIELDS`, `CONTEXT_CLOSE_FIELDS`
- Exports combined sets: `OPEN_KNOWN_FIELDS` (9 total), `CLOSE_KNOWN_FIELDS` (36 total), `STATIC_FIELDS` (3 total)
- `buildLookaheadFreeQuery`: Both overloads now produce a `joined AS (SELECT ... FROM market.daily d LEFT JOIN market.context c ON d.date = c.date)` CTE followed by `lagged AS (SELECT ... LAG(...) OVER (PARTITION BY ticker ORDER BY date))`, then filter to requested dates
- `buildOutcomeQuery`: Both overloads now query from `market.daily LEFT JOIN market.context`, returning close-derived fields from both tables

### data-availability.ts (new file)
Created `checkDataAvailability(conn, ticker, options?)` helper that:
- Queries `COUNT(*), MIN(date), MAX(date)` from `market.daily`, `market.context`, and optionally `market.intraday`
- Returns `DataAvailabilityReport` with boolean flags, date ranges, and actionable warning messages
- Handles missing tables gracefully (try/catch — treats table-not-found as no data)

### field-timing.test.ts (full rewrite)
- 38 tests pass (vs 2 failing before — the 44-field and 55-total assertions were outdated)
- New counts: 9 open, 36 close, 3 static, 48 total classified columns
- New table-specific assertions for DAILY_OPEN/CLOSE, CONTEXT_OPEN/CLOSE sets
- New classification tests: `Prior_Range_vs_ATR` (open), `BB_Width` (close), `Vol_Regime` (context close), `VIX_Open`/`VIX_Gap_Pct` (context open)
- Updated buildLookaheadFreeQuery tests: verify `FROM market.daily d LEFT JOIN market.context c`, `PARTITION BY ticker ORDER BY date`

## Deviations from Plan

None — plan executed exactly as written.

## Key Decisions Made

1. **Tier 3 columns in schema-metadata**: `High_Time`, `Low_Time`, `High_Before_Low`, `Reversal_Type` are included in the `daily` table description because they exist as columns in `market.daily` CREATE TABLE, even though Tier 3 enrichment is deferred. This is correct — the columns exist and may be populated later.

2. **Legacy string[] overload**: The `buildLookaheadFreeQuery(string[])` overload was updated to query `market.daily JOIN market.context` (not `spx_daily`). The ticker is appended as the last parameter (`$N+1`) to avoid shifting the date placeholder numbering. This preserves backward compatibility for any callers that pass string dates.

3. **Field count changes**: Old schema had 8 open / 44 close / 3 static = 55 total (after Trend_Score removal, actually 43 close = 54, but tests were written for 44/55). New schema: 9 open / 36 close / 3 static = 48 total. The reduction is because old `spx_daily` had many Tier 3 intraday timing columns not in the new schema (High_In_First_Hour, Low_In_First_Hour, etc.) and old VIX intraday aggregate columns are gone.

## Self-Check

Checking created files exist:
- FOUND: packages/mcp-server/src/utils/data-availability.ts
- FOUND: packages/mcp-server/src/utils/field-timing.ts
- FOUND: packages/mcp-server/src/utils/schema-metadata.ts
- FOUND: .planning/phases/63-tool-migration/63-01-SUMMARY.md

Checking commits exist:
- FOUND: 4a3e634 feat(63-01): rewrite schema-metadata.ts with new normalized table structure
- FOUND: 6cd7d38 feat(63-01): rewrite field-timing.ts with dual-table derivation and JOIN-aware CTE
- FOUND: 19be8f3 test(63-01): update field-timing.test.ts for dual-table schema, all 38 tests pass

## Self-Check: PASSED
