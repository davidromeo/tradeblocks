# Requirements: TradeBlocks v2.2

**Defined:** 2026-03-22
**Core Value:** Accurate, trustworthy portfolio analytics that help traders understand their strategies and make better decisions

## v2.2 Requirements

Requirements for Massive.com market data integration milestone.

### API Client

- [x] **API-01**: System fetches OHLCV bars from Massive.com REST API aggregates endpoint
- [x] **API-02**: System authenticates via `Authorization: Bearer` header using `MASSIVE_API_KEY` environment variable
- [x] **API-03**: System converts Massive Unix millisecond timestamps to YYYY-MM-DD date strings in Eastern Time
- [x] **API-04**: System normalizes ticker prefixes bidirectionally (I:VIX <-> VIX for indices, O:SPX... for options)
- [x] **API-05**: System paginates through `next_url` responses with a seen-cursor guard to prevent infinite loops
- [x] **API-06**: System validates API responses with Zod schemas before processing
- [x] **API-07**: System detects HTTP 429 rate limit responses and surfaces clear error messages

### Import Tool

- [x] **IMP-01**: User can import daily OHLCV bars into `market.daily` via `import_from_massive` MCP tool with ticker, from, to, and target_table parameters
- [x] **IMP-02**: User can import VIX context data by specifying `target_table: "context"`, which auto-fetches I:VIX, I:VIX9D, I:VIX3M and merges into `market.context`
- [x] **IMP-03**: User can import intraday bars into `market.intraday` with configurable timespan (1m, 5m, 15m, 1h)
- [x] **IMP-04**: System auto-triggers enrichment pipeline after daily imports (unless `skip_enrichment: true`)
- [x] **IMP-05**: User can import historical option minute bars using OCC ticker format (O:SPX...)
- [x] **IMP-07**: System returns clear error when `MASSIVE_API_KEY` is not set
- [x] **IMP-08**: System upserts imported data using existing ON CONFLICT merge semantics (no duplicates)

### Trade Replay

- [ ] **RPL-01**: User can replay a trade by providing trade details (legs, open date, close date), and the system fetches minute-level option bars for each leg from Massive
- [ ] **RPL-02**: System resolves tradelog leg descriptions to OCC option tickers (strike, expiration, put/call -> O:SPX format)
- [ ] **RPL-03**: System combines per-leg minute bars into a weighted strategy P&L path based on position quantities and directions
- [ ] **RPL-04**: System calculates MFE (maximum favorable excursion) and MAE (maximum adverse excursion) from the strategy P&L path
- [ ] **RPL-05**: System returns the full minute-by-minute P&L path with timestamps, per-leg prices, combined strategy value, and MFE/MAE summary
- [ ] **RPL-06**: User can replay a trade directly from a block's tradelog by providing block_id and trade index

### Enrichment

- [x] **ENR-01**: Tier 2 enrichment computes VIX_IVR (252-day rank: (current - min) / (max - min) * 100) and stores in `market.context`
- [x] **ENR-02**: Tier 2 enrichment computes VIX9D_IVR and VIX9D_IVP (252-day rank and percentile for VIX9D)
- [x] **ENR-03**: Tier 2 enrichment computes VIX3M_IVR and VIX3M_IVP (252-day rank and percentile for VIX3M)
- [x] **ENR-04**: Remove Bollinger Bands fields (BB_Position, BB_Width) from Tier 1 enrichment and `market.daily` schema
- [x] **ENR-05**: VIX_Percentile renamed to VIX_IVP for naming consistency with IVR/IVP scheme

### Documentation

- [ ] **DOC-01**: README market data section documents both CSV import and Massive API import paths with examples
- [ ] **DOC-02**: Broken `scripts/README.md` reference removed and replaced with correct documentation (fixes #248)
- [ ] **DOC-03**: Documentation includes required env vars, ticker format reference, and target_table usage

### Testing

- [x] **TST-01**: Unit tests for `massive-client.ts` using mocked `fetch` (timestamp conversion, pagination, ticker normalization, error handling)
- [ ] **TST-02**: Integration tests for `import_from_massive` tool with real DuckDB and mocked API responses
- [ ] **TST-03**: Unit tests for OCC ticker resolution and strategy P&L path combination
- [ ] **TST-04**: Integration tests for trade replay with mocked Massive API responses

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Sync Enhancements

- **SYNC-01**: Exponential backoff retry with progress reporting for multi-batch imports
- **SYNC-02**: Warning when `market.context` is absent during daily enrichment (causes null VIX fields)

### Extended Data

- **EXT-01**: `multiplier` parameter for non-standard bar sizes (5-min, 15-min)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time streaming / WebSocket data | TradeBlocks is an analytics platform, not a live monitor |
| Massive MCP server integration | REST API is better fit for structured import pipelines (key decision) |
| Automatic ticker discovery from trades | High complexity, error-prone for index options mapping |
| Full options chain import | Exhausts rate limits, enormous data volume — use single-contract bars |
| Storing raw API response JSON | Doubles storage, creates second source of truth |
| Scheduler/cron integration | Outside MCP tool scope |
| TastyTrade integration or dependency | Trade replay must be broker-independent |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 66 | Complete |
| API-02 | Phase 66 | Complete |
| API-03 | Phase 66 | Complete |
| API-04 | Phase 66 | Complete |
| API-05 | Phase 66 | Complete |
| API-06 | Phase 66 | Complete |
| API-07 | Phase 66 | Complete |
| TST-01 | Phase 66 | Complete |
| IMP-01 | Phase 67 | Complete |
| IMP-02 | Phase 67 | Complete |
| IMP-03 | Phase 67 | Complete |
| IMP-04 | Phase 67 | Complete |
| IMP-05 | Phase 67 | Complete |
| IMP-07 | Phase 66 | Complete |
| IMP-08 | Phase 67 | Complete |
| ENR-01 | Phase 67 | Complete |
| ENR-02 | Phase 67 | Complete |
| ENR-03 | Phase 67 | Complete |
| ENR-04 | Phase 67 | Complete |
| ENR-05 | Phase 67 | Complete |
| TST-02 | Phase 67 | Pending |
| RPL-01 | Phase 68 | Pending |
| RPL-02 | Phase 68 | Pending |
| RPL-03 | Phase 68 | Pending |
| RPL-04 | Phase 68 | Pending |
| RPL-05 | Phase 68 | Pending |
| RPL-06 | Phase 68 | Pending |
| DOC-01 | Phase 68 | Pending |
| DOC-02 | Phase 68 | Pending |
| DOC-03 | Phase 68 | Pending |
| TST-03 | Phase 68 | Pending |
| TST-04 | Phase 68 | Pending |

**Coverage:**
- v2.2 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
