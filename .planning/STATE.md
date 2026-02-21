# State: TradeBlocks

## Current Position

Phase: 60 of 64 (Database Separation and Connection Infrastructure)
Plan: 2 of 2 complete
Status: Phase complete
Last activity: 2026-02-21 — Completed 60-02 (DB-09 write isolation + lifecycle tests)

Progress: [██░░░░░░░░] 20%

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Accurate, trustworthy portfolio analytics
**Current focus:** v3.0 Market Data Separation — Phase 60 complete, Phase 61 next

## Performance Metrics

**Velocity:**
- Total plans completed: 2 (v3.0)
- Average duration: 4 min
- Total execution time: 8 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 60 | 2/2 | 8 min | 4 min |
| Phase 60 P02 | 4min | 2 tasks | 6 files |

## Accumulated Context

### Decisions

(Cleared at milestone boundary — see PROJECT.md Key Decisions for persistent decisions)

- Research confirmed: zero new npm dependencies needed for v3.0
- Research confirmed: custom TS indicator functions over library (TradingView parity control)
- Hard fail on ATTACH error for market.duckdb (market access required for v3.0 operation)
- Auto-recreate market.duckdb on corruption (market data re-importable from source CSVs)
- resolveMarketDbPath precedence: CLI --market-db > MARKET_DB_PATH env > <dataDir>/market.duckdb
- All four market table columns created upfront — no ALTER TABLE in later phases
- tableExists() exported from schemas.ts for use in later migration phases
- enable_external_access: true at instance creation + SET enable_external_access=false after ATTACH (self-locking, blocks HTTP while allowing already-attached local DBs)
- enable_external_access decision RESOLVED: local ATTACH works; HTTP blocked after connection setup (Phase 61 can use DuckDB read_csv for local files but HTTP is blocked)
- syncMarketData() deprecated with @deprecated JSDoc — will be removed in Phase 64
- withFullSync calls syncAllBlocks only (DB-09 enforced) — market writes not wrapped in analytics.duckdb transactions
- [Phase 60]: enable_external_access starts true then locked via SET after ATTACH — allows local file ATTACH while blocking HTTP
- [Phase 60]: withFullSync calls syncAllBlocks only (DB-09 enforced) — market writes not wrapped in analytics.duckdb transactions

### Pending Todos

None.

### Blockers/Concerns

- `field-timing.ts` unit tests assert specific column counts (8/44/3) — must update in lockstep during Phase 63.
- Pre-existing TypeScript error in `packages/mcp-server/src/tools/market-data.ts:482` — out of scope for v3.0 but should be addressed.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 60-02-PLAN.md (DB-09 write isolation and lifecycle tests) — Phase 60 complete
Resume file: None
