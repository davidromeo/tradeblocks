---
phase: 72-exit-policy-comparison
plan: 03
subsystem: api
tags: [mcp, duckdb, batch-exit-analysis, exit-triggers, trade-replay]

requires:
  - phase: 72-01
    provides: "analyzeBatch pure engine, BatchExitConfig/TradeInput/BatchExitResult types"
  - phase: 72-02
    provides: "handleReplayTrade with intraday cache read/write"
  - phase: 71
    provides: "analyzeExitTriggers engine, ExitTriggerConfig, LegGroupConfig"
  - phase: 68
    provides: "handleReplayTrade signature, tradelog query pattern"
provides:
  - batch_exit_analysis MCP tool registered in server
  - handleBatchExitAnalysis exported via test-exports.ts
  - batchExitAnalysisSchema exported via test-exports.ts

affects: [batch-exit-analysis, mcp-tools, exit-policy-comparison]

tech-stack:
  added: []
  patterns:
    - "Trade query with ROW_NUMBER CTE + rowid tiebreaker for deterministic trade_idx"
    - "Per-trade replay loop always uses format:'full' regardless of output format param"
    - "Skip-and-continue error handling: failed replays skipped, skip count reported in summary"
    - "Profile context: informational enrichment with swallowed errors (non-critical path)"

key-files:
  created:
    - packages/mcp-server/src/tools/batch-exit-analysis.ts
  modified:
    - packages/mcp-server/src/index.ts
    - packages/mcp-server/src/test-exports.ts

key-decisions:
  - "Always pass format:'full' to handleReplayTrade regardless of params.format — params.format controls batch output density, not replay resolution"
  - "ROW_NUMBER CTE uses ORDER BY date_opened, rowid to ensure deterministic trade_idx for trades sharing same date_opened"
  - "Profile context lookup swallows errors — profile is informational context, not critical for batch analysis"
  - "Skip-and-continue: trades that fail replay are skipped with count tracked and appended to summary string"

patterns-established:
  - "Batch replay pattern: query trades, iterate with try/catch per trade, build TradeInput[], delegate to pure engine"
  - "WHERE clause construction via string array join — same DuckDB parameterization pattern as replay.ts"

requirements-completed:
  - BATCH-12
  - BATCH-13
  - BATCH-14
  - BATCH-15
  - TST-10

duration: 8min
completed: 2026-03-23
---

# Phase 72 Plan 03: Batch Exit Analysis MCP Tool Summary

**batch_exit_analysis MCP tool wired end-to-end: queries trades from DuckDB with deterministic ROW_NUMBER, replays each via handleReplayTrade (Massive cache-aware), delegates to pure analyzeBatch engine, and returns aggregate stats with trigger attribution**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-23T13:03:00Z
- **Completed:** 2026-03-23T13:04:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `batch_exit_analysis` MCP tool with full Zod schema (12 parameters) covering block filtering, candidate policy, leg groups, baseline mode, limit/P&L filters, multiplier, and output format
- Implemented trade querying with ROW_NUMBER CTE and rowid tiebreaker for deterministic ordering
- Per-trade replay loop always requests `format:'full'` pnlPath, delegates to pure `analyzeBatch` engine for aggregate stats
- Profile context lookup via `getProfile` when strategy is specified — informational enrichment with swallowed errors
- Registered tool in `index.ts` and exported handler + schema via `test-exports.ts`
- All 13 existing batch-exit-analysis unit tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create batch_exit_analysis MCP tool handler** - `e83fc46` (feat)
2. **Task 2: Wire into server and export for testing** - `94f2687` (feat)

## Files Created/Modified

- `packages/mcp-server/src/tools/batch-exit-analysis.ts` - New MCP tool handler with Zod schema, trade querying, replay loop, analyzeBatch delegation, profile context
- `packages/mcp-server/src/index.ts` - Added import and registration call for registerBatchExitAnalysisTools
- `packages/mcp-server/src/test-exports.ts` - Added handleBatchExitAnalysis and batchExitAnalysisSchema exports for integration testing

## Decisions Made

- **format:'full' always for replay**: params.format controls batch output density (whether perTrade is included), not the replay resolution needed by analyzeBatch. Always requesting full pnlPath ensures the pure engine has all data.
- **ROW_NUMBER + rowid tiebreaker**: Without rowid, ROW_NUMBER is non-deterministic when multiple trades share the same date_opened, which would produce inconsistent trade_idx values across queries.
- **Profile context non-critical**: Profile enrichment caught with try/catch — a missing profile schema or connection error should not fail the batch analysis that the user actually asked for.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 72 complete: all three plans executed (pure engine, replay cache, MCP tool wiring)
- batch_exit_analysis tool is ready for use — requires MASSIVE_API_KEY for first-run bar fetching; subsequent runs use cached market.intraday data
- Integration tests for the tool handler can now be written using handleBatchExitAnalysis from test-exports.ts

---
*Phase: 72-exit-policy-comparison*
*Completed: 2026-03-23*
