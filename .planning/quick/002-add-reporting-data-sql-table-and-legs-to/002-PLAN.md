---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/mcp-server/src/db/schemas.ts
  - packages/mcp-server/src/sync/block-sync.ts
  - packages/mcp-server/src/tools/performance.ts
  - packages/mcp-server/src/utils/schema-metadata.ts
autonomous: true

must_haves:
  truths:
    - "Reporting trades are queryable via SQL alongside backtest trades"
    - "Leg details are visible when comparing backtest vs actual trades"
    - "Strike differences are immediately apparent in comparison output"
  artifacts:
    - path: "packages/mcp-server/src/db/schemas.ts"
      provides: "trades.reporting_data table schema"
      contains: "reporting_data"
    - path: "packages/mcp-server/src/sync/block-sync.ts"
      provides: "Sync logic for reporting log CSV to DuckDB"
      contains: "insertReportingBatch"
    - path: "packages/mcp-server/src/tools/performance.ts"
      provides: "Leg fields in compare_backtest_to_actual output"
      contains: "backtestLegs"
  key_links:
    - from: "packages/mcp-server/src/sync/block-sync.ts"
      to: "trades.reporting_data"
      via: "INSERT statement"
      pattern: "INSERT INTO trades.reporting_data"
---

<objective>
Add reporting_data SQL table and legs to backtest-vs-actual comparison tool.

Purpose: Enable SQL queries on actual/reported trades and make strike differences visible when debugging slippage issues. Currently, only backtest trades are in DuckDB, and the comparison tool omits leg details that reveal strike differences.

Output:
1. New `trades.reporting_data` table synced from reportinglog.csv
2. `backtestLegs` and `actualLegs` fields in compare_backtest_to_actual output when detailLevel: "trades"
</objective>

<execution_context>
@/Users/davidromeo/.claude/get-shit-done/workflows/execute-plan.md
@/Users/davidromeo/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@packages/mcp-server/src/db/schemas.ts
@packages/mcp-server/src/sync/block-sync.ts
@packages/mcp-server/src/tools/performance.ts
@packages/mcp-server/src/utils/block-loader.ts
@packages/lib/models/reporting-trade.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add reporting_data table and sync logic</name>
  <files>
    packages/mcp-server/src/db/schemas.ts
    packages/mcp-server/src/sync/block-sync.ts
    packages/mcp-server/src/utils/schema-metadata.ts
  </files>
  <action>
1. In `schemas.ts`, add `ensureReportingDataTable()` function that creates `trades.reporting_data` table:
   - Columns: block_id (VARCHAR NOT NULL), date_opened (DATE NOT NULL), time_opened (VARCHAR), strategy (VARCHAR), legs (VARCHAR), initial_premium (DOUBLE), num_contracts (INTEGER), pl (DOUBLE NOT NULL), date_closed (DATE), time_closed (VARCHAR), closing_price (DOUBLE), avg_closing_cost (DOUBLE), reason_for_close (VARCHAR), opening_price (DOUBLE)
   - No PRIMARY KEY (same pattern as trade_data - trades can have duplicates)

2. Call `ensureReportingDataTable()` from the existing initialization flow (find where `ensureTradeDataTable` is called and add alongside it).

3. In `block-sync.ts`, add `insertReportingBatch()` function (mirror `insertTradeBatch`):
   - Takes conn, blockId, records array, startIdx, batchSize
   - Maps CSV columns: "Date Opened" -> date_opened, "Time Opened" -> time_opened, "Strategy" -> strategy, "Legs" -> legs, "Initial Premium" -> initial_premium, "No. of Contracts" -> num_contracts, "P/L" -> pl, "Date Closed" -> date_closed, "Time Closed" -> time_closed, "Closing Price" -> closing_price, "Avg. Closing Cost" -> avg_closing_cost, "Reason For Close" -> reason_for_close, "Opening Price" -> opening_price
   - Use same parseNumber pattern as insertTradeBatch

4. In `syncBlockInternal()`:
   - After syncing tradelog, check if reportinglog exists (use `findOptionalLogFiles` which already looks for it)
   - If reportinglog exists and reportinglog_hash differs from stored hash:
     - DELETE FROM trades.reporting_data WHERE block_id = $1
     - Read and parse reportinglog CSV
     - Insert in batches using insertReportingBatch
   - This happens within the same transaction as tradelog sync

5. In `schema-metadata.ts`, add description for the new table following existing pattern for trade_data.
  </action>
  <verify>
    Run: `TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call run_sql '{"query": "SELECT COUNT(*) FROM trades.reporting_data"}'`
    Should return count (may be 0 if no blocks have reporting logs, but should not error).
  </verify>
  <done>
    - trades.reporting_data table exists and is created on init
    - Blocks with reportinglog.csv have their data synced to reporting_data
    - Schema metadata includes reporting_data description
  </done>
</task>

<task type="auto">
  <name>Task 2: Add legs to compare_backtest_to_actual output</name>
  <files>
    packages/mcp-server/src/tools/performance.ts
  </files>
  <action>
1. In the `DetailedComparison` interface (around line 1956), add two new fields:
   - `backtestLegs: string | null`
   - `actualLegs: string | null`

2. In the trade-level matching logic (detailLevel === "trades" branch, around line 2001):
   - When building matched comparison objects (around line 2116), add:
     - `backtestLegs: btTrade.legs`
     - `actualLegs: actualTrade.legs`
   - When building unmatched backtest comparison objects (around line 2147), add:
     - `backtestLegs: btTrade.legs`
     - `actualLegs: null`
   - When building unmatched actual comparison objects (around line 2179), add:
     - `backtestLegs: null`
     - `actualLegs: actualTrade.legs`

3. Also add a "legs" entry to the `differences` array when legs differ:
   ```typescript
   if (btTrade.legs !== actualTrade.legs) {
     differences.push({
       field: "legs",
       backtest: btTrade.legs,
       actual: actualTrade.legs,
     });
   }
   ```
   Add this near the other field difference checks (after openingPrice, around line 2082).

4. Summary mode (detailLevel === "summary") does not need legs since it aggregates multiple trades.
  </action>
  <verify>
    Run: `TRADEBLOCKS_DATA_DIR=~/backtests tradeblocks-mcp --call compare_backtest_to_actual '{"blockId": "main-port-2025", "detailLevel": "trades", "dateRange": {"from": "2025-01-01", "to": "2025-01-15"}}'`
    Output should include `backtestLegs` and `actualLegs` fields in each comparison entry.
  </verify>
  <done>
    - compare_backtest_to_actual with detailLevel: "trades" includes backtestLegs and actualLegs
    - When legs differ, a "legs" entry appears in the differences array
    - Strike differences (e.g., 6970/7010 vs 6975/7015) are now visible in output
  </done>
</task>

<task type="auto">
  <name>Task 3: Bump version and update docs</name>
  <files>
    packages/mcp-server/package.json
    packages/mcp-server/CHANGELOG.md
  </files>
  <action>
1. Bump version in package.json from 0.6.0 to 0.6.1 (patch - new feature, non-breaking)

2. Add changelog entry at the top of CHANGELOG.md:
   ```markdown
   ## [0.6.1] - 2025-02-04

   ### Added
   - `trades.reporting_data` SQL table synced from reportinglog.csv
   - `backtestLegs` and `actualLegs` fields in `compare_backtest_to_actual` output (detailLevel: "trades")
   - Leg differences now shown in trade comparison differences array
   ```
  </action>
  <verify>
    Run: `cat packages/mcp-server/package.json | grep version`
    Should show "0.6.1"
  </verify>
  <done>
    - Version bumped to 0.6.1
    - CHANGELOG updated with new features
  </done>
</task>

</tasks>

<verification>
1. Table creation: `run_sql '{"query": "DESCRIBE trades.reporting_data"}'` returns column list
2. Data sync: After touching a block's reportinglog.csv, `run_sql '{"query": "SELECT COUNT(*) FROM trades.reporting_data WHERE block_id = '\''main-port-2025'\''"}'` returns trade count
3. Comparison output: `compare_backtest_to_actual` with detailLevel: "trades" shows legs in output
4. TypeScript: `npm run typecheck` passes in packages/mcp-server
</verification>

<success_criteria>
- [ ] trades.reporting_data table created automatically on server init
- [ ] Reporting log CSV data synced to DuckDB alongside tradelog
- [ ] compare_backtest_to_actual includes backtestLegs/actualLegs when detailLevel: "trades"
- [ ] Leg differences appear in the differences array
- [ ] Version bumped and changelog updated
- [ ] All tests pass, no TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/002-add-reporting-data-sql-table-and-legs-to/002-SUMMARY.md`
</output>
