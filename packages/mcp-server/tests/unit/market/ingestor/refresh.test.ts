import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { DuckDBInstance } from "@duckdb/node-api";
import { MarketIngestor } from "../../../../src/market/ingestor/index.js";
import { createMarketStores } from "../../../../src/market/stores/index.js";
import { ensureMarketDataTables } from "../../../../src/db/market-schemas.js";
import type { MarketDataProvider, BarRow } from "../../../../src/utils/market-provider.js";

function makeBarsProvider(bars: BarRow[]): MarketDataProvider {
  return {
    name: "test",
    capabilities: () => ({
      tradeBars: true, quotes: true, greeks: false,
      flatFiles: false, bulkByRoot: false, perTicker: true,
      minuteBars: true, dailyBars: true,
    }),
    fetchBars: async () => bars,
    fetchOptionSnapshot: async () => ({ contracts: [] }),
  };
}

describe("MarketIngestor.refresh", () => {
  let dataDir: string;
  let instance: DuckDBInstance;
  let conn: Awaited<ReturnType<DuckDBInstance["connect"]>>;

  beforeEach(async () => {
    dataDir = join(tmpdir(), `ingestor-refresh-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dataDir, { recursive: true });
    instance = await DuckDBInstance.create(":memory:");
    conn = await instance.connect();
    await conn.run(`ATTACH ':memory:' AS market`);
    await ensureMarketDataTables(conn);
  });

  afterEach(() => {
    try { instance.closeSync(); } catch { /* ignore */ }
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("runs ingestBars per spot ticker and reports per-operation results", async () => {
    const bars: BarRow[] = [
      { ticker: "SPX", date: "2026-01-05", open: 4800, high: 4820, low: 4790, close: 4810, volume: 0 },
    ];
    const stores = createMarketStores({ conn, dataDir, parquetMode: false });
    const ingestor = new MarketIngestor({
      stores,
      dataRoot: dataDir,
      providerFactory: () => makeBarsProvider(bars),
    });

    const result = await ingestor.refresh({
      asOf: "2026-01-05",
      spotTickers: ["SPX", "QQQ"],
      computeVixContext: false,
    });

    expect(result.status).toBe("ok");
    expect(result.perOperation.spot).toHaveLength(2);
    expect(result.perOperation.vixContext).toBeNull();
  });

  it("fires computeVixContext when VIX-family ticker is in spotTickers and flag is true", async () => {
    const bars: BarRow[] = [
      { ticker: "VIX", date: "2026-01-05", open: 15, high: 16, low: 14, close: 15.5, volume: 0 },
    ];
    let contextCalled = false;
    const stores = createMarketStores({ conn, dataDir, parquetMode: false });
    stores.enriched.computeContext = async () => {
      contextCalled = true;
    };
    const ingestor = new MarketIngestor({
      stores,
      dataRoot: dataDir,
      providerFactory: () => makeBarsProvider(bars),
    });

    const result = await ingestor.refresh({
      asOf: "2026-01-05",
      spotTickers: ["VIX"],
      computeVixContext: true,
    });

    expect(contextCalled).toBe(true);
    expect(result.perOperation.vixContext).not.toBeNull();
  });

  it("skips computeVixContext when no VIX-family ticker is present, even if flag is true", async () => {
    const bars: BarRow[] = [
      { ticker: "QQQ", date: "2026-01-05", open: 400, high: 402, low: 399, close: 401, volume: 0 },
    ];
    let contextCalled = false;
    const stores = createMarketStores({ conn, dataDir, parquetMode: false });
    stores.enriched.computeContext = async () => {
      contextCalled = true;
    };
    const ingestor = new MarketIngestor({
      stores,
      dataRoot: dataDir,
      providerFactory: () => makeBarsProvider(bars),
    });

    await ingestor.refresh({
      asOf: "2026-01-05",
      spotTickers: ["QQQ"],
      computeVixContext: true,
    });

    expect(contextCalled).toBe(false);
  });
});
