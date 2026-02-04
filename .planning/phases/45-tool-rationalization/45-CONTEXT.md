# Phase 45: Tool Rationalization - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Analyze all MCP tools and remove those that run_sql can fully replace. This phase produces an analysis document and executes tool removal. Computational tools that use TradeBlocks libraries stay; pure query/filter tools are candidates for removal.

</domain>

<decisions>
## Implementation Decisions

### Deprecation criteria
- Tools are candidates for removal ONLY if run_sql can do 100% of what they do
- Query-only tools are candidates; computational tools are not
- **Key principle:** SQL is for exploration and filtering; TradeBlocks libraries are for computation
- Reuse TradeBlocks libraries for anything functional — SQL handles the data access layer

### Tools explicitly staying
- Monte Carlo simulations
- Walk-forward analysis
- Tail risk analysis (though SQL can amplify it)
- Correlations
- Any tool that runs library computation, not just queries

### Migration timeline
- Remove deprecated tools in this phase (v2.6), not later
- No soft deprecation period — this is a beta MCP server
- SQL availability marks progress toward 1.0 release

### Communication
- Document changes in CHANGELOG.md
- No runtime deprecation warnings — just remove

### Documentation approach
- Analysis document lives in phase directory (.planning/phases/45-tool-rationalization/)
- Planning documents are not released externally
- describe_database keeps general examples only, doesn't reference old tools

### Block filtering
- Hybrid approach: functional tools keep blockId parameter
- SQL handles cross-block queries and conditional filtering
- Tools that compute on a block keep their block context

### Claude's Discretion
- Per-tool decision on whether SQL generator vs keeping functionality makes sense
- Level of detail in analysis document (rationale for each decision)
- Whether convenience justifies keeping a tool that SQL could replace
- Which tool descriptions (if any) need updating

</decisions>

<specifics>
## Specific Ideas

- "SQL will mark the 1.0 release once it's solid"
- "Tradeblocks libraries should be used for functional use cases"
- "SQL is mainly for exploration and filtering, also useful for backtest conception and generation"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-tool-rationalization*
*Context gathered: 2026-02-04*
