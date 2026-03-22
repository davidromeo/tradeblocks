/**
 * massive-client.ts
 *
 * HTTP adapter layer for the Massive.com (formerly Polygon.io) REST API.
 *
 * This module provides:
 * - TypeScript types and Zod validation schemas for API responses
 * - Bidirectional ticker normalization (plain storage format ↔ Massive API format)
 * - Unix millisecond timestamp to Eastern Time date string conversion
 * - fetchBars() — HTTP client function for the aggregates endpoint with pagination,
 *   rate-limit retry, Zod validation, and error handling
 *
 * Key design decisions (per Phase 66 CONTEXT.md):
 * - D-01/D-02/D-03: API key read at call site via process.env.MASSIVE_API_KEY
 * - D-05: Pagination loop guard with seen-cursor Set + MAX_PAGES=500 safety net
 * - D-06: adjusted=false and limit=50000 in all aggregate API calls
 * - D-07: 429 retry with Retry-After header or exponential backoff
 * - D-09/D-10/D-11: Ticker prefixes (I: for indices, O: for options) managed here
 * - Timestamps are Unix milliseconds — NOT seconds — from the Massive aggregates API.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod Schemas for Massive API Response Validation
// ---------------------------------------------------------------------------

/**
 * Schema for a single aggregate bar from the Massive API.
 * OHLC and timestamp are required. Volume-related fields (v, vw, n) are optional
 * because the Massive API omits them for index tickers (SPX, VIX, etc.).
 */
export const MassiveBarSchema = z.object({
  v: z.number().optional(),   // volume (missing for indices)
  vw: z.number().optional(),  // volume-weighted average price (missing for indices)
  o: z.number(),              // open
  c: z.number(),              // close
  h: z.number(),              // high
  l: z.number(),              // low
  t: z.number(),              // Unix millisecond timestamp
  n: z.number().optional(),   // number of transactions (missing for indices)
});

export type MassiveBar = z.infer<typeof MassiveBarSchema>;

/**
 * Schema for the Massive aggregates endpoint response envelope.
 * The `next_url` field is optional — absent on the last page.
 */
export const MassiveAggregateResponseSchema = z.object({
  ticker: z.string(),
  queryCount: z.number(),
  resultsCount: z.number().optional(),
  adjusted: z.boolean().optional(),
  results: z.array(MassiveBarSchema).default([]),
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
 * For intraday bars (timespan != "day"), `time` is populated with HH:MM Eastern Time.
 */
export interface MassiveBarRow {
  date: string;    // "YYYY-MM-DD" Eastern Time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ticker: string;  // Storage format — no I: or O: prefix
  time?: string;   // "HH:MM" Eastern Time — only set for intraday (minute/hour) bars
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

/**
 * Convert a Unix millisecond timestamp from the Massive API to a HH:MM time string
 * in Eastern Time (America/New_York), with full DST awareness.
 *
 * Used for intraday bar imports where both date and time are needed.
 * The returned string is always zero-padded "HH:MM" format (24-hour).
 *
 * IMPORTANT: Massive returns milliseconds (not seconds). Do NOT divide by 1000.
 */
export function massiveTimestampToETTime(unixMs: number): string {
  return new Date(unixMs).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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

// ---------------------------------------------------------------------------
// HTTP Client Options
// ---------------------------------------------------------------------------

/**
 * Options for fetching OHLCV bars from the Massive aggregates endpoint.
 * Callers always use plain tickers — the client handles I: and O: prefixes internally.
 */
export interface FetchBarsOptions {
  /** Plain ticker — VIX, AAPL, SPX251219C05000000 (no I: or O: prefix) */
  ticker: string;
  /** Start date "YYYY-MM-DD" */
  from: string;
  /** End date "YYYY-MM-DD" */
  to: string;
  /** Bar timespan (default: "day") */
  timespan?: "day" | "minute" | "hour";
  /** Bar multiplier (default: 1) */
  multiplier?: number;
  /** Asset class — determines Massive ticker prefix (default: "stock") */
  assetClass?: MassiveAssetClass;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read MASSIVE_API_KEY from the environment at call site (per D-01/D-02).
 * Throws with descriptive error if missing (per D-03).
 */
function getApiKey(): string {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) {
    throw new Error(
      "Set MASSIVE_API_KEY environment variable to use Massive.com data import"
    );
  }
  return key;
}

/**
 * Fetch a URL with auth headers and automatic retry on 429 (per D-07).
 * Reads Retry-After header when available; falls back to exponential backoff.
 * Throws with human-readable message after exhausting retries.
 */
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 429) {
      if (attempt === maxRetries) {
        throw new Error(
          "Massive.com rate limit exceeded — try again in a few minutes"
        );
      }
      const retryAfter = response.headers.get("Retry-After");
      const backoffMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.pow(2, attempt + 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }

    return response;
  }
  // This path is unreachable but satisfies TypeScript's control-flow analysis
  throw new Error("Massive.com rate limit exceeded after retries");
}

// ---------------------------------------------------------------------------
// HTTP Client — Main Export
// ---------------------------------------------------------------------------

/**
 * Fetch OHLCV bars from the Massive.com aggregates endpoint.
 *
 * Handles:
 * - Auth via MASSIVE_API_KEY env var (read at call site, per D-01)
 * - Pagination with loop guard (seen-cursor Set + MAX_PAGES safety net, per D-05)
 * - adjusted=false and limit=50000 query params (per D-06)
 * - 429 rate-limit retry with backoff (per D-07)
 * - 401 auth error with distinct message (per D-03)
 * - Zod validation of each page before mapping to rows
 * - Timestamp conversion: Unix ms → YYYY-MM-DD ET string
 * - Ticker normalization: API format → plain storage format
 *
 * @throws Error if MASSIVE_API_KEY is not set
 * @throws Error if API returns 401 (invalid key)
 * @throws Error if API returns 429 after max retries (rate limit)
 * @throws Error if response fails Zod validation
 * @throws Error if pagination cursor repeats (loop guard)
 * @throws Error if MAX_PAGES safety limit is reached
 */
export async function fetchBars(
  options: FetchBarsOptions
): Promise<MassiveBarRow[]> {
  const apiKey = getApiKey();
  const {
    ticker,
    from,
    to,
    timespan = "day",
    multiplier = 1,
    assetClass = "stock",
  } = options;

  const apiTicker = toMassiveTicker(ticker, assetClass);
  const storageTicker = fromMassiveTicker(apiTicker);
  const headers = { Authorization: `Bearer ${apiKey}` };

  // Build initial URL (per D-06: adjusted=false, limit=50000)
  let url: string | null =
    `${MASSIVE_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(apiTicker)}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=false&limit=${MASSIVE_MAX_LIMIT}`;

  const allRows: MassiveBarRow[] = [];
  const seenCursors = new Set<string>();
  let pageCount = 0;

  while (url) {
    // Safety net: max pages (per D-05)
    pageCount++;
    if (pageCount > MASSIVE_MAX_PAGES) {
      throw new Error(
        `Pagination safety limit reached (${MASSIVE_MAX_PAGES} pages) — possible API issue`
      );
    }

    const response = await fetchWithRetry(url, headers);

    // Handle auth errors (per D-03)
    if (response.status === 401) {
      throw new Error(
        "MASSIVE_API_KEY rejected by Massive.com — check your key"
      );
    }

    if (!response.ok) {
      throw new Error(
        `Massive.com API error: HTTP ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json();

    // Zod validation — fail loudly on schema drift before mapping to DuckDB rows
    const parsed = MassiveAggregateResponseSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Massive API response validation failed: ${issues}`);
    }

    const data = parsed.data;

    // Map API bars to DuckDB storage rows
    for (const bar of data.results) {
      const row: MassiveBarRow = {
        date: massiveTimestampToETDate(bar.t),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v ?? 0,
        ticker: storageTicker,
      };
      // For intraday bars, also extract the HH:MM Eastern Time component
      if (timespan !== "day") {
        row.time = massiveTimestampToETTime(bar.t);
      }
      allRows.push(row);
    }

    // Pagination (per D-05: seen-cursor guard against documented Massive loop bug)
    if (data.next_url) {
      const nextUrlObj = new URL(data.next_url);
      const cursor = nextUrlObj.searchParams.get("cursor") ?? data.next_url;
      if (seenCursors.has(cursor)) {
        throw new Error(
          `Pagination loop detected — cursor repeated: ${cursor.slice(0, 50)}...`
        );
      }
      seenCursors.add(cursor);
      url = data.next_url;
    } else {
      url = null;
    }
  }

  return allRows;
}
