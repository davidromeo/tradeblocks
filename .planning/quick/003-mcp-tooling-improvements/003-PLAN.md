---
phase: quick
plan: 003
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/mcp-server/src/tools/shared/filters.ts
  - packages/mcp-server/src/tools/blocks/core.ts
  - packages/mcp-server/src/tools/edge-decay.ts
  - packages/mcp-server/src/tools/blocks/health.ts
  - packages/mcp-server/src/tools/blocks/analysis.ts
  - packages/mcp-server/src/tools/blocks/comparison.ts
  - packages/lib/calculations/edge-decay-synthesis.ts
autonomous: true

must_haves:
  truths:
    - "get_statistics filters daily logs by date range when startDate/endDate are provided"
    - "analyze_rolling_metrics returns series only when includeSeries=true"
    - "portfolio_health_check correlation and tail flags include sample size (n=X)"
    - "analyze_edge_decay observations are sorted by magnitude with topObservations in summary"
    - "stress_test pre-filters built-in scenarios by portfolio date overlap when no explicit scenarios"
    - "get_strategy_comparison and block_diff output uses netPl/grossPl instead of bare pl"
    - "analyze_edge_decay summary includes compositeDecayScore with component breakdown"
  artifacts:
    - path: "packages/mcp-server/src/tools/shared/filters.ts"
      provides: "filterDailyLogsByDateRange function"
      exports: ["filterDailyLogsByDateRange"]
    - path: "packages/lib/calculations/edge-decay-synthesis.ts"
      provides: "compositeDecayScore, topObservations, absPercentChange on FactualObservation"
      contains: "compositeDecayScore"
  key_links:
    - from: "packages/mcp-server/src/tools/blocks/core.ts"
      to: "packages/mcp-server/src/tools/shared/filters.ts"
      via: "import filterDailyLogsByDateRange"
      pattern: "filterDailyLogsByDateRange"
---

<objective>
Execute 7 targeted MCP server and lib improvements: bug fix for daily log date filtering, rolling metrics output trimming, health check sample size context, edge decay magnitude sorting + topObservations, stress test date pre-filtering, field naming consistency (pl -> netPl), and composite decay score.

Purpose: Fix a bug where get_statistics ignores date filters on daily logs, reduce token waste from large rolling metric series, add actionable context to health check flags, improve edge decay synthesis output quality, eliminate irrelevant stress scenarios, and align field naming for consistency.

Output: Updated MCP tools and edge-decay-synthesis lib with all 7 improvements.
</objective>

<execution_context>
@/Users/davidromeo/.claude/get-shit-done/workflows/execute-plan.md
@/Users/davidromeo/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/mcp-server/src/tools/shared/filters.ts
@packages/mcp-server/src/tools/blocks/core.ts
@packages/mcp-server/src/tools/edge-decay.ts
@packages/mcp-server/src/tools/blocks/health.ts
@packages/mcp-server/src/tools/blocks/analysis.ts
@packages/mcp-server/src/tools/blocks/comparison.ts
@packages/lib/calculations/edge-decay-synthesis.ts
@packages/lib/models/daily-log.ts
@packages/lib/models/tail-risk.ts
@packages/lib/calculations/correlation.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: MCP server fixes (items 1, 2, 3, 5, 6)</name>
  <files>
    packages/mcp-server/src/tools/shared/filters.ts
    packages/mcp-server/src/tools/blocks/core.ts
    packages/mcp-server/src/tools/edge-decay.ts
    packages/mcp-server/src/tools/blocks/health.ts
    packages/mcp-server/src/tools/blocks/analysis.ts
    packages/mcp-server/src/tools/blocks/comparison.ts
  </files>
  <action>
    **Item 1 - Bug Fix: get_statistics daily log date filtering**

    In `packages/mcp-server/src/tools/shared/filters.ts`:
    - Import `DailyLogEntry` from `@tradeblocks/lib`
    - Add `filterDailyLogsByDateRange(dailyLogs: DailyLogEntry[], startDate?: string, endDate?: string): DailyLogEntry[]` function
    - Logic mirrors `filterByDateRange` but uses `entry.date` (Date object) instead of `t.dateOpened`
    - When startDate provided: filter `entry.date >= start`
    - When endDate provided: set end to 23:59:59.999 and filter `entry.date <= end`
    - Export the function

    In `packages/mcp-server/src/tools/blocks/core.ts`:
    - Import `filterDailyLogsByDateRange` from `../shared/filters.js`
    - Import `DailyLogEntry` type from `@tradeblocks/lib`
    - After line 400 where `dailyLogs` is declared, add: when `startDate` or `endDate` are provided AND `dailyLogs` exists AND we are NOT strategy-filtered, filter dailyLogs using `filterDailyLogsByDateRange(dailyLogs, startDate, endDate)`
    - Store in a `let filteredDailyLogs` variable and pass that to `calculator.calculatePortfolioStats` on line 434 (instead of raw `dailyLogs`)
    - Also update the `isStrategyFiltered` ternary on line 434 to use `filteredDailyLogs`

    **Item 2 - Trim analyze_rolling_metrics output**

    In `packages/mcp-server/src/tools/edge-decay.ts`:
    - In the `analyze_rolling_metrics` tool's inputSchema (around line 117), add a new Zod field:
      ```
      includeSeries: z.boolean().optional().default(false).describe("Include full rolling series data points in output (default: false, saves tokens)")
      ```
    - Destructure `includeSeries` alongside existing params in the handler
    - In the structuredData object (around line 209), change `series: result.series` to conditionally include it:
      ```
      ...(includeSeries ? { series: result.series } : {}),
      ```
    - Keep all other fields (seasonalAverages, recentVsHistorical, dataQuality) as-is

    **Item 3 - Health check: sample size context on correlation/tail flags**

    In `packages/mcp-server/src/tools/blocks/health.ts`:
    - In the high correlation pairs loop (lines 307-316), read `correlationMatrix.sampleSizes[i][j]` and append `, n=${sampleSize}` to each pair string:
      ```
      const sampleSize = correlationMatrix.sampleSizes[i][j];
      highCorrPairs.push(
        `${correlationMatrix.strategies[i]} & ${correlationMatrix.strategies[j]} (${val.toFixed(2)}, n=${sampleSize})`
      );
      ```
    - In the high tail dependence pairs loop (lines 333-351), the tail risk result does NOT have per-pair sample sizes. Instead, use the overall `tailRisk.tradingDaysUsed` as the n context. Append `, n=${tailRisk.tradingDaysUsed} days` to the flag message (not per-pair, but on the overall flag message string):
      Change the warning message on line 355 from:
      ```
      `High tail dependence pairs (>${tailThreshold}): ${highTailPairs.join(", ")}`
      ```
      to:
      ```
      `High tail dependence pairs (>${tailThreshold}, ${tailRisk.tradingDaysUsed} shared trading days): ${highTailPairs.join(", ")}`
      ```

    **Item 5 - Stress test: pre-filter scenarios by portfolio date range**

    In `packages/mcp-server/src/tools/blocks/analysis.ts`:
    - In the stress_test handler, the `else` block (lines 102-113) runs ALL built-in scenarios when no specific `scenarios` param is given
    - Before that else block, compute the portfolio date range from trades (already done on lines 139-149, but move the calculation BEFORE the scenario selection logic)
    - In the else block (no specific scenarios requested), add a date overlap check: only include a built-in scenario if it overlaps with the portfolio date range. Overlap means: `scenario.endDate >= portfolioStartDate && scenario.startDate <= portfolioEndDate`
    - This replaces the current "run all, skip empty" behavior with "only attempt relevant scenarios"
    - When specific scenarios ARE requested (the if block, lines 75-101), keep current behavior (run exactly what was asked for)
    - Remove `skippedScenarios` from the summary structuredData when all skips are from date pre-filtering. Specifically: track pre-filtered scenario names separately. In the output, only include `skippedScenarios` for scenarios that had date overlap but zero trades (genuine coverage gaps), not for pre-filtered ones. Add a `preFilteredScenarios` field listing what was excluded by date range.

    **Item 6 - Field naming: pl -> netPl in comparison tools**

    In `packages/mcp-server/src/tools/blocks/comparison.ts`:

    For `get_strategy_comparison` (lines 31-187):
    - In the `sortBy` enum (line 53), keep `"pl"` in the enum for backward compat but update the description: `"Sort strategies by metric (default: pl for net P&L)"`
    - In the output `strategies` array mapping (lines 160-168), rename `pl: s.totalPl` to `netPl: s.totalPl` and add `grossPl: s.totalPl + (s.totalCommissions ?? 0)` (check if `totalCommissions` exists on the strategy stats type -- if not, just rename `pl` to `netPl` and skip grossPl for strategy comparison since per-strategy commissions may not be tracked)

    For `block_diff` (lines 386-624):
    - In the `metricsToCompare` enum (line 409), keep `"pl"` for backward compat
    - In `buildStrategyEntry` (lines 479-517), rename `pl:` to `netPl:` in both entryA and entryB objects (lines 486 and 495)
    - In the delta calculation (line 506), rename `pl:` to `netPl:`
  </action>
  <verify>
    Run `cd /Users/davidromeo/Code/tradeblocks && npm run --workspace=packages/mcp-server build` to verify TypeScript compilation.
    Run `npm test -- --passWithNoTests packages/mcp-server` if any MCP tests exist.
    Verify no TypeScript errors with `npx tsc --noEmit -p packages/mcp-server/tsconfig.json`.
  </verify>
  <done>
    - filterDailyLogsByDateRange exists in filters.ts and is used in core.ts get_statistics
    - analyze_rolling_metrics has includeSeries param, series omitted by default
    - Health check correlation flags show "n=X" per pair, tail flags show shared trading days count
    - stress_test pre-filters built-in scenarios by portfolio date overlap when no explicit scenarios
    - get_strategy_comparison outputs netPl instead of pl; block_diff outputs netPl instead of pl
    - All changes compile without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Edge decay synthesis improvements (items 4 + 7)</name>
  <files>
    packages/lib/calculations/edge-decay-synthesis.ts
  </files>
  <action>
    **Item 4 - Magnitude sorting + topObservations**

    In `packages/lib/calculations/edge-decay-synthesis.ts`:
    - Add `absPercentChange: number | null` field to the `FactualObservation` interface (after `percentChange`)
    - In `extractObservations()`, compute `absPercentChange` for every observation: `Math.abs(percentChange)` when percentChange is not null, otherwise null
    - After all observations are collected (line ~321, before return), sort the array by `absPercentChange` descending, with nulls last:
      ```typescript
      observations.sort((a, b) => {
        if (a.absPercentChange === null && b.absPercentChange === null) return 0
        if (a.absPercentChange === null) return 1
        if (b.absPercentChange === null) return -1
        return b.absPercentChange - a.absPercentChange
      })
      ```
    - Add `topObservations: FactualObservation[]` to the `EdgeDecaySummary` interface
    - In the summary construction (~line 549), compute topObservations as the first 5 observations with non-null absPercentChange:
      ```typescript
      const topObservations = observations.filter(o => o.absPercentChange !== null).slice(0, 5)
      ```
    - Add `topObservations` to the summary object

    **Item 7 - Composite decay score**

    In `packages/lib/calculations/edge-decay-synthesis.ts`:
    - Add `compositeDecayScore: number` to `EdgeDecaySummary` interface (0-1 scale, 0 = no decay, 1 = maximum decay)
    - Add `compositeDecayScoreComponents` to `EdgeDecaySummary`:
      ```typescript
      compositeDecayScoreComponents: {
        meanAbsPercentChange: { value: number; normalized: number; weight: number }
        mcRegimeDivergence: { value: number | null; normalized: number; weight: number }
        wfEfficiencyDelta: { value: number | null; normalized: number; weight: number }
        structuralFlagRatio: { value: number; normalized: number; weight: number }
      }
      ```

    Compute the composite score from 4 sub-scores in the summary construction area (after topObservations):

    1. **meanAbsPercentChange** (weight: 0.3): Average absPercentChange of all observations with non-null values. Normalize to 0-1 via: `Math.min(value / 50, 1)` (50% mean change = fully decayed). If no observations, value=0, normalized=0.

    2. **mcRegimeDivergence** (weight: 0.3): From `regimeResult?.divergence.compositeScore` (already 0-1). If regime was skipped, normalized=0 (neutral, not counted). Redistribute its weight equally among the other three components if null.

    3. **wfEfficiencyDelta** (weight: 0.2): Average of absolute deltas from `wfResult.recentVsHistorical.delta` (sharpe, winRate, profitFactor -- only non-null ones). Normalize: `Math.min(avgAbsDelta / 0.5, 1)` (0.5 absolute efficiency delta = fully decayed). If all null, normalized=0.

    4. **structuralFlagRatio** (weight: 0.2): `structuralFlagCount / totalMetricsCompared` where totalMetricsCompared is the number of metrics in rollingResult.recentVsHistorical.metrics. Normalize: this ratio is already 0-1.

    Weight redistribution when MC is null: redistribute 0.3 weight proportionally among the other 3 (so 0.3 becomes ~0.43, 0.2 becomes ~0.29, 0.2 becomes ~0.29).

    Final compositeDecayScore = weighted sum of normalized components.

    Clamp result to [0, 1] range via `Math.max(0, Math.min(1, score))`.
  </action>
  <verify>
    Run `cd /Users/davidromeo/Code/tradeblocks && npx tsc --noEmit -p packages/lib/tsconfig.json` to verify lib compilation.
    Run `npm test -- tests/unit/edge-decay-synthesis.test.ts` if test exists, otherwise `npm test -- --passWithNoTests`.
    Verify the FactualObservation interface change doesn't break downstream consumers by checking MCP server still compiles: `npx tsc --noEmit -p packages/mcp-server/tsconfig.json`.
  </verify>
  <done>
    - FactualObservation has absPercentChange field
    - Observations are sorted by absPercentChange descending (nulls last)
    - EdgeDecaySummary has topObservations (first 5 non-null)
    - EdgeDecaySummary has compositeDecayScore (0-1) and compositeDecayScoreComponents
    - Composite score weights: meanAbsPercentChange 0.3, mcRegimeDivergence 0.3, wfEfficiencyDelta 0.2, structuralFlagRatio 0.2
    - Weight redistribution works correctly when MC is null
    - All TypeScript compilation passes
  </done>
</task>

<task type="auto">
  <name>Task 3: Final validation and version bump</name>
  <files>
    packages/mcp-server/package.json
  </files>
  <action>
    1. Run full typecheck across both packages: `npx tsc --noEmit -p packages/lib/tsconfig.json && npx tsc --noEmit -p packages/mcp-server/tsconfig.json`
    2. Run any existing tests that touch the modified files: `npm test`
    3. If any test failures, fix them. Common issues:
       - Snapshot tests may need updating if output shape changed (observations now have absPercentChange)
       - Strategy comparison tests may check for `pl` field -- update to `netPl`
    4. Bump MCP server version in `packages/mcp-server/package.json`: minor version bump (e.g., 2.7.0 -> 2.8.0) since this adds new features (includeSeries param, compositeDecayScore, pre-filtering)
    5. Run `npm run --workspace=packages/mcp-server build` to verify production build succeeds
  </action>
  <verify>
    `npm test` passes all tests.
    `npm run --workspace=packages/mcp-server build` succeeds.
    `npx tsc --noEmit -p packages/mcp-server/tsconfig.json` has zero errors.
  </verify>
  <done>
    - All tests pass
    - MCP server builds successfully
    - Version bumped appropriately
    - No TypeScript errors anywhere
  </done>
</task>

</tasks>

<verification>
1. TypeScript: `npx tsc --noEmit -p packages/lib/tsconfig.json && npx tsc --noEmit -p packages/mcp-server/tsconfig.json` -- zero errors
2. Tests: `npm test` -- all pass
3. Build: `npm run --workspace=packages/mcp-server build` -- success
4. Spot-check: grep for `filterDailyLogsByDateRange` in core.ts, `includeSeries` in edge-decay.ts, `compositeDecayScore` in edge-decay-synthesis.ts, `netPl` in comparison.ts
</verification>

<success_criteria>
- All 7 items implemented and compiling
- No regression in existing tests
- MCP server builds and version bumped
</success_criteria>

<output>
After completion, create `.planning/quick/003-mcp-tooling-improvements/003-SUMMARY.md`
</output>
