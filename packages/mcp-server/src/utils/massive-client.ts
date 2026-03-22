/**
 * massive-client.ts
 *
 * Pure utility layer for the Massive.com (formerly Polygon.io) REST API adapter.
 *
 * This module provides:
 * - TypeScript types and Zod validation schemas for API responses
 * - Bidirectional ticker normalization (plain storage format ↔ Massive API format)
 * - Unix millisecond timestamp to Eastern Time date string conversion
 *
 * All exports are pure functions or values with no HTTP, fetch, or side effects.
 * The HTTP client layer (Plan 02) imports from this module to map API responses
 * to DuckDB storage rows.
 *
 * Key design decisions (per Phase 66 CONTEXT.md):
 * - D-09/D-10/D-11: Ticker prefixes (I: for indices, O: for options) are managed
 *   here — callers always use plain tickers (VIX, SPX, AAPL).
 * - adjusted=false is enforced at the HTTP call site (Plan 02).
 * - Timestamps are Unix milliseconds — NOT seconds — from the Massive aggregates API.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod Schemas for Massive API Response Validation
// ---------------------------------------------------------------------------

/**
 * Schema for a single aggregate bar from the Massive API.
 * All numeric fields are required. Timestamps are Unix milliseconds.
 */
export const MassiveBarSchema = z.object({
  v: z.number(),   // volume
  vw: z.number(),  // volume-weighted average price
  o: z.number(),   // open
  c: z.number(),   // close
  h: z.number(),   // high
  l: z.number(),   // low
  t: z.number(),   // Unix millisecond timestamp
  n: z.number(),   // number of transactions
});

export type MassiveBar = z.infer<typeof MassiveBarSchema>;

/**
 * Schema for the Massive aggregates endpoint response envelope.
 * The `next_url` field is optional — absent on the last page.
 */
export const MassiveAggregateResponseSchema = z.object({
  ticker: z.string(),
  queryCount: z.number(),
  resultsCount: z.number(),
  adjusted: z.boolean(),
  results: z.array(MassiveBarSchema),
  status: z.string(),
  request_id: z.string(),
  next_url: z.string().optional(),
});

export type MassiveAggregateResponse = z.infer<typeof MassiveAggregateResponseSchema>;

// ---------------------------------------------------------------------------
// Storage Row Type
// ---------------------------------------------------------------------------

/**
 * Shape returned to callers after translating a Massive API bar to DuckDB format.
 * Dates are YYYY-MM-DD strings in Eastern Time. Ticker uses storage format (no prefix).
 */
export interface MassiveBarRow {
  date: string;    // "YYYY-MM-DD" Eastern Time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ticker: string;  // Storage format — no I: or O: prefix
}

// ---------------------------------------------------------------------------
// Asset Class Type
// ---------------------------------------------------------------------------

/** Asset classes supported by the Massive aggregates endpoint. */
export type MassiveAssetClass = "stock" | "index" | "option";

// ---------------------------------------------------------------------------
// Ticker Normalization Functions
// ---------------------------------------------------------------------------

/**
 * Convert a storage-format ticker to the format expected by the Massive API.
 *
 * - Indices (VIX, SPX) → prepend "I:" prefix → "I:VIX"
 * - Options (OCC format) → prepend "O:" prefix if not already present → "O:SPX251219C05000000"
 * - Stocks (AAPL, SPY) → unchanged
 *
 * Per D-09: callers always pass plain tickers; this function handles the prefix.
 * Per D-10: asset class determines the prefix; options are structurally distinct.
 */
export function toMassiveTicker(ticker: string, assetClass: MassiveAssetClass): string {
  if (assetClass === "index") return ticker.startsWith("I:") ? ticker : `I:${ticker}`;
  if (assetClass === "option") return ticker.startsWith("O:") ? ticker : `O:${ticker}`;
  return ticker; // stocks have no prefix
}

/**
 * Convert a Massive API ticker back to storage format by stripping the prefix.
 *
 * - "I:VIX" → "VIX"
 * - "O:SPX251219C05000000" → "SPX251219C05000000"
 * - "AAPL" → "AAPL" (unchanged)
 *
 * Per D-11: DuckDB storage uses plain tickers (no I: or O: prefix).
 */
export function fromMassiveTicker(apiTicker: string): string {
  return apiTicker.replace(/^[IO]:/, "");
}

// ---------------------------------------------------------------------------
// Timestamp Conversion
// ---------------------------------------------------------------------------

/**
 * Convert a Unix millisecond timestamp from the Massive API to a YYYY-MM-DD
 * date string in Eastern Time (America/New_York), with full DST awareness.
 *
 * IMPORTANT: Massive returns milliseconds (not seconds). Do NOT pass raw bar.t
 * to parseFlexibleDate() which expects seconds (threshold > 1e8 would mis-detect).
 *
 * The "en-CA" locale produces YYYY-MM-DD format natively (ISO date ordering)
 * without requiring manual string formatting.
 *
 * Per Pitfall 1: This conversion must happen in the adapter layer before any
 * shared importer code touches the timestamp.
 * Per Pitfall 2: Always use America/New_York for stocks/indices/options.
 */
export function massiveTimestampToETDate(unixMs: number): string {
  return new Date(unixMs).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

// ---------------------------------------------------------------------------
// API Constants
// ---------------------------------------------------------------------------

/** Base URL for the Massive.com REST API. */
export const MASSIVE_BASE_URL = "https://api.massive.com";

/** Maximum bars per request supported by the Massive aggregates endpoint. */
export const MASSIVE_MAX_LIMIT = 50000;

/**
 * Maximum pages to fetch per import call.
 * Safety net against documented Massive pagination loop bug (polygon-io/issues #289).
 * Per D-05: Also track seen cursors in a Set<string> to detect loops before hitting this cap.
 */
export const MASSIVE_MAX_PAGES = 500;
