# Project Milestones: TradeBlocks

## v2.1 Portfolio Comparison (Shipped: 2026-01-18)

**Delivered:** 7 new MCP tools for advanced portfolio comparison and analysis, plus CLI test mode and web platform integration documentation.

**Phases completed:** 17-24 (9 plans total, including Phase 17.1)

**Key accomplishments:**

- `block_diff` tool comparing two blocks with strategy overlap and P/L attribution
- `stress_test` tool with 11 built-in historical scenarios (COVID crash, 2022 bear, volmageddon, etc.)
- `drawdown_attribution` tool identifying max drawdown periods and per-strategy loss contribution
- `marginal_contribution` tool calculating marginal Sharpe/Sortino impact of adding strategies
- `strategy_similarity` tool with composite scoring for redundancy detection
- `what_if_scaling` tool projecting portfolio metrics at different strategy weights
- `portfolio_health_check` tool providing unified 4-layer health assessment
- CLI test mode (`--call` flag) for direct tool invocation with real data
- Web platform integration guide (ngrok tunnel setup for ChatGPT, Google AI Studio, Julius)

**Stats:**

- 137 files created/modified
- ~6,200 LOC added in packages/mcp-server/
- 9 phases (including 17.1), 9 plans
- 2 days (2026-01-17 → 2026-01-18)

**Git range:** `feat(17-01)` → `docs: update version to 0.2.0`

**What's next:** Planning next milestone

---

## v2.0 Claude Integration (Shipped: 2026-01-17)

**Delivered:** MCP server with 19 tools for AI-powered trading analytics, plus 6 agent skills for guided analysis workflows across Claude, Codex, and Gemini platforms.

**Phases completed:** 11-16 (15 plans total, including Phase 13.1)

**Key accomplishments:**

- MCP server (`tradeblocks-mcp`) with 19 tools covering statistics, analysis, performance, and reports
- JSON-first output pattern optimized for Claude reasoning with structured data
- 6 agent skills (health-check, wfa, risk, compare, portfolio, optimize) following agentskills.io standard
- Flexible CSV discovery by column headers (ISS-006 fix)
- GitHub Actions release pipeline with MCPB bundle distribution
- 20 integration tests and comprehensive documentation

**Stats:**

- 98 files created/modified
- ~10,400 LOC in packages/ (MCP server + agent skills)
- 7 phases (including 13.1), 15 plans
- 4 days (2026-01-14 → 2026-01-17)

**Git range:** `feat(11-01)` → `docs(16-01)`

**What's next:** Planning next milestone

---

## v1.0 WFA Enhancement (Shipped: 2026-01-11)

**Delivered:** Transformed walk-forward analysis from a rigid automatic tool into a user-controlled system with clear, understandable results for newcomers.

**Phases completed:** 1-10 (17 plans total)

**Key accomplishments:**

- Parameter UI overhaul with collapsible containers and opt-in model (disabled by default)
- Tab-based results organization with summary view showing headline verdict badges
- Interpretation guidance system with verdict explanations, red flag detection, and insights
- Calculation validation with sample variance (N-1) fix and 40+ new tests
- Pre-run configuration guidance with auto-config alerts for low-frequency trading
- Error boundary for graceful failure handling and empty state guidance

**Stats:**

- 62 files created/modified
- +8,961 / -797 lines of TypeScript
- 10 phases, 17 plans
- ~2.8 hours execution time (single day)

**Git range:** `7e8178d` → `3c9adb9`

**What's next:** v2.0 Claude Integration ✓

---
