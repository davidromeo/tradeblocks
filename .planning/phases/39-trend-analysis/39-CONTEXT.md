# Phase 39: Trend Analysis - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Analyze slippage trends over time and detect improvement/degradation patterns. Correlate slippage trends with external factors (market volatility, time-of-day). This phase provides analytical insights for the model to interpret — it does NOT provide actionable suggestions (that's the model's job with the data).

</domain>

<decisions>
## Implementation Decisions

### Time Series Granularity
- Granularity is Claude's discretion (daily recommended for AI interpretation, but configurable if beneficial)
- Provide BOTH rolling windows AND fixed calendar periods in the output
- Minimum data requirement: at least 2 periods to compute a trend
- Provide BOTH block-level summary AND per-strategy breakdown

### Trend Detection Method
- Track BOTH slippage magnitude (|actual - backtest|) AND directional bias over time
- Use linear regression to determine trend direction (negative slope = improving, positive = degrading)
- Include statistical confidence: p-value and R² for trend reliability
- Output BOTH raw slope value AND categorical label (improving/stable/degrading)

### External Factor Correlation
- Claude decides which factors to correlate based on available data (VIX, time-of-day, etc.)
- Report correlation strength as BOTH raw coefficient AND human-readable label (strong positive, weak negative, etc.)
- Data only — no actionable suggestions in the tool output
- Skip correlation section entirely if external factor data is unavailable (don't return nulls with explanations)

### Output Structure
- Structure is Claude's discretion — optimize for ease of analysis
- Include parameter to optionally return raw time series data points (for charting)
- Metadata per strategy: Claude decides what's useful for interpretation
- Highlights section: Claude's discretion based on whether findings warrant calling out

### Claude's Discretion
- Time granularity choice (daily/weekly/configurable)
- Output structure and nesting
- Which external factors to analyze
- Per-strategy metadata fields
- Whether to include highlights section

</decisions>

<specifics>
## Specific Ideas

- Linear regression for trend detection — user explicitly requested this over simple comparison
- p-value/R² for statistical confidence — raw stats preferred over translated labels
- Data-only output — model interprets and suggests, tool just provides metrics

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 39-trend-analysis*
*Context gathered: 2026-02-01*
