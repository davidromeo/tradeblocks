import { buildOccTicker } from "./thetadata.ext.js";
import type {
  MarketDataProvider,
  ProviderCapabilities,
  BarRow,
  BulkQuotesOptions,
  BulkQuoteRow,
  FetchBarsOptions,
  FetchSnapshotOptions,
  FetchSnapshotResult,
  FetchContractListOptions,
  FetchContractListResult,
  ContractReference,
  OptionContract,
  AssetClass,
} from "../market-provider.js";
import { ensureThetaTerminalRunning } from "./thetadata-terminal.js";

const THETADATA_BASE_URL = "http://127.0.0.1:25503";
const THETADATA_TIMEOUT_MS = 30_000;
/**
 * NDJSON wildcard streams (`/v3/option/history/quote` with strike=*, expiration=*)
 * for a full SPXW day can run 30–60 min end-to-end. The single-request 30s timeout
 * kills them. Use a long default here, overridable via `THETADATA_STREAM_TIMEOUT_MS`
 * env for pathological cases.
 */
const THETADATA_STREAM_TIMEOUT_MS = 3_600_000; // 60 min
const THETADATA_RETRY_BASE_MS = 250;
const THETADATA_MAX_ATTEMPTS = 4;
const RETRYABLE_THETA_STATUS_CODES = new Set([429, 474, 571]);

const THETA_ERROR_NAMES: Record<number, string> = {
  404: "NO_IMPL",
  429: "OS_LIMIT",
  470: "GENERAL",
  471: "PERMISSION",
  472: "NO_DATA",
  473: "INVALID_PARAMS",
  474: "DISCONNECTED",
  475: "TERMINAL_PARSE",
  476: "WRONG_IP",
  477: "NO_PAGE_FOUND",
  478: "INVALID_SESSION_ID",
  571: "SERVER_STARTING",
  572: "UNCAUGHT_ERROR",
};

type ThetaJsonObject = Record<string, unknown>;
type ThetaJsonArray = ThetaJsonObject[];

export interface ThetaHistoryQuoteGroup {
  symbol: string;
  expiration: string;
  strike: number;
  right: "call" | "put";
  data: Array<{
    timestamp: string;
    bid: number | null;
    ask: number | null;
  }>;
}

export interface ThetaBulkQuoteRequest {
  symbol: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  expiration?: string;
  strike?: string;
  right?: "call" | "put" | "both";
  interval?: string;
  maxDte?: number;
  strikeRange?: number;
}

interface ParsedOccTicker {
  root: string;
  expiration: string;
  right: "call" | "put";
  strike: number;
}

interface ThetaContractKeyParts {
  symbol: string;
  expiration: string;
  strike: number;
  right: "call" | "put";
}

function getBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.THETADATA_BASE_URL || THETADATA_BASE_URL;
}

function getTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  return Number.parseInt(
    env.THETADATA_REQUEST_TIMEOUT_MS || String(THETADATA_TIMEOUT_MS),
    10,
  ) || THETADATA_TIMEOUT_MS;
}

function getStreamTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  return Number.parseInt(
    env.THETADATA_STREAM_TIMEOUT_MS || String(THETADATA_STREAM_TIMEOUT_MS),
    10,
  ) || THETADATA_STREAM_TIMEOUT_MS;
}

function getRetryBaseMs(env: NodeJS.ProcessEnv = process.env): number {
  return Number.parseInt(
    env.THETADATA_RETRY_BASE_MS || String(THETADATA_RETRY_BASE_MS),
    10,
  ) || THETADATA_RETRY_BASE_MS;
}

function getMaxAttempts(env: NodeJS.ProcessEnv = process.env): number {
  return Number.parseInt(
    env.THETADATA_MAX_ATTEMPTS || String(THETADATA_MAX_ATTEMPTS),
    10,
  ) || THETADATA_MAX_ATTEMPTS;
}

async function maybeEnsureThetaRunning(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (env.THETADATA_SKIP_AUTO_START === "1") return;
  await ensureThetaTerminalRunning(env);
}

function compactDate(date: string): string {
  return date.replaceAll("-", "");
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

function splitDateRangeByMonth(from: string, to: string): Array<{ from: string; to: string }> {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  const chunks: Array<{ from: string; to: string }> = [];

  let cursor = new Date(start);
  while (cursor <= end) {
    const chunkStart = new Date(cursor);
    const chunkEnd = new Date(Date.UTC(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + 1,
      0,
      12,
      0,
      0,
    ));
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({ from: formatDate(chunkStart), to: formatDate(chunkEnd) });
    cursor = new Date(Date.UTC(
      chunkEnd.getUTCFullYear(),
      chunkEnd.getUTCMonth(),
      chunkEnd.getUTCDate() + 1,
      12,
      0,
      0,
    ));
  }

  return chunks;
}

function toThetaInterval(timespan: "day" | "minute" | "hour", multiplier = 1): string | null {
  if (timespan === "day") return null;
  if (timespan === "hour") {
    if (multiplier !== 1) {
      throw new Error(`ThetaData does not support ${multiplier}h bars`);
    }
    return "1h";
  }

  const minuteIntervals = new Set([1, 5, 10, 15, 30]);
  if (!minuteIntervals.has(multiplier)) {
    throw new Error(`ThetaData does not support ${multiplier}m bars`);
  }
  return `${multiplier}m`;
}

function formatStrike(strike: number): string {
  return strike.toFixed(3);
}

function toThetaRight(right: "call" | "put"): string {
  return right;
}

function normalizeThetaRight(value: unknown): "call" | "put" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "c" || raw === "call") return "call";
  if (raw === "p" || raw === "put") return "put";
  throw new Error(`Unsupported ThetaData option right: ${String(value)}`);
}

function parseOccTicker(ticker: string): ParsedOccTicker {
  const match = ticker.match(/^([A-Z]+)(\d{2})(\d{2})(\d{2})(C|P)(\d{8})$/);
  if (!match) {
    throw new Error(`Invalid OCC option ticker: ${ticker}`);
  }

  const root = match[1];
  const expiration = `20${match[2]}-${match[3]}-${match[4]}`;
  const right = match[5] === "C" ? "call" : "put";
  const strike = Number.parseInt(match[6], 10) / 1000;
  return { root, expiration, right, strike };
}

function thetaTimestampToEtDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function thetaTimestampToEtTime(timestamp: string): string {
  return timestamp.slice(11, 16);
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toInteger(value: unknown): number | null {
  const num = toNumber(value);
  return num == null ? null : Math.trunc(num);
}

function thetaKey(parts: ThetaContractKeyParts): string {
  return [
    parts.symbol,
    parts.expiration,
    parts.strike.toFixed(3),
    parts.right,
  ].join("|");
}

function inferExerciseStyle(symbol: string): string {
  const europeanRoots = new Set([
    "SPX",
    "SPXW",
    "XSP",
    "NDX",
    "NDXP",
    "RUT",
    "RUTW",
    "VIX",
    "VIX9D",
    "DJX",
  ]);
  return europeanRoots.has(symbol.toUpperCase()) ? "european" : "american";
}

function breakEvenFor(contractType: "call" | "put", strike: number, midpoint: number): number {
  const value = contractType === "call" ? strike + midpoint : strike - midpoint;
  return Number(value.toFixed(6));
}

function filterSnapshotContract(
  contract: ThetaContractKeyParts,
  options: FetchSnapshotOptions,
): boolean {
  if (options.contract_type && contract.right !== options.contract_type) return false;
  if (options.expiration_date_gte && contract.expiration < options.expiration_date_gte) return false;
  if (options.expiration_date_lte && contract.expiration > options.expiration_date_lte) return false;
  if (options.strike_price_gte != null && contract.strike < options.strike_price_gte) return false;
  if (options.strike_price_lte != null && contract.strike > options.strike_price_lte) return false;
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function thetaErrorLabel(status: number): string {
  return THETA_ERROR_NAMES[status] ?? `HTTP_${status}`;
}

function thetaErrorMessage(status: number, body: string): string {
  const prefix = `ThetaData ${status} ${thetaErrorLabel(status)}`;
  const trimmed = body.trim();
  if (!trimmed) return prefix;
  return `${prefix}: ${trimmed}`;
}

async function requestThetaArray(
  endpointPath: string,
  params: Record<string, string | number | boolean | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ThetaJsonArray> {
  return await requestThetaJson(endpointPath, params, env) as ThetaJsonArray;
}

/**
 * Streams an NDJSON response from ThetaData, yielding one parsed object per line.
 * Unlike requestThetaJson, this never materializes the full response body as a
 * single string — so wildcard queries that exceed V8's ~512MB string-length cap
 * (SPXW full chains on large expiration days) don't crash. Retries on transport
 * or 429/571/474 errors; "no data" (472) is treated as an empty stream.
 */
async function* streamThetaNdjson(
  endpointPath: string,
  params: Record<string, string | number | boolean | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): AsyncGenerator<ThetaJsonObject, void, void> {
  await maybeEnsureThetaRunning(env);

  const url = new URL(endpointPath, getBaseUrl(env));
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set("format", "ndjson");

  const maxAttempts = getMaxAttempts(env);
  const retryBaseMs = getRetryBaseMs(env);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(getStreamTimeoutMs(env)),
      });

      if (response.status === 472) {
        const text = await response.text();
        if (text.trim().startsWith("No data found for your request")) return;
        throw new Error(thetaErrorMessage(response.status, text));
      }

      if (!response.ok) {
        const text = await response.text();
        if (RETRYABLE_THETA_STATUS_CODES.has(response.status) && attempt < maxAttempts) {
          await sleep(retryBaseMs * attempt);
          continue;
        }
        throw new Error(thetaErrorMessage(response.status, text));
      }

      if (!response.body) return;

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newlineIdx = buffer.indexOf("\n");
          while (newlineIdx >= 0) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (line) {
              let parsed: unknown;
              try {
                parsed = JSON.parse(line);
              } catch (error) {
                throw new Error(
                  `ThetaData returned invalid NDJSON line from ${endpointPath}: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
              }
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                yield parsed as ThetaJsonObject;
              }
            }
            newlineIdx = buffer.indexOf("\n");
          }
        }
        const tail = buffer.trim();
        if (tail) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(tail);
          } catch (error) {
            throw new Error(
              `ThetaData returned invalid NDJSON tail from ${endpointPath}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            yield parsed as ThetaJsonObject;
          }
        }
      } finally {
        reader.releaseLock();
      }
      return;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      const isTransportError = err.message === "fetch failed";
      if ((isTransportError || err.name === "AbortError") && attempt < maxAttempts) {
        await sleep(retryBaseMs * attempt);
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error(`ThetaData stream failed for ${endpointPath}`);
}

async function requestThetaJson(
  endpointPath: string,
  params: Record<string, string | number | boolean | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown[]> {
  await maybeEnsureThetaRunning(env);

  const url = new URL(endpointPath, getBaseUrl(env));
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    url.searchParams.set(key, String(value));
  }
  if (!url.searchParams.has("format")) {
    url.searchParams.set("format", "json");
  }

  const maxAttempts = getMaxAttempts(env);
  const retryBaseMs = getRetryBaseMs(env);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(getTimeoutMs(env)),
      });
      const text = await response.text();

      if (response.status === 472 && text.trim().startsWith("No data found for your request")) {
        return [];
      }

      if (!response.ok) {
        if (RETRYABLE_THETA_STATUS_CODES.has(response.status) && attempt < maxAttempts) {
          await sleep(retryBaseMs * attempt);
          continue;
        }
        throw new Error(thetaErrorMessage(response.status, text));
      }

      const trimmed = text.trim();
      if (!trimmed) return [];
      if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
        throw new Error(trimmed);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (error) {
        throw new Error(
          `ThetaData returned invalid JSON from ${endpointPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") {
        const object = parsed as {
          data?: unknown[];
          response?: unknown[];
        };
        if (Array.isArray(object.data)) return object.data;
        if (Array.isArray(object.response)) return object.response;
      }

      throw new Error(`ThetaData ${endpointPath} returned unexpected JSON shape`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      const isTransportError = err.message === "fetch failed";
      if ((isTransportError || err.name === "AbortError") && attempt < maxAttempts) {
        await sleep(retryBaseMs * attempt);
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error(`ThetaData request failed for ${endpointPath}`);
}

function flattenThetaRows(rows: ThetaJsonArray): ThetaJsonArray {
  const flat: ThetaJsonArray = [];
  for (const row of rows) {
    if (Array.isArray(row.data) && row.contract && typeof row.contract === "object") {
      for (const datum of row.data as unknown[]) {
        if (!datum || typeof datum !== "object") continue;
        flat.push({
          ...(row.contract as ThetaJsonObject),
          ...(datum as ThetaJsonObject),
        });
      }
      continue;
    }
    flat.push(row);
  }
  return flat;
}

function normalizeThetaExpiration(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new Error("ThetaData row missing expiration");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  throw new Error(`Unsupported ThetaData expiration: ${raw}`);
}

function normalizeThetaBulkRight(value: ThetaBulkQuoteRequest["right"]): string {
  if (!value || value === "both") return "both";
  return value;
}

export async function fetchOptionHistoryQuoteGroups(
  request: ThetaBulkQuoteRequest,
): Promise<ThetaHistoryQuoteGroup[]> {
  const {
    symbol,
    date,
    startDate,
    endDate,
    expiration = "*",
    strike = "*",
    right = "both",
    interval = "1m",
    maxDte,
    strikeRange,
  } = request;

  if (!date && (!startDate || !endDate)) {
    throw new Error("fetchOptionHistoryQuoteGroups requires date or startDate/endDate");
  }

  const params: Record<string, string | number | boolean | undefined> = {
    symbol,
    expiration,
    strike,
    right: normalizeThetaBulkRight(right),
    interval,
    ...(date ? { date: compactDate(date) } : {
      start_date: compactDate(startDate!),
      end_date: compactDate(endDate!),
    }),
    ...(maxDte != null ? { max_dte: maxDte } : {}),
    ...(strikeRange != null ? { strike_range: strikeRange } : {}),
  };

  const grouped = new Map<string, ThetaHistoryQuoteGroup>();

  for await (const row of streamThetaNdjson("/v3/option/history/quote", params)) {
    // NDJSON emits one flat quote per line with contract fields alongside the
    // quote fields. No grouped {contract, data[]} shape to handle here.
    const rowSymbol = String(row.symbol ?? symbol).toUpperCase();
    const rowStrike = toNumber(row.strike);
    if (rowStrike == null) continue;
    const rowExpiration = normalizeThetaExpiration(row.expiration);
    const rowRight = normalizeThetaRight(row.right);
    const timestamp = String(row.timestamp ?? "");
    if (!timestamp) continue;

    const key = thetaKey({
      symbol: rowSymbol,
      expiration: rowExpiration,
      strike: rowStrike,
      right: rowRight,
    });
    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = {
        symbol: rowSymbol,
        expiration: rowExpiration,
        strike: rowStrike,
        right: rowRight,
        data: [],
      };
      grouped.set(key, bucket);
    }
    bucket.data.push({
      timestamp,
      bid: toNumber(row.bid),
      ask: toNumber(row.ask),
    });
  }

  return [...grouped.values()];
}

function mapIntradayRow(row: ThetaJsonObject, ticker: string): BarRow {
  const timestamp = String(row.timestamp ?? "");
  return {
    date: thetaTimestampToEtDate(timestamp),
    time: thetaTimestampToEtTime(timestamp),
    open: toNumber(row.open) ?? 0,
    high: toNumber(row.high) ?? 0,
    low: toNumber(row.low) ?? 0,
    close: toNumber(row.close) ?? 0,
    volume: toInteger(row.volume) ?? 0,
    ticker,
  };
}

function mapEodRow(row: ThetaJsonObject, ticker: string): BarRow {
  const dateToken = String(row.date ?? row.timestamp ?? row.created ?? row.last_trade ?? "");
  return {
    date: dateToken.slice(0, 10),
    open: toNumber(row.open) ?? 0,
    high: toNumber(row.high) ?? 0,
    low: toNumber(row.low) ?? 0,
    close: toNumber(row.close) ?? 0,
    volume: toInteger(row.volume) ?? 0,
    ticker,
    bid: toNumber(row.bid) ?? undefined,
    ask: toNumber(row.ask) ?? undefined,
  };
}

function normalizedMidpoint(bid: number, ask: number): number {
  if (bid > 0 && ask > 0) return Number(((bid + ask) / 2).toFixed(6));
  return Math.max(bid, ask, 0);
}

async function fetchOptionHistoryRows(
  ticker: string,
  from: string,
  to: string,
  endpoint: "ohlc" | "quote" | "eod",
  interval: string | null,
): Promise<ThetaJsonArray> {
  const occ = parseOccTicker(ticker);
  const chunks = splitDateRangeByMonth(from, to);
  const rows: ThetaJsonArray = [];

  for (const chunk of chunks) {
    const params: Record<string, string | number | boolean | undefined> = {
      symbol: occ.root,
      expiration: compactDate(occ.expiration),
      strike: formatStrike(occ.strike),
      right: toThetaRight(occ.right),
      format: "json",
      ...(interval ? { interval } : {}),
      start_date: compactDate(chunk.from),
      end_date: compactDate(chunk.to),
    };
    rows.push(...flattenThetaRows(
      await requestThetaArray(`/v3/option/history/${endpoint}`, params),
    ));
  }

  return rows;
}

async function fetchSymbolHistoryRows(
  ticker: string,
  from: string,
  to: string,
  assetClass: Exclude<AssetClass, "option">,
  endpoint: "ohlc" | "eod",
  interval: string | null,
): Promise<ThetaJsonArray> {
  const chunks = splitDateRangeByMonth(from, to);
  const rows: ThetaJsonArray = [];

  for (const chunk of chunks) {
    const params: Record<string, string | number | boolean | undefined> = {
      symbol: ticker,
      format: "json",
      ...(interval ? { interval } : {}),
      start_date: compactDate(chunk.from),
      end_date: compactDate(chunk.to),
    };
    rows.push(...flattenThetaRows(
      await requestThetaArray(`/v3/${assetClass}/history/${endpoint}`, params),
    ));
  }

  return rows;
}

export class ThetaDataProvider implements MarketDataProvider {
  readonly name = "thetadata";

  capabilities(): ProviderCapabilities {
    return {
      tradeBars: true,
      quotes: true,
      greeks: true,
      flatFiles: false,
      bulkByRoot: true,
      perTicker: false,
      minuteBars: true,
      dailyBars: true,
    };
  }

  async fetchBars(options: FetchBarsOptions): Promise<BarRow[]> {
    const {
      ticker,
      from,
      to,
      timespan = "day",
      multiplier = 1,
      assetClass = "stock",
    } = options;

    if (timespan === "day") {
      const rows = assetClass === "option"
        ? await fetchOptionHistoryRows(ticker, from, to, "eod", null)
        : await fetchSymbolHistoryRows(ticker, from, to, assetClass, "eod", null);

      return rows
        .map((row) => mapEodRow(row, ticker))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    const interval = toThetaInterval(timespan, multiplier);
    const rows = assetClass === "option"
      ? await fetchOptionHistoryRows(ticker, from, to, "ohlc", interval)
      : await fetchSymbolHistoryRows(ticker, from, to, assetClass, "ohlc", interval);

    return rows
      .map((row) => mapIntradayRow(row, ticker))
      .sort((a, b) => {
        const left = `${a.date} ${a.time ?? ""}`;
        const right = `${b.date} ${b.time ?? ""}`;
        return left.localeCompare(right);
      });
  }

  async fetchQuotes(ticker: string, from: string, to: string): Promise<Map<string, { bid: number; ask: number }>> {
    const rows = await fetchOptionHistoryRows(ticker, from, to, "quote", "1m");
    const quotes = new Map<string, { bid: number; ask: number }>();

    for (const row of rows) {
      const timestamp = String(row.timestamp ?? "");
      if (!timestamp) continue;
      const bid = toNumber(row.bid);
      const ask = toNumber(row.ask);
      if (bid == null || ask == null) continue;
      quotes.set(`${thetaTimestampToEtDate(timestamp)} ${thetaTimestampToEtTime(timestamp)}`, {
        bid,
        ask,
      });
    }

    return quotes;
  }

  /**
   * Stream every contract's minute quotes for one underlying on one date via
   * ThetaData's wildcard `/v3/option/history/quote` endpoint. Replaces
   * thousands of per-ticker calls with up to 4 wire requests (SPX monthlies +
   * SPXW dailies, each split into calls and puts because wildcards don't work
   * on `right`).
   *
   * The 4 (root, right) streams run **in parallel** — ThetaTerminal advertises
   * 4 concurrent slots, so this saturates the budget and wall-clock drops to
   * the longest single stream instead of the sum. Rows are multiplexed through
   * a bounded queue that applies backpressure to producers faster than the
   * consumer.
   *
   * Yields rows in **chunks** (`BULK_YIELD_CHUNK`) rather than one-by-one —
   * per-row yield/await overhead dominated the runtime at 5M+ rows when tested.
   *
   * Wildcard failures (500/471/571 mid-stream) surface as thrown errors — the
   * ingestor decides whether to fall back to per-ticker or abort.
   */
  async *fetchBulkQuotes(options: BulkQuotesOptions): AsyncGenerator<BulkQuoteRow[], void, void> {
    const { underlying, date } = options;
    const upperUnderlying = underlying.toUpperCase();
    const roots = upperUnderlying === "SPX" ? ["SPX", "SPXW"] : [upperUnderlying];
    const rights: Array<"call" | "put"> = ["call", "put"];
    const groups = roots.flatMap((root) => rights.map((right) => ({ root, right })));

    const BULK_YIELD_CHUNK = 50_000;
    const QUEUE_CAP = 8; // ×50k = 400k rows ≈ 50 MB steady state

    const queue: BulkQuoteRow[][] = [];
    let producersLeft = groups.length;
    let producerError: Error | null = null;
    let notifyConsumer: (() => void) | null = null;
    let notifyProducer: (() => void) | null = null;

    const wakeConsumer = () => {
      if (notifyConsumer) { const r = notifyConsumer; notifyConsumer = null; r(); }
    };
    const wakeProducer = () => {
      if (notifyProducer) { const r = notifyProducer; notifyProducer = null; r(); }
    };

    const producers = groups.map(async ({ root, right }) => {
      const params: Record<string, string | number | boolean | undefined> = {
        symbol: root,
        expiration: "*",
        strike: "*",
        right: normalizeThetaBulkRight(right),
        interval: "1m",
        date: compactDate(date),
      };
      let buf: BulkQuoteRow[] = [];
      const flushLocal = async () => {
        while (queue.length >= QUEUE_CAP) {
          await new Promise<void>((r) => { notifyProducer = r; });
        }
        queue.push(buf);
        buf = [];
        wakeConsumer();
      };
      try {
        for await (const row of streamThetaNdjson("/v3/option/history/quote", params)) {
          const symbol = String(row.symbol ?? root).toUpperCase();
          const strike = toNumber(row.strike);
          if (strike == null) continue;
          const expiration = normalizeThetaExpiration(row.expiration);
          const rowRight = normalizeThetaRight(row.right);
          const timestamp = String(row.timestamp ?? "");
          if (!timestamp) continue;
          const bid = toNumber(row.bid);
          const ask = toNumber(row.ask);
          if (bid == null || ask == null) continue;
          const rightChar: "C" | "P" = rowRight === "call" ? "C" : "P";
          const ticker = buildOccTicker(symbol, expiration, rightChar, strike);
          const etTimestamp = `${thetaTimestampToEtDate(timestamp)} ${thetaTimestampToEtTime(timestamp)}`;
          buf.push({ ticker, timestamp: etTimestamp, bid, ask });
          if (buf.length >= BULK_YIELD_CHUNK) await flushLocal();
        }
        if (buf.length > 0) await flushLocal();
      } catch (e) {
        if (!producerError) producerError = e instanceof Error ? e : new Error(String(e));
      } finally {
        producersLeft--;
        wakeConsumer();
      }
    });

    try {
      while (queue.length > 0 || producersLeft > 0) {
        if (producerError) throw producerError;
        if (queue.length === 0) {
          await new Promise<void>((r) => { notifyConsumer = r; });
          continue;
        }
        const chunk = queue.shift()!;
        wakeProducer();
        yield chunk;
      }
      if (producerError) throw producerError;
    } finally {
      await Promise.allSettled(producers);
    }
  }

  async fetchContractList(options: FetchContractListOptions): Promise<FetchContractListResult> {
    const { underlying, as_of, expiration_date_gte, expiration_date_lte } = options;
    const maxDte = expiration_date_lte
      ? Math.max(
          0,
          Math.round(
            (parseIsoDate(expiration_date_lte).getTime() - parseIsoDate(as_of).getTime()) /
            86_400_000,
          ),
        )
      : undefined;

    // SPX monthlies and SPXW dailies are separate roots in ThetaData.
    // Query both when underlying is SPX to get the full chain.
    const roots = underlying === "SPX" ? ["SPX", "SPXW"] : [underlying];
    const baseParams = {
      date: compactDate(as_of),
      format: "json" as const,
      ...(maxDte != null ? { max_dte: maxDte } : {}),
    };
    const rowArrays = await Promise.all(
      roots.map(root => requestThetaArray("/v3/option/list/contracts/quote", { ...baseParams, symbol: root })),
    );
    const rows = rowArrays.flat();

    const contracts: ContractReference[] = [];
    for (const row of rows) {
      const symbol = String(row.symbol ?? underlying).toUpperCase();
      const expiration = String(row.expiration ?? "");
      const strike = toNumber(row.strike);
      if (!expiration || strike == null) continue;
      const contractType = normalizeThetaRight(row.right);
      if (expiration_date_gte && expiration < expiration_date_gte) continue;
      if (expiration_date_lte && expiration > expiration_date_lte) continue;

      contracts.push({
        ticker: buildOccTicker(
          symbol,
          expiration,
          contractType === "call" ? "C" : "P",
          strike,
        ),
        contract_type: contractType,
        strike,
        expiration,
        exercise_style: inferExerciseStyle(symbol),
      });
    }

    return { contracts, underlying };
  }

  async fetchOptionSnapshot(options: FetchSnapshotOptions): Promise<FetchSnapshotResult> {
    const firstOrderRows = flattenThetaRows(await requestThetaArray("/v3/option/snapshot/greeks/first_order", {
      symbol: options.underlying,
      expiration: "*",
      format: "json",
    }));

    if (firstOrderRows.length === 0) {
      return {
        contracts: [],
        underlying_price: 0,
        underlying_ticker: options.underlying,
      };
    }

    let underlyingPrice = toNumber(firstOrderRows[0].underlying_price) ?? 0;

    const filtered = firstOrderRows.filter((row) => {
      const strike = toNumber(row.strike);
      const expiration = String(row.expiration ?? "");
      if (strike == null || !expiration) return false;
      return filterSnapshotContract({
        symbol: String(row.symbol ?? options.underlying).toUpperCase(),
        expiration,
        strike,
        right: normalizeThetaRight(row.right),
      }, options);
    });

    const oiPromise = requestThetaArray("/v3/option/snapshot/open_interest", {
      symbol: options.underlying,
      expiration: "*",
      format: "json",
    }).then(flattenThetaRows).catch(() => []);

    const expirations = [...new Set(filtered.map((row) => String(row.expiration)))];
    const tradePromises = expirations.map(async (expiration) => {
      try {
        const rows = flattenThetaRows(await requestThetaArray("/v3/option/snapshot/trade", {
          symbol: options.underlying,
          expiration,
          format: "json",
        }));
        return { expiration, rows };
      } catch {
        return { expiration, rows: [] as ThetaJsonArray };
      }
    });

    const [oiRows, tradeGroups] = await Promise.all([
      oiPromise,
      Promise.all(tradePromises),
    ]);

    const openInterestByKey = new Map<string, number>();
    for (const row of oiRows) {
      const symbol = String(row.symbol ?? options.underlying).toUpperCase();
      const expiration = String(row.expiration ?? "");
      const strike = toNumber(row.strike);
      if (!expiration || strike == null) continue;
      openInterestByKey.set(thetaKey({
        symbol,
        expiration,
        strike,
        right: normalizeThetaRight(row.right),
      }), toInteger(row.open_interest) ?? 0);
    }

    const tradePriceByKey = new Map<string, number>();
    for (const group of tradeGroups) {
      for (const row of group.rows) {
        const symbol = String(row.symbol ?? options.underlying).toUpperCase();
        const expiration = String(row.expiration ?? "");
        const strike = toNumber(row.strike);
        const price = toNumber(row.price);
        if (!expiration || strike == null || price == null) continue;
        tradePriceByKey.set(thetaKey({
          symbol,
          expiration,
          strike,
          right: normalizeThetaRight(row.right),
        }), price);
      }
    }

    const contracts: OptionContract[] = filtered.map((row) => {
      const symbol = String(row.symbol ?? options.underlying).toUpperCase();
      const expiration = String(row.expiration);
      const strike = toNumber(row.strike) ?? 0;
      const contractType = normalizeThetaRight(row.right);
      const bid = toNumber(row.bid) ?? 0;
      const ask = toNumber(row.ask) ?? 0;
      const midpoint = normalizedMidpoint(bid, ask);
      const rowUnderlying = toNumber(row.underlying_price) ?? 0;
      if (underlyingPrice === 0 && rowUnderlying > 0) {
        underlyingPrice = rowUnderlying;
      }

      const key = thetaKey({ symbol, expiration, strike, right: contractType });
      return {
        ticker: buildOccTicker(
          symbol,
          expiration,
          contractType === "call" ? "C" : "P",
          strike,
        ),
        underlying_ticker: options.underlying,
        underlying_price: rowUnderlying || underlyingPrice,
        contract_type: contractType,
        strike,
        expiration,
        exercise_style: inferExerciseStyle(symbol),
        delta: toNumber(row.delta),
        gamma: null,
        theta: toNumber(row.theta),
        vega: toNumber(row.vega),
        iv: toNumber(row.implied_vol),
        greeks_source: "thetadata",
        bid,
        ask,
        midpoint,
        last_price: tradePriceByKey.get(key) ?? null,
        open_interest: openInterestByKey.get(key) ?? 0,
        volume: 0,
        break_even: breakEvenFor(contractType, strike, midpoint),
      };
    });

    contracts.sort((a, b) => {
      const left = `${a.expiration}|${a.strike.toFixed(3)}|${a.contract_type}`;
      const right = `${b.expiration}|${b.strike.toFixed(3)}|${b.contract_type}`;
      return left.localeCompare(right);
    });

    return {
      contracts,
      underlying_price: underlyingPrice,
      underlying_ticker: options.underlying,
    };
  }
}
