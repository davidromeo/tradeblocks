# Phase 36: Enhanced Comparison - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the existing `compare_backtest_to_actual` MCP tool to provide detailed trade-level comparison between backtest and actual results. The model should be able to:
1. Get trade-level details (entry/exit prices, contracts, reasons for differences)
2. Identify high-slippage outliers automatically
3. Group comparison results by strategy name or by date

This phase builds on Phase 35's reporting log ingestion. Discrepancy classification and trend analysis are separate phases (37, 39).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User delegated all implementation decisions to Claude. Based on codebase exploration:

**Comparison Detail Level:**
- Include all available fields that might explain discrepancies
- Price fields: entry, exit, slippage between backtest and actual
- Execution fields: timestamps, contracts, reason for close, legs
- Context fields (from backtest): VIX levels, gap/movement when available
- Response pattern: summary stats plus full trade list (existing pattern)
- Keep exact date + strategy matching (current behavior works well)
- Enhance existing `compare_backtest_to_actual` tool with `detailLevel` parameter

**Outlier Detection:**
- Use statistical approach (standard deviations from mean slippage) that adapts to data
- Include severity levels (low/medium/high) rather than just boolean
- Return outliers inline with flag, support filtering to outliers-only via parameter
- Include outlier summary stats: count, % of trades, avg outlier slippage, impact

**Grouping Behavior:**
- Add `groupBy` parameter to existing tool: `none` (default), `strategy`, `date`
- Daily granularity for date grouping; optionally support week/month
- Provide aggregated stats per group plus ability to access individual trades
- Default sort by slippage (worst first) to surface problem areas

**Difference Reasons:**
- Field-by-field comparison showing which fields differ and by how much
- Show both raw contract counts and scaling factor used
- Include timing differences when timestamps are reliable
- Show both close reasons, flag when they differ significantly

</decisions>

<specifics>
## Specific Ideas

**Existing code to leverage:**
- `ReportingTrade` model in `packages/lib/models/reporting-trade.ts`
- Current `compare_backtest_to_actual` in `packages/mcp-server/src/tools/performance.ts` (lines 1781-2141)
- Day+strategy aggregation logic already implemented
- Scaling modes (raw, perContract, toReported) already work

**Sample data location:**
- `~/backtests/main-port-2026-ytd/` contains both tradelog and strategylog CSVs
- ReportingTrade fields: strategy, dateOpened/timeOpened, openingPrice, legs, initialPremium, numContracts, pl, closingPrice, dateClosed/timeClosed, avgClosingCost, reasonForClose
- Backtest Trade has additional: VIX levels, gap/movement, maxProfit/maxLoss, margin, commissions

**Key insight from exploration:**
- Current tool aggregates by day+strategy, uses first trade's numContracts as "unit size"
- Need to add option for individual trade-level comparison (not just day aggregates)
- Slippage calculation: `actualPl - scaledBacktestPl`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-enhanced-comparison*
*Context gathered: 2026-01-31*
