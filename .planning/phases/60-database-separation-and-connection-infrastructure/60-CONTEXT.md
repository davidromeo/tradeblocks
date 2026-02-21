# Phase 60: Database Separation and Connection Infrastructure - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a separate `market.duckdb` file with four normalized tables (`market.daily`, `market.context`, `market.intraday`, `market._sync_metadata`), ATTACH it alongside the existing `analytics.duckdb` at MCP server startup, and handle the full connection lifecycle (DETACH on close, re-ATTACH on read-write mode changes). Old market tables in `analytics.duckdb` are removed as part of this phase.

</domain>

<decisions>
## Implementation Decisions

### Old data transition
- Drop old `market` schema entirely from `analytics.duckdb` using `DROP SCHEMA IF EXISTS market CASCADE` — clean break, no table-by-table removal
- This includes `market.spx_daily`, `market.spx_15min`, `market.vix_intraday`, and `market._sync_metadata`
- Drop silently on startup — debug-level log only, no prominent warnings
- Drop order: drop old market schema from analytics.duckdb FIRST, then ATTACH new market.duckdb. Prevents DuckDB #14421 naming conflicts during ATTACH.
- No migration tool — users re-import their source CSVs via `import_csv` (Phase 61)

### Startup resilience
- market.duckdb follows the same RO/RW upgrade/downgrade lifecycle pattern as analytics.duckdb (DETACH and re-ATTACH when switching modes)
- Claude's discretion on: degraded mode vs fail-on-ATTACH-error, corruption auto-recovery, and whether market/analytics modes must stay in sync or can be independent

### Market DB configuration
- `MARKET_DB_PATH` configurable via env var or CLI argument, defaulting to `<baseDir>/market.duckdb`
- Auto-create intermediate directories (mkdirp) if the configured path's parent directory doesn't exist
- Claude's discretion on: config priority order (CLI vs env var) and startup path logging level

### Schema bootstrapping
- Full lifecycle integration tests required: create market.duckdb, ATTACH, query tables, DETACH, re-ATTACH, old table cleanup
- Claude's discretion on: whether to create all four tables upfront or incrementally, whether to include all ~35 columns on market.daily upfront or just raw OHLCV, and table creation idempotency pattern

### Claude's Discretion
- Startup behavior when ATTACH fails (degraded mode vs hard fail)
- Corruption recovery approach (auto-recreate vs error-and-stop)
- Whether market.duckdb and analytics.duckdb modes must always match or can be independent
- Config precedence order (CLI > env > default vs other)
- Startup log level for market DB path
- Table/column creation strategy (all upfront vs incremental per phase)
- CREATE TABLE IF NOT EXISTS vs other idempotency patterns

</decisions>

<specifics>
## Specific Ideas

- Current architecture: single `analytics.duckdb` file with both `trades.*` and `market.*` schemas. Connection is a lazy singleton with RO/RW mode management, lock recovery, and exponential backoff.
- The existing `schemas.ts` creates tables with `CREATE TABLE IF NOT EXISTS` — this pattern works well and should carry forward.
- Market tables currently created in `sync/market-sync.ts`, not in `schemas.ts` — the new market schema creation should be part of the core schema setup, not sync code.
- DuckDB #14421: having tables with the same schema name in both the main DB and an ATTACHed DB causes corruption. Dropping the old schema first eliminates this risk entirely.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 60-database-separation-and-connection-infrastructure*
*Context gathered: 2026-02-21*
