# Phase 58: Schema Metadata + Documentation - Research

**Researched:** 2026-02-08
**Domain:** MCP schema discovery, lookahead bias documentation, DuckDB temporal query patterns
**Confidence:** HIGH

## Summary

Phase 58 is a documentation-focused phase that surfaces the temporal field classification system (built in Phases 55-57) through the `describe_database` tool's output, so that users writing ad-hoc `run_sql` queries get the same lookahead bias protection that the purpose-built tools now have.

The existing infrastructure is fully mature. The `timing` property already exists on every `spx_daily` column in `SCHEMA_DESCRIPTIONS` (schema-metadata.ts), the `OPEN_KNOWN_FIELDS`, `CLOSE_KNOWN_FIELDS`, and `STATIC_FIELDS` derived sets exist in `field-timing.ts`, and the `buildLookaheadFreeQuery()` CTE builder produces correct SQL. What is missing is: (1) the `describe_database` tool output does not include the `timing` property on column info, (2) the example queries use naive same-day JOINs without temporal awareness, and (3) there is no copy-paste LAG() CTE template in the output.

**Primary recommendation:** Extend the `ColumnInfo` interface in schema.ts to include an optional `timing` field, update example queries in schema-metadata.ts to use lag-aware patterns, and add a new `lagTemplate` section to the `describe_database` output.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Implementation language | Existing codebase |
| zod | 3.x | Tool input schema validation | Already used in all MCP tools |
| @duckdb/node-api | Current | DuckDB queries | Already used for all market data |

### Supporting

No new libraries needed. This phase modifies existing code only.

## Architecture Patterns

### Files to Modify

```
packages/mcp-server/src/
  tools/schema.ts           # ColumnInfo interface + output builder
  utils/schema-metadata.ts  # EXAMPLE_QUERIES content + new LAG template
```

### Pattern 1: Extend ColumnInfo with timing

**What:** Add optional `timing` property to `ColumnInfo` interface (schema.ts line 24-30) and populate it from `ColumnDescription.timing` in the column mapping loop (line 145-157).

**Current code (schema.ts line 24-30):**
```typescript
interface ColumnInfo {
  name: string;
  type: string;
  description: string;
  nullable: boolean;
  hypothesis: boolean;
}
```

**Target:**
```typescript
interface ColumnInfo {
  name: string;
  type: string;
  description: string;
  nullable: boolean;
  hypothesis: boolean;
  timing?: 'open' | 'close' | 'static';
}
```

**Source mapping (schema.ts line 145-157):** Add `timing: colDesc?.timing` to the return object alongside `hypothesis: colDesc?.hypothesis || false`.

### Pattern 2: Replace Naive Example Queries with Lag-Aware Patterns

**What:** The `EXAMPLE_QUERIES` in schema-metadata.ts (lines 815-1023) contain JOIN and hypothesis examples that use naive `t.date_opened = m.date` JOINs reading close-derived fields as same-day values. These must be updated to use the LAG CTE pattern for close-derived fields.

**Current naive JOIN example (line 884-892):**
```sql
SELECT
  t.date_opened, t.strategy, t.pl,
  m.VIX_Close, m.Vol_Regime, m.Total_Return_Pct
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
ORDER BY t.date_opened DESC
```

**Problem:** `VIX_Close`, `Vol_Regime`, and `Total_Return_Pct` are all close-derived (timing='close'). Using them same-day introduces lookahead bias.

**Fix:** Replace with lag-aware CTE in the example, using the same WITH lagged AS pattern that buildLookaheadFreeQuery produces.

### Pattern 3: LAG() CTE Template in Output

**What:** Add a pre-built, copy-paste LAG() CTE template to the `describe_database` output. This template should be a reusable SQL block that users can adapt for their own queries.

**Where to add:** New property on the `ExampleQueries` interface, or a separate `lagTemplate` field on `DatabaseSchemaOutput`. The template should include the WITH lagged AS CTE pattern with representative open/close/static fields.

**Generated vs hardcoded:** The template can be dynamically generated from `OPEN_KNOWN_FIELDS`, `CLOSE_KNOWN_FIELDS`, and `STATIC_FIELDS` at module load time, ensuring it stays in sync with schema changes. Import the sets from field-timing.ts into schema-metadata.ts or schema.ts.

### Anti-Patterns to Avoid

- **Hardcoding field names in the LAG template:** The field-timing.ts module already derives fields from SCHEMA_DESCRIPTIONS. The template should also derive from the same source to stay in sync automatically.
- **Making example queries overly verbose:** The LAG CTE template can be a single reusable block; individual example queries should reference it by name or show the complete pattern only once.
- **Breaking the JSON output structure:** The `DatabaseSchemaOutput` interface is what downstream consumers (Claude) parse. Adding new fields must be additive, never removing existing ones.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Field classification lists | Hardcoded arrays of field names | `OPEN_KNOWN_FIELDS`, `CLOSE_KNOWN_FIELDS`, `STATIC_FIELDS` from field-timing.ts | Already derived from SCHEMA_DESCRIPTIONS, guaranteed in sync |
| LAG CTE SQL | Manually written SQL string | `buildLookaheadFreeQuery()` pattern from field-timing.ts | Already tested, handles quoting and parameterization |

**Key insight:** The LAG template for describe_database is documentation-only SQL (not executed), so it can be a static string -- but it should be programmatically generated from the same field sets to prevent drift.

## Common Pitfalls

### Pitfall 1: Circular Import Between schema-metadata.ts and field-timing.ts

**What goes wrong:** field-timing.ts imports from schema-metadata.ts. If schema-metadata.ts imports from field-timing.ts to generate the LAG template, you get a circular dependency.

**Why it happens:** The LAG template needs the field sets, which are in field-timing.ts, which imports SCHEMA_DESCRIPTIONS from schema-metadata.ts.

**How to avoid:** Generate the LAG template in schema.ts (the tool file) which already imports from both modules. Or generate it lazily at tool registration time rather than at module load time.

**Warning signs:** TypeScript compile errors or undefined values at import time.

### Pitfall 2: Example Queries Becoming Too Long

**What goes wrong:** Full LAG CTE patterns are verbose (44 close fields). If every example query includes the full CTE, the describe_database output becomes massive.

**Why it happens:** Trying to be comprehensive in every example.

**How to avoid:** Include one complete LAG CTE template as a reference, then have example queries reference a simplified version or say "use the LAG template above." Or show a truncated CTE with a comment like `-- ... all close-derived fields ...`.

**Warning signs:** describe_database output exceeding token limits in Claude conversations.

### Pitfall 3: Not Updating the ExampleQueries Type

**What goes wrong:** Adding a new section (like `lagTemplate`) without updating the TypeScript interfaces causes type errors.

**Why it happens:** ExampleQueries has typed categories (basic, joins, hypothesis).

**How to avoid:** Either add a new property to ExampleQueries, or add the template as a separate field on DatabaseSchemaOutput.

### Pitfall 4: Forgetting to Bump MCP Server Version

**What goes wrong:** describe_database output changes but version stays at 1.1.0.

**How to avoid:** Bump to 1.2.0 (minor: new schema discovery features, non-breaking).

## Code Examples

### Adding timing to ColumnInfo output (schema.ts)

```typescript
// In the column mapping loop (schema.ts ~line 145-157)
const columns: ColumnInfo[] = columnsData.map(
  ([columnName, dataType, isNullable]) => {
    const colDesc: ColumnDescription | undefined =
      tableDesc?.columns?.[columnName];
    return {
      name: columnName,
      type: dataType,
      description: colDesc?.description || "",
      nullable: isNullable,
      hypothesis: colDesc?.hypothesis || false,
      timing: colDesc?.timing,  // <-- NEW: undefined for non-market tables
    };
  }
);
```

### Lag-aware example query pattern

```typescript
// Replace naive join examples with lag-aware patterns
{
  description: "Trade P&L with market context (lag-aware: close-derived fields use prior trading day)",
  sql: `WITH lagged AS (
  SELECT date,
    -- Open-known (same-day, safe)
    Gap_Pct, VIX_Open, Prior_Close,
    -- Static (same-day, safe)
    Day_of_Week, Month, Is_Opex,
    -- Close-derived (use prior trading day to prevent lookahead bias)
    LAG(VIX_Close) OVER (ORDER BY date) AS prev_VIX_Close,
    LAG(Vol_Regime) OVER (ORDER BY date) AS prev_Vol_Regime,
    LAG(RSI_14) OVER (ORDER BY date) AS prev_RSI_14
  FROM market.spx_daily
)
SELECT t.date_opened, t.strategy, t.pl,
  m.Gap_Pct, m.VIX_Open,
  m.prev_VIX_Close, m.prev_Vol_Regime, m.prev_RSI_14
FROM trades.trade_data t
JOIN lagged m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'
ORDER BY t.date_opened DESC`,
}
```

### LAG template generation (in schema.ts at tool registration time)

```typescript
import {
  OPEN_KNOWN_FIELDS,
  CLOSE_KNOWN_FIELDS,
  STATIC_FIELDS,
} from "../utils/field-timing.js";

function generateLagTemplate(): string {
  const openCols = [...OPEN_KNOWN_FIELDS].map(f => `    ${f}`).join(',\n');
  const staticCols = [...STATIC_FIELDS].map(f => `    ${f}`).join(',\n');
  const lagCols = [...CLOSE_KNOWN_FIELDS]
    .map(f => `    LAG(${f}) OVER (ORDER BY date) AS prev_${f}`)
    .join(',\n');

  return `-- Lookahead-free LAG CTE template for market.spx_daily
-- Open-known fields: use same-day values (known at/before market open)
-- Static fields: use same-day values (calendar facts known in advance)
-- Close-derived fields: use LAG() for prior trading day values
WITH lagged AS (
  SELECT date,
    -- Open-known fields (safe same-day)
${openCols},
    -- Static fields (safe same-day)
${staticCols},
    -- Close-derived fields (prior trading day via LAG)
${lagCols}
  FROM market.spx_daily
)
SELECT *
FROM trades.trade_data t
JOIN lagged m ON t.date_opened = m.date
WHERE t.block_id = 'my-block'`;
}
```

### DatabaseSchemaOutput extension

```typescript
interface DatabaseSchemaOutput {
  schemas: Record<string, SchemaInfo>;
  examples: typeof EXAMPLE_QUERIES;
  lagTemplate: {
    description: string;
    sql: string;
    fieldCounts: {
      openKnown: number;
      static: number;
      closeDerived: number;
    };
  };
  syncInfo: {
    blocksProcessed: number;
    marketFilesSynced: number;
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Naive same-day JOINs | LAG CTE for close-derived fields | Phase 55-57 (2026-02-08) | Prevents lookahead bias in all purpose-built tools |
| No timing metadata in schema output | timing property on ColumnDescription | Phase 55 (2026-02-08) | Classification exists but not surfaced to users |
| Example queries show naive JOINs | (This phase) Example queries show lag-aware patterns | Phase 58 | Users of run_sql get correct guidance |

## Open Questions

1. **Should the LAG template include ALL 44 close-derived fields or a curated subset?**
   - What we know: The full template with 44 LAG() lines is verbose but comprehensive.
   - What's unclear: Whether Claude's context window handles 44+ lines of LAG columns well, or if a shorter "most commonly used" subset is better.
   - Recommendation: Include the full template in the `lagTemplate.sql` field (it is generated programmatically so always stays in sync). Claude can truncate as needed.

2. **Should existing naive example queries be kept alongside lag-aware versions?**
   - What we know: Some basic examples (like "Recent market conditions" which queries spx_daily alone without trade JOINs) don't need lag awareness.
   - What's unclear: Whether removing naive JOIN examples is too aggressive.
   - Recommendation: Replace only the JOIN/hypothesis examples that mix trades with close-derived market fields. Keep pure market-data-only and pure trade-only examples as-is.

## Sources

### Primary (HIGH confidence)
- `packages/mcp-server/src/tools/schema.ts` - Current describe_database implementation, ColumnInfo interface, DatabaseSchemaOutput type
- `packages/mcp-server/src/utils/schema-metadata.ts` - SCHEMA_DESCRIPTIONS with timing annotations, ColumnDescription interface, EXAMPLE_QUERIES
- `packages/mcp-server/src/utils/field-timing.ts` - OPEN_KNOWN_FIELDS (8), CLOSE_KNOWN_FIELDS (44), STATIC_FIELDS (3), buildLookaheadFreeQuery()
- `packages/mcp-server/src/tools/market-data.ts` - Working examples of lag-aware query usage in analyze_regime_performance, suggest_filters, enrich_trades
- `.planning/phases/55-*/55-01-SUMMARY.md` - Field classification foundation decisions
- `.planning/phases/56-*/56-01-SUMMARY.md` - Tool migration patterns and decisions
- `.planning/phases/57-*/57-01-SUMMARY.md` - enrich_trades implementation and patterns

### Secondary (MEDIUM confidence)
- None needed -- all information is from the codebase itself.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, pure modification of existing code
- Architecture: HIGH - Pattern is clear from field-timing.ts and working tools
- Pitfalls: HIGH - Circular import and output size are concrete, verified concerns

**Research date:** 2026-02-08
**Valid until:** Indefinite (internal codebase knowledge, not external library)
