# Quick Task 002: Add reporting_data SQL table and legs to backtest comparison

**Completed:** 2026-02-04
**Duration:** ~15 minutes
**Version:** 0.6.1

## One-liner

Added trades.reporting_data DuckDB table synced from reportinglog.csv and backtestLegs/actualLegs fields to compare_backtest_to_actual output.

## What Was Built

### 1. trades.reporting_data SQL Table

New DuckDB table for storing actual/reported trade records from reportinglog.csv:
- 14 columns matching the reporting trade model
- Synced during block sync alongside trade_data
- Enables SQL queries comparing backtest vs actual trades

**Schema:**
```sql
CREATE TABLE trades.reporting_data (
  block_id VARCHAR NOT NULL,
  date_opened DATE NOT NULL,
  time_opened VARCHAR,
  strategy VARCHAR,
  legs VARCHAR,
  initial_premium DOUBLE,
  num_contracts INTEGER,
  pl DOUBLE NOT NULL,
  date_closed DATE,
  time_closed VARCHAR,
  closing_price DOUBLE,
  avg_closing_cost DOUBLE,
  reason_for_close VARCHAR,
  opening_price DOUBLE
)
```

### 2. Sync Logic for Reporting Logs

- Added `insertReportingBatch()` function mirroring `insertTradeBatch()`
- Sync happens within same transaction as tradelog sync
- Old reporting data deleted before new data inserted (same pattern as trade_data)
- Cleanup handled when blocks are deleted

### 3. Legs in compare_backtest_to_actual Output

When using `detailLevel: "trades"`:
- Added `backtestLegs` and `actualLegs` fields to comparison objects
- Legs differences appear in the `differences` array when strikes differ
- Summary mode has null legs (aggregated trades don't have individual legs)

**Example output:**
```json
{
  "backtestLegs": "1 Jan 14 6890 P STO 26.90 | 1 Jan 14 6990 C STO 17.95...",
  "actualLegs": "1 Jan 14 6895 P STO 28.20 | 1 Jan 14 6990 C STO 18.00...",
  "differences": [
    {
      "field": "legs",
      "backtest": "1 Jan 14 6890 P STO...",
      "actual": "1 Jan 14 6895 P STO..."
    }
  ]
}
```

### 4. Schema Metadata Updates

- Updated trades schema description to mention both trade_data and reporting_data
- Added full column descriptions for reporting_data table
- Added SQL example for comparing backtest vs actual trades via JOIN

## Files Modified

| File | Changes |
|------|---------|
| `packages/mcp-server/src/db/schemas.ts` | Added `ensureReportingDataTable()` function |
| `packages/mcp-server/src/db/connection.ts` | Import and call new table creation |
| `packages/mcp-server/src/db/index.ts` | Export new function |
| `packages/mcp-server/src/sync/block-sync.ts` | Added `insertReportingBatch()` and sync logic |
| `packages/mcp-server/src/utils/schema-metadata.ts` | Added reporting_data descriptions and SQL example |
| `packages/mcp-server/src/tools/performance.ts` | Added legs fields to DetailedComparison |
| `packages/mcp-server/package.json` | Version bump to 0.6.1 |
| `packages/mcp-server/CHANGELOG.md` | Document new features |

## Commits

| Commit | Description |
|--------|-------------|
| `ec39b75` | feat(quick-002): add trades.reporting_data table and sync logic |
| `1bc9a3a` | feat(quick-002): add legs to compare_backtest_to_actual output |
| `2788a65` | chore(quick-002): bump version to 0.6.1 and update changelog |

## Verification

- [x] `SELECT COUNT(*) FROM trades.reporting_data` returns 0 (no blocks with reporting logs synced yet)
- [x] Schema has all 14 expected columns
- [x] `compare_backtest_to_actual` includes `backtestLegs` and `actualLegs` in output
- [x] Legs differences appear in differences array when strikes differ
- [x] TypeScript compilation passes
- [x] Build succeeds

## Usage Examples

### Query reporting data via SQL
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call run_sql '{"query": "SELECT date_opened, strategy, legs, pl FROM trades.reporting_data WHERE block_id = '\''my-block'\''"}'
```

### Compare backtest vs actual with legs
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call compare_backtest_to_actual '{"blockId": "my-block", "detailLevel": "trades"}'
```

### SQL comparison between tables
```sql
SELECT
  t.date_opened, t.strategy, t.legs as bt_legs, r.legs as actual_legs,
  t.pl as bt_pl, r.pl as actual_pl, r.pl - t.pl as slippage
FROM trades.trade_data t
JOIN trades.reporting_data r
  ON t.block_id = r.block_id
  AND t.date_opened = r.date_opened
  AND t.strategy = r.strategy
WHERE t.block_id = 'my-block'
ORDER BY t.date_opened
```

## Notes

- Blocks need a file named `reportinglog.csv` (or configured via `csvMappings.reportinglog` in block.json) to sync reporting data
- Summary mode sets `backtestLegs` and `actualLegs` to null since trades are aggregated
