---
phase: 27-remove-manual-input
plan: "02"
subsystem: ui
tags: [refactor, riskFreeRate, stores, services, cleanup]

# Dependency graph
requires:
  - phase: 27-01
    provides: Removed riskFreeRate from type definitions (PortfolioStatsCalculator, PerformanceSnapshot)
provides:
  - Cleaned riskFreeRate from Zustand stores (block-store, performance-store)
  - Cleaned riskFreeRate from services (performance-snapshot, calendar-data)
  - Removed Risk-free Rate input control from block-stats page UI
  - Removed riskFreeRate from block-dialog analysisConfig
affects: [27-03, tests, MCP]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - lib/stores/block-store.ts
    - lib/stores/performance-store.ts
    - lib/services/performance-snapshot.ts
    - lib/services/calendar-data.ts
    - app/(platform)/block-stats/page.tsx
    - app/(platform)/assistant/page.tsx
    - components/block-dialog.tsx

key-decisions:
  - "No user-facing configuration for risk-free rate needed since date-based lookup handles it automatically"
  - "Removed Input import cleanup as part of Task 2 commit"

patterns-established: []

# Metrics
duration: 8min
completed: 2026-01-18
---

# Phase 27 Plan 02: Stores/Services/UI Cleanup Summary

**Removed riskFreeRate parameter from all application layer code including stores, services, and UI components**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-18T23:59:30Z
- **Completed:** 2026-01-19T00:07:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Removed riskFreeRate from PortfolioStatsCalculator instantiations in block-store and calendar-data
- Removed riskFreeRate from buildPerformanceSnapshot calls across all stores and services
- Removed riskFreeRate from SnapshotOptions interface
- Removed Risk-free Rate input control from block-stats page UI
- Removed riskFreeRate from analysisConfig in block-dialog

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove riskFreeRate from stores and services** - `82ddee5` (refactor)
2. **Task 2: Remove riskFreeRate from UI components** - `c892cff` (refactor)

## Files Created/Modified

- `lib/stores/block-store.ts` - Removed riskFreeRate from PortfolioStatsCalculator and buildPerformanceSnapshot calls
- `lib/stores/performance-store.ts` - Removed riskFreeRate variable and isDefaultView check
- `lib/services/performance-snapshot.ts` - Removed riskFreeRate from SnapshotOptions interface and implementation
- `lib/services/calendar-data.ts` - Removed riskFreeRate from PortfolioStatsCalculator call
- `app/(platform)/block-stats/page.tsx` - Removed riskFreeRate state, input control, and all related usages
- `app/(platform)/assistant/page.tsx` - Removed riskFreeRate from snapshot and calculator calls
- `components/block-dialog.tsx` - Removed riskFreeRate from analysisConfig and all buildPerformanceSnapshot calls

## Decisions Made

- Removed the Risk-free Rate input control from block-stats UI since date-based lookup now handles rate automatically
- Cleaned up unused Input import that was left after removing the input control

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused Input import**
- **Found during:** Task 2 (Remove riskFreeRate from UI components)
- **Issue:** ESLint pre-commit hook failed due to unused Input import
- **Fix:** Removed `import { Input } from "@/components/ui/input"` from block-stats page
- **Files modified:** app/(platform)/block-stats/page.tsx
- **Verification:** npm run build passes, lint passes
- **Committed in:** c892cff (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for clean commit. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Stores and services are clean of riskFreeRate
- UI no longer exposes manual risk-free rate configuration
- Ready for Plan 03: MCP and test file cleanup
- Note: TypeScript may still show errors in MCP and test files until Plan 03 completes

---
*Phase: 27-remove-manual-input*
*Completed: 2026-01-18*
