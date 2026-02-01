# Phase 38: Strategy Matching - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

MCP tool to suggest matches between backtest strategies and actual (reporting log) strategies when names don't align. Helps users identify which strategies in their backtest correspond to which in actual results, with confidence scores. Also detects when strategies are systematically different (unmatchable).

</domain>

<decisions>
## Implementation Decisions

### Matching criteria
- Use BOTH P/L correlation AND trade timing overlap as matching signals
- P/L correlation is primary, trade timing as secondary confirmation
- Normalize P/L per-contract before correlation (handles backtest running more contracts than actual)
- Exact name matches auto-confirm at 100% confidence (skip correlation check)

### Confidence scoring
- Express as numeric score (0-100)
- No minimum threshold — show all possible matches, even weak ones
- Claude's discretion: dynamic threshold for minimum overlapping days, factors influencing score, whether to include reasoning

### Unmatchable detection
- Flag as unmatchable if EITHER:
  - Negative correlation (strategies move opposite)
  - Systematic P/L difference in one direction
- List strategies that exist only in backtest OR only in actual as "unmatched" (separate from unmatchable)
- Claude's discretion: presentation format, detail level of explanations

### Output structure
- Claude's discretion: primary output format (per-strategy view vs matrix vs bi-directional)
- Claude's discretion: whether to support detail levels, whether to accept hint parameters

### Claude's Discretion
- Dynamic threshold approach for minimum overlapping days
- Factors influencing confidence score (correlation strength, sample size, etc.)
- Whether to include reasoning for confidence/unmatchable decisions
- Output structure and detail levels
- Whether to accept strategy name hints as input parameter

</decisions>

<specifics>
## Specific Ideas

- Tool will be called by LLMs, so output format should optimize for programmatic interpretation
- Per-contract normalization mirrors approach used in existing `analyze_discrepancies` tool

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-strategy-matching*
*Context gathered: 2026-02-01*
