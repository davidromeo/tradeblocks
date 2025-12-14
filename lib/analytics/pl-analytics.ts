import { getTradingDayKey } from "@/lib/utils/trading-day";
import { getISOWeek, getISOWeekYear } from "date-fns";

export type LogType = "sized" | "oneLot";

export interface RawTrade {
  id: string;
  openedOn: Date;
  closedOn: Date;
  pl: number;
  strategy?: string;
  premium?: number;
  marginReq?: number;
  contracts?: number;
  fundsAtClose?: number;
  dayKey?: string; // e.g. "2023-05-15" (ET based) from DB
}

export interface DailyPnLPoint {
  date: string; // YYYY-MM-DD
  pl: number;
}

export interface EquityPoint {
  date: string; // YYYY-MM-DD
  equityBeforeWithdrawal: number;
  equityAfterWithdrawal: number;
  dayPL: number;
  withdrawal: number;
}

export interface AvgPLStats {
  avgWinningDay: number;
  avgLosingDay: number;
  avgWinningWeek: number;
  avgLosingWeek: number;
  avgWinningMonth: number;
  avgLosingMonth: number;
}

export type WithdrawalMode = "none" | "percent" | "fixed" | "resetToStart";

export interface WithdrawalConfig {
  startingBalance: number;
  mode: WithdrawalMode;
  percent?: number; // 0-100 when mode === "percent"
  fixedAmount?: number; // dollars when mode === "fixed"
  onlyIfProfitable: boolean;
}

export interface MonthlyPLRow {
  month: string; // YYYY-MM
  pl: number;
  withdrawal: number;
  startingEquity: number;
  endingEquity: number;
}

export interface WithdrawalSimulationResult {
  monthly: MonthlyPLRow[];
  finalEndingBalance: number;
  totalWithdrawn: number;
  avgWithdrawalPerMonth: number;
}

export interface CapitalPathResult {
  equityCurve: EquityPoint[];
  startingCapital: number;
  endingCapital: number;
  totalPL: number;
  maxDrawdownPct: number; // peak-to-trough percentage drawdown (negative or zero)
  cagrPct: number;
}

/**
 * Divide trade P/L and basis by contracts to get a 1-lot equivalent view.
 */
export function normalizeTradesToOneLot(trades: RawTrade[]): RawTrade[] {
  return trades.map((t) => {
    const contracts = t.contracts ?? 0;
    if (contracts <= 0) return { ...t };
    return {
      ...t,
      strategy: t.strategy,
      pl: t.pl / contracts,
      premium: t.premium !== undefined ? t.premium / contracts : undefined,
      marginReq:
        t.marginReq !== undefined ? t.marginReq / contracts : undefined,
      fundsAtClose: t.fundsAtClose,
    };
  });
}

/**
 * Bucket trades by closed date and sum daily P/L.
 */
export function buildDailyPnL(trades: RawTrade[]): DailyPnLPoint[] {
  const grouped = new Map<string, number>();
  const sorted = [...trades].sort(
    (a, b) => a.closedOn.getTime() - b.closedOn.getTime()
  );

  sorted.forEach((t) => {
    // If trade already has an ET-based dayKey (from Calendar logic), use it.
    // Otherwise fall back to deriving it from the closedOn date.
    // NOTE: Calendar uses Open Date for grouping; Simulator historically used Close Date.
    // To match Calendar exactly, we should ideally use the same key it uses.
    // For most users, p/l is realized on close, but "Calendar P/L" often implies daily attribution.
    // Since the USER explicitly requested matching the Calendar, we prefer the Calendar's key.
    const key =
      t.dayKey && t.dayKey !== "1970-01-01" ? t.dayKey : toDateKey(t.closedOn);

    grouped.set(key, (grouped.get(key) ?? 0) + (t.pl || 0));
  });

  return Array.from(grouped.entries())
    .map(([date, pl]) => ({ date, pl }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Average winning/losing day/week/month from a daily P/L series.
 */
export function computeAvgPLStats(daily: DailyPnLPoint[]): AvgPLStats {
  const avg = (values: number[]) =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const winningDays = daily.filter((d) => d.pl > 0).map((d) => d.pl);
  const losingDays = daily.filter((d) => d.pl < 0).map((d) => d.pl);

  const weeklyMap = new Map<string, number>();
  daily.forEach((d) => {
    const date = new Date(d.date);
    const key = `${getISOWeekYear(date)}-W${getISOWeek(date)}`;
    weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + d.pl);
  });
  const weekly = Array.from(weeklyMap.values());
  const winningWeeks = weekly.filter((v) => v > 0);
  const losingWeeks = weekly.filter((v) => v < 0);

  const monthlyMap = new Map<string, number>();
  daily.forEach((d) => {
    const key = d.date.slice(0, 7); // YYYY-MM
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + d.pl);
  });
  const monthlyVals = Array.from(monthlyMap.values());
  const winningMonths = monthlyVals.filter((v) => v > 0);
  const losingMonths = monthlyVals.filter((v) => v < 0);

  return {
    avgWinningDay: avg(winningDays),
    avgLosingDay: avg(losingDays),
    avgWinningWeek: avg(winningWeeks),
    avgLosingWeek: avg(losingWeeks),
    avgWinningMonth: avg(winningMonths),
    avgLosingMonth: avg(losingMonths),
  };
}

/**
 * Simulate daily equity and monthly withdrawals using raw dollar P/L from the log.
 */
export function computeEquityAndWithdrawals(
  trades: RawTrade[],
  options: {
    startingCapital: number;
    withdrawalMode: WithdrawalConfig["mode"];
    withdrawalPercent?: number;
    fixedWithdrawal?: number;
    withdrawProfitableMonthsOnly?: boolean;
    normalizeToOneLot?: boolean;
  }
): {
  daily: EquityPoint[];
  monthly: MonthlyPLRow[];
  startingCapital: number;
  endingCapital: number;
  totalPL: number;
  totalWithdrawn: number;
  maxDrawdownPct: number;
  cagrPct: number;
} {
  // Derive normalization factor based on max contracts magnitude.
  const maxContracts = Math.max(
    0,
    ...trades.map((t) => (t.contracts ? Math.abs(t.contracts) : 0))
  );
  const factor =
    options.normalizeToOneLot && maxContracts > 0 ? 1 / maxContracts : 1;

  const startingCapital = options.startingCapital * factor;

  // Aggregate daily P/L (already normalized if factor < 1).
  const dailyPL = buildDailyPnL(
    trades.map((t) => ({
      ...t,
      pl: t.pl * factor,
      premium: t.premium !== undefined ? t.premium * factor : t.premium,
      marginReq: t.marginReq !== undefined ? t.marginReq * factor : t.marginReq,
    }))
  );

  const days = [...dailyPL].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let equity = startingCapital;
  let peakEquity = startingCapital;
  let maxDrawdownPct = 0;
  let totalWithdrawn = 0;
  const daily: EquityPoint[] = [];

  // Build monthly buckets before withdrawals.
  const monthlyBuckets = new Map<
    string,
    { monthPL: number; dayIndices: number[]; startEquity?: number }
  >();

  days.forEach((d, idx) => {
    const key = d.date.slice(0, 7);
    if (!monthlyBuckets.has(key)) {
      monthlyBuckets.set(key, {
        monthPL: 0,
        dayIndices: [],
        startEquity: undefined,
      });
    }
    const bucket = monthlyBuckets.get(key)!;
    bucket.monthPL += d.pl;
    bucket.dayIndices.push(idx);
  });

  // Iterate days to build equityBefore/After and handle withdrawals at month end.
  days.forEach((day, idx) => {
    const dayMonth = day.date.slice(0, 7);
    const bucket = monthlyBuckets.get(dayMonth)!;
    if (bucket.startEquity === undefined) {
      bucket.startEquity = equity;
    }

    const equityBefore = equity;
    const equityAfterPL = equityBefore + day.pl;
    equity = equityAfterPL;

    peakEquity = Math.max(peakEquity, equity);
    if (peakEquity > 0) {
      const dd = (equity - peakEquity) / peakEquity;
      maxDrawdownPct = Math.min(maxDrawdownPct, dd);
    }

    const nextMonth =
      idx < days.length - 1 ? days[idx + 1].date.slice(0, 7) : dayMonth;
    const isLastDayOfMonth = dayMonth !== nextMonth || idx === days.length - 1;

    let withdrawal = 0;
    if (isLastDayOfMonth) {
      const monthPL = bucket.monthPL;
      const equityBeforeWithdrawal = equity;
      const mode = options.withdrawalMode;
      const profitOk = !options.withdrawProfitableMonthsOnly || monthPL > 0;

      switch (mode) {
        case "percent": {
          if (profitOk) {
            withdrawal = Math.max(
              0,
              Math.min(
                equityBeforeWithdrawal,
                monthPL * (options.withdrawalPercent ?? 0)
              )
            );
          }
          break;
        }
        case "fixed": {
          if (profitOk) {
            withdrawal = Math.max(
              0,
              Math.min(equityBeforeWithdrawal, options.fixedWithdrawal ?? 0)
            );
          }
          break;
        }
        case "resetToStart": {
          if (equityBeforeWithdrawal > startingCapital) {
            withdrawal = Math.min(
              equityBeforeWithdrawal - startingCapital,
              equityBeforeWithdrawal
            );
          }
          break;
        }
        case "none":
        default:
          withdrawal = 0;
      }

      equity = equityBeforeWithdrawal - withdrawal;
      totalWithdrawn += withdrawal;
    }

    daily.push({
      date: day.date,
      dayPL: day.pl,
      equityBeforeWithdrawal: equityAfterPL,
      equityAfterWithdrawal: equity,
      withdrawal,
    });
  });

  // Build monthly rows with withdrawals recorded on last day of month.
  const monthly: MonthlyPLRow[] = [];
  const monthKeys = Array.from(monthlyBuckets.keys()).sort();
  monthKeys.forEach((month) => {
    const bucket = monthlyBuckets.get(month)!;
    const daysInMonth = bucket.dayIndices.map((i) => daily[i]);
    const withdrawal = daysInMonth.reduce((s, d) => s + (d.withdrawal || 0), 0);
    const endingEquity =
      daysInMonth[daysInMonth.length - 1]?.equityAfterWithdrawal ?? 0;
    monthly.push({
      month,
      pl: bucket.monthPL,
      withdrawal,
      startingEquity: bucket.startEquity ?? startingCapital,
      endingEquity,
    });
  });

  const totalPL = daily.reduce((s, d) => s + d.dayPL, 0);
  const endingCapital =
    daily.length > 0
      ? daily[daily.length - 1].equityAfterWithdrawal
      : startingCapital;

  // Invariant check (debug only; keep silent if matches).
  const lhs = startingCapital + totalPL;
  const rhs = endingCapital + totalWithdrawn;
  if (Math.abs(lhs - rhs) > 1e-3) {
    console.warn("Equity/withdrawal invariant mismatch", { lhs, rhs });
  }

  const cagrPct = computeCAGR(
    startingCapital,
    endingCapital,
    days.length > 0 ? new Date(days[0].date) : null,
    days.length > 0 ? new Date(days[days.length - 1].date) : null
  );

  return {
    daily,
    monthly,
    startingCapital,
    endingCapital,
    totalPL,
    totalWithdrawn,
    maxDrawdownPct,
    cagrPct,
  };
}

function toDateKey(date: Date): string {
  return getTradingDayKey(date);
}

function computeCAGR(
  startBalance: number,
  endBalance: number,
  startDate: Date | null,
  endDate: Date | null
): number {
  if (!startDate || !endDate) return 0;
  const years = Math.max(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365),
    0.0001
  );
  if (startBalance <= 0) return 0;
  return Math.pow(endBalance / startBalance, 1 / years) - 1;
}
