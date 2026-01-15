# Roadmap: TradeBlocks

## Milestones

- ✅ [v1.0 WFA Enhancement](milestones/v1.0-wfa-enhancement.md) (Phases 1-10) — SHIPPED 2026-01-11
- 🚧 **v2.0 Claude Integration** - Phases 11-15 (in progress)

## Completed Milestones

<details>
<summary>v1.0 WFA Enhancement (Phases 1-10) — SHIPPED 2026-01-11</summary>

Transform TradeBlocks' walk-forward analysis from a rigid automatic tool into a user-controlled system with clear, understandable results.

- [x] Phase 1: Audit & Analysis (3/3 plans) — completed 2026-01-11
- [x] Phase 2: Parameter UI Polish (1/1 plan) — completed 2026-01-11
- [x] Phase 3: Input Validation Fixes (1/1 plan) — completed 2026-01-11
- [x] Phase 5: Optimization Targets (1/1 plan) — completed 2026-01-11
- [x] Phase 6: Results Summary View (1/1 plan) — completed 2026-01-11
- [x] Phase 7: Terminology Explanations (1/1 plan) — completed 2026-01-11
- [x] Phase 8: Interpretation Guidance (3/3 plans) — completed 2026-01-11
- [x] Phase 9: Calculation Robustness (1/1 plan) — completed 2026-01-11
- [x] Phase 10: Integration & Polish (3/3 plans) — completed 2026-01-11

**Stats:** 10 phases, 17 plans, ~2.8 hours execution time

See [v1.0 archive](milestones/v1.0-wfa-enhancement.md) for full details.

</details>

## 🚧 v2.0 Claude Integration (In Progress)

**Milestone Goal:** Enable Claude Code/Cowork to interact with TradeBlocks programmatically via MCP server or skill, providing full API access to data queries, analysis execution, and automated exploration.

### Phase 11: Research & Architecture ✓

**Goal**: Investigate MCP vs skill approach, understand TradeBlocks data access patterns, design integration architecture
**Depends on**: v1.0 complete
**Status**: Complete
**Completed**: 2026-01-14

Plans:
- [x] 11-01: Monorepo Foundation (pnpm workspace + MCP server scaffold) - completed 2026-01-14
- [x] 11-02: MCP Server Scaffold (stdio transport, list_backtests tool) - completed 2026-01-14

### Phase 12: Core Integration Layer ✓

**Goal**: Build MCP server tools exposing data queries, statistics, and analysis capabilities
**Depends on**: Phase 11
**Status**: Complete
**Completed**: 2026-01-14
**Plans**: 3

Plans:
- [x] 12-01: Block Loading and Core Tools (block-loader, output-formatter, 6 Tier 1 tools) - completed 2026-01-14
- [x] 12-02: Analysis Tools (WFA, Monte Carlo, correlation, tail risk, position sizing) - completed 2026-01-14
- [x] 12-03: Performance Tools (chart data, period returns, backtest vs actual, MFE/MAE) - completed 2026-01-14

**Deliverables:**
- 14 MCP tools (6 core + 5 analysis + 3 performance)
- JSON-first output pattern for Claude reasoning
- Full parameter exposure for all calculation modules

### Phase 13: Analysis Capabilities ✓

**Goal**: Add Report Builder integration, custom report generation, automated exploration modes
**Depends on**: Phase 12
**Status**: Complete
**Completed**: 2026-01-14
**Plans**: 1

Plans:
- [x] 13-01: Report Builder MCP Tools (4 new tools: list_available_fields, run_filtered_query, get_field_statistics, aggregate_by_field) - completed 2026-01-14

**Deliverables:**
- 18 MCP tools total (6 core + 5 analysis + 3 performance + 4 report)
- Full filtering and aggregation capabilities for Claude exploration

### Phase 13.1: Import CSV Tool (INSERTED) ✓

**Goal**: Add `import_csv` MCP tool to accept arbitrary CSV paths and create persistent blocks
**Depends on**: Phase 13
**Status**: Complete
**Completed**: 2026-01-15
**Plans**: 1

Scope:
- `import_csv` tool accepting CSV path + optional block name
- Validates CSV structure (trade log format)
- Copies to configured blocks directory
- Creates `.block.json` metadata
- Returns block ID for immediate use

Plans:
- [x] 13.1-01: Implement import_csv MCP tool - completed 2026-01-15

### Phase 14: Multi-Platform Agent Skills

**Goal**: Create skills/tools for Claude Code, OpenAI Agents, and Gemini Agents to interact with TradeBlocks MCP server
**Depends on**: Phase 13.1
**Research**: Likely needed to understand each platform's agent/skill format
**Plans**: TBD

Potential scope:
- Claude Code skill (`.claude/commands/`) wrapping MCP tools with natural language interface
- OpenAI function calling / Assistants API adapter
- Gemini function declaration adapter
- Shared prompt templates for trading analysis workflows

Plans:
- [ ] 14-01: TBD (research each platform's requirements)

### Phase 15: Polish & Documentation

**Goal**: Error handling, usage examples, integration testing, documentation
**Depends on**: Phase 14
**Research**: Unlikely (internal work)
**Plans**: TBD

Plans:
- [ ] 15-01: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Audit & Analysis | v1.0 | 3/3 | Complete | 2026-01-11 |
| 2. Parameter UI Polish | v1.0 | 1/1 | Complete | 2026-01-11 |
| 3. Input Validation Fixes | v1.0 | 1/1 | Complete | 2026-01-11 |
| 5. Optimization Targets | v1.0 | 1/1 | Complete | 2026-01-11 |
| 6. Results Summary View | v1.0 | 1/1 | Complete | 2026-01-11 |
| 7. Terminology Explanations | v1.0 | 1/1 | Complete | 2026-01-11 |
| 8. Interpretation Guidance | v1.0 | 3/3 | Complete | 2026-01-11 |
| 9. Calculation Robustness | v1.0 | 1/1 | Complete | 2026-01-11 |
| 10. Integration & Polish | v1.0 | 3/3 | Complete | 2026-01-11 |
| 11. Research & Architecture | v2.0 | 2/2 | Complete | 2026-01-14 |
| 12. Core Integration Layer | v2.0 | 3/3 | Complete | 2026-01-14 |
| 13. Analysis Capabilities | v2.0 | 1/1 | Complete | 2026-01-14 |
| 13.1 Import CSV Tool | v2.0 | 1/1 | Complete | 2026-01-15 |
| 14. Multi-Platform Agent Skills | v2.0 | 0/? | Not started | - |
| 15. Polish & Documentation | v2.0 | 0/? | Not started | - |

## Audit Notes

See `.planning/AUDIT-FINDINGS.md` for detailed findings from Phase 1.
