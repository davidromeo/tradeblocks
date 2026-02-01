# Project Research Summary

**Project:** TradeBlocks MCP Server - DuckDB Analytics Layer
**Domain:** SQL analytics engine for trading data hypothesis generation
**Researched:** 2026-02-01
**Confidence:** HIGH

## Executive Summary

The DuckDB Analytics Layer adds SQL query capabilities to the TradeBlocks MCP server, enabling Claude to explore trade data and market conditions through flexible SQL queries rather than rigid hand-crafted tools. This research establishes that the best approach is to use `@duckdb/node-api` (Node Neo) as the database client, implement a two-database architecture (trades.duckdb for all blocks + market.duckdb for shared market data), and sync CSVs to DuckDB on-demand using mtime-based change detection.

The recommended architecture preserves the existing folder-based block portability model where CSVs remain the source of truth and DuckDB databases serve as derived caches. The `run_sql` tool will become the primary interface for exploratory analysis, replacing multiple specialized query tools with one powerful SQL interface. This enables unlimited analytical flexibility for hypothesis generation while avoiding the maintenance burden of building 50+ specialized MCP tools.

Critical risks center on security (SQL injection from AI-generated queries), concurrency (single-writer architecture blocking queries during sync), and data freshness (stale cache detection). Mitigation requires disabling filesystem access in DuckDB, using read-only connections for queries, implementing robust mtime+hash sync validation, and adding resource limits to prevent memory exhaustion.

## Key Findings

### Recommended Stack

Use the **official DuckDB Node Neo client** for all database operations. The legacy `duckdb` package is deprecated and will not receive updates beyond DuckDB 1.5.x (Early 2026). Node Neo provides native Promise support, TypeScript-first design, and platform-specific binary distribution without build-time compilation.

**Core technologies:**
- **`@duckdb/node-api` v1.4.4-r.1**: Official DuckDB client — active development, native async/Promise API, TypeScript-first, no build-time compilation
- **DuckDB Core 1.4.4**: Embedded analytics database — columnar storage, vectorized execution, excellent CSV auto-detection
- **tsup bundler configuration**: Build tooling — must mark DuckDB packages as external (native bindings cannot be bundled)

**Critical bundling consideration:** The MCP server's current `noExternal: [/.*/]` config will NOT work with DuckDB. Native `.node` bindings and platform-specific packages must remain external. Update tsup.config.ts to mark `@duckdb/node-api`, `@duckdb/node-bindings`, and all platform packages as external.

### Expected Features

The SQL analytics layer replaces rigid query tools with flexible SQL exploration.

**Must have (table stakes):**
- `run_sql` tool accepting SQL strings — core capability for Claude to query data
- Schema discovery (list_tables, describe) — Claude needs to know what's queryable
- Trades + market data joins — primary use case for hypothesis generation
- Result pagination (default 100 rows) — prevents context overflow in Claude responses
- Parameterized queries — prevent SQL injection while allowing date ranges, block filters

**Should have (competitive differentiators):**
- Query templates for common patterns — accelerate exploration (VIX regime, gap analysis, correlation discovery)
- Statistical functions (corr, percentile, regression) — built into DuckDB, just document
- Window functions for streak/rolling analysis — DuckDB native, enables time-series patterns
- Cross-block aggregation — UNION across all portfolios for strategy comparisons

**Defer (v2+):**
- Saved query library — premature, Claude remembers context
- Query caching layer — DuckDB is fast enough, premature optimization
- Custom aggregation UDFs — built-in SQL functions sufficient for MVP
- Real-time data feeds — batch CSV updates are sufficient

**Anti-features (tools to deprecate after SQL proves out):**
- `run_filtered_query` — replaced by WHERE clause flexibility
- `aggregate_by_field` — replaced by GROUP BY with CASE expressions
- `get_field_statistics` — replaced by SELECT AVG(), STDDEV()
- `find_predictive_fields` — replaced by correlation queries
- `filter_curve` — replaced by multi-dimensional SQL threshold sweeps

### Architecture Approach

The architecture uses a **two-database model** with lazy synchronization to preserve block portability while enabling cross-block SQL queries. CSVs remain the source of truth; DuckDB databases are derived caches rebuilt from CSVs on demand.

**Major components:**
1. **DuckDBManager** — Database lifecycle, connection pooling, configuration locking. Creates single long-lived connection at startup, exposes read-only connection for queries.
2. **SyncManager** — CSV-to-DuckDB synchronization. Compares filesystem mtimes against cached metadata, performs incremental sync only for changed blocks, handles add/update/delete.
3. **QueryExecutor** — SQL execution with security sandbox. Enforces resource limits, disables filesystem access, validates table names, executes user SQL with read-only connection.
4. **Query Router** — Complexity-based routing. Simple single-block queries use existing CSV logic (graceful degradation); complex/cross-block queries use DuckDB.

**Database structure:**
- `~/backtests/trades.duckdb` — All blocks' trades/daily logs with block_id column for cross-block queries
- `~/backtests/_marketdata/market.duckdb` — Shared market data (daily, intraday, highlow, VIX) attached via ATTACH for joins
- `_sync_metadata` table in each database — Tracks CSV mtime_ms, row_count, synced_at for staleness detection

**Sync strategy:**
- Lazy sync on first analytics query (not eager on startup)
- 1-minute sync check interval to avoid filesystem thrashing
- mtime-based change detection with transaction-based apply
- Delete-then-reimport for updated blocks (simpler than complex diff logic)

### Critical Pitfalls

Top 5 pitfalls that could derail implementation:

1. **SQL Injection from AI-Generated Queries** — Claude generates SQL with user-controlled values (block IDs, dates, strategies) via string concatenation. Mitigation: Disable filesystem access (`SET enable_external_access = false`), disable LocalFileSystem explicitly, lock configuration, use read-only connections, whitelist table names, block COPY/EXPORT/IMPORT/ATTACH statements.

2. **Single-Writer Concurrency Blocking Queries** — DuckDB enforces single-writer semantics. If syncing CSVs (write), Claude's queries (reads) will block or fail. Mitigation: Fast atomic sync operations, read-only connections for queries, separate databases (market.duckdb read-only, trades.duckdb synced), schedule syncs during idle periods, not on every query.

3. **Stale Data from Incomplete Sync Detection** — mtime-based cache invalidation doesn't catch all scenarios (1-second mtime granularity, network filesystem delays, editor touch operations). Mitigation: Use content hashing (MD5/SHA256) in addition to mtime, store hash in metadata, implement file lock checking before sync, add --force-refresh option.

4. **Memory Exhaustion During Large Queries** — DuckDB defaults to 80% of system RAM. Complex analytical queries can consume available memory, crashing Node.js process or triggering OOM killer. Mitigation: Set explicit memory limits (`SET memory_limit = '2GB'`), set temp directory size for disk spilling, limit thread count, enforce query result LIMIT, monitor memory usage.

5. **Deprecated Package Leading to Breaking Changes** — Using legacy `duckdb` npm package which stops receiving updates after DuckDB 1.5.x (Early 2026). Mitigation: Use `@duckdb/node-api` (Node Neo) from the start, reference official docs, check package deprecation notices.

## Implications for Roadmap

Based on research, suggested phase structure that follows dependency order and avoids critical pitfalls:

### Phase 1: Database Layer Foundation
**Rationale:** Must establish secure, properly configured database before any sync or query functionality. Package choice, security configuration, and connection management are foundational decisions that can't be changed later without major rework.

**Delivers:**
- DuckDBManager class with connection lifecycle
- Security configuration (disable filesystem, lock config, set resource limits)
- Database schema creation (trades, daily_logs, reporting_trades, _sync_metadata)
- Graceful shutdown handlers (SIGTERM/SIGINT, checkpoint before exit)
- Corruption recovery on startup (integrity check, rebuild if needed)

**Addresses:**
- Package selection (use @duckdb/node-api, not deprecated duckdb)
- Security sandbox (prevent SQL injection filesystem access)
- Memory limits (prevent OOM crashes)
- Connection pooling (single long-lived connection)

**Avoids:**
- Pitfall 1: Deprecated package
- Pitfall 4: Memory exhaustion
- Pitfall 5: Wrong package choice

### Phase 2: CSV Sync Pipeline
**Rationale:** Sync must be reliable and efficient before exposing SQL queries. The sync algorithm handles all add/update/delete scenarios and maintains data freshness guarantees. Block portability preservation is critical — folders remain source of truth.

**Delivers:**
- SyncManager with mtime-based change detection
- CSV import using DuckDB's read_csv with column mapping
- Incremental sync (add/update/delete blocks)
- Transaction-based sync application (atomic, rollback on error)
- Market data sync from _marketdata/ folder

**Uses:**
- DuckDB's `read_csv` with auto-detection
- ATTACH/DETACH for multi-database queries
- INSERT INTO SELECT pattern for bulk import

**Implements:**
- Two-database architecture (trades.duckdb + market.duckdb)
- Lazy sync on first query, not eager on startup
- Sync metadata table for staleness tracking

**Avoids:**
- Pitfall 2: Concurrency blocking (fast atomic syncs)
- Pitfall 3: Stale data (mtime + row count validation)
- Pitfall 6: Schema evolution (additive schema design)

### Phase 3: run_sql Tool with Security
**Rationale:** Query execution is the user-facing feature but must not ship without complete security sandbox. AI-generated SQL is inherently risky; security cannot be retrofitted.

**Delivers:**
- `run_sql` MCP tool accepting SQL strings
- Security sandbox (read-only connection, disabled filesystem)
- Query result formatting with column metadata
- Result pagination (default 100 rows, configurable)
- Error handling with helpful messages

**Implements:**
- QueryExecutor with security checks
- Table name whitelist validation
- Blocked statement detection (COPY, EXPORT, IMPORT, ATTACH)
- Resource limit enforcement

**Avoids:**
- Pitfall 1: SQL injection (complete security sandbox)
- Pitfall 4: Memory exhaustion (result limits, memory config)

### Phase 4: Schema Discovery and Query Templates
**Rationale:** Claude needs schema knowledge to write useful queries. Query templates accelerate common patterns and serve as examples for Claude to learn from.

**Delivers:**
- `list_tables` functionality (trades, daily_market, intraday, etc.)
- `describe_table` with column names, types, sample data
- Query template library (VIX regime, gap analysis, correlation, threshold discovery)
- Documentation of DuckDB SQL features (window functions, CTEs, QUALIFY)

**Addresses:**
- Table stakes feature: schema discovery
- Differentiator: query templates for hypothesis generation
- Education: examples teach Claude SQL patterns

### Phase 5: Tool Deprecation Analysis
**Rationale:** Don't deprecate existing tools until SQL is proven to work in production. Need data on actual usage patterns to confirm which tools are truly redundant.

**Delivers:**
- Usage tracking for deprecated tools vs run_sql
- Migration guide from old tools to SQL equivalents
- Graceful deprecation warnings (not hard removal)
- Documentation of SQL replacements

**Addresses:**
- Anti-features: replace rigid tools with flexible SQL
- Maintenance burden reduction

### Phase Ordering Rationale

- **Phase 1 before 2:** Security config and connection management must be established before sync logic. Wrong package choice would require full rewrite.
- **Phase 2 before 3:** Data must be synced and fresh before exposing query interface. Sync determines architecture (single/two databases, metadata schema).
- **Phase 3 before 4:** Core query execution must work before adding discovery and templates. Security sandbox cannot be added after public launch.
- **Phase 4 before 5:** Claude needs schema knowledge and templates to use SQL effectively. Tool deprecation only makes sense after SQL proves valuable.
- **Phase 5 last:** Don't remove existing functionality until new approach is proven in production with real usage data.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2:** CSV sync pipeline — Need to decide on content hashing strategy (MD5 vs SHA256 vs row count), investigate DuckDB's COPY vs INSERT performance, determine optimal batch size for large CSVs
- **Phase 3:** Security sandbox — Need to validate DuckDB security settings actually prevent filesystem access, test SQL injection attack vectors, confirm read-only connection enforcement

Phases with standard patterns (skip research-phase):

- **Phase 1:** Database initialization — Well-documented DuckDB setup, standard connection pooling patterns
- **Phase 4:** Schema discovery — Straightforward SQL metadata queries, template creation is design work not research
- **Phase 5:** Tool deprecation — Code audit and refactoring, not research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official npm registry verification, DuckDB docs confirm Node Neo recommendation, package deprecation timeline explicit |
| Features | HIGH | SQL feature set well-documented, query patterns tested in DuckDB, FEATURES.md based on real Option Omega use cases |
| Architecture | HIGH | Two-database pattern proven in DuckDB multi-database docs, sync algorithm tested at scale in similar systems |
| Pitfalls | HIGH | All pitfalls sourced from official DuckDB docs, GitHub issues, and security advisory bulletins |

**Overall confidence:** HIGH

### Gaps to Address

Minor gaps that need validation during implementation:

- **CSV column mapping edge cases:** FEATURES.md notes that TradeBlocks CSVs have inconsistent column names (e.g., "Opening Commissions + Fees" vs "Opening comms & fees"). Phase 2 planning should catalog all column name variations and build robust COALESCE logic.

- **Timezone handling consistency:** ARCHITECTURE.md mentions Eastern Time handling but doesn't specify DuckDB timezone configuration. Phase 2 should verify that storing dates as strings (YYYY-MM-DD) vs DATE type preserves Eastern Time semantics to match existing UI behavior.

- **Query result size edge cases:** FEATURES.md specifies 100-row default pagination, but doesn't address what happens when a query returns 10K+ rows. Phase 3 should add hard limits (e.g., 1000 rows max) and truncation warnings.

- **Bundle size impact:** STACK.md confirms DuckDB packages must be external, but doesn't quantify bundle size increase for MCP server. Phase 1 should measure actual npm package size impact for distribution.

## Sources

### Primary (HIGH confidence)
- [npm: @duckdb/node-api v1.4.4-r.1](https://www.npmjs.com/package/@duckdb/node-api) — Current version verified 2026-02-01
- [DuckDB Node Neo Documentation](https://duckdb.org/docs/stable/clients/node_neo/overview) — Official API docs
- [DuckDB Concurrency Model](https://duckdb.org/docs/stable/connect/concurrency) — Single-writer architecture
- [Securing DuckDB](https://duckdb.org/docs/stable/operations_manual/securing_duckdb/overview) — Security settings
- [DuckDB Memory Management](https://duckdb.org/2024/07/09/memory-management) — Resource limits
- [DuckDB CSV Auto Detection](https://duckdb.org/docs/stable/data/csv/auto_detection) — CSV parsing capabilities
- [DuckDB Multi-Database Support](https://duckdb.org/2024/01/26/multi-database-support-in-duckdb) — ATTACH pattern

### Secondary (MEDIUM confidence)
- [DuckDB Window Functions (MotherDuck)](https://motherduck.com/blog/motherduck-window-functions-in-sql/) — Query pattern examples
- [DuckDB Time Series Analysis](https://medium.com/@Quaxel/time-series-crunching-with-duckdb-without-losing-your-mind-fd129ba7173f) — Window function patterns
- [SQL for Trading (LuxAlgo)](https://www.luxalgo.com/blog/sql-for-trading-unlock-financial-data/) — Domain-specific query patterns

### Tertiary (LOW confidence)
- [DuckDB OLAP Caching Patterns (MotherDuck)](https://motherduck.com/blog/duckdb-olap-caching/) — Sync optimization ideas
- [Technical Indicators in BigQuery/SQL](https://medium.com/google-cloud/how-to-calculate-technical-indicators-in-bigquery-using-sql-moving-averages-rsi-macd-b58b16e4f52e) — Statistical function examples

### Security Advisory (CRITICAL)
- [GitHub: duckdb-node Security Advisory GHSA-w62p-hx95-gf2c](https://github.com/duckdb/duckdb-node/security/advisories/GHSA-w62p-hx95-gf2c) — npm package compromise incident (versions 1.3.3, 1.29.2) validates need for official @duckdb/node-api package

---
*Research completed: 2026-02-01*
*Ready for roadmap: yes*
