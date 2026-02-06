---
phase: quick-011
plan: 03
subsystem: mcp-server
tags: [sharpe-ratio, daily-logs, consistency, data-ethos, mcp-tools]

dependency-graph:
  requires: []
  provides:
    - "Consistent Sharpe ratios across block_diff, marginal_contribution, what_if_scaling, and get_statistics"
    - "Data-only output from marginal_contribution (no interpretation field)"
  affects: []

tech-stack:
  added: []
  patterns:
    - "Daily-log-based Sharpe for baseline stats when available, trade-based for derived/modified calculations"

key-files:
  created: []
  modified:
    - packages/mcp-server/src/tools/blocks/comparison.ts
    - packages/mcp-server/src/tools/blocks/analysis.ts
    - packages/mcp-server/src/tools/blocks/similarity.ts

decisions:
  - id: "sharpe-mixed-basis"
    description: "Baseline uses daily-log Sharpe; 'without' and 'scaled' use trade-based since daily logs don't reflect strategy removal or P&L scaling"

metrics:
  duration: "~6 minutes"
  completed: "2026-02-06"
---

# Quick 011 Plan 03: Fix Sharpe Ratio Consistency Across MCP Tools Summary

**One-liner:** Daily-log-based Sharpe for block_diff/marginal_contribution/what_if_scaling baselines, interpretation field removed from marginal_contribution.

## What Changed

### block_diff (comparison.ts)
- Portfolio-level stats now use daily logs when available, matching get_statistics
- Daily logs are filtered to the same startDate/endDate range as trades
- Falls back to trade-based when daily logs are unavailable or empty after filtering
- Per-strategy stats remain trade-based (correct: daily logs are portfolio-wide)
- Added import for `filterDailyLogsByDateRange` from shared filters

### marginal_contribution (analysis.ts)
- Baseline stats now use daily logs when available (both multi-strategy and single-strategy edge cases)
- "Without" stats remain trade-based with explicit comment explaining why (daily logs include the removed strategy's impact)
- Removed `interpretation` field entirely from Contribution type and all output objects
- Removed interpretation calculation logic (the "improves"/"hurts"/"negligible"/"unknown" labels)
- Added comment explaining the mixed-basis nature of marginal deltas

### what_if_scaling (similarity.ts)
- Baseline stats now use daily logs when available
- Daily logs are filtered by startDate/endDate when date filters are applied
- Scaled stats remain trade-based with explicit comment explaining why (daily logs don't reflect P&L scaling)
- Added import for `filterDailyLogsByDateRange` from shared filters

## Design Decision: Mixed-Basis Marginal Contributions

The marginal contribution calculation compares `baseline - without`. After this fix:
- **Baseline** uses daily-log-based Sharpe (matching get_statistics)
- **Without** uses trade-based Sharpe (necessary: daily logs include the removed strategy)

This means marginal deltas are mixed-basis. However, the primary user complaint was that the baseline Sharpe didn't match get_statistics (e.g., 5.35 vs 4.91). Now it does. The marginal delta values adjust accordingly but still correctly indicate whether a strategy improves or hurts the portfolio.

## Deviations from Plan

None -- plan executed exactly as written.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix block_diff to use daily-log-based Sharpe | 5fd32e5 | comparison.ts |
| 2 | Fix marginal_contribution and what_if_scaling Sharpe + remove interpretation | b222b3c | analysis.ts, similarity.ts |

## Verification

- TypeScript compilation passes for all three modified files (errors in performance.ts are pre-existing from parallel agent work)
- Zero occurrences of `interpretation` in analysis.ts output objects
- All three tools use daily-log Sharpe for baseline when daily logs available
- All three tools fall back to trade-based when no daily logs

## Self-Check: PASSED
