# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-17)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** v2.1 Portfolio Comparison - Phase 19

## Current Position

Milestone: v2.1 Portfolio Comparison
Phase: 18 complete, ready for 19
Plan: 1 of 1 in Phase 18
Status: Phase complete
Last activity: 2026-01-18 — Completed 18-01-PLAN.md (Stress Test Tool)

Progress: ███░░░░░░░ 30%

## v2.1 Portfolio Comparison Goal

Add 7 new MCP tools to improve portfolio comparison and analysis capabilities:
1. `block_diff` - Compare two blocks with strategy overlap and P/L attribution [DONE - Phase 17]
2. `stress_test` - Historical scenario analysis (COVID, 2022 bear, VIX spikes) [DONE - Phase 18]
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
- Phase 18 complete: stress_test tool with 11 built-in scenarios

## Accumulated Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 17 | Trade-based calculations only for comparison tools | Daily logs represent full portfolio, not per-strategy |
| 18 | 11 built-in scenarios (9 crashes + 2 recoveries) | Cover major market events post-2013 |
| 18 | Return null stats for scenarios with no trades | Graceful handling, not errors |

## Session Continuity

Last session: 2026-01-18
Stopped at: Completed 18-01-PLAN.md (Stress Test Tool)
Resume file: None

Next: `/gsd:plan-phase 19` to plan Drawdown Attribution tool

## Testing Infrastructure

CLI test mode added for MCP tool verification:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call <tool> '<json-args>'
```

Example:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call stress_test '{"blockId":"main-port-2026","scenarios":["covid_crash","bear_2022"]}'
```
