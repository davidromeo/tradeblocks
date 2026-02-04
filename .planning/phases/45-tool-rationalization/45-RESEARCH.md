# Phase 45: Tool Rationalization - Research

**Researched:** 2026-02-04
**Domain:** MCP Tool Analysis and SQL Replacement
**Confidence:** HIGH

## Summary

This research analyzes all 40+ MCP tools in the TradeBlocks server to determine which can be replaced by `run_sql`. The analysis applies the user-established criteria: tools are candidates for removal ONLY if SQL can do 100% of what they do. Query-only tools are candidates; computational tools that use TradeBlocks libraries are not.

The key distinction is:
- **SQL layer**: Data access, filtering, aggregation, cross-block queries
- **TradeBlocks libraries**: Statistical computations (Sharpe, Sortino, Kelly, Monte Carlo, walk-forward, correlation matrices, tail risk)

After systematic analysis, **7 tools are recommended for removal** in this phase. These tools provide functionality that `run_sql` with `describe_database` can fully replace.

**Primary recommendation:** Remove `get_trades`, `list_available_fields`, `run_filtered_query`, `aggregate_by_field`, `get_market_context`, `enrich_trades`, and `find_similar_days`. Keep all computational tools that use TradeBlocks library functions.

## Tool Inventory and Analysis

### Complete Tool List by Category

#### SQL/Schema Tools (KEEP - Infrastructure)
| Tool | Purpose | Decision |
|------|---------|----------|
| `run_sql` | Execute SQL queries against DuckDB | KEEP - Core |
| `describe_database` | Get schema, columns, row counts, examples | KEEP - Core |
| `purge_market_table` | Delete and re-sync market data | KEEP - Maintenance |

#### Block Core Tools
| Tool | Purpose | Decision |
|------|---------|----------|
| `list_blocks` | List all blocks with metadata | KEEP - Entry point, sync orchestration |
| `get_block_info` | Block metadata, strategies, date range | KEEP - Convenience, low cost |
| `get_statistics` | Comprehensive portfolio stats (Sharpe, Sortino, etc.) | KEEP - Uses PortfolioStatsCalculator |
| `get_reporting_log_stats` | Actual trade execution stats | KEEP - Uses library functions |
| `get_trades` | Filter, sort, paginate trades | **REMOVE** - SQL can do this |

#### Block Comparison Tools
| Tool | Purpose | Decision |
|------|---------|----------|
| `get_strategy_comparison` | Compare strategies within block | KEEP - Uses calculateStrategyStats |
| `compare_blocks` | Side-by-side block metrics | KEEP - Uses PortfolioStatsCalculator |
| `block_diff` | Strategy overlap + P&L attribution | KEEP - Uses calculateStrategyStats |

#### Block Analysis Tools
| Tool | Purpose | Decision |
|------|---------|----------|
| `stress_test` | Performance during market scenarios | KEEP - Uses PortfolioStatsCalculator |
| `drawdown_attribution` | Identify drawdown contributors | KEEP - Builds equity curve, calculates attribution |
| `marginal_contribution` | Leave-one-out Sharpe/Sortino | KEEP - Iterative portfolio recomputation |
| `strategy_similarity` | Detect redundant strategies | KEEP - Uses correlation + tail risk libraries |
| `what_if_scaling` | Strategy weight simulation | KEEP - Uses PortfolioStatsCalculator |
| `portfolio_health_check` | Comprehensive health assessment | KEEP - Orchestrates correlation, tail risk, MC, WFA |

#### Analysis Tools (Tier 2)
| Tool | Purpose | Decision |
|------|---------|----------|
| `run_walk_forward` | Walk-forward optimization | KEEP - Uses WalkForwardAnalyzer |
| `run_monte_carlo` | Monte Carlo simulation | KEEP - Uses runMonteCarloSimulation |
| `get_correlation_matrix` | Strategy correlations | KEEP - Uses calculateCorrelationMatrix |
| `get_tail_risk` | Gaussian copula tail dependence | KEEP - Uses performTailRiskAnalysis |
| `get_position_sizing` | Kelly criterion sizing | KEEP - Uses calculateKellyMetrics |

#### Performance Tools (Tier 3)
| Tool | Purpose | Decision |
|------|---------|----------|
| `get_performance_charts` | Chart data (equity, drawdown, exposure) | KEEP - Uses library calculations |
| `get_mfe_mae_distribution` | MFE/MAE excursion analysis | KEEP - Uses library enrichment |
| `get_period_returns` | Period-based return analysis | KEEP - Uses library calculations |
| `compare_backtest_to_actual` | Backtest vs live comparison | KEEP - Uses library comparison logic |
| `get_daily_exposure` | Daily exposure analysis | KEEP - Uses calculateDailyExposure |

#### Report Tools
| Tool | Purpose | Decision |
|------|---------|----------|
| `list_available_fields` | List fields for filtering | **REMOVE** - DESCRIBE + schema-metadata.ts |
| `get_field_statistics` | Field min/max/avg/histogram | KEEP - Enrichment logic needed |
| `run_filtered_query` | Filter trades with conditions | **REMOVE** - SQL WHERE clause |
| `aggregate_by_field` | Bucket trades by field | **REMOVE** - SQL GROUP BY |
| `find_predictive_fields` | Pearson correlations for predictiveness | KEEP - Uses pearsonCorrelation library |
| `filter_curve` | Sweep filter thresholds | KEEP - Uses enrichment + analysis logic |
| `analyze_discrepancies` | Backtest vs actual discrepancies | KEEP - Uses library matching |
| `suggest_strategy_matches` | Match strategies between blocks | KEEP - Uses fuzzy matching logic |
| `analyze_slippage_trends` | Slippage trend analysis | KEEP - Uses library calculations |

#### Market Data Tools
| Tool | Purpose | Decision |
|------|---------|----------|
| `get_market_context` | Query market conditions | **REMOVE** - SQL on market.* tables |
| `enrich_trades` | Join market data to trades | **REMOVE** - SQL JOIN |
| `analyze_regime_performance` | Performance by market regime | KEEP - Uses enrichment + statistical analysis |
| `suggest_filters` | Suggest market-based filters | KEEP - Complex filter testing logic |
| `find_similar_days` | Find historically similar days | **REMOVE** - SQL with conditions |
| `calculate_orb` | Opening Range Breakout levels | KEEP - Uses 15min checkpoint calculation |

## Tools Recommended for Removal

### 1. `get_trades` - REMOVE

**What it does:** Filters trades with optional strategy/date/P&L filters, sorts by field, paginates results.

**Why SQL can replace it:**
```sql
SELECT date_opened, time_opened, strategy, legs, pl, num_contracts,
       opening_commissions + closing_commissions as commissions
FROM trades.trade_data
WHERE block_id = 'main-port'
  AND strategy ILIKE '%iron%'
  AND date_opened >= '2024-01-01'
  AND pl > 0
ORDER BY date_opened DESC
LIMIT 50 OFFSET 0;
```

**Confidence:** HIGH - SQL provides identical filtering, sorting, pagination.

### 2. `list_available_fields` - REMOVE

**What it does:** Lists available fields grouped by category (market, returns, risk, trade, timing).

**Why SQL can replace it:**
- `DESCRIBE trades.trade_data` shows all columns
- `describe_database` provides column descriptions and types
- Schema metadata is documented in `schema-metadata.ts` examples

**Confidence:** HIGH - Field discovery is built into describe_database.

### 3. `run_filtered_query` - REMOVE

**What it does:** Applies filter conditions (eq, neq, gt, gte, lt, lte, between) with AND/OR logic.

**Why SQL can replace it:**
```sql
SELECT COUNT(*) as match_count,
       SUM(CASE WHEN pl > 0 THEN 1 ELSE 0 END) as winners,
       SUM(pl) as total_pl,
       AVG(pl) as avg_pl
FROM trades.trade_data
WHERE block_id = 'main-port'
  AND VIX_Close > 20
  AND Gap_Pct BETWEEN -0.5 AND 0.5;
```

**Confidence:** HIGH - SQL WHERE clause is more expressive than the tool's condition array.

### 4. `aggregate_by_field` - REMOVE

**What it does:** Buckets trades by field values and calculates aggregate metrics.

**Why SQL can replace it:**
```sql
SELECT
  CASE
    WHEN VIX_Close < 15 THEN '10-15'
    WHEN VIX_Close < 20 THEN '15-20'
    WHEN VIX_Close < 25 THEN '20-25'
    ELSE '25+'
  END as vix_bucket,
  COUNT(*) as count,
  SUM(CASE WHEN pl > 0 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate,
  AVG(pl) as avg_pl,
  SUM(pl) as total_pl
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'main-port'
GROUP BY vix_bucket
ORDER BY vix_bucket;
```

**Confidence:** HIGH - SQL GROUP BY with CASE provides flexible bucketing.

### 5. `get_market_context` - REMOVE

**What it does:** Queries market conditions for dates with optional filters.

**Why SQL can replace it:**
```sql
SELECT date, VIX_Close, Vol_Regime, Term_Structure_State, Gap_Pct
FROM market.spx_daily
WHERE date BETWEEN '2024-01-01' AND '2024-06-30'
  AND VIX_Close > 20
  AND Vol_Regime IN (4, 5, 6)
ORDER BY date;
```

**Confidence:** HIGH - Direct table access with SQL filters.

### 6. `enrich_trades` - REMOVE

**What it does:** Joins market context data to a block's trades.

**Why SQL can replace it:**
```sql
SELECT
  t.date_opened,
  t.strategy,
  t.pl,
  m.VIX_Close,
  m.Vol_Regime,
  m.Term_Structure_State,
  m.Gap_Pct
FROM trades.trade_data t
LEFT JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'main-port';
```

**Confidence:** HIGH - SQL JOIN is the canonical way to do this.

### 7. `find_similar_days` - REMOVE

**What it does:** Finds historical trading days with similar market conditions.

**Why SQL can replace it:**
```sql
-- Find days similar to 2024-01-15
WITH ref AS (
  SELECT VIX_Close, Vol_Regime, Term_Structure_State
  FROM market.spx_daily WHERE date = '2024-01-15'
)
SELECT m.date, m.VIX_Close, m.Vol_Regime
FROM market.spx_daily m, ref
WHERE m.date != '2024-01-15'
  AND m.Vol_Regime = ref.Vol_Regime
  AND m.Term_Structure_State = ref.Term_Structure_State
  AND ABS(m.VIX_Close - ref.VIX_Close) < 3
ORDER BY ABS(m.VIX_Close - ref.VIX_Close)
LIMIT 20;
```

**Confidence:** HIGH - SQL can express similarity conditions with CTEs.

## Tools That Stay

### Core Computational Tools (Use TradeBlocks Libraries)

These tools MUST stay because they use specialized library functions:

| Tool | Library Function Used |
|------|----------------------|
| `get_statistics` | `PortfolioStatsCalculator.calculatePortfolioStats()` |
| `get_strategy_comparison` | `calculator.calculateStrategyStats()` |
| `compare_blocks` | `PortfolioStatsCalculator.calculatePortfolioStats()` |
| `block_diff` | `calculator.calculateStrategyStats()` |
| `stress_test` | `PortfolioStatsCalculator.calculatePortfolioStats()` |
| `drawdown_attribution` | Custom equity curve building |
| `marginal_contribution` | Iterative `calculatePortfolioStats()` |
| `strategy_similarity` | `calculateCorrelationMatrix()`, `performTailRiskAnalysis()` |
| `what_if_scaling` | `PortfolioStatsCalculator` with modified trades |
| `portfolio_health_check` | Multiple: correlation, tail risk, MC, WFA |
| `run_walk_forward` | `WalkForwardAnalyzer.analyze()` |
| `run_monte_carlo` | `runMonteCarloSimulation()` |
| `get_correlation_matrix` | `calculateCorrelationMatrix()` |
| `get_tail_risk` | `performTailRiskAnalysis()` |
| `get_position_sizing` | `calculateKellyMetrics()` |
| `find_predictive_fields` | `pearsonCorrelation()` |

### Tools That Use Trade Enrichment

These tools enrich trades with calculated fields (MFE/MAE, VIX at open, ROM, etc.) before analysis:

| Tool | Why Keep |
|------|----------|
| `get_field_statistics` | Needs trade enrichment for calculated fields |
| `filter_curve` | Needs enrichment + complex threshold sweep |
| `analyze_regime_performance` | Enrichment + statistical breakdown |
| `suggest_filters` | Complex filter testing with projected impact |
| `calculate_orb` | 15-min checkpoint math, not in DB |

### Tools That Orchestrate Sync

| Tool | Why Keep |
|------|----------|
| `list_blocks` | Entry point, triggers sync, provides blockIds |
| `get_block_info` | Quick metadata without full sync |

### Tools with Complex Business Logic

| Tool | Why Keep |
|------|----------|
| `compare_backtest_to_actual` | Scaling modes, strategy matching |
| `analyze_discrepancies` | Fuzzy matching, discrepancy detection |
| `suggest_strategy_matches` | Fuzzy string matching algorithms |

## Architecture Patterns

### SQL-First Data Access Pattern

After rationalization, the standard pattern for data exploration becomes:

```
1. describe_database - Understand schema, see examples
2. run_sql - Explore data with custom queries
3. [computational tool] - When library computation needed
```

### Tool Selection Guide

**Use SQL when:**
- Filtering/sorting/paginating raw data
- Counting or summing records
- Grouping and aggregating by fields
- Joining trades with market data
- Cross-block queries (something tools can't do)

**Use dedicated tool when:**
- Computing risk-adjusted metrics (Sharpe, Sortino, Calmar)
- Running simulations (Monte Carlo, walk-forward)
- Computing correlations or tail risk
- Calculating Kelly criterion
- Analyzing equity curves or drawdowns
- Getting enriched field values (MFE/MAE, ROM)

## Common Pitfalls

### Pitfall 1: Premature Tool Removal
**What goes wrong:** Removing a tool that has subtle computation not visible in the API
**Why it happens:** Tool appears to just filter data but actually enriches it
**How to avoid:** Trace through the code to verify no library calls
**Example:** `get_field_statistics` looks like aggregation but needs trade enrichment

### Pitfall 2: Forgetting Block Sync
**What goes wrong:** SQL returns stale data if block not synced
**Why it happens:** run_sql uses withFullSync but list_blocks does too
**How to avoid:** Document that SQL queries auto-sync on first call
**Note:** `withFullSync` middleware handles this automatically

### Pitfall 3: Expecting SQL to Compute Stats
**What goes wrong:** User expects SQL to calculate Sharpe ratio
**Why it happens:** Sharpe requires daily returns aggregation + stddev
**How to avoid:** Clear documentation that SQL is for data access, not computation
**Solution:** describe_database examples should never show statistical computation

## Code Examples

### SQL for Previous `get_trades` Functionality

```sql
-- Get winning trades for IronCondor strategy in 2024
SELECT
  date_opened,
  time_opened,
  strategy,
  legs,
  pl,
  num_contracts,
  opening_commissions + closing_commissions as total_commissions
FROM trades.trade_data
WHERE block_id = 'main-port'
  AND strategy ILIKE '%ironcondor%'
  AND date_opened >= '2024-01-01'
  AND pl > 0
ORDER BY pl DESC
LIMIT 50;
```

### SQL for Previous `run_filtered_query` Functionality

```sql
-- Count trades in high VIX environment with specific gap
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN pl > 0 THEN 1 ELSE 0 END) as winners,
  SUM(pl) as total_pl
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'main-port'
  AND m.VIX_Close > 25
  AND ABS(m.Gap_Pct) < 0.3;
```

### SQL for Previous `aggregate_by_field` Functionality

```sql
-- Performance by volatility regime
SELECT
  m.Vol_Regime,
  COUNT(*) as trades,
  ROUND(AVG(t.pl), 2) as avg_pl,
  ROUND(SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100, 1) as win_rate_pct
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'main-port'
GROUP BY m.Vol_Regime
ORDER BY m.Vol_Regime;
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Sharpe ratio in SQL | Window functions with stddev | `get_statistics` tool |
| Monte Carlo in SQL | Recursive CTEs | `run_monte_carlo` tool |
| Correlation matrix in SQL | Self-joins with aggregation | `get_correlation_matrix` |
| Kelly criterion | Manual win rate + payoff calc | `get_position_sizing` |

**Key insight:** SQL is for data access; TradeBlocks libraries are for computation. The boundary is clear.

## Implementation Steps

1. **Remove tools** (simple deletion):
   - `get_trades` from `blocks/core.ts`
   - `list_available_fields` from `reports/fields.ts`
   - `run_filtered_query` from `reports/queries.ts`
   - `aggregate_by_field` from `reports/queries.ts`
   - `get_market_context` from `market-data.ts`
   - `enrich_trades` from `market-data.ts`
   - `find_similar_days` from `market-data.ts`

2. **Update describe_database examples** to cover:
   - Trade filtering patterns (replace get_trades)
   - Market data queries (replace get_market_context)
   - JOIN patterns (replace enrich_trades)
   - Aggregation patterns (replace aggregate_by_field)

3. **Update CHANGELOG.md** with breaking changes

4. **Bump version** to 2.6.0 (minor - removing tools)

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all tool files in `packages/mcp-server/src/tools/`
- `run_sql` implementation showing DuckDB capabilities
- `describe_database` implementation showing schema introspection
- TradeBlocks library imports in each tool file

### Secondary (MEDIUM confidence)
- DuckDB documentation for SQL capabilities
- User decisions from 45-CONTEXT.md

## Metadata

**Confidence breakdown:**
- Tool categorization: HIGH - Direct code inspection
- SQL replacement patterns: HIGH - Tested in describe_database examples
- Library dependency mapping: HIGH - Import statements verified

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable domain)
