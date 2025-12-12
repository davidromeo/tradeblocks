"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CalendarDayComparison } from "@/lib/analytics/calendar-comparison";
import { cn } from "@/lib/utils";
import {
  addDays,
  endOfMonth,
  format,
  getDay,
  getMonth,
  getYear,
  parseISO,
  startOfMonth,
} from "date-fns";
import { useMemo } from "react";

interface PLComparisonCalendarPanelProps {
  days: CalendarDayComparison[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Helper to determine color based on slippage P/L.
 * Positive slippage (Green) = Live > BT
 * Negative slippage (Red) = Live < BT
 */
function getSlippageColor(slippagePl: number | undefined) {
  if (!slippagePl || slippagePl === 0) return "bg-muted text-muted-foreground";
  // Opacity based on magnitude? For now just simple green/red
  if (slippagePl > 0)
    return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  return "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30";
}

function formatUsd(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(v);
}

export function PLComparisonCalendarPanel({
  days,
}: PLComparisonCalendarPanelProps) {
  // 1. Group by Year
  const groupedByYear = useMemo(() => {
    const map = new Map<number, CalendarDayComparison[]>();
    days.forEach((d) => {
      const year = getYear(parseISO(d.date));
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(d);
    });
    // Sort years descending
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [days]);

  if (days.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Select both a Backtest block and a Live block to compare.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {groupedByYear.map(([year, yearDays]) => (
        <YearComparisonBlock key={year} year={year} days={yearDays} />
      ))}
    </div>
  );
}

function YearComparisonBlock({
  year,
  days,
}: {
  year: number;
  days: CalendarDayComparison[];
}) {
  // Group by month
  const groupedByMonth = useMemo(() => {
    const map = new Map<number, CalendarDayComparison[]>();
    days.forEach((d) => {
      const month = getMonth(parseISO(d.date));
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(d);
    });
    // Fill all months 0-11 for structure, or just present ones?
    // Calendar usually shows all or range. Let's show all for now.
    const result = [];
    for (let i = 0; i < 12; i++) {
      // Only include months that have data or are relevant?
      // Showing all 12 is cleaner for layout.
      result.push({ monthIndex: i, days: map.get(i) || [] });
    }
    return result;
  }, [days]);

  const stats = useMemo(() => {
    let btTotal = 0;
    let liveTotal = 0;
    let slippageTotal = 0;
    days.forEach((d) => {
      btTotal += d.btDailyPl || 0;
      liveTotal += d.liveDailyPl || 0;
      slippageTotal += d.slippagePl || 0;
    });
    return { btTotal, liveTotal, slippageTotal };
  }, [days]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-2xl font-bold">{year} Comparison</CardTitle>
        <div className="flex gap-4 text-sm font-medium">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase">
              BT Total
            </span>
            <span>{formatUsd(stats.btTotal)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase">
              Live Total
            </span>
            <span>{formatUsd(stats.liveTotal)}</span>
          </div>
          <div className="flex flex-col items-end text-muted-foreground/50">
            <span className="text-xs">|</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase">
              Net Slippage
            </span>
            <span
              className={
                stats.slippageTotal >= 0 ? "text-emerald-500" : "text-rose-500"
              }
            >
              {formatUsd(stats.slippageTotal)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Responsive Grid: 1 col mobile, 2 col tablet, 3 or 4 col desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {groupedByMonth.map(({ monthIndex, days: monthDays }) =>
            monthDays.length > 0 || true ? ( // Show all months for grid alignment? Or filter empty?
              // Let's filter purely empty months if they are largely irrelevant,
              // but keeping layout static is nice. Let's show if year has data.
              <MonthComparisonGrid
                key={monthIndex}
                year={year}
                monthIndex={monthIndex}
                days={monthDays}
              />
            ) : null
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthComparisonGrid({
  year,
  monthIndex,
  days,
}: {
  year: number;
  monthIndex: number;
  days: CalendarDayComparison[];
}) {
  const dateMap = useMemo(() => {
    const m = new Map<string, CalendarDayComparison>();
    days.forEach((d) => m.set(d.date, d));
    return m;
  }, [days]);

  const start = startOfMonth(new Date(year, monthIndex));
  const end = endOfMonth(new Date(year, monthIndex));

  // Create grid cells
  const monthName = format(start, "MMMM");

  // Logic to build 7-col grid including placeholders
  const startDay = getDay(start); // 0-6 Sun-Sat
  const cells = [];

  // Empty Prefix
  for (let i = 0; i < startDay; i++) {
    cells.push(null);
  }

  // Real Days
  let current = start;
  while (current <= end) {
    cells.push(current);
    current = addDays(current, 1);
  }

  const monthStats = useMemo(() => {
    let slippage = 0;
    days.forEach((d) => (slippage += d.slippagePl || 0));
    return slippage;
  }, [days]);

  // Skip rendering totally empty months if desired? No, calendar structure usually implies showing empty spans.

  return (
    <div className="border rounded-lg p-3 bg-card/50">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-sm">{monthName}</span>
        <span
          className={cn(
            "text-xs font-mono",
            monthStats >= 0 ? "text-emerald-500" : "text-rose-500"
          )}
        >
          {monthStats !== 0 ? formatUsd(monthStats) : "-"}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-[10px] text-muted-foreground uppercase">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} className="aspect-square" />;

          const dateKey = format(d, "yyyy-MM-dd");
          const data = dateMap.get(dateKey);
          const slippage = data?.slippagePl;
          const hasData =
            data !== undefined &&
            (data.btDailyPl !== undefined || data.liveDailyPl !== undefined);

          if (!hasData) {
            return (
              <div
                key={dateKey}
                className="aspect-square rounded-md bg-muted/10 border border-transparent flex flex-col items-center justify-center"
              >
                <span className="text-[10px] text-muted-foreground/30">
                  {format(d, "d")}
                </span>
              </div>
            );
          }

          return (
            <div
              key={dateKey}
              className={cn(
                "group relative aspect-square rounded-md border text-[10px] flex flex-col items-center justify-center cursor-default transition-colors",
                getSlippageColor(slippage)
              )}
              title={`Date: ${dateKey}\nBT: ${formatUsd(
                data.btDailyPl ?? 0
              )}\nLive: ${formatUsd(
                data.liveDailyPl ?? 0
              )}\nSlippage: ${formatUsd(slippage ?? 0)}`}
            >
              <span className="font-medium">{format(d, "d")}</span>
              {/* Optional: Show slippage amt in tiny text? */}
            </div>
          );
        })}
      </div>
    </div>
  );
}
