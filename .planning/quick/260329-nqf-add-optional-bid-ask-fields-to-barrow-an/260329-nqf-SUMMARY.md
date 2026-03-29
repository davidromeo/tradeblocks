---
phase: quick
plan: 260329-nqf
subsystem: mcp-server/market-data
tags: [bar-cache, mark-price, bid-ask, trade-replay, market-provider]
dependency_graph:
  requires: []
  provides: [markPrice helper, BarRow.bid/ask, market.intraday bid/ask columns]
  affects: [trade-replay, replay.ts, exit-analysis.ts, bar-cache.ts]
tech_stack:
  added: []
  patterns: [optional fields on shared interface, pure function helper, ALTER TABLE migration]
key_files:
  created:
    - packages/mcp-server/tests/unit/mark-price.test.ts
  modified:
    - packages/mcp-server/src/utils/market-provider.ts
    - packages/mcp-server/src/db/market-schemas.ts
    - packages/mcp-server/src/utils/bar-cache.ts
    - packages/mcp-server/src/utils/trade-replay.ts
    - packages/mcp-server/src/tools/replay.ts
    - packages/mcp-server/src/tools/exit-analysis.ts
    - packages/mcp-server/src/test-exports.ts
decisions:
  - markPrice fallback condition uses (bid > 0 || ask > 0) — both-zero treated as absent (stale/unavailable quote)
  - markPrice accepts Pick<BarRow, 'high'|'low'|'bid'|'ask'> for flexibility
  - Variable name hl2 kept in computeStrategyPnlPath to minimize diff — semantics unchanged when bid/ask absent
  - ALTER TABLE migration uses same try/catch ignore pattern as existing migrations
metrics:
  duration_minutes: 10
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_changed: 7
  tests_added: 6
---

# Quick Task 260329-nqf: Add Optional Bid/Ask Fields to BarRow and markPrice Helper Summary

**One-liner:** Optional bid/ask fields on BarRow with markPrice() helper preferring mid-quote over HL2 at all three mark-price calculation sites.

## What Was Built

Added opt-in bid/ask quote support to the market data layer:

1. **BarRow interface** (`market-provider.ts`) — two new optional fields `bid?: number` and `ask?: number`

2. **markPrice helper** (`trade-replay.ts`) — pure function: returns `(bid+ask)/2` when both present and non-zero, falls back to `(high+low)/2`. Exported for testing.

3. **Schema migration** (`market-schemas.ts`) — `market.intraday` CREATE TABLE now includes `bid DOUBLE, ask DOUBLE`; ALTER TABLE migration block handles existing databases (try/catch, ignore already-exists errors).

4. **bar-cache read/write** (`bar-cache.ts`) — SELECT includes `bid, ask` (positions 4,5; time/date shift to 6,7); INSERT includes bid/ask with `NULL` fallback for bars without quote data.

5. **Mark price sites updated** — all three inline `(high+low)/2` expressions replaced with `markPrice()`:
   - `trade-replay.ts` line 381: `computeStrategyPnlPath` inner loop
   - `replay.ts` line 365: underlying price map build loop
   - `exit-analysis.ts` line 170: VIX/VIX9D price maps loop

6. **Unit tests** (`tests/unit/mark-price.test.ts`) — 6 cases covering all bid/ask presence/absence combinations including partial (one present), zero values, and undefined.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | BarRow bid/ask fields, schema migration, bar-cache, markPrice helper + tests | 83c034b |
| 2 | Replace all HL2 sites with markPrice helper | f0ead0c |

## Verification Results

```
Tests: 48 passed (6 new + 42 existing trade-replay)
TypeScript: 0 errors
Remaining inline HL2 in src/: only markPrice fallback body + one JSDoc comment
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All mark price sites are wired to markPrice(). Providers do not yet populate bid/ask fields (that depends on future provider-side changes), but the infrastructure is complete and backward-compatible.

## Self-Check: PASSED

- `packages/mcp-server/src/utils/market-provider.ts` — bid/ask fields present
- `packages/mcp-server/src/utils/trade-replay.ts` — markPrice helper present
- `packages/mcp-server/src/db/market-schemas.ts` — bid/ask columns + migration present
- `packages/mcp-server/src/utils/bar-cache.ts` — read/write bid/ask present
- `packages/mcp-server/tests/unit/mark-price.test.ts` — 6 tests present
- Commit 83c034b exists: `git log --oneline | grep 83c034b` ✓
- Commit f0ead0c exists: `git log --oneline | grep f0ead0c` ✓
