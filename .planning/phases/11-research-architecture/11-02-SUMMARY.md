---
phase: 11-research-architecture
plan: 02
subsystem: mcp-server
tags: [mcp, stdio, claude-desktop, node]

# Dependency graph
requires:
  - phase: 11-01
    provides: monorepo structure, MCP package scaffold
provides:
  - Working MCP server with stdio transport
  - list_backtests tool implementation
  - McpServer API pattern for future tools
affects: [phase-12-core-integration, phase-13-analysis]

# Tech tracking
tech-stack:
  added: ["@modelcontextprotocol/sdk", "zod@4"]
  patterns: ["McpServer.registerTool()", "stdio transport", "folder-based blocks"]

key-files:
  created: ["packages/mcp-server/src/index.ts"]
  modified: ["packages/mcp-server/package.json", "eslint.config.mjs"]

key-decisions:
  - "Use McpServer API instead of deprecated Server class"
  - "Use zod@4 for SDK compatibility (3.25 had missing dist files)"
  - "Folder-based block structure for MCP (folder = block with tradelog/dailylog/reportinglog)"
  - "MCP will manage .block.json metadata files with cached stats"

patterns-established:
  - "McpServer.registerTool() pattern for tool registration"
  - "stderr for logging, stdout reserved for JSON-RPC"
  - "Command line arg for backtest directory"

issues-created: []

# Metrics
duration: 48min
completed: 2026-01-14
---

# Phase 11 Plan 02: MCP Server Scaffold Summary

**Minimal MCP server with stdio transport, list_backtests tool, and validated architecture for Claude Desktop/Cowork integration**

## Performance

- **Duration:** 48 min
- **Started:** 2026-01-14T17:18:25Z
- **Completed:** 2026-01-14T18:06:33Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 4

## Accomplishments

- Created MCP server entry point using modern McpServer API
- Implemented `list_backtests` tool that lists CSV files in a directory
- Validated stdio transport works with Claude Desktop
- Documented folder-based block architecture for Phase 12

## Task Commits

1. **Task 1: Create MCP server entry point** - `057b855` (feat)
2. **Task 2: Fix zod resolution** - `5046889` (fix)
3. **Task 2: Migrate to McpServer API** - `7bce3e9` (refactor)

## Files Created/Modified

- `packages/mcp-server/src/index.ts` - MCP server entry point with list_backtests tool
- `packages/mcp-server/package.json` - Updated zod to ^4.0.0 for SDK compatibility
- `eslint.config.mjs` - Added dist/** to ignores
- `pnpm-lock.yaml` - Dependency updates

## Decisions Made

1. **McpServer over Server:** The `Server` class is deprecated. Used `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` with `registerTool()` pattern.

2. **Zod 4 for compatibility:** Zod 3.25.0 had missing dist files in pnpm store. SDK supports `^3.25 || ^4.0`, so upgraded to zod 4.

3. **Folder-based block structure for MCP:**
   ```
   ~/backtests/
     my-portfolio/
       tradelog.csv        # required - trades with strategy column
       dailylog.csv        # optional - daily equity
       reportinglog.csv    # optional - backtest comparison
       .block.json         # MCP-managed metadata + cached stats
   ```

4. **MCP reprocess vs UI recalculate:** MCP "reprocess" will re-parse CSVs + recalculate stats (since MCP has own storage via .block.json, not IndexedDB).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint failing on dist/ files**
- **Found during:** Task 1 commit
- **Issue:** ESLint was linting packages/mcp-server/dist/index.js and failing on shebang
- **Fix:** Added `dist/**` and `packages/*/dist/**` to eslint.config.mjs ignores
- **Committed in:** 057b855

**2. [Rule 3 - Blocking] Zod module resolution error**
- **Found during:** Task 2 server testing
- **Issue:** `ERR_MODULE_NOT_FOUND` for zod/dist/esm/v4/index.js - zod 3.25.0 package had only src/, no dist/
- **Fix:** Upgraded to zod ^4.0.0 which has proper ESM builds
- **Committed in:** 5046889

**3. [Rule 1 - Bug] Deprecated Server API**
- **Found during:** Checkpoint verification
- **Issue:** TypeScript warning that `Server` is deprecated, use `McpServer` instead
- **Fix:** Migrated to McpServer API with registerTool() pattern
- **Committed in:** 7bce3e9

---

**Total deviations:** 3 auto-fixed (1 lint config, 1 dependency, 1 API migration)
**Impact on plan:** All fixes necessary for correct operation. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Architecture Documented for Phase 12

### Block Data Model (from codebase exploration)
- Block = container with trades, daily logs, reporting logs linked by blockId
- Strategies identified by `strategy` field in trade records
- Daily logs improve equity curve accuracy but are optional
- Reporting logs enable actual vs backtest comparison

### MCP Tools Roadmap (Phase 12+)
- `list_blocks` - show all blocks with summary stats
- `analyze_block` - get detailed stats (uses .block.json cache)
- `reprocess_block` - force re-parse CSVs + recalculate
- `compare_strategies` - compare actual vs reporting log

## Next Phase Readiness

Phase 11 complete. Ready for Phase 12: Core Integration Layer
- Monorepo structure established (11-01)
- MCP server scaffold working (11-02)
- Architecture validated with Claude Desktop
- Block folder structure documented
- Next: Add analyze_block tool with lib/ imports

---
*Phase: 11-research-architecture*
*Completed: 2026-01-14*
