# Requirements: TradeBlocks v3.0 Market Data Separation

**Defined:** 2026-02-21
**Core Value:** Accurate, trustworthy portfolio analytics that help traders understand their edge — accessible via both web UI and AI-assisted workflows.

## v3.0 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Database Infrastructure

- [x] **DB-01**: Separate market.duckdb file created and ATTACHed as `market` schema at startup
- [x] **DB-02**: Configurable `MARKET_DB_PATH` via env var or CLI argument, defaulting to `<baseDir>/market.duckdb`
- [x] **DB-03**: Normalized `market.daily` table with `(ticker, date)` primary key for OHLCV + computed indicators
- [x] **DB-04**: Normalized `market.context` table with `(date)` primary key for global market conditions (VIX, regime, term structure)
- [x] **DB-05**: Normalized `market.intraday` table with `(ticker, date, time)` primary key for any-resolution bar data
- [x] **DB-06**: `market._sync_metadata` table tracking import/enrichment state per source and ticker
- [x] **DB-07**: Explicit DETACH on connection close, re-ATTACH on read-write upgrade/downgrade
- [x] **DB-08**: Old market tables dropped from `analytics.duckdb` before ATTACH (corruption prevention per DuckDB #14421)
- [x] **DB-09**: Cross-database write isolation enforced (import tools not wrapped in withFullSync)

### Import Tools

- [ ] **IMP-01**: `import_csv` MCP tool accepting file path, column mapping, target table, ticker, and optional skip_enrichment flag
- [ ] **IMP-02**: `import_from_database` MCP tool accepting DuckDB path, query, column mapping, target table, ticker, with ATTACH/DETACH lifecycle
- [ ] **IMP-03**: Column mapping validation ensuring required fields per target table
- [ ] **IMP-04**: `ON CONFLICT DO NOTHING` merge semantics for safe overlapping imports
- [ ] **IMP-05**: Ticker normalization enforced at import boundary via `normalizeTicker()`
- [ ] **IMP-06**: Enrichment pipeline triggered automatically after import unless skip_enrichment is true
- [ ] **IMP-07**: Multi-ticker support — any ticker can be imported into daily, context, or intraday tables

### Enrichment Pipeline

- [ ] **ENR-01**: Pure TypeScript indicator functions (RSI, ATR, EMA, SMA, Bollinger Bands, realized vol) validated against TradingView outputs
- [ ] **ENR-02**: Tier 1 enrichment: ~18 fields from single-ticker OHLCV (Gap_Pct, RSI_14, ATR_Pct, Trend_Score, BB_Position, BB_Width, Realized_Vol_5D/20D, Prior_Range_vs_ATR, etc.)
- [ ] **ENR-03**: Tier 2 enrichment: VIX regime fields from `market.context` (Vol_Regime, Term_Structure_State, VIX_Percentile, VIX ratios, etc.)
- [ ] **ENR-04**: Tier 3 enrichment: intraday timing fields written to `market.daily` from `market.intraday` bars (High_Time, Low_Time, Reversal_Type, Opening_Drive_Strength, Intraday_Realized_Vol, etc.)
- [ ] **ENR-05**: 200+ day lookback for Wilder smoothing warmup, only updating requested date range
- [ ] **ENR-06**: Wilder state caching in `_sync_metadata` for efficient incremental imports
- [ ] **ENR-07**: Idempotent enrichment (re-running produces same results)
- [ ] **ENR-08**: Unit tests for all indicator functions with TradingView parity validation

### Tool Migration

- [ ] **MIG-01**: `enrich_trades` migrated to `market.daily JOIN market.context` with updated intraday queries
- [ ] **MIG-02**: `analyze_regime_performance` migrated with context JOIN for regime segmentation
- [ ] **MIG-03**: `suggest_filters` migrated with context JOIN for VIX-based filters
- [ ] **MIG-04**: `suggest_filters` updated to include new enrichment fields as filter candidates (BB_Width, Realized_Vol, Prior_Range_vs_ATR)
- [ ] **MIG-05**: `calculate_orb` rewritten to query `market.intraday` with time range filter (any bar resolution)
- [ ] **MIG-06**: `buildLookaheadFreeQuery()` rewritten with `market.daily JOIN market.context` inside CTE before LAG application
- [ ] **MIG-07**: `checkDataAvailability()` helper integrated into all market tools
- [ ] **MIG-08**: Tools report missing data clearly with actionable messages instead of silent NULLs
- [ ] **MIG-09**: `schema-metadata.ts` updated with new tables, new fields, and field timing annotations
- [ ] **MIG-10**: `field-timing.ts` updated with correct column counts and JOIN-aware LAG CTE

### Cleanup

- [ ] **CLN-02**: `run_sql` allowlist updated to new table names
- [ ] **CLN-03**: `describe_database` updated with new schema structure and LAG CTE template
- [ ] **CLN-04**: `_marketdata/` sync code deleted (market-sync.ts and related exports)
- [ ] **CLN-05**: Pine Scripts simplified to 1 minimal daily script (~12 columns of raw OHLCV + VIX)
- [ ] **CLN-06**: Two Pine Scripts removed (spx-15min-checkpoints.pine, vix-intraday.pine)
- [ ] **CLN-07**: New import tools registered in MCP server index

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Tranche Optimizer | Deferred to v3.1 |
| Parquet import format | CSV + DuckDB covers all current user needs |
| Options chain / IV surface data | Not derivable from OHLCV; different feature entirely |
| Real-time data feeds | Batch CSV/DB updates sufficient for analysis |
| Auto-detect CSV format | Model-driven mapping replaces format detection |
| migrate_market_data tool | Users re-import their source CSVs via import_csv; import_from_database covers edge cases |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 60 | Complete |
| DB-02 | Phase 60 | Complete |
| DB-03 | Phase 60 | Complete |
| DB-04 | Phase 60 | Complete |
| DB-05 | Phase 60 | Complete |
| DB-06 | Phase 60 | Complete |
| DB-07 | Phase 60 | Complete |
| DB-08 | Phase 60 | Complete |
| DB-09 | Phase 60 | Complete |
| IMP-01 | Phase 61 | Pending |
| IMP-02 | Phase 61 | Pending |
| IMP-03 | Phase 61 | Pending |
| IMP-04 | Phase 61 | Pending |
| IMP-05 | Phase 61 | Pending |
| IMP-06 | Phase 61 | Pending |
| IMP-07 | Phase 61 | Pending |
| ENR-01 | Phase 62 | Pending |
| ENR-02 | Phase 62 | Pending |
| ENR-03 | Phase 62 | Pending |
| ENR-04 | Phase 62 | Pending |
| ENR-05 | Phase 62 | Pending |
| ENR-06 | Phase 62 | Pending |
| ENR-07 | Phase 62 | Pending |
| ENR-08 | Phase 62 | Pending |
| MIG-01 | Phase 63 | Pending |
| MIG-02 | Phase 63 | Pending |
| MIG-03 | Phase 63 | Pending |
| MIG-04 | Phase 63 | Pending |
| MIG-05 | Phase 63 | Pending |
| MIG-06 | Phase 63 | Pending |
| MIG-07 | Phase 63 | Pending |
| MIG-08 | Phase 63 | Pending |
| MIG-09 | Phase 63 | Pending |
| MIG-10 | Phase 63 | Pending |
| CLN-02 | Phase 64 | Pending |
| CLN-03 | Phase 64 | Pending |
| CLN-04 | Phase 64 | Pending |
| CLN-05 | Phase 64 | Pending |
| CLN-06 | Phase 64 | Pending |
| CLN-07 | Phase 64 | Pending |

**Coverage:**
- v3.0 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after roadmap creation*
