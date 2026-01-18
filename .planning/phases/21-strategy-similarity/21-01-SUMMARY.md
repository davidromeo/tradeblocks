---
phase: 21-strategy-similarity
plan: 01
subsystem: mcp-server
tags: [mcp, strategy-similarity, correlation, tail-risk, redundancy-detection, portfolio-analysis]

requires:
  - phase: 17
    provides: Trade-based calculations constraint, filterByStrategy utility
  - phase: 17.1
    provides: CLI test mode for verification
  - phase: 20
    provides: marginal_contribution tool pattern, JSON-first output structure
provides:
  - strategy_similarity MCP tool detecting redundant strategy pairs
  - Composite similarity scoring (correlation + tail dependence + overlap)
  - Redundancy flags and actionable recommendations
  - Integration tests with 4-strategy similarity fixture
affects: [phase-22, phase-23]

tech-stack:
  added: []
  patterns: [composite-similarity-scoring, redundancy-detection, strategy-pair-analysis, multi-metric-flags]

key-files:
  created:
    - packages/mcp-server/tests/integration/strategy-similarity.test.ts
    - packages/mcp-server/tests/fixtures/similarity-test-block/tradelog.csv
  modified:
    - packages/mcp-server/src/tools/blocks.ts
    - packages/mcp-server/src/test-exports.ts

key-decisions:
  - "Composite similarity score: 50% correlation, 30% tail dependence, 20% overlap"
  - "Default thresholds: correlationThreshold=0.7, tailDependenceThreshold=0.5"
  - "Redundant flag requires BOTH high correlation AND high tail dependence"
  - "Three recommendation types: redundant (consolidate), high correlation (moderate), high tail (stress risk)"
  - "Trade-based calculations only (no daily logs) per Phase 17 constraint"
  - "Leverage existing calculateCorrelationMatrix and performTailRiskAnalysis utilities"

patterns-established:
  - "Multi-flag similarity detection: combine correlation, tail, overlap into composite score"
  - "Tiered recommendations: different advice based on which flags triggered"
  - "Strategy pair iteration: unique pairs (i < j) with sorted output by composite score"

issues-created: []

duration: 8min
completed: 2026-01-18
---

# Phase 21 Plan 01: Strategy Similarity Tool Summary

**strategy_similarity MCP tool detecting redundant strategies via composite scoring (correlation + tail dependence + overlap), with 28 integration tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-18T17:00:00Z
- **Completed:** 2026-01-18T17:08:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Implemented strategy_similarity MCP tool (Tool 10) with blockId, thresholds, method, topN parameters
- Composite similarity score combining 50% correlation (absolute), 30% tail dependence, 20% overlap
- Three-tier flagging: isHighCorrelation, isHighTailDependence, isRedundant (both required)
- Actionable recommendations based on flag combinations
- Created comprehensive test fixture with 4 strategies demonstrating similarity patterns
- Added 28 integration tests covering all functionality and edge cases

## Task Commits

1. **Task 1: Implement strategy_similarity MCP tool** - `6cc6a73` (feat)
2. **Task 2: Add integration tests** - `4afe75c` (test)

## Files Created/Modified

- `packages/mcp-server/src/tools/blocks.ts` - Added Tool 10: strategy_similarity (284 lines), renumbered get_trades to Tool 11
- `packages/mcp-server/src/test-exports.ts` - Export calculateCorrelationMatrix and performTailRiskAnalysis
- `packages/mcp-server/tests/integration/strategy-similarity.test.ts` - 28 integration tests
- `packages/mcp-server/tests/fixtures/similarity-test-block/tradelog.csv` - 40 trades across 4 strategies

## Decisions Made

- Composite score weights: 50% correlation (absolute value to handle negative correlations), 30% tail dependence, 20% overlap
- Default thresholds chosen for balance: 0.7 correlation (meaningful similarity), 0.5 tail dependence (significant joint risk)
- Redundant flag is conservative (requires BOTH conditions) to avoid false positives
- Recommendations tiered: consolidate for redundant, moderate warning for high-correlation-only, stress warning for high-tail-only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation matched plan specification.

## CLI Test Mode

Verified via CLI test mode (documented in test file):
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call strategy_similarity '{"blockId":"main-port-2026"}'
```

Expected output structure:
- Summary line: "Strategy Similarity: {blockId} | {N} strategies | {M} redundant pairs | Most similar: {A}-{B} ({score})"
- Structured data: blockId, options, strategySummary, similarPairs array with flags and recommendations, recommendations array

## Test Fixture Design

The similarity-test-block fixture contains 4 strategies (40 trades total) designed to demonstrate:

| Strategy | Trading Days | P/L Pattern | Expected Behavior |
|----------|--------------|-------------|-------------------|
| TrendFollowA | Jan 2-15 (10 days) | Consistent wins with some losses | High correlation with TrendFollowB |
| TrendFollowB | Jan 2-15 (10 days) | Similar to TrendFollowA (~98% same direction) | High correlation with TrendFollowA |
| MeanRevert | Jan 2-15 (10 days) | Opposite direction to TrendFollow | Negative correlation with TrendFollow |
| Independent | Feb 1-14 (10 days) | Unrelated to others | Zero overlap, null/low correlation |

## Next Phase Readiness

- strategy_similarity tool ready for use by AI agents
- Composite scoring pattern established for multi-metric analysis
- Ready for Phase 22: What-If Scaling Tool

---
*Phase: 21-strategy-similarity*
*Completed: 2026-01-18*
