# Requirements: TradeBlocks v2.7 Edge Decay Analysis

**Defined:** 2026-02-04
**Core Value:** Detect whether a trading strategy is losing its edge -- regime change vs normal drawdown -- through a single unified MCP tool

## v2.7 Requirements

### Period Segmentation

- [x] **PSEG-01**: Tool segments trades by year and quarter, calculating win rate, profit factor, Kelly %, and avg monthly return as % of equity for each period
- [x] **PSEG-02**: Tool detects year-over-year trend direction in key metrics (improving, stable, deteriorating) with simple linear regression
- [x] **PSEG-03**: Tool identifies the worst consecutive-month stretch and compares it to historical worst

### Rolling Metrics Analysis

- [x] **ROLL-01**: Tool computes rolling Sharpe, win rate, and profit factor over a configurable window (default 50 trades)
- [x] **ROLL-02**: Tool calculates quarterly averages of rolling metrics to identify seasonal patterns (H1 vs H2, Q4 weakness)
- [x] **ROLL-03**: Tool compares last N trades (recent window) to full history for rolling Sharpe, win rate, and profit factor averages
- [x] **ROLL-04**: Tool detects when avg loss exceeds avg win (payoff structure inversion) in recent window

### Monte Carlo Regime Comparison

- [x] **MCRG-01**: Tool runs Monte Carlo simulation sampling from full trade history (percentage-based resampling)
- [x] **MCRG-02**: Tool runs Monte Carlo simulation sampling from only the recent window (configurable, default ~200 trades)
- [x] **MCRG-03**: Tool compares P(Profit), expected return, Sharpe, and median max drawdown between full-history and recent-window simulations
- [x] **MCRG-04**: Tool classifies regime divergence severity (aligned, mild divergence, significant divergence, regime break)

### Walk-Forward Degradation

- [x] **WFD-01**: Tool runs progressive walk-forward analysis (365d IS / 90d OOS / 90d step) across the full trade history
- [x] **WFD-02**: Tool tracks OOS efficiency (OOS metric / IS metric) for each period as a time series
- [x] **WFD-03**: Tool detects when OOS efficiency breaks below a threshold (e.g., 50%) or turns negative
- [x] **WFD-04**: Tool compares recent OOS periods to historical OOS average to quantify degradation

### Live Alignment Signal

- [x] **LIVE-01**: When reporting log exists, tool compares backtest vs actual direction agreement rate
- [x] **LIVE-02**: When reporting log exists, tool calculates per-contract gap between backtest and actual by strategy
- [x] **LIVE-03**: When reporting log exists, tool identifies strategies where actual significantly underperforms backtest (potential execution decay)
- [x] **LIVE-04**: Tool gracefully skips live alignment when no reporting log exists

### Data Aggregation & Output

- [x] **VERD-01**: Tool produces a structured top-level summary of key numbers from each signal category (no verdict labels, no interpretation -- data only)
- [x] **VERD-02**: Tool produces per-signal key metrics summaries for each of the 5 signal categories (no grades -- raw data for LLM interpretation)
- [x] **VERD-03**: Tool surfaces factual observations as structured data objects (metric, current value, comparison value, delta) when notable thresholds are crossed (no "actionable" framing -- facts only)
- [x] **VERD-04**: Tool produces key numbers summary (recent vs historical Sharpe, WR, PF, MC P(Profit), WFE trend)
- [x] **VERD-05**: Tool includes detailed supporting data for each signal (period breakdowns, rolling metric summaries, MC comparison table, WF period details)

### Tool API

- [x] **API-01**: Tool accepts blockId (required), recentWindow (optional, default auto-calculated), strategy (optional filter)
- [x] **API-02**: Tool auto-calculates default recentWindow as ~20% of total trades or last 200, whichever is larger
- [x] **API-03**: Tool registered in MCP server with Zod schema validation and proper description
- [x] **API-04**: Tool works with CLI --call mode for testing

## Future Requirements

### Per-Strategy Decay Drill-Down
- **STRAT-01**: Run edge decay analysis independently for each strategy within a block
- **STRAT-02**: Identify which specific strategies are decaying vs holding steady
- **STRAT-03**: Rank strategies by decay severity

### UI Integration
- **UI-01**: Edge decay visualization in web dashboard
- **UI-02**: Rolling metrics chart with decay overlay
- **UI-03**: Regime comparison visualization

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automated trading decisions | Analysis tool, not execution engine |
| Real-time monitoring | Batch analysis on stored data, not live feeds |
| Strategy optimization/repair | Detect decay, don't fix it -- that's the user's job |
| Per-strategy independent analysis | Defer to future -- start with portfolio-level |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PSEG-01 | Phase 46 | Complete |
| PSEG-02 | Phase 46 | Complete |
| PSEG-03 | Phase 46 | Complete |
| ROLL-01 | Phase 46 | Complete |
| ROLL-02 | Phase 46 | Complete |
| ROLL-03 | Phase 46 | Complete |
| ROLL-04 | Phase 46 | Complete |
| MCRG-01 | Phase 47 | Complete |
| MCRG-02 | Phase 47 | Complete |
| MCRG-03 | Phase 47 | Complete |
| MCRG-04 | Phase 47 | Complete |
| WFD-01 | Phase 48 | Complete |
| WFD-02 | Phase 48 | Complete |
| WFD-03 | Phase 48 | Complete |
| WFD-04 | Phase 48 | Complete |
| LIVE-01 | Phase 49 | Complete |
| LIVE-02 | Phase 49 | Complete |
| LIVE-03 | Phase 49 | Complete |
| LIVE-04 | Phase 49 | Complete |
| VERD-01 | Phase 50 | Complete |
| VERD-02 | Phase 50 | Complete |
| VERD-03 | Phase 50 | Complete |
| VERD-04 | Phase 50 | Complete |
| VERD-05 | Phase 50 | Complete |
| API-01 | Phase 50 | Complete |
| API-02 | Phase 50 | Complete |
| API-03 | Phase 50 | Complete |
| API-04 | Phase 50 | Complete |

**Coverage:**
- v2.7 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-02-04*
*Last updated: 2026-02-06 after Phase 50 context discussion (VERD-01/02/03 revised: data-not-interpretation)*
