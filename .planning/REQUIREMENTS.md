# Requirements: TradeBlocks v2.6

**Defined:** 2026-02-01
**Core Value:** Enable Claude to write arbitrary SQL against trades and market data for hypothesis generation

## v2.6 Requirements

### Database Infrastructure

- [ ] **DB-01**: MCP server integrates `@duckdb/node-api` package
- [ ] **DB-02**: DuckDB connection manager handles init, shutdown, and errors gracefully
- [ ] **DB-03**: `trades.duckdb` stores all block trades with `block_id` column
- [ ] **DB-04**: `market.duckdb` stores market data (spx_daily, vix, extensible)
- [ ] **DB-05**: Security sandbox configured (disable filesystem access, read-only for queries)
- [ ] **DB-06**: Resource limits set (memory, threads appropriate for MCP server)

### Sync Layer

- [ ] **SYNC-01**: `_sync_metadata` table tracks block_id, csv_mtime, synced_at
- [ ] **SYNC-02**: Sync detects new blocks (folder exists, not in metadata)
- [ ] **SYNC-03**: Sync detects changed blocks (csv_mtime > synced_at)
- [ ] **SYNC-04**: Sync detects deleted blocks (in metadata, folder missing)
- [ ] **SYNC-05**: Sync operations are transaction-safe (no partial state)
- [ ] **SYNC-06**: Sync is lazy (triggered on query, not on server startup)
- [ ] **SYNC-07**: Market data syncs from `_marketdata/` folder

### Query Interface

- [ ] **SQL-01**: `run_sql` MCP tool accepts SQL query string
- [ ] **SQL-02**: Queries can JOIN trades with market data tables
- [ ] **SQL-03**: Queries can filter by block_id or query across all blocks
- [ ] **SQL-04**: Results are limited to prevent excessive output (configurable limit)
- [ ] **SQL-05**: SQL errors return helpful messages (not stack traces)
- [ ] **SQL-06**: Dangerous SQL patterns blocked (COPY, EXPORT, ATTACH, etc.)

### Schema Discovery

- [ ] **SCHEMA-01**: `list_tables` tool/resource shows available tables and columns
- [ ] **SCHEMA-02**: `get_schema` provides column names, types for a table
- [ ] **SCHEMA-03**: Example queries documented for common hypothesis patterns

### Tool Rationalization

- [ ] **DEPR-01**: Analysis of which tools `run_sql` can replace
- [ ] **DEPR-02**: Deprecation plan documented (which tools, timeline)
- [ ] **DEPR-03**: At least one tool deprecated or marked for deprecation

## Future Requirements (v2.7+)

### Extended Market Data
- **MARKET-01**: DIX/GEX data integration
- **MARKET-02**: Additional index support (NDX, RUT)
- **MARKET-03**: Custom market data import tool

### Advanced Query Features
- **ADV-01**: Query result streaming for large datasets
- **ADV-02**: Query caching for repeated patterns
- **ADV-03**: Query performance metrics

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web UI SQL interface | MCP server only; web app remains client-side |
| Real-time sync | Lazy sync sufficient; no file watchers |
| Full tool deprecation | v2.6 analyzes; actual removal in future versions |
| DuckDB extensions | Core functionality sufficient; extensions add complexity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 41 | Pending |
| DB-02 | Phase 41 | Pending |
| DB-03 | Phase 41 | Pending |
| DB-04 | Phase 41 | Pending |
| DB-05 | Phase 41 | Pending |
| DB-06 | Phase 41 | Pending |
| SYNC-01 | Phase 42 | Pending |
| SYNC-02 | Phase 42 | Pending |
| SYNC-03 | Phase 42 | Pending |
| SYNC-04 | Phase 42 | Pending |
| SYNC-05 | Phase 42 | Pending |
| SYNC-06 | Phase 42 | Pending |
| SYNC-07 | Phase 42 | Pending |
| SQL-01 | Phase 43 | Pending |
| SQL-02 | Phase 43 | Pending |
| SQL-03 | Phase 43 | Pending |
| SQL-04 | Phase 43 | Pending |
| SQL-05 | Phase 43 | Pending |
| SQL-06 | Phase 43 | Pending |
| SCHEMA-01 | Phase 44 | Pending |
| SCHEMA-02 | Phase 44 | Pending |
| SCHEMA-03 | Phase 44 | Pending |
| DEPR-01 | Phase 45 | Pending |
| DEPR-02 | Phase 45 | Pending |
| DEPR-03 | Phase 45 | Pending |

**Coverage:**
- v2.6 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-01 after initial definition*
