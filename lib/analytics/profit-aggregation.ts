import { format, startOfWeek } from "date-fns";

import { Trade } from "@/lib/models/trade";

export interface PeriodPnL {
  period: string;
  totalPL: number;
  isWinning: boolean;
  isLosing: boolean;
  numTrades: number;
}

const keyDay = (d: Date) => format(d, "yyyy-MM-dd");
const keyMonth = (d: Date) => format(d, "yyyy-MM");
const keyWeek = (d: Date) => format(startOfWeek(d), "yyyy-MM-dd");

function aggregate(
  trades: Trade[],
  keyFn: (d: Date) => string
): PeriodPnL[] {
  const map = new Map<string, { pl: number; count: number }>();

  trades.forEach((t) => {
    const d =
      t.dateOpened instanceof Date ? t.dateOpened : new Date(t.dateOpened);
    const key = keyFn(d);
    if (!map.has(key)) map.set(key, { pl: 0, count: 0 });
    const entry = map.get(key)!;
    entry.pl += t.pl || 0;
    entry.count += 1;
  });

  return Array.from(map.entries())
    .map(([period, { pl, count }]) => ({
      period,
      totalPL: pl,
      isWinning: pl > 0,
      isLosing: pl < 0,
      numTrades: count,
    }))
    .sort((a, b) => (a.period < b.period ? -1 : 1));
}

export function getDailyPnL(trades: Trade[]): PeriodPnL[] {
  return aggregate(trades, keyDay);
}

export function getWeeklyPnL(trades: Trade[]): PeriodPnL[] {
  return aggregate(trades, keyWeek);
}

export function getMonthlyPnL(trades: Trade[]): PeriodPnL[] {
  return aggregate(trades, keyMonth);
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeAvgWinLoss(pnls: PeriodPnL[]) {
  const wins = pnls.filter((p) => p.isWinning).map((p) => p.totalPL);
  const losses = pnls.filter((p) => p.isLosing).map((p) => p.totalPL);
  return {
    avgWin: avg(wins),
    avgLoss: avg(losses),
  };
}
