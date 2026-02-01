---
phase: 36-enhanced-comparison
plan: 01
subsystem: mcp
tags: [mcp, z-score, outlier-detection, grouping, trade-comparison]

# Dependency graph
requires:
  - phase: 35-reporting-log-ingestion
    provides: ReportingTrade model and CSV parsing
provides:
  - Trade-level comparison with field-by-field differences
  - Z-score outlier detection with severity levels
  - Flexible grouping by strategy/date/week/month
  - outlierStats summary metrics
affects: [mcp-tools, trading-calendar, analysis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - z-score outlier detection with configurable threshold
    - grouped aggregation with per-group statistics
    - trade matching by date|strategy|time (minute precision)

key-files:
  created: []
  modified:
    - packages/mcp-server/src/tools/performance.ts
    - packages/mcp-server/package.json

key-decisions:
  - "Truncate time to minute precision for matching (handles fractional seconds in actual trades)"
  - "Use z-score threshold of 2 by default (~95% confidence interval)"
  - "Sort comparisons by absolute slippage (worst first) to surface problems"
  - "Require minimum 3 matched comparisons for outlier detection"

patterns-established:
  - "DetailedComparison interface with field differences and context"
  - "GroupedResult interface for aggregated group statistics"
  - "outlierStats object for statistical summary of outliers"

# Metrics
duration: 12min
completed: 2026-01-31
---

# Phase 36 Plan 01: Enhanced Comparison Summary

**Enhanced compare_backtest_to_actual MCP tool with trade-level details, z-score outlier detection, and flexible grouping**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-31T16:49:25Z
- **Completed:** 2026-01-31T17:01:25Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Added 4 new parameters to compare_backtest_to_actual: detailLevel, outliersOnly, outliersThreshold, groupBy
- Implemented trade-level matching by date|strategy|time with field-by-field differences
- Added z-score outlier detection with severity levels (low/medium/high)
- Added grouping by strategy, date, week, or month with per-group statistics
- Maintained backward compatibility - existing callers work unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1 & 2: Add parameters, trade-level comparison, outlier detection, grouping** - `2383596` (feat)
2. **Task 3: Version bump to 0.4.4** - `4c94531` (chore)

## Files Created/Modified

- `packages/mcp-server/src/tools/performance.ts` - Enhanced compare_backtest_to_actual with new parameters
- `packages/mcp-server/package.json` - Version bumped to 0.4.4

## Decisions Made

1. **Time precision for matching:** Truncate to minute level (HH:mm) since actual trades often have fractional seconds (e.g., "09:34:06.5809432") while backtests have clean times ("09:34:00")
2. **Default threshold:** Z-score of 2 corresponds to ~95% confidence interval - reasonable default for identifying unusual slippage
3. **Minimum sample size:** Require 3+ matched comparisons for outlier detection to avoid spurious statistics
4. **Sorting:** Sort by absolute slippage (worst first) to immediately surface problem areas
5. **Severity levels:** >3 = high, >2 = medium, else low - matches common statistical significance levels

## Deviations from Plan

None - plan executed exactly as written.

Note: Tasks 1 and 2 were implemented together since the outlier detection and grouping logic naturally fit within the same code flow after building comparisons.

## Issues Encountered

1. **Unused variable lint error:** ESLint caught an unused `scaledActualPl` variable in the unmatched actuals loop. Fixed by removing the unnecessary calculation since slippage is 0 for unmatched trades anyway.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Enhanced comparison tool ready for use by Claude and other MCP clients
- Foundation laid for additional comparison enhancements (exit time comparison, win/loss direction matching)
- MCP server version 0.4.4 ready for deployment

---
*Phase: 36-enhanced-comparison*
*Completed: 2026-01-31*
