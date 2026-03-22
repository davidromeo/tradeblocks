/**
 * massive-snapshot.ts
 *
 * HTTP client for the Massive.com v3/snapshot/options endpoint.
 *
 * Provides:
 * - Zod validation schemas for the snapshot API response
 * - fetchOptionSnapshot() — fetches full option chain with pagination
 * - Black-Scholes greeks fallback when API greeks are missing
 * - Timezone-safe DTE computation for BS calculations
 *
 * Key design decisions (per Phase 70 CONTEXT.md):
 * - D-01/D-02: Auto-paginate with seen-cursor guard + MAX_PAGES safety
 * - D-04: BS fallback via computeLegGreeks when greeks are null/missing
 * - D-05: greeks_source field: "massive" or "computed" per contract
 */

import { z } from "zod";
import {
  toMassiveTicker,
  fromMassiveTicker,
  MASSIVE_BASE_URL,
  MASSIVE_MAX_PAGES,
} from "./massive-client.js";
import type { MassiveAssetClass } from "./massive-client.js";
import { computeLegGreeks } from "./black-scholes.js";

// ---------------------------------------------------------------------------
// Known index tickers (for asset class detection)
// ---------------------------------------------------------------------------

const INDEX_TICKERS = new Set([
  "SPX", "NDX", "RUT", "DJX", "VIX", "VIX9D", "VIX3M", "OEX", "XSP",
]);

// ---------------------------------------------------------------------------
// Zod Schemas for Massive Snapshot API Response
// ---------------------------------------------------------------------------

export const MassiveSnapshotGreeksSchema = z.object({
  delta: z.number(),
  gamma: z.number(),
  theta: z.number(),
  vega: z.number(),
});

export const MassiveSnapshotDaySchema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  change: z.number(),
  change_percent: z.number(),
  volume: z.number().optional(),
  vwap: z.number().optional(),
  previous_close: z.number(),
  last_updated: z.number(),
});

export const MassiveSnapshotQuoteSchema = z.object({
  bid: z.number(),
  ask: z.number(),
  midpoint: z.number(),
  bid_size: z.number(),
  ask_size: z.number(),
  last_updated: z.number(),
  timeframe: z.string(),
});

export const MassiveSnapshotTradeSchema = z.object({
  price: z.number(),
  size: z.number(),
  sip_timestamp: z.number(),
  conditions: z.array(z.number()).optional(),
  timeframe: z.string(),
});

export const MassiveSnapshotDetailsSchema = z.object({
  ticker: z.string(),
  contract_type: z.string(),
  strike_price: z.number(),
  expiration_date: z.string(),
  exercise_style: z.string(),
  shares_per_contract: z.number(),
});

export const MassiveSnapshotUnderlyingSchema = z.object({
  ticker: z.string(),
  price: z.number(),
  change_to_break_even: z.number(),
  last_updated: z.number(),
  timeframe: z.string(),
});

export const MassiveSnapshotContractSchema = z.object({
  break_even_price: z.number(),
  implied_volatility: z.number(),
  open_interest: z.number(),
  greeks: MassiveSnapshotGreeksSchema.optional(),
  day: MassiveSnapshotDaySchema,
  last_quote: MassiveSnapshotQuoteSchema,
  last_trade: MassiveSnapshotTradeSchema.optional(),
  details: MassiveSnapshotDetailsSchema,
  underlying_asset: MassiveSnapshotUnderlyingSchema,
});

export const MassiveSnapshotResponseSchema = z.object({
  request_id: z.string(),
  status: z.string(),
  results: z.array(MassiveSnapshotContractSchema),
  next_url: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Output Types
// ---------------------------------------------------------------------------

/** Curated option contract returned to callers. */
export interface OptionContract {
  ticker: string;            // OCC ticker without O: prefix
  underlying_ticker: string; // from underlying_asset.ticker via fromMassiveTicker
  underlying_price: number;  // from underlying_asset.price
  contract_type: "call" | "put";
  strike: number;
  expiration: string;        // YYYY-MM-DD
  exercise_style: string;    // "american" or "european"
  // Greeks
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;         // implied_volatility from API, or computed
  greeks_source: "massive" | "computed";
  // Quotes
  bid: number;
  ask: number;
  midpoint: number;
  last_price: number | null; // from last_trade.price (null if no last_trade)
  // Volume/OI
  open_interest: number;
  volume: number;            // from day.volume
  // Derived
  break_even: number;
}

/** Input options for fetchOptionSnapshot. */
export interface FetchOptionSnapshotOptions {
  underlying: string;            // Plain ticker: "SPX", "SPY", "AAPL"
  strike_price_gte?: number;     // Min strike
  strike_price_lte?: number;     // Max strike
  expiration_date_gte?: string;  // Min expiry "YYYY-MM-DD"
  expiration_date_lte?: string;  // Max expiry "YYYY-MM-DD"
  contract_type?: "call" | "put";
}

/** Result from fetchOptionSnapshot. */
export interface FetchOptionSnapshotResult {
  contracts: OptionContract[];
  underlying_price: number;
  underlying_ticker: string;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Read MASSIVE_API_KEY from environment at call site.
 * Re-implemented locally since getApiKey is not exported from massive-client.
 */
function getApiKey(): string {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) {
    throw new Error(
      "Set MASSIVE_API_KEY environment variable to use Massive.com data import",
    );
  }
  return key;
}

/**
 * Fetch URL with auth and retry on 429.
 * Same pattern as massive-client.ts fetchWithRetry (private there).
 */
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries = 2,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 429) {
      if (attempt === maxRetries) {
        throw new Error(
          "Massive.com rate limit exceeded — try again in a few minutes",
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
  throw new Error("Massive.com rate limit exceeded after retries");
}

/**
 * Compute timezone-safe DTE (days to expiry).
 *
 * Uses Eastern Time calendar date to avoid UTC off-by-one near expiration.
 * Per CLAUDE.md date handling rules: parse dates via regex, use en-CA locale
 * with America/New_York timezone for "today".
 */
function computeDTE(expirationDate: string): number {
  // Parse expiration date components via regex (no Date constructor ambiguity)
  const expMatch = expirationDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!expMatch) return 0;
  const [, expYearS, expMonthS, expDayS] = expMatch;
  const expYear = parseInt(expYearS, 10);
  const expMonth = parseInt(expMonthS, 10);
  const expDay = parseInt(expDayS, 10);

  // Get today's ET calendar date
  const todayET = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const todayMatch = todayET.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!todayMatch) return 0;
  const [, todayYearS, todayMonthS, todayDayS] = todayMatch;
  const todayYear = parseInt(todayYearS, 10);
  const todayMonth = parseInt(todayMonthS, 10);
  const todayDay = parseInt(todayDayS, 10);

  // DTE = difference in calendar days using Date.UTC (no timezone shift)
  const dte =
    (Date.UTC(expYear, expMonth - 1, expDay) -
      Date.UTC(todayYear, todayMonth - 1, todayDay)) /
    86_400_000;

  // If expired or same-day, use tiny positive to avoid division by zero in BS
  return dte <= 0 ? 0.001 : dte;
}

/**
 * Detect asset class for underlying ticker.
 * Known indices use 'index' (I: prefix); everything else is 'stock'.
 */
function detectAssetClass(ticker: string): MassiveAssetClass {
  return INDEX_TICKERS.has(ticker.toUpperCase()) ? "index" : "stock";
}

/**
 * Map a validated Massive contract to OptionContract output shape.
 * Applies BS fallback when greeks are missing.
 */
function mapContract(
  contract: z.infer<typeof MassiveSnapshotContractSchema>,
): OptionContract {
  const hasApiGreeks =
    contract.greeks != null && contract.greeks.delta != null;

  let delta: number | null = null;
  let gamma: number | null = null;
  let theta: number | null = null;
  let vega: number | null = null;
  let iv: number | null = null;
  let greeksSource: "massive" | "computed" = "computed";

  if (hasApiGreeks) {
    // API greeks present — pass through
    delta = contract.greeks!.delta;
    gamma = contract.greeks!.gamma;
    theta = contract.greeks!.theta;
    vega = contract.greeks!.vega;
    iv = contract.implied_volatility;
    greeksSource = "massive";
  } else {
    // BS fallback (per D-04)
    const optionPrice =
      contract.last_trade?.price ?? contract.last_quote.midpoint;
    const underlyingPrice = contract.underlying_asset.price;
    const strike = contract.details.strike_price;
    const dte = computeDTE(contract.details.expiration_date);
    const type = contract.details.contract_type === "call" ? "C" : "P";
    const riskFreeRate = 0.045;
    const dividendYield = 0.015;

    const result = computeLegGreeks(
      optionPrice,
      underlyingPrice,
      strike,
      dte,
      type as "C" | "P",
      riskFreeRate,
      dividendYield,
    );

    if (result.iv !== null) {
      delta = result.delta;
      gamma = result.gamma;
      theta = result.theta;
      vega = result.vega;
      iv = result.iv;
    }
    greeksSource = "computed";
  }

  return {
    ticker: fromMassiveTicker(contract.details.ticker),
    underlying_ticker: fromMassiveTicker(contract.underlying_asset.ticker),
    underlying_price: contract.underlying_asset.price,
    contract_type: contract.details.contract_type as "call" | "put",
    strike: contract.details.strike_price,
    expiration: contract.details.expiration_date,
    exercise_style: contract.details.exercise_style,
    delta,
    gamma,
    theta,
    vega,
    iv,
    greeks_source: greeksSource,
    bid: contract.last_quote.bid,
    ask: contract.last_quote.ask,
    midpoint: contract.last_quote.midpoint,
    last_price: contract.last_trade?.price ?? null,
    open_interest: contract.open_interest,
    volume: contract.day.volume ?? 0,
    break_even: contract.break_even_price,
  };
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Fetch option chain snapshot from the Massive.com v3/snapshot/options endpoint.
 *
 * Handles:
 * - Auth via MASSIVE_API_KEY env var (read at call site)
 * - Pagination with loop guard (seen-cursor Set + MAX_PAGES safety)
 * - 429 rate-limit retry with backoff
 * - 401 auth error with distinct message
 * - Zod validation of each page
 * - Black-Scholes greeks fallback for contracts with missing greeks
 * - Timezone-safe DTE computation for BS calculations
 *
 * @throws Error if MASSIVE_API_KEY is not set
 * @throws Error if API returns 401 (invalid key)
 * @throws Error if API returns 429 after max retries
 * @throws Error if response fails Zod validation
 * @throws Error if pagination cursor repeats (loop guard)
 */
export async function fetchOptionSnapshot(
  options: FetchOptionSnapshotOptions,
): Promise<FetchOptionSnapshotResult> {
  const apiKey = getApiKey();
  const { underlying } = options;

  const assetClass = detectAssetClass(underlying);
  const apiTicker = toMassiveTicker(underlying, assetClass);
  const headers = { Authorization: `Bearer ${apiKey}` };

  // Build initial URL
  const params = new URLSearchParams({ limit: "250" });
  if (options.strike_price_gte != null) {
    params.set("strike_price.gte", String(options.strike_price_gte));
  }
  if (options.strike_price_lte != null) {
    params.set("strike_price.lte", String(options.strike_price_lte));
  }
  if (options.expiration_date_gte != null) {
    params.set("expiration_date.gte", options.expiration_date_gte);
  }
  if (options.expiration_date_lte != null) {
    params.set("expiration_date.lte", options.expiration_date_lte);
  }
  if (options.contract_type != null) {
    params.set("contract_type", options.contract_type);
  }

  let url: string | null =
    `${MASSIVE_BASE_URL}/v3/snapshot/options/${encodeURIComponent(apiTicker)}?${params.toString()}`;

  const allContracts: OptionContract[] = [];
  const seenCursors = new Set<string>();
  let pageCount = 0;
  let underlyingPrice = 0;
  let underlyingTicker = underlying;

  while (url) {
    // Safety net: max pages
    pageCount++;
    if (pageCount > MASSIVE_MAX_PAGES) {
      throw new Error(
        `Pagination safety limit reached (${MASSIVE_MAX_PAGES} pages) — possible API issue`,
      );
    }

    const response = await fetchWithRetry(url, headers);

    // Handle auth errors
    if (response.status === 401) {
      throw new Error(
        "MASSIVE_API_KEY rejected by Massive.com — check your key",
      );
    }

    if (!response.ok) {
      throw new Error(
        `Massive.com API error: HTTP ${response.status} ${response.statusText}`,
      );
    }

    const json = await response.json();

    // Zod validation
    const parsed = MassiveSnapshotResponseSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${String(i.path.join("."))}: ${i.message}`)
        .join("; ");
      throw new Error(`Massive API response validation failed: ${issues}`);
    }

    const data = parsed.data;

    // Extract underlying info from first result (same across all contracts)
    if (data.results.length > 0 && underlyingPrice === 0) {
      underlyingPrice = data.results[0].underlying_asset.price;
      underlyingTicker = fromMassiveTicker(
        data.results[0].underlying_asset.ticker,
      );
    }

    // Map contracts
    for (const contract of data.results) {
      allContracts.push(mapContract(contract));
    }

    // Pagination with seen-cursor guard
    if (data.next_url) {
      const nextUrlObj = new URL(data.next_url);
      const cursor = nextUrlObj.searchParams.get("cursor") ?? data.next_url;
      if (seenCursors.has(cursor)) {
        throw new Error(
          `Pagination loop detected — cursor repeated: ${cursor.slice(0, 50)}...`,
        );
      }
      seenCursors.add(cursor);
      url = data.next_url;
    } else {
      url = null;
    }
  }

  return {
    contracts: allContracts,
    underlying_price: underlyingPrice,
    underlying_ticker: underlyingTicker,
  };
}
