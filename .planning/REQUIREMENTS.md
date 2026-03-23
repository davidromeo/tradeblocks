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

- [x] **RPL-01**: User can replay a trade by providing trade details (legs, open date, close date), and the system fetches minute-level option bars for each leg from Massive
- [x] **RPL-02**: System resolves tradelog leg descriptions to OCC option tickers (strike, expiration, put/call -> O:SPX format)
- [x] **RPL-03**: System combines per-leg minute bars into a weighted strategy P&L path based on position quantities and directions
- [x] **RPL-04**: System calculates MFE (maximum favorable excursion) and MAE (maximum adverse excursion) from the strategy P&L path
- [x] **RPL-05**: System returns the full minute-by-minute P&L path with timestamps, per-leg prices, combined strategy value, and MFE/MAE summary
- [x] **RPL-06**: User can replay a trade directly from a block's tradelog by providing block_id and trade index

### Enrichment

- [x] **ENR-01**: Tier 2 enrichment computes VIX_IVR (252-day rank: (current - min) / (max - min) * 100) and stores in `market.context`
- [x] **ENR-02**: Tier 2 enrichment computes VIX9D_IVR and VIX9D_IVP (252-day rank and percentile for VIX9D)
- [x] **ENR-03**: Tier 2 enrichment computes VIX3M_IVR and VIX3M_IVP (252-day rank and percentile for VIX3M)
- [x] **ENR-04**: Remove Bollinger Bands fields (BB_Position, BB_Width) from Tier 1 enrichment and `market.daily` schema
- [x] **ENR-05**: VIX_Percentile renamed to VIX_IVP for naming consistency with IVR/IVP scheme

### Documentation

- [x] **DOC-01**: README market data section documents both CSV import and Massive API import paths with examples
- [x] **DOC-02**: Broken `scripts/README.md` reference removed and replaced with correct documentation (fixes #248)
- [x] **DOC-03**: Documentation includes required env vars, ticker format reference, and target_table usage

### Exit Trigger Analysis

- [x] **EXIT-01**: `analyze_exit_triggers` MCP tool accepts block_id + trade_index (or explicit legs) and trigger configs, runs replay internally, and returns when each trigger would fire
- [x] **EXIT-02**: System evaluates all 14 trigger types at every P&L path point: profitTarget, stopLoss, trailingStop, dteExit, ditExit, clockTimeExit, underlyingPriceMove, positionDelta, perLegDelta, vixMove, vix9dMove, vix9dVixRatio, slRatioThreshold, slRatioMove
- [x] **EXIT-03**: System identifies first-to-fire trigger across all configured triggers with timestamp and P&L at fire
- [x] **EXIT-04**: System compares trigger fire time against actualExitTimestamp showing P&L difference
- [x] **EXIT-05**: System supports legGroups parameter for per-group exit triggers (e.g., put spread vs call spread in iron condor)
- [x] **EXIT-06**: Triggers requiring external data (underlyingPriceMove, vixMove, vix9dMove) fetch minute bars from Massive automatically
- [x] **EXIT-07**: `decompose_greeks` MCP tool accepts same replay inputs and returns P&L decomposed into delta, gamma, theta, vega, and residual contributions
- [x] **EXIT-08**: Greek attribution computed between consecutive timestamps per D-09: delta_pnl = netDelta * underlyingChange, gamma_pnl = 0.5 * netGamma * underlyingChange^2, theta_pnl = netTheta * dt, vega_pnl = netVega * ivChange
- [x] **EXIT-09**: For calendar strategies, decompose_greeks includes per-leg-group vega attribution showing front vs back month IV divergence
- [x] **EXIT-10**: Both tools are registered in MCP server and available via tool listing
- [x] **EXIT-11**: Both tools handle errors gracefully (missing API key, invalid trade, no greeks data)

### Batch Exit Analysis

- [ ] **BATCH-01**: `batch_exit_analysis` MCP tool accepts block_id, optional strategy/date_range filters, a candidate_policy (array of trigger configs), and baseline_mode
- [ ] **BATCH-02**: Candidate policy uses same 14 trigger type schema as analyze_exit_triggers, with optional leg_groups for per-group exits
- [ ] **BATCH-03**: Two baseline modes: `actual` (candidate vs trade's actual P&L) and `holdToEnd` (candidate vs last replay timestamp)
- [ ] **BATCH-04**: Trades queried from DuckDB by block_id with optional strategy (ILIKE), date_range, min_pl, max_pl filters
- [ ] **BATCH-05**: Default limit 50 trades, configurable up to 200; most recent trades selected (ORDER BY date_opened DESC)
- [ ] **BATCH-06**: Output includes aggregate stats comparable to get_statistics: total trades, win rate, avg P&L, total P&L, profit factor, max drawdown, Sharpe ratio, plus delta vs baseline
- [ ] **BATCH-07**: Per-trigger attribution: which trigger fired first on how many trades, avg P&L when that trigger fired
- [ ] **BATCH-08**: Per-trade breakdown available in format="full"; format="summary" returns aggregate stats + trigger attribution only
- [ ] **BATCH-09**: Strategy profile context included in output when profile exists for block+strategy (informational, not input)
- [ ] **BATCH-10**: Aggregate stats include: winningTrades, losingTrades, winRate, totalPnl, avgPnl, avgWin, avgLoss, maxWin, maxLoss, profitFactor, maxDrawdown, sharpeRatio, maxWinStreak, maxLossStreak
- [ ] **BATCH-11**: Pure analysis engine (no I/O) computes aggregates from pre-analyzed trade results; tool handler orchestrates replay + engine
- [ ] **BATCH-12**: Tool registered in MCP server and available via tool listing
- [ ] **BATCH-13**: Tool handles errors gracefully: skips trades that fail replay, reports skip count in summary
- [ ] **BATCH-14**: Handler and schema exported via test-exports.ts for integration testing
- [ ] **BATCH-15**: Tool checks market.intraday for existing option bars before calling Massive; first run populates, subsequent runs are local reads

### Option Bar Caching

- [ ] **CACHE-01**: replay_trade persists fetched option minute bars in market.intraday after fetching from Massive, using same INSERT OR REPLACE pattern as underlying bar caching

### Testing

- [x] **TST-01**: Unit tests for `massive-client.ts` using mocked `fetch` (timestamp conversion, pagination, ticker normalization, error handling)
- [x] **TST-02**: Integration tests for `import_from_massive` tool with real DuckDB and mocked API responses
- [x] **TST-03**: Unit tests for OCC ticker resolution and strategy P&L path combination
- [x] **TST-04**: Integration tests for trade replay with mocked Massive API responses
- [x] **TST-05**: Unit tests for all 14 exit trigger evaluators
- [x] **TST-06**: Unit tests for greeks decomposition math and leg-group vega attribution
- [x] **TST-07**: Tool handlers and schemas exported via test-exports.ts for integration testing
- [ ] **TST-08**: Unit tests for batch exit analysis aggregate stats (win rate, profit factor, Sharpe, drawdown, streaks)
- [ ] **TST-09**: Unit tests for both baseline modes and per-trigger attribution counting
- [ ] **TST-10**: Batch exit analysis handler and pure engine functions exported via test-exports.ts

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Sync Enhancements

- **SYNC-01**: Exponential backoff retry with progress reporting for multi-batch imports
- **SYNC-02**: Warning when `market.context` is absent during daily enrichment (causes null VIX fields)

### Extended Data

- **EXT-01**: `multiplier` parameter for non-standard bar sizes (5-min, 15-min)

### Batch Exit Enhancements

- **BEXT-01**: Multi-policy sweep in one call (test PT at 30%, 50%, 70% simultaneously)
- **BEXT-02**: Automated exit rule optimization (find optimal trigger thresholds via grid search)
- **BEXT-03**: Greek attribution aggregation across batch (aggregate delta/theta/vega contribution across all trades)

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
| Profile exit rule auto-translation to trigger configs | Would require parsing human-readable exit rule text |

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
| TST-02 | Phase 67 | Complete |
| RPL-01 | Phase 68 | Complete |
| RPL-02 | Phase 68 | Complete |
| RPL-03 | Phase 68 | Complete |
| RPL-04 | Phase 68 | Complete |
| RPL-05 | Phase 68 | Complete |
| RPL-06 | Phase 68 | Complete |
| DOC-01 | Phase 68 | Complete |
| DOC-02 | Phase 68 | Complete |
| DOC-03 | Phase 68 | Complete |
| TST-03 | Phase 68 | Complete |
| TST-04 | Phase 68 | Complete |
| EXIT-01 | Phase 71 | Planned |
| EXIT-02 | Phase 71 | Planned |
| EXIT-03 | Phase 71 | Planned |
| EXIT-04 | Phase 71 | Planned |
| EXIT-05 | Phase 71 | Planned |
| EXIT-06 | Phase 71 | Planned |
| EXIT-07 | Phase 71 | Planned |
| EXIT-08 | Phase 71 | Planned |
| EXIT-09 | Phase 71 | Planned |
| EXIT-10 | Phase 71 | Planned |
| EXIT-11 | Phase 71 | Planned |
| TST-05 | Phase 71 | Planned |
| TST-06 | Phase 71 | Planned |
| TST-07 | Phase 71 | Planned |
| BATCH-01 | Phase 72 | Planned |
| BATCH-02 | Phase 72 | Planned |
| BATCH-03 | Phase 72 | Planned |
| BATCH-04 | Phase 72 | Planned |
| BATCH-05 | Phase 72 | Planned |
| BATCH-06 | Phase 72 | Planned |
| BATCH-07 | Phase 72 | Planned |
| BATCH-08 | Phase 72 | Planned |
| BATCH-09 | Phase 72 | Planned |
| BATCH-10 | Phase 72 | Planned |
| BATCH-11 | Phase 72 | Planned |
| BATCH-12 | Phase 72 | Planned |
| BATCH-13 | Phase 72 | Planned |
| BATCH-14 | Phase 72 | Planned |
| BATCH-15 | Phase 72 | Planned |
| CACHE-01 | Phase 72 | Planned |
| TST-08 | Phase 72 | Planned |
| TST-09 | Phase 72 | Planned |
| TST-10 | Phase 72 | Planned |

**Coverage:**
- v2.2 requirements: 65 total
- Mapped to phases: 65
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-23 after Phase 72 planning*
