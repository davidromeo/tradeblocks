# State: TradeBlocks

## Current Position

Phase: 61 of 64 (Import Tools)
Plan: 2 of 2 complete
Status: In progress
Last activity: 2026-02-22 — Completed 61-02 (import_market_csv and import_from_database MCP tools, version 1.3.0)

Progress: [████░░░░░░] 27%

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Accurate, trustworthy portfolio analytics
**Current focus:** v3.0 Market Data Separation — Phase 61 in progress (import tools)

## Performance Metrics

**Velocity:**
- Total plans completed: 4 (v3.0)
- Average duration: 3 min
- Total execution time: 12 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 60 | 2/2 | 8 min | 4 min |
| 61 | 2/2 | 4 min | 2 min |

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
- [Phase 61-01]: column mapping direction { sourceCol: schemaCol } — single object works for CSV headers and query result columns
- [Phase 61-01]: applyColumnMapping skips unparseable date rows (warning) rather than throwing — allows partial imports of messy CSVs
- [Phase 61-01]: triggerEnrichment is a pure stub (no side effects) — Phase 62 replaces it with real implementation
- [Phase 61-02]: Tool names import_market_csv and import_from_database (import_csv taken by block importer in imports.ts)
- [Phase 61-02]: downgradeToReadOnly placed in finally block — cleanup guaranteed even on import errors
- [Phase 61-02]: MCP server version bumped to 1.3.0 (minor bump for two new tools)

### Pending Todos

None.

### Blockers/Concerns

- `field-timing.ts` unit tests assert specific column counts (8/44/3) — must update in lockstep during Phase 63.
- Pre-existing TypeScript error in `packages/mcp-server/src/tools/market-data.ts:482` — out of scope for v3.0 but should be addressed.

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 61-02-PLAN.md (import_market_csv and import_from_database MCP tools + version 1.3.0)
Resume file: None
