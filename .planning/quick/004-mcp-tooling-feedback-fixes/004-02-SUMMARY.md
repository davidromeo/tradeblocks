# Quick Task 004 - Task 2: Tail Risk Sample Sizes and netPl Enum Additions

**One-liner:** Per-pair sample sizes from correlation matrix in tail risk flags, plus netPl accepted in sortBy/metricsToCompare enums

## Task Commits

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | bb6b52e | fix | Show per-pair sample sizes in tail risk health flags |
| 2 | ca6c981 | feat | Add netPl to sortBy and metricsToCompare enums |

## Changes Made

### Issue 3: Tail Risk Per-Pair Sample Sizes (health.ts)

**Problem:** Tail risk flags showed a single aggregate `tradingDaysUsed` count, which was misleading when different strategy pairs had different overlap periods.

**Solution:** Cross-reference the correlation matrix's `sampleSizes` (which uses the same strategy pairing/alignment approach) to display per-pair sample sizes.

**Implementation:**
- Built a `corrStrategyIndex` map to translate between tail risk strategy indices and correlation matrix indices
- For each high tail dependence pair, look up `correlationMatrix.sampleSizes[corrI][corrJ]`
- Output now reads: `"STRAT-A & STRAT-B (0.65, n=303)"` instead of a single aggregate count
- Removed aggregate `tradingDaysUsed` from the tail flag message prefix

**Files modified:** `packages/mcp-server/src/tools/blocks/health.ts`

### Issue 5: netPl in Comparison Enums (comparison.ts)

**Problem:** Users calling `get_strategy_comparison` with `sortBy: "netPl"` or `block_diff` with `metricsToCompare: ["netPl"]` got validation errors, even though the output field is named `netPl`.

**Solution:** Added `"netPl"` to both enum definitions with fall-through/equivalence to `"pl"`.

**Implementation:**
- `get_strategy_comparison`: Added `"netPl"` to `sortBy` enum; added `case "netPl":` fall-through to `case "pl":` in sort switch
- `block_diff`: Added `"netPl"` to `metricsToCompare` enum; updated `buildPortfolioEntry` to check `includeMetric("pl") || includeMetric("netPl")`
- Updated tool descriptions to note equivalence

**Files modified:** `packages/mcp-server/src/tools/blocks/comparison.ts`

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit -p packages/mcp-server/tsconfig.json` -- passes (no type errors)
- `npm test` -- 71 suites, 1177 tests, all passing

## Metrics

- **Duration:** ~2 minutes
- **Completed:** 2026-02-06

## Self-Check: PASSED
