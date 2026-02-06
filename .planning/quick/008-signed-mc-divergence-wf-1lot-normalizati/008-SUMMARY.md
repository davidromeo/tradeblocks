---
phase: quick-008
plan: 01
subsystem: edge-decay-analysis
tags: [mc-regime-comparison, walk-forward, normalization, signed-divergence]
dependency-graph:
  requires: [quick-006, quick-007]
  provides: [signed-mc-divergence, wf-1lot-normalization, direction-aware-synthesis]
  affects: [mcp-edge-decay-tool]
tech-stack:
  added: []
  patterns: [signed-divergence-scoring, direction-aware-composite, per-contract-normalization]
key-files:
  created: []
  modified:
    - packages/lib/calculations/mc-regime-comparison.ts
    - packages/lib/calculations/walk-forward-degradation.ts
    - packages/lib/calculations/edge-decay-synthesis.ts
    - tests/unit/mc-regime-comparison.test.ts
    - tests/unit/walk-forward-degradation.test.ts
    - tests/unit/edge-decay-synthesis.test.ts
decisions:
  - id: q008-d1
    decision: "MC divergence scores are signed: negative = degradation, positive = improvement"
    rationale: "Unsigned scores lost direction information, making it impossible to distinguish improvement from degradation"
  - id: q008-d2
    decision: "MDD divergence sign is flipped relative to other metrics"
    rationale: "For MDD, a positive delta (larger drawdown) is degradation, opposite of other metrics where positive delta is improvement"
  - id: q008-d3
    decision: "Edge decay composite only counts MC degradation (negative compositeScore), not improvement"
    rationale: "Composite decay score measures decay -- improvement should contribute 0 to the score, not reduce it"
  - id: q008-d4
    decision: "normalizeTo1Lot divides pl by numContracts, not contracts, to avoid confusion"
    rationale: "Simpler and more intuitive -- each trade's P&L is normalized to what 1 contract would have produced"
  - id: q008-d5
    decision: "useMarginReturns auto-detection computed once and shared between MC and WF signals"
    rationale: "Avoids duplicate computation and ensures consistent behavior between signals"
metrics:
  duration: ~6 minutes
  completed: 2026-02-06
  tests-before: 1188
  tests-after: 1200
  new-tests: 12
---

# Quick Task 008: Signed MC Divergence + WF 1-Lot Normalization Summary

Signed MC regime divergence scores and 1-lot normalization for WF degradation analysis, eliminating the last percent-scaling artifacts in the edge decay pipeline.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Signed MC divergence scores + direction-aware synthesis | fe5f406 | computeDivergenceScore returns signed values; synthesis MC component only counts degradation |
| 2 | WF 1-lot normalization + synthesis passthrough | fcb5905 | normalizeTo1Lot config option; synthesis passes useMarginReturns to WF |

## Changes Made

### Task 1: Signed MC Divergence Scores

**mc-regime-comparison.ts:**
- `computeDivergenceScore()` now returns signed values: negative = degradation, positive = improvement
- `probabilityOfProfit`: `delta / 0.10` (no abs)
- `sharpeRatio`: `sign(delta) * min(5.0, |delta| / max(0.5, |fullValue|))`
- `medianMaxDrawdown`: sign flipped -- positive delta (larger MDD) produces negative score
- Updated JSDoc on `MetricComparison.divergenceScore` and `classifyDivergence`

**edge-decay-synthesis.ts:**
- MC component is now direction-aware: `mcDecayDirection = compositeScore < 0 ? 1 : 0`
- Only degradation (negative compositeScore) contributes to composite decay score
- When MC shows improvement (positive compositeScore), its contribution is 0

**Tests added (7):** Tests 29-35 for signed divergence behavior, updated tests 19 and 20 for signed semantics.

### Task 2: WF 1-Lot Normalization

**walk-forward-degradation.ts:**
- Added `normalizeTo1Lot?: boolean` to `WFDConfig` interface
- When true, creates normalized trade copies: `pl = numContracts > 0 ? pl / numContracts : pl`
- Handles `numContracts=0` gracefully (keeps original P&L)
- Normalized trades used for all metric computations (Sharpe, profit factor)

**edge-decay-synthesis.ts:**
- Moved `useMarginReturns` auto-detection before both MC and WF signals (computed once)
- WF call now receives `{ normalizeTo1Lot: useMarginReturns }`

**Tests added (5):** Tests 23-26 for normalization behavior, plus test 15 for direction-aware MC component in synthesis.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- Full test suite: 1200/1200 tests pass (12 new tests)
- No new TypeScript errors introduced (pre-existing TS errors in unrelated test files)
- All 8 success criteria met

## Self-Check: PASSED
