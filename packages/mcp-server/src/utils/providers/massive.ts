/**
 * Massive.com (Polygon.io) Market Data Provider
 *
 * Implements MarketDataProvider for the Massive.com REST API.
 * Combines the former massive-client.ts (OHLCV bars) and massive-snapshot.ts
 * (option chain snapshots) into a single provider adapter.
 *
 * Key design decisions:
 * - D-01/D-02/D-03: API key read at call site via process.env.MASSIVE_API_KEY
 * - D-05: Pagination loop guard with seen-cursor Set + MAX_PAGES=500 safety net
 * - D-06: adjusted=false and limit=50000 in all aggregate API calls
 * - D-07: 429 retry with Retry-After header or exponential backoff
 * - D-09/D-10/D-11: Ticker prefixes (I: for indices, O: for options)
 * - Timestamps are Unix milliseconds from the Massive aggregates API
 */

import { z } from "zod";
import type {
  MarketDataProvider,
  BarRow,
  FetchBarsOptions,
  FetchSnapshotOptions,
  FetchSnapshotResult,
  OptionContract,
  AssetClass,
} from "../market-provider.js";
import { computeLegGreeks } from "../black-scholes.js";

// ===========================================================================
// Zod Schemas — Aggregates (OHLCV Bars)
// ===========================================================================

export const MassiveBarSchema = z.object({
  v: z.number().optional(),
  vw: z.number().optional(),
  o: z.number(),
  c: z.number(),
  h: z.number(),
  l: z.number(),
  t: z.number(),
  n: z.number().optional(),
});

export type MassiveBar = z.infer<typeof MassiveBarSchema>;

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

// ===========================================================================
// Zod Schemas — Quotes (Historical Bid/Ask)
// ===========================================================================

export const MassiveQuoteSchema = z.object({
  bid_price: z.number(),
  ask_price: z.number(),
  sip_timestamp: z.number(), // nanoseconds
  bid_size: z.number(),
  ask_size: z.number(),
  sequence_number: z.number(),
});

export type MassiveQuote = z.infer<typeof MassiveQuoteSchema>;

export const MassiveQuotesResponseSchema = z.object({
  status: z.string(),
  request_id: z.string(),
  results: z.array(MassiveQuoteSchema).default([]),
  next_url: z.string().optional(),
});

export type MassiveQuotesResponse = z.infer<typeof MassiveQuotesResponseSchema>;

// ===========================================================================
// Zod Schemas — Snapshot (Option Chain)
// ===========================================================================

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

// ===========================================================================
// Constants
// ===========================================================================

export const MASSIVE_BASE_URL = "https://api.massive.com";
export const MASSIVE_MAX_LIMIT = 50000;
export const MASSIVE_MAX_PAGES = 500;

// ===========================================================================
// Ticker Normalization
// ===========================================================================

export function toMassiveTicker(ticker: string, assetClass: AssetClass): string {
  if (assetClass === "index") return ticker.startsWith("I:") ? ticker : `I:${ticker}`;
  if (assetClass === "option") return ticker.startsWith("O:") ? ticker : `O:${ticker}`;
  return ticker;
}

export function fromMassiveTicker(apiTicker: string): string {
  return apiTicker.replace(/^[IO]:/, "");
}

// ===========================================================================
// Timestamp Conversion
// ===========================================================================

export function massiveTimestampToETDate(unixMs: number): string {
  return new Date(unixMs).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

export function massiveTimestampToETTime(unixMs: number): string {
  return new Date(unixMs).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Converts a nanosecond sip_timestamp to "YYYY-MM-DD HH:MM" ET minute key.
 * Used for matching quotes to intraday bars by minute bucket.
 */
export function nanosToETMinuteKey(nanosTimestamp: number): string {
  const ms = Math.floor(nanosTimestamp / 1_000_000);
  const date = massiveTimestampToETDate(ms);
  const time = massiveTimestampToETTime(ms);
  return `${date} ${time}`;
}

// ===========================================================================
// Internal Helpers
// ===========================================================================

function getApiKey(): string {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) {
    throw new Error(
      "Set MASSIVE_API_KEY environment variable to use Massive.com data import"
    );
  }
  return key;
}

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
  throw new Error("Massive.com rate limit exceeded after retries");
}

// ===========================================================================
// Snapshot Helpers
// ===========================================================================

const INDEX_TICKERS = new Set([
  "SPX", "NDX", "RUT", "DJX", "VIX", "VIX9D", "VIX3M", "OEX", "XSP",
]);

function detectSnapshotAssetClass(ticker: string): AssetClass {
  return INDEX_TICKERS.has(ticker.toUpperCase()) ? "index" : "stock";
}

function computeDTE(expirationDate: string): number {
  const expMatch = expirationDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!expMatch) return 0;
  const [, expYearS, expMonthS, expDayS] = expMatch;
  const expYear = parseInt(expYearS, 10);
  const expMonth = parseInt(expMonthS, 10);
  const expDay = parseInt(expDayS, 10);

  const todayET = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const todayMatch = todayET.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!todayMatch) return 0;
  const [, todayYearS, todayMonthS, todayDayS] = todayMatch;
  const todayYear = parseInt(todayYearS, 10);
  const todayMonth = parseInt(todayMonthS, 10);
  const todayDay = parseInt(todayDayS, 10);

  const dte =
    (Date.UTC(expYear, expMonth - 1, expDay) -
      Date.UTC(todayYear, todayMonth - 1, todayDay)) /
    86_400_000;

  return dte <= 0 ? 0.001 : dte;
}

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
    delta = contract.greeks!.delta;
    gamma = contract.greeks!.gamma;
    theta = contract.greeks!.theta;
    vega = contract.greeks!.vega;
    iv = contract.implied_volatility;
    greeksSource = "massive";
  } else {
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

// ===========================================================================
// MassiveProvider
// ===========================================================================

export class MassiveProvider implements MarketDataProvider {
  readonly name = "massive";

  async fetchBars(options: FetchBarsOptions): Promise<BarRow[]> {
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

    let url: string | null =
      `${MASSIVE_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(apiTicker)}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=false&limit=${MASSIVE_MAX_LIMIT}`;

    const allRows: BarRow[] = [];
    const seenCursors = new Set<string>();
    let pageCount = 0;

    while (url) {
      pageCount++;
      if (pageCount > MASSIVE_MAX_PAGES) {
        throw new Error(
          `Pagination safety limit reached (${MASSIVE_MAX_PAGES} pages) — possible API issue`
        );
      }

      const response = await fetchWithRetry(url, headers);

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

      const parsed = MassiveAggregateResponseSchema.safeParse(json);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        throw new Error(`Massive API response validation failed: ${issues}`);
      }

      const data = parsed.data;

      for (const bar of data.results) {
        const row: BarRow = {
          date: massiveTimestampToETDate(bar.t),
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v ?? 0,
          ticker: storageTicker,
        };
        if (timespan !== "day") {
          row.time = massiveTimestampToETTime(bar.t);
        }
        allRows.push(row);
      }

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

    // Enrich option intraday bars with bid/ask from quotes endpoint (best-effort)
    if (assetClass === "option" && timespan !== "day" && allRows.length > 0) {
      const quotesMap = await this.fetchQuotesForBars(apiTicker, headers, from, to);
      if (quotesMap.size > 0) {
        for (const row of allRows) {
          if (row.time != null) {
            const key = `${row.date} ${row.time}`;
            const quote = quotesMap.get(key);
            if (quote != null) {
              row.bid = quote.bid;
              row.ask = quote.ask;
            }
          }
        }
      }
    }

    return allRows;
  }

  /**
   * Fetches historical quotes (bid/ask) for an option ticker over a date range.
   * Returns a Map keyed by "YYYY-MM-DD HH:MM" ET minute key.
   * Any error (network, HTTP error, parse failure) silently returns an empty Map.
   */
  private async fetchQuotesForBars(
    apiTicker: string,
    headers: Record<string, string>,
    from: string,
    to: string,
  ): Promise<Map<string, { bid: number; ask: number }>> {
    const result = new Map<string, { bid: number; ask: number }>();
    try {
      let url: string | null =
        `${MASSIVE_BASE_URL}/v3/quotes/${encodeURIComponent(apiTicker)}?timestamp.gte=${from}&timestamp.lte=${to}&order=asc&limit=${MASSIVE_MAX_LIMIT}`;

      const seenCursors = new Set<string>();
      const QUOTES_MAX_PAGES = 100;
      let pageCount = 0;

      while (url) {
        pageCount++;
        if (pageCount > QUOTES_MAX_PAGES) {
          break;
        }

        let response: Response;
        try {
          response = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(30_000),
          });
        } catch {
          // Network error — return what we have so far (best-effort)
          return result;
        }

        if (!response.ok) {
          // 403 (tier restriction), 429 (rate limit), or any other HTTP error — swallow
          return result;
        }

        const json = await response.json();
        const parsed = MassiveQuotesResponseSchema.safeParse(json);
        if (!parsed.success) {
          // Schema mismatch — return what we have so far
          return result;
        }

        const data = parsed.data;
        // Since order=asc, later quotes for the same minute overwrite earlier (last quote wins)
        for (const quote of data.results) {
          const key = nanosToETMinuteKey(quote.sip_timestamp);
          result.set(key, { bid: quote.bid_price, ask: quote.ask_price });
        }

        if (data.next_url) {
          const nextUrlObj = new URL(data.next_url);
          const cursor = nextUrlObj.searchParams.get("cursor") ?? data.next_url;
          if (seenCursors.has(cursor)) {
            break; // Pagination loop — stop gracefully
          }
          seenCursors.add(cursor);
          url = data.next_url;
        } else {
          url = null;
        }
      }
    } catch {
      // Any unexpected error — return empty map (best-effort)
      return new Map();
    }

    return result;
  }

  async fetchOptionSnapshot(options: FetchSnapshotOptions): Promise<FetchSnapshotResult> {
    const apiKey = getApiKey();
    const { underlying } = options;

    const assetClass = detectSnapshotAssetClass(underlying);
    const apiTicker = toMassiveTicker(underlying, assetClass);
    const headers = { Authorization: `Bearer ${apiKey}` };

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
      pageCount++;
      if (pageCount > MASSIVE_MAX_PAGES) {
        throw new Error(
          `Pagination safety limit reached (${MASSIVE_MAX_PAGES} pages) — possible API issue`,
        );
      }

      const response = await fetchWithRetry(url, headers);

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

      const parsed = MassiveSnapshotResponseSchema.safeParse(json);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${String(i.path.join("."))}: ${i.message}`)
          .join("; ");
        throw new Error(`Massive API response validation failed: ${issues}`);
      }

      const data = parsed.data;

      if (data.results.length > 0 && underlyingPrice === 0) {
        underlyingPrice = data.results[0].underlying_asset.price;
        underlyingTicker = fromMassiveTicker(
          data.results[0].underlying_asset.ticker,
        );
      }

      for (const contract of data.results) {
        allContracts.push(mapContract(contract));
      }

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
}
