# Phase 37: Discrepancy Analysis - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Classify slippage sources, identify systematic patterns, and correlate slippage with market conditions. This phase adds analytical capabilities on top of the trade-level comparison from Phase 36. It does NOT add new data sources — it works with existing Trade (backtest) and ReportingTrade (actual) data.

</domain>

<decisions>
## Implementation Decisions

### Slippage Categories
- 5 categories based on available data:
  1. **Entry price slippage** — difference in openingPrice × contracts
  2. **Exit price slippage** — difference in closingPrice × contracts
  3. **Size slippage** — different numContracts between backtest and actual
  4. **Exit timing slippage** — different reasonForClose or close timing
  5. **Unexplained residual** — remaining P/L difference after accounting for above
- Cannot compute fee slippage (no fee data in ReportingTrade)
- Cannot compute execution quality (no separate fill price data)

### Pattern Detection
- Detect patterns that appear consistently, not random noise
- Pattern types to detect (based on available data):
  - **Direction bias** — strategy consistently slips positive or negative
  - **Category concentration** — majority of slippage in one category
  - **Time-of-day patterns** — using timeOpened from trades
  - **VIX-correlated patterns** — using openingVix/closingVix when available
- Present as insights, not judgments — surface patterns for user interpretation
- Do not use "risk flags" or severity labels that imply decisions

### Market Correlation
- Correlate slippage with ALL available numeric fields:
  - openingVix, closingVix
  - gap, movement
  - timeOpened (parsed to hour)
  - numContracts (size effect)
- Compute at both levels:
  - Portfolio-wide summary
  - Per-strategy breakdown
- Let model decide presentation format based on data (coefficients, buckets, or both)

### Claude's Discretion
- Attribution method when multiple factors present (sequential vs pro-rata)
- Granularity of output (per-trade vs aggregate vs both)
- Tool design (one tool vs multiple specialized tools)
- Default output structure (summary-first vs data-first vs sections)
- Filtering parameters (strategy, date range, category)
- Statistical thresholds for pattern significance

</decisions>

<specifics>
## Specific Ideas

- "We cannot make decisions but we can provide insights" — tools should surface patterns and data, not assign risk levels or make recommendations
- Leverage the existing compare_backtest_to_actual tool's data structures (DetailedComparison interface) as input
- Consider that the model has limited context — tool output should be self-explanatory

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-discrepancy-analysis*
*Context gathered: 2026-01-31*
