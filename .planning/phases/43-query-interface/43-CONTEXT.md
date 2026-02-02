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
- Accept optional `limit` parameter (default: 100, max: 1000)

### Error Responses
- Pass through DuckDB syntax errors verbatim — they're well-formatted with line/column info
- Suggest alternatives for unknown tables/columns — enables self-correction without extra tool calls
- Do NOT echo original query in error response — Claude already has it
- Resource limit errors: clear message + suggestion ("Query exceeded 30s timeout. Consider adding LIMIT or filtering by block_id.")

### Query Limits
- 30-second execution timeout (hard limit)
- Default row limit: 100 rows
- Maximum row limit: 1000 rows (cap for `limit` parameter)
- Memory limits: user-configurable in MCP server config (already from Phase 41)

### Security
- **Read-only**: Only SELECT statements allowed — INSERT/UPDATE/DELETE blocked
- No query complexity limits — trust timeout to catch runaway queries
- Dangerous operations blocked: COPY, EXPORT, ATTACH, and filesystem functions
- Blocked operation errors: helpful message explaining what's blocked and the alternative
- No audit logging for blocked queries — keep logs clean

### Claude's Discretion
- Exact wording of error messages
- Implementation details for query validation

</decisions>

<specifics>
## Specific Ideas

- Results should fit comfortably in Claude's context — 100 default × ~15 columns is reasonable
- Most hypothesis queries use aggregates (GROUP BY), not raw rows — limits rarely hit in practice
- Metadata fields preferred over warning messages for truncation — structured data is easier to handle programmatically

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

<research_focus>
## Research Focus

Before planning, investigate:

1. **DuckDB timeout mechanism** — How does `@duckdb/node-api` handle query cancellation? Native timeout or manual implementation needed?

2. **Existing MCP tool patterns** — Review `get_statistics`, `get_trades`, error handling in existing tools for consistency

</research_focus>

---

*Phase: 43-query-interface*
*Context gathered: 2026-02-02*
