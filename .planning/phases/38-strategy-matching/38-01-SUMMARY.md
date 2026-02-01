---
phase: 38-strategy-matching
plan: 01
subsystem: mcp
tags: [correlation, strategy-matching, pearson, spearman, kendall, reporting-log]

# Dependency graph
requires:
  - phase: 37-discrepancy-analysis
    provides: analyze_discrepancies tool and reporting log infrastructure
provides:
  - suggest_strategy_matches MCP tool for correlating backtest and actual strategies
  - Confidence scoring (0-100) based on P/L correlation and timing overlap
  - Unmatchable detection (negative correlation, systematic bias)
  - Exact name match auto-confirmation at 100% confidence
affects: [strategy-confirmation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Per-contract P/L normalization for strategy comparison
    - Confidence scoring combining correlation (70%) and timing overlap (30%)
    - Sample size penalty for correlations with <20 overlapping days

key-files:
  created: []
  modified:
    - packages/mcp-server/src/tools/reports.ts
    - packages/mcp-server/package.json

key-decisions:
  - "Confidence formula: 70% correlation weight + 30% timing overlap weight"
  - "Unmatchable threshold: correlation < -0.2 or bias ratio > 2 std devs"
  - "Per-contract normalization: dailyPl / sumContracts when contracts > 0"
  - "Sample size penalty: multiply confidence by (overlapDays / 20) when < 20 days"

patterns-established:
  - "Strategy matching: exact names auto-confirm at 100%, correlation-based suggestions ranked by confidence"
  - "Correlation matrix output: rows=backtest, cols=actual, with sample sizes for interpretation"

# Metrics
duration: 3min
completed: 2026-02-01
---

# Phase 38 Plan 01: Strategy Matching Summary

**suggest_strategy_matches MCP tool with P/L correlation, confidence scoring (0-100), and unmatchable detection for backtest/actual strategy alignment**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-01T15:54:06Z
- **Completed:** 2026-02-01T15:57:07Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- New MCP tool `suggest_strategy_matches` for correlating backtest and actual strategies
- Support for Pearson, Spearman, and Kendall correlation methods
- Per-contract P/L normalization for fair comparison across different position sizes
- Confidence scores (0-100) combining correlation strength and timing overlap
- Exact name matches auto-confirm at 100% confidence
- Unmatchable detection for strategies with negative correlation or systematic bias
- Full correlation matrix in output for programmatic interpretation

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement suggest_strategy_matches MCP tool** - `480ac92` (feat)
2. **Task 2: Bump MCP server version** - `4a25719` (chore)
3. **Task 3: CLI verification** - (verification only, no commit)

## Files Created/Modified
- `packages/mcp-server/src/tools/reports.ts` - Added suggest_strategy_matches tool (~520 lines)
- `packages/mcp-server/package.json` - Bumped version to 0.4.7

## Decisions Made
- **Confidence formula:** 70% from correlation strength, 30% from timing overlap (same-day trading frequency)
- **Per-contract normalization:** `dailyPl = sumPl / sumContracts` for each strategy on each day
- **Unmatchable thresholds:**
  - Negative correlation < -0.2 means strategies move opposite
  - Bias ratio > 2 (mean difference / std deviation) indicates systematic P/L difference
- **Sample size penalty:** Confidence reduced proportionally when overlap < 20 days
- **Spearman implementation:** Inline using getRanks + Pearson on ranks (not separately exported)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - build and CLI verification succeeded on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Strategy matching tool complete and verified with real data
- Tool found 12 exact matches and 3 unmatched backtest-only strategies in test block
- Ready for Phase 39: Strategy Confirmation (UI integration)

---
*Phase: 38-strategy-matching*
*Completed: 2026-02-01*
