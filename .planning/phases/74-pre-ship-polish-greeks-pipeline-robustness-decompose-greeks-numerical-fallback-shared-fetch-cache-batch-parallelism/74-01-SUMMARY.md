---
phase: 74-pre-ship-polish
plan: "01"
subsystem: greeks-engine
tags: [correctness, observability, exit-triggers, black-scholes, bachelier, greeks]
dependency_graph:
  requires: []
  provides: [stopLoss-abs-normalization, bachelier-threshold-0.1, greeks-model-field]
  affects: [exit-triggers.ts, black-scholes.ts]
tech_stack:
  added: []
  patterns: [abs-normalization, model-provenance-field, tdd-red-green]
key_files:
  created: []
  modified:
    - packages/mcp-server/src/utils/exit-triggers.ts
    - packages/mcp-server/src/utils/black-scholes.ts
    - packages/mcp-server/tests/unit/exit-triggers.test.ts
    - packages/mcp-server/tests/unit/black-scholes.test.ts
decisions:
  - "Math.abs(threshold) in stopLoss normalizes negative user-supplied thresholds before comparison"
  - "BACHELIER_DTE_THRESHOLD lowered from 0.5 to 0.1 — BS+bisection now works reliably to ~2.4 hours"
  - "GreeksResult.model field is optional ('bs' | 'bachelier'); undefined only when IV solve fails (null result)"
metrics:
  duration_seconds: 116
  completed_date: "2026-03-24"
  tasks_completed: 1
  files_modified: 4
requirements: [POL-01, POL-06, POL-07, TST-14]
---

# Phase 74 Plan 01: stopLoss abs fix, Bachelier threshold 0.1, GreeksResult.model field

**One-liner:** Correctness and observability fixes — stopLoss abs(threshold) normalization, Bachelier DTE lowered to 0.1 days, GreeksResult gains model provenance field.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Write failing tests for 3 correctness fixes | 0e0989a | tests/unit/exit-triggers.test.ts, tests/unit/black-scholes.test.ts |
| 1 (GREEN) | Implement stopLoss abs, threshold 0.1, model field | 78f4b92 | src/utils/exit-triggers.ts, src/utils/black-scholes.ts |

## What Was Built

### Fix 1: stopLoss abs(threshold) normalization

Users sometimes pass negative thresholds (e.g., threshold=-2 meaning "stop at $2 loss"). Without abs normalization, the comparison `pnl <= -(-2)` became `pnl <= 2`, which fires on any P&L below $2 — including positive P&L. This is a silent correctness bug.

Fix: `const absThreshold = Math.abs(threshold)` before computing `dollarThresholdSL`, so both positive and negative threshold inputs produce the same behavior.

### Fix 2: Lower BACHELIER_DTE_THRESHOLD from 0.5 to 0.1

The Bachelier model was used for DTE < 0.5 days (~12 hours). With the BS+bisection solver from Phase 73, Black-Scholes now converges reliably down to ~2.4 hours (DTE ~0.1). The Bachelier range is narrowed to the last ~2.4 hours of option life where BS truly cannot handle the extreme gamma.

DTE=0.3 (previously Bachelier) now uses BS — this returns log-normal IV instead of normal dollar vol, which is more useful for that maturity range.

### Fix 3: GreeksResult.model field for provenance

Added optional `model?: 'bs' | 'bachelier'` to `GreeksResult`. `computeLegGreeks` sets:
- `model: 'bachelier'` in the Bachelier branch (dte < 0.1)
- `model: 'bs'` in the Black-Scholes branch (dte >= 0.1)
- `model: undefined` in `nullResult` (IV solve failed)

This lets callers distinguish pricing model without inspecting iv magnitude heuristics.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

All files found. All commits present. 110 tests pass.
