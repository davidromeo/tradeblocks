"use client";

import { cn } from "@/lib/utils";

interface StrategyCorrelationMatrixProps {
  trades: {
    strategies: string[];
    correlations: { a: string; b: string; corr: number }[];
  };
  sizingMode: "actual" | "normalized";
  metric: "pl" | "rom";
}

export function StrategyCorrelationMatrix({
  trades,
  sizingMode,
  metric,
}: StrategyCorrelationMatrixProps) {
  const { strategies, correlations } = trades;
  if (!strategies.length) return null;

  const grid: Record<string, Record<string, number>> = {};
  strategies.forEach((a) => {
    grid[a] = {};
    strategies.forEach((b) => {
      const entry =
        correlations.find(
          (c) =>
            (c.a === a && c.b === b) || (c.a === b && c.b === a)
        ) ?? null;
      grid[a][b] = entry ? entry.corr : 0;
    });
  });

  const getColor = (corr: number) => {
    if (corr >= 0.75) return "bg-rose-600/70 text-rose-50";
    if (corr >= 0.5) return "bg-rose-600/30 text-rose-50";
    if (corr <= -0.75) return "bg-sky-600/70 text-sky-50";
    if (corr <= -0.5) return "bg-sky-600/30 text-sky-50";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Strategy correlation</h3>
        <p className="text-xs text-muted-foreground">
          Metric: {metric === "pl" ? "P/L" : "ROM%"} • Sizing: {sizingMode}
        </p>
      </div>
      <div className="overflow-auto">
        <table className="min-w-[480px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-24 text-left text-[11px] text-muted-foreground">Strategy</th>
              {strategies.map((s) => (
                <th key={s} className="px-1 text-[11px] text-muted-foreground">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strategies.map((row) => (
              <tr key={row}>
                <td className="pr-2 text-[11px] font-semibold text-muted-foreground">
                  {row}
                </td>
                {strategies.map((col) => {
                  const corr = grid[row][col];
                  return (
                    <td key={col} className="p-1">
                      <div
                        className={cn(
                          "flex h-8 items-center justify-center rounded-sm text-[11px] font-semibold",
                          getColor(corr)
                        )}
                        title={`${row} vs ${col}: ${(corr * 100).toFixed(1)}%`}
                      >
                        {(corr * 100).toFixed(0)}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
