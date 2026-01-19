# Phase 25 Plan 01: Treasury Data Summary

**Implemented historical Treasury rate data and lookup utility for date-based risk-free rate calculations, enabling accurate Sharpe/Sortino ratios.**

## TDD Cycle

### RED
- Created comprehensive test suite with 20 test cases covering:
  - In-range date lookup returns actual rate
  - Before-range fallback to earliest available rate
  - After-range fallback to latest available rate
  - Weekend/holiday fallback to most recent prior trading day
  - Helper functions (getEarliestRateDate, getLatestRateDate, getRateDataRange)
  - Rate value sanity checks (COVID crash near-zero rates, 2023 rate hikes)
- Tests failed as expected: module `@/lib/utils/risk-free-rate` did not exist

### GREEN
- Downloaded DTB3 series from FRED (Federal Reserve Economic Data)
- Created `lib/data/treasury-rates.ts` with 3,250 daily rate entries
- Implemented `lib/utils/risk-free-rate.ts` with:
  - `getRiskFreeRate(date)`: O(1) hash lookup for trading days, O(log n) binary search for weekends/holidays
  - `getEarliestRateDate()`: Returns 2013-01-02
  - `getLatestRateDate()`: Returns 2025-12-31
  - `getRateDataRange()`: Returns { start, end } date range
  - `formatDateToKey(date)`: Helper for YYYY-MM-DD string conversion
- All 20 tests pass

### REFACTOR
- No refactoring needed. Implementation is clean with:
  - Lazy caching of sorted keys for performance
  - Proper documentation following project conventions
  - Binary search for efficient weekend/holiday lookups

## Files Created/Modified

- `lib/data/treasury-rates.ts` - Static rate data (3,260 entries, ~71KB)
- `lib/utils/risk-free-rate.ts` - Lookup utility with fallback behavior
- `tests/unit/risk-free-rate.test.ts` - Test suite (20 tests)

## Data Stats

- **Date range:** 2013-01-02 to 2026-01-15
- **Number of entries:** 3,260 daily trading day rates
- **Data source:** FRED DTB3 (Federal Reserve Economic Data)
- **File size:** ~71KB
- **Rate range observed:** 0.01% (2020 COVID crash) to 5.36% (2023 rate hikes)

## Verification

- [x] `npm test -- tests/unit/risk-free-rate.test.ts` - 20/20 tests pass
- [x] `npm run build` - Successful compilation
- [x] Rate values in reasonable range (0-20%)
- [x] Fallback behavior works for out-of-range dates

## Commits

1. `51dbdbe` - test(25-01): add failing tests for risk-free rate lookup
2. `80122d1` - feat(25-01): implement treasury rate data and lookup utility
3. `b5678e9` - feat(25-01): add 2026 Treasury rates and update documentation

## Next Step

Ready for Phase 26: Core Calculations - Update Sharpe/Sortino ratio calculations to use actual Treasury rates instead of fixed 2% assumption.
