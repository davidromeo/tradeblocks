/**
 * SpotStore dual-backend contract tests (Phase 2 Plan 03 Task 1).
 *
 * Runs the same test suite against ParquetSpotStore and DuckdbSpotStore via
 * `describe.each([parquet, duckdb])`. The final parity describe block asserts
 * that identical `writeBars` input yields `deepEqual` output from `readBars`
 * across both backends — the strongest evidence that the D-02 "no parquetMode
 * branching in method bodies" invariant produces observationally-identical
 * behavior.
 *
 * Tests cover:
 *   - writeBars + readBars round-trip (3 minute bars)
 *   - empty-array writeBars is a no-op
 *   - readDailyBars RTH aggregation (first(open)/max(high)/min(low)/last(close))
 *   - getCoverage on populated ticker
 *   - getCoverage on missing ticker returns empty report
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import {
  ParquetSpotStore,
  DuckdbSpotStore,
} from "../../../../src/test-exports.js";
import {
  buildStoreFixture,
  type FixtureHandle,
} from "../../../fixtures/market-stores/build-fixture.js";
import { makeBars } from "../../../fixtures/market-stores/bars-fixture.js";
import { createMarketParquetViews } from "../../../../src/db/market-views.js";

async function makeParquetSpot(): Promise<{
  store: ParquetSpotStore;
  fixture: FixtureHandle;
}> {
  const fixture = await buildStoreFixture({ parquetMode: true });
  return { store: new ParquetSpotStore(fixture.ctx), fixture };
}

async function makeDuckdbSpot(): Promise<{
  store: DuckdbSpotStore;
  fixture: FixtureHandle;
}> {
  const fixture = await buildStoreFixture({ parquetMode: false });
  return { store: new DuckdbSpotStore(fixture.ctx), fixture };
}

describe.each([
  {
    name: "parquet",
    make: makeParquetSpot,
    refreshViews: async (f: FixtureHandle) => {
      await createMarketParquetViews(f.ctx.conn, f.ctx.dataDir);
    },
  },
  {
    name: "duckdb",
    make: makeDuckdbSpot,
    refreshViews: async (_f: FixtureHandle) => {
      /* no-op */
    },
  },
])("SpotStore contract — $name backend", ({ make, refreshViews }) => {
  let fixture: FixtureHandle;
  let store: ParquetSpotStore | DuckdbSpotStore;

  beforeEach(async () => {
    const built = await make();
    fixture = built.fixture;
    store = built.store;
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it("writeBars + readBars round-trip (3 minute bars)", async () => {
    const bars = makeBars("SPX", "2025-01-06");
    await store.writeBars("SPX", "2025-01-06", bars);
    await refreshViews(fixture);

    const read = await store.readBars("SPX", "2025-01-06", "2025-01-06");
    expect(read.length).toBe(3);
    expect(read.map((r) => r.time)).toEqual(["09:30", "10:30", "15:45"]);
    expect(read[0].ticker).toBe("SPX");
    expect(read[0].date).toBe("2025-01-06");
    expect(read[0].open).toBe(100);
  });

  it("writeBars with empty array is a no-op", async () => {
    await store.writeBars("SPX", "2025-01-06", []);
    await refreshViews(fixture);
    const read = await store.readBars("SPX", "2025-01-06", "2025-01-06");
    expect(read).toEqual([]);
  });

  it("readDailyBars aggregates RTH minute bars via first/last/max/min", async () => {
    const bars = makeBars("SPX", "2025-01-06");
    await store.writeBars("SPX", "2025-01-06", bars);
    await refreshViews(fixture);

    const daily = await store.readDailyBars("SPX", "2025-01-06", "2025-01-06");
    expect(daily.length).toBe(1);
    expect(daily[0].ticker).toBe("SPX");
    expect(daily[0].date).toBe("2025-01-06");
    // first(open ORDER BY time) → 09:30 bar → open=100
    expect(daily[0].open).toBe(100);
    // max(high) across 3 bars — bar 2 has high=106
    expect(daily[0].high).toBeGreaterThanOrEqual(106);
    // min(low) across 3 bars — bar 1 has low=99 (basePrice 100 - 1)
    expect(daily[0].low).toBeLessThanOrEqual(99);
    // last(close ORDER BY time) → 15:45 bar → close=99.5
    expect(daily[0].close).toBeCloseTo(99.5, 5);
  });

  it("getCoverage reports written dates with correct earliest/latest/totalDates", async () => {
    await store.writeBars("SPX", "2025-01-06", makeBars("SPX", "2025-01-06"));
    await store.writeBars("SPX", "2025-01-08", makeBars("SPX", "2025-01-08"));
    await refreshViews(fixture);

    const cov = await store.getCoverage("SPX", "2025-01-01", "2025-01-31");
    expect(cov.earliest).toBe("2025-01-06");
    expect(cov.latest).toBe("2025-01-08");
    expect(cov.totalDates).toBe(2);
    expect(cov.missingDates).toEqual([]);
  });

  it("getCoverage on ticker with no rows returns empty report", async () => {
    await refreshViews(fixture);
    const cov = await store.getCoverage("QQQ", "2025-01-01", "2025-01-31");
    expect(cov.earliest).toBeNull();
    expect(cov.latest).toBeNull();
    expect(cov.totalDates).toBe(0);
    expect(cov.missingDates).toEqual([]);
  });
});

describe("SpotStore backend parity", () => {
  it("Parquet and DuckDB return identical readBars output for the same input", async () => {
    const p = await makeParquetSpot();
    const d = await makeDuckdbSpot();
    try {
      const bars = makeBars("SPX", "2025-01-06");
      await p.store.writeBars("SPX", "2025-01-06", bars);
      await d.store.writeBars("SPX", "2025-01-06", bars);
      await createMarketParquetViews(p.fixture.ctx.conn, p.fixture.ctx.dataDir);

      const fromP = await p.store.readBars("SPX", "2025-01-06", "2025-01-06");
      const fromD = await d.store.readBars("SPX", "2025-01-06", "2025-01-06");
      expect(fromP).toEqual(fromD);
    } finally {
      p.fixture.cleanup();
      d.fixture.cleanup();
    }
  });
});
