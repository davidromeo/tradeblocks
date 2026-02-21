# State: TradeBlocks

## Current Position

Phase: 60 of 64 (Database Separation and Connection Infrastructure)
Plan: 1 of 2 complete
Status: In progress
Last activity: 2026-02-21 — Completed 60-01 (DB separation infrastructure)

Progress: [█░░░░░░░░░] 10%

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Accurate, trustworthy portfolio analytics
**Current focus:** v3.0 Market Data Separation — Phase 60 (Database Separation)

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (v3.0)
- Average duration: 4 min
- Total execution time: 4 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 60 | 1/2 | 4 min | 4 min |

## Accumulated Context

### Decisions

(Cleared at milestone boundary — see PROJECT.md Key Decisions for persistent decisions)

- Research confirmed: zero new npm dependencies needed for v3.0
- Research confirmed: custom TS indicator functions over library (TradingView parity control)
- Open decision: `enable_external_access` for DuckDB `read_csv` — must resolve before Phase 61
- Hard fail on ATTACH error for market.duckdb (market access required for v3.0 operation)
- Auto-recreate market.duckdb on corruption (market data re-importable from source CSVs)
- resolveMarketDbPath precedence: CLI --market-db > MARKET_DB_PATH env > <dataDir>/market.duckdb
- All four market table columns created upfront — no ALTER TABLE in later phases
- tableExists() exported from schemas.ts for use in later migration phases

### Pending Todos

None.

### Blockers/Concerns

- `enable_external_access` decision needed before Phase 61 (import tools). If disabled, `import_csv` must use Node.js `parseCSV` fallback instead of DuckDB `read_csv`.
- `field-timing.ts` unit tests assert specific column counts (8/44/3) — must update in lockstep during Phase 63.
- Pre-existing TypeScript error in `packages/mcp-server/src/tools/market-data.ts:482` — out of scope for v3.0 but should be addressed.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 60-01-PLAN.md (DB separation and connection infrastructure)
Resume file: None
