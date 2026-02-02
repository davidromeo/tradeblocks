# Phase 44: Schema Discovery - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Tools for Claude to discover what tables and columns are available for SQL queries. Claude needs to understand the database structure before writing queries with run_sql. Creating new schema features or data transformations are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Discovery mechanism
- Use DuckDB introspection (DESCRIBE/SHOW commands) internally — always accurate, no maintenance
- Sync before introspection using withFullSync — ensures tables exist and are populated
- Claude decides: tool structure (single vs multiple tools)

### Output format
- Organize tables by schema (trades.*, market.*) — group related tables together
- Include row counts for context — helps Claude understand data volume
- Include block_id breakdown for trades table — shows which blocks exist with row counts
- Claude decides: what metadata per column (type only vs description vs samples)

### Example queries
- Include examples in tool output — contextual and always available
- Cover both basic SQL patterns AND trading-specific hypothesis patterns
- Include JOIN examples between trades and market data — critical for hypothesis testing
- Claude decides: number of examples per table (balance usefulness vs output size)

### Schema descriptions
- Hardcoded descriptions in the tool — curated, accurate, manageable for stable schema
- Claude decides: business meaning vs technical format vs both
- Claude decides: whether to include data source/provenance for market tables
- Claude decides: whether to highlight key hypothesis columns

</decisions>

<specifics>
## Specific Ideas

- User wants to see which blocks exist and their row counts when discovering schema
- JOINs between trades and market data are important for hypothesis testing — examples should cover this
- Trading-specific patterns matter: win rate, P&L by day/strategy, drawdown, regime analysis

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 44-schema-discovery*
*Context gathered: 2026-02-02*
