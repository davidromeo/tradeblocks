---
phase: 60-database-separation-and-connection-infrastructure
plan: 01
subsystem: database
tags: [duckdb, attach, detach, market-data, connection-lifecycle, schema]

# Dependency graph
requires: []
provides:
  - market-schemas.ts with ensureMarketTables() for 4 normalized market tables
  - connection.ts ATTACH/DETACH lifecycle for market.duckdb
  - resolveMarketDbPath() with CLI > env > default precedence
  - DROP SCHEMA IF EXISTS market CASCADE before ATTACH (DuckDB #14421 prevention)
  - tableExists() exported from schemas.ts for later phases
affects: [61-market-data-import, 62-enrichment-pipeline, 63-field-timing-update]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-DB pattern: analytics.duckdb for trades, market.duckdb ATTACHed as market catalog"
    - "ATTACH before table creation, DETACH before close — all in connection.ts lifecycle"
    - "DROP SCHEMA IF EXISTS market CASCADE before ATTACH prevents DuckDB #14421 corruption"
    - "market.duckdb auto-recreated on corruption (market data is re-importable)"
    - "CREATE TABLE IF NOT EXISTS market.daily uses catalog prefix, not schema prefix"

key-files:
  created:
    - packages/mcp-server/src/db/market-schemas.ts
  modified:
    - packages/mcp-server/src/db/connection.ts
    - packages/mcp-server/src/db/schemas.ts
    - packages/mcp-server/src/db/index.ts
    - packages/mcp-server/src/index.ts

key-decisions:
  - "Hard fail on ATTACH error (market access required for v3.0 operation)"
  - "Auto-recreate market.duckdb on corruption — market data re-importable from CSVs"
  - "resolveMarketDbPath precedence: CLI --market-db > MARKET_DB_PATH env > <dataDir>/market.duckdb"
  - "All four market tables created upfront with full column sets — no ALTER TABLE in later phases"
  - "tableExists() exported from schemas.ts for use in later migration phases"
  - "market._sync_metadata PK uses (source, ticker, target_table) for per-source tracking"

patterns-established:
  - "ATTACH lifecycle: drop legacy schema -> ATTACH RW -> ensureMarketTables -> use; ATTACH RO -> use; DETACH -> close"
  - "Market table naming: CREATE TABLE IF NOT EXISTS market.daily (catalog prefix, default main schema)"
  - "Market path resolution: resolveMarketDbPath() reads process.argv directly (avoids threading through functions)"

requirements-completed: [DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08]

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 60 Plan 01: Database Separation and Connection Infrastructure Summary

**Dual-DuckDB lifecycle with market.duckdb ATTACHed as market catalog, four normalized market tables (daily/context/intraday/_sync_metadata), and DROP SCHEMA guard for DuckDB #14421**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-21T23:31:08Z
- **Completed:** 2026-02-21T23:35:00Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Created `market-schemas.ts` with `ensureMarketTables()` — four tables with all columns defined upfront so later phases can write data without ALTER TABLE
- Rewired `connection.ts` with full ATTACH/DETACH lifecycle: drop legacy schema, ATTACH RW/RO, DETACH on close, `resolveMarketDbPath()` with CLI > env > default precedence
- Removed old `ensureMarketDataTables()` and old market tables (spx_daily, spx_15min, vix_intraday) from analytics.duckdb path

## Task Commits

Each task was committed atomically:

1. **Task 1: Create market-schemas.ts and update schemas.ts** - `54816be` (feat)
2. **Task 2: Integrate ATTACH/DETACH lifecycle and config into connection.ts** - `8ea15ab` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `packages/mcp-server/src/db/market-schemas.ts` — New file: `ensureMarketTables()` with 4 CREATE TABLE IF NOT EXISTS for market.daily, market.context, market.intraday, market._sync_metadata
- `packages/mcp-server/src/db/connection.ts` — ATTACH/DETACH lifecycle, resolveMarketDbPath(), attachMarketDb(), detachMarketDb(), DROP SCHEMA guard, storedMarketDbPath module state
- `packages/mcp-server/src/db/schemas.ts` — Removed ensureMarketDataTables(), removed market._sync_metadata from ensureSyncTables(), exported tableExists() for later phases
- `packages/mcp-server/src/db/index.ts` — Replaced ensureMarketDataTables export with ensureMarketTables + tableExists exports
- `packages/mcp-server/src/index.ts` — Added --market-db and MARKET_DB_PATH documentation in printUsage()

## Decisions Made

- **Hard fail on ATTACH error**: market.duckdb is required for v3.0 operation; degraded mode would silently break queries
- **Auto-recreate on corruption**: market data is always re-importable from source CSVs, so deleting and re-creating is safe
- **CLI arg parsed directly in resolveMarketDbPath()**: avoids threading `marketDbPath` through getConnection/openReadWriteConnection call chains
- **All columns upfront**: market.daily has all 31 columns defined now so Phase 61-63 can INSERT without schema changes
- **market._sync_metadata PK: (source, ticker, target_table)**: supports multiple data sources per ticker and tracks enrichment state per table independently
- **tableExists() exported**: it's a useful utility for future migration phases; exporting it also satisfies ESLint no-unused-vars

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Exported tableExists() to resolve ESLint no-unused-vars error**
- **Found during:** Task 1 commit (pre-commit hook)
- **Issue:** `tableExists()` in schemas.ts was private and unused after removing `ensureMarketDataTables()`. Plan said to keep it for later phases, but ESLint blocked the commit
- **Fix:** Changed `async function tableExists` to `export async function tableExists` and added it to db/index.ts exports. Preserves the function for later phases while satisfying the linter
- **Files modified:** packages/mcp-server/src/db/schemas.ts, packages/mcp-server/src/db/index.ts
- **Verification:** ESLint passed, commit succeeded
- **Committed in:** 54816be (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - linting correctness)
**Impact on plan:** Minimal. tableExists() is now exported instead of private — makes it available for exactly the "later phases" the plan intended. No scope creep.

## Issues Encountered

- Pre-existing TypeScript error in `packages/mcp-server/src/tools/market-data.ts:482` (`'profitFactor' is possibly 'null'`). Confirmed pre-existing via `git stash` before changes. Out of scope for this plan — logged to deferred items.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- market.duckdb ATTACH/DETACH infrastructure is complete and ready for Phase 61 (import tools)
- Four market tables exist in market.duckdb with correct PKs and all columns upfront
- `enable_external_access` decision still needed before Phase 61 — if disabled, `import_csv` must use Node.js parseCSV fallback

---
*Phase: 60-database-separation-and-connection-infrastructure*
*Completed: 2026-02-21*
