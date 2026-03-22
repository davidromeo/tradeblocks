import { jest } from "@jest/globals";

/**
 * Integration tests for replay_trade MCP tool (handleReplayTrade)
 *
 * Tests both hypothetical and tradelog replay modes with:
 *   - Mocked fetch for Massive.com minute bar requests
 *   - Real in-memory DuckDB for tradelog mode (mocked via getConnection)
 *
 * Requirements: TST-04, RPL-01, RPL-05, RPL-06
 */

import { DuckDBInstance, DuckDBConnection } from "@duckdb/node-api";
import type { MassiveAggregateResponse } from "../../src/utils/massive-client.js";

// We need to mock getConnection before importing handleReplayTrade
// so that tradelog mode uses our in-memory DuckDB
const mockGetConnection = jest.fn<() => Promise<DuckDBConnection>>();
jest.unstable_mockModule("../../src/db/connection.js", () => ({
  getConnection: mockGetConnection,
  upgradeToReadWrite: jest.fn(),
  downgradeToReadOnly: jest.fn(),
  closeConnection: jest.fn(),
  isConnected: jest.fn(() => true),
}));

// Import after mocking
const { handleReplayTrade } = await import("../../src/tools/replay.js");

// =============================================================================
// Test helpers
// =============================================================================

/**
 * Build a Massive API response with minute bars.
 * Each bar has timestamps in Unix ms, suitable for option minute data.
 */
function buildMinuteBarResponse(
  ticker: string,
  bars: Array<{ t: number; o: number; h: number; l: number; c: number }>
): MassiveAggregateResponse {
  return {
    ticker,
    queryCount: bars.length,
    resultsCount: bars.length,
    adjusted: false,
    results: bars.map((b) => ({
      t: b.t,
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
      v: 500,
      vw: (b.h + b.l) / 2,
      n: 10,
    })),
    status: "OK",
    request_id: "test-replay-req",
  };
}

/**
 * Mock fetch to return minute bar responses based on OCC ticker patterns in URLs.
 */
function mockFetch(
  responses: Map<string, MassiveAggregateResponse>
): jest.SpiedFunction<typeof globalThis.fetch> {
  return jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, response] of responses) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response("Not Found", { status: 404, statusText: "Not Found" });
  });
}

// Minute bars for SPY 470C — 3 minutes starting at 09:30 ET on 2025-01-17
// 2025-01-17 is in EST (UTC-5): 09:30 ET = 14:30 UTC = 1737124200000 ms
const SPY_470C_BARS = [
  { t: 1737124200000, o: 5.0, h: 5.2, l: 4.9, c: 5.1 },  // 09:30
  { t: 1737124260000, o: 5.1, h: 5.5, l: 5.0, c: 5.3 },  // 09:31
  { t: 1737124320000, o: 5.3, h: 5.4, l: 4.7, c: 4.8 },  // 09:32
];

// Minute bars for SPY 475C (short leg of spread)
const SPY_475C_BARS = [
  { t: 1737124200000, o: 3.0, h: 3.1, l: 2.9, c: 3.05 },  // 09:30
  { t: 1737124260000, o: 3.05, h: 3.3, l: 3.0, c: 3.2 },  // 09:31
  { t: 1737124320000, o: 3.2, h: 3.3, l: 2.6, c: 2.7 },   // 09:32
];

// =============================================================================
// Test suite
// =============================================================================

describe("replay_trade integration", () => {
  let db: DuckDBInstance;
  let conn: DuckDBConnection;

  beforeEach(async () => {
    // In-memory DuckDB for tradelog mode
    db = await DuckDBInstance.create(":memory:");
    conn = await db.connect();
    await conn.run(`CREATE SCHEMA IF NOT EXISTS trades`);
    await conn.run(`
      CREATE TABLE trades.trade_data (
        block_id VARCHAR NOT NULL,
        date_opened DATE NOT NULL,
        time_opened VARCHAR,
        strategy VARCHAR,
        legs VARCHAR,
        premium DOUBLE,
        num_contracts INTEGER,
        pl DOUBLE NOT NULL,
        date_closed DATE,
        time_closed VARCHAR,
        reason_for_close VARCHAR,
        margin_req DOUBLE,
        opening_commissions DOUBLE,
        closing_commissions DOUBLE,
        ticker VARCHAR
      )
    `);

    // Wire mock getConnection to return our in-memory conn
    mockGetConnection.mockResolvedValue(conn);

    process.env.MASSIVE_API_KEY = "test-key-replay";
  });

  afterEach(async () => {
    delete process.env.MASSIVE_API_KEY;
    jest.restoreAllMocks();
    conn.closeSync();
  });

  // ---------------------------------------------------------------------------
  // Hypothetical mode
  // ---------------------------------------------------------------------------

  describe("hypothetical mode", () => {
    test("single-leg replay returns P&L path with MFE/MAE", async () => {
      const response = buildMinuteBarResponse(
        "O:SPY250117C00470000",
        SPY_470C_BARS
      );
      mockFetch(new Map([["SPY250117C00470000", response]]));

      const result = await handleReplayTrade(
        {
          legs: [
            {
              ticker: "SPY",
              strike: 470,
              type: "C",
              expiry: "2025-01-17",
              quantity: 1,
              entry_price: 5.0,
            },
          ],
          open_date: "2025-01-17",
          close_date: "2025-01-17",
          multiplier: 100,
        },
        "/tmp/test-replay"
      );

      expect(result.pnlPath.length).toBe(3);
      expect(result.legs.length).toBe(1);
      expect(result.legs[0].occTicker).toBe("SPY250117C00470000");

      // Each point should have strategyPnl and legPrices
      for (const point of result.pnlPath) {
        expect(typeof point.strategyPnl).toBe("number");
        expect(point.legPrices.length).toBe(1);
        expect(point.timestamp).toBeTruthy();
      }

      // MFE/MAE should be numeric
      expect(typeof result.mfe).toBe("number");
      expect(typeof result.mae).toBe("number");
      expect(result.mfeTimestamp).toBeTruthy();
      expect(result.maeTimestamp).toBeTruthy();
      expect(typeof result.totalPnl).toBe("number");
    });

    test("multi-leg spread replay combines legs correctly", async () => {
      const longResponse = buildMinuteBarResponse(
        "O:SPY250117C00470000",
        SPY_470C_BARS
      );
      const shortResponse = buildMinuteBarResponse(
        "O:SPY250117C00475000",
        SPY_475C_BARS
      );
      mockFetch(
        new Map([
          ["SPY250117C00470000", longResponse],
          ["SPY250117C00475000", shortResponse],
        ])
      );

      const result = await handleReplayTrade(
        {
          legs: [
            {
              ticker: "SPY",
              strike: 470,
              type: "C",
              expiry: "2025-01-17",
              quantity: 1,
              entry_price: 5.0,
            },
            {
              ticker: "SPY",
              strike: 475,
              type: "C",
              expiry: "2025-01-17",
              quantity: -1,
              entry_price: 3.0,
            },
          ],
          open_date: "2025-01-17",
          close_date: "2025-01-17",
          multiplier: 100,
        },
        "/tmp/test-replay"
      );

      expect(result.pnlPath.length).toBe(3);
      expect(result.legs.length).toBe(2);

      // Each point should have combined P&L from both legs
      for (const point of result.pnlPath) {
        expect(point.legPrices.length).toBe(2);
      }

      // Verify spread P&L combines both legs (not just one)
      // Entry: long 470C at 5.0, short 475C at 3.0 → net debit 2.0
      // At minute 0: 470C HL2=(5.2+4.9)/2=5.05, 475C HL2=(3.1+2.9)/2=3.0
      // Long leg: (5.05-5.0)*1*100=5, Short leg: (3.0-3.0)*-1*100=0
      // Combined: 5
      expect(result.pnlPath[0].strategyPnl).toBeCloseTo(5, 0);
    });

    test("returns error when open_date missing in hypothetical mode", async () => {
      await expect(
        handleReplayTrade(
          {
            legs: [
              {
                ticker: "SPY",
                strike: 470,
                type: "C",
                expiry: "2025-01-17",
                quantity: 1,
                entry_price: 5.0,
              },
            ],
            close_date: "2025-01-17",
            multiplier: 100,
          },
          "/tmp/test-replay"
        )
      ).rejects.toThrow("open_date and close_date are required");
    });
  });

  // ---------------------------------------------------------------------------
  // Tradelog mode
  // ---------------------------------------------------------------------------

  describe("tradelog mode", () => {
    test("resolves trade from block and replays it", async () => {
      // Insert a test trade
      await conn.run(`
        INSERT INTO trades.trade_data
          (block_id, date_opened, date_closed, legs, premium, num_contracts, pl, ticker)
        VALUES
          ('test-block', '2025-01-17', '2025-01-17', 'SPY 470C', 500.0, 1, 50.0, 'SPY')
      `);

      const response = buildMinuteBarResponse(
        "O:SPY250117C00470000",
        SPY_470C_BARS
      );
      mockFetch(new Map([["SPY250117C00470000", response]]));

      const result = await handleReplayTrade(
        {
          block_id: "test-block",
          trade_index: 0,
          multiplier: 100,
        },
        "/tmp/test-replay"
      );

      expect(result.pnlPath.length).toBe(3);
      expect(result.legs.length).toBe(1);
      expect(result.legs[0].occTicker).toBe("SPY250117C00470000");
      expect(typeof result.mfe).toBe("number");
      expect(typeof result.mae).toBe("number");
      expect(typeof result.totalPnl).toBe("number");
    });

    test("returns error for unparseable tradelog legs", async () => {
      // Insert trade with unparseable legs string
      await conn.run(`
        INSERT INTO trades.trade_data
          (block_id, date_opened, date_closed, legs, premium, num_contracts, pl, ticker)
        VALUES
          ('bad-block', '2025-01-17', '2025-01-17', 'SPX Put Spread', 200.0, 1, -100.0, 'SPX')
      `);

      await expect(
        handleReplayTrade(
          {
            block_id: "bad-block",
            trade_index: 0,
            multiplier: 100,
          },
          "/tmp/test-replay"
        )
      ).rejects.toThrow("hypothetical mode");
    });

    test("returns error when trade not found at index", async () => {
      // Empty table — trade_index=0 will not find anything
      await expect(
        handleReplayTrade(
          {
            block_id: "missing-block",
            trade_index: 0,
            multiplier: 100,
          },
          "/tmp/test-replay"
        )
      ).rejects.toThrow("No trade found");
    });
  });

  // ---------------------------------------------------------------------------
  // Input validation
  // ---------------------------------------------------------------------------

  describe("input validation", () => {
    test("returns error when neither legs nor block_id provided", async () => {
      await expect(
        handleReplayTrade(
          {
            open_date: "2025-01-17",
            close_date: "2025-01-17",
            multiplier: 100,
          },
          "/tmp/test-replay"
        )
      ).rejects.toThrow("Provide either legs[]");
    });
  });
});
