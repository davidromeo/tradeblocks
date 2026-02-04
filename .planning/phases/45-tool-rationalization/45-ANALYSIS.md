# Phase 45: Tool Rationalization Analysis

**Date:** 2026-02-04
**Version:** 0.6.0

## Summary

This document records the analysis and decisions for MCP tool rationalization. With `run_sql` and `describe_database` now providing flexible SQL access to DuckDB, query-only tools are redundant. This phase removes 7 tools that SQL can fully replace while keeping computational tools that use TradeBlocks libraries.

## Decision Framework

**Removal criteria:** A tool is removed ONLY if `run_sql` can do 100% of what it does.

**Key principle:** SQL is for data access, filtering, and aggregation. TradeBlocks libraries are for statistical computation.

## Tools Removed (7)

### 1. `get_trades`

**Location:** `tools/blocks/core.ts`

**What it did:** Filter, sort, and paginate trades with optional strategy/date/P&L filters.

**Why removed:** SQL provides identical functionality with more flexibility.

**SQL replacement:**
```sql
SELECT date_opened, time_opened, strategy, legs, pl, num_contracts,
       opening_commissions + closing_commissions as commissions
FROM trades.trade_data
WHERE block_id = 'my-block'
  AND strategy ILIKE '%iron%'
  AND pl > 0
ORDER BY date_opened DESC
LIMIT 50 OFFSET 0;
```

---

### 2. `list_available_fields`

**Location:** `tools/reports/fields.ts`

**What it did:** Listed fields available for filtering, grouped by category.

**Why removed:** `describe_database` provides complete schema info with column descriptions, types, and hypothesis flags.

**SQL replacement:**
- Use `describe_database` tool for schema introspection
- Schema metadata includes human-readable descriptions

---

### 3. `run_filtered_query`

**Location:** `tools/reports/queries.ts`

**What it did:** Applied filter conditions (eq, neq, gt, gte, lt, lte, between) with AND/OR logic.

**Why removed:** SQL WHERE clauses are more expressive and flexible.

**SQL replacement:**
```sql
SELECT COUNT(*) as match_count,
       SUM(CASE WHEN pl > 0 THEN 1 ELSE 0 END) as winners,
       SUM(pl) as total_pl
FROM trades.trade_data
WHERE block_id = 'my-block'
  AND VIX_Close > 20
  AND Gap_Pct BETWEEN -0.5 AND 0.5;
```

---

### 4. `aggregate_by_field`

**Location:** `tools/reports/queries.ts`

**What it did:** Bucketed trades by field values and calculated aggregate metrics.

**Why removed:** SQL GROUP BY with CASE expressions provides the same bucketing capability.

**SQL replacement:**
```sql
SELECT
  CASE
    WHEN m.VIX_Close < 15 THEN '10-15'
    WHEN m.VIX_Close < 20 THEN '15-20'
    WHEN m.VIX_Close < 25 THEN '20-25'
    ELSE '25+'
  END as vix_bucket,
  COUNT(*) as trades,
  SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate,
  SUM(t.pl) as total_pl
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
GROUP BY vix_bucket
ORDER BY vix_bucket;
```

---

### 5. `get_market_context`

**Location:** `tools/market-data.ts`

**What it did:** Queried market conditions for dates with optional filters.

**Why removed:** Direct SQL on `market.spx_daily` with optional joins to `market.spx_15min`, `market.spx_highlow`, `market.vix_intraday`.

**SQL replacement:**
```sql
SELECT date, VIX_Close, Vol_Regime, Term_Structure_State, Gap_Pct
FROM market.spx_daily
WHERE date BETWEEN '2024-01-01' AND '2024-06-30'
  AND VIX_Close > 20
ORDER BY date;
```

---

### 6. `enrich_trades`

**Location:** `tools/market-data.ts`

**What it did:** Joined market context data to trades.

**Why removed:** SQL JOIN is the canonical way to do this.

**SQL replacement:**
```sql
SELECT t.date_opened, t.strategy, t.pl,
       m.VIX_Close, m.Vol_Regime, m.Gap_Pct
FROM trades.trade_data t
LEFT JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'my-block';
```

---

### 7. `find_similar_days`

**Location:** `tools/market-data.ts`

**What it did:** Found historical days with similar market conditions.

**Why removed:** SQL CTEs can express similarity conditions.

**SQL replacement:**
```sql
WITH ref AS (
  SELECT VIX_Close, Vol_Regime, Term_Structure_State
  FROM market.spx_daily WHERE date = '2024-01-15'
)
SELECT m.date, m.VIX_Close, m.Vol_Regime, m.Term_Structure_State
FROM market.spx_daily m, ref
WHERE m.date != '2024-01-15'
  AND m.Vol_Regime = ref.Vol_Regime
  AND ABS(m.VIX_Close - ref.VIX_Close) < 3
ORDER BY ABS(m.VIX_Close - ref.VIX_Close)
LIMIT 20;
```

---

## Tools Kept

### Core Computational Tools

These tools use TradeBlocks library functions that compute metrics SQL cannot:

| Tool | Library Function | Why Keep |
|------|------------------|----------|
| `get_statistics` | `PortfolioStatsCalculator.calculatePortfolioStats()` | Sharpe, Sortino, Calmar ratios |
| `get_strategy_comparison` | `calculateStrategyStats()` | Per-strategy breakdown |
| `compare_blocks` | `PortfolioStatsCalculator` | Side-by-side portfolio comparison |
| `block_diff` | `calculateStrategyStats()` | Strategy overlap + attribution |
| `stress_test` | `PortfolioStatsCalculator` | Market scenario testing |
| `drawdown_attribution` | Custom equity curve | Drawdown contributor analysis |
| `marginal_contribution` | Iterative `calculatePortfolioStats()` | Leave-one-out Sharpe/Sortino |
| `strategy_similarity` | Correlation + tail risk libraries | Redundancy detection |
| `what_if_scaling` | `PortfolioStatsCalculator` with modified trades | Weight simulation |
| `portfolio_health_check` | Multiple: correlation, tail risk, MC, WFA | Comprehensive health |
| `run_walk_forward` | `WalkForwardAnalyzer.analyze()` | Walk-forward optimization |
| `run_monte_carlo` | `runMonteCarloSimulation()` | Monte Carlo simulation |
| `get_correlation_matrix` | `calculateCorrelationMatrix()` | Strategy correlations |
| `get_tail_risk` | `performTailRiskAnalysis()` | Gaussian copula analysis |
| `get_position_sizing` | `calculateKellyMetrics()` | Kelly criterion |
| `find_predictive_fields` | `pearsonCorrelation()` | Field predictiveness |

### Tools with Trade Enrichment

| Tool | Why Keep |
|------|----------|
| `get_field_statistics` | Needs trade enrichment for calculated fields (MFE/MAE, ROM) |
| `filter_curve` | Threshold sweep with enrichment logic |
| `analyze_regime_performance` | Enrichment + statistical breakdown |
| `suggest_filters` | Complex filter testing with projected impact |
| `calculate_orb` | 15-min checkpoint math not in DB |

### Infrastructure/Sync Tools

| Tool | Why Keep |
|------|----------|
| `list_blocks` | Entry point, sync orchestration |
| `get_block_info` | Quick metadata |
| `get_reporting_log_stats` | Actual trade stats |
| `run_sql` | Core SQL engine |
| `describe_database` | Schema discovery |
| `purge_market_table` | Maintenance |

### Tools with Complex Business Logic

| Tool | Why Keep |
|------|----------|
| `compare_backtest_to_actual` | Scaling modes, strategy matching |
| `analyze_discrepancies` | Fuzzy matching, discrepancy detection |
| `suggest_strategy_matches` | Fuzzy string matching |
| `analyze_slippage_trends` | Library calculations |

---

## Breaking Changes

Version 0.6.0 removes 7 MCP tools. Users must migrate to SQL for:

1. **Trade querying** - Use `run_sql` with `SELECT ... FROM trades.trade_data`
2. **Field discovery** - Use `describe_database` for schema info
3. **Filtered queries** - Use SQL `WHERE` clauses
4. **Aggregations** - Use SQL `GROUP BY` with `CASE` expressions
5. **Market data** - Use SQL on `market.*` tables
6. **Trade enrichment** - Use SQL `JOIN`
7. **Similar day finding** - Use SQL CTEs with similarity conditions

---

## Migration Notes

### For AI Agents (Claude)

The `describe_database` tool now includes example queries covering all patterns from removed tools. When Claude needs to:

- **Get trades**: Write a `SELECT` on `trades.trade_data`
- **Check field availability**: Call `describe_database`
- **Filter trades**: Use SQL `WHERE` with conditions
- **Group by field**: Use SQL `GROUP BY` with `CASE` for buckets
- **Join market data**: Use `LEFT JOIN market.spx_daily m ON t.date_opened = m.date`

### For Direct Users

The `--call` CLI mode still works for all remaining tools:
```bash
TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call run_sql '{"query": "SELECT ..."}'
```

---

*Analysis complete. See CHANGELOG.md for breaking change summary.*
