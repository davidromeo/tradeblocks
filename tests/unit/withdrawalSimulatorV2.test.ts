import {
  runWithdrawalSimulation,
  WithdrawalSimSettings,
} from "@/lib/withdrawals/withdrawalSimulatorV2";

const START_BALANCE = 100_000;

// Tiny synthetic “Funds at Close” series that behaves like a real OO log.
const FUNDS_AT_CLOSE = [
  { monthKey: "2023-01", fundsAtClose: 110_000 },
  { monthKey: "2023-02", fundsAtClose: 121_000 }, // +10%
  { monthKey: "2023-03", fundsAtClose: 133_100 }, // +10%
];

// Helper: derive monthly returns from Funds at Close
function buildBaselineReturns() {
  return FUNDS_AT_CLOSE.map((row, idx) => {
    const prevFunds =
      idx === 0 ? START_BALANCE : FUNDS_AT_CLOSE[idx - 1].fundsAtClose;
    const baseReturn = row.fundsAtClose / prevFunds - 1; // e.g. 0.10
    return { monthKey: row.monthKey, baseReturn };
  });
}

describe("runWithdrawalSimulation — funds-at-close baseline", () => {
  it("reproduces the equity curve when there are no withdrawals", () => {
    const baselineMonths = buildBaselineReturns();

    const settings: WithdrawalSimSettings = {
      startingBalance: START_BALANCE,
      mode: "none", // no withdrawals at all
      percentOfProfit: 0,
      fixedDollar: 0,
      withdrawOnlyProfitableMonths: false,
      resetToStart: false,
    };

    const result = runWithdrawalSimulation(baselineMonths, settings);

    // 1) Equity end-of-month should match original Funds at Close
    const equitySeries = result.points.map((p) => p.equityEnd);
    const expectedEquitySeries = FUNDS_AT_CLOSE.map((f) => f.fundsAtClose);

    // Use float precision helper
    equitySeries.forEach((val, idx) => {
      expect(val).toBeCloseTo(expectedEquitySeries[idx], 6);
    });

    // 2) Final equity matches last Funds at Close
    expect(result.finalEquity).toBeCloseTo(
      FUNDS_AT_CLOSE[FUNDS_AT_CLOSE.length - 1].fundsAtClose,
      6
    );

    // 3) No withdrawals taken
    expect(result.totalWithdrawn).toBeCloseTo(0, 6);

    // 4) Each month’s PnL equals previous equity × that month’s return
    const returns = baselineMonths.map((b) => b.baseReturn);
    result.points.forEach((point, idx) => {
      const prevEquity =
        idx === 0 ? START_BALANCE : result.points[idx - 1].equityEnd;
      const expectedPnl = prevEquity * returns[idx];
      expect(point.pnlScaled).toBeCloseTo(expectedPnl, 6);
    });
  });

  it("withdraws excess above starting balance when resetToStart is true", () => {
    const baselineMonths = buildBaselineReturns();

    const settings: WithdrawalSimSettings = {
      startingBalance: START_BALANCE,
      mode: "none", // withdrawals come ONLY from resetToStart
      percentOfProfit: 0,
      fixedDollar: 0,
      withdrawOnlyProfitableMonths: false,
      resetToStart: true,
    };

    const result = runWithdrawalSimulation(baselineMonths, settings);

    // After each month we should snap equity back to START_BALANCE
    result.points.forEach((p) => {
      expect(p.equityEnd).toBeCloseTo(START_BALANCE, 6);
    });
    expect(result.finalEquity).toBeCloseTo(START_BALANCE, 6);

    // Expected withdrawals:
    // Month 1: 100k -> 110k (+10%). W=10k.
    // Month 2: 100k (reset) -> 110k (+10%). W=10k.
    // Month 3: 100k (reset) -> 110k (+10%). W=10k.
    // Total = 30k.

    expect(result.totalWithdrawn).toBeCloseTo(30_000, 6);

    const withdrawals = result.points.map((p) => p.withdrawal);
    withdrawals.forEach((w) => {
      expect(w).toBeCloseTo(10_000, 6);
    });
  });

  it("prevents explosion by using sane returns (Whale Scenario check)", () => {
    // 35% monthly returns, 12 months.
    const whaleMonths = Array(12).fill({ monthKey: "M", baseReturn: 0.35 });

    const result = runWithdrawalSimulation(whaleMonths, {
      startingBalance: 10000,
      mode: "fixedDollar",
      fixedDollar: 1000,
      withdrawOnlyProfitableMonths: true,
      resetToStart: false,
    });

    expect(Number.isFinite(result.finalEquity)).toBe(true);
    // 10k * (1.35)^12 approx 366k
    expect(result.finalEquity).toBeLessThan(1_000_000);
  });
});
