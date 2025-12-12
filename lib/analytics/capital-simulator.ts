import { Trade } from "@/lib/models/trade";

export type BasisMode = "premium" | "margin";
export type WithdrawalMode = "none" | "percent" | "fixed" | "reset";

export interface CapitalSimOptions {
  startingCapital: number;
  allocationPct: number; // 0-1
  basis: BasisMode;
  withdrawalMode?: WithdrawalMode;
  withdrawalPct?: number; // 0-1 when mode is percent
  fixedAmount?: number; // when mode is fixed
  withdrawOnlyIfProfitable?: boolean;
  normalizeToOneLot?: boolean;
}

export interface CapitalSimPoint {
  date: Date;
  equity: number;
}

export interface CapitalSimResult {
  equityCurve: CapitalSimPoint[];
  endingCapital: number;
  totalWithdrawals: number;
  portfolioPL: number;
  maxDrawdownPct: number;
  cagrPct: number;
}

export function simulateEquityCurve(
  trades: Trade[],
  opts: CapitalSimOptions
): CapitalSimResult {
  const {
    startingCapital,
    allocationPct,
    basis,
    withdrawalMode = "none",
    withdrawalPct = 0,
    fixedAmount = 0,
    withdrawOnlyIfProfitable = true,
    normalizeToOneLot = false,
  } = opts;

  const sorted = [...trades].sort((a, b) => {
    const da = (a.dateClosed as Date) || (a.dateOpened as Date);
    const db = (b.dateClosed as Date) || (b.dateOpened as Date);
    return new Date(da).getTime() - new Date(db).getTime();
  });

  let equity = startingCapital;
  let peakEquity = startingCapital;
  let maxDrawdownPct = 0;
  let totalWithdrawals = 0;
  const equityCurve: CapitalSimPoint[] = [];

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  let currentMonth = sorted.length > 0 ? monthKey(new Date(sorted[0].dateOpened)) : "";
  let monthStartEquity = startingCapital;

  const applyWithdrawal = (monthProfit: number) => {
    if (withdrawalMode === "none") return;
    const profitable = monthProfit > 0;
    if (withdrawOnlyIfProfitable && !profitable) return;

    let withdrawal = 0;
    if (withdrawalMode === "percent") {
      withdrawal = monthProfit * withdrawalPct;
    } else if (withdrawalMode === "fixed") {
      withdrawal = Math.min(Math.max(0, fixedAmount), monthProfit, equity);
    } else if (withdrawalMode === "reset") {
      withdrawal = equity > startingCapital ? equity - startingCapital : 0;
    }

    equity -= withdrawal;
    totalWithdrawals += withdrawal;
  };

  sorted.forEach((trade) => {
    const d = (trade.dateClosed as Date) || (trade.dateOpened as Date);
    const month = monthKey(d);
    if (currentMonth !== month && currentMonth !== "") {
      const monthProfit = equity - monthStartEquity;
      applyWithdrawal(monthProfit);
      monthStartEquity = equity;
    }
    currentMonth = month;

    const contracts = normalizeToOneLot ? Math.max(1, trade.numContracts || 1) : 1;
    const basisValue =
      basis === "margin"
        ? (trade.marginReq || 0) / contracts
        : (trade.premium || 0) / contracts;

    if (basisValue <= 0) return;

    // Normalize P/L to a single contract when requested to keep risk sizing consistent.
    const tradePLPerContract = (trade.pl || 0) / contracts;
    const tradeReturnPct = (tradePLPerContract / basisValue) * 100;
    const positionSize = equity * allocationPct;
    const deltaEquity = positionSize * (tradeReturnPct / 100);
    equity += deltaEquity;
    equityCurve.push({ date: d, equity });

    peakEquity = Math.max(peakEquity, equity);
    const dd = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    maxDrawdownPct = Math.max(maxDrawdownPct, dd);
  });

  // Final month withdrawal
  const finalMonthProfit = equity - monthStartEquity;
  applyWithdrawal(finalMonthProfit);

  const endingCapital = equity;
  const portfolioPL = endingCapital + totalWithdrawals - startingCapital;

  const cagrPct = computeCAGR(
    startingCapital,
    endingCapital,
    sorted.length > 0 ? new Date(sorted[0].dateOpened) : null,
    sorted.length > 0
      ? new Date(sorted[sorted.length - 1].dateClosed || sorted[sorted.length - 1].dateOpened)
      : null
  );

  return {
    equityCurve,
    endingCapital,
    totalWithdrawals,
    portfolioPL,
    maxDrawdownPct,
    cagrPct,
  };
}

function computeCAGR(
  startBalance: number,
  endBalance: number,
  startDate: Date | null,
  endDate: Date | null
) {
  if (!startDate || !endDate) return 0;
  const years = Math.max(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365),
    0.0001
  );
  if (startBalance <= 0) return 0;
  return (Math.pow(endBalance / startBalance, 1 / years) - 1) * 100;
}
