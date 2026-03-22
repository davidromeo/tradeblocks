# Roadmap: TradeBlocks

## Milestones

- ✅ **v2.6 DuckDB Analytics Layer** — Phases 41-45 (shipped 2026-02-04)
- ✅ **v2.7 Edge Decay Analysis** — Phases 46-50 (shipped 2026-02-06)
- ✅ **v2.8 Market Data Consolidation** — Phases 51-54 (shipped 2026-02-07)
- ✅ **v2.9 Lookahead-Free Market Analytics** — Phases 55-59 (shipped 2026-02-09)
- ✅ **v2.1 Strategy Profiles (beta 1)** — Phases 60-63 (shipped 2026-03-06)
- ✅ **v2.1 Profile Schema V2 & Portfolio Analysis (beta 2)** — Phases 64-65 (shipped 2026-03-08)
- 🚧 **v2.2 Massive.com Market Data Integration** — Phases 66-68 (in progress)

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
- [ ] **Phase 68: Trade Replay & Documentation** — Build `replay_trade` MCP tool (OCC ticker resolution, multi-leg P&L path, MFE/MAE); market data docs overhaul fixing #248

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
- [ ] 68-02-PLAN.md — replay_trade MCP tool registration, tradelog mode, integration tests
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
| 68. Trade Replay & Documentation | v2.2 | 2/3 | In Progress|  |
