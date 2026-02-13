import type { Trade } from "@tradeblocks/lib";

export const DEFAULT_MARKET_TICKER = "SPX";
export const GLOBAL_MARKET_TICKER = "ALL";

const TICKER_FIELD_CANDIDATES = [
  "ticker",
  "Ticker",
  "symbol",
  "Symbol",
  "underlying",
  "Underlying",
  "underlyingSymbol",
  "Underlying Symbol",
];

/**
 * Normalize ticker strings into a stable uppercase symbol.
 */
export function normalizeTicker(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const firstToken = trimmed.split(/\s+/)[0];
  const stripped = firstToken.replace(/^[\^$]+/, "");
  const normalized = stripped.toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  if (!normalized) return null;
  // Guard against contract-count tokens like "1" from Symbol/legs strings.
  // Valid tickers should include at least one alphabetic character.
  if (!/[A-Z]/.test(normalized)) return null;
  return normalized;
}

/**
 * Parse the underlying ticker from a legs/symbol string.
 * Example: "SPX 5200P/5150P" -> "SPX"
 */
export function extractTickerFromLegs(legs: string | null | undefined): string | null {
  if (!legs) return null;
  const match = legs.trim().match(/^([A-Za-z\^$][A-Za-z0-9._\-$^]*)/);
  if (!match) return null;
  return normalizeTicker(match[1]);
}

/**
 * Resolve ticker from arbitrary object fields (case/alias tolerant).
 */
export function resolveTickerFromFields(
  fields: Record<string, unknown> | null | undefined
): string | null {
  if (!fields) return null;
  for (const field of TICKER_FIELD_CANDIDATES) {
    const raw = fields[field];
    if (typeof raw === "string") {
      const normalized = normalizeTicker(raw);
      if (normalized) return normalized;
    }
  }
  return null;
}

/**
 * Resolve ticker for a loaded trade.
 */
export function resolveTradeTicker(
  trade: Pick<Trade, "legs" | "customFields">,
  fallback: string = DEFAULT_MARKET_TICKER
): string {
  return (
    resolveTickerFromFields(trade.customFields as Record<string, unknown> | undefined) ??
    extractTickerFromLegs(trade.legs) ??
    fallback
  );
}

/**
 * Resolve ticker from a CSV row plus optional fallback.
 */
export function resolveTickerFromCsvRow(
  row: Record<string, string>,
  fallback: string = DEFAULT_MARKET_TICKER
): string {
  return (
    resolveTickerFromFields(row as Record<string, unknown>) ??
    extractTickerFromLegs(row["Legs"] || row["Symbol"] || row["symbol"]) ??
    fallback
  );
}

/**
 * Stable composite key for ticker+date maps.
 */
export function marketTickerDateKey(ticker: string, date: string): string {
  return `${ticker}|${date}`;
}
