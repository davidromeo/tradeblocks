---
phase: 47-monte-carlo-regime-comparison
verified: 2026-02-05T15:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 47: Monte Carlo Regime Comparison Verification Report

**Phase Goal:** Users can compare forward-looking risk profiles between full trade history and recent trading window

**Verified:** 2026-02-05T15:30:00Z

**Status:** passed

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Monte Carlo simulation runs on full trade history using percentage-based resampling | ✓ VERIFIED | `mc-regime-comparison.ts:261` sets `resampleMethod: 'percentage'` for fullParams, calls `runMonteCarloSimulation(fullPool, fullParams)` at line 267 |
| 2 | Monte Carlo simulation runs on only the recent window trades (configurable, default ~200) | ✓ VERIFIED | Recent pool extracted via `sortedTrades.slice(-recentWindowSize)` at line 255, default via `calculateDefaultRecentWindow()` at line 241, separate simulation with seed+10000 at lines 270-274 |
| 3 | P(Profit), expected return, Sharpe, and median max drawdown are compared between the two simulations | ✓ VERIFIED | Four metrics compared at lines 277-282: `probabilityOfProfit`, `expectedReturn` (meanTotalReturn), `sharpeRatio` (meanSharpeRatio), `medianMaxDrawdown`. Each MetricComparison includes delta, percentChange, divergenceScore |
| 4 | Regime divergence is classified into severity levels (aligned / mild divergence / significant divergence / regime break) | ✓ VERIFIED | `classifyDivergence()` function at lines 144-172 implements threshold-based classification: <0.30→aligned, <0.60→mild_divergence, <1.00→significant_divergence, >=1.00→regime_break. Tests verify all four levels (tests 11-14) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/lib/calculations/mc-regime-comparison.ts` | MC regime comparison engine with dual simulation, metric comparison, and divergence classification | ✓ VERIFIED | 337 lines, exports runRegimeComparison, classifyDivergence, all type interfaces. Calls runMonteCarloSimulation twice (lines 267, 274) with different seeds. No stubs, no TODO/FIXME comments |
| `tests/unit/mc-regime-comparison.test.ts` | Test coverage for regime comparison engine | ✓ VERIFIED | 462 lines, 22 tests passed (10 for runRegimeComparison, 6 for classifyDivergence, 6 edge cases). Tests validate all success criteria including determinism, classification thresholds, strategy filtering |
| `packages/lib/calculations/rolling-metrics.ts` | Exports calculateDefaultRecentWindow | ✓ VERIFIED | Function exported at line 132: `export function calculateDefaultRecentWindow(tradeCount: number)` |
| `packages/lib/calculations/index.ts` | Barrel export for mc-regime-comparison | ✓ VERIFIED | Line 26: `export * from './mc-regime-comparison'` |
| `packages/mcp-server/src/tools/edge-decay.ts` | analyze_regime_comparison MCP tool registered | ✓ VERIFIED | Tool registered at lines 240-393 with Zod schema validation, calls runRegimeComparison at line 311, returns text summary + structured JSON via createToolOutput |
| `packages/mcp-server/package.json` | Version bump for new MCP tool | ✓ VERIFIED | Version bumped to 0.7.1 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| mc-regime-comparison.ts | monte-carlo.ts | runMonteCarloSimulation | ✓ WIRED | Import at line 14, called twice (lines 267, 274) with different seeds and pools |
| mc-regime-comparison.ts | rolling-metrics.ts | calculateDefaultRecentWindow | ✓ WIRED | Import at line 16, called at line 241 to compute default recentWindowSize |
| index.ts | mc-regime-comparison.ts | barrel export | ✓ WIRED | Export at line 26, module available via `@tradeblocks/lib` |
| edge-decay.ts | mc-regime-comparison.ts | runRegimeComparison | ✓ WIRED | Import at line 16, called at line 311 within MCP tool handler |
| edge-decay.ts | output-formatter.ts | createToolOutput | ✓ WIRED | Import at line 11, called at line 379 to return JSON-first response |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| MCRG-01: MC simulation on full history with percentage-based resampling | ✓ SATISFIED | `resampleMethod: 'percentage'` at line 261, fullPool simulation at line 267 |
| MCRG-02: MC simulation on recent window (configurable, default ~200) | ✓ SATISFIED | Recent pool at line 255, default via calculateDefaultRecentWindow (max(20% trades, 200)), separate simulation at line 274 |
| MCRG-03: Compare P(Profit), expected return, Sharpe, median max drawdown | ✓ SATISFIED | Four metrics compared at lines 277-282 with delta, percentChange, divergenceScore computation |
| MCRG-04: Classify regime divergence severity | ✓ SATISFIED | classifyDivergence() at lines 144-172 with four severity levels, threshold-based classification |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns detected |

**Scan Results:**
- No TODO/FIXME/XXX/HACK comments
- No console.log statements
- No placeholder text
- No empty returns or stub implementations
- No interpretive labels in calculation code (verified via grep)

### Human Verification Required

None. All success criteria are programmatically verifiable through:
1. Static code analysis (grep/file inspection)
2. Unit test execution (22 tests passed)
3. TypeScript compilation (no errors)
4. Integration test (MCP server builds successfully)

## Verification Details

### Truth 1: Full History MC Simulation

**Implementation:**
```typescript
// Line 258-267
const fullParams: MonteCarloParams = {
  numSimulations,
  simulationLength,
  resampleMethod: 'percentage',  // ✓ Percentage-based
  initialCapital,
  tradesPerYear,
  randomSeed,
  worstCaseEnabled: false,
}
const fullResult = runMonteCarloSimulation(fullPool, fullParams)
```

**Tests:**
- Test 2: Basic execution verifies fullHistory statistics structure
- Test 17: Determinism verified with fixed seed
- Test 18: All winning trades produce high P(Profit)

### Truth 2: Recent Window MC Simulation

**Implementation:**
```typescript
// Line 241: Default window calculation
let recentWindowSize = options?.recentWindowSize ?? calculateDefaultRecentWindow(sortedTrades.length)

// Line 255: Recent pool extraction
const recentPool = sortedTrades.slice(-recentWindowSize)

// Lines 270-274: Separate simulation with different seed
const recentParams: MonteCarloParams = {
  ...fullParams,
  randomSeed: randomSeed + 10000,  // ✓ Different seed
}
const recentResult = runMonteCarloSimulation(recentPool, recentParams)
```

**Tests:**
- Test 3: Verifies calculateDefaultRecentWindow formula (max(20% * 500, 200) = 200)
- Test 4: Custom recentWindowSize honored
- Test 9: RecentWindowSize clamped to 50% when >= trade count

### Truth 3: Four Metrics Compared

**Implementation:**
```typescript
// Lines 277-299: Four metric comparisons
const metricPairs: [string, number, number][] = [
  ['probabilityOfProfit', fullResult.statistics.probabilityOfProfit, recentResult.statistics.probabilityOfProfit],
  ['expectedReturn', fullResult.statistics.meanTotalReturn, recentResult.statistics.meanTotalReturn],
  ['sharpeRatio', fullResult.statistics.meanSharpeRatio, recentResult.statistics.meanSharpeRatio],
  ['medianMaxDrawdown', fullResult.statistics.medianMaxDrawdown, recentResult.statistics.medianMaxDrawdown],
]

const comparison: MetricComparison[] = metricPairs.map(([metric, fullValue, recentValue]) => {
  const delta = recentValue - fullValue
  const percentChange = fullValue !== 0 ? (delta / Math.abs(fullValue)) * 100 : null
  const divergenceScore = computeDivergenceScore(metric, fullValue, delta)
  return { metric, fullHistoryValue: fullValue, recentWindowValue: recentValue, delta, percentChange, divergenceScore }
})
```

**Tests:**
- Test 8: Verifies exactly 4 metrics in comparison array
- Test 20: Each comparison has valid delta and percentChange

### Truth 4: Divergence Classification

**Implementation:**
```typescript
// Lines 158-167: Threshold-based classification
let severity: DivergenceSeverity
if (compositeScore < 0.30) {
  severity = 'aligned'
} else if (compositeScore < 0.60) {
  severity = 'mild_divergence'
} else if (compositeScore < 1.00) {
  severity = 'significant_divergence'
} else {
  severity = 'regime_break'
}
```

**Tests:**
- Test 11: aligned classification (<0.30)
- Test 12: mild_divergence classification (0.30-0.60)
- Test 13: significant_divergence classification (0.60-1.00)
- Test 14: regime_break classification (>=1.00)
- Test 15: Score description is factual, contains composite score value
- Test 19: Recent window much worse produces at least mild_divergence

### MCP Tool Integration

**Tool Registration:**
- Tool name: `analyze_regime_comparison`
- Input schema: Zod-validated with blockId (required), strategy, recentWindowSize, numSimulations, simulationLength, randomSeed (all optional)
- Output: Text summary + structured JSON with fullHistory, recentWindow, comparison, divergence, parameters
- Error handling: Catches insufficient trades (<30), no trades, and general errors

**Verification:**
- MCP server builds without errors (0.7.1)
- Tool registered at lines 240-393 in edge-decay.ts
- Calls runRegimeComparison with pre-filtered trades (strategy filter applied before call)
- Returns JSON-first output via createToolOutput

### Test Suite Results

**MC Regime Comparison Tests:** 22/22 passed
- runRegimeComparison: 10 tests
- classifyDivergence: 6 tests
- edge cases: 6 tests

**Full Test Suite:** 1108/1108 passed (68 suites)
- No regressions introduced

**Test Coverage:**
- Insufficient trades validation
- Default window calculation
- Custom window configuration
- Strategy filtering (case-insensitive)
- Date range extraction
- Metric comparison structure
- Window clamping
- All four divergence severity levels
- Determinism with fixed seeds
- Regime detection with degraded recent window
- Metric validity checks

## Phase Completion Assessment

Phase 47 has achieved its goal: **Users can compare forward-looking risk profiles between full trade history and recent trading window**.

All four success criteria from ROADMAP.md are verified:
1. ✓ MC simulation runs on full trade history using percentage-based resampling
2. ✓ MC simulation runs on only the recent window trades (configurable, default ~200)
3. ✓ P(Profit), expected return, Sharpe, and median max drawdown are compared
4. ✓ Regime divergence is classified into severity levels

All four requirements (MCRG-01 through MCRG-04) are satisfied.

**Two plans completed:**
- 47-01: MC regime comparison engine + 22 TDD tests
- 47-02: MCP tool registration + version bump

**Delivered artifacts:**
- Core calculation engine: `mc-regime-comparison.ts` (337 lines, no stubs)
- Comprehensive tests: `mc-regime-comparison.test.ts` (462 lines, 22 tests)
- MCP tool: `analyze_regime_comparison` registered in edge-decay.ts
- Exported helper: `calculateDefaultRecentWindow` from rolling-metrics.ts
- Version bump: MCP server 0.7.1

**Phase is ready for:**
- Phase 48: Walk-Forward Degradation (independent)
- Phase 49: Live Alignment Signal (independent)
- Phase 50: Verdict Synthesis & Tool Registration (depends on 47, 48, 49)

---

_Verified: 2026-02-05T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
