# Phase 12: Core Integration Layer - Research

**Researched:** 2026-01-14
**Domain:** MCP Server Development with TypeScript for financial data queries
**Confidence:** HIGH

<research_summary>
## Summary

Researched MCP server development patterns and conducted comprehensive codebase analysis to ensure full feature coverage for the TradeBlocks integration layer.

**TradeBlocks has 10 major features** across analysis, risk, and portfolio management:
1. Block Management & Statistics
2. Performance Analysis (equity curves, drawdowns, returns)
3. Walk-Forward Analysis (strategy robustness testing)
4. Trading Calendar (backtest vs actual comparison)
5. Position Sizing (Kelly criterion)
6. Risk Simulator (Monte Carlo with worst-case scenarios)
7. Tail Risk Analysis (Gaussian copula)
8. Correlation Matrix (Kendall/Spearman/Pearson)
9. Static Datasets (external data matching)
10. Report Builder (custom charts)

**Key finding:** The existing lib/calculations/ directory already has production-tested implementations for ALL major calculations (portfolio stats, Monte Carlo, Kelly, tail risk, correlation, WFA). The MCP server is primarily a thin adapter layer.

**Tool design:** 14 workflow-based tools organized into three tiers:
- **Tier 1 (Core):** Block listing, statistics, strategy comparison, cross-block comparison
- **Tier 2 (Analysis):** WFA, Monte Carlo, correlation, tail risk, position sizing
- **Tier 3 (Performance):** Chart data, period returns, backtest vs actual comparison

**Primary recommendation:** Build 14 MCP tools covering all major features. Defer Static Datasets and Report Builder to Phase 13. Reuse existing calculation modules via @lib/* imports. Keep tool descriptions clear and return structured markdown for Claude parsing.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.12.0 | MCP server implementation | Official SDK with full spec support |
| zod | ^3.25+ | Schema validation | Required peer dependency, type-safe validation |
| tsup | ^8.0 | Build/bundling | Already in use, bundles @lib/* imports |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mathjs | (existing) | Statistics calculations | Reuse from lib/calculations |
| csv-parse | (existing) | CSV parsing | Reuse from lib/processing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdio transport | Streamable HTTP | HTTP for remote servers; stdio preferred for CLI tools |
| zod | JSON Schema | Zod has better DX, required by SDK anyway |

**Installation:**
Already installed in packages/mcp-server/:
```bash
pnpm add @modelcontextprotocol/sdk zod
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
packages/mcp-server/
├── src/
│   ├── index.ts           # Entry point, server setup
│   ├── tools/             # Tool implementations
│   │   ├── blocks.ts      # Block listing/querying tools
│   │   ├── trades.ts      # Trade query/filter tools
│   │   ├── statistics.ts  # Statistics calculation tools
│   │   └── analysis.ts    # Advanced analysis tools
│   └── utils/
│       └── csv-loader.ts  # Load CSVs from folder structure
├── package.json
└── tsconfig.json
```

### Pattern 1: Workflow-Based Tool Design
**What:** Build tools that handle complete user goals, not granular API functions
**When to use:** Always - this is the primary pattern for MCP tools
**Example:**
```typescript
// GOOD: Workflow-based tool
server.tool(
  "get_block_statistics",
  "Get complete portfolio statistics for a backtest block",
  {
    blockId: z.string().describe("Block folder name"),
    strategy: z.string().optional().describe("Filter by strategy name")
  },
  async ({ blockId, strategy }) => {
    const trades = await loadTrades(blockId);
    const filtered = strategy
      ? trades.filter(t => t.strategy === strategy)
      : trades;
    const stats = calculator.calculatePortfolioStats(filtered);
    return { content: [{ type: "text", text: formatStats(stats) }] };
  }
);

// BAD: Granular API-style tools (avoid)
// - get_trades
// - filter_by_strategy
// - calculate_sharpe
// - calculate_sortino
// Too many tools confuses the model
```

### Pattern 2: Error Reporting in Result Objects
**What:** Return errors in the tool result, not as MCP protocol errors
**When to use:** All tool implementations
**Example:**
```typescript
server.tool("get_trades", "...", schema, async (args) => {
  try {
    const trades = await loadTrades(args.blockId);
    return {
      content: [{ type: "text", text: JSON.stringify(trades) }]
    };
  } catch (error) {
    // Report error in result, NOT as thrown exception
    return {
      content: [{
        type: "text",
        text: `Error loading trades: ${error.message}`
      }],
      isError: true
    };
  }
});
```

### Pattern 3: Progressive Discovery for Many Options
**What:** Return available options first, then let model query specifics
**When to use:** When there are many blocks or strategies to choose from
**Example:**
```typescript
// Tool 1: Discover what's available
server.tool("list_backtests", "List available backtest blocks", {}, async () => {
  const blocks = await getBlocks();
  return {
    content: [{
      type: "text",
      text: `Available blocks:\n${blocks.map(b => `- ${b.name}: ${b.trades} trades`).join('\n')}`
    }]
  };
});

// Tool 2: Get details for specific block
server.tool("get_block_details", "Get full details for a block", { blockId }, async (args) => {
  // Return detailed info only when asked
});
```

### Anti-Patterns to Avoid
- **Too many tools:** Keep to ~8-12 tools max. Model performance degrades with more.
- **console.log in stdio servers:** This corrupts JSON-RPC messages. Use console.error only.
- **Returning too much data:** Summarize or paginate. Don't return 10k trades raw.
- **Global state between tools:** Each tool call should be independent.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Portfolio statistics | Custom formulas | `PortfolioStatsCalculator` from lib/calculations | Handles edge cases, matches Python numpy |
| Monte Carlo simulation | Custom simulation loop | `runMonteCarloSimulation` from lib/calculations/monte-carlo | Includes worst-case testing, percentile bands |
| Kelly criterion | Manual Kelly formula | `calculateKellyFraction` from lib/calculations/kelly | Per-strategy and portfolio-level calculations |
| Tail risk analysis | Custom copula math | `calculateTailDependence` from lib/calculations/tail-risk | Gaussian copula with Kendall's tau |
| Correlation matrix | Manual correlation | `calculateCorrelationMatrix` from lib/calculations/correlation | Kendall, Spearman, Pearson methods |
| Walk-forward analysis | Custom WFA logic | `WalkForwardOptimizer` from lib/calculations | Multiple optimization targets, robustness metrics |
| Margin timeline | Manual margin calc | `calculateMarginTimeline` from lib/calculations/margin-timeline | Handles compounding vs fixed capital |
| CSV parsing | Manual parsing | `TradeProcessor` from lib/processing | Handles column mapping, validation, errors |
| Date handling | Direct Date objects | Existing date utils | Eastern timezone handling is tricky |
| Performance snapshots | Manual chart data | `buildPerformanceSnapshot` from lib/services | Cached, handles all chart types |
| Calendar comparison | Custom matching | `scaleStrategyComparison` from lib/services/calendar-data | Handles scaling modes |

**Key insight:** TradeBlocks lib/ already has production-tested implementations for EVERY calculation and analysis feature. The MCP server is primarily a thin adapter layer that exposes existing functionality via MCP protocol.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: STDIO Logging Corruption
**What goes wrong:** Server fails silently or produces invalid JSON
**Why it happens:** `console.log()` writes to stdout, corrupting JSON-RPC messages
**How to avoid:** Only use `console.error()` for any logging in stdio servers
**Warning signs:** MCP Inspector shows malformed messages or disconnects

### Pitfall 2: Tool Proliferation
**What goes wrong:** Model calls wrong tools, uses wrong parameters, wastes context
**Why it happens:** Exposing too many granular tools (18+ tools uses 5-7% of context)
**How to avoid:** Design workflow-based tools that handle complete goals (~8-12 max)
**Warning signs:** Model struggles with simple queries, picks wrong tool

### Pitfall 3: Strategy Filtering with Daily Logs
**What goes wrong:** Statistics are wrong when filtering by strategy
**Why it happens:** Daily logs represent FULL portfolio, not per-strategy
**How to avoid:** When `isStrategyFiltered=true`, force trade-based calculations only
**Warning signs:** Sharpe/Sortino ratios don't change when filtering strategies

### Pitfall 4: Response Size Explosion
**What goes wrong:** Model context fills up, responses slow/fail
**Why it happens:** Returning full trade arrays (thousands of rows)
**How to avoid:** Summarize data, paginate large results, return stats not raw data
**Warning signs:** Slow responses, model forgetting earlier context

### Pitfall 5: Timezone Confusion
**What goes wrong:** Dates show wrong day, time-based filtering breaks
**Why it happens:** Not handling Eastern timezone correctly
**How to avoid:** Use existing date handling from lib/, never use `.toISOString()` for display
**Warning signs:** Dates off by one day, trades appearing on wrong dates
</common_pitfalls>

<code_examples>
## Code Examples

### Basic MCP Server with Tool Registration
```typescript
// Source: packages/mcp-server/src/index.ts (existing scaffold)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer(
  { name: "tradeblocks-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.tool(
  "tool_name",
  "Tool description for the model",
  { param: z.string().describe("Parameter description") },
  async ({ param }) => {
    // Implementation
    return {
      content: [{ type: "text", text: "Result" }]
    };
  }
);

await server.connect(new StdioServerTransport());
```

### Reusing TradeBlocks Calculations
```typescript
// Source: Pattern based on lib/calculations/portfolio-stats.ts
import { PortfolioStatsCalculator } from "@lib/calculations/portfolio-stats";
import { Trade } from "@lib/models/trade";

const calculator = new PortfolioStatsCalculator({
  riskFreeRate: 2.0,
  annualizationFactor: 252
});

// In tool handler:
const stats = calculator.calculatePortfolioStats(trades, dailyLogs, isStrategyFiltered);
```

### Complex Input Schema with Zod
```typescript
// Source: MCP best practices + Zod docs
const GetStatsSchema = z.object({
  blockId: z.string().describe("Block folder name"),
  strategy: z.string().optional().describe("Filter by strategy"),
  startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
  endDate: z.string().optional().describe("End date (YYYY-MM-DD)")
}).refine(
  data => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  { message: "startDate must be before endDate" }
);

server.tool("get_statistics", "Get filtered statistics", GetStatsSchema, async (args) => {
  // Implementation with validated args
});
```

### Loading Block Data from Folder Structure
```typescript
// Pattern for folder-based blocks from Phase 11 decisions
import * as fs from "fs/promises";
import * as path from "path";
import { TradeProcessor } from "@lib/processing/trade-processor";

async function loadBlock(baseDir: string, blockId: string) {
  const blockPath = path.join(baseDir, blockId);

  // Load tradelog.csv (required)
  const tradelogPath = path.join(blockPath, "tradelog.csv");
  const tradeContent = await fs.readFile(tradelogPath, "utf-8");
  const processor = new TradeProcessor();
  const result = await processor.processContent(tradeContent);

  // Load dailylog.csv (optional)
  let dailyLogs = undefined;
  const dailylogPath = path.join(blockPath, "dailylog.csv");
  try {
    const dailyContent = await fs.readFile(dailylogPath, "utf-8");
    dailyLogs = await parseDailyLog(dailyContent);
  } catch {
    // No daily log - that's fine
  }

  return { trades: result.trades, dailyLogs };
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE transport | Streamable HTTP | 2025 | SSE deprecated, use Streamable HTTP for remote |
| Server class | McpServer class | 2025 | Server deprecated, McpServer is the new API |
| zod@3 | zod@4 (or 3.25+) | 2025 | SDK imports from zod/v4, backwards compat with 3.25+ |
| registerTool | server.tool | 2025 | Cleaner API, same functionality |

**New tools/patterns to consider:**
- **Progressive Discovery:** For systems with many tools, guide models through discovery stages
- **Code Mode (Cloudflare):** Agents write executable code instead of tool calls - not applicable here
- **Workflow-Based Design:** Single tools that handle complete goals - adopt this pattern

**Deprecated/outdated:**
- **SSE transport:** Use Streamable HTTP for remote, stdio for local
- **Server class:** Use McpServer instead
- **Granular API-style tools:** Don't mirror REST endpoints 1:1
</sota_updates>

<tool_design>
## Proposed Tool Design for Phase 12

Based on comprehensive feature inventory (full API surface, read-only, cross-block intelligence):

### Tier 1: Core Tools (Always Available)
These tools cover the fundamental operations:

| # | Tool | Description | Maps to Feature |
|---|------|-------------|-----------------|
| 1 | **list_backtests** | List all available backtest blocks with summary stats | Block Management |
| 2 | **get_block_info** | Get detailed info for a specific block (trade count, date range, strategies) | Block Management |
| 3 | **get_statistics** | Full portfolio stats with optional strategy/date filter | Block Statistics |
| 4 | **get_strategy_comparison** | Compare all strategies within a block | Block Statistics |
| 5 | **compare_blocks** | Compare stats across multiple blocks | Cross-block intelligence |
| 6 | **get_trades** | Get trades with filtering (strategy, date, paginated) | Data queries |

### Tier 2: Analysis Tools (Advanced)
These expose the advanced analysis features:

| # | Tool | Description | Maps to Feature |
|---|------|-------------|-----------------|
| 7 | **run_walk_forward** | Execute WFA with configurable periods and optimization target | Walk-Forward Analysis |
| 8 | **run_monte_carlo** | Monte Carlo simulation with worst-case scenarios | Risk Simulator |
| 9 | **get_correlation_matrix** | Strategy correlation (Kendall/Spearman/Pearson) | Correlation Matrix |
| 10 | **get_tail_risk** | Gaussian copula tail dependence analysis | Tail Risk Analysis |
| 11 | **get_position_sizing** | Kelly criterion-based capital allocation | Position Sizing |

### Tier 3: Performance & Reporting Tools

| # | Tool | Description | Maps to Feature |
|---|------|-------------|-----------------|
| 12 | **get_performance_charts** | Get data for equity curve, drawdown, returns distribution | Performance Analysis |
| 13 | **get_period_returns** | Monthly/weekly P&L breakdown | Performance Analysis |
| 14 | **compare_backtest_to_actual** | Compare backtest vs actual trades with scaling | Trading Calendar |

### Tool Count Analysis

**Total: 14 tools** - Slightly above the 12-tool guideline, but justified because:
- Each tool maps to a distinct UI feature users already understand
- Tools are grouped into clear tiers (core vs advanced)
- No overlap or redundancy between tools
- Alternative: Could merge correlation + tail risk into "get_risk_metrics" to reduce count

### Feature Coverage Matrix

| UI Feature | Covered By | Notes |
|------------|------------|-------|
| Block Management | list_backtests, get_block_info | Read-only, no CRUD |
| Block Statistics | get_statistics, get_strategy_comparison | Full stats coverage |
| Performance Analysis | get_performance_charts, get_period_returns | Chart data, not images |
| Walk-Forward Analysis | run_walk_forward | Full WFA execution |
| Trading Calendar | compare_backtest_to_actual | Requires reportinglog.csv |
| Position Sizing | get_position_sizing | Kelly calculations |
| Risk Simulator | run_monte_carlo | Full Monte Carlo |
| Tail Risk Analysis | get_tail_risk | Copula analysis |
| Correlation Matrix | get_correlation_matrix | All three methods |
| Static Datasets | (deferred to Phase 13) | External data integration |
| Report Builder | (deferred to Phase 13) | Custom chart building |
| AI Assistant | (not needed) | MCP IS the AI interface |

### Deferred to Phase 13

These features require more complex implementation or UI state that doesn't translate well to MCP:

1. **Static Datasets** - Uploading and matching external CSV data
2. **Report Builder** - Custom chart/filter configuration (too stateful)
3. **Chart image generation** - Return data instead, let Claude visualize

### Input Parameter Standards

All tools accepting filters should use consistent parameters:

```typescript
// Common filter parameters
interface CommonFilters {
  blockId: string;                    // Required for all block-specific tools
  strategy?: string | string[];       // Optional strategy filter (single or multi)
  startDate?: string;                 // YYYY-MM-DD, Eastern time
  endDate?: string;                   // YYYY-MM-DD, Eastern time
  normalize?: 'raw' | 'margin' | '1lot'; // Return normalization
}
```

### Output Format Standards

All tools should return structured text that Claude can parse:

```typescript
// Structured output for statistics
{
  content: [{
    type: "text",
    text: `## Block: ${blockId}\n\n### Portfolio Statistics\n| Metric | Value |\n|--------|-------|\n| Total P/L | $${stats.totalPl} |\n...`
  }]
}
```
</tool_design>

<feature_inventory>
## Complete TradeBlocks Feature Inventory

Comprehensive inventory of all TradeBlocks functionality discovered during codebase exploration:

### App Routes & Features

| Route | Feature | Key Calculations | MCP Coverage |
|-------|---------|------------------|--------------|
| `/blocks` | Block Management | N/A | `list_backtests`, `get_block_info` |
| `/block-stats` | Portfolio Statistics | `PortfolioStatsCalculator` | `get_statistics`, `get_strategy_comparison` |
| `/performance-blocks` | Performance Charts | `buildPerformanceSnapshot` | `get_performance_charts`, `get_period_returns` |
| `/walk-forward` | Walk-Forward Analysis | `WalkForwardOptimizer`, `getWalkForwardVerdict` | `run_walk_forward` |
| `/trading-calendar` | Backtest vs Actual | `scaleStrategyComparison` | `compare_backtest_to_actual` |
| `/position-sizing` | Kelly Sizing | `calculateKellyFraction` | `get_position_sizing` |
| `/risk-simulator` | Monte Carlo | `runMonteCarloSimulation` | `run_monte_carlo` |
| `/tail-risk-analysis` | Tail Dependence | `calculateTailDependence` | `get_tail_risk` |
| `/correlation-matrix` | Strategy Correlation | `calculateCorrelationMatrix` | `get_correlation_matrix` |
| `/static-datasets` | External Data | `matchDatasetToTrades` | Phase 13 |
| `/assistant` | GPT Export | Export helpers | N/A (MCP replaces this) |

### Calculation Modules (lib/calculations/)

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| `portfolio-stats.ts` | Core statistics | `calculatePortfolioStats`, `calculateStrategyStats` |
| `monte-carlo.ts` | Risk simulation | `runMonteCarloSimulation` (with worst-case testing) |
| `kelly.ts` | Position sizing | `calculateKellyFraction`, portfolio Kelly |
| `tail-risk.ts` | Tail dependence | `calculateTailDependence` (Gaussian copula) |
| `correlation.ts` | Strategy correlation | `calculateCorrelationMatrix` (Kendall/Spearman/Pearson) |
| `walk-forward-optimizer.ts` | WFA execution | Parameter optimization across periods |
| `walk-forward-verdict.ts` | WFA interpretation | Robustness assessment and recommendations |
| `margin-timeline.ts` | Margin analysis | Margin utilization over time |
| `flexible-filter.ts` | Trade filtering | Custom criteria filtering |

### Data Models (lib/models/)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Trade` | Individual trade | dateOpened, strategy, pl, legs, commissions |
| `DailyLogEntry` | Daily portfolio value | date, netLiquidity, dailyPl, drawdownPct |
| `ReportingTrade` | Actual/live trades | Similar to Trade, for calendar comparison |
| `PortfolioStats` | Calculated statistics | sharpeRatio, sortinoRatio, maxDrawdown, kelly, etc. |
| `StrategyStats` | Per-strategy stats | strategyName, tradeCount, totalPl, winRate |
| `WalkForwardAnalysis` | WFA results | periods, robustnessMetrics, verdict |

### Performance Chart Types (from performance-blocks)

| Chart | Data Source | MCP Return Format |
|-------|-------------|-------------------|
| Equity Curve | Trade sequence | Array of {date, cumPl, cumPct} |
| Drawdown | Equity curve | Array of {date, drawdownPct, duration} |
| Monthly Returns | Grouped trades | Matrix of year x month values |
| Return Distribution | Trade P/L | Histogram buckets with counts |
| Day of Week | Grouped trades | Array of {day, avgPl, tradeCount} |
| Win/Loss Streaks | Trade sequence | Array of {start, end, count, type} |
| VIX Regime | Trades with VIX | Array of {regime, avgPl, tradeCount} |
| ROM Timeline | Trades with margin | Array of {date, rom, margin} |
| Margin Utilization | Trade margins | Array of {date, utilization, peak} |
| Rolling Metrics | Windowed calcs | Array of {date, sharpe, sortino, ...} |

### Optimization Targets (WFA)

| Target | Description | Calculation |
|--------|-------------|-------------|
| Net Profit | Total P/L | Sum of trade P/L |
| Sharpe Ratio | Risk-adjusted return | Mean / StdDev (annualized) |
| Sortino Ratio | Downside risk | Mean / DownsideStdDev |
| Calmar Ratio | Drawdown-adjusted | CAGR / MaxDrawdown |
| Win Rate | Consistency | Winners / Total |
| CAGR | Compound growth | Annualized geometric return |
| Correlation | Diversification | IS/OOS correlation |
| Tail Risk | Extreme events | Tail dependence measure |
| Effective Factors | Robustness | Multi-factor score |

### Common Filter Parameters

These parameters appear across multiple features and should be standardized in MCP tools:

| Parameter | Type | Used In |
|-----------|------|---------|
| blockId | string | All tools |
| strategy | string[] | Statistics, charts, WFA |
| startDate | YYYY-MM-DD | Date filtering |
| endDate | YYYY-MM-DD | Date filtering |
| normalize | 'raw'/'margin'/'1lot' | Charts, stats |
| dateBasis | 'opened'/'closed' | Grouping |
| riskFreeRate | number (%) | Sharpe, Sortino |

### Key Architectural Constraints

1. **Daily logs = full portfolio** - Cannot use for strategy-filtered stats
2. **Timezone = US Eastern** - All dates parsed/displayed in America/New_York
3. **Commission separation** - Gross P/L and commissions tracked separately
4. **Leg combining** - Optional grouping of multi-leg trades by timestamp
5. **Caching** - Performance snapshots and combined trades are cached

</feature_inventory>

<open_questions>
## Open Questions

1. **Pagination strategy for large result sets**
   - What we know: Trades can number in thousands, must not return all raw
   - What's unclear: Exact pagination params (page size, offset vs cursor)
   - Recommendation: Start with offset/limit, 100 trades per page default

2. **Cross-block comparison scope**
   - What we know: User wants to compare blocks
   - What's unclear: How many blocks can be compared at once without overwhelming context
   - Recommendation: Limit to 5 blocks per comparison, return summary table not full stats

3. **Date filtering format**
   - What we know: Dates are Eastern time internally
   - What's unclear: What format should MCP tools accept (ISO string, YYYY-MM-DD)?
   - Recommendation: Accept YYYY-MM-DD strings, parse as Eastern time
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK docs
- [Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server) - Official patterns
- TradeBlocks lib/calculations/portfolio-stats.ts - Existing calculation logic
- TradeBlocks lib/db/ stores - Existing data access patterns

### Secondary (MEDIUM confidence)
- [Less is More Design Patterns](https://www.klavis.ai/blog/less-is-more-mcp-design-patterns-for-ai-agents) - Tool design patterns
- [NearForm MCP Tips](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) - Pitfalls and best practices

### Tertiary (LOW confidence - needs validation)
- None - all findings verified with primary sources
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: MCP SDK, TypeScript, Zod
- Ecosystem: @modelcontextprotocol/sdk, existing TradeBlocks lib/
- Patterns: Workflow-based tools, progressive discovery, error in results
- Pitfalls: stdio logging, tool count, timezone handling

**Confidence breakdown:**
- Standard stack: HIGH - official SDK, already in use
- Architecture: HIGH - verified patterns from official docs + existing codebase
- Pitfalls: HIGH - documented in multiple sources, some from direct experience
- Code examples: HIGH - from SDK docs and existing TradeBlocks code

**Research date:** 2026-01-14
**Valid until:** 2026-02-14 (30 days - MCP ecosystem relatively stable)
</metadata>

---

*Phase: 12-core-integration-layer*
*Research completed: 2026-01-14*
*Ready for planning: yes*
