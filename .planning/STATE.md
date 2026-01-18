# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** v2.2 Historical Risk-Free Rates

## Current Position

Milestone: v2.2 Historical Risk-Free Rates
Phase: 27 of 28 (Remove Manual Input)
Plan: 1 of 3 complete
Status: In progress
Last activity: 2026-01-18 — Completed 27-01-PLAN.md

Progress: ███░░░░░░░ 62.5%

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

## v2.2 Context

**Feature Request:** Amy's suggestion to use variable/actual risk-free rates for portfolio analysis instead of fixed 2%.

**Problem:** Sharpe ratio gets distorted when rates move meaningfully - using a constant rate when actual rates varied (0% in 2020 vs 5%+ in 2023) skews results.

**Solution:** Embed historical Treasury 3-month T-bill rates (2013-2025) as static data, lookup by trade date, remove manual input.

**Key Decisions:**
- Data range: 2013-01-01 to present (~3,000 trading days)
- Fallback: Last known rate for dates outside range
- No override: Remove manual input entirely
- Local-only: No external API calls (maintains TradeBlocks principle)

### Roadmap Evolution

- Milestone v2.2 created: Historical risk-free rates, 4 phases (Phase 25-28)

## Session Continuity

Last session: 2026-01-18
Stopped at: Completed 27-01-PLAN.md (Types/Models cleanup)
Resume file: None
Next: 27-02-PLAN.md (Stores/Services/MCP cleanup) or 27-03-PLAN.md (UI/Tests cleanup)

## Testing Infrastructure

CLI test mode available for MCP tool verification:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call <tool> '<json-args>'
```

Example:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call portfolio_health_check '{"blockId":"main-port-2026"}'
```
