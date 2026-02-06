# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** Planning next milestone

## Current Position

Milestone: v2.7 Edge Decay Analysis -- COMPLETE
Phase: All complete (46-50)
Plan: All complete
Status: Milestone shipped, archived, tagged v2.7
Last activity: 2026-02-06 -- Completed quick task 011-01: performance tools output bounds + bug fixes

Progress: [██████████] 100%

## Historical Context

See [v2.7 archive](milestones/v2.7-edge-decay-analysis.md) for edge decay analysis details.
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
| 003 | MCP tooling improvements (7 items: daily log filtering, rolling metrics trim, health check sample sizes, edge decay sorting + composite score, stress test pre-filter, pl→netPl naming) | 2026-02-06 | ce5f73b | [003-mcp-tooling-improvements](./quick/003-mcp-tooling-improvements/) |
| 004 | MCP tooling feedback fixes (5 items: dollar-metric filtering, composite score accuracy, per-pair tail risk n=, netPl enum, severity label removal) | 2026-02-06 | 37d871c | [004-mcp-tooling-feedback-fixes](./quick/004-mcp-tooling-feedback-fixes/) |
| 005 | Health check dual MC resampling: detect position sizing inflation | 2026-02-06 | e29731b | [005-mc-dual-resampling-health-check](./quick/005-mc-dual-resampling-health-check/) |
| 006 | Composite decay score quality: drop expectedReturn, cap mcDivergence, direction-aware scoring, netPl default | 2026-02-06 | b0e4a54 | — |
| 007 | Margin-based ROM (pl/marginReq) for MC regime comparison with auto-detection | 2026-02-06 | 7cee4f7 | [007-margin-based-rom-for-mc-regime-comparis](./quick/007-margin-based-rom-for-mc-regime-comparis/) |
| 008 | Signed MC divergence scores + WF 1-lot normalization | 2026-02-06 | fcb5905 | [008-signed-mc-divergence-wf-1lot-normalizati](./quick/008-signed-mc-divergence-wf-1lot-normalizati/) |
| 009 | Margin return floor -99%, negative IS Sharpe guard, MDD docs | 2026-02-06 | 829e8dd | [009-fix-margin-return-floor-wf-neg-sharpe-md](./quick/009-fix-margin-return-floor-wf-neg-sharpe-md/) |
| 010 | MC additive mode, minSamples guard, remove recs, null fallback | 2026-02-06 | 17e4f1d | [010-fix-mcp-mc-additive-minsample-recs-null](./quick/010-fix-mcp-mc-additive-minsample-recs-null/) |
| 011-01 | Performance tools output bounds: maxDataPoints truncation, tab-delimited keys, auto date overlap, matched-only stats, streak interpretation removal | 2026-02-06 | ba75c8c | [011-fix-mcp-output-size-ethos-sharpe-bugs](./quick/011-fix-mcp-output-size-ethos-sharpe-bugs/) |
| 011-02 | Remove interpretive fields from report tools (predictive, discrepancies, slippage-trends) | 2026-02-06 | b778108 | [011-fix-mcp-output-size-ethos-sharpe-bugs](./quick/011-fix-mcp-output-size-ethos-sharpe-bugs/) |
| 011-03 | Daily-log Sharpe consistency for block_diff, marginal_contribution, what_if_scaling + remove interpretation | 2026-02-06 | b222b3c | [011-fix-mcp-output-size-ethos-sharpe-bugs](./quick/011-fix-mcp-output-size-ethos-sharpe-bugs/) |

## Testing Infrastructure

CLI test mode available for MCP tool verification:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call <tool> '<json-args>'
```

Example:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call analyze_edge_decay '{"blockId":"main-port"}'
```

## Session Continuity

Last session: 2026-02-06
Stopped at: Completed quick task 011 plan 01
Resume file: None
