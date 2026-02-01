# TradeBlocks

## What This Is

Options trading analytics platform with a web dashboard and AI-powered analysis via MCP (Model Context Protocol). Includes walk-forward analysis, Monte Carlo simulation, correlation analysis, position sizing, and more — all accessible through a browser UI or programmatically via MCP server for integration with Claude, Codex, and Gemini AI assistants.

## Core Value

Make trading analytics accessible and understandable. Complex analysis should be easy to run and interpret, whether through the UI or AI-assisted workflows.

## Requirements

### Validated

**v1.0 WFA Enhancement:**
- ✓ Walk-forward analysis with user-controlled parameters — v1.0
- ✓ Tab-based results organization with verdict badges — v1.0
- ✓ Interpretation guidance with red flags and insights — v1.0
- ✓ Calculation robustness (sample variance N-1, 179 tests) — v1.0

**v2.0 Claude Integration:**
- ✓ MCP server with 19 tools (stats, analysis, performance, reports) — v2.0
- ✓ JSON-first output pattern for AI reasoning — v2.0
- ✓ 6 agent skills for guided analysis workflows — v2.0
- ✓ Multi-platform support (Claude, Codex, Gemini) — v2.0
- ✓ Flexible CSV discovery by column headers — v2.0
- ✓ GitHub Actions release pipeline — v2.0

**v2.1 Portfolio Comparison:**
- ✓ block_diff tool for two-block comparison with strategy overlap — v2.1
- ✓ stress_test tool with 11 built-in historical scenarios — v2.1
- ✓ drawdown_attribution tool for max drawdown period analysis — v2.1
- ✓ marginal_contribution tool for per-strategy Sharpe/Sortino impact — v2.1
- ✓ strategy_similarity tool for redundancy detection — v2.1
- ✓ what_if_scaling tool for strategy weight projections — v2.1
- ✓ portfolio_health_check tool for unified 4-layer assessment — v2.1
- ✓ CLI test mode (--call flag) for direct tool invocation — v2.1
- ✓ Web platform integration guide (ngrok tunnel setup) — v2.1

**v2.2 Historical Risk-Free Rates:**
- ✓ Historical Treasury rates embedded (3,260 daily rates 2013-2026) — v2.2
- ✓ Date-based Sharpe/Sortino using actual Treasury rates per trading day — v2.2
- ✓ Removed manual riskFreeRate input from types, stores, UI, MCP API — v2.2
- ✓ Automated treasury rate update workflow (.github/workflows) — v2.2

**v2.3 Workspace Packages:**
- ✓ @tradeblocks/lib workspace package with barrel exports — v2.3
- ✓ MCP server imports from workspace package (bundler moduleResolution) — v2.3
- ✓ Next.js app imports migrated (127+ files) — v2.3
- ✓ Test imports migrated with Jest moduleNameMapper (62 files) — v2.3
- ✓ Removed legacy @/lib/* path alias — v2.3

**v2.4 Backtest Optimization Tools:**
- ✓ find_predictive_fields tool for Pearson correlation analysis of all numeric fields vs P/L — v2.4
- ✓ filter_curve tool with bidirectional threshold sweeping (lt/gt/both modes) — v2.4
- ✓ Sweet spot detection with combined improvement scoring (winRateDelta * avgPlDelta) — v2.4
- ✓ CLI --call mode fixed to apply Zod schema parsing for proper defaults — v2.4

**v2.5 Reporting Log Integration & Discrepancy Analysis:**
- ✓ MCP server can ingest reporting logs (strategylog.csv) for a block — v2.5
- ✓ Models can compare backtest vs actual with trade-level detail — v2.5
- ✓ Models can analyze discrepancy patterns (slippage sources, execution quality) — v2.5
- ✓ Models can detect strategy matching issues and suggest fixes — v2.5
- ✓ Models can track slippage trends over time — v2.5
- ✓ Quality scoring dropped (existing tools provide metrics, AI synthesizes) — v2.5

### Active

**v2.6 DuckDB Analytics Layer:**
- [ ] Central `market.duckdb` for all market data (SPX daily, intraday, VIX, extensible)
- [ ] Auto-synced `trades.duckdb` caching all blocks with mtime-based refresh
- [ ] `run_sql` MCP tool for arbitrary SQL queries joining trades ↔ market data
- [ ] Cross-block queries (e.g., "all Iron Condors across all portfolios")
- [ ] Deprecate redundant query tools (SQL replaces filter/aggregate tools)

## Current Milestone: v2.6 DuckDB Analytics Layer

**Goal:** Enable Claude to write arbitrary SQL against trades and market data for hypothesis generation and backtest research.

**Target features:**
- Central market data store (`market.duckdb`) with existing + extensible data sources
- Auto-synced trade cache (`trades.duckdb`) that stays fresh with CSV changes
- `run_sql` tool as primary query interface for AI-driven exploration
- Support for cross-block analysis and market data joins
- Preserve block portability (folder delete/update/add still works)

### Out of Scope

- Server-side computation — Must remain 100% client-side for web app
- New optimization algorithms — Focus on UX and AI integration
- Mobile app — Web-first approach, PWA works well

## Context

**Current state (v2.5):**
- Next.js 15 web application with client-side computation
- MCP server (`tradeblocks-mcp` v0.4.8) with 33 tools at packages/mcp-server/
- 6 agent skills at packages/agent-skills/
- Shared library at packages/lib/ (81 files, barrel exports)
- ~20,800 LOC in packages/, ~12,500 LOC in WFA-related files
- 1024 tests (65 test suites)
- Embedded historical Treasury rates (2013-2026) for accurate risk metrics
- Backtest optimization tools for data-driven filter development
- Reporting log analysis tools for backtest vs actual comparison

**Architecture:**
- Monorepo with npm workspaces
- Root: Next.js web app
- packages/lib/: Shared library (@tradeblocks/lib workspace package)
- packages/mcp-server/: MCP server (npm: tradeblocks-mcp)
- packages/agent-skills/: Agent skill definitions

## Constraints

- **Client-side web app**: All web computation in browser, no backend API
- **MCP server**: Node.js process, stdio transport
- **Compatibility**: Must work with existing Block/Trade data structures
- **CLI test verification**: All v2.1+ MCP tools require CLI test mode verification with real data

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Results clarity as core priority | New users overwhelmed is biggest barrier | ✓ Good |
| MCP over custom Claude skill | Wider platform support, standard protocol | ✓ Good |
| JSON-first output pattern | Optimizes for AI reasoning, not human reading | ✓ Good |
| Folder-based blocks with .block.json | Simple file structure, cacheable metadata | ✓ Good |
| Flexible CSV discovery | UX improvement, column headers over filenames | ✓ Good |
| Agent Skills standard (agentskills.io) | Cross-platform compatibility | ✓ Good |
| npm workspaces monorepo | Simpler than pnpm, better npm compatibility | ✓ Good |
| Trade-based calculations only for comparison tools | Daily logs represent full portfolio, not per-strategy | ✓ Good |
| Composite similarity scoring (50% corr, 30% tail, 20% overlap) | Balance correlation and tail risk signals | ✓ Good |
| 4-layer health check response | Progressive detail from quick verdict to actionable flags | ✓ Good |
| ngrok tunnel for web platforms | Keeps data local while enabling remote MCP URLs | ✓ Good |
| Embedded Treasury rates (no API calls) | Maintains 100% local data principle, ~71KB bundled | ✓ Good |
| Date-based risk-free rates over fixed rate | Accurate Sharpe/Sortino reflecting actual market conditions | ✓ Good |
| Direct TS source consumption for workspace packages | No build step needed, all consumers handle compilation | ✓ Good |
| Bundler moduleResolution for MCP server | Enables workspace package resolution without .js extensions | ✓ Good |
| Stores excluded from main lib export | Avoids browser/Node dependency conflicts | ✓ Good |
| Pearson correlation for field predictiveness | Simple, interpretable, identifies linear relationships | ✓ Good |
| Sweet spot criteria (winRateDelta > 0, avgPlDelta > 0, ≥20% trades) | Ensures actionable filters that improve both metrics | ✓ Good |
| Fix CLI handler instead of per-tool workarounds | Single fix ensures all tools work correctly | ✓ Good |
| Per-contract P/L normalization for strategy matching | Fair comparison across different position sizes | ✓ Good |
| Z-score threshold of 2 for outlier detection | ~95% confidence interval, reasonable default | ✓ Good |
| Confidence scoring: 70% correlation + 30% timing overlap | Balance P/L correlation and trading frequency alignment | ✓ Good |
| Linear regression with normal approximation for p-value | Simple, uses existing normalCDF from lib | ✓ Good |
| Drop Quality Scoring (Phase 40) | Existing tools provide metrics; AI synthesizes rather than prescriptive scores | ✓ Good |
| Trade matching by date\|strategy\|time (minute precision) | Handles fractional seconds in actual trades | ✓ Good |

---
*Last updated: 2026-02-01 after v2.6 milestone started*
