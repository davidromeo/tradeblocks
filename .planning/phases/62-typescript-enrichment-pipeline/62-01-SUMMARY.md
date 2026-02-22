---
phase: 62-typescript-enrichment-pipeline
plan: "01"
subsystem: mcp-server
tags: [indicators, enrichment, tdd, pure-functions, wilder-rsi, atr, ema, bollinger-bands, realized-vol, vix]
dependency_graph:
  requires: []
  provides:
    - market-enricher.ts with 14 exported pure indicator functions
    - dist/test-exports.js re-exports for unit test access
  affects:
    - packages/mcp-server/src/utils/market-enricher.ts (NEW)
    - packages/mcp-server/src/test-exports.ts (updated)
    - packages/mcp-server/tests/unit/market-enricher.test.ts (NEW)
tech_stack:
  added: []
  patterns:
    - Pure TypeScript indicator functions (no DB access, no side effects)
    - TDD RED-GREEN cycle with hand-verified fixture values
    - dist/test-exports.js import pattern (same as field-timing, intraday-timing)
    - Population stddev (N denominator) for Bollinger Bands and Realized Vol
    - Wilder smoothing with SMA seed (TradingView convention)
key_files:
  created:
    - packages/mcp-server/src/utils/market-enricher.ts
    - packages/mcp-server/tests/unit/market-enricher.test.ts
  modified:
    - packages/mcp-server/src/test-exports.ts
decisions:
  - RSI seeds from SMA of first period changes (bars 1..period), then Wilder smoothing
  - ATR seeds from SMA of first period TR values, first valid ATR at index=period
  - EMA seeds from SMA of first period closes (TradingView convention, not close[0])
  - Realized Vol first valid at i=period (window [i-period+1..i] of log returns, which start at index 1)
  - computeTrendScore condition 5 uses prior 20-day high excluding today; skips 5th condition (score 0) if i < 20
  - classifyTermStructure flatness: both VIX9D/VIX and VIX/VIX3M ratios within 1% of 1.0
  - computeVIXDerivedFields returns null (not NaN) for first-row pct fields (matching interface EnrichedContextRow)
  - Two test assertions corrected: RSI Wilder drop and RealizedVol first valid index (implementation correct, tests adjusted)
metrics:
  duration: "6 min"
  completed: "2026-02-22"
  tasks_completed: 1
  files_changed: 3
---

# Phase 62 Plan 01: Pure TypeScript Indicator Functions Summary

Pure TypeScript indicator functions for the Phase 62 enrichment pipeline — validated with 84 unit tests using hand-verified datasets. The computational core of the market enrichment pipeline, ready for Plan 02 to wire into DuckDB.

## What Was Built

`packages/mcp-server/src/utils/market-enricher.ts` — 14 exported pure functions:

**Primitive Indicators:**
- `computeRSI(closes, period)` — Wilder RSI with SMA seed; first `period` entries NaN
- `computeATR(highs, lows, closes, period)` — Wilder ATR; first `period` entries NaN
- `computeEMA(closes, period)` — EMA with SMA seed; first `period-1` entries NaN
- `computeSMA(closes, period)` — Rolling SMA; first `period-1` entries NaN

**Composite Indicators:**
- `computeBollingerBands(closes, period, multiplier)` — Population stddev; first `period-1` entries null
- `computeRealizedVol(closes, period)` — Log returns, population stddev, annualized
- `computeTrendScore(closes, ema21, sma50, rsi14)` — Integer -5 to +5 from 5 conditions
- `computeConsecutiveDays(closes)` — Streak counter with sign and flat-day reset

**Row-Level Helpers:**
- `isGapFilled(open, high, low, priorClose)` — Returns 0 or 1
- `isOpex(dateStr)` — 3rd Friday detection via string parsing (timezone-safe)

**Tier 2 VIX Functions:**
- `computeVIXDerivedFields(rows)` — Pct changes, ratios, spike from context rows
- `classifyVolRegime(vixClose)` — 1-6 classification by VIX level
- `classifyTermStructure(vix9dClose, vixClose, vix3mClose)` — Contango/backwardation/flat
- `computeVIXPercentile(vixCloses, period)` — Rolling rank as count(v < current) / period * 100

## Test Coverage

84 unit tests across all 14 functions:
- Hand-verified computations (no external data dependency)
- Edge cases: empty arrays, insufficient data, flat prices, exact boundaries
- All-up RSI=100, all-down RSI=0 verified
- Population vs sample stddev verified for realized vol and Bollinger Bands
- isOpex verified for specific known third Fridays in 2025

## TDD Commits

| Commit | Hash | Phase |
|--------|------|-------|
| test(62-01): add failing indicator function tests | cc1c28d | RED |
| feat(62-01): implement pure indicator functions | 22482c5 | GREEN |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture assertions corrected (implementation was correct)**

- **Found during:** GREEN phase (test run)
- **Issue:** Two test assertions were based on incorrect assumptions about behavior:
  1. RSI Wilder smoothing test assumed RSI > 50 after 15 up days + 1 large down day, but Wilder's formula correctly drops RSI to ~46.43 when loss is 15x the avg gain
  2. Realized Vol "first period NaN" test expected NaN at index 5 (period=5) but the implementation correctly computes at index 5 (window [1..5] of log returns is valid)
- **Fix:** Corrected test assertions to match mathematically correct implementation behavior; added explanatory comments showing the actual formula verification
- **Files modified:** `packages/mcp-server/tests/unit/market-enricher.test.ts`
- **Commit:** 22482c5 (included in GREEN commit)

## Self-Check: PASSED

All created files exist:
- FOUND: packages/mcp-server/src/utils/market-enricher.ts
- FOUND: packages/mcp-server/tests/unit/market-enricher.test.ts
- FOUND: packages/mcp-server/src/test-exports.ts (modified)

All commits exist:
- FOUND: cc1c28d (RED: test(62-01): add failing indicator function tests)
- FOUND: 22482c5 (GREEN: feat(62-01): implement pure indicator functions)
