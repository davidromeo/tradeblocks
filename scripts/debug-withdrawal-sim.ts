import fs from "fs";
import path from "path";
import { parseWithdrawalDailyCsv } from "../lib/processing/withdrawal-log-parser";
import { runWithdrawalSimulationFromDailyLog } from "../lib/withdrawals/withdrawalSimulatorV2";

const filePath = process.argv[2];
const modeArg = process.argv[3] || "reset"; // 'reset', 'fixed', 'base', 'percent'
const extraArg = process.argv[4]; // e.g. '30' for percent, OR ref file if no extra arg needed?
// Let's refine args parsing:
// usage: script <sim-file> [mode] [extra|ref] [ref]

// Simple heuristic:
// if mode=percent, arg[4] is value, arg[5] is ref
// else arg[4] is ref

let percentValue = 0;
let refFilePath: string | undefined = undefined;

if (modeArg === "percent") {
  percentValue = Number(extraArg || "0");
  refFilePath = process.argv[5];
} else {
  // maybe fixed value?
  if (modeArg === "fixed") {
    // do we expect fixed amount arg?
    // previously: settings.fixedDollar = extraArg ? Number(extraArg) : 10000;
    // So yes.
    // But what if it's a file path?
    if (extraArg && extraArg.endsWith(".csv")) {
      refFilePath = extraArg;
      // use default fixed 10k?
    } else {
      // extraArg is the amount
      refFilePath = process.argv[5];
    }
  } else {
    // reset or base
    refFilePath = extraArg;
  }
}

if (!filePath) {
  console.error(
    "Usage: npx tsx scripts/debug-withdrawal-sim.ts <path-to-csv> [mode] [value] [ref-csv-path]"
  );
  process.exit(1);
}

const inputCsv = fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");

// Load Ref CSV if present, otherwise use inputCsv for comparison
const refCsv = refFilePath
  ? fs.readFileSync(path.resolve(process.cwd(), refFilePath), "utf8")
  : inputCsv;

console.log(`[DebugSim] Input File: ${path.basename(filePath)}`);
if (refFilePath)
  console.log(`[DebugSim] Ref File:   ${path.basename(refFilePath)}`);

// --- 1. OO Monthly P/L Aggregation (FROM REF CSV) ---
const rawRowsRef = refCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
// actually we need parsed dailyRows for sim

// Parsing headers from Ref
const headerRow = rawRowsRef[0].split(",");
const headers = headerRow.map((h) =>
  h
    .replace(/^\uFEFF|["']/g, "")
    .trim()
    .toLowerCase()
);

function findHeader(hList: string[], candidates: string[]): number {
  const wanted = candidates.map((c) => c.trim().toLowerCase());
  return hList.findIndex((h) => wanted.includes(h));
}

function parseNumClean(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[%,$]/g, "").replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const ooMonthlyPl = new Map<string, number>();

// Use robust parser on REF CSV to get accurate P/L
const refDailyRows = parseWithdrawalDailyCsv(refCsv);

for (const row of refDailyRows) {
  const d = row.date;
  const monthKey = d.toISOString().slice(0, 7); // "YYYY-MM"
  if (row.pl !== undefined) {
    ooMonthlyPl.set(monthKey, (ooMonthlyPl.get(monthKey) ?? 0) + row.pl);
  }
}

// --- 2. Determine Settings ---
const settings = {
  startingBalance: 160000,
  mode: "none" as "none" | "percentOfProfit" | "fixedDollar",
  percentOfProfit: 0,
  fixedDollar: 0,
  withdrawOnlyProfitableMonths: true,
  resetToStart: false,
};

if (modeArg === "reset") {
  settings.resetToStart = true;
  settings.mode = "none";
} else if (modeArg === "fixed") {
  const parsedVal =
    extraArg && !extraArg.endsWith(".csv") ? Number(extraArg) : 10000;
  settings.fixedDollar = parsedVal;
  settings.mode = "fixedDollar";
  settings.withdrawOnlyProfitableMonths = false;
} else if (modeArg === "percent") {
  settings.mode = "percentOfProfit";
  settings.percentOfProfit = percentValue;
  settings.withdrawOnlyProfitableMonths = true;
} else if (modeArg === "base") {
  settings.mode = "none";
  settings.resetToStart = false;
}

console.log(`[DebugSim] Mode: ${modeArg}, Settings:`, settings);

// --- 3. Run Simulation (ON INPUT CSV) ---
const inputDailyRows = parseWithdrawalDailyCsv(inputCsv);
const result = runWithdrawalSimulationFromDailyLog(inputDailyRows, settings);

// --- 4. Side-by-Side Monthly P/L ---
console.log("\n=== Monthly P/L: Sim vs OO ===");

let totalSimPnL = 0;
let totalOoPnL = 0;

// Sort months ascending
const allMonths = Array.from(
  new Set([...result.points.map((p) => p.month), ...ooMonthlyPl.keys()])
).sort();

for (const month of allMonths) {
  const simPoint = result.points.find((p) => p.month === month);
  const simPnL = simPoint?.pnlScaled ?? 0;
  const ooPnL = ooMonthlyPl.get(month) ?? 0;

  totalSimPnL += simPnL;
  totalOoPnL += ooPnL;

  const diff = simPnL - ooPnL;
  const pctDiff = Math.abs(ooPnL) > 1e-9 ? (diff / ooPnL) * 100 : 0;

  const diffStr = diff.toFixed(2);
  const pctStr = pctDiff.toFixed(2);

  // Highlight substantial diffs
  if (Math.abs(diff) > 5) {
    // maybe add color or marker?
  }

  console.log(
    `${month}: OO=${ooPnL.toFixed(2).padStart(10)}, Sim=${simPnL
      .toFixed(2)
      .padStart(10)}, Δ=${diffStr.padStart(8)} (${pctStr}%)`
  );
}

console.log("\nTotal OO PnL: ", totalOoPnL.toFixed(2));
console.log("Total Sim PnL:", totalSimPnL.toFixed(2));
console.log("Total Withdrawn:", result.totalWithdrawn.toFixed(2));
console.log("Final Equity:   ", result.finalEquity.toFixed(2));

// --- 5. Final Row Comparison (VS REF CSV) ---
const lastRowRef = rawRowsRef[rawRowsRef.length - 1].split(",");
// need headers from Ref
// We parsed 'headers' from rawRowsRef[0] earlier.

const fundsIdx = findHeader(headers, ["current funds", "currentfunds"]);
const withdrawnIdx = findHeader(headers, ["withdrawn", "total withdrawn"]);

if (fundsIdx >= 0 && withdrawnIdx >= 0) {
  const ooFunds = parseNumClean(lastRowRef[fundsIdx]);
  const ooWithdrawn = parseNumClean(lastRowRef[withdrawnIdx]);

  console.log(
    `\n=== Comparison with Option Omega Log (${
      refFilePath ? "REF" : "SELF"
    }) ===`
  );
  console.log(`OO Current Funds (Gross): ${ooFunds.toFixed(2)}`);
  console.log(`OO Total Withdrawn:       ${ooWithdrawn.toFixed(2)}`);

  const simGross = result.finalEquity + result.totalWithdrawn;
  const diff = simGross - ooFunds;
  const diffPct = (diff / ooFunds) * 100;

  console.log(`Sim Gross (Eq+W):         ${simGross.toFixed(2)}`);
  console.log(
    `Diff:                     ${diff.toFixed(2)} (${diffPct.toFixed(4)}%)`
  );
}
