---
phase: quick-007
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/lib/calculations/monte-carlo.ts
  - packages/lib/calculations/mc-regime-comparison.ts
  - packages/lib/calculations/edge-decay-synthesis.ts
  - tests/unit/mc-regime-comparison.test.ts
  - tests/unit/edge-decay-synthesis.test.ts
autonomous: true

must_haves:
  truths:
    - "MC regime comparison uses pl/marginReq for percentage returns when trades have valid marginReq"
    - "Trades with marginReq <= 0 are skipped in margin return calculation"
    - "Fallback to standard calculatePercentageReturns when <90% of trades have valid marginReq"
    - "Existing tests continue to pass unchanged"
  artifacts:
    - path: "packages/lib/calculations/monte-carlo.ts"
      provides: "calculateMarginReturns() function and precomputedReturns support"
      exports: ["calculateMarginReturns"]
    - path: "packages/lib/calculations/mc-regime-comparison.ts"
      provides: "useMarginReturns option in MCRegimeComparisonOptions"
      contains: "useMarginReturns"
    - path: "packages/lib/calculations/edge-decay-synthesis.ts"
      provides: "Auto-detection of valid marginReq and pass-through to regime comparison"
      contains: "useMarginReturns"
  key_links:
    - from: "packages/lib/calculations/edge-decay-synthesis.ts"
      to: "packages/lib/calculations/mc-regime-comparison.ts"
      via: "useMarginReturns option"
      pattern: "useMarginReturns.*true"
    - from: "packages/lib/calculations/mc-regime-comparison.ts"
      to: "packages/lib/calculations/monte-carlo.ts"
      via: "precomputedReturns in MonteCarloParams"
      pattern: "precomputedReturns"
---

<objective>
Implement margin-based Return on Margin (ROM) for MC regime comparison to fix contaminated percentage returns when strategy-filtered trades come from multi-strategy portfolios.

Purpose: `fundsAtClose` reflects full portfolio equity (e.g., $10M), not the strategy's allocation. Using `pl / marginReq` as per-trade ROM gives a denominator that scales with position size and is 100% populated across trades, producing comparable percentage returns for MC regime comparison.

Output: Updated monte-carlo.ts with `calculateMarginReturns()` and `precomputedReturns` support, mc-regime-comparison.ts with `useMarginReturns` option, edge-decay-synthesis.ts with auto-detection, and tests validating the new path.
</objective>

<execution_context>
@/Users/davidromeo/.claude/get-shit-done/workflows/execute-plan.md
@/Users/davidromeo/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/lib/calculations/monte-carlo.ts
@packages/lib/calculations/mc-regime-comparison.ts
@packages/lib/calculations/edge-decay-synthesis.ts
@tests/unit/mc-regime-comparison.test.ts
@tests/unit/edge-decay-synthesis.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add calculateMarginReturns and precomputedReturns to monte-carlo.ts</name>
  <files>packages/lib/calculations/monte-carlo.ts</files>
  <action>
1. Add a new exported function `calculateMarginReturns(trades: Trade[]): number[]` near `calculatePercentageReturns()` (around line 686):
   - Sort trades chronologically (same pattern as calculatePercentageReturns)
   - For each trade: if `trade.marginReq > 0`, push `trade.pl / trade.marginReq` to result array
   - Skip trades where `marginReq <= 0` (do NOT push 0, just skip -- resulting array may be shorter than input)
   - Return the array of margin-based returns (decimals, same convention as calculatePercentageReturns)

2. Add `precomputedReturns?: number[]` to the `MonteCarloParams` interface (after `historicalInitialCapital`):
   - JSDoc: "Pre-computed percentage returns to use directly instead of calculating from trades. When provided with resampleMethod='percentage', these returns are used as the resample pool, bypassing calculatePercentageReturns()."

3. In `runMonteCarloSimulation()`, in the `else` branch for percentage resampling (lines 924-941):
   - BEFORE the existing `calculatePercentageReturns()` call, add a check:
     ```
     if (params.precomputedReturns && params.precomputedReturns.length > 0) {
       const precomputedPool = getPercentageResamplePool(
         params.precomputedReturns,
         params.resampleWindow
       );
       actualResamplePoolSize = precomputedPool.length;
       resamplePool = precomputedPool;
     } else {
       // existing calculatePercentageReturns logic
     }
     ```
   - This keeps the existing code path intact when precomputedReturns is not provided
  </action>
  <verify>
Run `npm test -- tests/unit/monte-carlo.test.ts` to confirm no existing MC tests break. Run `npm run typecheck` (or `npx tsc --noEmit`) to confirm type safety.
  </verify>
  <done>
`calculateMarginReturns()` is exported and computes `pl/marginReq` per trade. `precomputedReturns` is accepted in MonteCarloParams and used when provided. All existing MC tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire useMarginReturns through mc-regime-comparison and edge-decay-synthesis</name>
  <files>packages/lib/calculations/mc-regime-comparison.ts, packages/lib/calculations/edge-decay-synthesis.ts</files>
  <action>
**mc-regime-comparison.ts:**

1. Add `useMarginReturns?: boolean` to `MCRegimeComparisonOptions` interface (after `strategy`):
   - JSDoc: "Use margin-based returns (pl/marginReq) instead of capital-based percentage returns. Auto-detected by edge-decay-synthesis when trades have valid marginReq."

2. Add `useMarginReturns?: boolean` to the `parameters` field of `MCRegimeComparisonResult` (after `randomSeed`):
   - This reports whether margin returns were used in the output

3. Import `calculateMarginReturns` from `'./monte-carlo'`

4. In `runRegimeComparison()`, after resolving defaults (around line 223), add margin returns logic:
   ```
   // Resolve margin returns
   const useMarginReturns = options?.useMarginReturns ?? false

   let fullPrecomputedReturns: number[] | undefined
   let recentPrecomputedReturns: number[] | undefined
   let marginInitialCapital = initialCapital

   if (useMarginReturns) {
     // Compute margin returns for each pool
     fullPrecomputedReturns = calculateMarginReturns(fullPool)
     recentPrecomputedReturns = calculateMarginReturns(recentPool)

     // Use median marginReq from full pool as stable initial capital estimate
     const marginReqs = fullPool
       .map(t => t.marginReq)
       .filter(m => m > 0)
       .sort((a, b) => a - b)
     if (marginReqs.length > 0) {
       marginInitialCapital = marginReqs[Math.floor(marginReqs.length / 2)]
     }
   }
   ```

5. Update the `fullParams` object (line 230-238) to conditionally include precomputedReturns:
   ```
   const fullParams: MonteCarloParams = {
     numSimulations,
     simulationLength,
     resampleMethod: 'percentage',
     initialCapital: useMarginReturns ? marginInitialCapital : initialCapital,
     tradesPerYear,
     randomSeed,
     worstCaseEnabled: false,
     ...(fullPrecomputedReturns ? { precomputedReturns: fullPrecomputedReturns } : {}),
   }
   ```

6. Similarly update `recentParams` (line 242-245) to spread recentPrecomputedReturns if available.

7. Add `useMarginReturns` to the `parameters` object in the return value (line 299-305).

**edge-decay-synthesis.ts:**

1. In `synthesizeEdgeDecay()`, before the `runRegimeComparison()` call (around line 471), add auto-detection:
   ```
   // Auto-detect margin returns eligibility
   const validMarginCount = trades.filter(t => t.marginReq > 0).length
   const useMarginReturns = validMarginCount >= trades.length * 0.9
   ```

2. Pass the flag to `runRegimeComparison()`:
   ```
   regimeResult = runRegimeComparison(trades, {
     recentWindowSize: recentWindow,
     useMarginReturns,
   })
   ```
  </action>
  <verify>
Run `npm test -- tests/unit/mc-regime-comparison.test.ts tests/unit/edge-decay-synthesis.test.ts` to confirm all existing tests pass. The existing test helpers set `marginReq: 5000` on all trades, so useMarginReturns will auto-activate in the edge-decay-synthesis tests (100% have valid margin). Run `npm run typecheck` to confirm types.
  </verify>
  <done>
`useMarginReturns` option flows from edge-decay-synthesis auto-detection through mc-regime-comparison to monte-carlo's precomputedReturns. Existing tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add targeted tests for margin returns path</name>
  <files>tests/unit/mc-regime-comparison.test.ts, tests/unit/edge-decay-synthesis.test.ts</files>
  <action>
**tests/unit/mc-regime-comparison.test.ts:**

Add a new describe block at the end (before the closing of the file):

```typescript
describe('margin-based returns (useMarginReturns)', () => {
  test('23. useMarginReturns produces valid results', () => {
    const trades = generateTradeSet(50)
    const result = runRegimeComparison(trades, {
      useMarginReturns: true,
      numSimulations: 100,
      randomSeed: 42,
    })

    // Should complete without error
    expect(result.fullHistory.tradeCount).toBe(50)
    expect(result.parameters.useMarginReturns).toBe(true)

    // Should have valid divergence score
    expect(typeof result.divergence.compositeScore).toBe('number')
    expect(isFinite(result.divergence.compositeScore)).toBe(true)
  })

  test('24. useMarginReturns reports in parameters output', () => {
    const trades = generateTradeSet(50)

    const withMargin = runRegimeComparison(trades, {
      useMarginReturns: true,
      numSimulations: 100,
      randomSeed: 42,
    })
    const withoutMargin = runRegimeComparison(trades, {
      useMarginReturns: false,
      numSimulations: 100,
      randomSeed: 42,
    })

    expect(withMargin.parameters.useMarginReturns).toBe(true)
    expect(withoutMargin.parameters.useMarginReturns).toBe(false)
  })

  test('25. useMarginReturns uses median marginReq as initialCapital', () => {
    const trades = generateTradeSet(50)
    const result = runRegimeComparison(trades, {
      useMarginReturns: true,
      numSimulations: 100,
      randomSeed: 42,
    })

    // All trades have marginReq=5000, so initialCapital should be 5000
    expect(result.parameters.initialCapital).toBe(5000)
  })
})
```

Also import `calculateMarginReturns` at the top of the file (add to the existing import from `@tradeblocks/lib`), then add a describe block for unit testing the function:

```typescript
describe('calculateMarginReturns', () => {
  test('26. Basic: returns pl/marginReq for each trade', () => {
    const trades = [
      makeTrade({ pl: 500, marginReq: 5000 }),   // 0.10
      makeTrade({ pl: -200, marginReq: 5000 }),   // -0.04
      makeTrade({ pl: 1000, marginReq: 10000 }),  // 0.10
    ]
    // Give them unique dates so sorting is deterministic
    trades[0].dateOpened = new Date('2024-01-01')
    trades[1].dateOpened = new Date('2024-01-02')
    trades[2].dateOpened = new Date('2024-01-03')

    const returns = calculateMarginReturns(trades)

    expect(returns).toHaveLength(3)
    expect(returns[0]).toBeCloseTo(0.10, 6)
    expect(returns[1]).toBeCloseTo(-0.04, 6)
    expect(returns[2]).toBeCloseTo(0.10, 6)
  })

  test('27. Skips trades with marginReq <= 0', () => {
    const trades = [
      makeTrade({ pl: 500, marginReq: 5000, dateOpened: new Date('2024-01-01') }),
      makeTrade({ pl: 100, marginReq: 0, dateOpened: new Date('2024-01-02') }),
      makeTrade({ pl: -200, marginReq: -100, dateOpened: new Date('2024-01-03') }),
      makeTrade({ pl: 300, marginReq: 3000, dateOpened: new Date('2024-01-04') }),
    ]

    const returns = calculateMarginReturns(trades)

    // Only 2 trades have valid marginReq
    expect(returns).toHaveLength(2)
    expect(returns[0]).toBeCloseTo(0.10, 6)   // 500/5000
    expect(returns[1]).toBeCloseTo(0.10, 6)   // 300/3000
  })

  test('28. Empty trades returns empty array', () => {
    expect(calculateMarginReturns([])).toEqual([])
  })
})
```

**tests/unit/edge-decay-synthesis.test.ts:**

Add a test at the end of the main describe block that validates margin returns auto-detection:

```typescript
test('N. Auto-detects margin returns when trades have valid marginReq', () => {
  // All trades from generateTradeSet have marginReq=5000 (100% valid, >= 90% threshold)
  const trades = generateTradeSet(60)
  const result = synthesizeEdgeDecay(trades)

  // The regime signal should be available
  if (result.signals.regime.available && result.signals.regime.detail) {
    // Parameters should report useMarginReturns = true
    expect(result.signals.regime.detail.parameters.useMarginReturns).toBe(true)
    // initialCapital should be median marginReq (all 5000, so 5000)
    expect(result.signals.regime.detail.parameters.initialCapital).toBe(5000)
  }
})

test('N+1. Falls back to standard returns when <90% have valid marginReq', () => {
  const trades = generateTradeSet(60)
  // Set 80% of trades to marginReq=0 (only 20% valid, below 90% threshold)
  for (let i = 0; i < 48; i++) {
    trades[i].marginReq = 0
  }
  const result = synthesizeEdgeDecay(trades)

  if (result.signals.regime.available && result.signals.regime.detail) {
    // Should NOT use margin returns
    expect(result.signals.regime.detail.parameters.useMarginReturns).toBe(false)
  }
})
```

Use the next sequential test number in the file for N. Check the last test number before adding.
  </action>
  <verify>
Run `npm test -- tests/unit/mc-regime-comparison.test.ts tests/unit/edge-decay-synthesis.test.ts` -- all tests (existing + new) must pass. Run `npm test` to confirm full suite (1180+ tests) passes.
  </verify>
  <done>
New tests validate: (1) calculateMarginReturns computes pl/marginReq and skips invalid margins, (2) useMarginReturns flows through regime comparison and reports in parameters, (3) edge-decay-synthesis auto-detects margin eligibility at 90% threshold, (4) fallback engages when <90% have valid marginReq. All 1180+ existing tests still pass.
  </done>
</task>

</tasks>

<verification>
1. `npm run typecheck` passes with no errors
2. `npm test -- tests/unit/monte-carlo.test.ts` -- all existing MC tests pass
3. `npm test -- tests/unit/mc-regime-comparison.test.ts` -- all 22 existing + 6 new tests pass
4. `npm test -- tests/unit/edge-decay-synthesis.test.ts` -- all existing + 2 new tests pass
5. `npm test` -- full suite (1180+ tests) passes
</verification>

<success_criteria>
- calculateMarginReturns() exported from monte-carlo.ts, computes pl/marginReq per trade, skips marginReq <= 0
- precomputedReturns accepted in MonteCarloParams, used in percentage resampling when provided
- useMarginReturns option in MCRegimeComparisonOptions, uses margin returns and median marginReq as initialCapital
- edge-decay-synthesis auto-detects margin eligibility (>= 90% valid) and passes useMarginReturns to regime comparison
- useMarginReturns reported in MCRegimeComparisonResult.parameters
- All existing tests pass unchanged, new tests validate the margin returns path
</success_criteria>

<output>
After completion, create `.planning/quick/007-margin-based-rom-for-mc-regime-comparis/007-SUMMARY.md`
</output>
