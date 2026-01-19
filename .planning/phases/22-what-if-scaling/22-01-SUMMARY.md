---
phase: 22-what-if-scaling
plan: 01
subsystem: mcp-server
tags: [mcp, what-if-scaling, strategy-weights, portfolio-optimization, trade-based-calculations]

requires:
  - phase: 17
    provides: Trade-based calculations constraint, filterByStrategy utility, filterByDateRange utility
  - phase: 17.1
    provides: CLI test mode for verification
  - phase: 20
    provides: marginal_contribution tool pattern, JSON-first output structure
  - phase: 21
    provides: strategy_similarity pattern, SIMILARITY_DEFAULTS typed constant pattern
provides:
  - what_if_scaling MCP tool (Tool 11) for exploring strategy weight combinations
  - Before/after comparison with delta percentages
  - Per-strategy breakdown showing ALL strategies (not just scaled ones)
  - Commission scaling proportional to weights
  - Integration tests with 24 test cases
affects: [phase-23, ai-optimizer-workflows]

tech-stack:
  added: []
  patterns: [strategy-weight-scaling, commission-proportional-scaling, portfolio-what-if-analysis]

key-files:
  created:
    - packages/mcp-server/tests/integration/what-if-scaling.test.ts
  modified:
    - packages/mcp-server/src/tools/blocks.ts

key-decisions:
  - "Weight range 0-2.0 for realism (no extreme leverage)"
  - "Weight 0 excludes strategy entirely from scaled portfolio"
  - "Commissions scale proportionally with weight (0.5x size = 0.5x commissions)"
  - "Per-strategy breakdown shows ALL strategies, not just scaled ones, to confirm unscaled stayed at 1.0x"
  - "Trade-based calculations only (no daily logs) per Phase 17 constraint"
  - "Unknown strategies in weights trigger warning but continue processing"

patterns-established:
  - "Portfolio what-if analysis: compare baseline vs modified portfolio with delta percentages"
  - "Proportional commission scaling: commissions scale with trade size/weight"
  - "Comprehensive per-strategy breakdown: show all strategies even when only some are modified"

issues-created: []

duration: 12min
completed: 2026-01-18
---

# Phase 22 Plan 01: What-If Scaling Tool Summary

**what_if_scaling MCP tool (Tool 11) for exploring strategy weight combinations with before/after comparison and per-strategy breakdown, 24 integration tests**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-18T16:15:00Z
- **Completed:** 2026-01-18T16:27:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented what_if_scaling MCP tool (Tool 11) with strategyWeights parameter (0-2.0x range)
- Before/after comparison with Sharpe, Sortino, MDD, Net P/L, and trade count deltas
- Per-strategy breakdown showing ALL strategies with original, scaled, and delta values
- Commission scaling proportional to weights for realistic P&L calculations
- Created 24 integration tests covering all functionality and edge cases

## Task Commits

1. **Task 1: Implement what_if_scaling MCP tool** - `5a7f09f` (feat)
2. **Task 2: Add integration tests** - `9263099` (test)

## Files Created/Modified

- `packages/mcp-server/src/tools/blocks.ts` - Added Tool 11: what_if_scaling (278 lines), renumbered get_trades to Tool 12
- `packages/mcp-server/tests/integration/what-if-scaling.test.ts` - 24 integration tests (570 lines)

## Decisions Made

- Weight range capped at 0-2.0 for realism (2x leverage is reasonable, higher would be extreme)
- Weight 0 completely excludes strategy from scaled portfolio (equivalent to marginal_contribution "without")
- Commissions scale proportionally with weight because smaller position = smaller trading costs
- Per-strategy breakdown includes ALL strategies to confirm which stayed at 1.0x (no ambiguity)
- Case-insensitive strategy matching for user convenience

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation matched plan specification.

## CLI Test Mode

Verified via CLI test mode (documented in test file):
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call what_if_scaling '{"blockId":"main-port-2026","strategyWeights":{"5/7 17Δ":0.5}}'
```

Expected output structure:
- Summary line: "What-If Scaling: {blockId} | Sharpe {original} -> {scaled} ({delta}%) | MDD {original}% -> {scaled}% ({delta}%)"
- Structured data: blockId, strategyWeights, dateRange, unknownStrategies, comparison, perStrategy

## Test Coverage

24 integration tests covering:
- No weights (baseline = scaled) - metrics identical, all weights 1.0
- Single strategy 0.5x - P/L halved, others unchanged
- Single strategy 2.0x - P/L doubled
- Weight 0 (exclude) - trades removed, strategy shown with 0 trades
- Multiple strategy weights - independent scaling
- Unknown strategy in weights - warn and continue
- All strategies weight 0 - error (empty portfolio)
- Date range + weights - both filters applied
- Commission scaling - proportional with weight
- Per-strategy breakdown - ALL strategies shown, sorted by original P/L
- Comparison structure - all metrics present with delta/deltaPct

## Future Enhancement Notes

- `keepTotalExposure` flag for capital reallocation (scale others up when one scales down)
- This would enable "what if I moved capital from strategy A to B" scenarios

## Next Phase Readiness

- what_if_scaling tool ready for AI optimizer pattern (3-4 quick weight explorations converge on optimal blend)
- Builds on marginal_contribution (Phase 20) for strategy evaluation
- Ready for Phase 23 or additional portfolio optimization tools

---
*Phase: 22-what-if-scaling*
*Completed: 2026-01-18*
