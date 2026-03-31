---
phase: 74-pre-ship-polish
plan: 03
subsystem: mcp-server/greeks-decomposition
tags: [greeks, decomposition, midpoint, numerical-fallback, accuracy]
dependency_graph:
  requires: []
  provides: [midpoint-greeks-attribution, numerical-greeks-fallback]
  affects: [greeks-decomposition.ts, trade-replay]
tech_stack:
  added: []
  patterns: [midpoint-formula, realized-delta, numerical-attribution]
key_files:
  created: []
  modified:
    - packages/mcp-server/src/utils/greeks-decomposition.ts
    - packages/mcp-server/tests/unit/greeks-decomposition.test.ts
decisions:
  - "Midpoint greeks use (cur+next)/2 average; fall back to cur when next is null (D-05/D-06)"
  - "Numerical fallback activates when pnlPath.length > 2 AND model residual > 80% of totalPnlChange"
  - "Numerical time_and_vol absorbs theta+vega+unexplained — cleaner than calling it residual when it serves a different purpose"
  - "Gamma in numerical mode from delta changes: 0.5 * deltaChange * underlyingChange (D-10)"
  - "Intervals where underlying change < $0.01 push all P&L to time_and_vol (can't estimate delta without movement)"
metrics:
  duration_minutes: 8
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_modified: 2
  tests_added: 13
---

# Phase 74 Plan 03: Midpoint Greeks Attribution + Numerical Fallback Summary

**One-liner:** Midpoint greeks (cur+next average) replace start-of-interval attribution; numerical realized-delta fallback activates when model residual exceeds 80%, producing delta/gamma/time_and_vol breakdown.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Add failing tests for midpoint and numerical fallback | 59ccf28 | greeks-decomposition.test.ts |
| 1+2 | Midpoint greeks attribution + numerical fallback implementation | 10a72e1 | greeks-decomposition.ts, greeks-decomposition.test.ts |

## What Was Built

### Task 1: Midpoint Greeks Attribution (D-05/D-06)

Replaced start-of-interval greek usage with midpoint formula for all four factors:

```typescript
const midDelta = (curDelta + nextDelta) / 2;   // Falls back when next is null
const midGamma = (curGamma + nextGamma) / 2;
const midTheta = (curTheta + nextTheta) / 2;
const midVega  = (curVega  + nextVega)  / 2;
```

When `next.netDelta` is null/undefined, `nextDelta = curDelta` (graceful fallback = start-of-interval behavior). This matters most for 0DTE where delta can change rapidly — midpoint reduces attribution error from large gamma.

### Task 2: Numerical Greeks Fallback (D-09/D-10/D-11)

Added `numericalDecomposition()` that activates when `|totalResidual| / |totalPnlChange| > 0.80` AND path has more than 2 points.

**Algorithm:**
1. Per-interval: `realizedDelta = actualPnlChange / underlyingChange`
2. Gamma from consecutive delta changes: `gammaPnl = 0.5 * deltaChange * underlyingChange`
3. `time_and_vol` = everything else (theta + vega + unexplained)
4. Skips intervals where `|underlyingChange| < 0.01` (can't estimate delta)

**New interface fields:**
- `GreeksDecompositionResult.method: 'model' | 'numerical'`
- `FactorName` extended with `'time_and_vol'`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing multi-step accumulation test for midpoint semantics**
- **Found during:** Task 1 RED phase
- **Issue:** Existing test `multi-step path accumulates correctly` expected `delta.steps[0] = 0.5 * 1 = 0.5` (start-of-interval), but midpoint gives `(0.5+0.6)/2 * 1 = 0.55`
- **Fix:** Updated test expected values and adjusted `strategyPnl` in fixture to match midpoint math
- **Files modified:** greeks-decomposition.test.ts

**2. [Rule 1 - Bug] Updated edge-case test for numerical-mode behavior**
- **Found during:** Task 2 GREEN phase
- **Issue:** `path without legGreeks -> all P&L goes to residual` test looked for `residual` factor, but numerical mode uses `time_and_vol` instead
- **Fix:** Updated test to check for `time_and_vol` and `method === 'numerical'`
- **Files modified:** greeks-decomposition.test.ts

## Tests Added

13 new tests across two describe blocks:

**midpoint greeks attribution (5 tests):**
- delta uses midpoint when next point has valid netDelta
- delta falls back to start-of-interval when next point netDelta is null
- midpoint formula applies to gamma
- midpoint formula applies to theta
- midpoint formula applies to vega

**numerical greeks fallback (7 tests):**
- method is "numerical" when model residual > 80%
- method is "model" when model residual <= 80%
- numerical fallback includes delta, gamma, time_and_vol factors
- numerical fallback: realized delta from option price / underlying change
- numerical fallback skips intervals where underlying barely moves
- numerical result has warning about >80% residual
- model result method is "model" when returning empty path

**Updated test (1):**
- multi-step path accumulates correctly (midpoint greeks) — adjusted expected values

**Total: 31 tests pass** (13 new + 1 updated + 17 existing)

## Known Stubs

None. Both midpoint and numerical attribution are fully implemented and tested.

## Self-Check: PASSED

- packages/mcp-server/src/utils/greeks-decomposition.ts: FOUND
- packages/mcp-server/tests/unit/greeks-decomposition.test.ts: FOUND
- Commit 59ccf28 (RED tests): FOUND
- Commit 10a72e1 (implementation): FOUND
- All 31 tests pass
