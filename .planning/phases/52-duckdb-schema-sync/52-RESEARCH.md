# Phase 52: DuckDB Schema + Sync - Research

**Researched:** 2026-02-07
**Domain:** DuckDB schema migration, market data sync, MCP server internals
**Confidence:** HIGH

## Summary

Phase 52 modifies the DuckDB schema and sync layer in the MCP server to absorb 20 new CSV columns (13 highlow + 7 VIX) into the `spx_daily` table, retire the standalone `spx_highlow` table, and update all references across the codebase. Phase 51 has already consolidated the PineScript to output a single combined CSV -- Phase 52 makes the database side match.

The key architectural insight is that the sync layer's `mergeMarketDataRows` function already filters CSV columns to only include those that exist in the DuckDB table schema (line 141 of `market-sync.ts`). This means the schema change drives everything: once columns are added to `spx_daily`, the existing sync logic will automatically pick them up from the combined CSV. The approach is therefore: (1) update the `CREATE TABLE IF NOT EXISTS` statement in `schemas.ts`, (2) remove the `spx_highlow` table creation, (3) remove the `spx_highlow.csv` file mapping from sync config, (4) update all downstream references (schema metadata, SQL tool, schema tool, market-data tool), and (5) handle existing databases via purge + re-sync.

DuckDB's `CREATE TABLE IF NOT EXISTS` will NOT add new columns to an existing table -- it simply skips creation if the table already exists. This means users with existing `analytics.duckdb` databases will need to purge the `spx_daily` table (via the existing `purge_market_table` tool) to get the new schema applied. The purge + re-sync path (SYNC-03) is already supported by the existing infrastructure.

**Primary recommendation:** Modify `schemas.ts` to add 20 new columns to `spx_daily` and remove `spx_highlow` table, update `market-sync.ts` to remove `spx_highlow.csv` mapping, update `schema-metadata.ts` with descriptions for all new columns, and update `schema.ts`, `sql.ts`, and `market-data.ts` to remove all `spx_highlow` references. No new dependencies needed.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@duckdb/node-api` | ^1.4.4-r.1 | DuckDB Node.js bindings | Already in use, no upgrade needed |
| TypeScript | ^5.8.0 | Type safety | Already in use |

### Supporting

No new libraries needed. All changes are to existing files within the MCP server package.

## Architecture Patterns

### Files to Modify

```
packages/mcp-server/src/
  db/
    schemas.ts           # Add 20 columns to spx_daily, remove spx_highlow table
  sync/
    market-sync.ts       # Remove spx_highlow.csv mapping
  utils/
    schema-metadata.ts   # Add descriptions for 20 new columns, remove spx_highlow section, update example queries
  tools/
    schema.ts            # Remove spx_highlow from MARKET_TABLE_FILES and purge_market_table enum
    sql.ts               # Remove market.spx_highlow from AVAILABLE_TABLES and description
    market-data.ts       # Remove HighLowTimingData interface, loadHighLowData(), highlow cache, update file header comment
```

### Pattern 1: Schema Definition via CREATE TABLE IF NOT EXISTS

**What:** All DuckDB table schemas are defined declaratively in `schemas.ts` using `CREATE TABLE IF NOT EXISTS` statements. The schemas are applied on every connection via `ensureMarketDataTables()`.

**Key behavior:** `CREATE TABLE IF NOT EXISTS` does NOT alter existing tables. If a table already exists with the old schema (35 columns), the new schema (55 columns) will NOT be applied. The table must be dropped or purged first.

**Migration strategy for existing databases:**
1. User calls `purge_market_table` with `table: "spx_daily"` (deletes all rows + clears sync metadata)
2. On next query, sync middleware triggers, detects missing sync metadata for `spx_daily.csv`
3. Since table still exists with old schema, need to DROP and recreate
4. Actually simpler: add a `DROP TABLE IF EXISTS market.spx_daily` before the `CREATE TABLE IF NOT EXISTS` in the schema migration, OR use schema version tracking

**Recommended approach:** Since `ensureMarketDataTables` runs on every connection init, add a one-time migration check. But the simplest approach that matches existing patterns is:
- Update the `CREATE TABLE IF NOT EXISTS` for `spx_daily` with the new 55-column schema
- For the `spx_highlow` table, replace `CREATE TABLE IF NOT EXISTS` with `DROP TABLE IF EXISTS`
- Users with existing databases must call `purge_market_table` for `spx_daily` first, then the table gets dropped and recreated with the new schema on next sync. However, since `CREATE TABLE IF NOT EXISTS` won't modify the existing table, we need a smarter approach.

**Best approach (recommended):** Drop and recreate `spx_daily` unconditionally:
```typescript
// In ensureMarketDataTables():

// Drop spx_highlow table (retired)
await conn.run(`DROP TABLE IF EXISTS market.spx_highlow`);

// Drop and recreate spx_daily with new schema (adds 20 new columns)
// Safe because data is re-importable from CSV (SYNC-03)
await conn.run(`DROP TABLE IF EXISTS market.spx_daily`);
await conn.run(`CREATE TABLE market.spx_daily ( ... 55 columns ... )`);

// Also clear sync metadata for spx_daily and spx_highlow so data is re-imported
await conn.run(`DELETE FROM market._sync_metadata WHERE file_name IN ('spx_daily.csv', 'spx_highlow.csv')`);
```

**However**, this approach would drop and recreate every time the server connects, losing data until re-sync. A better pattern is schema version checking:

**Best pragmatic approach:** Use `ALTER TABLE ADD COLUMN` for each new column, wrapped in try/catch to handle the case where column already exists. DuckDB does not support `ADD COLUMN IF NOT EXISTS`, so we catch errors:

```typescript
async function migrateSpxDailySchema(conn: DuckDBConnection): Promise<void> {
  const newColumns = [
    { name: 'High_Time', type: 'DOUBLE' },
    { name: 'Low_Time', type: 'DOUBLE' },
    // ... 18 more
  ];

  for (const col of newColumns) {
    try {
      await conn.run(`ALTER TABLE market.spx_daily ADD COLUMN ${col.name} ${col.type}`);
    } catch {
      // Column already exists, skip
    }
  }
}
```

**FINAL RECOMMENDED APPROACH:** Use a version-checking pattern. Check if the `spx_daily` table already has the new columns. If not, drop and recreate it, then clear its sync metadata to force a fresh import. This is clean and handles both fresh installs and existing databases:

```typescript
async function ensureMarketDataTables(conn: DuckDBConnection): Promise<void> {
  // Check if spx_daily needs migration (does High_Time column exist?)
  let needsMigration = false;
  try {
    const result = await conn.runAndReadAll(`
      SELECT 1 FROM duckdb_columns()
      WHERE schema_name = 'market' AND table_name = 'spx_daily' AND column_name = 'High_Time'
    `);
    // Table exists but doesn't have High_Time -> needs migration
    const tableExists = await conn.runAndReadAll(`
      SELECT 1 FROM duckdb_tables()
      WHERE schema_name = 'market' AND table_name = 'spx_daily'
    `);
    if (tableExists.getRows().length > 0 && result.getRows().length === 0) {
      needsMigration = true;
    }
  } catch {
    // Table doesn't exist yet, CREATE TABLE IF NOT EXISTS will handle it
  }

  if (needsMigration) {
    await conn.run(`DROP TABLE market.spx_daily`);
    await conn.run(`DELETE FROM market._sync_metadata WHERE file_name = 'spx_daily.csv'`);
  }

  // Drop retired spx_highlow table
  await conn.run(`DROP TABLE IF EXISTS market.spx_highlow`);
  await conn.run(`DELETE FROM market._sync_metadata WHERE file_name = 'spx_highlow.csv'`);

  // Create spx_daily with full 55-column schema (IF NOT EXISTS)
  await conn.run(`CREATE TABLE IF NOT EXISTS market.spx_daily ( ... )`);

  // ... rest of tables unchanged
}
```

### Pattern 2: Sync Configuration (File-to-Table Mapping)

**What:** The `MARKET_DATA_FILES` constant in `market-sync.ts` maps CSV filenames to DuckDB table names. This is the only place that controls which files are synced.

**Current state:**
```typescript
const MARKET_DATA_FILES = {
  "spx_daily.csv": { table: "market.spx_daily", dateColumn: "time" },
  "spx_15min.csv": { table: "market.spx_15min", dateColumn: "time" },
  "spx_highlow.csv": { table: "market.spx_highlow", dateColumn: "time" },
  "vix_intraday.csv": { table: "market.vix_intraday", dateColumn: "time" },
};
```

**After Phase 52:** Remove the `spx_highlow.csv` entry. The sync will no longer attempt to read or import this file.

**Critical insight:** The sync layer's `mergeMarketDataRows` function dynamically discovers table columns from DuckDB and only imports CSV columns that match. This means:
- If the `spx_daily` CSV has new columns (High_Time, VIX_Gap_Pct, etc.) but the table schema hasn't been updated yet, those columns are silently dropped
- Once the schema is updated to include the new columns, the sync automatically picks them up
- No changes needed to the CSV parsing or row merging logic itself

### Pattern 3: Schema Metadata (describe_database)

**What:** `schema-metadata.ts` contains hardcoded descriptions for every table and column. The `describe_database` tool merges these descriptions with live schema introspection from DuckDB.

**Changes needed:**
1. Add column descriptions for all 20 new columns in the `spx_daily` section
2. Remove the entire `spx_highlow` table section
3. Update example queries that reference `market.spx_highlow` (there is one JOIN example)

### Pattern 4: Market Data Tool References

**What:** `market-data.ts` has a parallel CSV loading system (in-memory Maps with 5-minute TTL cache) that reads directly from CSV files. This includes `loadHighLowData()` which reads `spx_highlow.csv`, the `HighLowTimingData` interface, and the `highlowDataCache`.

**Important scoping note:** Phase 53 (Import Consolidation) will migrate these tools to query DuckDB instead of reading CSVs directly. Phase 52 should NOT do this migration -- it should only:
1. Update the file header comment to remove `spx_highlow.csv` reference
2. Remove the `HighLowTimingData` interface (no longer a separate data source)
3. Remove `loadHighLowData()` function
4. Remove `highlowDataCache` variable
5. Remove `highlow` from `getMarketData()` return type and implementation
6. Remove `highlow` from `MarketDataRecord` interface

**Wait -- the `highlow` data is still used by `getMarketData()` which is called by `analyze_regime_performance`, `suggest_filters`, and `calculate_orb`.** Let me check if any of these tools actually use the highlow data...

Actually, looking at the code: `analyze_regime_performance` only uses `daily` from `getMarketData()`. `suggest_filters` only uses `daily`. `calculate_orb` only uses `intraday`. None of them use `highlow`. The `highlow` data is only loaded and cached but never consumed by any tool. It was available in the `getMarketData()` return for potential future use.

So removing the highlow loading is safe. However, there's a subtlety: the `MarketDataRecord` interface (line 212) includes `highlow?: HighLowTimingData`. This is the type returned by `getMarketData()` and potentially used externally. Since no tool actually uses `highlow`, removing it is clean.

**Alternative approach for Phase 52 scope:** Since Phase 53 will remove ALL CSV loading code, Phase 52 could simply leave the `market-data.ts` changes minimal -- just update comments and the `MarketDataRecord` interface. The `loadHighLowData` function will gracefully return an empty Map when `spx_highlow.csv` doesn't exist (it has a try/catch). So the tools won't break even without removing the code.

**RECOMMENDED:** In Phase 52, do the minimal change in `market-data.ts`:
- Update file header comment (remove `spx_highlow.csv` reference)
- The `loadHighLowData()` already handles missing file gracefully (returns empty Map)
- Leave the actual code removal to Phase 53 (Import Consolidation) which removes ALL CSV loading

### Anti-Patterns to Avoid

- **ALTER TABLE ADD COLUMN one-by-one without idempotency:** DuckDB lacks `ADD COLUMN IF NOT EXISTS`, so individual `ALTER TABLE` calls would need error handling for each column. The drop-and-recreate approach is cleaner.
- **Changing existing column names or types:** The 35 existing `spx_daily` columns must keep their exact names and types. Only ADD new columns.
- **Removing `spx_highlow` without clearing sync metadata:** If the table is dropped but metadata remains, the sync layer will try to insert into a non-existent table. Must clear `market._sync_metadata WHERE file_name = 'spx_highlow.csv'`.
- **Updating market-data.ts CSV loading logic:** This is Phase 53's scope. Phase 52 should only update schema, sync config, metadata, and tool descriptions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema migration detection | Custom version table or file | Column existence check via `duckdb_columns()` | DuckDB provides introspection; simple one-column check is sufficient |
| Sync metadata cleanup | Manual SQL in multiple places | Add cleanup to `ensureMarketDataTables()` migration block | Single point of change, runs on every connection |
| CSV column filtering | Custom header-to-schema mapping | Existing `mergeMarketDataRows` auto-filtering | Already filters CSV columns to match table schema (line 141) |

**Key insight:** The existing sync infrastructure handles 90% of the work. The `mergeMarketDataRows` function's dynamic column discovery means no changes to CSV parsing or row insertion logic are needed.

## Common Pitfalls

### Pitfall 1: CREATE TABLE IF NOT EXISTS Won't Update Existing Tables

**What goes wrong:** Updating the `CREATE TABLE IF NOT EXISTS` SQL in `schemas.ts` and expecting existing databases to automatically get the new columns. They won't -- the statement is a no-op when the table already exists.
**Why it happens:** `CREATE TABLE IF NOT EXISTS` is designed for idempotent table creation, not schema evolution.
**How to avoid:** Implement a migration check: query `duckdb_columns()` for a sentinel column (e.g., `High_Time`). If the table exists but lacks the column, drop and recreate. Clear sync metadata so data is re-imported.
**Warning signs:** New columns showing as NULL even after re-sync, or `describe_database` showing 35 columns instead of 55.

### Pitfall 2: Orphaned Sync Metadata After Table Drop

**What goes wrong:** Dropping `spx_highlow` table but not clearing its `market._sync_metadata` entry causes errors on next sync (table not found).
**Why it happens:** The sync layer checks metadata hashes before querying the table. If metadata exists but table doesn't, the hash comparison succeeds but the INSERT fails.
**How to avoid:** Always pair table drops with metadata cleanup: `DELETE FROM market._sync_metadata WHERE file_name = 'spx_highlow.csv'`.
**Warning signs:** Sync errors mentioning `market.spx_highlow` table not found.

### Pitfall 3: Missing References in Tool Descriptions

**What goes wrong:** `run_sql` tool description still mentions `market.spx_highlow`, causing Claude to write queries against a non-existent table.
**Why it happens:** Multiple files reference `spx_highlow` in string constants and comments.
**How to avoid:** Search for all `spx_highlow` references in the MCP server source (there are 8 files). Update every one.
**Warning signs:** Claude generating SQL queries that reference `market.spx_highlow` and getting "table not found" errors.

### Pitfall 4: Example Queries Referencing Retired Table

**What goes wrong:** The example queries in `schema-metadata.ts` include a JOIN to `market.spx_highlow`. If this isn't updated, `describe_database` will suggest broken query patterns.
**Why it happens:** The example queries section is separate from the table descriptions section.
**How to avoid:** Update the "Trades on reversal days" example query to JOIN `market.spx_daily` instead of `market.spx_highlow` (since highlow columns are now in `spx_daily`).
**Warning signs:** `describe_database` output including example queries that fail.

### Pitfall 5: purge_market_table Enum Still Lists spx_highlow

**What goes wrong:** The `purge_market_table` tool in `schema.ts` has a Zod enum that lists `spx_highlow` as a valid table. After the table is dropped, calling `purge_market_table` with `table: "spx_highlow"` would fail.
**Why it happens:** The enum and the `MARKET_TABLE_FILES` constant are hardcoded.
**How to avoid:** Remove `spx_highlow` from both the enum and the `MARKET_TABLE_FILES` constant.
**Warning signs:** Claude suggesting `purge_market_table` for `spx_highlow` and getting an error.

## Code Examples

### Example 1: Updated spx_daily Schema (55 columns)

```typescript
// Source: packages/mcp-server/src/db/schemas.ts
// Pattern: Existing 35 columns + 13 highlow + 7 VIX = 55 total
await conn.run(`
  CREATE TABLE IF NOT EXISTS market.spx_daily (
    date VARCHAR PRIMARY KEY,
    Prior_Close DOUBLE,
    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,
    Gap_Pct DOUBLE,
    Intraday_Range_Pct DOUBLE,
    Intraday_Return_Pct DOUBLE,
    Total_Return_Pct DOUBLE,
    Close_Position_In_Range DOUBLE,
    Gap_Filled INTEGER,
    VIX_Open DOUBLE,
    VIX_Close DOUBLE,
    VIX_Change_Pct DOUBLE,
    VIX_Spike_Pct DOUBLE,
    VIX_Percentile DOUBLE,
    Vol_Regime INTEGER,
    VIX9D_Close DOUBLE,
    VIX3M_Close DOUBLE,
    VIX9D_VIX_Ratio DOUBLE,
    VIX_VIX3M_Ratio DOUBLE,
    Term_Structure_State INTEGER,
    ATR_Pct DOUBLE,
    RSI_14 DOUBLE,
    Price_vs_EMA21_Pct DOUBLE,
    Price_vs_SMA50_Pct DOUBLE,
    Trend_Score INTEGER,
    BB_Position DOUBLE,
    Return_5D DOUBLE,
    Return_20D DOUBLE,
    Consecutive_Days INTEGER,
    Day_of_Week INTEGER,
    Month INTEGER,
    Is_Opex INTEGER,
    Prev_Return_Pct DOUBLE,
    -- 13 highlow columns (NEW)
    High_Time DOUBLE,
    Low_Time DOUBLE,
    High_Before_Low INTEGER,
    High_In_First_Hour INTEGER,
    Low_In_First_Hour INTEGER,
    High_In_Last_Hour INTEGER,
    Low_In_Last_Hour INTEGER,
    Reversal_Type INTEGER,
    High_Low_Spread DOUBLE,
    Early_Extreme INTEGER,
    Late_Extreme INTEGER,
    Intraday_High DOUBLE,
    Intraday_Low DOUBLE,
    -- 7 VIX columns (NEW)
    VIX_Gap_Pct DOUBLE,
    VIX9D_Open DOUBLE,
    VIX9D_Change_Pct DOUBLE,
    VIX_High DOUBLE,
    VIX_Low DOUBLE,
    VIX3M_Open DOUBLE,
    VIX3M_Change_Pct DOUBLE
  )
`);
```

### Example 2: Schema Migration Check

```typescript
// Source: packages/mcp-server/src/db/schemas.ts
// Check if spx_daily needs migration by looking for a sentinel column
async function migrateSpxDailyIfNeeded(conn: DuckDBConnection): Promise<void> {
  try {
    const tableCheck = await conn.runAndReadAll(`
      SELECT 1 FROM duckdb_tables()
      WHERE schema_name = 'market' AND table_name = 'spx_daily'
    `);

    if (tableCheck.getRows().length === 0) {
      // Table doesn't exist yet, CREATE TABLE IF NOT EXISTS will handle it
      return;
    }

    const colCheck = await conn.runAndReadAll(`
      SELECT 1 FROM duckdb_columns()
      WHERE schema_name = 'market' AND table_name = 'spx_daily' AND column_name = 'High_Time'
    `);

    if (colCheck.getRows().length === 0) {
      // Table exists but missing new columns -> drop and recreate
      await conn.run(`DROP TABLE market.spx_daily`);
      await conn.run(`DELETE FROM market._sync_metadata WHERE file_name = 'spx_daily.csv'`);
    }
  } catch {
    // Any error here is non-fatal, CREATE TABLE IF NOT EXISTS will handle fresh state
  }
}
```

### Example 3: Updated Market Data Files Config

```typescript
// Source: packages/mcp-server/src/sync/market-sync.ts
const MARKET_DATA_FILES: Record<string, { table: string; dateColumn: string }> = {
  "spx_daily.csv": { table: "market.spx_daily", dateColumn: "time" },
  "spx_15min.csv": { table: "market.spx_15min", dateColumn: "time" },
  // "spx_highlow.csv" REMOVED - highlow data now in spx_daily.csv
  "vix_intraday.csv": { table: "market.vix_intraday", dateColumn: "time" },
};
```

### Example 4: Updated Example Query (Reversal Days)

```typescript
// Source: packages/mcp-server/src/utils/schema-metadata.ts
// BEFORE: Joins market.spx_highlow (separate table)
// AFTER: Queries market.spx_daily directly (highlow columns merged)
{
  description: "Trades on reversal days (high/low timing)",
  sql: `SELECT
  t.date_opened, t.strategy, t.pl,
  m.Reversal_Type, m.High_Before_Low, m.High_In_First_Hour
FROM trades.trade_data t
JOIN market.spx_daily m ON t.date_opened = m.date
WHERE m.Reversal_Type != 0
  AND t.block_id = 'my-block'`,
},
```

## Complete Inventory of Changes

### File: `packages/mcp-server/src/db/schemas.ts`

| Change | Requirement | Details |
|--------|-------------|---------|
| Add 13 highlow columns to `spx_daily` CREATE TABLE | SCHEMA-01 | High_Time, Low_Time, High_Before_Low, etc. |
| Add 7 VIX columns to `spx_daily` CREATE TABLE | SCHEMA-02 | VIX_Gap_Pct, VIX9D_Open, etc. |
| Remove `spx_highlow` CREATE TABLE block | SCHEMA-03 | Replace with DROP TABLE IF EXISTS |
| Add migration check function | SCHEMA-01/02 | Drop+recreate spx_daily if missing new columns |
| Clear spx_highlow sync metadata | SCHEMA-03 | DELETE from market._sync_metadata |

### File: `packages/mcp-server/src/sync/market-sync.ts`

| Change | Requirement | Details |
|--------|-------------|---------|
| Remove `spx_highlow.csv` entry from MARKET_DATA_FILES | SYNC-02 | Remove line 30 |
| Update file header comment | SYNC-02 | Remove spx_highlow.csv from list |

### File: `packages/mcp-server/src/utils/schema-metadata.ts`

| Change | Requirement | Details |
|--------|-------------|---------|
| Add 13 highlow column descriptions to `spx_daily.columns` | SCHEMA-04 | Copy descriptions from existing `spx_highlow` section |
| Add 7 VIX column descriptions to `spx_daily.columns` | SCHEMA-04 | New descriptions for VIX_Gap_Pct, etc. |
| Remove entire `spx_highlow` table section | SCHEMA-03/04 | Remove lines 523-601 |
| Update `spx_daily.keyColumns` | SCHEMA-04 | Add High_Time, Reversal_Type |
| Update reversal days example query | SCHEMA-04 | Change JOIN from spx_highlow to spx_daily |
| Update `spx_daily.description` | SCHEMA-04 | Mention highlow timing data |

### File: `packages/mcp-server/src/tools/schema.ts`

| Change | Requirement | Details |
|--------|-------------|---------|
| Remove `spx_highlow` from `MARKET_TABLE_FILES` | SCHEMA-03 | Line 70 |
| Remove `spx_highlow` from `purge_market_table` enum | SCHEMA-03 | Line 217 |
| Update `purge_market_table` description | SCHEMA-03 | Remove "spx_highlow" from valid tables list |

### File: `packages/mcp-server/src/tools/sql.ts`

| Change | Requirement | Details |
|--------|-------------|---------|
| Remove `market.spx_highlow` from `AVAILABLE_TABLES` | SCHEMA-03 | Line 36 |
| Remove `market.spx_highlow` from header comment | SCHEMA-03 | Line 18 |
| Remove from `run_sql` description string | SCHEMA-03 | Line 239 |

### File: `packages/mcp-server/src/tools/market-data.ts`

| Change | Requirement | Details |
|--------|-------------|---------|
| Update file header comment | SYNC-02 | Remove spx_highlow.csv reference |
| Minimal: leave HighLowTimingData/loadHighLowData for Phase 53 cleanup | -- | Function handles missing file gracefully |

**NOTE:** The `market-data.ts` CSV loading code (HighLowTimingData interface, loadHighLowData, highlowDataCache) will be completely removed in Phase 53 when all CSV loading migrates to DuckDB queries. Phase 52 should only update comments. The existing `loadHighLowData()` gracefully handles a missing `spx_highlow.csv` file by returning an empty Map (lines 479-482).

### Column Type Reference

From Phase 51 research, the 20 new columns with their exact types:

**13 Highlow Fields:**

| Column Name | DuckDB Type | Description | hypothesis |
|-------------|-------------|-------------|------------|
| High_Time | DOUBLE | Time of day high as decimal hours (e.g., 10.5 = 10:30 AM) | true |
| Low_Time | DOUBLE | Time of day low as decimal hours (e.g., 14.25 = 2:15 PM) | true |
| High_Before_Low | INTEGER | 1 if high occurred before low, 0 if not | true |
| High_In_First_Hour | INTEGER | 1 if high was 9:30-10:30 AM | true |
| Low_In_First_Hour | INTEGER | 1 if low was 9:30-10:30 AM | true |
| High_In_Last_Hour | INTEGER | 1 if high was 3:00-4:00 PM | true |
| Low_In_Last_Hour | INTEGER | 1 if low was 3:00-4:00 PM | true |
| Reversal_Type | INTEGER | 1=morning high/afternoon low, -1=opposite, 0=same session | true |
| High_Low_Spread | DOUBLE | Hours between high and low | true |
| Early_Extreme | INTEGER | 1 if either extreme in first 30 min | true |
| Late_Extreme | INTEGER | 1 if either extreme in last 30 min | true |
| Intraday_High | DOUBLE | Intraday high price (may differ from daily high on gap days) | false |
| Intraday_Low | DOUBLE | Intraday low price (may differ from daily low on gap days) | false |

**7 VIX Fields:**

| Column Name | DuckDB Type | Description | hypothesis |
|-------------|-------------|-------------|------------|
| VIX_Gap_Pct | DOUBLE | VIX overnight gap percentage | true |
| VIX9D_Open | DOUBLE | 9-day VIX open value | false |
| VIX9D_Change_Pct | DOUBLE | 9-day VIX open-to-close change percentage | true |
| VIX_High | DOUBLE | VIX intraday high | false |
| VIX_Low | DOUBLE | VIX intraday low | false |
| VIX3M_Open | DOUBLE | 3-month VIX open value | false |
| VIX3M_Change_Pct | DOUBLE | 3-month VIX open-to-close change percentage | true |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate `spx_highlow` table + CSV | Merged into `spx_daily` table | Phase 52 (this phase) | Eliminates JOIN requirement for highlow queries |
| 4 CSV file mappings in sync | 3 CSV file mappings | Phase 52 (this phase) | Simpler sync, fewer files to manage |
| 35-column `spx_daily` | 55-column `spx_daily` | Phase 52 (this phase) | All daily data in one table, richer analysis |

**Deprecated/outdated:**
- `market.spx_highlow` table: Being retired in this phase. All highlow data now in `spx_daily`.
- `spx_highlow.csv` file: No longer needed. Data comes from combined `spx_daily.csv`.

## Open Questions

1. **Should Phase 52 also clean up market-data.ts CSV loading code?**
   - What we know: Phase 53 (Import Consolidation) will remove ALL CSV loading from market-data.ts and migrate to DuckDB queries. The existing `loadHighLowData()` handles missing files gracefully.
   - What's unclear: Whether leaving dead code for one phase is acceptable vs cleaning it now.
   - Recommendation: Leave it for Phase 53. The code is harmless (returns empty Map), and Phase 53 will do a complete removal anyway. Touching market-data.ts minimally in Phase 52 reduces risk and keeps scope tight.

2. **MCP server version bump?**
   - What we know: CLAUDE.md says to bump MCP server version when MCP functionality changes. This phase changes database schema and tool descriptions.
   - What's unclear: Whether schema changes alone warrant a version bump.
   - Recommendation: Yes, bump version. The `describe_database` output changes (columns added, table removed), which is a user-visible API change. Bump minor version to 0.10.0.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - All 7 MCP server files read and analyzed:
  - `packages/mcp-server/src/db/schemas.ts` (current schema definitions)
  - `packages/mcp-server/src/sync/market-sync.ts` (sync config and merge logic)
  - `packages/mcp-server/src/utils/schema-metadata.ts` (column descriptions)
  - `packages/mcp-server/src/tools/schema.ts` (describe_database, purge_market_table)
  - `packages/mcp-server/src/tools/sql.ts` (run_sql available tables)
  - `packages/mcp-server/src/tools/market-data.ts` (CSV loading, interfaces)
  - `packages/mcp-server/src/db/connection.ts` (init flow)
- **Phase 51 outputs** - Verified field names and types from `51-RESEARCH.md` and `51-VERIFICATION.md`
- **DuckDB official docs** - CREATE TABLE, ALTER TABLE, DROP TABLE syntax verified

### Secondary (MEDIUM confidence)
- [DuckDB ALTER TABLE docs](https://duckdb.org/docs/stable/sql/statements/alter_table) - Confirmed no `ADD COLUMN IF NOT EXISTS` support
- [DuckDB DROP TABLE docs](https://duckdb.org/docs/stable/sql/statements/drop) - Confirmed `DROP TABLE IF EXISTS` support
- [DuckDB CREATE TABLE docs](https://duckdb.org/docs/stable/sql/statements/create_table) - Confirmed `CREATE OR REPLACE TABLE` support

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all existing code
- Architecture: HIGH - All files read, all patterns understood, sync column-filtering mechanism verified
- Pitfalls: HIGH - DuckDB schema evolution limitations verified via official docs, all references inventoried
- Migration strategy: HIGH - Multiple approaches analyzed, recommended approach uses existing DuckDB introspection capabilities

**Research date:** 2026-02-07
**Valid until:** 2026-04-07 (stable -- DuckDB API and MCP server structure unlikely to change)
