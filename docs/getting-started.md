# Getting Started

## Prerequisites

- **Node.js 22+** (required for native fetch support)
- **npm** (included with Node.js)

## Installation

```bash
git clone https://github.com/davidromeo/tradeblocks.git
cd tradeblocks
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the web dashboard.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MASSIVE_API_KEY` | No | Massive.com API key for automated market data import. CSV import works without it. |
| `TRADEBLOCKS_DATA_DIR` | No | Override default data directory (default: `~/Trading/backtests`) |
| `MARKET_DB_PATH` | No | Override market database file path |
| `DUCKDB_THREADS` | No | Limit DuckDB thread count for resource-constrained environments |
| `DUCKDB_MEMORY_LIMIT` | No | Limit DuckDB memory usage (e.g., `512MB`) |

## Your First Data Import

1. Open the web dashboard at `http://localhost:3000`
2. Navigate to **Blocks** and create a new block
3. Upload a `tradelog.csv` file (from [Option Omega](https://optionomega.com/) or compatible format)
4. Optionally upload a `dailylog.csv` for enhanced drawdown calculations
5. View your portfolio statistics, equity curve, and performance metrics

Files are auto-detected by column headers, not filenames. Any CSV with the expected columns will work.

## MCP Server Setup

The MCP server provides 50+ tools for AI-assisted portfolio analysis. Install and connect it to your AI client:

```bash
# Run directly with npx
npx tradeblocks-mcp ~/Trading/backtests

# Or add to Claude Code
claude mcp add tradeblocks -- npx tradeblocks-mcp ~/Trading/backtests
```

See [packages/mcp-server/README.md](../packages/mcp-server/README.md) for platform-specific configuration (Claude Desktop, Codex CLI, Gemini CLI, ChatGPT, Google AI Studio).

## Massive.com API (Optional)

For automated market data import without manual CSV exports:

1. Get an API key from [massive.com](https://massive.com)
2. Set the environment variable:
   ```bash
   export MASSIVE_API_KEY=your_key_here
   ```
   Or add it to your `.env` file or Claude Desktop configuration.
3. Use the `import_from_massive` MCP tool for daily OHLCV, VIX context, or intraday bars
4. Enrichment runs automatically after daily imports

See [Market Data Guide](market-data.md) for full details on import paths, ticker formats, and enrichment.

## Next Steps

- [Market Data Guide](market-data.md) -- importing and enriching market data
- [MCP Tools Reference](mcp-tools.md) -- complete tool listing by category
- [Architecture](architecture.md) -- how TradeBlocks works under the hood
- [Development Guide](development.md) -- contributing and local dev setup
