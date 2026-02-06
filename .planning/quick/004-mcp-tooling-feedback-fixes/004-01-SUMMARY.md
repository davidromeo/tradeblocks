# Quick Task 004 - Task 1: Fix dollar-metric pollution and remove MC severity labels

## One-liner

Add metricType classification to FactualObservation, filter dollar metrics from topObservations/compositeDecayScore, and remove DivergenceSeverity labels from MC regime comparison output.

## Task Commits

| # | Hash | Description | Files |
|---|------|-------------|-------|
| 1a | 4d7695f | Filter dollar-value metrics from topObservations and compositeDecayScore | edge-decay-synthesis.ts, edge-decay-synthesis.test.ts |
| 1b | 37d871c | Remove MC regime severity labels from divergence output | mc-regime-comparison.ts, edge-decay-synthesis.ts, edge-decay.ts, mc-regime-comparison.test.ts |

## Changes Made

### Issue 1+2: Dollar-metric pollution in edge-decay-synthesis.ts

- Added `metricType: 'dollar' | 'rate'` field to `FactualObservation` interface
- Created `DOLLAR_METRICS` constant set: avgWin, avgLoss, avgReturn, netPl
- Created `DOLLAR_TREND_METRICS` constant set: netPl, tradeCount (for period trend slopes)
- Classified all observations in `extractObservations()`:
  - Rolling metrics: uses `DOLLAR_METRICS.has()` lookup
  - MC regime metrics: all `'rate'` (probabilityOfProfit, expectedReturn, sharpeRatio, medianMaxDrawdown)
  - WF efficiency metrics: all `'rate'` (sharpeEfficiency, winRateEfficiency, profitFactorEfficiency)
  - Period trend metrics: uses `DOLLAR_TREND_METRICS.has()` for netPl/tradeCount trends
  - Live alignment metrics: all `'rate'` (directionAgreementRate, executionEfficiency)
- Filtered `topObservations` to `metricType === 'rate'` only
- Filtered `meanAbsPercentChange` (compositeDecayScore component) to rate-type observations only
- Dollar observations remain in the full `observations` array with their `metricType: 'dollar'` tag

### Issue 6: Remove MC regime severity labels

- Removed `DivergenceSeverity` type export from mc-regime-comparison.ts
- Removed `severity` field from `MCRegimeComparisonResult.divergence`
- Updated `classifyDivergence()` return type to `{ compositeScore: number; scoreDescription: string }`
- Removed severity classification logic (threshold-based label assignment)
- Removed `severity` from edge-decay-synthesis regime signal summary
- Updated MCP tool description: replaced severity label text with "Returns a composite divergence score (0 = aligned, higher = more divergent)"
- Updated MCP tool summary string: `Divergence: score ${score}` instead of `Divergence: ${severity} (score: ${score})`
- Removed all `.severity` assertions from mc-regime-comparison.test.ts, replaced with compositeScore checks

## Tests

- Added 3 new tests in edge-decay-synthesis.test.ts:
  - 12a: topObservations contains only rate-type metrics
  - 12b: Dollar-type observations exist in full observations array
  - 12c: All observations have metricType field
- Updated 8 tests in mc-regime-comparison.test.ts (removed severity assertions, replaced with compositeScore checks)
- Full test suite: 1180 tests passing across 71 suites

## Verification

- `npm test` -- 1180/1180 pass
- `npx tsc --noEmit -p packages/lib/tsconfig.json` -- clean
- `npx tsc --noEmit -p packages/mcp-server/tsconfig.json` -- clean
- Grep confirms no remaining `DivergenceSeverity` or `.severity` references in packages/ or tests/
- Grep confirms `metricType` field present on FactualObservation and used in all observation creation sites

## Deviations from Plan

None -- plan executed exactly as written.

## Duration

~4 minutes

## Self-Check: PASSED
