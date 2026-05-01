/**
 * ParquetSpotStore writeBars zero-batch guard (quick-260421-l63 Task 3).
 *
 * Tests the defense-in-depth write-side guard that rejects all-zero-OHLC
 * batches. Mixed batches (some zero rows, some valid rows) are allowed —
 * upstream cleanup and the enricher's read-side filter handle those.
 *
 * Uses the shared build-fixture helper so the test exercises the real
 * Parquet write path (writeSpotPartition) end-to-end for the success cases.
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { ParquetSpotStore } from "../../src/test-exports.js";
import {
  buildStoreFixture,
  type FixtureHandle,
} from "../fixtures/market-stores/build-fixture.js";
import { createMarketParquetViews } from "../../src/db/market-views.js";
import type { BarRow } from "../../src/market/stores/types.js";

function zeroBar(time: string): BarRow {
  return {
    ticker: "SPX",
    date: "2025-01-06",
    time,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    volume: 0,
  };
}

function validBar(time: string, basePrice: number): BarRow {
  return {
    ticker: "SPX",
    date: "2025-01-06",
    time,
    open: basePrice,
    high: basePrice + 1,
    low: basePrice - 1,
    close: basePrice + 0.5,
    bid: basePrice - 0.1,
    ask: basePrice + 0.1,
    volume: 0,
  };
}

describe("ParquetSpotStore writeBars zero-batch guard (quick-260421-l63)", () => {
  let fixture: FixtureHandle;
  let store: ParquetSpotStore;

  beforeEach(async () => {
    fixture = await buildStoreFixture({ parquetMode: true });
    store = new ParquetSpotStore(fixture.ctx);
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it("rejects all-zero OHLC batch with descriptive error including ticker + date", async () => {
    const bars = ["09:30", "10:30", "15:45"].map(zeroBar);
    await expect(store.writeBars("SPX", "2025-01-06", bars)).rejects.toThrow(
      /all-zero OHLC/,
    );
    await expect(store.writeBars("SPX", "2025-01-06", bars)).rejects.toThrow(
      /ticker=SPX/,
    );
    await expect(store.writeBars("SPX", "2025-01-06", bars)).rejects.toThrow(
      /date=2025-01-06/,
    );
  });

  it("allows a mixed batch (one zero row, two valid rows) — caller owns mixed semantics", async () => {
    const bars = [zeroBar("09:30"), validBar("10:30", 105), validBar("15:45", 99)];
    await expect(
      store.writeBars("SPX", "2025-01-06", bars),
    ).resolves.toBeUndefined();
    await createMarketParquetViews(fixture.ctx.conn, fixture.ctx.dataDir);
    const read = await store.readBars("SPX", "2025-01-06", "2025-01-06");
    // All 3 rows written, including the zero row. The guard does NOT filter
    // mixed batches — that's the enricher's job on read.
    expect(read.length).toBe(3);
  });

  it("preserves the empty-array early-return contract (no error, no write)", async () => {
    await expect(
      store.writeBars("SPX", "2025-01-06", []),
    ).resolves.toBeUndefined();
    await createMarketParquetViews(fixture.ctx.conn, fixture.ctx.dataDir);
    const read = await store.readBars("SPX", "2025-01-06", "2025-01-06");
    expect(read).toEqual([]);
  });

  it("happy path: all non-zero OHLC rows succeed (no regression)", async () => {
    const bars = [
      validBar("09:30", 100),
      validBar("10:30", 105),
      validBar("15:45", 99),
    ];
    await expect(
      store.writeBars("SPX", "2025-01-06", bars),
    ).resolves.toBeUndefined();
    await createMarketParquetViews(fixture.ctx.conn, fixture.ctx.dataDir);
    const read = await store.readBars("SPX", "2025-01-06", "2025-01-06");
    expect(read.length).toBe(3);
    expect(read[0].open).toBe(100);
  });
});
