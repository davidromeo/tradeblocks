---
phase: quick
plan: 003-01
subsystem: mcp-server
tags: [mcp, bug-fix, filtering, health-check, stress-test, field-naming]
dependency-graph:
  requires: [v2.7]
  provides: [daily-log-date-filtering, rolling-metrics-trimming, health-check-sample-sizes, stress-test-prefiltering, pl-field-naming]
  affects: []
tech-stack:
  added: []
  patterns: [date-overlap-prefiltering, conditional-output-inclusion]
key-files:
  created: []
  modified:
    - packages/mcp-server/src/tools/shared/filters.ts
    - packages/mcp-server/src/tools/blocks/core.ts
    - packages/mcp-server/src/tools/edge-decay.ts
    - packages/mcp-server/src/tools/blocks/health.ts
    - packages/mcp-server/src/tools/blocks/analysis.ts
    - packages/mcp-server/src/tools/blocks/comparison.ts
decisions:
  - id: 003-01-d1
    decision: "StrategyStats lacks totalCommissions, so grossPl not added to get_strategy_comparison"
    rationale: "Per-strategy commission tracking not available in model"
metrics:
  duration: ~5min
  completed: 2026-02-06
---

# Quick 003-01: MCP Server Fixes (Items 1, 2, 3, 5, 6) Summary

Bug fix for daily log date filtering, rolling metrics output trimming, health check sample size context, stress test date pre-filtering, and pl-to-netPl field renaming in comparison tools.

## Task Commits

| Task | Item | Description | Commit | Key Files |
|------|------|-------------|--------|-----------|
| 1 | Item 1 | Daily log date filtering bug fix | a1c73e8 | filters.ts, core.ts |
| 1 | Item 2 | Rolling metrics includeSeries param | b792604 | edge-decay.ts |
| 1 | Item 3 | Health check sample size context | c26733f | health.ts |
| 1 | Item 5 | Stress test scenario pre-filtering | a5a1f64 | analysis.ts |
| 1 | Item 6 | pl -> netPl field naming | ce5f73b | comparison.ts |

## Changes Made

### Item 1 - Bug Fix: get_statistics daily log date filtering
- Added `filterDailyLogsByDateRange()` function in `filters.ts` that mirrors `filterByDateRange` but uses `entry.date` (Date object) instead of `t.dateOpened`
- Imported and used in `core.ts` get_statistics handler
- When startDate/endDate are provided and not strategy-filtered, daily logs are now filtered by the same date range as trades
- Fixes a bug where date-filtered statistics used unfiltered daily log data, producing incorrect drawdown/Sharpe calculations

### Item 2 - Trim analyze_rolling_metrics output
- Added `includeSeries` boolean parameter (default: false) to `analyze_rolling_metrics` input schema
- Series data (which can be hundreds of data points) is now omitted by default
- All other output fields (seasonalAverages, recentVsHistorical, dataQuality) remain unchanged
- Saves significant tokens when Claude only needs summary metrics

### Item 3 - Health check sample size context
- Correlation flag pairs now show per-pair sample size: `"StratA & StratB (0.72, n=156)"`
- Reads `correlationMatrix.sampleSizes[i][j]` for each flagged pair
- Tail dependence warning message now includes shared trading days count: `"High tail dependence pairs (>0.5, 234 shared trading days): ..."`
- Uses `tailRisk.tradingDaysUsed` since per-pair sample sizes aren't available in the tail risk result

### Item 5 - Stress test scenario pre-filtering
- Moved portfolio date range computation before scenario selection logic
- When no explicit scenarios are requested, built-in scenarios are now pre-filtered by date overlap
- Overlap check: `scenario.endDate >= portfolioStartDate && scenario.startDate <= portfolioEndDate`
- Tracks two distinct categories:
  - `preFilteredScenarios`: excluded because no date overlap with portfolio (never attempted)
  - `skippedScenarios`: had date overlap but zero matching trades (genuine coverage gaps)
- Explicit scenario requests bypass pre-filtering (run exactly what was asked)
- Summary text shows both pre-filtered and skipped counts separately

### Item 6 - Field naming: pl -> netPl
- `get_strategy_comparison`: renamed output field from `pl` to `netPl` in strategies array
- `block_diff` `buildStrategyEntry`: renamed `pl` to `netPl` in entryA, entryB, and delta objects
- `sortBy` enum keeps `"pl"` value for backward compatibility, description updated to clarify it sorts by net P&L
- `StrategyStats` model lacks `totalCommissions`, so `grossPl` not added (only available at portfolio level)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Skip grossPl in get_strategy_comparison | StrategyStats model lacks totalCommissions field; per-strategy commissions not tracked |
| Keep "pl" in sortBy/metricsToCompare enums | Backward compatibility for existing tool callers |

## Self-Check: PASSED
