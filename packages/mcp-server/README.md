# TradeBlocks MCP Server

Model Context Protocol (MCP) server for options trading analysis. Provides programmatic access to backtest statistics, walk-forward analysis, Monte Carlo simulations, and risk metrics.

## Features

- **19 MCP tools** for comprehensive trading analysis
- **Block-based data organization** - each folder is a trading strategy
- **Automatic caching** - statistics cached in `.block.json` for fast access
- **Flexible CSV detection** - auto-detects file types by column headers
- **Cross-platform** - works with Claude Desktop, Claude Code, and other MCP clients

## Installation

### Option 1: MCPB Bundle (Claude Desktop - One Click)

Download the latest `.mcpb` file from [GitHub Releases](https://github.com/davidromeo/tradeblocks/releases) and double-click to install.

The installer will prompt you to select your Trading Data Directory.

### Option 2: npx (Claude Desktop / Claude Code)

Run directly without installation:

```bash
npx tradeblocks-mcp ~/Trading/backtests
```

For Claude Desktop, add to your config file:

```json
{
  "mcpServers": {
    "tradeblocks": {
      "command": "npx",
      "args": ["tradeblocks-mcp", "/path/to/your/backtests"]
    }
  }
}
```

### Option 3: From Source

```bash
git clone https://github.com/davidromeo/tradeblocks
cd tradeblocks
npm install
npm run build -w packages/mcp-server

# Run the server
node packages/mcp-server/server/index.js ~/Trading/backtests
```

## Quick Start

1. **Set up your data** - Create folders for each strategy with CSV files
2. **Connect Claude** - Install via MCPB or configure manually
3. **Start analyzing** - Ask Claude to "list my backtests" or "run a health check on iron-condor"

For detailed usage examples, see [docs/USAGE.md](docs/USAGE.md).

## Claude Desktop Configuration

| Platform | Config Location |
|----------|-----------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "tradeblocks": {
      "command": "node",
      "args": ["/path/to/tradeblocks/packages/mcp-server/server/index.js"],
      "env": {
        "BLOCKS_DIRECTORY": "/path/to/your/backtests"
      }
    }
  }
}
```

## Claude Code (CLI) Installation

```bash
# Add the MCP server to Claude Code
claude mcp add tradeblocks -- node /path/to/tradeblocks/packages/mcp-server/server/index.js

# Set the blocks directory in your shell profile
export BLOCKS_DIRECTORY=~/Trading/backtests
```

## Agent Skills

For guided conversational workflows, install the bundled agent skills:

```bash
# Install skills to Claude Code
tradeblocks-mcp install-skills

# Install to other platforms
tradeblocks-mcp install-skills --platform codex
tradeblocks-mcp install-skills --platform gemini

# Check installation status
tradeblocks-mcp check-skills

# Remove skills
tradeblocks-mcp uninstall-skills
```

Skills provide structured prompts for tasks like:
- Strategy health checks
- Walk-forward analysis interpretation
- Portfolio addition recommendations
- Correlation analysis

See [Agent Skills README](../agent-skills/README.md) for details.

## Block Directory Structure

Each folder in your blocks directory represents a trading strategy:

```
backtests/
  SPX-Iron-Condor/
    tradelog.csv      # Required - trade history
    dailylog.csv      # Optional - daily portfolio values
    reportinglog.csv  # Optional - live/reported trades
    .block.json       # Auto-generated - cached metadata
  NDX-Put-Spread/
    my-export.csv     # Works! Auto-detected by columns
    ...
```

### CSV Formats

**tradelog.csv** - Trade records with these key columns:
- Date Opened, Time Opened, Date Closed, Time Closed
- P/L (gross profit/loss)
- Strategy, Legs (or Symbol)
- No. of Contracts, Premium (optional)

**dailylog.csv** - Daily portfolio values:
- Date
- Net Liquidity (or Portfolio Value, Equity)
- P/L, Drawdown % (optional)

**Flexible Detection**: Files don't need standard names. The server detects CSV types by examining column headers (ISS-006).

## Available Tools

### Core Tools
| Tool | Description |
|------|-------------|
| `list_backtests` | List all available blocks |
| `get_statistics` | Performance metrics (Sharpe, Sortino, drawdown, etc.) |
| `get_trades` | Raw trade data with optional filters |
| `reprocess_block` | Re-parse CSVs and recalculate statistics |

### Analysis Tools
| Tool | Description |
|------|-------------|
| `run_walk_forward` | Walk-forward analysis with configurable windows |
| `run_monte_carlo` | Monte Carlo simulation with worst-case scenarios |
| `calculate_correlation` | Strategy correlation matrix (Kendall's tau) |
| `get_tail_risk` | VaR, CVaR, and max drawdown analysis |
| `calculate_position_sizing` | Kelly criterion position sizing |

### Performance Tools
| Tool | Description |
|------|-------------|
| `get_performance_charts` | 16 chart types (equity, drawdown, distribution) |
| `get_period_returns` | Returns aggregated by time period |
| `compare_backtest_vs_actual` | Backtest vs live performance comparison |

### Report Builder Tools
| Tool | Description |
|------|-------------|
| `list_available_fields` | List filterable trade fields |
| `run_filtered_query` | Query trades with custom filters |
| `get_field_statistics` | Statistics for a specific field |
| `aggregate_by_field` | Group and aggregate by field values |

### Import Tools
| Tool | Description |
|------|-------------|
| `import_csv` | Import a CSV file as a new block |

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Pack MCPB bundle
npm run mcpb:pack
```

## Related

- [Usage Guide](docs/USAGE.md) - Detailed usage examples and workflows
- [Agent Skills](../agent-skills/README.md) - Conversational workflows for guided analysis
- [Main Application](../../README.md) - Web-based UI for TradeBlocks
