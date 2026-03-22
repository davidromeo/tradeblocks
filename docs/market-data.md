# Market Data Guide

TradeBlocks supports two paths for importing market data: CSV files and the Massive.com API.

## CSV Import

### import_market_csv

Import OHLCV data from a local CSV file into DuckDB.

**Parameters:**
- `file_path` -- path to the CSV file (use `~` for home directory)
- `ticker` -- symbol identifier (e.g., `SPX`, `VIX`, `SPY`)
- `target_table` -- destination: `"daily"`, `"context"`, or `"intraday"`
- `column_mapping` -- maps CSV headers to schema columns

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

1. Get an API key from [massive.com](https://massive.com)
2. Set the environment variable:
   ```bash
   export MASSIVE_API_KEY=your_key_here
   ```
   Or add to your `.env` file, Claude Desktop config, or shell profile.
3. The key is read at call time -- no server restart needed after setting it.

### import_from_massive

Import market data directly from the Massive.com REST API.

**Parameters:**
- `ticker` -- plain ticker symbol (e.g., `SPX`, `VIX`, `SPY`). API prefixes are added automatically.
- `from` -- start date (`YYYY-MM-DD`)
- `to` -- end date (`YYYY-MM-DD`)
- `target_table` -- destination: `"daily"`, `"context"`, or `"intraday"`
- `skip_enrichment` -- (optional) set `true` to skip auto-enrichment after import
- `timespan` -- (optional) bar size for intraday: `"minute"`, `"hour"` (default: `"minute"`)

**Daily OHLCV import:**
```
import_from_massive ticker=SPX from=2024-01-01 to=2024-12-31 target_table=daily
```

**VIX context import:**
```
import_from_massive ticker=VIX target_table=context from=2024-01-01 to=2024-12-31
```

When `target_table="context"`, the tool automatically fetches VIX, VIX9D, and VIX3M data and merges them into the `market.context` table.

**Intraday minute bars:**
```
import_from_massive ticker=SPY from=2024-06-01 to=2024-06-30 target_table=intraday
```

### Ticker Formats

| Type | Plain Ticker | API Format | Storage Format |
|------|-------------|------------|----------------|
| Stock | SPY | SPY | SPY |
| Index | VIX | I:VIX | VIX |
| Option | SPY 01/17/25 470C | O:SPY250117C00470000 | SPY250117C00470000 |

The API client automatically adds and removes `I:` and `O:` prefixes. Always use plain tickers in tool calls.

### OCC Option Ticker Format

Options use the OCC standardized format:

```
{ROOT}{YYMMDD}{C|P}{STRIKE*1000 padded to 8 digits}
```

Examples:
- SPY Jan 17, 2025 $470 Call: `SPY250117C00470000`
- SPX Dec 19, 2025 $4500 Put: `SPX251219P04500000`
- QQQ Mar 21, 2025 $450.50 Call: `QQQ250321C00450500`

## Trade Replay

### replay_trade

Replay historical trades using Massive.com option minute bars to see minute-by-minute P&L paths.

**Hypothetical mode:** Provide explicit legs with strikes, expiry, and entry prices:
```
replay_trade mode=hypothetical ticker=SPX expiry=2025-01-17 entry_date=2025-01-15 legs=[...]
```

**Tradelog mode:** Replay an existing trade from your data:
```
replay_trade mode=tradelog block_id=my-strategy trade_index=5
```

Returns minute-by-minute P&L path with:
- **MFE** (Max Favorable Excursion) -- best unrealized gain during the trade
- **MAE** (Max Adverse Excursion) -- worst unrealized loss during the trade
- Entry/exit timestamps and prices

## Enrichment Pipeline

After daily imports, enrichment runs automatically (unless `skip_enrichment=true`).

### Tier 1: Technical Indicators (market.daily)

| Field | Description |
|-------|-------------|
| RSI_14 | 14-period Relative Strength Index |
| ATR_14 | 14-period Average True Range |
| EMA_9 | 9-period Exponential Moving Average |
| SMA_20, SMA_50 | Simple Moving Averages |
| Realized_Vol | Realized volatility |
| Gap_Pct | Overnight gap percentage |
| Prior_Close | Previous session close |
| Prior_Range_vs_ATR | Previous range relative to ATR |
| BB_Width, BB_Position | Bollinger Band metrics |

### Tier 2: VIX Context (market.context)

| Field | Description |
|-------|-------------|
| VIX_IVR, VIX_IVP | VIX Implied Volatility Rank and Percentile (252-day) |
| VIX9D_IVR, VIX9D_IVP | 9-day VIX rank and percentile |
| VIX3M_IVR, VIX3M_IVP | 3-month VIX rank and percentile |
| Vol_Regime | Low / Medium / High / Extreme (based on IVR thresholds) |
| Term_Structure | Contango / Backwardation (VIX vs VIX3M) |

Run enrichment separately with `enrich_market_data` if you imported with `skip_enrichment=true`.

## Target Tables Reference

| Table | Schema Key | Primary Use |
|-------|-----------|-------------|
| `market.daily` | `ticker, date` | Daily OHLCV + technical indicators |
| `market.context` | `date` | VIX term structure + regime classification |
| `market.intraday` | `ticker, date, time` | Minute/hourly bar data for ORB and replay |
