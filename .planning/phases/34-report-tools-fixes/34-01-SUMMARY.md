---
phase: 34-report-tools-fixes
plan: 01
subsystem: api
tags: [mcp, zod, cli-handler, defaults]

# Dependency graph
requires:
  - phase: 17.1-cli-test-mode
    provides: CLI --call handler for testing
provides:
  - Fixed CLI --call mode to apply Zod parsing (defaults now work)
  - Cleaned up runtime default workarounds from 5 tools
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [zod-schema-parsing-in-cli]

key-files:
  created: []
  modified: [packages/mcp-server/src/cli-handler.ts, packages/mcp-server/src/tools/reports.ts]

key-decisions:
  - "Fix root cause in CLI handler rather than patching each tool"

patterns-established:
  - "CLI --call mode now applies Zod parsing like normal MCP server mode"

issues-created: []

# Metrics
duration: 15min
completed: 2026-01-19
---

# Phase 34 Plan 01: Report Tools Fixes Summary

**Fixed CLI --call mode to apply Zod schema parsing, eliminating need for runtime default workarounds**

## Performance

- **Duration:** 15 min
- **Started:** 2026-01-19T22:15:00Z
- **Completed:** 2026-01-19T22:30:00Z
- **Tasks:** 3 (plan) + 1 (root cause fix)
- **Files modified:** 2

## Accomplishments

- Identified root cause: CLI --call handler bypassed Zod parsing, causing defaults to not apply
- Fixed cli-handler.ts to call `inputSchema.safeParse()` before invoking tool handlers
- Removed runtime default workarounds from 5 tools in reports.ts:
  - `run_filtered_query` (logic, includeSampleTrades, sampleSize)
  - `get_field_statistics` (histogramBuckets)
  - `aggregate_by_field` (metrics, includeOutOfRange)
  - `find_predictive_fields` (targetField, minSamples, includeCustomFields)
  - `filter_curve` (mode, percentileSteps)

## Task Commits

Initial plan execution (later superseded):

1. **Task 1: Fix aggregate_by_field runtime defaults** - `4f0a06b` (fix)
2. **Task 2: Fix run_filtered_query runtime defaults** - `4858d4f` (fix)
3. **Task 3: Fix get_field_statistics runtime defaults** - `eaf10a8` (fix)
4. **Plan metadata** - `7a209e0` (docs)

Root cause fix (final):

5. **Fix CLI handler + cleanup workarounds** - `99cb928` (fix)

## Files Created/Modified

- `packages/mcp-server/src/cli-handler.ts` - Added Zod schema parsing before tool invocation
- `packages/mcp-server/src/tools/reports.ts` - Removed 5 runtime default workarounds

## Decisions Made

- **Fix at CLI handler level**: Instead of patching ~74 parameters across 4 files with runtime defaults, fixed the root cause in cli-handler.ts. This ensures all current and future tools work correctly without per-tool workarounds.

## Deviations from Plan

### Post-execution improvement

- **Found during:** Investigation after plan execution
- **Issue:** Discovered the bug only affected CLI --call mode (our test mode), not normal MCP server operation where the SDK applies Zod parsing
- **Fix:** Fixed cli-handler.ts to also apply Zod parsing, then reverted the workarounds from Phase 32, 33, and 34
- **Impact:** Cleaner codebase - no scattered runtime default workarounds needed

## Issues Encountered

None - root cause was clear once investigated.

## Next Phase Readiness

- Phase 34 complete (single plan phase)
- Milestone v2.4 Backtest Optimization Tools is now complete
- All 3 phases (32, 33, 34) delivered successfully

---
*Phase: 34-report-tools-fixes*
*Completed: 2026-01-19*
