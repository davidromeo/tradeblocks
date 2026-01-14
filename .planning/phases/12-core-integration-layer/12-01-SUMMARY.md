---
phase: 12-core-integration-layer
plan: 01
subsystem: mcp-server
tags: [mcp, block-loader, portfolio-stats, tools]

# Dependency graph
requires:
  - phase: 11-02
    provides: MCP server scaffold, McpServer API pattern
provides:
  - Block data loading utilities (CSV parsing, metadata caching)
  - 6 Tier 1 core MCP tools
  - Structured markdown output formatting
affects: [phase-12-02-analysis-tools, phase-13]

# Tech tracking
tech-stack:
  added: []
  patterns: ["registerBlockTools()", "filterByStrategy()", "filterByDateRange()"]

key-files:
  created:
    - "packages/mcp-server/src/utils/block-loader.ts"
    - "packages/mcp-server/src/utils/output-formatter.ts"
    - "packages/mcp-server/src/tools/blocks.ts"
  modified:
    - "packages/mcp-server/src/index.ts"

key-decisions:
  - "CSV parsing inline in block-loader (not using TradeProcessor directly due to browser File API dependency)"
  - "Strategy filtering forces trade-based calculations (daily logs represent full portfolio)"
  - "Automatic metadata caching in .block.json for faster list_backtests"
  - "ESM imports require .js extension in TypeScript"

patterns-established:
  - "filterByStrategy() and filterByDateRange() for trade filtering"
  - "formatXXX() functions for structured markdown output"
  - "Tool modules export registerXXXTools(server, baseDir) function"

issues-created: []

# Metrics
duration: ~25min
completed: 2026-01-14
---

# Phase 12 Plan 01: Block Loading and Core Tools Summary

**Block data loading utilities and 6 Tier 1 core MCP tools for block listing, statistics, and comparison**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-01-14
- **Completed:** 2026-01-14
- **Tasks:** 2 (both auto)
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- Created block-loader.ts with CSV parsing and metadata management
- Created output-formatter.ts for structured markdown output
- Implemented 6 core MCP tools in blocks.ts:
  1. `list_backtests` - List all blocks with summary stats
  2. `get_block_info` - Detailed info for specific block
  3. `get_statistics` - Full portfolio stats with filters
  4. `get_strategy_comparison` - Compare strategies within block
  5. `compare_blocks` - Cross-block comparison (max 5)
  6. `get_trades` - Paginated trade list with filters
- Refactored index.ts to use modular tool registration

## Task Commits

1. **Task 1: Create block data loading utilities** - `5083713` (feat)
2. **Task 2: Implement Tier 1 core tools** - `3c65930` (feat)

## Files Created/Modified

### Created
- `packages/mcp-server/src/utils/block-loader.ts` - CSV parsing, block loading, metadata management
- `packages/mcp-server/src/utils/output-formatter.ts` - Markdown formatting for all tool outputs
- `packages/mcp-server/src/tools/blocks.ts` - 6 Tier 1 MCP tools

### Modified
- `packages/mcp-server/src/index.ts` - Simplified to import and register tools from blocks.ts

## Decisions Made

1. **CSV parsing inline vs TradeProcessor:** TradeProcessor uses browser File API which isn't available in Node.js MCP server. Implemented simplified CSV parsing inline in block-loader.ts.

2. **Strategy filtering calculation mode:** When strategy filter is applied, daily logs are NOT used because they represent the FULL portfolio performance. This matches the existing TradeBlocks behavior with `isStrategyFiltered=true`.

3. **Automatic metadata caching:** When get_statistics is called without filters, the result is cached in .block.json for faster list_backtests responses.

4. **ESM import extensions:** TypeScript with Node16 module resolution requires explicit .js extensions for relative imports, even for .ts source files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESM import extensions**
- **Found during:** Task 2 build verification
- **Issue:** TypeScript error `TS2835: Relative import paths need explicit file extensions`
- **Fix:** Added `.js` extension to all relative imports
- **Impact:** None - standard ESM requirement

---

**Total deviations:** 1 auto-fixed (ESM import extension)
**Impact on plan:** Minor - standard TypeScript/ESM behavior

## Tool Capabilities

### list_backtests
- No parameters
- Returns: Block list with name, trade count, date range, strategies, P&L

### get_block_info
- Parameters: `blockId` (required)
- Returns: Trade count, daily log count, date range, strategies list

### get_statistics
- Parameters: `blockId` (required), `strategy`, `startDate`, `endDate` (optional)
- Returns: Full PortfolioStats as markdown table
- Note: Strategy filter forces trade-based calculations

### get_strategy_comparison
- Parameters: `blockId` (required)
- Returns: Comparison table sorted by P&L

### compare_blocks
- Parameters: `blockIds` (array, max 5)
- Returns: Side-by-side stats comparison

### get_trades
- Parameters: `blockId` (required), `strategy`, `startDate`, `endDate`, `page`, `pageSize` (optional)
- Returns: Paginated trade table (default 50, max 100 per page)

## Verification Checklist

- [x] `pnpm --filter tradeblocks-mcp build` succeeds
- [x] `pnpm run lint` passes
- [x] No console.log in server code (only console.error)
- [x] All tools return structured markdown
- [x] Error cases return `isError: true`

## Next Phase Readiness

Ready for Phase 12 Plan 02: Analysis Tools
- Block loading infrastructure complete
- Output formatting patterns established
- Tool registration pattern documented
- Next: Add Tier 2 analysis tools (WFA, Monte Carlo, correlation, etc.)

---
*Phase: 12-core-integration-layer*
*Plan: 01*
*Completed: 2026-01-14*
