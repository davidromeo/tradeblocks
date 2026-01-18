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

### Active

(None — planning next milestone)

### Out of Scope

- Server-side computation — Must remain 100% client-side for web app
- New optimization algorithms — Focus on UX and AI integration
- Mobile app — Web-first approach, PWA works well

## Context

**Current state (v2.1):**
- Next.js 15 web application with client-side computation
- MCP server (`tradeblocks-mcp`) with 26 tools at packages/mcp-server/
- 6 agent skills at packages/agent-skills/
- ~16,600 LOC in packages/, ~12,500 LOC in WFA-related files
- 179 walk-forward tests + ~150 MCP integration tests

**Architecture:**
- Monorepo with npm workspaces
- Root: Next.js web app
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

---
*Last updated: 2026-01-18 after v2.1 milestone*
