---
phase: 63-tool-migration
plan: 02
subsystem: mcp-server/tools
tags: [schema-migration, market-data-tools, duckdb, enrichment, filters]
dependency_graph:
  requires: [63-01]
  provides: [enrich_trades-dual-table, analyze_regime_performance-dual-table, suggest_filters-new-candidates, Prior_Range_vs_ATR-enrichment]
  affects: [market-data.ts, market-enricher.ts]
tech_stack:
  added: []
  patterns: [checkDataAvailability-at-tool-start, composite-filter-generation, pivot-intraday-to-wide-format]
key_files:
  created: []
  modified:
    - packages/mcp-server/src/tools/market-data.ts
    - packages/mcp-server/src/utils/market-enricher.ts
decisions:
  - Prior_Range_vs_ATR computed in Tier 1 enricher as (high[i-1] - low[i-1]) / ATR[i-1] — first bar is null (no prior day)
  - Intraday queries updated to use market.intraday with CASE-WHEN pivot for checkpoint columns (graceful degradation — returns empty results until import blocker resolved)
  - checkpointFields moved before query in calculate_orb to resolve forward reference
  - Composite filter improvement threshold: compositeWinRate > max(filterA_projected, filterB_projected) + 2pp
  - Pre-existing TS error (profitFactor possibly null) fixed as Rule 1 deviation
metrics:
  duration_seconds: 350
  tasks_completed: 2
  files_modified: 2
  files_created: 0
  tests_added: 0
  completed_date: 2026-02-22
---

# Phase 63 Plan 02: Tool Migration (enrich_trades, analyze_regime_performance, suggest_filters) Summary

Migrated three market-data tools (enrich_trades, analyze_regime_performance, suggest_filters) from the old `market.spx_daily` monolithic table to the new normalized schema (`market.daily JOIN market.context`), integrated `checkDataAvailability` warnings, added new enrichment field exposure (BB_Width, Realized_Vol_5D/20D, BB_Position, Prior_Range_vs_ATR), and implemented composite filter suggestion generation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate enrich_trades + add Prior_Range_vs_ATR to enricher | 5f47fc3 | market-data.ts, market-enricher.ts |
| 2 | Migrate analyze_regime_performance and suggest_filters | 5f47fc3 | market-data.ts (same commit) |

Note: Both tasks were completed in a single commit since all changes were to the same files and were worked atomically.

## What Was Built

### market-enricher.ts: Prior_Range_vs_ATR computation

Added `Prior_Range_vs_ATR` computation to the Tier 1 enrichment loop in `runEnrichment()`:
- For bar `i`: `Prior_Range_vs_ATR[i] = (high[i-1] - low[i-1]) / ATR[i-1]`
- First bar: `null` (no prior day)
- ATR must be valid (non-NaN, > 0) for the value to be set
- Added `"Prior_Range_vs_ATR"` to the `columns` array for batch UPDATE
- Removed the schema gap comment about `Prior_Range_vs_ATR` (column now written)

### market-data.ts: DailyMarketData interface update

Replaced the old `DailyMarketData` interface (referencing `market.spx_daily`) with an updated version documenting the new dual-table structure:
- Fields organized by source table (`market.daily` vs `market.context`)
- Timing annotations in comments (`// open-known`, `// close-derived`)
- New fields added: `Prior_Range_vs_ATR`, `BB_Width`, `Realized_Vol_5D`, `Realized_Vol_20D`
- Replaced `Intraday15MinData` interface with a documentation comment about `market.intraday` schema

### enrich_trades tool

- Added optional `ticker` parameter (default: SPX)
- Added `checkDataAvailability` call at handler start; warnings included in response when non-empty
- Updated intraday queries to use `market.intraday` with SQL CASE-WHEN pivot to produce checkpoint columns (`P_0930`, `P_0945`, etc.) that `buildIntradayContext` expects
- VIX intraday similarly pivoted to produce `VIX_HHMM` columns
- `SPX_CHECKPOINTS` and `VIX_CHECKPOINTS` imported from `intraday-timing.ts` for pivot generation
- Updated lagNote to mention new fields (BB_Width, Realized_Vol_5D/20D, BB_Position, Prior_Range_vs_ATR, VIX_Gap_Pct)
- Updated description to reference new tables and new enrichment fields

### analyze_regime_performance tool

- Added optional `ticker` parameter (default: SPX)
- Added `checkDataAvailability` at handler start; warnings included in response when non-empty
- Updated description to reference `market.daily` and `market.context`
- Updated lagNote to mention fields come from `market.context` via JOIN
- Added code comment: `// Future: BB_Width quartile and Realized_Vol regime segmentation dimensions can be added here`
- No changes to segmentation logic — `prev_Vol_Regime` and `prev_Term_Structure_State` field names are unchanged (they come from the LAG CTE regardless of source table)

### suggest_filters tool

- Added optional `ticker` parameter (default: SPX)
- Added `checkDataAvailability` at handler start; warnings included in response when non-empty
- Added 8 new standalone filter candidates:
  - `BB_Width > 0.05` (wide bands, close-derived)
  - `BB_Width < 0.02` (narrow bands, close-derived)
  - `Realized_Vol_5D > 1.5%` (close-derived)
  - `Realized_Vol_20D > 1.2%` (close-derived)
  - `BB_Position > 0.9` (near upper band, close-derived)
  - `BB_Position < 0.1` (near lower band, close-derived)
  - `Prior_Range_vs_ATR > 1.5` (outsized range, open-known — uses same-day value)
  - `Prior_Range_vs_ATR < 0.5` (compressed range, open-known — uses same-day value)
- Added composite filter suggestion generation:
  - Takes pairs of `significantFilters` (winRateDelta > 3)
  - Finds trades that match BOTH filters
  - Only surfaces composites where `compositeWinRate > max(filterA_projected, filterB_projected) + 2pp`
  - Sorted by improvement, top 5 returned in `compositeSuggestions` field
- Updated `lagNote` to include new close-derived fields

### calculate_orb tool

- Updated SQL to query `market.intraday` instead of `market.spx_15min`
- Moved `checkpointFields` definition before the query (it was referenced in the pivot SQL)
- Query now uses CASE-WHEN pivot to produce the same checkpoint column format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript error: profitFactor possibly null**
- **Found during:** Task 1 (compilation check)
- **Issue:** `profitFactor` could be `null` (when `grossLosses === 0` and `grossWins === 0`), but `Math.round(profitFactor * 100) / 100` would fail TypeScript's null check
- **Fix:** Changed to `profitFactor !== null ? Math.round(profitFactor * 100) / 100 : null`
- **Files modified:** `packages/mcp-server/src/tools/market-data.ts`
- **Commit:** 5f47fc3
- **Note:** This was documented in STATE.md as a pre-existing issue (line 83: "Pre-existing TypeScript error in `packages/mcp-server/src/tools/market-data.ts:482`")

### Structural Notes

- Both tasks committed in a single commit (`5f47fc3`) because they both modified `market-data.ts` and were worked in the same session. The task boundary was logical but the commit is clean and covers both.
- The `calculate_orb` tool was also updated to reference `market.intraday` (was referencing `market.spx_15min`) even though it was not explicitly listed as a plan task — required for the "zero references to old table names" success criterion.

## Key Decisions Made

1. **Prior_Range_vs_ATR formula**: `(high[i-1] - low[i-1]) / ATR[i-1]`. Uses prior bar's high, low, and ATR. ATR validity checked before division. First bar is `null`.

2. **Intraday SQL pivot approach**: Used CASE-WHEN pivot in DuckDB SQL to transform `market.intraday` (normalized one-row-per-bar) back into wide-format checkpoint columns that `buildIntradayContext` expects. This maintains backward compatibility with the intraday timing logic while referencing the correct new table.

3. **checkpointFields moved before query in calculate_orb**: The original code defined `checkpointFields` after the query that referenced it. Moving it before fixed a forward reference issue and improved code clarity.

4. **Composite filter improvement threshold**: A composite is surfaced only if `compositeWinRate > max(filterA_projected, filterB_projected) + 2pp`. This ensures composites are genuinely additive rather than just equivalent to the better standalone filter.

## Self-Check

Checking created files exist:
- No new files created.

Checking key modified files exist:
- FOUND: packages/mcp-server/src/tools/market-data.ts
- FOUND: packages/mcp-server/src/utils/market-enricher.ts

Checking commits exist:
- FOUND: 5f47fc3 feat(63-02): migrate enrich_trades to new schema with Prior_Range_vs_ATR and checkDataAvailability

## Self-Check: PASSED
