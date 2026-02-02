# Phase 44: Schema Discovery - Research

**Researched:** 2026-02-01
**Domain:** DuckDB introspection via MCP tools
**Confidence:** HIGH

## Summary

This phase implements schema discovery tools that allow Claude to understand the DuckDB database structure before writing SQL queries with `run_sql`. The research focused on DuckDB's introspection capabilities and how to expose them effectively through MCP tools.

DuckDB provides multiple introspection mechanisms: `DESCRIBE` statements for table schemas, `duckdb_tables()` and `duckdb_columns()` functions for comprehensive metadata, and `information_schema` views for SQL-standard compatibility. The recommended approach uses the `duckdb_*` functions internally as they provide the richest metadata (including row estimates) while being specifically designed for DuckDB.

The user decisions from CONTEXT.md specify: use DuckDB introspection (not hardcoded schemas), organize tables by schema, include row counts and block_id breakdowns, hardcode descriptions in the tool, and include example queries in the output.

**Primary recommendation:** Create a single `describe_database` tool that returns comprehensive schema information organized by schema namespace, with hardcoded business-context descriptions, row counts via COUNT(*), block breakdowns via GROUP BY, and trading-specific example queries.

## Standard Stack

The schema discovery tools build on existing infrastructure from Phase 41-43:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @duckdb/node-api | 1.4.4-r.1 | DuckDB introspection queries | Already installed, provides DESCRIBE/duckdb_* functions |
| zod | 4.0.0 | Input schema validation | Used across all MCP tools |
| @modelcontextprotocol/sdk | 1.11.0 | MCP server framework | MCP standard implementation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | No additional libraries needed | All introspection via DuckDB SQL |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `duckdb_tables()` + `duckdb_columns()` | `information_schema` views | duckdb_* functions provide richer metadata (estimated_size, internal flag) |
| COUNT(*) for row counts | `duckdb_tables().estimated_size` | COUNT(*) is exact but slower; estimated_size is fast but approximate |
| Single comprehensive tool | Separate list_tables/describe_table tools | Single tool reduces round-trips; Claude gets full context in one call |

**Installation:**
No new packages needed - all dependencies installed in Phase 41.

## Architecture Patterns

### Recommended Project Structure
```
packages/mcp-server/src/
├── tools/
│   └── schema.ts            # describe_database tool implementation
├── db/
│   └── schemas.ts           # Existing - table creation (reference for schema)
└── utils/
    └── schema-metadata.ts   # Hardcoded descriptions and examples (new)
```

### Pattern 1: Single Comprehensive Discovery Tool
**What:** One `describe_database` tool returns all schema information organized by namespace
**When to use:** Always - Claude needs full context to write effective queries
**Rationale:**
- Claude's query planning benefits from seeing all tables/columns at once
- Reduces round-trip latency (one tool call vs multiple)
- Example queries provide immediate context for common patterns
- Row counts and block breakdowns give data volume awareness

**Example output structure:**
```typescript
interface SchemaDiscoveryOutput {
  schemas: {
    trades: {
      description: string;
      tables: {
        trade_data: {
          description: string;
          rowCount: number;
          columns: Array<{
            name: string;
            type: string;
            description: string;
            nullable: boolean;
          }>;
          blockBreakdown: Array<{ blockId: string; rowCount: number }>;
        };
      };
    };
    market: {
      description: string;
      tables: Record<string, TableInfo>;
    };
  };
  examples: {
    basic: Array<{ description: string; sql: string }>;
    joins: Array<{ description: string; sql: string }>;
    hypothesis: Array<{ description: string; sql: string }>;
  };
}
```

### Pattern 2: Introspection Query Composition
**What:** Build introspection queries from DuckDB functions, not information_schema
**When to use:** All schema discovery queries
**Example:**
```typescript
// Get all user tables with row estimates
const tablesQuery = `
  SELECT
    schema_name,
    table_name,
    estimated_size,
    column_count
  FROM duckdb_tables()
  WHERE internal = false
    AND schema_name IN ('trades', 'market')
  ORDER BY schema_name, table_name
`;

// Get columns for a specific table
const columnsQuery = `
  SELECT
    column_name,
    data_type,
    is_nullable
  FROM duckdb_columns()
  WHERE schema_name = $1 AND table_name = $2
  ORDER BY column_index
`;
```

### Pattern 3: Accurate Row Counts via COUNT(*)
**What:** Use COUNT(*) for exact row counts rather than estimated_size
**When to use:** For trades.trade_data where accuracy matters for Claude's understanding
**Rationale:**
- `estimated_size` from duckdb_tables() is an approximation
- For small tables (< 100k rows), COUNT(*) is fast enough
- Claude needs accurate row counts to understand data availability
**Example:**
```typescript
// Accurate row counts (acceptable performance for MCP tool)
const rowCounts = await Promise.all(
  tableNames.map(async (table) => {
    const result = await conn.runAndReadAll(
      `SELECT COUNT(*) as count FROM ${table}`
    );
    return { table, count: Number(result.getRows()[0][0]) };
  })
);
```

### Pattern 4: Block Breakdown for Trades Table
**What:** Include per-block row counts so Claude knows which blocks have data
**When to use:** Always include for trades.trade_data
**Example:**
```typescript
// Block breakdown query
const blockBreakdown = await conn.runAndReadAll(`
  SELECT block_id, COUNT(*) as row_count
  FROM trades.trade_data
  GROUP BY block_id
  ORDER BY block_id
`);
```

### Pattern 5: Hardcoded Schema Metadata
**What:** Store table/column descriptions in TypeScript constants, not database
**When to use:** All description text
**Rationale from CONTEXT.md:** "Hardcoded descriptions in the tool - curated, accurate, manageable for stable schema"
**Example:**
```typescript
// Source: packages/mcp-server/src/utils/schema-metadata.ts (new file)
export const SCHEMA_DESCRIPTIONS = {
  trades: {
    description: "Trading data synced from CSV files",
    tables: {
      trade_data: {
        description: "Individual trade records from all blocks. Each row is one trade with P&L, strategy, and timing info.",
        columns: {
          block_id: "Portfolio block identifier - use to filter by block",
          date_opened: "Trade entry date (DATE format)",
          time_opened: "Trade entry time in Eastern Time (e.g., '09:35:00')",
          strategy: "Strategy name assigned to the trade",
          legs: "Option legs description (e.g., 'SPY 450P/445P')",
          premium: "Credit received (positive) or debit paid (negative)",
          num_contracts: "Number of contracts traded",
          pl: "Gross profit/loss before commissions",
          date_closed: "Trade exit date (NULL if still open)",
          time_closed: "Trade exit time in Eastern Time",
          reason_for_close: "Exit reason (e.g., 'Target', 'Stop', 'Expiration')",
          margin_req: "Margin requirement for the position",
          opening_commissions: "Commissions paid at entry",
          closing_commissions: "Commissions paid at exit",
        },
      },
    },
  },
  market: {
    description: "Market context data (SPX, VIX) for hypothesis testing",
    tables: {
      spx_daily: {
        description: "Daily SPX market data with technical indicators, VIX context, and regime classifications.",
        // ... column descriptions
      },
      // ... other tables
    },
  },
};
```

### Anti-Patterns to Avoid
- **Don't use SHOW ALL TABLES:** Returns database/schema columns that aren't needed; duckdb_tables() is cleaner
- **Don't query information_schema:** Less metadata than duckdb_* functions; compatibility layer adds overhead
- **Don't make descriptions dynamic:** Querying column comments adds complexity; hardcoded is simpler and more curated
- **Don't split into multiple tools:** Claude benefits from full context in one call; multiple tools increase latency

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table listing | Parse filesystem for .sql files | `duckdb_tables()` function | DuckDB knows its own schema |
| Column enumeration | Hardcode column lists | `duckdb_columns()` or DESCRIBE | Schema may evolve; introspection stays accurate |
| Row counting | Estimate from file size | `COUNT(*)` queries | Exact counts help Claude understand data volume |
| Type formatting | Parse raw DuckDB types | Use type strings as-is | DuckDB type names are already user-friendly |

**Key insight:** DuckDB's introspection functions (`duckdb_tables()`, `duckdb_columns()`, `DESCRIBE`) provide accurate, current schema information. Use them rather than maintaining parallel schema definitions.

## Common Pitfalls

### Pitfall 1: Blocking on Large Table Scans
**What goes wrong:** COUNT(*) on large tables blocks the tool response
**Why it happens:** trades.trade_data could have 100k+ rows
**How to avoid:**
- Use `withFullSync` middleware (sync already runs before query)
- COUNT(*) after sync is fast (data already in memory)
- If performance is an issue, fall back to `duckdb_tables().estimated_size`
**Warning signs:** Tool takes > 5 seconds; timeout errors

### Pitfall 2: Including Internal/System Tables
**What goes wrong:** Output includes `_sync_metadata` or DuckDB system tables
**Why it happens:** Missing filter on `internal` column or forgetting exclusion
**How to avoid:**
- Filter `WHERE internal = false` in duckdb_tables() queries
- Explicitly exclude `%_sync_metadata%` tables from output
- Only return tables in `trades` and `market` schemas
**Warning signs:** Claude tries to query _sync_metadata; confusion about system tables

### Pitfall 3: Stale Schema After Table Creation
**What goes wrong:** New tables from Phase 41-42 not visible
**Why it happens:** Introspection before sync; tables not yet created
**How to avoid:**
- Use `withFullSync` middleware to ensure tables exist before introspection
- Sync creates tables if they don't exist
**Warning signs:** "Table not found" errors despite schema discovery showing the table

### Pitfall 4: Missing Example Queries Context
**What goes wrong:** Claude writes inefficient or incorrect queries
**Why it happens:** Schema alone doesn't convey query patterns
**How to avoid:**
- Include targeted example queries for each major use case
- Show JOIN patterns explicitly (trades + market data is critical)
- Include hypothesis testing patterns (win rate by regime, etc.)
**Warning signs:** Claude repeatedly asks for query help; inefficient queries

### Pitfall 5: Overwhelming Output Size
**What goes wrong:** Tool output too large for Claude's context
**Why it happens:** Too many example queries; verbose column descriptions
**How to avoid:**
- Limit examples to ~10 essential patterns (3-4 basic, 3-4 joins, 3-4 hypothesis)
- Keep column descriptions to 1 line each
- Don't include sample data rows
**Warning signs:** Output > 50KB; Claude truncates or ignores parts

## Code Examples

### DuckDB Introspection Queries

```typescript
// Source: DuckDB official docs - duckdb_table_functions
// https://duckdb.org/docs/stable/sql/meta/duckdb_table_functions

// List all user tables in trades/market schemas
const tablesQuery = `
  SELECT
    schema_name,
    table_name,
    estimated_size,
    column_count
  FROM duckdb_tables()
  WHERE internal = false
    AND schema_name IN ('trades', 'market')
    AND table_name NOT LIKE '%_sync_metadata'
  ORDER BY schema_name, table_name
`;

// Get column details for a table
const columnsQuery = `
  SELECT
    column_name,
    data_type,
    is_nullable
  FROM duckdb_columns()
  WHERE schema_name = $1
    AND table_name = $2
  ORDER BY column_index
`;

// Get exact row count (fast after sync)
const countQuery = `SELECT COUNT(*) FROM trades.trade_data`;

// Get block breakdown
const blockBreakdownQuery = `
  SELECT block_id, COUNT(*) as row_count
  FROM trades.trade_data
  GROUP BY block_id
  ORDER BY block_id
`;
```

### Tool Registration with Full Sync

```typescript
// Source: packages/mcp-server/src/tools/sql.ts (existing pattern)
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConnection } from "../db/connection.js";
import { withFullSync } from "./middleware/sync-middleware.js";
import { createToolOutput } from "../utils/output-formatter.js";
import { SCHEMA_DESCRIPTIONS, EXAMPLE_QUERIES } from "../utils/schema-metadata.js";

export function registerSchemaTools(server: McpServer, baseDir: string): void {
  server.registerTool(
    "describe_database",
    {
      description:
        "Get complete database schema: all tables, columns, types, row counts, and example queries. " +
        "Call this BEFORE using run_sql to understand available data and query patterns.",
      inputSchema: z.object({}), // No parameters needed
    },
    withFullSync(baseDir, async (_, { blockSyncResult, marketSyncResult }) => {
      const conn = await getConnection(baseDir);

      // Get tables from duckdb_tables()
      const tables = await conn.runAndReadAll(`
        SELECT schema_name, table_name, column_count
        FROM duckdb_tables()
        WHERE internal = false
          AND schema_name IN ('trades', 'market')
          AND table_name NOT LIKE '%_sync_metadata'
        ORDER BY schema_name, table_name
      `);

      // Build schema info with row counts and columns
      // ... (implementation details)

      const summary = `Database schema: ${tableCount} tables across ${schemaCount} schemas`;

      return createToolOutput(summary, {
        schemas: schemaInfo,
        examples: EXAMPLE_QUERIES,
        syncInfo: {
          blocksProcessed: blockSyncResult.blocksProcessed,
          marketFilesSynced: marketSyncResult.filesSynced,
        },
      });
    })
  );
}
```

### Hardcoded Schema Metadata Structure

```typescript
// Source: New file - packages/mcp-server/src/utils/schema-metadata.ts

export const SCHEMA_DESCRIPTIONS: SchemaMetadata = {
  trades: {
    description: "Trading data synced from CSV files. Contains trade records from all portfolio blocks.",
    tables: {
      trade_data: {
        description: "Individual trade records. Each row = one trade with entry/exit details, P&L, and strategy.",
        keyColumns: ["block_id", "date_opened", "strategy", "pl"],
        columns: {
          block_id: { description: "Portfolio block ID - filter by this to query specific portfolios", hypothesis: true },
          date_opened: { description: "Trade entry date (DATE)", hypothesis: true },
          time_opened: { description: "Trade entry time in Eastern Time", hypothesis: false },
          strategy: { description: "Strategy name (e.g., 'IronCondor', 'PutSpread')", hypothesis: true },
          legs: { description: "Option legs (e.g., 'SPY 450P/445P')", hypothesis: false },
          premium: { description: "Credit received (+) or debit paid (-)", hypothesis: false },
          num_contracts: { description: "Number of contracts", hypothesis: false },
          pl: { description: "Gross P&L before commissions", hypothesis: true },
          date_closed: { description: "Exit date (NULL if open)", hypothesis: false },
          time_closed: { description: "Exit time in Eastern Time", hypothesis: false },
          reason_for_close: { description: "Exit reason (Target/Stop/Expiration)", hypothesis: true },
          margin_req: { description: "Margin requirement ($)", hypothesis: false },
          opening_commissions: { description: "Entry commissions ($)", hypothesis: false },
          closing_commissions: { description: "Exit commissions ($)", hypothesis: false },
        },
      },
    },
  },
  market: {
    description: "Market context data for hypothesis testing. SPX prices, VIX levels, technical indicators.",
    tables: {
      spx_daily: {
        description: "Daily SPX data with indicators. JOIN with trades on date_opened for market context.",
        keyColumns: ["date", "Vol_Regime", "VIX_Close", "Total_Return_Pct"],
        // ... columns
      },
      // ... other market tables
    },
  },
};

export const EXAMPLE_QUERIES = {
  basic: [
    {
      description: "Count trades by strategy",
      sql: "SELECT strategy, COUNT(*) as trades, SUM(pl) as total_pl FROM trades.trade_data GROUP BY strategy ORDER BY total_pl DESC",
    },
    {
      description: "Daily P&L for a specific block",
      sql: "SELECT date_opened, SUM(pl) as daily_pl FROM trades.trade_data WHERE block_id = 'my-block' GROUP BY date_opened ORDER BY date_opened",
    },
    {
      description: "Recent market conditions",
      sql: "SELECT date, Close, VIX_Close, Vol_Regime, Total_Return_Pct FROM market.spx_daily ORDER BY date DESC LIMIT 20",
    },
  ],
  joins: [
    {
      description: "Trade P&L with market context",
      sql: `SELECT
        t.date_opened, t.strategy, t.pl,
        m.VIX_Close, m.Vol_Regime, m.Total_Return_Pct
      FROM trades.trade_data t
      JOIN market.spx_daily m ON t.date_opened = m.date
      WHERE t.block_id = 'my-block'
      ORDER BY t.date_opened DESC`,
    },
    {
      description: "Trades with intraday SPX context",
      sql: `SELECT
        t.date_opened, t.time_opened, t.strategy, t.pl,
        s.MOC_30min, s.Afternoon_Move
      FROM trades.trade_data t
      JOIN market.spx_15min s ON t.date_opened = s.date
      WHERE t.block_id = 'my-block'`,
    },
  ],
  hypothesis: [
    {
      description: "Win rate by VIX regime",
      sql: `SELECT
        m.Vol_Regime,
        COUNT(*) as trades,
        SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) as winners,
        ROUND(100.0 * SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate,
        SUM(t.pl) as total_pl
      FROM trades.trade_data t
      JOIN market.spx_daily m ON t.date_opened = m.date
      WHERE t.block_id = 'my-block'
      GROUP BY m.Vol_Regime
      ORDER BY m.Vol_Regime`,
    },
    {
      description: "P&L by day of week",
      sql: `SELECT
        m.Day_of_Week,
        COUNT(*) as trades,
        SUM(t.pl) as total_pl,
        AVG(t.pl) as avg_pl
      FROM trades.trade_data t
      JOIN market.spx_daily m ON t.date_opened = m.date
      WHERE t.block_id = 'my-block'
      GROUP BY m.Day_of_Week
      ORDER BY m.Day_of_Week`,
    },
    {
      description: "Performance in trending vs range-bound markets",
      sql: `SELECT
        CASE WHEN m.Trend_Score >= 3 THEN 'Uptrend'
             WHEN m.Trend_Score <= -3 THEN 'Downtrend'
             ELSE 'Range' END as market_condition,
        COUNT(*) as trades,
        SUM(t.pl) as total_pl,
        AVG(t.pl) as avg_pl
      FROM trades.trade_data t
      JOIN market.spx_daily m ON t.date_opened = m.date
      WHERE t.block_id = 'my-block'
      GROUP BY market_condition`,
    },
  ],
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `information_schema.tables` | `duckdb_tables()` function | DuckDB 0.8+ | Richer metadata (estimated_size, internal flag) |
| `PRAGMA table_info()` | `DESCRIBE` statement | DuckDB 0.3+ | Standard SQL syntax, same output |
| Multiple discovery tools | Single comprehensive tool | Best practice | Reduces latency, gives Claude full context |

**Deprecated/outdated:**
- `PRAGMA show_tables`: Superseded by `SHOW TABLES` command
- `sqlite_master` queries: Compatibility layer; prefer native DuckDB functions

## Open Questions

1. **Optimal number of example queries**
   - What we know: Too few = Claude lacks patterns; too many = output bloat
   - What's unclear: Exact threshold for useful vs overwhelming
   - Recommendation: Start with ~10 examples (3-4 per category); adjust based on usage

2. **Column description detail level**
   - What we know: CONTEXT.md says Claude decides "type only vs description vs samples"
   - What's unclear: Optimal balance for trading-specific context
   - Recommendation: Include type + one-line description + "hypothesis" flag for key analytical columns; no sample values (bloats output)

3. **Data provenance for market tables**
   - What we know: CONTEXT.md mentions Claude decides whether to include source info
   - What's unclear: Whether users care about data sources
   - Recommendation: Include brief provenance (e.g., "Source: CSV files in market/ folder") but not detailed update methodology

## Sources

### Primary (HIGH confidence)
- [DuckDB DESCRIBE Guide](https://duckdb.org/docs/stable/guides/meta/describe) - DESCRIBE syntax and output columns
- [DuckDB List Tables Guide](https://duckdb.org/docs/stable/guides/meta/list_tables) - SHOW TABLES, duckdb_tables()
- [DuckDB Metadata Functions](https://duckdb.org/docs/stable/sql/meta/duckdb_table_functions) - duckdb_tables(), duckdb_columns(), duckdb_schemas() full column lists
- [DuckDB Information Schema](https://duckdb.org/docs/stable/sql/meta/information_schema) - SQL-standard views, tables/columns views
- TradeBlocks codebase:
  - `packages/mcp-server/src/db/schemas.ts` - Actual table definitions (ground truth)
  - `packages/mcp-server/src/tools/sql.ts` - run_sql implementation (reference pattern)
  - `packages/mcp-server/src/tools/blocks/core.ts` - list_blocks output structure (JSON pattern)
  - `packages/mcp-server/src/tools/middleware/sync-middleware.ts` - withFullSync pattern

### Secondary (MEDIUM confidence)
- [DUCKDB_TABLES() Examples](https://database.guide/duckdb_tables-examples/) - Community examples of duckdb_tables() usage

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing dependencies, no new packages
- Architecture: HIGH - Single-tool pattern matches existing codebase; DuckDB introspection APIs verified
- Pitfalls: MEDIUM - Performance concerns theoretical until tested with large datasets

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - DuckDB introspection APIs are stable)
