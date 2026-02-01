# Roadmap: TradeBlocks

## Milestones

- [v1.0 WFA Enhancement](milestones/v1.0-wfa-enhancement.md) (Phases 1-10) — SHIPPED 2026-01-11
- [v2.0 Claude Integration](milestones/v2.0-claude-integration.md) (Phases 11-16) — SHIPPED 2026-01-17
- [v2.1 Portfolio Comparison](milestones/v2.1-portfolio-comparison.md) (Phases 17-24) — SHIPPED 2026-01-18
- [v2.2 Historical Risk-Free Rates](milestones/v2.2-historical-risk-free-rates.md) (Phases 25-28) — SHIPPED 2026-01-18
- [v2.3 Workspace Packages](milestones/v2.3-workspace-packages.md) (Phases 29-31) — SHIPPED 2026-01-19
- [v2.4 Backtest Optimization Tools](milestones/v2.4-backtest-optimization-tools.md) (Phases 32-34) — SHIPPED 2026-01-19
- **v2.5 Reporting Log Integration & Discrepancy Analysis** (Phases 35-40) — IN PROGRESS

## v2.5 Reporting Log Integration & Discrepancy Analysis

**Milestone Goal:** Enable AI models to ingest reporting logs, compare backtest vs actual results at trade level, analyze discrepancy patterns, and score backtest quality — all via MCP.

### Phase 35: Reporting Log Ingestion ✓

**Goal**: Model can load and parse reporting logs (strategylog.csv) for a block via MCP
**Depends on**: Nothing (foundation for v2.5)
**Requirements**: ING-01, ING-02
**Success Criteria** (what must be TRUE):
  1. Model can call MCP tool to load strategylog.csv for a block
  2. Model receives parsing statistics (strategy count, date range, total P/L)
  3. Loaded reporting log is available for subsequent comparison operations
**Plans**: 1 plan — completed 2026-01-31

Plans:
- [x] 35-01-PLAN.md — Enhance list_blocks with hasReportingLog flag, add get_reporting_log_stats tool with caching

### Phase 36: Enhanced Comparison ✓

**Goal**: Model can get detailed trade-level comparison between backtest and actual results
**Depends on**: Phase 35
**Requirements**: CMP-01, CMP-02, CMP-03
**Success Criteria** (what must be TRUE):
  1. Model can get trade-level comparison with entry/exit prices, contracts, and reasons for differences
  2. Model can identify high-slippage outliers automatically (trades with unusual deviation)
  3. Model can group comparison results by strategy name or by date
**Plans**: 1 plan — completed 2026-01-31

Plans:
- [x] 36-01-PLAN.md — Enhance compare_backtest_to_actual with detailLevel, outlier detection, and groupBy parameters

### Phase 37: Discrepancy Analysis ✓

**Goal**: Model can classify slippage sources and identify systematic patterns
**Depends on**: Phase 36
**Requirements**: DSC-01, DSC-02, DSC-03, DSC-04
**Success Criteria** (what must be TRUE):
  1. Model can classify slippage into categories (entry price, exit price, size, timing, unexplained)
  2. Model can identify strategies with systematic slippage patterns (direction bias, category concentration)
  3. Model can detect patterns via configurable thresholds (not risk flags - insights for user interpretation)
  4. Model can correlate slippage with market conditions (VIX levels, time-of-day)
**Plans**: 1 plan — completed 2026-02-01

Plans:
- [x] 37-01-PLAN.md — Implement analyze_discrepancies MCP tool with slippage attribution, pattern detection, and market correlations

### Phase 38: Strategy Matching ✓

**Goal**: Model can get suggested strategy matches and detect unmatchable divergence
**Depends on**: Phase 36
**Requirements**: MTH-01, MTH-02, MTH-03
**Success Criteria** (what must be TRUE):
  1. Model can get suggested strategy matches based on P/L correlation
  2. Model receives confidence scores for each match suggestion
  3. Model can detect when backtest and actual are systematically different (unmatchable divergence)
**Plans**: 1 plan — completed 2026-02-01

Plans:
- [x] 38-01-PLAN.md — Implement suggest_strategy_matches MCP tool with correlation-based matching, confidence scores, and unmatchable detection

### Phase 39: Trend Analysis

**Goal**: Model can analyze slippage trends over time and detect improvement/degradation
**Depends on**: Phase 37
**Requirements**: TRD-01, TRD-02, TRD-03
**Success Criteria** (what must be TRUE):
  1. Model can get time-series slippage data by strategy
  2. Model can detect if slippage is trending better or worse over time
  3. Model can correlate slippage trends with external factors (market volatility, execution venue changes)
**Plans**: 1 plan

Plans:
- [ ] 39-01-PLAN.md — Implement analyze_slippage_trends MCP tool with linear regression trend detection and external factor correlation

### Phase 40: Quality Scoring

**Goal**: Model can score backtest quality and receive improvement suggestions
**Depends on**: Phase 37, Phase 38, Phase 39
**Requirements**: QTY-01, QTY-02, QTY-03
**Success Criteria** (what must be TRUE):
  1. Model can get overall backtest quality score (0-100) based on accuracy vs actual
  2. Model receives component scores (accuracy, consistency, coverage)
  3. Model receives actionable improvement suggestions based on score breakdown
**Plans**: TBD

Plans:
- [ ] 40-01: Implement backtest_quality_score MCP tool

## Completed Milestones

<details>
<summary>v2.4 Backtest Optimization Tools (Phases 32-34) — SHIPPED 2026-01-19</summary>

MCP tools for data-driven filter optimization: find_predictive_fields for correlation analysis and filter_curve for threshold sweeping with sweet spot detection.

- [x] Phase 32: find-predictive-fields (1/1 plan) — completed 2026-01-19
- [x] Phase 33: filter-curve (1/1 plan) — completed 2026-01-19
- [x] Phase 34: report-tools-fixes (1/1 plan) — completed 2026-01-19

**Stats:** 3 phases, 3 plans, 1 day execution time

See [v2.4 archive](milestones/v2.4-backtest-optimization-tools.md) for full details.

</details>

<details>
<summary>v2.3 Workspace Packages (Phases 29-31) — SHIPPED 2026-01-19</summary>

Convert lib/ to @tradeblocks/lib workspace package for clean imports across the monorepo.

- [x] Phase 29: workspace-setup (1/1 plan) — completed 2026-01-19
- [x] Phase 30: import-migration (2/2 plans) — completed 2026-01-19
- [x] Phase 31: cleanup-verification (1/1 plan) — completed 2026-01-19

**Stats:** 3 phases, 4 plans, ~7 hours execution time

See [v2.3 archive](milestones/v2.3-workspace-packages.md) for full details.

</details>

<details>
<summary>v2.2 Historical Risk-Free Rates (Phases 25-28) — SHIPPED 2026-01-18</summary>

Embedded 3,260 historical Treasury rates (2013-2026) for accurate Sharpe/Sortino calculations that reflect actual market conditions.

- [x] Phase 25: Treasury Data (1/1 plan) — completed 2026-01-18
- [x] Phase 26: Core Calculations (1/1 plan) — completed 2026-01-18
- [x] Phase 27: Remove Manual Input (3/3 plans) — completed 2026-01-19
- [x] Phase 28: MCP & Tests (1/1 plan) — completed 2026-01-19

**Stats:** 4 phases, 6 plans, 1 day execution time

See [v2.2 archive](milestones/v2.2-historical-risk-free-rates.md) for full details.

</details>

<details>
<summary>v2.1 Portfolio Comparison (Phases 17-24) — SHIPPED 2026-01-18</summary>

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

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 WFA Enhancement | 1-10 | 17 | Complete | 2026-01-11 |
| v2.0 Claude Integration | 11-16 | 15 | Complete | 2026-01-17 |
| v2.1 Portfolio Comparison | 17-24 | 9 | Complete | 2026-01-18 |
| v2.2 Historical Risk-Free Rates | 25-28 | 6 | Complete | 2026-01-18 |
| v2.3 Workspace Packages | 29-31 | 4 | Complete | 2026-01-19 |
| v2.4 Backtest Optimization Tools | 32-34 | 3 | Complete | 2026-01-19 |
| v2.5 Reporting Log Integration | 35-40 | 5+ | In Progress | - |

## Audit Notes

See `.planning/AUDIT-FINDINGS.md` for detailed findings from Phase 1.
