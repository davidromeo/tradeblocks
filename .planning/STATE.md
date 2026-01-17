# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-17)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** v2.1 Portfolio Comparison - Phase 18

## Current Position

Milestone: v2.1 Portfolio Comparison
Phase: 17.1 complete, ready for 18
Plan: 0 of ? in Phase 18
Status: Ready to plan
Last activity: 2026-01-17 — Completed 17.1-01-PLAN.md (CLI Test Mode)

Progress: ██░░░░░░░░ 25%

## v2.1 Portfolio Comparison Goal

Add 7 new MCP tools to improve portfolio comparison and analysis capabilities:
1. `block_diff` - Compare two blocks with strategy overlap and P/L attribution
2. `stress_test` - Historical scenario analysis (COVID, 2022 bear, VIX spikes)
3. `drawdown_attribution` - Identify which strategies drive drawdowns
4. `marginal_contribution` - Calculate marginal Sharpe/Sortino of adding strategies
5. `strategy_similarity` - Detect redundant strategies
6. `what_if_scaling` - Project metrics at different position sizes
7. `portfolio_health_check` - Unified health assessment in one call

## Historical Context

See [v2.0 archive](milestones/v2.0-claude-integration.md) for full phase details and decisions.
See [v1.0 archive](milestones/v1.0-wfa-enhancement.md) for WFA enhancement history.

## Roadmap Evolution

- Milestone v2.1 created: Portfolio comparison tools, 7 phases (Phase 17-23)
- Phase 17.1 added: CLI test mode for subagent testing

## Session Continuity

Last session: 2026-01-17
Stopped at: Completed 17.1-01-PLAN.md (CLI Test Mode)
Resume file: None

Next: `/gsd:plan-phase 18` to plan Stress Test tool

## Testing Infrastructure

CLI test mode added for MCP tool verification:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call <tool> '<json-args>'
```
