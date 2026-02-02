---
phase: 42-sync-layer
plan: 02
subsystem: sync
tags: [duckdb, sync, transactions, hashing, csv-parsing]

dependency-graph:
  requires: [42-01]
  provides: [block-sync-logic, public-sync-api]
  affects: [42-04, 42-05]

tech-stack:
  added: []
  patterns: [atomic-transactions, hash-based-change-detection, batch-inserts]

key-files:
  created:
    - packages/mcp-server/src/sync/block-sync.ts
  modified:
    - packages/mcp-server/src/sync/index.ts
    - packages/mcp-server/src/db/connection.ts

decisions:
  - Batch size of 500 rows for INSERT operations
  - On sync failure for previously-synced block, remove its data (no stale data)
  - CSV parsing helpers copied locally to avoid circular imports
  - Transaction pattern: BEGIN, DELETE old, INSERT new, COMMIT

metrics:
  duration: 3m10s
  completed: 2026-02-02
---

# Phase 42 Plan 02: Block Sync Logic Summary

Hash-based CSV to DuckDB synchronization with atomic transactions and error handling for trade data.

## Changes Made

### Task 1: Block Sync Logic (18e250f)
Created `packages/mcp-server/src/sync/block-sync.ts` with:

**Core Functions:**
- `syncBlockInternal(conn, blockId, blockPath)`: Atomic sync of single block
  - Finds tradelog CSV (block.json mappings > "tradelog.csv" > first CSV)
  - Hashes file with SHA-256, compares to stored hash
  - If changed: DELETE old + INSERT new in transaction
  - Batch inserts in groups of 500 rows
  - Hashes optional dailylog/reportinglog files for metadata
  - On failure: rolls back and removes stale data if previously synced

- `detectBlockChanges(conn, baseDir)`: Filesystem vs metadata comparison
  - Returns `{ toSync: string[], toDelete: string[] }`
  - toSync: folders not in metadata OR with different hash
  - toDelete: block_ids in metadata but folder gone

- `cleanupDeletedBlocks(conn, deletedBlockIds)`: Atomic orphan removal
  - Deletes trade_data and sync_metadata in transaction

**Supporting Code:**
- CSV parsing helpers (parseCSV, parseCSVLine) copied from block-loader.ts
- Tradelog discovery with priority: block.json > standard name > discovery
- Numeric parsing with NaN handling for safe database inserts

### Task 2: Public Sync API (da005ce)
Updated `packages/mcp-server/src/sync/index.ts`:

- `syncAllBlocks(baseDir)`: Full sync triggered by list_blocks
  - Calls detectBlockChanges() to find work
  - Cleans up deleted blocks
  - Syncs changed/new blocks
  - Returns SyncResult with counts and errors

- `syncBlock(blockId, baseDir)`: Single block sync for per-tool use
  - Checks folder existence
  - Cleans up if folder gone but was synced
  - Calls syncBlockInternal() for actual sync

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Unused ensureMarketDataTables import**
- **Found during:** Task 1 commit (ESLint pre-commit hook)
- **Issue:** connection.ts imported ensureMarketDataTables but didn't use it
- **Fix:** Removed the import (will be added back in Plan 03)
- **Files modified:** packages/mcp-server/src/db/connection.ts
- **Commit:** 18e250f (included in Task 1 commit)

## Key Technical Details

### Transaction Pattern
```typescript
await conn.run("BEGIN TRANSACTION");
try {
  await conn.run("DELETE FROM trades.trade_data WHERE block_id = $1", [blockId]);
  // ... batch inserts ...
  await upsertSyncMetadata(conn, metadata);
  await conn.run("COMMIT");
} catch (err) {
  await conn.run("ROLLBACK");
  // If previously synced, remove stale data
  if (existingMetadata) {
    await cleanupDeletedBlocks(conn, [blockId]);
  }
  throw err;
}
```

### Batch Insert Strategy
- 500 rows per batch (14 columns per row = 7000 parameters max per batch)
- Builds parameterized VALUES clauses: `($1, $2, ...), ($15, $16, ...), ...`
- Uses array-based parameter binding for DuckDB

### Change Detection Flow
1. List directories in baseDir (excluding hidden, `_marketdata`)
2. Get all synced block_ids from metadata
3. For each folder:
   - If not in metadata: mark for sync (new)
   - If in metadata: hash tradelog, compare to stored hash
   - If hash differs: mark for sync (changed)
4. For each synced block_id not in folders: mark for delete

## Verification Completed

- [x] `npm run build` succeeds in packages/mcp-server
- [x] New blocks detected (folder exists, not in metadata)
- [x] Changed blocks detected (hash differs)
- [x] Deleted blocks have data removed (folder gone, was in metadata)
- [x] Atomic transactions (BEGIN/COMMIT/ROLLBACK pattern verified)
- [x] Hash-based change detection (no mtime dependencies)
- [x] SYNC-06 verified: No sync calls in index.ts (lazy sync)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 500-row batch size | Balances memory usage with insert performance |
| Copy CSV helpers | Avoids circular import risk with block-loader.ts |
| Remove stale data on failure | CONTEXT.md requirement: no stale data in DB |
| Local transaction management | Each function owns its transaction lifecycle |

## Next Phase Readiness

**Plan 42-03 (Market Sync):**
- Sync infrastructure complete
- `syncMarketData()` placeholder ready to implement
- Need to add ensureMarketDataTables() call back to connection.ts
- Will use merge strategy for rolling window exports

**Plan 42-04 (Tool Integration):**
- syncAllBlocks() ready for list_blocks integration
- syncBlock() ready for per-tool lazy sync
- SyncResult type available for response formatting
