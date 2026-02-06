# Project Milestones: TradeBlocks

## v2.7 Edge Decay Analysis (Shipped: 2026-02-06)

**Delivered:** Unified `analyze_edge_decay` MCP tool detecting strategy performance degradation through 5 signal engines (period segmentation, rolling metrics, Monte Carlo regime comparison, walk-forward degradation, live alignment) with structured factual data output for LLM interpretation.

**Phases completed:** 46-50 (11 plans total)

**Key accomplishments:**

- Period segmentation engine with yearly/quarterly/monthly breakdowns, linear regression trend detection, and worst losing stretch identification
- Rolling metrics engine with configurable windows, seasonal averages, recent-vs-historical comparison, and structural flag detection (payoff inversion)
- Dual Monte Carlo regime comparison with 4-level divergence classification (aligned/mild/significant/regime_break)
- Progressive walk-forward degradation tracking with OOS efficiency time series and recent-vs-historical comparison
- Live alignment signal comparing backtest vs actual execution with direction agreement and per-contract efficiency
- Unified `analyze_edge_decay` synthesis tool aggregating all 5 signals into exhaustive factual observations

**Stats:**

- 258 files changed, +41,570 / -37,529 lines of TypeScript
- 5 phases, 11 plans
- 152 new tests (1177 total)
- 9 days (Jan 28 → Feb 6, 2026)

**Git range:** `297c2fe` → `4338396`

**What's next:** Planning next milestone

---

## v2.6 DuckDB Analytics Layer (Shipped: 2026-02-04)

**Delivered:** SQL query capabilities for the MCP server via DuckDB, enabling Claude to write arbitrary SQL against trades and market data for hypothesis generation, with hash-based sync, security sandbox, schema discovery, and tool rationalization.

**Phases completed:** 41-45 including 42.1 (11 plans total)

**Key accomplishments:**

- DuckDB integration with lazy singleton connection manager, security sandbox (`enable_external_access: false`), and graceful shutdown
- CSV-to-DuckDB sync layer with SHA-256 hash-based change detection, atomic transactions, and 4 market data tables
- `run_sql` MCP tool enabling arbitrary SQL with security validation, 30s timeout, and helpful error messages
- `describe_database` MCP tool with DuckDB introspection, column descriptions, hypothesis flags, and 12 example queries
- Sync middleware pattern (`withSyncedBlock`/`withFullSync`) applied to 23+ tools, eliminating sync boilerplate
- Tool rationalization: removed 7 redundant query tools (41→34), establishing SQL-first data access pattern

**Stats:**

- 44 files modified in packages/mcp-server/
- +10,444 / -7,010 lines of TypeScript
- 6 phases, 11 plans
- 4 days (Feb 1 → Feb 4, 2026)

**Git range:** `4be28bb` → `01c0718`

**What's next:** Planning next milestone

---

## v2.5 Reporting Log Integration & Discrepancy Analysis (Shipped: 2026-02-01)

**Delivered:** MCP tools for AI-powered reporting log analysis: discover blocks with reporting logs, compare backtest vs actual at trade level with outlier detection, analyze slippage sources and patterns, match strategies by P/L correlation, and detect slippage trends over time.

**Phases completed:** 35-39 (5 plans total)

**Key accomplishments:**

- `get_reporting_log_stats` MCP tool for per-strategy breakdown from reporting logs (trade count, win rate, total P/L)
- Enhanced `compare_backtest_to_actual` with trade-level details, z-score outlier detection, and flexible grouping
- `analyze_discrepancies` MCP tool with 5-category slippage attribution and systematic pattern detection
- `suggest_strategy_matches` MCP tool with correlation-based matching and confidence scoring
- `analyze_slippage_trends` MCP tool with linear regression trend detection and statistical significance

**Stats:**

- 7 files modified in packages/mcp-server/
- +2,640 lines of TypeScript
- 5 phases, 5 plans
- 2 days (Jan 31 → Feb 1, 2026)

**Git range:** `d97d617` → `91f9b41`

**What's next:** Planning next milestone

---

## v2.4 Backtest Optimization Tools (Shipped: 2026-01-19)

**Delivered:** MCP tools for data-driven filter optimization: find_predictive_fields for correlation analysis and filter_curve for threshold sweeping with sweet spot detection.

**Phases completed:** 32-34 (3 plans total)

**Key accomplishments:**

- `find_predictive_fields` MCP tool ranking all numeric fields by Pearson correlation with P/L
- `filter_curve` MCP tool with bidirectional threshold sweeping (lt/gt/both modes) and auto-generated percentile thresholds
- Sweet spot detection with combined improvement scoring (winRateDelta * avgPlDelta)
- Fixed CLI --call mode to apply Zod schema parsing, eliminating runtime default workarounds

**Stats:**

- 10 files modified
- +1,565 / -21 lines of TypeScript
- 3 phases, 3 plans
- 1 day (2026-01-19)

**Git range:** `1868a0f` → `4047d50`

**What's next:** Planning next milestone

---

## v2.3 Workspace Packages (Shipped: 2026-01-19)

**Delivered:** Converted lib/ to @tradeblocks/lib workspace package for clean imports across the monorepo.

**Phases completed:** 29-31 (4 plans total)

**Key accomplishments:**

- @tradeblocks/lib workspace package with barrel exports (81 files)
- MCP server imports from workspace package (bundler moduleResolution)
- Next.js app imports migrated (127+ files)
- Test imports migrated with Jest moduleNameMapper (62 files)
- Removed legacy @/lib/* path alias

**Stats:**

- 189+ files modified
- 3 phases, 4 plans
- ~7 hours execution time

**Git range:** See [v2.3 archive](milestones/v2.3-workspace-packages.md)

**What's next:** v2.4 Backtest Optimization Tools ✓

---

## v2.2 Historical Risk-Free Rates (Shipped: 2026-01-18)

**Delivered:** Historical Treasury rates (2013-2026) embedded for accurate Sharpe/Sortino calculations that reflect actual market conditions, replacing fixed 2% assumption.

**Phases completed:** 25-28 (6 plans total)

**Key accomplishments:**

- Embedded 3,260 historical Treasury 3-month T-bill rates (2013-01-02 to 2026-01-15) as static data (~71KB)
- Date-based Sharpe/Sortino calculations using actual Treasury rates per trading day
- Removed manual riskFreeRate input from types, stores, UI, and MCP server API
- O(1) hash lookup for trading days with O(log n) binary search fallback for weekends/holidays
- Fixed 6 pre-existing test failures (maxLoss fallback for debit trades, calendar scaling tests)
- Added automated treasury rate update workflow for future maintenance

**Stats:**

- 41 files created/modified
- +5,866 / -179 lines of TypeScript
- 4 phases, 6 plans
- 1 day (2026-01-18)

**Git range:** `761776b` → `5e56dda`

**What's next:** Planning next milestone

---

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
