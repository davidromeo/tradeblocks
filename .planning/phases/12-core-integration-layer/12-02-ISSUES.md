# UAT Issues: Phase 12 Plan 02

**Tested:** 2026-01-14
**Source:** .planning/phases/12-core-integration-layer/12-02-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

[None]

## Resolved Issues

### UAT-001: MCP tool schemas don't expose all calculation parameters

**Discovered:** 2026-01-14
**Resolved:** 2026-01-14
**Phase/Plan:** 12-02 / 12-02-FIX
**Severity:** Major
**Feature:** All 11 MCP tools (Tier 1 + Tier 2)

**Description:** The MCP tool schemas were too restrictive. They didn't expose all the parameters that the underlying `lib/calculations` modules support.

**Resolution:**
Expanded all tool schemas to expose underlying calculation module parameters:

1. **run_monte_carlo:** 4 → 12+ params (simulationLength, resampleWindow, resampleMethod, initialCapital, tradesPerYear, randomSeed, normalizeTo1Lot, worstCasePercentage, worstCaseMode, worstCaseSizing)

2. **get_correlation_matrix:** 2 → 5 params (alignment, normalization, dateBasis, timePeriod)

3. **get_tail_risk:** 1 → 6 params (tailThreshold, minTradingDays, normalization, dateBasis, strategyFilter, varianceThreshold)

4. **run_walk_forward:** 5 → 10+ params (explicit day mode, expanded optimization targets, trade constraints, normalizeTo1Lot, selectedStrategies)

5. **get_position_sizing:** 2 → 5 params (kellyFraction, maxAllocationPct, includeNegativeKelly)

6. **Tier 1 block tools:**
   - list_backtests: sortBy, sortOrder
   - get_trades: minPl/maxPl, sortBy, sortOrder
   - compare_blocks: metrics filter

All new parameters have sensible defaults for backward compatibility.

**Commits:** acca1a0, 5a45343, 8a42d7d, 8948906, 0f60ded, 106a5fd

---

*Phase: 12-core-integration-layer*
*Plan: 02*
*Tested: 2026-01-14*
