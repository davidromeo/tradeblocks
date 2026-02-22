# State: TradeBlocks

## Current Position

Phase: 62 of 64 (TypeScript Enrichment Pipeline)
Plan: 3 of 3 complete
Status: Phase complete
Last activity: 2026-02-22 — Completed 62-03 (enrich_market_data MCP tool registered, version 1.4.0)

Progress: [██████░░░░] 45%

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Accurate, trustworthy portfolio analytics
**Current focus:** v3.0 Market Data Separation — Phase 62 complete, Phase 63 next

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (v3.0)
- Average duration: 4 min
- Total execution time: 20 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 60 | 2/2 | 8 min | 4 min |
| 61 | 3/3 | 8 min | 3 min |
| 62 | 3/3 | 12 min | 4 min |

## Accumulated Context

### Decisions

(Cleared at milestone boundary — see PROJECT.md Key Decisions for persistent decisions)

- Research confirmed: zero new npm dependencies needed for v3.0
- Research confirmed: custom TS indicator functions over library (TradingView parity control)
- Hard fail on ATTACH error for market.duckdb (market access required for v3.0 operation)
- Auto-recreate market.duckdb on corruption (market data re-importable from source CSVs)
- resolveMarketDbPath precedence: CLI --market-db > MARKET_DB_PATH env > <dataDir>/market.duckdb
- All four market table columns created upfront — no ALTER TABLE in later phases
- tableExists() exported from schemas.ts for use in later migration phases
- [REVISED Phase 61-03]: SET enable_external_access=false REMOVED from connection.ts — confirmed to block ALL ATTACH including local files, breaking importFromDatabase; enable_external_access:true at instance creation is sufficient security boundary
- enable_external_access: instance-level "true" allows all local ATTACH; SET false is NOT used (breaks local ATTACH, not just HTTP)
- syncMarketData() deprecated with @deprecated JSDoc — will be removed in Phase 64
- withFullSync calls syncAllBlocks only (DB-09 enforced) — market writes not wrapped in analytics.duckdb transactions
- [Phase 60]: enable_external_access starts true then locked via SET after ATTACH — allows local file ATTACH while blocking HTTP
- [Phase 60]: withFullSync calls syncAllBlocks only (DB-09 enforced) — market writes not wrapped in analytics.duckdb transactions
- [Phase 61-01]: column mapping direction { sourceCol: schemaCol } — single object works for CSV headers and query result columns
- [Phase 61-01]: applyColumnMapping skips unparseable date rows (warning) rather than throwing — allows partial imports of messy CSVs
- [Phase 61-01]: triggerEnrichment is a pure stub (no side effects) — Phase 62 replaces it with real implementation
- [Phase 61-02]: Tool names import_market_csv and import_from_database (import_csv taken by block importer in imports.ts)
- [Phase 61-02]: downgradeToReadOnly placed in finally block — cleanup guaranteed even on import errors
- [Phase 61-02]: MCP server version bumped to 1.3.0 (minor bump for two new tools)
- [Phase 61-03]: DuckDB API: columnNames() returns string[] of column names; getColumns() returns column data arrays (not descriptors)
- [Phase 61-03]: importFromDatabase works end-to-end after removing SET enable_external_access=false and fixing columnNames() API call
- [Phase 62]: RSI seeds from SMA of first period changes (bars 1..period) then Wilder smoothing — confirmed correct Wilder initialization
- [Phase 62]: computeRealizedVol first valid index at i=period (window [i-period+1..i] of log returns starting at index 1)
- [Phase 62]: classifyTermStructure flatness: both VIX9D/VIX and VIX/VIX3M ratios within 1% of 1.0
- [Phase 62-02]: triggerEnrichment no longer returns 'pending' — wired to runEnrichment(); returns 'complete'/'skipped'/'error'
- [Phase 62-02]: Only daily table imports trigger enrichment; context/intraday imports skip (source data not enrichment targets)
- [Phase 62-02]: Schema gaps silently skipped: Prior_Range_vs_ATR, Opening_Drive_Strength, Intraday_Realized_Vol absent from market.daily
- [Phase 62-02]: wilder_state column NOT written — 200-day lookback approach supersedes it per CONTEXT.md decision
- [Phase 62-02]: enrichment watermark pattern: source='enrichment', ticker, target_table='daily' in market._sync_metadata
- [Phase 62-03]: enrich_market_data follows same RW lifecycle as import tools (upgradeToReadWrite before, downgradeToReadOnly in finally)
- [Phase 62-03]: MCP server version bumped to 1.4.0 (minor bump for new enrich_market_data tool)

### Pending Todos

None.

### Blockers/Concerns

- `field-timing.ts` unit tests assert specific column counts (8/44/3) — must update in lockstep during Phase 63.
- Pre-existing TypeScript error in `packages/mcp-server/src/tools/market-data.ts:482` — out of scope for v3.0 but should be addressed.
- **[Phase 63 prerequisite] Intraday CSV format incompatible with market.intraday**: The existing 15min/VIX intraday CSVs (`spx_15min.csv`, `msft_15min.csv`, `vix_intraday.csv`) use a single Unix timestamp `time` column encoding both date and time. `market.intraday` requires separate `date` (YYYY-MM-DD) and `time` (HH:MM) columns for its `(ticker, date, time)` PK. Column mapping cannot split one source column into two. Tier 3 enrichment (Phase 62) and `calculate_orb` migration (Phase 63) both depend on `market.intraday` being populated — the Pine Script export format must be updated to emit separate date/time columns before intraday data can be imported.

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 62-03-PLAN.md (enrich_market_data MCP tool registered, version bumped to 1.4.0, Phase 62 complete)
Resume file: None
