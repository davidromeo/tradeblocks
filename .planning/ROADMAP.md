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

### Phase 11: Research & Architecture

**Goal**: Investigate MCP vs skill approach, understand TradeBlocks data access patterns, design integration architecture
**Depends on**: v1.0 complete
**Research**: Likely (MCP server patterns, Claude skill patterns, API design)
**Research topics**: MCP server implementation in Next.js, Claude skill best practices, exposing IndexedDB data via API, authentication/security considerations
**Plans**: TBD

Plans:
- [x] 11-01: Monorepo Foundation (pnpm workspace + MCP server scaffold) - completed 2026-01-14
- [ ] 11-02: TBD (MCP server core implementation)

### Phase 12: Core Integration Layer

**Goal**: Build the chosen integration (MCP server or skill), expose data queries and basic statistics
**Depends on**: Phase 11
**Research**: Likely (implementation depends on Phase 11 architecture decision)
**Research topics**: Chosen approach implementation patterns
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

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
| 11. Research & Architecture | v2.0 | 1/? | In Progress | - |
| 12. Core Integration Layer | v2.0 | 0/? | Not started | - |
| 13. Analysis Capabilities | v2.0 | 0/? | Not started | - |
| 14. Polish & Documentation | v2.0 | 0/? | Not started | - |

## Audit Notes

See `.planning/AUDIT-FINDINGS.md` for detailed findings from Phase 1.
