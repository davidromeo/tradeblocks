# Phase 11: Research & Architecture - Research

**Researched:** 2026-01-14 (Updated)
**Domain:** Claude Code/Cowork integration for options trade analysis
**Confidence:** HIGH

<research_summary>
## Summary

Researched architecture options for enabling Claude Code/Cowork to analyze options trading data. Two distinct approaches emerged based on different use cases:

### Approach A: Standalone MCP Server (RECOMMENDED for new users)

**"Drop CSVs in a folder and let Claude analyze them"**

A standalone npm package that:
- Reads CSV files directly from a designated folder
- Uses stdio transport (simple, fast, local)
- Exposes TradeBlocks calculation logic as MCP tools
- Works with Claude Desktop, Claude Code, and Claude Cowork out of the box
- Published to npm for easy `npx` installation

This is ideal for users who want Claude to analyze backtest results without running the full TradeBlocks web app.

### Approach B: Browser Integration (for existing TradeBlocks users)

For users already using TradeBlocks web app with IndexedDB data, use Chrome DevTools MCP + Claude Skills to query the running application.

**Primary recommendation:** Build a **standalone MCP server** (`@tradeblocks/mcp-server` or `tradeblocks-analyzer`) that extracts the calculation logic from TradeBlocks into a dedicated npm package. This provides the cleanest user experience and broadest compatibility.

</research_summary>

<standard_stack>
## Standard Stack

### Approach A: Standalone MCP Server (Recommended)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | 1.25.2+ | MCP server implementation | Official TypeScript SDK |
| `zod` | 3.25+ | Schema validation | Required peer dependency for SDK |
| `csv-parse` | 5.x | CSV parsing | Same library TradeBlocks uses |
| `mathjs` | 12.x | Statistical calculations | Same library TradeBlocks uses |

**Extracted from TradeBlocks:**

| Module | Purpose | Notes |
|--------|---------|-------|
| `lib/processing/csv-parser.ts` | Parse trade log CSVs | Extract and adapt |
| `lib/processing/trade-processor.ts` | Process raw trades | Extract and adapt |
| `lib/calculations/portfolio-stats.ts` | Core statistics | Extract as-is |
| `lib/calculations/enrich-trades.ts` | Derived metrics | Extract as-is |
| `lib/models/*.ts` | Type definitions | Extract as-is |

### Approach B: Browser Integration

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome DevTools MCP | latest | Browser automation | Already in Claude Code |
| Claude Skills | - | Workflow definition | Native Claude feature |

### Package Structure for Standalone MCP

```
tradeblocks-mcp/
├── src/
│   ├── index.ts              # MCP server entry (shebang + stdio)
│   ├── server.ts             # Server setup and tool registration
│   ├── tools/
│   │   ├── list-trades.ts    # List CSV files in folder
│   │   ├── analyze-file.ts   # Analyze single CSV
│   │   ├── portfolio-stats.ts # Get portfolio statistics
│   │   ├── strategy-stats.ts  # Strategy breakdown
│   │   └── compare-files.ts   # Compare multiple backtests
│   ├── processing/
│   │   ├── csv-parser.ts     # From TradeBlocks
│   │   └── trade-processor.ts # From TradeBlocks
│   ├── calculations/
│   │   ├── portfolio-stats.ts # From TradeBlocks
│   │   └── enrich-trades.ts   # From TradeBlocks
│   └── models/
│       └── trade.ts          # From TradeBlocks
├── package.json
├── tsconfig.json
└── README.md
```

**Installation for users:**
```bash
# One-time setup in Claude Desktop config
npx tradeblocks-mcp /path/to/backtests/folder
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended: Standalone stdio MCP Server

```
┌──────────────────┐     ┌────────────────────┐     ┌─────────────────┐
│  Claude Desktop  │────▶│  tradeblocks-mcp   │────▶│   CSV Files     │
│  / Cowork / Code │     │  (stdio server)    │     │   (local fs)    │
└──────────────────┘     └────────────────────┘     └─────────────────┘
         │                        │
    JSON-RPC 2.0              Read files
    via stdin/stdout          Parse & analyze
```

**User workflow:**
1. Drop backtest CSV files in a folder (e.g., `~/backtests/`)
2. Configure Claude Desktop with the MCP server
3. Ask Claude: "Analyze the trades in my backtests folder"
4. Claude uses MCP tools to list, read, and analyze files

### Pattern 1: stdio Server Entry Point

**What:** Node.js script with shebang that runs via npx
**Example:**
```typescript
#!/usr/bin/env node
// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./server.js";

const server = new Server(
  { name: "tradeblocks-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Get allowed directory from command line args
const allowedDir = process.argv[2];
if (!allowedDir) {
  console.error("Usage: tradeblocks-mcp <path-to-backtests-folder>");
  process.exit(1);
}

registerTools(server, allowedDir);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`TradeBlocks MCP running, watching: ${allowedDir}`);
```

### Pattern 2: Tool Registration

**What:** Register MCP tools that expose analysis capabilities
**Example:**
```typescript
// src/server.ts
import { z } from "zod";
import { PortfolioStatsCalculator } from "./calculations/portfolio-stats.js";
import { parseTradeCsv } from "./processing/csv-parser.js";
import { processTrades } from "./processing/trade-processor.js";

export function registerTools(server: Server, allowedDir: string) {

  // Tool: List available CSV files
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: "list_backtests",
        description: "List all CSV files in the backtests folder",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "analyze_backtest",
        description: "Analyze a backtest CSV file and return portfolio statistics",
        inputSchema: {
          type: "object",
          properties: {
            filename: { type: "string", description: "CSV filename to analyze" }
          },
          required: ["filename"]
        }
      },
      {
        name: "compare_backtests",
        description: "Compare statistics across multiple backtest files",
        inputSchema: {
          type: "object",
          properties: {
            filenames: {
              type: "array",
              items: { type: "string" },
              description: "List of CSV filenames to compare"
            }
          },
          required: ["filenames"]
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "list_backtests": {
        const files = await fs.readdir(allowedDir);
        const csvFiles = files.filter(f => f.endsWith('.csv'));
        return { content: [{ type: "text", text: JSON.stringify(csvFiles, null, 2) }] };
      }

      case "analyze_backtest": {
        const { filename } = args as { filename: string };
        const filePath = path.join(allowedDir, filename);

        // Security: ensure path is within allowed directory
        if (!filePath.startsWith(allowedDir)) {
          throw new Error("Access denied: file outside allowed directory");
        }

        const csvContent = await fs.readFile(filePath, 'utf-8');
        const rawTrades = parseTradeCsv(csvContent);
        const trades = processTrades(rawTrades);
        const stats = PortfolioStatsCalculator.calculatePortfolioStats(trades);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              filename,
              tradeCount: trades.length,
              stats
            }, null, 2)
          }]
        };
      }

      case "compare_backtests": {
        // Compare multiple files...
      }
    }
  });
}
```

### Pattern 3: Claude Desktop Configuration

**What:** User configures their Claude Desktop to use the MCP server
**Example:**
```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "tradeblocks": {
      "command": "npx",
      "args": [
        "-y",
        "tradeblocks-mcp",
        "/Users/username/backtests"
      ]
    }
  }
}
```

### Pattern 4: package.json for npm Publishing

**What:** Configure package for npx execution
**Example:**
```json
{
  "name": "tradeblocks-mcp",
  "version": "1.0.0",
  "description": "MCP server for options trade analysis",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "tradeblocks-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc && chmod +x dist/index.js",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.2",
    "zod": "^3.25.0",
    "csv-parse": "^5.5.0",
    "mathjs": "^12.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

### Anti-Patterns to Avoid

- **HTTP transport for local tool**: Use stdio - it's simpler, faster, no network stack
- **Requiring browser/UI**: Standalone server reads files directly, no browser needed
- **Bundling with TradeBlocks web app**: Keep MCP server as separate package
- **Complex authentication**: Local file access needs no OAuth
- **Returning raw trades**: Return statistics/aggregations, not thousands of trades
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol handling | Custom JSON-RPC | `@modelcontextprotocol/sdk` | Official SDK handles all complexity |
| Transport layer | Custom stdio wrapper | `StdioServerTransport` | SDK provides robust implementation |
| CSV parsing | Regex/manual parsing | `csv-parse` | Battle-tested, handles edge cases |
| Statistical calculations | New formulas | Extract from `lib/calculations/` | 9,400+ lines already tested |
| Input validation | Manual checks | `zod` | Required by SDK, integrates naturally |
| File path security | Manual string checks | Path validation patterns | Prevent directory traversal |

**Key insight:** The calculation logic already exists in TradeBlocks. Extract `lib/calculations/`, `lib/processing/`, and `lib/models/` into the standalone package. Don't rewrite - copy and adapt.

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Missing Shebang

**What goes wrong:** npx can't execute the script
**Why it happens:** Entry point missing `#!/usr/bin/env node`
**How to avoid:** Add shebang as first line of src/index.ts, ensure build preserves it
**Warning signs:** "Permission denied" or "not found" when running via npx

### Pitfall 2: Logging to stdout

**What goes wrong:** Log messages corrupt JSON-RPC communication
**Why it happens:** MCP uses stdout for protocol messages
**How to avoid:** Use `console.error()` for all logging, never `console.log()`
**Warning signs:** "Invalid JSON" errors, connection failures

### Pitfall 3: Path Traversal

**What goes wrong:** User can read files outside allowed directory
**Why it happens:** Not validating resolved paths
**How to avoid:** Always check `resolvedPath.startsWith(allowedDir)` after `path.resolve()`
**Warning signs:** Security vulnerability, unexpected file access

### Pitfall 4: Synchronous File Operations

**What goes wrong:** Server blocks on large files
**Why it happens:** Using `fs.readFileSync()` instead of async
**How to avoid:** Use `fs.promises` or async callbacks
**Warning signs:** Slow responses, timeout errors

### Pitfall 5: ES Module Issues

**What goes wrong:** Import errors at runtime
**Why it happens:** Mixed CommonJS/ESM, wrong tsconfig settings
**How to avoid:** Use `"type": "module"` in package.json, `"module": "Node16"` in tsconfig
**Warning signs:** "Cannot use import statement" errors

### Pitfall 6: Large Response Payloads

**What goes wrong:** Claude truncates or fails to process response
**Why it happens:** Returning thousands of trades as raw data
**How to avoid:** Return aggregated statistics; offer pagination for raw data
**Warning signs:** Incomplete responses, context window issues

</common_pitfalls>

<code_examples>
## Code Examples

### Complete MCP Server Entry Point

```typescript
#!/usr/bin/env node
// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { PortfolioStatsCalculator } from "./calculations/portfolio-stats.js";
import { parseTradeCsv } from "./processing/csv-parser.js";

// Get backtest folder from command line
const backtestDir = process.argv[2];
if (!backtestDir) {
  console.error("Usage: tradeblocks-mcp <backtests-folder>");
  console.error("Example: tradeblocks-mcp ~/backtests");
  process.exit(1);
}

const resolvedDir = path.resolve(backtestDir);

// Create server
const server = new Server(
  { name: "tradeblocks-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_backtests",
      description: "List all CSV files available for analysis",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "get_portfolio_stats",
      description: "Calculate portfolio statistics for a backtest file",
      inputSchema: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "Name of the CSV file to analyze"
          }
        },
        required: ["filename"]
      }
    },
    {
      name: "get_strategy_breakdown",
      description: "Get statistics broken down by strategy",
      inputSchema: {
        type: "object",
        properties: {
          filename: { type: "string" }
        },
        required: ["filename"]
      }
    },
    {
      name: "compare_backtests",
      description: "Compare key metrics across multiple backtest files",
      inputSchema: {
        type: "object",
        properties: {
          filenames: {
            type: "array",
            items: { type: "string" },
            description: "List of CSV filenames to compare"
          }
        },
        required: ["filenames"]
      }
    }
  ]
}));

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_backtests": {
        const files = await fs.readdir(resolvedDir);
        const csvFiles = files.filter(f => f.toLowerCase().endsWith('.csv'));
        return {
          content: [{
            type: "text",
            text: `Found ${csvFiles.length} backtest file(s):\n${csvFiles.join('\n')}`
          }]
        };
      }

      case "get_portfolio_stats": {
        const { filename } = args as { filename: string };
        const filePath = path.join(resolvedDir, filename);

        // Security check
        if (!path.resolve(filePath).startsWith(resolvedDir)) {
          throw new Error("Access denied");
        }

        const content = await fs.readFile(filePath, 'utf-8');
        const trades = parseTradeCsv(content);
        const stats = PortfolioStatsCalculator.calculatePortfolioStats(trades);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              file: filename,
              totalTrades: stats.totalTrades,
              totalPl: stats.totalPl,
              winRate: stats.winRate,
              profitFactor: stats.profitFactor,
              sharpeRatio: stats.sharpeRatio,
              sortinoRatio: stats.sortinoRatio,
              maxDrawdown: stats.maxDrawdown,
              avgWin: stats.avgWin,
              avgLoss: stats.avgLoss
            }, null, 2)
          }]
        };
      }

      // ... other tool handlers
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`TradeBlocks MCP ready. Watching: ${resolvedDir}`);
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

### User Installation & Configuration

```bash
# Step 1: Create backtests folder
mkdir ~/backtests

# Step 2: Drop CSV files in folder
cp my-strategy-backtest.csv ~/backtests/

# Step 3: Configure Claude Desktop
# Edit ~/Library/Application Support/Claude/claude_desktop_config.json:
```

```json
{
  "mcpServers": {
    "tradeblocks": {
      "command": "npx",
      "args": ["-y", "tradeblocks-mcp", "/Users/yourusername/backtests"]
    }
  }
}
```

```bash
# Step 4: Restart Claude Desktop

# Step 5: Ask Claude
# "What backtests are available?"
# "Analyze the performance of my-strategy-backtest.csv"
# "Compare all my backtests and tell me which performed best"
```

</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom CLI tools | MCP servers | 2024-2025 | Standardized AI tool integration |
| HTTP-based APIs | stdio for local tools | 2025 | Simpler, faster local execution |
| SSE transport | Streamable HTTP (remote) | March 2025 | SSE deprecated for remote servers |
| Manual tool discovery | MCP tool listing | 2024-2025 | AI auto-discovers capabilities |
| SDK v1 | SDK v2 (pre-alpha) | 2025 | v2 stable Q1 2026, use v1.x for production |

**New developments:**

- **Claude Cowork** (Jan 2026): Anthropic's agent that works with local files via MCP, perfect fit for this use case
- **npx-based MCP distribution**: Standard pattern for distributing local MCP servers
- **Desktop Extensions**: Single-click MCP installation coming, but npx still recommended for custom tools

**Best practices:**

- Use **stdio transport** for local tools (no network overhead)
- Publish to **npm** for easy `npx` installation
- Keep responses **aggregated** (stats, not raw data)
- Log to **stderr** only (stdout reserved for protocol)

</sota_updates>

<open_questions>
## Open Questions

1. **Package naming**
   - Options: `tradeblocks-mcp`, `@tradeblocks/mcp-server`, `backtest-analyzer-mcp`
   - Recommendation: Simple name like `tradeblocks-mcp` for easy npx usage

2. **Scope of extraction**
   - What we know: Need csv-parser, trade-processor, portfolio-stats at minimum
   - What's unclear: Whether to include daily log processing, walk-forward analysis
   - Recommendation: Start minimal (portfolio stats), add features based on demand

3. **CSV format flexibility**
   - What we know: TradeBlocks expects specific column names
   - What's unclear: Whether to support other broker export formats
   - Recommendation: Start with TradeBlocks format, document expected columns

4. **Daily log support**
   - What we know: Daily logs enhance drawdown calculations
   - What's unclear: Whether standalone use case needs this complexity
   - Recommendation: Make daily logs optional, core stats work with trade log only

5. **Monorepo vs separate repo**
   - Options: Add to TradeBlocks repo as workspace package, or new repo
   - Recommendation: New repo for clean separation and independent releases

</open_questions>

<alternative_browser_approach>
## Alternative: Browser Integration (for existing TradeBlocks users)

For users already using the TradeBlocks web app, an alternative approach uses Chrome DevTools MCP to query the running application.

**When to use:** When user has data in TradeBlocks IndexedDB and wants to query it without export.

**Architecture:**
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│  Chrome DevTools │────▶│  TradeBlocks    │
│   + Skill       │     │  MCP             │     │  (Browser)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Skill example:**
```markdown
# .claude/skills/tradeblocks/SKILL.md
---
name: tradeblocks-browser
description: Query TradeBlocks application running in browser
---

## Prerequisites
- TradeBlocks running at http://localhost:3000
- Chrome DevTools MCP available

## Workflow
1. Use Chrome DevTools MCP to navigate to TradeBlocks
2. Execute JavaScript to query Zustand stores
3. Return formatted statistics
```

**Tradeoffs:**
- ✅ Queries existing IndexedDB data
- ✅ No file management needed
- ❌ Requires browser open with TradeBlocks loaded
- ❌ More complex setup
- ❌ Less portable (tied to specific machine's IndexedDB)

**Recommendation:** Use standalone MCP server for new users; browser integration for power users already invested in TradeBlocks web app.

</alternative_browser_approach>

<sources>
## Sources

### Primary (HIGH confidence)

- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) - Protocol architecture
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK
- [Connect Local MCP Servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) - Configuration guide
- [Building MCP Server in Node.js](https://oneuptime.com/blog/post/2025-12-17-build-mcp-server-nodejs/view) - Complete tutorial
- [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) - Reference implementation

### Secondary (MEDIUM confidence)

- [Claude Cowork announcement](https://venturebeat.com/technology/anthropic-launches-cowork-a-claude-desktop-agent-that-works-in-your-files-no) - Cowork capabilities
- [Hackteam MCP Tutorial](https://hackteam.io/blog/build-your-first-mcp-server-with-typescript-in-under-10-minutes/) - Quick start guide
- [MCP CLI tools](https://github.com/f/mcptools) - Testing/debugging MCP servers

### Tertiary (TradeBlocks Internal)

- `lib/calculations/portfolio-stats.ts` - Core statistics (extract this)
- `lib/processing/csv-parser.ts` - CSV parsing (extract this)
- `lib/processing/trade-processor.ts` - Trade processing (extract this)
- `lib/models/trade.ts` - Type definitions (extract this)

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: MCP stdio servers, npm publishing, file-based tools
- Ecosystem: @modelcontextprotocol/sdk, Claude Desktop, Claude Cowork
- Patterns: Tool registration, path security, npx distribution
- Extraction: TradeBlocks calculation code → standalone package

**Confidence breakdown:**
- Standard stack: HIGH - Official tools, verified patterns
- Architecture: HIGH - Well-documented MCP server patterns
- Code extraction: HIGH - TradeBlocks code is clean, modular
- Distribution: HIGH - npm/npx is standard MCP distribution method

**Research date:** 2026-01-14
**Valid until:** 2026-02-14 (30 days)

</metadata>

---

*Phase: 11-research-architecture*
*Research completed: 2026-01-14*
*Ready for planning: yes*
