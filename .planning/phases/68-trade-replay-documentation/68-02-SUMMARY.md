---
phase: 68-trade-replay-documentation
plan: 02
subsystem: api
tags: [mcp-tool, trade-replay, massive-api, minute-bars, mfe-mae, occ-ticker]

# Dependency graph
requires:
  - phase: 68-trade-replay-documentation
    provides: parseLegsString, buildOccTicker, computeStrategyPnlPath, computeReplayMfeMae pure functions
  - phase: 66-massive-api-client
    provides: fetchBars for minute bar retrieval from Massive.com
provides:
  - replay_trade MCP tool with hypothetical and tradelog replay modes
  - handleReplayTrade exported handler for direct testing
  - replayTradeSchema Zod schema for tool input validation
affects: [68-03-documentation]

# Tech tracking
tech-stack:
  added: []
  patterns: [jest-unstable-mockModule-for-esm-mocking, dual-mode-tool-input-validation]

key-files:
  created:
    - packages/mcp-server/src/tools/replay.ts
    - packages/mcp-server/tests/integration/trade-replay.test.ts
  modified:
    - packages/mcp-server/src/index.ts
    - packages/mcp-server/src/test-exports.ts

key-decisions:
  - "Tradelog mode uses date_closed as expiry approximation (best available without explicit expiry in tradelog)"
  - "Per-contract entry price split evenly across legs when replaying from tradelog"
  - "jest.unstable_mockModule used for ESM-compatible getConnection mocking in integration tests"

patterns-established:
  - "Dual-mode MCP tool: legs[] for hypothetical, block_id+trade_index for tradelog"
  - "ESM module mocking pattern with jest.unstable_mockModule + dynamic import"

requirements-completed: [RPL-01, RPL-05, RPL-06, TST-04]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 68 Plan 02: Trade Replay MCP Tool Summary

**replay_trade MCP tool wired with dual-mode input (hypothetical legs and tradelog block_id+trade_index), minute bar fetching via Massive API, and 7 integration tests with mocked fetch and real DuckDB**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T20:35:13Z
- **Completed:** 2026-03-22T20:38:25Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- replay_trade MCP tool registered with Zod schema supporting two input modes
- Hypothetical mode: explicit legs with strikes, expiry, entry prices for what-if analysis
- Tradelog mode: block_id + trade_index to replay any existing trade without re-entering parameters
- 7 integration tests covering single-leg, multi-leg spread, tradelog replay, and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create replay_trade MCP tool with both input modes** - `2a0cee5` (feat)
2. **Task 2: Integration tests for replay_trade** - `59d778d` (test)

## Files Created/Modified
- `packages/mcp-server/src/tools/replay.ts` - replay_trade tool: Zod schema, handleReplayTrade handler, registerReplayTools
- `packages/mcp-server/tests/integration/trade-replay.test.ts` - 7 integration tests with mocked Massive API and in-memory DuckDB
- `packages/mcp-server/src/index.ts` - Added registerReplayTools import and call
- `packages/mcp-server/src/test-exports.ts` - Added handleReplayTrade and replayTradeSchema exports

## Decisions Made
- Tradelog mode approximates expiry as date_closed (best available without explicit expiry column in trade_data)
- Per-contract entry price split evenly across legs when premium comes from tradelog (premium / numContracts / numLegs)
- Used jest.unstable_mockModule for ESM-compatible getConnection mocking in integration tests (top-level await + dynamic import pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - requires MASSIVE_API_KEY env var which is an existing prerequisite from Phase 66.

## Next Phase Readiness
- replay_trade tool fully wired and tested, ready for documentation in Plan 03
- All 28 tests pass (21 unit from Plan 01 + 7 integration from Plan 02)
- Tool registered in server index and accessible via MCP

---
*Phase: 68-trade-replay-documentation*
*Completed: 2026-03-22*
