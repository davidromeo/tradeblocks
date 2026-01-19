# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** Planning next milestone

## Current Position

Milestone: v2.3 Workspace Packages
Phase: 30 of 31 (import-migration)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-01-19 — Completed 30-02-PLAN.md (Next.js app import migration)

Progress: ███░░░░░░░ 30%

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

Last session: 2026-01-19
Stopped at: Completed 30-02-PLAN.md
Resume file: None
Next: Execute Phase 31 cleanup-verification

## Testing Infrastructure

CLI test mode available for MCP tool verification:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call <tool> '<json-args>'
```

Example:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call portfolio_health_check '{"blockId":"main-port-2026"}'
```
