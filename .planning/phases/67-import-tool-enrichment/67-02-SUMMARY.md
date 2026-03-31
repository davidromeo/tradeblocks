---
phase: 67-import-tool-enrichment
plan: 02
subsystem: market-enrichment
tags: [enrichment, ivr, ivp, bollinger-bands, schema-migration, vix]
dependency_graph:
  requires: []
  provides: [IVR/IVP enrichment, clean-BB-schema]
  affects: [market-enricher, market-schemas, schema-metadata, field-timing, market-data, market-enrichment, schema-tools]
tech_stack:
  added: []
  patterns: [rolling-window-pure-functions, migration-try-catch, tier2-batch-update]
key_files:
  created: []
  modified:
    - packages/mcp-server/src/db/market-schemas.ts
    - packages/mcp-server/src/utils/market-enricher.ts
    - packages/mcp-server/src/utils/schema-metadata.ts
    - packages/mcp-server/src/utils/field-timing.ts
    - packages/mcp-server/src/tools/market-data.ts
    - packages/mcp-server/src/tools/market-enrichment.ts
    - packages/mcp-server/src/tools/schema.ts
    - packages/mcp-server/src/test-exports.ts
    - packages/mcp-server/tests/unit/market-enricher.test.ts
decisions:
  - "computeIVP divides by period-1 (251) not period (252) — compares current against prior days only, not itself"
  - "computeIVR returns 50 when range=0 (all values identical) — avoids division by zero, semantically middle-of-range"
  - "Removed computeVIXPercentile entirely — superseded by computeIVP which uses cleaner <= semantics"
  - "IVR/IVP for VIX9D and VIX3M use same 252-day window as VIX — consistent term structure analysis"
metrics:
  duration: ~25 minutes
  completed: "2026-03-22"
  tasks: 3
  files: 9
---

# Phase 67 Plan 02: Schema Changes and IVR/IVP Enrichment Summary

Replace Bollinger Bands from Tier 1 enrichment with IVR/IVP metrics for VIX term structure analysis across VIX, VIX9D, and VIX3M.

## What Was Built

**Schema changes (market-schemas.ts):**
- Removed `BB_Position` and `BB_Width` from `CREATE TABLE market.daily`
- Added `DROP COLUMN` migration for existing databases
- Renamed `VIX_Percentile` to `VIX_IVP` in `CREATE TABLE market.context`
- Added `RENAME COLUMN` migration for existing databases
- Added 5 new columns to `market.context`: `VIX_IVR`, `VIX9D_IVR`, `VIX9D_IVP`, `VIX3M_IVR`, `VIX3M_IVP`
- Added `ADD COLUMN` migrations for new columns

**Enricher changes (market-enricher.ts):**
- Removed `BollingerBandRow` interface and `computeBollingerBands` function entirely
- Removed BB computation from Tier 1 (`runEnrichment`) — bbArr, BB_Position, BB_Width
- Removed `computeVIXPercentile` — replaced by `computeIVP`
- Added `computeIVR(values, period=252)` — rolling range-based rank (0-100)
- Added `computeIVP(values, period=252)` — rolling percentile vs prior days (0-100)
- Updated `EnrichedContextRow` to replace `VIX_Percentile` with 6 IVR/IVP fields
- Updated `runTier2` to compute IVR/IVP for all three VIX indices
- Updated `tier2Cols` and `updateRows` builder with new fields

**Downstream updates (5 files):**
- `schema-metadata.ts`: Removed BB from keyColumns and field descriptions; added 6 IVR/IVP field descriptions (all `timing: 'close'`); renamed VIX_Percentile → VIX_IVP in context table; updated example queries
- `field-timing.ts`: No direct changes needed — derives from schema-metadata annotations automatically
- `market-data.ts`: Removed BB fields from `DailyMarketData` interface; added `VIX_IVR`/`VIX_IVP`; replaced BB filter suggestions with VIX_IVP filters; updated all description strings
- `market-enrichment.ts`: Updated Tier 1/Tier 2 field counts and names in tool description
- `schema.ts`: Updated LAG template to use IVR/IVP instead of BB columns

**Tests (market-enricher.test.ts):**
- Removed `computeBollingerBands` describe block (8 tests)
- Removed `computeVIXPercentile` describe block (5 tests)
- Added `computeIVR` describe block (8 tests)
- Added `computeIVP` describe block (9 tests)
- All 88 tests pass

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 7fc2717 | feat(67-02): schema changes, BB removal, IVR/IVP Tier 2 enrichment |
| 2 | 1968b71 | feat(67-02): update BB/IVP references in downstream files |
| 3 | bc1be27 | test(67-02): add computeIVR and computeIVP unit tests |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. IVR/IVP fields are fully wired from pure compute functions through batch DB updates to schema metadata and tool descriptions.

## Self-Check: PASSED

Files verified:
- packages/mcp-server/src/db/market-schemas.ts — contains VIX_IVR, VIX_IVP, DROP COLUMN BB, RENAME VIX_Percentile
- packages/mcp-server/src/utils/market-enricher.ts — contains computeIVR, computeIVP, no computeBollingerBands
- packages/mcp-server/tests/unit/market-enricher.test.ts — 88 tests pass

Commits verified: 7fc2717, 1968b71, bc1be27 all present in git log.
