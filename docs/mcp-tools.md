# MCP Tools Reference

TradeBlocks provides 60+ MCP tools for AI-assisted options trading analysis, organized by category.

## Block Management

| Tool | Description |
|------|-------------|
| `list_blocks` | List all portfolio blocks with summary statistics |
| `get_block_info` | Detailed info for a specific block |
| `get_statistics` | Portfolio performance metrics (Sharpe, Sortino, drawdown, etc.) |
| `get_trades` | Individual trade records with optional filtering |
| `get_strategy_comparison` | Compare strategies within a single block |
| `compare_blocks` | Side-by-side comparison across multiple blocks |
| `block_diff` | Diff statistics between two blocks |

## Performance Analysis

| Tool | Description |
|------|-------------|
| `get_performance_charts` | Chart data: equity curve, drawdown, monthly returns (16+ types) |
| `get_period_returns` | Returns aggregated by period (daily, weekly, monthly) |
| `compare_backtest_to_actual` | Backtest vs live trade comparison with slippage analysis |

## Market Data Import

| Tool | Description |
|------|-------------|
| `import_market_csv` | Import OHLCV data from a local CSV file |
| `import_from_database` | Import from an external DuckDB database |
| `import_from_massive` | Import from Massive.com API (daily, context, intraday) |
| `enrich_market_data` | Run enrichment pipeline to compute ~40 derived indicators |

See [Market Data Guide](market-data.md) for import examples, ticker formats, and enrichment details.

## Market Analysis

| Tool | Description |
|------|-------------|
| `analyze_regime_performance` | Analyze P&L by market regime (VIX levels, trend, volatility) |
| `suggest_filters` | AI-suggested entry filters based on market conditions |
| `calculate_orb` | Opening range breakout analysis from intraday bars |
| `enrich_trades` | Add market context to trades (lookahead-free) |

## Trade Replay

| Tool | Description |
|------|-------------|
| `replay_trade` | Replay trades with minute-level option bars for MFE/MAE analysis |

Supports hypothetical mode (explicit legs) and tradelog mode (replay from existing trade data). Requires `MASSIVE_API_KEY`. See [Market Data Guide](market-data.md#trade-replay) for details.

## Strategy Profiles

| Tool | Description |
|------|-------------|
| `profile_strategy` | Create or update a strategy profile with structured metadata |
| `get_strategy_profile` | Retrieve a stored strategy profile |
| `list_profiles` | List all strategy profiles (optionally filtered by block) |
| `delete_profile` | Delete a strategy profile |

## Profile Analysis

| Tool | Description |
|------|-------------|
| `analyze_structure_fit` | Analyze strategy performance by regime/condition dimensions |
| `validate_entry_filters` | Test each entry filter's contribution to edge |
| `portfolio_structure_map` | Regime x structure coverage matrix across all strategies |

## Advanced Analysis

| Tool | Description |
|------|-------------|
| `run_monte_carlo` | Monte Carlo simulation with confidence intervals and worst-case scenarios |
| `run_walk_forward` | Walk-forward analysis to detect overfitting |
| `get_correlation_matrix` | Strategy correlation matrix (Kendall, Spearman, Pearson) |
| `get_tail_risk` | Tail dependence and copula-based risk analysis |
| `get_position_sizing` | Kelly criterion position sizing guidance |
| `regime_allocation_advisor` | Regime-based allocation recommendations |

## Edge Decay

| Tool | Description |
|------|-------------|
| `analyze_edge_decay` | Detect strategy performance decay over time |

## SQL and Schema Discovery

| Tool | Description |
|------|-------------|
| `run_sql` | Execute arbitrary SQL against DuckDB (trades + market data) |
| `describe_database` | Show database schema with table info and example queries |
| `get_field_statistics` | Field-level statistics for any column |

## Import Tools

| Tool | Description |
|------|-------------|
| `import_csv` | Import a CSV file as a new block *(CLI only -- not available in Claude Desktop)* |

---

For detailed parameter schemas, use your AI client's tool discovery feature or see the tool definitions in the MCP server source code under `packages/mcp-server/src/tools/`.

For usage examples and common workflows, see the [MCP Usage Guide](../packages/mcp-server/docs/USAGE.md).
