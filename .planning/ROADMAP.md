# Roadmap: TradeBlocks

## Milestones

- ✅ [v1.0 WFA Enhancement](milestones/v1.0-wfa-enhancement.md) (Phases 1-10) — SHIPPED 2026-01-11
- ✅ [v2.0 Claude Integration](milestones/v2.0-claude-integration.md) (Phases 11-16) — SHIPPED 2026-01-17
- ✅ [v2.1 Portfolio Comparison](milestones/v2.1-portfolio-comparison.md) (Phases 17-24) — SHIPPED 2026-01-18
- 🚧 **v2.2 Historical Risk-Free Rates** — Phases 25-28 (in progress)

## Completed Milestones

<details>
<summary>✅ v2.1 Portfolio Comparison (Phases 17-24) — SHIPPED 2026-01-18</summary>

7 new MCP tools for advanced portfolio comparison and analysis, plus CLI test mode and web platform integration documentation.

- [x] Phase 17: Block Diff (1/1 plan) — completed 2026-01-17
- [x] Phase 17.1: CLI Test Mode (1/1 plan) — completed 2026-01-17
- [x] Phase 18: Stress Test (1/1 plan) — completed 2026-01-18
- [x] Phase 19: Drawdown Attribution (1/1 plan) — completed 2026-01-18
- [x] Phase 20: Marginal Contribution (1/1 plan) — completed 2026-01-18
- [x] Phase 21: Strategy Similarity (1/1 plan) — completed 2026-01-18
- [x] Phase 22: What-If Scaling (1/1 plan) — completed 2026-01-18
- [x] Phase 23: Portfolio Health Check (1/1 plan) — completed 2026-01-18
- [x] Phase 24: Web Platform Guide (1/1 plan) — completed 2026-01-18

**Stats:** 9 phases (including 17.1), 9 plans, 2 days execution time

See [v2.1 archive](milestones/v2.1-portfolio-comparison.md) for full details.

</details>

<details>
<summary>✅ v2.0 Claude Integration (Phases 11-16) — SHIPPED 2026-01-17</summary>

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
<summary>✅ v1.0 WFA Enhancement (Phases 1-10) — SHIPPED 2026-01-11</summary>

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

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 WFA Enhancement | 1-10 | 17 | Complete | 2026-01-11 |
| v2.0 Claude Integration | 11-16 | 15 | Complete | 2026-01-17 |
| v2.1 Portfolio Comparison | 17-24 | 9 | Complete | 2026-01-18 |
| v2.2 Historical Risk-Free Rates | 25-28 | TBD | In progress | - |

---

## 🚧 v2.2 Historical Risk-Free Rates (In Progress)

**Milestone Goal:** Replace fixed 2% risk-free rate with embedded historical Treasury rates (2013-2025) for accurate Sharpe/Sortino calculations that reflect actual market conditions.

**Background:** Amy's feature request - Sharpe ratio gets distorted when rates move meaningfully. Using a constant rate when actual rates varied significantly (e.g., 0% in 2020 vs 5%+ in 2023) skews risk-adjusted metrics.

**Approach:**
- Embed ~3,000 daily 3-month T-bill rates (2013-2025) as static data (~60KB)
- Lookup rate by trade date, fallback to last known rate for dates outside range
- Remove manual riskFreeRate input entirely (no override needed)
- Local-only: no external API calls, data bundled in app

### Phase 25: Treasury Data ✅

**Goal**: Create embedded rate data file and lookup utility
**Depends on**: Previous milestone complete
**Research**: Unlikely (data format known from research)
**Plans**: 1 plan (TDD)

Plans:
- [x] 25-01: Treasury rate data and lookup utility (TDD) — completed 2026-01-18

### Phase 26: Core Calculations ✅

**Goal**: Update Sharpe/Sortino calculations to use date-based rate lookup
**Depends on**: Phase 25
**Research**: Unlikely (internal refactoring)
**Plans**: 1 plan (TDD)

Plans:
- [x] 26-01: Date-based risk-free rates for Sharpe/Sortino (TDD) — completed 2026-01-18

### Phase 27: Remove Manual Input ✅

**Goal**: Remove riskFreeRate from types, stores, UI, and services
**Depends on**: Phase 26
**Research**: Unlikely (deletion/cleanup)
**Plans**: 3 plans

Plans:
- [x] 27-01: Remove riskFreeRate from types/models — completed 2026-01-18
- [x] 27-02: Remove from stores/services/UI — completed 2026-01-18
- [x] 27-03: Remove from MCP/tests — completed 2026-01-19

### Phase 28: MCP & Tests

**Goal**: Update MCP server and test suites for new rate behavior
**Depends on**: Phase 27
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 28-01: TBD (run /gsd:plan-phase 28 to break down)

---

## Progress (v2.2)

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 25. Treasury Data | v2.2 | 1/1 | Complete | 2026-01-18 |
| 26. Core Calculations | v2.2 | 1/1 | Complete | 2026-01-18 |
| 27. Remove Manual Input | v2.2 | 3/3 | Complete | 2026-01-19 |
| 28. MCP & Tests | v2.2 | 0/? | Not started | - |

## Audit Notes

See `.planning/AUDIT-FINDINGS.md` for detailed findings from Phase 1.
