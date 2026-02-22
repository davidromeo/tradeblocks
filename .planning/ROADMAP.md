# Roadmap: TradeBlocks

## Milestones

- ✅ **v2.6 DuckDB Analytics Layer** — Phases 41-45 (shipped 2026-02-04)
- ✅ **v2.7 Edge Decay Analysis** — Phases 46-50 (shipped 2026-02-06)
- ✅ **v2.8 Market Data Consolidation** — Phases 51-54 (shipped 2026-02-07)
- ✅ **v2.9 Lookahead-Free Market Analytics** — Phases 55-59 (shipped 2026-02-09)
- 🚧 **v3.0 Market Data Separation** — Phases 60-64 (in progress)

See [MILESTONES.md](MILESTONES.md) for full history.

<details>
<summary>✅ v2.9 Lookahead-Free Market Analytics (Phases 55-59) — SHIPPED 2026-02-09</summary>

- [x] Phase 55: Field Classification Foundation (1/1 plans) — completed 2026-02-08
- [x] Phase 56: Fix Existing Tools (1/1 plans) — completed 2026-02-08
- [x] Phase 57: Restore enrich_trades (1/1 plans) — completed 2026-02-08
- [x] Phase 58: Schema Metadata + Documentation (1/1 plans) — completed 2026-02-08
- [x] Phase 59: Intraday Market Context Enrichment (1/1 plans) — completed 2026-02-08

</details>

### 🚧 v3.0 Market Data Separation (In Progress)

**Milestone Goal:** Extract market data into a separate DuckDB with normalized schema, model-driven import tools, and TypeScript enrichment pipeline — enabling users to bring their own market data from any source.

## Phases

- [x] **Phase 60: Database Separation and Connection Infrastructure** — Separate market.duckdb created, ATTACHed at startup, with normalized schema and safe connection lifecycle (completed 2026-02-21)
- [ ] **Phase 61: Import Tools** — MCP tools for ingesting market data from CSV files and external DuckDB databases
- [ ] **Phase 62: TypeScript Enrichment Pipeline** — Pure indicator functions and tiered enrichment runner computing ~40 derived fields from raw OHLCV
- [ ] **Phase 63: Tool Migration** — All 4 market-data tools and shared query utilities migrated to new normalized schema
- [ ] **Phase 64: Cleanup and API Surface** — Dead code removed, run_sql/describe_database updated, PineScripts simplified, new tools registered

## Phase Details

### Phase 60: Database Separation and Connection Infrastructure
**Goal**: MCP server starts with a separate market.duckdb ATTACHed alongside analytics.duckdb, with all four normalized tables created and safe connection lifecycle handling all ATTACH pitfalls
**Depends on**: Nothing (first phase of v3.0)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-09
**Success Criteria** (what must be TRUE):
  1. MCP server starts successfully with a `market.duckdb` file created at the configured path and ATTACHed as `market` schema
  2. Queries against `market.daily`, `market.context`, `market.intraday`, and `market._sync_metadata` succeed with correct primary key constraints (multi-ticker support via ticker column)
  3. Old market tables are dropped from `analytics.duckdb` before ATTACH, preventing the DuckDB #14421 corruption bug
  4. Connection close explicitly DETACHes market.duckdb, and read-write upgrade/downgrade re-ATTACHes correctly without stale file locks
  5. Import writes to market.duckdb are not wrapped in analytics.duckdb transactions (cross-database write isolation enforced)
**Plans:** 2/2 plans complete
Plans:
- [ ] 60-01-PLAN.md — Market schemas, ATTACH/DETACH lifecycle, and config resolution
- [ ] 60-02-PLAN.md — Cross-database write isolation and lifecycle integration tests

### Phase 61: Import Tools
**Goal**: Users can import market data from CSV files or external DuckDB databases into the normalized schema via MCP tools, with column mapping validation, ticker normalization, and idempotent merge semantics
**Depends on**: Phase 60
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, IMP-06, IMP-07
**Success Criteria** (what must be TRUE):
  1. User can call `import_market_csv` with a file path, column mapping, target table, and ticker to load OHLCV data into `market.daily` (or context/intraday) and see enriched fields populated automatically afterward
  2. User can call `import_from_database` with an external DuckDB path and query to pull market data across databases, with the source database properly ATTACHed and DETACHed within the tool call
  3. Overlapping imports (same ticker + date range) succeed without duplicates via ON CONFLICT DO NOTHING, and ticker values are normalized consistently regardless of input casing
  4. Column mapping validation rejects imports with missing required fields and returns clear error messages identifying which fields are absent
**Plans:** 1/3 plans executed
Plans:
- [ ] 61-01-PLAN.md — Core ingestion utilities (market-importer.ts + Phase 60 metadata helpers)
- [ ] 61-02-PLAN.md — Tool registration (market-imports.ts + index.ts wiring + version bump)
- [ ] 61-03-PLAN.md — Integration tests for both import tools

### Phase 62: TypeScript Enrichment Pipeline
**Goal**: Raw OHLCV data in market.daily is automatically enriched with ~40 computed indicator fields across three tiers, using pure TypeScript functions validated against TradingView outputs
**Depends on**: Phase 61
**Requirements**: ENR-01, ENR-02, ENR-03, ENR-04, ENR-05, ENR-06, ENR-07, ENR-08
**Success Criteria** (what must be TRUE):
  1. After importing raw OHLCV data, Tier 1 fields (RSI_14, ATR_Pct, Trend_Score, BB_Position, BB_Width, Realized_Vol, Gap_Pct, etc.) are computed and written to `market.daily` with values matching TradingView outputs within acceptable tolerance
  2. When `market.context` has VIX data, Tier 2 fields (Vol_Regime, Term_Structure_State, VIX_Percentile) are computed; when VIX data is absent, Tier 2 is skipped gracefully without errors
  3. When `market.intraday` has bar data, Tier 3 fields (High_Time, Low_Time, Reversal_Type, Opening_Drive_Strength, Intraday_Realized_Vol) are written to `market.daily`; when intraday is absent, Tier 3 is skipped gracefully
  4. Re-running enrichment on already-enriched data produces identical results (idempotent), and incremental imports only recompute the affected date range while using 200+ day lookback for Wilder smoothing warmup
  5. All 7 indicator functions have unit tests validating TradingView parity at non-trivial data points (not just the first 14 bars)
**Plans**: TBD

### Phase 63: Tool Migration
**Goal**: All four existing market-data tools and shared query utilities work against the new normalized schema, with graceful degradation when data is missing and correct lookahead-free field timing
**Depends on**: Phase 62
**Requirements**: MIG-01, MIG-02, MIG-03, MIG-04, MIG-05, MIG-06, MIG-07, MIG-08, MIG-09, MIG-10
**Success Criteria** (what must be TRUE):
  1. `enrich_trades` returns correct sameDay/priorDay fields by JOINing `market.daily` and `market.context`, with new enrichment fields (BB_Width, Realized_Vol) available in output
  2. `analyze_regime_performance` and `suggest_filters` segment trades using regime data from `market.context` JOIN, and `suggest_filters` includes new enrichment fields as filter candidates
  3. `calculate_orb` queries `market.intraday` with time-range filters instead of reading pivoted checkpoint columns, supporting any bar resolution
  4. `buildLookaheadFreeQuery()` correctly JOINs `market.daily + market.context` inside the CTE before applying LAG — a Monday trade returns Friday's Vol_Regime, not Monday's
  5. All tools report missing data with actionable messages (what is missing, how to import it) instead of silent NULLs or cryptic errors
**Plans**: TBD

### Phase 64: Cleanup and API Surface
**Goal**: Dead sync code is removed, API surface is updated for new schema, PineScripts are simplified, and new tools are registered in the MCP server index
**Depends on**: Phase 63
**Requirements**: CLN-02, CLN-03, CLN-04, CLN-05, CLN-06, CLN-07
**Success Criteria** (what must be TRUE):
  1. `run_sql` accepts queries against new table names (`market.daily`, `market.context`, `market.intraday`) and rejects queries against old table names (`market.spx_daily`, `market.spx_15min`, `market.vix_intraday`)
  2. `describe_database` returns the new schema structure with correct field timing annotations and an updated LAG CTE template that references the normalized tables
  3. The `_marketdata/` sync directory and its exports are deleted, and `import_csv`/`import_from_database` tools are registered in the MCP server index
  4. Pine Scripts are reduced from 3 to 1 minimal daily script exporting ~12 columns of raw OHLCV + VIX data
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 60 → 61 → 62 → 63 → 64

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 55. Field Classification Foundation | v2.9 | 1/1 | Complete | 2026-02-08 |
| 56. Fix Existing Tools | v2.9 | 1/1 | Complete | 2026-02-08 |
| 57. Restore enrich_trades | v2.9 | 1/1 | Complete | 2026-02-08 |
| 58. Schema Metadata + Documentation | v2.9 | 1/1 | Complete | 2026-02-08 |
| 59. Intraday Market Context Enrichment | v2.9 | 1/1 | Complete | 2026-02-08 |
| 60. Database Separation | 2/2 | Complete    | 2026-02-21 | - |
| 61. Import Tools | 1/3 | In Progress|  | - |
| 62. Enrichment Pipeline | v3.0 | 0/? | Not started | - |
| 63. Tool Migration | v3.0 | 0/? | Not started | - |
| 64. Cleanup and API Surface | v3.0 | 0/? | Not started | - |
