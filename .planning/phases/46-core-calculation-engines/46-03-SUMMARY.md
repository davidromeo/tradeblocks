---
phase: 46-core-calculation-engines
plan: 03
subsystem: api
tags: [mcp, edge-decay, period-segmentation, rolling-metrics, cli]

# Dependency graph
requires:
  - phase: 46-01
    provides: segmentByPeriod period segmentation engine
  - phase: 46-02
    provides: computeRollingMetrics rolling metrics engine
provides:
  - analyze_period_metrics MCP tool for period-segmented statistics with trends
  - analyze_rolling_metrics MCP tool for rolling window stats with structural flags
  - CLI --call mode support for both new tools
affects: [47-ui-dashboard, 48-report-generation, 50-integration-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [withSyncedBlock middleware for DuckDB auto-sync, filterByStrategy for strategy isolation]

key-files:
  created:
    - packages/mcp-server/src/tools/edge-decay.ts
  modified:
    - packages/mcp-server/src/index.ts
    - packages/mcp-server/src/cli-handler.ts
    - packages/mcp-server/package.json

key-decisions:
  - "Two separate tools (analyze_period_metrics, analyze_rolling_metrics) rather than one combined tool for focused, composable queries"
  - "Used withSyncedBlock middleware consistent with other single-block tools"
  - "CLI handler also updated (separate registration from index.ts) to enable --call testing mode"

patterns-established:
  - "Edge decay tools follow same registerXTools(server, baseDir) pattern as all other MCP tool modules"

# Metrics
duration: 5min
completed: 2026-02-05
---

# Phase 46 Plan 03: MCP Edge Decay Tools Summary

**Two MCP tools (analyze_period_metrics, analyze_rolling_metrics) wired to Phase 46 engines, registered in server + CLI handler, version bumped to 0.7.0, verified with real 3425-trade block**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-05T14:25:56Z
- **Completed:** 2026-02-05T14:31:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `analyze_period_metrics` tool producing yearly/quarterly/monthly breakdowns, linear regression trends, and worst consecutive losing month identification
- Created `analyze_rolling_metrics` tool producing rolling window series, Q1-Q4 seasonal averages, recent-vs-historical comparison with structural flags
- Both tools support optional strategy filtering and custom parameter overrides (windowSize, recentWindowSize, recentWindowDays)
- Verified end-to-end with real data: 3425 trades across 46 months with full trend detection and seasonal averages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MCP edge decay tools and register them** - `4296f86` (feat)
2. **Task 2: End-to-end CLI verification with real data** - verification-only task, no file changes

## Files Created/Modified
- `packages/mcp-server/src/tools/edge-decay.ts` - New tool module with registerEdgeDecayTools function containing both tools
- `packages/mcp-server/src/index.ts` - Added import and registration of edge decay tools, bumped version to 0.7.0
- `packages/mcp-server/src/cli-handler.ts` - Added import and registration for --call mode
- `packages/mcp-server/package.json` - Version bumped from 0.6.1 to 0.7.0

## Decisions Made
- Two separate tools rather than one combined tool -- each tool has a focused purpose and can be called independently, matching the pattern of other MCP tools (e.g., separate get_correlation_matrix and get_tail_risk)
- CLI handler requires separate tool registration from the McpServer index.ts since it uses a mock ToolCapture class
- No interpretive labels in any tool output -- all data is factual numbers passed through from the lib engines

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CLI handler missing edge decay tool registration**
- **Found during:** Task 1 (tool registration and CLI testing)
- **Issue:** The `cli-handler.ts` file has a separate tool registration system from `index.ts` (uses ToolCapture mock). New tools must be registered in both places.
- **Fix:** Added `registerEdgeDecayTools` import and call to `cli-handler.ts` alongside `index.ts`
- **Files modified:** `packages/mcp-server/src/cli-handler.ts`
- **Verification:** `tradeblocks-mcp --call --list` shows both new tools
- **Committed in:** `4296f86` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix -- without it, CLI --call mode testing would not work. No scope creep.

## Issues Encountered
- DuckDB lock conflict prevented testing against default ~/backtests directory (another MCP server process held the lock). Worked around by copying block data to a temp directory where a fresh DuckDB instance could be created.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both period segmentation and rolling metrics engines are now accessible via MCP tools
- Ready for downstream phases: UI dashboard (47), report generation (48), integration testing (50)
- MCP server version bumped to 0.7.0 reflecting new edge decay analysis capabilities

---
*Phase: 46-core-calculation-engines*
*Completed: 2026-02-05*
