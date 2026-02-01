# Feature Landscape: SQL Analytics for Hypothesis Generation

**Domain:** Trading analytics SQL query interface
**Researched:** 2026-02-01
**Milestone:** v2.6 DuckDB Analytics Layer

## Executive Summary

The `run_sql` tool enables Claude to explore trade data and market conditions using SQL, generating hypotheses for Option Omega filter development. This replaces the current approach of hand-crafted MCP tools with a flexible query interface.

**Core value proposition:** Instead of building 50 specialized tools for every possible analysis pattern, provide one powerful SQL interface that enables unlimited exploratory queries. Claude writes SQL, TradeBlocks executes it, results drive hypothesis generation.

---

## Table Stakes

Features users **must have** for SQL analytics to be useful. Missing these = product feels broken.

### 1. Basic Query Execution

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `run_sql` tool accepting SQL string | Core capability | Low | Single entry point |
| Parameterized queries (date ranges, block IDs) | Prevent SQL injection, UX | Medium | Prepared statement style |
| Result pagination (limit/offset) | Large result sets crash Claude | Low | Default 100 rows |
| Column type metadata in results | Claude needs to understand schema | Low | Include in response |
| Error messages with line/column | Debugging requires context | Low | DuckDB provides this |

### 2. Schema Discovery

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `list_tables` query or resource | Know what's available | Low | trades, market_daily, market_intraday |
| `describe <table>` functionality | Know column names/types | Low | Schema introspection |
| Sample data preview | Understand data shape | Low | `SELECT * FROM trades LIMIT 5` works |

### 3. Core Data Joins

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Trades + daily market data join | Primary use case | Medium | Join on date_opened = market.date |
| Cross-block queries | "All Iron Condors ever" | Medium | block_id column in trades table |
| Date range filtering | Every query needs this | Low | WHERE date_opened BETWEEN ... |

### 4. SQL Feature Coverage

DuckDB supports these out of the box - no implementation needed, just document:

| SQL Feature | Why Needed | Example Use Case |
|-------------|------------|------------------|
| Window functions (LAG, LEAD, ROW_NUMBER) | Streak analysis, rolling calcs | `LAG(pl) OVER (ORDER BY date)` |
| CTEs (WITH clause) | Complex multi-step analysis | Build intermediate aggregations |
| GROUP BY with aggregates | Regime bucketing | `GROUP BY vol_regime` |
| CASE expressions | Conditional categorization | `CASE WHEN vix > 25 THEN 'high'...` |
| HAVING clause | Filter aggregates | `HAVING avg(pl) > 0` |
| ASOF JOIN | Time-aligned data | Join market data "as of" trade open |
| ROLLUP/CUBE | Hierarchical summaries | Multi-level groupings |
| QUALIFY clause | Filter window results | Top N per group |

---

## Differentiators

Features that make this **powerful for hypothesis generation**. Not expected, but highly valued.

### 1. Hypothesis-Centric Query Patterns

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pre-built CTEs for common patterns | Accelerate exploration | Medium | e.g., `trades_with_regime` |
| Example queries in schema metadata | Claude learns patterns | Low | Include in describe output |
| Query templates for Option Omega filters | Direct path to actionable filters | Medium | VIX, gap, RSI templates |

**Example templates:**
```sql
-- Template: VIX Filter Exploration
WITH regime_performance AS (
  SELECT
    CASE
      WHEN m.VIX_Close < 15 THEN 'low'
      WHEN m.VIX_Close < 25 THEN 'normal'
      ELSE 'high'
    END AS vix_regime,
    COUNT(*) AS trades,
    AVG(t.pl) AS avg_pl,
    SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) AS win_rate
  FROM trades t
  JOIN market_daily m ON DATE(t.date_opened) = m.date
  GROUP BY 1
)
SELECT * FROM regime_performance ORDER BY avg_pl DESC;
```

### 2. Statistical Functions for Signal Discovery

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Correlation functions | Find predictive fields | Low | DuckDB built-in `corr()` |
| Percentile functions | Threshold discovery | Low | `percentile_cont(0.1)` |
| Regression functions | Trend detection | Low | `regr_slope()`, `regr_r2()` |
| Kendall/Spearman correlation | Non-linear relationships | Medium | Extension or UDF |

### 3. Export to Option Omega Format

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Query result to filter suggestion | Actionable output | Medium | Claude synthesizes, but structured |
| Threshold extraction queries | "Best VIX cutoff" | Low | Use QUALIFY/window funcs |
| Statistical significance testing | Avoid overfit filters | Medium | Sample size, p-value context |

### 4. Time-Series Intelligence

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Rolling window aggregates | Moving averages, streaks | Low | `SUM() OVER (ROWS BETWEEN...)` |
| Date/time functions | Period analysis | Low | `date_trunc('month', date)` |
| Streak detection | Consecutive wins/losses | Medium | Window functions |
| Regime change detection | Volatility regime shifts | Medium | LAG comparison |

### 5. Multi-Block Analysis

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| UNION across blocks | Aggregate all portfolios | Low | block_id column enables |
| Block comparison queries | Head-to-head analysis | Low | GROUP BY block_id |
| Strategy-level cross-block | "Iron Condors globally" | Low | Filter by strategy name |

---

## Anti-Features

Things **NOT to build** because SQL handles them better. These are candidates for deprecation.

### Tools to Deprecate (SQL Replaces)

| Current Tool | Why Deprecate | SQL Replacement |
|--------------|---------------|-----------------|
| `run_filtered_query` | Rigid filter operators | `WHERE` clause flexibility |
| `aggregate_by_field` | Fixed bucket logic | `GROUP BY` with `CASE` |
| `get_field_statistics` | Fixed stat set | `SELECT AVG(), STDDEV()...` |
| `find_predictive_fields` | Can't customize | `SELECT corr(field, pl)...` |
| `filter_curve` | Single-field sweep | Multi-dimensional SQL |
| `analyze_regime_performance` | Fixed regime definitions | Custom `CASE` buckets |

**Why deprecate:**
1. Each tool implements a subset of what SQL can do
2. Tool parameters are rigid; SQL is infinitely flexible
3. Maintenance burden scales with tool count
4. Claude can write better SQL than we can anticipate use cases

### Tools to Keep (Specialized Computation)

| Tool | Why Keep | Notes |
|------|----------|-------|
| `run_monte_carlo` | Complex simulation | Not expressible in SQL |
| `run_walk_forward` | Iterative optimization | Multi-pass algorithm |
| `get_correlation_matrix` | Matrix computation | SQL awkward for matrices |
| `get_tail_risk` | Copula calculations | Statistical library |
| `get_position_sizing` | Kelly criterion | Iterative computation |
| `portfolio_health_check` | Multi-tool synthesis | Orchestration tool |
| `stress_test` | Curated scenarios | Named periods catalog |
| `compare_backtest_to_actual` | Trade matching | Complex alignment |

### Things NOT to Build

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| SQL query builder UI | Over-engineering | Claude writes SQL |
| Saved query library | Storage complexity | Claude remembers context |
| Query caching layer | Premature optimization | DuckDB is fast enough |
| Custom aggregate functions | Maintenance burden | Use built-in SQL functions |
| Real-time data feeds | Scope creep | Batch CSV updates |
| Query permissions/ACL | Over-engineering | Single-user desktop app |

---

## Feature Dependencies

```
Schema Discovery (must work first)
    |
    v
Basic Query Execution
    |
    v
Trades Table Population <---- CSV Sync Logic
    |
    v
Market Data Join <---- market.duckdb Ingestion
    |
    v
Query Templates / Examples
    |
    v
Tool Deprecation (after SQL is proven)
```

**Critical path:**
1. Schema must be queryable before anything else works
2. Trades table must have correct schema for joins
3. Market data must be joinable by date
4. Only after SQL works: evaluate which tools to deprecate

---

## Query Pattern Catalog

Real examples Claude should be able to run for hypothesis generation.

### Pattern 1: Regime Bucketing

**Question:** "How does performance vary by VIX level?"

```sql
SELECT
  CASE
    WHEN m.VIX_Close < 15 THEN '1. VIX < 15'
    WHEN m.VIX_Close < 20 THEN '2. VIX 15-20'
    WHEN m.VIX_Close < 25 THEN '3. VIX 20-25'
    WHEN m.VIX_Close < 30 THEN '4. VIX 25-30'
    ELSE '5. VIX 30+'
  END AS vix_bucket,
  COUNT(*) AS trades,
  ROUND(AVG(t.pl), 2) AS avg_pl,
  ROUND(100.0 * SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_rate,
  ROUND(SUM(t.pl), 2) AS total_pl
FROM trades t
JOIN market_daily m ON DATE(t.date_opened) = m.date
WHERE t.strategy = 'Iron Condor'
GROUP BY 1
ORDER BY 1;
```

### Pattern 2: Gap Analysis

**Question:** "Do gap-up days hurt my straddles?"

```sql
SELECT
  CASE
    WHEN m.Gap_Pct > 0.5 THEN 'gap_up_big'
    WHEN m.Gap_Pct > 0 THEN 'gap_up_small'
    WHEN m.Gap_Pct > -0.5 THEN 'gap_down_small'
    ELSE 'gap_down_big'
  END AS gap_type,
  COUNT(*) AS trades,
  AVG(t.pl) AS avg_pl,
  STDDEV(t.pl) AS pl_stddev
FROM trades t
JOIN market_daily m ON DATE(t.date_opened) = m.date
WHERE t.strategy LIKE '%Straddle%'
GROUP BY 1
ORDER BY avg_pl DESC;
```

### Pattern 3: Time-of-Day Analysis

**Question:** "Are morning entries better than afternoon?"

```sql
SELECT
  CASE
    WHEN CAST(SUBSTR(t.time_opened, 1, 2) AS INT) < 11 THEN 'morning'
    WHEN CAST(SUBSTR(t.time_opened, 1, 2) AS INT) < 14 THEN 'midday'
    ELSE 'afternoon'
  END AS entry_period,
  COUNT(*) AS trades,
  AVG(t.pl) AS avg_pl,
  100.0 * SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) / COUNT(*) AS win_rate
FROM trades t
GROUP BY 1;
```

### Pattern 4: Correlation Discovery

**Question:** "Which market fields predict P&L?"

```sql
SELECT
  'VIX_Close' AS field,
  ROUND(CORR(m.VIX_Close, t.pl), 4) AS correlation
FROM trades t
JOIN market_daily m ON DATE(t.date_opened) = m.date
UNION ALL
SELECT
  'Gap_Pct',
  ROUND(CORR(m.Gap_Pct, t.pl), 4)
FROM trades t
JOIN market_daily m ON DATE(t.date_opened) = m.date
UNION ALL
SELECT
  'RSI_14',
  ROUND(CORR(m.RSI_14, t.pl), 4)
FROM trades t
JOIN market_daily m ON DATE(t.date_opened) = m.date
ORDER BY ABS(correlation) DESC;
```

### Pattern 5: Cross-Block Strategy Comparison

**Question:** "How does Iron Condor perform across all my portfolios?"

```sql
SELECT
  t.block_id,
  COUNT(*) AS trades,
  AVG(t.pl) AS avg_pl,
  SUM(t.pl) AS total_pl,
  100.0 * SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) / COUNT(*) AS win_rate
FROM trades t
WHERE t.strategy = 'Iron Condor'
GROUP BY t.block_id
ORDER BY total_pl DESC;
```

### Pattern 6: Threshold Discovery

**Question:** "What VIX level maximizes Iron Condor win rate?"

```sql
WITH thresholds AS (
  SELECT UNNEST(GENERATE_SERIES(12, 35, 1)) AS vix_threshold
),
performance AS (
  SELECT
    th.vix_threshold,
    COUNT(*) FILTER (WHERE m.VIX_Close <= th.vix_threshold) AS trades_below,
    AVG(t.pl) FILTER (WHERE m.VIX_Close <= th.vix_threshold) AS avg_pl_below,
    100.0 * SUM(CASE WHEN t.pl > 0 AND m.VIX_Close <= th.vix_threshold THEN 1 ELSE 0 END)
      / NULLIF(COUNT(*) FILTER (WHERE m.VIX_Close <= th.vix_threshold), 0) AS win_rate_below
  FROM trades t
  JOIN market_daily m ON DATE(t.date_opened) = m.date
  CROSS JOIN thresholds th
  WHERE t.strategy = 'Iron Condor'
  GROUP BY th.vix_threshold
)
SELECT * FROM performance
WHERE trades_below >= 20
ORDER BY win_rate_below DESC
LIMIT 10;
```

### Pattern 7: Consecutive Win/Loss Streaks

**Question:** "What's my typical losing streak?"

```sql
WITH streaks AS (
  SELECT
    t.*,
    CASE WHEN t.pl > 0 THEN 1 ELSE 0 END AS is_win,
    SUM(CASE WHEN t.pl > 0 THEN 0 ELSE 1 END) OVER (ORDER BY t.date_opened ROWS UNBOUNDED PRECEDING) AS loss_group
  FROM trades t
)
SELECT
  loss_group,
  COUNT(*) AS streak_length,
  MIN(date_opened) AS streak_start,
  MAX(date_opened) AS streak_end
FROM streaks
WHERE is_win = 0
GROUP BY loss_group
ORDER BY streak_length DESC
LIMIT 10;
```

### Pattern 8: RSI Extremes

**Question:** "Should I avoid oversold entries?"

```sql
SELECT
  CASE
    WHEN m.RSI_14 < 30 THEN 'oversold'
    WHEN m.RSI_14 > 70 THEN 'overbought'
    ELSE 'neutral'
  END AS rsi_zone,
  COUNT(*) AS trades,
  AVG(t.pl) AS avg_pl,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY t.pl) AS p25_pl,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY t.pl) AS p75_pl
FROM trades t
JOIN market_daily m ON DATE(t.date_opened) = m.date
GROUP BY 1;
```

---

## Option Omega Filter Mapping

Option Omega backtests support these filters. SQL queries should help discover optimal values.

| Option Omega Filter | SQL Discovery Pattern |
|---------------------|----------------------|
| VIX Min/Max | Threshold sweep on `VIX_Close` |
| Gap Min/Max | Bucket analysis on `Gap_Pct` |
| RSI 14 Min/Max | Bucket analysis on `RSI_14` |
| DIX/GEX (SqueezeMetrics) | Join external data, correlate |
| Term Structure State | Filter on `Term_Structure_State` |
| Day of Week | `Day_of_Week` in {2,3,4,5,6} |
| Volatility Regime | `Vol_Regime` in {1,2,3,4,5,6} |
| Opening Range Breakout | Use `calculate_orb` + SQL |
| Trend Score | Filter on `Trend_Score` |

**Workflow:**
1. Run SQL to explore regime performance
2. Identify promising filter ranges
3. Claude suggests: "Consider adding VIX < 22 filter"
4. User tests in Option Omega backtest
5. Iterate

---

## MVP Recommendation

For MVP, prioritize:

1. **`run_sql` tool with trades + market_daily tables** - Core capability
2. **Schema discovery** - Claude needs to know what's available
3. **Query examples in docs** - Bootstraps Claude's SQL knowledge
4. **Result pagination** - Prevents context overflow

Defer to post-MVP:

- **Tool deprecation**: Prove SQL works first, then deprecate
- **Intraday market data**: Daily data covers 90% of hypotheses
- **Custom aggregation UDFs**: Built-in functions sufficient
- **Query result caching**: Premature optimization

---

## Sources

Research sources for DuckDB SQL patterns:

- [DuckDB Window Functions](https://duckdb.org/docs/stable/sql/functions/window_functions)
- [MotherDuck Window Functions Blog](https://motherduck.com/blog/motherduck-window-functions-in-sql/)
- [DuckDB Time Series Analysis](https://medium.com/@Quaxel/time-series-crunching-with-duckdb-without-losing-your-mind-fd129ba7173f)
- [SQL for Trading: LuxAlgo](https://www.luxalgo.com/blog/sql-for-trading-unlock-financial-data/)
- [QuestDB Correlation Tracking](https://questdb.com/blog/track-correlations-across-financial-market-assets/)
- [Technical Indicators in BigQuery/SQL](https://medium.com/google-cloud/how-to-calculate-technical-indicators-in-bigquery-using-sql-moving-averages-rsi-macd-b58b16e4f52e)
- [DuckDB Advanced Aggregation](https://motherduck.com/duckdb-book-summary-chapter4/)
