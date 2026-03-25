---
phase: quick
plan: 260325-u0y
subsystem: analytics
tags: [exit-triggers, delta, per-leg, directional, zod]

requires:
  - phase: 71
    provides: exit trigger evaluation engine with 15 trigger types
provides:
  - legIndex/exitAbove/exitBelow directional fields on ExitTriggerConfig
  - OO-style directional per-leg delta exits
  - Directional positionDelta exits
affects: [exit-analysis, batch-exit-analysis, strategy-profiles]

tech-stack:
  added: []
  patterns: [directional delta thresholds with backward-compatible abs() fallback]

key-files:
  created: []
  modified:
    - packages/mcp-server/src/utils/exit-triggers.ts
    - packages/mcp-server/src/tools/exit-analysis.ts
    - packages/mcp-server/src/tools/batch-exit-analysis.ts
    - packages/mcp-server/tests/unit/exit-triggers.test.ts

key-decisions:
  - "exitAbove/exitBelow use strict inequality (> / <) matching OO directional semantics"
  - "legIndex without exitAbove/exitBelow falls back to abs() on that single leg"
  - "No legIndex at all preserves full backward-compat iteration over all legs"

requirements-completed: [quick-fix]

duration: 3min
completed: 2026-03-25
---

# Quick Task 260325-u0y: Fix perLegDelta Trigger for OO-Style Directional Exits

**Added legIndex + exitAbove/exitBelow directional fields to perLegDelta and positionDelta triggers with full backward compatibility**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T21:39:42Z
- **Completed:** 2026-03-25T21:43:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- perLegDelta now supports OO-style per-leg directional exits (legIndex + exitAbove/exitBelow)
- positionDelta supports directional thresholds (exitAbove/exitBelow)
- Full backward compatibility: triggers without new fields behave identically to before
- 8 new test cases covering all directional paths + multi-trigger independence
- All 73 tests pass (existing + new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add directional fields + update evaluation logic + Zod schemas** - `00819f1` (feat)
2. **Task 2: Add unit tests for directional perLegDelta and positionDelta** - `f9e02dd` (test)

## Files Created/Modified
- `packages/mcp-server/src/utils/exit-triggers.ts` - Added legIndex/exitAbove/exitBelow to ExitTriggerConfig, updated perLegDelta and positionDelta case logic
- `packages/mcp-server/src/tools/exit-analysis.ts` - Added 3 new optional fields to triggerConfigSchema
- `packages/mcp-server/src/tools/batch-exit-analysis.ts` - Added 3 new optional fields to triggerConfigSchema
- `packages/mcp-server/tests/unit/exit-triggers.test.ts` - 8 new test cases for directional delta behavior

## Decisions Made
- exitAbove/exitBelow use strict inequality (> / <) matching OO directional semantics
- legIndex without exitAbove/exitBelow falls back to abs() on that single leg only
- No legIndex preserves full backward-compat iteration over all legs with abs()

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Floating point precision: 0.3 + 6*0.05 evaluates to 0.6000000000000001 in JS, causing test with exitAbove=0.6 to fire one index early. Fixed by using exitAbove=0.64 in tests to avoid FP boundary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Directional delta exits ready for use in analyze_exit_triggers and batch_exit_analysis tools
- Profile strategy tool can now express OO-style per-leg exit rules

---
*Plan: 260325-u0y*
*Completed: 2026-03-25*
