import { getMonthlyPnL } from "./profit-aggregation";
import { Trade } from "@/lib/models/trade";

export interface WithdrawalRow {
  month: string;
  monthPL: number;
  withdrawal: number;
  endingBalance: number;
}

export interface WithdrawalResult {
  rows: WithdrawalRow[];
  finalBalance: number;
  totalWithdrawals: number;
}

interface Options {
  startingBalance?: number;
  withdrawalPct?: number; // 0-1
  withdrawOnlyIfProfitable?: boolean;
  withdrawalMode?: "percent" | "fixed" | "reset";
  fixedAmount?: number;
}

export function simulateWithdrawals(
  trades: Trade[],
  opts: Options = {}
): WithdrawalResult {
  const sortedTrades = [...trades].sort((a, b) => {
    const da = (a.dateClosed as Date) || (a.dateOpened as Date);
    const db = (b.dateClosed as Date) || (b.dateOpened as Date);
    return new Date(da).getTime() - new Date(db).getTime();
  });

  const inferredStarting =
    opts.startingBalance ??
    (sortedTrades.length > 0
      ? sortedTrades[0].fundsAtClose ?? 100_000
      : 100_000);

  const startingBalance = inferredStarting;
  const pct = opts.withdrawalPct ?? 0.3;
  const withdrawOnlyIfProfitable = opts.withdrawOnlyIfProfitable ?? true;
  const withdrawalMode = opts.withdrawalMode ?? "percent";
  const fixedAmount = opts.fixedAmount ?? 0;

  const monthly = getMonthlyPnL(trades);

  // ensure chronological
  monthly.sort((a, b) => (a.period < b.period ? -1 : 1));

  const rows: WithdrawalRow[] = [];
  let balance = startingBalance;
  let totalWithdrawals = 0;

  monthly.forEach((m) => {
    const monthPL = m.totalPL;
    const canWithdraw = !withdrawOnlyIfProfitable || monthPL > 0;
    let withdrawal = 0;
    if (canWithdraw) {
      if (withdrawalMode === "reset") {
        const postPLBalance = balance + monthPL;
        withdrawal = postPLBalance > startingBalance ? postPLBalance - startingBalance : 0;
      } else if (withdrawalMode === "fixed") {
        withdrawal = Math.max(0, fixedAmount);
      } else {
        withdrawal = monthPL * pct;
      }
    }
    balance = balance + monthPL - withdrawal;
    totalWithdrawals += withdrawal;

    rows.push({
      month: m.period,
      monthPL,
      withdrawal,
      endingBalance: balance,
    });
  });

  return { rows, finalBalance: balance, totalWithdrawals };
}
