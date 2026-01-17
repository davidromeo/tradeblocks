# Phase 12: Core Integration Layer - Context

**Gathered:** 2026-01-14
**Status:** Ready for planning

<vision>
## How This Should Work

When working with Claude (Code or Cowork), the MCP integration provides full programmatic access to TradeBlocks data and analysis. The vision is a dual-mode experience:

1. **Conversational**: Ask natural questions like "which strategy performs best in high VIX environments?" and Claude translates that into the appropriate tool calls
2. **Tool-like**: Explicit commands when precision is needed - "get_stats for block X filtered by date range Y"

The key use case is **backtest optimization** - uploading multiple CSV variants, filtering trades by criteria (dates, market conditions, strategy parameters), running WFA analysis, and having Claude find patterns or correlations. Questions like "Are there market conditions we should filter for?" should be answerable.

Claude should be able to work both **within a single block** (deep analysis of one backtest) and **across multiple blocks** (comparing strategies, finding which performs best under what conditions).

</vision>

<essential>
## What Must Be Nailed

- **Cross-block intelligence** - Claude can query and compare data across multiple blocks, not just one at a time
- **Rich filtering** - Slice trades by any criteria: dates, market conditions (VIX levels etc from the data), strategy parameters
- **Full stats access** - Every metric TradeBlocks calculates is available through MCP tools
- **Analysis & export** - Run WFA, generate reports, export results to files

All four are equally critical - they work together to enable the optimization workflow.

</essential>

<boundaries>
## What's Out of Scope

- **Modifying data** - No creating/updating/deleting blocks through MCP. This is read and analyze only. Block management stays in the UI.
- **External data fetching** - No fetching VIX or market data from external sources. Only analyze what's already in the uploaded CSVs (if trades have VIX data in fields, that's fair game).
- **Full CRUD operations** - No CSV imports through MCP. Users upload through the UI, Claude analyzes what exists.

</boundaries>

<specifics>
## Specific Ideas

- Should feel conversational but also support explicit tool calls for precision
- Backtest optimization is the killer use case: upload variants, filter, compare, find what works
- The block abstraction may need to be flexible - sometimes analyze within one, sometimes compare across many
- Market condition filtering (like VIX environment) from trade data fields is valuable

</specifics>

<notes>
## Additional Context

Phase 11 established:
- Monorepo structure with pnpm workspaces
- MCP server at packages/mcp-server/ with McpServer API
- Folder-based block structure: each folder contains tradelog.csv (required), dailylog.csv (optional), reportinglog.csv (optional)
- `.block.json` stores metadata + cached stats
- `list_backtests` tool already scaffolded

This phase builds on that foundation to expose the full query and analysis capabilities. The MCP server needs to translate Claude's questions into the right data operations against the block structure.

</notes>

---

*Phase: 12-core-integration-layer*
*Context gathered: 2026-01-14*
