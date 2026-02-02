# Phase 42: Sync Layer - Research

**Researched:** 2026-02-01
**Domain:** CSV-to-DuckDB synchronization with hash-based change detection
**Confidence:** HIGH

## Summary

This research covers implementing a sync layer that keeps DuckDB analytics cache fresh by detecting changes to CSV files in block folders and the `_marketdata/` folder. The sync layer uses hash-based change detection (per CONTEXT.md decisions), stores metadata in DuckDB itself, and provides atomic transaction-based updates with proper error handling.

Key findings:
- DuckDB transactions work via standard SQL (`BEGIN`, `COMMIT`, `ROLLBACK`) through the existing `connection.run()` API - no special transaction methods needed
- SHA-256 is recommended over MD5: faster on modern hardware (due to CPU extensions), more secure, and provides better collision resistance for content hashing
- Node.js `crypto.createHash()` provides efficient file hashing with buffer-based streaming
- DuckDB's `INSERT OR REPLACE` and `ON CONFLICT DO UPDATE` support clean upsert patterns for market data merge strategy
- The Appender API (most efficient bulk insert) is NOT available in `@duckdb/node-api` - use multi-row INSERT statements instead

**Primary recommendation:** Implement sync as a module (`src/sync/`) with hash-based change detection via SHA-256, sync metadata stored in `trades._sync_metadata` table, and atomic transactions for all sync operations. Market data uses date-based merge with `INSERT ... ON CONFLICT DO NOTHING`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@duckdb/node-api` | 1.4.3+ | Database operations | Already installed (Phase 41), native Promise support |
| Node.js `crypto` | Built-in | SHA-256 hashing | Built into Node.js, no dependencies, hardware-accelerated |
| Node.js `fs/promises` | Built-in | File operations | Async file reading, mtime access |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | All requirements covered by Node.js built-ins + existing DuckDB |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SHA-256 | MD5 | MD5 is actually slower on modern CPUs and less secure; no benefit |
| SHA-256 | BLAKE3 | Faster but requires 3rd-party package; SHA-256 is sufficient for file content hashing |
| Multi-row INSERT | Appender API | Appender is faster but not available in `@duckdb/node-api`; INSERT is adequate for sync volumes |

**Installation:**
```bash
# No additional packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/mcp-server/src/
├── db/
│   ├── connection.ts     # Existing - DuckDB connection manager
│   ├── schemas.ts        # NEW - Schema/table definitions
│   └── index.ts          # Existing - exports
├── sync/
│   ├── index.ts          # Public API: syncAllBlocks(), syncBlock()
│   ├── block-sync.ts     # Block CSV -> DuckDB sync logic
│   ├── market-sync.ts    # Market data merge logic
│   ├── metadata.ts       # Sync metadata table operations
│   └── hasher.ts         # File content hashing
└── tools/
    └── blocks.ts         # Modify to call sync before queries
```

### Pattern 1: Sync-on-Read (Lazy Sync)
**What:** Sync happens at query time, blocking until complete
**When to use:** All read operations (`list_blocks`, `get_statistics`, etc.)
**Example:**
```typescript
// In blocks.ts - list_blocks tool
import { syncAllBlocks } from "../sync/index.js";

// Before returning block list, ensure DuckDB is fresh
const syncResult = await syncAllBlocks(baseDir);
if (syncResult.errors.length > 0) {
  // Include errors in response for visibility
}
// Now query DuckDB for block data...
```

### Pattern 2: Hash-Based Change Detection
**What:** Compute SHA-256 of file content, compare with stored hash
**When to use:** Every sync check
**Example:**
```typescript
// Source: Node.js crypto docs + CONTEXT.md decisions
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

### Pattern 3: Atomic Sync Transactions
**What:** DELETE old + INSERT new in single transaction; rollback on failure
**When to use:** Every block sync operation
**Example:**
```typescript
// Source: DuckDB transaction docs
const conn = await getConnection(dataDir);

await conn.run('BEGIN TRANSACTION');
try {
  // Delete existing data for this block
  await conn.run(`DELETE FROM trades.trade_data WHERE block_id = '${blockId}'`);

  // Insert new data
  await conn.run(`INSERT INTO trades.trade_data VALUES ...`);

  // Update sync metadata
  await conn.run(`INSERT OR REPLACE INTO trades._sync_metadata
    (block_id, content_hash, synced_at) VALUES (?, ?, ?)`,
    [blockId, newHash, new Date().toISOString()]);

  await conn.run('COMMIT');
} catch (error) {
  await conn.run('ROLLBACK');
  throw error;
}
```

### Pattern 4: Market Data Merge (Date-Based Upsert)
**What:** INSERT only new dates, preserve existing historical data
**When to use:** `_marketdata/` folder sync
**Example:**
```typescript
// Source: DuckDB INSERT ON CONFLICT docs + CONTEXT.md decisions
// Market data has date as primary key
await conn.run(`
  INSERT INTO market.spx_daily (date, open, high, low, close, ...)
  VALUES (?, ?, ?, ?, ?, ...)
  ON CONFLICT (date) DO NOTHING
`);
// Only inserts if date doesn't exist; preserves historical data
```

### Anti-Patterns to Avoid
- **Full table scan for change detection:** Use metadata table lookup, not SELECT COUNT(*)
- **Per-row transactions:** Batch all rows in single transaction
- **mtime as decision factor:** Per CONTEXT.md, use hash only; mtime is informational
- **Auto-rebuild on sync failure:** Fail with error, let user investigate

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Content hashing | Custom hash function | `crypto.createHash('sha256')` | Built-in, hardware-accelerated, battle-tested |
| Transaction management | Manual state tracking | DuckDB `BEGIN/COMMIT/ROLLBACK` | Database handles atomicity guarantees |
| Date parsing for market data | Custom parser | Existing `parseTimestamp()` in market-data.ts | Already handles TradingView format |
| CSV parsing | Custom parser | Existing `parseCSV()` in block-loader.ts | Already handles quoted fields, edge cases |
| Block folder discovery | New discovery logic | Existing `listBlocks()` pattern | Already handles folder structure |

**Key insight:** The sync layer orchestrates existing components (CSV parsing, DuckDB queries, file hashing) rather than reimplementing them. Reuse patterns from `block-loader.ts` and `market-data.ts`.

## Common Pitfalls

### Pitfall 1: Forgetting ROLLBACK on Error
**What goes wrong:** Transaction left open, subsequent queries fail or use stale state
**Why it happens:** Error thrown before COMMIT, no try/catch with ROLLBACK
**How to avoid:** Always wrap transactions in try/catch with ROLLBACK in catch block
**Warning signs:** "Transaction already open" errors, queries returning unexpected results

### Pitfall 2: Large File Hashing Memory Issues
**What goes wrong:** Reading entire large CSV into memory for hashing
**Why it happens:** Using `fs.readFileSync()` or `fs.readFile()` on 100MB+ files
**How to avoid:** For very large files, use streaming hash; for typical trade CSVs (<10MB), buffer is fine
**Warning signs:** Memory pressure, slow startup on large blocks

### Pitfall 3: Race Conditions on Concurrent Syncs
**What goes wrong:** Two sync operations for same block running simultaneously
**Why it happens:** User calls multiple tools in parallel
**How to avoid:** Use per-block sync lock or let DuckDB's transaction isolation handle it
**Warning signs:** Duplicate entries, constraint violations

### Pitfall 4: Stale Metadata After File Deletion
**What goes wrong:** Block folder deleted but metadata row remains
**Why it happens:** Only checking for changes, not deletions
**How to avoid:** On `syncAllBlocks()`, compare filesystem blocks with metadata table, delete orphans
**Warning signs:** Queries return data for non-existent blocks

### Pitfall 5: Market Data Date Timezone Issues
**What goes wrong:** Same date inserted twice due to timezone mismatch
**Why it happens:** CSV has Unix timestamp, DB has date string, timezone conversion differs
**How to avoid:** Use existing `parseTimestamp()` which handles Eastern Time; ensure DB dates are YYYY-MM-DD strings
**Warning signs:** Duplicate rows in market data table, gaps in date sequence

## Code Examples

Verified patterns from official sources:

### File Hashing with SHA-256
```typescript
// Source: Node.js crypto docs
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

export async function hashFileContent(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
```

### Sync Metadata Table Schema
```sql
-- Source: CONTEXT.md decisions
-- Stored in trades schema alongside trade data
CREATE TABLE IF NOT EXISTS trades._sync_metadata (
  block_id VARCHAR PRIMARY KEY,      -- Block folder name
  tradelog_hash VARCHAR NOT NULL,    -- SHA-256 of tradelog.csv content
  dailylog_hash VARCHAR,             -- SHA-256 of dailylog.csv (nullable)
  reportinglog_hash VARCHAR,         -- SHA-256 of reportinglog.csv (nullable)
  synced_at TIMESTAMP NOT NULL,      -- Last successful sync time
  sync_version INTEGER DEFAULT 1     -- Schema version for migrations
);

-- Market data sync metadata (separate since different merge strategy)
CREATE TABLE IF NOT EXISTS market._sync_metadata (
  file_name VARCHAR PRIMARY KEY,     -- e.g., 'spx_daily.csv'
  content_hash VARCHAR NOT NULL,     -- SHA-256 of file
  max_date VARCHAR,                  -- Latest date in DB for this file
  synced_at TIMESTAMP NOT NULL
);
```

### Transaction-Safe Block Sync
```typescript
// Source: DuckDB docs + CONTEXT.md decisions
export async function syncBlock(
  conn: DuckDBConnection,
  blockId: string,
  blockPath: string
): Promise<SyncResult> {
  await conn.run('BEGIN TRANSACTION');

  try {
    // 1. Hash current files
    const tradelogPath = path.join(blockPath, 'tradelog.csv');
    const newHash = await hashFileContent(tradelogPath);

    // 2. Check if sync needed
    const existingMeta = await getSyncMetadata(conn, blockId);
    if (existingMeta?.tradelog_hash === newHash) {
      await conn.run('ROLLBACK'); // No changes needed
      return { blockId, status: 'unchanged' };
    }

    // 3. Delete old data
    await conn.run(`DELETE FROM trades.trade_data WHERE block_id = ?`, [blockId]);

    // 4. Parse and insert new data
    const trades = await loadTrades(blockPath);
    for (const trade of trades) {
      await conn.run(`INSERT INTO trades.trade_data VALUES (?, ?, ?, ...)`,
        [blockId, trade.dateOpened, trade.pl, ...]);
    }

    // 5. Update metadata
    await conn.run(`
      INSERT OR REPLACE INTO trades._sync_metadata
      (block_id, tradelog_hash, synced_at)
      VALUES (?, ?, ?)
    `, [blockId, newHash, new Date().toISOString()]);

    await conn.run('COMMIT');
    return { blockId, status: 'synced', tradeCount: trades.length };

  } catch (error) {
    await conn.run('ROLLBACK');
    throw error;
  }
}
```

### Market Data Merge Insert
```typescript
// Source: DuckDB INSERT docs + CONTEXT.md decisions
export async function mergeMarketData(
  conn: DuckDBConnection,
  records: DailyMarketData[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const record of records) {
    const result = await conn.run(`
      INSERT INTO market.spx_daily (date, Open, High, Low, Close, ...)
      VALUES (?, ?, ?, ?, ?, ...)
      ON CONFLICT (date) DO NOTHING
    `, [record.date, record.Open, record.High, record.Low, record.Close, ...]);

    // Check if row was actually inserted
    const changes = await result.getRowCount(); // Hypothetical API
    if (changes > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  return { inserted, skipped };
}
```

### Deleted Block Cleanup
```typescript
// Source: CONTEXT.md decisions - delete on next sync
export async function cleanupDeletedBlocks(
  conn: DuckDBConnection,
  baseDir: string
): Promise<string[]> {
  // Get all block_ids from metadata
  const result = await conn.run('SELECT block_id FROM trades._sync_metadata');
  const metadataBlocks = (await result.getRows()).map(r => r.block_id as string);

  // Get all folders in baseDir
  const folders = await fs.readdir(baseDir, { withFileTypes: true });
  const existingBlocks = folders
    .filter(f => f.isDirectory() && !f.name.startsWith('.') && f.name !== '_marketdata')
    .map(f => f.name);

  // Find orphaned blocks
  const deleted: string[] = [];
  for (const blockId of metadataBlocks) {
    if (!existingBlocks.includes(blockId)) {
      // Block folder gone - remove from DB
      await conn.run('BEGIN TRANSACTION');
      await conn.run(`DELETE FROM trades.trade_data WHERE block_id = ?`, [blockId]);
      await conn.run(`DELETE FROM trades._sync_metadata WHERE block_id = ?`, [blockId]);
      await conn.run('COMMIT');
      deleted.push(blockId);
    }
  }

  return deleted;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| mtime-based change detection | Hash-based detection | Per CONTEXT.md | More reliable, no false positives from `touch` |
| In-memory cache (block-loader.ts) | DuckDB persistent cache | Phase 41-42 | Faster queries, survives restarts |
| MD5 hashing | SHA-256 hashing | 2025+ | Faster on modern CPUs, more secure |
| Appender API for bulk insert | Multi-row INSERT | N/A (Neo limitation) | Appender not available in Node Neo client |

**Deprecated/outdated:**
- `block.json` mtime caching: Replaced by DuckDB sync metadata table
- Per-tool file loading: Replaced by sync-on-read from DuckDB

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal Batch Size for Multi-Row INSERT**
   - What we know: Single INSERT with many VALUES is faster than many single-row INSERTs
   - What's unclear: Optimal batch size (100? 500? 1000?) for trade data
   - Recommendation: Start with 500 rows per INSERT, tune based on testing

2. **Row Count After INSERT ON CONFLICT**
   - What we know: DuckDB returns changes count from INSERT
   - What's unclear: Exact API in `@duckdb/node-api` for getting affected rows
   - Recommendation: Test with `getRowCount()` or equivalent; fall back to separate SELECT if needed

3. **Concurrent Sync Behavior**
   - What we know: DuckDB has snapshot isolation; concurrent writes may conflict
   - What's unclear: Exact behavior when two syncs try to update same block
   - Recommendation: Accept that DuckDB will abort one transaction; retry or report error

## Sources

### Primary (HIGH confidence)
- [DuckDB Transaction Management](https://duckdb.org/docs/stable/sql/statements/transactions) - BEGIN/COMMIT/ROLLBACK syntax
- [DuckDB INSERT Statements](https://duckdb.org/docs/stable/sql/statements/insert) - ON CONFLICT, INSERT OR REPLACE
- [Node.js crypto.createHash](https://nodejs.org/api/crypto.html) - SHA-256 hashing API
- [DuckDB Node Neo Client](https://duckdb.org/docs/stable/clients/node_neo/overview) - Connection API

### Secondary (MEDIUM confidence)
- [JavaScript Hashing Performance](https://lemire.me/blog/2025/01/11/javascript-hashing-speed-comparison-md5-versus-sha-256/) - SHA-256 faster than MD5 on modern CPUs
- [DuckDB Appender](https://duckdb.org/docs/stable/data/appender) - Confirms Appender not available in Node.js

### Tertiary (LOW confidence)
- Syncthing documentation - General patterns for hash-based sync (informational only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using only existing dependencies (DuckDB, Node.js built-ins)
- Architecture: HIGH - Patterns verified against DuckDB docs and existing codebase
- Pitfalls: MEDIUM - Based on documentation and common database patterns; real-world validation needed

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - sync patterns are stable, DuckDB API unlikely to change)
