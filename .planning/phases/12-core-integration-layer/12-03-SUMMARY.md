---
phase: 12-core-integration-layer
plan: 03
subsystem: mcp-server
tags: [mcp, performance-tools, charts, mfe-mae, backtest-comparison]

# Dependency graph
requires:
  - phase: 12-01
    provides: Block loading utilities, output formatters
  - phase: 12-02
    provides: JSON-first output pattern, analysis tools
provides:
  - 3 Tier 3 performance MCP tools
  - MFE/MAE chart type for stop loss/take profit optimization
  - Backtest vs actual comparison with scaling modes
  - Complete 14-tool MCP server
affects: [phase-13-analysis-capabilities]

# Tech tracking
tech-stack:
  added: []
  patterns: ["inline MFE/MAE calculations", "16 chart type builders"]

key-files:
  created:
    - "packages/mcp-server/src/tools/performance.ts"
  modified:
    - "packages/mcp-server/src/utils/block-loader.ts"
    - "packages/mcp-server/src/index.ts"

key-decisions:
  - "JSON-first output pattern: brief text summary + structured JSON via createToolOutput()"
  - "16 chart types in get_performance_charts covering all performance visualization needs"
  - "MFE/MAE implemented inline to avoid bundle dependency issues (trade-efficiency, async-helpers)"
  - "Backtest vs actual supports three scaling modes: raw, perContract, toReported"
  - "All tools expose full underlying calculation parameters for model access"

patterns-established:
  - "Inline complex calculations when lib dependencies have browser-only imports"
  - "Filter helpers: filterByStrategy(), filterByDateRange(), normalizeTradesToOneLot()"
  - "Each chart type has dedicated builder function for maintainability"

issues-created: []

# Future consideration for Phase 13
phase-13-ideas:
  - "Report Builder MCP integration - expose custom report configuration and execution"
  - "Custom reports could allow Claude to create filtered, aggregated analysis views"
  - "Key interfaces: ReportConfig, FilterConfig, ChartAxisConfig from lib/models/report-config.ts"

# Metrics
duration: ~45min (including UAT-001 fix for parameter expansion)
completed: 2026-01-14
---

# Phase 12 Plan 03: Performance Tools Summary

**3 Tier 3 performance MCP tools + MFE/MAE analysis completing the 14-tool MCP server**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-01-14
- **Completed:** 2026-01-14
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files created:** 1
- **Files modified:** 2

## Accomplishments

- Implemented 3 Tier 3 performance tools:
  1. `get_performance_charts` - 16 chart types with full parameter exposure
  2. `get_period_returns` - Monthly/weekly/daily P&L breakdown
  3. `compare_backtest_to_actual` - Trading calendar comparison with scaling
- Added `loadReportingLog()` to block-loader for reportinglog.csv parsing
- Expanded all performance tool parameters per UAT-001 feedback
- Added MFE/MAE chart type for stop loss and take profit optimization
- Completed Phase 12: Core Integration Layer with 14 MCP tools

## Task Commits

1. **Task 1: Performance chart and period returns tools** - `70e24a8` (feat)
2. **Task 2: Backtest vs actual comparison tool** - `8bdeff5` (feat)
3. **UAT-001: Expand performance tool parameters** - `df89ee6` (fix)
4. **Add MFE/MAE chart type** - `f511af8` (feat)

## Files Created/Modified

### Created
- `packages/mcp-server/src/tools/performance.ts` - 3 Tier 3 performance MCP tools (~1800 lines)

### Modified
- `packages/mcp-server/src/utils/block-loader.ts` - Added loadReportingLog() function
- `packages/mcp-server/src/index.ts` - Import and register performance tools

## Tool Capabilities

### get_performance_charts
16 chart types with full parameter exposure:
- **Equity**: equity_curve, drawdown
- **Returns**: monthly_returns, monthly_returns_percent, return_distribution, day_of_week
- **Patterns**: streak_data (+ runs test), trade_sequence, rom_timeline
- **Rolling**: rolling_metrics (configurable window)
- **Analysis**: exit_reason_breakdown, holding_periods, premium_efficiency, margin_utilization, volatility_regimes
- **Risk**: mfe_mae (Maximum Favorable/Adverse Excursion)

Parameters: blockId, strategy, charts[], dateRange, riskFreeRate, normalizeTo1Lot, bucketCount, rollingWindowSize, mfeMaeBucketSize

### get_period_returns
P&L breakdown by time period:
- Period types: monthly, weekly, daily
- Includes gross P/L, commissions, net P/L per period
- Parameters: blockId, strategy, period, year, dateRange, normalizeTo1Lot

### compare_backtest_to_actual
Trading calendar comparison:
- Matches trades by date and strategy
- Three scaling modes:
  - `raw`: No scaling
  - `perContract`: Divide by contracts for per-lot comparison
  - `toReported`: Scale backtest DOWN to match actual size
- Parameters: blockId, strategy, scaling, dateRange, matchedOnly

## Complete Tool Inventory (14 tools)

| Tier | Tool | Category |
|------|------|----------|
| 1 | list_blocks | Core |
| 1 | get_block_stats | Core |
| 1 | get_trades | Core |
| 1 | get_daily_logs | Core |
| 1 | reprocess_block | Core |
| 1 | get_strategies | Core |
| 2 | run_walk_forward | Analysis |
| 2 | run_monte_carlo | Analysis |
| 2 | analyze_correlation | Analysis |
| 2 | analyze_tail_risk | Analysis |
| 2 | calculate_position_size | Analysis |
| 3 | get_performance_charts | Performance |
| 3 | get_period_returns | Performance |
| 3 | compare_backtest_to_actual | Performance |

## Deviations from Plan

1. **Parameter expansion (UAT-001):** Added extensive parameters to all three tools to ensure Claude has full access to underlying calculation capabilities. This was done during execution based on user feedback.

2. **MFE/MAE addition:** Added as 16th chart type during execution. Implemented inline to avoid bundle dependency issues with @lib/metrics/trade-efficiency.

## Verification Checklist

- [x] `pnpm --filter tradeblocks-mcp build` succeeds
- [x] `pnpm run lint` passes
- [x] All 14 tools registered (6 core + 5 analysis + 3 performance)
- [x] compare_backtest_to_actual properly handles missing reportinglog.csv
- [x] Performance chart data correctly formatted as JSON
- [x] Human verification checkpoint passed

## Phase 13 Consideration: Report Builder Integration

The Report Builder (`lib/models/report-config.ts`) is a powerful feature that could be exposed via MCP:

**Key interfaces:**
- `ReportConfig` - Full report configuration with filters, chart type, axes
- `FilterConfig` - Multiple filter conditions with AND/OR logic
- `ChartAxisConfig` - Axis field, label, scale configuration

**Potential MCP tools:**
- `list_preset_reports` - Get built-in report configurations
- `run_report` - Execute a report config against a block
- `create_custom_report` - Build a new report configuration

**Value:** Would allow Claude to create custom filtered views, threshold analyses, and aggregated summaries without hardcoding specific queries.

## Next Phase Readiness

Ready for Phase 13: Analysis Capabilities
- All 14 MCP tools implemented and working
- JSON-first output pattern established
- Full parameter exposure for model reasoning
- Report Builder documented for potential Phase 13 integration

---
*Phase: 12-core-integration-layer*
*Plan: 03*
*Completed: 2026-01-14*
