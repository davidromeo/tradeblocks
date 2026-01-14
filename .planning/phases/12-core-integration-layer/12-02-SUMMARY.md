---
phase: 12-core-integration-layer
plan: 02
subsystem: mcp-server
tags: [mcp, analysis-tools, walk-forward, monte-carlo, correlation, tail-risk, kelly]

# Dependency graph
requires:
  - phase: 12-01
    provides: Block loading utilities, output formatters, Tier 1 tools
provides:
  - Dual output pattern (markdown + JSON resource)
  - 5 Tier 2 advanced analysis MCP tools
  - Walk-forward, Monte Carlo, correlation, tail risk, position sizing
affects: [phase-12-03-ui-integration, phase-13]

# Tech tracking
tech-stack:
  added: []
  patterns: ["createDualOutput()", "registerAnalysisTools()"]

key-files:
  created:
    - "packages/mcp-server/src/tools/analysis.ts"
  modified:
    - "packages/mcp-server/src/index.ts"
    - "packages/mcp-server/src/tools/blocks.ts"
    - "packages/mcp-server/src/utils/output-formatter.ts"

key-decisions:
  - "All MCP tools return dual output: markdown for display + JSON resource for Claude reasoning"
  - "Walk-forward uses dynamic window sizing based on trade date range"
  - "Monte Carlo defaults to trades resample method with worst-case pool injection"
  - "Correlation defaults to Kendall's tau (more robust to outliers)"
  - "Tail risk uses 10th percentile threshold for tail definition"
  - "Kelly warnings for fractions > 25% (portfolio) or > 50% (strategy)"

patterns-established:
  - "createDualOutput(markdown, data) for all tool responses"
  - "Structured JSON includes all numerical values for Claude reasoning"
  - "Error responses still use simple { content: [text], isError: true }"

issues-created: []

# Metrics
duration: ~15min
completed: 2026-01-14
---

# Phase 12 Plan 02: Advanced Analysis Tools Summary

**5 Tier 2 advanced analysis MCP tools with dual output pattern**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-01-14
- **Completed:** 2026-01-14
- **Tasks:** 3 (all auto)
- **Files created:** 1
- **Files modified:** 3

## Accomplishments

- Added `createDualOutput()` helper for dual output pattern (markdown + JSON)
- Refactored all 6 Tier 1 tools to include structured JSON resource
- Implemented 5 Tier 2 analysis tools:
  1. `run_walk_forward` - Walk-forward analysis with verdict assessment
  2. `run_monte_carlo` - Bootstrap simulation with VaR and percentile bands
  3. `get_correlation_matrix` - Kendall/Spearman/Pearson correlation analysis
  4. `get_tail_risk` - Gaussian copula tail dependence analysis
  5. `get_position_sizing` - Kelly criterion capital allocation
- Registered analysis tools in MCP server index

## Task Commits

1. **Task 0: Add dual output pattern to Tier 1 tools** - `c9541a8` (feat)
2. **Task 1: Implement walk-forward and Monte Carlo tools** - `7ca727a` (feat)
3. **Task 2: Implement correlation, tail risk, position sizing tools** - `3b014af` (feat)

## Files Created/Modified

### Created
- `packages/mcp-server/src/tools/analysis.ts` - 5 Tier 2 analysis MCP tools

### Modified
- `packages/mcp-server/src/index.ts` - Import and register analysis tools
- `packages/mcp-server/src/tools/blocks.ts` - Add dual output to all 6 Tier 1 tools
- `packages/mcp-server/src/utils/output-formatter.ts` - Add createDualOutput() helper

## Decisions Made

1. **Dual output pattern:** All tools return both markdown (for display) and JSON resource (for Claude reasoning). This enables Claude to parse numerical values without regex extraction from markdown tables.

2. **Walk-forward window sizing:** Dynamic calculation based on trade date range. Uses isWindowCount and oosWindowCount to determine in-sample and out-of-sample periods automatically.

3. **Monte Carlo defaults:** Uses trades resample method (not daily or percentage) for simplicity. Worst-case testing enabled by default with 5% pool injection.

4. **Correlation method:** Defaults to Kendall's tau which is more robust to outliers than Pearson.

5. **Tail risk thresholds:** Uses 10th percentile for tail definition (tailThreshold=0.1) and 80% variance threshold for effective factors.

6. **Kelly warnings:** Portfolio Kelly > 25% or strategy Kelly > 50% triggers warnings. Negative Kelly indicates strategy should be removed.

## Deviations from Plan

None - all tasks completed as specified.

## Tool Capabilities

### run_walk_forward
- Parameters: `blockId` (required), `strategy`, `isWindowCount`, `oosWindowCount`, `optimizationTarget`
- Returns: Summary metrics, verdict assessment, recommended parameters, per-period results

### run_monte_carlo
- Parameters: `blockId` (required), `strategy`, `numSimulations`, `includeWorstCase`
- Returns: Return statistics, risk metrics, VaR, percentile bands

### get_correlation_matrix
- Parameters: `blockId` (required), `method`
- Returns: Correlation matrix, analytics, highly correlated pairs warnings

### get_tail_risk
- Parameters: `blockId` (required)
- Returns: Joint tail risk matrix, analytics, marginal contributions, interpretation

### get_position_sizing
- Parameters: `blockId` (required), `capitalBase`
- Returns: Portfolio Kelly, per-strategy Kelly, allocation recommendations, warnings

## Verification Checklist

- [x] `pnpm --filter tradeblocks-mcp build` succeeds
- [x] `pnpm run lint` passes
- [x] All 5 analysis tools registered (run_walk_forward, run_monte_carlo, get_correlation_matrix, get_tail_risk, get_position_sizing)
- [x] Tools import from @lib/calculations (not reimplementing calculations)
- [x] Error handling for blocks with insufficient data (e.g., correlation needs 2+ strategies)

## Next Phase Readiness

Ready for Phase 12 Plan 03: UI Integration (if planned)
- All 11 MCP tools implemented (6 Tier 1 + 5 Tier 2)
- Dual output pattern established for Claude reasoning
- Tools reuse existing calculation modules without duplication

---
*Phase: 12-core-integration-layer*
*Plan: 02*
*Completed: 2026-01-14*
