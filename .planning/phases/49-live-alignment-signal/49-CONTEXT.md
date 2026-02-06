# Phase 49: Live Alignment Signal - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Derive higher-level alignment signals from backtest vs actual comparison when reporting log exists. This feeds Phase 50's verdict synthesis. The raw comparison infrastructure already exists in `compare_backtest_to_actual` — this module computes derived metrics on top.

</domain>

<decisions>
## Implementation Decisions

### Derived Metrics (Claude's Discretion)
Claude will select appropriate derived metrics based on:
- What Phase 50 needs to synthesize a verdict
- What the existing `compare_backtest_to_actual` already provides
- Patterns established in Phase 46-48 calculation engines

Likely candidates (to be validated during research):
- Direction agreement rate (% days where backtest/actual agree on win/loss)
- Per-strategy execution efficiency (actual P&L as % of backtest P&L)
- Trend analysis (is alignment quality improving or degrading over time)

### No Reporting Log Handling
When a block has no reporting log (no actual trades to compare):
- Return explicit skip object: `{ available: false, reason: 'no reporting log' }`
- Phase 50 can include this information in the verdict narrative
- Do NOT fail or throw — graceful degradation

### Architecture (Claude's Discretion)
Claude will determine whether to:
- Reuse existing `compare_backtest_to_actual` matching/scaling logic from lib layer
- Create independent calculation engine in `packages/lib/calculations/`
- Or a hybrid approach

Decision should be based on:
- Consistency with Phase 46-48 engine patterns
- Code reuse vs coupling tradeoffs
- What produces the cleanest API for Phase 50 consumption

### Output Structure
- Data for LLM consumption, not hard recommendations
- Raw metrics and derived signals without predetermined "good/bad" thresholds
- Phase 50 (verdict synthesis) interprets the signals, not this module

</decisions>

<specifics>
## Specific Ideas

- The existing `compare_backtest_to_actual` MCP tool is comprehensive (slippage, z-scores, outlier severity, per-strategy grouping, field-by-field diffs)
- This module adds a layer of derived metrics specifically designed for Phase 50 verdict synthesis
- Pattern should match other edge decay tools: lib calculation engine + MCP tool registration

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 49-live-alignment-signal*
*Context gathered: 2026-02-05*
