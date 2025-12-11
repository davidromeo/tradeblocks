"use client";

import { endOfWeek, format, getMonth, getYear, startOfWeek } from "date-fns";
import { Table as TableIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trade } from "@/lib/models/trade";
import { cn } from "@/lib/utils";

import { DailyDetailModal, DaySummary } from "./DayDetailModal";
import { MonthlyPLCalendar } from "./MonthlyPLCalendar";
import { MonthStats } from "./YearlyPLTable";
import { YearHeatmap, YearlyCalendarSnapshot } from "./YearHeatmap";

interface PLCalendarPanelProps {
  trades: Trade[];
}

const formatCompactUsd = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000)
    return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000)
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

interface WeekSummary extends DaySummary {
  endDate: Date;
}

export function PLCalendarPanel({ trades }: PLCalendarPanelProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "year">("month");
  const [selectedDayStats, setSelectedDayStats] = useState<DaySummary | null>(
    null
  );
  const [modalMode, setModalMode] = useState<"day" | "week">("day");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Aggregate trades by day
  const dailyStats = useMemo(() => {
    const stats = new Map<string, DaySummary>();

    trades.forEach((trade) => {
      // Handle dateOpened which might be a Date object or string
      const date = trade.dateOpened instanceof Date 
        ? trade.dateOpened 
        : new Date(trade.dateOpened);
        
      const dateKey = format(date, "yyyy-MM-dd");

      if (!stats.has(dateKey)) {
        stats.set(dateKey, {
          date: date,
          netPL: 0,
          tradeCount: 0,
          winRate: 0,
          winCount: 0,
          maxMargin: 0,
          trades: [],
        });
      }

      const dayStat = stats.get(dateKey)!;
      dayStat.netPL += trade.pl;
      dayStat.tradeCount += 1;
      if (trade.pl > 0) dayStat.winCount += 1;
      dayStat.maxMargin = Math.max(dayStat.maxMargin, trade.marginReq || 0);
      
      // Map Trade to DailyTrade
      dayStat.trades.push({
        id: undefined, // Trade model doesn't have ID
        dateOpened: trade.dateOpened instanceof Date ? trade.dateOpened.toISOString() : trade.dateOpened,
        strategy: trade.strategy || "Custom",
        legs: trade.legs || "",
        premium: trade.premium || 0,
        margin: trade.marginReq || 0,
        pl: trade.pl
      });
    });
    
    // Calculate win rates
    stats.forEach((stat) => {
      const wins = stat.winCount;
      stat.winRate =
        stat.tradeCount > 0
          ? Math.round((wins / stat.tradeCount) * 100)
          : 0;
    });

    return stats;
  }, [trades]);

  // Aggregate trades by month for the current year
  const monthlyStats = useMemo(() => {
    const stats = new Map<number, MonthStats>();
    const year = getYear(currentDate);

    trades.forEach((trade) => {
      const date = trade.dateOpened instanceof Date 
        ? trade.dateOpened 
        : new Date(trade.dateOpened);
        
      if (getYear(date) !== year) return;

      const monthIndex = getMonth(date);

      if (!stats.has(monthIndex)) {
        stats.set(monthIndex, {
          monthIndex,
          netPL: 0,
          tradeCount: 0,
          winCount: 0,
          lossCount: 0,
          totalPremium: 0,
        });
      }

      const monthStat = stats.get(monthIndex)!;
      monthStat.netPL += trade.pl;
      monthStat.tradeCount += 1;
      if (trade.pl > 0) monthStat.winCount += 1;
      if (trade.pl < 0) monthStat.lossCount += 1;
      monthStat.totalPremium += trade.premium || 0;
    });

    return stats;
  }, [trades, currentDate]);

  // Aggregate trades by year/month for the heatmap
  const yearlySnapshot = useMemo<YearlyCalendarSnapshot>(() => {
    const yearMap = new Map<number, Map<number, { netPL: number; trades: number; wins: number }>>();

    trades.forEach((trade) => {
      const date = trade.dateOpened instanceof Date ? trade.dateOpened : new Date(trade.dateOpened);
      const y = getYear(date);
      const m = getMonth(date);

      if (!yearMap.has(y)) yearMap.set(y, new Map());
      const monthMap = yearMap.get(y)!;
      if (!monthMap.has(m)) monthMap.set(m, { netPL: 0, trades: 0, wins: 0 });
      const entry = monthMap.get(m)!;
      entry.netPL += trade.pl;
      entry.trades += 1;
      if (trade.pl > 0) entry.wins += 1;
    });

    const years = Array.from(yearMap.entries())
      .map(([year, monthsMap]) => {
        const months = Array.from(monthsMap.entries()).map(([month, vals]) => ({
          month,
          netPL: vals.netPL,
          trades: vals.trades,
          winRate: vals.trades > 0 ? Math.round((vals.wins / vals.trades) * 100) : 0,
        }));

        const total = months.reduce(
          (acc, m) => {
            acc.netPL += m.netPL;
            acc.trades += m.trades;
            acc.wins += Math.round((m.winRate / 100) * m.trades);
            return acc;
          },
          { netPL: 0, trades: 0, wins: 0 }
        );

        return {
          year,
          months,
          total: {
            netPL: total.netPL,
            trades: total.trades,
            winRate: total.trades > 0 ? Math.round((total.wins / total.trades) * 100) : 0,
          },
        };
      })
      .sort((a, b) => b.year - a.year);

    return { years };
  }, [trades]);

  // Calculate max margin for the current month to scale utilization bars
  const maxMarginForMonth = useMemo(() => {
    let max = 0;
    const currentMonthStr = format(currentDate, "yyyy-MM");
    
    dailyStats.forEach((stat, dateKey) => {
      if (dateKey.startsWith(currentMonthStr)) {
        max = Math.max(max, stat.maxMargin);
      }
    });
    
    return max;
  }, [dailyStats, currentDate]);

  // Calculate period stats (Month or Year)
  const periodStats = useMemo(() => {
    let netPL = 0;
    let tradeCount = 0;
    let winCount = 0;

    if (view === "month") {
      const currentMonthStr = format(currentDate, "yyyy-MM");
      dailyStats.forEach((stat, dateKey) => {
        if (dateKey.startsWith(currentMonthStr)) {
          netPL += stat.netPL;
          tradeCount += stat.tradeCount;
          winCount += stat.winCount;
        }
      });
    } else {
      monthlyStats.forEach((stat) => {
        netPL += stat.netPL;
        tradeCount += stat.tradeCount;
        winCount += stat.winCount;
      });
    }

    return {
      netPL,
      tradeCount,
      winRate: tradeCount > 0 ? Math.round((winCount / tradeCount) * 100) : 0,
    };
  }, [view, currentDate, dailyStats, monthlyStats]);

  const weeklyStats = useMemo(() => {
    const weeks = new Map<string, WeekSummary>();
    const currentMonthStr = format(currentDate, "yyyy-MM");

    dailyStats.forEach((stat, dateKey) => {
      if (!dateKey.startsWith(currentMonthStr)) return;

      const weekStart = startOfWeek(stat.date);
      const weekEnd = endOfWeek(stat.date);
      const weekKey = format(weekStart, "yyyy-MM-dd");

      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, {
          date: weekStart,
          endDate: weekEnd,
          netPL: 0,
          tradeCount: 0,
          winRate: 0,
          winCount: 0,
          maxMargin: 0,
          trades: [],
          dailyBreakdown: [],
        });
      }

      const weekStat = weeks.get(weekKey)!;
      weekStat.netPL += stat.netPL;
      weekStat.tradeCount += stat.tradeCount;
      weekStat.winCount += stat.winCount;
      weekStat.maxMargin = Math.max(weekStat.maxMargin, stat.maxMargin);
      weekStat.trades.push(...stat.trades);
      weekStat.dailyBreakdown?.push({
        date: stat.date,
        netPL: stat.netPL,
        tradeCount: stat.tradeCount,
        winRate:
          stat.tradeCount > 0
            ? Math.round((stat.winCount / stat.tradeCount) * 100)
            : 0,
        premium: stat.trades.reduce((sum, t) => sum + (t.premium || 0), 0),
        margin: stat.trades.reduce((sum, t) => sum + (t.margin || 0), 0),
      });
    });

    weeks.forEach((week) => {
      week.winRate =
        week.tradeCount > 0
          ? Math.round((week.winCount / week.tradeCount) * 100)
          : 0;
    });

    return Array.from(weeks.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, [dailyStats, currentDate]);

  const handleDayClick = (stats: DaySummary) => {
    setSelectedDayStats(stats);
    setModalMode("day");
    setIsModalOpen(true);
  };

  const handleWeekClick = (stats: WeekSummary) => {
    setSelectedDayStats(stats);
    setModalMode("week");
    setIsModalOpen(true);
  };

  const years = useMemo(() => {
    const yearsSet = new Set<number>();
    trades.forEach((t) => {
        const date = t.dateOpened instanceof Date 
        ? t.dateOpened 
        : new Date(t.dateOpened);
        yearsSet.add(getYear(date));
    });
    // Ensure current year is always available
    yearsSet.add(new Date().getFullYear());
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [trades]);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {view === "month" ? "Monthly" : "Yearly"} Net P/L
            </CardTitle>
            <span className="text-muted-foreground">$</span>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                periodStats.netPL >= 0 ? "text-emerald-500" : "text-rose-500"
              )}
            >
              {formatCompactUsd(periodStats.netPL)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            <TableIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodStats.tradeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <div className="text-muted-foreground">%</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodStats.winRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "month" | "year")}
            className="w-[200px]"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={getYear(currentDate).toString()}
            onValueChange={(val) => {
              const newDate = new Date(currentDate);
              newDate.setFullYear(parseInt(val));
              setCurrentDate(newDate);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-[500px]">
        {view === "month" ? (
          <div className="space-y-6">
            <MonthlyPLCalendar
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              dailyStats={dailyStats}
              onDayClick={handleDayClick}
              maxMarginForPeriod={maxMarginForMonth}
            />

            {weeklyStats.length > 0 && (
              <WeeklySummaryGrid
                weeks={weeklyStats}
                onWeekClick={handleWeekClick}
              />
            )}
          </div>
        ) : (
          <YearHeatmap
            data={yearlySnapshot}
            onMonthClick={(year, monthIndex) => {
              const newDate = new Date(currentDate);
              newDate.setFullYear(year);
              newDate.setMonth(monthIndex);
              setCurrentDate(newDate);
              setView("month");
            }}
          />
        )}
      </div>

      <DailyDetailModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        summary={selectedDayStats}
        mode={modalMode}
      />
    </div>
  );
}

function WeeklySummaryGrid({
  weeks,
  onWeekClick,
}: {
  weeks: WeekSummary[];
  onWeekClick: (week: WeekSummary) => void;
}) {
  const formatCompactUsd = (value: number) => {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Weekly summary</h3>
        <p className="text-xs text-muted-foreground">
          {weeks.length} week{weeks.length === 1 ? "" : "s"} in view
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {weeks.map((week) => {
          const rangeLabel = `${format(week.date, "MMM d")} – ${format(
            week.endDate ?? week.date,
            "MMM d"
          )}`;

          const tone =
            week.netPL > 0
              ? "from-emerald-500/20 to-emerald-500/5 border-emerald-900/40 text-emerald-100"
              : week.netPL < 0
              ? "from-rose-500/20 to-rose-500/5 border-rose-900/40 text-rose-100"
              : "from-zinc-700/10 to-zinc-800/10 border-zinc-700/40 text-zinc-200";

          return (
            <button
              key={week.date.toISOString()}
              onClick={() => onWeekClick(week)}
              className={cn(
                "min-w-[240px] flex-1 rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
                "bg-gradient-to-br",
                tone
              )}
              title={`P/L: ${formatCompactUsd(week.netPL)} • Trades: ${week.tradeCount} • Max Margin: ${formatCompactUsd(week.maxMargin)}`}
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                <span className="text-white/70">{rangeLabel}</span>
                <span className={week.netPL >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  {week.netPL >= 0 ? "+" : "-"}
                  {formatCompactUsd(Math.abs(week.netPL))}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-white/80">
                <div className="rounded-lg bg-black/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-white/50">Trades</div>
                  <div className="text-sm font-semibold">{week.tradeCount}</div>
                </div>
                <div className="rounded-lg bg-black/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-white/50">Win Rate</div>
                  <div className="text-sm font-semibold">{week.winRate}%</div>
                </div>
                <div className="rounded-lg bg-black/20 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-white/50">Max Margin</div>
                  <div className="text-sm font-semibold">
                    {formatCompactUsd(week.maxMargin)}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
