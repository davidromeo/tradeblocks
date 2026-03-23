---
phase: 71-exit-trigger-analysis
plan: 02
subsystem: analytics
tags: [greeks, decomposition, attribution, vega, delta, gamma, theta, options]

# Dependency graph
requires:
  - phase: 69-greeks-engine
    provides: "PnlPoint with per-leg greeks and net position greeks"
provides:
  - "decomposeGreeks() function for P&L factor attribution"
  - "Per-leg-group vega attribution for calendar/double-calendar strategies"
  - "computeTimeDeltaDays() helper for intraday/cross-day time deltas"
affects: [71-exit-trigger-analysis]

# Tech tracking
tech-stack:
  added: []
  patterns: ["step-by-step greeks attribution with residual capture"]

key-files:
  created:
    - packages/mcp-server/src/utils/greeks-decomposition.ts
    - packages/mcp-server/tests/unit/greeks-decomposition.test.ts
  modified:
    - packages/mcp-server/src/test-exports.ts

key-decisions:
  - "IV change converted from decimal to percentage points (*100) since vega is per 1% IV move"
  - "Per-leg-group vega uses position-weighted vega (quantity * multiplier / 100) per leg"
  - "Cross-day time delta uses calendar day difference with fractional trading day adjustments"

patterns-established:
  - "Greek attribution: use starting-point greeks for each step (path[i] greeks applied to path[i]->path[i+1] changes)"
  - "Factor ranking: sort by abs(totalPnl) descending for consistent factor importance ordering"

requirements-completed: [EXIT-07, EXIT-08, EXIT-09, TST-06]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 71 Plan 02: Greeks Decomposition Engine Summary

**Pure-logic greeks decomposition engine with delta/gamma/theta/vega/residual attribution and per-leg-group vega for calendar strategies**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T03:05:16Z
- **Completed:** 2026-03-23T03:09:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Built decomposeGreeks() that decomposes replay P&L into 5 ranked factor contributions per D-07/D-09
- Per-leg-group vega attribution captures front/back month IV divergence for calendar strategies per D-08
- 19 unit tests covering single-factor isolation, multi-factor residual, leg group vega, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Greeks decomposition engine with per-leg-group vega** - `3840295` (feat)
2. **Task 2: Unit tests for greeks decomposition** - `2eeb15b` (test)

## Files Created/Modified
- `packages/mcp-server/src/utils/greeks-decomposition.ts` - Core decomposition engine (decomposeGreeks, computeTimeDeltaDays)
- `packages/mcp-server/tests/unit/greeks-decomposition.test.ts` - 19 unit tests for decomposition math
- `packages/mcp-server/src/test-exports.ts` - Added greeks decomposition exports

## Decisions Made
- IV change converted from decimal to percentage points (*100) since vega is defined as P&L per 1% IV move
- Per-leg-group vega uses position-weighted vega: legGreek.vega * quantity * multiplier / 100
- computeTimeDeltaDays uses 390 trading minutes/day for same-day fractional days
- Cross-day gaps use calendar day difference with fractional adjustments from market open (9:30)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- decomposeGreeks ready for integration into exit trigger analysis tools
- Types (GreeksDecompositionConfig, GreeksDecompositionResult) exported via test-exports.ts
- Accepts PnlPoint[] from existing trade replay pipeline

---
*Phase: 71-exit-trigger-analysis*
*Completed: 2026-03-23*
