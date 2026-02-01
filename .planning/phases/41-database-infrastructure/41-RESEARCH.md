# Phase 41: Database Infrastructure - Research

**Researched:** 2026-02-01
**Domain:** DuckDB embedded database integration for Node.js MCP server
**Confidence:** HIGH

## Summary

This research covers DuckDB integration into the TradeBlocks MCP server using the official `@duckdb/node-api` package. The new Node Neo client (which replaces the deprecated `duckdb` package) provides Promise-based async APIs, TypeScript-first design, and is built on DuckDB's C API for better stability and performance.

Key findings:
- `@duckdb/node-api` v1.4.3 is the current stable release, providing native Promise support without requiring wrappers
- DuckDB supports configuration via instance creation options for memory, threads, and external access
- The CONTEXT.md decision to use a single `analytics.duckdb` file with two schemas (trades, market) simplifies JOINs significantly
- Security settings self-lock when disabled, preventing runtime re-enablement
- No built-in query timeout exists; use row limits and memory caps instead

**Primary recommendation:** Use `@duckdb/node-api` with lazy initialization pattern, persistent connection, and configure `enable_external_access=false` at instance creation with memory limit of 512MB and 2 threads as conservative defaults.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@duckdb/node-api` | 1.4.3+ | DuckDB Node.js client | Official package, Promise-native, TypeScript-first, replaces deprecated `duckdb` package |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@duckdb/node-bindings` | (auto) | Low-level C API bindings | Automatically included by node-api; not directly used |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@duckdb/node-api` | `duckdb` (old) | Old package deprecated; won't receive updates after DuckDB 1.4.x |
| `@duckdb/node-api` | `duckdb-async` | Wrapper around old package; unnecessary with Neo's native Promises |

**Installation:**
```bash
npm install @duckdb/node-api
```

## Architecture Patterns

### Recommended Project Structure
```
packages/mcp-server/
├── src/
│   ├── db/
│   │   ├── connection.ts      # DuckDB connection manager
│   │   ├── schemas.ts         # Schema definitions for trades/market
│   │   └── index.ts           # Public exports
│   ├── tools/
│   │   └── ...existing...
│   └── index.ts
```

### Pattern 1: Lazy Singleton Connection Manager
**What:** Initialize DuckDB connection on first query, keep open until server shutdown
**When to use:** Always - aligns with CONTEXT.md decision
**Example:**
```typescript
// Source: DuckDB docs + CONTEXT.md decisions
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import * as path from 'path';

let instance: DuckDBInstance | null = null;
let connection: DuckDBConnection | null = null;

export async function getConnection(dataDir: string): Promise<DuckDBConnection> {
  if (connection) return connection;

  const dbPath = path.join(dataDir, 'analytics.duckdb');

  // Create instance with configuration
  instance = await DuckDBInstance.create(dbPath, {
    threads: process.env.DUCKDB_THREADS || '2',
    memory_limit: process.env.DUCKDB_MEMORY_LIMIT || '512MB',
    enable_external_access: 'false',
  });

  connection = await instance.connect();

  // Initialize schemas
  await connection.run('CREATE SCHEMA IF NOT EXISTS trades');
  await connection.run('CREATE SCHEMA IF NOT EXISTS market');

  return connection;
}

export async function closeConnection(): Promise<void> {
  if (connection) {
    connection.closeSync();
    connection = null;
  }
  instance = null;
}
```

### Pattern 2: Environment-Based Configuration
**What:** Allow resource limits to be configured via environment variables
**When to use:** For all configurable settings (memory, threads)
**Example:**
```typescript
// Source: CONTEXT.md decisions
const config = {
  threads: process.env.DUCKDB_THREADS || '2',
  memory_limit: process.env.DUCKDB_MEMORY_LIMIT || '512MB',
};
```

### Pattern 3: Schema-Based Organization
**What:** Use DuckDB schemas to separate trades data from market data
**When to use:** Per CONTEXT.md - single file with two schemas
**Example:**
```sql
-- Source: CONTEXT.md decisions
CREATE SCHEMA IF NOT EXISTS trades;
CREATE SCHEMA IF NOT EXISTS market;

-- Tables in trades schema
CREATE TABLE trades.blocks (...);

-- Tables in market schema
CREATE TABLE market.spx_daily (...);

-- JOINs work without ATTACH/DETACH
SELECT * FROM trades.blocks t
JOIN market.spx_daily m ON t.trade_date = m.date;
```

### Anti-Patterns to Avoid
- **Multiple database files requiring ATTACH/DETACH:** Complicates JOINs, per CONTEXT.md
- **Connection per request:** DuckDB is embedded and thread-safe for reads; persistent connection is standard
- **Eager initialization:** Opens DB even when no queries run; use lazy pattern instead
- **Auto-rebuild on corruption:** Per CONTEXT.md, fail with clear error; user deletes manually

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async query execution | Callback wrappers | `@duckdb/node-api` native Promises | Package natively supports async/await |
| Query timeout | Custom timer + kill | Row limits + memory caps | DuckDB has no native query timeout; workarounds are unreliable |
| Schema creation | Manual SQL files | `CREATE SCHEMA IF NOT EXISTS` | Built into DuckDB, idempotent |
| Connection pooling | Pool manager | Single persistent connection | Embedded DB doesn't need pools |

**Key insight:** DuckDB is embedded (in-process), not client-server. Most "database patterns" from PostgreSQL/MySQL don't apply. Keep it simple.

## Common Pitfalls

### Pitfall 1: Using Deprecated `duckdb` Package
**What goes wrong:** Installing old `duckdb` package instead of `@duckdb/node-api`
**Why it happens:** Old package still exists on npm, appears in older tutorials
**How to avoid:** Always use `@duckdb/node-api`; verify imports use `@duckdb/node-api` not `duckdb`
**Warning signs:** Callback-based API, missing Promise methods, build errors on Apple Silicon

### Pitfall 2: Expecting Query Timeouts
**What goes wrong:** Assuming DuckDB has statement timeout like PostgreSQL
**Why it happens:** Common in other databases
**How to avoid:** Use row limits (LIMIT clause), memory caps, and conservative resource settings
**Warning signs:** Long-running queries with no abort mechanism

### Pitfall 3: Disabling Security After Enable
**What goes wrong:** Trying to re-enable `enable_external_access` after setting to false
**Why it happens:** DuckDB security settings self-lock when disabled
**How to avoid:** Set `enable_external_access: 'false'` at instance creation; don't try to change later
**Warning signs:** Error messages about locked configuration

### Pitfall 4: OOM on Large Result Sets
**What goes wrong:** Query returns millions of rows, exhausts memory
**Why it happens:** No row limit on SELECT queries
**How to avoid:** Always apply LIMIT clause; set memory_limit configuration
**Warning signs:** Process killed by OS, "Failed to allocate block" errors

### Pitfall 5: File Corruption Error Handling
**What goes wrong:** Attempting auto-rebuild when database file is corrupt
**Why it happens:** Desire for "self-healing" behavior
**How to avoid:** Per CONTEXT.md, fail with clear error message instructing user to delete file
**Warning signs:** Recursive corruption, data loss from partial rebuilds

## Code Examples

Verified patterns from official sources:

### Instance Creation with Configuration
```typescript
// Source: https://duckdb.org/docs/stable/clients/node_neo/overview
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

// In-memory database (for testing)
const instance = await DuckDBInstance.create(':memory:');

// File-based database with configuration
const instance = await DuckDBInstance.create('analytics.duckdb', {
  threads: '2',
  memory_limit: '512MB',
  enable_external_access: 'false',
});

const connection = await instance.connect();
```

### Running Queries
```typescript
// Source: https://duckdb.org/docs/stable/clients/node_neo/overview
// Simple query
const result = await connection.run('SELECT 42 as answer');
const rows = await result.getRows();
// rows = [{ answer: 42 }]

// Query with results
const result = await connection.run(`
  SELECT block_id, COUNT(*) as trade_count
  FROM trades.blocks
  GROUP BY block_id
`);
const columns = result.columnNames();  // ['block_id', 'trade_count']
const rows = await result.getRows();
```

### Creating Schemas and Tables
```typescript
// Source: https://duckdb.org/docs/stable/sql/statements/create_schema
await connection.run('CREATE SCHEMA IF NOT EXISTS trades');
await connection.run('CREATE SCHEMA IF NOT EXISTS market');

await connection.run(`
  CREATE TABLE IF NOT EXISTS trades.trade_data (
    block_id VARCHAR NOT NULL,
    date_opened DATE NOT NULL,
    pl DOUBLE,
    strategy VARCHAR
  )
`);
```

### Graceful Shutdown
```typescript
// Source: https://duckdb.org/docs/stable/clients/node_neo/overview
// Explicit cleanup (connections auto-cleanup when references dropped)
connection.closeSync();
// Instance cleanup happens automatically via garbage collection
```

### Error Handling Pattern
```typescript
// Recommended pattern for MCP server
async function runQuery(sql: string): Promise<QueryResult> {
  try {
    const conn = await getConnection(dataDir);
    const result = await conn.run(sql);
    return { success: true, rows: await result.getRows() };
  } catch (error) {
    // Return helpful error, not stack trace
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `duckdb` npm package | `@duckdb/node-api` | Dec 2024 | New Promise-native API, better TypeScript |
| C++ API bindings | C API bindings | Dec 2024 | More stable, easier to maintain |
| Callback-based async | Native Promises | Dec 2024 | Cleaner code, better error handling |

**Deprecated/outdated:**
- `duckdb` npm package: Last release will be DuckDB 1.4.x (Fall 2025); no 1.5.x support
- `duckdb-async` wrapper: Unnecessary with Neo's native Promise support

## Open Questions

Things that couldn't be fully resolved:

1. **Query Interrupt Reliability**
   - What we know: DuckDB has `interrupt()` in C API, partially exposed in clients
   - What's unclear: Whether `@duckdb/node-api` exposes interrupt; effectiveness is mixed per GitHub issues
   - Recommendation: Don't rely on interrupt; use row limits and memory caps instead

2. **Exact Memory Behavior Under Pressure**
   - What we know: `memory_limit` caps DuckDB memory; spills to temp directory
   - What's unclear: Behavior when both memory and temp directory limits hit simultaneously
   - Recommendation: Start with 512MB, monitor in practice, adjust if needed

3. **Thread Configuration for MCP Context**
   - What we know: Default is CPU core count; MCP server runs alongside Claude
   - What's unclear: Optimal thread count for MCP server use case
   - Recommendation: Start conservative (2 threads); this is Claude's discretion per CONTEXT.md

## Sources

### Primary (HIGH confidence)
- [DuckDB Node Neo Client Overview](https://duckdb.org/docs/stable/clients/node_neo/overview) - Instance creation, connection, API patterns
- [DuckDB Configuration Reference](https://duckdb.org/docs/stable/configuration/overview) - memory_limit, threads, enable_external_access
- [DuckDB Securing Guide](https://duckdb.org/docs/stable/operations_manual/securing_duckdb/overview) - Security options, configuration locking
- [DuckDB CREATE SCHEMA](https://duckdb.org/docs/stable/sql/statements/create_schema) - Schema creation syntax

### Secondary (MEDIUM confidence)
- [DuckDB Node Neo Client Announcement](https://duckdb.org/2024/12/18/duckdb-node-neo-client) - Architecture, TypeScript design, differences from old API
- [DuckDB OOM Troubleshooting](https://duckdb.org/docs/stable/guides/troubleshooting/oom_errors) - Memory management, prevention strategies

### Tertiary (LOW confidence)
- GitHub issues on query interrupt - Active development, behavior may change

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official DuckDB documentation confirms `@duckdb/node-api` is the current package
- Architecture: HIGH - Patterns from official docs plus CONTEXT.md decisions
- Pitfalls: MEDIUM - Based on GitHub issues and documentation warnings; real-world experience needed

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - DuckDB is stable, slow-moving API)
