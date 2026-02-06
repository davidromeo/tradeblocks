---
phase: quick-010
plan: 01
subsystem: calculations, mcp-server
tags: [monte-carlo, health-check, similarity, edge-decay, null-handling]
dependency-graph:
  requires: []
  provides:
    - Additive MC simulation for percentage mode
    - MinSamples guard on health check correlation and tail flags
    - Recommendation-free similarity output
    - Null fallback for edge decay win rate and profit factor
  affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - packages/lib/calculations/monte-carlo.ts
    - packages/mcp-server/src/tools/blocks/health.ts
    - packages/mcp-server/src/tools/blocks/similarity.ts
    - packages/mcp-server/tests/integration/strategy-similarity.test.ts
    - packages/lib/calculations/edge-decay-synthesis.ts
    - tests/unit/edge-decay-synthesis.test.ts
    - packages/mcp-server/src/tools/edge-decay.ts
decisions: []
metrics:
  duration: ~6 minutes
  completed: 2026-02-06
---

# Quick Task 010: MC Additive Mode, MinSamples Guard, Remove Recs, Null Fallback Summary

**One-liner:** Additive MC for percentage returns, minSamples>=10 on health flags, remove similarity recommendations, null fallback for edge decay win rate/profit factor.

## Task Commits

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | MC additive mode for percentage returns | d73c261 | Replace multiplicative compounding with additive cumulative return in percentage mode |
| 2 | Health check minSamples guard | ec82f03 | Add sampleSize >= 10 check to correlation and tail dependence flags |
| 3 | Remove similarity recommendations | bef771e | Remove recommendation field, recommendations array, 4 tests |
| 4 | Edge decay 0 to null | 17e4f1d | Change win rate and profit factor fallback from 0 to null |

## Changes Made

### Task 1: MC Additive Mode for Percentage Returns
In `runSingleSimulation()`, replaced multiplicative compounding (`capital = capital * (1 + value)`) with additive cumulative return (`cumulativeReturn += value; capital = initialCapital * (1 + cumulativeReturn)`). This prevents blowup where sequential -99% margin returns compound to near-zero, making MC simulations unreliable for margin-based percentage mode.

### Task 2: Health Check MinSamples Guard
Added `sampleSize >= 10` guard to both correlation flag and tail dependence flag conditions in the health check tool. Moved `sampleSize` and `pairSampleSize` variable declarations above their respective `if` conditions so they're available for the guard check. Prevents false-positive health warnings from low-sample strategy pairs.

### Task 3: Remove Similarity Recommendations
Removed all interpretive recommendation logic from the strategy similarity tool:
- Removed `recommendation` field from `SimilarPair` interface
- Removed per-pair recommendation generation block
- Removed top-level `recommendations` array construction
- Removed `recommendations` from structured output
- Removed 4 recommendation-specific tests from test suite
- Updated test helper function to match

### Task 4: Edge Decay Summary 0 to Null
Changed `EdgeDecaySummary` interface fields `recentWinRate`, `historicalWinRate`, `recentProfitFactor`, `historicalProfitFactor` from `number` to `number | null`. Changed fallback from `?? 0` to `?? null`. Updated `fmtPct` in MCP edge-decay tool to handle null values (returns "N/A"). Updated test assertions to accept both number and null.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated fmtPct in edge-decay.ts to handle null**
- **Found during:** Task 4
- **Issue:** Changing win rate/profit factor types to `number | null` caused type error in MCP edge-decay tool where `fmtPct` expected `number`
- **Fix:** Updated `fmtPct` signature from `(v: number)` to `(v: number | null)` with null check returning "N/A"
- **Files modified:** packages/mcp-server/src/tools/edge-decay.ts
- **Commit:** 17e4f1d

## Verification

- `npm test -- tests/unit/monte-carlo.test.ts`: 18/18 passed
- `npm test -- packages/mcp-server (all)`: 180/180 passed
- `npm test -- tests/unit/edge-decay-synthesis.test.ts`: 18/18 passed
- `npx tsc --noEmit -p packages/lib/tsconfig.json`: clean
- `npm run build`: success
- MCP server build: success

## Self-Check: PASSED
