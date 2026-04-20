import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { DuckDBInstance } from "@duckdb/node-api";
import { MarketIngestor } from "../../../../src/market/ingestor/index.js";
import { createMarketStores } from "../../../../src/market/stores/index.js";
import { ensureMarketDataTables } from "../../../../src/db/market-schemas.js";
import { TickerRegistry } from "../../../../src/market/tickers/registry.js";
import type { MarketDataProvider } from "../../../../src/utils/market-provider.js";

describe("MarketIngestor.ingestFlatFile", () => {
  let dataDir: string;
  let instance: DuckDBInstance;
  let conn: Awaited<ReturnType<DuckDBInstance["connect"]>>;
  let tickers: TickerRegistry;

  beforeEach(async () => {
    dataDir = join(tmpdir(), `ingestor-flatfile-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dataDir, { recursive: true });
    instance = await DuckDBInstance.create(":memory:");
    conn = await instance.connect();
    await conn.run(`ATTACH ':memory:' AS market`);
    await ensureMarketDataTables(conn);
    tickers = new TickerRegistry([{ underlying: "SPX", roots: ["SPX", "SPXW"] }]);
  });

  afterEach(() => {
    try { instance.closeSync(); } catch { /* ignore */ }
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("returns unsupported when provider lacks flatFiles capability", async () => {
    const provider: MarketDataProvider = {
      name: "no-flat",
      capabilities: () => ({
        tradeBars: true,
        quotes: true,
        greeks: false,
        flatFiles: false,
        bulkByRoot: false,
        perTicker: true,
        minuteBars: true,
        dailyBars: true,
      }),
      fetchBars: async () => [],
      fetchOptionSnapshot: async () => ({ contracts: [], underlying_price: 0, underlying_ticker: "SPX" }),
    };
    const stores = createMarketStores({ conn, dataDir, parquetMode: false, tickers });
    const ingestor = new MarketIngestor({ stores, dataRoot: dataDir, providerFactory: () => provider });

    const result = await ingestor.ingestFlatFile({
      date: "2026-01-05",
      assetClass: "option",
      underlying: "SPX",
    });

    expect(result.status).toBe("unsupported");
    expect(result.error).toMatch(/flat[_\s-]?file/i);
  });

  it("delegates to provider.downloadBulkData and returns ok with rowsWritten", async () => {
    let downloadCalled = false;

    const provider: MarketDataProvider = {
      name: "has-flat",
      capabilities: () => ({
        tradeBars: true,
        quotes: true,
        greeks: false,
        flatFiles: true,
        bulkByRoot: false,
        perTicker: true,
        minuteBars: true,
        dailyBars: true,
      }),
      fetchBars: async () => [],
      fetchOptionSnapshot: async () => ({ contracts: [], underlying_price: 0, underlying_ticker: "SPX" }),
      downloadBulkData: async () => {
        downloadCalled = true;
        return { rowCount: 5000, skipped: false };
      },
    };
    const stores = createMarketStores({ conn, dataDir, parquetMode: false, tickers });
    const ingestor = new MarketIngestor({ stores, dataRoot: dataDir, providerFactory: () => provider });

    const result = await ingestor.ingestFlatFile({
      date: "2026-01-05",
      assetClass: "option",
      underlying: "SPX",
    });

    expect(downloadCalled).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.rowsWritten).toBe(5000);
  });
});
