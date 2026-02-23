---
phase: 64-cleanup-and-api-surface
plan: 01
subsystem: api
tags: [mcp-server, duckdb, market-data, cleanup, dead-code-removal]

# Dependency graph
requires:
  - phase: 63-tool-migration
    provides: market.intraday normalized schema, calculate_orb using market.intraday

provides:
  - enrich_trades returns raw intradayBars arrays instead of pivoted checkpoint columns
  - run_sql AVAILABLE_TABLES uses new normalized names (market.daily, market.context, market.intraday, market._sync_metadata)
  - describe_database includes Import Workflow section (import_market_csv -> enrich_market_data pipeline)
  - market-sync.ts and intraday-timing.ts deleted with zero remaining references
  - McpServer version updated to 1.5.0

affects: [64-03, any future plan touching enrich_trades or run_sql]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw bar arrays in enrich_trades: intradayBars: [{time, open, high, low, close}] instead of pivoted CASE-WHEN checkpoint columns"
    - "AVAILABLE_TABLES allowlist enforcement: run_sql rejects queries against old table names at DB level"

key-files:
  created: []
  modified:
    - packages/mcp-server/src/tools/market-data.ts
    - packages/mcp-server/src/tools/sql.ts
    - packages/mcp-server/src/tools/schema.ts
    - packages/mcp-server/src/sync/index.ts
    - packages/mcp-server/src/tools/reports/queries.ts
    - packages/mcp-server/src/index.ts
    - packages/mcp-server/src/test-exports.ts
    - packages/mcp-server/src/utils/market-enricher.ts

key-decisions:
  - "enrich_trades intradayBars uses raw bar arrays (not checkpoint pivot) — simpler, more flexible for callers to filter by time themselves"
  - "computeIntradayTimingFields stub added to market-enricher.ts for Plan 64-03 consumption — avoids test-exports.ts conflict when Plans 64-01 and 64-03 run in the same wave"
  - "Pre-existing market-import.test.ts failure (validateColumnMapping intraday) logged as out-of-scope, not introduced by this plan"

patterns-established: []

requirements-completed: [CLN-02, CLN-03, CLN-04, CLN-07]

# Metrics
duration: 20min
completed: 2026-02-23
---

# Phase 64 Plan 01: Cleanup and API Surface Summary

**Dead code removal (market-sync.ts, intraday-timing.ts) and API surface cleanup: run_sql updated to normalized table names, enrich_trades returns raw intraday bar arrays, McpServer version bumped to 1.5.0**

## Performance

- **Duration:** 20 min
- **Started:** 2026-02-23T15:15:00Z
- **Completed:** 2026-02-23T15:38:59Z
- **Tasks:** 2
- **Files modified:** 10 (including 2 deletions + 2 file deletes)

## Accomplishments

- Deleted `intraday-timing.ts` (~200 lines of dead checkpoint-pivot code) and its test file
- Deleted `market-sync.ts` (~300+ lines of deprecated _marketdata/ sync) and its integration test
- Replaced complex CASE-WHEN pivot query in `enrich_trades` with simple raw bar query returning `intradayBars: [{time, open, high, low, close}]`
- Updated `run_sql` AVAILABLE_TABLES allowlist to new normalized schema names
- Added Import Workflow guidance to `describe_database` output
- Bumped McpServer version from 1.2.0 to 1.5.0

## Task Commits

Each task was committed atomically:

1. **Task 1: Simplify enrich_trades intraday output to raw bars and remove intraday-timing dependency** - `8909a5c` (feat)
2. **Task 2: Delete market-sync.ts, update run_sql/describe_database/index.ts, clean stale references** - `3062ad6` (feat)

## Files Created/Modified

- `packages/mcp-server/src/tools/market-data.ts` - Removed intraday-timing imports; replaced checkpoint-pivot intraday query with raw bar query (`intradayBars`)
- `packages/mcp-server/src/tools/sql.ts` - Updated AVAILABLE_TABLES and tool description to new normalized table names
- `packages/mcp-server/src/tools/schema.ts` - Added `importWorkflow` field to DatabaseSchemaOutput with pipeline steps
- `packages/mcp-server/src/sync/index.ts` - Removed `syncMarketData`, `MarketSyncResult`, and `syncMarketDataInternal` import
- `packages/mcp-server/src/tools/reports/queries.ts` - Updated stale `market.spx_daily` reference to `market.daily`
- `packages/mcp-server/src/index.ts` - Version bumped to 1.5.0
- `packages/mcp-server/src/test-exports.ts` - Removed intraday-timing and syncMarketData/MarketSyncResult exports; added `computeIntradayTimingFields` export for Plan 64-03
- `packages/mcp-server/src/utils/market-enricher.ts` - Added `computeIntradayTimingFields` stub with full types for Plan 64-03 implementation
- `packages/mcp-server/src/sync/market-sync.ts` - DELETED
- `packages/mcp-server/src/utils/intraday-timing.ts` - DELETED
- `packages/mcp-server/tests/unit/intraday-timing.test.ts` - DELETED
- `packages/mcp-server/tests/integration/market-sync-multi-ticker.test.ts` - DELETED
- `packages/mcp-server/src/tools/middleware/sync-middleware.ts` - Cleaned stale `syncMarketData` reference in comment
- `packages/mcp-server/src/sync/metadata.ts` - Cleaned stale `spx_daily.csv` example in JSDoc

## Decisions Made

- **computeIntradayTimingFields stub**: Added a full working implementation stub (not just a type placeholder) to `market-enricher.ts` so Plan 64-03 can consume the test-exports.ts export without TS errors. Plan 64-03 will replace this with the real Tier 3 implementation.
- **ImportWorkflow as output field**: Added `importWorkflow` as a structured field in `DatabaseSchemaOutput` rather than embedded text, making it parseable by API consumers.
- **Raw bars over checkpoint pivot**: `enrich_trades` now returns `intradayBars: [{time, open, high, low, close}]` arrays, letting callers decide their own temporal filtering logic rather than having server-side checkpoint pivoting.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added computeIntradayTimingFields stub to market-enricher.ts**
- **Found during:** Task 1 (intraday-timing deletion)
- **Issue:** The plan said to add `export { computeIntradayTimingFields } from './utils/market-enricher.js'` to test-exports.ts, but the function didn't exist yet — TypeScript compilation failed
- **Fix:** Added a full working stub function `computeIntradayTimingFields(bars, openingPeriodEndTime)` with proper types (`IntradayBar`, `IntradayTimingResult`) to market-enricher.ts so the export compiles. Plan 64-03 will replace this with the real implementation.
- **Files modified:** packages/mcp-server/src/utils/market-enricher.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 8909a5c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical for compilation)
**Impact on plan:** Essential for TypeScript compilation. The stub matches the exact interface Plan 64-03 expects. No scope creep.

## Issues Encountered

- Pre-existing test failure in `tests/integration/market-import.test.ts` (`validateColumnMapping intraday` test at line 102) — confirmed pre-existing by checking against stashed state. Logged as out-of-scope per deviation rules.

## Next Phase Readiness

- Plan 64-02 (universal Pine Script + intraday importer) is already complete (see 64-02-SUMMARY.md)
- Plan 64-03 (Tier 3 enrichment) can now proceed: `computeIntradayTimingFields` stub is in market-enricher.ts and test-exports.ts export is present
- All API surface references to old table names (spx_daily, spx_15min, vix_intraday) are removed from mcp-server/src/

---
*Phase: 64-cleanup-and-api-surface*
*Completed: 2026-02-23*
