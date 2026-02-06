# Requirements: TradeBlocks

**Defined:** 2026-02-06
**Core Value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows

## v2.8 Requirements

Requirements for Market Data Consolidation milestone. Consolidate 6 PineScripts to 3, unify DuckDB import, enrich daily data with OO-aligned fields.

### PineScript Consolidation

- [ ] **PINE-01**: Daily script computes highlow timing via `request.security_lower_tf()` with 5-min intrabar data
- [ ] **PINE-02**: Daily script exports High_Time, Low_Time, High_Before_Low, reversal metrics (13 highlow fields)
- [ ] **PINE-03**: Daily script exports VIX_Gap_Pct (overnight move — already computed, not plotted)
- [ ] **PINE-04**: Daily script exports VIX9D_Open and VIX9D_Change_Pct (already computed, not plotted)
- [ ] **PINE-05**: Daily script exports VIX_High and VIX_Low (already computed, not plotted)
- [ ] **PINE-06**: Daily script exports VIX3M_Open and VIX3M_Change_Pct (already computed, not plotted)
- [ ] **PINE-07**: Standalone highlow script removed
- [ ] **PINE-08**: 30-min and hourly checkpoint scripts removed
- [ ] **PINE-09**: Scripts README updated with new workflow (fewer scripts, combined CSV)

### DuckDB Schema

- [ ] **SCHEMA-01**: `spx_daily` table includes all 13 highlow columns (High_Time, Low_Time, etc.)
- [ ] **SCHEMA-02**: `spx_daily` table includes new VIX export columns (VIX_Gap_Pct, VIX9D_Open, etc.)
- [ ] **SCHEMA-03**: `spx_highlow` table retired (dropped from schema)
- [ ] **SCHEMA-04**: `describe_database` column descriptions updated for new fields

### Market Data Sync

- [ ] **SYNC-01**: Market sync handles combined daily CSV with highlow + new VIX columns
- [ ] **SYNC-02**: `spx_highlow.csv` file mapping removed from sync
- [ ] **SYNC-03**: Existing `spx_daily.csv` data re-importable after schema change (purge + re-sync)

### Import Consolidation

- [ ] **IMPORT-01**: `analyze_regime_performance` queries DuckDB instead of in-memory CSV
- [ ] **IMPORT-02**: `suggest_filters` queries DuckDB instead of in-memory CSV
- [ ] **IMPORT-03**: `calculate_orb` queries DuckDB instead of in-memory CSV
- [ ] **IMPORT-04**: In-memory CSV loading code removed from market-data.ts
- [ ] **IMPORT-05**: CSV file caching (5-min TTL Map) removed

### Documentation

- [ ] **DOCS-01**: PoC test files cleaned up (scripts/poc test/)
- [ ] **DOCS-02**: CLAUDE.md updated to reflect 3 scripts instead of 6

## Future Requirements

- VVIX and SKEW index data in daily script — deferred, not needed for OO alignment
- Put/call ratio (USI:PCC) — deferred
- DuckDB tables for 30-min/hourly checkpoints — not needed, scripts removed
- Intraday checkpoint computation via `request.security_lower_tf()` on daily chart — potential future optimization

## Out of Scope

| Feature | Reason |
|---------|--------|
| DIX/GEX (SqueezeMetrics) | Proprietary data, not available on TradingView |
| Options greeks data | Options-specific, not derivable from SPX/VIX charts |
| Real-time data feeds | Batch CSV updates sufficient for analysis |
| Web UI changes | This milestone is MCP server + PineScript only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PINE-01 | Phase 51 | Pending |
| PINE-02 | Phase 51 | Pending |
| PINE-03 | Phase 51 | Pending |
| PINE-04 | Phase 51 | Pending |
| PINE-05 | Phase 51 | Pending |
| PINE-06 | Phase 51 | Pending |
| PINE-07 | Phase 51 | Pending |
| PINE-08 | Phase 51 | Pending |
| PINE-09 | Phase 51 | Pending |
| SCHEMA-01 | Phase 52 | Pending |
| SCHEMA-02 | Phase 52 | Pending |
| SCHEMA-03 | Phase 52 | Pending |
| SCHEMA-04 | Phase 52 | Pending |
| SYNC-01 | Phase 52 | Pending |
| SYNC-02 | Phase 52 | Pending |
| SYNC-03 | Phase 52 | Pending |
| IMPORT-01 | Phase 53 | Pending |
| IMPORT-02 | Phase 53 | Pending |
| IMPORT-03 | Phase 53 | Pending |
| IMPORT-04 | Phase 53 | Pending |
| IMPORT-05 | Phase 53 | Pending |
| DOCS-01 | Phase 54 | Pending |
| DOCS-02 | Phase 54 | Pending |

**Coverage:**
- v2.8 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 after roadmap creation*
