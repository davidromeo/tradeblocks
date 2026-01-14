# Phase 12-02-FIX Summary

## Objective
Fix UAT-001: Expand MCP tool schemas to expose all underlying calculation module parameters, enabling Claude to fully customize analysis without hidden hardcoded defaults.

## Execution Log

### Task 1: Expand run_monte_carlo schema
**Commit:** `acca1a0`
**Changes:**
- Expanded from 4 to 12+ parameters
- Added: simulationLength, resampleWindow, resampleMethod, initialCapital, tradesPerYear, randomSeed, normalizeTo1Lot
- Added worst-case parameters: worstCasePercentage, worstCaseMode, worstCaseSizing
- Updated handler to pass all params to MonteCarloParams
- Updated configuration display and structured output

### Task 2: Expand get_correlation_matrix schema
**Commit:** `5a45343`
**Changes:**
- Expanded from 2 to 5 parameters
- Added: alignment ('shared'/'zero-pad'), normalization ('raw'/'margin'/'notional'), dateBasis ('opened'/'closed'), timePeriod ('daily'/'weekly'/'monthly')
- Updated configuration display with full options table
- Updated structured output to include options object

### Task 3: Expand get_tail_risk schema
**Commit:** `8a42d7d`
**Changes:**
- Expanded from 1 to 6 parameters
- Added: tailThreshold, minTradingDays, normalization, dateBasis, strategyFilter, varianceThreshold
- All params passed to TailRiskAnalysisOptions
- Updated configuration display and structured output

### Task 4: Expand run_walk_forward schema
**Commit:** `8948906`
**Changes:**
- Expanded from 5 to 10+ parameters
- Added explicit day mode: inSampleDays, outOfSampleDays, stepSizeDays (overrides window counts)
- Expanded optimization targets: added profitFactor, cagr, avgDailyPl
- Added trade constraints: minInSampleTrades, minOutOfSampleTrades
- Added data handling: normalizeTo1Lot, selectedStrategies
- Two modes: window count (convenience) or explicit days (precision)

### Task 5: Expand get_position_sizing schema
**Commit:** `0f60ded`
**Changes:**
- Expanded from 2 to 5 parameters
- Added: kellyFraction ('full'/'half'/'quarter'), maxAllocationPct, includeNegativeKelly
- Handler applies Kelly multiplier and allocation caps
- Output shows raw vs adjusted allocations
- Recommendations show selected fraction indicator

### Task 6: Expand Tier 1 block tools schemas
**Commit:** `106a5fd`
**Changes:**
- **list_backtests:** Added sortBy (name/tradeCount/netPl/dateRange), sortOrder (asc/desc)
- **get_trades:** Added minPl/maxPl filters, sortBy (date/pl/strategy), sortOrder
- **compare_blocks:** Added metrics filter to select specific comparison metrics

## Files Modified
- `packages/mcp-server/src/tools/analysis.ts` (Tasks 1-5)
- `packages/mcp-server/src/tools/blocks.ts` (Task 6)

## Key Decisions

1. **Backward Compatibility**: All new parameters have sensible defaults, so existing tool calls work unchanged.

2. **Dual Mode Pattern**: run_walk_forward supports both window count mode (simple) and explicit days mode (precise). Explicit days override window count calculations when provided.

3. **Optional vs Default**: Used `.default()` for parameters with sensible defaults, `.optional()` for truly optional params (like filters).

4. **Structured Data**: All tools include new options in structuredData for Claude reasoning transparency.

5. **Kelly Fraction Safety**: Position sizing applies multipliers and caps to protect against unrealistic allocation recommendations.

## Verification
- Build: `pnpm --filter tradeblocks-mcp build` - PASSED
- Lint: `pnpm run lint` - PASSED

## Commit History
| Task | Commit | Description |
|------|--------|-------------|
| 1 | `acca1a0` | expand run_monte_carlo schema |
| 2 | `5a45343` | expand get_correlation_matrix schema |
| 3 | `8a42d7d` | expand get_tail_risk schema |
| 4 | `8948906` | expand run_walk_forward schema |
| 5 | `0f60ded` | expand get_position_sizing schema |
| 6 | `106a5fd` | expand tier 1 block tools schemas |
