# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-17)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** v2.1 Portfolio Comparison - Complete (7/7 tools)

## Current Position

Milestone: v2.1 Portfolio Comparison
Phase: 23 complete (portfolio_health_check tool)
Plan: 1 of 1 in Phase 23
Status: v2.1 tools complete, ready for Phase 24 (Web Platform Guide)
Last activity: 2026-01-18 — Completed 23-01-PLAN.md (Portfolio Health Check Tool)

Progress: ██████████ 100% (v2.1 tools complete)

## v2.1 Portfolio Comparison Goal

Add 7 new MCP tools to improve portfolio comparison and analysis capabilities:
1. `block_diff` - Compare two blocks with strategy overlap and P/L attribution [DONE - Phase 17]
2. `stress_test` - Historical scenario analysis (COVID, 2022 bear, VIX spikes) [DONE - Phase 18]
3. `drawdown_attribution` - Identify which strategies drive drawdowns [DONE - Phase 19]
4. `marginal_contribution` - Calculate marginal Sharpe/Sortino of adding strategies [DONE - Phase 20]
5. `strategy_similarity` - Detect redundant strategies [DONE - Phase 21]
6. `what_if_scaling` - Project metrics at different position sizes [DONE - Phase 22]
7. `portfolio_health_check` - Unified health assessment in one call [DONE - Phase 23]

## Historical Context

See [v2.0 archive](milestones/v2.0-claude-integration.md) for full phase details and decisions.
See [v1.0 archive](milestones/v1.0-wfa-enhancement.md) for WFA enhancement history.

## Roadmap Evolution

- Milestone v2.1 created: Portfolio comparison tools, 7 phases (Phase 17-23)
- Phase 17.1 added: CLI test mode for subagent testing
- Phase 18 complete: stress_test tool with 11 built-in scenarios
- Phase 19 complete: drawdown_attribution tool with equity curve analysis
- Phase 20 complete: marginal_contribution tool with with/without comparison
- Phase 21 complete: strategy_similarity tool with composite scoring
- Phase 22 complete: what_if_scaling tool with strategy weights
- Phase 23 complete: portfolio_health_check tool with 4-layer response

## Accumulated Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 17 | Trade-based calculations only for comparison tools | Daily logs represent full portfolio, not per-strategy |
| 17.1 | **CLI test verification required for all v2.1 MCP tools** | Real data validation catches issues unit tests miss |
| 18 | 11 built-in scenarios (9 crashes + 2 recoveries) | Cover major market events post-2013 |
| 18 | Return null stats for scenarios with no trades | Graceful handling, not errors |
| 19 | Equity curve from trades sorted by close date/time | Accurate chronological P/L tracking |
| 19 | Initial capital = first trade's fundsAtClose - pl | Derive starting point from available data |
| 20 | Marginal contribution = baseline - without metric | Positive = strategy improves portfolio |
| 20 | Interpretation thresholds: |delta| < 0.01 = negligible | Consistent categorization |
| 21 | Composite similarity: 50% correlation, 30% tail dep, 20% overlap | Balance correlation and tail risk signals |
| 21 | Redundant requires BOTH high correlation AND high tail dependence | Conservative flag to avoid false positives |
| 22 | Weight range 0-2.0 for realism | 2x leverage is reasonable, higher would be extreme |
| 22 | Commissions scale proportionally with weight | 0.5x size ≈ 0.5x trading costs |
| 23 | 4-layer response: verdict -> grades -> flags -> keyNumbers | Progressive detail from quick verdict to actionable flags |
| 23 | Grades A/B/C/F (no +/- modifiers) | Simplicity over granularity |
| 23 | Robustness grade null when WFA skipped | Don't penalize for insufficient data |

## Session Continuity

Last session: 2026-01-18
Stopped at: Completed 23-01-PLAN.md (Portfolio Health Check Tool)
Resume file: None

Next: `/gsd:plan-phase 24` to plan Web Platform Integration Guide

## Testing Infrastructure

CLI test mode added for MCP tool verification:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call <tool> '<json-args>'
```

Example:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call strategy_similarity '{"blockId":"main-port-2026"}'
```
