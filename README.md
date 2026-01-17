# TradeBlocks

Options trading analytics toolkit with a web dashboard and AI-powered analysis via MCP (Model Context Protocol).

## Quick Start

### MCP Server (AI Assistant Integration)

Use TradeBlocks with Claude, Codex CLI, Gemini CLI, or any MCP-compatible client:

```bash
# Run directly with npx
npx tradeblocks-mcp ~/Trading/backtests

# Or install globally
npm install -g tradeblocks-mcp
tradeblocks-mcp ~/Trading/backtests
```

**One-click install for Claude Desktop:** Download the `.mcpb` bundle from [Releases](https://github.com/davidromeo/tradeblocks/releases).

See [MCP Server README](packages/mcp-server/README.md) for configuration details for Claude Desktop, Claude Code, Codex CLI, and Gemini CLI.

### Web Dashboard

```bash
git clone https://github.com/davidromeo/tradeblocks.git
cd tradeblocks
npm install
npm run dev
# Open http://localhost:3000
```

## Features

### MCP Server (tradeblocks-mcp)
- **19 analysis tools** – statistics, Monte Carlo simulations, walk-forward analysis, correlation matrices
- **Multi-platform** – Claude Desktop, Claude Code, Codex CLI, Gemini CLI
- **Agent skills** – guided workflows for strategy health checks, portfolio recommendations
- **Block-based organization** – each folder is a strategy with auto-cached statistics

### Web Dashboard
- **Performance dashboards** – win rates, P&L breakdowns, equity curves
- **Risk tooling** – Monte Carlo simulator, position sizing, correlation analysis
- **Block workflows** – organize trade logs, daily logs, and derived metrics
- **Client-side storage** – IndexedDB keeps data fast and private

## Data Format

TradeBlocks uses CSV exports in OptionOmega format. Each strategy folder contains:

```
backtests/
  SPX-Iron-Condor/
    tradelog.csv      # Required - trade history
    dailylog.csv      # Optional - daily portfolio values
  NDX-Put-Spread/
    my-export.csv     # Auto-detected by column headers
```

**Trade log columns:** `Date Opened`, `Time Opened`, `P/L`, `Strategy`, `No. of Contracts`

**Daily log columns:** `Date`, `Net Liquidity`, `P/L`, `Drawdown %`

> Flexible detection: Files are identified by column headers, not filenames.

## Documentation

| Guide | Description |
|-------|-------------|
| [MCP Server README](packages/mcp-server/README.md) | Installation & platform configuration |
| [MCP Usage Guide](packages/mcp-server/docs/USAGE.md) | Tool reference & example workflows |
| [Agent Skills](packages/agent-skills/README.md) | Guided conversational analysis |
| [Development Guide](docs/development.md) | Architecture & local development |

## Development

```bash
# Web dashboard
npm run dev              # Start dev server
npm run build            # Production build
npm test                 # Run tests

# MCP server
npm run build -w packages/mcp-server
npm test -w packages/mcp-server
npm run mcpb:pack -w packages/mcp-server  # Create MCPB bundle
```

## Contributing

1. Create a feature branch
2. Update or add tests when behavior changes
3. Run `npm run lint` and `npm test` before opening a pull request

## License

MIT

