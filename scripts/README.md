# Generating spx_daily.csv Without TradingView Premium

TradeBlocks' `market.spx_daily` table unlocks powerful hypothesis testing — VIX regime analysis, term structure filtering, trend scoring, and more. The official data source is a TradingView Premium export, but not everyone has a Premium subscription ($60+/month).

This script generates a fully compatible `spx_daily.csv` using **Yahoo Finance (free, no account required)** via the `yfinance` Python library.

## What it generates

- **1,000+ rows** of daily SPX data from 2022 to today
- **Full VIX term structure**: VIX9D, VIX, VIX3M with ratios and `Term_Structure_State`
- **Vol_Regime** classification (1=very low … 6=extreme)
- **Technical indicators**: RSI-14, ATR%, EMA21, SMA50, Trend Score, Bollinger Band position
- **Calendar features**: Day of week, month, OPEX flag, consecutive days streak
- All fields compatible with TradeBlocks' `market.spx_daily` schema

## Requirements

```bash
pip install yfinance pandas numpy pytz
```

## Usage

```bash
# Generate to default output path
python3 generate_spx_daily.py

# Custom output path or date range
python3 generate_spx_daily.py --output /path/to/_marketdata/spx_daily.csv --start 2020-01-01
```

Place the output in your TradeBlocks `_marketdata/` folder. TradeBlocks auto-imports it on the next tool call.

## Daily automation (Linux/macOS cron)

```bash
# Run every weekday at 6 PM after US market close
0 18 * * 1-5 python3 /path/to/generate_spx_daily.py >> /tmp/spx_daily.log 2>&1
```

## Fields not available from daily data

Intraday fields (`High_Time`, `Low_Time`, `High_Before_Low`, etc.) are set to `NaN`. TradeBlocks handles this gracefully — all other features work fully.

## Compatibility

Outputs a `time` column as Unix timestamp (4 PM ET) matching TradeBlocks' TradingView import format. Tested with TradeBlocks v2.9.
