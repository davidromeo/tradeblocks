# Changelog

All notable changes to the TradeBlocks MCP Server will be documented in this file.

## [2.0.0] - 2026-02-24

### BREAKING CHANGES

- **Separate market DuckDB**: Market data now lives in `market.duckdb` (ATTACHed as `market` schema), separate from `analytics.duckdb`. Configurable via `--market-db` CLI flag or `MARKET_DB_PATH` env var, defaults to `<baseDir>/market.duckdb`
- **Normalized schema**: Old tables (`market.spx_daily`, `market.spx_15min`, `market.vix_intraday`) replaced with `market.daily`, `market.context`, `market.intraday` — all multi-ticker via `(ticker, date)` keys. `run_sql` rejects queries against old table names
- **No auto-sync**: The `_marketdata/` directory and auto-sync pipeline are removed. Use `import_market_csv` or `import_from_database` to import data explicitly
- **Pine Scripts removed**: All 3 custom Pine Scripts deleted (SPX daily indicators, SPX 15-min checkpoints, VIX intraday). TradingView's native chart export ("Export chart data...") gives you raw OHLCV, and the server computes all derived fields
- **`enrich_trades` output changed**: Returns raw intraday bars (array of `{time, open, high, low, close}`) instead of pivoted checkpoint columns

### Added

#### Market Database
- Separate `market.duckdb` with ATTACH/DETACH lifecycle — portable market data you can copy between machines or share across projects
- Four normalized tables: `market.daily` (ticker+date keyed OHLCV + indicators), `market.context` (date-keyed VIX/volatility), `market.intraday` (ticker+date+time keyed bars at any resolution), `market._sync_metadata` (import/enrichment state)
- Safe connection lifecycle: explicit DETACH on close, re-ATTACH on read-write upgrade, old tables dropped before ATTACH to prevent DuckDB #14421 corruption

#### Import Pipeline
- `import_market_csv` — Import any CSV with column mapping validation, ticker normalization, and idempotent merge (overlapping date ranges handled via ON CONFLICT)
- `import_from_database` — Import from external DuckDB files with ATTACH/DETACH lifecycle managed within the tool call
- Both tools auto-trigger enrichment after import (skippable via `skip_enrichment`)
- AI-assisted workflow: point your model at an exported CSV and ask it to import — it will inspect headers, build the column mapping, and run the import

#### Enrichment Engine
- `enrich_market_data` — 14 pure TypeScript indicator functions computing ~40 derived fields from raw OHLCV, validated against TradingView reference values
- **Tier 1** — Core daily indicators: RSI_14, ATR_Pct, Trend_Score, BB_Position, BB_Width, Realized_Vol_5D/20D, Gap_Pct, Prior_Range_vs_ATR, EMA/SMA moving averages
- **Tier 2** — Cross-asset context (requires VIX data in `market.context`): Vol_Regime, Term_Structure_State, VIX_Percentile, VIX ratios
- **Tier 3** — Intraday timing (requires bar data in `market.intraday`): High_Time, Low_Time, Reversal_Type, Opening_Drive_Strength, Intraday_Realized_Vol
- Incremental enrichment with 200-day lookback for Wilder smoothing warmup via `enriched_through` watermark
- Idempotent — re-running produces identical results
- Tiers 2 and 3 skip gracefully when source data is absent

#### Docker & Auth
- Multi-stage Dockerfile and docker-compose for remote server deployments
- Docker images published to GitHub Container Registry on every release (including betas)
- OAuth 2.1 with Authorization Code + PKCE for HTTP endpoints — JWT tokens, login flow, dynamic client registration
- `--no-auth` flag and `TRADEBLOCKS_NO_AUTH` env var for trusted-network bypass
- Rate-limited login endpoint via `express-rate-limit`
- DuckDB tuning via `DUCKDB_THREADS` and `DUCKDB_MEMORY_LIMIT` env vars

### Changed

- `enrich_trades` JOINs `market.daily` + `market.context` with correct lookahead-free field timing
- `analyze_regime_performance` uses `market.context` JOIN for regime segmentation
- `suggest_filters` includes new enrichment fields as filter candidates (BB_Width, Realized_Vol, Prior_Range_vs_ATR)
- `calculate_orb` rewritten to query `market.intraday` with time-range filters — supports any bar resolution
- `buildLookaheadFreeQuery` JOINs `market.daily + market.context` inside CTE before LAG application
- `describe_database` includes import workflow guidance, new schema structure, and updated LAG CTE template
- `run_sql` allowlist updated to new table names
- All market-data tools report missing data with actionable messages instead of silent NULLs

### Migration

Users with existing market data need to re-import from source CSVs:
1. Export OHLCV from TradingView — open any chart (SPX daily, VIX daily, SPX 5-min, etc.), right-click → "Export chart data..."
2. Import via `import_market_csv` with column mapping (or ask your AI to handle the mapping)
3. Enrichment triggers automatically, computing all derived fields

No Pine Scripts needed. No column renaming. Just export → import → analyze.

## [0.6.1] - 2026-02-04

### Added

- `trades.reporting_data` SQL table synced from reportinglog.csv
- `backtestLegs` and `actualLegs` fields in `compare_backtest_to_actual` output (detailLevel: "trades")
- Leg differences now shown in trade comparison differences array

## [0.6.0] - 2026-02-04

### BREAKING CHANGES

Removed 7 MCP tools that are now fully replaceable by `run_sql` + `describe_database`:

- `get_trades` - Use `SELECT ... FROM trades.trade_data WHERE ...`
- `list_available_fields` - Use `describe_database` for schema info
- `run_filtered_query` - Use `SELECT ... WHERE ...` with conditions
- `aggregate_by_field` - Use `GROUP BY` with CASE expressions
- `get_market_context` - Use `SELECT ... FROM market.daily WHERE ...`
- `enrich_trades` - Use `SELECT t.*, m.* FROM trades.trade_data t JOIN market.daily m ON ...`
- `find_similar_days` - Use CTE with similarity conditions

See `describe_database` examples for SQL patterns replacing each tool.

### Added

- New SQL examples in `describe_database` covering all removed tool patterns:
  - Trade filtering with pagination (replaces `get_trades`)
  - Market data queries (replaces `get_market_context`)
  - Trade enrichment via JOIN (replaces `enrich_trades`)
  - VIX bucket aggregation (replaces `aggregate_by_field`)
  - Similar day finder with CTE (replaces `find_similar_days`)

### Migration Guide

**For AI agents (Claude):** The `describe_database` tool now includes example queries covering all patterns from removed tools. When you need to:

- **Get trades**: Write a `SELECT` on `trades.trade_data` with filters
- **Check field availability**: Call `describe_database`
- **Filter trades**: Use SQL `WHERE` with conditions
- **Group by field**: Use SQL `GROUP BY` with `CASE` for buckets
- **Join market data**: Use `LEFT JOIN market.daily m ON t.date_opened = m.date`

**For direct users:** The `--call` CLI mode still works for all remaining tools:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call run_sql '{"query": "SELECT ..."}'
```

## [0.5.1] - 2026-02-04

### Added

- `purge_market_table` tool for clearing corrupted market data and triggering re-sync

### Fixed

- Market data sync now filters CSV columns to only those in table schema
- Handles TradingView marker columns gracefully
- Fixed PineScript column names to be SQL-safe

## [0.5.0] - 2026-02-03

### Added

- `describe_database` tool for schema discovery with column descriptions, types, row counts, and example queries
- DuckDB analytics layer with `trades` and `market` schemas
- `run_sql` tool for executing SQL queries against DuckDB
- Lazy sync: data synced on query, not server startup
- Auto-append LIMIT (default 100, max 1000) for unbounded queries
- 30-second query timeout protection

### Infrastructure

- Single DuckDB file (`analytics.duckdb`) for all analytics
- SHA-256 hash-based change detection for sync
- Sync middleware pattern (`withSyncedBlock`, `withFullSync`)
