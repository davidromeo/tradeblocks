---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Massive.com Market Data Integration
status: unknown
stopped_at: Completed 75-03-PLAN.md
last_updated: "2026-03-24T15:04:47.684Z"
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 29
  completed_plans: 28
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Accurate, trustworthy portfolio analytics
**Current focus:** Phase 75 — normalized-vix-term-structure

## Current Position

Phase: 75 (normalized-vix-term-structure) — EXECUTING
Plan: 4 of 4

## Performance Metrics

| Metric | v2.1-b2 | v2.2 (current) |
|--------|---------|----------------|
| Phases | 2 | 3 |
| Plans | 6 | TBD |
| Tests added | 86 | TBD |
| Phase 66 P01 | 179 | 2 tasks | 2 files |
| Phase 66 P02 | 245 | 2 tasks | 3 files |
| Phase 67 P01 | 20 | 2 tasks | 5 files |
| Phase 67 P02 | 25 | 3 tasks | 9 files |
| Phase 67-import-tool-enrichment P03 | 15 | 1 tasks | 2 files |
| Phase 68 P01 | 172 | 1 tasks | 3 files |
| Phase 68 P03 | 213 | 2 tasks | 7 files |
| Phase 68 P02 | 192 | 2 tasks | 4 files |
| Phase 69 P01 | 211 | 1 tasks | 3 files |
| Phase 69 P02 | 255 | 2 tasks | 4 files |
| Phase 70 P01 | 4 | 1 tasks | 2 files |
| Phase 70 P02 | 160 | 3 tasks | 4 files |
| Phase 71 P02 | 238 | 2 tasks | 3 files |
| Phase 71 P01 | 5 | 2 tasks | 2 files |
| Phase 71 P03 | 130 | 2 tasks | 3 files |
| Phase 72 P01 | 232 | 2 tasks | 4 files |
| Phase 72 P02 | 64 | 1 tasks | 1 files |
| Phase 72-exit-policy-comparison P03 | 8 | 2 tasks | 3 files |
| Phase 73 P02 | 86 | 2 tasks | 2 files |
| Phase 73 P01 | 222 | 2 tasks | 3 files |
| Phase 73 P03 | 360 | 2 tasks | 6 files |
| Phase 74 P01 | 116 | 1 tasks | 4 files |
| Phase 74 P03 | 8 | 2 tasks | 2 files |
| Phase 74 P02 | 234 | 2 tasks | 5 files |
| Phase 74 P04 | 1 | 1 tasks | 1 files |
| Phase 75 P01 | 2 | 2 tasks | 2 files |
| Phase 75 P02 | 4 | 2 tasks | 2 files |
| Phase 75 P03 | 4 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

- v2.1 completed (phases 60-65, strategy profiles + portfolio analysis)
- Massive.com REST API chosen over MCP server (structured JSON, fits import pipeline)
- Single `import_from_massive` tool with target_table parameter (mirrors import_market_csv)
- API key via MASSIVE_API_KEY env var (not in conversation history)
- Auto-enrichment after daily imports (reuse existing pipeline unchanged)
- Trade replay broker-independent — no TastyTrade dependency (addresses #234 partially)
- Fixes #248 (broken market data docs reference) in Phase 68
- No new core dependencies — native fetch, AbortSignal.timeout(), existing Zod 4.3.6
- `adjusted=false` explicit in all Massive API calls (prevents retroactive price changes)
- Pagination loop guard using seen-cursor Set + MAX_PAGES=500 (addresses documented Massive bug)
- [Phase 66]: en-CA locale with timeZone America/New_York produces YYYY-MM-DD ET dates without manual string formatting
- [Phase 66]: fromMassiveTicker uses /^[IO]:/ regex to strip I: and O: prefixes in one operation
- [Phase 66]: MassiveAssetClass type enum drives toMassiveTicker prefix selection — callers always use plain tickers
- [Phase 66]: fetchWithRetry reads Retry-After header; falls back to 2^(attempt+1) seconds exponential backoff on 429
- [Phase 66]: fetchBars derives storageTicker via round-trip fromMassiveTicker(toMassiveTicker()) ensuring storage format is always prefix-free
- [Phase 67]: Context merge uses Map<date,row> keyed approach — handles partial data gracefully when dates missing from one index
- [Phase 67]: runContextEnrichment() delegates to private runTier2() without modifying triggerEnrichment semantics
- [Phase 67]: Volume stripped from intraday rows — market.intraday schema has no volume column
- [Phase 67]: computeIVP divides by period-1 (251): compares current against prior days only, not itself
- [Phase 67]: computeIVR returns 50 when range=0: avoids division by zero, semantically middle-of-range
- [Phase 67]: Removed computeVIXPercentile entirely: superseded by computeIVP with cleaner <= semantics
- [Phase 67]: In-memory DuckDB per test for integration tests (no filesystem cleanup needed, faster isolation)
- [Phase 67]: volume column intentionally stripped from market.daily daily import (schema has no volume column — same pattern as intraday)
- [Phase 68]: Root propagation: subsequent spread legs inherit root from first leg in slash-delimited notation
- [Phase 68]: HL2 mark pricing: (high + low) / 2 at each minute bar for option mark price
- [Phase 68]: Spread quantity convention: first leg +1, subsequent alternate -1, +1, -1
- [Phase 68]: Four docs/ guide files (getting-started, market-data, mcp-tools, architecture) per D-14
- [Phase 68]: Fixed #248: broken scripts/README.md refs were in MCP server docs, not root README
- [Phase 68]: Tradelog mode uses date_closed as expiry approximation (best available without explicit expiry in tradelog)
- [Phase 68]: jest.unstable_mockModule for ESM-compatible getConnection mocking in integration tests
- [Phase 69]: Abramowitz & Stegun 26.2.17 CDF approximation for BS module — zero external math dependencies
- [Phase 69]: Newton-Raphson IV solver with bisection fallback when vega < 1e-10; initial guess sigma=0.3
- [Phase 69]: Theta per calendar day (annual/365), vega per 1% IV move (raw/100)
- [Phase 69]: GreeksConfig as optional parameter keeps computeStrategyPnlPath backwards compatible
- [Phase 69]: Underlying bar HL2 mark pricing consistent with option pricing; batch INSERT OR REPLACE for market.intraday caching
- [Phase 70]: Re-implemented getApiKey and fetchWithRetry locally since private in massive-client.ts
- [Phase 70]: INDEX_TICKERS set for asset class detection: SPX, NDX, RUT, DJX, VIX, VIX9D, VIX3M, OEX, XSP
- [Phase 70]: greeks_source provenance field distinguishes API greeks (massive) from BS model greeks (computed)
- [Phase 70]: Handler returns JSON string directly — snapshot tool is stateless API proxy, no DB needed
- [Phase 70]: registerSnapshotTools takes no baseDir — snapshot is pure API proxy
- [Phase 71]: IV change converted decimal to percentage points (*100) since vega is per 1% IV move
- [Phase 71]: Per-leg-group vega uses position-weighted vega: legGreek.vega * quantity * multiplier / 100
- [Phase 71]: 14 exit trigger types as pure evaluator functions against PnlPoint paths; first-to-fire orchestration with actual exit P&L comparison
- [Phase 71]: vix9dVixRatio bidirectional threshold: >= for contango (threshold >= 1), <= for backwardation (threshold < 1)
- [Phase 71]: Both exit analysis tools fetch VIX/VIX9D/underlying price maps on-demand based on trigger types
- [Phase 71]: Composite tool pattern: MCP tool runs replay internally then passes to pure analysis engine
- [Phase 72]: Cache-read returns early from fetchLegBars: avoids Massive API call for already-fetched option bars (BATCH-15)
- [Phase 72]: analyzeBatch noTrigger case: candidatePnl = last pnlPath point (hold to end of replay)
- [Phase 72]: Sharpe ratio trade-level (not annualized): mean/sample stddev (N-1), null if < 2 trades
- [Phase 72]: Test file was created in Plan 72-01 TDD RED phase before implementation — Plan 72-02 confirms all 13 tests pass against pure batch exit analysis engine
- [Phase 72-exit-policy-comparison]: Always pass format:'full' to handleReplayTrade regardless of params.format — params.format controls batch output density, not replay resolution needed by analyzeBatch
- [Phase 72-exit-policy-comparison]: ROW_NUMBER CTE uses ORDER BY date_opened, rowid for deterministic trade_idx when multiple trades share the same date_opened
- [Phase 72-exit-policy-comparison]: Profile context lookup in batch_exit_analysis swallows errors — non-critical informational enrichment
- [Phase 73]: unit=percent returns null when entryCost not provided; dollarThreshold=threshold*abs(entryCost) handles both credit/debit
- [Phase 73]: bachelierTheta sign: annualTheta = -e^(-rT)*sigma_n*n(d)/(2*sqrtT) + r*price (negative for long). Divide by 365 directly without negation.
- [Phase 73]: BACHELIER_DTE_THRESHOLD = 0.5 days: dte < 0.5 uses Bachelier, dte >= 0.5 uses Black-Scholes
- [Phase 73]: iv field in GreeksResult: stores log-normal vol for BS path, normal dollar vol (~hundreds for SPX) for Bachelier path
- [Phase 73]: greeksWarning computed in handleReplayTrade from fullPath (not in computeStrategyPnlPath) to avoid changing pure function signature
- [Phase 73]: skippedTrades array replaces opaque skippedCount in batch_exit_analysis for detailed error reporting per D-15
- [Phase 74]: Math.abs(threshold) in stopLoss normalizes negative user-supplied thresholds before comparison
- [Phase 74]: BACHELIER_DTE_THRESHOLD lowered from 0.5 to 0.1 — BS+bisection now works reliably to ~2.4 hours
- [Phase 74]: GreeksResult.model field added ('bs' | 'bachelier'); undefined only when IV solve fails
- [Phase 74]: Midpoint greeks use (cur+next)/2 average; fall back to cur when next is null (D-05/D-06)
- [Phase 74]: Numerical fallback activates when pnlPath.length > 2 AND model residual > 80% of totalPnlChange (D-09)
- [Phase 74]: time_and_vol factor in numerical mode absorbs theta+vega+unexplained; method field distinguishes model vs numerical (D-10/D-11)
- [Phase 74]: fetchBarsWithCache accepts optional DuckDBConnection to avoid repeated getConnection calls in hot paths
- [Phase 74]: sortedTimestamps built from intraday keys only; date-only fallback keys excluded from binary search
- [Phase 74]: findNearestTimestamp uses minutes-since-midnight (HH:MM); sub-minute precision not needed for 1-min bars
- [Phase 74]: mapWithLimit uses worker-pool pattern (N workers competing for idx++) for order-stable parallel replay
- [Phase 74]: MAX_CONCURRENT_REPLAYS = 5 caps concurrent Massive API/DuckDB calls (batch parallelism)
- [Phase 75]: migrateContextToNormalized uses vixDailyCount > 0 as idempotency check — skips migration if VIX rows already exist in market.daily
- [Phase 75]: INSERT OR IGNORE (DuckDB dialect) used for idempotent inserts in migration; market.context preserved intact for backward compatibility
- [Phase 75]: runTier2 uses DEFAULT_MARKET_TICKER (SPX) for Return_20D join to derive Trend_Direction
- [Phase 75]: Context import tracks metadata per-ticker as import_from_massive:daily:VIX/VIX9D/VIX3M (not bulk context)
- [Phase 75]: Backward compat: market.context still gets Tier 2 writes in try/catch during transition — will be removed in future phase
- [Phase 75]: VIX_FIELD_MAPPINGS drives JOIN generation and SELECT column aliasing — adding any new VIX ticker to the array automatically extends both JOIN and SELECT clauses in buildLookaheadFreeQuery
- [Phase 75]: CONTEXT_OPEN/CLOSE_FIELDS export names preserved in field-timing.ts — derived from VIX_FIELD_MAPPINGS + _context_derived columns for backward compat with all downstream tools

### Roadmap Evolution

- Phase 73 added: 0DTE Greeks Engine + Exit Trigger Usability (DTE bug fix, Bachelier model, unit field for triggers, greeks warnings, UX fixes)
- Phase 74 added: Pre-ship Polish — stopLoss abs, shared fetchBarsWithCache, midpoint greeks attribution, tolerant timestamp lookup, numerical greeks fallback, lower Bachelier threshold, model field in GreeksResult, parallel batch replay
- Phase 75 added: Normalized VIX Term Structure — replace hardcoded VIX9D/VIX3M columns with market.vix_term_structure, support any tenor, context as pivoted view

### Pending Todos

None.

### Blockers/Concerns

- Phase 67 planning note: options ticker canonicalization via Massive reference/contracts endpoint — confirm response format before coding lookup step
- Phase 66 validation: I:VIX ticker format for aggregates endpoint is inferred from unified snapshot docs; verify with live API call during implementation (low risk — HTTP 200 with 0 rows is detectable)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260322-ubp | Forward-fill sparse bars, OO date range derivation, index root fallback map | 2026-03-22 | f23f8fe | [260322-ubp](./quick/260322-ubp-fix-3-trade-replay-improvements-oo-date-/) |
| 260324-gd1 | Add cache-read for underlying intraday bars in replay.ts | 2026-03-24 | 9f259f2 | [260324-gd1](./quick/260324-gd1-add-cache-read-for-underlying-intraday-b/) |

## Session Continuity

Last session: 2026-03-24T15:04:47.681Z
Stopped at: Completed 75-03-PLAN.md
Resume file: None
