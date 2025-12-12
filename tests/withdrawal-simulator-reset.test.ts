import { parseWithdrawalDailyCsv } from "@/lib/processing/withdrawal-log-parser";
import {
  runWithdrawalSimulationFromDailyLog,
  WithdrawalSimSettings,
} from "@/lib/withdrawals/withdrawalSimulatorV2";

describe("Withdrawal Simulator - Daily Log & Reset Logic", () => {
  // Synthetic CSV that mimics the structure user provided
  const csvContent = `Date, Net Liquidity, Current Funds, Total Withdrawn, Trading Funds, P/L, P/L %, Drawdown %
2022-05-16, 160000, 160000, 0, 160000, 0, 0%, 0%
2022-05-17, 160000, 161000, 0, 160000, 1000, 0.625%, 0%
2022-05-18, 160000, 162000, 0, 161000, 1000, 0.62%, 0%
`;

  it("parses daily log CSV correctly", () => {
    const rows = parseWithdrawalDailyCsv(csvContent);
    expect(rows.length).toBe(3);
    // Note: parser ignores "Net Liquidity", "Current Funds" etc. as simplified model doesn't have them
    expect(rows[0].date.toISOString().slice(0, 10)).toBe("2022-05-16");
    expect(rows[1].pl).toBe(1000);
    expect(rows[1].plPct).toBeCloseTo(0.00625);
  });

  it("simulates reset-to-start correctly", () => {
    // Create a scenario:
    // Month 1: +$1000 profit (Ends at 161,000) -> Should withdraw 1000, reset to 160,000
    // Month 2: +$500 profit (Ends at 160,500) -> Should withdraw 500, reset to 160,000

    // We'll construct rows manually for clearer logic testing
    const rows = [
      // Month 1
      { date: new Date("2022-01-01"), plPct: 0.00625 }, // +1000 on 160k -> 161,000
      // Month 2
      { date: new Date("2022-02-01"), plPct: 0.003125 }, // +500 on 160k -> 160,500
    ];

    const settings: WithdrawalSimSettings = {
      startingBalance: 160_000,
      mode: "none",
      percentOfProfit: 0,
      fixedDollar: 0,
      withdrawOnlyProfitableMonths: true,
      resetToStart: true,
    };

    const result = runWithdrawalSimulationFromDailyLog(rows, settings);

    // Month 1:
    // Start: 160,000
    // Day 1: 160,000 * 0.00625 = 1000 profit. Equity = 161,000.
    // End Month: Equity 161,000.
    // Reset Check: 161,000 > 160,000. Excess 1000.
    // Withdrawal: 1000. New Equity: 160,000.

    // Month 2:
    // Start: 160,000.
    // Day 1: 160,000 * 0.003125 = 500 profit. Equity = 160,500.
    // End Month: Equity 160,500.
    // Reset Check: 160,500 > 160,000. Excess 500.
    // Withdrawal: 500. New Equity: 160,000.

    expect(result.points.length).toBe(2);
    expect(result.points[0].withdrawal).toBeCloseTo(1000);
    expect(result.points[0].equityEnd).toBeCloseTo(160000);

    expect(result.points[1].withdrawal).toBeCloseTo(500);
    expect(result.points[1].equityEnd).toBeCloseTo(160000);

    expect(result.totalWithdrawn).toBeCloseTo(1500);
    expect(result.finalEquity).toBeCloseTo(160000);
  });
});
