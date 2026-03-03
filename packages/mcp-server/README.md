# TradeBlocks MCP Server

Model Context Protocol (MCP) server for options trading analysis. Works with Claude Desktop, Claude Code, Codex CLI, Gemini CLI, ChatGPT, Google AI Studio, and any MCP-compatible client.

## Features

- **Comprehensive MCP tools** for trading analysis
- **SQL analytics layer** - `run_sql` for arbitrary queries, `describe_database` for schema discovery
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

Web AI platforms require HTTP transport with a publicly reachable URL:

```bash
tradeblocks-mcp --http ~/Trading/backtests
```

Then expose port 3100 however you prefer (ngrok, Cloudflare Tunnel, reverse proxy, Docker on a server, etc.) and add the URL (`https://your-host/mcp`) to your platform's MCP settings.

See [Web Platforms Guide](docs/WEB-PLATFORMS.md) for platform-specific setup, or [Docker Deployment](#docker-deployment) for running on a remote server.

## Transport Modes

| Mode | Flag | Use Case | Platforms |
|------|------|----------|-----------|
| stdio | (default) | Local CLI tools | Claude Desktop, Claude Code, Codex CLI, Gemini CLI |
| HTTP | `--http` | Web platforms, remote servers | ChatGPT, Google AI Studio, Julius AI |

```bash
# stdio mode (default)
tradeblocks-mcp ~/backtests

# HTTP mode
tradeblocks-mcp --http ~/backtests
tradeblocks-mcp --http --port 8080 ~/backtests
```

## Docker Deployment

Run the MCP server in a container for remote/server deployments.

### Pre-built image (recommended)

```bash
docker run -d -p 3100:3100 -v ./data:/data --env-file .env ghcr.io/davidromeo/tradeblocks-mcp:latest
```

Or with docker compose, set the image in `docker-compose.yml`:
```yaml
services:
  tradeblocks:
    image: ghcr.io/davidromeo/tradeblocks-mcp:latest
```

### Build from source

```bash
cd packages/mcp-server
npm run build                # build on host (resolves workspace deps)
docker build -t tradeblocks-mcp .
docker compose up -d
```

Place your block folders (each containing CSV files) in the `data/` directory. The container runs in HTTP mode on port 3100 by default. See [Authentication](#authentication) below for configuring credentials.

Connect any MCP client to `http://<your-host>:3100/mcp`. How you expose this endpoint (reverse proxy, tunnel, VPN, etc.) is up to you.

## Authentication

HTTP mode includes **OAuth 2.1 with PKCE** authentication, enabled by default. MCP clients that support OAuth (Claude, ChatGPT, etc.) handle the flow automatically — users see a login prompt on first connection.

### Setup

Copy `.env.example` to `.env` and configure:

```env
# Required for HTTP mode
TRADEBLOCKS_USERNAME=admin
TRADEBLOCKS_PASSWORD=changeme
TRADEBLOCKS_JWT_SECRET=           # generate with: openssl rand -hex 32

# Optional
TRADEBLOCKS_PORT=3100             # HTTP port (default: 3100)
TRADEBLOCKS_JWT_EXPIRY=24h        # Token lifetime (default: 24h)
TRADEBLOCKS_ISSUER_URL=           # Public URL when behind a reverse proxy (e.g. https://mcp.yourdomain.com)

# DuckDB tuning
DUCKDB_THREADS=2
DUCKDB_MEMORY_LIMIT=512MB
```

### Disabling Auth

If the server is behind a reverse proxy or tunnel that already handles authentication:

```bash
tradeblocks-mcp --http --no-auth ~/backtests
```

Or set `TRADEBLOCKS_NO_AUTH=true` in `.env`.

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
| `list_blocks` | List all available blocks with summary stats |
| `get_block_info` | Detailed info for a specific block |
| `get_statistics` | Performance metrics (Sharpe, Sortino, drawdown, etc.) |
| `get_strategy_comparison` | Compare strategies within a block |
| `compare_blocks` | Compare statistics across multiple blocks |

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

### SQL Tools
| Tool | Description |
|------|-------------|
| `run_sql` | Execute SQL queries against trades and market data |
| `describe_database` | Schema discovery with table info and example queries |

### Market Data Tools
| Tool | Description |
|------|-------------|
| `import_market_csv` | Import market data CSV with column mapping |
| `import_from_database` | Import from external DuckDB databases |
| `enrich_market_data` | Compute ~40 derived indicators from raw OHLCV |
| `enrich_trades` | Enrich trades with market context (lookahead-free) |
| `analyze_regime_performance` | Analyze P&L by market regime |
| `suggest_filters` | Suggest trade filters based on market conditions |
| `calculate_orb` | Opening range breakout analysis from intraday bars |

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

## Market Data (Optional)

For market context (VIX regimes, intraday timing, gap analysis), import market data from TradingView exports using MCP tools:

1. **Export** from TradingView (any chart: SPX daily, VIX daily, SPX 5-min, etc.)
2. **Import** via `import_market_csv` with a column mapping
3. **Enrich** via `enrich_market_data` to compute ~40 derived indicators

No Pine Scripts needed — TradingView exports raw OHLCV natively.

Market data lives in a separate `market.duckdb` (configurable via `MARKET_DB_PATH` or `--market-db`). Tables:
- `market.daily` — Daily OHLCV + enriched indicators (keyed by `ticker, date`)
- `market.context` — VIX / volatility context (keyed by `date`)
- `market.intraday` — Intraday bars at any resolution (keyed by `ticker, date, time`)

See [scripts/README.md](../../scripts/README.md) for import examples and column mapping reference.

## Related

- [Usage Guide](docs/USAGE.md) - Detailed usage examples and workflows
- [Web Platforms Guide](docs/WEB-PLATFORMS.md) - Connect to ChatGPT, Google AI Studio, Julius
- [Agent Skills](../agent-skills/README.md) - Conversational workflows for guided analysis
- [Market Data Import](../../scripts/README.md) - Import workflow and column mapping reference
- [Main Application](../../README.md) - Web-based UI for TradeBlocks
