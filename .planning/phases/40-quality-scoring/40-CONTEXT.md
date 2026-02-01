# Phase 40: Quality Scoring - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Model can assess backtest quality through component scores and underlying metrics. This synthesizes data from prior phases (discrepancy analysis, strategy matching, trend analysis) into a structured quality assessment. The tool provides data and metrics — interpretation is left to the user/AI.

</domain>

<decisions>
## Implementation Decisions

### Scoring Philosophy
- **No combined "overall" score** — avoid implying one right interpretation
- Provide **separate component scores** for accuracy, consistency, coverage
- User/AI weighs factors themselves based on their priorities
- Tool is descriptive, not prescriptive — insights without opinions

### Component Scores
- Three components: **accuracy**, **consistency**, **coverage**
- **Scale: 0-1 decimal** (not 0-100) — cleaner, less "grade-like"
- **Numbers only** — no interpretive labels (good/fair/poor)
- Include **underlying metrics** with each score for transparency:
  - Accuracy: mean slippage, median slippage, slippage std dev
  - Consistency: trend slope, R-squared, period count
  - Coverage: match rate, unmatched count, matched count

### Granularity
- **Block-level scores** — overall summary
- **Per-strategy breakdown** — see which strategies have issues
- **Time-based breakdown** — see quality over different periods
- **User-specified granularity** for time breakdown (daily/weekly/monthly parameter)

### Insufficient Data Handling
- **Return scores with warning** when data is limited
- Include metadata: `confidence` level or `sampleSize` field
- Don't error out — provide what's calculable with appropriate caveats

### Claude's Discretion
- How to calculate each 0-1 score from underlying metrics
- Whether to flag strategy outliers (suggested: sort by score, implicit highlighting)
- Exact thresholds for confidence levels
- How to aggregate time-period scores

</decisions>

<specifics>
## Specific Ideas

- "TradeBlocks is all about insights and not trying to poison the well with opinions"
- The AI model using this tool should draw conclusions and form observations — the tool just provides clean data
- Consistency with prior phases: use same trade matching, same granularity options as Phase 39

</specifics>

<deferred>
## Deferred Ideas

- "Improvement suggestions" — dropped from scope. The AI interprets the data and can suggest what to investigate based on the metrics. Tool stays neutral.

</deferred>

---

*Phase: 40-quality-scoring*
*Context gathered: 2026-02-01*
