---
phase: quick-008
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/lib/calculations/mc-regime-comparison.ts
  - packages/lib/calculations/walk-forward-degradation.ts
  - packages/lib/calculations/edge-decay-synthesis.ts
  - tests/unit/mc-regime-comparison.test.ts
  - tests/unit/walk-forward-degradation.test.ts
  - tests/unit/edge-decay-synthesis.test.ts
autonomous: true

must_haves:
  truths:
    - "MC divergence scores are signed: negative = degradation, positive = improvement"
    - "compositeScore is signed: negative means net degradation across metrics"
    - "WF degradation normalizes trade P&L to 1-lot when normalizeTo1Lot is true"
    - "Edge decay synthesis correctly handles signed MC scores in composite decay score"
    - "All existing tests pass (1188+) plus new tests for signed divergence and 1-lot normalization"
  artifacts:
    - path: "packages/lib/calculations/mc-regime-comparison.ts"
      provides: "Signed divergence scores in computeDivergenceScore()"
      contains: "signed divergence"
    - path: "packages/lib/calculations/walk-forward-degradation.ts"
      provides: "normalizeTo1Lot config option"
      contains: "normalizeTo1Lot"
    - path: "packages/lib/calculations/edge-decay-synthesis.ts"
      provides: "Direction-aware MC component in composite decay score + WF normalization passthrough"
      contains: "mcDecayDirection"
  key_links:
    - from: "packages/lib/calculations/mc-regime-comparison.ts"
      to: "packages/lib/calculations/edge-decay-synthesis.ts"
      via: "compositeScore now signed, synthesis must handle negative values"
      pattern: "compositeScore"
    - from: "packages/lib/calculations/edge-decay-synthesis.ts"
      to: "packages/lib/calculations/walk-forward-degradation.ts"
      via: "passes normalizeTo1Lot option based on useMarginReturns auto-detection"
      pattern: "normalizeTo1Lot"
---

<objective>
Fix two remaining edge decay % scaling issues: (1) Make MC regime divergence scores signed so negative = degradation and positive = improvement, and (2) Add 1-lot normalization to WF degradation so dollar P&L growth from position sizing doesn't contaminate IS/OOS efficiency comparisons.

Purpose: These two fixes eliminate the last % scaling artifacts in the edge decay analysis pipeline, ensuring the composite decay score accurately reflects whether performance is improving or degrading.

Output: Updated mc-regime-comparison.ts, walk-forward-degradation.ts, edge-decay-synthesis.ts with corresponding test updates.
</objective>

<execution_context>
@/Users/davidromeo/.claude/get-shit-done/workflows/execute-plan.md
@/Users/davidromeo/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/lib/calculations/mc-regime-comparison.ts
@packages/lib/calculations/walk-forward-degradation.ts
@packages/lib/calculations/edge-decay-synthesis.ts
@tests/unit/mc-regime-comparison.test.ts
@tests/unit/walk-forward-degradation.test.ts
@tests/unit/edge-decay-synthesis.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Signed MC divergence scores + direction-aware synthesis</name>
  <files>
    packages/lib/calculations/mc-regime-comparison.ts
    packages/lib/calculations/edge-decay-synthesis.ts
    tests/unit/mc-regime-comparison.test.ts
    tests/unit/edge-decay-synthesis.test.ts
  </files>
  <action>
**mc-regime-comparison.ts -- Make `computeDivergenceScore()` return signed values (line 157):**

Currently uses `Math.abs(delta)` making scores always positive. Change to signed:

- For `probabilityOfProfit`: return `delta / 0.10` (no abs). Negative delta (lower recent P(profit)) = negative score = degradation.
- For `sharpeRatio`: return `sign(delta) * Math.min(5.0, Math.abs(delta) / Math.max(0.5, Math.abs(fullValue)))`. Negative delta = negative score = degradation.
- For `medianMaxDrawdown`: **flip sign** -- return `-(delta) / Math.max(0.01, fullValue)`, capped at [-5.0, 5.0]. Positive delta (larger MDD) = degradation = should produce negative score. So: `const raw = delta / Math.max(0.01, fullValue); return -Math.sign(raw) * Math.min(5.0, Math.abs(raw))`. Wait, simpler: MDD increasing (positive delta) is bad, so negate: `return -Math.min(5.0, delta / Math.max(0.01, fullValue))`. If delta is +0.04 and fullValue is 0.08, raw = 0.5, negated = -0.5 (degradation). If delta is -0.02 and fullValue is 0.08, raw = -0.25, negated = +0.25 (improvement). Correct.

Update the JSDoc comment on `MetricComparison.divergenceScore` to note it's now signed (negative = degradation, positive = improvement).

**`classifyDivergence()` -- compositeScore is now signed:**
No code changes needed -- it already computes `mean(divergenceScores)`. With signed inputs, the mean is naturally signed. Update JSDoc to note the score is signed.

Update `scoreDescription` to remain factual: keep the existing format but ensure it handles negative scores properly (`.toFixed(2)` already works for negatives).

**edge-decay-synthesis.ts -- Direction-aware MC component (lines 636-638):**

Replace:
```typescript
const mcDivergenceValue = regimeResult?.divergence.compositeScore ?? null
const mcDivergenceNormalized = Math.min(mcDivergenceValue ?? 0, 1)
```

With:
```typescript
const mcDivergenceValue = regimeResult?.divergence.compositeScore ?? null
// Signed: negative = degradation, positive = improvement
// For decay score: use magnitude, but only count degradation (negative values)
const mcDivergenceNormalized = Math.min(Math.abs(mcDivergenceValue ?? 0), 1)
const mcDecayDirection = (mcDivergenceValue ?? 0) < 0 ? 1 : 0
```

Then in the composite calculation (line 682-687), change `mcDivergenceNormalized * weights.mcRegimeDivergence` to `(mcDivergenceNormalized * mcDecayDirection) * weights.mcRegimeDivergence`.

Update the `compositeDecayScoreComponents.mcRegimeDivergence` object to include `decayDirection` field:
```typescript
mcRegimeDivergence: { value: mcDivergenceValue, normalized: mcDivergenceNormalized * mcDecayDirection, weight: weights.mcRegimeDivergence }
```
Note: the `normalized` field now reflects the direction-adjusted value (0 when improving, magnitude when degrading), matching how `meanAbsPercentChange.normalized` already incorporates `decayFraction`.

Update the `EdgeDecaySummary` type definition for `compositeDecayScoreComponents.mcRegimeDivergence` -- keep the same shape `{ value: number | null; normalized: number; weight: number }` since normalized now encodes direction. No type change needed.

**Test updates -- mc-regime-comparison.test.ts:**

Add new describe block `'signed divergence scores'`:

Test 29: "degrading scenario produces negative divergenceScore for probabilityOfProfit"
- Create MetricComparison with delta = -0.05 (recent P(profit) lower). Verify divergenceScore is negative (-0.5).

Test 30: "improving scenario produces positive divergenceScore for probabilityOfProfit"
- delta = +0.05 -> divergenceScore = +0.5

Test 31: "medianMaxDrawdown increase (degradation) produces negative divergenceScore"
- delta = +0.04, fullValue = 0.08 -> divergenceScore should be negative (-0.5)

Test 32: "medianMaxDrawdown decrease (improvement) produces positive divergenceScore"
- delta = -0.02, fullValue = 0.08 -> divergenceScore should be positive (+0.25)

Test 33: "compositeScore is negative for all-degrading comparisons"
- Build 3 comparisons all with degrading deltas, verify classifyDivergence returns negative compositeScore.

Test 34: "compositeScore is positive for all-improving comparisons"
- Build 3 comparisons all with improving deltas, verify positive compositeScore.

Update existing tests 11-16: These pre-compute `divergenceScore` values in their MetricComparison objects. Since `classifyDivergence` just averages whatever scores are passed in, and the tests set `divergenceScore` directly, the tests for classifyDivergence itself don't need changes. However, **test 20** checks `comp.divergenceScore >= 0` -- this assertion MUST be removed since scores are now signed.

**Test updates -- edge-decay-synthesis.test.ts:**

Add test 15: "composite decay score MC component is 0 when MC shows improvement"
- Generate 60 trades with improving recent window (e.g., higher win rate in recent trades). Verify `compositeDecayScoreComponents.mcRegimeDivergence.normalized` is 0.

No changes needed to existing synthesis tests -- the compositeDecayScore is clamped 0-1 and the existing assertions test for valid range, not specific values.
  </action>
  <verify>
    npm test -- tests/unit/mc-regime-comparison.test.ts tests/unit/edge-decay-synthesis.test.ts
  </verify>
  <done>
    - computeDivergenceScore returns signed values: negative for degradation, positive for improvement
    - MDD sign is flipped: positive delta (larger MDD) produces negative score
    - compositeScore is signed (mean of signed per-metric scores)
    - Edge decay synthesis uses direction-aware MC component: only degradation (negative compositeScore) contributes to decay score
    - All existing tests pass, new tests for signed behavior pass
    - Test 20 assertion updated to allow negative divergenceScore
  </done>
</task>

<task type="auto">
  <name>Task 2: WF 1-lot normalization + synthesis passthrough</name>
  <files>
    packages/lib/calculations/walk-forward-degradation.ts
    packages/lib/calculations/edge-decay-synthesis.ts
    tests/unit/walk-forward-degradation.test.ts
  </files>
  <action>
**walk-forward-degradation.ts -- Add `normalizeTo1Lot` option:**

1. Add `normalizeTo1Lot?: boolean` to the `WFDConfig` interface (after `strategy`). Do NOT add it to `DEFAULT_CONFIG` (defaults to undefined/false).

2. In `analyzeWalkForwardDegradation()`, after step 2 (sort chronologically), if `config.normalizeTo1Lot` is true, create normalized trade copies:
```typescript
let tradesToAnalyze = sorted
if (config.normalizeTo1Lot) {
  tradesToAnalyze = sorted.map(t => ({
    ...t,
    pl: t.numContracts > 0 ? t.pl / t.numContracts : t.pl,
  }))
}
```
Then use `tradesToAnalyze` instead of `sorted` for all subsequent operations (filterTradesForWindow calls, date range, etc.). This affects Sharpe (via PortfolioStatsCalculator) and profit factor (grossProfit/grossLoss) but NOT win rate (count-based, unaffected by P&L magnitude).

Important: the `sorted` array is still needed for date range calculations. Use `tradesToAnalyze` when passing trades to `filterTradesForWindow` and `computeMetrics`. Since `filterTradesForWindow` uses `t.dateOpened`, the normalized copies (which have the same dateOpened) work identically.

Actually, simpler: just replace `sorted` with `tradesToAnalyze` for everything after the normalization step. The dateOpened fields are unchanged.

3. The `config` object in the result will naturally include `normalizeTo1Lot` since it's part of `WFDConfig` and spread from options.

**edge-decay-synthesis.ts -- Pass normalizeTo1Lot to WF:**

Move the margin returns auto-detection (currently at line 472-473, inside the MC try block) EARLIER, before the WF call (line 510). It should be computed once and reused for both MC and WF:

Before signal 3 (MC regime comparison, ~line 467), add:
```typescript
// Auto-detect margin returns eligibility (used by both MC and WF)
const validMarginCount = trades.filter(t => t.marginReq > 0).length
const useMarginReturns = validMarginCount >= trades.length * 0.9
```

Remove the duplicate from inside the MC try block (lines 472-473).

Update the MC call to use the outer `useMarginReturns` variable (it already references `useMarginReturns`, just ensure it's the same variable).

Update the WF call (line 510) from:
```typescript
const wfResult = analyzeWalkForwardDegradation(trades)
```
To:
```typescript
const wfResult = analyzeWalkForwardDegradation(trades, {
  normalizeTo1Lot: useMarginReturns,
})
```

**Test updates -- walk-forward-degradation.test.ts:**

Add new describe block `'1-lot normalization (normalizeTo1Lot)'`:

Test 23: "normalizeTo1Lot normalizes trade P&L by numContracts"
- Generate 730 trades where early trades have numContracts=1 and later trades have numContracts=10 (simulating position sizing growth), with same per-contract P&L.
- Run with and without normalizeTo1Lot.
- With normalization: IS and OOS Sharpe/PF should be more comparable (efficiency ratios closer to 1.0).
- Without normalization: later OOS periods with 10x contracts produce 10x P&L, inflating OOS metrics vs IS.
- Assert: normalized efficiency ratios have smaller deviation from 1.0 than unnormalized.

Test 24: "normalizeTo1Lot handles trades with numContracts=0 gracefully"
- Create a trade set with some numContracts=0. Verify those trades keep original P&L (no division by zero).

Test 25: "normalizeTo1Lot=false (default) does not modify trade P&L"
- Run analyzeWalkForwardDegradation without the option. Verify results match running with `normalizeTo1Lot: false` explicitly.

Test 26: "config output includes normalizeTo1Lot when set"
- Run with `normalizeTo1Lot: true`, verify `result.config.normalizeTo1Lot` is `true`.
  </action>
  <verify>
    npm test -- tests/unit/walk-forward-degradation.test.ts tests/unit/edge-decay-synthesis.test.ts
  </verify>
  <done>
    - WFDConfig has normalizeTo1Lot option
    - When true, trade P&L is divided by numContracts before computing Sharpe and profit factor
    - Edge decay synthesis passes normalizeTo1Lot=useMarginReturns to WF
    - useMarginReturns auto-detection is computed once and shared between MC and WF signals
    - All existing tests pass, new normalization tests pass
    - Trades with numContracts=0 are handled gracefully (no division by zero)
  </done>
</task>

</tasks>

<verification>
Run full test suite to ensure no regressions:
```bash
npm test
```
All 1188+ existing tests must pass. New tests (approximately 8-10 new test cases) must also pass.

Verify typecheck:
```bash
npm run typecheck 2>/dev/null || npx tsc --noEmit
```
</verification>

<success_criteria>
1. MC divergence scores are signed: negative = degradation, positive = improvement
2. MDD divergence sign is correctly flipped (larger MDD = negative score)
3. compositeScore is signed (can be negative)
4. Edge decay composite decay score only counts MC degradation (negative compositeScore), not improvement
5. WF normalizeTo1Lot divides trade.pl by numContracts when enabled
6. Edge decay synthesis auto-detects and passes normalizeTo1Lot to WF using same useMarginReturns flag
7. All tests pass (existing 1188+ plus ~8-10 new)
8. No type errors
</success_criteria>

<output>
After completion, create `.planning/quick/008-signed-mc-divergence-wf-1lot-normalizati/008-SUMMARY.md`
</output>
