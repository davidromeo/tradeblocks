import { estimateTradesPerYear, MIN_TRADES_PER_YEAR, Trade } from "@tradeblocks/lib";

function createTrade(date: Date): Trade {
  return {
    dateOpened: date,
    timeOpened: "09:30:00",
    openingPrice: 0,
    legs: "Mock",
    premium: 0,
    pl: 1000,
    numContracts: 1,
    fundsAtClose: 100000,
    marginReq: 0,
    strategy: "Test",
    openingCommissionsFees: 0,
    closingCommissionsFees: 0,
    openingShortLongRatio: 1,
  };
}

describe("estimateTradesPerYear", () => {
  it("returns fallback when fewer than two trades", () => {
    const trades: Trade[] = [createTrade(new Date("2024-01-01"))];
    expect(estimateTradesPerYear(trades, 120)).toBe(120);
  });

  it("enforces the minimum trade pace", () => {
    const trades: Trade[] = [];
    expect(estimateTradesPerYear(trades, 0)).toBe(MIN_TRADES_PER_YEAR);
  });

  it("calculates realistic pace for sparse filtered strategies", () => {
    const trades: Trade[] = [];
    const start = new Date("2024-01-01");
    for (let i = 0; i < 23; i++) {
      const date = new Date(start.getTime() + i * 10 * 24 * 60 * 60 * 1000);
      trades.push(createTrade(date));
    }

    const pace = estimateTradesPerYear(trades, 1190);
    expect(pace).toBeGreaterThan(10);
    expect(pace).toBeLessThan(100);
  });
});
