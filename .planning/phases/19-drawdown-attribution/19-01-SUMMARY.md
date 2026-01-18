---
phase: 19-drawdown-attribution
plan: 01
subsystem: mcp-server
tags: [mcp, drawdown, attribution, portfolio-analysis, equity-curve]

requires:
  - phase: 17
    provides: Trade-based calculations constraint, filterByStrategy utility
  - phase: 17.1
    provides: CLI test mode for verification
  - phase: 18
    provides: stress_test tool pattern, JSON-first output structure
provides:
  - drawdown_attribution MCP tool identifying max drawdown period
  - Per-strategy P/L attribution during drawdown
  - Integration tests with designed drawdown scenario fixture
affects: [phase-20, phase-21, phase-22, phase-23]

tech-stack:
  added: []
  patterns: [equity-curve-analysis, peak-to-trough-drawdown, per-strategy-attribution]

key-files:
  created:
    - packages/mcp-server/tests/integration/drawdown-attribution.test.ts
    - packages/mcp-server/tests/fixtures/drawdown-test-block/tradelog.csv
  modified:
    - packages/mcp-server/src/tools/blocks.ts

key-decisions:
  - "Trade-based calculations only (no daily logs) per Phase 17 constraining decision"
  - "Build equity curve from trades sorted by close date/time"
  - "Initial capital derived from first trade's fundsAtClose - pl"
  - "Attribution percentages calculated as abs(strategy_pl / total_loss) * 100"

patterns-established:
  - "Equity curve construction: sort trades by close date, track cumulative equity"
  - "Peak-to-trough drawdown: track peak equity, identify max drawdown period"
  - "Per-strategy attribution: group trades in drawdown period, calculate contribution"

issues-created: []

duration: 5min
completed: 2026-01-18
---

# Phase 19 Plan 01: Drawdown Attribution Tool Summary

**drawdown_attribution MCP tool identifying max drawdown period and per-strategy P/L attribution, with 16 integration tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-18T15:28:22Z
- **Completed:** 2026-01-18T15:33:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Implemented drawdown_attribution MCP tool with blockId, strategy filter, topN parameters
- Built equity curve from trades to identify max drawdown period (peak to trough)
- Calculated per-strategy attribution with P/L, trade count, win/loss, contribution percentage
- Created comprehensive test fixture with designed drawdown scenario
- Added 16 integration tests covering all functionality and edge cases

## Task Commits

1. **Task 1: Implement drawdown_attribution MCP tool** - `1994730` (feat)
2. **Task 2: Add integration tests** - `8d22058` (test)

## Files Created/Modified

- `packages/mcp-server/src/tools/blocks.ts` - Added Tool 8: drawdown_attribution (224 lines)
- `packages/mcp-server/tests/integration/drawdown-attribution.test.ts` - 16 integration tests
- `packages/mcp-server/tests/fixtures/drawdown-test-block/tradelog.csv` - Test fixture with designed drawdown

## Decisions Made

- Used trade-based equity curve (consistent with Phase 17 constraint)
- Derive initial capital from first trade's fundsAtClose - pl
- Sort trades by close date/time for accurate equity curve
- Calculate contribution as absolute percentage (handles mixed positive/negative)
- Return null drawdown period when equity never declines from peak

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation matched plan specification.

## CLI Test Mode

Verified via CLI test mode (documented in test file):
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call drawdown_attribution '{"blockId":"main-port-2026"}'
```

Expected output structure:
- Summary line: "Drawdown Attribution: {blockId} | Max DD: X% | {peakDate} to {troughDate} | Top contributor: {strategy} ($X)"
- Structured data: blockId, filters, drawdownPeriod (peak/trough dates, equity values, maxDrawdown%, durationDays), periodStats (totalTrades, totalPl), attribution array

## Next Phase Readiness

- drawdown_attribution tool ready for use by AI agents
- Pattern established for equity curve analysis and period-based attribution
- Ready for Phase 20: Marginal Contribution Tool

---
*Phase: 19-drawdown-attribution*
*Completed: 2026-01-18*
