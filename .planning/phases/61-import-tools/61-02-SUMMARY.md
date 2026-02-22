---
phase: 61-import-tools
plan: "02"
subsystem: mcp-server
tags: [mcp-tools, market-data, import, duckdb]
dependency_graph:
  requires: [61-01]
  provides: [import_market_csv tool, import_from_database tool, registerMarketImportTools]
  affects: [packages/mcp-server/src/index.ts, packages/mcp-server/src/test-exports.ts]
tech_stack:
  added: []
  patterns: [MCP tool registration, upgradeToReadWrite/downgradeToReadOnly lifecycle, ~ path expansion]
key_files:
  created:
    - packages/mcp-server/src/tools/market-imports.ts
  modified:
    - packages/mcp-server/src/index.ts
    - packages/mcp-server/src/test-exports.ts
    - packages/mcp-server/package.json
decisions:
  - "Tool names: import_market_csv and import_from_database (import_csv is taken by block importer in imports.ts)"
  - "downgradeToReadOnly placed in finally block ensuring cleanup even on import errors"
  - "Version bumped to 1.3.0 (minor bump for two new MCP tools)"
metrics:
  duration: "2 min"
  completed: "2026-02-22"
  tasks_completed: 2
  files_modified: 4
---

# Phase 61 Plan 02: Market Import MCP Tools Registration Summary

MCP tool registration wrappers for `import_market_csv` and `import_from_database`, wired into server startup with test export additions and version bump to 1.3.0.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create market-imports.ts tool registration file | 6b25f48 | packages/mcp-server/src/tools/market-imports.ts |
| 2 | Wire into index.ts, test-exports.ts, and bump package version | a4e5ff7 | src/index.ts, src/test-exports.ts, package.json |

## What Was Built

**`packages/mcp-server/src/tools/market-imports.ts`** — New tool registration file with `registerMarketImportTools()` that registers two MCP tools:

- **`import_market_csv`**: Imports OHLCV data from a local CSV file into `market.daily`, `market.context`, or `market.intraday`. Accepts `file_path`, `ticker`, `target_table`, `column_mapping`, `dry_run`, `skip_enrichment`. Expands `~` in file path.

- **`import_from_database`**: Imports market data from an external DuckDB database by ATTACHing it as `ext_import_source`. Accepts `db_path`, `query`, `ticker`, `target_table`, `column_mapping`, `dry_run`, `skip_enrichment`. Expands `~` in db path.

Both tools follow the same RW lifecycle: `upgradeToReadWrite` → `getConnection` → delegate to `market-importer.ts` → `downgradeToReadOnly` in finally block.

**`packages/mcp-server/src/index.ts`** — Added import and `registerMarketImportTools(server, resolvedDir)` call after `registerImportTools`.

**`packages/mcp-server/src/test-exports.ts`** — Added exports for `validateColumnMapping`, `importMarketCsvFile`, `importFromDatabase`, `triggerEnrichment`, type exports (`ImportMarketCsvOptions`, `ImportFromDatabaseOptions`, `ImportResult`), and Phase 60 metadata helpers (`MarketImportMetadata`, `getMarketImportMetadata`, `upsertMarketImportMetadata`).

**`packages/mcp-server/package.json`** — Version bumped from `1.2.1` to `1.3.0` (minor bump for two new MCP tools).

## Verification Results

- Build passes cleanly: `npm run build --workspace=packages/mcp-server`
- `import_csv` name NOT present in `market-imports.ts` (no collision with block importer)
- `withFullSync` NOT imported or called
- `registerMarketImportTools` present in both `market-imports.ts` (exported) and `index.ts` (called)
- `validateColumnMapping` exported from `test-exports.ts`
- Package version confirmed at `1.3.0`

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] packages/mcp-server/src/tools/market-imports.ts exists and exports registerMarketImportTools
- [x] packages/mcp-server/src/index.ts calls registerMarketImportTools(server, resolvedDir)
- [x] packages/mcp-server/src/test-exports.ts exports validateColumnMapping, importMarketCsvFile, importFromDatabase, triggerEnrichment, and metadata helpers
- [x] packages/mcp-server/package.json version is 1.3.0
- [x] Full build passes with no errors
- [x] Commit 6b25f48 exists (Task 1)
- [x] Commit a4e5ff7 exists (Task 2)
