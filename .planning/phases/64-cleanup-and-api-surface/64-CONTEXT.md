# Phase 64: Cleanup and API Surface - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove dead sync code, update `run_sql`/`describe_database` for the new normalized schema, simplify Pine Scripts to one universal script, register new tools, and unblock Tier 3 intraday enrichment (ENR-04 pulled into this phase since the Pine Script simplification resolves the format blocker).

</domain>

<decisions>
## Implementation Decisions

### Old Table Name Handling (run_sql)
- Update `AVAILABLE_TABLES` allowlist to new names: `market.daily`, `market.context`, `market.intraday`, `market._sync_metadata`
- Old table names (`market.spx_daily`, `market.spx_15min`, `market.vix_intraday`) simply fail the allowlist check — no special error messaging or auto-rewriting
- Update tool description/help text to reference new table names
- `market._sync_metadata` included in allowlist — users can query import/enrichment state

### Pine Script Simplification
- Reduce from 3 scripts to 1 universal script
- Script exports raw OHLCV of the chart symbol (no derived fields — enrichment pipeline computes those)
- VIX/VIX9D/VIX3M data pulled via `request.security()` for convenience on daily timeframe
- Same script works on any timeframe: daily chart → import to `market.daily`, intraday chart → import to `market.intraday`
- Keep the same TradingView export method (indicator with `display=display.data_window` plots)
- Delete `spx-15min-checkpoints.pine` and `vix-intraday.pine`

### Tier 3 Enrichment (Unblocked)
- ENR-04 pulled into this phase — the Pine Script simplification resolves the intraday CSV format blocker (proper OHLCV rows instead of pivoted checkpoint columns)
- Implement Tier 3 enrichment logic: High_Time, Low_Time, Reversal_Type, Opening_Drive_Strength, Intraday_Realized_Vol
- Remove the hard-skip in `market-enricher.ts` (line ~897) and implement actual computation from `market.intraday` rows

### Dead Code Removal
- **Delete `market-sync.ts`** and all its exports from `sync/index.ts` — entire `_marketdata/` auto-sync system replaced by explicit `import_market_csv`
- **Delete `intraday-timing.ts`** and its `test-exports.ts` entries — checkpoint definitions and wide-format builders no longer needed
- **Delete old integration tests**: `market-sync-multi-ticker.test.ts` and any other tests for deleted sync code
- **Clean all stale references**: update every comment mentioning old table names (`spx_daily`, `spx_15min`, `vix_intraday`) across the codebase
- **Simplify enrich_trades intraday output**: return raw intraday bars from `market.intraday` instead of pivoting back to checkpoint-format columns (P_0930, VIX_1030, etc.)

### describe_database Output
- LAG template and example queries already reference new table names (verified correct)
- Add example queries for `market.intraday` (ORB calculations, time-range filters)
- Add embedded "Import Workflow" section explaining the `import_market_csv` → `enrich_market_data` pipeline
- Keep describe_database focused on schema discovery — enrichment tier status stays in `enrich_market_data` tool

### Claude's Discretion
- Exact columns in the simplified Pine Script (whatever enrichment needs as raw input)
- Format of the embedded import workflow guidance in describe_database
- How to restructure enrich_trades intraday output (raw bar format)
- Whether to conditionally skip VIX `request.security()` calls on non-daily timeframes or let them export na

</decisions>

<specifics>
## Specific Ideas

- User wants one universal Pine Script that works across timeframes — run on daily for daily data, run on 15-min for intraday data, same script
- VIX/VIX9D/VIX3M are not derivable from each other (separate CBOE indices from different option tenors) so keeping `request.security()` in the script is the pragmatic choice for the 90% daily workflow
- Tier 3 unblock is a natural consequence of fixing the intraday data format — not scope creep

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 64-cleanup-and-api-surface*
*Context gathered: 2026-02-22*
