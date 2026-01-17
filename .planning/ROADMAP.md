# Roadmap: TradeBlocks

## Milestones

- ✅ [v1.0 WFA Enhancement](milestones/v1.0-wfa-enhancement.md) (Phases 1-10) — SHIPPED 2026-01-11
- ✅ [v2.0 Claude Integration](milestones/v2.0-claude-integration.md) (Phases 11-16) — SHIPPED 2026-01-17
- 🚧 **v2.1 Portfolio Comparison** — Phases 17-23 (in progress)

## 🚧 v2.1 Portfolio Comparison (In Progress)

**Milestone Goal:** Add 7 new MCP tools to improve portfolio comparison and analysis capabilities, addressing gaps in "what changed and why" analysis identified from real user feedback.

### Phase 17: Block Diff Tool ✓
**Goal:** Compare two blocks showing strategies shared vs unique, per-strategy P/L attribution, and side-by-side metrics
**Depends on:** v2.0 complete
**Research:** Unlikely (uses existing calculators)
**Plans:** 1/1 complete

Plans:
- [x] 17-01: Implement block_diff tool with strategy overlap analysis

### Phase 17.1: CLI Test Mode ✓
**Goal:** Add --call flag to MCP server for direct tool invocation (enables subagent testing)
**Depends on:** Phase 17
**Research:** No
**Plans:** 1/1 complete

Plans:
- [x] 17.1-01: Add --call CLI mode for direct tool invocation

### Phase 18: Stress Test Tool
**Goal:** Show portfolio performance during named historical scenarios (COVID crash, 2022 bear, Aug 2024 VIX spike)
**Depends on:** Phase 17
**Research:** Unlikely (simple date filtering + scenario definitions)
**Plans:** TBD

Plans:
- [ ] 18-01: TBD

### Phase 19: Drawdown Attribution Tool
**Goal:** During max drawdown periods, identify which strategies contributed most to losses
**Depends on:** Phase 18
**Research:** Unlikely (extends existing drawdown logic)
**Plans:** TBD

Plans:
- [ ] 19-01: TBD

### Phase 20: Marginal Contribution Tool
**Goal:** Calculate marginal Sharpe/Sortino contribution of adding a strategy to a portfolio
**Depends on:** Phase 19
**Research:** Unlikely (new algorithm, uses existing ratio calculators)
**Plans:** TBD

Plans:
- [ ] 20-01: TBD

### Phase 21: Strategy Similarity Tool
**Goal:** Flag strategies that may be redundant based on correlation, tail dependence, and overlap
**Depends on:** Phase 20
**Research:** Unlikely (leverages existing correlation/tail-risk)
**Plans:** TBD

Plans:
- [ ] 21-01: TBD

### Phase 22: What-If Scaling Tool
**Goal:** Project portfolio metrics if strategies were run at different sizes
**Depends on:** Phase 21
**Research:** Unlikely (straightforward scaling logic)
**Plans:** TBD

Plans:
- [ ] 22-01: TBD

### Phase 23: Portfolio Health Check Tool
**Goal:** Run correlation + tail risk + Monte Carlo in one call, return unified portfolio health assessment
**Depends on:** Phase 22
**Research:** Unlikely (orchestrates previous tools)
**Plans:** TBD

Plans:
- [ ] 23-01: TBD

## Completed Milestones

<details>
<summary>v2.0 Claude Integration (Phases 11-16) — SHIPPED 2026-01-17</summary>

MCP server with 19 tools for AI-powered trading analytics, plus 6 agent skills for guided analysis workflows across Claude, Codex, and Gemini platforms.

- [x] Phase 11: Research & Architecture (2/2 plans) — completed 2026-01-14
- [x] Phase 12: Core Integration Layer (3/3 plans) — completed 2026-01-14
- [x] Phase 13: Analysis Capabilities (1/1 plan) — completed 2026-01-14
- [x] Phase 13.1: Import CSV Tool (1/1 plan) — completed 2026-01-15
- [x] Phase 14: Multi-Platform Agent Skills (4/4 plans) — completed 2026-01-16
- [x] Phase 15: Polish & Documentation (2/2 plans) — completed 2026-01-17
- [x] Phase 16: Documentation Review (1/1 plan) — completed 2026-01-17

**Stats:** 7 phases (including 13.1), 15 plans, 4 days execution time

See [v2.0 archive](milestones/v2.0-claude-integration.md) for full details.

</details>

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

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 17. Block Diff | v2.1 | 1/1 | Complete | 2026-01-17 |
| 18. Stress Test | v2.1 | 0/? | Not started | - |
| 19. Drawdown Attribution | v2.1 | 0/? | Not started | - |
| 20. Marginal Contribution | v2.1 | 0/? | Not started | - |
| 21. Strategy Similarity | v2.1 | 0/? | Not started | - |
| 22. What-If Scaling | v2.1 | 0/? | Not started | - |
| 23. Portfolio Health Check | v2.1 | 0/? | Not started | - |

## Audit Notes

See `.planning/AUDIT-FINDINGS.md` for detailed findings from Phase 1.
