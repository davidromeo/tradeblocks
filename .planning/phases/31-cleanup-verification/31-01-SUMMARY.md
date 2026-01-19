---
# Plan metadata
phase: 31
plan: 01
subsystem: imports
tags: [typescript, monorepo, imports, path-aliases, jest]

# Dependency graph
requires:
  - 30: Next.js app import migration to @tradeblocks/lib
provides:
  - Unified import system across app, tests, and lib
  - Removed legacy @/lib/* path alias
  - Complete migration to @tradeblocks/lib
affects:
  - 31-02: May need cleanup if any imports were missed

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Jest moduleNameMapper for monorepo imports
    - Selective re-exports to avoid naming conflicts

# File tracking
key-files:
  created: []
  modified:
    - tsconfig.json
    - jest.config.js
    - app/(platform)/blocks/page.tsx
    - components/block-dialog.tsx
    - packages/lib/processing/index.ts
    - packages/lib/processing/data-loader.ts
    - 62 test files in tests/

# Decisions
decisions:
  - decision: Renamed ProcessingResult to DataLoadingResult in data-loader.ts
    reason: Conflict with ProcessingResult from models/block.ts
    date: 2026-01-19
  - decision: Export capital-calculator functions selectively
    reason: calculateInitialCapital conflicts with utils/equity-curve.ts
    date: 2026-01-19

# Metrics
duration: "13m"
completed: 2026-01-19
---

# Phase 31 Plan 01: Import Migration Completion Summary

Completed migration of remaining imports from `@/lib/*` to `@tradeblocks/lib`, unified the import system, and removed the legacy path alias from tsconfig.json.

## Objective

Eliminate all `@/lib/*` imports in app, components, and tests directories to complete the monorepo import migration started in Phase 30.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Migrate 5 dynamic imports in app/components | de919b2 | page.tsx, block-dialog.tsx |
| 2 | Migrate ~62 test imports, update Jest config | 9801dbe | jest.config.js, 62 test files |
| 3 | Remove @/lib/* alias from tsconfig.json | ec0a5e8 | tsconfig.json, processing/index.ts, data-loader.ts |

## Key Changes

### Task 1: Dynamic Imports in App/Components
- Updated 2 dynamic imports in `app/(platform)/blocks/page.tsx` from `@/lib/stores/performance-store` to `@tradeblocks/lib/stores`
- Updated 3 dynamic imports in `components/block-dialog.tsx` from `@/lib/db` to `@tradeblocks/lib`

### Task 2: Test Imports
- Added `moduleNameMapper` entries to `jest.config.js`:
  - `^@tradeblocks/lib/stores$` -> `<rootDir>/packages/lib/stores/index.ts`
  - `^@tradeblocks/lib$` -> `<rootDir>/packages/lib/index.ts`
- Migrated 62 test files across `tests/unit/`, `tests/lib/`, `tests/integration/`, `tests/data/`
- Updated mocks in `static-datasets-store.test.ts` and `walk-forward-store.test.ts`

### Task 3: Remove Legacy Path Alias
- Removed `"@/lib/*": ["./packages/lib/*"]` from `tsconfig.json` paths
- Added missing exports to `packages/lib/processing/index.ts`:
  - `DataLoader` and related types from `data-loader.ts`
  - `calculateInitialCapitalFromDailyLog`, `calculateInitialCapitalFromTrades` from `capital-calculator.ts`
- Fixed naming conflicts:
  - Renamed `ProcessingResult<T>` to `DataLoadingResult<T>` in `data-loader.ts` (conflicts with `ProcessingResult` in `models/block.ts`)
  - Used type import for `ProcessingError` to avoid duplicate exports

## Verification

- `npm run build` passes successfully
- TypeScript compilation passes with no `@/lib/*` references
- `grep -r "@/lib" tests/` returns no results
- 977 tests run (949 passing, 28 failing - pre-existing issues unrelated to migration)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing exports from @tradeblocks/lib**
- **Found during:** Task 3
- **Issue:** `DataLoader`, `calculateInitialCapital*` not exported from package index
- **Fix:** Added exports to `packages/lib/processing/index.ts`
- **Files modified:** `packages/lib/processing/index.ts`
- **Commit:** ec0a5e8

**2. [Rule 1 - Bug] Naming conflicts in exports**
- **Found during:** Task 3
- **Issue:** `ProcessingResult` and `ProcessingError` defined in multiple modules
- **Fix:** Renamed `ProcessingResult<T>` to `DataLoadingResult<T>` in data-loader.ts, used type import for `ProcessingError`
- **Files modified:** `packages/lib/processing/data-loader.ts`
- **Commit:** ec0a5e8

**3. [Rule 2 - Missing Critical] Test mocks using wrong paths**
- **Found during:** Task 2/3
- **Issue:** Tests using `@/lib/*` paths in `jest.mock()` calls
- **Fix:** Updated mocks to use relative paths `../../packages/lib/*`
- **Files modified:** `walk-forward-store.test.ts`, `static-datasets-store.test.ts`
- **Commit:** ec0a5e8

## Import System Summary

After this plan, the import system is:

| Scope | Import Path | Resolves To |
|-------|-------------|-------------|
| App/Components | `@tradeblocks/lib` | `packages/lib/index.ts` |
| App/Components | `@tradeblocks/lib/stores` | `packages/lib/stores/index.ts` |
| App/Components | `@/*` | `./*` (root-relative) |
| Tests (Jest) | `@tradeblocks/lib` | `packages/lib/index.ts` |
| Tests (Jest) | `@tradeblocks/lib/stores` | `packages/lib/stores/index.ts` |

The legacy `@/lib/*` path alias has been completely removed.

## Next Phase Readiness

Ready for Phase 31-02 verification. All imports have been migrated, and the codebase builds successfully.
