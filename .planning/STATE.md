# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** Planning next milestone

## Current Position

Milestone: v2.2 Historical Risk-Free Rates — SHIPPED
Phase: All complete
Plan: All complete
Status: Ready to plan next milestone
Last activity: 2026-01-18 — v2.2 milestone complete

Progress: ██████████ 100%

## Historical Context

See [v2.2 archive](milestones/v2.2-historical-risk-free-rates.md) for risk-free rate implementation details.
See [v2.1 archive](milestones/v2.1-portfolio-comparison.md) for portfolio comparison tools.
See [v2.0 archive](milestones/v2.0-claude-integration.md) for Claude integration history.
See [v1.0 archive](milestones/v1.0-wfa-enhancement.md) for WFA enhancement history.

## Accumulated Decisions

Key decisions from v2.2 milestone now captured in PROJECT.md Key Decisions table:
- Embedded Treasury rates (no API calls) — maintains 100% local data principle
- Date-based risk-free rates over fixed rate — accurate Sharpe/Sortino reflecting market conditions
- Rolling metrics Sharpe uses fixed 2.0% — visualization simplification for MCP charts

## Session Continuity

Last session: 2026-01-18
Stopped at: Completed v2.2 milestone
Resume file: None
Next: `/gsd:discuss-milestone` to plan next version

## Testing Infrastructure

CLI test mode available for MCP tool verification:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call <tool> '<json-args>'
```

Example:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call portfolio_health_check '{"blockId":"main-port-2026"}'
```
