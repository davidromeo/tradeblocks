/**
 * ThetaData Market Data Provider (stub)
 *
 * Placeholder implementation — will be replaced with full ThetaData REST API
 * adapter in a subsequent task.
 */

import type {
  MarketDataProvider,
  BarRow,
  FetchBarsOptions,
  FetchSnapshotOptions,
  FetchSnapshotResult,
} from "../market-provider.js";

export class ThetaDataProvider implements MarketDataProvider {
  readonly name = "thetadata";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchBars(options: FetchBarsOptions): Promise<BarRow[]> {
    throw new Error("ThetaData provider not yet implemented — set MARKET_DATA_PROVIDER=massive");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchOptionSnapshot(options: FetchSnapshotOptions): Promise<FetchSnapshotResult> {
    throw new Error("ThetaData provider not yet implemented — set MARKET_DATA_PROVIDER=massive");
  }
}
