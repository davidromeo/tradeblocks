# Architecture Patterns: DuckDB Analytics Layer

**Project:** TradeBlocks MCP Server - DuckDB Integration
**Researched:** 2025-02-01
**Confidence:** HIGH (based on official DuckDB documentation and existing codebase analysis)

## Executive Summary

This document defines the architecture for adding DuckDB as an analytics layer to the TradeBlocks MCP server. The design preserves the existing folder-based block portability (delete folder = block disappears, add folder = block appears) while enabling cross-block SQL queries with market data joins.

## Recommended Architecture

```
~/backtests/
├── _marketdata/
│   ├── spx_daily.csv          # Source CSV (unchanged)
│   ├── spx_15min.csv          # Source CSV (unchanged)
│   ├── spx_highlow.csv        # Source CSV (unchanged)
│   ├── vix_intraday.csv       # Source CSV (unchanged)
│   └── market.duckdb          # NEW: DuckDB market data store
├── block-a/
│   ├── tradelog.csv           # Source of truth (unchanged)
│   ├── dailylog.csv           # Optional (unchanged)
│   └── reportinglog.csv       # Optional (unchanged)
├── block-b/
│   └── tradelog.csv
└── trades.duckdb              # NEW: Cross-block trade cache
```

### Design Principles

1. **CSVs remain source of truth** - DuckDB databases are derived caches
2. **Sync on demand** - Check freshness before queries, not on startup
3. **Lazy initialization** - Create databases only when analytics features are used
4. **Graceful degradation** - If DuckDB unavailable, fall back to existing CSV logic
5. **Block portability preserved** - Folder operations work as expected

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `DuckDBManager` | Database lifecycle, connection pooling | SyncManager, QueryExecutor |
| `SyncManager` | CSV-to-DuckDB synchronization logic | DuckDBManager, file system |
| `QueryExecutor` | Cross-block SQL query execution | DuckDBManager |
| `block-loader.ts` | Existing CSV loading (unchanged) | File system |
| Tool handlers | MCP tool implementations | All above |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Tool Request                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Query Complexity Check                      │
│         (Single block? Use existing CSV logic)                   │
│         (Cross-block or analytics? Use DuckDB)                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SyncManager                              │
│   1. Check _sync_metadata table for stale blocks                │
│   2. Compare CSV mtime vs cached mtime                          │
│   3. Re-import changed/new blocks only                          │
│   4. Remove deleted blocks                                       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       QueryExecutor                              │
│   Execute user SQL against synced DuckDB tables                 │
└─────────────────────────────────────────────────────────────────┘
```

## Database Initialization and Schema Design

### Package Selection

**Use `@duckdb/node-api` (Node Neo)** - The new official DuckDB Node.js client.

Rationale:
- Native TypeScript support (no wrapper needed)
- Promise-based API (no callback hell)
- Actively maintained; old `duckdb` package deprecated (end of life: DuckDB 1.5.x in early 2026)
- Built on DuckDB's C API with more functionality exposed

```typescript
// Installation
npm install @duckdb/node-api

// Basic usage pattern
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

const instance = await DuckDBInstance.create('trades.duckdb');
const connection = await instance.connect();
```

### Schema: market.duckdb

Located at `~/backtests/_marketdata/market.duckdb`.

```sql
-- Sync metadata table
CREATE TABLE IF NOT EXISTS _sync_metadata (
    source_file VARCHAR PRIMARY KEY,
    mtime_ms BIGINT NOT NULL,
    row_count INTEGER NOT NULL,
    synced_at TIMESTAMP NOT NULL DEFAULT current_timestamp
);

-- Daily market data (from spx_daily.csv)
CREATE TABLE IF NOT EXISTS daily_market (
    date DATE PRIMARY KEY,
    prior_close DOUBLE,
    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,
    gap_pct DOUBLE,
    intraday_range_pct DOUBLE,
    intraday_return_pct DOUBLE,
    total_return_pct DOUBLE,
    close_position_in_range DOUBLE,
    gap_filled INTEGER,
    vix_open DOUBLE,
    vix_close DOUBLE,
    vix_change_pct DOUBLE,
    vix_spike_pct DOUBLE,
    vix_percentile DOUBLE,
    vol_regime INTEGER,
    vix9d_close DOUBLE,
    vix3m_close DOUBLE,
    vix9d_vix_ratio DOUBLE,
    vix_vix3m_ratio DOUBLE,
    term_structure_state INTEGER,
    atr_pct DOUBLE,
    rsi_14 DOUBLE,
    price_vs_ema21_pct DOUBLE,
    price_vs_sma50_pct DOUBLE,
    trend_score INTEGER,
    bb_position DOUBLE,
    return_5d DOUBLE,
    return_20d DOUBLE,
    consecutive_days INTEGER,
    day_of_week INTEGER,
    month INTEGER,
    is_opex INTEGER,
    prev_return_pct DOUBLE
);

-- 15-minute intraday data (from spx_15min.csv)
CREATE TABLE IF NOT EXISTS intraday_15min (
    date DATE PRIMARY KEY,
    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,
    p_0930 DOUBLE,
    p_0945 DOUBLE,
    -- ... all P_* columns
    p_1545 DOUBLE,
    pct_0930_to_1000 DOUBLE,
    pct_0930_to_1200 DOUBLE,
    pct_0930_to_1500 DOUBLE,
    pct_0930_to_close DOUBLE,
    moc_15min DOUBLE,
    moc_30min DOUBLE,
    moc_45min DOUBLE,
    moc_60min DOUBLE,
    afternoon_move DOUBLE
);

-- High/low timing data (from spx_highlow.csv)
CREATE TABLE IF NOT EXISTS highlow_timing (
    date DATE PRIMARY KEY,
    open DOUBLE,
    high DOUBLE,
    low DOUBLE,
    close DOUBLE,
    high_time DOUBLE,
    low_time DOUBLE,
    high_before_low INTEGER,
    high_in_first_hour INTEGER,
    low_in_first_hour INTEGER,
    high_in_last_hour INTEGER,
    low_in_last_hour INTEGER,
    reversal_type INTEGER,
    high_low_spread DOUBLE,
    early_extreme DOUBLE,
    late_extreme DOUBLE,
    intraday_high DOUBLE,
    intraday_low DOUBLE
);

-- VIX intraday data (from vix_intraday.csv)
CREATE TABLE IF NOT EXISTS vix_intraday (
    date DATE PRIMARY KEY,
    -- ... all VIX columns
);
```

### Schema: trades.duckdb

Located at `~/backtests/trades.duckdb` (sibling to block folders).

```sql
-- Sync metadata table
CREATE TABLE IF NOT EXISTS _sync_metadata (
    block_id VARCHAR NOT NULL,
    csv_type VARCHAR NOT NULL,  -- 'tradelog', 'dailylog', 'reportinglog'
    filename VARCHAR NOT NULL,
    mtime_ms BIGINT NOT NULL,
    row_count INTEGER NOT NULL,
    synced_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (block_id, csv_type)
);

-- All trades from all blocks (denormalized for query performance)
CREATE TABLE IF NOT EXISTS trades (
    block_id VARCHAR NOT NULL,
    date_opened DATE NOT NULL,
    time_opened VARCHAR,
    date_closed DATE,
    time_closed VARCHAR,
    strategy VARCHAR NOT NULL,
    legs VARCHAR,
    num_contracts INTEGER,
    opening_price DOUBLE,
    closing_price DOUBLE,
    premium DOUBLE,
    pl DOUBLE NOT NULL,
    opening_commissions DOUBLE,
    closing_commissions DOUBLE,
    margin_req DOUBLE,
    funds_at_close DOUBLE,
    reason_for_close VARCHAR,
    opening_vix DOUBLE,
    closing_vix DOUBLE,
    gap DOUBLE,
    movement DOUBLE,
    max_profit DOUBLE,
    max_loss DOUBLE
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_trades_block ON trades(block_id);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date_opened);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy);
CREATE INDEX IF NOT EXISTS idx_trades_block_date ON trades(block_id, date_opened);

-- Daily logs from all blocks
CREATE TABLE IF NOT EXISTS daily_logs (
    block_id VARCHAR NOT NULL,
    date DATE NOT NULL,
    net_liquidity DOUBLE,
    current_funds DOUBLE,
    withdrawn DOUBLE,
    trading_funds DOUBLE,
    daily_pl DOUBLE,
    daily_pl_pct DOUBLE,
    drawdown_pct DOUBLE,
    PRIMARY KEY (block_id, date)
);

-- Reporting logs (actual trades) from all blocks
CREATE TABLE IF NOT EXISTS reporting_trades (
    block_id VARCHAR NOT NULL,
    trade_id VARCHAR,
    date DATE NOT NULL,
    strategy VARCHAR,
    symbol VARCHAR,
    contracts INTEGER,
    actual_pl DOUBLE,
    -- ... other reporting fields
    PRIMARY KEY (block_id, trade_id)
);
```

## Sync Algorithm

### Core Sync Logic

The sync follows a lazy, incremental pattern that handles all cases: add, update, delete.

```typescript
interface SyncMetadata {
  block_id: string;
  csv_type: 'tradelog' | 'dailylog' | 'reportinglog';
  filename: string;
  mtime_ms: number;
  row_count: number;
  synced_at: Date;
}

async function syncTradesDatabase(baseDir: string, db: DuckDBConnection): Promise<SyncResult> {
  // 1. Scan filesystem for current blocks
  const currentBlocks = await discoverBlocks(baseDir);

  // 2. Load existing sync metadata from DuckDB
  const reader = await db.runAndReadAll(
    'SELECT block_id, csv_type, filename, mtime_ms FROM _sync_metadata'
  );
  const cachedMetadata = new Map<string, SyncMetadata>();
  for (const row of reader.getRowObjects()) {
    const key = `${row.block_id}:${row.csv_type}`;
    cachedMetadata.set(key, row as SyncMetadata);
  }

  // 3. Identify changes
  const toAdd: BlockCsv[] = [];
  const toUpdate: BlockCsv[] = [];
  const toDelete: string[] = [];

  for (const block of currentBlocks) {
    for (const csv of block.csvFiles) {
      const key = `${block.blockId}:${csv.type}`;
      const cached = cachedMetadata.get(key);

      if (!cached) {
        toAdd.push({ blockId: block.blockId, ...csv });
      } else if (cached.mtime_ms !== csv.mtimeMs) {
        toUpdate.push({ blockId: block.blockId, ...csv });
      }
      cachedMetadata.delete(key);  // Mark as seen
    }
  }

  // Remaining in cachedMetadata = deleted blocks
  for (const [key, meta] of cachedMetadata) {
    toDelete.push(meta.block_id);
  }

  // 4. Apply changes within transaction
  await db.run('BEGIN TRANSACTION');
  try {
    // Delete removed blocks
    for (const blockId of new Set(toDelete)) {
      await db.run('DELETE FROM trades WHERE block_id = ?', [blockId]);
      await db.run('DELETE FROM daily_logs WHERE block_id = ?', [blockId]);
      await db.run('DELETE FROM reporting_trades WHERE block_id = ?', [blockId]);
      await db.run('DELETE FROM _sync_metadata WHERE block_id = ?', [blockId]);
    }

    // Update changed blocks (delete + re-import)
    for (const csv of toUpdate) {
      await deleteBlockCsv(db, csv.blockId, csv.type);
      await importBlockCsv(db, baseDir, csv);
    }

    // Add new blocks
    for (const csv of toAdd) {
      await importBlockCsv(db, baseDir, csv);
    }

    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }

  return { added: toAdd.length, updated: toUpdate.length, deleted: toDelete.length };
}
```

### CSV Import Pattern

Use DuckDB's native CSV reading with explicit column mapping for performance and reliability.

```typescript
async function importBlockCsv(
  db: DuckDBConnection,
  baseDir: string,
  csv: { blockId: string; type: string; filename: string; mtimeMs: number }
): Promise<void> {
  const csvPath = path.join(baseDir, csv.blockId, csv.filename);

  if (csv.type === 'tradelog') {
    // Use COPY for bulk import with column mapping
    await db.run(`
      INSERT INTO trades
      SELECT
        '${csv.blockId}' AS block_id,
        strptime("Date Opened", '%Y-%m-%d')::DATE AS date_opened,
        "Time Opened" AS time_opened,
        CASE WHEN "Date Closed" != '' THEN strptime("Date Closed", '%Y-%m-%d')::DATE END AS date_closed,
        "Time Closed" AS time_closed,
        COALESCE(NULLIF("Strategy", ''), 'Unknown') AS strategy,
        "Legs" AS legs,
        TRY_CAST("No. of Contracts" AS INTEGER) AS num_contracts,
        TRY_CAST(REPLACE(REPLACE("Opening Price", '$', ''), ',', '') AS DOUBLE) AS opening_price,
        TRY_CAST(REPLACE(REPLACE("Closing Price", '$', ''), ',', '') AS DOUBLE) AS closing_price,
        TRY_CAST(REPLACE(REPLACE("Premium", '$', ''), ',', '') AS DOUBLE) AS premium,
        TRY_CAST(REPLACE(REPLACE("P/L", '$', ''), ',', '') AS DOUBLE) AS pl,
        TRY_CAST(REPLACE(REPLACE(COALESCE("Opening Commissions + Fees", "Opening comms & fees", '0'), '$', ''), ',', '') AS DOUBLE) AS opening_commissions,
        TRY_CAST(REPLACE(REPLACE(COALESCE("Closing Commissions + Fees", "Closing comms & fees", '0'), '$', ''), ',', '') AS DOUBLE) AS closing_commissions,
        TRY_CAST(REPLACE(REPLACE("Margin Req.", '$', ''), ',', '') AS DOUBLE) AS margin_req,
        TRY_CAST(REPLACE(REPLACE("Funds at Close", '$', ''), ',', '') AS DOUBLE) AS funds_at_close,
        "Reason For Close" AS reason_for_close,
        TRY_CAST("Opening VIX" AS DOUBLE) AS opening_vix,
        TRY_CAST("Closing VIX" AS DOUBLE) AS closing_vix,
        TRY_CAST("Gap" AS DOUBLE) AS gap,
        TRY_CAST("Movement" AS DOUBLE) AS movement,
        TRY_CAST(REPLACE(REPLACE("Max Profit", '$', ''), ',', '') AS DOUBLE) AS max_profit,
        TRY_CAST(REPLACE(REPLACE("Max Loss", '$', ''), ',', '') AS DOUBLE) AS max_loss
      FROM read_csv('${csvPath.replace(/'/g, "''")}',
        header=true,
        auto_detect=true,
        ignore_errors=true
      )
    `);
  }

  // Update sync metadata
  const stat = await fs.stat(csvPath);
  const rowCount = await getRowCount(db, 'trades', csv.blockId);

  await db.run(`
    INSERT OR REPLACE INTO _sync_metadata
    (block_id, csv_type, filename, mtime_ms, row_count, synced_at)
    VALUES (?, ?, ?, ?, ?, current_timestamp)
  `, [csv.blockId, csv.type, csv.filename, stat.mtimeMs, rowCount]);
}
```

### Sync Timing Strategy

**Lazy sync before queries:**
```typescript
class DuckDBManager {
  private lastSyncCheck: number = 0;
  private readonly SYNC_CHECK_INTERVAL = 60_000; // 1 minute

  async ensureSynced(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSyncCheck < this.SYNC_CHECK_INTERVAL) {
      return; // Skip check, recently synced
    }

    await this.syncIfNeeded();
    this.lastSyncCheck = now;
  }

  private async syncIfNeeded(): Promise<void> {
    // Quick check: any CSV mtime newer than our last full sync?
    const needsSync = await this.hasNewerFiles();
    if (needsSync) {
      await syncTradesDatabase(this.baseDir, this.connection);
    }
  }
}
```

**Why lazy over eager:**
- MCP server may be started but never used for analytics
- Prevents blocking startup with large CSV imports
- Allows immediate response to simple queries (existing CSV logic)
- Sync cost is only paid when cross-block features are used

## Query Execution Flow

### Query Router

Route queries based on complexity:

```typescript
async function handleQuery(
  baseDir: string,
  blockId: string | null,
  query: QueryParams
): Promise<QueryResult> {
  // Simple single-block queries: use existing CSV logic
  if (blockId && !query.requiresJoin && !query.requiresAggregation) {
    return await handleSimpleQuery(baseDir, blockId, query);
  }

  // Complex/cross-block queries: use DuckDB
  const db = await getDuckDBManager().getConnection();
  await db.ensureSynced();

  return await executeAnalyticsQuery(db, query);
}
```

### Cross-Block Query Example

```sql
-- Find correlation between VIX regime and strategy performance
SELECT
  t.strategy,
  m.vol_regime,
  COUNT(*) as trade_count,
  SUM(t.pl) as total_pl,
  AVG(t.pl) as avg_pl,
  SUM(CASE WHEN t.pl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as win_rate
FROM trades t
JOIN daily_market m ON t.date_opened = m.date
WHERE t.block_id IN ('main-port', 'ira-port')
GROUP BY t.strategy, m.vol_regime
ORDER BY t.strategy, m.vol_regime;
```

### Attaching Market Database for Joins

```typescript
async function executeWithMarketData(
  tradesDb: DuckDBConnection,
  sql: string
): Promise<ResultReader> {
  const marketDbPath = path.join(this.baseDir, '_marketdata', 'market.duckdb');

  // Attach market database for cross-database joins
  await tradesDb.run(`ATTACH '${marketDbPath}' AS market (READ_ONLY)`);

  try {
    // Execute query with access to both databases
    return await tradesDb.runAndReadAll(sql);
  } finally {
    await tradesDb.run('DETACH market');
  }
}
```

## Error Handling

### Stale/Missing Data

```typescript
interface SyncStatus {
  lastSync: Date | null;
  staleness: 'fresh' | 'stale' | 'unknown';
  missingBlocks: string[];
  errors: string[];
}

async function checkSyncStatus(db: DuckDBConnection): Promise<SyncStatus> {
  const reader = await db.runAndReadAll(`
    SELECT
      block_id,
      synced_at,
      mtime_ms
    FROM _sync_metadata
  `);

  const status: SyncStatus = {
    lastSync: null,
    staleness: 'unknown',
    missingBlocks: [],
    errors: []
  };

  // Check each block's freshness
  for (const row of reader.getRowObjects()) {
    const currentMtime = await getFileMtime(row.block_id);
    if (currentMtime > row.mtime_ms) {
      status.staleness = 'stale';
      status.missingBlocks.push(row.block_id);
    }
  }

  return status;
}
```

### Graceful Degradation

```typescript
async function executeWithFallback<T>(
  analyticsQuery: () => Promise<T>,
  csvFallback: () => Promise<T>
): Promise<{ result: T; source: 'duckdb' | 'csv' }> {
  try {
    const result = await analyticsQuery();
    return { result, source: 'duckdb' };
  } catch (error) {
    console.warn('DuckDB query failed, falling back to CSV:', error);
    const result = await csvFallback();
    return { result, source: 'csv' };
  }
}
```

### Database Corruption Recovery

```typescript
async function initializeDatabase(dbPath: string): Promise<DuckDBConnection> {
  try {
    const instance = await DuckDBInstance.create(dbPath);
    const conn = await instance.connect();

    // Verify database integrity
    await conn.run('PRAGMA integrity_check');

    return conn;
  } catch (error) {
    // Database corrupted - delete and recreate
    console.warn(`Database corrupted at ${dbPath}, recreating...`);
    await fs.unlink(dbPath).catch(() => {});
    await fs.unlink(dbPath + '.wal').catch(() => {});

    const instance = await DuckDBInstance.create(dbPath);
    return await instance.connect();
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Eager Sync on Startup

**What:** Syncing all CSVs to DuckDB when MCP server starts
**Why bad:** Blocks startup, wastes resources if analytics not used
**Instead:** Lazy sync before first analytics query, with periodic refresh

### Anti-Pattern 2: Per-Query Database Opening

**What:** Opening new DuckDB connection for each MCP tool call
**Why bad:** Connection overhead, lost caching benefits
**Instead:** Connection pooling with DuckDBInstance.fromCache()

### Anti-Pattern 3: Full Re-Import on Any Change

**What:** Dropping all tables and re-importing when any CSV changes
**Why bad:** O(n) work for O(1) change, slow for large datasets
**Instead:** Incremental sync with mtime-based change detection

### Anti-Pattern 4: Ignoring CSV as Source of Truth

**What:** Storing derived data only in DuckDB
**Why bad:** Breaks block portability, loses data on db corruption
**Instead:** Always derive from CSVs, DuckDB is a cache

### Anti-Pattern 5: Storing DuckDB Files Inside Block Folders

**What:** `block-a/block.duckdb` per-block databases
**Why bad:** Can't do cross-block queries efficiently, duplication
**Instead:** Single `trades.duckdb` at root with block_id column

## Scalability Considerations

| Concern | At 100 trades | At 10K trades | At 1M trades |
|---------|---------------|---------------|--------------|
| Sync time | < 100ms | < 1s | 5-10s |
| Query time | < 10ms | < 100ms | < 1s |
| Database size | < 1MB | < 10MB | ~100MB |
| Memory usage | Minimal | ~50MB | ~500MB |
| Approach | Sync every query | 1-min sync interval | Background sync worker |

### For Large Datasets (Future Consideration)

If trade count exceeds 100K:
1. Convert CSVs to Parquet for 10x faster reads
2. Add background sync worker with file watcher
3. Consider partitioning trades table by year
4. Add materialized views for common aggregations

## Sources

- [DuckDB Node Neo Client Documentation](https://duckdb.org/docs/stable/clients/node_neo/overview)
- [DuckDB Node Neo GitHub](https://github.com/duckdb/duckdb-node-neo)
- [@duckdb/node-api NPM Package](https://www.npmjs.com/package/@duckdb/node-api)
- [DuckDB CSV Import Guide](https://duckdb.org/docs/stable/guides/file_formats/csv_import)
- [DuckDB CSV Auto Detection](https://duckdb.org/docs/stable/data/csv/auto_detection)
- [DuckDB INSERT Statement (Upsert)](https://duckdb.org/docs/stable/sql/statements/insert)
- [DuckDB ATTACH/DETACH for Multi-Database](https://duckdb.org/docs/stable/sql/statements/attach)
- [DuckDB Concurrency Model](https://duckdb.org/docs/stable/connect/concurrency)
- [DuckDB Performance Guide](https://duckdb.org/docs/stable/guides/performance/overview)
- [DuckDB OLAP Caching Patterns (MotherDuck)](https://motherduck.com/blog/duckdb-olap-caching/)
