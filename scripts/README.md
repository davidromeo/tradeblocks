# TradeBlocks Data Generation Scripts

Python scripts to generate market data and custom indicator CSVs for import into TradeBlocks.

## Dependencies

```bash
pip install yfinance pandas numpy scipy
```

## Scripts

### `generate_spx_daily.py` — Market Data CSV

Downloads daily SPX, VIX, VIX9D, VIX3M data from Yahoo Finance and computes
derived columns (returns, rolling stats, regime labels).

**Output:** `spx_daily.csv` — import via TradeBlocks Block Management
(target table: `context` or `daily`)

```bash
python scripts/generate_spx_daily.py \
  --output /home/carsten/dev/tradeblocks-data/spx_daily.csv
```

---

### `generate_custom_indicators.py` — Custom Indicators CSV

Calculates two indicators from the Straddle tradelog and SPX data:

| Column | Formula |
|--------|---------|
| `VIX_MA_Ratio` | `VIX_Close / rolling_mean(VIX_Close, 20)` |
| `VRP_daily` | `IV_straddle(09:45) − RV_GK` (Garman-Klass realized vol) |

**Output columns:** `date, VIX_MA_Ratio, VIX_MA_Regime, VIX_MA_Label, VRP_daily, VRP_MA20`

**Output:** `custom_indicators.csv` — import via Static Datasets page

```bash
# Without VRP (VIX_MA_Ratio only):
python scripts/generate_custom_indicators.py \
  --output /home/carsten/dev/tradeblocks-data/custom_indicators.csv

# With VRP (requires OptionOmega tradelog at 09:45 ET):
python scripts/generate_custom_indicators.py \
  --vrp \
  --trades /path/to/tradelog.csv \
  --spx /home/carsten/dev/tradeblocks-data/spx_daily.csv \
  --output /home/carsten/dev/tradeblocks-data/custom_indicators.csv
```

---

## Test Data Setup for Dev Environment

```bash
# 1. Generate SPX market data
python scripts/generate_spx_daily.py \
  --output /home/carsten/dev/tradeblocks-data/spx_daily.csv

# 2. Generate custom indicators (with VRP)
python scripts/generate_custom_indicators.py \
  --vrp \
  --trades /home/tradeblocks/data/Straddle-multi/tradelog.csv \
  --spx /home/carsten/dev/tradeblocks-data/spx_daily.csv \
  --output /home/carsten/dev/tradeblocks-data/custom_indicators.csv

# 3. Start dev server
npm run dev -- --port 3001

# 4. Open http://localhost:3001/static-datasets and upload custom_indicators.csv
#    Set match strategy: same-day
```
