# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Make trading analytics accessible and understandable through web UI and AI-assisted workflows
**Current focus:** v2.6 DuckDB Analytics Layer

## Current Position

Milestone: v2.6 DuckDB Analytics Layer
Phase: 44 of 45 (Schema Discovery) — COMPLETE
Plan: All plans complete
Status: Ready for Phase 45
Last activity: 2026-02-04 — Phase 44 verified, market data sync bug fixed

Progress: [████████  ] 83% (5/6 phases)

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
- describe_database: single tool returns all schema info (tables, columns, types, descriptions, row counts, examples)
- Schema descriptions hardcoded + merged with DuckDB introspection for accuracy + context
- Hypothesis flags on columns for analytical relevance
- Market sync filters CSV columns to only those in table schema (handles TradingView marker columns)
- PineScript exports use SQL-safe column names (Marker_*, underscores instead of spaces)

## Roadmap Evolution

- Phase 42.1 inserted after Phase 42: Sync Layer Hardening (integration tests + middleware pattern)

## Session Continuity

Last session: 2026-02-04
Stopped at: Phase 44 verified + market sync bug fixed
Resume file: None
Next: `/gsd:discuss-phase 45` (Tool Rationalization)

### Session Notes (2026-02-04)
- Executed Phase 44 (describe_database tool) — verified working
- Found market data sync bug during verification testing
- Fixed PineScript column names (SQL-safe: Marker_*, New_High/New_Low, VIX_Price)
- Fixed MCP sync to filter columns to schema, handle BigInt, lowercase OHLC
- Commits: 6b2b512 (scripts), fbdd824 (mcp-server)
- User needs to re-export CSVs from TradingView with updated indicators
- Discussed automating market data fetch (v2.7 idea: Yahoo Finance + local calculation)

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
