---
phase: 33-filter-curve
plan: 01
subsystem: mcp-server
tags: [mcp, filter, threshold, optimization, correlation]

# Dependency graph
requires:
  - phase: 32-find-predictive-fields
    provides: Field correlation infrastructure, enrichTrades(), getTradeFieldValue()
provides:
  - filter_curve MCP tool for threshold sweeping
  - Bidirectional filter analysis (lt/gt/both)
  - Sweet spot detection with improvement scoring
affects: [report-tools, backtest-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns: [percentile-based threshold generation, bidirectional filter analysis]

key-files:
  created: []
  modified: [packages/mcp-server/src/tools/reports.ts]

key-decisions:
  - "Sweet spot criteria: winRateDelta > 0 AND avgPlDelta > 0 AND percentOfTrades >= 20%"
  - "Sweet spots ranked by combined score (winRateDelta * avgPlDelta)"
  - "Default percentile steps: [5, 10, 25, 50, 75, 90, 95] for threshold generation"

patterns-established:
  - "Bidirectional filter analysis with lt/gt/both modes"
  - "Threshold sweeping with auto-generation from percentiles"

issues-created: []

# Metrics
duration: 3min
completed: 2026-01-19
---

# Phase 33 Plan 01: filter-curve Tool Summary

**filter_curve MCP tool for threshold sweeping with bidirectional analysis, auto-generated thresholds from percentiles, and sweet spot detection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-19T21:55:31Z
- **Completed:** 2026-01-19T21:58:26Z
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments

- Created filter_curve MCP tool with ~314 lines of implementation
- Bidirectional threshold analysis (lt/gt/both modes)
- Auto-generated thresholds from percentiles [5,10,25,50,75,90,95]
- Custom threshold support overrides auto-generation
- Sweet spot detection with combined improvement scoring
- Full strategy/date pre-filter support

## Task Commits

Each task was committed atomically:

1. **Task 1: Create filter_curve MCP tool** - `cfe908f` (feat)
2. **Task 2: CLI test verification** - No commit needed (implementation correct on first try)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/mcp-server/src/tools/reports.ts` - Added filter_curve tool (~314 lines)

## Decisions Made

- **Sweet spot criteria:** winRateDelta > 0 AND avgPlDelta > 0 AND percentOfTrades >= 20%
- **Sweet spot ranking:** Combined score = winRateDelta * avgPlDelta
- **Default percentiles:** [5, 10, 25, 50, 75, 90, 95] for auto-generated thresholds

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation worked correctly on first attempt.

## CLI Test Results

All 4 test cases passed:

1. **Basic test (openingVix):** 7 auto-generated thresholds, 3 sweet spots found
2. **Single direction (mode: "lt"):** Output correctly includes only lt results
3. **Custom thresholds ([15,20,25,30]):** Exactly 4 thresholds in output
4. **Different field (durationHours):** 5 sweet spots found, demonstrating cross-field utility

Sample output structure:
```json
{
  "summary": "Filter curve for openingVix: 7 thresholds analyzed | 3 sweet spots found",
  "structuredData": {
    "baseline": { "count": 3436, "winRate": 58.67, "avgPl": 15572.75 },
    "thresholds": [...],
    "sweetSpots": [
      { "threshold": 17.18, "direction": "lt", "score": 30.49, "recommendation": "Consider filtering openingVix < 17.18" }
    ]
  }
}
```

## Next Step

Phase 33 complete, ready for Phase 34 (report-tools-fixes)

---
*Phase: 33-filter-curve*
*Completed: 2026-01-19*
