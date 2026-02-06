# Phase 50: Verdict Synthesis & Tool Registration - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Combine all 5 edge decay signal categories (period metrics, rolling metrics, MC regime comparison, walk-forward degradation, live alignment) into a single `analyze_edge_decay` MCP tool that collects, structures, and surfaces factual data for LLM interpretation. The tool aggregates signal outputs and surfaces notable factual observations — it does NOT produce verdicts, grades, or recommendations.

</domain>

<decisions>
## Implementation Decisions

### Philosophy: Data, Not Interpretation
- TradeBlocks provides insights through hard data and facts
- The LLM consuming the tool output interprets the results
- No verdicts (Healthy / Severe Decay labels removed)
- No component grades (A-F removed)
- No "actionable" framing — observations are factual, not prescriptive
- This applies retroactively: Phase 47's regime divergence classification labels (aligned / mild divergence / significant divergence / regime break) should also be revisited as a separate task

### Requirements Revision
- VERD-01 (was: top-line verdict) → Replaced with structured top-level summary of key numbers. Claude's discretion on exact structure.
- VERD-02 (was: component grades A-F) → Replaced with per-signal key metrics. Claude's discretion on what to surface per category.
- VERD-03 (was: actionable flags) → Replaced with factual observations as structured data objects (not strings). Each observation includes metric, current value, comparison value, delta — pure math.
- VERD-04, VERD-05 stay as-is (key numbers summary and supporting data are already factual)
- API-01 through API-04 stay as-is (tool registration mechanics unchanged)
- REQUIREMENTS.md to be updated with revised wording

### Factual Observations
- Format: structured data objects the LLM can reason about (not string descriptions)
- Example shape: `{metric, current, comparison, delta, ...}` — pure numbers and facts
- Trigger logic: Claude's discretion on what warrants an observation
- Source traceability: Claude's discretion on whether to include signal category reference

### Claude's Discretion
- Call strategy: whether to call lib engines directly or MCP tools (likely direct for efficiency)
- Signal selection: whether all 5 always run or caller can pick (likely always-all with graceful skip)
- Sub-tool parameters: whether to expose MC/WF params or use defaults (likely defaults-only for simplicity)
- Response shape: by signal category vs other grouping (likely by signal category to match engines)
- Rolling metrics handling: summary stats only vs downsampled series (constraint: ~3200 points for large blocks)
- Detail level per signal: full detail vs summaries with reference to standalone tools
- Metadata section inclusion
- Top-level summary structure (key numbers + deltas likely)
- Per-signal summary structure

</decisions>

<specifics>
## Specific Ideas

- "TradeBlocks is about insights, not recommendations. Hard data and facts. For the MCP server we're letting the LLM help interpret the results."
- The 5 standalone signal tools remain available for deep-dives — the unified tool is the overview, standalone tools are for detail.

</specifics>

<deferred>
## Deferred Ideas

- Revisit Phase 47's regime divergence classification labels (aligned / mild / significant / regime break) to align with data-not-interpretation philosophy — separate task outside Phase 50 scope

</deferred>

---

*Phase: 50-verdict-synthesis-tool-registration*
*Context gathered: 2026-02-06*
