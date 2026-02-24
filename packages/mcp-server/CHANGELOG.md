# Changelog

All notable changes to the TradeBlocks MCP Server will be documented in this file.

## [2.0.0] - 2026-02-24

### BREAKING CHANGES

- **Separate market DuckDB**: Market data now lives in `market.duckdb` (ATTACHed as `market` schema), separate from `analytics.duckdb`
- **Normalized schema**: Old tables (`market.spx_daily`, `market.spx_15min`, `market.vix_intraday`) replaced with `market.daily`, `market.context`, `market.intraday` — all multi-ticker via `(ticker, date)` keys
- **No auto-sync**: The `_marketdata/` directory and auto-sync pipeline are removed. Use `import_market_csv` or `import_from_database` to import data explicitly
- **Pine Scripts removed**: TradingView exports raw OHLCV natively — no custom indicators needed

### Added

- `import_market_csv` — Import market data from CSV with column mapping (any ticker, any table)
- `import_from_database` — Import from external DuckDB databases with ATTACH/DETACH lifecycle
- `enrich_market_data` — TypeScript enrichment pipeline computing ~40 derived indicators from raw OHLCV
  - Tier 1: RSI, ATR, BB, Realized Vol, Trend Score, Gap metrics (from daily OHLCV)
  - Tier 2: Vol Regime, Term Structure, VIX Percentile (from VIX context data)
  - Tier 3: Opening Drive Strength, Intraday Realized Vol, High/Low timing (from intraday bars)
- `MARKET_DB_PATH` env var and `--market-db` CLI flag for configurable market database location
- HTTP transport with OAuth 2.1 (dynamic client registration + PKCE + JWT)
- Cloudflare Tunnel deployment support

### Changed

- `enrich_trades` now returns raw intraday bars (array of `{time, open, high, low, close}`) instead of pivoted checkpoint columns
- `suggest_filters` includes new enrichment fields as filter candidates (BB_Width, Realized_Vol, Prior_Range_vs_ATR)
- `calculate_orb` redesigned for `market.intraday` with SQL aggregation — supports any bar resolution
- `buildLookaheadFreeQuery` JOINs `market.daily + market.context` before LAG application
- `describe_database` includes import workflow guidance and updated LAG CTE template
- `run_sql` allowlist updated to new table names

### Migration

Users with existing market data need to re-import from source CSVs:
1. Export OHLCV from TradingView (daily chart for SPX, VIX, etc.)
2. `import_market_csv` with appropriate column mapping
3. `enrich_market_data` to compute derived fields

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
