---
phase: 23-portfolio-health-check
plan: 01
subsystem: mcp-server
tags: [mcp, portfolio-health-check, correlation, tail-risk, monte-carlo, walk-forward, unified-assessment]

requires:
  - phase: 17
    provides: Trade-based calculations constraint, filterByStrategy utility
  - phase: 17.1
    provides: CLI test mode for verification
  - phase: 21
    provides: strategy_similarity pattern, correlation/tail risk utilities
  - phase: 22
    provides: what_if_scaling pattern, DEFAULTS typed constant pattern
provides:
  - portfolio_health_check MCP tool (Tool 13) with 4-layer response
  - Unified health assessment combining correlation, tail risk, MC, WFA
  - Configurable thresholds for all dimensions
  - Integration tests with 26 test cases
affects: [ai-analysis-workflows, phase-24]

tech-stack:
  added: []
  patterns: [unified-health-assessment, 4-layer-response-structure, multi-analysis-orchestration]

key-files:
  created:
    - packages/mcp-server/tests/integration/portfolio-health-check.test.ts
  modified:
    - packages/mcp-server/src/tools/blocks.ts

key-decisions:
  - "4-layer response: verdict -> grades -> flags -> keyNumbers"
  - "Grades use A/B/C/F format (no +/- modifiers for simplicity)"
  - "Verdict: HEALTHY (0 flags), MODERATE_CONCERNS (1-2 flags), ISSUES_DETECTED (3+ flags)"
  - "Robustness grade null when WFA cannot run (doesn't count toward flags)"
  - "Flags include specific strategy names and numbers for actionability"
  - "Default thresholds: correlation 0.5, tail 0.5, profit prob 0.95, WFE -0.15, MDD mult 3.0"

patterns-established:
  - "Multi-analysis orchestration: combine correlation, tail risk, MC, WFA in single call"
  - "Layered response structure: verdict (quick) -> grades (dashboard) -> flags (actionable) -> keyNumbers (detail)"
  - "Configurable thresholds with DEFAULTS constant pattern"

issues-created: []

duration: 5min
completed: 2026-01-18
---

# Phase 23 Plan 01: Portfolio Health Check Tool Summary

**portfolio_health_check MCP tool (Tool 13) combining correlation, tail risk, Monte Carlo, and WFA into unified 4-layer health assessment with 26 integration tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-18T16:35:04Z
- **Completed:** 2026-01-18T16:40:23Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Implemented portfolio_health_check MCP tool (Tool 13) with unified 4-layer response
- 4-layer structure: verdict -> grades -> flags -> keyNumbers
- Combines: correlation matrix, tail risk analysis, Monte Carlo simulation, walk-forward analysis
- Grades A/B/C/F for: diversification (avg corr), tailRisk (avg tail dep), robustness (WFE), consistency (MC profit prob)
- Flags include specific strategy names and values for actionability
- 5 configurable thresholds with sensible defaults (HEALTH_CHECK_DEFAULTS)
- Created 26 integration tests covering all functionality and edge cases
- CLI verification successful with real 16-strategy portfolio

## Task Commits

1. **Task 1: Implement portfolio_health_check MCP tool** - `4da48a4` (feat)
2. **Task 2: Add integration tests** - `7fa310f` (test)
3. **Task 3: CLI verification and final validation** - no code changes needed

## Files Created/Modified

- `packages/mcp-server/src/tools/blocks.ts` - Added Tool 13: portfolio_health_check (477 lines), imports for MC and WFA
- `packages/mcp-server/tests/integration/portfolio-health-check.test.ts` - 26 integration tests (656 lines)

## Decisions Made

- 4-layer response structure matches user vision: quick verdict -> dashboard grades -> actionable flags -> detail numbers
- Grades use simple A/B/C/F (no +/- modifiers) for clarity
- Robustness grade is null when WFA cannot run (insufficient data), doesn't count toward flag total
- Default thresholds chosen for balance: 0.5 correlation/tail (flag significant pairs), 0.95 profit prob (high bar), -15% WFE (moderate degradation), 3x MDD multiplier (realistic stress)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation matched plan specification.

## CLI Test Mode

Verified via CLI test mode with real data:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests node server/index.js --call portfolio_health_check '{"blockId":"main-port-2026"}'
```

Output verified:
- Summary line appears: "Health Check: main-port-2026 | MODERATE_CONCERNS | 2 flags | Sharpe: 7.83"
- JSON includes all 4 layers (verdict, grades, flags, keyNumbers)
- Flags include specific strategy names: "0/1 DC & 21/28 30 Delta (0.71)"
- Grades use A/B/C/F format: diversification: A, tailRisk: A, robustness: C, consistency: A
- Key numbers populated: 16 strategies, 3436 trades, Sharpe 7.83

## Test Coverage

26 integration tests covering:
- 4-layer response structure (verdict, grades, flags, keyNumbers)
- Verdict logic (HEALTHY/MODERATE_CONCERNS/ISSUES_DETECTED)
- Grade calculation based on metrics (diversification, tailRisk, robustness, consistency)
- Flag generation with strategy names
- Threshold configuration (defaults and custom)
- Edge cases (2 strategies minimum, non-existent block)

## v2.1 Milestone Completion

With Phase 23 complete, v2.1 Portfolio Comparison milestone is complete:
1. `block_diff` - Compare two blocks [Phase 17]
2. `stress_test` - Historical scenario analysis [Phase 18]
3. `drawdown_attribution` - Identify drawdown drivers [Phase 19]
4. `marginal_contribution` - Calculate marginal Sharpe/Sortino [Phase 20]
5. `strategy_similarity` - Detect redundant strategies [Phase 21]
6. `what_if_scaling` - Project metrics at different sizes [Phase 22]
7. `portfolio_health_check` - Unified health assessment [Phase 23]

## Next Phase Readiness

- portfolio_health_check tool ready for AI agent workflows
- 4-layer response enables quick triage (verdict) and deep analysis (flags/numbers)
- Ready for Phase 24: Web Platform Integration Guide

---
*Phase: 23-portfolio-health-check*
*Completed: 2026-01-18*
