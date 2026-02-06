---
phase: quick-007
plan: 01
subsystem: calculations
tags: [monte-carlo, margin-returns, regime-comparison, edge-decay]
completed: 2026-02-06
duration: ~5 minutes
requires: []
provides:
  - calculateMarginReturns function in monte-carlo.ts
  - precomputedReturns support in MonteCarloParams
  - useMarginReturns option in MCRegimeComparisonOptions
  - Auto-detection of margin eligibility in edge-decay-synthesis
affects: []
tech-stack:
  added: []
  patterns:
    - Margin-based ROM (pl/marginReq) as alternative to capital-based percentage returns
key-files:
  created: []
  modified:
    - packages/lib/calculations/monte-carlo.ts
    - packages/lib/calculations/mc-regime-comparison.ts
    - packages/lib/calculations/edge-decay-synthesis.ts
    - tests/unit/mc-regime-comparison.test.ts
    - tests/unit/edge-decay-synthesis.test.ts
decisions:
  - id: q007-d1
    description: "Use median marginReq as initialCapital for margin-based MC simulations"
    rationale: "Median is more robust to outlier margin requirements than mean"
  - id: q007-d2
    description: "90% threshold for auto-detecting margin returns eligibility"
    rationale: "High threshold ensures margin returns are only used when nearly all trades have valid marginReq data"
metrics:
  tasks: 3/3
  tests-added: 8
  tests-total: 1188
---

# Quick Task 007: Margin-Based ROM for MC Regime Comparison Summary

Margin-based Return on Margin (pl/marginReq) for MC regime comparison, fixing contaminated percentage returns when strategy-filtered trades come from multi-strategy portfolios where fundsAtClose reflects full portfolio equity.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add calculateMarginReturns and precomputedReturns | 6a7665d | calculateMarginReturns(), precomputedReturns in MonteCarloParams |
| 2 | Wire useMarginReturns through regime comparison and synthesis | adc021d | useMarginReturns option, median marginReq as initialCapital, auto-detection |
| 3 | Add targeted tests for margin returns path | 7cee4f7 | 8 new tests (3 MC regime, 3 calculateMarginReturns, 2 edge-decay-synthesis) |

## What Was Built

1. **`calculateMarginReturns(trades)`** in `monte-carlo.ts` -- computes `pl / marginReq` for each trade, skipping trades with `marginReq <= 0`. Returns decimal returns like `calculatePercentageReturns`.

2. **`precomputedReturns`** field in `MonteCarloParams` -- when provided with `resampleMethod='percentage'`, these returns are used directly as the resample pool, bypassing `calculatePercentageReturns()`.

3. **`useMarginReturns`** option in `MCRegimeComparisonOptions` -- when true, computes margin returns for both full and recent trade pools, uses median marginReq as initialCapital, and passes precomputed returns to the MC engine.

4. **Auto-detection** in `synthesizeEdgeDecay()` -- checks if >= 90% of trades have `marginReq > 0`. If so, sets `useMarginReturns: true` for the regime comparison call.

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| q007-d1 | Use median marginReq as initialCapital | Median is robust to outlier margin requirements |
| q007-d2 | 90% threshold for margin eligibility auto-detection | High threshold ensures margin returns only used when data is reliably populated |

## Deviations from Plan

None -- plan executed exactly as written.

## Test Results

- **mc-regime-comparison.test.ts**: 28 tests (22 existing + 6 new) -- all passing
- **edge-decay-synthesis.test.ts**: 17 tests (15 existing + 2 new) -- all passing
- **Full suite**: 1188 tests -- all passing
- **Typecheck**: No new errors (pre-existing errors in unrelated files only)

## Self-Check: PASSED
