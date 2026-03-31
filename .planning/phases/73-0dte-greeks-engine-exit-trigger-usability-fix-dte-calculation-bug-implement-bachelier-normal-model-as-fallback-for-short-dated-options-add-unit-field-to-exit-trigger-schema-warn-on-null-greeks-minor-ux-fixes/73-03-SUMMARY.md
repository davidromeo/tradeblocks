---
phase: 73-0dte-greeks-engine
plan: "03"
subsystem: mcp-server
tags:
  - trade-replay
  - greeks
  - exit-triggers
  - ux
  - 0dte
dependency_graph:
  requires:
    - 73-01
    - 73-02
  provides:
    - DTE-02
    - WARN-01
    - WARN-02
    - UX-01
    - UX-02
    - UNIT-05
    - TST-13
  affects:
    - packages/mcp-server/src/utils/trade-replay.ts
    - packages/mcp-server/src/utils/greeks-decomposition.ts
    - packages/mcp-server/src/tools/replay.ts
    - packages/mcp-server/src/tools/exit-analysis.ts
    - packages/mcp-server/src/tools/batch-exit-analysis.ts
    - packages/mcp-server/src/utils/batch-exit-analysis.ts
tech_stack:
  added: []
  patterns:
    - greeksWarning computed from fullPath null-rate in handler
    - entryCost computed from replayLegs.reduce and passed to trigger configs
    - skippedTrades array replaces opaque skippedCount for error reporting
key_files:
  created: []
  modified:
    - packages/mcp-server/src/utils/trade-replay.ts
    - packages/mcp-server/src/utils/greeks-decomposition.ts
    - packages/mcp-server/src/tools/replay.ts
    - packages/mcp-server/src/tools/exit-analysis.ts
    - packages/mcp-server/src/tools/batch-exit-analysis.ts
    - packages/mcp-server/src/utils/batch-exit-analysis.ts
decisions:
  - DTE fix: 4PM ET expiry uses +16*60*60*1000 ms offset on local midnight Date
  - greeksWarning computed in handleReplayTrade from fullPath (not in computeStrategyPnlPath) to avoid changing pure function signature
  - skippedTrades cast simplified: BatchExitResult now has skippedTrades field directly
  - test-exports.ts already had Bachelier exports from Plan 73-01; no changes needed
metrics:
  duration_seconds: 360
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_modified: 6
---

# Phase 73 Plan 03: Wire Integration Layer Summary

Wire Bachelier model selection into replay pipeline, fix DTE bug, add greeks warnings, add unit field to Zod schemas, add skip details to batch tool, change replay default format, update test exports.

## What Was Built

All tool handlers updated to connect the pure math (Plan 01) and pure logic (Plan 02) changes to the MCP tool layer. Users now get working 0DTE greeks, percentage-based exit triggers, and improved error feedback.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Fix DTE + greeks warnings + replay default | 85b004c | DTE 4PM fix, greeksWarning, sampled default |
| 2 | unit field + entryCost + skippedTrades | 1a46f0a | Zod schemas, entryCost, skippedTrades array |

## Changes by File

### packages/mcp-server/src/utils/trade-replay.ts
- Fixed DTE calculation: `new Date(eyy, emm-1, edd).getTime() + 16*60*60*1000` so 0DTE trades compute fractional DTE to 4:00 PM ET rather than midnight
- Added `greeksWarning?: string | null` field to `ReplayResult` interface

### packages/mcp-server/src/tools/replay.ts
- Changed `format` default from `"summary"` to `"sampled"` (D-14)
- Updated format description to reflect new default
- Added greeksWarning computation after fullPath: iterates legGreeks, counts null deltas, emits warning string when >50% are null
- Returns `greeksWarning` in result object

### packages/mcp-server/src/utils/greeks-decomposition.ts
- Added `warning?: string | null` to `GreeksDecompositionResult` interface (D-13)
- Added residual warning: computes `residualPct = abs(totalResidual) / abs(totalPnlChange)`, emits warning string when >80%
- Empty path early return also includes `warning: null`

### packages/mcp-server/src/tools/exit-analysis.ts
- Added `unit: z.enum(['percent', 'dollar']).default('dollar').optional()` to `triggerConfigSchema`
- Added `entryCost` computation from `replayLegs.reduce` after replay call
- Added `unit: t.unit` and `entryCost` to both `exitTriggers` and `legGroupConfigs` trigger mappings

### packages/mcp-server/src/tools/batch-exit-analysis.ts
- Added `unit: z.enum(['percent', 'dollar']).default('dollar').optional()` to `triggerConfigSchema`
- Replaced `let skippedCount = 0` with `const skippedTrades: Array<{tradeIndex, dateOpened, error}>[]`
- Replaced bare `skippedCount++` catch block with `skippedTrades.push({tradeIndex, dateOpened, error})`
- Added `tradeEntryCost` computation per-trade from `replayResult.legs.reduce`
- Added `entryCost: tradeEntryCost` to `TradeInput` construction
- Updated summary augmentation to use `skippedTrades.length` and set `result.skippedTrades`

### packages/mcp-server/src/utils/batch-exit-analysis.ts
- Added `entryCost?: number` to `TradeInput` interface
- Added `skippedTrades?: Array<{tradeIndex, dateOpened, error}>` to `BatchExitResult` interface
- In `analyzeBatch`: copies `entryCost` from trade onto each trigger config via `triggersWithCost = candidatePolicy.map(t => ({...t, entryCost}))`

## Deviations from Plan

### Auto-fixed Issues

None.

### Scope Clarification

**test-exports.ts: No changes needed**

The plan specified adding Bachelier exports to test-exports.ts. On inspection, these were already added by Plan 73-01 (lines 213-232). The file already exports `pdf`, `cdf`, `bachelierPrice`, `bachelierDelta`, `bachelierGamma`, `bachelierTheta`, `bachelierVega`, `solveNormalIV`, and `BACHELIER_DTE_THRESHOLD` from `./utils/black-scholes.js`. No duplicate exports added.

**greeksWarning computed in handler (not in pure function)**

The plan suggested adding greeksNullCount/greeksTotalCount to `computeStrategyPnlPath`. Since that function returns `PnlPoint[]` (not an object), computing the warning in the handler by iterating `fullPath` achieves the same result while preserving the pure function's signature and avoiding a breaking change to its return type.

## Verification

```
TypeScript: npx tsc --noEmit => 0 errors
Tests: 102 passed (exit-triggers.test.ts + black-scholes.test.ts)
```

## Known Stubs

None.

## Self-Check: PASSED

Files verified:
- packages/mcp-server/src/utils/trade-replay.ts: contains `+ 16 * 60 * 60 * 1000`
- packages/mcp-server/src/utils/trade-replay.ts: contains `greeksWarning` in ReplayResult
- packages/mcp-server/src/tools/replay.ts: contains `.default("sampled")`
- packages/mcp-server/src/tools/replay.ts: contains `greeksNullCount / greeksTotalCount > 0.5`
- packages/mcp-server/src/utils/greeks-decomposition.ts: contains `warning?: string | null`
- packages/mcp-server/src/utils/greeks-decomposition.ts: contains `residualPct > 0.8`
- packages/mcp-server/src/tools/exit-analysis.ts: contains `unit: z.enum(['percent', 'dollar'])`
- packages/mcp-server/src/tools/exit-analysis.ts: contains `entryCost` from `replayLegs.reduce`
- packages/mcp-server/src/tools/batch-exit-analysis.ts: contains `skippedTrades` array
- packages/mcp-server/src/tools/batch-exit-analysis.ts: does NOT contain bare `skippedCount++`
- packages/mcp-server/src/test-exports.ts: contains `bachelierPrice`, `pdf`, `cdf`, `BACHELIER_DTE_THRESHOLD` (pre-existing from 73-01)

Commits verified:
- 85b004c: feat(73-03): fix DTE 4PM expiry, add greeksWarning, change replay default to sampled
- 1a46f0a: feat(73-03): add unit field to Zod schemas, entryCost computation, skippedTrades array
