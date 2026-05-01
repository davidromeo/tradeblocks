import type { DuckDBConnection } from "@duckdb/node-api";
import * as path from "path";
import { getDataRoot } from "./data-root.js";
import { writeParquetAtomic, writeParquetPartition } from "./parquet-writer.js";

export type CanonicalSingleFileDataset = "daily" | "date_context";
export type CanonicalPartitionedDataset =
  | "intraday"
  | "option_chain"
  | "option_quote_minutes";
export type CanonicalMarketDataset = CanonicalSingleFileDataset | CanonicalPartitionedDataset;

const SINGLE_FILE_DATASETS: Record<CanonicalSingleFileDataset, string> = {
  daily: "daily.parquet",
  date_context: "date_context.parquet",
};

const PARTITIONED_DATASETS: Record<CanonicalPartitionedDataset, string> = {
  intraday: "intraday",
  option_chain: "option_chain",
  option_quote_minutes: "option_quote_minutes",
};

export function resolveMarketDir(dataDir: string): string {
  return path.join(getDataRoot(dataDir), "market");
}

export function resolveCanonicalMarketFile(
  dataDir: string,
  dataset: CanonicalSingleFileDataset,
): string {
  return path.join(resolveMarketDir(dataDir), SINGLE_FILE_DATASETS[dataset]);
}

export function resolveCanonicalMarketPartitionDir(
  dataDir: string,
  dataset: CanonicalPartitionedDataset,
): string {
  return path.join(resolveMarketDir(dataDir), PARTITIONED_DATASETS[dataset]);
}

export function resolveCanonicalMarketPartitionPath(
  dataDir: string,
  dataset: CanonicalPartitionedDataset,
  date: string,
): string {
  return path.join(resolveCanonicalMarketPartitionDir(dataDir, dataset), `date=${date}`);
}

export function resolveCanonicalMarketPartitionFile(
  dataDir: string,
  dataset: CanonicalPartitionedDataset,
  date: string,
): string {
  return path.join(resolveCanonicalMarketPartitionPath(dataDir, dataset, date), "data.parquet");
}

export function canonicalMarketTableName(dataset: CanonicalMarketDataset): string {
  return `market.${dataset}`;
}

// ============================================================================
// Market Data 3.0 — Declarative dataset registry (Phase 1)
//
// Describes the 3.0 target Parquet layout:
//   spot:                 spot/ticker=X/date=Y/data.parquet
//   enriched:             enriched/ticker=X/data.parquet
//   enriched_context:     enriched/context/data.parquet
//   option_chain:         option_chain/underlying=X/date=Y/data.parquet
//   option_quote_minutes: option_quote_minutes/underlying=X/date=Y/data.parquet
// This registry is SEPARATE from the legacy CanonicalPartitionedDataset enum
// and PARTITIONED_DATASETS map above. Both coexist per CONTEXT.md D-15:
// legacy resolvers serve existing callers (date-only paths) until Phase 3/5
// deletes them (option_chain/option_quote_minutes in Phase 3; intraday/
// daily/date_context in Phase 5 after Phase 4 consumer migration);
// the new DATASETS_V3 describes only the 3.0 target state.
// ============================================================================

export interface DatasetDef {
  subdir: string;
  partitionKeys: string[];
  filename: string;
}

export const DATASETS_V3: Record<string, DatasetDef> = {
  spot:                 { subdir: "spot",                 partitionKeys: ["ticker", "date"],     filename: "data.parquet" },
  enriched:             { subdir: "enriched",             partitionKeys: ["ticker"],             filename: "data.parquet" },
  enriched_context:     { subdir: "enriched/context",     partitionKeys: [],                     filename: "data.parquet" },
  option_chain:         { subdir: "option_chain",         partitionKeys: ["underlying", "date"], filename: "data.parquet" },
  option_quote_minutes: { subdir: "option_quote_minutes", partitionKeys: ["underlying", "date"], filename: "data.parquet" },
};

// ------ Per-dataset write helpers ------
//
// Each helper reads its DatasetDef, composes the partitions map in the order
// given by DatasetDef.partitionKeys, and delegates to writeParquetPartition
// (the generic multi-level writer from parquet-writer.ts).
//
// Security note: writeParquetPartition applies a whitelist to every partition
// key and value — /^[A-Za-z0-9._-]+$/ on values, /^[A-Za-z_][A-Za-z0-9_]*$/ on keys.
// That is the deepest defense-in-depth layer (T-1-01). Helpers do not re-validate.

export async function writeSpotPartition(
  conn: DuckDBConnection,
  args: { dataDir: string; ticker: string; date: string; selectQuery: string; compression?: string },
): Promise<{ rowCount: number }> {
  const def = DATASETS_V3.spot;
  return writeParquetPartition(conn, {
    baseDir: path.join(resolveMarketDir(args.dataDir), def.subdir),
    partitions: { ticker: args.ticker, date: args.date },   // order matches def.partitionKeys
    selectQuery: args.selectQuery,
    compression: args.compression,
    filename: def.filename,
  });
}

export async function writeChainPartition(
  conn: DuckDBConnection,
  args: { dataDir: string; underlying: string; date: string; selectQuery: string; compression?: string },
): Promise<{ rowCount: number }> {
  const def = DATASETS_V3.option_chain;
  return writeParquetPartition(conn, {
    baseDir: path.join(resolveMarketDir(args.dataDir), def.subdir),
    partitions: { underlying: args.underlying, date: args.date },
    selectQuery: args.selectQuery,
    compression: args.compression,
    filename: def.filename,
  });
}

export async function writeQuoteMinutesPartition(
  conn: DuckDBConnection,
  args: { dataDir: string; underlying: string; date: string; selectQuery: string; compression?: string },
): Promise<{ rowCount: number }> {
  const def = DATASETS_V3.option_quote_minutes;
  // Sort rows by (time, ticker) before writing so DuckDB row groups in the
  // resulting parquet have tight min/max statistics on `time`. Backtester
  // candidate-snapshot reads target a narrow time window (typically a single
  // minute), and time-sorted row groups let DuckDB's parquet reader prune
  // ~98% of row groups for those queries via column-statistics filtering.
  // Wrapping the caller's selectQuery is safer than asking every caller to
  // remember to ORDER BY: writes go through one funnel.
  const sortedSelect = `SELECT * FROM (${args.selectQuery}) AS q ORDER BY q.time, q.ticker`;
  return writeParquetPartition(conn, {
    baseDir: path.join(resolveMarketDir(args.dataDir), def.subdir),
    partitions: { underlying: args.underlying, date: args.date },
    selectQuery: sortedSelect,
    compression: args.compression,
    filename: def.filename,
  });
}

/**
 * Writes the single file for a ticker: enriched/ticker=X/data.parquet.
 * Single-level partitioning (only `ticker`).
 */
export async function writeEnrichedTickerFile(
  conn: DuckDBConnection,
  args: { dataDir: string; ticker: string; selectQuery: string; compression?: string },
): Promise<{ rowCount: number }> {
  const def = DATASETS_V3.enriched;
  return writeParquetPartition(conn, {
    baseDir: path.join(resolveMarketDir(args.dataDir), def.subdir),
    partitions: { ticker: args.ticker },
    selectQuery: args.selectQuery,
    compression: args.compression,
    filename: def.filename,
  });
}

/**
 * Writes the zero-partition enriched context file: enriched/context/data.parquet.
 *
 * SPECIAL CASE: partitionKeys=[] would cause writeParquetPartition's partition
 * loop to no-op and compose {baseDir}/data.parquet (one directory too shallow).
 * Bypass the generic writer and call writeParquetAtomic directly with the full target path.
 * Per RESEARCH.md Pattern 7 note (line 709).
 */
export async function writeEnrichedContext(
  conn: DuckDBConnection,
  args: { dataDir: string; selectQuery: string; compression?: string },
): Promise<{ rowCount: number }> {
  const def = DATASETS_V3.enriched_context;
  const targetPath = path.join(resolveMarketDir(args.dataDir), def.subdir, def.filename);
  return writeParquetAtomic(conn, {
    targetPath,
    selectQuery: args.selectQuery,
    compression: args.compression,
  });
}
