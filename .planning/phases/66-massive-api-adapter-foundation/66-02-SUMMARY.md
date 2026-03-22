---
phase: 66-massive-api-adapter-foundation
plan: "02"
subsystem: mcp-server/utils
tags: [massive-api, http-client, fetch, pagination, rate-limiting, zod-validation, unit-tests]
dependency_graph:
  requires:
    - 66-01 (MassiveBarSchema, MassiveAggregateResponseSchema, MassiveBarRow, toMassiveTicker, fromMassiveTicker, massiveTimestampToETDate, MASSIVE_BASE_URL, MASSIVE_MAX_LIMIT, MASSIVE_MAX_PAGES)
  provides:
    - fetchBars
    - FetchBarsOptions
  affects:
    - packages/mcp-server/src/utils/massive-client.ts (extended with HTTP layer)
    - packages/mcp-server/src/test-exports.ts (massive-client exports added)
    - packages/mcp-server/tests/unit/massive-client-fetch.test.ts (created)
tech_stack:
  added: []
  patterns:
    - native fetch with AbortSignal.timeout(30_000) for per-request timeout
    - jest.spyOn(globalThis, 'fetch') for HTTP mocking in ESM test environment
    - jest.useFakeTimers() with runAllTimersAsync() for retry backoff testing
    - Retry-After header with exponential fallback for 429 handling
    - Set<string> cursor tracking for pagination loop detection
key_files:
  created:
    - packages/mcp-server/tests/unit/massive-client-fetch.test.ts
  modified:
    - packages/mcp-server/src/utils/massive-client.ts
    - packages/mcp-server/src/test-exports.ts
decisions:
  - "fetchWithRetry reads Retry-After header; falls back to 2^(attempt+1) seconds exponential backoff"
  - "fetchBars derives storageTicker via fromMassiveTicker(toMassiveTicker(ticker, assetClass)) — round-trip through API format ensures storage format is always prefix-free"
  - "jest.useFakeTimers() + runAllTimersAsync() used in retry tests to avoid real delays"
  - "maxRetries=2 in fetchWithRetry means 1 retry before throwing on 429"
metrics:
  duration_seconds: 245
  completed_date: "2026-03-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
  tests_added: 18
---

# Phase 66 Plan 02: Massive API HTTP Client — fetchBars() and Unit Tests Summary

**One-liner:** Native fetch HTTP client for Massive.com aggregates endpoint with 429 retry/backoff, pagination loop guard via seen-cursor Set, Zod response validation, and 18 unit tests covering auth, URL construction, response parsing, pagination, rate limiting, and HTTP errors.

## What Was Built

Extended `packages/mcp-server/src/utils/massive-client.ts` with the HTTP layer (Plan 01 established the pure utility layer). Added the `fetchBars()` function and supporting internals.

### New Exports

| Export | Kind | Purpose |
|--------|------|---------|
| `fetchBars` | async function | Main HTTP client for Massive aggregates endpoint |
| `FetchBarsOptions` | Interface | Input options: ticker, from, to, timespan, multiplier, assetClass |

### Internal Helpers (not exported)

| Helper | Purpose |
|--------|---------|
| `getApiKey()` | Read `MASSIVE_API_KEY` at call site; throw descriptive error if missing |
| `fetchWithRetry()` | Single fetch with 429 retry using Retry-After or exponential backoff |

### fetchBars() Behavior

- **Auth:** Reads `MASSIVE_API_KEY` from env at call site (D-01). Throws `"Set MASSIVE_API_KEY environment variable to use Massive.com data import"` if missing (D-03). Sends `Authorization: Bearer <key>` header.
- **URL:** Builds `${MASSIVE_BASE_URL}/v2/aggs/ticker/${apiTicker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=false&limit=50000` (D-06).
- **Ticker:** Converts via `toMassiveTicker(ticker, assetClass)` for API, stores via `fromMassiveTicker(apiTicker)` — callers pass plain tickers.
- **Timeout:** `AbortSignal.timeout(30_000)` on every fetch call.
- **401:** Throws `"MASSIVE_API_KEY rejected by Massive.com — check your key"` (D-03).
- **429:** Retries up to 2 times with `Retry-After` header value or exponential backoff. Throws `"Massive.com rate limit exceeded — try again in a few minutes"` after exhaustion.
- **Pagination:** Follows `next_url` collecting all pages. Guards against Massive's documented loop bug (polygon-io#289) using `seenCursors: Set<string>` — throws `"Pagination loop detected"` on cursor repeat. Throws after `MASSIVE_MAX_PAGES=500` pages.
- **Validation:** `MassiveAggregateResponseSchema.safeParse(json)` on every page. Throws `"Massive API response validation failed: {field}: {message}"` on schema drift.
- **Mapping:** `massiveTimestampToETDate(bar.t)` for dates, `fromMassiveTicker` for storage tickers.

## Tests Created

`packages/mcp-server/tests/unit/massive-client-fetch.test.ts` — 18 tests across 6 describe blocks:

| Block | Tests | Coverage |
|-------|-------|----------|
| `API key handling` | 3 | Missing key error, Bearer header sent, 401 error message |
| `URL construction` | 4 | I:VIX URL encoding, default timespan/multiplier, custom timespan/multiplier, stock without prefix |
| `response parsing` | 3 | ET date conversion (Unix ms → 2025-01-07), I: prefix stripped in rows, empty results array |
| `Zod validation` | 2 | Malformed response, nested field path in error |
| `pagination` | 3 | Multi-page collection, loop guard (repeated cursor), MAX_PAGES guard |
| `rate limiting` | 2 | Retry then succeed, throw after max retries |
| `HTTP errors` | 1 | 500 with status code in message |

**Result:** 18/18 passing, 0 failures.

**Setup pattern:** `jest.spyOn(globalThis, 'fetch')` per STACK.md recommendation. Env var isolation via `process.env = { ...ORIG_ENV }` / restore in `afterEach`. `jest.useFakeTimers()` + `runAllTimersAsync()` for retry backoff tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed fake timer test pattern for "throws after max retries on 429"**
- **Found during:** Task 2 — first test run
- **Issue:** `await jest.runAllTimersAsync()` then `await expect(...).rejects.toThrow()` pattern caused an unhandled rejection because the promise settled before the second `await` could catch it
- **Fix:** Changed to `const errorPromise = expect(...).rejects.toThrow(...)` then `await jest.runAllTimersAsync(); await errorPromise;` — this lets Jest track the rejection before timers run
- **Files modified:** `packages/mcp-server/tests/unit/massive-client-fetch.test.ts`
- **Commit:** b1e893c (same task commit, fixed before finalizing)

## Known Stubs

None — fetchBars() is fully implemented with no placeholders or TODOs.

## Self-Check: PASSED

- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `export async function fetchBars(`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `export interface FetchBarsOptions`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `process.env.MASSIVE_API_KEY`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `"Set MASSIVE_API_KEY environment variable`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `Authorization: \`Bearer ${apiKey}\``
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `adjusted=false`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `seenCursors`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `Pagination loop detected`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `MASSIVE_MAX_PAGES`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `429`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `MASSIVE_API_KEY rejected by Massive.com`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `MassiveAggregateResponseSchema.safeParse`
- [x] `packages/mcp-server/src/utils/massive-client.ts` contains `AbortSignal.timeout`
- [x] `packages/mcp-server/src/test-exports.ts` contains `from './utils/massive-client.js'` and `fetchBars`
- [x] Commit `a217c75` exists (fetchBars implementation)
- [x] Commit `b1e893c` exists (unit tests)
- [x] TypeScript compiles with zero errors
- [x] 18 unit tests pass, 0 failures
- [x] Combined with Plan 01: 42 total tests, 0 failures
