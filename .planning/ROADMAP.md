# Roadmap: TradeBlocks

## Milestones

- ✅ **v2.6 DuckDB Analytics Layer** — Phases 41-45 (shipped 2026-02-04)
- ✅ **v2.7 Edge Decay Analysis** — Phases 46-50 (shipped 2026-02-06)
- ✅ **v2.8 Market Data Consolidation** — Phases 51-54 (shipped 2026-02-07)
- ✅ **v2.9 Lookahead-Free Market Analytics** — Phases 55-59 (shipped 2026-02-09)
- ✅ **v2.1 Strategy Profiles (beta 1)** — Phases 60-63 (shipped 2026-03-06)
- ✅ **v2.1 Profile Schema V2 & Portfolio Analysis (beta 2)** — Phases 64-65 (shipped 2026-03-08)
- 🚧 **v2.2 Massive.com Market Data Integration** — Phases 66-74 (in progress)

See [MILESTONES.md](MILESTONES.md) for full history.

<details>
<summary>✅ v2.9 Lookahead-Free Market Analytics (Phases 55-59) — SHIPPED 2026-02-09</summary>

- [x] Phase 55: Field Classification Foundation (1/1 plans) — completed 2026-02-08
- [x] Phase 56: Fix Existing Tools (1/1 plans) — completed 2026-02-08
- [x] Phase 57: Restore enrich_trades (1/1 plans) — completed 2026-02-08
- [x] Phase 58: Schema Metadata + Documentation (1/1 plans) — completed 2026-02-08
- [x] Phase 59: Intraday Market Context Enrichment (1/1 plans) — completed 2026-02-08

</details>

<details>
<summary>✅ v2.1 Strategy Profiles — beta 1 (Phases 60-63) — SHIPPED 2026-03-06</summary>

- [x] Phase 60: Profile Storage (1/1 plans) — completed 2026-03-04
- [x] Phase 61: Profile CRUD Tools (1/1 plans) — completed 2026-03-05
- [x] Phase 62: Structure-Aware Analysis Tools (3/3 plans) — completed 2026-03-05
- [x] Phase 63: Eliminate block.json (2/2 plans) — completed 2026-03-06

</details>

<details>
<summary>✅ v2.1 Profile Schema V2 & Portfolio Analysis — beta 2 (Phases 64-65) — SHIPPED 2026-03-08</summary>

- [x] Phase 64: Schema V2 (2/2 plans) — completed 2026-03-08
- [x] Phase 65: Portfolio Analysis Tools (4/4 plans) — completed 2026-03-08

</details>

## v2.2: Massive.com Market Data Integration

**Milestone Goal:** Add Massive.com REST API as an optional market data source, eliminating manual CSV export/import for users with a Massive subscription. Deliver broker-independent trade replay with MFE/MAE analysis. Fix market data documentation gaps.

## Phases

- [x] **Phase 66: Massive API Adapter Foundation** — Build and unit-test `massive-client.ts` in isolation: timestamps, pagination guard, ticker normalization, Zod validation, rate limit detection, API key check (completed 2026-03-22)
- [x] **Phase 67: Import Tool & Enrichment** — Register `import_from_massive` MCP tool; wire daily OHLCV, VIX context (3-call merge), intraday bars, auto-enrichment; add IVR/IVP fields to Tier 2; remove Bollinger Bands from Tier 1 (completed 2026-03-22)
- [x] **Phase 68: Trade Replay & Documentation** — Build `replay_trade` MCP tool (OCC ticker resolution, multi-leg P&L path, MFE/MAE); market data docs overhaul fixing #248 (completed 2026-03-22)
- [x] **Phase 69: Black-Scholes Greeks Engine** — Pure BS greeks computation (delta, gamma, theta, vega, IV) + IV solver, wired into replay_trade with underlying bar fetching, caching, IVP lookup (completed 2026-03-22)
- [x] **Phase 70: Live Options Snapshot** — Integrate Massive /v3/snapshot/options endpoint for current greeks, IV, and open interest on active positions (completed 2026-03-22)
- [x] **Phase 71: Exit Trigger Analysis** — Port analyze_exit_triggers and decompose_greeks from TastyTrade MCP to TradeBlocks using replay + greeks data (completed 2026-03-23)
- [x] **Phase 72: Exit Policy Comparison** — Batch exit analysis tool for multi-trade policy testing across entire blocks (completed 2026-03-23)
- [x] **Phase 73: 0DTE Greeks Engine + Exit Trigger Usability** — Fix DTE bug, Bachelier normal model fallback, percentage-based exit triggers, greeks warnings, UX fixes (completed 2026-03-24)
- [ ] **Phase 74: Pre-ship Polish** — stopLoss abs fix, shared fetchBarsWithCache, midpoint greeks attribution, tolerant timestamp lookup, numerical fallback, lower Bachelier threshold, model field, parallel batch replay

## Phase Details

### Phase 66: Massive API Adapter Foundation
**Goal**: A fully tested HTTP adapter exists that can fetch and translate Massive.com bar data correctly, safely, and without data integrity failures
**Depends on**: Phase 65 (v2.1 shipped)
**Requirements**: API-01, API-02, API-03, API-04, API-05, API-06, API-07, IMP-07, TST-01
**Success Criteria** (what must be TRUE):
  1. Calling the client with a valid ticker, date range, and API key returns rows with YYYY-MM-DD date strings in Eastern Time (not Unix milliseconds, no UTC off-by-one)
  2. A repeated `next_url` cursor terminates with a clear error rather than looping indefinitely
  3. Ticker normalization converts `VIX` to `I:VIX` for API calls and back to `VIX` for storage; OCC-format options tickers pass through unchanged
  4. A Zod-invalid API response is rejected with a descriptive parse error before any rows reach DuckDB
  5. An HTTP 429 response surfaces a human-readable rate limit error (not an unhandled rejection)
  6. Calling the client without `MASSIVE_API_KEY` set returns an error message that names the missing variable
**Plans**: 2 plans
Plans:
- [x] 66-01-PLAN.md — Types, Zod schemas, ticker normalization, timestamp conversion + unit tests
- [x] 66-02-PLAN.md — fetchBars() HTTP client with pagination, auth, rate limiting + unit tests

### Phase 67: Import Tool & Enrichment
**Goal**: Users can import market data from Massive.com via a single MCP tool, and enrichment produces accurate IVR/IVP fields for VIX term structure without Bollinger Band noise
**Depends on**: Phase 66
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, IMP-08, ENR-01, ENR-02, ENR-03, ENR-04, ENR-05, TST-02
**Success Criteria** (what must be TRUE):
  1. `import_from_massive` with `target_table: "daily"` fetches OHLCV bars for any stock or index ticker and upserts them into `market.daily` without duplicates on re-import
  2. `import_from_massive` with `target_table: "context"` makes three API calls (VIX, VIX9D, VIX3M), merges by date, and upserts into `market.context` in one operation
  3. `import_from_massive` with `target_table: "intraday"` stores minute bars with the requested timespan (1m, 5m, 15m, 1h) in `market.intraday`
  4. After a daily import, enrichment runs automatically and `market.context` contains VIX_IVP, VIX_IVR, VIX9D_IVR, VIX9D_IVP, VIX3M_IVR, and VIX3M_IVP columns populated from 252-day lookback
  5. `market.daily` no longer contains BB_Position or BB_Width columns; existing queries that referenced those fields receive a clear schema error rather than silent null results
**Plans**: 3 plans
Plans:
- [x] 67-01-PLAN.md — Register import_from_massive MCP tool, wire fetchBars to DuckDB import pipeline
- [x] 67-02-PLAN.md — Remove Bollinger Bands from Tier 1, add IVR/IVP to Tier 2 enrichment
- [x] 67-03-PLAN.md — Integration tests for import_from_massive with mocked API and real DuckDB

### Phase 68: Trade Replay & Documentation
**Goal**: Users can replay any historical trade using Massive.com option minute bars to get a minute-by-minute strategy P&L path with MFE and MAE, without any broker dependency
**Depends on**: Phase 67
**Requirements**: RPL-01, RPL-02, RPL-03, RPL-04, RPL-05, RPL-06, DOC-01, DOC-02, DOC-03, TST-03, TST-04
**Success Criteria** (what must be TRUE):
  1. `replay_trade` accepts trade legs (strike, expiration, put/call, quantity) plus open and close dates, fetches minute bars from Massive, and returns a timestamped P&L series covering the full holding period
  2. Tradelog leg description strings are parsed into valid OCC option tickers (`O:SPX...`) without manual formatting by the user
  3. Multi-leg strategies (spreads, iron condors) produce a single combined P&L path that weights each leg by its quantity and direction
  4. MFE and MAE values in the response match the actual peak and trough of the strategy P&L path computed from the minute series
  5. `replay_trade` also accepts `block_id` and a trade index, resolves the trade from the block's tradelog, and replays it without the user re-entering leg details
  6. The README market data section documents both CSV and Massive API import paths with env var setup, ticker formats, and `target_table` examples; the broken `scripts/README.md` reference is gone
**Plans**: 3 plans
Plans:
- [x] 68-01-PLAN.md — Trade replay pure logic: OCC ticker construction, legs parsing, P&L path, MFE/MAE + unit tests
- [x] 68-02-PLAN.md — replay_trade MCP tool registration, tradelog mode, integration tests
- [x] 68-03-PLAN.md — Documentation overhaul: docs/ directory with four guides, README update, fix #248

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 55. Field Classification Foundation | v2.9 | 1/1 | Complete | 2026-02-08 |
| 56. Fix Existing Tools | v2.9 | 1/1 | Complete | 2026-02-08 |
| 57. Restore enrich_trades | v2.9 | 1/1 | Complete | 2026-02-08 |
| 58. Schema Metadata + Documentation | v2.9 | 1/1 | Complete | 2026-02-08 |
| 59. Intraday Market Context Enrichment | v2.9 | 1/1 | Complete | 2026-02-08 |
| 60. Profile Storage | v2.1-b1 | 1/1 | Complete | 2026-03-04 |
| 61. Profile CRUD Tools | v2.1-b1 | 1/1 | Complete | 2026-03-05 |
| 62. Structure-Aware Analysis Tools | v2.1-b1 | 3/3 | Complete | 2026-03-05 |
| 63. Eliminate block.json | v2.1-b1 | 2/2 | Complete | 2026-03-06 |
| 64. Schema V2 | v2.1-b2 | 2/2 | Complete | 2026-03-08 |
| 65. Portfolio Analysis Tools | v2.1-b2 | 4/4 | Complete | 2026-03-08 |
| 66. Massive API Adapter Foundation | v2.2 | 2/2 | Complete    | 2026-03-22 |
| 67. Import Tool & Enrichment | v2.2 | 3/3 | Complete    | 2026-03-22 |
| 68. Trade Replay & Documentation | v2.2 | 3/3 | Complete    | 2026-03-22 |
| 69. Black-Scholes Greeks Engine | v2.2 | 2/2 | Complete    | 2026-03-22 |
| 70. Live Options Snapshot | v2.2 | 2/2 | Complete    | 2026-03-22 |
| 71. Exit Trigger Analysis | v2.2 | 3/3 | Complete   | 2026-03-23 |
| 72. Exit Policy Comparison | v2.2 | 3/3 | Complete   | 2026-03-23 |
| 73. 0DTE Greeks Engine + Exit Trigger Usability | v2.2 | 3/3 | Complete   | 2026-03-24 |
| 74. Pre-ship Polish | v2.2 | 3/4 | In Progress|  |

### Phase 69: Black-Scholes Greeks Engine — Add BS greeks computation to replay_trade output using option OHLC bars + underlying price + DTE

**Goal:** Each replay_trade P&L path point includes per-leg greeks (delta, gamma, theta, vega, IV), net position greeks, and IVP, computed via pure Black-Scholes with Newton's method IV solver using underlying minute bars from Massive (with daily close fallback)
**Requirements**: BS-01, BS-02, BS-03, BS-04, BS-05, BS-06, BS-07, BS-08, BS-09, BS-10, BS-11, BS-12
**Depends on:** Phase 68
**Plans:** 2/2 plans complete

Plans:
- [x] 69-01-PLAN.md — Pure Black-Scholes module: BS pricing, greeks, Newton's method IV solver + unit tests
- [x] 69-02-PLAN.md — Wire greeks into replay pipeline: extend PnlPoint, fetch underlying bars, IVP lookup, caching

### Phase 70: Live Options Snapshot — Integrate Massive /v3/snapshot/options endpoint for current greeks, IV, and open interest on active positions

**Goal:** A `get_option_snapshot` MCP tool fetches live option chain data (greeks, IV, OI, quotes) from Massive's v3/snapshot/options endpoint with auto-pagination and BS greeks fallback for contracts where the API returns empty greeks
**Requirements**: SNAP-01, SNAP-02, SNAP-03, SNAP-04, SNAP-05, SNAP-06, SNAP-07, SNAP-08, SNAP-09
**Depends on:** Phase 69
**Plans:** 2/2 plans complete

Plans:
- [x] 70-01-PLAN.md — Snapshot client: Zod schemas, fetchOptionSnapshot with pagination, BS greeks fallback + unit tests
- [x] 70-02-PLAN.md — get_option_snapshot MCP tool registration, test exports

### Phase 71: Exit Trigger Analysis — Port analyze_exit_triggers and decompose_greeks from TastyTrade MCP to TradeBlocks using replay + greeks data

**Goal:** Two MCP tools (`analyze_exit_triggers` and `decompose_greeks`) that run replay internally, evaluate 14 exit trigger types against the greeks-enriched P&L path, and decompose P&L into ranked greek factor contributions with per-leg-group vega attribution for calendar strategies
**Requirements**: EXIT-01, EXIT-02, EXIT-03, EXIT-04, EXIT-05, EXIT-06, EXIT-07, EXIT-08, EXIT-09, EXIT-10, EXIT-11, TST-05, TST-06, TST-07
**Depends on:** Phase 70
**Plans:** 3/3 plans complete

Plans:
- [x] 71-01-PLAN.md — Exit trigger evaluators: 14 trigger types + analysis engine + unit tests
- [x] 71-02-PLAN.md — Greeks decomposition engine: factor attribution + per-leg-group vega + unit tests
- [x] 71-03-PLAN.md — MCP tool registration for both tools, server wiring, test exports

### Phase 72: Exit Policy Comparison — Batch exit analysis tool for multi-trade policy testing across entire blocks

**Goal:** A `batch_exit_analysis` MCP tool that replays matching trades from a block, evaluates a candidate exit policy against each trade's minute-level P&L path, and returns aggregate statistics (win rate, Sharpe, total P&L, profit factor) with per-trigger attribution — directly comparable to get_statistics output. Option bars are cached in market.intraday for instant re-analysis.
**Requirements**: BATCH-01, BATCH-02, BATCH-03, BATCH-04, BATCH-05, BATCH-06, BATCH-07, BATCH-08, BATCH-09, BATCH-10, BATCH-11, BATCH-12, BATCH-13, BATCH-14, BATCH-15, CACHE-01, TST-08, TST-09, TST-10
**Depends on:** Phase 71
**Plans:** 3/3 plans complete

Plans:
- [x] 72-01-PLAN.md — Option bar caching in replay + batch exit analysis pure engine
- [x] 72-02-PLAN.md — Unit tests for batch exit analysis engine
- [x] 72-03-PLAN.md — MCP tool registration, server wiring, test exports

### Phase 73: 0DTE Greeks Engine + Exit Trigger Usability — Fix DTE calculation bug, implement Bachelier normal model as fallback for short-dated options, add unit field to exit trigger schema, warn on null greeks, minor UX fixes

**Goal:** 0DTE options get correct greeks via Bachelier normal model (replacing null greeks from BS gamma explosion), exit triggers support percentage-based thresholds, and tool UX is improved with better defaults and error reporting
**Requirements**: DTE-01, DTE-02, BACH-01, BACH-02, BACH-03, UNIT-01, UNIT-02, UNIT-03, UNIT-04, UNIT-05, WARN-01, WARN-02, UX-01, UX-02, TST-11, TST-12, TST-13
**Depends on:** Phase 72
**Plans:** 3/3 plans complete

Plans:
- [x] 73-01-PLAN.md — Bachelier normal model: pricing, greeks, IV solver, model selection in computeLegGreeks + TDD tests
- [x] 73-02-PLAN.md — Exit trigger unit field: percentage-based profitTarget/stopLoss + TDD tests
- [x] 73-03-PLAN.md — Wire into tools: DTE fix, greeks warnings, Zod schemas, UX fixes, test exports

### Phase 74: Pre-ship Polish — Greeks pipeline robustness, decompose_greeks numerical fallback, shared fetch cache, batch parallelism

**Goal:** Eight targeted fixes to the greeks pipeline, exit triggers, and batch tool: stopLoss abs(threshold), shared fetchBarsWithCache utility, midpoint greeks attribution, tolerant underlying timestamp lookup, numerical greeks fallback, lower Bachelier threshold, model field in GreeksResult, parallel batch replay
**Requirements**: POL-01, POL-02, POL-03, POL-04, POL-05, POL-06, POL-07, POL-08, POL-09, POL-10, POL-11, POL-12, POL-13, POL-14, TST-14, TST-15, TST-16, TST-17
**Depends on:** Phase 73
**Plans:** 3/4 plans executed

Plans:
- [x] 74-01-PLAN.md — stopLoss abs fix, lower Bachelier threshold, model field in GreeksResult
- [x] 74-02-PLAN.md — Shared fetchBarsWithCache utility, replay.ts refactor, tolerant timestamp lookup
- [x] 74-03-PLAN.md — Midpoint greeks attribution, numerical decomposition fallback
- [ ] 74-04-PLAN.md — Parallel batch replay with concurrency limiter
