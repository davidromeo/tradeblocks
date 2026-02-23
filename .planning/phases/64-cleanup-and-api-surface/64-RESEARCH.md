# Phase 64: Cleanup and API Surface - Research

**Researched:** 2026-02-22
**Domain:** MCP Server codebase cleanup, API surface update, Pine Script simplification, ENR-04 Tier 3 enrichment
**Confidence:** HIGH — all findings are directly from codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Old Table Name Handling (run_sql)**
- Update `AVAILABLE_TABLES` allowlist to new names: `market.daily`, `market.context`, `market.intraday`, `market._sync_metadata`
- Old table names simply fail the allowlist check — no special error messaging or auto-rewriting
- Update tool description/help text to reference new table names
- `market._sync_metadata` included in allowlist

**Pine Script Simplification**
- Reduce from 3 scripts to 1 universal script
- Script exports raw OHLCV of the chart symbol (no derived fields — enrichment pipeline computes those)
- VIX/VIX9D/VIX3M data pulled via `request.security()` for convenience on daily timeframe
- Same script works on any timeframe: daily chart → import to `market.daily`, intraday chart → import to `market.intraday`
- Keep the same TradingView export method (indicator with `display=display.data_window` plots)
- Delete `spx-15min-checkpoints.pine` and `vix-intraday.pine`

**Tier 3 Enrichment (Unblocked)**
- ENR-04 pulled into this phase — Pine Script simplification resolves the intraday CSV format blocker
- Implement Tier 3 enrichment logic: High_Time, Low_Time, Reversal_Type, Opening_Drive_Strength, Intraday_Realized_Vol
- Remove the hard-skip in `market-enricher.ts` (line ~897) and implement actual computation from `market.intraday` rows

**Dead Code Removal**
- Delete `market-sync.ts` and all its exports from `sync/index.ts`
- Delete `intraday-timing.ts` and its `test-exports.ts` entries
- Delete old integration tests: `market-sync-multi-ticker.test.ts` and any other tests for deleted sync code
- Clean all stale references: update every comment mentioning old table names across the codebase
- Simplify enrich_trades intraday output: return raw intraday bars from `market.intraday` instead of pivoting to checkpoint-format columns

**describe_database Output**
- LAG template and example queries already reference new table names (verified correct — no changes needed there)
- Add example queries for `market.intraday` (ORB calculations, time-range filters)
- Add embedded "Import Workflow" section explaining the `import_market_csv` → `enrich_market_data` pipeline
- Keep describe_database focused on schema discovery — enrichment tier status stays in `enrich_market_data` tool

### Claude's Discretion
- Exact columns in the simplified Pine Script (whatever enrichment needs as raw input)
- Format of the embedded import workflow guidance in describe_database
- How to restructure enrich_trades intraday output (raw bar format)
- Whether to conditionally skip VIX `request.security()` calls on non-daily timeframes or let them export na

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLN-02 | `run_sql` allowlist updated to new table names | `sql.ts` AVAILABLE_TABLES array identified at lines 31-36 with exact values to replace |
| CLN-03 | `describe_database` updated with new schema structure and LAG CTE template | `schema.ts` already has correct new-table LAG template; needs intraday examples + import workflow section |
| CLN-04 | `_marketdata/` sync code deleted (market-sync.ts and related exports) | `market-sync.ts` fully identified, all exports in `sync/index.ts`, test-exports.ts entries documented |
| CLN-05 | Pine Scripts simplified to 1 minimal daily script (~12 columns of raw OHLCV + VIX) | Three existing scripts identified in `/scripts/`; universal script design pattern documented |
| CLN-06 | Two Pine Scripts removed (spx-15min-checkpoints.pine, vix-intraday.pine) | Both scripts at `/scripts/spx-15min-checkpoints.pine` and `/scripts/vix-intraday.pine` |
| CLN-07 | New import tools registered in MCP server index | All new tools (`market-imports`, `market-enrichment`) already registered in `index.ts`; this requirement may already be satisfied — verify |
| ENR-04 | Tier 3 intraday timing fields written to `market.daily` from `market.intraday` rows | `hasTier3Data()` and hard-skip at line 897-909 in `market-enricher.ts`; schema columns already exist in `market.daily` |
</phase_requirements>

---

## Summary

Phase 64 is a cleanup and finalization phase. All new infrastructure (DB schema, import tools, enrichment pipeline, tool migration) shipped in Phases 60-63. This phase removes the old `_marketdata/` auto-sync system, simplifies the TradingView Pine Scripts from three specialized scripts to one universal script, updates the MCP server's public API surface to reflect the new table names, implements the previously-blocked Tier 3 enrichment, and simplifies enrich_trades intraday output.

The phase is well-scoped and surgical. No new npm dependencies are needed. All TypeScript changes are within `packages/mcp-server/src/`. The Tier 3 enrichment is the most complex new logic — it reads from `market.intraday` (raw OHLCV bars with HH:MM time column) and computes High_Time, Low_Time, High_Before_Low, Reversal_Type, and potentially Opening_Drive_Strength into `market.daily`. The `market.daily` schema columns for these fields already exist (added in Phase 60).

The CLN-07 requirement (register new tools in index) is likely already satisfied — `registerMarketImportTools` and `registerMarketEnrichmentTools` are already called in `index.ts` at lines 25-26 and 285-287. This needs verification before planning to avoid a phantom task.

**Primary recommendation:** Split into three clear tasks: (1) dead code removal + API surface updates, (2) Pine Script replacement, (3) Tier 3 enrichment implementation.

---

## Standard Stack

No new libraries needed. This phase works entirely within the existing stack.

### Core (already in place)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@duckdb/node-api` | existing | Market DB queries for Tier 3 | Already used throughout enrichment pipeline |
| TypeScript | existing | All MCP server code | Project standard |
| PineScript v6 | n/a | TradingView indicator scripting | Same version as existing scripts |

---

## Architecture Patterns

### Pattern 1: Existing Enrichment Tier Pattern (for Tier 3)
**What:** Each tier queries raw data from DuckDB, computes fields in TypeScript, then batch-updates via `batchUpdateDaily()`.
**When to use:** Tier 3 follows the exact same pattern as Tier 1.
**Example (from market-enricher.ts Tier 1):**
```typescript
// 1. Fetch raw data from market.intraday for all dates in range
const intradayResult = await conn.runAndReadAll(`
  SELECT date, time, open, high, low, close
  FROM market.intraday
  WHERE ticker = $1 AND date >= $2
  ORDER BY date, time
`, [ticker, lookbackStart]);

// 2. Compute fields in TypeScript (pure functions)
// 3. batchUpdateDaily(conn, enrichedRows, ['High_Time', 'Low_Time', 'High_Before_Low', 'Reversal_Type'])
```

### Pattern 2: Allowlist Filtering for run_sql
**What:** `sql.ts` uses a static `AVAILABLE_TABLES` array for the error message when a table is not found. The allowlist is purely informational (DuckDB enforces actual table existence).
**Key insight:** The allowlist does NOT block queries — it appears in error messages only. Changing it is a documentation update, not a security gate.

### Pattern 3: MCP Server Tool Registration
**What:** All tools are registered via `register*Tools(server, resolvedDir)` in `index.ts`'s `createServer()`. The pattern is import → call in createServer.
**Current state:** `registerMarketImportTools` and `registerMarketEnrichmentTools` are already registered (CLN-07 may already be done).

### Pattern 4: Pine Script Universal Export
**What:** TradingView exports data visible in the "Data Window" (display.data_window). Same script on daily chart → daily OHLCV. Same script on 15-min chart → intraday bars. Each exported row has: `time` (Unix timestamp), then the plot values as named columns.
**Critical insight:** The NEW Pine Script must emit separate `date` and `time` columns, OR the import tool's column mapping must split the Unix timestamp. The decision made in this phase is that the Pine Script emits raw OHLCV, and the `import_market_csv` tool handles column mapping. The `market.intraday` table needs `date` (YYYY-MM-DD) and `time` (HH:MM) as separate columns. TradingView always exports a single `time` Unix timestamp — the column mapping in `import_market_csv` handles splitting it into date+time.

**Wait — this is a critical issue to resolve:** The blocker STATE.md described was that "column mapping cannot split one source column into two." Looking at the CONTEXT.md decision: the Pine Script simplification "resolves the intraday CSV format blocker." This means the NEW Pine Script must export separate date and time columns directly, not rely on the import tool to split. The universal script will need to plot explicit date and time values for the intraday case. For the daily timeframe, only date matters (the existing date column from TradingView). This is the crux of why the Pine Script simplification is the blocker-resolver.

### Pattern 5: enrich_trades Intraday Output Simplification
**What:** Currently, `market-data.ts` pivots raw `market.intraday` rows into wide-format checkpoint columns (P_0930, VIX_1030, etc.) using SQL CASE WHEN. The CONTEXT.md decision is to return raw bar arrays instead.
**Implementation:** Instead of pivoting, return bars as an array of `{time, open, high, low, close}` objects per trade date.

### Anti-Patterns to Avoid
- **Do not** add new columns to market-schemas.ts for Tier 3 — they already exist (High_Time, Low_Time, High_Before_Low, Reversal_Type) in the CREATE TABLE statement
- **Do not** try to auto-rewrite old table names in run_sql — the decision is clean failure via allowlist mismatch
- **Do not** keep `syncMarketData` or `syncMarketDataInternal` as deprecated stubs — delete them entirely per CLN-04
- **Do not** touch `sync/block-sync.ts` — it has its own `_marketdata` skip logic at line 649 which can stay or be cleaned up depending on scope

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tier 3 time parsing | Custom HHMM parser | Direct SQL string operations on HH:MM format already in market.intraday | DuckDB can do `SUBSTR(time, 1, 2)::INT * 60 + SUBSTR(time, 4, 2)::INT` for minutes |
| Pine Script date/time split | Complex JavaScript splitting in import tool | Plot explicit date+time values from PineScript | Script-level solution is cleaner and correct |

---

## Common Pitfalls

### Pitfall 1: CLN-07 Already Done
**What goes wrong:** Creating a task for "register new tools in MCP server index" when they're already registered.
**Why it happens:** Requirements list CLN-07 as pending, but the code shows both `registerMarketImportTools` and `registerMarketEnrichmentTools` are already called in `index.ts` at lines 284-288.
**How to avoid:** Verify by checking `index.ts` — if both are there, CLN-07 is satisfied. The task should focus on version bumping to 1.5.0 and any remaining unregistered tools, not registration itself.

### Pitfall 2: intraday-timing.ts Import References in market-data.ts
**What goes wrong:** Deleting `intraday-timing.ts` without removing all its import sites.
**Why it happens:** `market-data.ts` imports `buildIntradayContext`, `SPX_15MIN_OUTCOME_FIELDS`, `VIX_OUTCOME_FIELDS`, `VIX_OHLC_OUTCOME_FIELDS`, `SPX_CHECKPOINTS`, `VIX_CHECKPOINTS` from `intraday-timing.ts` (lines 34-40). These are used extensively in the `enrich_trades` intraday context section (lines 955-1127).
**How to avoid:** The CONTEXT.md decision is to simplify enrich_trades intraday output to raw bars — this means the checkpoint-pivoting code and all `buildIntradayContext` calls must be replaced with simpler raw-bar queries before deleting `intraday-timing.ts`.

### Pitfall 3: test-exports.ts Has Multiple intraday-timing Exports
**What goes wrong:** Missing some exports when removing `intraday-timing.ts` from `test-exports.ts`.
**Why it happens:** Lines 71-82 of `test-exports.ts` export 8 symbols from `intraday-timing.ts` including the `IntradayContext` type.
**How to avoid:** Remove the entire block (lines 71-82) from `test-exports.ts`. Also remove the `intraday-timing.test.ts` test file.

### Pitfall 4: market-sync.ts Exports Used in Test
**What goes wrong:** Deleting `market-sync.ts` causes `market-sync-multi-ticker.test.ts` to fail even before we delete the test.
**Why it happens:** The test imports `syncMarketData` from `dist/test-exports.js` which re-exports from `sync/index.ts`. Delete in correct order: test file first, then remove from test-exports.ts, then remove from sync/index.ts, then delete market-sync.ts.
**How to avoid:** Delete `market-sync-multi-ticker.test.ts` first, then clean up sync/index.ts, then delete market-sync.ts.

### Pitfall 5: Pine Script "date" vs "time" Column
**What goes wrong:** New universal Pine Script still only emits a Unix timestamp `time` column, leaving `market.intraday` unpopulatable because the import tool can't split one column into two.
**Why it happens:** This was the original blocker. The decision says the Pine Script simplification "resolves" it.
**How to avoid:** The universal script must plot both a date value (YYYYMMDD integer or date string) AND a time value (HHMM or HH:MM) as separate named plots when running on intraday timeframes, OR use a PineScript trick like `str.format_time(time, "HH:mm", "America/New_York")` and `str.format_time(time, "yyyy-MM-dd", "America/New_York")` to emit date and time as separate string plots.

**Alternative approach:** Check how `import_market_csv` column mapping works — if it supports a computed field that splits Unix timestamp into date+time, the script can remain simple. Looking at `market-importer.ts`, the `applyColumnMapping` function maps source columns to schema columns 1:1. It does convert Unix timestamp → YYYY-MM-DD for the `date` column. But for `time` HH:MM, the current code has no split mechanism. The Pine Script must plot both separately.

### Pitfall 6: Tier 3 Opening_Drive_Strength and Intraday_Realized_Vol
**What goes wrong:** These two fields are mentioned in the CONTEXT.md as Tier 3 fields to implement, but they do NOT exist as columns in `market.daily` CREATE TABLE.
**Why it happens:** Looking at `market-schemas.ts`, the Tier 3 columns are `High_Time`, `Low_Time`, `High_Before_Low`, `Reversal_Type` — only 4 columns. `Opening_Drive_Strength` and `Intraday_Realized_Vol` were listed as "schema gaps" in the Phase 62/63 notes.
**How to avoid:** The Tier 3 implementation should only write the 4 existing columns: `High_Time`, `Low_Time`, `High_Before_Low`, `Reversal_Type`. The comment in market-enricher.ts line 691-692 explicitly notes `Opening_Drive_Strength` and `Intraday_Realized_Vol` as "Tier 3 schema gaps" — they're out of scope unless schema migration is added.

### Pitfall 7: describe_database Already Has Correct LAG Template
**What goes wrong:** Spending effort "updating" the LAG template when it already references `market.daily` and `market.context`.
**Why it happens:** The CONTEXT.md says "LAG template and example queries already reference new table names (verified correct)."
**How to avoid:** Only ADD intraday examples and the Import Workflow section. Do not modify the existing LAG template or basic/join/hypothesis queries — they already use the new schema.

### Pitfall 8: reports/queries.ts Has Stale Reference
**What goes wrong:** Leaving `market.spx_daily` reference in `reports/queries.ts` documentation comment (line 25).
**Why it happens:** The file is a dead module (tools were removed) but the stale comment exists.
**How to avoid:** Update the comment to use `market.daily` or remove the module entirely.

---

## Code Examples

### Deleting market-sync.ts from sync/index.ts

**Remove these lines from sync/index.ts:**
```typescript
// Remove this import:
import { syncMarketDataInternal } from "./market-sync.js";

// Remove these type exports:
export interface MarketSyncResult { ... }

// Remove this function:
export async function syncMarketData(baseDir: string): Promise<MarketSyncResult> { ... }
```

**Keep:** `syncAllBlocks`, `syncBlock`, all block-sync-related exports, metadata exports, hasher exports.

### Updating run_sql AVAILABLE_TABLES in sql.ts

```typescript
// Current (lines 31-36):
const AVAILABLE_TABLES = [
  "trades.trade_data",
  "market.spx_daily",
  "market.spx_15min",
  "market.vix_intraday",
];

// Replace with:
const AVAILABLE_TABLES = [
  "trades.trade_data",
  "trades.reporting_data",
  "market.daily",
  "market.context",
  "market.intraday",
  "market._sync_metadata",
];
```

Also update the tool description string at lines 236-237:
```typescript
// Current:
"Query trades (trades.trade_data) and market data (market.spx_daily, " +
"market.spx_15min, market.vix_intraday). " +

// Replace with:
"Query trades (trades.trade_data, trades.reporting_data) and market data " +
"(market.daily, market.context, market.intraday, market._sync_metadata). " +
```

Also update the file header comment at lines 14-19.

### Tier 3 Enrichment Pattern

The `hasTier3Data` function at line 667 and the hard-skip at 897 should be replaced with actual computation:

```typescript
async function runTier3(conn: DuckDBConnection, ticker: string, dates: string[]): Promise<TierStatus> {
  // Query intraday bars for all dates in range
  const result = await conn.runAndReadAll(`
    SELECT date, time, high, low, close
    FROM market.intraday
    WHERE ticker = $1 AND date = ANY($2)
    ORDER BY date, time
  `, [ticker, dates]);

  // Group by date, compute High_Time (decimal hours), Low_Time, High_Before_Low, Reversal_Type
  // High_Time = hour + minute/60 of the bar with the highest high for that date
  // Reversal_Type: +1 if high in morning (< 12:00) AND low in afternoon (>= 12:00)
  //               -1 if low in morning AND high in afternoon
  //                0 otherwise (trend day)

  // Batch UPDATE market.daily for [High_Time, Low_Time, High_Before_Low, Reversal_Type]
}
```

**Time parsing from HH:MM string to decimal hours:**
```typescript
function hhmmToDecimalHours(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}
```

### enrich_trades Intraday Simplification

**Replace** the complex CASE WHEN pivot + `buildIntradayContext` pattern with:
```typescript
// Simple raw bar query
const intradayResult = await conn.runAndReadAll(`
  WITH requested(ticker, date) AS (VALUES ${pairsClause})
  SELECT i.ticker, i.date, i.time, i.open, i.high, i.low, i.close
  FROM market.intraday i
  JOIN requested r ON i.ticker = r.ticker AND i.date = r.date
  ORDER BY i.ticker, i.date, i.time
`, pairParams);

// Group by ticker+date into arrays of bars
const intradayBarsByKey = new Map<string, Array<{time: string, open: number, high: number, low: number, close: number}>>();
```

Then in the enriched trade:
```typescript
baseTrade.intradayBars = intradayBarsByKey.get(marketKey) || null;
// (null when no intraday data available — graceful degradation preserved)
```

### Universal Pine Script Structure

The new script must:
1. Export raw OHLCV of the chart symbol (open, high, low, close — `time` is auto-included by TradingView)
2. For daily chart: also export VIX/VIX9D/VIX3M via `request.security()` — needed for `market.context` import
3. For intraday chart: the VIX `request.security()` calls will export na on intraday timeframes (acceptable per CONTEXT.md)
4. Export separate `Bar_Date` (YYYY-MM-DD string) and `Bar_Time` (HH:MM string) plots using `str.format_time()`

```pine
//@version=6
indicator("TradeBlocks Market Data Export", overlay=false)

// Export date and time as separate columns (required for market.intraday import)
string barDate = str.format_time(time, "yyyy-MM-dd", "America/New_York")
string barTime = str.format_time(time, "HH:mm", "America/New_York")

// VIX term structure (request.security — returns na on intraday timeframes, safe to export)
float vixOpen  = request.security("CBOE:VIX", timeframe.period, open)
float vixClose = request.security("CBOE:VIX", timeframe.period, close)
float vix9dClose = request.security("CBOE:VIX9D", timeframe.period, close)
float vix3mClose = request.security("CBOE:VIX3M", timeframe.period, close)

// Core OHLCV plots (TradingView includes open,high,low,close by default but we plot for mapping)
plot(open,  "open",  display=display.data_window)
plot(high,  "high",  display=display.data_window)
plot(low,   "low",   display=display.data_window)
plot(close, "close", display=display.data_window)

// Date/time for intraday import column mapping
plotchar(0, "Bar_Date", "", location=location.top, display=display.data_window, char=barDate)  // NOTE: PineScript plots are numeric — alternative approach needed
```

**Important caveat (LOW confidence):** PineScript `plotchar()` with a string may not work as expected for export. An alternative is to export numeric date (YYYYMMDD) and time (HHMM) values which the import tool can parse. The existing `market-importer.ts` already converts Unix timestamps to YYYY-MM-DD dates — extending this to also extract HH:MM from the timestamp would be a cleaner solution than relying on Pine Script string exports.

**Recommended approach for Pine Script date/time:** Export two numeric plots:
- `Bar_Date_Num` = `year * 10000 + month * 100 + dayofmonth` (e.g., 20240115)
- `Bar_Time_Num` = `hour(time, "America/New_York") * 100 + minute(time, "America/New_York")` (e.g., 930)

Then in `import_market_csv` column mapping, recognize these as special computed columns when target is `market.intraday`. This is the most reliable path.

**Alternative (simpler):** Extend `applyColumnMapping` in `market-importer.ts` to split a single Unix `time` column into both `date` (YYYY-MM-DD) and `time` (HH:MM ET) when both are needed. This requires no Pine Script tricks at all — the universal script just has the standard `time` column like all current scripts.

**RECOMMENDED RESOLUTION:** Check what was actually decided: the CONTEXT.md says the Pine Script simplification "resolves the format blocker." The format blocker was that intraday CSVs had a single Unix timestamp. If the importer can split one timestamp into date+time columns, the Pine Script needs no special date/time plots. The `market-importer.ts` already has Unix timestamp → YYYY-MM-DD conversion. Adding HH:MM extraction would resolve the blocker without any Pine Script tricks.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `_marketdata/` auto-sync folder | Explicit `import_market_csv` MCP tool | Phase 61 | Sync code becomes dead code in Phase 64 |
| `market.spx_daily`, `market.spx_15min`, `market.vix_intraday` table names | `market.daily`, `market.context`, `market.intraday` | Phase 60 | Public API still refers to old names |
| 3 specialized Pine Scripts (daily, 15min checkpoints, VIX intraday) | 1 universal script | Phase 64 | Users need simpler workflow |
| Tier 3 hard-skipped | Tier 3 implemented from `market.intraday` | Phase 64 | High_Time, Low_Time, Reversal_Type populated |
| intraday context as pivoted checkpoint columns | Raw OHLCV bar arrays | Phase 64 | Simpler output, no checkpoint-format coupling |

---

## File Inventory

### Files to DELETE
| File | Reason |
|------|--------|
| `/packages/mcp-server/src/sync/market-sync.ts` | Dead sync code — CLN-04 |
| `/packages/mcp-server/src/utils/intraday-timing.ts` | Checkpoint-format definitions — obsolete after raw-bar simplification |
| `/packages/mcp-server/tests/integration/market-sync-multi-ticker.test.ts` | Tests for deleted sync code |
| `/packages/mcp-server/tests/unit/intraday-timing.test.ts` | Tests for deleted intraday-timing.ts |
| `/scripts/spx-15min-checkpoints.pine` | CLN-06 |
| `/scripts/vix-intraday.pine` | CLN-06 |

### Files to MODIFY
| File | Change |
|------|--------|
| `/packages/mcp-server/src/sync/index.ts` | Remove `syncMarketData`, `MarketSyncResult`, import of `market-sync.js` |
| `/packages/mcp-server/src/test-exports.ts` | Remove `syncMarketData`, `MarketSyncResult` export (lines 34-38), remove intraday-timing exports (lines 71-82) |
| `/packages/mcp-server/src/tools/sql.ts` | Update AVAILABLE_TABLES, description, file header comment — CLN-02 |
| `/packages/mcp-server/src/tools/schema.ts` | Add intraday example queries + Import Workflow section — CLN-03 |
| `/packages/mcp-server/src/tools/market-data.ts` | Remove `intraday-timing.ts` imports, simplify enrich_trades intraday to raw bars |
| `/packages/mcp-server/src/utils/market-enricher.ts` | Implement Tier 3 replacing hard-skip at line 897 — ENR-04 |
| `/packages/mcp-server/src/tools/reports/queries.ts` | Update stale `market.spx_daily` reference in comment |
| `/packages/mcp-server/package.json` | Bump version to 1.5.0 (or confirm existing bump) |
| `/scripts/spx-daily.pine` | Replace with universal script — CLN-05 |

### Files to VERIFY (may already be correct)
| File | What to Check |
|------|---------------|
| `/packages/mcp-server/src/index.ts` | CLN-07 — confirm `registerMarketImportTools` and `registerMarketEnrichmentTools` are already called |
| `/packages/mcp-server/src/utils/schema-metadata.ts` | Confirm intraday table description is current |
| `/packages/mcp-server/src/sync/block-sync.ts` | Line 649 `_marketdata` skip logic — may stay or get cleaned up |

---

## Open Questions

1. **CLN-07 Already Done?**
   - What we know: `index.ts` lines 25-26 import `registerMarketImportTools` and `registerMarketEnrichmentTools`, and lines 285-287 call both in `createServer()`
   - What's unclear: Was CLN-07 tracking something else (e.g., a specific tool within these modules, or a version bump)?
   - Recommendation: The planner should check if CLN-07 is satisfied and collapse it into a "verify and close" task or combine with the version bump.

2. **Pine Script Date/Time Approach**
   - What we know: The blocker was that `market.intraday` needs separate `date` and `time` columns, but TradingView exports a single Unix `time` column
   - What's unclear: Should the importer split the Unix timestamp (extend `market-importer.ts`), or should the Pine Script emit numeric date/time plots?
   - Recommendation: Extend `applyColumnMapping` in `market-importer.ts` to support splitting a Unix timestamp into both `date` (YYYY-MM-DD) and `time` (HH:MM ET) outputs when both target columns are mapped to the same source column. This is the most robust approach and doesn't require Pine Script tricks. The universal script stays simple (raw OHLCV + VIX request.security, standard `time` Unix column).

3. **Tier 3: Opening_Drive_Strength and Intraday_Realized_Vol**
   - What we know: These fields are mentioned in Tier 3 docs but NOT in the `market.daily` schema
   - What's unclear: Should the Phase 64 implementation add these columns (ALTER TABLE) or scope strictly to existing 4 columns?
   - Recommendation: Scope to the 4 existing columns (High_Time, Low_Time, High_Before_Low, Reversal_Type). Opening_Drive_Strength and Intraday_Realized_Vol require schema migration and separate CONTEXT.md approval.

4. **version is 1.2.0 in index.ts but package.json was bumped to 1.5.0**
   - What we know: `index.ts` line 278 still says `version: "1.2.0"` in the McpServer constructor; package.json was bumped to 1.5.0 in a prior phase
   - What's unclear: Should index.ts McpServer version be kept in sync with package.json?
   - Recommendation: Update the McpServer constructor version to match package.json as part of this phase's version bump.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `/packages/mcp-server/src/sync/market-sync.ts` — full file read
- Direct inspection of `/packages/mcp-server/src/sync/index.ts` — full file read
- Direct inspection of `/packages/mcp-server/src/tools/sql.ts` — full file read
- Direct inspection of `/packages/mcp-server/src/tools/schema.ts` — full file read
- Direct inspection of `/packages/mcp-server/src/utils/intraday-timing.ts` — full file read
- Direct inspection of `/packages/mcp-server/src/utils/market-enricher.ts` — partial reads (lines 660-930)
- Direct inspection of `/packages/mcp-server/src/utils/schema-metadata.ts` — full file read
- Direct inspection of `/packages/mcp-server/src/tools/market-data.ts` — partial reads (key sections)
- Direct inspection of `/packages/mcp-server/src/test-exports.ts` — full file read
- Direct inspection of `/packages/mcp-server/src/index.ts` — full file read
- Direct inspection of `/scripts/spx-daily.pine`, `/scripts/spx-15min-checkpoints.pine`, `/scripts/vix-intraday.pine` — all three read
- Direct inspection of `64-CONTEXT.md`, `REQUIREMENTS.md`, `STATE.md`

---

## Metadata

**Confidence breakdown:**
- File inventory: HIGH — all files directly inspected
- Dead code scope: HIGH — all import sites and export references traced
- Tier 3 enrichment pattern: HIGH — follows identical pattern to Tier 1
- Pine Script approach: MEDIUM — universal script design is clear, but date/time export mechanism has two valid paths (importer split vs Pine Script plots); needs final decision
- CLN-07 status: HIGH — already satisfied based on index.ts inspection

**Research date:** 2026-02-22
**Valid until:** indefinite (static codebase analysis, not external library research)
