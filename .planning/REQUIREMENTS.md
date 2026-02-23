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

- [x] **IMP-01**: `import_csv` MCP tool accepting file path, column mapping, target table, ticker, and optional skip_enrichment flag
- [x] **IMP-02**: `import_from_database` MCP tool accepting DuckDB path, query, column mapping, target table, ticker, with ATTACH/DETACH lifecycle
- [x] **IMP-03**: Column mapping validation ensuring required fields per target table
- [x] **IMP-04**: `ON CONFLICT DO NOTHING` merge semantics for safe overlapping imports
- [x] **IMP-05**: Ticker normalization enforced at import boundary via `normalizeTicker()`
- [x] **IMP-06**: Enrichment pipeline triggered automatically after import unless skip_enrichment is true
- [x] **IMP-07**: Multi-ticker support — any ticker can be imported into daily, context, or intraday tables

### Enrichment Pipeline

- [x] **ENR-01**: Pure TypeScript indicator functions (RSI, ATR, EMA, SMA, Bollinger Bands, realized vol) validated against TradingView outputs
- [x] **ENR-02**: Tier 1 enrichment: ~18 fields from single-ticker OHLCV (Gap_Pct, RSI_14, ATR_Pct, Trend_Score, BB_Position, BB_Width, Realized_Vol_5D/20D, Prior_Range_vs_ATR, etc.)
- [x] **ENR-03**: Tier 2 enrichment: VIX regime fields from `market.context` (Vol_Regime, Term_Structure_State, VIX_Percentile, VIX ratios, etc.)
- [x] **ENR-04**: Tier 3 enrichment: intraday timing fields written to `market.daily` from `market.intraday` bars (High_Time, Low_Time, Reversal_Type, Opening_Drive_Strength, Intraday_Realized_Vol, etc.) — *deferred: blocked by intraday CSV format (single Unix timestamp must be split into separate date/time columns in Pine Script export before market.intraday can be populated; see STATE.md blocker)*
- [x] **ENR-05**: 200+ day lookback for Wilder smoothing warmup, only updating requested date range
- [x] **ENR-06**: Efficient incremental imports via `enriched_through` date watermark in `_sync_metadata` with 200-day lookback for Wilder smoothing warmup (watermark approach — no per-row Wilder state stored)
- [x] **ENR-07**: Idempotent enrichment (re-running produces same results)
- [x] **ENR-08**: Unit tests for all indicator functions with TradingView parity validation

### Tool Migration

- [x] **MIG-01**: `enrich_trades` migrated to `market.daily JOIN market.context` with updated intraday queries
- [x] **MIG-02**: `analyze_regime_performance` migrated with context JOIN for regime segmentation
- [x] **MIG-03**: `suggest_filters` migrated with context JOIN for VIX-based filters
- [x] **MIG-04**: `suggest_filters` updated to include new enrichment fields as filter candidates (BB_Width, Realized_Vol, Prior_Range_vs_ATR)
- [x] **MIG-05**: `calculate_orb` rewritten to query `market.intraday` with time range filter (any bar resolution)
- [x] **MIG-06**: `buildLookaheadFreeQuery()` rewritten with `market.daily JOIN market.context` inside CTE before LAG application
- [x] **MIG-07**: `checkDataAvailability()` helper integrated into all market tools
- [x] **MIG-08**: Tools report missing data clearly with actionable messages instead of silent NULLs
- [x] **MIG-09**: `schema-metadata.ts` updated with new tables, new fields, and field timing annotations
- [x] **MIG-10**: `field-timing.ts` updated with correct column counts and JOIN-aware LAG CTE

### Cleanup

- [x] **CLN-02**: `run_sql` allowlist updated to new table names
- [x] **CLN-03**: `describe_database` updated with new schema structure and LAG CTE template
- [x] **CLN-04**: `_marketdata/` sync code deleted (market-sync.ts and related exports)
- [x] **CLN-05**: Pine Scripts simplified to 1 minimal daily script (~12 columns of raw OHLCV + VIX)
- [x] **CLN-06**: Two Pine Scripts removed (spx-15min-checkpoints.pine, vix-intraday.pine)
- [x] **CLN-07**: New import tools registered in MCP server index

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
| IMP-01 | Phase 61 | Complete |
| IMP-02 | Phase 61 | Complete |
| IMP-03 | Phase 61 | Complete |
| IMP-04 | Phase 61 | Complete |
| IMP-05 | Phase 61 | Complete |
| IMP-06 | Phase 61 | Complete |
| IMP-07 | Phase 61 | Complete |
| ENR-01 | Phase 62 | Complete |
| ENR-02 | Phase 62 | Complete |
| ENR-03 | Phase 62 | Complete |
| ENR-04 | Phase 62 | Deferred |
| ENR-05 | Phase 62 | Complete |
| ENR-06 | Phase 62 | Complete |
| ENR-07 | Phase 62 | Complete |
| ENR-08 | Phase 62 | Complete |
| MIG-01 | Phase 63 | Complete |
| MIG-02 | Phase 63 | Complete |
| MIG-03 | Phase 63 | Complete |
| MIG-04 | Phase 63 | Complete |
| MIG-05 | Phase 63 | Complete |
| MIG-06 | Phase 63 | Complete |
| MIG-07 | Phase 63 | Complete |
| MIG-08 | Phase 63 | Complete |
| MIG-09 | Phase 63 | Complete |
| MIG-10 | Phase 63 | Complete |
| CLN-02 | Phase 64 | Complete |
| CLN-03 | Phase 64 | Complete |
| CLN-04 | Phase 64 | Complete |
| CLN-05 | Phase 64 | Complete |
| CLN-06 | Phase 64 | Complete |
| CLN-07 | Phase 64 | Complete |

**Coverage:**
- v3.0 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after roadmap creation*
