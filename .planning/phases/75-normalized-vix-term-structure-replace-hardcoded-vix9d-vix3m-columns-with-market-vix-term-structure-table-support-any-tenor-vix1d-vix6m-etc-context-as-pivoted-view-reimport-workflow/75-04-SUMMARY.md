---
phase: 75-normalized-vix-term-structure
plan: "04"
subsystem: mcp-tools-descriptions
tags: [duckdb, market-data, vix, schema-migration, tool-descriptions, describe-database]

# Dependency graph
requires:
  - phase: 75-normalized-vix-term-structure
    plan: "03"
    provides: buildLookaheadFreeQuery with VIX ticker JOINs + market._context_derived

provides:
  - All MCP tool descriptions reference normalized VIX schema
  - describe_database VIX tenor auto-discovery (SELECT DISTINCT ticker LIKE 'VIX%')
  - sql.ts ALLOWED_TABLES includes market._context_derived
  - Test suite updated for normalized schema

affects:
  - All users calling describe_database (now see vixTenors field)
  - run_sql users (can now query market._context_derived directly)
  - All AI guidance from tool descriptions (now references correct tables)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VIX tenor auto-discovery: SELECT DISTINCT ticker FROM market.daily WHERE ticker LIKE 'VIX%'"
    - "vixTenors output field: {available, queryPattern, ratioPattern} for AI-guided queries"
    - "Test insertMarketData pattern: write to market.daily VIX + market._context_derived for normalized schema"

key-files:
  created: []
  modified:
    - packages/mcp-server/src/tools/market-data.ts
    - packages/mcp-server/src/tools/schema.ts
    - packages/mcp-server/src/tools/sql.ts
    - packages/mcp-server/src/tools/market-imports.ts
    - packages/mcp-server/src/tools/market-enrichment.ts
    - packages/mcp-server/tests/unit/field-timing.test.ts
    - packages/mcp-server/tests/integration/massive-import.test.ts
    - packages/mcp-server/tests/integration/profile-analysis-fit.test.ts
    - packages/mcp-server/tests/integration/profile-analysis-map.test.ts

key-decisions:
  - "vixTenors field added to describe_database output: AI tools can discover which VIX tenors are imported without guessing"
  - "sql.ts retains market.context in ALLOWED_TABLES (legacy entry) + adds market._context_derived for normalized queries"
  - "LAG CTE template in schema.ts updated to use 4 JOINs (vix, vix9d, vix3m, _context_derived)"
  - "market.context preserved in import tool descriptions for backward compat (target_table='context' still works)"

requirements-completed: [VTS-15, VTS-16, TST-19]

# Metrics
duration: 14min
completed: "2026-03-24"
---

# Phase 75 Plan 04: Tool Descriptions + describe_database VIX Tenor Discovery Summary

**All MCP tool descriptions updated to reference normalized VIX schema (market.daily VIX tickers + market._context_derived); describe_database gains VIX tenor auto-discovery; sql.ts allows market._context_derived queries; all tests updated and passing**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-24T15:04:00Z
- **Completed:** 2026-03-24T15:18:19Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `market-data.ts` module docstring updated: `market.context` → `market.daily (VIX tickers) + market._context_derived`
- `market-data.ts` `DailyMarketData` interface comments updated: `// VIX (market.daily ticker='VIX' via JOIN)` and `// VIX term structure (market.daily ticker='VIX9D'/'VIX3M' via JOIN)`
- `market-data.ts` all 6 tool description strings updated (zero remaining `market.context` references)
- `schema.ts` CTE template SQL updated: `LEFT JOIN market.context c` → 4 JOINs (vix, vix9d, vix3m, _context_derived)
- `schema.ts` VIX tenor auto-discovery added: queries `SELECT DISTINCT ticker FROM market.daily WHERE ticker LIKE 'VIX%'`
- `schema.ts` `describe_database` output includes `vixTenors` field with `available`, `queryPattern`, `ratioPattern`
- `schema.ts` importWorkflow steps updated to reference `market._context_derived`
- `sql.ts` `AVAILABLE_TABLES` array gains `market._context_derived` entry
- `sql.ts` run_sql description now includes `market._context_derived` in the table list
- `sql.ts` module docstring updated with LEGACY note for `market.context`
- `market-imports.ts` module docstring and all 3 import tool descriptions updated
- `market-enrichment.ts` module docstring and tool description updated (Tier 2 references `market.daily` + `market._context_derived`)
- Test suite: 816 tests pass, 1 pre-existing failure (trade-replay-greeks DTE=0 edge case, unrelated to this plan)
- `field-timing.test.ts`: JOIN assertions updated for VIX ticker JOINs; field count assertions updated (9/39/51)
- `massive-import.test.ts`: context import assertions updated (3x rows per date, market.daily IVR queries)
- `profile-analysis-fit.test.ts`: `insertMarketData` writes VIX rows to `market.daily` + Vol_Regime to `market._context_derived`
- `profile-analysis-map.test.ts`: `insertMarketData` writes Trend_Direction to `market._context_derived`

## Task Commits

Each task was committed atomically:

1. **Task 1: Update market-data.ts descriptions and DailyMarketData interface** — `b014cec` (feat)
2. **Task 2: Update schema.ts, sql.ts, market-imports.ts, market-enrichment.ts** — `2e01213` (feat)
3. **Task 3: Update tests for normalized schema** — `239d68f` (test)

## Files Created/Modified

- `packages/mcp-server/src/tools/market-data.ts` — Module docstring, DailyMarketData comments, 6 tool description strings updated
- `packages/mcp-server/src/tools/schema.ts` — CTE template updated; VIX tenor auto-discovery added; importWorkflow steps updated
- `packages/mcp-server/src/tools/sql.ts` — AVAILABLE_TABLES gains `market._context_derived`; description updated
- `packages/mcp-server/src/tools/market-imports.ts` — Module docstring and 3 import tool descriptions updated
- `packages/mcp-server/src/tools/market-enrichment.ts` — Module docstring and tool description updated
- `packages/mcp-server/tests/unit/field-timing.test.ts` — JOIN and field count assertions updated
- `packages/mcp-server/tests/integration/massive-import.test.ts` — Context import row count and IVR query updated
- `packages/mcp-server/tests/integration/profile-analysis-fit.test.ts` — insertMarketData writes to normalized tables
- `packages/mcp-server/tests/integration/profile-analysis-map.test.ts` — insertMarketData writes to normalized tables

## Decisions Made

- `vixTenors` output added to `describe_database`: AI tools can auto-discover available VIX tenors and know the correct query pattern without hallucinating column names
- `market.context` kept in `ALLOWED_TABLES` (legacy entry) — users who wrote SQL queries referencing `market.context` still work; they can migrate to `market._context_derived` at their convenience
- LAG CTE template in `schema.ts` updated to 4-JOIN pattern (vix, vix9d, vix3m, cd) — matches what `buildLookaheadFreeQuery` actually generates
- Test helpers updated to insert into both `market.daily` (VIX ticker rows) and `market._context_derived` (regime fields) — no longer insert regime fields into `market.context` only

## Deviations from Plan

### Auto-fixed Issues

None. One pre-existing test failure discovered:

**Pre-existing failure (out of scope):**
- `trade-replay-greeks.test.ts`: "returns null greeks values when DTE <= 0" — failing before this plan's changes (confirmed via git stash). DTE edge case in Black-Scholes model, unrelated to VIX schema migration. Logged to deferred items.

Plan executed exactly as written for all 3 tasks.

## Issues Encountered

- Pre-existing `trade-replay-greeks.test.ts` test failure (1 test) confirmed to not be caused by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. All VIX schema references in tool descriptions are accurate and point to the normalized schema implemented in Plans 01-03.

## Next Phase Readiness

- All tool descriptions now guide AI to use `market.daily` for VIX ticker data and `market._context_derived` for regime fields
- `describe_database` automatically reports available VIX tenors (VIX, VIX9D, VIX3M, plus any future tenors)
- `run_sql` allows direct queries on `market._context_derived`
- Phase 75 is complete — all 4 plans executed successfully

---
*Phase: 75-normalized-vix-term-structure*
*Completed: 2026-03-24*
