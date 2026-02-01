# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** v2.6 DuckDB Analytics Layer

## Current Position

Milestone: v2.6 DuckDB Analytics Layer
Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-01 — Milestone v2.6 started

Progress: [          ] 0% (requirements phase)

## Historical Context

See [v2.5 archive](milestones/v2.5-reporting-log-integration.md) for reporting log integration details.
See [v2.4 archive](milestones/v2.4-backtest-optimization-tools.md) for backtest optimization tools.
See [v2.3 archive](milestones/v2.3-workspace-packages.md) for workspace package migration details.
See [v2.2 archive](milestones/v2.2-historical-risk-free-rates.md) for risk-free rate implementation details.
See [v2.1 archive](milestones/v2.1-portfolio-comparison.md) for portfolio comparison tools.
See [v2.0 archive](milestones/v2.0-claude-integration.md) for Claude integration history.
See [v1.0 archive](milestones/v1.0-wfa-enhancement.md) for WFA enhancement history.

## Accumulated Decisions

All decisions now captured in PROJECT.md Key Decisions table.

v2.5 decisions:
- Per-contract P/L normalization for strategy matching
- Z-score threshold of 2 for outlier detection
- Confidence scoring: 70% correlation + 30% timing overlap
- Linear regression with normal approximation for p-value
- Trade matching by date|strategy|time (minute precision)
- Phase 40 (Quality Scoring) dropped — AI synthesizes from existing tools

## Session Continuity

Last session: 2026-02-01
Stopped at: Started v2.6 milestone, defining requirements
Resume file: None
Next: Complete requirements → create roadmap

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Expose parameterRanges in run_walk_forward MCP tool | 2026-01-30 | d1de196 | [001-expose-parameterranges-in-run-walk-forwa](./quick/001-expose-parameterranges-in-run-walk-forwa/) |

## Testing Infrastructure

CLI test mode available for MCP tool verification:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call <tool> '<json-args>'
```

Example:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call portfolio_health_check '{"blockId":"main-port-2026"}'
```
