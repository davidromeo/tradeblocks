---
phase: 20-marginal-contribution
plan: 01
subsystem: mcp-server
tags: [mcp, marginal-contribution, sharpe-ratio, sortino-ratio, portfolio-analysis]

requires:
  - phase: 17
    provides: Trade-based calculations constraint, filterByStrategy utility
  - phase: 17.1
    provides: CLI test mode for verification
  - phase: 19
    provides: drawdown_attribution tool pattern, JSON-first output structure
provides:
  - marginal_contribution MCP tool calculating per-strategy Sharpe/Sortino impact
  - With/without comparison algorithm for marginal contribution
  - Integration tests with designed strategy characteristics fixture
affects: [phase-21, phase-22, phase-23]

tech-stack:
  added: []
  patterns: [marginal-contribution-algorithm, with-without-comparison, interpretation-thresholds]

key-files:
  created:
    - packages/mcp-server/tests/integration/marginal-contribution.test.ts
    - packages/mcp-server/tests/fixtures/marginal-test-block/tradelog.csv
  modified:
    - packages/mcp-server/src/tools/blocks.ts

key-decisions:
  - "Trade-based calculations only (no daily logs) per Phase 17 constraining decision"
  - "Marginal contribution = baseline metric - without metric (positive = improves portfolio)"
  - "Interpretation thresholds: |delta| < 0.01 = negligible, > 0 = improves, < 0 = hurts"
  - "Single strategy portfolios return null marginal values with explanation message"

patterns-established:
  - "With/without comparison: calculate baseline with all trades, then without each strategy"
  - "Interpretation field: categorize marginal impact as improves/hurts/negligible"
  - "Sorted output: most beneficial strategy first (highest positive marginal Sharpe)"

issues-created: []

duration: 6min
completed: 2026-01-18
---

# Phase 20 Plan 01: Marginal Contribution Tool Summary

**marginal_contribution MCP tool calculating per-strategy Sharpe/Sortino impact with with/without comparison algorithm, 23 integration tests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-18T16:05:00Z
- **Completed:** 2026-01-18T16:11:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Implemented marginal_contribution MCP tool (Tool 9) with blockId, targetStrategy, topN parameters
- Calculates baseline portfolio Sharpe/Sortino using all trades
- For each strategy, calculates "without" metrics by removing that strategy
- Marginal contribution = baseline - without (positive = improves, negative = hurts)
- Created comprehensive test fixture with 3 strategies designed to demonstrate marginal contribution
- Added 23 integration tests covering all functionality and edge cases

## Task Commits

1. **Task 1: Implement marginal_contribution MCP tool** - `bdcdff3` (feat)
2. **Task 2: Add integration tests** - `122eeff` (test)

## Files Created/Modified

- `packages/mcp-server/src/tools/blocks.ts` - Added Tool 9: marginal_contribution (271 lines)
- `packages/mcp-server/tests/integration/marginal-contribution.test.ts` - 23 integration tests
- `packages/mcp-server/tests/fixtures/marginal-test-block/tradelog.csv` - Test fixture with 30 trades across 3 strategies

## Decisions Made

- Used trade-based calculations only (consistent with Phase 17 constraint)
- Marginal contribution calculated as baseline - without (positive indicates strategy improves portfolio)
- Interpretation thresholds set at |delta| < 0.01 for negligible, positive for improves, negative for hurts
- Single strategy portfolios return null marginal values with "only-strategy" interpretation
- Results sorted by marginal Sharpe descending (most beneficial first)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation matched plan specification.

## CLI Test Mode

Verified via CLI test mode (documented in test file):
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call marginal_contribution '{"blockId":"main-port-2026"}'
```

Expected output structure:
- Summary line: "Marginal Contribution: {blockId} | Top: {strategy} (Sharpe +{delta}) | Worst: {strategy} (Sharpe {delta})"
- Structured data: blockId, filters, baseline (totalStrategies, totalTrades, sharpeRatio, sortinoRatio), contributions array, summary (mostBeneficial, leastBeneficial)

## Next Phase Readiness

- marginal_contribution tool ready for use by AI agents
- Pattern established for with/without comparison calculations
- Ready for Phase 21: Strategy Similarity Tool

---
*Phase: 20-marginal-contribution*
*Completed: 2026-01-18*
