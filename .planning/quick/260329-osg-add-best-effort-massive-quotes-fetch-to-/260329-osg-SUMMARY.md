---
phase: quick
plan: 260329-osg
subsystem: mcp-server/providers
tags: [massive, quotes, bid-ask, options, intraday]
dependency_graph:
  requires: [markPrice helper (260329-nqf)]
  provides: [bid/ask population in BarRow for option intraday bars]
  affects: [trade replay via markPrice helper — now prefers (bid+ask)/2 over HL2 for option bars]
tech_stack:
  added: []
  patterns: [best-effort fetch, Zod schema validation, nanosecond timestamp conversion]
key_files:
  created: []
  modified:
    - packages/mcp-server/src/utils/providers/massive.ts
    - packages/mcp-server/src/test-exports.ts
    - packages/mcp-server/tests/unit/providers/massive.test.ts
decisions:
  - "fetchQuotesForBars uses direct fetch (not fetchWithRetry) — 403/429 are expected degradation signals, not retry candidates"
  - "Best-effort: any HTTP error or network exception returns empty Map; bars always returned without crashing"
  - "last quote wins per minute: order=asc pagination so later iteration overwrites earlier Map entries"
  - "nanosToETMinuteKey exported for testability; same helpers (massiveTimestampToETDate/Time) reused for consistency"
  - "Guard: assetClass === 'option' && timespan !== 'day' && allRows.length > 0 before quotes fetch"
metrics:
  duration: 15
  completed_date: "2026-03-29"
  tasks: 1
  files_modified: 3
---

# Quick Task 260329-osg: Add Best-Effort Massive Quotes Fetch to Option Intraday Bars

**One-liner:** Best-effort /v3/quotes fetch after bar pagination merges bid/ask into option intraday BarRows by "YYYY-MM-DD HH:MM" ET minute key, silently degrading on 403/429/network errors.

## What Was Done

Added historical bid/ask enrichment to `MassiveProvider.fetchBars` for option intraday bars. After the existing bar pagination loop completes, a new `fetchQuotesForBars` private method calls `/v3/quotes/{ticker}` and builds a `Map<minuteKey, {bid, ask}>`. Bars with matching minute keys get `bid`/`ask` set; bars without matches retain `undefined`. Any failure (403 tier restriction, 429 rate limit, network error, schema parse failure) silently returns an empty Map — bars are always returned.

## Commits

| Hash | Description |
|------|-------------|
| ede1151 | feat(260329-osg): add best-effort quotes fetch to enrich option intraday bars with bid/ask |

## New Exports

| Symbol | Type | Description |
|--------|------|-------------|
| `MassiveQuoteSchema` | Zod schema | Validates individual quote objects (bid_price, ask_price, sip_timestamp, bid_size, ask_size, sequence_number) |
| `MassiveQuotesResponseSchema` | Zod schema | Validates /v3/quotes response (status, request_id, results[], next_url?) |
| `nanosToETMinuteKey` | function | Converts nanosecond sip_timestamp to "YYYY-MM-DD HH:MM" ET key |
| `MassiveQuote` | type | Inferred from MassiveQuoteSchema |
| `MassiveQuotesResponse` | type | Inferred from MassiveQuotesResponseSchema |

## Tests

13 new tests across 4 new describe blocks:
- `MassiveQuoteSchema` — 4 tests (valid, missing bid_price, string timestamp, missing sequence_number)
- `MassiveQuotesResponseSchema` — 4 tests (valid, next_url, default empty results, missing status)
- `nanosToETMinuteKey` — 2 tests (EST and EDT conversion)
- `Quotes enrichment` — 7 tests (merge, last-quote-wins, no match, skip daily, skip non-option, 403, 429, network error)

Total: 72 tests passing (59 existing + 13 new).

## Deviations from Plan

None — plan executed exactly as written. TDD approach: tests written first confirmed failures, then implementation made all pass.

## Self-Check: PASSED

- FOUND: packages/mcp-server/src/utils/providers/massive.ts
- FOUND: packages/mcp-server/tests/unit/providers/massive.test.ts
- FOUND commit: ede1151
