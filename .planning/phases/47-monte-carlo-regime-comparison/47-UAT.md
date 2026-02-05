---
status: complete
phase: 47-monte-carlo-regime-comparison
source: 47-01-SUMMARY.md, 47-02-SUMMARY.md
started: 2026-02-05T12:00:00Z
updated: 2026-02-05T12:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Default Regime Comparison
expected: Running analyze_regime_comparison with just blockId="main-port" returns fullHistory (3425 trades) and recentWindow (~685 trades) with 6 statistics each, 4 metric comparisons with divergence scores, divergence severity classification, and resolved parameters
result: pass

### 2. Strategy Filter
expected: Running with strategy="0/1 DC" returns results filtered to only that strategy's trades, with reduced trade counts and strategy-specific statistics
result: pass

### 3. Custom Parameters
expected: Running with recentWindowSize=100, numSimulations=500, randomSeed=123 returns results using those exact parameters (visible in parameters section), different stats than defaults due to different seed/window
result: pass

### 4. Nonexistent Strategy Error
expected: Running with strategy="nonexistent_strategy_xyz" returns a clear error message indicating no trades found for that strategy
result: pass

### 5. Insufficient Trades Handling
expected: Running on a block with very few trades (or a strategy with <30 trades) returns an error about insufficient trades
result: pass

### 6. Divergence Severity Classification
expected: The tool classifies divergence into severity levels — "aligned" for main-port full (score ~0.08), "mild_divergence" for filtered/smaller windows, and higher severities for blocks with genuine regime differences
result: pass

### 7. Nonexistent Block Error
expected: Running with a nonexistent blockId returns a clear error message about the block not being found
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
