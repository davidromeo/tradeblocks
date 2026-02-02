# Phase 43: Query Interface - Research

**Researched:** 2026-02-01
**Domain:** DuckDB SQL query execution via MCP tool
**Confidence:** HIGH

## Summary

This phase implements a `run_sql` MCP tool that allows Claude to execute arbitrary SQL SELECT queries against the DuckDB analytics database. The research focused on two critical areas identified in CONTEXT.md: DuckDB query timeout mechanisms and existing MCP tool patterns in the codebase.

**Key Findings:**
- DuckDB's Node.js API (@duckdb/node-api v1.4.4-r.1) does **not** provide native query timeout or cancellation
- Manual timeout implementation required using Promise.race pattern with resource cleanup
- Security via `enable_external_access=false` and `lock_configuration=true` (already configured in Phase 41)
- Error responses follow established pattern: `{content: [{type: "text", text: string}], isError: true}`
- DuckDB syntax errors include line/column information in error messages

**Primary recommendation:** Implement manual 30-second timeout using Promise.race with proper cleanup. Block dangerous SQL patterns via RegEx validation before query execution. Follow existing error response patterns from sync middleware and report tools.

## Standard Stack

The query interface builds on existing infrastructure from Phase 41-42:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @duckdb/node-api | 1.4.4-r.1 | DuckDB Node.js bindings | Official DuckDB package for Node.js (replaces deprecated duckdb package) |
| zod | 4.0.0 | Input schema validation | Used across all MCP tools for parameter validation |
| @modelcontextprotocol/sdk | 1.11.0 | MCP server framework | MCP standard implementation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | No additional libraries needed | Query interface uses existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual timeout via Promise.race | Third-party timeout libraries (e.g., p-timeout) | Native Promise.race is sufficient and avoids dependency |
| RegEx SQL validation | SQL parser library | RegEx handles blocklist validation; parser would be overkill for simple pattern matching |

**Installation:**
No new packages needed - all dependencies installed in Phase 41.

## Architecture Patterns

### Recommended Project Structure
```
packages/mcp-server/src/
├── tools/
│   └── sql.ts              # run_sql tool implementation
├── utils/
│   └── sql-validator.ts    # SQL validation logic (optional - could inline)
└── db/
    └── connection.ts       # Existing - getConnection() reused
```

### Pattern 1: Manual Query Timeout with Promise.race
**What:** Wrap DuckDB query execution with a timeout promise that rejects after 30 seconds
**When to use:** All user-submitted SQL queries that could run indefinitely
**Example:**
```typescript
async function executeWithTimeout(
  conn: DuckDBConnection,
  sql: string,
  params: unknown[],
  timeoutMs: number
): Promise<unknown[]> {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Query timeout")), timeoutMs);
  });

  const queryPromise = conn.all(sql, params);

  try {
    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (error) {
    // Note: DuckDB query may still be running - no native cancellation
    throw error;
  }
}
```

**Important limitation:** Promise.race does NOT cancel the losing promise. The DuckDB query continues running in the background. This is acceptable because:
- DuckDB's memory_limit (512MB) prevents runaway memory usage
- Query will eventually complete or hit resource limits
- Connection is long-lived singleton, not per-request

### Pattern 2: SQL Validation via Blocklist
**What:** Validate SQL before execution to block dangerous operations
**When to use:** All queries before passing to DuckDB
**Example:**
```typescript
// Source: CONTEXT.md decisions + DuckDB security docs
const DANGEROUS_PATTERNS = [
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bDELETE\b/i,
  /\bDROP\b/i,
  /\bCREATE\b/i,
  /\bALTER\b/i,
  /\bCOPY\b/i,
  /\bEXPORT\b/i,
  /\bATTACH\b/i,
  /\bDETACH\b/i,
  /\bread_csv\(/i,
  /\bread_parquet\(/i,
  /\bread_json\(/i,
  /\bread_text\(/i,
  /\bwrite_csv\(/i,
];

function validateSQL(sql: string): { valid: boolean; error?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sql)) {
      const operation = pattern.source.replace(/\\b|\(|\/i$/g, "");
      return {
        valid: false,
        error: `${operation} operations are not allowed. This tool only supports SELECT queries for data analysis.`,
      };
    }
  }
  return { valid: true };
}
```

### Pattern 3: Error Response Format
**What:** Consistent error response structure across all MCP tools
**When to use:** All error conditions (validation, timeout, DuckDB errors)
**Example:**
```typescript
// Source: packages/mcp-server/src/tools/reports/queries.ts:176-185
return {
  content: [
    {
      type: "text",
      text: `Error message here: ${(error as Error).message}`,
    },
  ],
  isError: true,
};
```

### Pattern 4: Result Formatting with Metadata
**What:** Return results with truncation metadata for context awareness
**When to use:** All successful query responses
**Example:**
```typescript
// Source: CONTEXT.md decisions
interface QueryResult {
  rows: Array<Record<string, unknown>>;
  columns: Array<{ name: string; type: string }>;
  totalRows: number;
  returnedRows: number;
  truncated: boolean;
}
```

### Anti-Patterns to Avoid
- **Don't echo the query in error responses:** Claude already has the query text; repeating it wastes context
- **Don't use try-catch for validation:** Validate SQL with RegEx before attempting execution to provide helpful errors
- **Don't implement query cancellation via connection.interrupt():** The method exists but is non-functional in @duckdb/node-api 1.4.4

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP tool registration | Custom tool wrapper | `server.registerTool()` with Zod schema | Standard MCP SDK pattern used by all 14 existing tools |
| Input validation | Manual type checking | Zod schemas | Type-safe validation with automatic error messages |
| DuckDB connection | Per-request connections | `getConnection(baseDir)` singleton | Existing pattern from Phase 41; connection pooling handled |
| Error formatting | Custom error objects | `{content: [{type: "text", text}], isError: true}` | MCP SDK standard format used across codebase |
| SQL parameterization | String concatenation | DuckDB prepared statements ($1, $2, etc.) | Prevents SQL injection, used in existing sync code |

**Key insight:** The MCP server codebase has strong established patterns for tool registration, error handling, and database access. Follow these patterns exactly for consistency.

## Common Pitfalls

### Pitfall 1: Assuming DuckDB Provides Query Cancellation
**What goes wrong:** Attempting to use `connection.interrupt()` or expecting Promise.race to stop the query
**Why it happens:** The method exists in the API but is documented as non-functional; Promise.race doesn't cancel the losing promise
**How to avoid:** Accept that timeout only rejects the Promise; DuckDB query runs to completion in background. Rely on memory_limit for resource protection.
**Warning signs:** User reports queries running after timeout; connection appears hung

### Pitfall 2: Passing Through Raw DuckDB Errors Without Context
**What goes wrong:** DuckDB syntax errors are helpful but may reference internal table names or features Claude doesn't know about
**Why it happens:** Direct `error.message` pass-through without interpretation
**How to avoid:** For common errors (unknown table/column), suggest alternatives. For syntax errors, pass through verbatim (they're well-formatted).
**Warning signs:** Claude repeatedly makes same mistake due to unclear error message

### Pitfall 3: Not Truncating Large Result Sets
**What goes wrong:** Queries returning 10,000+ rows overflow Claude's context window
**Why it happens:** Forgetting to apply LIMIT or not validating user-provided limit parameter
**How to avoid:** Always apply LIMIT clause; validate limit parameter is <= 1000; include truncation metadata
**Warning signs:** MCP server response truncated; Claude complains about incomplete data

### Pitfall 4: Blocking Valid SQL Keywords in Comments
**What goes wrong:** RegEx validation blocks queries with "DELETE" in a comment or string literal
**Why it happens:** Simple pattern matching without SQL parsing
**How to avoid:** Accept this limitation; false positives are rare and easily worked around. Document that keywords in comments trigger validation.
**Warning signs:** User reports valid query blocked; query contains dangerous keyword in non-executable context

### Pitfall 5: Security Configuration Drift
**What goes wrong:** Assuming `enable_external_access=false` is set when it's not; COPY/ATTACH succeed
**Why it happens:** Configuration set in Phase 41 but not verified on each query
**How to avoid:** Rely on lock_configuration=true from Phase 41 setup. Don't re-verify config on every query (performance cost). Trust defense-in-depth: config lock + SQL validation.
**Warning signs:** Filesystem operations succeed when they shouldn't

## Code Examples

Verified patterns from official sources and existing codebase:

### Query Execution with Timeout
```typescript
// Pattern: Promise.race timeout (not from official docs - standard JavaScript pattern)
// Source: packages/mcp-server/src/db/connection.ts (conn.run pattern)
async function executeQuery(
  conn: DuckDBConnection,
  sql: string,
  limit: number,
  timeoutMs: number = 30000
): Promise<{ rows: unknown[]; columns: { name: string; type: string }[] }> {
  // Apply LIMIT if not present in query
  const finalSql = sql.trim().toUpperCase().includes("LIMIT")
    ? sql
    : `${sql} LIMIT ${limit}`;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Query exceeded 30s timeout. Consider adding LIMIT or filtering by block_id.")),
      timeoutMs
    );
  });

  const queryPromise = conn.all(finalSql);

  const rows = await Promise.race([queryPromise, timeoutPromise]);

  // Extract column metadata from first row (DuckDB returns plain objects)
  const columns = rows.length > 0
    ? Object.keys(rows[0]).map((name) => ({
        name,
        type: typeof rows[0][name], // Simplified - actual DuckDB types available via DESCRIBE
      }))
    : [];

  return { rows, columns };
}
```

### Tool Registration with Sync Middleware
```typescript
// Source: packages/mcp-server/src/tools/reports/queries.ts:23-189
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConnection } from "../db/connection.js";
import { createToolOutput } from "../utils/output-formatter.js";

export function registerSQLTools(server: McpServer, baseDir: string): void {
  server.registerTool(
    "run_sql",
    {
      description:
        "Execute a SQL SELECT query against the DuckDB analytics database. Query trades (trades.trade_data) and market data (market.spx_daily, market.spx_15min, etc.). Returns up to 1000 rows.",
      inputSchema: z.object({
        query: z.string().describe("SQL SELECT query to execute"),
        limit: z
          .number()
          .min(1)
          .max(1000)
          .default(100)
          .describe("Maximum rows to return (default: 100, max: 1000)"),
      }),
    },
    async ({ query, limit }) => {
      try {
        // Validate SQL
        const validation = validateSQL(query);
        if (!validation.valid) {
          return {
            content: [{ type: "text", text: validation.error! }],
            isError: true,
          };
        }

        // Execute query with timeout
        const conn = await getConnection(baseDir);
        const result = await executeQuery(conn, query, limit);

        const summary = `Query returned ${result.rows.length} row(s)`;
        const structuredData = {
          rows: result.rows,
          columns: result.columns,
          totalRows: result.rows.length,
          returnedRows: result.rows.length,
          truncated: result.rows.length === limit,
        };

        return createToolOutput(summary, structuredData);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `SQL error: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
```

### SQL Validation
```typescript
// Source: CONTEXT.md decisions + https://duckdb.org/docs/stable/operations_manual/securing_duckdb/overview
const DANGEROUS_PATTERNS = [
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bDELETE\b/i,
  /\bDROP\b/i,
  /\bCREATE\b/i,
  /\bALTER\b/i,
  /\bCOPY\b/i,
  /\bEXPORT\b/i,
  /\bATTACH\b/i,
  /\bDETACH\b/i,
  /\bSET\b/i, // Prevent configuration changes
  /\bread_csv\(/i,
  /\bread_parquet\(/i,
  /\bread_json\(/i,
  /\bread_text\(/i,
  /\bwrite_csv\(/i,
];

function validateSQL(sql: string): { valid: boolean; error?: string } {
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sql)) {
      const operation = pattern.source
        .replace(/\\b/g, "")
        .replace(/\\/g, "")
        .replace(/\(/g, "")
        .replace(/i$/g, "");
      return {
        valid: false,
        error: `${operation} operations are not allowed. This tool only supports SELECT queries for read-only data analysis.`,
      };
    }
  }

  return { valid: true };
}
```

### Error Response with Suggestions
```typescript
// Source: CONTEXT.md decisions
function enhanceError(error: Error, query: string): string {
  const msg = error.message;

  // Table not found - suggest alternatives
  if (msg.includes("Table") && msg.includes("does not exist")) {
    return `${msg}\n\nAvailable tables:\n- trades.trade_data (trade records)\n- market.spx_daily (daily market context)\n- market.spx_15min (intraday checkpoints)\n- market.spx_highlow (high/low timing)\n- market.vix_intraday (VIX intraday data)`;
  }

  // Column not found - suggest using DESCRIBE
  if (msg.includes("column") && msg.includes("not found")) {
    return `${msg}\n\nUse: DESCRIBE trades.trade_data; to see available columns`;
  }

  // Timeout
  if (msg.includes("timeout")) {
    return msg; // Already includes suggestion from executeQuery
  }

  // Syntax error - pass through verbatim (includes line/column info)
  return msg;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| duckdb package | @duckdb/node-api | DuckDB 1.4.x (2025) | Official package with better TypeScript support |
| callback-based API | Promise-based API | @duckdb/node-api 1.4.x | Simpler async/await patterns |
| AbortController for timeouts | Promise.race | N/A (AbortController not supported by DuckDB) | Use standard Promise patterns |

**Deprecated/outdated:**
- `duckdb` npm package: Deprecated in favor of @duckdb/node-api (last release for 1.4.x in Fall 2025, no 1.5.x support)
- `connection.interrupt()`: Method exists but documented as non-functional in current version

## Open Questions

Things that couldn't be fully resolved:

1. **DuckDB column type metadata from query results**
   - What we know: `conn.all()` returns plain JavaScript objects; DuckDB has rich type system (VARCHAR, DOUBLE, DATE, etc.)
   - What's unclear: How to extract actual DuckDB column types from query results without separate DESCRIBE query
   - Recommendation: Use JavaScript `typeof` for simple type reporting; if precise DuckDB types needed, execute `PRAGMA table_info(table_name)` after query

2. **Query result size estimation before execution**
   - What we know: Can apply LIMIT to cap rows, but don't know row count before executing
   - What's unclear: Whether DuckDB provides query cost estimation or COUNT(*) optimization
   - Recommendation: Always apply LIMIT; accept that we can't pre-validate result size. Truncation metadata signals when limit hit.

3. **Optimal timeout value for analytics queries**
   - What we know: CONTEXT.md specifies 30 seconds; simple aggregates complete in <1s
   - What's unclear: Whether 30s is sufficient for complex JOIN queries on large datasets
   - Recommendation: Start with 30s; adjust based on user feedback. Add timeout as optional parameter in future if needed.

## Sources

### Primary (HIGH confidence)
- [DuckDB Node.js API Reference](https://duckdb.org/docs/stable/clients/nodejs/reference) - Connection methods, no native timeout/cancellation
- [DuckDB Securing Overview](https://duckdb.org/docs/stable/operations_manual/securing_duckdb/overview) - enable_external_access, lock_configuration, dangerous operations
- [GitHub Issue #8564: Query timeout](https://github.com/duckdb/duckdb/issues/8564) - Confirmed no built-in timeout; interrupt() recommended but requires threading
- TradeBlocks codebase:
  - `packages/mcp-server/src/db/connection.ts` - getConnection() singleton pattern
  - `packages/mcp-server/src/tools/reports/queries.ts` - Error response format, tool registration pattern
  - `packages/mcp-server/src/tools/middleware/sync-middleware.ts` - Middleware patterns
  - `packages/mcp-server/src/utils/output-formatter.ts` - createToolOutput() structure

### Secondary (MEDIUM confidence)
- [MDN: Promise.race()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race) - Timeout pattern limitations
- [Using AbortSignal in Node.js](https://nearform.com/insights/using-abortsignal-in-node-js/) - Modern cancellation patterns (not applicable to DuckDB)
- [DuckDB GitHub Discussion #8242](https://github.com/duckdb/duckdb/discussions/8242) - Prepared statements for SQL injection prevention
- [DuckDB Prepared Statements](https://duckdb.org/docs/stable/sql/query_syntax/prepared_statements) - Parameterization syntax

### Tertiary (LOW confidence)
- [SQLRooms DuckDB Connector](https://sqlrooms.org/api/duckdb/interfaces/DuckDbConnector.html) - Third-party implementation with cancellation (not using official API)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing dependencies from Phase 41; no new packages required
- Architecture: HIGH - Patterns verified in existing codebase (14 MCP tools use same structure)
- Pitfalls: MEDIUM - Timeout/cancellation limitation confirmed via official docs and GitHub issues; other pitfalls based on DuckDB security docs
- Security: HIGH - enable_external_access=false and lock_configuration=true patterns verified in official docs

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - DuckDB is stable; @duckdb/node-api 1.4.x current, 1.5.x not until early 2026)
