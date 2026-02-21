# Market Data Separation Design

Separate market data into its own DuckDB database with a normalized schema, model-driven import tools, and a TypeScript enrichment pipeline. Enables users to bring their own market data from any source (TradingView, IB, data vendors, other MCP servers) without being locked into TradeBlocks' internal data format.

## Motivation

Users have market data in various forms: broker exports, data vendor databases, TradingView CSVs, or data fetched via other MCP servers (e.g., tastytrade). Today, TradeBlocks requires TradingView Pine Script exports dropped into a `_marketdata/` folder with a specific column layout. This design removes that coupling.

The key insight: let the LLM be the adapter layer. Instead of building brittle format-specific parsers, expose a clean schema and import tools. The model inspects whatever data the user has, builds a column mapping, and pushes it through a unified import path.

## Architecture

### Separate Market Database

Market data moves out of `analytics.duckdb` into its own file:

- Configurable via `MARKET_DB_PATH` env var or CLI argument
- Defaults to `<baseDir>/market.duckdb` alongside existing `analytics.duckdb`
- ATTACHed as the `market` schema at MCP server startup
- `analytics.duckdb` retains only the `trades` schema

### Normalized Schema

Four tables in the market database:

**`market.daily`** - Primary key: `(ticker, date)`

Per-ticker daily OHLCV and computed indicators.

| Column | Type | Source |
|--------|------|--------|
| ticker | VARCHAR | Import |
| date | DATE | Import |
| open | DOUBLE | Import (required) |
| high | DOUBLE | Import (required) |
| low | DOUBLE | Import (required) |
| close | DOUBLE | Import (required) |
| volume | DOUBLE | Import (optional) |
| Gap_Pct | DOUBLE | Enrichment |
| Intraday_Range_Pct | DOUBLE | Enrichment |
| Intraday_Return_Pct | DOUBLE | Enrichment |
| Total_Return_Pct | DOUBLE | Enrichment |
| Close_Position_In_Range | DOUBLE | Enrichment |
| Gap_Filled | INTEGER | Enrichment |
| Return_5D | DOUBLE | Enrichment |
| Return_20D | DOUBLE | Enrichment |
| Consecutive_Days | INTEGER | Enrichment |
| RSI_14 | DOUBLE | Enrichment |
| ATR_Pct | DOUBLE | Enrichment |
| Price_vs_EMA21_Pct | DOUBLE | Enrichment |
| Price_vs_SMA50_Pct | DOUBLE | Enrichment |
| Trend_Score | INTEGER | Enrichment |
| BB_Position | DOUBLE | Enrichment |
| BB_Width | DOUBLE | Enrichment (new) |
| Realized_Vol_5D | DOUBLE | Enrichment (new) |
| Realized_Vol_20D | DOUBLE | Enrichment (new) |
| Prior_Range_vs_ATR | DOUBLE | Enrichment (new) |
| High_Time | DOUBLE | Enrichment (from intraday) |
| Low_Time | DOUBLE | Enrichment (from intraday) |
| High_Before_Low | INTEGER | Enrichment (from intraday) |
| High_In_First_Hour | INTEGER | Enrichment (from intraday) |
| Low_In_First_Hour | INTEGER | Enrichment (from intraday) |
| High_In_Last_Hour | INTEGER | Enrichment (from intraday) |
| Low_In_Last_Hour | INTEGER | Enrichment (from intraday) |
| Reversal_Type | INTEGER | Enrichment (from intraday) |
| High_Low_Spread | DOUBLE | Enrichment (from intraday) |
| Early_Extreme | INTEGER | Enrichment (from intraday) |
| Late_Extreme | INTEGER | Enrichment (from intraday) |
| Intraday_High | DOUBLE | Enrichment (from intraday) |
| Intraday_Low | DOUBLE | Enrichment (from intraday) |

**`market.context`** - Primary key: `(date)`

Global market conditions shared across all tickers. One row per trading day.

| Column | Type | Source |
|--------|------|--------|
| date | DATE | Import |
| VIX_Open | DOUBLE | Import |
| VIX_Close | DOUBLE | Import |
| VIX_High | DOUBLE | Import (optional) |
| VIX_Low | DOUBLE | Import (optional) |
| VIX_Change_Pct | DOUBLE | Enrichment |
| VIX_Spike_Pct | DOUBLE | Enrichment |
| VIX_Percentile | DOUBLE | Enrichment |
| Vol_Regime | INTEGER | Enrichment |
| VIX9D_Open | DOUBLE | Import (optional) |
| VIX9D_Close | DOUBLE | Import (optional) |
| VIX9D_Change_Pct | DOUBLE | Enrichment |
| VIX3M_Open | DOUBLE | Import (optional) |
| VIX3M_Close | DOUBLE | Import (optional) |
| VIX3M_Change_Pct | DOUBLE | Enrichment |
| VIX9D_VIX_Ratio | DOUBLE | Enrichment |
| VIX_VIX3M_Ratio | DOUBLE | Enrichment |
| Term_Structure_State | INTEGER | Enrichment |

**`market.intraday`** - Primary key: `(ticker, date, time)`

Normalized bar data at any resolution. One row per bar.

| Column | Type |
|--------|------|
| ticker | VARCHAR |
| date | DATE |
| time | TIME |
| open | DOUBLE |
| high | DOUBLE |
| low | DOUBLE |
| close | DOUBLE |
| volume | DOUBLE |

Works for any ticker and any bar resolution (1-min, 5-min, 15-min, etc.). VIX intraday data goes here with `ticker = 'VIX'`.

**`market._sync_metadata`** - Primary key: `(source, ticker)`

Tracks what has been imported and enriched.

| Column | Type |
|--------|------|
| source | VARCHAR |
| ticker | VARCHAR |
| content_hash | VARCHAR |
| row_count | INTEGER |
| min_date | DATE |
| max_date | DATE |
| enriched | BOOLEAN |
| imported_at | TIMESTAMP |

## Import Tools

Two MCP tools with the same column mapping contract. The model inspects the user's data source, builds the mapping, and calls the appropriate tool.

### `import_csv`

Imports market data from a CSV file.

```
import_csv(
  file_path: string,
  column_mapping: Record<string, string>,  // schema field → CSV header
  table: "daily" | "context" | "intraday",
  ticker: string,
  skip_enrichment?: boolean  // default false
)
```

- Validates that required columns are present in the mapping
- Inserts with `ON CONFLICT DO NOTHING` for safe overlapping imports
- Runs enrichment pipeline after insert unless `skip_enrichment: true`
- Returns: rows imported, rows skipped (duplicates), enrichment status

### `import_from_database`

Imports market data from an external DuckDB file.

```
import_from_database(
  db_path: string,
  query: string,              // SELECT against the source DB
  column_mapping: Record<string, string>,
  table: "daily" | "context" | "intraday",
  ticker: string,
  skip_enrichment?: boolean
)
```

- ATTACHes source DB read-only with a temp alias
- Executes the user's query to extract data
- Maps columns and inserts into market DB
- DETACHes source DB when done
- Same enrichment and return behavior as `import_csv`

### Shared Internals

Both tools share internal functions (not exposed as MCP tools):

- `validateColumnMapping(table, mapping)` - Checks required fields per target table
- `insertMappedRows(table, ticker, rows)` - INSERT with ON CONFLICT handling
- `runEnrichment(ticker, dateRange)` - The TypeScript enrichment pipeline

### Model Workflow

For any data source, the model follows the same pattern:

1. Inspect the source (read CSV headers, or ATTACH + DESCRIBE a database)
2. Build the column mapping (model determines which source columns map to schema fields)
3. Call `import_csv` or `import_from_database`
4. Enrichment runs automatically

For incremental updates (e.g., "get yesterday's data from tastytrade"):

1. Model calls tastytrade MCP to fetch the data
2. Writes it to a small CSV
3. Calls `import_csv` with the mapping
4. Same path, same contract

## Enrichment Pipeline

TypeScript module that computes derived fields from raw data. Runs after each import unless skipped. Idempotent - re-running overwrites with the same values.

### Architecture

Each indicator is a pure function that can be unit tested independently:

```typescript
calculateRSI(closes: number[], period: number): number[]
calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[]
calculateEMA(values: number[], period: number): number[]
// etc.
```

The enrichment runner:

1. SELECTs raw OHLCV from `market.daily` for the affected ticker/date range
2. Computes all Tier 1 indicators in TypeScript
3. JOINs to `market.context` for VIX data, computes Tier 2 if available
4. Queries `market.intraday` for intraday timing fields, computes Tier 3 if available
5. UPDATEs computed fields back to `market.daily` and `market.context`
6. Updates `_sync_metadata` enrichment status

### Tier 1 - From Single Ticker OHLCV (always runs)

| Field | Formula |
|-------|---------|
| Gap_Pct | (open - prior close) / prior close * 100 |
| Intraday_Range_Pct | (high - low) / open * 100 |
| Intraday_Return_Pct | (close - open) / open * 100 |
| Total_Return_Pct | (close - prior close) / prior close * 100 |
| Close_Position_In_Range | (close - low) / (high - low) |
| Gap_Filled | price crossed prior close during session |
| Return_5D, Return_20D | Lookback cumulative returns |
| Consecutive_Days | Up/down streak counter |
| RSI_14 | 14-period Wilder's exponential smoothing |
| ATR_Pct | 14-period ATR / close * 100 (Wilder smoothing) |
| Price_vs_EMA21_Pct | (close - EMA21) / close * 100 |
| Price_vs_SMA50_Pct | (close - SMA50) / close * 100 |
| Trend_Score | Count of close > EMA9/EMA21/SMA50/SMA200 (0-4) |
| BB_Position | (close - lower) / (upper - lower), 20-period 2-sigma |
| BB_Width | (upper - lower) / middle band (new) |
| Realized_Vol_5D | 5-day rolling stdev of daily returns * sqrt(252) (new) |
| Realized_Vol_20D | 20-day rolling stdev of daily returns * sqrt(252) (new) |
| Prior_Range_vs_ATR | Prior day (high - low) / ATR (new) |

### Tier 2 - From VIX Data in `market.context` (runs if VIX data exists)

| Field | Formula |
|-------|---------|
| VIX_Change_Pct | (VIX_Close - prior VIX_Close) / prior * 100 |
| VIX_Spike_Pct | (VIX_High - VIX_Open) / VIX_Open * 100 |
| VIX_Percentile | Percentile rank over 252 trading days |
| Vol_Regime | Threshold buckets: <13=1, 13-16=2, 16-20=3, 20-25=4, 25-30=5, >30=6 |
| Term_Structure_State | VIX9D > VIX → -1, VIX > VIX3M → 0, else → 1 |
| VIX9D_VIX_Ratio | VIX9D_Close / VIX_Close |
| VIX_VIX3M_Ratio | VIX_Close / VIX3M_Close |
| VIX9D_Change_Pct, VIX3M_Change_Pct | Daily change percentages |

### Tier 3 - From Intraday Bars (runs if `market.intraday` has data)

| Field | Written to | Formula |
|-------|------------|---------|
| High_Time, Low_Time | market.daily | Decimal hour when daily high/low occurred |
| High_Before_Low | market.daily | 1 if high occurred before low |
| High/Low_In_First_Hour | market.daily | 1 if extreme in 9:30-10:30 window |
| High/Low_In_Last_Hour | market.daily | 1 if extreme in 15:00-16:00 window |
| Reversal_Type | market.daily | 1=morning high/afternoon low, -1=inverse, 0=trend |
| High_Low_Spread | market.daily | Hours between high and low |
| Early_Extreme, Late_Extreme | market.daily | Flags for extremes near open/close |
| Intraday_High, Intraday_Low | market.daily | Actual high/low prices from bars |
| Opening_Drive_Strength | market.daily | First 30-60 min move as % of ATR (new) |
| Intraday_Realized_Vol | market.daily | Realized vol computed from intraday bars (new) |

### Testing Strategy

Each indicator function is validated against known TradingView outputs from existing Pine Script data. Test cases use real market data where the expected values are computed by TradingView, ensuring formula parity.

## Tool Migration

### Table Reference Updates

| Old | New |
|-----|-----|
| `market.spx_daily` | `market.daily` JOIN `market.context` |
| `market.spx_15min` | `market.intraday` with time range filter |
| `market.vix_intraday` | `market.intraday WHERE ticker = 'VIX'` |

### Per-Tool Changes

**`enrich_trades`**: Split single-table query into `market.daily JOIN market.context ON date`. Intraday context queries `market.intraday` with time range filter (replaces named checkpoint columns). Add new enrichment fields to output.

**`analyze_regime_performance`**: `volRegime` and `termStructure` segmentation JOINs `market.context`. If context table is empty, skip those segmentations and report which are unavailable.

**`suggest_filters`**: VIX-based filters come from `market.context` JOIN. If no context data, skip VIX filters and suggest only price-based filters.

**`calculate_orb`**: Rewrite to query `market.intraday` with time range filter. Works for any bar resolution, actually simpler than the current checkpoint column approach.

**`run_sql`**: Update allowed table list. Users query new table names.

**`describe_database`**: Update schema metadata to reflect new structure.

### Graceful Degradation

Shared helper checks data availability before each tool runs:

```typescript
checkDataAvailability(ticker: string, dateRange: [string, string]): {
  hasDaily: boolean,
  hasContext: boolean,
  hasIntraday: boolean,
  intradayResolution: string | null
}
```

Tools use this to skip unavailable analyses and return clear messages like "VIX context not available - import VIX data for regime analysis" rather than silently returning NULLs.

## Pine Script Simplification

The existing 3 Pine Scripts reduce to 1 minimal script.

**Keep (simplified) - `spx-daily.pine`:**

Exports only raw data that TypeScript cannot source on its own:

| Field | Why it stays |
|-------|-------------|
| Date, Open, High, Low, Close, Volume | Core OHLCV |
| VIX_Open, VIX_Close | From `request.security("CBOE:VIX", ...)` |
| VIX9D_Open, VIX9D_Close | From `request.security("CBOE:VIX9D", ...)` |
| VIX3M_Open, VIX3M_Close | From `request.security("CBOE:VIX3M", ...)` |

~12 columns instead of 55. All computed indicators are handled by the enrichment pipeline.

**Remove - `spx-15min-checkpoints.pine`:**

Replaced by native TradingView bar export at any resolution. Users export raw bars and import into `market.intraday`.

**Remove - `vix-intraday.pine`:**

Same - native VIX bar export imported into `market.intraday` with `ticker = 'VIX'`.

## Migration

Ships as one release. No coexistence phase.

**Step 1 - Build:**
- New market DB with normalized schema
- Import tools (`import_csv`, `import_from_database`)
- TypeScript enrichment pipeline
- Migrate all existing tools to new table names and JOINs

**Step 2 - Migration tooling:**
- `migrate_market_data` MCP tool that:
  1. Reads existing data from `analytics.duckdb` market tables
  2. Transforms to normalized schema (splits denormalized VIX fields into `market.context`, pivoted checkpoints into `market.intraday` rows)
  3. Writes to new market DB
  4. Reports what was migrated
- One-time operation per user, model-guided

**Step 3 - Remove old system:**
- Delete `_marketdata/` folder sync code (`market-sync.ts`)
- Drop old market table creation from `schemas.ts`
- Remove old `market.*` tables from `analytics.duckdb`
- Update simplified Pine Script

## Field Timing Classification

The lookahead prevention framework carries forward with the same logic:

- **Open-known fields** (safe at trade entry): Gap_Pct, VIX_Open, Prior_Close, open, VIX_Gap_Pct, Prev_Return_Pct, VIX9D_Open, VIX3M_Open
- **Static fields** (known in advance): Day_of_Week, Month, Is_Opex
- **Close-known fields** (must use LAG for entry analysis): Everything else

`buildLookaheadFreeQuery()` updated to reference new table structure with JOINs.

New enrichment fields classified as:
- **Realized_Vol_5D, Realized_Vol_20D**: Close-known (uses close prices)
- **BB_Width**: Close-known (uses Bollinger Bands)
- **Prior_Range_vs_ATR**: Open-known (uses prior day's range vs ATR, both known at open)
- **Opening_Drive_Strength**: Close-known (needs first hour to complete)
- **Intraday_Realized_Vol**: Close-known (needs full session)
