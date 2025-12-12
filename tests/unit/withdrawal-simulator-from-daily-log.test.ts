// tests/unit/withdrawal-simulator-from-daily-log.test.ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ⬇️ Adjust these imports if your paths are slightly different
import { parseWithdrawalDailyCsv } from "../../lib/processing/withdrawal-log-parser";
import {
  runWithdrawalSimulationFromDailyLog,
  type WithdrawalSimSettings,
} from "../../lib/withdrawals/withdrawalSimulatorV2";

const FIXTURE_ROOT = path.resolve(__dirname, "..", "fixtures", "withdrawals");

// All in dollars
const STARTING_BALANCE = 160_000;

// Note: Values provided by user analysis of OO logs
const OO_BASE_FINAL_EQUITY = 296497.64;
// const OO_BASE_TOTAL_WITHDRAWN = 0;

const OO_RESET_FINAL_EQUITY = 2_058_581.44;
const OO_RESET_TOTAL_WITHDRAWN = 1_908_978.3;

const OO_FIXED_FINAL_EQUITY = 6_117_224_899.7;
const OO_FIXED_TOTAL_WITHDRAWN = 430_000;

// Helper to load & parse a fixture
function loadDailyLog(filename: string) {
  const fullPath = path.join(FIXTURE_ROOT, filename);
  const csv = fs.readFileSync(fullPath, "utf8");
  const rows = parseWithdrawalDailyCsv(csv);
  if (!rows.length) {
    throw new Error(`Parsed 0 rows from ${filename}`);
  }
  return rows;
}

// Use a small relative tolerance for huge numbers
function expectClose(actual: number, expected: number, relTol = 2e-3) {
  const diff = Math.abs(actual - expected);
  const scale = Math.max(Math.abs(expected), 1);
  expect(diff / scale).toBeLessThanOrEqual(relTol);
}

describe("Withdrawal simulator – daily-log reproduction of OO runs", () => {
  it("reproduces the base (no-withdrawal) run when mode = none", () => {
    const daily = loadDailyLog("base.csv");

    const settings: WithdrawalSimSettings = {
      startingBalance: STARTING_BALANCE,
      mode: "none", // no extra withdrawals
      percentOfProfit: 0,
      fixedDollar: 0,
      withdrawOnlyProfitableMonths: true,
      resetToStart: false,
    };

    const result = runWithdrawalSimulationFromDailyLog(daily, settings);

    // Base run should have no withdrawals at all
    expect(result.totalWithdrawn).toBe(0);

    // Final equity should match OO's Current Funds (within rounding)
    expectClose(result.finalEquity, OO_BASE_FINAL_EQUITY);
  });

  it("reproduces OO 'reset to starting funds' run when resetToStart = true", () => {
    const daily = loadDailyLog("reset-to-start.csv");

    const settings: WithdrawalSimSettings = {
      startingBalance: STARTING_BALANCE,
      mode: "none", // we let resetToStart drive withdrawals
      percentOfProfit: 0,
      fixedDollar: 0,
      withdrawOnlyProfitableMonths: true,
      resetToStart: true,
    };

    const result = runWithdrawalSimulationFromDailyLog(daily, settings);

    // Option Omega "Current Funds" for a Reset run is Gross Equity (Active + Withdrawn).
    // The simulator tracks Net/Active Equity.
    // So we reconstruct Gross Equity to match OO's target value.
    const grossEquity = result.finalEquity + result.totalWithdrawn;
    expectClose(grossEquity, OO_RESET_FINAL_EQUITY, 0.01);

    // Match OO's final Withdrawn
    expectClose(result.totalWithdrawn, OO_RESET_TOTAL_WITHDRAWN, 0.01);
  });

  it("reproduces OO 'withdraw fixed amount every month' run", () => {
    const daily = loadDailyLog("fixed-10k.csv");

    const settings: WithdrawalSimSettings = {
      startingBalance: STARTING_BALANCE,
      mode: "fixedDollar",
      percentOfProfit: 0,
      fixedDollar: 10_000,
      withdrawOnlyProfitableMonths: false, // OO withdraws 10k every month
      resetToStart: false,
    };

    const result = runWithdrawalSimulationFromDailyLog(daily, settings);

    // Final equity close to OO's Current Funds
    expectClose(result.finalEquity, OO_FIXED_FINAL_EQUITY, 0.005);

    // Total withdrawn should be exactly 430k (43 months * 10k)
    // Total withdrawn should be exactly 430k (43 months * 10k)
    expectClose(result.totalWithdrawn, OO_FIXED_TOTAL_WITHDRAWN, 1e-6);
  });

  it("reproduces OO 'reset-to-starting-funds' run for 0.80 Kelly log", () => {
    const csvPath = path.resolve(
      process.cwd(),
      "tests/fixtures/withdrawals/reset-0-80.csv"
    );
    const csvContent = fs.readFileSync(csvPath, "utf8");
    const dailyLog = parseWithdrawalDailyCsv(csvContent);

    // Dynamic Ground Truth Parsing
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const headers = lines[0].split(",").map((h) =>
      h
        .replace(/^\uFEFF|["']/g, "")
        .trim()
        .toLowerCase()
    );
    const lastRow = lines[lines.length - 1].split(","); // Simple split for now, assuming no comma in numbers

    const findIdx = (candidates: string[]) =>
      headers.findIndex((h) => candidates.includes(h));
    const parseNum = (val: string) => parseFloat(val.replace(/[$,"]/g, ""));

    const tfIdx = findIdx(["trading funds", "tradingfunds"]); // Active Capital
    const wdIdx = findIdx(["withdrawn", "total withdrawn", "totalwithdrawn"]);

    const OO_TRADING_FUNDS = parseNum(lastRow[tfIdx]);
    const OO_WITHDRAWN = parseNum(lastRow[wdIdx]);

    const result = runWithdrawalSimulationFromDailyLog(dailyLog, {
      startingBalance: 160000,
      resetToStart: true,
      mode: "none", // Reset mode implies "none" base strategy + resetToStart=true
      percentOfProfit: 0,
      fixedDollar: 0,
      withdrawOnlyProfitableMonths: true,
    });

    // Verify Active Equity (should match Trading Funds)
    expectClose(result.finalEquity, OO_TRADING_FUNDS, 0.001); // 0.1% tolerance

    // Verify Total Withdrawn
    expectClose(result.totalWithdrawn, OO_WITHDRAWN, 0.001); // 0.1% tolerance
  });
});
