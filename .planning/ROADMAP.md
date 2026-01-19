# Roadmap: TradeBlocks

## Milestones

- ✅ [v1.0 WFA Enhancement](milestones/v1.0-wfa-enhancement.md) (Phases 1-10) — SHIPPED 2026-01-11
- ✅ [v2.0 Claude Integration](milestones/v2.0-claude-integration.md) (Phases 11-16) — SHIPPED 2026-01-17
- ✅ [v2.1 Portfolio Comparison](milestones/v2.1-portfolio-comparison.md) (Phases 17-24) — SHIPPED 2026-01-18
- ✅ [v2.2 Historical Risk-Free Rates](milestones/v2.2-historical-risk-free-rates.md) (Phases 25-28) — SHIPPED 2026-01-18
- 🚧 **v2.3 Workspace Packages** - Phases 29-31 (in progress)

## Completed Milestones

<details>
<summary>✅ v2.2 Historical Risk-Free Rates (Phases 25-28) — SHIPPED 2026-01-18</summary>

Embedded 3,260 historical Treasury rates (2013-2026) for accurate Sharpe/Sortino calculations that reflect actual market conditions.

- [x] Phase 25: Treasury Data (1/1 plan) — completed 2026-01-18
- [x] Phase 26: Core Calculations (1/1 plan) — completed 2026-01-18
- [x] Phase 27: Remove Manual Input (3/3 plans) — completed 2026-01-19
- [x] Phase 28: MCP & Tests (1/1 plan) — completed 2026-01-19

**Stats:** 4 phases, 6 plans, 1 day execution time

See [v2.2 archive](milestones/v2.2-historical-risk-free-rates.md) for full details.

</details>

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

### 🚧 v2.3 Workspace Packages (In Progress)

**Milestone Goal:** Convert `lib/` to a proper workspace package (`@tradeblocks/lib`) to fix TypeScript path resolution issues and enable clean imports across the monorepo.

#### Phase 29: workspace-setup — Complete

**Goal**: Create `@tradeblocks/lib` package with workspace config
**Depends on**: Previous milestone complete
**Research**: Unlikely (npm workspaces are well-documented)
**Plans**: 1/1 complete

Plans:
- [x] 29-01: Create package structure, move lib/, verify workspace resolution

#### Phase 30: import-migration

**Goal**: Update all imports in Next.js app and MCP server to use package imports
**Depends on**: Phase 29
**Research**: Unlikely (mechanical find/replace)
**Plans**: 2

Plans:
- [ ] 30-01: MCP server imports (6 files + config cleanup)
- [ ] 30-02: Next.js app imports (127 files in app/ + components/)

#### Phase 31: cleanup-verification

**Goal**: Remove old path alias configs, verify type checking/build/tests pass
**Depends on**: Phase 30
**Research**: Unlikely (internal cleanup)
**Plans**: TBD

Plans:
- [ ] 31-01: TBD

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 WFA Enhancement | 1-10 | 17 | Complete | 2026-01-11 |
| v2.0 Claude Integration | 11-16 | 15 | Complete | 2026-01-17 |
| v2.1 Portfolio Comparison | 17-24 | 9 | Complete | 2026-01-18 |
| v2.2 Historical Risk-Free Rates | 25-28 | 6 | Complete | 2026-01-18 |
| v2.3 Workspace Packages | 29-31 | 0/? | In progress | - |

## Audit Notes

See `.planning/AUDIT-FINDINGS.md` for detailed findings from Phase 1.
