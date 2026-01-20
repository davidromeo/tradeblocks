---
phase: 32-find-predictive-fields
plan: 01
subsystem: mcp-server
tags: [pearson-correlation, statistics, backtest-optimization]

# Dependency graph
requires:
  - phase: mcp-server-setup
    provides: MCP tool registration patterns, report tools infrastructure
provides:
  - find_predictive_fields MCP tool for correlation analysis
  - Field-to-P/L correlation ranking
affects: [33-filter-curve, 34-parameter-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns: [runtime-defaults-for-zod, field-validation-guards]

key-files:
  created: []
  modified: [packages/mcp-server/src/tools/reports.ts]

key-decisions:
  - "Apply Zod defaults at runtime since MCP SDK may not apply them"
  - "Use Pearson correlation for linear relationship detection"
  - "Rank by absolute correlation (both positive and negative are predictive)"
  - "Require minimum 30 samples by default for reliable correlation"

patterns-established:
  - "Runtime defaults pattern: rawParam ?? defaultValue"
  - "Guard pattern for getTradeFieldValue against undefined fields"

issues-created: []

# Metrics
duration: 25min
completed: 2026-01-19
---

# Phase 32 Plan 01: find-predictive-fields Tool Summary

**Pearson correlation-based MCP tool that ranks all numeric fields by their predictive strength for P/L, enabling data-driven filter optimization**

## Performance

- **Duration:** 25 min
- **Started:** 2026-01-19
- **Completed:** 2026-01-19
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created find_predictive_fields MCP tool that calculates correlations between all numeric fields and a target field
- Implemented proper ranking by absolute correlation value
- Added interpretation labels (strong/moderate/weak/negligible) based on |r| thresholds
- Added support for strategy, date range, and custom fields filtering

## Task Commits

Each task was committed atomically:

1. **Task 1: Create find_predictive_fields MCP tool** - `9b0bbbf` (feat)
2. **Task 2: CLI test verification + fixes** - `ef3b158` (fix)

## Files Created/Modified
- `packages/mcp-server/src/tools/reports.ts` - Added find_predictive_fields tool (~240 lines)

## Decisions Made
- Used runtime defaults (rawParam ?? defaultValue) instead of relying on Zod defaults, as MCP SDK CLI handler may not apply them
- Added guard against undefined fields in getTradeFieldValue for robustness
- Added null check for fieldInfo iteration for safety

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod defaults not applied by MCP SDK**
- **Found during:** Task 2 (CLI verification)
- **Issue:** All correlations returned 0 because minSamples was undefined (not 30 as expected)
- **Fix:** Apply defaults at runtime: `const minSamples = rawMinSamples ?? 30`
- **Files modified:** packages/mcp-server/src/tools/reports.ts
- **Verification:** CLI test returns proper correlations with default minSamples=30
- **Committed in:** ef3b158

**2. [Rule 3 - Blocking] Guard against undefined field parameter**
- **Found during:** Task 2 (initial test showed 'Cannot read startsWith of undefined')
- **Issue:** getTradeFieldValue called with undefined field crashed
- **Fix:** Added type guard: `if (typeof field !== 'string') return null`
- **Files modified:** packages/mcp-server/src/tools/reports.ts
- **Verification:** Tool runs without error
- **Committed in:** ef3b158

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking), 0 deferred
**Impact on plan:** Both fixes essential for basic functionality. No scope creep.

## Issues Encountered
- Pre-existing TypeScript strict mode errors in MCP server (unrelated to this change) - noted but not addressed as they don't affect build

## CLI Test Results

```
CLI Test Results:
  Target: pl
  Total fields analyzed: 41
  Fields with sufficient data: 37
  Skipped fields: 4

  Interpretation breakdown:
    strong: 1
    moderate: 4
    weak: 6
    negligible: 26
```

Sample top correlations:
- Net P/L: r=+0.9999 (strong) - expected, nearly identical to target
- Return on Margin: r=+0.5975 (moderate)
- P/L %: r=+0.5422 (moderate)
- Is Winner: r=+0.4623 (moderate)

## Next Phase Readiness
- find_predictive_fields tool complete and working
- Ready for Phase 33 (filter-curve tool)

---
*Phase: 32-find-predictive-fields*
*Completed: 2026-01-19*
