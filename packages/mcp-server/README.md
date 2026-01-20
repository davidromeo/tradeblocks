# TradeBlocks MCP Server

Model Context Protocol (MCP) server for options trading analysis. Works with Claude Desktop, Claude Code, Codex CLI, Gemini CLI, ChatGPT, Google AI Studio, and any MCP-compatible client.

## Features

- **21 MCP tools** for comprehensive trading analysis
- **Two transport modes**: stdio (CLI tools) and HTTP (web platforms)
- **Block-based data organization** - each folder is a trading strategy
- **Automatic caching** - statistics cached in `block.json` for fast access
- **Flexible CSV detection** - auto-detects file types by column headers

## Installation

### Option 1: MCPB Bundle (Claude Desktop - One Click)

Download the latest `.mcpb` file from [GitHub Releases](https://github.com/davidromeo/tradeblocks/releases) and double-click to install.

The installer will prompt you to select your Trading Data Directory.

### Option 2: npx (All Platforms)

Run directly without installation:

```bash
# stdio mode (Claude Desktop, Claude Code, Codex CLI, Gemini CLI)
npx tradeblocks-mcp ~/Trading/backtests

# HTTP mode (ChatGPT, Google AI Studio, Julius AI)
npx tradeblocks-mcp --http ~/Trading/backtests
```

See [Configuration by Platform](#configuration-by-platform) below for platform-specific setup.

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
2. **Connect your AI platform** - See [Configuration by Platform](#configuration-by-platform) below
3. **Start analyzing** - Ask your AI to "list my backtests" or "run a health check on iron-condor"

For detailed usage examples, see [docs/USAGE.md](docs/USAGE.md).

## Configuration by Platform

### Claude Desktop

| Platform | Config Location |
|----------|-----------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

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

### Claude Code (CLI)

```bash
# Add the MCP server
claude mcp add tradeblocks -- npx tradeblocks-mcp ~/Trading/backtests

# Or with environment variable
export BLOCKS_DIRECTORY=~/Trading/backtests
claude mcp add tradeblocks -- npx tradeblocks-mcp
```

### OpenAI Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.tradeblocks]
command = "npx"
args = ["tradeblocks-mcp", "/path/to/your/backtests"]
```

Or add via command line:

```bash
codex mcp add tradeblocks -- npx tradeblocks-mcp ~/Trading/backtests
```

See [Codex MCP documentation](https://developers.openai.com/codex/mcp/) for more options.

### Gemini CLI

Add to `~/.gemini/settings.json`:

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

See [Gemini CLI MCP documentation](https://geminicli.com/docs/tools/mcp-server/) for more options.

### Web Platforms (ChatGPT, Google AI Studio, Julius)

Web AI platforms require HTTP transport with an ngrok tunnel:

**Terminal 1:** Start HTTP server
```bash
tradeblocks-mcp --http ~/Trading/backtests
```

**Terminal 2:** Expose via ngrok
```bash
ngrok http 3100
```

Then add the ngrok URL (`https://xxx.ngrok.io/mcp`) to your platform's MCP settings.

See [Web Platforms Guide](docs/WEB-PLATFORMS.md) for detailed setup instructions.

## Transport Modes

| Mode | Flag | Use Case | Platforms |
|------|------|----------|-----------|
| stdio | (default) | Local CLI tools | Claude Desktop, Claude Code, Codex CLI, Gemini CLI |
| HTTP | `--http` | Web platforms via ngrok | ChatGPT, Google AI Studio, Julius AI |

```bash
# stdio mode (default)
tradeblocks-mcp ~/backtests

# HTTP mode
tradeblocks-mcp --http ~/backtests
tradeblocks-mcp --http --port 8080 ~/backtests
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
    block.json        # Auto-generated - cached metadata
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
| `list_backtests` | List all available blocks with summary stats |
| `get_block_info` | Detailed info for a specific block |
| `get_statistics` | Performance metrics (Sharpe, Sortino, drawdown, etc.) |
| `get_strategy_comparison` | Compare strategies within a block |
| `compare_blocks` | Compare statistics across multiple blocks |
| `get_trades` | Raw trade data with filtering, sorting, pagination |

### Analysis Tools
| Tool | Description |
|------|-------------|
| `run_walk_forward` | Walk-forward analysis with configurable windows |
| `run_monte_carlo` | Monte Carlo simulation with worst-case scenarios |
| `get_correlation_matrix` | Strategy correlation matrix (Kendall, Spearman, Pearson) |
| `get_tail_risk` | Tail dependence and copula-based risk analysis |
| `get_position_sizing` | Kelly criterion position sizing |

### Performance Tools
| Tool | Description |
|------|-------------|
| `get_performance_charts` | 16 chart types (equity, drawdown, distribution) |
| `get_period_returns` | Returns aggregated by time period |
| `compare_backtest_to_actual` | Backtest vs live performance comparison |

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
| `import_csv` | Import a CSV file as a new block *(CLI only - not available in Claude Desktop)* |

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
- [Web Platforms Guide](docs/WEB-PLATFORMS.md) - Connect to ChatGPT, Google AI Studio, Julius
- [Agent Skills](../agent-skills/README.md) - Conversational workflows for guided analysis
- [Main Application](../../README.md) - Web-based UI for TradeBlocks
