# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-04)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** v2.7 Edge Decay Analysis

## Current Position

Milestone: v2.7 Edge Decay Analysis
Phase: 46 of 50 (Core Calculation Engines)
Plan: 3 of TBD in current phase
Status: In progress
Last activity: 2026-02-05 -- Completed 46-03-PLAN.md (MCP edge decay tools)

Progress: [███░░░░░░░] ~30%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 6min
- Total execution time: 18min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 46-core-calculation-engines | 3 | 18min | 6min |

## Historical Context

See [v2.6 archive](milestones/v2.6-duckdb-analytics-layer.md) for DuckDB analytics layer details.
See [v2.5 archive](milestones/v2.5-reporting-log-integration.md) for reporting log integration details.
See [v2.4 archive](milestones/v2.4-backtest-optimization-tools.md) for backtest optimization tools.
See [v2.3 archive](milestones/v2.3-workspace-packages.md) for workspace package migration details.
See [v2.2 archive](milestones/v2.2-historical-risk-free-rates.md) for risk-free rate implementation details.
See [v2.1 archive](milestones/v2.1-portfolio-comparison.md) for portfolio comparison tools.
See [v2.0 archive](milestones/v2.0-claude-integration.md) for Claude integration history.
See [v1.0 archive](milestones/v1.0-wfa-enhancement.md) for WFA enhancement history.

## Accumulated Decisions

All decisions now captured in PROJECT.md Key Decisions table.

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Expose parameterRanges in run_walk_forward MCP tool | 2026-01-30 | d1de196 | [001-expose-parameterranges-in-run-walk-forwa](./quick/001-expose-parameterranges-in-run-walk-forwa/) |
| 002 | Add reporting_data SQL table and legs to backtest comparison | 2026-02-04 | 2788a65 | [002-add-reporting-data-sql-table-and-legs-to](./quick/002-add-reporting-data-sql-table-and-legs-to/) |

## Testing Infrastructure

CLI test mode available for MCP tool verification:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call <tool> '<json-args>'
```

Example:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call portfolio_health_check '{"blockId":"main-port-2026"}'
```

## Session Continuity

Last session: 2026-02-05
Stopped at: Completed 46-03-PLAN.md (MCP edge decay tools)
Resume file: None
