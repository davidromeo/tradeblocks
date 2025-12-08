"use client";

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { defaultPLCalendarSettings, PLCalendarSettings } from "@/lib/settings/pl-calendar-settings";

import { DaySummary } from "./DayDetailModal";

interface MonthlyPLCalendarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  dailyStats: Map<string, DaySummary>;
  onDayClick: (dayKey: string) => void;
  maxMarginForPeriod: number;
  drawdownThreshold?: number;
  weeklyMode: "trailing7" | "calendarWeek";
  heatmapMetric: "pl" | "rom" | "running";
  settings?: import("@/lib/settings/pl-calendar-settings").PLCalendarSettings;
}

export function MonthlyPLCalendar({
  currentDate,
  onDateChange,
  dailyStats,
  onDayClick,
  maxMarginForPeriod,
  drawdownThreshold = 10,
  weeklyMode,
  heatmapMetric,
  settings = defaultPLCalendarSettings,
}: MonthlyPLCalendarProps) {
  const safeSettings: PLCalendarSettings = {
    ...defaultPLCalendarSettings,
    ...settings,
  };

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

  const fmtShortUsd = (v: number) => {
    const sign = v < 0 ? "-" : "";
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  const getDailyPLClass = (metricValue: number, absMax: number) => {
    if (!safeSettings.showHeatmap) return metricValue >= 0 ? "text-emerald-400" : "text-rose-400";
    if (absMax <= 0) return "";
    const intensity = Math.min(1, Math.abs(metricValue) / absMax);
    if (metricValue >= 0) {
      if (intensity < 0.33) return "text-emerald-300";
      if (intensity < 0.66) return "text-emerald-400";
      return "text-emerald-500";
    }
    if (intensity < 0.33) return "text-rose-300";
    if (intensity < 0.66) return "text-rose-400";
    return "text-rose-500";
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  // Align calendar grid to Sunday start to match the visual header.
  // Monday-start calendar to align with trading week
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const dayEntries = calendarDays.map((day) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const isCurrentMonth = isSameMonth(day, monthStart);
    // Only attach stats for dates that are part of the visible month; padding days stay empty.
    const stats = isCurrentMonth ? dailyStats.get(dateKey) : undefined;
    const isDrawdown =
      stats && stats.drawdownPct !== undefined
        ? stats.drawdownPct <= -Math.abs(drawdownThreshold)
        : false;
    const utilization =
      stats && maxMarginForPeriod > 0
        ? (stats.maxMargin / maxMarginForPeriod) * 100
        : 0;

    return {
      day,
      dateKey,
      stats,
      isCurrentMonth,
      isDrawdown,
      utilization,
    };
  });

  const absMaxDailyMetric = Math.max(
    1,
    ...dayEntries.map((e) => {
      if (heatmapMetric === "rom") return Math.abs(e.stats?.romPct ?? 0);
      if (heatmapMetric === "running")
        return Math.abs(e.stats?.cumulativePL ?? e.stats?.netPL ?? 0);
      return Math.abs(e.stats?.netPL ?? 0);
    })
  );

  // chunk into weeks of 7
  const weeks: typeof dayEntries[] = [];
  for (let i = 0; i < dayEntries.length; i += 7) {
    weeks.push(dayEntries.slice(i, i + 7));
  }

  const weekPLs = weeks.map((week) =>
    week.reduce((sum, entry) => sum + (entry.stats?.netPL ?? 0), 0)
  );
  const weekROMs = weeks.map((week) =>
    week.reduce((sum, entry) => sum + (entry.stats?.romPct ?? 0), 0)
  );
  const medianWeekPL = (() => {
    const vals = [...weekPLs].filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
    if (vals.length === 0) return 0;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
  })();
  const medianWeekROM = (() => {
    const vals = [...weekROMs].filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
    if (vals.length === 0) return 0;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
  })();
  const maxWeekAbsPL =
    weekPLs.length > 0
      ? Math.max(1, ...weekPLs.map((v) => Math.abs(v)))
      : 1;
  const maxWeekAbsROM =
    weekROMs.length > 0
      ? Math.max(1, ...weekROMs.map((v) => Math.abs(v)))
      : 1;

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-2xl font-bold">
          {format(currentDate, "MMMM yyyy")}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-px bg-muted/20 text-center text-sm font-medium text-muted-foreground">
          {weekDays.map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="space-y-1 bg-muted/20 p-1">
          {weeks.map((week, idx) => {
            const filteredWeek = week.filter((entry) => {
              const dow = entry.day.getDay();
              return dow >= 1 && dow <= 5; // Mon-Fri only
            });
            const weekPL = weekPLs[idx];
            const weekROM = weekROMs[idx];
            const basisValue = heatmapMetric === "rom" ? weekROM : weekPL;
            const medianBasis = heatmapMetric === "rom" ? medianWeekROM : medianWeekPL;
            const maxWeekAbs = heatmapMetric === "rom" ? maxWeekAbsROM : maxWeekAbsPL;
            const regime =
              basisValue > 2 * medianBasis
                ? "strong"
                : basisValue < -1.5 * medianBasis
                ? "weak"
                : "normal";
            const weekBg =
              !safeSettings.showWeeklyBands
                ? "bg-muted/20"
                : regime === "strong"
                ? "bg-emerald-500/5"
                : regime === "weak"
                ? "bg-rose-500/5"
                : "bg-muted/40";

            const stratAgg: Record<string, { pl: number; trades: number }> = {};
            week.forEach((entry) => {
              if (!entry.stats) return;
              entry.stats.trades.forEach((t) => {
                const key = t.strategy || "Unknown";
                if (!stratAgg[key]) stratAgg[key] = { pl: 0, trades: 0 };
                stratAgg[key].pl += t.pl;
                stratAgg[key].trades += 1;
              });
            });
            const topStrategies = Object.entries(stratAgg)
              .sort((a, b) => Math.abs(b[1].pl) - Math.abs(a[1].pl))
              .slice(0, 3);

            const points = week
              .map((entry) => entry.stats?.cumulativePL)
              .filter((v): v is number => typeof v === "number");
            const minP = points.length ? Math.min(...points) : 0;
            const maxP = points.length ? Math.max(...points) : 1;
            const normPoints =
              points.length && maxP !== minP
                ? points.map((p) => (p - minP) / (maxP - minP))
                : points.map(() => 0.5);
            return (
              <div
                key={`week-${idx}`}
                className={cn("rounded-xl px-1 pt-1 pb-1.5 transition-colors", weekBg)}
              >
                <div className="grid grid-cols-5 gap-[1px]">
                  {filteredWeek.map((entry) => {
                    const { day, dateKey, stats, isCurrentMonth, utilization } = entry;
                    let metricValue: number;
                    let metricLabel: string;

                    if (heatmapMetric === "rom") {
                      metricValue = stats?.romPct ?? 0;
                      metricLabel =
                        stats?.romPct !== undefined ? `${stats.romPct.toFixed(1)}%` : "–";
                    } else if (heatmapMetric === "running") {
                      const running = stats?.cumulativePL ?? stats?.netPL ?? 0;
                      metricValue = running;
                      metricLabel = formatCompactUsd(running);
                    } else {
                      const pl = stats?.netPL ?? 0;
                      metricValue = pl;
                      metricLabel = formatCompactUsd(pl);
                    }
                    return (
                      <div
                        key={dateKey || day.toString()}
                        onClick={() => stats && onDayClick(dateKey)}
                        className={cn(
                          "relative flex min-h-[100px] flex-col justify-between bg-background p-2 transition-colors hover:bg-muted/50",
                          !isCurrentMonth && "bg-muted/5 text-muted-foreground",
                          stats && "cursor-pointer"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              !isCurrentMonth && "text-muted-foreground/50"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                          {stats && (
                            <span className="text-xs text-muted-foreground">
                              {stats.tradeCount}t
                            </span>
                          )}
                          {safeSettings.showStreaks && stats?.streak && Math.abs(stats.streak) >= 2 && (
                            <span
                              className={cn(
                                "text-[10px] font-semibold",
                                stats.streak > 0 ? "text-emerald-300" : "text-rose-300"
                              )}
                            >
                              {stats.streak > 0 ? `+${stats.streak}` : stats.streak}
                            </span>
                          )}
                        </div>

                        {stats && (
                          <div className="mt-2 flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "text-center text-sm font-bold",
                          getDailyPLClass(metricValue, absMaxDailyMetric)
                        )}
                      >
                        {metricLabel}
                      </div>
                              <span className="text-[11px] text-muted-foreground">
                                {weeklyMode === "trailing7" ? "7d" : "Wk"}{" "}
                                {formatCompactUsd(
                                  weeklyMode === "trailing7"
                                    ? stats.rollingWeeklyPL ?? 0
                                    : stats.calendarWeekPL ?? 0
                                )}
                              </span>
                            </div>

                            <div className="mt-auto w-full space-y-1">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className={cn(
                                    "h-full transition-all",
                                    utilization > 80 ? "bg-amber-500" : "bg-blue-500"
                                  )}
                                  style={{ width: `${Math.min(utilization, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="uppercase tracking-wide">Week {idx + 1}</span>
                  <span
                    className={cn(
                      "font-semibold",
                      weekPL > 0
                        ? "text-emerald-400"
                        : weekPL < 0
                        ? "text-rose-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {fmtShortUsd(weekPL)}
                  </span>
                  <div className="ml-2 flex-1 h-1 rounded-full bg-background/40">
                    <div
                      className={cn(
                        "h-1 rounded-full",
                        basisValue > 0
                          ? "bg-emerald-500"
                          : basisValue < 0
                          ? "bg-rose-500"
                          : "bg-muted-foreground/60"
                      )}
                      style={{
                        width:
                          maxWeekAbs > 0
                            ? `${Math.min(100, (Math.abs(basisValue) / maxWeekAbs) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
                  {safeSettings.showWeeklyStrategies && topStrategies.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      {topStrategies.map(([name, info]) => (
                        <span key={name}>
                          {name}{" "}
                          <span className={info.pl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {fmtShortUsd(info.pl)}
                          </span>{" "}
                          ({info.trades}t)
                        </span>
                      ))}
                    </div>
                  )}
                  {safeSettings.showWeeklySparkline && normPoints.length > 0 && (
                    <svg className="ml-auto h-4 w-24" viewBox="0 0 100 20" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        points={normPoints
                          .map((p, i) => `${(i / Math.max(1, normPoints.length - 1)) * 100},${(1 - p) * 20}`)
                          .join(" ")}
                        className="text-emerald-400"
                      />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
