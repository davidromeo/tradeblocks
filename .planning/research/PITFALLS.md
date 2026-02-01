# Domain Pitfalls: DuckDB Analytics Layer for Node.js MCP Server

**Domain:** DuckDB integration with Node.js + file-based data synchronization + AI-generated SQL
**Researched:** 2026-02-01
**Confidence:** HIGH (verified via official DuckDB documentation and GitHub issues)

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or security vulnerabilities.

---

### Pitfall 1: Deprecated duckdb Package Leading to Breaking Changes

**What goes wrong:** Using the original `duckdb` npm package which is deprecated. The old package will stop receiving updates after DuckDB 1.4.x (Fall 2025) and won't support DuckDB 1.5.x (Early 2026).

**Why it happens:** The original `duckdb` package appears first in npm searches and has more downloads due to historical usage. Many tutorials and Stack Overflow answers reference the old API.

**Consequences:**
- Code breaks when DuckDB core updates beyond 1.4.x
- Missing Promise-native support requires additional `duckdb-async` wrapper
- SQLite-style callback API doesn't match DuckDB's actual capabilities
- No access to new DuckDB features

**Prevention:**
- Use `@duckdb/node-api` (the "Node Neo" package) from the start
- Reference: [DuckDB Node.js Client (Neo)](https://duckdb.org/docs/stable/clients/node_neo/overview)
- Check package dates and deprecation notices before adopting

**Detection:** Seeing `new Database(...)` constructor patterns instead of `Database.create(...)`. Using callback-based APIs instead of Promises.

**Phase to address:** Phase 1 (Database Layer Foundation) - choose correct package upfront

---

### Pitfall 2: Single-Writer Architecture Blocking MCP Requests

**What goes wrong:** DuckDB enforces single-writer semantics. If the MCP server is syncing CSV data to DuckDB (write operation), all incoming SQL queries from Claude will block or fail until the sync completes.

**Why it happens:** DuckDB prioritizes analytical performance and ACID compliance over concurrent write support. File-level locking prevents multiple writers.

**Consequences:**
- Claude's queries timeout during CSV sync operations
- MCP server appears unresponsive
- Race conditions between query tool and sync process
- Potential for `SQLITE_BUSY`-style errors

**Prevention:**
- Design sync operations to be fast and atomic (batch inserts, not row-by-row)
- Use read-only connections for queries: `access_mode = 'READ_ONLY'`
- Implement query queuing with sync coordination
- Consider separate database files (market.duckdb for reads, trades.duckdb for sync)
- Schedule syncs during idle periods, not on every query

**Detection:** Queries returning timeout errors. `Transaction conflict` errors in logs. Long query latencies that correlate with file modification times.

**Phase to address:** Phase 1 (Database Layer Foundation) - architect connection management from the start

**Source:** [DuckDB Concurrency Documentation](https://duckdb.org/docs/stable/connect/concurrency)

---

### Pitfall 3: SQL Injection from AI-Generated Queries

**What goes wrong:** Claude generates SQL queries that include user-controlled values (block IDs, strategy names, date ranges) via string concatenation instead of parameterized queries. A malicious user could craft inputs that execute arbitrary SQL.

**Why it happens:** LLMs naturally generate SQL by embedding values directly into query strings. The `run_sql` tool receives complete SQL strings, making parameterization difficult to enforce after the fact.

**Consequences:**
- File system access via `read_csv('/etc/passwd')` or `COPY ... TO '/tmp/exfiltrate.csv'`
- Data exfiltration or corruption
- Denial of service via resource-intensive queries
- Extension loading to expand attack surface

**Prevention:**
1. **Disable filesystem access:** `SET enable_external_access = false`
2. **Disable local filesystem specifically:** `SET disabled_filesystems = 'LocalFileSystem'`
3. **Lock configuration:** `SET lock_configuration = true` (prevents runtime changes)
4. **Use read-only connections** for the query tool
5. **Restrict extensions:** `SET autoload_known_extensions = false; SET allow_community_extensions = false`
6. **Resource limits:** `SET threads = 4; SET memory_limit = '2GB'; SET max_temp_directory_size = '1GB'`
7. **Whitelist table names** - validate SQL references only known tables before execution

**Detection:** Queries containing file paths. Queries referencing extensions. Queries with `COPY`, `EXPORT`, `IMPORT`, or `ATTACH` statements. Unusual query patterns.

**Phase to address:** Phase 3 (run_sql Tool) - implement security sandbox before exposing SQL execution

**Source:** [Securing DuckDB](https://duckdb.org/docs/stable/operations_manual/securing_duckdb/overview)

---

### Pitfall 4: Stale Data Due to Incomplete Sync Detection

**What goes wrong:** The mtime-based cache invalidation used for CSV files doesn't account for all scenarios. Files edited but not saved, partial writes, or network filesystem delays can cause the database to be out of sync with source CSVs.

**Why it happens:** File modification time (mtime) is checked, but:
- mtime granularity varies by filesystem (some only have 1-second precision)
- Network filesystems may have delayed mtime propagation
- Editor "touch" operations can update mtime without content changes
- Files being actively written have incomplete content

**Consequences:**
- Queries return stale data
- Claude's analysis based on outdated information
- User confusion when UI shows different data than SQL queries
- Silent data inconsistencies

**Prevention:**
- Use file content hashing (MD5/SHA256 of file) in addition to mtime
- Store hash in metadata alongside mtime
- Implement file lock checking before sync (ensure no active writes)
- Add `--force-refresh` option to manually trigger full sync
- Include data freshness timestamp in query results

**Detection:** Comparison between CSV row counts and DuckDB table counts. Hash mismatches. Queries returning different results than equivalent in-memory calculations.

**Phase to address:** Phase 2 (CSV Sync Pipeline) - build robust change detection

---

### Pitfall 5: Memory Exhaustion During Large Query Operations

**What goes wrong:** DuckDB defaults to using 80% of system RAM. Complex analytical queries (JOINs, window functions, large GROUP BYs) can consume available memory, causing the Node.js process to crash or the system to become unresponsive.

**Why it happens:** DuckDB is optimized for analytical workloads and aggressively uses memory for performance. The MCP server runs as a background process where memory usage isn't immediately visible.

**Consequences:**
- Node.js process killed by OOM killer
- MCP connection dropped, losing context
- System-wide performance degradation
- Potential data corruption if killed mid-write

**Prevention:**
- Set explicit memory limits: `SET memory_limit = '2GB'` (reasonable for MCP)
- Set temp directory size: `SET max_temp_directory_size = '4GB'` (for disk spilling)
- Limit thread count: `SET threads = 4` (reduces parallel memory consumption)
- Add query result limits: Always include `LIMIT` in user-facing queries
- Monitor memory in long-running process

**Detection:** Node.js process restarts. System memory pressure alerts. Query timeouts due to disk spilling.

**Phase to address:** Phase 1 (Database Layer Foundation) - configure resource limits at initialization

**Source:** [DuckDB Memory Management](https://duckdb.org/2024/07/09/memory-management)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded user experience.

---

### Pitfall 6: Schema Evolution Breaking Sync Pipeline

**What goes wrong:** Market data CSV sources add new columns (e.g., TradingView adds a new indicator). The existing DuckDB schema doesn't have these columns, causing sync failures or silent data loss.

**Why it happens:** DuckDB's ALTER TABLE support is limited compared to PostgreSQL. You can add/drop columns but cannot change data types or add constraints easily. CSV schema detection may succeed but table insert fails.

**Consequences:**
- Sync process fails entirely on schema mismatch
- New data fields silently dropped
- Manual intervention required to update schema
- Potential need to rebuild database from scratch

**Prevention:**
- Design schema to be additive (add columns, never remove or change types)
- Use DuckDB's `sniff_csv()` function to detect schema before sync
- Implement schema comparison: current CSV headers vs existing table columns
- Auto-generate ALTER TABLE ADD COLUMN statements for new fields
- Store CSV schema version in metadata for change tracking
- Support "drop and recreate" mode for major schema changes

**Detection:** Sync errors referencing column mismatches. CSV files with more columns than database tables. Null values in columns that should have data.

**Phase to address:** Phase 2 (CSV Sync Pipeline) - build schema evolution handling

**Source:** [DuckDB ALTER TABLE](https://www.getorchestra.io/guides/duckdb-sqlconcepts-alter-table)

---

### Pitfall 7: Database File Corruption from Improper Shutdown

**What goes wrong:** The MCP server is killed (SIGKILL, system crash, Docker stop timeout) while DuckDB has uncommitted transactions or is mid-write. The database file may be corrupted or left in an inconsistent state.

**Why it happens:** DuckDB uses write-ahead logging (WAL) for durability, but abrupt termination during checkpoint or WAL replay can leave files in an invalid state. Node.js process managers may not wait for cleanup.

**Consequences:**
- Database fails to open on next startup
- Complete data loss requiring rebuild from CSVs
- Partial data loss (recent changes missing)
- "Database file is corrupt" errors

**Prevention:**
- Implement graceful shutdown handler (SIGTERM, SIGINT)
- Close database connection explicitly before process exit
- Use `CHECKPOINT` command before shutdown to flush WAL
- Store database in a location with journaling filesystem
- Regular backups (or rely on CSVs as source of truth)
- Add startup integrity check: `PRAGMA integrity_check`

**Detection:** Startup failures with corruption messages. Unexpected data loss between sessions. WAL files accumulating without checkpoints.

**Phase to address:** Phase 1 (Database Layer Foundation) - implement lifecycle management

---

### Pitfall 8: Query Performance Cliff with Cross-Block Analysis

**What goes wrong:** The `run_sql` tool allows queries that JOIN across many blocks or scan all historical data. These queries run fast in development (few blocks) but timeout in production (hundreds of blocks, years of data).

**Why it happens:** DuckDB can scan files extremely fast, creating a false sense of unlimited scalability. Without indexes or partitioning, full table scans are the default. Development datasets don't represent production scale.

**Consequences:**
- Production queries timeout
- Claude gets partial or no results
- User experience degrades over time as data grows
- Memory exhaustion on large scans

**Prevention:**
- Partition data by time period (one table per year, or use date as partition key)
- Add sensible defaults: query only recent N months unless specified
- Implement query cost estimation before execution
- Add `LIMIT` guardrails (e.g., max 10000 rows returned)
- Index frequently filtered columns (block_id, strategy, date)
- Test with production-scale data volumes

**Detection:** Query execution time increasing over months. Memory spikes during certain query patterns. Timeout errors on queries that previously worked.

**Phase to address:** Phase 2 (CSV Sync Pipeline) - design for scale from the start

---

### Pitfall 9: Connection Pool Mismanagement

**What goes wrong:** Creating new database connections for each query instead of reusing connections. Or holding connections open indefinitely without cleanup.

**Why it happens:** The MCP request/response model doesn't naturally map to connection pooling. Each tool invocation feels like it should have its own connection. Node.js async patterns make it easy to leak connections.

**Consequences:**
- Performance overhead from connection creation (DuckDB loads metadata on connect)
- File handles exhausted
- Memory leaks from unclosed connections
- Lost cached metadata between queries

**Prevention:**
- Create single connection at MCP server startup
- Reuse connection across all tool invocations
- Implement connection health checking
- Add cleanup on server shutdown
- Consider connection wrapper class with automatic recovery

**Detection:** Increasing memory usage over time. "Too many open files" errors. Slow first query after idle period.

**Phase to address:** Phase 1 (Database Layer Foundation) - design connection lifecycle

**Source:** [DuckDB Performance Guide](https://duckdb.org/docs/stable/guides/performance/overview)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without major rework.

---

### Pitfall 10: Timezone Mismatches Between CSVs and SQL

**What goes wrong:** Trading data is in Eastern Time, but DuckDB defaults to UTC. SQL queries return different dates than the UI shows.

**Why it happens:** DuckDB parses date strings without timezone and stores them as-is. The existing codebase carefully preserves Eastern Time semantics (as documented in CLAUDE.md), but SQL queries may not apply the same care.

**Consequences:**
- Trades appear on wrong dates in SQL results
- JOIN failures when matching trades to market data by date
- Confusion when comparing SQL output to UI
- Edge cases around DST transitions

**Prevention:**
- Store dates as strings (YYYY-MM-DD) not DATE/TIMESTAMP types
- If using timestamps, explicitly set timezone: `SET timezone = 'America/New_York'`
- Document timezone handling in query tool description
- Add timezone information to query result metadata

**Detection:** Date mismatches between SQL and UI. Queries returning unexpected results around 4 PM ET.

**Phase to address:** Phase 2 (CSV Sync Pipeline) - match existing timezone handling

---

### Pitfall 11: npm Package Security Incident (Historical Warning)

**What goes wrong:** Installing a compromised version of the DuckDB npm package that contains malware.

**Why it happens:** In early 2025, DuckDB npm packages (versions 1.3.3 and 1.29.2) were compromised with cryptocurrency-stealing malware. This is a supply chain attack, not a DuckDB issue.

**Consequences:**
- Malware execution in Node.js process
- Potential data exfiltration
- Cryptocurrency wallet compromise

**Prevention:**
- Verify package versions from official sources
- Use npm audit and lockfiles
- Pin specific known-good versions
- Check [GitHub Security Advisory](https://github.com/duckdb/duckdb-node/security/advisories/GHSA-w62p-hx95-gf2c)

**Detection:** npm audit warnings. Unexpected network traffic from MCP server.

**Phase to address:** Phase 1 (Database Layer Foundation) - verify dependencies

---

### Pitfall 12: Over-Engineering the Sync Solution

**What goes wrong:** Building complex incremental sync logic when full refresh would be simpler and fast enough. Or implementing real-time watching when periodic refresh suffices.

**Why it happens:** Developers assume they need sophisticated change tracking. DuckDB's CSV import is so fast that simple full refresh is often the right answer.

**Consequences:**
- Wasted development time
- Complex code with edge case bugs
- Maintenance burden
- Premature optimization

**Prevention:**
- Benchmark full CSV import times before designing incremental sync
- DuckDB can import hundreds of thousands of rows per second
- Start with mtime-triggered full refresh, add incremental only if proven necessary
- Profile before optimizing

**Detection:** Incremental sync taking longer than full refresh would. Complex state management for sync. Frequent sync bugs.

**Phase to address:** Phase 2 (CSV Sync Pipeline) - measure before optimizing

**Source:** [DuckDB CSV Performance](https://motherduck.com/blog/taming-wild-csvs-with-duckdb-data-engineering/)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Database Layer | Wrong package, no security config | Use @duckdb/node-api, configure security at initialization |
| Phase 2: CSV Sync | Stale data, schema evolution | Content hashing + mtime, additive schema design |
| Phase 3: run_sql Tool | SQL injection, unbounded queries | Disable filesystem access, add LIMIT guardrails |
| Phase 4: Deprecation | Breaking existing tools | Keep existing tools, add SQL as alternative |

---

## Security Checklist for run_sql Tool

Before shipping the SQL query tool:

- [ ] `SET enable_external_access = false` (disable file system access)
- [ ] `SET disabled_filesystems = 'LocalFileSystem'` (explicit block)
- [ ] `SET autoload_known_extensions = false` (no surprise extensions)
- [ ] `SET allow_community_extensions = false` (only official extensions)
- [ ] `SET lock_configuration = true` (prevent runtime changes)
- [ ] `SET memory_limit = '2GB'` (resource limit)
- [ ] `SET max_temp_directory_size = '2GB'` (disk spill limit)
- [ ] `SET threads = 4` (CPU limit)
- [ ] Read-only connection for queries
- [ ] Query result row limit enforced
- [ ] Table name whitelist validation
- [ ] No COPY, EXPORT, IMPORT, ATTACH statements allowed

---

## Sources

**Official Documentation:**
- [DuckDB Concurrency](https://duckdb.org/docs/stable/connect/concurrency)
- [Securing DuckDB](https://duckdb.org/docs/stable/operations_manual/securing_duckdb/overview)
- [DuckDB Node.js API](https://duckdb.org/docs/stable/clients/nodejs/overview)
- [Node.js Client (Neo)](https://duckdb.org/docs/stable/clients/node_neo/overview)
- [DuckDB Memory Management](https://duckdb.org/2024/07/09/memory-management)
- [DuckDB Performance Guide](https://duckdb.org/docs/stable/guides/performance/overview)

**GitHub Issues & Discussions:**
- [duckdb-node Security Advisory](https://github.com/duckdb/duckdb-node/security/advisories/GHSA-w62p-hx95-gf2c)
- [How to deal with DuckDB concurrency issues](https://github.com/duckdb/duckdb/discussions/13392)
- [Multiple running database instances on same database file](https://github.com/duckdb/duckdb/issues/77)

**Community Resources:**
- [Taming Wild CSVs with DuckDB - MotherDuck](https://motherduck.com/blog/taming-wild-csvs-with-duckdb-data-engineering/)
- [AI Builder's Guide - MotherDuck](https://motherduck.com/docs/key-tasks/ai-and-motherduck/building-analytics-agents/)
- [DuckDB ALTER TABLE - Orchestra](https://www.getorchestra.io/guides/duckdb-sqlconcepts-alter-table)
