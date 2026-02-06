---
phase: quick-009
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/lib/calculations/monte-carlo.ts
  - packages/lib/calculations/walk-forward-degradation.ts
  - packages/lib/calculations/mc-regime-comparison.ts
  - tests/unit/mc-regime-comparison.test.ts
  - tests/unit/walk-forward-degradation.test.ts
autonomous: true

must_haves:
  truths:
    - "Margin returns never go below -99%, preventing MC simulations from dying at zero capital"
    - "Walk-forward Sharpe efficiency is null when IS Sharpe is negative, preventing nonsensical ratios"
    - "MDD divergence sign convention is documented clearly in the MetricComparison interface"
  artifacts:
    - path: "packages/lib/calculations/monte-carlo.ts"
      provides: "Clamped margin return floor at -0.99"
      contains: "Math.max"
    - path: "packages/lib/calculations/walk-forward-degradation.ts"
      provides: "Negative IS Sharpe guard in computeEfficiency"
      contains: "metric === 'sharpe' && isValue < 0"
    - path: "packages/lib/calculations/mc-regime-comparison.ts"
      provides: "JSDoc clarifying MDD sign convention"
      contains: "sign is flipped"
  key_links:
    - from: "packages/lib/calculations/monte-carlo.ts"
      to: "MC simulation compounding"
      via: "calculateMarginReturns return values"
      pattern: "Math\\.max.*-0\\.99"
    - from: "packages/lib/calculations/walk-forward-degradation.ts"
      to: "WF efficiency averaging"
      via: "computeEfficiency returns null for negative IS Sharpe"
      pattern: "metric === 'sharpe'"
---

<objective>
Fix three targeted issues from Round 4 verification of the edge decay analysis feature:
1. Floor margin returns at -99% to prevent MC simulation capital death
2. Exclude Sharpe efficiency when IS Sharpe is negative to prevent nonsensical ratios
3. Add clarifying JSDoc for MDD divergence sign convention

Purpose: These are correctness fixes that prevent real analytical failures (zero P(Profit) from capital death, inflated efficiency deltas from negative Sharpe ratios).
Output: Three source file patches + two new tests, all existing tests still passing.
</objective>

<execution_context>
@/Users/davidromeo/.claude/get-shit-done/workflows/execute-plan.md
@/Users/davidromeo/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/lib/calculations/monte-carlo.ts (lines 707-727: calculateMarginReturns)
@packages/lib/calculations/walk-forward-degradation.ts (lines 232-244: computeEfficiency)
@packages/lib/calculations/mc-regime-comparison.ts (lines 22-31: MetricComparison interface, lines 176-181: MDD divergence)
@tests/unit/mc-regime-comparison.test.ts (lines 512-546: existing margin return tests)
@tests/unit/walk-forward-degradation.test.ts (lines 218-234: existing negative Sharpe warning test)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Floor margin returns and guard negative IS Sharpe</name>
  <files>
    packages/lib/calculations/monte-carlo.ts
    packages/lib/calculations/walk-forward-degradation.ts
    packages/lib/calculations/mc-regime-comparison.ts
  </files>
  <action>
**1. packages/lib/calculations/monte-carlo.ts** -- `calculateMarginReturns()` function (line 721):

Replace:
```typescript
returns.push(trade.pl / trade.marginReq);
```

With:
```typescript
const marginReturn = trade.pl / trade.marginReq;
returns.push(Math.max(marginReturn, -0.99));
```

This clamps each margin return to -99% minimum. Without this, a single return like -100.8% (pl=-1340.4, margin=1330) takes capital to <= 0 via `capital * (1 + value)`, killing every subsequent simulation path.

**2. packages/lib/calculations/walk-forward-degradation.ts** -- `computeEfficiency()` function (line 241, after the epsilon check):

Add this guard before the return statement:
```typescript
// Negative IS Sharpe produces misleading efficiency ratios
// (e.g., -0.5 / -1.26 = 0.40 looks good but is meaningless)
if (metric === 'sharpe' && isValue < 0) return null
```

The full function should be:
```typescript
function computeEfficiency(
  oosValue: number | null,
  isValue: number | null,
  metric: string,
): number | null {
  if (oosValue === null || isValue === null) return null
  if (!Number.isFinite(oosValue) || !Number.isFinite(isValue)) return null
  const eps = EFFICIENCY_EPSILON[metric] ?? 0.01
  if (Math.abs(isValue) < eps) return null
  // Negative IS Sharpe produces misleading efficiency ratios
  if (metric === 'sharpe' && isValue < 0) return null
  return oosValue / isValue
}
```

**3. packages/lib/calculations/mc-regime-comparison.ts** -- `MetricComparison` interface (line 29-30):

Replace the existing `divergenceScore` JSDoc:
```typescript
/** Per-metric normalized divergence score. Signed: negative = degradation, positive = improvement. Magnitude indicates strength. */
divergenceScore: number
```

With expanded JSDoc:
```typescript
/** Per-metric divergence score. Signed: negative = degradation, positive = improvement.
 *  Note: For MDD, the sign is flipped relative to percentChange because lower MDD is better.
 *  A negative percentChange (MDD decreased) produces a positive divergenceScore (improvement). */
divergenceScore: number
```
  </action>
  <verify>
Run `npm test -- tests/unit/mc-regime-comparison.test.ts tests/unit/walk-forward-degradation.test.ts` -- all existing tests pass.
Run `npm run build` -- no type errors.
  </verify>
  <done>
- `calculateMarginReturns` clamps returns at -0.99
- `computeEfficiency` returns null when metric is 'sharpe' and isValue < 0
- `MetricComparison.divergenceScore` JSDoc explains MDD sign convention
- All existing tests still pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests for margin floor and negative Sharpe guard</name>
  <files>
    tests/unit/mc-regime-comparison.test.ts
    tests/unit/walk-forward-degradation.test.ts
  </files>
  <action>
**1. tests/unit/mc-regime-comparison.test.ts** -- Add test 36 inside the `calculateMarginReturns` describe block (after test 28, around line 546):

```typescript
test('36. Clamps margin returns exceeding -100% to -0.99', () => {
  const trades = [
    makeTrade({ pl: 500, marginReq: 5000, dateOpened: new Date('2024-01-01') }),
    makeTrade({ pl: -1340.4, marginReq: 1330, dateOpened: new Date('2024-01-02') }),  // raw: -1.0078 -> clamped
    makeTrade({ pl: -6000, marginReq: 5000, dateOpened: new Date('2024-01-03') }),    // raw: -1.20 -> clamped
    makeTrade({ pl: -200, marginReq: 5000, dateOpened: new Date('2024-01-04') }),     // raw: -0.04 -> not clamped
  ]

  const returns = calculateMarginReturns(trades)

  expect(returns).toHaveLength(4)
  expect(returns[0]).toBeCloseTo(0.10, 6)     // 500/5000 = 0.10
  expect(returns[1]).toBeCloseTo(-0.99, 6)    // -1340.4/1330 = -1.0078 -> clamped to -0.99
  expect(returns[2]).toBeCloseTo(-0.99, 6)    // -6000/5000 = -1.20 -> clamped to -0.99
  expect(returns[3]).toBeCloseTo(-0.04, 6)    // -200/5000 = -0.04 -> not clamped
})
```

**2. tests/unit/walk-forward-degradation.test.ts** -- Add test 27 inside the `edge cases` describe block (after the last test in that block):

```typescript
test('27. returns null Sharpe efficiency for negative IS Sharpe', () => {
  // Generate mostly-losing trades to produce negative IS Sharpe
  const trades = generateTradeSet(730, {
    winRate: 0.1,
    avgPl: 50,
    startDate: new Date(2022, 0, 1),
  })
  const result = analyzeWalkForwardDegradation(trades)

  const sufficientPeriods = result.periods.filter((p) => p.sufficient)

  // Periods with negative IS Sharpe should have null Sharpe efficiency
  for (const period of sufficientPeriods) {
    const sharpe = period.metrics.sharpe
    if (sharpe.inSample !== null && sharpe.inSample < 0) {
      expect(sharpe.efficiency).toBeNull()
    }
  }

  // At least some periods should have negative IS Sharpe (given 10% win rate)
  const periodsWithNegIS = sufficientPeriods.filter(
    (p) => p.metrics.sharpe.inSample !== null && p.metrics.sharpe.inSample < 0,
  )
  expect(periodsWithNegIS.length).toBeGreaterThan(0)
})
```
  </action>
  <verify>
Run `npm test -- tests/unit/mc-regime-comparison.test.ts tests/unit/walk-forward-degradation.test.ts` -- all tests pass including the two new ones.
Run `npm test` -- full suite passes (no regressions).
  </verify>
  <done>
- Test 36 in mc-regime-comparison verifies margin return clamping for values exceeding -100%
- Test 27 in walk-forward-degradation verifies null Sharpe efficiency for negative IS Sharpe periods
- Full test suite passes with no regressions
  </done>
</task>

</tasks>

<verification>
1. `npm test -- tests/unit/mc-regime-comparison.test.ts` -- all 36 tests pass
2. `npm test -- tests/unit/walk-forward-degradation.test.ts` -- all 27 tests pass
3. `npm test` -- full suite (1200+ tests) passes
4. `npm run build` -- no type errors
</verification>

<success_criteria>
- calculateMarginReturns never returns values below -0.99
- computeEfficiency returns null for Sharpe when IS value is negative
- MetricComparison.divergenceScore has clear JSDoc explaining MDD sign convention
- Two new targeted tests validate both fixes
- Zero test regressions
</success_criteria>

<output>
After completion, create `.planning/quick/009-fix-margin-return-floor-wf-neg-sharpe-md/009-SUMMARY.md`
</output>
