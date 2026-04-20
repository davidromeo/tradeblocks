/**
 * Shared types for the Market Data 3.0 store layer.
 *
 * Phase 1: Types only; concrete store backends ship in Phase 2.
 * This file is shared code — private-only modules MUST NOT be imported here.
 *
 * Note on BarRow / ContractRow:
 *   Both types already exist in shared code under `src/utils/` (see
 *   `src/utils/market-provider.ts` for `BarRow` and `src/utils/chain-loader.ts` for
 *   `ContractRow`). We re-export them from here to keep a single source of truth and
 *   to satisfy the shared-code-no-private-import rule. Phase 2 concrete stores and
 *   downstream plans import these from `src/market/stores/types.js`.
 */
import type { DuckDBConnection } from "@duckdb/node-api";
import type { TickerRegistry } from "../tickers/registry.js";

/**
 * StoreContext — one per MCP process (or standalone script).
 *
 * Locked to exactly four fields per CONTEXT.md D-03. `parquetMode` is a snapshot
 * taken at construction time (see RESEARCH.md Pitfall 8 — do not re-read the env var
 * mid-process, since concrete stores may cache backend choice).
 */
export interface StoreContext {
  conn: DuckDBConnection;
  dataDir: string;
  parquetMode: boolean;
  tickers: TickerRegistry;
}

/**
 * Option quote snapshot at a given minute.
 *
 * The quote store persists one row per (occ_ticker, timestamp) minute.
 * Phase 2 backends may choose wider schemas on disk, but this is the in-memory
 * contract every reader/writer agrees on.
 */
export interface QuoteRow {
  occ_ticker: string;
  timestamp: string;
  bid: number;
  ask: number;
  bid_size?: number;
  ask_size?: number;
}

/**
 * Result of `store.getCoverage(...)`.
 *
 * `earliest` / `latest` are ISO date strings (YYYY-MM-DD) or `null` when no data
 * covers the requested range. `missingDates` is the list of trading dates within
 * the requested window that have no partition. `totalDates` is the count of
 * trading dates in the requested window (inclusive on both ends).
 */
export interface CoverageReport {
  earliest: string | null;
  latest: string | null;
  missingDates: string[];
  totalDates: number;
}

// Re-export existing shared types so downstream store files (and Phase 2 concrete
// stores) have a single import path: `./types.js`.
export type { BarRow } from "../../utils/market-provider.js";
export type { ContractRow } from "../../utils/chain-loader.js";
