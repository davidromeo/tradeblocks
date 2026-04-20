export type IngestStatus = "ok" | "skipped" | "unsupported" | "error";

export interface IngestResult {
  status: IngestStatus;
  rowsWritten: number;
  dateRange?: { from: string; to: string };
  enrichment?: { from: string; to: string } | null;
  error?: string;
  details?: Record<string, unknown>;
}

export interface IngestBarsOptions {
  tickers: string[];
  from: string;
  to: string;
  timespan?: "1d" | "1m" | "5m" | "15m" | "1h";
  provider?: "massive" | "thetadata";
  skipEnrichment?: boolean;
  dryRun?: boolean;
}

export interface IngestQuotesOptions {
  /**
   * Specific OCC tickers to fetch. Per-ticker provider calls (Massive, or
   * ThetaData single-contract quote). Use when you know the exact contracts
   * you need (e.g. a backtester trade list).
   *
   * Mutually exclusive with `underlyings`. Exactly one of the two must be
   * non-empty.
   */
  tickers?: string[];
  /**
   * Underlyings to fetch every-contract-every-minute for. Routes through
   * `provider.fetchBulkQuotes` — one wildcard wire call per (root, right)
   * per date (e.g. 4 calls/day for SPX covering SPX-C, SPX-P, SPXW-C, SPXW-P).
   * Capability-gated on `capabilities().bulkByRoot` — returns status=unsupported
   * on per-ticker-only providers.
   *
   * Mutually exclusive with `tickers`.
   */
  underlyings?: string[];
  from: string;
  to: string;
  provider?: "massive" | "thetadata";
  dryRun?: boolean;
}

export interface IngestChainOptions {
  underlyings: string[];
  from: string;
  to: string;
  provider?: "massive" | "thetadata";
  dryRun?: boolean;
}

/**
 * Dataset types accepted by import_flat_file. Each maps to a single store:
 *   spot_bars      → stores.spot.writeFromSelect
 *   option_quotes  → stores.quote.writeFromSelect
 *   option_chain   → stores.chain.writeFromSelect
 *
 * Enriched is computed locally and never imported; it's absent on purpose.
 */
export type FlatFileDatasetType = "spot_bars" | "option_quotes" | "option_chain";

export interface IngestFlatFileOptions {
  /** Absolute path to a local file DuckDB can read (parquet, csv, jsonl, gz, etc.). */
  filePath: string;
  /** Which store the rows land in. */
  datasetType: FlatFileDatasetType;
  /**
   * SELECT (or WITH ... SELECT) that produces the target store's canonical
   * columns. The LLM composes this after sniffing the file via
   * `run_sql SELECT * FROM read_parquet('{filePath}') LIMIT 5` (or read_csv)
   * and comparing columns against `describe_database`.
   */
  selectSql: string;
  /**
   * Single-partition target. Required keys depend on datasetType:
   *   spot_bars      → { ticker, date }
   *   option_quotes  → { underlying, date }
   *   option_chain   → { underlying, date }
   */
  partition: { ticker?: string; underlying?: string; date: string };
  dryRun?: boolean;
}

export interface ComputeVixContextOptions {
  from: string;
  to: string;
}

export interface RefreshOptions {
  asOf: string;
  spotTickers: string[];
  chainUnderlyings?: string[];
  quoteTickers?: string[];
  computeVixContext?: boolean;
  provider?: "massive" | "thetadata";
}

export interface RefreshResult {
  status: IngestStatus;
  perOperation: {
    spot: IngestResult[];
    chain: IngestResult[];
    quotes: IngestResult[];
    vixContext: IngestResult | null;
  };
  coverage: Record<string, { totalDates: number; dateRange?: { from: string; to: string } }>;
  errors: string[];
}
