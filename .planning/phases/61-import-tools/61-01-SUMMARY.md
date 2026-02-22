---
phase: 61-import-tools
plan: "01"
subsystem: mcp-server
tags: [market-data, import, duckdb, csv, ingestion]
dependency_graph:
  requires: [60-01, 60-02]
  provides: [61-02]
  affects: [packages/mcp-server/src/utils/market-importer.ts, packages/mcp-server/src/sync/metadata.ts]
tech_stack:
  added: []
  patterns: [ON CONFLICT DO NOTHING, ATTACH/DETACH lifecycle, fail-clean validation, batch insert 500 rows]
key_files:
  created:
    - packages/mcp-server/src/utils/market-importer.ts
  modified:
    - packages/mcp-server/src/sync/metadata.ts
decisions:
  - "column mapping direction: { sourceCol: schemaCol } — allows one mapping object to work for both CSV headers and query result columns"
  - "applyColumnMapping skips rows with unparseable dates (log warning) rather than throwing to allow partial imports of messy CSVs"
  - "insertMappedRows collects distinct columns across ALL rows (union of keys) to handle sparse rows"
  - "triggerEnrichment is a pure stub returning pending/skipped with no side effects — Phase 62 replaces it"
metrics:
  duration: "2 min"
  completed: "2026-02-22"
  tasks_completed: 2
  files_changed: 2
---

# Phase 61 Plan 01: Market Importer Core Utilities Summary

Created core market data ingestion utilities that power both import MCP tools: isolated CSV/DB import logic with column mapping validation, idempotent batch inserts, ATTACH/DETACH lifecycle, and enrichment stub.

## What Was Built

### `packages/mcp-server/src/utils/market-importer.ts` (new)

Core ingestion module with these exports:

**Types:**
- `ImportMarketCsvOptions` — filePath, ticker, targetTable, columnMapping, dryRun, skipEnrichment
- `ImportFromDatabaseOptions` — dbPath, query, ticker, targetTable, columnMapping, dryRun, skipEnrichment
- `ImportResult` — rowsInserted, rowsSkipped, inputRowCount, dateRange, enrichment

**Functions:**
- `validateColumnMapping(columnMapping, targetTable)` — checks Object.values(columnMapping) covers all REQUIRED_SCHEMA_FIELDS[targetTable]; returns `{ valid, missingFields }`
- `importMarketCsvFile(conn, options)` — reads CSV with `fs.readFile`, parses, maps columns, batched INSERT ON CONFLICT DO NOTHING, upserts metadata, triggers enrichment
- `importFromDatabase(conn, options)` — ATTACHes external DuckDB as `ext_import_source` READ_ONLY, runs query, maps columns, inserts, DETACHes in finally block
- `triggerEnrichment(conn, ticker, targetTable, dateRange, skipEnrichment)` — Phase 62 stub returning `{ status: "pending"|"skipped", message: "..." }`

**Key implementation details:**
- `parseFlexibleDate()` handles both Unix timestamp (>1e8 → ET date via `toLocaleDateString`) and YYYY-MM-DD strings
- `applyColumnMapping()` injects `ticker` for `daily` and `intraday` tables; skips `context` (date-only PK)
- Numeric coercion: empty/"NaN"/"NA" → null; otherwise parseFloat
- Batch size: 500 rows per INSERT statement (matches market-sync.ts pattern)
- COUNT(*) before/after INSERT determines actual `inserted` vs `skipped` counts
- `dry_run=true` returns preview without executing any INSERT

**Anti-patterns absent (verified):**
- No `withFullSync` (DB-09: market writes outside analytics.duckdb transactions)
- No `upsertMarketSyncMetadata` (old file_name-based schema)

### `packages/mcp-server/src/sync/metadata.ts` (modified)

Appended three new Phase 60 exports after all existing content:

- `MarketImportMetadata` interface — `{ source, ticker, target_table, max_date, enriched_through, synced_at }`
- `getMarketImportMetadata(conn, source, ticker, targetTable)` — queries `market._sync_metadata` by composite PK
- `upsertMarketImportMetadata(conn, metadata)` — `INSERT INTO ... ON CONFLICT (source, ticker, target_table) DO UPDATE SET max_date, enriched_through, synced_at`

**Existing helpers preserved unchanged:**
- `BlockSyncMetadata`, `getSyncMetadata`, `upsertSyncMetadata`, `deleteSyncMetadata`, `getAllSyncedBlockIds`
- `MarketSyncMetadata`, `getMarketSyncMetadata`, `upsertMarketSyncMetadata`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `23e55b4` | feat(61-01): create market-importer.ts with core ingestion logic |
| Task 2 | `333efae` | feat(61-01): add Phase 60 metadata helpers to metadata.ts |

## Verification

- TypeScript build passes cleanly (`npm run build --workspace=packages/mcp-server`)
- No circular imports: `market-importer.ts` → `metadata.ts` → `@duckdb/node-api` (no back-reference)
- All 5 exports present in market-importer.ts: `validateColumnMapping`, `importMarketCsvFile`, `importFromDatabase`, `triggerEnrichment`, plus 3 type exports
- All 3 new exports added to metadata.ts: `MarketImportMetadata`, `getMarketImportMetadata`, `upsertMarketImportMetadata`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- FOUND: packages/mcp-server/src/utils/market-importer.ts
- FOUND: packages/mcp-server/src/sync/metadata.ts (modified)

Commits exist:
- FOUND: 23e55b4 feat(61-01): create market-importer.ts
- FOUND: 333efae feat(61-01): add Phase 60 metadata helpers
