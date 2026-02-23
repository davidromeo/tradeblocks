---
phase: 64-cleanup-and-api-surface
plan: 03
subsystem: database
tags: [duckdb, market-data, enrichment, intraday, typescript]

# Dependency graph
requires:
  - phase: 64-01
    provides: computeIntradayTimingFields stub exported from test-exports.ts
  - phase: 63-02
    provides: market.intraday schema with ticker/date/time/OHLC columns
provides:
  - Tier 3 enrichment computing 6 intraday timing fields from market.intraday bars
  - Opening_Drive_Strength and Intraday_Realized_Vol columns in market.daily schema
  - computeIntradayTimingFields pure function (exported) with decimal-hours API
  - 16 unit tests covering all Tier 3 computation cases
affects: [any future enrichment phases, MCP analysis tools querying intraday fields]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "runTier3 follows same structure as runTier2: hasTier3Data check, query intraday, group by date, compute, batchUpdateDaily"
    - "computeIntradayTimingFields returns null for empty input (not object-with-nulls)"
    - "Decimal hours representation: 10.5 = 10:30 (not HHMM numeric 1030)"
    - "Opening drive strength = first-30-min range / full-day range (ratio, not %)"
    - "Intraday vol = barStdDev * sqrt(bars.length * 252) (decimal, not %)"

key-files:
  created:
    - packages/mcp-server/tests/unit/tier3-enrichment.test.ts
  modified:
    - packages/mcp-server/src/db/market-schemas.ts
    - packages/mcp-server/src/utils/market-enricher.ts

key-decisions:
  - "computeIntradayTimingFields returns null for empty bars (not object with null fields) — enables !null check in callers"
  - "Opening drive strength uses ratio formula (first-30-min-range / full-day-range) not percentage formula — more intuitive 0-1 scale"
  - "intradayRealizedVol is decimal (0.X) not percentage — consistent with financial convention; tests confirm < 2.0 for normal data"
  - "Reversal type boundary at 12:00 noon: morning = before 12:00, afternoon >= 12:00"
  - "Opening period = bars with decimal hours < 10.0 (i.e., before 10:00 AM ET) — market opens 09:30, first 30 min"

patterns-established:
  - "Tier 3 pure function replaces stub: same export name, different return type (null | object vs always-object)"
  - "ALTER TABLE migration after CREATE TABLE IF NOT EXISTS for new Tier 3 columns"

requirements-completed: [ENR-04]

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 64 Plan 03: Tier 3 Intraday Timing Enrichment Summary

**Tier 3 enrichment computing High_Time, Low_Time, High_Before_Low, Reversal_Type, Opening_Drive_Strength, Intraday_Realized_Vol from market.intraday bars, with schema migration and 16 unit tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T15:42:29Z
- **Completed:** 2026-02-23T15:46:29Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- Replaced computeIntradayTimingFields stub (wrong API) with full implementation: returns null for empty input, camelCase fields, decimal hours, ratio-based opening drive strength
- Implemented runTier3 function that queries market.intraday by date range, groups bars by date, computes all 6 fields per day, and batch-updates market.daily
- Replaced hard-skip at line 897 with actual runTier3 call — Tier 3 enrichment now runs when intraday data is present
- Added Opening_Drive_Strength and Intraday_Realized_Vol columns to market.daily schema plus ALTER TABLE migration for existing databases
- 16 unit tests passing covering all output field groups

## Task Commits

Each task was committed atomically:

1. **Task 1: Add schema columns and implement Tier 3 enrichment** - `a481ff7` (feat)
2. **Task 2: Unit tests for Tier 3 computation logic** - `bdec027` (test)

## Files Created/Modified
- `packages/mcp-server/src/db/market-schemas.ts` - Added Opening_Drive_Strength and Intraday_Realized_Vol to CREATE TABLE and ALTER TABLE migration block
- `packages/mcp-server/src/utils/market-enricher.ts` - Replaced computeIntradayTimingFields stub with full implementation; added runTier3 and hhmmToDecimalHours; replaced hard-skip with runTier3 call; updated JSDoc
- `packages/mcp-server/tests/unit/tier3-enrichment.test.ts` - 16 unit tests for computeIntradayTimingFields covering all fields and edge cases

## Decisions Made
- computeIntradayTimingFields returns `null` for empty bars rather than an object with null fields — simpler null check for callers, matches plan spec
- Opening drive strength uses ratio (0-1 scale) not percentage — more natural for comparing across different volatility days; plan spec used ratio approach
- Stub at bottom of market-enricher.ts had a different API (PascalCase fields, HHMM numeric, percentage vol, always-object return) — fully replaced with plan's API to match test expectations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced stub with incompatible API**
- **Found during:** Task 1 (schema + enrichment implementation)
- **Issue:** The existing computeIntradayTimingFields stub (added in Plan 64-01) had a completely different API: returned `IntradayTimingResult` (PascalCase fields, never null), used HHMM numeric format (1030 for 10:30), used percentage-based Opening_Drive_Strength formula. The plan's tests expected camelCase fields, decimal hours, ratio formula, and null for empty input.
- **Fix:** Replaced the entire stub section with the plan's specified implementation including new `hhmmToDecimalHours` helper
- **Files modified:** packages/mcp-server/src/utils/market-enricher.ts
- **Verification:** All 16 tests pass, TypeScript compiles cleanly
- **Committed in:** a481ff7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in stub API)
**Impact on plan:** Required replacement to match test expectations. The stub was explicitly a placeholder for Plan 64-03 implementation, so this is expected scope.

## Issues Encountered
None - plan executed as specified once stub API mismatch was resolved.

## Next Phase Readiness
- Phase 64 complete — all 3 plans done
- Tier 3 enrichment functional when intraday bars are present in market.intraday
- The early-return path (Tier 1 already up to date) still returns hardcoded tier3 skip — acceptable since Tier 3 was not enriched in that batch anyway

---
*Phase: 64-cleanup-and-api-surface*
*Completed: 2026-02-23*
