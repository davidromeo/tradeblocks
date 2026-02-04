---
phase: 45-tool-rationalization
plan: 01
subsystem: mcp-tools
tags: [sql, duckdb, tool-removal, breaking-change]
completed: 2026-02-04
duration: ~15m
dependency-graph:
  requires: [44-schema-discovery]
  provides: [sql-complete-analytics-layer]
  affects: []
tech-stack:
  added: []
  patterns: [sql-first-data-access]
key-files:
  created:
    - packages/mcp-server/CHANGELOG.md
    - .planning/phases/45-tool-rationalization/45-ANALYSIS.md
  modified:
    - packages/mcp-server/src/tools/blocks/core.ts
    - packages/mcp-server/src/tools/reports/fields.ts
    - packages/mcp-server/src/tools/reports/queries.ts
    - packages/mcp-server/src/tools/reports/index.ts
    - packages/mcp-server/src/tools/market-data.ts
    - packages/mcp-server/src/utils/schema-metadata.ts
    - packages/mcp-server/package.json
    - packages/mcp-server/src/index.ts
decisions:
  - name: remove-query-tools
    choice: Remove 7 query-only tools that run_sql fully replaces
    rationale: SQL provides identical functionality with more flexibility
    alternatives: [keep-as-convenience, deprecate-gradually]
---

# Phase 45 Plan 01: Tool Rationalization Summary

**One-liner:** Removed 7 redundant query tools, added SQL replacement examples, version 0.6.0 with breaking changes documented.

## What Was Built

### Tool Removal (BREAKING CHANGE)

Removed 7 MCP tools that `run_sql` can fully replace:

| Tool | Former Location | SQL Replacement |
|------|-----------------|-----------------|
| `get_trades` | blocks/core.ts | `SELECT ... FROM trades.trade_data WHERE ...` |
| `list_available_fields` | reports/fields.ts | `describe_database` tool |
| `run_filtered_query` | reports/queries.ts | SQL `WHERE` clauses |
| `aggregate_by_field` | reports/queries.ts | SQL `GROUP BY` with `CASE` |
| `get_market_context` | market-data.ts | `SELECT ... FROM market.spx_daily ...` |
| `enrich_trades` | market-data.ts | SQL `JOIN` |
| `find_similar_days` | market-data.ts | SQL CTE with conditions |

### Documentation Updates

1. **45-ANALYSIS.md**: Full analysis of tool decisions with SQL replacement patterns
2. **CHANGELOG.md**: Breaking changes documented with migration guide
3. **schema-metadata.ts**: Added 6 new SQL examples covering removed tool patterns

### Computational Tools Kept

All tools using TradeBlocks libraries remain:
- `get_statistics` (PortfolioStatsCalculator)
- `get_field_statistics` (trade enrichment + percentiles)
- `analyze_regime_performance` (statistical breakdown)
- `suggest_filters` (filter impact testing)
- `calculate_orb` (ORB calculation)
- Plus 20+ other computational/analysis tools

## Technical Details

### Version Bump

- package.json: 0.5.1 -> 0.6.0
- index.ts McpServer: 0.5.0 -> 0.6.0

### Tool Count Change

- Before: 41 registered tools
- After: 34 registered tools
- Removed: 7 tools

### Files Changed

| File | Change |
|------|--------|
| `blocks/core.ts` | Removed get_trades (~200 lines) |
| `reports/fields.ts` | Removed list_available_fields (~110 lines) |
| `reports/queries.ts` | Gutted - both tools removed, kept as docs |
| `reports/index.ts` | Removed registerQueryTools import |
| `market-data.ts` | Removed 3 tools (~450 lines), cleaned unused code |
| `schema-metadata.ts` | Added 6 SQL examples |

## Decisions Made

### SQL-First Data Access

The pattern for data exploration is now:
1. `describe_database` - Understand schema
2. `run_sql` - Query data directly
3. Computational tool - When library computation needed

### No Deprecation Period

Removed tools immediately rather than deprecating because:
- MCP server is beta (pre-1.0)
- SQL availability is the milestone toward 1.0
- Clean break is simpler for AI agents

## Deviations from Plan

None - plan executed exactly as written.

## Verification

All verification checks passed:
- [x] Build succeeds
- [x] 7 tools removed (41 -> 34 registrations)
- [x] Removed tools not in registerTool calls
- [x] Computational tools still present
- [x] Version bumped to 0.6.0
- [x] CHANGELOG.md documents breaking changes
- [x] SQL examples added to schema-metadata.ts

## Next Phase Readiness

Phase 45 is the final phase of v2.6 milestone. Ready for:
- Milestone archival
- Version tagging
- ROADMAP/PROJECT updates

## Commits

| Hash | Message |
|------|---------|
| e72fd5d | feat(45-01): remove 7 redundant MCP tools |
| b89fd1b | docs(45-01): add SQL examples and version bump to 0.6.0 |
