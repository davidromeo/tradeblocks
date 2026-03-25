---
phase: quick
plan: 260325-qr5
subsystem: exit-triggers
tags: [profitAction, partial-close, exit-analysis, batch-analysis]
dependency_graph:
  requires: []
  provides: [closeAllocationPct-partial-close, evaluateProfitAction-helper]
  affects: [exit-triggers, batch-exit-analysis, exit-analysis-tool, batch-exit-analysis-tool]
tech_stack:
  added: []
  patterns: [partial-close-allocation-tracking, delegation-to-helper-for-complex-evaluator]
key_files:
  created: []
  modified:
    - packages/mcp-server/src/utils/exit-triggers.ts
    - packages/mcp-server/src/utils/batch-exit-analysis.ts
    - packages/mcp-server/src/tools/exit-analysis.ts
    - packages/mcp-server/src/tools/batch-exit-analysis.ts
    - packages/mcp-server/tests/unit/exit-triggers.test.ts
    - packages/mcp-server/tests/unit/batch-exit-analysis.test.ts
decisions:
  - evaluateProfitAction as separate exported helper (evaluateTrigger delegates to it for profitAction type, keeping evaluateTrigger signature unchanged)
  - partialCloses tracked as PartialClose[] with index, pnlAtFire, allocation, trigger fields
  - pnlAtFire in partial close = strategyPnl * remainingAllocation * closeAllocationPct (proportional to remaining position)
  - batch candidatePnl = sum(partialClose.pnlAtFire) + remaining position P&L
metrics:
  duration_seconds: 370
  completed: "2026-03-25T19:25:13Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 11
  files_modified: 6
---

# Quick Task 260325-qr5: Add closeAllocationPct to profitAction Trigger Steps

Partial position closing at profit milestones via closeAllocationPct on profitAction steps, with cascading remaining-allocation tracking and batch P&L aggregation.

## Task 1: Add closeAllocationPct to exit-triggers engine and update Zod schemas

**Commits:** `ba9d8b0` (RED), `911dbb9` (GREEN)

- Added `PartialClose` interface and `evaluateProfitAction` exported helper
- `closeAllocationPct` (0-1) on step type in `ExitTriggerConfig.steps`
- `partialCloses` field on `ExitTriggerResult` populated by `analyzeExitTriggers`
- `evaluateTrigger` delegates profitAction to helper, returning just fireEvent (backward compat)
- Zod schemas in both tool files accept `closeAllocationPct` on steps
- 8 new tests: single partial close, cascading partials, partial+stop retrace, backward compat, mixed steps, percent mode, analyzeExitTriggers integration (x2)

## Task 2: Update batch-exit-analysis P&L aggregation for partial closes

**Commit:** `2adba4d`

- `analyzeBatch` computes candidatePnl as `sum(partialClose.pnlAtFire) + remainingPositionPnl`
- `TradeExitResult` includes optional `partialCloses` for full format output transparency
- 3 new tests: multi-step partial P&L sum, backward compat (no closeAllocationPct), hold-to-end with partial close

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
