---
phase: 27-remove-manual-input
plan: 03
subsystem: api, testing
tags: [mcp-server, risk-free-rate, treasury-rates, tests]

# Dependency graph
requires:
  - phase: 27-01-remove-manual-input
    provides: Types/models cleanup - AnalysisConfig without riskFreeRate
  - phase: 27-02-remove-manual-input
    provides: Stores/services/UI cleanup - components without riskFreeRate
provides:
  - MCP server API without riskFreeRate parameter
  - Test suite updated for date-based rate behavior
  - Complete removal of manual riskFreeRate input across codebase
affects: [28-mcp-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed rate approximation for MCP rolling metrics visualization"
    - "Path alias resolution for MCP bundling with @/ prefix"

key-files:
  created: []
  modified:
    - packages/mcp-server/src/tools/performance.ts
    - packages/mcp-server/tsconfig.json
    - packages/mcp-server/tsup.config.ts
    - tests/unit/portfolio-stats.test.ts
    - tests/unit/performance-store.test.ts
    - tests/unit/performance-snapshot-cache.test.ts
    - tests/unit/portfolio-stats-risk-free.test.ts

key-decisions:
  - "Rolling metrics Sharpe uses fixed 2.0% rate - visualization simplification"
  - "Added @/ path alias to MCP server for proper module resolution"

patterns-established:
  - "MCP server bundles with esbuild alias configuration for @lib/ and @/ paths"

# Metrics
duration: 12min
completed: 2026-01-19
---

# Phase 27 Plan 03: MCP & Tests Summary

**MCP server API cleaned of riskFreeRate parameter, test suite updated for date-based behavior, full build verified**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-19T00:06:04Z
- **Completed:** 2026-01-19T00:18:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- MCP server `get_performance_charts` tool no longer accepts `riskFreeRate` parameter
- Rolling metrics Sharpe calculation uses inline 2.0% constant for visualization
- All 4 test files updated to not pass `riskFreeRate` in configs
- 34 tests pass with new date-based rate behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove riskFreeRate from MCP server** - `47d3d24` (refactor)
2. **Task 2: Update test files to remove riskFreeRate references** - `586a784` (test)

## Files Created/Modified

### MCP Server
- `packages/mcp-server/src/tools/performance.ts` - Removed riskFreeRate from schema and buildRollingMetrics
- `packages/mcp-server/tsconfig.json` - Added @/ path alias for module resolution
- `packages/mcp-server/tsup.config.ts` - Added esbuild alias configuration for bundling

### Test Files
- `tests/unit/portfolio-stats.test.ts` - Removed riskFreeRate from PortfolioStatsCalculator config
- `tests/unit/performance-store.test.ts` - Removed riskFreeRate from buildPerformanceSnapshot call
- `tests/unit/performance-snapshot-cache.test.ts` - Removed 8 riskFreeRate references
- `tests/unit/portfolio-stats-risk-free.test.ts` - Updated test to verify date-based rates

## Decisions Made

1. **Rolling metrics Sharpe uses fixed 2.0%** - The MCP server's rolling metrics are a visualization approximation for quick chart display. The accurate date-based Sharpe is computed in portfolio-stats.ts for actual statistics.

2. **Added @/ path alias to MCP server** - The risk-free-rate utility imports from `@/lib/data/treasury-rates` which required adding the path alias to tsconfig and esbuild configuration for proper bundling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @/ path alias for MCP server module resolution**
- **Found during:** Task 1 (MCP server build verification)
- **Issue:** MCP server build failed because risk-free-rate.ts imports from `@/lib/data/treasury-rates` but MCP server only had `@lib/*` path alias
- **Fix:** Added `@/` alias to tsconfig.json and esbuild configuration in tsup.config.ts
- **Files modified:** packages/mcp-server/tsconfig.json, packages/mcp-server/tsup.config.ts
- **Verification:** `npm run build --workspace=packages/mcp-server` succeeds
- **Committed in:** 47d3d24 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Essential fix for build to succeed. No scope creep.

## Issues Encountered

None - after fixing the path alias resolution, all tasks completed as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 27 complete - all manual riskFreeRate input removed from codebase
- Ready for Phase 28: MCP & Tests final integration testing
- Pre-existing calendar-data test failures are unrelated to this work

---
*Phase: 27-remove-manual-input*
*Completed: 2026-01-19*
