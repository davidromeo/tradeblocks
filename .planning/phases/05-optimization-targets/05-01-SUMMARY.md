---
phase: 05-optimization-targets
plan: 01
subsystem: ui
tags: [react, walk-forward, optimization, dropdown]

# Dependency graph
requires:
  - phase: 01-audit-analysis
    provides: identification of broken diversification targets
provides:
  - Clean optimization target dropdown with only working options
  - Documentation of why diversification targets kept in types
affects: [walk-forward-analysis, user-experience]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - components/walk-forward/period-selector.tsx
    - lib/models/walk-forward.ts

key-decisions:
  - "Keep diversification targets in type for backward compatibility with stored configs"
  - "Remove from UI rather than implement expensive per-combination calculations"

patterns-established: []

issues-created: []

# Metrics
duration: 5min
completed: 2026-01-11
---

# Phase 5 Plan 01: Remove Broken Diversification Targets Summary

**Removed broken diversification optimization targets (minAvgCorrelation, minTailRisk, maxEffectiveFactors) from dropdown while preserving type compatibility**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-11T17:38:00Z
- **Completed:** 2026-01-11T17:43:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 2

## Accomplishments

- Removed 3 broken diversification targets from TARGET_OPTIONS array
- Removed "diversification" group from optimization target dropdown
- Removed isDiversificationTarget helper function no longer needed
- Removed "Performance Floor" UI section (~100 lines)
- Added documentation explaining why diversification targets remain in types

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove broken diversification targets from dropdown** - `7a00524` (fix)
2. **Task 2: Clean up type definition** - `b195fef` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/walk-forward/period-selector.tsx` - Removed diversification targets from dropdown, helper function, and Performance Floor section
- `lib/models/walk-forward.ts` - Added comment explaining why diversification targets kept in type

## Decisions Made

- **Keep types for backward compatibility**: Diversification targets remain in WalkForwardOptimizationTarget type to prevent breaking stored analysis configs that might reference them
- **Document rather than delete**: Added comments explaining the technical reason (computing diversification metrics per parameter combination is too expensive)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

Phase 5 complete. Ready for Phase 6 (Results Summary View).

- Users can no longer select broken diversification targets
- 8 working optimization targets available in 2 groups
- Diversification CONSTRAINTS continue to work correctly

---
*Phase: 05-optimization-targets*
*Completed: 2026-01-11*
