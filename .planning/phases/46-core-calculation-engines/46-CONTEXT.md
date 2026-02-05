# Phase 46: Core Calculation Engines - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Build period segmentation and rolling metrics engines that produce factual, numerical outputs for any block's trade history. These are foundational calculations consumed by Phases 47-50. No interpretive labels, no recommendations — data and measurements only.

**Cross-cutting principle (applies to all v2.7 phases):** TradeBlocks provides insights, not recommendations. All outputs are factual observations with raw numbers. No value-laden labels like "Improving" or "Deteriorating." The model and user interpret the data.

</domain>

<decisions>
## Implementation Decisions

### Period segmentation design
- Three granularity levels: yearly, quarterly, and monthly breakdowns
- Partial periods are included but annotated (e.g., "Q1 2024 (partial: 14 days)") so the user sees all data with appropriate context
- Metrics per period: win rate, profit factor, Kelly %, avg monthly return as % of equity, Sharpe ratio, trade count, and net P&L
- Worst consecutive-month losing stretch shows both the all-time worst AND flags any currently active streak (e.g., "current: 3 months, worst: 5 months")

### Trend detection approach
- Present raw numbers only: regression slope, R², p-value, and sample size per metric
- No interpretive labels (no "improving/stable/deteriorating") — direction is implicit in the slope sign
- Compute trend lines for ALL period metrics (win rate, PF, Kelly, Sharpe, avg return, net P&L, trade count)
- R², p-value, and sample size included so the model/user can judge statistical significance

### Rolling metrics behavior
- Rolling window size is a configurable parameter with a smart auto-calculated default based on trade count
- Compute rolling versions of ALL period metrics for consistency: Sharpe, win rate, profit factor, Kelly %, avg return, net P&L
- Quarterly seasonal averages (Q1/Q2/Q3/Q4) computed in this phase for each rolling metric

### Recent vs historical comparison
- "Recent window" supports both trade-count-based and time-based definitions
- Default to trade-count-based with auto-calculated N; time-based available as override
- Multiple structural flags surfaced as threshold markers in the data:
  - Payoff structure inversion (avg loss > avg win)
  - Win rate crossing below 50%
  - Profit factor dropping below 1.0
  - Kelly criterion going negative
- Flags presented as data with threshold markers (e.g., "PF: 0.85 vs 1.3 [below 1.0]") — factual, not narrative

### Claude's Discretion
- Comparison output format (side-by-side with deltas vs ratios)
- Smart default formula for rolling window size
- Edge handling when insufficient data for rolling calculations
- Auto-calculation logic for default recent window trade count

</decisions>

<specifics>
## Specific Ideas

- "TradeBlocks provides insights, not recommendations" — this is a core product philosophy that must carry through all v2.7 phases
- The model (Claude via MCP) will help interpret results, so raw statistical data (R², p-value, sample size) is preferred over pre-digested labels
- Structural flags use threshold markers rather than narrative observations — keeps the data layer factual

</specifics>

<deferred>
## Deferred Ideas

- Verdict/synthesis labels (Phase 50 will need to reconcile the "factual throughout" decision with the original verdict concept)
- Strategy-level filtering for period/rolling metrics — may emerge in later phases

</deferred>

---

*Phase: 46-core-calculation-engines*
*Context gathered: 2026-02-05*
