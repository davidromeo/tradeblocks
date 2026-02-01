# Technology Stack: DuckDB Analytics Layer

**Project:** TradeBlocks MCP Server - DuckDB Integration
**Researched:** 2026-02-01
**Confidence:** HIGH (verified via npm registry and official docs)

## Executive Summary

Use `@duckdb/node-api` (Node Neo) version 1.4.4-r.1 for DuckDB integration. This is the **official recommended** Node.js client, replacing the deprecated `duckdb` package. It provides native Promise support, TypeScript-first design, and platform-specific binary distribution that avoids build-time compilation.

## Recommended Stack

### Core DuckDB Package

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@duckdb/node-api` | ^1.4.4-r.1 | DuckDB Node.js client | Official recommended package; native async/Promise API; TypeScript-first; no build-time compilation; active development |

**Critical Note:** The legacy `duckdb` and `duckdb-async` packages are deprecated and will not receive updates after DuckDB 1.5.x (Early 2026). Use `@duckdb/node-api` for all new development.

### Package Architecture

The `@duckdb/node-api` package uses a layered architecture:

```
@duckdb/node-api (high-level API)
    |
    v
@duckdb/node-bindings (C API bindings)
    |
    v
Platform-specific packages (optional dependencies):
  - @duckdb/node-bindings-darwin-arm64  (macOS Apple Silicon)
  - @duckdb/node-bindings-darwin-x64    (macOS Intel)
  - @duckdb/node-bindings-linux-arm64   (Linux ARM)
  - @duckdb/node-bindings-linux-x64     (Linux x64)
  - @duckdb/node-bindings-win32-x64     (Windows x64)
```

This design (inspired by esbuild) ensures:
- Only the binaries for your platform are installed
- No build-time compilation or node-gyp
- Fast, clean installs

## API Overview

### Creating Connections

```typescript
import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

// Quick connection to in-memory database
const connection = await DuckDBConnection.create();

// File-based database
const instance = await DuckDBInstance.create('analytics.db');
const connection = await instance.connect();

// With configuration
const instance = await DuckDBInstance.create('analytics.db', {
  threads: '4'
});
```

### Running Queries

```typescript
// Simple query with Promise
const result = await connection.run('SELECT * FROM trades LIMIT 10');

// With parameters (prevents SQL injection)
const result = await connection.run(
  'SELECT * FROM trades WHERE block_id = $1',
  { '1': 'my-block' }
);

// Get results
const reader = await connection.runAndReadAll('SELECT * FROM trades');
const rows = reader.getRows();           // Array of arrays
const rowObjects = reader.getRowObjects(); // Array of objects
```

### Streaming Large Results

```typescript
// Stream results for memory efficiency
const result = await connection.stream('SELECT * FROM large_table');

for await (const chunk of result) {
  // Process chunk
}

// Or iterate rows directly
for await (const rows of result.yieldRows()) {
  // Process rows
}
```

### CSV Loading (Key for TradeBlocks)

```typescript
// Auto-detect CSV schema
await connection.run(`
  CREATE TABLE trades AS
  SELECT * FROM read_csv('${csvPath}', auto_detect=true)
`);

// Override specific column types
await connection.run(`
  CREATE TABLE trades AS
  SELECT * FROM read_csv('${csvPath}',
    types = {'dateOpened': 'DATE', 'pl': 'DOUBLE'}
  )
`);

// All columns as VARCHAR (for maximum compatibility)
await connection.run(`
  CREATE TABLE trades AS
  SELECT * FROM read_csv('${csvPath}', all_varchar=true)
`);
```

### Cross-Block Queries (ATTACH)

```typescript
// Attach multiple block databases
await connection.run("ATTACH 'block1.db' AS b1");
await connection.run("ATTACH 'block2.db' AS b2");

// Cross-database join
const result = await connection.run(`
  SELECT b1.trades.*, b2.trades.pl as other_pl
  FROM b1.trades
  JOIN b2.trades ON b1.trades.dateOpened = b2.trades.dateOpened
`);
```

## Bundling Considerations

### Current tsup Config Issue

The MCP server currently uses `noExternal: [/.*/]` to bundle all dependencies. This will **not work** with `@duckdb/node-api` because:

1. Native `.node` bindings cannot be bundled
2. Platform-specific packages are resolved at runtime

### Required tsup Changes

```typescript
// tsup.config.ts
export default defineConfig({
  // ... existing config

  // Mark DuckDB packages as external
  external: [
    '@duckdb/node-api',
    '@duckdb/node-bindings',
    /^@duckdb\/node-bindings-/,  // All platform packages
  ],
});
```

### Package Distribution Impact

Since DuckDB packages must be external:
- For **stdio MCP transport**: Works fine; packages installed in node_modules
- For **MCPB standalone distribution**: Must include @duckdb packages alongside bundled server
- For **npm publish**: Just add @duckdb/node-api to dependencies

**Recommendation:** Add `@duckdb/node-api` as a regular dependency (not bundled). The MCP server's `package.json` already works this way for the npm-published version.

## Alternatives Considered

| Option | Status | Why Not |
|--------|--------|---------|
| `duckdb` (legacy) | Deprecated | Will not receive updates after Fall 2025 |
| `duckdb-async` | Deprecated | Same deprecation timeline as `duckdb` |
| `@duckdb/duckdb-wasm` | Active | Performance overhead; memory limits; designed for browser; overkill for Node.js |
| SQLite + better-sqlite3 | Active | No CSV auto-detection; worse OLAP performance; limited SQL analytics |
| Postgres via pg | Active | External dependency; overkill for embedded analytics |

### Why Not DuckDB-WASM?

DuckDB-WASM works in Node.js but has limitations:
- **Performance:** WASM adds virtualization overhead vs native
- **Memory:** Limited by WASM constraints (4GB max)
- **Threading:** Single-threaded by default
- **Disk spilling:** Cannot spill to disk when out of memory

For an MCP server doing analytics on local CSV files, native `@duckdb/node-api` is the clear choice.

## Installation

```bash
# Add to MCP server package
npm install @duckdb/node-api

# Verify installation
node -e "import('@duckdb/node-api').then(d => console.log(d.default.version()))"
```

## TypeScript Configuration

`@duckdb/node-api` is written in TypeScript and ships with full type definitions. No additional @types package needed.

Works with the existing MCP server tsconfig:
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true
  }
}
```

## Performance Characteristics

| Scenario | Expected Performance |
|----------|---------------------|
| CSV loading | Excellent; parallel parsing, auto-type detection |
| Aggregation queries | Excellent; columnar storage, vectorized execution |
| JOIN operations | Good; hash/merge joins, automatic optimization |
| Cross-block queries | Good; ATTACH allows cross-database JOINs |
| Memory usage | Efficient; can spill to disk if needed |

## Version Compatibility

| Component | Version | Notes |
|-----------|---------|-------|
| DuckDB Core | 1.4.4 | Bundled with node-api |
| Node.js | >=18 | Required by MCP server |
| TypeScript | ^5.8.0 | Existing MCP server version |

## Sources

- [npm: @duckdb/node-api](https://www.npmjs.com/package/@duckdb/node-api) - Current version 1.4.4-r.1 (verified 2026-02-01)
- [DuckDB Node Neo Documentation](https://duckdb.org/docs/stable/clients/node_neo/overview) - Official docs
- [DuckDB Node Neo Announcement](https://duckdb.org/2024/12/18/duckdb-node-neo-client) - Architecture rationale
- [GitHub: duckdb-node-neo](https://github.com/duckdb/duckdb-node-neo) - Source and README
- [DuckDB CSV Auto Detection](https://duckdb.org/docs/stable/data/csv/auto_detection) - CSV parsing docs
- [DuckDB Multi-Database Support](https://duckdb.org/2024/01/26/multi-database-support-in-duckdb) - ATTACH capabilities
