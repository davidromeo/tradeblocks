# State: TradeBlocks

## Current Position

Phase: 64 of 64 (Cleanup and API Surface)
Plan: 2 of 3 complete
Status: In progress
Last activity: 2026-02-23 — Completed 64-02 (Universal Pine Script + intraday Unix timestamp importer)

Progress: [█████████░] 85%

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Accurate, trustworthy portfolio analytics
**Current focus:** v3.0 Market Data Separation — Phase 63 complete, Phase 64 in progress

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
| 63 | 3/3 | ~12 min | 4 min |
| 64 (so far) | 2/3 | 6 min | 3 min |

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
- [Phase 63-01]: Prior_Range_vs_ATR added to market.daily schema (was a documented Phase 62 gap) — timing: 'open' (prior day's range/ATR known at market open)
- [Phase 63-01]: buildLookaheadFreeQuery string[] overload: ticker appended as last param ($N+1) so date placeholder numbering is not shifted
- [Phase 63-01]: Tier 3 columns (High_Time, Low_Time, High_Before_Low, Reversal_Type) included in schema-metadata.daily because columns exist in market.daily CREATE TABLE even though enrichment is deferred
- [Phase 63-01]: New field counts: 9 open / 36 close / 3 static = 48 total (was 8/44/3/55 — reduction due to Tier 3 intraday timing columns removed from new schema)
- [Phase 63-02]: Prior_Range_vs_ATR computed as (high[i-1] - low[i-1]) / ATR[i-1] — open-known field, first bar null (no prior day)
- [Phase 63-02]: Intraday queries updated to market.intraday with CASE-WHEN pivot for checkpoint columns — graceful degradation until import blocker resolved
- [Phase 63-02]: Composite filter improvement threshold: compositeWinRate > max(filterA_projected, filterB_projected) + 2pp
- [Phase 63-02]: Pre-existing TS error (profitFactor possibly null in analyze_regime_performance) fixed as Rule 1 deviation
- [Phase 63-03]: hhmmToSqlTime() converts HHMM '0930' to '09:30' before SQL — defined locally in registerMarketDataTools
- [Phase 63-03]: calculate_orb SQL CTE pattern: orb_range aggregates window bars, breakout_events finds first post-window bar exceeding range
- [Phase 63-03]: entry_triggered boolean computed in TypeScript as breakoutCondition !== 'NoBreakout' (not in SQL)
- [Phase 63-03]: useHighLow toggle uses SQL template interpolation (not parameter) — column expressions cannot be parameterized
- [Phase 63-03]: barResolution auto-detection: time gap between first two bars on first available date (informational only)
- [Phase 64-02]: parseFlexibleTime handles three formats: Unix timestamp (seconds) → HH:MM ET via toLocaleTimeString, HH:MM passthrough, HHMM 4-digit → HH:MM
- [Phase 64-02]: intraday validation relaxed — 'time' not required in column mapping when 'date' is mapped; auto-extraction from Unix timestamp provides it
- [Phase 64-02]: Universal Pine Script exports 10 plots (open, high, low, close + 6 VIX fields); enrichment pipeline computes all derived fields after import
- [Phase 64-02]: spx-15min-checkpoints.pine and vix-intraday.pine deleted (CLN-06) — checkpoint pivot approach superseded by raw market.intraday schema
- [Phase 64-01]: enrich_trades intradayBars uses raw bar arrays (not checkpoint pivot) — callers filter by time themselves; simpler and more flexible
- [Phase 64-01]: computeIntradayTimingFields stub added to market-enricher.ts for Plan 64-03 — avoids test-exports.ts parallel edit conflict
- [Phase 64-01]: McpServer version bumped to 1.5.0 (synced with package.json); run_sql AVAILABLE_TABLES updated to normalized schema names

### Pending Todos

None.

### Blockers/Concerns

- `field-timing.ts` unit tests assert specific column counts (8/44/3) — must update in lockstep during Phase 63.
- Pre-existing TypeScript error in `packages/mcp-server/src/tools/market-data.ts:482` — out of scope for v3.0 but should be addressed.
- [RESOLVED 64-02] **Intraday CSV format incompatible with market.intraday** — resolved: market-importer now auto-extracts HH:MM ET from Unix timestamps when mapping a single `time` column to `date` for intraday imports. Users can import TradingView intraday CSVs without a separate time column in the mapping.

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 64-01-PLAN.md (dead code removal + API surface cleanup: intraday-timing.ts and market-sync.ts deleted; run_sql and describe_database updated to normalized schema; McpServer v1.5.0)
Resume file: None
