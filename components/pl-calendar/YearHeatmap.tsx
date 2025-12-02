import React from "react";

import { cn } from "@/lib/utils";

interface MonthlySummary {
  month: number; // 0-based
  netPL: number;
  trades: number;
  winRate?: number;
  romPct?: number;
}

interface YearSummary {
  year: number;
  months: MonthlySummary[];
  total: {
    netPL: number;
    trades: number;
    winRate?: number;
    romPct?: number;
  };
}

export interface YearlyCalendarSnapshot {
  years: YearSummary[];
}

interface YearHeatmapProps {
  data: YearlyCalendarSnapshot;
  metric?: "pl" | "rom";
  onMonthClick?: (year: number, month: number) => void;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatCompactPL(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function getCellColorClass(value: number, metric: "pl" | "rom") {
  // Normalize value into buckets for color intensity.
  const abs = Math.abs(value);
  const thresholds = metric === "pl" ? [500, 2000, 5000] : [1, 5, 10];
  const isPositive = value >= 0;

  if (abs === 0) return "bg-zinc-900 text-zinc-400";
  if (isPositive) {
    if (abs >= thresholds[2]) return "bg-emerald-700/70 text-emerald-50";
    if (abs >= thresholds[1]) return "bg-emerald-700/50 text-emerald-100";
    return "bg-emerald-900/60 text-emerald-300";
  }
  // negative
  if (abs >= thresholds[2]) return "bg-rose-700/70 text-rose-50";
  if (abs >= thresholds[1]) return "bg-rose-700/50 text-rose-100";
  return "bg-rose-900/60 text-rose-300";
}

export function YearHeatmap({ data, onMonthClick, metric = "pl" }: YearHeatmapProps) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">
          Yearly P/L Overview
        </div>
        <div className="text-xs text-zinc-500">
          {data.years.length} years • {MONTH_LABELS.length} months
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-20 pb-3 text-left text-xs font-medium text-zinc-500">
                Year
              </th>
              {MONTH_LABELS.map((label) => (
                <th
                  key={label}
                  className="px-2 pb-3 text-center text-xs font-medium text-zinc-500"
                >
                  {label}
                </th>
              ))}
              <th className="px-2 pb-3 text-center text-xs font-medium text-zinc-500">
                Total
              </th>
            </tr>
          </thead>

          <tbody className="align-top">
            {data.years.map((yearRow) => (
              <tr key={yearRow.year} className="h-16">
                <td className="pr-3 text-left font-mono text-sm text-zinc-400">
                  {yearRow.year}
                </td>

                {MONTH_LABELS.map((_, monthIndex) => {
                  const monthSummary = yearRow.months.find(
                    (m) => m.month === monthIndex
                  );

                  if (!monthSummary) {
                    return (
                      <td key={monthIndex} className="px-2">
                        <div className="flex h-14 items-center justify-center rounded-xl bg-zinc-900 text-xs text-zinc-600">
                          --
                        </div>
                      </td>
                    );
                  }

                  const metricValue =
                    metric === "pl" ? monthSummary.netPL : monthSummary.romPct ?? 0;

                  const colorClass = getCellColorClass(metricValue, metric);

                  return (
                    <td key={monthIndex} className="px-2">
                  <button
                    type="button"
                    onClick={() =>
                      onMonthClick?.(yearRow.year, monthIndex)
                    }
                    className={cn(
                      "flex h-14 w-full flex-col items-center justify-center rounded-xl px-2 transition hover:ring-2 hover:ring-primary/40",
                      colorClass
                    )}
                    title={`${
                      metric === "pl"
                        ? `$${monthSummary.netPL.toLocaleString()}`
                        : `${(monthSummary.romPct ?? 0).toFixed(1)}% ROM`
                    } · ${monthSummary.trades} ${monthSummary.trades === 1 ? "trade" : "trades"}`}
                  >
                    <div className="font-mono text-xs">
                      {metric === "pl"
                        ? formatCompactPL(monthSummary.netPL)
                        : `${(monthSummary.romPct ?? 0).toFixed(1)}%`}
                    </div>
                    <div className="mt-0.5 text-[0.65rem] text-zinc-300/80">
                      {monthSummary.trades}{" "}
                      {monthSummary.trades === 1 ? "trade" : "trades"}
                    </div>
                  </button>
                </td>
              );
            })}

                <td className="px-2">
                  <div
                    className="flex h-14 flex-col items-center justify-center rounded-xl bg-zinc-900 px-2"
                    title={`${
                      metric === "pl"
                        ? `$${yearRow.total.netPL.toLocaleString()}`
                        : `${(yearRow.total.romPct ?? 0).toFixed(1)}% ROM`
                    } · ${yearRow.total.trades} trades`}
                  >
                    <div className="font-mono text-xs text-zinc-100">
                      {metric === "pl"
                        ? formatCompactPL(yearRow.total.netPL)
                        : `${(yearRow.total.romPct ?? 0).toFixed(1)}%`}
                    </div>
                    <div className="mt-0.5 text-[0.65rem] text-zinc-400">
                      {yearRow.total.trades} trades
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[0.65rem] text-zinc-500">
        <span>Legend:</span>
        {metric === "pl" ? (
          <>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-emerald-700/70" /> Large Profit
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-emerald-900/60" /> Small Profit
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-rose-900/60" /> Small Loss
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-rose-700/70" /> Large Loss
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-emerald-700/70" /> High ROM
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-emerald-900/60" /> Positive ROM
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-rose-900/60" /> Low / Negative ROM
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-rose-700/70" /> Strongly Negative ROM
            </span>
          </>
        )}
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm bg-zinc-900" /> No Trades
        </span>
      </div>
    </section>
  );
}
