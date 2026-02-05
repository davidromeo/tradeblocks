---
phase: 47-monte-carlo-regime-comparison
plan: 01
subsystem: calculations
tags: [monte-carlo, regime-comparison, divergence-classification, edge-decay]
completed: 2026-02-05
duration: ~5min
requires: [46-core-calculation-engines]
provides: [mc-regime-comparison-engine, divergence-classification, exported-calculateDefaultRecentWindow]
affects: [47-02-mcp-tool, 50-verdict-synthesis]
tech-stack:
  added: []
  patterns: [dual-simulation-comparison, threshold-based-classification]
key-files:
  created:
    - packages/lib/calculations/mc-regime-comparison.ts
    - tests/unit/mc-regime-comparison.test.ts
  modified:
    - packages/lib/calculations/rolling-metrics.ts
    - packages/lib/calculations/index.ts
decisions:
  - Same initialCapital and tradesPerYear used for both simulations to ensure fair comparison
  - Different random seeds for full vs recent (seed+10000) to avoid correlated randomness
  - RecentWindowSize clamped to 50% of total when it exceeds trade count
  - Divergence scores capped at 5.0 for expectedReturn, sharpeRatio, medianMaxDrawdown to prevent outlier domination
metrics:
  tasks: 2/2
  tests: 22 passed
  test-suites: 1 passed
  full-suite: 1108 passed / 68 suites
---

# Phase 47 Plan 01: MC Regime Comparison Engine Summary

Dual Monte Carlo simulation engine comparing full trade history vs recent window, with four-metric comparison and threshold-based divergence classification (aligned/mild/significant/regime_break).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Export calculateDefaultRecentWindow and create MC regime comparison engine | 0bbfb91 | rolling-metrics.ts, mc-regime-comparison.ts, index.ts |
| 2 | TDD tests for MC regime comparison engine | e8a474e | mc-regime-comparison.test.ts |

## What Was Built

### MC Regime Comparison Engine (`mc-regime-comparison.ts`)

**Main function: `runRegimeComparison(trades, options?)`**
- Filters by strategy (case-insensitive), sorts chronologically
- Validates minimum 30 trades
- Resolves defaults: recentWindowSize via `calculateDefaultRecentWindow`, numSimulations=1000, randomSeed=42
- Clamps recentWindowSize to 50% of total if it exceeds trade count
- Runs `runMonteCarloSimulation` twice with `resampleMethod: 'percentage'`:
  - Full history pool with seed N
  - Recent window pool with seed N+10000
- Compares four metrics with delta, percentChange, and per-metric divergenceScore:
  - `probabilityOfProfit`: normalized by 0.10 (10pp = score 1.0)
  - `expectedReturn`: relative change, capped at 5.0
  - `sharpeRatio`: relative change scaled by max(0.5, |fullValue|), capped at 5.0
  - `medianMaxDrawdown`: relative change, capped at 5.0

**Pure function: `classifyDivergence(comparisons)`**
- Computes composite score = mean of per-metric divergence scores
- Classifies: aligned (<0.30), mild_divergence (<0.60), significant_divergence (<1.00), regime_break (>=1.00)
- Returns factual scoreDescription with no interpretive labels

### Exported `calculateDefaultRecentWindow` from rolling-metrics.ts
- Changed from private to exported function
- Formula: `max(round(tradeCount * 0.2), 200)`, capped at tradeCount
- Enables reuse across mc-regime-comparison and future phases

### Test Coverage (22 tests)
- 10 tests for `runRegimeComparison` (insufficient trades, defaults, strategy filter, window clamping, date ranges, metric structure)
- 6 tests for `classifyDivergence` (all four severity levels, factual description, empty comparisons)
- 6 edge case tests (determinism, all-winners, regime detection, metric validation, simulationLength defaults)

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Same initialCapital for both simulations | Avoids Pitfall 3 from research: different capital bases produce incomparable percentage metrics |
| Same tradesPerYear for both simulations | Avoids Pitfall 4: consistent annualization across both runs |
| Different seeds (N vs N+10000) | Prevents correlated sampling between full and recent simulations |
| Cap divergence scores at 5.0 | Prevents single extreme metric from dominating composite score |
| worstCaseEnabled: false | Per research: worst-case injection muddies regime comparison signal |

## Verification Results

1. TypeScript: No errors in modified files
2. MC regime comparison tests: 22/22 passed
3. Full test suite: 1108/1108 passed (68 suites, 0 failures)
4. No interpretive labels found in calculation code

## Next Phase Readiness

Plan 47-02 (MCP tool registration) can proceed immediately. The engine exports:
- `runRegimeComparison` -- main entry point
- `classifyDivergence` -- pure classification function
- All TypeScript interfaces: `MCRegimeComparisonOptions`, `MCRegimeComparisonResult`, `MetricComparison`, `DivergenceSeverity`
