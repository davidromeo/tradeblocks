# Market Data Import

Market data is imported via MCP tools — no Pine Scripts needed. TradingView exports raw OHLCV natively from any chart.

## Import Workflow

1. **Export from TradingView**: Open chart (SPX, VIX, etc.) → Right-click → "Export chart data..."
2. **Import via MCP**: Use `import_market_csv` to load the CSV into the correct table
3. **Enrich**: Use `enrich_market_data` to compute ~40 derived indicators from raw OHLCV

## Target Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `market.daily` | Daily OHLCV + enriched indicators | ticker, date, open, high, low, close |
| `market.context` | VIX / volatility context data | date, VIX_Open, VIX_Close, Vol_Regime |
| `market.intraday` | Intraday bars (any resolution) | ticker, date, time, open, high, low, close |

## Example Imports

### SPX Daily (from TradingView SPX daily chart)

```
import_market_csv:
  file_path: "~/Downloads/CBOE_SPX, 1D.csv"
  ticker: "SPX"
  target_table: "daily"
  column_mapping: { "time": "date", "open": "open", "high": "high", "low": "low", "close": "close" }
```

### VIX Daily (from TradingView CBOE:VIX daily chart)

```
import_market_csv:
  file_path: "~/Downloads/CBOE_VIX, 1D.csv"
  ticker: "VIX"
  target_table: "context"
  column_mapping: { "time": "date", "open": "VIX_Open", "high": "VIX_High", "low": "VIX_Low", "close": "VIX_Close" }
```

### VIX9D / VIX3M (for term structure)

```
import_market_csv:
  file_path: "~/Downloads/CBOE_VIX9D, 1D.csv"
  ticker: "VIX9D"
  target_table: "context"
  column_mapping: { "time": "date", "close": "VIX9D_Close" }
```

### SPX 5-min Intraday (from TradingView SPX 5-min chart)

```
import_market_csv:
  file_path: "~/Downloads/CBOE_SPX, 5.csv"
  ticker: "SPX"
  target_table: "intraday"
  column_mapping: { "time": "date", "open": "open", "high": "high", "low": "low", "close": "close" }
```

## After Import

Run `enrich_market_data` to compute derived fields:

- **Tier 1** (from daily OHLCV): RSI_14, ATR_Pct, BB_Position, BB_Width, Realized_Vol, Gap_Pct, etc.
- **Tier 2** (from context VIX data): Vol_Regime, Term_Structure_State, VIX_Percentile
- **Tier 3** (from intraday bars): Opening_Drive_Strength, Intraday_Realized_Vol

## Notes

- **Idempotent**: Re-importing the same data merges on conflict (no duplicates)
- **Column mapping**: The `time` column from TradingView maps to `date` — Unix timestamps are auto-converted to Eastern Time
- **Any ticker**: The schema supports any ticker, not just SPX/VIX
- **Any resolution**: Intraday bars work at any timeframe (1-min, 5-min, 15-min, etc.)
