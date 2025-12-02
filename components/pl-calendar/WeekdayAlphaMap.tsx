"use client";

import { cn } from "@/lib/utils";

interface WeekdayStat {
  weekday: number;
  pl: number;
  margin: number;
  trades: number;
  winRate: number;
  romPct: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function WeekdayAlphaMap({
  stats,
  sizingMode,
}: {
  stats: WeekdayStat[];
  sizingMode: "actual" | "normalized" | "kelly" | "halfKelly";
}) {
  const data: WeekdayStat[] = stats ?? [];

  if (!data.length) return null;

  const maxRom = Math.max(1, ...data.map((s) => Math.abs(s.romPct)));

  const fmtUsd = (v: number) => {
    const sign = v < 0 ? "-" : "";
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Weekday alpha</h3>
        <p className="text-xs text-muted-foreground">
          Sizing: {sizingMode === "actual" ? "Actual" : "1-lot normalized"}
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {data.map((s) => {
          const intensity = Math.min(1, Math.abs(s.romPct) / maxRom);
          const bg =
            s.romPct >= 0
              ? intensity > 0.66
                ? "bg-emerald-600/60 text-emerald-50"
                : "bg-emerald-500/20 text-emerald-50"
              : intensity > 0.66
              ? "bg-rose-600/60 text-rose-50"
              : "bg-rose-500/20 text-rose-50";

          return (
            <div
              key={s.weekday}
              className={cn(
                "rounded-xl border border-muted bg-muted/30 p-3 text-xs space-y-1",
                bg
              )}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-200">
                {DAY_LABELS[s.weekday] || "-"}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-neutral-200">P/L</span>
                <span className="font-semibold text-neutral-50">
                  {fmtUsd(s.pl)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-neutral-200">ROM</span>
                <span className="font-semibold text-neutral-50">
                  {s.romPct.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-neutral-200">Win%</span>
                <span className="font-semibold text-neutral-50">
                  {s.winRate.toFixed(0)}%
                </span>
              </div>
              <div className="text-[11px] text-neutral-200">
                Trades: {s.trades}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
