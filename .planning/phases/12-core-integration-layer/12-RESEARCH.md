# Phase 12: Core Integration Layer - Research

**Researched:** 2026-01-14
**Domain:** MCP Server Development with TypeScript for financial data queries
**Confidence:** HIGH

<research_summary>
## Summary

Researched MCP server development patterns for building the TradeBlocks integration layer. The standard approach uses the official `@modelcontextprotocol/sdk` with McpServer API, Zod for schema validation, and stdio transport for local CLI integration.

Key finding: MCP tool design follows a "Less is More" principle - expose workflow-based tools that handle complete user goals rather than granular API functions. For TradeBlocks, this means tools like `get_block_statistics` (complete stats for a block) rather than separate tools for each metric.

The existing TradeBlocks codebase already has well-structured data access patterns in `lib/db/` and calculation logic in `lib/calculations/` - the MCP server can reuse these directly via the shared @lib/* path alias established in Phase 11.

**Primary recommendation:** Build ~8-12 focused MCP tools that expose block queries, trade filtering, statistics calculation, and cross-block comparison. Reuse existing `PortfolioStatsCalculator` and db store functions. Keep tool descriptions clear and tool count minimal to avoid model confusion.
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
| Statistics calculation | Custom formulas | `PortfolioStatsCalculator` from lib/calculations | Already handles edge cases, matches Python implementation |
| CSV parsing | Manual parsing | `TradeProcessor` from lib/processing | Handles column mapping, validation, errors |
| Date handling | Direct Date objects | Existing date utils | Eastern timezone handling is tricky |
| Filtering trades | Custom filter logic | Existing store functions | `getTradesByStrategy`, `getTradesByDateRange` exist |
| Zod schemas | JSON Schema | Zod | SDK requires Zod, better TypeScript integration |

**Key insight:** TradeBlocks lib/ already has production-tested implementations for every calculation and data operation needed. The MCP server is primarily a thin adapter layer that exposes existing functionality via MCP protocol.
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

Based on user requirements (full API surface, read-only, cross-block intelligence, filtering, stats):

### Discovery Tools
1. **list_backtests** - List all available backtest blocks with summary stats
2. **get_block_info** - Get detailed info for a specific block

### Query Tools
3. **get_trades** - Get trades with optional filtering (strategy, date range, paginated)
4. **get_strategies** - List unique strategies in a block
5. **get_daily_log** - Get daily portfolio values (if available)

### Statistics Tools
6. **get_statistics** - Calculate full portfolio stats with optional strategy filter
7. **get_strategy_comparison** - Compare all strategies within a block
8. **compare_blocks** - Compare stats across multiple blocks

### Analysis Tools
9. **get_performance_summary** - Summary metrics formatted for reporting
10. **analyze_drawdowns** - Detailed drawdown analysis
11. **get_period_returns** - Monthly/weekly P&L breakdown

### Export Tools
12. **export_analysis** - Generate summary report in text format

**Total: 12 tools** - at the upper limit but each serves a distinct workflow purpose.
</tool_design>

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
