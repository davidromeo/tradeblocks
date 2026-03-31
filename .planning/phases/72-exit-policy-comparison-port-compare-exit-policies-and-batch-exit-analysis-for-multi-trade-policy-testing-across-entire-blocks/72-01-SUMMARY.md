---
phase: 72-exit-policy-comparison
plan: "01"
subsystem: mcp-server
tags: [batch-analysis, exit-policy, option-caching, pure-module, tdd]
dependency_graph:
  requires:
    - Phase 71 exit-triggers module (analyzeExitTriggers, ExitTriggerConfig, TriggerType)
    - Phase 68/69 trade-replay module (PnlPoint, ReplayLeg, ReplayResult)
    - market.intraday DuckDB table (option bar caching storage)
  provides:
    - Option bar cache-read/write in replay.ts (BATCH-15, D-09)
    - Pure batch exit analysis engine (batch-exit-analysis.ts)
    - analyzeBatch, computeAggregateStats, computeTriggerAttribution exports
  affects:
    - packages/mcp-server/src/tools/replay.ts (cache-read + cache-write in fetchLegBars)
    - packages/mcp-server/src/utils/batch-exit-analysis.ts (new pure module)
    - packages/mcp-server/src/test-exports.ts (new exports added)
tech_stack:
  added: []
  patterns:
    - TDD (RED commit then GREEN commit)
    - Pure module (no I/O, no DuckDB, no fetch in batch-exit-analysis.ts)
    - Best-effort caching (try/catch wrapping all cache operations)
    - INSERT OR REPLACE idempotent writes (same pattern as underlying bar caching)
key_files:
  created:
    - packages/mcp-server/src/utils/batch-exit-analysis.ts
    - packages/mcp-server/tests/unit/batch-exit-analysis.test.ts
  modified:
    - packages/mcp-server/src/tools/replay.ts
    - packages/mcp-server/src/test-exports.ts
decisions:
  - "Cache-read returns early from fetchLegBars: avoids Massive API call for already-fetched option bars"
  - "Cache-write uses INSERT OR REPLACE (idempotent): safe to re-write cached rows without tracking source"
  - "volume: 0 for cached option bars: market.intraday has no volume column, consistent with existing intraday rows"
  - "analyzeBatch noTrigger case: candidatePnl = last pnlPath point (hold to end of replay)"
  - "Sharpe ratio: mean/sample stddev (N-1), trade-level (not annualized), null if < 2 trades"
  - "Profit factor: Infinity when no losing trades (mathematically correct edge case)"
  - "Drawdown from equity curve cumsum of candidatePnls (sequential order, not sorted)"
metrics:
  duration_seconds: 232
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_modified: 4
---

# Phase 72 Plan 01: Option Bar Caching and Batch Exit Analysis Engine Summary

**One-liner:** Option bar cache-read/write in replay.ts (BATCH-15) plus pure batch exit analysis engine with aggregate stats, trigger attribution, and dual baseline modes.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add option bar cache-read and cache-write to replay.ts | b124789 | replay.ts |
| 2 | Create batch exit analysis pure engine (TDD) | 894a6d9 | batch-exit-analysis.ts, test-exports.ts |

TDD commits:
- RED: 8b51a68 (failing tests)
- GREEN: 894a6d9 (implementation + test-exports)

## What Was Built

### Task 1: Option Bar Caching in replay.ts

Modified `fetchLegBars` inner function in `handleReplayTrade` to:

1. **Cache-read path** (top of function): Before calling `fetchBars()` from Massive, query `market.intraday` for existing rows matching the OCC ticker + date range. If rows found, return immediately — no API call. Maps DuckDB rows to `MassiveBarRow` shape (volume=0 since intraday has no volume column).

2. **Cache-write block** (after `barsByLeg`): Iterate over all legs, persist fetched option bars to `market.intraday` using `INSERT OR REPLACE`. Follows the exact same 500-row chunk pattern as the existing underlying bar caching at lines 324-345. Wrapped in try/catch (best-effort).

Result: Second replay of the same trade skips the Massive API call entirely (BATCH-15, D-09).

### Task 2: Batch Exit Analysis Engine

Created `packages/mcp-server/src/utils/batch-exit-analysis.ts` — a pure logic module with:

**`analyzeBatch(trades, config) → BatchExitResult`**
- Iterates trades, calls `analyzeExitTriggers` from exit-triggers.ts with candidate policy
- candidatePnl = firstToFire.pnlAtFire (if trigger fired) or last path point (noTrigger case)
- baselinePnl = trade.actualPnl (mode='actual') or last path point (mode='holdToEnd')
- Builds TradeExitResult per trade, then aggregates
- format='summary' omits perTrade array

**`computeAggregateStats(tradeResults) → AggregateStats`**
- Win rate, profit factor (Infinity if no losses), avg win/loss, max win/loss
- Max drawdown from equity curve (cumsum of candidatePnls, peak-to-trough)
- Sharpe: mean/sample_stddev (N-1), null if < 2 trades
- Max win/loss streaks
- Baseline aggregates (baselineTotalPnl, baselineWinRate, totalPnlDelta)

**`computeTriggerAttribution(tradeResults) → TriggerAttribution[]`**
- Groups by triggerFired (TriggerType | 'noTrigger')
- Per group: count, totalPnl, avgPnl, avgDelta
- Sorted by count descending

## Test Coverage

13 tests, all passing:
- Empty batch → zero stats
- All wins (profitTarget) → correct win rate + total P&L
- Mixed wins/losses → correct profit factor
- baseline=actual → delta = candidate - actual
- baseline=holdToEnd → delta vs last path point
- Per-trigger attribution counts
- noTrigger category populated
- format=summary vs full
- Max drawdown from equity curve
- Sharpe mean/stddev calculation
- Sharpe null < 2 trades
- Profit factor Infinity edge case
- Win/loss streak calculation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added volume: 0 to cache-read mapped rows**
- **Found during:** Task 1, TypeScript compile
- **Issue:** `MassiveBarRow` interface requires `volume: number` but `market.intraday` has no volume column
- **Fix:** Added `volume: 0` to the mapped row object in the cache-read return
- **Files modified:** packages/mcp-server/src/tools/replay.ts
- **Commit:** b124789 (part of same commit after immediate fix)

No other deviations — plan executed as written.

## Known Stubs

None. Both modules are fully implemented with no placeholder values or TODO markers.

## Self-Check: PASSED
