# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-11)

**Core value:** Make WFA results clear and understandable for users new to walk-forward analysis
**Current focus:** v2.0 Claude Integration — Phase 12 complete, ready for Phase 13

## Current Position

Phase: 12 of 14 (Core Integration Layer) — COMPLETE
Plan: 3 of 3 complete
Status: Phase 12 complete, ready for Phase 13
Last activity: 2026-01-14 — 14 MCP tools complete, MFE/MAE chart type added

Progress: ████████░░ 100% (Phase 12)

## v2.0 Goal

Enable Claude Code/Cowork to interact with TradeBlocks programmatically via MCP server or skill, providing full API access to data queries, analysis execution, and automated exploration.

## Accumulated Context

### Decisions

**v2.0 Phase 11-01:**
- Monorepo with pnpm workspaces (not npm workspaces)
- MCP server at packages/mcp-server/ with ESM-only config
- tsup bundles lib/ imports for standalone npm distribution
- Path alias @lib/* for shared code imports

**v2.0 Phase 11-02:**
- Use McpServer API (not deprecated Server class)
- Use zod@4 for SDK compatibility
- Folder-based block structure for MCP:
  - Each folder = one block
  - Contains tradelog.csv (required), dailylog.csv (optional), reportinglog.csv (optional)
  - .block.json stores metadata + cached stats
- MCP "reprocess" = re-parse CSVs + recalculate (different from UI "recalculate")

**v2.0 Phase 12-01:**
- CSV parsing inline in block-loader (TradeProcessor uses browser File API)
- Strategy filtering forces trade-based calculations (daily logs = full portfolio)
- Automatic metadata caching in .block.json for faster listing
- ESM imports require .js extension in TypeScript

**v2.0 Phase 12-02:**
- JSON-first output pattern: All tools return brief text summary + structured JSON resource
  - JSON is authoritative source for Claude reasoning (machine-readable)
  - Text summary for user visibility only (1-3 lines)
  - Removed verbose markdown tables to reduce context bloat
- Walk-forward uses dynamic window sizing based on trade date range
- Monte Carlo defaults to trades resample method with 5% worst-case pool injection
- Correlation defaults to Kendall's tau (robust to outliers)
- Kelly warnings for portfolio > 25% or strategy > 50%
- UAT-001 Fix: Expanded all tool schemas to expose underlying calculation module parameters

**v2.0 Phase 12-03:**
- 16 chart types in get_performance_charts including MFE/MAE for stop loss/take profit optimization
- MFE/MAE implemented inline to avoid bundle dependency issues
- Backtest vs actual supports three scaling modes: raw, perContract, toReported
- All performance tools expose full parameters (dateRange, normalizeTo1Lot, etc.)
- Report Builder documented for Phase 13 consideration (custom filtered reports via MCP)

All v1.0 decisions documented in PROJECT.md and archived in milestone file.

### Deferred Issues

ISS-005: Plotly TypeScript type conflicts with pnpm (pre-existing, exposed by package manager switch)

All v1.0 issues resolved. See `.planning/ISSUES.md` for closed issues with resolution notes.

### Blockers/Concerns

None — ISS-005 is a build-time type issue only, runtime works correctly.

### Roadmap Evolution

- Milestone v2.0 created: Claude Integration, 4 phases (Phase 11-14)
- Phase 11 complete: Research & Architecture

## Session Continuity

Last session: 2026-01-14
Stopped at: Phase 12 complete, ready for Phase 13
Resume file: None
