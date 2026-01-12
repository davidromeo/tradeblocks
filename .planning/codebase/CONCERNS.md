# Codebase Concerns

**Analysis Date:** 2026-01-11

## Tech Debt

**Console.log statements in production code:**
- Issue: Multiple console.log statements in critical calculation functions
- Files: `lib/stores/block-store.ts` (lines 514-543), `lib/processing/trade-processor.ts`, `lib/services/performance-snapshot.ts`
- Why: Development debugging left in place
- Impact: Noisy console output, potential performance impact in production
- Fix approach: Replace with proper logging library or remove for production

**Large, complex files exceeding 1000+ lines:**
- Issue: Several files have grown too large with mixed concerns
- Files:
  - `components/block-dialog.tsx` (2347 lines) - CSV parsing, validation, stats calculation, UI
  - `app/(platform)/risk-simulator/page.tsx` (1908 lines) - Complex page component
  - `lib/stores/trading-calendar-store.ts` (1181 lines) - Complex state management
  - `lib/calculations/monte-carlo.ts` (1181 lines) - Complex numerical calculations
- Why: Features added incrementally without refactoring
- Impact: Hard to test, difficult to maintain, cognitive load
- Fix approach: Extract concerns into smaller, focused modules

**Empty catch blocks swallowing errors:**
- Issue: Some catch blocks don't log or handle errors
- Files: `lib/stores/walk-forward-store.ts` (lines 590, 863)
- Why: Quick error suppression during development
- Impact: Hides failures, makes debugging difficult
- Fix approach: Add error logging to all catch blocks

## Known Bugs

**Test failures in calendar data scaling:**
- Symptoms: getScaledDayBacktestPl() returns unscaled values in toReported mode
- Trigger: Run `npm test` - 6 tests failing
- Files:
  - `lib/services/calendar-data.ts` - scaling functions
  - `tests/unit/calendar-data.test.ts` (lines 915, 1022, 1099, 1130)
- Workaround: None - feature affected
- Root cause: Scaling logic not applying contract ratio factor
- Fix: Review and correct scaling implementation in `lib/services/calendar-data.ts`

**Leg group maxLoss calculation missing:**
- Symptoms: combineLegGroup() returns undefined maxLoss for debit spreads
- Trigger: Run `npm test` - test at line 61 failing
- Files:
  - `lib/utils/combine-leg-groups.ts`
  - `tests/lib/utils/combine-leg-groups.test.ts`
- Workaround: None
- Root cause: maxLoss not calculated when no explicit value and no margin
- Fix: Add fallback to premium paid for maxLoss calculation

## Security Considerations

**No concerns detected:**
- No dangerouslySetInnerHTML usage found
- No XSS vulnerabilities detected
- No API keys or secrets in codebase
- Input validation via Zod schemas at data boundaries
- All data processing is client-side only

## Performance Bottlenecks

**Large array operations on trade datasets:**
- Problem: Multiple iterations over potentially thousands of trades
- Files:
  - `lib/calculations/correlation.ts` - Creates objects for all strategy/date combinations
  - `lib/utils/combine-leg-groups.ts` - Iterates through trades multiple times
- Measurement: Not profiled with large datasets
- Cause: No optimization for large datasets
- Improvement path: Profile with 10k+ trades, consider Web Workers for heavy calculations

**IndexedDB cache without TTL:**
- Problem: Cache entries stored without expiration or cleanup strategy
- Files: `lib/db/combined-trades-cache.ts`, `lib/db/performance-snapshot-cache.ts`
- Measurement: Storage grows without bound
- Cause: No explicit TTL or cache eviction policy
- Improvement path: Implement cache size limits or TTL-based cleanup

## Fragile Areas

**Trading calendar scaling logic:**
- Files: `lib/services/calendar-data.ts`, `lib/stores/trading-calendar-store.ts`
- Why fragile: Complex state transformations, multiple scaling modes
- Common failures: Scaling factors not applied correctly, strategy matching issues
- Safe modification: Ensure comprehensive test coverage before changes
- Test coverage: Tests exist but 4+ are failing

**Block recalculation flow:**
- File: `lib/stores/block-store.ts` (recalculateBlock function)
- Why fragile: Many steps, cache invalidation, state updates
- Common failures: Cache not invalidated, partial state updates
- Safe modification: Follow existing pattern, test thoroughly
- Test coverage: Integration tests cover full flow

## Scaling Limits

**IndexedDB browser storage:**
- Current capacity: Browser-dependent (typically 50-500MB per origin)
- Limit: Varies by browser (Chrome ~60% of disk, Firefox ~10% of disk)
- Symptoms at limit: Storage quota exceeded errors
- Scaling path: Implement data archiving or export for large portfolios

**Client-side calculations:**
- Current capacity: Depends on browser memory
- Limit: Large portfolios (10k+ trades) may slow down
- Symptoms at limit: UI freezes during calculations
- Scaling path: Web Workers for heavy calculations, pagination for large datasets

## Dependencies at Risk

**No critical dependency risks detected:**
- All dependencies current and maintained
- Next.js 16.0.7 (latest stable)
- React 19.2.1 (latest)
- TypeScript 5 (latest)

## Missing Critical Features

**None identified as critical gaps:**
- Core functionality appears complete for trading analysis use case

## Test Coverage Gaps

**Component/UI testing:**
- What's not tested: React components, chart rendering
- Risk: UI regressions not caught by tests
- Priority: Low (per project guidance - UI validation manual)
- Difficulty to test: Would need setup for React Testing Library with charts

**Error boundary behavior:**
- What's not tested: How app behaves when components throw errors
- Risk: White screen of death for users
- Priority: Medium
- Difficulty to test: Need to intentionally trigger errors in test environment

---

*Concerns audit: 2026-01-11*
*Update as issues are fixed or new ones discovered*
