# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** v2.6 DuckDB Analytics Layer

## Current Position

Milestone: v2.6 DuckDB Analytics Layer
Phase: 43 of 45 (Query Interface)
Plan: 01 complete
Status: In progress
Last activity: 2026-02-01 — Completed 43-01-PLAN.md (run_sql tool)

Progress: [██████    ] 58% (4/7 plans in milestone)

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

v2.6 decisions:
- Single DuckDB file (analytics.duckdb) with trades/market schemas
- SHA-256 hash-based change detection (not mtime)
- Lazy sync: triggered on query, not server startup
- Batch inserts: 500 rows per batch for performance
- Market data merge/preserve strategy: INSERT ON CONFLICT DO NOTHING
- 14 MCP tools integrated with sync layer
- Unchanged blocks are not tracked in SyncResult (simply not processed)
- Concurrent sync not safe - use sequential syncs only
- DuckDB COUNT returns BigInt, requires Number() conversion
- Sync middleware: withSyncedBlock, withSyncedBlocks, withFullSync patterns
- Tool files split: blocks/ (7 modules), reports/ (10 modules), shared/ (1 module)
- SQL validation via pattern blocklist (not parsing) for security
- 30s query timeout with Promise.race for protection
- Auto-append LIMIT (default 100, max 1000) for unbounded queries

## Roadmap Evolution

- Phase 42.1 inserted after Phase 42: Sync Layer Hardening (integration tests + middleware pattern)

## Session Continuity

Last session: 2026-02-01
Stopped at: Completed 43-01-PLAN.md (run_sql tool)
Resume file: None
Next: Execute remaining Phase 43 plans or proceed to Phase 44

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
