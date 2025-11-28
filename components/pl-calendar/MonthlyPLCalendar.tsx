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

import { DaySummary } from "./DayDetailModal";

interface MonthlyPLCalendarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  dailyStats: Map<string, DaySummary>;
  onDayClick: (stats: DaySummary) => void;
  maxMarginForPeriod: number;
}

export function MonthlyPLCalendar({
  currentDate,
  onDateChange,
  dailyStats,
  onDayClick,
  maxMarginForPeriod,
}: MonthlyPLCalendarProps) {
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

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
        <div className="grid grid-cols-7 gap-px bg-muted/20 text-center text-sm font-medium text-muted-foreground">
          {weekDays.map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-muted/20">
          {calendarDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const stats = dailyStats.get(dateKey);
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            // Calculate utilization percentage relative to the max margin seen in the period
            // If maxMarginForPeriod is 0, avoid division by zero
            const utilization =
              stats && maxMarginForPeriod > 0
                ? (stats.maxMargin / maxMarginForPeriod) * 100
                : 0;

            return (
              <div
                key={day.toString()}
                onClick={() => stats && onDayClick(stats)}
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
                </div>

                {stats && (
                  <div className="mt-2 flex flex-col gap-1">
                    <div
                      className={cn(
                        "text-center text-sm font-bold",
                        stats.netPL >= 0 ? "text-emerald-500" : "text-rose-500"
                      )}
                    >
                      {formatCompactUsd(stats.netPL)}
                    </div>
                    
                    {/* Utilization Bar */}
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
      </CardContent>
    </Card>
  );
}
