---
phase: 75-normalized-vix-term-structure
plan: "01"
subsystem: database
tags: [duckdb, market-data, vix, schema-migration, market-schemas]

# Dependency graph
requires:
  - phase: 67-ivr-ivp-enrichment
    provides: IVR/IVP enrichment columns in market.context (VIX_IVR, VIX_IVP, VIX9D_IVR, etc.)
provides:
  - ivr/ivp columns on market.daily (ALTER TABLE migration, idempotent)
  - market._context_derived table (Vol_Regime, Term_Structure_State, Trend_Direction, VIX_Spike_Pct, VIX_Gap_Pct)
  - migrateContextToNormalized() function — copies VIX/VIX9D/VIX3M OHLCV+IVR/IVP from market.context to market.daily on first run
  - market-importer.ts knows about _context_derived for upsert routing
affects:
  - 75-02 (VIX term structure table — depends on market.daily ivr/ivp columns)
  - 75-03 (import path rewrite — depends on _context_derived in CONFLICT_TARGETS)
  - 75-04 (pivot view — depends on _context_derived table)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ALTER TABLE ADD COLUMN with try/catch for idempotent schema migrations"
    - "INSERT OR IGNORE for idempotent data migrations"
    - "migrateContextToNormalized called at end of ensureMarketTables (startup migration pattern)"

key-files:
  created: []
  modified:
    - packages/mcp-server/src/db/market-schemas.ts
    - packages/mcp-server/src/utils/market-importer.ts

key-decisions:
  - "migrateContextToNormalized uses vixDailyCount > 0 as idempotency check — skips migration if VIX rows already exist in market.daily"
  - "INSERT OR IGNORE (not ON CONFLICT DO NOTHING) — DuckDB dialect for idempotent inserts"
  - "market.context preserved intact — not dropped (backward compatibility per D-04/D-20)"
  - "_context_derived placed after market.context CREATE TABLE block so migration function can reference both"

patterns-established:
  - "Startup migration: ensureMarketTables() calls migrateContextToNormalized() at the end — safe to re-run every startup"
  - "Importer constants: REQUIRED_SCHEMA_FIELDS and CONFLICT_TARGETS must be updated for any new table that uses import_market_csv"

requirements-completed: [VTS-01, VTS-02, VTS-03, VTS-04, VTS-05, VTS-06]

# Metrics
duration: 2min
completed: "2026-03-24"
---

# Phase 75 Plan 01: Schema Foundation Summary

**ivr/ivp columns added to market.daily, market._context_derived table created, and idempotent migration from legacy market.context wired into startup**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T14:50:51Z
- **Completed:** 2026-03-24T14:52:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `market.daily` gains `ivr DOUBLE` and `ivp DOUBLE` columns via idempotent ALTER TABLE migration (Phase 75, VTS-01)
- `market._context_derived` table created with `date VARCHAR NOT NULL PRIMARY KEY` and five derived columns: Vol_Regime, Term_Structure_State, Trend_Direction, VIX_Spike_Pct, VIX_Gap_Pct
- `migrateContextToNormalized()` exported from market-schemas.ts: copies VIX/VIX9D/VIX3M OHLCV+IVR/IVP rows from market.context into market.daily, and derived fields into market._context_derived — skips if already done
- market-importer.ts constants updated so `_context_derived` is a valid upsert target

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ivr/ivp columns, _context_derived table, migration function** - `dc93389` (feat)
2. **Task 2: Update market-importer.ts constants** - `9cae3ab` (feat)

## Files Created/Modified

- `packages/mcp-server/src/db/market-schemas.ts` — Added ivr/ivp ALTER TABLE migration, market._context_derived DDL, migrateContextToNormalized() function, call at end of ensureMarketTables()
- `packages/mcp-server/src/utils/market-importer.ts` — Added _context_derived to REQUIRED_SCHEMA_FIELDS and CONFLICT_TARGETS

## Decisions Made

- `migrateContextToNormalized` uses `vixDailyCount > 0` as the idempotency gate: if any VIX rows exist in market.daily, migration is skipped entirely
- `INSERT OR IGNORE` used (DuckDB dialect) rather than `ON CONFLICT DO NOTHING` — consistent with DuckDB syntax
- market.context is preserved (not dropped) per D-04/D-20 backward compatibility requirement
- Migration function placed before `ensureMarketTables` in file but called at the end of the function — forward declaration avoided by placing the exported function first

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema foundation complete — Plans 02/03/04 can build on market.daily ivr/ivp columns and market._context_derived table
- market.context data will be migrated automatically on next server startup for existing databases
- TypeScript compiles cleanly (verified)

---
*Phase: 75-normalized-vix-term-structure*
*Completed: 2026-03-24*
