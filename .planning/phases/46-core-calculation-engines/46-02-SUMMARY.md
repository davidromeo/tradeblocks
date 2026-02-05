---
phase: 46-core-calculation-engines
plan: 02
subsystem: calculations
tags: [rolling-metrics, edge-decay, kelly, sharpe, seasonal, structural-flags]

# Dependency graph
requires:
  - phase: 46-core-calculation-engines (plan 01)
    provides: "period-segmentation engine, trend-detection utility (both already in index.ts)"
provides:
  - "Rolling metrics engine with 6 metrics over configurable trade-count window"
  - "Quarterly seasonal averages (Q1-Q4) for each rolling metric"
  - "Recent-vs-historical comparison with deltas and 4 structural flags"
  - "Smart auto-defaults for window sizes based on trade count"
  - "Standalone compareRecentVsHistorical for downstream use"
affects:
  - "46-core-calculation-engines plan 03 (MCP tool wiring)"
  - "47-50 downstream phases (consume rolling metrics and comparison outputs)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rolling window computation over trade-count-based windows (vs day-based in PerformanceCalculator)"
    - "Structural flag crossing logic: flags only fire when threshold is newly crossed"
    - "Smart auto-defaults: window = 20% clamped [20,200], recent = max(20%, 200)"

key-files:
  created:
    - "packages/lib/calculations/rolling-metrics.ts"
    - "tests/unit/rolling-metrics.test.ts"
  modified:
    - "packages/lib/calculations/index.ts"

key-decisions:
  - "Rolling window uses PortfolioStatsCalculator for Sharpe (handles risk-free rates) plus inline computation for basic metrics"
  - "Structural flags use crossing logic: flag fires only when recent crosses threshold AND historical was on the other side"
  - "Seasonal averages group rolling data points by calendar quarter across all years, not by raw period data"

patterns-established:
  - "Structural flag crossing pattern: compare recent vs historical against threshold, only flag on new crossings"
  - "Dual computation pattern: inline fast metrics for win rate/PF/netPl, PortfolioStatsCalculator for Sharpe, calculateKellyMetrics for Kelly"

# Metrics
duration: 7min
completed: 2026-02-05
---

# Phase 46 Plan 02: Rolling Metrics Engine Summary

**Rolling metrics engine with 6 trade-count-windowed metrics, Q1-Q4 seasonal averages, recent-vs-historical comparison, and 4 structural threshold flags**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-05T14:15:45Z
- **Completed:** 2026-02-05T14:22:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Rolling series computation over configurable trade-count window with smart auto-defaults (20% of trades clamped to [20, 200])
- Quarterly seasonal averages for all 6 rolling metrics (winRate, profitFactor, kellyPercent, sharpeRatio, avgReturn, netPl)
- Recent-vs-historical comparison with deltas, percent changes, and 4 structural flags (payoff inversion, win rate < 50%, PF < 1.0, Kelly < 0)
- 32 comprehensive test cases all passing, including crossing logic verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Build rolling metrics engine** - `7485ccc` (feat)
2. **Task 2: Test rolling metrics engine** - `4a08390` (test)

## Files Created/Modified
- `packages/lib/calculations/rolling-metrics.ts` - Rolling metrics engine with computeRollingMetrics and compareRecentVsHistorical
- `packages/lib/calculations/index.ts` - Added barrel export for rolling-metrics
- `tests/unit/rolling-metrics.test.ts` - 32 test cases covering all features, edge cases, and structural flag logic

## Decisions Made
- Used inline metric computation (win rate, profit factor, avg return, net P&L) for performance, with PortfolioStatsCalculator only for Sharpe ratio (which needs risk-free rate handling)
- Structural flags use crossing logic: a flag fires only when the recent value crosses a critical threshold AND the historical value was on the safe side -- avoids false alerts when metrics were already past the threshold historically
- Seasonal averages are computed from rolling series data points grouped by calendar quarter (Q1-Q4 across all years), revealing patterns like "Q4 is consistently weak"
- Both trade-count-based and time-based recent window definitions supported via options, with trade-count as default

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
- Pre-commit lint hook caught unused `getQuarter` helper function (was computing quarter inline from date string instead) -- removed the unused function
- Pre-commit lint hook caught unused type imports in test file -- removed `RollingMetricsResult` and `RecentVsHistoricalComparison` unused type imports
- Test 18 initially failed because `generateTrades` helper puts all wins first then all losses (not interleaved) -- fixed by creating interleaved trades for the "no flags" test case

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- Rolling metrics engine ready for MCP tool wiring in Plan 03
- All exports accessible via `@tradeblocks/lib` barrel export
- `compareRecentVsHistorical` available as standalone function for downstream phases
- Full test coverage provides regression safety for future changes

---
*Phase: 46-core-calculation-engines*
*Completed: 2026-02-05*
