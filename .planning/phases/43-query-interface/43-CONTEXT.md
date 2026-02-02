# Phase 43: Query Interface - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

MCP tool (`run_sql`) that accepts SQL strings and returns query results from DuckDB. Claude can execute arbitrary SELECT queries against trades and market data tables, with security sandbox preventing dangerous operations.

</domain>

<decisions>
## Implementation Decisions

### Result Formatting
- Array of objects: each row as `{column: value}` — easy for Claude to read
- Include column metadata with DuckDB types (VARCHAR, DOUBLE, DATE, etc.)
- Truncation communicated via metadata fields: `truncated`, `totalRows`, `returnedRows`
- Accept `limit` parameter with configurable cap (Claude decides default and max)

### Error Responses
- Claude's Discretion: syntax error detail level
- Claude's Discretion: whether to suggest alternatives for unknown tables/columns
- Claude's Discretion: whether to echo original query in error response
- Claude's Discretion: resource limit error messaging style

### Query Limits
- 30-second execution timeout (hard limit)
- Row limits: Claude decides default, with configurable maximum
- Memory limits: user-configurable in MCP server config

### Security
- **Read-only**: Only SELECT statements allowed — INSERT/UPDATE/DELETE blocked
- No query complexity limits — trust timeout to catch runaway queries
- Dangerous operations blocked: COPY, EXPORT, ATTACH
- Claude's Discretion: blocked operation error verbosity
- Claude's Discretion: whether to log blocked queries

### Claude's Discretion
- Default row limit value
- Maximum row limit cap
- Error message detail levels
- Unknown reference suggestions
- Blocked operation error verbosity
- Audit logging for blocked queries

</decisions>

<specifics>
## Specific Ideas

- Results should fit comfortably in Claude's context — the limit system should prevent overwhelming responses
- Metadata fields preferred over warning messages for truncation — structured data is easier to programmatically handle

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 43-query-interface*
*Context gathered: 2026-02-02*
