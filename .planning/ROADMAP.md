# Roadmap: TradeBlocks

## Milestones

- ✅ **v1.0 WFA Enhancement** - Phases 1-10 (shipped 2026-01-11)
- ✅ **v2.0 Claude Integration** - Phases 11-16, 13.1 (shipped 2026-01-17)
- ✅ **v2.1 Portfolio Comparison** - Phases 17-24, 17.1 (shipped 2026-01-18)
- ✅ **v2.2 Historical Risk-Free Rates** - Phases 25-28 (shipped 2026-01-18)
- ✅ **v2.3 Workspace Packages** - Phases 29-31 (shipped 2026-01-19)
- ✅ **v2.4 Backtest Optimization Tools** - Phases 32-34 (shipped 2026-01-19)
- ✅ **v2.5 Reporting Log Integration** - Phases 35-39 (shipped 2026-02-01)
- ✅ **v2.6 DuckDB Analytics Layer** - Phases 41-45, 42.1 (shipped 2026-02-04)

## v2.7 Edge Decay Analysis (In Progress)

**Milestone Goal:** Detect whether a trading strategy is losing its edge through a single unified `analyze_edge_decay` MCP tool that orchestrates period segmentation, rolling metrics, Monte Carlo regime comparison, walk-forward degradation tracking, and live alignment signals into a structured verdict.

### Overview

Five phases deliver the edge decay analysis tool bottom-up: two foundational calculation engines (period segmentation + rolling metrics), then Monte Carlo regime comparison, walk-forward degradation tracking, and live alignment signal as independent analysis modules, culminating in verdict synthesis and tool registration that wires everything into the unified MCP tool.

## Phases

- [x] **Phase 46: Core Calculation Engines** - Period segmentation and rolling metrics analysis (completed 2026-02-05)
- [x] **Phase 47: Monte Carlo Regime Comparison** - Dual MC simulation comparing full history vs recent window (completed 2026-02-05)
- [x] **Phase 48: Walk-Forward Degradation** - Progressive walk-forward with OOS efficiency tracking (completed 2026-02-05)
- [x] **Phase 49: Live Alignment Signal** - Backtest vs actual comparison when reporting log exists (completed 2026-02-06)
- [ ] **Phase 50: Verdict Synthesis & Tool Registration** - Combine all signals into unified MCP tool

## Phase Details

### Phase 46: Core Calculation Engines
**Goal**: Users can see period-segmented statistics with trend detection and rolling metric trajectories for any block
**Depends on**: Nothing (foundational calculations)
**Requirements**: PSEG-01, PSEG-02, PSEG-03, ROLL-01, ROLL-02, ROLL-03, ROLL-04
**Success Criteria** (what must be TRUE):
  1. Given a block's trades, the engine produces yearly and quarterly breakdowns of win rate, profit factor, Kelly %, and avg monthly return as % of equity
  2. Year-over-year trend direction (improving/stable/deteriorating) is detected via linear regression on key metrics
  3. The worst consecutive-month losing stretch is identified and compared to historical worst
  4. Rolling Sharpe, win rate, and profit factor are computed over a configurable window with quarterly seasonal averages
  5. Recent window vs full history comparison surfaces payoff structure inversions (avg loss > avg win)
**Plans:** 3 plans
Plans:
- [x] 46-01-PLAN.md — Period segmentation engine + trend detection + tests
- [x] 46-02-PLAN.md — Rolling metrics engine + seasonal averages + recent comparison + tests
- [x] 46-03-PLAN.md — MCP tool registration (analyze_period_metrics, analyze_rolling_metrics) + CLI verification

### Phase 47: Monte Carlo Regime Comparison
**Goal**: Users can compare forward-looking risk profiles between full trade history and recent trading window
**Depends on**: Phase 46 (needs recent window concept established)
**Requirements**: MCRG-01, MCRG-02, MCRG-03, MCRG-04
**Success Criteria** (what must be TRUE):
  1. Monte Carlo simulation runs on full trade history using percentage-based resampling
  2. Monte Carlo simulation runs on only the recent window trades (configurable, default ~200)
  3. P(Profit), expected return, Sharpe, and median max drawdown are compared between the two simulations
  4. Regime divergence is classified into severity levels (aligned / mild divergence / significant divergence / regime break)
**Plans:** 2 plans
Plans:
- [x] 47-01-PLAN.md — MC regime comparison engine + divergence classification + TDD tests
- [x] 47-02-PLAN.md — MCP tool registration (analyze_regime_comparison) + CLI verification

### Phase 48: Walk-Forward Degradation
**Goal**: Users can track whether out-of-sample performance is degrading over time relative to in-sample performance
**Depends on**: Nothing (independent of Phases 46-47, reuses existing walk-forward infrastructure)
**Requirements**: WFD-01, WFD-02, WFD-03, WFD-04
**Success Criteria** (what must be TRUE):
  1. Progressive walk-forward runs across full trade history with 365d IS / 90d OOS / 90d step
  2. OOS efficiency (OOS metric / IS metric) is tracked as a time series across all periods
  3. Efficiency breakdowns are detected when OOS efficiency drops below threshold (50%) or turns negative
  4. Recent OOS periods are compared to historical OOS average with quantified degradation
**Plans:** 2 plans
Plans:
- [x] 48-01-PLAN.md — WFD calculation engine + efficiency tracking + trend detection + tests
- [x] 48-02-PLAN.md — MCP tool registration (analyze_walk_forward_degradation) + CLI verification

### Phase 49: Live Alignment Signal
**Goal**: Users can assess whether live execution matches backtest expectations when reporting log data exists
**Depends on**: Nothing (independent module, reuses existing compare_backtest_to_actual infrastructure)
**Requirements**: LIVE-01, LIVE-02, LIVE-03, LIVE-04
**Success Criteria** (what must be TRUE):
  1. When reporting log exists, backtest vs actual direction agreement rate is calculated
  2. When reporting log exists, per-contract gap between backtest and actual is calculated by strategy
  3. Strategies where actual significantly underperforms backtest are identified as potential execution decay
  4. When no reporting log exists, live alignment is gracefully skipped with clear indication
**Plans:** 2 plans
Plans:
- [x] 49-01-PLAN.md — Live alignment calculation engine + trade matching + direction agreement + execution efficiency + trend detection + tests
- [x] 49-02-PLAN.md — MCP tool registration (analyze_live_alignment) + graceful skip + CLI verification

### Phase 50: Verdict Synthesis & Tool Registration
**Goal**: Users can run a single `analyze_edge_decay` MCP tool that aggregates all 5 signal categories into structured factual data for LLM interpretation (no verdicts, no grades -- data only)
**Depends on**: Phases 46, 47, 48, 49 (combines all signal outputs)
**Requirements**: VERD-01, VERD-02, VERD-03, VERD-04, VERD-05, API-01, API-02, API-03, API-04
**Success Criteria** (what must be TRUE):
  1. Tool accepts blockId (required), recentWindow (optional with auto-calculation), and strategy filter via Zod-validated schema
  2. Tool produces a structured top-level summary of key numbers and per-signal key metrics (no verdict labels, no grades -- raw data for LLM interpretation)
  3. Tool surfaces factual observations as structured data objects (metric, current, comparison, delta) when notable thresholds are crossed
  4. Tool includes detailed supporting data for each signal (period breakdowns, rolling metric summaries, MC comparison, WF details)
  5. Tool works with CLI --call mode for testing and is registered in the MCP server
**Known constraint**: Rolling metrics series produces ~N-W+1 data points (e.g., 3200+ for a 3425-trade block). This exceeds MCP output limits. The unified tool will need to either downsample the rolling series or return summary statistics with an option to fetch the full series separately.
**Plans:** 2 plans
Plans:
- [ ] 50-01-PLAN.md -- Edge decay synthesis engine (pure lib function) + TDD tests
- [ ] 50-02-PLAN.md -- MCP tool registration (analyze_edge_decay) + CLI verification + version bump

## Progress

**Execution Order:** 46 -> 47 -> 48 -> 49 -> 50
Note: Phases 47, 48, 49 are independent of each other but all feed into Phase 50.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 46. Core Calculation Engines | v2.7 | 3/3 | ✓ Complete | 2026-02-05 |
| 47. MC Regime Comparison | v2.7 | 2/2 | ✓ Complete | 2026-02-05 |
| 48. WF Degradation | v2.7 | 2/2 | ✓ Complete | 2026-02-05 |
| 49. Live Alignment | v2.7 | 2/2 | ✓ Complete | 2026-02-06 |
| 50. Verdict & Tool API | v2.7 | 0/2 | Not started | - |
