---
phase: 30-import-migration
plan: 02
subsystem: build-system
tags: [imports, workspace, next.js, typescript]
requires: [30-01]
provides: [clean-workspace-imports]
affects: [31-cleanup-verification]
tech-stack:
  added: []
  patterns: [workspace-package-imports, barrel-exports]
key-files:
  created: []
  modified:
    - app/**/*.tsx
    - components/**/*.tsx
    - packages/lib/calculations/index.ts
    - packages/lib/models/index.ts
    - packages/lib/processing/index.ts
decisions: []
metrics:
  duration: ~15min
  completed: 2026-01-19
---

# Phase 30 Plan 02: Next.js App Import Migration Summary

**Migrated 127+ files from @/lib/* path aliases to @tradeblocks/lib workspace package imports**

## Accomplishments

- Updated 12 files in app/ to use @tradeblocks/lib
- Updated 115 files in components/ to use @tradeblocks/lib
- Expanded lib barrel exports to include all required modules
- Resolved export naming conflict (findOptimalThreshold)
- Verified TypeScript and Next.js build pass

## Files Created/Modified

### App Directory (12 files)
- `app/layout.tsx` - cn utility import
- `app/(platform)/assistant/page.tsx` - portfolio stats, db, services imports
- `app/(platform)/block-stats/page.tsx` - calculations, db, metrics, models imports
- `app/(platform)/blocks/page.tsx` - stores, services imports
- `app/(platform)/correlation-matrix/page.tsx` - calculations, db, models imports
- `app/(platform)/performance-blocks/page.tsx` - stores, utils imports
- `app/(platform)/position-sizing/page.tsx` - calculations, db, models imports
- `app/(platform)/risk-simulator/page.tsx` - calculations, db, utils imports
- `app/(platform)/static-datasets/page.tsx` - stores, models, db imports
- `app/(platform)/tail-risk-analysis/page.tsx` - calculations, db, models imports
- `app/(platform)/trading-calendar/page.tsx` - stores imports
- `app/(platform)/walk-forward/page.tsx` - calculations, models, stores, utils imports

### Components Directory (115 files)
- All UI components (35 files) - cn utility import
- Performance charts (28 files) - stores, models imports
- Report builder (16 files) - calculations, models imports
- Trading calendar (7 files) - stores, services, models imports
- Walk-forward (8 files) - models, calculations imports
- Position sizing (4 files) - calculations imports
- Static datasets (3 files) - stores, models, processing imports
- Tail risk (4 files) - models imports
- Risk simulator (4 files) - calculations imports
- Other components (6 files) - various imports

### Lib Barrel Exports (3 files)
- `packages/lib/calculations/index.ts` - Added streak-analysis, flexible-filter, regime-comparison, table-aggregation, threshold-analysis, static-dataset-matcher, cumulative-distribution, walk-forward-interpretation, enrich-trades
- `packages/lib/models/index.ts` - Added tail-risk, static-dataset, enriched-trade, regime
- `packages/lib/processing/index.ts` - Added reporting-trade-processor, static-dataset-processor

## Import Pattern

```typescript
// Before:
import { cn } from "@/lib/utils";
import { Trade } from "@/lib/models/trade";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";
import { useBlockStore } from "@/lib/stores/block-store";

// After:
import { cn, Trade, PortfolioStatsCalculator } from "@tradeblocks/lib";
import { useBlockStore } from "@tradeblocks/lib/stores";
```

**Key distinction:** Stores use `@tradeblocks/lib/stores` (separate entry point) while all other exports use `@tradeblocks/lib` (main barrel).

## Decisions Made

1. **Store imports via separate entry point** - Maintained the pattern from 30-01 where stores are imported from `@tradeblocks/lib/stores` to avoid browser/Node dependency conflicts

2. **Renamed conflicting export** - `findOptimalThreshold` existed in both `threshold-analysis.ts` and `cumulative-distribution.ts`. Renamed the cumulative-distribution version to `findOptimalDistributionThreshold` in the barrel export

3. **Expanded barrel exports** - Added 12 additional module re-exports to the calculations barrel, 4 to models, and 2 to processing to ensure all imports resolve

## Issues Encountered

1. **Missing barrel exports** - Initial migration revealed several modules not exported from barrels:
   - calculations: streak-analysis, flexible-filter, regime-comparison, table-aggregation, threshold-analysis, static-dataset-matcher, cumulative-distribution, walk-forward-interpretation, enrich-trades
   - models: tail-risk, static-dataset, enriched-trade, regime
   - processing: reporting-trade-processor, static-dataset-processor
   - **Resolution:** Added all missing re-exports to respective index.ts files

2. **Export name conflict** - `findOptimalThreshold` exported from both threshold-analysis and cumulative-distribution
   - **Resolution:** Renamed cumulative-distribution version to `findOptimalDistributionThreshold` in barrel export

## Commits

| Hash | Message |
|------|---------|
| abeefdd | feat(30-02): update app directory imports to @tradeblocks/lib |
| f7b2259 | feat(30-02): update components directory imports to @tradeblocks/lib |
| 35ffcc7 | chore(30-02): verify TypeScript and build pass |

## Verification

- [x] `grep -r "@/lib/" app components` returns no matches
- [x] `npx tsc --noEmit` passes for app/ and components/
- [x] `npm run build` succeeds (16 routes generated)
- [x] No new TypeScript errors introduced

## Next Step

Phase 30 complete, ready for Phase 31: cleanup-verification
