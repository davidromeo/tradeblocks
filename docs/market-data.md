# Market Data Guide

TradeBlocks supports two paths for importing market data: CSV files and the Massive.com API. Both write to the same DuckDB tables and trigger the same enrichment pipeline.

## CSV Import

### import_market_csv

Import OHLCV data from a local CSV file into DuckDB.

**Parameters:**
- `file_path` — path to the CSV file (use `~` for home directory)
- `ticker` — symbol identifier (e.g., `SPX`, `VIX`, `SPY`)
- `target_table` — destination: `"daily"`, `"context"`, or `"intraday"`
- `column_mapping` — maps CSV headers to schema columns

**Example: Daily bars**
```json
{
  "file_path": "~/exports/spx-daily.csv",
  "ticker": "SPX",
  "target_table": "daily",
  "column_mapping": {
    "Date": "date",
    "Open": "open",
    "High": "high",
    "Low": "low",
    "Close": "close"
  }
}
```

**Example: Intraday bars from TradingView**
```json
{
  "file_path": "~/exports/spx-5min.csv",
  "ticker": "SPX",
  "target_table": "intraday",
  "column_mapping": {
    "time": "date",
    "open": "open",
    "high": "high",
    "low": "low",
    "close": "close"
  }
}
```

For TradingView intraday exports, the `time` column is a Unix timestamp encoding both date and time. Map it to `"date"` and the HH:MM Eastern Time will be extracted automatically.

**Example: VIX daily bars**
```json
{
  "file_path": "~/exports/vix-daily.csv",
  "ticker": "VIX",
  "target_table": "daily",
  "column_mapping": {
    "time": "date",
    "open": "open",
    "high": "high",
    "low": "low",
    "close": "close"
  }
}
```

VIX tenors (VIX, VIX9D, VIX3M, etc.) are imported as regular ticker rows in `market.daily`. Import each tenor separately with its own ticker.

Use `dry_run: true` to validate the import without writing data.

### import_from_database

Import data from an external DuckDB file via SQL query. Reference tables using the `ext_import_source` alias:

```json
{
  "db_path": "~/other-data/market.duckdb",
  "ticker": "SPX",
  "target_table": "daily",
  "query": "SELECT date, open, high, low, close FROM ext_import_source.main.daily_prices WHERE ticker = 'SPX'"
}
```

## Massive.com API Import

### Setup

See [Getting Started](getting-started.md#massivecom-api-optional) for API key configuration.

### import_from_massive

Import market data directly from the Massive.com REST API.

**Parameters:**
- `ticker` — plain ticker symbol (e.g., `SPX`, `VIX`, `SPY`). API prefixes added automatically.
- `from` — start date (`YYYY-MM-DD`)
- `to` — end date (`YYYY-MM-DD`)
- `target_table` — destination: `"daily"`, `"context"`, or `"intraday"`
- `skip_enrichment` — (optional) skip auto-enrichment after import
- `timespan` — (optional) bar size for intraday: `"1m"`, `"5m"`, `"15m"`, `"1h"` (default: `"1m"`)
- `asset_class` — (optional) auto-detected: `"index"`, `"stock"`, `"option"`
- `dry_run` — (optional) validate without writing

**Daily OHLCV import:**
```
import_from_massive ticker=SPX from=2024-01-01 to=2024-12-31 target_table=daily
```

**VIX context import (convenience shorthand):**
```
import_from_massive ticker=VIX target_table=context from=2024-01-01 to=2024-12-31
```

When `target_table="context"`, the tool automatically fetches VIX, VIX9D, and VIX3M and stores them as ticker rows in `market.daily`, then triggers enrichment.

**Intraday minute bars:**
```
import_from_massive ticker=SPX from=2024-06-01 to=2024-06-30 target_table=intraday timespan=5m
```

**Option minute bars:**
```
import_from_massive ticker=SPX250117C05000000 from=2025-01-13 to=2025-01-17 target_table=intraday asset_class=option
```

### Ticker Formats

| Type | Plain Ticker | API Format | Storage Format |
|------|-------------|------------|----------------|
| Stock | SPY | SPY | SPY |
| Index | VIX | I:VIX | VIX |
| Option | SPY250117C00470000 | O:SPY250117C00470000 | SPY250117C00470000 |

The API client automatically adds and removes `I:` and `O:` prefixes. Always use plain tickers in tool calls.

### OCC Option Ticker Format

Options use the OCC standardized format: `{ROOT}{YYMMDD}{C|P}{STRIKE*1000 padded to 8 digits}`

Examples:
- SPY Jan 17, 2025 $470 Call: `SPY250117C00470000`
- SPX Dec 19, 2025 $4500 Put: `SPX251219P04500000`
- QQQ Mar 21, 2025 $450.50 Call: `QQQ250321C00450500`

## Trade Replay

### replay_trade

Replay historical trades using minute-level option bars for P&L analysis with greeks.

**Data source:** Reads from `market.intraday` cache first. On cache miss, fetches from Massive.com (requires `MASSIVE_API_KEY`). Bars are persisted after fetch — subsequent replays are instant. You can also pre-load bars via `import_market_csv` with intraday data.

**Two modes:**
- **Hypothetical** — provide explicit legs with strikes, expiry, entry prices
- **Tradelog** — provide `block_id` + `trade_index` to replay from existing data

**Output includes:**
- Minute-by-minute P&L path (three formats: `full`, `sampled` default ~25 points, `summary`)
- MFE (max favorable excursion) and MAE (max adverse excursion)
- Per-leg greeks: delta, gamma, theta, vega, IV (Black-Scholes or Bachelier for 0DTE)
- Net position greeks: quantity-weighted sums
- Optional IVP from VIX data
- `close_at: "expiry"` to analyze holding through expiration

## Enrichment Pipeline

After imports, enrichment runs automatically (unless `skip_enrichment=true`). Run manually with `enrich_market_data`.

### Tier 1: Technical Indicators

Written to `market.daily` for the imported ticker. ~20 fields:

| Category | Fields |
|----------|--------|
| Momentum | RSI_14 |
| Volatility | ATR_Pct, Realized_Vol_5D, Realized_Vol_20D |
| Trend | Price_vs_EMA21_Pct, Price_vs_SMA50_Pct, Return_5D, Return_20D |
| Price action | Gap_Pct, Prior_Close, Prior_Range_vs_ATR, Prev_Return_Pct |
| Intraday | Intraday_Range_Pct, Intraday_Return_Pct, Close_Position_In_Range |
| Structure | Gap_Filled, Consecutive_Days |
| Calendar | Day_of_Week, Month, Is_Opex |

### Tier 2: VIX Context

Runs when VIX-family tickers exist in `market.daily`. Discovers tickers dynamically (`SELECT DISTINCT ticker WHERE ticker LIKE 'VIX%'`).

**Per-ticker (written to `market.daily`):**

| Field | Description |
|-------|-------------|
| ivr | Implied Volatility Rank (252-day): position in min-max range (0-100) |
| ivp | Implied Volatility Percentile (252-day): % of days at or below current (0-100) |

**Cross-ticker derived (written to `market._context_derived`):**

| Field | Description |
|-------|-------------|
| Vol_Regime | Volatility regime (1=very low <13, 2=low 13-16, 3=normal 16-20, 4=elevated 20-25, 5=high 25-30, 6=extreme >30) |
| Term_Structure_State | VIX term structure (-1=backwardation, 0=flat, 1=contango) |
| Trend_Direction | Trend from 20-day return: up (>1%), down (<-1%), flat |
| VIX_Spike_Pct | VIX spike from open to high as percentage |
| VIX_Gap_Pct | VIX overnight gap percentage |

### Tier 3: Intraday Timing

Runs when `market.intraday` has bars for the ticker. Written to `market.daily`:

| Field | Description |
|-------|-------------|
| High_Time | Time of day high occurred |
| Low_Time | Time of day low occurred |
| High_Before_Low | Whether high occurred before low (1/0) |
| Reversal_Type | Intraday reversal classification |
| Opening_Drive_Strength | Strength of the opening move |
| Intraday_Realized_Vol | Intraday realized volatility from bar data |

## Database Schema

| Table | Key | Purpose |
|-------|-----|---------|
| `market.daily` | `ticker, date` | Daily OHLCV + Tier 1 indicators + VIX ivr/ivp |
| `market._context_derived` | `date` | Cross-ticker derived fields (Vol_Regime, Term_Structure_State, etc.) |
| `market.intraday` | `ticker, date, time` | Minute/hourly bars, including cached option bars from replay |
| `market.context` | `date` | Legacy VIX table — preserved for backward compatibility, no longer primary |
| `market._sync_metadata` | `source, ticker, target_table` | Import tracking and enrichment watermarks |
