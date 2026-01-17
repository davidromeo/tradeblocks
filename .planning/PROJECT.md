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

### Active

(None — planning next milestone)

### Out of Scope

- Server-side computation — Must remain 100% client-side for web app
- New optimization algorithms — Focus on UX and AI integration
- Mobile app — Web-first approach, PWA works well

## Context

**Current state (v2.0):**
- Next.js 15 web application with client-side computation
- MCP server (`tradeblocks-mcp`) with 19 tools at packages/mcp-server/
- 6 agent skills at packages/agent-skills/
- ~10,400 LOC in packages/, ~12,500 LOC in WFA-related files
- 179 walk-forward tests + 20 MCP integration tests

**Architecture:**
- Monorepo with npm workspaces
- Root: Next.js web app
- packages/mcp-server/: MCP server (npm: tradeblocks-mcp)
- packages/agent-skills/: Agent skill definitions

## Constraints

- **Client-side web app**: All web computation in browser, no backend API
- **MCP server**: Node.js process, stdio transport
- **Compatibility**: Must work with existing Block/Trade data structures

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

---
*Last updated: 2026-01-17 after v2.0 milestone*
