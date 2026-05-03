import type { ContractRow } from "./chain-loader.js";
import { computeLegGreeks } from "./black-scholes.js";
import { computeFractionalDte } from "./option-time.js";

export type QuoteGreeksSource = "massive" | "thetadata" | "computed";
export type QuoteGreeksMode = "auto" | "provider" | "compute";

export interface QuoteGreekFields {
  delta?: number | null;
  gamma?: number | null;
  theta?: number | null;
  vega?: number | null;
  iv?: number | null;
  greeks_source?: QuoteGreeksSource | null;
  greeks_revision?: number | null;
}

export interface QuoteGreeksContractMeta {
  contract_type: ContractRow["contract_type"];
  strike: number;
  expiration: string;
}

export interface QuoteGreeksStats {
  rowsVisited: number;
  existingGreeksRows: number;
  computedRows: number;
  missingContractRows: number;
  missingUnderlyingRows: number;
  unresolvedRows: number;
}

export const OPTION_QUOTE_GREEKS_REVISION = 1;
export const OPTION_QUOTE_GREEKS_RISK_FREE_RATE = 0.045;
export const OPTION_QUOTE_GREEKS_DIVIDEND_YIELD = 0.015;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function hasQuoteGreeks(row: QuoteGreekFields): boolean {
  return isFiniteNumber(row.delta ?? null)
    && isFiniteNumber(row.gamma ?? null)
    && isFiniteNumber(row.theta ?? null)
    && isFiniteNumber(row.vega ?? null)
    && isFiniteNumber(row.iv ?? null);
}

export function normalizeExistingQuoteGreeks(
  row: QuoteGreekFields,
  defaultSource?: Exclude<QuoteGreeksSource, "computed">,
): void {
  if (!hasQuoteGreeks(row)) return;
  if (row.greeks_source == null && defaultSource) {
    row.greeks_source = defaultSource;
  }
  if (row.greeks_source === "computed" && row.greeks_revision == null) {
    row.greeks_revision = OPTION_QUOTE_GREEKS_REVISION;
  }
}

export function computeQuoteGreeks(params: {
  optionPrice: number;
  underlyingPrice: number;
  strike: number;
  date: string;
  time: string;
  expiration: string;
  contractType: ContractRow["contract_type"];
}): QuoteGreekFields | null {
  const {
    optionPrice,
    underlyingPrice,
    strike,
    date,
    time,
    expiration,
    contractType,
  } = params;
  if (!(optionPrice > 0) || !(underlyingPrice > 0) || !(strike > 0)) return null;
  const dte = computeFractionalDte(date, time.slice(0, 5), expiration);
  if (!(dte >= 0)) return null;
  const result = computeLegGreeks(
    optionPrice,
    underlyingPrice,
    strike,
    dte,
    contractType === "call" ? "C" : "P",
    OPTION_QUOTE_GREEKS_RISK_FREE_RATE,
    OPTION_QUOTE_GREEKS_DIVIDEND_YIELD,
  );
  if (!hasQuoteGreeks(result)) return null;
  return {
    delta: result.delta,
    gamma: result.gamma,
    theta: result.theta,
    vega: result.vega,
    iv: result.iv,
    greeks_source: "computed",
    greeks_revision: OPTION_QUOTE_GREEKS_REVISION,
  };
}

export function buildUnderlyingPriceKey(date: string, time: string): string {
  return `${date}|${time.slice(0, 5)}`;
}

export function applyQuoteGreeks<T extends QuoteGreekFields>(params: {
  rows: T[];
  getDate: (row: T) => string;
  getTime: (row: T) => string;
  getMid: (row: T) => number;
  getContractMeta: (row: T) => QuoteGreeksContractMeta | undefined;
  getUnderlyingPrice: (date: string, time: string) => number | undefined;
  mode?: QuoteGreeksMode;
  defaultProviderSource?: Exclude<QuoteGreeksSource, "computed">;
}): QuoteGreeksStats {
  const {
    rows,
    getDate,
    getTime,
    getMid,
    getContractMeta,
    getUnderlyingPrice,
    mode = "auto",
    defaultProviderSource,
  } = params;

  const stats: QuoteGreeksStats = {
    rowsVisited: 0,
    existingGreeksRows: 0,
    computedRows: 0,
    missingContractRows: 0,
    missingUnderlyingRows: 0,
    unresolvedRows: 0,
  };

  for (const row of rows) {
    stats.rowsVisited++;
    if (mode !== "compute" && hasQuoteGreeks(row)) {
      normalizeExistingQuoteGreeks(row, defaultProviderSource);
      stats.existingGreeksRows++;
      continue;
    }

    const meta = getContractMeta(row);
    if (!meta) {
      stats.missingContractRows++;
      stats.unresolvedRows++;
      continue;
    }

    if (mode === "provider") {
      stats.unresolvedRows++;
      continue;
    }

    const date = getDate(row);
    const time = getTime(row).slice(0, 5);
    const underlyingPrice = getUnderlyingPrice(date, time);
    if (!(underlyingPrice != null && underlyingPrice > 0)) {
      stats.missingUnderlyingRows++;
      stats.unresolvedRows++;
      continue;
    }

    const greeks = computeQuoteGreeks({
      optionPrice: getMid(row),
      underlyingPrice,
      strike: meta.strike,
      date,
      time,
      expiration: meta.expiration,
      contractType: meta.contract_type,
    });
    if (!greeks) {
      stats.unresolvedRows++;
      continue;
    }

    row.delta = greeks.delta;
    row.gamma = greeks.gamma;
    row.theta = greeks.theta;
    row.vega = greeks.vega;
    row.iv = greeks.iv;
    row.greeks_source = greeks.greeks_source;
    row.greeks_revision = greeks.greeks_revision;
    stats.computedRows++;
  }

  return stats;
}
