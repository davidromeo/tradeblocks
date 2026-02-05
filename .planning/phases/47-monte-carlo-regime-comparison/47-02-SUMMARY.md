---
phase: 47-monte-carlo-regime-comparison
plan: 02
subsystem: mcp-server
tags: [mcp-tool, regime-comparison, edge-decay, monte-carlo]
completed: 2026-02-05
duration: ~3min
requires: [47-01-mc-regime-comparison-engine]
provides: [analyze_regime_comparison-mcp-tool]
affects: [50-verdict-synthesis]
tech-stack:
  added: []
  patterns: [pre-filtered-strategy-passthrough, selective-statistics-output]
key-files:
  modified:
    - packages/mcp-server/src/tools/edge-decay.ts
    - packages/mcp-server/package.json
decisions:
  - Strategy filtering done before calling runRegimeComparison to avoid double-filtering
  - Structured output includes only 6 most relevant statistics per simulation (not full SimulationStatistics with VaR etc.) to keep output manageable
  - Error from runRegimeComparison (insufficient trades) surfaced as tool error message
metrics:
  tasks: 1/1
  tests: 1108 passed
  test-suites: 68 passed
  full-suite: 1108 passed / 68 suites
---

# Phase 47 Plan 02: MC Regime Comparison MCP Tool Summary

Registered `analyze_regime_comparison` as third edge decay MCP tool, exposing dual Monte Carlo regime comparison via CLI with Zod-validated schema and JSON-first output. MCP server bumped to 0.7.1.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Register analyze_regime_comparison MCP tool | e66ecbb | edge-decay.ts, package.json |

## What Was Built

### analyze_regime_comparison MCP Tool

**Registered in `edge-decay.ts` alongside existing tools (analyze_period_metrics, analyze_rolling_metrics)**

Input schema (Zod-validated):
- `blockId` (required): Block folder name
- `strategy` (optional): Filter by strategy name, case-insensitive
- `recentWindowSize` (optional, min 20): Recent window trade count
- `numSimulations` (optional, min 50, max 10000): MC simulation paths
- `simulationLength` (optional, min 10): Trades to project forward per simulation
- `randomSeed` (optional): Seed for reproducibility

Output format (JSON-first via `createToolOutput`):
- Text summary: P(Profit) full vs recent, Sharpe full vs recent, divergence severity and score
- Structured JSON with:
  - `fullHistory`: tradeCount, dateRange, 6 key statistics
  - `recentWindow`: tradeCount, dateRange, 6 key statistics
  - `comparison`: 4 MetricComparison objects with delta, percentChange, divergenceScore
  - `divergence`: severity (aligned/mild_divergence/significant_divergence/regime_break), compositeScore, scoreDescription
  - `parameters`: all resolved parameters

Error handling:
- No trades (or no matching strategy): Returns error with descriptive message
- Insufficient trades (<30): Catches runRegimeComparison error and returns as tool error
- General errors: Caught and returned as tool error with message

### Version Bump

MCP server version bumped from 0.7.0 to 0.7.1 in package.json.

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Pre-filter strategy before calling runRegimeComparison | Avoids double-filtering since engine also accepts strategy option |
| Pass strategy: undefined to engine after filtering | Explicit about avoiding redundant work |
| Select 6 statistics per simulation for output | Keeps JSON response manageable; excludes VaR, CVaR, stdDevReturn etc. |
| Reuse existing filterByStrategy helper | Consistent pattern with tools 1 and 2 |

## Verification Results

1. MCP server build: Successful (tsup + esbuild)
2. Tool registration: Confirmed via build output (no TypeScript errors)
3. Full test suite: 1108/1108 passed (68 suites, 0 failures)
4. CLI --call: DuckDB lock prevented live test (existing MCP server instance holding lock on analytics.duckdb) -- not a code issue, environment constraint

## Phase 47 Completion

Phase 47 (Monte Carlo Regime Comparison) is now complete:
- Plan 01: MC regime comparison engine with 22 tests
- Plan 02: MCP tool registration with CLI integration

All three edge decay MCP tools are registered:
1. `analyze_period_metrics` (Phase 46)
2. `analyze_rolling_metrics` (Phase 46)
3. `analyze_regime_comparison` (Phase 47)

Ready for Phase 48 (Edge Health Composite Score) and Phase 50 (Verdict Synthesis).
