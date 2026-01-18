# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** Planning next milestone

## Current Position

Milestone: v2.1 Portfolio Comparison — SHIPPED
Phase: 24 of 24 complete
Plan: All complete
Status: Ready to plan next milestone
Last activity: 2026-01-18 — v2.1 milestone archived

Progress: ██████████ 100% (v2.1 complete)

## Historical Context

See [v2.1 archive](milestones/v2.1-portfolio-comparison.md) for full phase details and decisions.
See [v2.0 archive](milestones/v2.0-claude-integration.md) for Claude integration history.
See [v1.0 archive](milestones/v1.0-wfa-enhancement.md) for WFA enhancement history.

## Accumulated Decisions

Key decisions from v2.1 milestone now captured in PROJECT.md Key Decisions table:
- Trade-based calculations only for comparison tools
- Composite similarity scoring (50% corr, 30% tail, 20% overlap)
- 4-layer health check response
- ngrok tunnel for web platforms

## Session Continuity

Last session: 2026-01-18
Stopped at: v2.1 milestone complete
Resume file: None

Next: `/gsd:discuss-milestone` or `/gsd:new-milestone` to plan next version

## Testing Infrastructure

CLI test mode available for MCP tool verification:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call <tool> '<json-args>'
```

Example:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call portfolio_health_check '{"blockId":"main-port-2026"}'
```
