---
phase: quick-009
plan: 01
subsystem: calculations
tags: [monte-carlo, walk-forward, margin-returns, sharpe-ratio, edge-decay]

# Dependency graph
requires:
  - phase: v2.7
    provides: MC regime comparison and walk-forward degradation engines
provides:
  - Margin return floor at -0.99 preventing MC capital death
  - Negative IS Sharpe guard in WF efficiency computation
  - MDD divergence sign convention documentation
affects: [edge-decay-analysis, mc-regime-comparison, walk-forward-degradation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Margin return clamping: Math.max(return, -0.99) prevents compounding to zero"
    - "Metric-specific null guards: return null for meaningless ratios instead of misleading values"

key-files:
  created: []
  modified:
    - packages/lib/calculations/monte-carlo.ts
    - packages/lib/calculations/walk-forward-degradation.ts
    - packages/lib/calculations/mc-regime-comparison.ts
    - tests/unit/mc-regime-comparison.test.ts
    - tests/unit/walk-forward-degradation.test.ts

key-decisions:
  - "Floor margin returns at -0.99 (not -1.0) to preserve 1% residual capital in MC compounding"
  - "Return null for negative IS Sharpe efficiency rather than filtering or warning only"

patterns-established:
  - "Margin return clamping: all margin-based returns clamped to [-0.99, +inf) before MC simulation"

# Metrics
duration: 4min
completed: 2026-02-06
---

# Quick Task 009: Fix Margin Return Floor, WF Negative Sharpe, MDD Docs

**Clamped margin returns at -99% to prevent MC capital death, guarded negative IS Sharpe efficiency, documented MDD sign convention**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-06T20:30:28Z
- **Completed:** 2026-02-06T20:34:13Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Margin returns in `calculateMarginReturns` now clamped to -0.99 minimum, preventing `capital * (1 + value)` from reaching zero and killing all MC simulation paths
- `computeEfficiency` returns null when IS Sharpe is negative, preventing misleading ratios like `-0.5 / -1.26 = 0.40` appearing as "good" efficiency
- `MetricComparison.divergenceScore` JSDoc now explains the MDD sign flip convention
- Two new targeted tests validate both fixes; full suite 1202/1202 passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Floor margin returns and guard negative IS Sharpe** - `1581ad2` (fix)
2. **Task 2: Add tests for margin floor and negative Sharpe guard** - `829e8dd` (test)

## Files Created/Modified
- `packages/lib/calculations/monte-carlo.ts` - Clamp margin returns at -0.99 in calculateMarginReturns
- `packages/lib/calculations/walk-forward-degradation.ts` - Null guard for negative IS Sharpe in computeEfficiency
- `packages/lib/calculations/mc-regime-comparison.ts` - Expanded JSDoc for MDD sign convention on divergenceScore
- `tests/unit/mc-regime-comparison.test.ts` - Test 36: margin return clamping verification
- `tests/unit/walk-forward-degradation.test.ts` - Test 27: null Sharpe efficiency for negative IS Sharpe

## Decisions Made
- Floor at -0.99 (not -1.0) to preserve 1% residual capital -- a return of exactly -1.0 would zero out capital, while -0.99 keeps simulation paths alive
- Return null for negative IS Sharpe efficiency rather than clamping or warning -- null correctly signals "not computable" to downstream consumers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MC simulations now robust against extreme margin losses
- WF efficiency averages no longer polluted by meaningless negative-Sharpe ratios
- All edge decay analysis tools produce correct results for adversarial inputs

## Self-Check: PASSED
