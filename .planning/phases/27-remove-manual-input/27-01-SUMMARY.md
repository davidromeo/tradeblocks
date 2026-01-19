---
phase: 27-remove-manual-input
plan: 01
subsystem: calculations
tags: [portfolio-stats, analysis-config, type-cleanup, risk-free-rate]

# Dependency graph
requires:
  - phase: 26-core-calculations
    provides: date-based Treasury rate calculations via getRiskFreeRate()
provides:
  - AnalysisConfig without riskFreeRate field
  - ProcessedBlock.analysisConfig without riskFreeRate
  - DEFAULT_ANALYSIS_CONFIG without riskFreeRate
  - calculateRollingSharpe using date-based rates
affects: [27-02, 27-03, stores, services, MCP, tests, UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Risk-free rates from historical Treasury data only (no manual override)"

key-files:
  created: []
  modified:
    - lib/models/portfolio-stats.ts
    - lib/models/block.ts
    - lib/models/validators.ts
    - lib/calculations/portfolio-stats.ts
    - lib/calculations/performance.ts

key-decisions:
  - "Remove riskFreeRate completely (not deprecate) since Phase 26 provides historical rates"
  - "Update calculateRollingSharpe to use getRiskFreeRate() for consistency"

patterns-established:
  - "AnalysisConfig no longer accepts risk-free rate overrides"
  - "All Sharpe/Sortino calculations use historical Treasury rates exclusively"

# Metrics
duration: 5min
completed: 2026-01-18
---

# Phase 27 Plan 01: Remove Manual Input Types/Models Summary

**Removed riskFreeRate from AnalysisConfig interface, ProcessedBlock type, Zod validator, and calculation defaults - foundation layer now uses date-based Treasury rates exclusively**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-01-18T23:50:00Z
- **Completed:** 2026-01-18T23:55:00Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments
- Removed `riskFreeRate` from `AnalysisConfig` interface in portfolio-stats.ts
- Removed `riskFreeRate` from `ProcessedBlock.analysisConfig` type in block.ts
- Removed `riskFreeRate` from `analysisConfigSchema` Zod validator
- Removed `riskFreeRate` from `DEFAULT_ANALYSIS_CONFIG` constant
- Updated `calculateRollingSharpe` to use `getRiskFreeRate(date)` instead of parameter

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove riskFreeRate from type definitions** - `af53820` (refactor)
2. **Task 2: Remove riskFreeRate from calculation files** - `3b87f2b` (refactor)

**Plan metadata:** `9954e94` (docs)

## Files Modified
- `lib/models/portfolio-stats.ts` - Removed riskFreeRate from AnalysisConfig interface
- `lib/models/block.ts` - Removed riskFreeRate from ProcessedBlock.analysisConfig type
- `lib/models/validators.ts` - Removed riskFreeRate from analysisConfigSchema
- `lib/calculations/portfolio-stats.ts` - Removed riskFreeRate from DEFAULT_ANALYSIS_CONFIG
- `lib/calculations/performance.ts` - Updated calculateRollingSharpe to use getRiskFreeRate()

## Decisions Made
- **Complete removal vs deprecation:** Chose complete removal since Phase 26 already implemented the replacement (date-based rates). No need for backward compatibility.
- **calculateRollingSharpe update:** Updated unused function to use date-based rates for consistency, even though it's currently dead code in the codebase.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript correctly reports errors in downstream files (stores, UI, tests) that still reference riskFreeRate. This is expected and will be fixed in Plans 02 and 03.

## Expected Downstream Errors

As designed, `npm run build` now shows TypeScript errors in files not yet updated:
- `app/(platform)/assistant/page.tsx` - Still passes `riskFreeRate` to PortfolioStatsCalculator

These errors will be resolved in:
- Plan 02: Stores/services/MCP cleanup
- Plan 03: UI/tests cleanup

## Next Phase Readiness
- Type definitions and core calculations cleaned up
- Ready for Plan 02 to clean up stores, services, and MCP
- Ready for Plan 03 to clean up UI components and tests

---
*Phase: 27-remove-manual-input*
*Completed: 2026-01-18*
