# Phase 35: Reporting Log Ingestion - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Model can load and parse reporting logs (strategylog.csv) for a block via MCP. This phase establishes the foundation for v2.5 — subsequent phases build comparison, analysis, and scoring on top of this ingestion capability.

</domain>

<decisions>
## Implementation Decisions

### Response structure
- **Full detail stats**: Per-strategy trade counts, win rates, total P/L, avg P/L, contract counts
- **list_blocks enhancement**: Add `hasReportingLog` flag + basic reportinglog stats for each block
- **Load + summary pattern**: No separate "load" tool needed — reportinglog is auto-parsed on first access, stats cached in block.json

### Error handling
- **Silent absence**: If strategylog.csv missing, `hasReportingLog: false`, no error. Tools that need it return "no reporting data available"
- **Follow existing pattern**: Use `ReportingTradeProcessor` as-is — tracks invalid rows, returns `invalidTrades` count. AI decides how to handle based on results.

### Data persistence
- **Cache stats in block.json**: Per-strategy breakdown (tradeCount, winRate, totalPL, avgPL per strategy)
- **Trades parsed from CSV**: Don't cache full trade array — re-parse with mtime-based invalidation
- **Lazy refresh on staleness**: Mark stale, reparse on next tool access that needs it
- **Stale display**: list_blocks returns cached stats with `stale: true` flag if CSV modified

### Parsing behavior
- **Reuse ReportingTradeProcessor**: Existing processor in `packages/lib` handles column aliases, validation, stats
- **Strategy name normalization**: Trim whitespace, normalize case for matching, preserve original for display
- **Extra columns**: Ignore silently — parse known columns, discard unknown

### Claude's Discretion
- Exact cache structure within block.json
- How to surface invalidTrades count in tool responses
- Whether to include parsing warnings in response

</decisions>

<specifics>
## Specific Ideas

- "Auto-parse on first access" — don't require explicit load call, parse when any tool needs the data
- "list_blocks should show hasReportingLog" — AI needs to know upfront which blocks have reporting data
- "Enhance the cache" — block.json should store per-strategy stats, not just basic counts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-reporting-log-ingestion*
*Context gathered: 2026-01-31*
