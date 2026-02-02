# Phase 42: Sync Layer - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

CSV-to-DuckDB synchronization that keeps the cache fresh without manual intervention. Users don't interact with sync directly — they experience it through query freshness. The sync layer detects changes to block CSVs and market data files, updates DuckDB accordingly, and handles block lifecycle (adds, deletes, renames).

</domain>

<decisions>
## Implementation Decisions

### Sync Triggering
- **Hybrid approach**: `list_blocks` syncs ALL blocks (since it reads all anyway); per-block tools sync just their block on demand
- Sync blocks the query until complete — always accurate results, no stale data returned
- First query pays sync cost, subsequent queries are fast DB reads

### Change Detection
- **Hash-based detection**: Always compute full content hash (MD5 or SHA) to determine if re-sync needed
- mtime is informational only (logging/debugging), not a decision factor
- Store sync metadata (hash, last sync time) in DuckDB `sync_metadata` table — single source of truth

### Error Handling
- **Skip failed blocks, continue others**: If one block has corrupt CSV, sync what we can
- Sync errors reported in tool response (`syncErrors` array) — Claude sees and can surface to user
- If previously-synced block fails to sync (CSV deleted/corrupted), **remove its data from DuckDB** — no stale data risk
- **Atomic transactions**: DELETE old + INSERT new in single transaction; rollback on failure, no partial state

### Block Lifecycle
- **Delete on next sync**: When `list_blocks` runs and folder is gone, remove from DuckDB
- Rename = delete + add: Old block data removed, new folder synced fresh (no rename detection)

### Market Data (_marketdata/ folder)
- **Merge/preserve strategy**: Market data exports are rolling windows (PineScript), so:
  - Keep historical rows in DB
  - Parse CSV, compare dates to DB
  - INSERT only new rows, preserve existing old rows
  - Accumulates full history over time even as export window rolls
- Detection: Compare newest date in CSV vs newest date in DB to determine if new data exists

### Claude's Discretion
- Hash algorithm choice (MD5 vs SHA-256)
- Sync metadata table schema details
- Merge query implementation for market data upsert
- Logging verbosity and format

</decisions>

<specifics>
## Specific Ideas

- Current `list_blocks` already reads all blocks and returns metadata (trade counts, date ranges) — sync naturally fits into this entry point
- Most tools take single `blockId`, so per-block lazy sync handles direct tool calls without `list_blocks` first
- PineScript exports overwrite entire file but with rolling window — merge strategy prevents data loss

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-sync-layer*
*Context gathered: 2026-02-01*
