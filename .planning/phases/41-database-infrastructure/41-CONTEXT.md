# Phase 41: Database Infrastructure - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish DuckDB foundation for all subsequent SQL features. This phase creates the database files, connection management, and basic configuration. Sync logic, query interface, and schema discovery are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Database layout
- Single file: `analytics.duckdb` in `TRADEBLOCKS_DATA_DIR`
- Two schemas: `trades` schema for block data, `market` schema for market data
- Simpler JOINs — no ATTACH/DETACH needed for cross-schema queries
- Corruption handling: Fail with clear error message telling user to delete file manually (no auto-rebuild)

### Connection lifecycle
- Initialization: Lazy — don't open DB until first query needs it
- Connection style: Persistent — keep connection open until server exits
- DuckDB is embedded and thread-safe for reads, so persistent is the standard pattern

### Security boundaries
- Protection level: Minimal guardrails — trust Claude, no SQL filtering
- Disable `enable_external_access` — prevents DuckDB from fetching remote URLs (keeps behavior predictable, not security)
- Row limits to prevent context overflow
- Memory caps to prevent resource exhaustion

### Resource limits
- Configuration: Environment variables (`DUCKDB_MEMORY_LIMIT`, `DUCKDB_THREADS`)
- Default memory limit: Claude's discretion based on typical trade data sizes
- Default thread limit: Claude's discretion
- Runaway queries: Claude's discretion based on DuckDB capabilities

### Claude's Discretion
- Shutdown handling approach
- Connection error handling (retry logic, error messages)
- Row limit behavior (truncate with note vs error with hint)
- Default memory and thread limits
- Query timeout/OOM handling strategy

</decisions>

<specifics>
## Specific Ideas

- "This is all internal and local to somebody's computer" — security is about preventing accidents, not protecting against attacks
- Keep it simple — minimal guardrails since Claude is the one writing the SQL

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 41-database-infrastructure*
*Context gathered: 2026-02-01*
