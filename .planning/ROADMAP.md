# Roadmap: TradeBlocks

## Milestones

- ✅ **v2.6 DuckDB Analytics Layer** — Phases 41-45 (shipped 2026-02-04)
- ✅ **v2.7 Edge Decay Analysis** — Phases 46-50 (shipped 2026-02-06)
- ✅ **v2.8 Market Data Consolidation** — Phases 51-54 (shipped 2026-02-07)
- ✅ **v2.9 Lookahead-Free Market Analytics** — Phases 55-59 (shipped 2026-02-09)
- 🚧 **v2.10 Strategy Profiles** — Phases 60-62 (in progress)

See [MILESTONES.md](MILESTONES.md) for full history.

<details>
<summary>✅ v2.9 Lookahead-Free Market Analytics (Phases 55-59) — SHIPPED 2026-02-09</summary>

- [x] Phase 55: Field Classification Foundation (1/1 plans) — completed 2026-02-08
- [x] Phase 56: Fix Existing Tools (1/1 plans) — completed 2026-02-08
- [x] Phase 57: Restore enrich_trades (1/1 plans) — completed 2026-02-08
- [x] Phase 58: Schema Metadata + Documentation (1/1 plans) — completed 2026-02-08
- [x] Phase 59: Intraday Market Context Enrichment (1/1 plans) — completed 2026-02-08

</details>

### 🚧 v2.10 Strategy Profiles (In Progress)

**Milestone Goal:** Add persistent strategy profile storage and structure-aware analysis tools to the MCP server, enabling Claude to understand trade mechanics and run targeted analysis without needing strategy screenshots each session.

## Phases

- [x] **Phase 60: Profile Storage** - DuckDB strategy_profiles table with full schema (completed 2026-03-04)
- [x] **Phase 61: Profile CRUD Tools** - profile_strategy, get_strategy_profile, list_profiles, delete_profile MCP tools (completed 2026-03-05)
- [x] **Phase 62: Structure-Aware Analysis Tools** - analyze_structure_fit, validate_entry_filters, portfolio_structure_map MCP tools (completed 2026-03-05)

## Phase Details

### Phase 60: Profile Storage
**Goal**: Strategy profiles can be persisted to and retrieved from DuckDB with a schema that covers all Option Omega strategy types
**Depends on**: Nothing (builds on existing DuckDB infrastructure)
**Requirements**: STOR-01, STOR-02, STOR-03
**Success Criteria** (what must be TRUE):
  1. A `strategy_profiles` table exists in DuckDB with columns for structure type, greeks bias, legs detail, entry filters, exit rules, thesis, expected regimes, and key metrics
  2. Profiles are keyed by block_id + strategy name — two profiles for different strategies in the same block coexist without collision
  3. The schema accepts all known Option Omega strategy types (vertical spreads, calendars, iron condors, reverse iron condors, butterflies, etc.) without schema changes
  4. Upserting a profile with an existing block_id + strategy key overwrites the previous record cleanly
**Plans:** 1/1 plans complete

Plans:
- [x] 60-01-PLAN.md — Strategy profiles types, DDL, CRUD functions, and integration tests

### Phase 61: Profile CRUD Tools
**Goal**: Claude can create, retrieve, list, and delete strategy profiles through MCP tools using the storage layer from Phase 60
**Depends on**: Phase 60
**Requirements**: PROF-01, PROF-02, PROF-03
**Success Criteria** (what must be TRUE):
  1. Calling `profile_strategy` with a block_id, strategy name, and structured description creates or updates a profile in DuckDB and confirms success
  2. Calling `get_strategy_profile` with a block_id and strategy name returns the full stored profile including all schema fields
  3. Calling `list_profiles` with a block_id returns all profiles for that block; calling without a block_id returns profiles across all blocks
  4. Calling `delete_profile` with a block_id and strategy name removes the profile; deleting nonexistent returns success
  5. All four tools follow existing MCP patterns (Zod schema, sync middleware, handler, createToolOutput) and register correctly
**Plans:** 1/1 plans complete

Plans:
- [x] 61-01-PLAN.md — Profile CRUD tools (profile_strategy, get_strategy_profile, list_profiles, delete_profile) with integration tests

### Phase 62: Structure-Aware Analysis Tools
**Goal**: Claude can run targeted analysis that explicitly uses a stored profile to query the right conditions, validate filter contributions, and map portfolio coverage across strategies
**Depends on**: Phase 61
**Requirements**: ANLZ-01, ANLZ-02, ANLZ-03
**Success Criteria** (what must be TRUE):
  1. Calling `analyze_structure_fit` with a block_id and strategy name fetches the profile and returns a fit report with regime/condition query results tailored to that strategy's greeks bias and profit driver
  2. Calling `validate_entry_filters` with a block_id and strategy name compares performance on entered vs. filtered-out days and returns per-filter contribution metrics
  3. Calling `portfolio_structure_map` returns a matrix of all profiled strategies crossed against market regimes, showing which regime x structure combinations have coverage and which are blind spots
  4. All three tools return structured output consumable without further SQL and follow existing MCP registration patterns
**Plans:** 3/3 plans complete

Plans:
- [ ] 62-01-PLAN.md — Shared utilities (analysis-stats, filter-predicates) and Trend_Direction enrichment
- [ ] 62-02-PLAN.md — analyze_structure_fit and validate_entry_filters tools with integration tests
- [ ] 62-03-PLAN.md — portfolio_structure_map, profile-aware tool enhancements, and registration wiring

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 55. Field Classification Foundation | v2.9 | 1/1 | Complete | 2026-02-08 |
| 56. Fix Existing Tools | v2.9 | 1/1 | Complete | 2026-02-08 |
| 57. Restore enrich_trades | v2.9 | 1/1 | Complete | 2026-02-08 |
| 58. Schema Metadata + Documentation | v2.9 | 1/1 | Complete | 2026-02-08 |
| 59. Intraday Market Context Enrichment | v2.9 | 1/1 | Complete | 2026-02-08 |
| 60. Profile Storage | v2.10 | 1/1 | Complete | 2026-03-04 |
| 61. Profile CRUD Tools | v2.10 | 1/1 | Complete | 2026-03-05 |
| 62. Structure-Aware Analysis Tools | 3/3 | Complete    | 2026-03-05 | - |

### Phase 63: Eliminate block.json — Move sync state to DuckDB with CSV header-sniffing role detection

**Goal:** Eliminate the block.json file entirely from the MCP server sync layer. CSV role detection switches to header sniffing via a shared csv-discovery module. listBlocks computes stats from DuckDB instead of cached block.json data. Syncthing stops syncing block.json.
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06
**Depends on:** Phase 62
**Plans:** 2/2 plans complete

Plans:
- [ ] 63-01-PLAN.md — Extract CSV discovery module and remove block.json from sync layer
- [ ] 63-02-PLAN.md — Rewrite listBlocks to use DuckDB, eliminate all block.json code, update .stignore
