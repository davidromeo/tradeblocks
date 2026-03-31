---
phase: 74-pre-ship-polish
plan: 02
subsystem: bar-cache-utility
tags: [refactor, drY, cache, greeks, timestamp-lookup]
dependency_graph:
  requires: []
  provides: [bar-cache-utility, tolerant-timestamp-lookup]
  affects: [replay.ts, trade-replay.ts]
tech_stack:
  added: []
  patterns: [shared-cache-utility, binary-search-nearest-timestamp, tdd]
key_files:
  created:
    - packages/mcp-server/src/utils/bar-cache.ts
    - packages/mcp-server/tests/unit/bar-cache.test.ts
  modified:
    - packages/mcp-server/src/tools/replay.ts
    - packages/mcp-server/src/utils/trade-replay.ts
    - packages/mcp-server/src/test-exports.ts
decisions:
  - "fetchBarsWithCache accepts optional DuckDBConnection (conn) to avoid repeated getConnection calls in hot paths"
  - "sortedTimestamps built from intraday keys only (filter k.includes(' ')) — date-only keys from daily fallback excluded"
  - "findNearestTimestamp uses minutes-since-midnight for comparison — seconds within same minute are not tracked in HH:MM format"
  - "Pre-existing trade-replay-greeks test failure (DTE<=0 on same-day expiry at 09:31) confirmed out of scope — not caused by these changes"
metrics:
  duration_seconds: 234
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_changed: 5
requirements_satisfied: [POL-02, POL-03, POL-04, POL-05, TST-15]
---

# Phase 74 Plan 02: Shared fetchBarsWithCache + Tolerant Timestamp Lookup Summary

**One-liner:** Shared `fetchBarsWithCache` utility (cache-read → API → cache-write) eliminates duplicated DuckDB+Massive logic in replay.ts; binary-search `findNearestTimestamp` in trade-replay.ts tolerates ±60s timestamp mismatch between option and underlying bars.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create fetchBarsWithCache utility and unit tests | 777d361 | bar-cache.ts, bar-cache.test.ts, test-exports.ts |
| 2 | Refactor replay.ts + add tolerant timestamp lookup to trade-replay.ts | c9073e9 | replay.ts, trade-replay.ts, test-exports.ts |

## What Was Built

### Task 1: bar-cache.ts (TDD)

New utility at `packages/mcp-server/src/utils/bar-cache.ts` implementing the standard cache-read → API-fetch → cache-write lifecycle:

1. **Cache-read**: SELECT from `market.intraday` — returns immediately on hit (no API call)
2. **API fetch**: calls `fetchBars()` from massive-client on cache miss
3. **Cache-write**: INSERT OR REPLACE into `market.intraday` in batches of 500 (best-effort)

DuckDB errors on read or write are swallowed. API errors return `[]`. Returns `[]` when both cache and API have no data.

5 unit tests cover all paths: cache hit, cache miss+write, empty both, DuckDB error fallthrough, options passthrough.

### Task 2: replay.ts refactor + tolerant timestamp lookup

**replay.ts:**
- `import { fetchBars }` replaced with `import { fetchBarsWithCache }` from bar-cache
- `fetchLegBars()` inner function: replaced ~65 lines of inline cache-read/API/fallback-root with ~25 lines calling `fetchBarsWithCache` twice (primary + fallback root)
- Underlying bar fetch: replaced ~70 lines of inline cache-read/API/cache-write with a single `fetchBarsWithCache()` call
- Separate `INSERT OR REPLACE INTO market.intraday` blocks (option + underlying) removed entirely — now handled by `fetchBarsWithCache`
- `sortedTimestamps` array built from `underlyingPrices` keys (intraday only) and passed to `GreeksConfig`

**trade-replay.ts:**
- `findNearestTimestamp(sortedTimestamps, target, toleranceSec)` — exported binary search helper
- `timestampToMinutes()` — private helper converting `"YYYY-MM-DD HH:MM"` to minutes-since-midnight
- `GreeksConfig.sortedTimestamps?: string[]` — optional field for intraday timestamp lookup
- `computeStrategyPnlPath`: underlying price lookup now has three levels:
  1. Exact timestamp match
  2. Nearest within 60s via `findNearestTimestamp` (new — fixes D-07/D-08)
  3. Date-only fallback (daily bars)

## Deviations from Plan

None — plan executed exactly as written, except the pre-existing test failure noted below.

## Pre-existing Issues (Not Caused by This Plan)

**trade-replay-greeks.test.ts: "returns null greeks values when DTE <= 0"**

This test was failing before any changes in this plan (confirmed by reverting to previous commit). The test sets expiry to "2025-03-19" (same calendar day as bars at "09:31"), but DTE at 09:31 is actually ~0.27 days (expiry at 4PM ET), so greeks are computed rather than returning null. The test comment says "same day = past expiry" which is incorrect — expiry day at 09:31 has ~6.5h remaining.

This is out of scope per deviation rules (pre-existing failure in file not modified by this plan's core changes). Documented in deferred-items.

## Known Stubs

None.

## Self-Check

- [x] bar-cache.ts exists with `fetchBarsWithCache` exported
- [x] replay.ts imports from `bar-cache.js` (grep confirmed 1 match)
- [x] trade-replay.ts has `findNearestTimestamp` (grep confirmed 3 occurrences)
- [x] trade-replay.ts has `sortedTimestamps` (grep confirmed 10 occurrences)
- [x] replay.ts has 0 `INSERT OR REPLACE INTO market.intraday` (grep confirmed)
- [x] All bar-cache tests pass (5/5)
- [x] All trade-replay.test.ts tests pass (33/33)
- [x] Commits 777d361 and c9073e9 exist in git log

## Self-Check: PASSED
