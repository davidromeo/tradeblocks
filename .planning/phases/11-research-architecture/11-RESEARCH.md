# Phase 11: Research & Architecture - Research

**Researched:** 2026-01-14
**Domain:** Claude Code integration with client-side Next.js application (IndexedDB storage)
**Confidence:** HIGH

<research_summary>
## Summary

Researched the architecture options for enabling Claude Code/Cowork to interact with TradeBlocks programmatically. The key challenge is that **TradeBlocks stores all data in IndexedDB (browser-side)**, while traditional MCP servers run on the server-side.

Three viable approaches were identified:

1. **Claude Skill + Chrome DevTools MCP** (Recommended): Create a Claude skill that uses the already-available Chrome DevTools MCP to execute JavaScript in the browser, directly accessing IndexedDB data. Zero server-side code required.

2. **Browser-Embedded MCP via evaluate_script**: Use Chrome DevTools MCP's `evaluate_script` tool to run TradeBlocks API functions directly in the browser context, accessing IndexedDB without transport complexity.

3. **Hybrid MCP Server + Export API**: Build a Next.js API route that serves as an MCP server for exported/synced data, suitable if future server-side persistence is planned.

**Primary recommendation:** Use Claude Skill + Chrome DevTools MCP. This leverages existing infrastructure (Chrome DevTools MCP is already available in Claude Code), requires no backend development, and directly accesses IndexedDB data where it lives.

</research_summary>

<standard_stack>
## Standard Stack

### Core - Claude Integration

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome DevTools MCP | latest | Browser automation + data extraction | Official Google MCP, already in Claude Code |
| Claude Skills | - | Workflow definition + methodology | Native Claude Code feature, zero dependencies |
| `@modelcontextprotocol/sdk` | 1.25.2+ | MCP server (if needed) | Official TypeScript SDK |

### Supporting - MCP Server (if choosing Option 3)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `mcp-handler` | latest | Next.js MCP adapter | If building HTTP-based MCP server |
| `zod` | 3.x | Schema validation | Required for MCP tool definitions |

### TradeBlocks Internal (Already Exists)

| Module | Purpose | Exposes For API |
|--------|---------|-----------------|
| `lib/db/` | IndexedDB CRUD operations | Trades, blocks, daily logs, static datasets |
| `lib/calculations/` | Portfolio statistics | All metrics (Sharpe, Sortino, Calmar, etc.) |
| `lib/stores/` | Zustand state management | Filtered/enriched data access |
| `lib/services/performance-snapshot.ts` | Pre-computed chart data | Full performance snapshots |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chrome DevTools MCP | Custom MCP server | Requires server-side data sync, more complex |
| Skills | Raw MCP tools | Skills add workflow context, better for multi-step analysis |
| evaluate_script | Export-to-file | Loses real-time data access, requires manual export |

**Installation:**
```bash
# For Claude Skill approach - no installation needed, Chrome DevTools MCP already available

# For MCP server approach (if chosen):
npm install mcp-handler @modelcontextprotocol/sdk zod
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Architecture: Skill + Browser Automation

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│  TradeBlocks     │────▶│    IndexedDB    │
│   + Skill       │     │  Skill           │     │    (Browser)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ Chrome DevTools │────▶│  evaluate_script │
│      MCP        │     │  (JS in browser) │
└─────────────────┘     └──────────────────┘
```

**Flow:**
1. User invokes skill (e.g., `/tradeblocks analyze`)
2. Skill guides Claude to use Chrome DevTools MCP
3. Chrome DevTools MCP executes JavaScript in TradeBlocks browser tab
4. JavaScript accesses IndexedDB via existing `lib/db/` functions
5. Results returned to Claude for analysis

### Pattern 1: Browser API Execution via Skill

**What:** Claude skill defines workflows that execute TradeBlocks functions in the browser via evaluate_script
**When to use:** All data queries and calculations
**Example:**
```markdown
# SKILL.md
---
name: tradeblocks
description: Analyze options trading performance from TradeBlocks application
---

## Workflow: Get Portfolio Statistics

1. Ensure TradeBlocks is open in browser with desired block selected
2. Use Chrome DevTools MCP to execute:
   ```javascript
   (async () => {
     const { getBlock } = await import('/lib/db/index.js');
     const { PortfolioStatsCalculator } = await import('/lib/calculations/portfolio-stats.js');
     const block = await getBlock(window.activeBlockId);
     return block?.portfolioStats;
   })()
   ```
3. Return formatted statistics to user
```

### Pattern 2: Data Export Bridge (Alternative)

**What:** Add an export button in TradeBlocks that saves analysis to a file Claude can read
**When to use:** When browser automation is unreliable or for offline analysis
**Example:**
```typescript
// app/(platform)/export-for-claude/route.ts - Not MCP, just export
export async function exportForClaude(blockId: string) {
  const trades = await getTradesByBlock(blockId);
  const stats = await PortfolioStatsCalculator.calculatePortfolioStats(trades);
  return { trades, stats, exportedAt: new Date().toISOString() };
}
```

### Pattern 3: Full MCP Server (Future Option)

**What:** HTTP-based MCP server in Next.js for when data moves server-side
**When to use:** Only if TradeBlocks adds server-side persistence
**Example:**
```typescript
// app/api/[transport]/route.ts
import { createMcpHandler } from "mcp-handler";

const handler = createMcpHandler((server) => {
  server.registerTool("get_portfolio_stats", {
    description: "Get portfolio statistics for a trading block",
    inputSchema: { blockId: z.string() },
  }, async ({ blockId }) => {
    // Would require server-side data access
    const stats = await getPortfolioStats(blockId);
    return { content: [{ type: "text", text: JSON.stringify(stats) }] };
  });
});
```

### Recommended Project Structure for Skills

```
.claude/
├── skills/
│   └── tradeblocks/
│       ├── SKILL.md              # Main skill definition
│       └── references/
│           ├── api-functions.md  # Available TradeBlocks functions
│           ├── data-models.md    # Trade, Block, Stats schemas
│           └── workflows.md      # Common analysis workflows
```

### Anti-Patterns to Avoid

- **Syncing IndexedDB to server**: TradeBlocks data is client-only by design; don't try to replicate it
- **Building custom MCP transport**: Use existing Chrome DevTools MCP, don't reinvent
- **Ignoring browser context**: Claude needs the TradeBlocks tab open; skill should guide this
- **Over-engineering authentication**: Local development needs no OAuth; data is already on user's machine
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom puppeteer scripts | Chrome DevTools MCP | Already integrated in Claude Code, battle-tested |
| Data access protocol | Custom WebSocket bridge | evaluate_script via CDP | Chrome DevTools MCP handles all CDP complexity |
| Workflow templates | Hardcoded prompts | Claude Skills | Skills support progressive disclosure, versioning |
| Multi-step analysis | Prompt engineering | Skill + references/ | Skills organize methodology, reference docs |
| IndexedDB → JSON | Custom serialization | Existing lib/db/ exports | TradeBlocks already has clean data accessors |
| Statistical calculations | New calculation code | lib/calculations/ | 9,400+ lines already written and tested |

**Key insight:** The entire calculation layer (`lib/calculations/`) and data access layer (`lib/db/`) already exist in TradeBlocks. The integration task is exposing these existing functions to Claude, not rebuilding them.

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: IndexedDB Server-Side Access

**What goes wrong:** Attempting to access IndexedDB from Next.js API routes or MCP server
**Why it happens:** IndexedDB is a browser-only API; server-side code has no access
**How to avoid:** Use Chrome DevTools MCP to execute code IN the browser context
**Warning signs:** Errors like "indexedDB is not defined", "window is not defined"

### Pitfall 2: Stale Browser Context

**What goes wrong:** evaluate_script runs but returns undefined/null
**Why it happens:** TradeBlocks tab not open, wrong page active, data not loaded
**How to avoid:** Skill should verify TradeBlocks is loaded before queries
**Warning signs:** Empty results when data should exist

### Pitfall 3: Skill Scope Creep

**What goes wrong:** Skill tries to do everything, becomes unwieldy
**Why it happens:** Putting all workflows in SKILL.md instead of references/
**How to avoid:** Use progressive disclosure - core workflows in SKILL.md, details in references/
**Warning signs:** SKILL.md > 500 lines, context window issues

### Pitfall 4: Async JavaScript in evaluate_script

**What goes wrong:** evaluate_script returns before async operations complete
**Why it happens:** IndexedDB operations are async; must await properly
**How to avoid:** Always use async IIFE: `(async () => { ... })()`
**Warning signs:** Promises returned instead of values, [object Promise]

### Pitfall 5: Large Data Transfer

**What goes wrong:** evaluate_script times out or truncates when returning large datasets
**Why it happens:** Returning thousands of trades as JSON
**How to avoid:** Use aggregation (stats, summaries) instead of raw data; paginate if needed
**Warning signs:** Timeout errors, incomplete JSON

### Pitfall 6: Module Import Errors

**What goes wrong:** ES module imports fail in evaluate_script
**Why it happens:** Browser context may not support dynamic imports in CDP context
**How to avoid:** Access functions via window globals or pre-loaded scripts
**Warning signs:** "Cannot use import statement" errors

</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns for TradeBlocks integration:

### Get Active Block Statistics (via Chrome DevTools MCP)

```javascript
// Execute via evaluate_script tool
(async () => {
  // Access Zustand store directly from window
  const blockStore = window.__ZUSTAND_STORE__?.blockStore;
  if (!blockStore) return { error: "TradeBlocks not loaded" };

  const activeBlockId = blockStore.getState().activeBlockId;
  if (!activeBlockId) return { error: "No block selected" };

  const block = blockStore.getState().blocks.find(b => b.id === activeBlockId);
  return {
    name: block.name,
    stats: block.portfolioStats,
    strategies: block.strategyStats
  };
})()
```

### Get Filtered Performance Data

```javascript
// Execute via evaluate_script tool
(async () => {
  const perfStore = window.__ZUSTAND_STORE__?.performanceStore;
  if (!perfStore) return { error: "Performance store not available" };

  const state = perfStore.getState();
  return {
    portfolioStats: state.data?.portfolioStats,
    equityCurve: state.data?.equityCurve?.slice(-30), // Last 30 points
    dateRange: state.dateRange,
    selectedStrategies: state.selectedStrategies
  };
})()
```

### Skill Workflow Example

```markdown
# .claude/skills/tradeblocks/SKILL.md
---
name: tradeblocks
description: Analyze options trading performance from TradeBlocks application
---

## Prerequisites
- TradeBlocks must be running at http://localhost:3000
- Desired trading block must be selected in the app
- Chrome DevTools MCP must be available

## Available Analyses

### Portfolio Summary
Get overall portfolio statistics including Sharpe ratio, win rate, max drawdown.

### Strategy Comparison
Compare performance across different trading strategies.

### Time-Based Analysis
Analyze performance by day of week, month, or time of day.

## Workflow

1. Verify TradeBlocks is open using Chrome DevTools MCP
2. Execute data queries via evaluate_script
3. Format and present results

## References
See references/api-functions.md for available query functions.
See references/data-models.md for data schemas.
```

### MCP Tool Definition (if using server approach)

```typescript
// Only if building HTTP MCP server
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler((server) => {
  server.registerTool(
    "analyze_trades",
    {
      title: "Analyze Trading Performance",
      description: "Calculate portfolio statistics from exported trade data",
      inputSchema: {
        filePath: z.string().describe("Path to exported trades JSON"),
      },
    },
    async ({ filePath }) => {
      // Read exported file (Claude can read local files)
      // This avoids IndexedDB access issues
      const trades = await readTradesFromFile(filePath);
      const stats = PortfolioStatsCalculator.calculatePortfolioStats(trades);
      return {
        content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      };
    }
  );
});
```

</code_examples>

<sota_updates>
## State of the Art (2025-2026)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE transport for MCP | Streamable HTTP | March 2025 | SSE deprecated, HTTP stream is new standard |
| Build custom browser automation | Chrome DevTools MCP | December 2025 | Google's official MCP for browser control |
| MCP only | MCP + Skills | 2025 | Skills add methodology layer on top of tools |
| Token-based context | Progressive disclosure | 2025 | Skills use references/ for on-demand loading |
| SDK v1 | SDK v2 (pre-alpha) | 2025 | v2 stable Q1 2026, use v1.x for production |

**New tools/patterns to consider:**

- **Chrome DevTools MCP**: Enables `evaluate_script` for running arbitrary JS in browser context. Perfect for IndexedDB access.
- **Skills + MCP combination**: Skills define *how* to use tools; MCP provides *access* to tools. Use both together.
- **Client ID Metadata Documents**: New OAuth pattern for MCP, but not needed for local development.

**Deprecated/outdated:**

- **SSE Transport**: Deprecated in MCP spec 2025-03-26, replaced by Streamable HTTP
- **Dynamic Client Registration**: Still supported but Client ID Metadata Documents preferred
- **Standalone MCP without Skills**: Works but misses methodology/workflow guidance

</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Zustand Store Exposure**
   - What we know: Zustand stores manage state, but may not be accessible via window
   - What's unclear: Whether TradeBlocks exposes stores globally or if we need to add exposure
   - Recommendation: During Phase 12, verify store accessibility and add `window.__ZUSTAND_STORE__` if needed

2. **ES Module Imports in evaluate_script**
   - What we know: Chrome DevTools MCP uses Puppeteer which may have limitations with dynamic imports
   - What's unclear: Whether `import()` works in CDP evaluate context
   - Recommendation: Test during Phase 12; may need to expose functions on window object

3. **Large Dataset Handling**
   - What we know: evaluate_script has output limits; thousands of trades may be too large
   - What's unclear: Exact size limits and whether streaming is supported
   - Recommendation: Design API to return aggregations (stats, summaries) rather than raw trades

4. **Skill Distribution**
   - What we know: Skills can be shared via zip, git repo, or marketplace
   - What's unclear: Whether TradeBlocks skill should be bundled with the app or separate
   - Recommendation: Start with local `.claude/skills/` directory, consider publishing later

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) - Protocol architecture, JSON-RPC format, primitives
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK, server/client creation
- [Vercel mcp-handler](https://github.com/vercel/mcp-handler) - Next.js MCP adapter
- [Chrome DevTools MCP](https://addyosmani.com/blog/devtools-mcp/) - Browser automation, evaluate_script
- [Claude Skills Guide](https://claude.com/blog/building-skills-for-claude-code) - Skill structure, best practices
- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/draft/basic/authorization) - OAuth 2.1 for MCP

### Secondary (MEDIUM confidence)

- [Next.js MCP Guide](https://nextjs.org/docs/app/guides/mcp) - Next.js 16+ MCP integration (verified)
- [freeCodeCamp MCP Tutorial](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/) - TypeScript implementation patterns
- [MCP Transports Comparison](https://docs.roocode.com/features/mcp/server-transports) - STDIO vs HTTP vs SSE

### Tertiary (TradeBlocks Internal - verified via codebase exploration)

- `lib/db/` - IndexedDB implementation, 8 object stores, full CRUD operations
- `lib/calculations/` - ~9,400 lines of calculation logic
- `lib/stores/` - Zustand state management (block-store, performance-store, trading-calendar-store)
- `lib/services/performance-snapshot.ts` - Pre-computed snapshot building

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: MCP protocol, Chrome DevTools MCP, Claude Skills
- Ecosystem: mcp-handler, @modelcontextprotocol/sdk, Zustand stores
- Patterns: Browser automation, skill workflows, data access
- Pitfalls: IndexedDB server access, async handling, module imports

**Confidence breakdown:**
- Standard stack: HIGH - Official tools, verified documentation
- Architecture: HIGH - Based on MCP spec and Chrome DevTools MCP capabilities
- Pitfalls: MEDIUM - Some patterns need verification during implementation
- Code examples: MEDIUM - Patterns verified but TradeBlocks integration untested

**Research date:** 2026-01-14
**Valid until:** 2026-02-14 (30 days - MCP ecosystem evolving but core patterns stable)

</metadata>

---

*Phase: 11-research-architecture*
*Research completed: 2026-01-14*
*Ready for planning: yes*
