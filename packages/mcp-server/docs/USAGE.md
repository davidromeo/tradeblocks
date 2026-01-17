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

- **Claude Desktop** - Install the .mcpb bundle or add to `claude_desktop_config.json`
- **Claude Code** - `claude mcp add tradeblocks -- npx tradeblocks-mcp ~/backtests`
- **Codex CLI** - Add to `~/.codex/config.toml`
- **Gemini CLI** - Add to `~/.gemini/settings.json`

See [README.md](../README.md) for platform-specific configuration.

---

## Common Workflows

### Health Check a Strategy

"Run a health check on my iron-condor strategy"

Your AI assistant will:
1. `list_backtests` - Find available blocks
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

### Optimize Parameters

"What's the best day of week to enter trades?"

Your AI assistant will:
1. `list_available_fields` - Find filterable fields
2. `aggregate_by_field` - Group by day of week
3. `get_field_statistics` - Compare performance
4. Present findings with overfitting warnings

---

## Tool Reference

### Core Tools
| Tool | Purpose |
|------|---------|
| `list_backtests` | List all available blocks |
| `get_statistics` | Performance metrics for a block |
| `get_trades` | Raw trade data with optional filters |
| `reprocess_block` | Re-parse CSVs and recalculate stats |

### Analysis Tools
| Tool | Purpose |
|------|---------|
| `run_walk_forward` | Detect overfitting via WFA |
| `run_monte_carlo` | Risk simulation with confidence intervals |
| `calculate_correlation` | Strategy correlation matrix |
| `get_tail_risk` | VaR, CVaR, max drawdown analysis |
| `calculate_position_sizing` | Kelly criterion position sizing |

### Performance Tools
| Tool | Purpose |
|------|---------|
| `get_performance_charts` | Chart data (equity, drawdown, P&L distribution, etc.) |
| `get_period_returns` | Returns by time period |
| `compare_backtest_vs_actual` | Backtest vs live comparison |

### Report Builder Tools
| Tool | Purpose |
|------|---------|
| `list_available_fields` | Filterable trade fields |
| `run_filtered_query` | Query trades with filters |
| `get_field_statistics` | Statistics for a field |
| `aggregate_by_field` | Group and aggregate trades |

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

### Flexible CSV Detection

As of v0.1.0 (ISS-006), the server can detect CSV types by column headers, not just filenames. This means:

- `my-strategy-export.csv` will work if it has the expected columns
- Files are auto-detected as tradelog, dailylog, or reportinglog
- Detected mappings are cached in `.block.json` for faster loading

---

## Troubleshooting

### "Block not found"

1. Check folder exists in your backtests directory
2. Ensure it contains a valid CSV (tradelog.csv or detected by content)
3. Run `list_backtests` to see what's available

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

## Related Documentation

- [README.md](../README.md) - Installation and setup
- [Option Omega Guide](./option-omega-guide.md) - Exporting from Option Omega
- [Agent Skills](../../agent-skills/README.md) - Conversational workflows
