# Phase 53: Import Consolidation - Research

**Researched:** 2026-02-07
**Domain:** DuckDB query migration, MCP tool refactoring, CSV loading removal
**Confidence:** HIGH

## Summary

Phase 53 migrates three MCP tools (`analyze_regime_performance`, `suggest_filters`, `calculate_orb`) from in-memory CSV loading to DuckDB queries, then removes the dead CSV loading code and its 5-minute TTL cache. This is a focused refactoring phase with no new dependencies -- all infrastructure (DuckDB connection, sync middleware, schema) is already in place from Phases 41-52.

The key architectural change is replacing `getMarketData(baseDir)` calls (which read CSV files into `Map<string, T>` objects via `loadDailyData`/`loadIntradayData`/etc.) with DuckDB queries via `getConnection(baseDir)` + `conn.runAndReadAll()`. The three tools currently bypass the DuckDB sync pipeline entirely -- they don't use the `withFullSync` middleware and don't call `getConnection`. After migration, they must use `withFullSync` middleware to ensure market data is synced before querying, matching the pattern already used by `run_sql` and `describe_database`.

The migration is mechanically straightforward because: (1) the DuckDB tables (`market.spx_daily`, `market.spx_15min`) already contain the exact same columns the CSV loading code was mapping into TypeScript interfaces; (2) the query patterns are simple date-keyed lookups and aggregations that map naturally to SQL; (3) existing tools like `run_sql` and `describe_database` already demonstrate the `getConnection` + `runAndReadAll` pattern with result row iteration. The main risk is ensuring numerical precision and NaN handling remain consistent -- DuckDB stores NaN values as NULL, while the CSV loading code explicitly parsed "NaN" strings to JavaScript `NaN`.

**Primary recommendation:** Migrate each tool one at a time in dependency order (analyze_regime_performance first since it's simplest, then suggest_filters, then calculate_orb), add the `withFullSync` middleware wrapper to each, replace `getMarketData()` with targeted DuckDB queries, then remove all CSV loading infrastructure as the final step.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@duckdb/node-api` | ^1.4.4-r.1 | DuckDB Node.js bindings | Already in use throughout MCP server |
| `@modelcontextprotocol/sdk` | ^1.11.0 | MCP server framework | Already in use |
| `zod` | ^4.0.0 | Input validation | Already in use |

### Supporting

No new libraries needed. This phase only modifies existing files.

## Architecture Patterns

### Files to Modify

```
packages/mcp-server/src/
  tools/
    market-data.ts       # PRIMARY: Migrate 3 tools, remove CSV loading code
```

### Pattern 1: DuckDB Query in Tool Handler (Existing Pattern)

**What:** Tools obtain a DuckDB connection via `getConnection(baseDir)`, execute queries with `conn.runAndReadAll()`, and iterate results via `result.getRows()`.

**When to use:** Any tool that needs to read market data from DuckDB.

**Example from sql.ts (lines 150-181):**
```typescript
// Source: packages/mcp-server/src/tools/sql.ts
import { getConnection } from "../db/connection.js";

const conn = await getConnection(baseDir);
const result = await conn.runAndReadAll(finalSql);

// Extract column metadata
const columnCount = result.columnCount;
const columns: Array<{ name: string; type: string }> = [];
for (let i = 0; i < columnCount; i++) {
  columns.push({
    name: result.columnName(i),
    type: result.columnType(i).toString(),
  });
}

// Convert rows to objects
const rows: Record<string, unknown>[] = [];
for (const row of result.getRows()) {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < columnCount; i++) {
    const value = row[i];
    // Convert BigInt to Number for JSON serialization
    obj[columns[i].name] = typeof value === "bigint" ? Number(value) : value;
  }
  rows.push(obj);
}
```

### Pattern 2: Sync Middleware Wrapping (Existing Pattern)

**What:** The `withFullSync` middleware wraps a tool handler to ensure all blocks and market data are synced to DuckDB before the handler executes. It calls `syncAllBlocks(baseDir)` and `syncMarketData(baseDir)` automatically.

**When to use:** Any tool that queries DuckDB market data tables.

**Example from sql.ts (lines 249):**
```typescript
// Source: packages/mcp-server/src/tools/sql.ts
import { withFullSync } from "./middleware/sync-middleware.js";

server.registerTool(
  "run_sql",
  { description: "...", inputSchema: z.object({...}) },
  withFullSync(baseDir, async ({ query, limit }) => {
    const conn = await getConnection(baseDir);
    // ... query DuckDB ...
  })
);
```

**Critical note:** The current market-data tools do NOT use `withFullSync`. They call `getMarketData(baseDir)` which reads CSV files directly. After migration, they MUST be wrapped with `withFullSync` or a similar sync-before-query pattern.

### Pattern 3: Parameterized Queries (Existing Pattern)

**What:** DuckDB supports parameterized queries via `$1, $2, ...` syntax with `conn.run(sql, values)` and `conn.runAndReadAll(sql, values)`.

**When to use:** When embedding user-provided values in queries (e.g., date ranges, block IDs).

**Example from sync-layer.test.ts:**
```typescript
// Source: packages/mcp-server/tests/integration/sync-layer.test.ts
const reader = await conn.runAndReadAll(
  `SELECT COUNT(*) as count FROM trades.trade_data WHERE block_id = $1`,
  [blockId]
);
```

### Pattern 4: Trade Loading Stays As-Is

**What:** The three tools load trades via `loadBlock(baseDir, blockId)` which reads CSV files from block directories. This is NOT part of Phase 53's scope -- trade loading stays using the existing CSV path via `block-loader.ts`.

**Why:** Trade data is also synced to DuckDB via the sync layer, but these tools need full `Trade` objects (with all fields like `dateOpened`, `timeOpened`, `strategy`, `pl`, etc.) for their processing logic. The in-memory `loadBlock` approach works well for this and isn't the bottleneck being addressed. Phase 53 only targets market data CSV loading.

### Pattern 5: NULL Handling (DuckDB vs JavaScript NaN)

**What:** DuckDB stores missing/invalid values as SQL NULL. The current CSV loader parses empty/NaN strings to JavaScript `NaN` via `parseNum()`. When migrating, `null` from DuckDB results replaces `NaN` from CSV parsing.

**Impact:** Code that currently checks `isNaN(value)` must also handle `null` (or the DuckDB result conversion should coalesce NULL to NaN for consistency). Since the tools mostly just check `> threshold` or perform arithmetic, and JavaScript treats `null` similarly to `NaN` in numeric contexts (`null > 25` is `false`, `null + 5` is `5`), the behavior is mostly compatible but must be verified per-tool.

**Recommended approach:** When reading DuckDB rows, convert NULL to NaN for numeric fields to maintain exact behavioral compatibility with the CSV loading path:
```typescript
const value = row[i];
// Convert BigInt to Number, NULL to NaN for numeric compatibility
if (value === null) return NaN;
if (typeof value === "bigint") return Number(value);
return value as number;
```

### Anti-Patterns to Avoid

- **Querying all market data into memory:** Do NOT `SELECT * FROM market.spx_daily` and load everything into a Map. The whole point is to let DuckDB do the filtering. Use `WHERE date IN (...)` or `WHERE date BETWEEN ... AND ...` to fetch only the rows needed for the matched trade dates.
- **Removing loadBlock/Trade CSV loading:** Phase 53 scope is market data only. Trade data loading via `loadBlock` stays unchanged.
- **Using raw string interpolation for user values:** Use parameterized queries (`$1, $2, ...`) for any values that come from user input (block IDs, dates).
- **Forgetting to add sync middleware:** Without `withFullSync`, the DuckDB tables may be empty or stale when the tool runs. Every tool querying DuckDB must be wrapped.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Market data sync | Custom sync-before-query logic | `withFullSync` middleware | Already handles all sync scenarios including block + market data |
| DuckDB connection management | Custom connection pooling | `getConnection(baseDir)` singleton | Already handles lazy init, config, and graceful shutdown |
| Column-to-field mapping | Custom result-to-interface mapper | Direct index-based row access | DuckDB `runAndReadAll` returns rows as arrays; use `result.columnName(i)` for mapping |
| Date formatting | Custom date parser | `formatTradeDate()` already exists | Existing utility handles Eastern Time formatting correctly |

**Key insight:** The DuckDB infrastructure (connection, sync, schema, middleware) is fully built from Phases 41-52. Phase 53 should ONLY wire the three tools into it, not build any new infrastructure.

## Common Pitfalls

### Pitfall 1: Missing Sync Middleware

**What goes wrong:** Tool queries DuckDB but market tables are empty because data was never synced from CSV files.
**Why it happens:** Current tools bypass DuckDB entirely. Adding `getConnection` without `withFullSync` means the first call after server startup would query empty tables.
**How to avoid:** Wrap each tool handler with `withFullSync(baseDir, async (input) => { ... })`. This is the exact pattern used by `run_sql` and `describe_database`.
**Warning signs:** Tool returns 0 matched trades or "No market data available" errors even when CSV files exist.

### Pitfall 2: NULL vs NaN Behavioral Differences

**What goes wrong:** Market data fields that were `NaN` from CSV parsing become `null` from DuckDB queries. Code like `marketData.VIX_Close > 25` behaves differently: `NaN > 25` is `false` (correct), but `null > 25` is also `false` (correct in this case). However, `NaN + 5` is `NaN` while `null + 5` is `5`, so arithmetic can differ.
**Why it happens:** DuckDB represents missing data as SQL NULL, not NaN.
**How to avoid:** Either convert NULL to NaN at the query result level, or use `COALESCE(column, 'NaN')` in SQL (not recommended -- NaN is not a standard SQL literal). The safest approach is to handle NULL at the JavaScript level when reading result rows.
**Warning signs:** Statistical calculations produce different results after migration (e.g., averages that previously excluded NaN entries now include null-as-zero entries).

### Pitfall 3: Date Format Mismatch Between Trades and Market Data

**What goes wrong:** Trade dates are JavaScript `Date` objects formatted via `formatTradeDate()` to `YYYY-MM-DD`. Market data dates in DuckDB are stored as `VARCHAR` in `YYYY-MM-DD` format. If the formatting differs (e.g., timezone handling), JOINs or lookups produce no matches.
**Why it happens:** The CSV loading path used the same `parseTimestamp` function for both. When querying DuckDB, trades and market data use different date sources.
**How to avoid:** Continue using `formatTradeDate()` for trade dates and compare against the DuckDB `date` column which is already in `YYYY-MM-DD` format. Verify the match rate after migration is identical to the CSV path.
**Warning signs:** `unmatchedDates` array in `analyze_regime_performance` output is much larger after migration.

### Pitfall 4: Query Approach - Batch vs Row-by-Row

**What goes wrong:** Executing one DuckDB query per trade date is extremely slow for blocks with hundreds of trades.
**Why it happens:** Developer translates the Map.get() pattern to individual SELECT queries.
**How to avoid:** Collect all unique trade dates first, then execute a single query: `SELECT * FROM market.spx_daily WHERE date IN ($1, $2, ...)` or use a date range: `SELECT * FROM market.spx_daily WHERE date BETWEEN $1 AND $2`. Build the result Map in JavaScript from the batch result.
**Warning signs:** Tool takes many seconds for blocks with 100+ trades.

### Pitfall 5: BigInt Conversion

**What goes wrong:** DuckDB COUNT and some INTEGER columns return BigInt values. JSON serialization fails with `TypeError: Do not know how to serialize a BigInt`.
**Why it happens:** DuckDB's Node API returns JavaScript BigInt for integer types.
**How to avoid:** Convert BigInt to Number when reading result rows: `typeof value === "bigint" ? Number(value) : value`. This pattern is already used in `sql.ts` line 170.
**Warning signs:** `TypeError: Do not know how to serialize a BigInt` in tool response.

### Pitfall 6: Handler Signature Change with withFullSync

**What goes wrong:** `withFullSync` changes the handler signature. The middleware passes `(input, ctx)` where `ctx` includes `{ blockSyncResult, marketSyncResult, baseDir }`. The current handlers receive raw input only.
**Why it happens:** Different middleware patterns have different handler signatures.
**How to avoid:** The `withFullSync` middleware expects `handler: (input: TInput, ctx: FullSyncContext) => Promise<TOutput>`. The second parameter is optional to use -- the tools don't need the sync context, just the assurance that sync has run. But the handler signature must accept the second parameter.
**Warning signs:** TypeScript compilation errors about handler parameter mismatch.

## Code Examples

### Example 1: Migrating analyze_regime_performance (Daily Market Data Query)

```typescript
// BEFORE (CSV loading):
const { daily } = await getMarketData(baseDir);
// ... in loop:
const marketData = daily.get(tradeDate);

// AFTER (DuckDB query):
import { getConnection } from "../db/connection.js";
import { withFullSync } from "./middleware/sync-middleware.js";

// Wrap handler with sync middleware:
server.registerTool(
  "analyze_regime_performance",
  { description: "...", inputSchema: z.object({...}) },
  withFullSync(baseDir, async ({ blockId, segmentBy, strategy }) => {
    // Load trades (still via CSV - unchanged)
    const block = await loadBlock(baseDir, blockId);
    let trades = block.trades;
    // ... filter trades ...

    // Collect unique trade dates
    const tradeDates = [...new Set(
      trades.map(t => formatTradeDate(t.dateOpened))
    )];

    // Batch query DuckDB for matching market data
    const conn = await getConnection(baseDir);
    const placeholders = tradeDates.map((_, i) => `$${i + 1}`).join(", ");
    const result = await conn.runAndReadAll(
      `SELECT * FROM market.spx_daily WHERE date IN (${placeholders})`,
      tradeDates
    );

    // Build date-keyed lookup from results
    const daily = new Map<string, Record<string, unknown>>();
    const columnCount = result.columnCount;
    const colNames: string[] = [];
    for (let i = 0; i < columnCount; i++) {
      colNames.push(result.columnName(i));
    }
    for (const row of result.getRows()) {
      const record: Record<string, unknown> = {};
      for (let i = 0; i < columnCount; i++) {
        const val = row[i];
        record[colNames[i]] = typeof val === "bigint" ? Number(val) : val;
      }
      daily.set(record["date"] as string, record);
    }

    // Rest of logic uses daily.get(tradeDate) as before
    // But field access changes from marketData.VIX_Close to marketData["VIX_Close"]
    // (or cast to typed interface)
  })
);
```

### Example 2: Migrating calculate_orb (Intraday Checkpoint Query)

```typescript
// BEFORE (CSV loading):
const { intraday } = await getMarketData(baseDir);
// iterate over intraday Map entries in date range

// AFTER (DuckDB query):
const conn = await getConnection(baseDir);
const result = await conn.runAndReadAll(
  `SELECT * FROM market.spx_15min WHERE date BETWEEN $1 AND $2 ORDER BY date`,
  [startDate, endDate || startDate]
);

// Build results from query output
const colNames: string[] = [];
for (let i = 0; i < result.columnCount; i++) {
  colNames.push(result.columnName(i));
}
for (const row of result.getRows()) {
  const record: Record<string, unknown> = {};
  for (let i = 0; i < result.columnCount; i++) {
    const val = row[i];
    record[colNames[i]] = typeof val === "bigint" ? Number(val) : val;
  }
  // Process ORB from record fields...
}
```

### Example 3: Helper Function for Converting DuckDB Rows

```typescript
/**
 * Convert DuckDB query result to array of Record objects.
 * Handles BigInt -> Number conversion.
 * Returns column names and row objects.
 */
function resultToRecords(result: DuckDBResultReader): {
  columns: string[];
  records: Record<string, unknown>[];
} {
  const columnCount = result.columnCount;
  const columns: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    columns.push(result.columnName(i));
  }

  const records: Record<string, unknown>[] = [];
  for (const row of result.getRows()) {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < columnCount; i++) {
      const val = row[i];
      record[columns[i]] = typeof val === "bigint" ? Number(val) : val;
    }
    records.push(record);
  }

  return { columns, records };
}
```

### Example 4: Code to Remove (CSV Loading Infrastructure)

```typescript
// ALL of the following should be removed from market-data.ts:

// 1. Cache variables (lines 223-228)
let dailyDataCache: Map<string, DailyMarketData> | null = null;
let intradayDataCache: Map<string, Intraday15MinData> | null = null;
let highlowDataCache: Map<string, HighLowTimingData> | null = null;
let vixIntradayDataCache: Map<string, VixIntradayData> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// 2. CSV loading functions (lines 234-601)
function parseTimestamp(timestamp: number): string { ... }
function parseNum(value: string | undefined): number { ... }
async function loadDailyData(baseDir: string): Promise<Map<string, DailyMarketData>> { ... }
async function loadIntradayData(baseDir: string): Promise<Map<string, Intraday15MinData>> { ... }
async function loadHighLowData(baseDir: string): Promise<Map<string, HighLowTimingData>> { ... }
async function loadVixIntradayData(baseDir: string): Promise<Map<string, VixIntradayData>> { ... }
async function getMarketData(baseDir: string): Promise<{ ... }> { ... }

// 3. Type interfaces that were only used for CSV->Map typing
// Keep: DailyMarketData, Intraday15MinData (if still needed for type reference elsewhere)
// Remove: HighLowTimingData (spx_highlow is retired)
// Remove: VixIntradayData (not used by any of the 3 tools)
// Remove: MarketDataRecord, IntradayMarketData (not used after CSV removal)
```

## Detailed Migration Strategy Per Tool

### Tool 1: analyze_regime_performance

**Current data flow:**
1. `loadBlock(baseDir, blockId)` -> trades (CSV, stays as-is)
2. `getMarketData(baseDir)` -> `{ daily }` (CSV Map, REMOVE)
3. For each trade: `daily.get(formatTradeDate(trade.dateOpened))` -> DailyMarketData

**Migrated data flow:**
1. `loadBlock(baseDir, blockId)` -> trades (unchanged)
2. Collect unique trade dates
3. `getConnection(baseDir)` + batch query `market.spx_daily WHERE date IN (...)`
4. Build `Map<string, Record<string, unknown>>` from results
5. For each trade: `daily.get(formatTradeDate(trade.dateOpened))` -> Record

**Fields accessed from DailyMarketData:**
- `Vol_Regime` (segmentBy: "volRegime")
- `Term_Structure_State` (segmentBy: "termStructure")
- `Day_of_Week` (segmentBy: "dayOfWeek")
- `Gap_Pct` (segmentBy: "gapDirection")
- `Trend_Score` (segmentBy: "trendScore")

**Query optimization:** Only SELECT the fields needed for the requested `segmentBy` dimension, plus `date`. This is optional but reduces data transfer:
```sql
-- For volRegime:
SELECT date, Vol_Regime FROM market.spx_daily WHERE date IN (...)
-- For termStructure:
SELECT date, Term_Structure_State FROM market.spx_daily WHERE date IN (...)
```

**Alternatively:** Just `SELECT *` for simplicity since the row count is small (one per trade date).

### Tool 2: suggest_filters

**Current data flow:**
1. `loadBlock(baseDir, blockId)` -> trades (CSV, stays as-is)
2. `getMarketData(baseDir)` -> `{ daily }` (CSV Map, REMOVE)
3. For each trade: match market data, then test 20 filter conditions

**Migrated data flow:**
Same as analyze_regime_performance. The tool uses many DailyMarketData fields across its 20 filter definitions. Use `SELECT *` from `market.spx_daily` for the trade dates.

**Fields accessed:** Gap_Pct, VIX_Close, VIX_Spike_Pct, Term_Structure_State, Vol_Regime, Day_of_Week, Is_Opex, Trend_Score, Consecutive_Days, RSI_14

**Key consideration:** This tool accesses `t.market!` (the non-null assertion after filtering). After migration, the record type is `Record<string, unknown>`, so field access becomes `(t.market as Record<string, unknown>)["VIX_Close"] as number`. Consider creating a typed wrapper or keeping the DailyMarketData interface and mapping into it.

### Tool 3: calculate_orb

**Current data flow:**
1. `getMarketData(baseDir)` -> `{ intraday }` (CSV Map, REMOVE)
2. Iterate over all dates in range, look up checkpoint fields by name

**Migrated data flow:**
1. `getConnection(baseDir)` + query `market.spx_15min WHERE date BETWEEN $1 AND $2`
2. Iterate over result rows, access checkpoint fields by column name

**Key difference from tools 1 & 2:** This tool does NOT load trades. It queries intraday data directly by date range. The query is simpler.

**Fields accessed:** P_0930...P_1545 (checkpoint prices), close, open, high, low

## Type Strategy

The tools currently use strongly-typed interfaces (`DailyMarketData`, `Intraday15MinData`). After migration, DuckDB results come back as `unknown[]` rows. There are two approaches:

### Option A: Keep interfaces, map DuckDB rows into them

```typescript
// Map result row to DailyMarketData interface
const record: DailyMarketData = {
  date: row[dateIdx] as string,
  Vol_Regime: row[volRegimeIdx] as number ?? NaN,
  // ... etc for all 35 fields
};
```

**Pros:** Type safety, existing code works unchanged.
**Cons:** Brittle mapping (must keep in sync with schema), lots of boilerplate.

### Option B: Use Record<string, unknown> with runtime casts

```typescript
const record = resultToRecord(row, columns);
const volRegime = (record["Vol_Regime"] as number) ?? NaN;
```

**Pros:** No brittle mapping, automatically adapts to schema changes.
**Cons:** Loses compile-time type checking, more casts in business logic.

### Recommendation: Option B with a thin accessor helper

```typescript
function getNum(record: Record<string, unknown>, field: string): number {
  const val = record[field];
  if (val === null || val === undefined) return NaN;
  if (typeof val === "bigint") return Number(val);
  return val as number;
}

// Usage in tool:
const volRegime = getNum(marketData, "Vol_Regime");
```

This preserves the readability of field access without maintaining a parallel interface. The DailyMarketData interface can be kept as documentation but doesn't need to be mapped to.

## Removal Inventory

After all three tools are migrated, remove:

### Variables (market-data.ts lines 223-228)
- `dailyDataCache` - in-memory Map cache
- `intradayDataCache` - in-memory Map cache
- `highlowDataCache` - in-memory Map cache
- `vixIntradayDataCache` - in-memory Map cache
- `cacheTimestamp` - TTL timestamp
- `CACHE_TTL_MS` - 5-minute TTL constant

### Functions (market-data.ts lines 234-601)
- `parseTimestamp()` - TradingView timestamp to YYYY-MM-DD
- `parseNum()` - string to number with NaN handling
- `loadDailyData()` - reads spx_daily.csv into Map
- `loadIntradayData()` - reads spx_15min.csv into Map
- `loadHighLowData()` - reads spx_highlow.csv into Map (already dead code after Phase 52)
- `loadVixIntradayData()` - reads vix_intraday.csv into Map
- `getMarketData()` - caching wrapper for all CSV loading

### Imports to remove (market-data.ts lines 15-16)
- `import * as fs from "fs/promises"` - no longer reading CSV files
- `import * as path from "path"` - no longer building file paths

### Imports to add (market-data.ts)
- `import { getConnection } from "../db/connection.js"`
- `import { withFullSync } from "./middleware/sync-middleware.js"`

### Type interfaces to evaluate
- `DailyMarketData` - Keep as documentation/export, or remove if nothing external uses it
- `Intraday15MinData` - Keep as documentation/export, or remove
- `HighLowTimingData` - REMOVE (spx_highlow retired in Phase 52)
- `VixIntradayData` - Keep if exported for other tools, remove if only used by CSV loading
- `MarketDataRecord` - REMOVE (was the combined CSV result type)
- `IntradayMarketData` - REMOVE (deprecated alias)

### Check for external consumers
Before removing type interfaces, verify they aren't imported elsewhere:
- `DailyMarketData` is exported and might be imported by other files
- Search the codebase for `from "./market-data"` or `from "../tools/market-data"`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSV files read into in-memory Maps with 5-min TTL cache | DuckDB queries via sync middleware | Phase 53 (this phase) | Eliminates redundant CSV parsing, single source of truth |
| No sync guarantee for market data tools | `withFullSync` ensures data is current | Phase 53 (this phase) | Market data tools get same freshness as `run_sql` |
| 4 CSV files loaded (daily, 15min, highlow, vix) | 0 CSV files loaded by tools (all via DuckDB) | Phase 53 (this phase) | Simpler code, no file I/O in tool handlers |

**Deprecated/outdated after Phase 53:**
- `getMarketData()` function: Replaced by DuckDB queries
- In-memory CSV cache (`dailyDataCache`, etc.): Replaced by DuckDB (which has its own caching)
- `loadDailyData()`, `loadIntradayData()`, etc.: No longer needed

## Open Questions

1. **Should DailyMarketData and Intraday15MinData interfaces be preserved as exports?**
   - What we know: They are defined in market-data.ts and exported. They may be imported by external code or used as type documentation.
   - What's unclear: Whether any other file imports these types.
   - Recommendation: Search the codebase for imports. If unused externally, remove them to keep the file clean. If used, keep them as pure type definitions (no runtime impact).

2. **Should the utility functions (formatTradeDate, getVolRegimeLabel, etc.) remain in market-data.ts?**
   - What we know: `formatTradeDate` is used by the tools and has no external callers. The label functions (`getVolRegimeLabel`, `getTermStructureLabel`, `getDayLabel`) are used by `analyze_regime_performance` only.
   - What's unclear: Whether to inline them or keep them as separate utility functions.
   - Recommendation: Keep them in market-data.ts. They are pure functions with no dependencies on CSV loading infrastructure.

3. **Should the version be bumped?**
   - What we know: CLAUDE.md says to bump MCP server version when MCP functionality changes. Tools will return identical results but use different internal implementation.
   - What's unclear: Whether internal refactoring without behavioral changes warrants a version bump.
   - Recommendation: Yes, bump patch version to 0.10.1. The removal of CSV loading code changes operational behavior (no more filesystem reads for market data, sync middleware adds a sync check), even if output is identical.

## Sources

### Primary (HIGH confidence)

- **Codebase inspection** - All relevant MCP server files read and analyzed:
  - `packages/mcp-server/src/tools/market-data.ts` (1279 lines - full CSV loading code + 3 tool implementations)
  - `packages/mcp-server/src/tools/sql.ts` (291 lines - DuckDB query pattern reference)
  - `packages/mcp-server/src/tools/schema.ts` (254 lines - sync middleware + DuckDB introspection pattern)
  - `packages/mcp-server/src/tools/middleware/sync-middleware.ts` (148 lines - withFullSync implementation)
  - `packages/mcp-server/src/db/connection.ts` (138 lines - getConnection singleton)
  - `packages/mcp-server/src/db/schemas.ts` (283 lines - 55-column spx_daily schema from Phase 52)
  - `packages/mcp-server/src/sync/market-sync.ts` (349 lines - mergeMarketDataRows, sync flow)
  - `packages/mcp-server/src/utils/block-loader.ts` (1566 lines - loadBlock for trade data)
  - `packages/mcp-server/src/index.ts` (318 lines - tool registration order)
  - `packages/mcp-server/tests/integration/sync-layer.test.ts` (100 lines - DuckDB test patterns)
- **Phase 52 research and verification** - Confirmed DuckDB schema, migration logic, and table structure
- **DuckDB @duckdb/node-api v1.4.4-r.1** - Verified API patterns: `runAndReadAll()`, `getRows()`, `columnName()`, `columnCount`, parameterized queries

### Secondary (MEDIUM confidence)

- None needed -- this is a purely internal refactoring with well-understood patterns already in the codebase.

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all existing code
- Architecture: HIGH - All files read, all query patterns verified from existing tools, sync middleware behavior understood
- Migration strategy: HIGH - Exact field access patterns documented per-tool, DuckDB query equivalents verified
- Pitfalls: HIGH - NULL vs NaN, sync middleware, BigInt conversion all verified from existing codebase patterns
- Removal inventory: HIGH - Every function, variable, and import to remove explicitly listed with line numbers

**Research date:** 2026-02-07
**Valid until:** 2026-04-07 (stable -- internal refactoring of well-established patterns)
