"use client";

import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface MonthStats {
  monthIndex: number; // 0-11
  netPL: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  totalPremium: number;
  totalMargin?: number;
  romPct?: number;
  // Cumulative P/L from Jan through this month (per year)
  runningNetPL?: number;
}

interface YearlyPLTableProps {
  year: number;
  monthlyStats: Map<number, MonthStats>;
  metric?: "pl" | "rom" | "running";
}

export function YearlyPLTable({ year, monthlyStats, metric = "pl" }: YearlyPLTableProps) {
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead className="text-right">Net P/L</TableHead>
            <TableHead className="text-right">Trades</TableHead>
            <TableHead className="text-right">Win Rate</TableHead>
            <TableHead className="text-right">Total Premium</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {months.map((monthIndex) => {
            const stats = monthlyStats.get(monthIndex);
            const date = new Date(year, monthIndex, 1);
            const winRate =
              stats && stats.tradeCount > 0
                ? Math.round((stats.winCount / stats.tradeCount) * 100)
                : 0;

            const displayValue =
              metric === "rom"
                ? stats?.romPct ?? 0
                : metric === "running"
                ? stats?.runningNetPL ?? stats?.netPL ?? 0
                : stats?.netPL ?? 0;

            return (
              <TableRow key={monthIndex}>
                <TableCell className="font-medium">
                  {format(date, "MMMM")}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    displayValue >= 0
                      ? "text-emerald-500"
                      : "text-rose-500"
                  )}
                >
                  {stats
                    ? metric === "rom"
                      ? `${displayValue.toFixed(1)}%`
                      : `${displayValue >= 0 ? "+" : ""}$${Math.abs(displayValue).toLocaleString()}`
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {stats ? stats.tradeCount : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {stats ? `${winRate}%` : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {stats
                    ? `$${stats.totalPremium.toLocaleString()}`
                    : "-"}
                </TableCell>
              </TableRow>
            );
          })}
          {/* Total Row */}
          <TableRow className="bg-muted/50 font-bold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">
              {(() => {
                const totalPL =
                  metric === "rom"
                    ? Array.from(monthlyStats.values()).reduce(
                        (acc, s) =>
                          acc +
                          (s.romPct !== undefined ? s.romPct : 0),
                        0
                      ) / Math.max(1, monthlyStats.size)
                    : Array.from(monthlyStats.values()).reduce(
                        (acc, s) => acc + s.netPL,
                        0
                      );
                return (
                  <span
                    className={
                      totalPL >= 0 ? "text-emerald-500" : "text-rose-500"
                    }
                  >
                    {metric === "rom"
                      ? `${totalPL.toFixed(1)}%`
                      : `${totalPL >= 0 ? "+" : ""}$${totalPL.toLocaleString()}`}
                  </span>
                );
              })()}
            </TableCell>
            <TableCell className="text-right">
              {Array.from(monthlyStats.values()).reduce(
                (acc, s) => acc + s.tradeCount,
                0
              )}
            </TableCell>
            <TableCell className="text-right">
              {(() => {
                const totalWins = Array.from(monthlyStats.values()).reduce(
                  (acc, s) => acc + s.winCount,
                  0
                );
                const totalTrades = Array.from(monthlyStats.values()).reduce(
                  (acc, s) => acc + s.tradeCount,
                  0
                );
                return totalTrades > 0
                  ? `${Math.round((totalWins / totalTrades) * 100)}%`
                  : "-";
              })()}
            </TableCell>
            <TableCell className="text-right">
              $
              {Array.from(monthlyStats.values())
                .reduce((acc, s) => acc + s.totalPremium, 0)
                .toLocaleString()}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
