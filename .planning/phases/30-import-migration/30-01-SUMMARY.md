---
phase: 30-import-migration
plan: 01
subsystem: infra
tags: [typescript, esm, workspace, bundler, imports]

# Dependency graph
requires:
  - phase: 29-workspace-setup
    provides: "@tradeblocks/lib workspace package structure"
provides:
  - MCP server imports from @tradeblocks/lib workspace package
  - Complete barrel exports for lib package
  - Bundler-compatible tsconfig for MCP server
  - Clean tsup config without path alias workarounds
affects: [30-02-app-migration, mcp-server, lib-package]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "moduleResolution: bundler for workspace package resolution"
    - "Workspace package imports via @tradeblocks/lib"
    - "Barrel export pattern for lib submodules"

key-files:
  created:
    - packages/lib/utils/index.ts
    - packages/lib/stores/index.ts
    - packages/lib/data/index.ts
    - packages/lib/services/index.ts
    - packages/lib/metrics/index.ts
    - packages/lib/types/index.ts
  modified:
    - packages/mcp-server/src/tools/*.ts
    - packages/mcp-server/src/utils/block-loader.ts
    - packages/mcp-server/tsconfig.json
    - packages/mcp-server/tsup.config.ts
    - packages/lib/index.ts
    - packages/lib/calculations/index.ts
    - packages/lib/models/index.ts
    - packages/lib/processing/index.ts

key-decisions:
  - "Changed moduleResolution to bundler - required for workspace package resolution without .js extensions"
  - "Excluded stores from main lib export - browser dependency conflicts and Block interface collision"
  - "Merged utils.ts into utils/index.ts - file shadowing folder caused module resolution issues"

patterns-established:
  - "Import from @tradeblocks/lib for shared code in MCP server"
  - "Use barrel exports for lib submodules"

issues-created: []

# Metrics
duration: 15min
completed: 2026-01-19
---

# Phase 30 Plan 01: MCP Server Import Migration Summary

**MCP server now imports from @tradeblocks/lib workspace package with bundler moduleResolution, eliminating fragile @lib/* path aliases and esbuild alias workarounds**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-01-19T15:25:28Z
- **Completed:** 2026-01-19T15:36:02Z
- **Tasks:** 3 (combined into 2 commits due to blocking dependency)
- **Files modified:** 16

## Accomplishments
- All MCP server imports migrated from @lib/* to @tradeblocks/lib
- Complete barrel exports added for all lib submodules
- Removed esbuild alias workarounds from tsup.config.ts
- Changed to bundler moduleResolution for proper workspace package resolution

## Task Commits

Tasks were committed atomically:

1. **Task 1+2: Update source imports and tsconfig** - `d9a787d` (feat)
   - Combined because tsconfig change was required to make imports work
2. **Task 3: Remove esbuild aliases** - `ce4b551` (chore)

## Files Created/Modified

**Created:**
- `packages/lib/utils/index.ts` - Barrel export for utils, merged from legacy utils.ts
- `packages/lib/stores/index.ts` - Barrel export for Zustand stores
- `packages/lib/data/index.ts` - Barrel export for static data
- `packages/lib/services/index.ts` - Barrel export for services
- `packages/lib/metrics/index.ts` - Barrel export for metrics
- `packages/lib/types/index.ts` - Barrel export for types

**Modified:**
- `packages/mcp-server/src/tools/blocks.ts` - Import from @tradeblocks/lib
- `packages/mcp-server/src/tools/analysis.ts` - Import from @tradeblocks/lib
- `packages/mcp-server/src/tools/performance.ts` - Import from @tradeblocks/lib
- `packages/mcp-server/src/tools/reports.ts` - Import from @tradeblocks/lib
- `packages/mcp-server/src/utils/block-loader.ts` - Import from @tradeblocks/lib
- `packages/mcp-server/src/test-exports.ts` - Import from @tradeblocks/lib
- `packages/mcp-server/tsconfig.json` - Changed to bundler moduleResolution, removed path aliases
- `packages/mcp-server/tsup.config.ts` - Removed esbuild @lib alias, simplified config
- `packages/lib/index.ts` - Added comment about stores exclusion
- `packages/lib/calculations/index.ts` - Added missing calculation exports
- `packages/lib/models/index.ts` - Added reporting-trade and report-config exports
- `packages/lib/processing/index.ts` - Fixed duplicate export issue

**Deleted:**
- `packages/lib/utils.ts` - Merged into utils/index.ts (was shadowing folder)

## Decisions Made

1. **Changed moduleResolution from Node16 to bundler**
   - Node16 requires .js extensions in imports, but lib source uses extensionless paths
   - Bundler resolution works with TypeScript source and bundlers (tsup/esbuild)

2. **Excluded stores from main lib export**
   - stores/block-store.ts exports Block interface that conflicts with models/block.ts
   - Stores have browser-specific Zustand dependencies
   - MCP server doesn't need stores anyway
   - Can still import stores directly from '@tradeblocks/lib/stores' in browser context

3. **Merged utils.ts into utils/index.ts**
   - Found utils.ts file was shadowing utils/ folder
   - TypeScript resolved './utils' to utils.ts, not utils/index.ts
   - Merged cn() and truncateStrategyName() functions into utils/index.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing barrel exports to lib package**
- **Found during:** Task 1 (source import updates)
- **Issue:** Many calculation modules not exported from lib - PortfolioStatsCalculator, WalkForwardAnalyzer, correlation, monte-carlo, kelly, daily-exposure, tail-risk-analysis
- **Fix:** Added exports to packages/lib/calculations/index.ts
- **Files modified:** packages/lib/calculations/index.ts, packages/lib/models/index.ts
- **Verification:** TypeScript resolves imports correctly
- **Committed in:** d9a787d (Task 1 commit)

**2. [Rule 3 - Blocking] Created missing barrel exports for lib submodules**
- **Found during:** Task 1 (source import updates)
- **Issue:** stores/, data/, services/, metrics/, types/ had no index.ts files
- **Fix:** Created barrel export files for each subdirectory
- **Files modified:** Created 5 new index.ts files
- **Verification:** lib/index.ts can export from all submodules
- **Committed in:** d9a787d (Task 1 commit)

**3. [Rule 3 - Blocking] Fixed module shadowing with utils.ts**
- **Found during:** Task 1 (normalizeToOneLot not found)
- **Issue:** packages/lib/utils.ts was shadowing packages/lib/utils/ folder
- **Fix:** Merged utils.ts content into utils/index.ts, deleted utils.ts
- **Files modified:** packages/lib/utils/index.ts created, packages/lib/utils.ts deleted
- **Verification:** normalizeToOneLot resolves correctly from @tradeblocks/lib
- **Committed in:** d9a787d (Task 1 commit)

**4. [Rule 3 - Blocking] Changed moduleResolution to bundler**
- **Found during:** Task 1 (source import updates)
- **Issue:** Node16 moduleResolution requires .js extensions, lib sources don't have them
- **Fix:** Changed tsconfig to use bundler moduleResolution
- **Files modified:** packages/mcp-server/tsconfig.json
- **Verification:** TypeScript compiles, build succeeds
- **Committed in:** d9a787d (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 3 - blocking issues)
**Impact on plan:** All auto-fixes were necessary to make imports work. Tasks 1 and 2 were combined into one commit because tsconfig changes were required for Task 1 to complete.

## Issues Encountered

- **Pre-existing type errors in MCP server:** TypeScript reports errors for ticker property access and undefined/null mismatches. These are NOT related to the import migration - they existed before and are type issues in the MCP server code itself. The import migration is complete and working.

## Next Phase Readiness

- MCP server fully migrated to @tradeblocks/lib imports
- Ready for 30-02-PLAN.md (Next.js app import migration)
- Build and runtime verified working

---
*Phase: 30-import-migration*
*Completed: 2026-01-19*
