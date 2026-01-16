# TradeBlocks MCP Server

Model Context Protocol (MCP) server for options trading analysis. Provides programmatic access to backtest statistics, walk-forward analysis, Monte Carlo simulations, and risk metrics.

## Features

- **19 MCP tools** for comprehensive trading analysis
- **Block-based data organization** - each folder is a trading strategy
- **Automatic caching** - statistics cached in `.block.json` for fast access
- **Cross-platform** - works with Claude Desktop, Claude Code, and other MCP clients

## Quick Start

```bash
# Build the server
cd packages/mcp-server
npm install
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## Claude Desktop Installation

### Option 1: Desktop Extension (Recommended)

Download the latest `.mcpb` file from releases and double-click to install.

Or build from source:

```bash
npm install -g @anthropic-ai/mcpb
cd packages/mcp-server
npm run build
mcpb pack
# Creates tradeblocks.mcpb - double-click to install
```

### Option 2: Manual Configuration

Add to Claude Desktop settings (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tradeblocks": {
      "command": "node",
      "args": ["/path/to/tradeblocks/packages/mcp-server/dist/index.js"],
      "env": {
        "TRADEBLOCKS_BLOCKS_DIR": "/path/to/your/blocks"
      }
    }
  }
}
```

Replace `/path/to/tradeblocks` and `/path/to/your/blocks` with your actual paths.

## Claude Code / CLI Installation

For Claude Code and other CLI-based agents, configure the MCP server in your settings and use the [Agent Skills](../agent-skills/README.md) for guided workflows.

## Configuration

Set the blocks directory via environment variable:

```bash
export TRADEBLOCKS_BLOCKS_DIR=/path/to/your/blocks
```

## Block Directory Structure

Each folder in your blocks directory represents a trading strategy:

```
blocks/
  SPX-Iron-Condor/
    tradelog.csv      # Required - trade history
    dailylog.csv      # Optional - daily portfolio values
    reportinglog.csv  # Optional - live/reported trades
    .block.json       # Auto-generated - cached metadata
  NDX-Put-Spread/
    tradelog.csv
    ...
```

### CSV Formats

**tradelog.csv** (required) - 17 columns:
```
symbol,trade_id,date_opened,time_opened,date_closed,time_closed,opening_price,closing_price,quantity,pl,opening_commissions_fees,closing_commissions_fees,max_profit,max_loss,strategy,status,notes
```

**dailylog.csv** (optional) - 5 columns:
```
date,pl,equity,portfolio_start_value,drawdown
```

**reportinglog.csv** (optional) - for backtest vs actual comparison

## Available Tools

### Core Tools
- `list_backtests` - List all available blocks
- `get_statistics` - Performance metrics (Sharpe, Sortino, drawdown, etc.)
- `reprocess_block` - Re-parse CSVs and recalculate statistics

### Analysis Tools
- `run_walk_forward` - Walk-forward analysis with configurable windows
- `run_monte_carlo` - Monte Carlo simulation with worst-case scenarios
- `calculate_correlation` - Strategy correlation matrix
- `get_tail_risk` - Tail risk and joint drawdown analysis
- `calculate_position_sizing` - Kelly criterion position sizing

### Performance Tools
- `get_performance_charts` - 16 chart types (equity curve, drawdown, P&L distribution, etc.)
- `get_period_returns` - Returns aggregated by time period
- `compare_backtest_vs_actual` - Compare theoretical vs live results

### Report Builder Tools
- `list_available_fields` - List filterable trade fields
- `run_filtered_query` - Query trades with filters
- `get_field_statistics` - Statistics for a specific field
- `aggregate_by_field` - Group and aggregate by field values

### Import Tools
- `import_csv` - Import a CSV file as a new block

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Pack for Desktop Extension
mcpb pack
```

## Related

- [Agent Skills](../agent-skills/README.md) - Conversational workflows for guided analysis
- [Main Application](../../README.md) - Web-based UI for TradeBlocks
