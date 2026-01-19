---
phase: 28-mcp-tests
plan: 01
subsystem: testing
tags: [jest, calendar-scaling, leg-groups, maxLoss, strategyMatches]

# Dependency graph
requires:
  - phase: 27-remove-manual-input
    provides: riskFreeRate removed from MCP and tests
provides:
  - Clean test suite with 989/989 tests passing
  - Fixed maxLoss fallback for debit trades
  - Fixed calendar scaling tests with correct strategyMatches API usage
affects: [milestone-completion, v2.2-release]

# Tech tracking
tech-stack:
  added: []
  patterns: [strategyMatches-required-for-toReported-scaling]

key-files:
  created: []
  modified:
    - lib/utils/combine-leg-groups.ts
    - tests/unit/calendar-data.test.ts

key-decisions:
  - "Use premium as maxLoss fallback for debit trades without explicit maxLoss"
  - "Tests must pass strategyMatches parameter for toReported mode scaling"

patterns-established:
  - "toReported scaling: Always pass strategyMatches with isAutoMatched field"
  - "maxLoss fallback: For debit trades (premium < 0), fallback to premium paid"

issues-created: []

# Metrics
duration: 15min
completed: 2026-01-18
---

# Phase 28: MCP Tests Summary

**Fixed 6 pre-existing test failures: maxLoss fallback for debit trades and calendar scaling tests with proper strategyMatches parameter usage**

## Performance

- **Duration:** 15 min
- **Started:** 2026-01-18T18:15:00-06:00
- **Completed:** 2026-01-18T18:30:00-06:00
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Fixed maxLoss calculation for single debit trades (Long Call with undefined maxLoss now uses premium paid)
- Fixed 5 calendar scaling tests by adding required strategyMatches parameter with isAutoMatched field
- Achieved clean test run with all 989 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix maxLoss fallback for debit trades** - `0489c6f` (fix)
2. **Task 2: Fix calendar scaling tests with strategyMatches** - `54b06e1` (test)
3. **Task 3: Run full test suite** - No commit (verification only)

## Files Created/Modified
- `lib/utils/combine-leg-groups.ts` - Added maxLoss fallback for single debit trades when maxLoss is undefined and premium < 0
- `tests/unit/calendar-data.test.ts` - Added strategyMatches parameter to 5 tests using toReported mode, including isAutoMatched: false field

## Decisions Made
- **maxLoss fallback logic:** For single debit trades without explicit maxLoss, use premium paid as the maximum possible loss (risk is limited to initial investment)
- **strategyMatches API usage:** Tests were incorrectly calling getScaledDayBacktestPl without strategyMatches, which caused toReported scaling to fall back to raw values

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
- TypeScript errors in test file due to missing `isAutoMatched` property in StrategyMatch objects - fixed by adding required field
- `getScaledDayMargin` only takes 2 arguments (not 3) - removed incorrect third parameter

## Next Phase Readiness
- v2.2 milestone ready to ship with clean test suite
- All 989 tests passing
- No TypeScript errors in modified files

---
*Phase: 28-mcp-tests*
*Completed: 2026-01-18*
