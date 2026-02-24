---
phase: 56-fix-existing-tools
plan: 01
subsystem: mcp
tags: [duckdb, lookahead-bias, lag-cte, market-data, mcp-tools]

# Dependency graph
requires:
  - phase: 55-field-classification-foundation
    provides: "field-timing.ts with buildLookaheadFreeQuery, OPEN_KNOWN_FIELDS, CLOSE_KNOWN_FIELDS, STATIC_FIELDS"
provides:
  - "Lookahead-free suggest_filters with 24 filter candidates (14 lagged, 10 same-day)"
  - "Lookahead-free analyze_regime_performance with 3 lagged segmentBy options"
  - "lagNote in both tools explaining temporal semantics"
  - "VIX_Open/VIX_Gap_Pct as new open-known filter candidates"
affects: [57-fix-sql-tools, 58-documentation-and-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "prev_* column pattern for reading LAG CTE fields in tool logic"
    - "lagged boolean on filter conditions for downstream consumers"
    - "lagNote in tool output explaining bias prevention semantics"

key-files:
  created: []
  modified:
    - "packages/mcp-server/src/tools/market-data.ts"
    - "packages/mcp-server/src/utils/schema-metadata.ts"

key-decisions:
  - "Filter field names kept canonical (VIX_Close not prev_VIX_Close) -- only test() reads prev_* columns"
  - "NaN handling via continue (skip trade) rather than fallback to same-day value"
  - "VIX_Open hypothesis flag set true now that it is used as filter candidate"

patterns-established:
  - "prev_* column access: close-derived filters/segments read prev_{field} from LAG CTE"
  - "lagged metadata: each filter condition includes lagged boolean for transparency"
  - "lagNote pattern: tools include text explanation of which fields are lagged and why"

# Metrics
duration: 5min
completed: 2026-02-08
---

# Phase 56 Plan 01: Fix Existing Tools Summary

**Lookahead-free suggest_filters (24 filters, 14 lagged) and analyze_regime_performance (3 lagged segmentBy) using LAG CTE from field-timing.ts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-08T21:43:24Z
- **Completed:** 2026-02-08T21:48:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Both suggest_filters and analyze_regime_performance now query market data via buildLookaheadFreeQuery() LAG CTE instead of naive SELECT *
- 14 close-derived filter candidates updated to read prev_* columns with "prior-day" display names
- 4 new open-known filter candidates added: VIX_Open > 25/30, |VIX_Gap_Pct| > 10/15%
- 3 close-derived segmentBy options (volRegime, termStructure, trendScore) read prev_* columns with NaN skip logic
- Both tools include lagNote explaining temporal semantics in output
- All 1201 existing tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix suggest_filters with lag-aware query and updated filter definitions** - `5bb282d` (feat)
2. **Task 2: Fix analyze_regime_performance with lag-aware query and segmentBy updates** - `c992612` (feat)

## Files Created/Modified
- `packages/mcp-server/src/tools/market-data.ts` - Updated both tools with LAG CTE queries, prev_* column reads, lagNote, lagged boolean
- `packages/mcp-server/src/utils/schema-metadata.ts` - Set VIX_Open hypothesis flag to true

## Decisions Made
- Filter field names kept as canonical names (e.g., `VIX_Close` not `prev_VIX_Close`) in condition output -- only the test() function reads from prev_* columns. This preserves user-facing field names.
- NaN handling in segmentBy uses `continue` to skip trades with missing lagged data, rather than falling back to same-day values (which would reintroduce lookahead bias).
- VIX_Open hypothesis flag set to true since it is now actively used as a filter candidate (BIAS-05).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- suggest_filters and analyze_regime_performance are lookahead-free
- Phase 57 (fix SQL tools) can proceed: run_sql example queries and describe_database need similar lag-awareness
- Phase 58 (documentation and testing) can add integration tests for the lag behavior
