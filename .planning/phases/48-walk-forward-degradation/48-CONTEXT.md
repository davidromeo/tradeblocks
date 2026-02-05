# Phase 48: Walk-Forward Degradation - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Track whether out-of-sample performance is degrading over time relative to in-sample performance. Produces OOS efficiency time series across sliding walk-forward windows, trend detection, and recent-vs-historical comparison. Exposed as MCP tool consistent with existing edge decay tools.

**Core principle:** TradeBlocks provides insight, not hard recommendations. The tool surfaces raw data with sensible defaults. Claude (or other LLMs) interprets the data and can re-run with different parameters to slice things different ways.

</domain>

<decisions>
## Implementation Decisions

### WFA Parameters
- All parameters configurable with sensible defaults (IS=365d, OOS=90d, step=90d)
- Claude can re-run with different window sizes to test hypotheses or zoom into specific periods
- Optimization metric configurable, default to Sharpe. Also computes win rate and profit factor
- Strategy filtering follows same pattern as other edge decay tools (optional, case-insensitive)

### WFA Approach
- Claude's Discretion: Decide whether to build lighter-weight progressive walk-forward (just compare IS vs OOS metrics across sliding windows) or reuse existing WFA infrastructure, based on code review during research. The key requirement is measuring IS vs OOS performance over time, not parameter optimization.

### Efficiency Tracking
- OOS efficiency = OOS metric / IS metric, reported as raw ratio (no classification labels)
- Track three metrics per period: Sharpe, win rate, profit factor
- Claude's Discretion: Whether the 50% breakdown threshold is configurable or fixed

### Degradation Reporting
- Return full OOS efficiency time series + linear regression trend direction
- Include recent vs historical OOS average comparison
- Claude's Discretion: Whether "recent" means last N WF periods or maps to recentWindowSize concept
- Claude's Discretion: Level of detail per period (just ratios vs full IS/OOS values + ratios)

### Edge Cases
- Insufficient history for full IS+OOS cycle: return partial results with warning (not an error)
- Claude's Discretion: Minimum trade count per period (skip or flag low-count periods)
- Claude's Discretion: Division-by-near-zero handling for efficiency ratios

</decisions>

<specifics>
## Specific Ideas

- "TradeBlocks is for insight not making hard recommendations. LLMs can interpret the data and/or slice things different ways" — this is the guiding principle for all edge decay tools
- Defaults should be good for regime detection, but configurability lets Claude explore different angles
- Consistency with existing edge decay tools (analyze_period_metrics, analyze_rolling_metrics, analyze_regime_comparison) in interface patterns

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 48-walk-forward-degradation*
*Context gathered: 2026-02-05*
