# Roadmap: TradeBlocks v2.6 DuckDB Analytics Layer

## Overview

This milestone adds SQL query capabilities to the MCP server, enabling Claude to write arbitrary SQL against trades and market data for hypothesis generation. The work proceeds through database foundation, CSV sync pipeline, query interface with security sandbox, schema discovery for Claude, and tool rationalization to replace rigid query tools with flexible SQL.

## Milestones

- v1.0 MVP (Phases 1-10) - shipped 2026-01-11
- v2.0 Claude Integration (Phases 11-16) - shipped 2026-01-17
- v2.1 Portfolio Comparison (Phases 17-24) - shipped 2026-01-18
- v2.2 Historical Risk-Free Rates (Phases 25-28) - shipped 2026-01-18
- v2.3 Workspace Packages (Phases 29-31) - shipped 2026-01-19
- v2.4 Backtest Optimization Tools (Phases 32-34) - shipped 2026-01-19
- v2.5 Reporting Log Integration (Phases 35-39) - shipped 2026-02-01
- **v2.6 DuckDB Analytics Layer** (Phases 41-45) - in progress

## Phases

**Phase Numbering:**
- Integer phases (41, 42, 43...): Planned milestone work
- Decimal phases (41.1, 41.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 41: Database Infrastructure** - DuckDB integration with security and resource configuration
- [x] **Phase 42: Sync Layer** - CSV-to-DuckDB synchronization with hash-based change detection
- [x] **Phase 42.1: Sync Layer Hardening** - Integration tests and sync middleware pattern (INSERTED)
- [ ] **Phase 43: Query Interface** - run_sql MCP tool with security sandbox
- [ ] **Phase 44: Schema Discovery** - Tools for Claude to discover tables and columns
- [ ] **Phase 45: Tool Rationalization** - Analysis and deprecation of redundant query tools

## Phase Details

### Phase 41: Database Infrastructure
**Goal**: Establish secure, properly configured DuckDB foundation for all subsequent features
**Depends on**: Nothing (first phase of v2.6)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06
**Success Criteria** (what must be TRUE):
  1. MCP server starts successfully with @duckdb/node-api integrated
  2. DuckDB connection initializes on first query and shuts down gracefully on server exit
  3. analytics.duckdb created with trades and market schemas (single file per CONTEXT.md)
  4. Filesystem access is disabled (enable_external_access = false enforced)
  5. Memory and thread limits are configured (no OOM on large queries)
**Plans**: 1 plan
Plans:
- [x] 41-01-PLAN.md - DuckDB integration with connection manager and shutdown handling

### Phase 42: Sync Layer
**Goal**: Reliable CSV-to-DuckDB synchronization that keeps cache fresh without manual intervention
**Depends on**: Phase 41
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07
**Success Criteria** (what must be TRUE):
  1. Adding a new block folder triggers sync on next query
  2. Modifying a block's CSV triggers re-sync on next query
  3. Deleting a block folder removes its data from DuckDB on next query
  4. Sync errors roll back cleanly (no partial state in database)
  5. Market data from _marketdata/ folder is synced and queryable
**Plans**: 4 plans
Plans:
- [x] 42-01-PLAN.md - Sync infrastructure (metadata tables, hasher, sync module skeleton)
- [x] 42-02-PLAN.md - Block sync logic (tradelog/dailylog CSV to DuckDB)
- [x] 42-03-PLAN.md - Market data sync (date-based merge for _marketdata/)
- [x] 42-04-PLAN.md - Tool integration (wire sync into list_blocks and per-block tools)

### Phase 42.1: Sync Layer Hardening (INSERTED)
**Goal**: Solidify sync layer with tests, split oversized tool files, and add cleaner middleware pattern
**Depends on**: Phase 42
**Requirements**: None (technical debt / quality improvement)
**Success Criteria** (what must be TRUE):
  1. Integration tests verify sync detects new/changed/deleted blocks correctly
  2. Integration tests verify transaction rollback on failure (no partial state)
  3. `blocks.ts` (3,374 lines) split into logical modules (<800 lines each)
  4. `reports.ts` (3,338 lines) split into logical modules (<800 lines each)
  5. Sync middleware pattern eliminates boilerplate from tool handlers
  6. All sync-integrated tools use the middleware pattern
**Plans**: 3 plans
Plans:
- [x] 42.1-01-PLAN.md - Integration tests for sync layer
- [x] 42.1-02-PLAN.md - Tool file splitting (blocks.ts, reports.ts)
- [x] 42.1-03-PLAN.md - Sync middleware pattern

### Phase 43: Query Interface
**Goal**: Claude can execute arbitrary SQL queries against trades and market data
**Depends on**: Phase 42
**Requirements**: SQL-01, SQL-02, SQL-03, SQL-04, SQL-05, SQL-06
**Success Criteria** (what must be TRUE):
  1. run_sql MCP tool accepts SQL strings and returns results
  2. Queries can JOIN trades with market data tables (e.g., trades + spx_daily)
  3. Cross-block queries work (WHERE block_id IN (...) or no filter)
  4. Results are limited to prevent context overflow (default 100 rows)
  5. Dangerous SQL patterns (COPY, EXPORT, ATTACH) are blocked with helpful errors
**Plans**: TBD

### Phase 44: Schema Discovery
**Goal**: Claude has tools to discover what tables and columns are available for queries
**Depends on**: Phase 43
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03
**Success Criteria** (what must be TRUE):
  1. Claude can list all available tables and their descriptions
  2. Claude can get column names and types for any table
  3. Example queries are documented for common hypothesis patterns
**Plans**: TBD

### Phase 45: Tool Rationalization
**Goal**: Identify and deprecate MCP tools that run_sql can replace
**Depends on**: Phase 44
**Requirements**: DEPR-01, DEPR-02, DEPR-03
**Success Criteria** (what must be TRUE):
  1. Analysis document exists listing which tools run_sql can replace
  2. Deprecation plan documented with timeline
  3. At least one tool marked deprecated with migration guidance
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 41 -> 42 -> 42.1 -> 43 -> 44 -> 45

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 41. Database Infrastructure | v2.6 | 1/1 | Complete | 2026-02-01 |
| 42. Sync Layer | v2.6 | 4/4 | Complete | 2026-02-02 |
| 42.1 Sync Layer Hardening | v2.6 | 3/3 | Complete | 2026-02-02 |
| 43. Query Interface | v2.6 | 0/TBD | Not started | - |
| 44. Schema Discovery | v2.6 | 0/TBD | Not started | - |
| 45. Tool Rationalization | v2.6 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-01*
*Last updated: 2026-02-02 (Phase 42.1 complete)*
