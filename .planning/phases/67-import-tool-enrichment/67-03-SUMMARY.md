---
phase: 67-import-tool-enrichment
plan: 03
subsystem: testing
tags: [duckdb, jest, integration-tests, massive, fetch-mock, ivr, ivp]

# Dependency graph
requires:
  - phase: 67-import-tool-enrichment/67-01
    provides: importFromMassive() function in market-importer.ts
  - phase: 67-import-tool-enrichment/67-02
    provides: runContextEnrichment(), IVR/IVP enrichment in market-enricher.ts

provides:
  - Integration test suite for importFromMassive() covering all three target_table paths
  - Verified upsert semantics with real DuckDB
  - Verified IVR/IVP enrichment with 252+ bar lookback
  - Bug fix: volume column stripped from daily mappedRows (market.daily has no volume column)

affects: [phase-68, milestone-v2.2-completion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-memory DuckDB (DuckDBInstance.create(':memory:')) with ATTACH ':memory:' AS market for isolated integration tests"
    - "jest.spyOn(globalThis, 'fetch') with URL-pattern-based routing for multi-ticker context import mocking"
    - "conn.closeSync() for DuckDB connection cleanup in afterEach (not conn.close() which is async-only)"

key-files:
  created:
    - packages/mcp-server/tests/integration/massive-import.test.ts
  modified:
    - packages/mcp-server/src/utils/market-importer.ts

key-decisions:
  - "In-memory DuckDB per test (not file-based tempdir) — faster, no filesystem cleanup needed, isolated per-test"
  - "Mock fetch uses URL-pattern matching (I%3AVIX9D before I%3AVIX) to correctly route context import's 3 concurrent calls"
  - "260 bars generated for IVR/IVP test (252 minimum + 8 buffer) using Math.sin() oscillation for realistic price movement"
  - "Unix timestamps fixed: 2024-01-02 09:30 ET = 1704205800000 ms (EST = UTC-5, 14:30 UTC)"

patterns-established:
  - "Integration test DuckDB setup: DuckDBInstance.create(':memory:') + ATTACH ':memory:' AS market + ensureMarketTables(conn)"
  - "Multi-ticker mock: Map<tickerPattern, response> with URL.includes() routing, most-specific pattern first"

requirements-completed: [TST-02, IMP-04]

# Metrics
duration: 15min
completed: 2026-03-22
---

# Phase 67 Plan 03: Integration Tests for import_from_massive Summary

**12-test integration suite for importFromMassive() using real DuckDB (in-memory) and mocked fetch, covering daily/context/intraday paths, upsert semantics, IVR/IVP enrichment verification, and error handling**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-22T19:10:00Z
- **Completed:** 2026-03-22T19:25:21Z
- **Tasks:** 1 (TDD — test and fix)
- **Files modified:** 2

## Accomplishments
- 12 integration tests passing covering all three target_table paths (daily, context, intraday)
- Verified IVR/IVP columns are populated when 252+ bars are present
- Verified upsert semantics: re-import of same dates updates (not duplicates) rows
- Auto-fixed bug: volume column was being mapped to market.daily which has no volume column

## Task Commits

1. **Task 1: Integration tests for import_from_massive** - `b7928af` (test + fix)

## Files Created/Modified
- `packages/mcp-server/tests/integration/massive-import.test.ts` — 12-test integration suite with real DuckDB, mocked fetch
- `packages/mcp-server/src/utils/market-importer.ts` — Bug fix: removed volume from daily mappedRows

## Decisions Made
- Used `DuckDBInstance.create(':memory:')` with `ATTACH ':memory:' AS market` for per-test isolation without filesystem cleanup
- Mock fetch routing uses URL pattern matching (Map iteration order matters — VIX9D before VIX to avoid prefix collision)
- conn.closeSync() required in afterEach (DuckDB node-api v1.4.4 — no async close on connection)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] volume column stripped from market.daily daily import mappedRows**
- **Found during:** Task 1 (integration tests discovered the bug when tests failed with "Table daily does not have a column with name volume")
- **Issue:** `importFromMassive()` for `targetTable: "daily"` mapped `volume: row.volume` but `market.daily` schema has no volume column (only intraday strips volume)
- **Fix:** Removed `volume: row.volume` from daily mappedRows in market-importer.ts (lines 736-744)
- **Files modified:** `packages/mcp-server/src/utils/market-importer.ts`
- **Verification:** All 12 integration tests pass including daily import tests
- **Committed in:** b7928af (combined with test commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in daily import volume mapping)
**Impact on plan:** Required fix for correctness. No scope creep.

## Issues Encountered
- Unix timestamp for 09:30 ET on 2024-01-02 was initially wrong (1704202200000 = 08:30 ET; correct is 1704205800000 for 14:30 UTC = 09:30 EST)

## Known Stubs
None — all import paths verified with real data through to DuckDB.

## Next Phase Readiness
- Phase 67 complete — all 3 plans done (massive-client, importer+enricher, integration tests)
- Phase 68 (documentation cleanup) can proceed

## Self-Check: PASSED
- File exists: packages/mcp-server/tests/integration/massive-import.test.ts ✓
- Commit exists: b7928af ✓
- All 12 tests pass ✓

---
*Phase: 67-import-tool-enrichment*
*Completed: 2026-03-22*
