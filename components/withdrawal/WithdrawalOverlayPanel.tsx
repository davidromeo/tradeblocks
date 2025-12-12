"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Banknote, PiggyBank, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  WithdrawalOverlayResult,
  WithdrawalOverlayTrade,
  simulateWithdrawalOverlay,
} from "@/lib/analytics/withdrawal-overlay";

interface WithdrawalOverlayPanelProps {
  trades: WithdrawalOverlayTrade[];
  startingCapital: number;
}

const fmtUsd = (v: number) =>
  `${v >= 0 ? "$" : "-$"}${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

export function WithdrawalOverlayPanel({
  trades,
  startingCapital,
}: WithdrawalOverlayPanelProps) {
  const [withdrawalPct, setWithdrawalPct] = useState<string>("30");

  const result: WithdrawalOverlayResult | null = useMemo(() => {
    if (!trades.length) return null;
    const pct = parseFloat(withdrawalPct || "0");
    return simulateWithdrawalOverlay(trades, {
      startingCapital,
      withdrawalPercentOfProfitableMonth: isNaN(pct) ? 0 : pct,
    });
  }, [trades, startingCapital, withdrawalPct]);

  if (!trades.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
          Upload a trade log to view withdrawal simulations.
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const {
    totalPL,
    endingTradingEquity,
    totalWithdrawn,
    endingNetEquity,
    monthly,
  } = result;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <PiggyBank className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Withdrawal Overlay (Option Omega Mode)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Uses P/L from your backtest as-is, then applies monthly withdrawals on profitable months.
              </p>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="withdrawalPct">Monthly Withdrawal % on Profitable Months</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="withdrawalPct"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="w-28"
                  value={withdrawalPct}
                  onChange={(e) => setWithdrawalPct(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">% of that month&apos;s profit</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-4">
          <SummaryTile
            icon={<Banknote className="h-4 w-4" />}
            label="Starting Capital"
            value={fmtUsd(startingCapital)}
          />
          <SummaryTile
            icon={<TrendingUp className="h-4 w-4" />}
            label="Total P/L (Backtest)"
            value={fmtUsd(totalPL)}
            pill="From log (no rescaling)"
          />
          <SummaryTile
            icon={<PiggyBank className="h-4 w-4" />}
            label="Total Withdrawn"
            value={fmtUsd(totalWithdrawn)}
            pill={`${withdrawalPct || 0}% of profitable months`}
          />
          <SummaryTile
            icon={<TrendingUp className="h-4 w-4" />}
            label="Ending Equity (After Withdrawals)"
            value={fmtUsd(endingNetEquity)}
            pill={`Trading equity: ${fmtUsd(endingTradingEquity)}`}
            highlight
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly P/L and Withdrawals</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Month P/L</TableHead>
                <TableHead className="text-right">Profitable?</TableHead>
                <TableHead className="text-right">Withdrawal</TableHead>
                <TableHead className="text-right">Cumulative Withdrawn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly.map((m) => {
                const monthDate = new Date(m.year, m.month, 1);
                return (
                  <TableRow key={m.monthKey}>
                    <TableCell className="font-medium">
                      {format(monthDate, "MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          m.monthPL >= 0 ? "text-emerald-500 font-medium" : "text-rose-500 font-medium"
                        }
                      >
                        {fmtUsd(m.monthPL)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {m.wasProfitable ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                          Profitable
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                          Losing / Flat
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.withdrawal !== 0 ? fmtUsd(m.withdrawal) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{fmtUsd(m.cumulativeWithdrawals)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  pill,
  highlight,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  pill?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 flex flex-col gap-1 ${
        highlight ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <span>{label}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
      {pill && <div className="text-[11px] text-muted-foreground">{pill}</div>}
    </div>
  );
}
