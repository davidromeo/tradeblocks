---
phase: quick-004
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/lib/calculations/edge-decay-synthesis.ts
  - packages/lib/calculations/mc-regime-comparison.ts
  - packages/mcp-server/src/tools/blocks/health.ts
  - packages/mcp-server/src/tools/blocks/comparison.ts
  - packages/mcp-server/src/tools/edge-decay.ts
  - tests/unit/mc-regime-comparison.test.ts
  - tests/unit/edge-decay-synthesis.test.ts
autonomous: true

must_haves:
  truths:
    - "topObservations contain only rate-type metrics (winRate, profitFactor, sharpeRatio, etc.), never dollar-value metrics (avgWin, avgLoss, avgReturn, netPl)"
    - "compositeDecayScore.meanAbsPercentChange is computed only from rate-type observations"
    - "Tail risk flag in health check shows per-pair sample sizes (n=X) not a single aggregate number"
    - "sortBy enum in get_strategy_comparison accepts 'netPl' alongside 'pl'"
    - "metricsToCompare enum in block_diff accepts 'netPl' alongside 'pl'"
    - "MC regime comparison output has no severity field -- only compositeScore and scoreDescription"
  artifacts:
    - path: "packages/lib/calculations/edge-decay-synthesis.ts"
      provides: "metricType classification, filtered topObservations, filtered meanAbsPercentChange"
      contains: "metricType"
    - path: "packages/lib/calculations/mc-regime-comparison.ts"
      provides: "Severity-free divergence output"
    - path: "packages/mcp-server/src/tools/blocks/health.ts"
      provides: "Per-pair sample sizes on tail risk flags"
    - path: "packages/mcp-server/src/tools/blocks/comparison.ts"
      provides: "netPl in sortBy and metricsToCompare enums"
  key_links:
    - from: "packages/lib/calculations/edge-decay-synthesis.ts"
      to: "packages/lib/calculations/mc-regime-comparison.ts"
      via: "divergence field shape (no severity)"
      pattern: "regimeResult\\.divergence"
---

<objective>
Fix 5 post-implementation verification issues from quick task 003 (MCP tooling improvements).

Purpose: Ensure edge decay analysis, health checks, and comparison tools produce clean, accurate, non-interpretive output.
Output: Updated lib calculations and MCP tool files with all 5 issues resolved.
</objective>

<execution_context>
@/Users/davidromeo/.claude/get-shit-done/workflows/execute-plan.md
@/Users/davidromeo/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/lib/calculations/edge-decay-synthesis.ts
@packages/lib/calculations/mc-regime-comparison.ts
@packages/mcp-server/src/tools/blocks/health.ts
@packages/mcp-server/src/tools/blocks/comparison.ts
@packages/mcp-server/src/tools/edge-decay.ts
@tests/unit/mc-regime-comparison.test.ts
@tests/unit/edge-decay-synthesis.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix dollar-metric pollution in edge decay and remove MC severity labels</name>
  <files>
    packages/lib/calculations/edge-decay-synthesis.ts
    packages/lib/calculations/mc-regime-comparison.ts
    packages/mcp-server/src/tools/edge-decay.ts
    tests/unit/mc-regime-comparison.test.ts
    tests/unit/edge-decay-synthesis.test.ts
  </files>
  <action>
**Issue 1+2: Dollar-metric pollution in edge-decay-synthesis.ts**

1. Add `metricType: 'dollar' | 'rate'` field to the `FactualObservation` interface.

2. Create a constant map classifying known metrics:
   ```typescript
   const DOLLAR_METRICS = new Set([
     'avgWin', 'avgLoss', 'avgReturn', 'netPl',
   ])
   ```
   Default any metric NOT in this set to `'rate'`.

3. In `extractObservations()`, set `metricType` on each observation:
   - For rolling metrics (line ~243-253): use `DOLLAR_METRICS.has(m.metric) ? 'dollar' : 'rate'`
   - For MC regime metrics (line ~258-269): all four metrics (`probabilityOfProfit`, `expectedReturn`, `sharpeRatio`, `medianMaxDrawdown`) are rate-type, so set `'rate'`
   - For WF efficiency metrics (line ~275-290): all are rate-type (`sharpeEfficiency`, `winRateEfficiency`, `profitFactorEfficiency`), set `'rate'`
   - For period trend metrics (line ~296-309): these have `absPercentChange: null` so they never affect topObservations or meanAbsPercentChange anyway, but still classify: `netPl` and `tradeCount` trend slopes are dollar/count, others are rate. Use `DOLLAR_METRICS.has(metricName) ? 'dollar' : 'rate'` (tradeCount is not a dollar metric but its trend is count-based -- classify as dollar to exclude from composite since it's not an edge metric)
   - For live alignment metrics (line ~315-341): `directionAgreementRate` and `executionEfficiency` are rate-type

4. Filter `topObservations` (line ~569): Change from:
   ```typescript
   const topObservations = observations.filter(o => o.absPercentChange !== null).slice(0, 5)
   ```
   To:
   ```typescript
   const topObservations = observations
     .filter(o => o.absPercentChange !== null && o.metricType === 'rate')
     .slice(0, 5)
   ```

5. Filter `meanAbsPercentChange` computation (line ~586-589): Change from using all `obsWithAbsPct` to only rate-type:
   ```typescript
   const rateObsWithAbsPct = observations.filter(o => o.absPercentChange !== null && o.metricType === 'rate')
   const meanAbsPctValue = rateObsWithAbsPct.length > 0
     ? rateObsWithAbsPct.reduce((sum, o) => sum + o.absPercentChange!, 0) / rateObsWithAbsPct.length
     : 0
   ```

6. Dollar observations remain in the full `observations` array with their `metricType: 'dollar'` tag -- no filtering there.

**Issue 6: Remove MC regime severity labels**

7. In `packages/lib/calculations/mc-regime-comparison.ts`:
   - Remove the `DivergenceSeverity` type export (line 22-26)
   - Remove `severity` from the `divergence` field of `MCRegimeComparisonResult` (line 69)
   - In `classifyDivergence()` function: remove the severity classification logic and the `severity` field from its return type. Keep `compositeScore` and `scoreDescription`. Update the function signature and body:
     ```typescript
     export function classifyDivergence(
       comparisons: MetricComparison[]
     ): { compositeScore: number; scoreDescription: string } {
       // ... keep compositeScore calculation ...
       // remove severity logic
       return { compositeScore, scoreDescription }
     }
     ```

8. In `packages/lib/calculations/edge-decay-synthesis.ts`:
   - Line 460: Remove `severity: regimeResult.divergence.severity` from the regime signal summary. The `compositeScore` is already included on line 461.

9. In `packages/mcp-server/src/tools/edge-decay.ts`:
   - Line 248: Update the tool description to remove "Classifies divergence severity as aligned, mild_divergence, significant_divergence, or regime_break." Replace with "Returns a composite divergence score (0 = aligned, higher = more divergent)."
   - Line 333: Remove `const severity = result.divergence.severity.replace(/_/g, " ");`
   - Line 336: Update summary string to remove severity label, use score only: `Divergence: score ${score}`
   - The `structuredData` on line 378 passes `result.divergence` directly -- since severity is removed from the source type, this will automatically stop including it.

10. In `tests/unit/mc-regime-comparison.test.ts`:
    - Line 306: Change `expect(result.severity).toBe('regime_break')` to `expect(result.compositeScore).toBeGreaterThanOrEqual(1.00)` (the compositeScore assertion already exists on line 307, so just delete line 306)
    - Search for any other `.severity` assertions in this file and remove/update them.

11. In `tests/unit/edge-decay-synthesis.test.ts`:
    - Add a test that verifies `topObservations` contains only rate-type metrics
    - Add a test or assertion that dollar-type observations (avgWin, avgLoss, avgReturn, netPl) exist in the full `observations` array with `metricType: 'dollar'`

12. Run `npm test -- tests/unit/mc-regime-comparison.test.ts tests/unit/edge-decay-synthesis.test.ts` to verify.
  </action>
  <verify>
    `npm test -- tests/unit/mc-regime-comparison.test.ts tests/unit/edge-decay-synthesis.test.ts` passes.
    `npx tsc --noEmit -p packages/lib/tsconfig.json` passes (no type errors from removing severity).
    `npx tsc --noEmit -p packages/mcp-server/tsconfig.json` passes.
  </verify>
  <done>
    - FactualObservation has metricType field; dollar metrics tagged as 'dollar', rate metrics as 'rate'
    - topObservations contains only rate-type metrics
    - compositeDecayScore.meanAbsPercentChange computed only from rate-type observations
    - DivergenceSeverity type removed; divergence object has only compositeScore + scoreDescription
    - All severity references removed from edge-decay MCP tool and synthesis engine
    - Tests pass with updated assertions
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix tail risk per-pair sample sizes and add netPl to comparison enums</name>
  <files>
    packages/mcp-server/src/tools/blocks/health.ts
    packages/mcp-server/src/tools/blocks/comparison.ts
  </files>
  <action>
**Issue 3: Tail risk flag per-pair sample sizes**

The `TailRiskAnalysisResult` has a single `tradingDaysUsed: number` (aggregate). Per-pair sample sizes are NOT available in the tail risk result. However, the correlation matrix IS already computed in the health check (line 167-173) and it HAS `sampleSizes: number[][]` per pair.

The tail risk and correlation use the same strategy pairing and alignment approach, so the correlation's per-pair sample sizes are a valid proxy.

In `packages/mcp-server/src/tools/blocks/health.ts`:

1. In the high tail dependence pairs loop (lines 333-352), the correlation matrix's `sampleSizes` are available since both use the same strategies. BUT the strategy order may differ between `tailRisk.strategies` and `correlationMatrix.strategies`. Need to map indices.

2. Build a strategy-to-correlation-index map:
   ```typescript
   const corrStrategyIndex = new Map<string, number>()
   correlationMatrix.strategies.forEach((s, i) => corrStrategyIndex.set(s, i))
   ```

3. In the tail dependence pairs loop, look up the per-pair sample size from correlation:
   ```typescript
   const corrI = corrStrategyIndex.get(tailRisk.strategies[i])
   const corrJ = corrStrategyIndex.get(tailRisk.strategies[j])
   const pairSampleSize = (corrI !== undefined && corrJ !== undefined)
     ? correlationMatrix.sampleSizes[corrI][corrJ]
     : null
   ```

4. Update the `highTailPairs.push()` to include `n=X`:
   ```typescript
   highTailPairs.push(
     `${tailRisk.strategies[i]} & ${tailRisk.strategies[j]} (${avgTail.toFixed(2)}${pairSampleSize !== null ? `, n=${pairSampleSize}` : ''})`
   )
   ```

5. Remove the aggregate `tradingDaysUsed` from the tail flag message (line 357):
   Change from:
   ```typescript
   message: `High tail dependence pairs (>${tailThreshold}, ${tailRisk.tradingDaysUsed} shared trading days): ${highTailPairs.join(", ")}`
   ```
   To:
   ```typescript
   message: `High tail dependence pairs (>${tailThreshold}): ${highTailPairs.join(", ")}`
   ```

**Issue 5: sortBy enum accepts "netPl"**

In `packages/mcp-server/src/tools/blocks/comparison.ts`:

1. `get_strategy_comparison` tool (line 53):
   - Change `sortBy` enum from `["pl", "winRate", "trades", "profitFactor", "name"]` to `["pl", "netPl", "winRate", "trades", "profitFactor", "name"]`
   - Update the sort `switch` statement (line 121-137): add `case "netPl":` that falls through to the `"pl"` case:
     ```typescript
     case "netPl":
     case "pl":
     default:
       return (a.totalPl - b.totalPl) * multiplier;
     ```
   - Update the description to mention netPl: `"Sort strategies by metric (default: pl for net P&L). 'netPl' and 'pl' are equivalent."`

2. `block_diff` tool (line 406-419):
   - Change `metricsToCompare` enum from `["trades", "pl", "winRate", "profitFactor", "sharpeRatio", "maxDrawdown"]` to `["trades", "pl", "netPl", "winRate", "profitFactor", "sharpeRatio", "maxDrawdown"]`
   - In `includeMetric` usage (line ~542-561): when checking `includeMetric("pl")`, also check for `"netPl"`:
     ```typescript
     if (includeMetric("pl") || includeMetric("netPl")) entry.netPl = stats.netPl;
     ```

3. Run typecheck to verify.
  </action>
  <verify>
    `npx tsc --noEmit -p packages/mcp-server/tsconfig.json` passes.
    `npm test` passes (full test suite, since health.ts changes could affect integration tests).
  </verify>
  <done>
    - Tail risk flags show per-pair sample sizes from correlation matrix (e.g., "STRAT-A & STRAT-B (0.65, n=303)")
    - Aggregate tradingDaysUsed removed from tail flag message
    - get_strategy_comparison sortBy accepts "netPl" (treated same as "pl")
    - block_diff metricsToCompare accepts "netPl" (treated same as "pl")
    - All tests pass, no type errors
  </done>
</task>

</tasks>

<verification>
1. `npm test` -- full test suite passes
2. `npx tsc --noEmit -p packages/lib/tsconfig.json` -- lib compiles cleanly
3. `npx tsc --noEmit -p packages/mcp-server/tsconfig.json` -- MCP server compiles cleanly
4. Grep confirms no remaining references to `DivergenceSeverity` type or `.severity` on divergence objects (except in walk-forward-interpretation.ts which has its own unrelated severity concept)
5. Grep confirms `metricType` field exists on FactualObservation interface
</verification>

<success_criteria>
- Dollar-value metrics (avgWin, avgLoss, avgReturn, netPl) tagged as 'dollar' and excluded from topObservations and compositeDecayScore.meanAbsPercentChange
- Dollar metrics still present in full observations array (data preserved, just not dominant in summary)
- Tail risk flags show per-pair n= values sourced from correlation matrix sampleSizes
- sortBy and metricsToCompare enums accept "netPl" with backward-compatible "pl"
- MC regime severity labels fully removed from lib type, classification function, synthesis engine, and MCP tool
- All existing tests pass (with updated assertions where severity was checked)
</success_criteria>

<output>
After completion, create `.planning/quick/004-mcp-tooling-feedback-fixes/004-SUMMARY.md`
</output>
