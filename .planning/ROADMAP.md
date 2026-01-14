# Roadmap: TradeBlocks

## Milestones

- ✅ [v1.0 WFA Enhancement](milestones/v1.0-wfa-enhancement.md) (Phases 1-10) — SHIPPED 2026-01-11
- 🚧 **v2.0 Claude Integration** - Phases 11-14 (in progress)

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

### Phase 12: Core Integration Layer

**Goal**: Build MCP server tools exposing data queries, statistics, and analysis capabilities
**Depends on**: Phase 11
**Status**: In progress
**Plans**: 3

Plans:
- [x] 12-01: Block Loading and Core Tools (block-loader, output-formatter, 6 Tier 1 tools) - completed 2026-01-14
- [ ] 12-02: Analysis Tools (WFA, Monte Carlo, correlation, tail risk, position sizing)
- [ ] 12-03: Performance Tools (chart data, period returns, backtest vs actual)

### Phase 13: Analysis Capabilities

**Goal**: Add WFA execution, report generation, automated exploration modes
**Depends on**: Phase 12
**Research**: Unlikely (internal patterns established from Phase 12)
**Plans**: TBD

Plans:
- [ ] 13-01: TBD

### Phase 14: Polish & Documentation

**Goal**: Error handling, usage examples, integration testing, documentation
**Depends on**: Phase 13
**Research**: Unlikely (internal work)
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

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
| 12. Core Integration Layer | v2.0 | 1/3 | In progress | - |
| 13. Analysis Capabilities | v2.0 | 0/? | Not started | - |
| 14. Polish & Documentation | v2.0 | 0/? | Not started | - |

## Audit Notes

See `.planning/AUDIT-FINDINGS.md` for detailed findings from Phase 1.
