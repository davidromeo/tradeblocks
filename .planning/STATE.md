# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-11)

**Core value:** Make WFA results clear and understandable for users new to walk-forward analysis
**Current focus:** v2.0 Claude Integration — Phase 14 (Multi-Platform Agent Skills)

## Current Position

Phase: 14 of 15 (Multi-Platform Agent Skills)
Plan: 4 of 4 in current phase
Status: Phase 14 complete (all 4 plans)
Last activity: 2026-01-16 — Completed 14-04-PLAN.md (npm Packaging Preparation)

Progress: █████████░ 90% (v2.0 milestone)

## v2.0 Goal

Enable Claude Code/Cowork to interact with TradeBlocks programmatically via MCP server or skill, providing full API access to data queries, analysis execution, and automated exploration.

## Accumulated Context

### Decisions

**v2.0 Phase 11-01:**
- Monorepo with npm workspaces (migrated from pnpm 2026-01-15)
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

**v2.0 Phase 13-01:**
- 4 Report Builder MCP tools: list_available_fields, run_filtered_query, get_field_statistics, aggregate_by_field
- Inline trade enrichment required (browser deps prevent importing enrichTrades)
- Filter logic implemented inline with all 7 operators (eq, neq, gt, gte, lt, lte, between)
- MFE/MAE approximated from maxProfit/maxLoss when full calculation unavailable
- Total MCP tools: 18 (6 core + 5 analysis + 3 performance + 4 report)

**v2.0 Phase 13.1-01:**
- import_csv MCP tool for ad-hoc CSV analysis without pre-configured blocks
- CSV validation for tradelog (17 columns), dailylog (5 columns), reportinglog formats
- Copy-on-import pattern: copies CSV to blocks directory with .block.json metadata
- Total MCP tools: 19 (6 core + 5 analysis + 3 performance + 4 report + 1 import)

**v2.0 Phase 14-01:**
- Agent Skills standard (agentskills.io) for cross-platform compatibility
- Progressive disclosure: SKILL.md (~120-140 lines) + references/ for detailed education
- 3 core skills created: tradeblocks-health-check, tradeblocks-wfa, tradeblocks-risk
- Conversational workflow pattern: gather context → analyze → interpret → recommend
- Skills installable at .claude/skills/, .codex/skills/, .gemini/skills/

**v2.0 Phase 14-02:**
- 3 additional skills: tradeblocks-compare, tradeblocks-portfolio, tradeblocks-optimize
- Compare skill handles 3 comparison types with scaling mode explanations
- Portfolio skill uses ADD/CONSIDER/SKIP recommendation framework
- Optimize skill uses Report Builder tools with overfitting warnings

**v2.0 Phase 14-03:**
- Two distribution paths: Skills (CLI) and Desktop Extension (Claude Desktop)
- Skills documentation: README.md, INSTALL.md, install.sh helper script
- Desktop Extension: manifest.json for MCPB packaging (.mcpb bundle)
- MCP server README.md with Claude Desktop installation instructions

**v2.0 Phase 14-04:**
- Skill manifest (index.json) for programmatic skill listing
- Copy-on-build pattern for npm package portability (symlinks not supported)
- Multi-entry tsup: index.ts (executable) + skill-installer.ts (library)
- Skill installer API: install/uninstall/check functions for Phase 15 CLI
- Phase 14 complete: 6 skills with documentation, packaging, and installer module

All v1.0 decisions documented in PROJECT.md and archived in milestone file.

### Deferred Issues

ISS-005: Plotly TypeScript type conflicts with pnpm (pre-existing, exposed by package manager switch)

All v1.0 issues resolved. See `.planning/ISSUES.md` for closed issues with resolution notes.

### Blockers/Concerns

None — ISS-005 is a build-time type issue only, runtime works correctly.

### Roadmap Evolution

- Milestone v2.0 created: Claude Integration, 5 phases (Phase 11-15)
- Phase 11 complete: Research & Architecture
- Phase 14 added: Multi-Platform Agent Skills (Claude, OpenAI, Gemini)
- Phase 15: Polish & Documentation (moved from Phase 14)
- Phase 13.1 inserted after Phase 13: Import CSV Tool (URGENT) — enables ad-hoc CSV analysis without pre-configured blocks

## Session Continuity

Last session: 2026-01-16
Stopped at: Completed 14-04-PLAN.md (Phase 14 fully complete)
Resume file: None
