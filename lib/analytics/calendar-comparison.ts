import { DailyPnLPoint } from "@/lib/analytics/pl-analytics";

export type CalendarDayComparison = {
  date: string; // "YYYY-MM-DD"

  // Backtest / Baseline
  btDailyPl?: number;
  btTrades?: number;

  // Live / Reporting
  liveDailyPl?: number;
  liveTrades?: number;

  // Differences
  slippagePl?: number; // live - bt (or 0 if missing)
  slippagePct?: number; // (live - bt) / abs(bt) * 100

  matchRate?: number; // For future phase: percentage of trades matched
};

/**
 * Merges two daily P/L series into a single comparison set.
 * Designed to work with the output of buildDailyPnL() or equivalent.
 */
export function buildCalendarDayComparisons(
  btDaily: DailyPnLPoint[],
  liveDaily: DailyPnLPoint[]
): CalendarDayComparison[] {
  const map = new Map<string, CalendarDayComparison>();

  // 1. Index BT data
  btDaily.forEach((d) => {
    map.set(d.date, {
      date: d.date,
      btDailyPl: d.pl,
      btTrades: 0, // Not available in DailyPnLPoint yet, requires raw trades if needed
    });
  });

  // 2. Merge Live data
  liveDaily.forEach((d) => {
    const existing = map.get(d.date);
    if (existing) {
      existing.liveDailyPl = d.pl;
    } else {
      map.set(d.date, {
        date: d.date,
        liveDailyPl: d.pl,
        btDailyPl: undefined,
      });
    }
  });

  // 3. Compute Slippage
  const results = Array.from(map.values()).map((item) => {
    const bt = item.btDailyPl ?? 0;
    const live = item.liveDailyPl ?? 0;

    // Only compute slippage if both exist or at least one exists and is non-zero?
    // User wants "Slippage P/L" = Live - BT.
    // If BT is missing (0) and Live is -500, Slippage is -500.
    const diff = live - bt;

    let pct = 0;
    if (Math.abs(bt) > 0) {
      pct = (diff / Math.abs(bt)) * 100;
    }

    return {
      ...item,
      slippagePl: diff,
      slippagePct: pct,
    };
  });

  // 4. Sort by Date
  return results.sort((a, b) => a.date.localeCompare(b.date));
}
