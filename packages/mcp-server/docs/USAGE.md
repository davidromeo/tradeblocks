# TradeBlocks MCP Server Usage Guide

## Quick Start

### 1. Set Up Your Data

Create a folder for your trading data:
```bash
mkdir -p ~/Trading/backtests
```

Each strategy is a "block" - a folder containing:
- `tradelog.csv` (required) - Your trade records
- `dailylog.csv` (optional) - Daily portfolio values

### 2. Start the Server

```bash
# With npx (recommended)
npx tradeblocks-mcp ~/Trading/backtests

# Or if installed globally
tradeblocks-mcp ~/Trading/backtests
```

### 3. Connect Your AI Assistant

The server communicates via stdio and works with any MCP-compatible client:

**Desktop/CLI Apps:**
- **Claude Desktop** - Install the .mcpb bundle or add to `claude_desktop_config.json`
- **Claude Code** - `claude mcp add tradeblocks -- npx tradeblocks-mcp ~/backtests`
- **Codex CLI** - Add to `~/.codex/config.toml`
- **Gemini CLI** - Add to `~/.gemini/settings.json`

**Web Platforms** (requires ngrok tunnel):
- **ChatGPT** - Developer Mode with remote URL
- **Google AI Studio** - Native MCP support
- **Julius AI** - Native MCP support

See [README.md](../README.md) for desktop/CLI configuration, or [WEB-PLATFORMS.md](./WEB-PLATFORMS.md) for web platform setup.

---

## Common Workflows

### Health Check a Strategy

"Run a health check on my iron-condor strategy"

Your AI assistant will:
1. `list_blocks` - Find available blocks
2. `get_statistics` - Get performance metrics
3. `run_walk_forward` - Check for overfitting
4. `get_tail_risk` - Assess worst-case scenarios

### Compare Two Strategies

"Compare my spy-puts strategy against qqq-calls"

Your AI assistant will:
1. Load both blocks
2. `get_statistics` on each
3. `calculate_correlation` between them
4. Present side-by-side comparison

### Analyze for Portfolio Addition

"Should I add this new strategy to my portfolio?"

Your AI assistant will:
1. Run health check on new strategy
2. Calculate correlation with existing strategies
3. Assess diversification benefit
4. Provide ADD/CONSIDER/SKIP recommendation

### Explore with SQL

"What's the best day of week to enter trades?"

Your AI assistant will:
1. `describe_database` - Discover available tables and columns
2. `run_sql` - Query trades grouped by day of week
3. Present findings with overfitting warnings

Example SQL:
```sql
SELECT DAYOFWEEK(date_opened) as dow, COUNT(*) as trades,
       SUM(CASE WHEN pl > 0 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate
FROM trades.trade_data
WHERE block_id = 'my-strategy'
GROUP BY dow ORDER BY dow
```

---

## Tool Reference

### Core Tools
| Tool | Purpose |
|------|---------|
| `list_blocks` | List all available blocks with summary stats |
| `get_block_info` | Detailed info for a specific block |
| `get_statistics` | Performance metrics for a block |
| `get_strategy_comparison` | Compare strategies within a block |
| `compare_blocks` | Compare statistics across multiple blocks |

### Analysis Tools
| Tool | Purpose |
|------|---------|
| `run_walk_forward` | Detect overfitting via WFA |
| `run_monte_carlo` | Risk simulation with confidence intervals |
| `get_correlation_matrix` | Strategy correlation matrix |
| `get_tail_risk` | Tail dependence and copula-based risk |
| `get_position_sizing` | Kelly criterion position sizing |

### Performance Tools
| Tool | Purpose |
|------|---------|
| `get_performance_charts` | Chart data (equity, drawdown, P&L distribution, etc.) |
| `get_period_returns` | Returns by time period |
| `compare_backtest_to_actual` | Backtest vs live comparison |

### SQL Tools
| Tool | Purpose |
|------|---------|
| `run_sql` | Execute SQL queries against trades and market data |
| `describe_database` | Schema discovery with table info and examples |

### Market Data Tools
| Tool | Purpose |
|------|---------|
| `import_market_csv` | Import market data CSV with column mapping |
| `import_from_database` | Import from external DuckDB databases |
| `enrich_market_data` | Compute ~40 derived indicators from raw OHLCV |
| `enrich_trades` | Enrich trades with market context (lookahead-free) |
| `analyze_regime_performance` | Analyze P&L by market regime |
| `suggest_filters` | Suggest trade filters based on market conditions |
| `calculate_orb` | Opening range breakout analysis from intraday bars |

### Import Tools
| Tool | Purpose |
|------|---------|
| `import_csv` | Import CSV and create new block *(CLI only)* |

> **Note:** `import_csv` requires filesystem access and only works with CLI tools (Claude Code, Codex CLI, Gemini CLI). Claude Desktop is sandboxed and cannot access files outside the configured blocks directory. For Claude Desktop, manually copy your CSV files to your blocks directory.

---

## CSV Format

### Trade Log (tradelog.csv)

Required columns:
- Date Opened, Time Opened
- Date Closed, Time Closed
- P/L (gross profit/loss)
- Strategy name
- Symbol (or Legs)

Optional columns:
- No. of Contracts
- Premium
- Max Profit, Max Loss (for MFE/MAE analysis)
- Opening/Closing Commissions + Fees

Example:
```csv
Date Opened,Time Opened,Date Closed,Time Closed,P/L,Strategy,Legs,No. of Contracts,Premium
2024-01-02,09:35:00,2024-01-02,15:30:00,200,Iron Condor,SPX 4800P/4750P,1,250
2024-01-03,09:35:00,2024-01-03,15:45:00,250,Iron Condor,SPX 4820P/4770P,1,275
```

### Daily Log (dailylog.csv)

Required columns:
- Date
- Net Liquidity (or "Portfolio Value", "Value", "Equity")

Optional columns:
- P/L (daily profit/loss)
- Drawdown %
- Current Funds, Trading Funds

Example:
```csv
Date,Net Liquidity,P/L,Drawdown %
2024-01-02,10200,200,0.00
2024-01-03,10450,250,0.00
2024-01-04,10300,-150,1.44
```

### Reporting Log (reportinglog.csv)

For backtest vs actual comparison. Required columns:
- Date Opened
- Strategy
- P/L
- No. of Contracts

Example:
```csv
Date Opened,Time Opened,Strategy,Legs,No. of Contracts,P/L
2024-01-02,09:35:00,Iron Condor,SPX 4800P/4750P,1,180
2024-01-03,09:35:00,Iron Condor,SPX 4820P/4770P,1,225
```

### Flexible CSV Detection

The server detects CSV types by column headers, not just filenames. This means:

- `my-strategy-export.csv` will work if it has the expected columns
- Files are auto-detected as tradelog, dailylog, or reportinglog
- Detected mappings are cached in `block.json` for faster loading

---

## Troubleshooting

### "Block not found"

1. Check folder exists in your backtests directory
2. Ensure it contains a valid CSV (tradelog.csv or detected by content)
3. Run `list_blocks` to see what's available

### "No trades after filtering"

The date range or strategy filter may be too restrictive. Try without filters first.

### CSV not detected

If your CSV has non-standard names, ensure it has the expected columns:
- Trade log needs: P/L, Date Opened, Date Closed
- Daily log needs: Date, Net Liquidity (or Portfolio Value)

The server logs warnings when it encounters unrecognized CSVs:
```
Warning: Folder 'my-folder' has CSV files but none match expected trade log format.
  Found: export.csv
  Expected columns: P/L, Date Opened, Date Closed, Symbol, Strategy
```

### Walk-forward analysis shows poor results

Walk-forward analysis tests if a strategy is overfit to historical data. Poor results may indicate:
- Strategy parameters were optimized on the test period
- Insufficient data for reliable out-of-sample testing
- Market regime changes during the analysis period

Consider using `run_monte_carlo` for additional robustness testing.

---

## Advanced Usage

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BLOCKS_DIRECTORY` | Path to blocks folder | (required) |

### SQL Queries

Use `describe_database` to see available tables, columns, and example queries. Then use `run_sql` for flexible data exploration:

```sql
-- Filter trades by strategy and P/L
SELECT date_opened, strategy, pl, num_contracts
FROM trades.trade_data
WHERE block_id = 'my-strategy' AND pl > 0
ORDER BY date_opened DESC
LIMIT 50

-- Join trades with market data (lookahead-free via LAG)
WITH joined AS (
  SELECT d.ticker, d.date, d.Gap_Pct, c.VIX_Open, c.VIX_Close, c.Vol_Regime
  FROM market.daily d
  LEFT JOIN market.context c ON d.date = c.date
  WHERE d.ticker = 'SPX'
),
lagged AS (
  SELECT *, LAG(VIX_Close) OVER (PARTITION BY ticker ORDER BY date) AS prev_VIX_Close,
    LAG(Vol_Regime) OVER (PARTITION BY ticker ORDER BY date) AS prev_Vol_Regime
  FROM joined
)
SELECT t.date_opened, t.strategy, t.pl, m.Gap_Pct, m.VIX_Open, m.prev_VIX_Close, m.prev_Vol_Regime
FROM trades.trade_data t
JOIN lagged m ON CAST(t.date_opened AS VARCHAR) = m.date
WHERE t.block_id = 'my-strategy'

-- Aggregate by VIX bucket (uses prior day's VIX to avoid lookahead)
WITH joined AS (
  SELECT d.ticker, d.date, c.VIX_Close
  FROM market.daily d
  LEFT JOIN market.context c ON d.date = c.date
  WHERE d.ticker = 'SPX'
),
lagged AS (
  SELECT *, LAG(VIX_Close) OVER (PARTITION BY ticker ORDER BY date) AS prev_VIX_Close
  FROM joined
)
SELECT
  CASE WHEN m.prev_VIX_Close < 20 THEN 'Low' ELSE 'High' END as vix_level,
  COUNT(*) as trades,
  SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate
FROM trades.trade_data t
JOIN lagged m ON CAST(t.date_opened AS VARCHAR) = m.date
WHERE t.block_id = 'my-strategy' AND m.prev_VIX_Close IS NOT NULL
GROUP BY vix_level
```

### Platform-Specific Configuration

See [README.md](../README.md#configuration-by-platform) for configuration examples for:
- Claude Desktop
- Claude Code (CLI)
- OpenAI Codex CLI
- Gemini CLI

### Installing Agent Skills

For guided workflows, install the bundled skills:

```bash
tradeblocks-mcp install-skills
tradeblocks-mcp install-skills --platform codex
tradeblocks-mcp check-skills
```

Skills provide structured prompts for common analysis tasks.

---

## Market Data Setup

For market-aware analysis (VIX regimes, gap analysis, intraday timing), import market data from TradingView exports:

1. **Export from TradingView**: Open chart (SPX daily, VIX daily, SPX 5-min, etc.) → Right-click → "Export chart data..."
2. **Import via MCP tool**: Use `import_market_csv` with a column mapping
3. **Enrich**: Use `enrich_market_data` to compute ~40 derived indicators

No Pine Scripts needed — TradingView exports raw OHLCV natively from any chart.

### Target Tables

| Table | Purpose | Example Data |
|-------|---------|--------------|
| `market.daily` | Daily OHLCV + enriched indicators | SPX daily bars |
| `market.context` | VIX / volatility context | VIX, VIX9D, VIX3M daily |
| `market.intraday` | Intraday bars (any resolution) | SPX 5-min, VIX 5-min |

See [scripts/README.md](../../../scripts/README.md) for import examples and column mapping reference.

## Related Documentation

- [README.md](../README.md) - Installation and setup
- [Web Platforms Guide](./WEB-PLATFORMS.md) - Connect to ChatGPT, Google AI Studio, Julius
- [Market Data Import](../../../scripts/README.md) - Import workflow and column mappings
- [Agent Skills](../../agent-skills/README.md) - Conversational workflows
