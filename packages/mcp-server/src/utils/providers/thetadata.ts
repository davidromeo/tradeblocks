import { buildOccTicker } from "./thetadata.ext.js";
import type {
  MarketDataProvider,
  ProviderCapabilities,
  BarRow,
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

      if (Array.isArray(parsed)) return parsed as ThetaJsonArray;
      if (parsed && typeof parsed === "object") {
        const object = parsed as {
          data?: unknown[];
          response?: unknown[];
        };
        if (Array.isArray(object.data)) return object.data as ThetaJsonArray;
        if (Array.isArray(object.response)) return object.response as ThetaJsonArray;
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
      ...(chunk.from === chunk.to
        ? { date: compactDate(chunk.from) }
        : { start_date: compactDate(chunk.from), end_date: compactDate(chunk.to) }),
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
      ...(chunk.from === chunk.to
        ? { date: compactDate(chunk.from) }
        : { start_date: compactDate(chunk.from), end_date: compactDate(chunk.to) }),
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

    const rows = await requestThetaArray("/v3/option/list/contracts/quote", {
      symbol: underlying,
      date: compactDate(as_of),
      format: "json",
      ...(maxDte != null ? { max_dte: maxDte } : {}),
    });

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
