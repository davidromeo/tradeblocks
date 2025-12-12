export type LogType = "sized" | "oneLot";

export interface TradeLogRow {
  id?: string;
  openedOn: string; // ISO or parseable date
  closedOn: string; // ISO or parseable date
  pl: number; // dollar P/L from the log
  premium?: number;
  marginReq?: number;
  contracts?: number;
}

export type WithdrawalMode =
  | "none"
  | "resetToStartingFunds"
  | "fixedAmount"
  | "percentOfMonthlyProfit";

export interface CapitalPathConfig {
  startingCapital: number;
  logType: LogType;
  withdrawalMode: WithdrawalMode;
  fixedWithdrawalAmount?: number;
  withdrawalProfitPercent?: number; // e.g. 0.3 for 30%
}

export interface DailyEquityPoint {
  date: string; // YYYY-MM-DD
  equity: number;
  withdrawals: number;
}

export interface CapitalPathResult {
  daily: DailyEquityPoint[];
  finalEquity: number;
  totalPL: number;
  totalWithdrawn: number;
  maxDrawdownPct: number; // negative or zero
}

/**
 * Simulate the equity path for a trade log with optional monthly withdrawals.
 * Sized mode trusts that trade.pl is already fully sized (do not rescale).
 * One-lot mode applies a simple 4% allocation heuristic for rough comparisons.
 */
export function simulateCapitalPath(
  trades: TradeLogRow[],
  config: CapitalPathConfig
): CapitalPathResult {
  const {
    startingCapital,
    logType,
    withdrawalMode,
    fixedWithdrawalAmount = 0,
    withdrawalProfitPercent = 0,
  } = config;

  if (trades.length === 0) {
    return {
      daily: [],
      finalEquity: startingCapital,
      totalPL: 0,
      totalWithdrawn: 0,
      maxDrawdownPct: 0,
    };
  }

  const sorted = [...trades].sort(
    (a, b) => new Date(a.closedOn).getTime() - new Date(b.closedOn).getTime()
  );

  // Group trades by closed date (YYYY-MM-DD).
  const grouped = new Map<string, TradeLogRow[]>();
  sorted.forEach((t) => {
    const key = toDateKey(t.closedOn);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  });

  const days = Array.from(grouped.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  let equity = startingCapital;
  let monthStartEquity = startingCapital;
  let peakEquity = startingCapital;
  let maxDrawdownPct = 0;
  let totalWithdrawn = 0;
  const daily: DailyEquityPoint[] = [];

  days.forEach((dayKey, idx) => {
    let dayPL = 0;
    const todaysTrades = grouped.get(dayKey)!;

    todaysTrades.forEach((t) => {
      if (logType === "sized") {
        dayPL += t.pl || 0;
      } else {
        const allocPct = 0.04;
        const basisPerLot = t.marginReq ?? t.premium ?? 1;
        const effectiveBasis = basisPerLot > 0 ? basisPerLot : 1;
        const lots = Math.max(0, Math.floor((equity * allocPct) / effectiveBasis));
        dayPL += (t.pl || 0) * lots;
      }
    });

    equity += dayPL;

    // Track drawdown after today's P/L.
    peakEquity = Math.max(peakEquity, equity);
    if (peakEquity > 0) {
      const dd = (equity - peakEquity) / peakEquity;
      maxDrawdownPct = Math.min(maxDrawdownPct, dd);
    }

    // Apply withdrawals on the last day of the month.
    const isLastDayOfMonth =
      idx === days.length - 1 ||
      monthKey(dayKey) !== monthKey(days[idx + 1]);

    let withdrawalToday = 0;
    if (isLastDayOfMonth) {
      const monthProfit = equity - monthStartEquity;
      switch (withdrawalMode) {
        case "resetToStartingFunds": {
          if (equity > startingCapital) {
            const desired = equity - startingCapital;
            const available = equity;
            withdrawalToday = Math.max(0, Math.min(desired, available));
          }
          break;
        }
        case "fixedAmount": {
          if (monthProfit > 0) {
            const desired = Math.max(0, fixedWithdrawalAmount);
            withdrawalToday = Math.min(desired, equity);
          }
          break;
        }
        case "percentOfMonthlyProfit": {
          if (monthProfit > 0 && withdrawalProfitPercent > 0) {
            const desired = monthProfit * withdrawalProfitPercent;
            withdrawalToday = Math.min(desired, equity);
          }
          break;
        }
        case "none":
        default:
          break;
      }

      equity -= withdrawalToday;
      totalWithdrawn += withdrawalToday;
      monthStartEquity = equity; // reset for the next month
    }

    daily.push({
      date: dayKey,
      equity,
      withdrawals: withdrawalToday,
    });
  });

  return {
    daily,
    finalEquity: equity,
    totalPL: equity - startingCapital,
    totalWithdrawn,
    maxDrawdownPct,
  };
}

function toDateKey(dateInput: string): string {
  const d = new Date(dateInput);
  return d.toISOString().slice(0, 10);
}

function monthKey(dateKey: string): string {
  const d = new Date(dateKey);
  return `${d.getFullYear()}-${d.getMonth()}`;
}
