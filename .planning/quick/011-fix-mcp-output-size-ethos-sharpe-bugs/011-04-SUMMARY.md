---
phase: quick-011
plan: 04
subsystem: mcp-tools, lib-calculations
tags: [live-alignment, regime-performance, pipe-delimiter, data-only-ethos]
dependency-graph:
  requires: [quick-011-01, quick-011-02, quick-011-03]
  provides: [pipe-safe-strategy-keys, data-only-regime-output, unmatched-trade-reporting]
  affects: []
tech-stack:
  added: []
  patterns: [tab-delimited-composite-keys]
key-files:
  created: []
  modified:
    - packages/lib/calculations/live-alignment.ts
    - packages/mcp-server/src/tools/market-data.ts
    - tests/unit/live-alignment.test.ts
decisions:
  - Used tab character as composite key delimiter instead of pipe to avoid strategy name truncation
metrics:
  duration: ~4 minutes
  completed: 2026-02-06
---

# Quick 011 Plan 04: Pipe-safe strategy keys, remove underperforming boolean, remove insight field, add unmatched trade reporting

Tab-delimited composite keys in live-alignment to prevent strategy name truncation; removed interpretive fields (underperforming, insight); added unmatched trade count and dates to regime performance.

## Task Commits

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Fix pipe truncation and remove underperforming | `97d7f3b` | Replace `\|` with `\t` in 5 key construction/parsing sites; remove underperforming from interface and output; update tests |
| 2 | Remove insight field and add unmatched reporting | `fab9027` | Remove insight variable and output field; add tradesTotal, tradesUnmatched, unmatchedDates to regime performance |

## Changes Made

### Task 1: Pipe-safe strategy keys + remove underperforming

**Problem:** Strategy names like "DC 2/7 | Mon, Wed - v2" were truncated because the code used `|` as a composite key delimiter, then split on `|` to extract the strategy name -- taking only the first segment.

**Fix:** Changed all 5 composite key construction and parsing sites in `live-alignment.ts` to use `\t` (tab) instead of `|`. Tab cannot appear in strategy names, dates, or times.

Sites changed:
1. Line ~168: actual trade key construction
2. Line ~188: backtest trade key construction
3. Line ~343: direction agreement day+strategy grouping
4. Line ~356: strategy extraction from key (split on tab)
5. Line ~466: monthly trend day+strategy grouping (plan missed this one)

Also removed the `underperforming: boolean` field from the `ExecutionEfficiencyResult.byStrategy` interface and the corresponding assignment. Consumers can compare `efficiency` to `1.0` themselves.

### Task 2: Remove insight field + add unmatched reporting

**Problem:** The `insight` field in `analyze_regime_performance` output provided interpretive text ("Best performance in X, Weakest in Y") which violates the data-only ethos -- the consuming LLM should derive insights from the segment data itself.

**Fix:** Removed the `insight` variable construction and its inclusion in the output. The `segments` array already provides `vsOverallWinRate` and `vsOverallAvgPl` deltas.

**Problem:** Trades that don't match market data were silently skipped with only `tradesMatched` reported.

**Fix:** Added tracking of unmatched trade dates and three new output fields:
- `tradesTotal`: total trades provided
- `tradesUnmatched`: count of trades without market data matches
- `unmatchedDates`: deduplicated, sorted array of dates where trades had no market data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed monthly trend key construction (line 466)**
- **Found during:** Task 1
- **Issue:** Plan identified 4 pipe-delimited key sites but missed line 466 in the monthly trend section which also uses `${p.date}|${p.strategy}`
- **Fix:** Changed to tab delimiter, same as other sites
- **Files modified:** `packages/lib/calculations/live-alignment.ts`
- **Commit:** `97d7f3b`

## Verification

- `npm run typecheck` (via `npx tsc --noEmit`): passes (only pre-existing errors in walk-forward-store.test.ts)
- `npm test -- tests/unit/live-alignment.test.ts`: 33/33 tests pass
- `npm test`: 1198/1200 pass (2 pre-existing failures in unrelated tests)
- No `insight` string anywhere in market-data.ts
- No `underperforming` string anywhere in live-alignment.ts
- All remaining `|` in live-alignment.ts are TypeScript union types or logical operators

## Self-Check: PASSED
