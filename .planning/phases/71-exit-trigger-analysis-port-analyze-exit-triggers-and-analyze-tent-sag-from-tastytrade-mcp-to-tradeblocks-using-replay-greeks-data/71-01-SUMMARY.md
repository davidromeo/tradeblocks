---
phase: 71-exit-trigger-analysis
plan: 01
subsystem: analysis
tags: [exit-triggers, greeks, trade-replay, pure-logic, options]

# Dependency graph
requires:
  - phase: 69-greeks-computation
    provides: PnlPoint with greeks fields, GreeksResult type
  - phase: 68-trade-replay
    provides: PnlPoint, ReplayLeg, ReplayResult types from trade-replay.ts
provides:
  - 14 exit trigger evaluators (profitTarget, stopLoss, trailingStop, dteExit, ditExit, clockTimeExit, underlyingPriceMove, positionDelta, perLegDelta, vixMove, vix9dMove, vix9dVixRatio, slRatioThreshold, slRatioMove)
  - analyzeExitTriggers orchestrator with first-to-fire logic
  - Actual exit comparison with pnlDifference
  - Leg group P&L computation and per-group trigger evaluation
affects: [71-02, 71-03, analyze_exit_triggers tool]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-logic trigger evaluation, Map-based external price lookup, running-state tracking for trailing triggers]

key-files:
  created:
    - packages/mcp-server/src/utils/exit-triggers.ts
    - packages/mcp-server/tests/unit/exit-triggers.test.ts
  modified: []

key-decisions:
  - "String comparison for timestamp matching in actual exit lookup (timestamps are lexicographically ordered YYYY-MM-DD HH:MM)"
  - "vix9dVixRatio uses bidirectional threshold: ratio >= threshold when threshold >= 1 (contango), ratio <= threshold when threshold < 1 (backwardation)"
  - "S/L ratio computed from short legs only (abs of markPrice * quantity * multiplier)"
  - "First available price sets baseline for percentage-move triggers (underlyingPriceMove, vixMove, vix9dMove)"

patterns-established:
  - "Exit trigger evaluation: iterate PnlPoint[], track running state per trigger type, return first fire point"
  - "Leg group analysis: compute per-group P&L from legPrices/entryPrice/quantity/multiplier, build synthetic PnlPoint[] for group evaluation"

requirements-completed: [EXIT-01, EXIT-02, EXIT-03, EXIT-04, EXIT-05, EXIT-06, TST-05]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 71 Plan 01: Exit Trigger Engine Summary

**Pure-logic exit trigger evaluation engine with 14 trigger types, first-to-fire orchestration, actual exit comparison, and leg group support**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T03:05:12Z
- **Completed:** 2026-03-23T03:10:39Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Implemented all 14 exit trigger evaluators as pure functions against greeks-enriched PnlPoint paths
- Built analyzeExitTriggers orchestrator with multi-trigger first-to-fire selection and actual exit P&L comparison
- Added leg group support for per-group P&L computation and independent per-group trigger evaluation
- Comprehensive test suite with 35 passing tests covering all trigger types, edge cases, and orchestration logic

## Task Commits

Each task was committed atomically:

1. **Task 1: Exit trigger types, evaluators, and analysis engine** - `1c3364e` (feat)
2. **Task 2: Unit tests for all 14 trigger types and analysis engine** - `0fde07a` (test)

## Files Created/Modified
- `packages/mcp-server/src/utils/exit-triggers.ts` - Pure-logic module with 14 trigger evaluators, analyzeExitTriggers orchestrator, leg group support (537 lines)
- `packages/mcp-server/tests/unit/exit-triggers.test.ts` - Unit tests for all trigger types, multi-trigger orchestration, actual exit comparison, leg groups (573 lines)

## Decisions Made
- String comparison for timestamp matching in actual exit lookup (timestamps are lexicographically ordered YYYY-MM-DD HH:MM)
- vix9dVixRatio uses bidirectional threshold: ratio >= threshold for contango deepening (threshold >= 1), ratio <= threshold for backwardation (threshold < 1)
- S/L ratio computed from short legs only using abs(markPrice * quantity * multiplier) / maxLoss
- First available price in external data maps sets baseline for percentage-move triggers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all 14 trigger types fully implemented with evaluation logic.

## Next Phase Readiness
- Exit trigger engine ready for integration into analyze_exit_triggers MCP tool (Plan 71-02)
- All exports (evaluateTrigger, analyzeExitTriggers, types) available for tool handler consumption
- Test-exports.ts update deferred to Plan 71-03 per plan specification

---
*Phase: 71-exit-trigger-analysis*
*Completed: 2026-03-23*
