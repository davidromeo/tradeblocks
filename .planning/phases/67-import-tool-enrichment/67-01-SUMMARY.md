---
phase: 67-import-tool-enrichment
plan: 01
subsystem: mcp-server/market-imports
tags: [massive-api, import, market-data, mcp-tool, enrichment]
dependency_graph:
  requires:
    - "66-02: fetchBars HTTP client (massive-client.ts)"
    - "phase-60: insertMappedRows, triggerEnrichment, insertMappedRows (market-importer.ts)"
    - "phase-62: runEnrichment, runTier2 (market-enricher.ts)"
  provides:
    - "importFromMassive() function in market-importer.ts"
    - "import_from_massive MCP tool in market-imports.ts"
    - "runContextEnrichment() standalone Tier 2 trigger"
    - "massiveTimestampToETTime() helper for intraday time extraction"
  affects:
    - "67-02: IVR/IVP enrichment (consumes context data populated here)"
    - "Phase 68: trade replay (consumes intraday data populated here)"
tech_stack:
  added: []
  patterns:
    - "Promise.all for 3 parallel Massive API calls (VIX/VIX9D/VIX3M context merge)"
    - "Date-keyed Map for merging multi-ticker bars into single context rows"
    - "OCC ticker auto-detection via regex /^[A-Z]+\d{6}[CP]\d{8}$/"
key_files:
  created: []
  modified:
    - packages/mcp-server/src/utils/massive-client.ts
    - packages/mcp-server/src/utils/market-importer.ts
    - packages/mcp-server/src/utils/market-enricher.ts
    - packages/mcp-server/src/tools/market-imports.ts
    - packages/mcp-server/src/test-exports.ts
decisions:
  - "Context merge uses Map<date, row> keyed approach — avoids triple-nested loops, handles partial data (dates missing from one index are still included)"
  - "Volume stripped from intraday rows before insertMappedRows — market.intraday schema has no volume column, insertMappedRows would error on unknown column"
  - "runContextEnrichment() delegates to private runTier2() — cleanest approach without modifying triggerEnrichment semantics"
  - "Auto-detect assetClass from Set of known index tickers + OCC regex — callers can override if needed"
  - "Context import metadata recorded with ticker='VIX' (canonical reference for context data)"
metrics:
  duration: "~20 minutes"
  completed: "2026-03-22T19:16:40Z"
  tasks: 2
  files_modified: 5
---

# Phase 67 Plan 01: import_from_massive Tool Summary

**One-liner:** `import_from_massive` MCP tool wiring Massive.com API to DuckDB via daily/context/intraday paths with 3-call VIX merge and intraday time extraction.

## What Was Built

### Task 1: importFromMassive function in market-importer.ts

Added `importFromMassive(conn, options): Promise<ImportResult>` supporting three paths:

**daily path:** Calls `fetchBars({ timespan: "day" })` → maps OHLCV rows directly (field names already match) → `insertMappedRows(conn, "daily", rows)` → `triggerEnrichment()` for Tier 1+2+3.

**context path:** Makes 3 parallel `fetchBars()` calls (`Promise.all`) for VIX, VIX9D, VIX3M with `assetClass: "index"`. Merges results into a `Map<date, contextRow>` with VIX columns (`VIX_Open`, `VIX_Close`, `VIX_High`, `VIX_Low`, `VIX9D_Open`, `VIX9D_Close`, `VIX3M_Open`, `VIX3M_Close`). Inserts merged rows into `market.context` then calls `runContextEnrichment()` to compute VIX-derived fields.

**intraday path:** Calls `fetchBars({ timespan: "minute"|"hour", multiplier })` — which now populates `row.time` (HH:MM ET) via `massiveTimestampToETTime()`. Strips volume before `insertMappedRows(conn, "intraday", ...)` since `market.intraday` has no volume column.

Supporting additions:
- `massiveTimestampToETTime(unixMs)` in `massive-client.ts` — extracts HH:MM ET from Unix milliseconds
- `time?: string` added to `MassiveBarRow` interface — populated by `fetchBars()` when timespan != "day"
- `runContextEnrichment(conn)` exported from `market-enricher.ts` — delegates to private `runTier2()`
- Auto-detect `assetClass`: known index Set (VIX, SPX, NDX, RUT, DJX, VXN, OVX, GVZ) + OCC regex → "option" → else "stock"

### Task 2: import_from_massive MCP tool registration

Added third `server.registerTool()` call in `registerMarketImportTools()` with:
- Zod schema: `ticker`, `from`, `to`, `target_table` (enum daily/context/intraday), `timespan` (1m/5m/15m/1h), `asset_class`, `dry_run`, `skip_enrichment`
- Timespan parsing: "1m"→("minute",1), "5m"→("minute",5), "15m"→("minute",15), "1h"→("hour",1)
- RW lifecycle: `upgradeToReadWrite` → try → `importFromMassive()` → `createToolOutput()` → catch (isError:true) → finally `downgradeToReadOnly()`
- Context imports show ticker as "VIX/VIX9D/VIX3M" in output (not the input ticker which is ignored)

## Deviations from Plan

None — plan executed exactly as written. The context enrichment approach (export `runContextEnrichment` from market-enricher.ts) was the cleanest of the options the plan suggested, and was the one chosen.

## Known Stubs

None. All three import paths are fully wired:
- daily → fetchBars → insertMappedRows → triggerEnrichment
- context → 3x fetchBars → merge → insertMappedRows → runContextEnrichment
- intraday → fetchBars(with time) → strip volume → insertMappedRows

## Self-Check: PASSED

| Item | Status |
|------|--------|
| market-importer.ts exists with importFromMassive | FOUND |
| market-imports.ts exists with import_from_massive tool | FOUND |
| massive-client.ts exists with massiveTimestampToETTime | FOUND |
| market-enricher.ts exists with runContextEnrichment | FOUND |
| test-exports.ts has importFromMassive export | FOUND |
| SUMMARY.md created | FOUND |
| Task 1 commit 70b3622 | FOUND |
| Task 2 commit 7726fc7 | FOUND |
| TypeScript compiles without errors | PASSED |
