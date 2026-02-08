# Roadmap: TradeBlocks

## Completed Milestones

See [MILESTONES.md](MILESTONES.md) for full history (v1.0 through v2.7).

## v2.8 Market Data Consolidation (In Progress)

**Milestone Goal:** Consolidate 6 PineScripts to 3, merge highlow timing into daily export, enrich with VIX fields, unify DuckDB import path, and retire in-memory CSV loading.

**Phase Numbering:** Continues from v2.7 (phases 46-50). v2.8 starts at phase 51.

- [x] **Phase 51: PineScript Consolidation** - Merge highlow into daily script, export new VIX fields, remove dead scripts
- [x] **Phase 52: DuckDB Schema + Sync** - Update schema for combined CSV, update sync logic, retire highlow table
- [x] **Phase 53: Import Consolidation** - Migrate 3 market data tools from in-memory CSV to DuckDB queries
- [ ] **Phase 54: Documentation + Cleanup** - Update docs for new 3-script workflow, remove PoC files

## Phase Details

### Phase 51: PineScript Consolidation
**Goal**: Daily PineScript produces a single combined CSV with highlow timing, enriched VIX fields, and all existing daily data
**Depends on**: Nothing (first phase of v2.8)
**Requirements**: PINE-01, PINE-02, PINE-03, PINE-04, PINE-05, PINE-06, PINE-07, PINE-08, PINE-09
**Success Criteria** (what must be TRUE):
  1. Updated daily .pine script computes highlow timing via `request.security_lower_tf()` and exports all 13 highlow fields alongside existing daily columns
  2. Updated daily .pine script exports 7 new VIX fields (VIX_Gap_Pct, VIX9D_Open, VIX9D_Change_Pct, VIX_High, VIX_Low, VIX3M_Open, VIX3M_Change_Pct) in the CSV
  3. Standalone highlow script file is deleted from the repository
  4. 30-min and hourly checkpoint scripts are deleted from the repository
  5. Scripts README documents the new 3-script workflow (daily, 15min, VIX intraday)
**Plans**: 2 plans
Plans:
- [x] 51-01-PLAN.md -- Merge highlow timing + enriched VIX exports into spx-daily.pine
- [x] 51-02-PLAN.md -- Delete obsolete scripts + update README for 3-script workflow

### Phase 52: DuckDB Schema + Sync
**Goal**: DuckDB schema absorbs highlow and new VIX columns into `spx_daily`, sync handles the combined CSV, and the `spx_highlow` table is retired
**Depends on**: Phase 51 (needs combined CSV format defined)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. `describe_database` shows `spx_daily` table with all 13 highlow columns and 7 new VIX columns, with accurate descriptions
  2. `spx_highlow` table no longer exists in the schema (dropped)
  3. Market sync ingests the combined daily CSV (with highlow + VIX fields) and populates `spx_daily` correctly
  4. `spx_highlow.csv` file mapping is gone from sync configuration
  5. Existing `spx_daily.csv` data can be purged and re-imported cleanly after schema change
**Plans**: 1 plan
Plans:
- [x] 52-01-PLAN.md -- Schema migration, sync config, reference cleanup, version bump

### Phase 53: Import Consolidation
**Goal**: All market data tools query DuckDB exclusively, eliminating the in-memory CSV loading path
**Depends on**: Phase 52 (needs DuckDB schema and sync working)
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05
**Success Criteria** (what must be TRUE):
  1. `analyze_regime_performance` returns correct results using DuckDB queries (no CSV loading)
  2. `suggest_filters` returns correct results using DuckDB queries (no CSV loading)
  3. `calculate_orb` returns correct results using DuckDB queries (no CSV loading)
  4. In-memory CSV loading functions and 5-min TTL cache are removed from market-data.ts
**Plans**: 1 plan
Plans:
- [x] 53-01-PLAN.md -- Migrate 3 tools to DuckDB queries, remove CSV loading infrastructure, version bump

### Phase 54: Documentation + Cleanup
**Goal**: All documentation reflects the new 3-script, DuckDB-only architecture and PoC artifacts are removed
**Depends on**: Phase 53 (needs final architecture settled)
**Requirements**: DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. PoC test files in scripts/poc test/ are removed from the repository
  2. CLAUDE.md references 3 PineScripts (not 6) and reflects DuckDB-only market data access
**Plans**: 1 plan
Plans:
- [ ] 54-01-PLAN.md -- Delete PoC files, update CLAUDE.md and planning docs, close v2.8 milestone

## Progress

**Execution Order:** 51 -> 52 -> 53 -> 54

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 51. PineScript Consolidation | v2.8 | 2/2 | Complete | 2026-02-07 |
| 52. DuckDB Schema + Sync | v2.8 | 1/1 | Complete | 2026-02-07 |
| 53. Import Consolidation | v2.8 | 1/1 | Complete | 2026-02-07 |
| 54. Documentation + Cleanup | v2.8 | 0/1 | Not started | - |
