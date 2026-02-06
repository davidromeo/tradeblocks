---
status: complete
phase: 49-live-alignment-signal
source: [49-01-SUMMARY.md, 49-02-SUMMARY.md]
started: 2026-02-06T15:30:00Z
updated: 2026-02-06T15:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Block WITH reporting log returns alignment metrics (main-port, 3425 trades)
expected: Tool returns available=true with direction agreement, execution efficiency, alignment trend, and data quality
result: pass
notes: 97.2% direction agreement (35/36 days), efficiency 1.27, 38 matched trades (66.7% match rate), 12 strategies broken out, overlap range 2026-01-02 to 2026-02-02

### 2. Block WITH reporting log returns alignment metrics (main-port-2026-ytd, 60 trades)
expected: Tool returns available=true with metrics for smaller block
result: pass
notes: 97.7% direction agreement (43/44 days), efficiency 0.83, 46 matched trades (76.7% match rate), 13 strategies broken out

### 3. Block WITHOUT reporting log returns graceful skip (btfd dc)
expected: Tool returns available=false with reason "no reporting log" via createToolOutput (not error)
result: pass
notes: Returns `{"blockId":"btfd dc","strategy":null,"available":false,"reason":"no reporting log"}` as non-error response

### 4. Strategy filter narrows results (main-port, strategy="8/10 DC - v2")
expected: Only the filtered strategy appears in results, both backtest and actual filtered
result: pass
notes: Returns 186 backtest (full history for that strategy), 4 actual, 4 matched (100%), single strategy in byStrategy arrays, overlap range 2026-01-06 to 2026-01-27

### 5. Scaling mode: raw (main-port)
expected: P/L values used as-is without per-contract normalization, efficiency reflects raw dollar amounts
result: pass
notes: Efficiency drops to 0.01 (expected -- backtest has ~10x contracts so raw PL comparison is massively skewed). Per-strategy slippageStdDev values are in raw dollar range (tens of thousands). Direction agreement unchanged at 97.2%.

### 6. Scaling mode: toReported (main-port)
expected: Backtest P/L scaled down to match actual contract count, efficiency closer to 1.0 than raw
result: pass
notes: Efficiency 0.82 (backtest scaled down, more comparable). Per-contract gaps and slippage stdev in reasonable dollar ranges. Direction agreement unchanged at 97.2%.

### 7. Scaling mode: perContract (default, main-port)
expected: Both sides divided by contract count for fair per-lot comparison
result: pass
notes: Efficiency 1.27 (per-contract basis, actual outperforming per lot). This is the default mode. Direction agreement 97.2%.

### 8. Existing tool: compare_backtest_to_actual still works after refactor
expected: Tool returns trade comparison data without errors (uses shared formatDateKey, truncateTimeToMinute, etc.)
result: pass
notes: Returns 1.1M chars of comparison data with strategy grouping and perContract scaling -- no errors, full output generated

### 9. Existing tool: analyze_discrepancies still works via re-export shim
expected: Tool returns slippage patterns (imports from slippage-helpers.ts which is now a re-export shim)
result: pass
notes: 38 matched trades, $948.06 total slippage, 12 per-strategy breakdowns, market correlations computed

### 10. Existing tool: analyze_slippage_trends still works via re-export shim
expected: Tool returns trend analysis (imports from slippage-helpers.ts re-export shim)
result: pass
notes: 5 weekly periods, improving trend (slope -60.73, p=0.011), per-strategy trends computed, external factor correlation with VIX

### 11. Per-strategy underperforming flag
expected: Strategies with efficiency < 1.0 show underperforming=true, >= 1.0 show false
result: pass
notes: main-port perContract: 8/12 strategies underperforming=true (efficiency < 1.0), 4 strategies underperforming=false (efficiency >= 1.0). Verified "8/10 DC - v2" at 1.95 → false, "DC 2/7 Tues" at 0.59 → true.

### 12. Alignment trend with insufficient data
expected: sufficientForTrends=false when < 4 months of data, directionTrend and efficiencyTrend are null
result: pass
notes: All blocks have only 2 months of overlap data → sufficientForTrends=false, both trend fields null, monthlySeries has 2 entries

### 13. Data quality metrics
expected: matchRate, overlapDateRange, warnings, trade counts all populated correctly
result: pass
notes: main-port: matchRate=0.667, overlap 2026-01-02 to 2026-02-02, 3425 backtest / 60 actual / 38 matched, 2 overlap months, no warnings. main-port-2026-ytd: matchRate=0.767, 60/60/46.

## Summary

total: 13
passed: 13
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
