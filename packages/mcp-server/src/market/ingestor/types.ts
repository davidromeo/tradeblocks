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

export interface IngestFlatFileOptions {
  date: string;
  assetClass: "option" | "index";
  underlying: string;
  provider?: "massive";
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
