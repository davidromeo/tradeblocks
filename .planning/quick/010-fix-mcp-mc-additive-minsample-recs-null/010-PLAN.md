---
phase: quick-010
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/lib/calculations/monte-carlo.ts
  - packages/mcp-server/src/tools/blocks/health.ts
  - packages/mcp-server/src/tools/blocks/similarity.ts
  - packages/mcp-server/tests/integration/strategy-similarity.test.ts
  - packages/lib/calculations/edge-decay-synthesis.ts
  - tests/unit/edge-decay-synthesis.test.ts
autonomous: true

must_haves:
  truths:
    - "MC simulations with margin (percentage) returns use additive cumulative return, not multiplicative compounding"
    - "Health check correlation and tail dependence flags only fire when sample size >= 10"
    - "Strategy similarity output contains no recommendation field on pairs and no recommendations array"
    - "Edge decay summary uses null (not 0) for win rate and profit factor when data is insufficient"
  artifacts:
    - path: "packages/lib/calculations/monte-carlo.ts"
      provides: "Additive MC simulation for percentage mode"
      contains: "cumulativeReturn"
    - path: "packages/mcp-server/src/tools/blocks/health.ts"
      provides: "minSamples guard on correlation and tail dependence flags"
      contains: "sampleSize >= 10"
    - path: "packages/mcp-server/src/tools/blocks/similarity.ts"
      provides: "Similarity output without interpretive recommendations"
    - path: "packages/lib/calculations/edge-decay-synthesis.ts"
      provides: "Null fallback for win rate and profit factor"
      contains: "?? null"
  key_links: []
---

<objective>
Fix four MCP/calculation issues: (1) MC additive mode for margin returns, (2) health check minSamples on correlation flags, (3) remove similarity recommendations, (4) edge decay 0-to-null.

Purpose: Prevent MC blowup with margin returns, reduce false-positive health flags from low-sample correlations, remove interpretive recommendations from similarity tool, and use semantically correct null instead of 0.
Output: Four targeted fixes across lib and MCP server, with updated tests.
</objective>

<execution_context>
@/Users/davidromeo/.claude/get-shit-done/workflows/execute-plan.md
@/Users/davidromeo/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/lib/calculations/monte-carlo.ts
@packages/mcp-server/src/tools/blocks/health.ts
@packages/mcp-server/src/tools/blocks/similarity.ts
@packages/mcp-server/tests/integration/strategy-similarity.test.ts
@packages/lib/calculations/edge-decay-synthesis.ts
@tests/unit/edge-decay-synthesis.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: MC additive mode for percentage returns</name>
  <files>packages/lib/calculations/monte-carlo.ts</files>
  <action>
In `runSingleSimulation()` (around line 792-813), replace the multiplicative compounding for `isPercentageMode` with additive cumulative return logic.

Current code (lines 792-813):
```typescript
for (const value of resampledValues) {
  const capitalBeforeTrade = capital;
  if (isPercentageMode) {
    capital = capital * (1 + value);
  } else {
    capital += value;
  }
  const cumulativeReturn = (capital - initialCapital) / initialCapital;
  equityCurve.push(cumulativeReturn);
  if (capitalBeforeTrade > 0) {
    const periodReturn = capital / capitalBeforeTrade - 1;
    returns.push(periodReturn);
  } else {
    returns.push(0);
  }
}
```

Replace with:
```typescript
let cumulativeReturn = 0;
for (const value of resampledValues) {
  const capitalBeforeTrade = capital;

  if (isPercentageMode) {
    // Additive mode: sum percentage returns, then apply to initial capital
    // Prevents blowup where sequential -99% returns compound to near-zero
    cumulativeReturn += value;
    capital = initialCapital * (1 + cumulativeReturn);
  } else {
    // Dollar P&L - add directly
    capital += value;
  }

  const cumRet = (capital - initialCapital) / initialCapital;
  equityCurve.push(cumRet);

  if (capitalBeforeTrade > 0) {
    const periodReturn = capital / capitalBeforeTrade - 1;
    returns.push(periodReturn);
  } else {
    returns.push(0);
  }
}
```

Key changes:
- Add `let cumulativeReturn = 0` before the loop
- In `isPercentageMode` branch: `cumulativeReturn += value; capital = initialCapital * (1 + cumulativeReturn)`
- The `cumRet` calculation for equityCurve remains the same (derived from capital vs initialCapital)
- The returns array still tracks period-over-period returns from capitalBeforeTrade
- Dollar mode is unchanged

No MC test changes needed - there are no existing percentage mode tests (confirmed via grep).
  </action>
  <verify>Run `npm test -- tests/unit/monte-carlo.test.ts` - all existing tests pass (they use dollar mode, not percentage mode).</verify>
  <done>Percentage mode MC simulations use additive cumulative return instead of multiplicative compounding. Sequential -99% returns sum instead of compound.</done>
</task>

<task type="auto">
  <name>Task 2: Health check minSamples guard on correlation and tail dependence flags</name>
  <files>packages/mcp-server/src/tools/blocks/health.ts</files>
  <action>
In the health check tool (around lines 314-325), add a `sampleSize >= 10` check to the correlation flagging condition.

Current code (line 319):
```typescript
if (!Number.isNaN(val) && Math.abs(val) > corrThreshold) {
```

Change to:
```typescript
const sampleSize = correlationMatrix.sampleSizes[i][j];
if (!Number.isNaN(val) && Math.abs(val) > corrThreshold && sampleSize >= 10) {
```

Note: `sampleSize` is already looked up on the NEXT line (line 320: `const sampleSize = correlationMatrix.sampleSizes[i][j]`), so just MOVE the existing declaration ABOVE the `if` and add `&& sampleSize >= 10` to the condition. Delete the duplicate declaration from within the block.

For the tail dependence section (around lines 348-372), add the same minSamples guard. The `pairSampleSize` is already computed (lines 362-367). Add the check to the existing condition:

Current (line 360):
```typescript
if (avgTail > tailThreshold) {
```

Change to:
```typescript
if (avgTail > tailThreshold && pairSampleSize !== null && pairSampleSize >= 10) {
```

Move the `pairSampleSize` computation (lines 362-367) ABOVE the `if (avgTail > tailThreshold...)` condition so it's available for the check.
  </action>
  <verify>No dedicated health test file exists. Run `npm test` to ensure no regressions. Check `npm run build` passes in the MCP server package.</verify>
  <done>Correlation and tail dependence flags in health check only fire when sample size >= 10, preventing false positives from low-sample pairs.</done>
</task>

<task type="auto">
  <name>Task 3: Remove similarity recommendations</name>
  <files>
    packages/mcp-server/src/tools/blocks/similarity.ts
    packages/mcp-server/tests/integration/strategy-similarity.test.ts
  </files>
  <action>
**In similarity.ts:**

1. Remove the per-pair recommendation generation block (lines 267-278):
   Delete the entire block:
   ```typescript
   let recommendation: string | null = null;
   if (isRedundant) {
     recommendation = "Consider consolidating...";
   } else if (isHighCorrelation) {
     recommendation = "Moderate redundancy...";
   } else if (isHighTailDependence) {
     recommendation = "Tail risk overlap...";
   }
   ```

2. Remove `recommendation` from the `pairs.push({...})` object (line 295):
   Delete the line: `recommendation,`

3. Remove the top-level `recommendations` array generation (lines 313-324):
   Delete the entire block:
   ```typescript
   const recommendations: string[] = [];
   for (const pair of topPairs) {
     if (pair.flags.isRedundant) {
       recommendations.push(...);
       recommendations.push(...);
     }
   }
   ```

4. Remove `recommendations` from the `structuredData` object (line 348):
   Delete the line: `recommendations,`

5. In the early return objects (around lines 105-112 and 118-124 in the test helper, but the actual source is in similarity.ts), find the two early-return objects that have `recommendations: []` and remove the `recommendations` property from each.
   - Search for `recommendations: []` in similarity.ts and remove those lines.

**In strategy-similarity.test.ts:**

1. Remove `recommendation` from the `SimilarPair` interface (line 54):
   Delete: `recommendation: string | null;`

2. Remove `recommendations` from the `StrategySimilarityResult` interface (line 74):
   Delete: `recommendations: string[];`

3. Remove `recommendations: []` from early-return expected objects in the test (lines 110 and 123).

4. Remove the assertion `expect(pair).toHaveProperty('recommendation');` (line 310).

5. Remove the entire `describe('recommendations', ...)` block (lines 523-575) - 4 tests total.
  </action>
  <verify>Run `npm test -- packages/mcp-server/tests/integration/strategy-similarity.test.ts` - all remaining tests pass. The removed recommendation tests should no longer exist.</verify>
  <done>Strategy similarity tool outputs numerical data only. No `recommendation` field on pairs, no `recommendations` array in output.</done>
</task>

<task type="auto">
  <name>Task 4: Edge decay summary 0 to null for win rate and profit factor</name>
  <files>
    packages/lib/calculations/edge-decay-synthesis.ts
    tests/unit/edge-decay-synthesis.test.ts
  </files>
  <action>
**In edge-decay-synthesis.ts:**

1. Update the `EdgeDecaySummary` interface (lines 153-156):
   Change:
   ```typescript
   recentWinRate: number
   historicalWinRate: number
   recentProfitFactor: number
   historicalProfitFactor: number
   ```
   To:
   ```typescript
   recentWinRate: number | null
   historicalWinRate: number | null
   recentProfitFactor: number | null
   historicalProfitFactor: number | null
   ```

2. Update the summary construction (lines 706-709):
   Change:
   ```typescript
   recentWinRate: winRateComp?.recentValue ?? 0,
   historicalWinRate: winRateComp?.historicalValue ?? 0,
   recentProfitFactor: pfComp?.recentValue ?? 0,
   historicalProfitFactor: pfComp?.historicalValue ?? 0,
   ```
   To:
   ```typescript
   recentWinRate: winRateComp?.recentValue ?? null,
   historicalWinRate: winRateComp?.historicalValue ?? null,
   recentProfitFactor: pfComp?.recentValue ?? null,
   historicalProfitFactor: pfComp?.historicalValue ?? null,
   ```

**In edge-decay-synthesis.test.ts:**

1. Update test 11 (around lines 234-235):
   Change:
   ```typescript
   expect(typeof result.summary.recentWinRate).toBe('number')
   expect(typeof result.summary.historicalWinRate).toBe('number')
   ```
   To assertions that accept both number and null:
   ```typescript
   expect(result.summary.recentWinRate === null || typeof result.summary.recentWinRate === 'number').toBe(true)
   expect(result.summary.historicalWinRate === null || typeof result.summary.historicalWinRate === 'number').toBe(true)
   ```
   (With 60 trades in `generateTradeSet`, these will be numbers, so either form works. But the type-flexible assertion is more correct given the type change.)

2. Check for any other tests that assert these fields are `0` and update them. Grep for `recentWinRate.*0` and `historicalWinRate.*0` in the test file to be sure.
  </action>
  <verify>Run `npm test -- tests/unit/edge-decay-synthesis.test.ts` - all tests pass. Run `npx tsc --noEmit -p packages/lib/tsconfig.json` to verify type consistency.</verify>
  <done>Edge decay summary uses null instead of 0 when win rate or profit factor data is insufficient, matching the existing Sharpe pattern.</done>
</task>

</tasks>

<verification>
1. `npm test -- tests/unit/monte-carlo.test.ts` passes
2. `npm test -- packages/mcp-server/tests/integration/strategy-similarity.test.ts` passes (with recommendation tests removed)
3. `npm test -- tests/unit/edge-decay-synthesis.test.ts` passes
4. `npm run typecheck` passes (or `npx tsc --noEmit` across relevant packages)
5. `npm run build` succeeds
</verification>

<success_criteria>
- MC percentage mode uses additive cumulative return (sum of returns, not multiplicative compounding)
- Health check correlation flags require sampleSize >= 10
- Health check tail dependence flags require sampleSize >= 10
- Strategy similarity output has no `recommendation` or `recommendations` fields
- Edge decay summary fields recentWinRate, historicalWinRate, recentProfitFactor, historicalProfitFactor are `number | null` (not `number`)
- All existing tests pass (with appropriate test updates)
</success_criteria>

<output>
After completion, create `.planning/quick/010-fix-mcp-mc-additive-minsample-recs-null/010-SUMMARY.md`
</output>
