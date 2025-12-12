export interface WithdrawalOverlayTrade {
  id?: string | number;
  closedOn: string | Date;
  pl: number; // already sized P/L from OO
}

export interface EquityPoint {
  index: number;
  date: Date;
  cumulativePL: number;
  tradingEquity: number; // startingCapital + cumulativePL
  totalWithdrawn: number; // cumulative withdrawals up to this point
  netEquity: number; // tradingEquity - totalWithdrawn
}

export interface MonthlyWithdrawalSummary {
  year: number;
  month: number; // 0-11
  monthKey: string; // "YYYY-MM"
  monthPL: number;
  wasProfitable: boolean;
  withdrawal: number;
  cumulativeWithdrawals: number;
}

export interface WithdrawalOverlayConfig {
  startingCapital: number;
  withdrawalPercentOfProfitableMonth: number; // e.g. 30 means 30% of that month's profit
}

export interface WithdrawalOverlayResult {
  startingCapital: number;
  withdrawalPercent: number;
  totalPL: number;
  endingTradingEquity: number;
  totalWithdrawn: number;
  endingNetEquity: number;
  monthly: MonthlyWithdrawalSummary[];
  equitySeries: EquityPoint[];
}

function sortTradesByClosedDate(
  trades: WithdrawalOverlayTrade[]
): WithdrawalOverlayTrade[] {
  return [...trades].sort((a, b) => {
    const da = new Date(a.closedOn).getTime();
    const db = new Date(b.closedOn).getTime();
    return da - db;
  });
}

export function computeCagr(
  startingCapital: number,
  endingCapital: number,
  years: number
): number {
  if (startingCapital <= 0 || years <= 0) return 0;
  return (Math.pow(endingCapital / startingCapital, 1 / years) - 1) * 100;
}

/**
 * Core withdrawal overlay:
 * - Keeps trade P/L unchanged.
 * - Builds equity from P/L, then applies withdrawals at month end on profitable months.
 */
export function simulateWithdrawalOverlay(
  trades: WithdrawalOverlayTrade[],
  config: WithdrawalOverlayConfig
): WithdrawalOverlayResult {
  const { startingCapital, withdrawalPercentOfProfitableMonth } = config;

  if (!trades.length) {
    return {
      startingCapital,
      withdrawalPercent: withdrawalPercentOfProfitableMonth,
      totalPL: 0,
      endingTradingEquity: startingCapital,
      totalWithdrawn: 0,
      endingNetEquity: startingCapital,
      monthly: [],
      equitySeries: [],
    };
  }

  const sorted = sortTradesByClosedDate(trades);

  let cumulativePL = 0;
  const equitySeries: EquityPoint[] = [];
  const monthlyPLMap = new Map<string, { year: number; month: number; pl: number }>();

  sorted.forEach((t, idx) => {
    const d = new Date(t.closedOn);
    cumulativePL += t.pl;
    const tradingEquity = startingCapital + cumulativePL;

    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthlyPLMap.get(monthKey) ?? {
      year: d.getFullYear(),
      month: d.getMonth(),
      pl: 0,
    };
    existing.pl += t.pl;
    monthlyPLMap.set(monthKey, existing);

    equitySeries.push({
      index: idx,
      date: d,
      cumulativePL,
      tradingEquity,
      totalWithdrawn: 0, // withdrawals applied later in seriesWithNet
      netEquity: tradingEquity,
    });
  });

  const totalPL = cumulativePL;
  const endingTradingEquity = startingCapital + totalPL;

  const monthKeysSorted = Array.from(monthlyPLMap.keys()).sort();
  let cumulativeWithdrawals = 0;
  const monthly: MonthlyWithdrawalSummary[] = [];

  for (const mk of monthKeysSorted) {
    const m = monthlyPLMap.get(mk)!;
    const monthPL = m.pl;
    const wasProfitable = monthPL > 0;
    let withdrawal = 0;
    if (wasProfitable && withdrawalPercentOfProfitableMonth > 0) {
      withdrawal = (monthPL * withdrawalPercentOfProfitableMonth) / 100;
    }
    cumulativeWithdrawals += withdrawal;
    monthly.push({
      year: m.year,
      month: m.month,
      monthKey: mk,
      monthPL,
      wasProfitable,
      withdrawal,
      cumulativeWithdrawals,
    });
  }

  const totalWithdrawn = cumulativeWithdrawals;
  const endingNetEquity = endingTradingEquity - totalWithdrawn;

  // Update equity series with cumulative withdrawals up to each month.
  const withdrawalByMonthKey = new Map<string, number>();
  monthly.forEach((m) => {
    const mk = `${m.year}-${String(m.month + 1).padStart(2, "0")}`;
    withdrawalByMonthKey.set(mk, m.cumulativeWithdrawals);
  });

  const seriesWithNet: EquityPoint[] = equitySeries.map((p) => {
    const mk = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, "0")}`;
    let withdrawalsUpToHere = 0;
    for (const [key, cumW] of withdrawalByMonthKey.entries()) {
      if (key <= mk) {
        withdrawalsUpToHere = Math.max(withdrawalsUpToHere, cumW);
      }
    }
    return {
      ...p,
      totalWithdrawn: withdrawalsUpToHere,
      netEquity: p.tradingEquity - withdrawalsUpToHere,
    };
  });

  return {
    startingCapital,
    withdrawalPercent: withdrawalPercentOfProfitableMonth,
    totalPL,
    endingTradingEquity,
    totalWithdrawn,
    endingNetEquity,
    monthly,
    equitySeries: seriesWithNet,
  };
}
