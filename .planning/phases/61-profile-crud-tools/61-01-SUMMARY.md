---
phase: 61-profile-crud-tools
plan: 01
subsystem: api
tags: [mcp, strategy-profiles, crud, zod, duckdb, integration-tests]

# Dependency graph
requires:
  - phase: 60-profile-storage
    provides: CRUD functions (upsertProfile, getProfile, listProfiles, deleteProfile) and StrategyProfile types
provides:
  - Four MCP tools: profile_strategy, get_strategy_profile, list_profiles, delete_profile
  - Exported handler functions and Zod schemas for testability
  - 9 integration tests covering all CRUD operations via tool handlers
affects: [62-profile-analysis-tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Profile tool handlers exported separately from registration for direct testing"
    - "Optional blockId in list_profiles: withSyncedBlock when present, direct query when absent"
    - "Write tools use upgradeToReadWrite/downgradeToReadOnly inside withSyncedBlock handler (double upgrade pattern)"

key-files:
  created:
    - packages/mcp-server/src/tools/profiles.ts
    - packages/mcp-server/tests/integration/profile-tools.test.ts
  modified:
    - packages/mcp-server/src/index.ts
    - packages/mcp-server/src/cli-handler.ts
    - packages/mcp-server/src/test-exports.ts

key-decisions:
  - "Export handler functions (handleProfileStrategy, etc.) separately from registerProfileTools for direct integration testing without MCP transport"
  - "list_profiles conditional sync: withSyncedBlock when blockId present, direct DB query when omitted (no block to validate)"

patterns-established:
  - "Profile tool test pattern: test handler functions directly with tempDir, same getConnection/closeConnection lifecycle as storage tests"

requirements-completed: [PROF-01, PROF-02, PROF-03]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 61 Plan 01: Profile CRUD Tools Summary

**Four MCP tools (profile_strategy, get_strategy_profile, list_profiles, delete_profile) exposing Phase 60 storage layer to Claude, with 9 passing integration tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T13:37:27Z
- **Completed:** 2026-03-05T13:42:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created profile_strategy tool with full Zod schema covering all StrategyProfile fields, upsert semantics via withSyncedBlock + upgradeToReadWrite
- Created get_strategy_profile, list_profiles, and delete_profile tools following existing MCP patterns
- Wired registerProfileTools in both index.ts (MCP server) and cli-handler.ts (CLI mode)
- 9 integration tests covering create, upsert, get, get-not-found, list-filtered, list-all, delete, delete-idempotent, and Zod default validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create profile tools and wire registration** - `2873167` (feat)
2. **Task 2: Integration tests for profile MCP tools** - `a0b281a` (test)

## Files Created/Modified

- `packages/mcp-server/src/tools/profiles.ts` - registerProfileTools with 4 tool registrations, exported handlers and Zod schemas
- `packages/mcp-server/src/index.ts` - Added registerProfileTools import and call
- `packages/mcp-server/src/cli-handler.ts` - Added registerProfileTools import and call
- `packages/mcp-server/src/test-exports.ts` - Added exports for handler functions and Zod schemas
- `packages/mcp-server/tests/integration/profile-tools.test.ts` - 9 integration tests

## Decisions Made

1. **Export handler functions for direct testing** - Rather than testing through MCP transport or ToolCapture, exported handleProfileStrategy, handleGetStrategyProfile, handleListProfiles, handleDeleteProfile as standalone async functions. This tests the full handler logic (CRUD + output formatting) without MCP plumbing overhead.

2. **Conditional sync in list_profiles** - When blockId is provided, withSyncedBlock validates the block exists and syncs it. When omitted, the tool queries directly without sync since there is no specific block to validate.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four profile CRUD tools are registered and functional
- Handlers are exported for reuse in future analysis tools that may compose on top
- Ready for Phase 62 analysis tools (analyze_structure_fit, validate_entry_filters, portfolio_structure_map)

## Self-Check: PASSED

- FOUND: packages/mcp-server/src/tools/profiles.ts
- FOUND: packages/mcp-server/tests/integration/profile-tools.test.ts
- FOUND: .planning/phases/61-profile-crud-tools/61-01-SUMMARY.md
- FOUND: commit 2873167 (feat: task 1)
- FOUND: commit a0b281a (test: task 2)

---
*Phase: 61-profile-crud-tools*
*Completed: 2026-03-05*
