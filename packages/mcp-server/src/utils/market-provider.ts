/**
 * Market Data Provider Interface
 *
 * Defines the shared types and provider abstraction for fetching market data
 * from external APIs (Massive.com, ThetaData, etc.).
 *
 * All providers normalize their responses to BarRow and OptionContract types.
 * The factory function getProvider() selects the active provider based on the
 * MARKET_DATA_PROVIDER environment variable (default: "massive").
 */

import { MassiveProvider } from "./providers/massive.js";
import { ThetaDataProvider } from "./providers/thetadata.js";

// ---------------------------------------------------------------------------
// Shared Types
// ---------------------------------------------------------------------------

/** Normalized OHLCV bar — shared output type for all providers. */
export interface BarRow {
  date: string;      // "YYYY-MM-DD" Eastern Time
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ticker: string;    // Plain storage format (no prefix)
  time?: string;     // "HH:MM" ET — only set for intraday (minute/hour) bars
}

/** Asset classes supported by market data providers. */
export type AssetClass = "stock" | "index" | "option";

/** Options for fetching OHLCV bars. */
export interface FetchBarsOptions {
  /** Plain ticker — VIX, AAPL, SPX251219C05000000 (no provider-specific prefix) */
  ticker: string;
  /** Start date "YYYY-MM-DD" */
  from: string;
  /** End date "YYYY-MM-DD" */
  to: string;
  /** Bar timespan (default: "day") */
  timespan?: "day" | "minute" | "hour";
  /** Bar multiplier (default: 1) */
  multiplier?: number;
  /** Asset class (default: "stock") */
  assetClass?: AssetClass;
}

/** Curated option contract returned by all providers. */
export interface OptionContract {
  ticker: string;
  underlying_ticker: string;
  underlying_price: number;
  contract_type: "call" | "put";
  strike: number;
  expiration: string;        // "YYYY-MM-DD"
  exercise_style: string;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  greeks_source: "massive" | "thetadata" | "computed";
  bid: number;
  ask: number;
  midpoint: number;
  last_price: number | null;
  open_interest: number;
  volume: number;
  break_even: number;
}

/** Options for fetching option chain snapshots. */
export interface FetchSnapshotOptions {
  underlying: string;
  strike_price_gte?: number;
  strike_price_lte?: number;
  expiration_date_gte?: string;
  expiration_date_lte?: string;
  contract_type?: "call" | "put";
}

/** Result from fetching an option chain snapshot. */
export interface FetchSnapshotResult {
  contracts: OptionContract[];
  underlying_price: number;
  underlying_ticker: string;
}

/** The contract every market data provider must implement. */
export interface MarketDataProvider {
  readonly name: string;
  fetchBars(options: FetchBarsOptions): Promise<BarRow[]>;
  fetchOptionSnapshot(options: FetchSnapshotOptions): Promise<FetchSnapshotResult>;
}

// ---------------------------------------------------------------------------
// Provider Factory (lazy singleton with static imports)
// ---------------------------------------------------------------------------

let _cached: MarketDataProvider | null = null;

/**
 * Get the active market data provider.
 *
 * Reads MARKET_DATA_PROVIDER env var (default: "massive").
 * Returns a lazy singleton — cached after first call.
 */
export function getProvider(): MarketDataProvider {
  if (_cached) return _cached;
  const name = (process.env.MARKET_DATA_PROVIDER ?? "massive").toLowerCase();
  switch (name) {
    case "massive":
      _cached = new MassiveProvider();
      break;
    case "thetadata":
      _cached = new ThetaDataProvider();
      break;
    default:
      throw new Error(
        `Unknown MARKET_DATA_PROVIDER: "${name}". Supported: massive, thetadata`
      );
  }
  return _cached!;
}

/** Reset cached provider — for test isolation only. */
export function _resetProvider(): void {
  _cached = null;
}
