---
phase: 71-exit-trigger-analysis
plan: 03
subsystem: api
tags: [mcp, exit-triggers, greeks, decomposition, zod, trade-replay]

requires:
  - phase: 71-01
    provides: "Exit trigger evaluation engine (14 trigger types, first-to-fire orchestration)"
  - phase: 71-02
    provides: "Greeks decomposition engine (delta/gamma/theta/vega/residual factor attribution)"
  - phase: 68
    provides: "Trade replay infrastructure (handleReplayTrade, fetchBars)"
provides:
  - "analyze_exit_triggers MCP tool (runs replay + evaluates 14 trigger types)"
  - "decompose_greeks MCP tool (runs replay + decomposes P&L into greek factors)"
  - "Test exports for exit-triggers, greeks-decomposition, and exit-analysis handlers"
affects: [71-04, integration-testing]

tech-stack:
  added: []
  patterns: ["Composite MCP tool pattern: tool calls handleReplayTrade internally then passes result to pure analysis engine"]

key-files:
  created:
    - packages/mcp-server/src/tools/exit-analysis.ts
  modified:
    - packages/mcp-server/src/index.ts
    - packages/mcp-server/src/test-exports.ts

key-decisions:
  - "Both tools fetch VIX/VIX9D/underlying price maps on-demand based on which trigger types are requested"
  - "Summary format strips per-step arrays from factors and legGroupVega to reduce payload"

patterns-established:
  - "Composite tool pattern: MCP tool that runs replay internally and passes result to pure logic engine"

requirements-completed: [EXIT-01, EXIT-02, EXIT-07, EXIT-10, EXIT-11, TST-07]

duration: 2min
completed: 2026-03-23
---

# Phase 71 Plan 03: Exit Analysis MCP Tools Summary

**Two MCP tools (analyze_exit_triggers, decompose_greeks) registered with Zod schemas, wired to pure engines via handleReplayTrade for single-call replay+analysis**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T03:13:14Z
- **Completed:** 2026-03-23T03:15:44Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created exit-analysis.ts with both tool handlers and Zod schemas
- Both tools run replay internally (single tool call does fetch + replay + analyze)
- VIX/VIX9D/underlying price maps fetched on-demand based on trigger types requested
- Registered both tools in MCP server and exported handlers/schemas for testing

## Task Commits

Each task was committed atomically:

1. **Task 1: MCP tool handlers and schemas for both tools** - `87a1613` (feat)
2. **Task 2: Server registration and test exports** - `df88c0e` (feat)

## Files Created/Modified
- `packages/mcp-server/src/tools/exit-analysis.ts` - MCP tool handlers, schemas, and registration for analyze_exit_triggers and decompose_greeks
- `packages/mcp-server/src/index.ts` - Added import and registration of exit analysis tools
- `packages/mcp-server/src/test-exports.ts` - Added exports for exit-triggers, greeks-decomposition types, and exit-analysis handlers

## Decisions Made
- Both tools fetch VIX/VIX9D/underlying price maps on-demand based on which trigger types are requested (avoids unnecessary API calls)
- Summary format strips per-step arrays from factors and legGroupVega to reduce payload size
- Used shared triggerConfigSchema and legSchema to avoid duplication between the two tool schemas

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both tools registered and available in MCP server
- Test exports available for integration testing in future plans
- Build succeeds with all changes

---
*Phase: 71-exit-trigger-analysis*
*Completed: 2026-03-23*
