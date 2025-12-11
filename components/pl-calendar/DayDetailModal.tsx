"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface DailyTrade {
  id?: string | number;
  dateOpened?: string;
  strategy: string;
  legs: string;
  premium: number; // total premium per trade
  margin: number;  // max margin used
  pl: number;
}

export interface DaySummary {
  date: Date;
  endDate?: Date;
  netPL: number;
  tradeCount: number;
  winRate: number;
  winCount: number;
  maxMargin: number;
  // Optional breakout by day (used when showing a week)
  dailyBreakdown?: {
    date: Date;
    netPL: number;
    tradeCount: number;
    winRate: number;
    premium?: number;
    margin?: number;
  }[];
  trades: DailyTrade[];
}

export interface DailyDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: DaySummary | null;
  mode?: "day" | "week";
}

const fmtUsd = (v: number) =>
  `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function exportCsv(trades: DailyTrade[], mode: "day" | "week", label: string) {
  const headers = ["Time", "Strategy", "Legs", "Premium", "Margin", "P/L"];
  const rows = trades.map((t) => {
    const time =
      t.dateOpened != null
        ? format(
            new Date(t.dateOpened),
            mode === "week" ? "MMM d HH:mm" : "HH:mm:ss"
          )
        : "";
    return [
      `"${time}"`,
      `"${(t.strategy || "").replace(/"/g, '""')}"`,
      `"${(t.legs || "").replace(/"/g, '""')}"`,
      t.premium.toString(),
      t.margin.toString(),
      t.pl.toString(),
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${label.replace(/\s+/g, "_")}_trades.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const fmtCompactUsd = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString()}`;
};

export function DailyDetailModal({
  open,
  onOpenChange,
  summary,
  mode = "day",
}: DailyDetailModalProps) {
  const [filter, setFilter] = useState<"all" | "wins" | "losses">("all");
  const [sort, setSort] = useState<"pl_desc" | "pl_asc" | "time_desc" | "time_asc">(
    "time_asc"
  );

  const filteredTrades = useMemo(() => {
    if (!summary) return [];
    let list = [...summary.trades];
    if (filter === "wins") list = list.filter((t) => t.pl > 0);
    if (filter === "losses") list = list.filter((t) => t.pl < 0);

    list.sort((a, b) => {
      if (sort === "pl_desc") return b.pl - a.pl;
      if (sort === "pl_asc") return a.pl - b.pl;

      const aTime = a.dateOpened ? new Date(a.dateOpened).getTime() : 0;
      const bTime = b.dateOpened ? new Date(b.dateOpened).getTime() : 0;
      return sort === "time_desc" ? bTime - aTime : aTime - bTime;
    });
    return list;
  }, [summary, filter, sort]);

  if (!summary) return null;

  const { date, endDate, netPL, tradeCount, winRate, maxMargin, trades } = summary;

  // Keep large currency values compact in the UI while retaining precision for tooltips/exports.
  const totalPremium = trades.reduce((sum, t) => sum + (t.premium || 0), 0);
  const totalMargin = trades.reduce((sum, t) => sum + (t.margin || 0), 0);

  const sortedBreakdown =
    mode === "week" && summary.dailyBreakdown
      ? [...summary.dailyBreakdown].sort(
          (a, b) => a.date.getTime() - b.date.getTime()
        )
      : [];

  const subtitle =
    mode === "week" ? "Weekly Performance Review" : "Daily Performance Review";
  const formattedDate =
    mode === "week" && endDate
      ? `${format(date, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`
      : format(date, "MMMM d, yyyy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] border border-neutral-800 bg-[#050506] text-sm p-0 overflow-hidden">
        <div className="max-h-[88vh] overflow-y-auto">
        {/* HEADER */}
        <header className="px-6 pt-6 pb-4 border-b border-neutral-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-3xl font-semibold tracking-tight text-white">
                {formattedDate}
              </DialogTitle>
              <p className="mt-1 text-xs font-mono uppercase tracking-wide text-neutral-400">
                {subtitle}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-neutral-300">
                <span className="text-neutral-500">Net P/L</span>
                <span
                  className={cn(
                    "font-semibold",
                    netPL >= 0 ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {fmtUsd(netPL)}
                </span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-neutral-300">
                <span className="text-neutral-500">Premium</span>
                <span>{fmtCompactUsd(totalPremium)}</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-neutral-300">
                <span className="text-neutral-500">Margin</span>
                <span>{fmtCompactUsd(totalMargin)}</span>
              </span>
            </div>
          </div>
        </header>

        {/* METRIC TILES */}
        <section className="grid grid-cols-1 gap-3 px-6 pt-4 pb-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Net P/L"
            value={fmtCompactUsd(netPL)}
            sublabel="Realized P/L"
            tone={netPL >= 0 ? "positive" : "negative"}
          />
          <MetricTile
            label="Total Trades"
            value={tradeCount.toString()}
            sublabel={`${tradeCount} executed`}
          />
          <MetricTile
            label="Win Rate"
            value={`${winRate.toFixed(0)}%`}
            sublabel={mode === "week" ? "Weekly win rate" : "Daily win rate"}
            tone="accent"
          />
          <MetricTile
            label="Max Margin"
            value={fmtCompactUsd(maxMargin)}
            sublabel="Peak exposure"
          />
        </section>

        {/* DAILY BREAKDOWN (week mode) */}
        {mode === "week" && sortedBreakdown.length > 0 && (
          <section className="px-6 pb-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Daily breakdown
              </h4>
              <span className="text-[11px] text-neutral-500">
                {sortedBreakdown.length} day{sortedBreakdown.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sortedBreakdown.map((d) => (
                <div
                  key={d.date.toISOString()}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2"
                >
                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span>{format(d.date, "EEE, MMM d")}</span>
                    <span
                      className={cn(
                        "font-semibold",
                        d.netPL >= 0 ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {fmtCompactUsd(d.netPL)}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 text-[11px] text-neutral-400">
                    <div>
                      <div className="uppercase tracking-wide text-[10px]">Trades</div>
                      <div className="text-neutral-200 font-semibold">{d.tradeCount}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-[10px]">Win %</div>
                      <div className="text-neutral-200 font-semibold">{d.winRate}%</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-[10px]">Avg P/L</div>
                      <div className="text-neutral-200 font-semibold">
                        {d.tradeCount > 0
                          ? fmtCompactUsd(d.netPL / d.tradeCount)
                          : "--"}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-[10px]">Premium</div>
                      <div className="text-neutral-200 font-semibold">
                        {fmtCompactUsd(d.premium || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide text-[10px]">Margin</div>
                      <div className="text-neutral-200 font-semibold">
                        {fmtCompactUsd(d.margin || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TABLE */}
        <section className="px-6 pb-5 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold">
                Trade Log ({filteredTrades.length}/{trades.length} entries)
              </h3>
              <span className="text-[11px] text-neutral-500">
                Detailed fills & legs
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-md border border-neutral-800 bg-neutral-900/80 p-1 text-xs">
                {(["all", "wins", "losses"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      "px-2 py-1 rounded-sm transition",
                      filter === key
                        ? "bg-neutral-800 text-white"
                        : "text-neutral-400 hover:text-white"
                    )}
                  >
                    {key === "all" ? "All" : key === "wins" ? "Wins" : "Losses"}
                  </button>
                ))}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    Sort:{" "}
                    {sort === "time_asc"
                      ? "Time ↑"
                      : sort === "time_desc"
                      ? "Time ↓"
                      : sort === "pl_desc"
                      ? "P/L ↓"
                      : "P/L ↑"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSort("time_asc")}>
                    Time ↑
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort("time_desc")}>
                    Time ↓
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort("pl_desc")}>
                    P/L ↓
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort("pl_asc")}>
                    P/L ↑
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => exportCsv(filteredTrades, mode, formattedDate)}
              >
                Export CSV
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-[#050608] overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-neutral-900/90 border-neutral-800 backdrop-blur">
                  <TableHead className="w-[160px] text-[11px] font-semibold uppercase tracking-wide text-neutral-300">
                    {mode === "week" ? "Date / Time" : "Time"}
                  </TableHead>
                  <TableHead className="w-[190px] text-[11px] font-semibold uppercase tracking-wide text-neutral-300">
                    Strategy
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-neutral-300">
                    Legs
                  </TableHead>
                  <TableHead className="w-[130px] text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-300">
                    Premium
                  </TableHead>
                  <TableHead className="w-[120px] text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-300">
                    Margin
                  </TableHead>
                  <TableHead className="w-[110px] text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-300">
                    P/L
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrades.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-6 text-center text-neutral-500"
                    >
                      No trades recorded for this day.
                    </TableCell>
                  </TableRow>
                )}

                {filteredTrades.map((t, idx) => {
                  const time =
                    t.dateOpened != null
                      ? format(
                          new Date(t.dateOpened),
                          mode === "week" ? "MMM d · HH:mm" : "HH:mm:ss"
                        )
                      : mode === "week"
                      ? "-- · --:--"
                      : "--:--:--";

                  return (
                    <TableRow
                      key={t.id ?? idx}
                      className="border-neutral-800 hover:bg-neutral-900/60"
                    >
                      {/*
                        Derive a short strategy label: prefer explicit strategy, otherwise use first leg segment.
                      */}
                      {(() => {
                        const strategyLabel =
                          t.strategy && t.strategy.trim().length > 0
                            ? t.strategy
                            : t.legs.split("|")[0]?.trim() || "Custom";

                        return (
                          <>
                      <TableCell className="font-mono text-xs text-neutral-400 whitespace-nowrap">
                        {time}
                      </TableCell>

                      {/* Strategy */}
                      <TableCell className="text-xs">
                        <span className="inline-flex items-center rounded-full bg-neutral-900 px-2 py-[2px] text-[11px] font-medium text-neutral-200">
                          {strategyLabel}
                        </span>
                      </TableCell>

                      {/* Legs */}
                      <TableCell
                        className="text-xs text-neutral-300 max-w-[360px] truncate"
                        title={t.legs}
                      >
                        {t.legs}
                      </TableCell>

                      {/* Premium */}
                      <TableCell
                        className="text-right font-mono text-xs tabular-nums text-neutral-200 whitespace-nowrap"
                        title={fmtUsd(t.premium)}
                      >
                        {fmtCompactUsd(t.premium)}
                      </TableCell>

                      {/* Margin */}
                      <TableCell
                        className="text-right font-mono text-xs tabular-nums text-neutral-200 whitespace-nowrap"
                        title={`$${t.margin.toLocaleString()}`}
                      >
                        {fmtCompactUsd(t.margin)}
                      </TableCell>

                      {/* P/L */}
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs tabular-nums whitespace-nowrap",
                          t.pl >= 0 ? "text-emerald-400" : "text-red-400"
                        )}
                        title={fmtUsd(t.pl)}
                      >
                        {fmtCompactUsd(t.pl)}
                      </TableCell>
                          </>
                        );
                      })()}
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
          </div>
        </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricTile({
  label,
  value,
  sublabel,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "neutral" | "positive" | "negative" | "accent";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
      ? "text-red-400"
      : tone === "accent"
      ? "text-amber-300"
      : "text-neutral-100";

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 flex flex-col gap-1">
      <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-neutral-400">
        {label}
      </span>
      <span className={cn("text-2xl font-semibold", toneClass)}>{value}</span>
      {sublabel && (
        <span className="text-[11px] text-neutral-500">{sublabel}</span>
      )}
    </div>
  );
}
