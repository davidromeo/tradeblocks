---
phase: 69-black-scholes-greeks-engine
plan: 02
subsystem: api
tags: [black-scholes, greeks, trade-replay, options, ivp, duckdb]

requires:
  - phase: 69-01
    provides: "computeLegGreeks, GreeksResult, solveIV from black-scholes.ts"
  - phase: 68
    provides: "computeStrategyPnlPath, handleReplayTrade, trade-replay pipeline"
provides:
  - "Per-leg greeks (delta, gamma, theta, vega, IV) at each P&L path point"
  - "Net position greeks (netDelta, netGamma, netTheta, netVega) quantity-weighted"
  - "IVP enrichment from market.context per timestamp"
  - "Underlying minute bar fetching and market.intraday caching"
  - "Daily close fallback when minute bars unavailable"
affects: [phase-71-exit-triggers, greeks-analysis, replay-enhancements]

tech-stack:
  added: []
  patterns:
    - "GreeksConfig passed as optional parameter for backwards-compatible greeks enrichment"
    - "Batch INSERT OR REPLACE for market.intraday caching (chunks of 500)"
    - "OCC ticker regex parsing for strike/type/expiry extraction"

key-files:
  created:
    - packages/mcp-server/tests/unit/trade-replay-greeks.test.ts
  modified:
    - packages/mcp-server/src/utils/trade-replay.ts
    - packages/mcp-server/src/tools/replay.ts
    - packages/mcp-server/src/test-exports.ts

key-decisions:
  - "GreeksConfig as optional param keeps computeStrategyPnlPath backwards compatible"
  - "Daily fallback uses date-only key lookup when minute timestamp key misses"
  - "Underlying price uses HL2 mark (high+low)/2 consistent with option mark pricing"
  - "Batch INSERT OR REPLACE in chunks of 500 for market.intraday caching"
  - "greeks=yes/no indicator added to replay summary string"

patterns-established:
  - "OCC ticker parsing regex: /^[A-Z]+(\\d{6})([CP])(\\d{8})$/ for strike/type/expiry"
  - "Reverse root map (SPXW->SPX) for underlying ticker resolution"

requirements-completed: [BS-06, BS-07, BS-08, BS-09, BS-10, BS-11, BS-12]

duration: 4min
completed: 2026-03-22
---

# Phase 69 Plan 02: Greeks Integration Summary

**Per-leg and net greeks wired into replay_trade P&L path with underlying bar fetching, IVP lookup, and market.intraday caching**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T22:22:37Z
- **Completed:** 2026-03-22T22:26:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended PnlPoint with legGreeks array, net position greeks (netDelta/Gamma/Theta/Vega), and IVP
- GreeksConfig interface enables optional greeks computation while maintaining backwards compatibility
- handleReplayTrade now fetches underlying minute bars, caches in market.intraday, queries IVP from market.context
- Daily close fallback when minute bars unavailable from Massive API
- 8 new unit tests covering greeks computation, net aggregation, backwards compat, edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend PnlPoint with greeks and update computeStrategyPnlPath** - `f046952` (feat)
2. **Task 2: Wire underlying bar fetching, caching, IVP lookup, and greeks config into handleReplayTrade** - `09ed603` (feat)

## Files Created/Modified
- `packages/mcp-server/src/utils/trade-replay.ts` - Added GreeksConfig interface, extended PnlPoint with greeks fields, greeks computation in P&L loop
- `packages/mcp-server/src/tools/replay.ts` - Underlying bar fetching, market.intraday caching, IVP lookup, GreeksConfig construction
- `packages/mcp-server/tests/unit/trade-replay-greeks.test.ts` - 8 test cases for greeks integration
- `packages/mcp-server/src/test-exports.ts` - Added GreeksConfig to trade-replay exports

## Decisions Made
- GreeksConfig as optional parameter keeps computeStrategyPnlPath backwards compatible -- existing callers unaffected
- Underlying price uses HL2 mark (high+low)/2, consistent with option mark pricing pattern
- Batch INSERT OR REPLACE in 500-row chunks for market.intraday caching -- balances query size and performance for typical replay (1-5 days of minute bars)
- Reverse root map (SPXW->SPX, NDXP->NDX, RUTW->RUT) for resolving underlying ticker from option OCC tickers
- Daily fallback tries date-only key when minute timestamp key misses in underlying price map

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- replay_trade output now includes complete greeks data at each P&L path point
- Ready for Phase 71 exit trigger analysis that will use greeks for stop/target evaluation
- All existing trade-replay and black-scholes tests continue to pass (72 total across 3 suites)

---
*Phase: 69-black-scholes-greeks-engine*
*Completed: 2026-03-22*
