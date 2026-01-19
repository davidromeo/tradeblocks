---
phase: 26-core-calculations
plan: 01
subsystem: calculations
tags: [sharpe, sortino, risk-free-rate, treasury, tdd]

# Dependency graph
requires:
  - phase: 25-treasury-data
    provides: getRiskFreeRate(date) lookup utility
provides:
  - Date-based excess return calculation for Sharpe ratio
  - Date-based excess return calculation for Sortino ratio
  - DailyReturnWithDate interface for date-paired returns
affects: [27-remove-manual-input, 28-mcp-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Per-day Treasury rate lookup for risk-adjusted metrics
    - Date-paired returns structure for time-aware calculations

key-files:
  created:
    - tests/unit/portfolio-stats-risk-free.test.ts
  modified:
    - lib/calculations/portfolio-stats.ts

key-decisions:
  - "config.riskFreeRate is now ignored - date-based rates always used"
  - "Excess return = daily return - (getRiskFreeRate(date) / 100 / 252)"

patterns-established:
  - "Date-paired returns: {date: Date, return: number}[] for time-aware calculations"

issues-created: []

# Metrics
duration: 7min
completed: 2026-01-18
---

# Phase 26 Plan 01: Core Calculations Summary

**Sharpe and Sortino ratios now use per-day Treasury rates via getRiskFreeRate(date) lookup, replacing fixed rate assumption**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-18T23:38:59Z
- **Completed:** 2026-01-18T23:45:59Z
- **Tasks:** 2 (RED + GREEN phases; no REFACTOR needed)
- **Files modified:** 2

## TDD Cycle

### RED
- Created `tests/unit/portfolio-stats-risk-free.test.ts` with 10 test cases
- Tests cover: 2020 COVID low-rate period, 2023 high-rate period, daily log path, trade-based path, config.riskFreeRate ignored, empty data handling
- All tests failed initially as expected (Sharpe/Sortino still using fixed rates)

### GREEN
- Added `DailyReturnWithDate` interface: `{date: Date, return: number}`
- Added `calculateDailyReturnsWithDates()` method returning date-paired returns
- Refactored `calculateSharpeRatio()` to compute per-day excess returns using `getRiskFreeRate(date)`
- Refactored `calculateSortinoRatio()` with same date-based approach
- All 10 new tests pass, all 10 existing tests pass

### REFACTOR
- Not needed - implementation was clean on first pass

## Accomplishments

- Sharpe ratio now uses actual historical Treasury rates for each trading day
- Sortino ratio now uses actual historical Treasury rates for each trading day
- COVID 2020 (~0% rates) correctly produces higher ratios than 2023 (~5% rates) for identical returns
- config.riskFreeRate parameter is now ignored (date-based rates always used)

## Task Commits

TDD commits:

1. **RED: Add failing tests** - `1416b5b` (test)
2. **GREEN: Implement date-based rates** - `fa78813` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `tests/unit/portfolio-stats-risk-free.test.ts` - 10 test cases for date-based risk-free rate behavior
- `lib/calculations/portfolio-stats.ts` - Added DailyReturnWithDate interface, calculateDailyReturnsWithDates() method, refactored Sharpe/Sortino

## Verification

```
npm test -- tests/unit/portfolio-stats-risk-free.test.ts
  ✓ 10 tests passed

npm test -- tests/unit/portfolio-stats.test.ts
  ✓ 10 tests passed

npm run build
  ✓ No TypeScript errors
```

## Decisions Made

- **config.riskFreeRate ignored:** Rather than using the config value as a fallback, date-based rates are always used. This ensures consistency and prepares for Phase 27 which will remove the config option entirely.
- **Excess return formula:** `excessReturn = dailyReturn - (getRiskFreeRate(date) / 100 / 252)` - converts annual rate to daily rate for each specific trading day.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Phase 26 complete (1/1 plans done)
- Ready for Phase 27: Remove Manual Input (clean up riskFreeRate from types, stores, UI)

---
*Phase: 26-core-calculations*
*Completed: 2026-01-18*
