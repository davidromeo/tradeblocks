"use client";

import { format } from "date-fns";

interface RomTrendPoint {
  date: string;
  romPct: number;
}

export function RomTrendChart({
  series,
  label,
}: {
  series: RomTrendPoint[];
  label: string;
}) {
  if (!series.length) return null;

  const minRom = Math.min(...series.map((p) => p.romPct));
  const maxRom = Math.max(...series.map((p) => p.romPct));
  const range = Math.max(1, maxRom - minRom);

  const points = series.map((p, idx) => {
    const x = (idx / Math.max(1, series.length - 1)) * 100;
    const y = ((p.romPct - minRom) / range) * 100;
    return `${x},${100 - y}`;
  });

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-20 text-emerald-400"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points.join(" ")}
        />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{format(new Date(series[0].date), "MMM d")}</span>
        <span>{format(new Date(series[series.length - 1].date), "MMM d")}</span>
      </div>
    </div>
  );
}
