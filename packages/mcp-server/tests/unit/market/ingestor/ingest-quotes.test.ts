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

describe("MarketIngestor.ingestQuotes", () => {
  let dataDir: string;
  let instance: DuckDBInstance;
  let conn: Awaited<ReturnType<DuckDBInstance["connect"]>>;
  let tickers: TickerRegistry;

  beforeEach(async () => {
    dataDir = join(tmpdir(), `ingestor-quotes-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dataDir, { recursive: true });
    instance = await DuckDBInstance.create(":memory:");
    conn = await instance.connect();
    await conn.run(`ATTACH ':memory:' AS market`);
    await ensureMarketDataTables(conn);
    // option_quote_minutes is not created by ensureMarketDataTables (it's a Parquet
    // view in production; tests must create the physical fallback table directly).
    await conn.run(`
      CREATE TABLE IF NOT EXISTS market.option_quote_minutes (
        underlying      VARCHAR NOT NULL,
        date            VARCHAR NOT NULL,
        ticker          VARCHAR NOT NULL,
        time            VARCHAR NOT NULL,
        bid             DOUBLE,
        ask             DOUBLE,
        mid             DOUBLE,
        last_updated_ns BIGINT,
        source          VARCHAR,
        PRIMARY KEY (underlying, date, ticker, time)
      )
    `);
    tickers = new TickerRegistry([{ underlying: "SPXW", roots: ["SPXW"] }]);
  });

  afterEach(() => {
    try { instance.closeSync(); } catch { /* ignore */ }
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("returns unsupported when provider lacks fetchQuotes", async () => {
    const provider: MarketDataProvider = {
      name: "no-quotes",
      capabilities: () => ({
        tradeBars: true,
        quotes: false,
        greeks: false,
        flatFiles: false,
        bulkByRoot: false,
        perTicker: true,
        minuteBars: true,
        dailyBars: true,
      }),
      fetchBars: async () => [],
      fetchOptionSnapshot: async () => ({ contracts: [] }),
    };
    const stores = createMarketStores({ conn, dataDir, parquetMode: false, tickers });
    const ingestor = new MarketIngestor({ stores, dataRoot: dataDir, providerFactory: () => provider });

    const result = await ingestor.ingestQuotes({
      tickers: ["SPXW260319C04800000"],
      from: "2026-01-05",
      to: "2026-01-05",
    });

    expect(result.status).toBe("unsupported");
    expect(result.error).toMatch(/does not support/i);
  });

  it("writes quotes when provider supports fetchQuotes", async () => {
    const provider: MarketDataProvider = {
      name: "has-quotes",
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
      fetchOptionSnapshot: async () => ({ contracts: [] }),
      fetchQuotes: async () => {
        const map = new Map<string, { bid: number; ask: number }>();
        map.set("2026-01-05 09:30", { bid: 10.0, ask: 10.5 });
        map.set("2026-01-05 09:31", { bid: 10.1, ask: 10.6 });
        return map;
      },
    };
    const stores = createMarketStores({ conn, dataDir, parquetMode: false, tickers });
    const ingestor = new MarketIngestor({ stores, dataRoot: dataDir, providerFactory: () => provider });

    const result = await ingestor.ingestQuotes({
      tickers: ["SPXW260319C04800000"],
      from: "2026-01-05",
      to: "2026-01-05",
    });

    expect(result.status).toBe("ok");
    expect(result.rowsWritten).toBe(2);
  });

  it("errors when neither tickers nor underlyings is provided", async () => {
    const provider: MarketDataProvider = {
      name: "any",
      capabilities: () => ({
        tradeBars: true, quotes: true, greeks: false, flatFiles: false,
        bulkByRoot: true, perTicker: true, minuteBars: true, dailyBars: true,
      }),
      fetchBars: async () => [],
      fetchOptionSnapshot: async () => ({ contracts: [] }),
    };
    const stores = createMarketStores({ conn, dataDir, parquetMode: false, tickers });
    const ingestor = new MarketIngestor({ stores, dataRoot: dataDir, providerFactory: () => provider });

    const result = await ingestor.ingestQuotes({ from: "2026-01-05", to: "2026-01-05" });

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/tickers.*underlyings/i);
  });

  it("errors when both tickers and underlyings are provided", async () => {
    const provider: MarketDataProvider = {
      name: "any",
      capabilities: () => ({
        tradeBars: true, quotes: true, greeks: false, flatFiles: false,
        bulkByRoot: true, perTicker: true, minuteBars: true, dailyBars: true,
      }),
      fetchBars: async () => [],
      fetchOptionSnapshot: async () => ({ contracts: [] }),
    };
    const stores = createMarketStores({ conn, dataDir, parquetMode: false, tickers });
    const ingestor = new MarketIngestor({ stores, dataRoot: dataDir, providerFactory: () => provider });

    const result = await ingestor.ingestQuotes({
      tickers: ["SPXW260319C04800000"],
      underlyings: ["SPX"],
      from: "2026-01-05",
      to: "2026-01-05",
    });

    expect(result.status).toBe("error");
  });

  it("bulk path: returns unsupported when provider lacks fetchBulkQuotes", async () => {
    const provider: MarketDataProvider = {
      name: "per-ticker-only",
      capabilities: () => ({
        tradeBars: true, quotes: true, greeks: false, flatFiles: false,
        bulkByRoot: false, perTicker: true, minuteBars: true, dailyBars: true,
      }),
      fetchBars: async () => [],
      fetchOptionSnapshot: async () => ({ contracts: [] }),
      fetchQuotes: async () => new Map(),
    };
    const stores = createMarketStores({ conn, dataDir, parquetMode: false, tickers });
    const ingestor = new MarketIngestor({ stores, dataRoot: dataDir, providerFactory: () => provider });

    const result = await ingestor.ingestQuotes({
      underlyings: ["SPX"],
      from: "2026-01-05",
      to: "2026-01-05",
    });

    expect(result.status).toBe("unsupported");
    expect(result.error).toMatch(/bulk-by-underlying/i);
  });

  it("bulk path: writes all rows yielded by fetchBulkQuotes", async () => {
    let bulkCalls = 0;
    const provider: MarketDataProvider = {
      name: "bulk",
      capabilities: () => ({
        tradeBars: true, quotes: true, greeks: false, flatFiles: false,
        bulkByRoot: true, perTicker: false, minuteBars: true, dailyBars: true,
      }),
      fetchBars: async () => [],
      fetchOptionSnapshot: async () => ({ contracts: [] }),
      fetchBulkQuotes: async function* ({ underlying, date }) {
        bulkCalls++;
        expect(underlying).toBe("SPXW");
        expect(date).toBe("2026-01-05");
        yield [
          { ticker: "SPXW260319C04800000", timestamp: "2026-01-05 09:30", bid: 10.0, ask: 10.5 },
          { ticker: "SPXW260319C04800000", timestamp: "2026-01-05 09:31", bid: 10.1, ask: 10.6 },
        ];
        yield [
          { ticker: "SPXW260319P04800000", timestamp: "2026-01-05 09:30", bid: 20.0, ask: 20.5 },
        ];
      },
    };
    const stores = createMarketStores({ conn, dataDir, parquetMode: false, tickers });
    const ingestor = new MarketIngestor({ stores, dataRoot: dataDir, providerFactory: () => provider });

    const result = await ingestor.ingestQuotes({
      underlyings: ["SPXW"],
      from: "2026-01-05",
      to: "2026-01-05",
    });

    expect(result.status).toBe("ok");
    expect(bulkCalls).toBe(1);
    expect(result.rowsWritten).toBe(3);
    expect(result.dateRange).toEqual({ from: "2026-01-05", to: "2026-01-05" });
  });
});
