---
phase: 73-0dte-greeks-engine
plan: "02"
subsystem: exit-triggers
tags: [tdd, exit-triggers, percentage-based, unit-field]
dependency_graph:
  requires: []
  provides: [ExitTriggerConfig.unit, ExitTriggerConfig.entryCost, percentage-based-trigger-evaluation]
  affects: [analyze_exit_triggers, batch_exit_analysis]
tech_stack:
  added: []
  patterns: [tdd-red-green, percentage-threshold-computation]
key_files:
  created: []
  modified:
    - packages/mcp-server/src/utils/exit-triggers.ts
    - packages/mcp-server/tests/unit/exit-triggers.test.ts
decisions:
  - "unit=percent returns null (no fire) when entryCost is not provided — cannot compute dollar threshold"
  - "dollarThreshold = threshold * abs(entryCost) handles both credit (negative) and debit (positive) entryCost"
  - "Other trigger types (dteExit, etc.) fall through switch without checking unit field"
metrics:
  duration_seconds: 86
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_modified: 2
---

# Phase 73 Plan 02: Percentage-Based Exit Trigger Unit Field Summary

Percentage-based exit triggers using `unit:'percent'` and `entryCost` to compute dollar threshold as `threshold * abs(entryCost)` for profitTarget and stopLoss.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | TDD RED: write failing tests for unit:percent | 95e16eb | tests/unit/exit-triggers.test.ts |
| 2 | TDD GREEN: implement unit field and percentage evaluation | a71ef3f | src/utils/exit-triggers.ts |

## What Was Built

Extended `ExitTriggerConfig` with two new optional fields:

- `unit?: 'percent' | 'dollar'` — specifies whether `threshold` is a dollar amount (default) or a fraction of entry cost
- `entryCost?: number` — the cost/credit of the position entry; negative = credit received (e.g., -350 for a $3.50 credit spread)

Modified `evaluateTrigger` to handle both triggers:

**profitTarget with `unit:'percent'`:** `dollarThreshold = threshold * abs(entryCost)`. Fires when `pnl >= dollarThreshold`. Returns null (no fire) if `entryCost` is not set.

**stopLoss with `unit:'percent'`:** `dollarThreshold = threshold * abs(entryCost)`. Fires when `pnl <= -dollarThreshold`. Returns null (no fire) if `entryCost` is not set.

All other trigger types ignore the `unit` field entirely — they fall through the switch without any change. Existing dollar-based behavior is fully preserved for `unit:'dollar'` and `unit:undefined`.

## Tests Added (8 new)

| Test | Description |
|------|-------------|
| profitTarget credit spread | threshold=0.7, entryCost=-350 → fires at pnl=246 (>= 245) |
| profitTarget debit spread | threshold=0.5, entryCost=500 → fires at pnl=250 |
| profitTarget just below threshold | pnl=244 < 245 → no fire |
| profitTarget no entryCost | unit=percent but entryCost omitted → null |
| profitTarget unit:dollar explicit | identical to current dollar behavior |
| profitTarget unit:undefined | backwards compat preserved |
| stopLoss fires at percentage threshold | threshold=2.0, entryCost=-350 → fires at pnl=-701 |
| stopLoss no entryCost | unit=percent but entryCost omitted → null |
| stopLoss just above threshold | pnl=-699 > -700 → no fire |
| dteExit ignores unit field | DTE-based trigger fires normally regardless of unit |
| analyzeExitTriggers passes entryCost through | end-to-end test via analyze orchestrator |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `packages/mcp-server/src/utils/exit-triggers.ts` — FOUND
- `packages/mcp-server/tests/unit/exit-triggers.test.ts` — FOUND
- Commit 95e16eb — test(73-02): add failing tests for percentage-based exit triggers — FOUND
- Commit a71ef3f — feat(73-02): add unit field to ExitTriggerConfig and percentage-based evaluation — FOUND
- All 46 tests pass (38 pre-existing + 8 new)
