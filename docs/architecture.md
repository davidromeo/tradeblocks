# Architecture

## Overview

TradeBlocks is an options trading analytics platform with two main components:

- **Next.js 15 Web Dashboard** -- visual performance analysis with equity curves, drawdowns, and Monte Carlo simulation
- **MCP Server** -- 50+ tools for AI-assisted analysis via Claude, ChatGPT, Codex, Gemini, and other MCP clients

## Data Flow

```
1. Import
   CSV upload (web) ──────────────> IndexedDB (client-side)
   CSV files (MCP) ────────────────> DuckDB (server-side)
   Massive.com API (MCP) ──────────> DuckDB (server-side)

2. Storage
   IndexedDB ── client-side trades, daily logs, block metadata
   DuckDB ───── server-side analytics, market data, strategy profiles

3. Enrichment
   Raw OHLCV ──> Tier 1 indicators (RSI, ATR, EMA, etc.)
   VIX data ───> Tier 2 context (IVR, IVP, Vol_Regime, Term_Structure)

4. Analysis
   50+ MCP tools for statistics, simulation, profiling, and SQL queries
```

## DuckDB Schema

### analytics.duckdb (trades database)

| Table | Purpose |
|-------|---------|
| `trades.trade_data` | Individual trade records synced from CSV |
| `trades.reporting_data` | Reported/live trades for backtest vs actual comparison |
| `trades._sync_metadata` | Block sync state tracking |
| `profiles.strategy_profiles` | Strategy profile storage (structure, filters, exits, regimes) |

### market.duckdb (market database)

| Table | Purpose |
|-------|---------|
| `market.daily` | Daily OHLCV + enriched indicators (RSI, ATR, EMA, etc.), keyed by `ticker, date` |
| `market.context` | VIX term structure (VIX, VIX9D, VIX3M) + IVR/IVP + regime classification, keyed by `date` |
| `market.intraday` | Minute/hourly bars for intraday analysis, keyed by `ticker, date, time` |
| `market._sync_metadata` | Import tracking and gap detection |

## Enrichment Tiers

### Tier 1: Technical Indicators (market.daily)

Applied to daily OHLCV data after import:

- **Trend**: EMA_9, SMA_20, SMA_50
- **Momentum**: RSI_14
- **Volatility**: ATR_14, Realized_Vol, BB_Width, BB_Position
- **Price action**: Gap_Pct, Prior_Close, Prior_Range_vs_ATR
- **Intraday**: Opening_Drive_Strength (from intraday bars when available)

### Tier 2: VIX Context (market.context)

Applied to VIX term structure data:

- **Rank/Percentile**: VIX_IVR, VIX_IVP, VIX9D_IVR, VIX9D_IVP, VIX3M_IVR, VIX3M_IVP (252-day lookback)
- **Regime**: Vol_Regime (Low/Medium/High/Extreme based on IVR thresholds)
- **Structure**: Term_Structure (Contango/Backwardation from VIX vs VIX3M)

## Key Patterns

### Block-Based Organization

Each trading strategy is a "block" -- a directory containing CSV files (tradelog, dailylog, reportinglog). Blocks are the primary unit of analysis across both the web dashboard and MCP server.

### Lookahead-Free Analytics

Close-derived fields (RSI, VIX_Close, Vol_Regime, BB_Width, and 34 others) are only known after market close. When joining trades with market data, `buildLookaheadFreeQuery()` applies `LAG()` to these fields so analysis uses only information available at the time of trade entry. Open-known fields (Gap_Pct, VIX_Open, Prior_Close) and static fields (Day_of_Week, Month, Is_Opex) are safe to use same-day.

### MCP Tool Pattern

All tools follow a consistent pattern:
1. **Zod schema** defines input validation
2. **Sync middleware** ensures DuckDB data is current
3. **Handler function** executes business logic
4. **createToolOutput** formats the response

### Eastern Time Throughout

All dates are US market dates in Eastern Time. Trade dates from CSVs are calendar dates (local midnight Date objects, compared via YYYY-MM-DD strings). Market data timestamps from APIs are Unix milliseconds converted to ET via `toLocaleDateString("en-CA", { timeZone: "America/New_York" })`. These two approaches must not be mixed. See `CLAUDE.md` for detailed date handling rules.

## Strategy Profiles

Strategy profiles capture structured metadata about trading strategies:

- **Structure**: structure_type (e.g., iron_condor, put_spread), legs, greeks bias
- **Entry**: entry_filters (VIX range, DTE, gap conditions, etc.)
- **Exit**: exit_rules (profit targets, stop losses, time-based)
- **Context**: expected_regimes, thesis, notes

Profiles are stored in `profiles.strategy_profiles` (DuckDB) and enable structure-aware analysis tools: `analyze_structure_fit`, `validate_entry_filters`, `portfolio_structure_map`.

## Project Structure

```
tradeblocks/
  app/                    # Next.js 15 app router
  components/             # React components (shadcn/ui + Plotly charts)
  packages/
    lib/                  # Core business logic (@tradeblocks/lib)
    mcp-server/           # MCP server (npm: tradeblocks-mcp)
    agent-skills/         # AI agent skill definitions
  docs/                   # Documentation
  tests/                  # Jest test suites
```

For Claude Code-specific instructions and detailed implementation rules, see the project `CLAUDE.md` files.
