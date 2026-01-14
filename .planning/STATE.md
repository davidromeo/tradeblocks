# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-11)

**Core value:** Make WFA results clear and understandable for users new to walk-forward analysis
**Current focus:** v2.0 Claude Integration — Phase 11 complete, ready for Phase 12

## Current Position

Phase: 11 of 14 (Research & Architecture) — COMPLETE
Plan: 2 of 2 complete
Status: Phase complete, ready for Phase 12
Last activity: 2026-01-14 — MCP server scaffold complete

Progress: ██░░░░░░░░ 15%

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
Stopped at: Phase 11 complete
Resume file: None
