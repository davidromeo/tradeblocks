# Phase 57: Restore enrich_trades - Research

**Researched:** 2026-02-08
**Domain:** MCP tool development / DuckDB lookahead-free joins / trade enrichment
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Output structure:**
- Inline per trade (not separate date-keyed lookup) -- each trade object includes its market context directly
- Fields grouped by temporal availability within each trade:
  - `entryContext.sameDay` -- open-known fields (Gap_Pct, VIX_Open, etc.) using same-day values
  - `entryContext.priorDay` -- close-derived fields (prev_VIX_Close, prev_RSI_14, etc.) using prior trading day values
  - `outcomeFields` -- same-day close-derived fields, only when `includeOutcomeFields=true`
- Top-level metadata following universal MCP pattern: `blockId`, `strategy`, `lagNote`, matching stats (`tradesTotal`, `tradesMatched`, `unmatchedDates`)
- Summary with lagNote modeled on suggest_filters' comprehensive format (lists which fields are lagged and why)
- Uses `createToolOutput(summary, data)` like all other tools

**Outcome fields behavior:**
- `includeOutcomeFields` defaults to false (safe by default) -- user must opt in
- Outcome fields appear in a separate `outcomeFields` section per trade (not inline with flags) -- makes the lookahead boundary structural
- Warning surfaced in both the top-level `lagNote` AND a `lookaheadWarning` field when outcome fields are included
- Aligns with "data-not-interpretation" ethos -- provide the data with clear provenance, let the consumer decide

**Filtering & pagination:**
- Simple params only: blockId (required), strategy (exact match), startDate/endDate -- consistent with analyze_regime_performance and suggest_filters
- No filter expressions -- filter_curve already handles that; enrich_trades is for data access, not analysis
- Default limit 50, max 500 -- test data shows ~850 trades per block, so 50 is manageable for LLM context
- Response includes `totalTrades`, `returned`, `offset`, `hasMore` pagination metadata
- Follows the `limit`/`offset` pattern used by list_blocks and run_sql

**Field selection:**
- Always return full spx_daily market context (all 55 fields) -- no field selection parameter
- LLM consumer can ignore fields it doesn't need; the full context enables richer analysis
- Uses the application-level join pattern from Phase 56: load trades from IndexedDB, query DuckDB with buildLookaheadFreeQuery(), match by date in memory

### Claude's Discretion
- Exact field grouping within entryContext (which fields in sameDay vs priorDay -- derived from OPEN_KNOWN_FIELDS, CLOSE_KNOWN_FIELDS, STATIC_FIELDS)
- Summary text format and lagNote wording
- How static fields (Day_of_Week, Month, Is_Opex) are grouped -- likely under sameDay since they're known before market open
- Error handling for edge cases (no market data for a date, empty blocks)

### Deferred Ideas (OUT OF SCOPE)
- **Intraday enrichment (spx_15min + vix_intraday)** -- requires time-based matching with no existing codebase precedent. Wide-format tables (columns per checkpoint like P_0930, VIX_1000) need dynamic column selection or UNPIVOT. Different temporal semantics (checkpoints are known at their timestamp, not open/close classification). Deserves its own phase with proper design.
</user_constraints>

## Summary

This phase restores the `enrich_trades` MCP tool that was removed in v0.6.0 (Phase 45) when it was a simple JOIN replaced by `run_sql`. The new version adds genuine value by enforcing lookahead-free temporal joins -- something `run_sql` cannot do by default. Users who naively `JOIN ON date_opened = date` would get same-day close-derived values (VIX_Close, RSI_14, etc.) that weren't available at trade entry time.

The implementation follows the proven pattern from Phase 56: load trades from IndexedDB via `loadBlock()`, collect unique trade dates, call `buildLookaheadFreeQuery()` to get a DuckDB CTE with LAG() for close-derived fields, match results by date in memory, and structure the output with clear temporal provenance. The existing `analyze_regime_performance` and `suggest_filters` tools in `market-data.ts` demonstrate this exact pattern -- `enrich_trades` extends it by returning the raw enriched data per-trade rather than computing aggregate statistics.

The key design challenge is structuring the output to clearly communicate temporal boundaries: same-day open-known fields (8 fields), prior-day close-derived fields (44 fields), static fields (3 fields), and optional outcome fields (same-day close values with a lookahead warning). The tool also needs pagination since blocks can have 800+ trades, but the default limit of 50 keeps LLM context manageable.

**Primary recommendation:** Implement as a single new tool registration in `market-data.ts`, reusing `formatTradeDate()`, `resultToRecords()`, `getNum()`, `loadBlock()`, `buildLookaheadFreeQuery()`, and `createToolOutput()` -- all of which are already available in that module or its imports.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.0.0 | Tool input schema validation | Used by all MCP tools in the codebase |
| @modelcontextprotocol/sdk | ^1.11.0 | MCP server framework | `server.registerTool()` pattern |
| @duckdb/node-api | ^1.4.4-r.1 | DuckDB queries for market data | Existing connection manager in `db/connection.ts` |
| @tradeblocks/lib | workspace | Trade type definitions | `Trade` interface, trade loading |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| field-timing.ts | internal | `buildLookaheadFreeQuery()`, field sets | Generating lookahead-free SQL CTE |
| block-loader.ts | internal | `loadBlock()` | Loading trades from IndexedDB/CSV |
| output-formatter.ts | internal | `createToolOutput()` | Structuring MCP response |
| sync-middleware.ts | internal | `withSyncedBlock()` | Pre-query block sync |
| shared/filters.ts | internal | `filterByStrategy()`, `filterByDateRange()` | Trade filtering before enrichment |

### Alternatives Considered
N/A -- all decisions are locked. The implementation stack is entirely within the existing codebase.

**Installation:** No new packages required. All dependencies already exist.

## Architecture Patterns

### Recommended Project Structure
```
packages/mcp-server/src/
├── tools/
│   └── market-data.ts          # Add enrich_trades here (alongside analyze_regime_performance, suggest_filters, calculate_orb)
├── utils/
│   ├── field-timing.ts         # OPEN_KNOWN_FIELDS, CLOSE_KNOWN_FIELDS, STATIC_FIELDS, buildLookaheadFreeQuery()
│   ├── schema-metadata.ts      # SCHEMA_DESCRIPTIONS with timing annotations
│   ├── block-loader.ts         # loadBlock()
│   └── output-formatter.ts     # createToolOutput()
└── test-exports.ts             # Add new exports if needed for testing
```

### Pattern 1: Application-Level Join (from Phase 56)
**What:** Load trades from filesystem/IndexedDB, query DuckDB for market data with LAG CTE, match by date in memory.
**When to use:** Any tool that combines trade data with market data while enforcing lookahead-free semantics.
**Example (from `analyze_regime_performance` in market-data.ts, lines 257-285):**
```typescript
// 1. Load block and filter trades
const block = await loadBlock(baseDir, blockId);
let trades = block.trades;
if (strategy) {
  trades = trades.filter(t => t.strategy.toLowerCase() === strategy.toLowerCase());
}

// 2. Collect unique trade dates
const tradeDates = [...new Set(trades.map(t => formatTradeDate(t.dateOpened)))];

// 3. Query DuckDB with lookahead-free CTE
const conn = await getConnection(baseDir);
const { sql, params } = buildLookaheadFreeQuery(tradeDates);
const dailyResult = await conn.runAndReadAll(sql, params);
const dailyRecords = resultToRecords(dailyResult);

// 4. Build date -> market data map
const daily = new Map<string, Record<string, unknown>>();
for (const record of dailyRecords) {
  daily.set(record["date"] as string, record);
}

// 5. Match trades to market data
for (const trade of trades) {
  const tradeDate = formatTradeDate(trade.dateOpened);
  const marketData = daily.get(tradeDate);
  if (!marketData) { unmatchedDates.push(tradeDate); continue; }
  // ... process enriched trade
}
```

### Pattern 2: createToolOutput() Response Structure
**What:** All MCP tools return a text summary + structured JSON resource.
**When to use:** Every tool response.
**Example:**
```typescript
return createToolOutput(summary, {
  blockId,
  lagNote,
  strategy: strategy || null,
  tradesTotal: trades.length,
  tradesMatched: totalMatched,
  // ... data payload
});
```

### Pattern 3: withSyncedBlock() Middleware
**What:** Wraps tool handler to sync block data before execution.
**When to use:** Tools that operate on a single block (identified by `blockId` in input).
**Example:**
```typescript
server.registerTool(
  "enrich_trades",
  { description: "...", inputSchema: z.object({ blockId: z.string(), ... }) },
  withSyncedBlock(baseDir, async ({ blockId, ... }) => {
    // Block data is synced before this runs
  })
);
```

### Pattern 4: Outcome Fields as Separate Section
**What:** When `includeOutcomeFields=true`, return same-day close-derived values in a structurally separate `outcomeFields` object per trade, with warnings at both per-trade and top-level.
**When to use:** Only for enrich_trades outcome mode.
**Rationale:** The structural separation makes it impossible to accidentally mix lookahead-free entry context with outcome data. This is stronger than using inline boolean flags.

### Pattern 5: Pagination Metadata
**What:** Response includes `totalTrades`, `returned`, `offset`, `hasMore` for cursor-based pagination.
**When to use:** Tools returning variable-length lists.
**Example (from list_blocks):**
```typescript
const total = allTrades.length;
const paginated = allTrades.slice(offset, offset + limit);
return createToolOutput(summary, {
  totalTrades: total,
  returned: paginated.length,
  offset,
  hasMore: offset + limit < total,
  trades: paginated,
});
```

### Anti-Patterns to Avoid
- **Naive JOIN on date:** `JOIN market.spx_daily m ON t.date_opened = m.date` gives same-day close-derived values. This is exactly what enrich_trades prevents.
- **Hardcoded field names:** Field classification must come from `OPEN_KNOWN_FIELDS`, `CLOSE_KNOWN_FIELDS`, `STATIC_FIELDS` sets (derived from `SCHEMA_DESCRIPTIONS` timing annotations). Never hardcode which fields are open/close/static.
- **Mixing temporal boundaries inline:** Outcome fields must be in a separate section, not mixed with entry context.
- **Not handling unmatched dates:** Some trade dates may not have market data (holidays, pre-market data range). Track and report `unmatchedDates`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lookahead-free SQL | Custom SQL per field | `buildLookaheadFreeQuery()` | Already handles all 55 fields with correct LAG CTE |
| Field classification | Hardcoded lists | `OPEN_KNOWN_FIELDS`, `CLOSE_KNOWN_FIELDS`, `STATIC_FIELDS` | Derived from `SCHEMA_DESCRIPTIONS` timing annotations |
| Trade date formatting | Custom date parser | `formatTradeDate()` in market-data.ts | Handles Eastern Time correctly |
| DuckDB result parsing | Custom row iteration | `resultToRecords()` in market-data.ts | Handles BigInt conversion |
| Block loading | Direct file reads | `loadBlock()` from block-loader.ts | Handles CSV mappings, metadata, discovery |
| Trade filtering | Custom filter logic | `filterByStrategy()`, `filterByDateRange()` from shared/filters.ts | Already tested, handles edge cases |
| Response formatting | Manual JSON/text | `createToolOutput()` | Universal MCP response pattern |

**Key insight:** The Phase 55-56 infrastructure (`field-timing.ts`, `buildLookaheadFreeQuery()`) and the existing market-data.ts utilities (`formatTradeDate()`, `resultToRecords()`, `getNum()`) provide 90% of what enrich_trades needs. The only new code is the output structuring logic that splits market fields into `entryContext.sameDay`, `entryContext.priorDay`, and `outcomeFields`.

## Common Pitfalls

### Pitfall 1: Outcome Fields Need a Second Query
**What goes wrong:** `buildLookaheadFreeQuery()` only returns open-known fields (same-day) and LAG'd close-derived fields (prior-day). For outcome fields, you need the *same-day* close-derived values, which the existing CTE deliberately excludes.
**Why it happens:** The LAG CTE is designed to prevent lookahead bias, so it replaces close-derived columns with `prev_*` versions. Outcome fields need the original (non-lagged) values for the same date.
**How to avoid:** When `includeOutcomeFields=true`, run a second simple query: `SELECT date, <close_known_fields> FROM market.spx_daily WHERE date IN (...)` to get same-day close values. Or build a variant query that includes both lagged and unlagged versions.
**Warning signs:** If outcome fields show `prev_*` values, the wrong data is being used.
**Recommended approach:** Build a separate `buildOutcomeQuery()` that returns same-day close-derived fields for the trade dates, OR modify the enrichment loop to extract outcome values from a parallel query result. The `CLOSE_KNOWN_FIELDS` set tells you exactly which fields need this treatment.

### Pitfall 2: formatTradeDate Scope
**What goes wrong:** `formatTradeDate()` is currently a module-level function in `market-data.ts` (not exported). enrich_trades in the same file can use it directly. If the tool were in a separate file, it would need to be extracted to a shared utility.
**Why it happens:** The function was only needed by two tools before (analyze_regime_performance, suggest_filters), both in market-data.ts.
**How to avoid:** Since enrich_trades will live in market-data.ts (same file as the other market data tools), this is not an issue. The function is already accessible.
**Warning signs:** Import errors if the tool is placed in a different file.

### Pitfall 3: Pagination Interacts with Filtering
**What goes wrong:** If you paginate BEFORE filtering by strategy/date, the offset/limit refer to unfiltered trades. If you paginate AFTER filtering, offset/limit refer to the filtered set.
**Why it happens:** Ambiguity in when to apply offset/limit.
**How to avoid:** Filter first, then paginate. The `totalTrades` count should reflect the filtered total, and `offset`/`hasMore` should refer to the filtered set.
**Warning signs:** `totalTrades` doesn't match expected count when strategy filter is applied.

### Pitfall 4: NaN Market Data Values
**What goes wrong:** Some market data fields may be NULL/NaN for certain dates (e.g., VIX9D_Close may not be available for older dates). Passing NaN through to JSON output creates invalid JSON.
**Why it happens:** DuckDB returns NULL for missing data, which becomes NaN through `getNum()`.
**How to avoid:** When building the per-trade market context, use `null` for NaN values in the JSON output. The `getNum()` helper returns NaN, but JSON.stringify() converts NaN to null. Verify this behavior, or explicitly replace NaN with null.
**Warning signs:** JSON parse errors in consumers, or unexpected "null" string values.

### Pitfall 5: Static Fields Grouping
**What goes wrong:** Day_of_Week, Month, Is_Opex are `static` timing, not `open`. If you only check `OPEN_KNOWN_FIELDS`, they'll be missing from the same-day section.
**Why it happens:** Three-way classification (open/close/static) but two-way output grouping (sameDay/priorDay).
**How to avoid:** Group static fields WITH open-known fields in the `entryContext.sameDay` section, since both are known before market open. The context doc notes: "Static fields likely under sameDay since they're known before market open."
**Warning signs:** Day_of_Week, Month, Is_Opex missing from output.

## Code Examples

### Example 1: Field Grouping Logic
```typescript
// Split market data record into temporal sections
function buildEntryContext(marketData: Record<string, unknown>): {
  sameDay: Record<string, unknown>;
  priorDay: Record<string, unknown>;
} {
  const sameDay: Record<string, unknown> = {};
  const priorDay: Record<string, unknown> = {};

  // Open-known fields: same-day values
  for (const field of OPEN_KNOWN_FIELDS) {
    const val = marketData[field];
    sameDay[field] = val === undefined ? null : (typeof val === 'bigint' ? Number(val) : val);
  }

  // Static fields: also same-day (known before market open)
  for (const field of STATIC_FIELDS) {
    const val = marketData[field];
    sameDay[field] = val === undefined ? null : (typeof val === 'bigint' ? Number(val) : val);
  }

  // Close-derived fields: prior trading day values (from LAG CTE)
  for (const field of CLOSE_KNOWN_FIELDS) {
    const prevKey = `prev_${field}`;
    const val = marketData[prevKey];
    priorDay[field] = val === undefined || val === null ? null : (typeof val === 'bigint' ? Number(val) : val);
  }

  return { sameDay, priorDay };
}
```

### Example 2: Outcome Fields Query
```typescript
// For outcome fields, query same-day close-derived values (no LAG)
function buildOutcomeQuery(tradeDates: string[]): { sql: string; params: string[] } {
  const closeColumns = [...CLOSE_KNOWN_FIELDS].map(f => `"${f}"`).join(', ');
  const placeholders = tradeDates.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `SELECT date, ${closeColumns}
    FROM market.spx_daily
    WHERE date IN (${placeholders})`;

  return { sql, params: tradeDates };
}
```

### Example 3: Enriched Trade Output Shape
```typescript
// Per-trade output structure
interface EnrichedTradeOutput {
  // Core trade fields
  dateOpened: string;    // YYYY-MM-DD
  timeOpened: string;
  strategy: string;
  legs: string;
  pl: number;
  numContracts: number;
  reasonForClose?: string;

  // Market context at entry time
  entryContext: {
    sameDay: Record<string, unknown>;   // 8 open-known + 3 static = 11 fields
    priorDay: Record<string, unknown>;  // 44 close-derived fields (prev_* values)
  };

  // Optional: same-day close values (lookahead)
  outcomeFields?: Record<string, unknown>;  // 44 close-derived fields (same-day values)
}
```

### Example 4: Pagination Implementation
```typescript
// After filtering, apply pagination
const filtered = filterByDateRange(filterByStrategy(trades, strategy), startDate, endDate);
const total = filtered.length;
const paginated = filtered.slice(offset, offset + limit);

// ... enrich paginated trades only (not all filtered trades)
// This avoids querying DuckDB for dates we won't return
const tradeDates = [...new Set(paginated.map(t => formatTradeDate(t.dateOpened)))];
```

### Example 5: Tool Registration Shape
```typescript
server.registerTool(
  "enrich_trades",
  {
    description: "Enrich trades with market context using correct temporal joins. " +
      "Open-known fields (Gap_Pct, VIX_Open) use same-day values. " +
      "Close-derived fields (VIX_Close, RSI_14, Vol_Regime) use prior trading day values to prevent lookahead bias. " +
      "Use includeOutcomeFields=true for post-hoc analysis (with clear warning).",
    inputSchema: z.object({
      blockId: z.string().describe("Block ID to enrich"),
      strategy: z.string().optional().describe("Filter to specific strategy (exact match)"),
      startDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
      endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
      includeOutcomeFields: z.boolean().default(false).describe(
        "Include same-day close values (lookahead). Defaults to false for safety."
      ),
      limit: z.number().min(1).max(500).default(50).describe("Max trades to return (default: 50, max: 500)"),
      offset: z.number().min(0).default(0).describe("Pagination offset (default: 0)"),
    }),
  },
  withSyncedBlock(baseDir, async ({ blockId, strategy, startDate, endDate, includeOutcomeFields, limit, offset }) => {
    // ... implementation
  })
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Old enrich_trades: naive `JOIN market.spx_daily m ON date_opened = date` | Removed in v0.6.0 (replaced by run_sql) | Phase 45, 2026-02-04 | Users must write raw SQL, still get lookahead bias |
| run_sql: manual JOIN (no temporal safety) | New enrich_trades: buildLookaheadFreeQuery() with LAG CTE | Phase 57 (this phase) | Enforces correct temporal joins by default |
| Per-field manual classification | SCHEMA_DESCRIPTIONS timing annotations + derived sets | Phase 55, 2026-02-07 | Classification is metadata-driven, not hardcoded |

**Deprecated/outdated:**
- Old `enrich_trades` (v0.5.x): Was a thin wrapper around `JOIN`. Removed because run_sql could do the same thing. The new version adds temporal-join enforcement that run_sql cannot provide.

## Open Questions

1. **JSON NaN handling**
   - What we know: `getNum()` returns NaN for null/undefined DuckDB values. `JSON.stringify()` converts NaN to `null`.
   - What's unclear: Whether all consumers handle null gracefully for numeric fields.
   - Recommendation: Explicitly replace NaN with null before JSON serialization for safety. A simple `v === v ? v : null` check (NaN !== NaN) works.

2. **Outcome fields: same query or separate query?**
   - What we know: `buildLookaheadFreeQuery()` returns prev_* for close-derived fields. Outcome needs same-day values.
   - What's unclear: Whether it's better to run a second simple SELECT or modify the CTE to include both lagged and unlagged columns.
   - Recommendation: Run a second simple query only when `includeOutcomeFields=true`. This keeps the common path (no outcome fields) at one query and avoids making the CTE more complex. The second query is trivial: `SELECT date, <close_columns> FROM market.spx_daily WHERE date IN (...)`.

3. **Trade field selection in output**
   - What we know: The decision says "inline per trade" with market context. Need to decide which trade fields to include.
   - What's unclear: Whether to include ALL trade fields or a curated subset.
   - Recommendation: Include the most analytically useful trade fields: `dateOpened`, `timeOpened`, `strategy`, `legs`, `pl`, `numContracts`, `premium`, `reasonForClose`, plus commissions. Omit internal fields like `fundsAtClose`, `marginReq`, `syntheticCapitalRatio`. This balances context richness with output size (especially at 50+ trades).

## Sources

### Primary (HIGH confidence)
- `packages/mcp-server/src/tools/market-data.ts` -- Full implementation of analyze_regime_performance, suggest_filters, calculate_orb (the exact patterns to follow)
- `packages/mcp-server/src/utils/field-timing.ts` -- buildLookaheadFreeQuery(), OPEN_KNOWN_FIELDS (8), CLOSE_KNOWN_FIELDS (44), STATIC_FIELDS (3)
- `packages/mcp-server/src/utils/schema-metadata.ts` -- SCHEMA_DESCRIPTIONS with all 55 spx_daily field timing annotations
- `packages/mcp-server/src/utils/block-loader.ts` -- loadBlock(), LoadedBlock interface
- `packages/mcp-server/src/utils/output-formatter.ts` -- createToolOutput()
- `packages/mcp-server/src/tools/middleware/sync-middleware.ts` -- withSyncedBlock()
- `packages/mcp-server/src/tools/shared/filters.ts` -- filterByStrategy(), filterByDateRange()
- `packages/mcp-server/tests/unit/field-timing.test.ts` -- Field classification tests (8 open, 44 close, 3 static)
- `packages/lib/models/trade.ts` -- Trade interface
- Git commit `e72fd5d` -- Old enrich_trades removal (Phase 45)

### Secondary (MEDIUM confidence)
- `packages/mcp-server/src/index.ts` -- Tool registration flow (registerMarketDataTools is where enrich_trades will be registered)
- `packages/mcp-server/src/tools/blocks/core.ts` -- list_blocks pagination pattern, get_statistics filter pattern

### Tertiary (LOW confidence)
None -- all findings verified from codebase sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in use in the codebase, no new dependencies
- Architecture: HIGH -- Exact patterns proven in analyze_regime_performance and suggest_filters (Phase 56)
- Pitfalls: HIGH -- Identified from direct code reading and the Phase 56 split-join implementation
- Output structure: HIGH -- Locked by CONTEXT.md decisions, code examples derived from existing field sets

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable -- no external dependencies, all internal patterns)
