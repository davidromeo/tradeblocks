"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { KellyScalingPlayground } from "@/components/pl-analytics/KellyScalingPlayground";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AvgPLStats,
  buildDailyPnL,
  computeAvgPLStats,
  normalizeTradesToOneLot,
  RawTrade,
} from "@/lib/analytics/pl-analytics";
import {
  computeKellyScaleResults,
  KellyScaleResult,
} from "@/lib/kelly/kellyOptimizerV2";
import { computeAdvancedKellyV3 } from "@/lib/kelly/kellyOptimizerV3";
import { WithdrawalDailyRow } from "@/lib/models/withdrawal-log";
import { parseWithdrawalDailyCsv } from "@/lib/processing/withdrawal-log-parser";
import { cn } from "@/lib/utils";
import {
  runWithdrawalSimulation,
  runWithdrawalSimulationFromDailyLog,
  WithdrawalMode,
} from "@/lib/withdrawals/withdrawalSimulatorV2";

interface PLAnalyticsPanelProps {
  trades: RawTrade[];
}

const fmtUsd = (v: number) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000)
    return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000)
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
};

type AllocationSort =
  | "portfolioShare"
  | "netPL"
  | "rom"
  | "peakAlloc"
  | "avgAlloc";

type StrategyAllocationRow = {
  strategy: string;
  trades: number;
  avgAlloc: number; // Avg % Funds / trade (baseline for Kelly)
  portfolioShare: number;
  peakDaily: number;
  netPL: number;
  rom: number;
  pf: number;
  maxCapitalUsed: number;
  clusterCorrelation?: number;
};

export function PLAnalyticsPanel({ trades }: PLAnalyticsPanelProps) {
  const [startingBalance, setStartingBalance] = useState(160_000);
  const [withdrawPercent, setWithdrawPercent] = useState(30);
  const [withdrawalFixed, setWithdrawalFixed] = useState(0);
  const [withdrawalMode, setWithdrawalMode] = useState<WithdrawalMode>("none");
  const [withdrawOnlyProfitable, setWithdrawOnlyProfitable] = useState(true);
  // Default normalizeOneLot to false as requested by user
  const [normalizeOneLot, setNormalizeOneLot] = useState(false);
  // Default resetToStartMonthly to true as requested by user
  const [resetToStartMonthly, setResetToStartMonthly] = useState(true);
  const [baseCapital, setBaseCapital] = useState(160_000);
  const [allocationSort, setAllocationSort] =
    useState<AllocationSort>("portfolioShare");
  const [targetMaxDdPct, setTargetMaxDdPct] = useState<number>(16);
  const [lockRealizedWeights, setLockRealizedWeights] = useState<boolean>(true);
  const [dailyLog, setDailyLog] = useState<WithdrawalDailyRow[] | null>(null);

  // Persistence for Withdrawal Simulator settings
  // Persistence for Withdrawal Simulator settings - trigger build
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("withdrawSimSettings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.startingBalance === "number")
          setStartingBalance(parsed.startingBalance);
        if (typeof parsed.withdrawPercent === "number")
          setWithdrawPercent(parsed.withdrawPercent);
        if (typeof parsed.withdrawalFixed === "number")
          setWithdrawalFixed(parsed.withdrawalFixed);
        if (parsed.withdrawalMode) setWithdrawalMode(parsed.withdrawalMode);
        if (typeof parsed.withdrawOnlyProfitable === "boolean")
          setWithdrawOnlyProfitable(parsed.withdrawOnlyProfitable);
        if (typeof parsed.normalizeOneLot === "boolean")
          setNormalizeOneLot(parsed.normalizeOneLot);
        if (typeof parsed.resetToStartMonthly === "boolean")
          setResetToStartMonthly(parsed.resetToStartMonthly);
        if (typeof parsed.baseCapital === "number")
          setBaseCapital(parsed.baseCapital);
      } catch (e) {
        console.error("Failed to parse saved withdrawal settings", e);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const settings = {
      startingBalance,
      withdrawPercent,
      withdrawalFixed,
      withdrawalMode,
      withdrawOnlyProfitable,
      normalizeOneLot,
      resetToStartMonthly,
      baseCapital,
    };
    window.localStorage.setItem(
      "withdrawSimSettings",
      JSON.stringify(settings)
    );
  }, [
    startingBalance,
    withdrawPercent,
    withdrawalFixed,
    withdrawalMode,
    withdrawOnlyProfitable,
    normalizeOneLot,
    resetToStartMonthly,
    baseCapital,
  ]);

  const normalizedTrades = useMemo(() => {
    return normalizeOneLot ? normalizeTradesToOneLot(trades) : trades;
  }, [normalizeOneLot, trades]);

  const daily = useMemo(
    () => buildDailyPnL(normalizedTrades),
    [normalizedTrades]
  );

  const avgStats = useMemo(() => computeAvgPLStats(daily), [daily]);
  const kellyScaleResults: KellyScaleResult[] = useMemo(() => {
    if (daily.length === 0) return [];
    return computeKellyScaleResults({
      dailyPnl: daily,
      startingCapital: startingBalance,
      baselinePortfolioKellyPct: 100,
      kellyScales: [0.55, 0.8, 0.85, 0.9, 1],
    });
  }, [daily, startingBalance]);
  const baselineKellyResult = useMemo(
    () => kellyScaleResults.find((r) => Math.abs(r.scale - 1) < 1e-6),
    [kellyScaleResults]
  );

  const allocationRows = useMemo(() => {
    if (normalizedTrades.length === 0) return [];

    type StratAgg = {
      strategy: string;
      trades: number;
      totalCapital: number;
      totalPL: number;
      winPL: number;
      lossPL: number;
      allocations: number[]; // per-trade allocation %
      dailyCapital: Map<string, { capital: number; funds: number }>;
      maxCapitalUsed: number;
    };

    const byStrategy = new Map<string, StratAgg>();
    const dateKey = (d: Date) => format(d, "yyyy-MM-dd");

    normalizedTrades.forEach((t) => {
      const strategy = t.strategy || "Uncategorized";
      const capitalUsed =
        t.marginReq && t.marginReq > 0
          ? t.marginReq
          : Math.abs(t.premium ?? 0) * 100;
      const fundsBaseline = t.fundsAtClose ?? 0;
      const allocPct =
        fundsBaseline > 0 ? (capitalUsed / fundsBaseline) * 100 : 0;

      if (!byStrategy.has(strategy)) {
        byStrategy.set(strategy, {
          strategy,
          trades: 0,
          totalCapital: 0,
          totalPL: 0,
          winPL: 0,
          lossPL: 0,
          allocations: [],
          dailyCapital: new Map(),
          maxCapitalUsed: 0,
        });
      }
      const agg = byStrategy.get(strategy)!;
      agg.trades += 1;
      agg.totalCapital += capitalUsed;
      agg.totalPL += t.pl;
      agg.allocations.push(allocPct);
      agg.maxCapitalUsed = Math.max(agg.maxCapitalUsed, capitalUsed);
      if (t.pl > 0) agg.winPL += t.pl;
      else if (t.pl < 0) agg.lossPL += Math.abs(t.pl);

      const key = dateKey(t.openedOn);
      const existing = agg.dailyCapital.get(key) ?? { capital: 0, funds: 0 };
      agg.dailyCapital.set(key, {
        capital: existing.capital + capitalUsed,
        funds: Math.max(existing.funds, fundsBaseline),
      });
    });

    const totalCapitalAll = Array.from(byStrategy.values()).reduce(
      (sum, s) => sum + s.totalCapital,
      0
    );

    const rows: StrategyAllocationRow[] = Array.from(byStrategy.values()).map(
      (s) => {
        const avgAlloc =
          s.allocations.length > 0
            ? s.allocations.reduce((a, b) => a + b, 0) / s.allocations.length
            : 0;
        const peakDaily = Math.max(
          0,
          ...Array.from(s.dailyCapital.values()).map((d) =>
            d.funds > 0 ? (d.capital / d.funds) * 100 : 0
          )
        );
        const portfolioShare =
          totalCapitalAll > 0 ? (s.totalCapital / totalCapitalAll) * 100 : 0;
        const rom = s.totalCapital > 0 ? (s.totalPL / s.totalCapital) * 100 : 0;
        const pf =
          s.lossPL > 0
            ? s.winPL / s.lossPL
            : s.winPL > 0
            ? Number.POSITIVE_INFINITY
            : 0;

        return {
          strategy: s.strategy,
          trades: s.trades,
          avgAlloc,
          portfolioShare,
          peakDaily,
          netPL: s.totalPL,
          rom,
          pf,
          maxCapitalUsed: s.maxCapitalUsed,
        };
      }
    );

    const sorter: Record<
      AllocationSort,
      (a: StrategyAllocationRow, b: StrategyAllocationRow) => number
    > = {
      portfolioShare: (a, b) => b.portfolioShare - a.portfolioShare,
      netPL: (a, b) => b.netPL - a.netPL,
      rom: (a, b) => b.rom - a.rom,
      peakAlloc: (a, b) => b.peakDaily - a.peakDaily,
      avgAlloc: (a, b) => b.avgAlloc - a.avgAlloc,
    };

    return rows.sort(sorter[allocationSort]);
  }, [normalizedTrades, allocationSort]);

  const kellyV3Result = useMemo(() => {
    if (daily.length === 0 || allocationRows.length === 0) return null;
    return computeAdvancedKellyV3({
      dailyPnl: daily,
      startingCapital: startingBalance,
      targetMaxDdPct,
      strategies: allocationRows.map((r) => ({
        name: r.strategy,
        pf: r.pf,
        romPct: r.rom,
        avgFundsPctPerTrade: r.avgAlloc,
        marginSpikeFactor:
          r.maxCapitalUsed > 0
            ? Math.min(1, r.maxCapitalUsed / startingBalance)
            : 0,
        tier: 2,
      })),
      lockRealizedWeights,
    });
  }, [
    allocationRows,
    daily,
    lockRealizedWeights,
    startingBalance,
    targetMaxDdPct,
  ]);

  const handleExportKellyCsv = () => {
    if (!kellyV3Result) return;
    const header = "Strategy,KellyPct\n";
    const body = kellyV3Result.rows
      .map((row) => `${row.name},${row.finalKellyPct.toFixed(2)}`)
      .join("\n");
    const csv = header + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kelly-optimizer-v3.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWithdrawalCsv = () => {
    const header = "Month,PnL,Withdrawal,Equity\n";
    const body = withdrawalSim.points
      .map(
        (p) =>
          `${p.month},${p.pnlScaled.toFixed(2)},${p.withdrawal.toFixed(
            2
          )},${p.equityEnd.toFixed(2)}`
      )
      .join("\n");
    const csv = header + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "withdrawal-simulation.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const withdrawalSim = useMemo(() => {
    // 0. Use uploaded daily log if available
    if (dailyLog && dailyLog.length > 0) {
      return runWithdrawalSimulationFromDailyLog(dailyLog, {
        startingBalance,
        mode: withdrawalMode,
        percentOfProfit:
          withdrawalMode === "percentOfProfit" ? withdrawPercent : undefined,
        fixedDollar:
          withdrawalMode === "fixedDollar" ? withdrawalFixed : undefined,
        withdrawOnlyProfitableMonths: withdrawOnlyProfitable,
        resetToStart: resetToStartMonthly,
      });
    }

    // 1. Group trades by month to find the LAST trade of each month
    const monthlyLastTrade = new Map<string, RawTrade>();
    // Assume normalizedTrades are typically sorted by close date, but enforce safety:
    // We already have monthlyPnlPoints which are sorted, but we need the raw trades.
    // Let's iterate the full list.
    const sortedTrades = [...normalizedTrades].sort(
      (a, b) => a.closedOn.getTime() - b.closedOn.getTime()
    );

    sortedTrades.forEach((t) => {
      // Use calendar logic for bucketing if possible, but FundsAtClose is intrinsically tied to the running equity curve
      // which is strictly Time-ordered.
      // We'll use strict YYYY-MM from closedOn for FundsAtClose tracking to match visual curve order.
      const key = t.closedOn.toISOString().slice(0, 7);
      monthlyLastTrade.set(key, t);
    });

    const sortedMonthKeys = Array.from(monthlyLastTrade.keys()).sort();

    // 2. Calculate monthly returns based on Funds At Close change
    const baselineMonths = sortedMonthKeys.map((monthKey, idx) => {
      const currentTrade = monthlyLastTrade.get(monthKey)!;
      const currentFunds = currentTrade.fundsAtClose ?? 0;

      let prevFunds = startingBalance; // Default to starting balance for first month return

      if (idx > 0) {
        const prevKey = sortedMonthKeys[idx - 1];
        const prevTrade = monthlyLastTrade.get(prevKey)!;
        prevFunds = prevTrade.fundsAtClose ?? startingBalance;
      }

      // Calculate Return: (End / Start) - 1
      // If funds key is missing or 0, fallback to 0 return
      const baseReturn =
        prevFunds > 0 && currentFunds > 0 ? currentFunds / prevFunds - 1 : 0;

      return {
        monthKey,
        baseReturn,
      };
    });

    // If no fundsAtClose data (e.g. old logs), baselineSteps will be 0 returns.
    // Fallback? If baseReturn is consistently 0 (and we have PnL), maybe warn or fallback?
    // User specifically asked for FundsAtClose support. We assume it exists.

    return runWithdrawalSimulation(baselineMonths, {
      startingBalance,
      mode: withdrawalMode,
      percentOfProfit:
        withdrawalMode === "percentOfProfit" ? withdrawPercent : undefined,
      fixedDollar:
        withdrawalMode === "fixedDollar" ? withdrawalFixed : undefined,
      withdrawOnlyProfitableMonths: withdrawOnlyProfitable,
      resetToStart: resetToStartMonthly,
    });
  }, [
    startingBalance,
    withdrawalMode,
    withdrawPercent,
    withdrawalFixed,
    withdrawOnlyProfitable,
    resetToStartMonthly,
    normalizedTrades,
    dailyLog,
  ]);

  if (trades.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No trade data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StatsGrid stats={avgStats} />

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CardTitle>Realized Strategy Allocation</CardTitle>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-muted/60"
              title="Estimates how much capital each strategy actually deployed, using margin (or premium) divided by Funds at Close. Net P/L respects the current sizing toggle (1-lot switch)."
            >
              ?
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Based on capital used per trade vs. Funds at Close. Avg % is per
            trade, portfolio share is total capital used by the strategy vs all
            trades.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1">
              <span className="font-semibold">Sizing</span>
              <span>{normalizeOneLot ? "1-lot normalized" : "Actual P/L"}</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1">
              <span className="font-semibold">Sort</span>
              <select
                className="bg-transparent text-xs"
                value={allocationSort}
                onChange={(e) =>
                  setAllocationSort(e.target.value as typeof allocationSort)
                }
              >
                <option value="portfolioShare">Portfolio share</option>
                <option value="netPL">Net P/L</option>
                <option value="rom">ROM%</option>
                <option value="peakAlloc">Peak daily allocation</option>
                <option value="avgAlloc">Avg % per trade</option>
              </select>
            </div>
            <div className="ml-auto">
              Showing {allocationRows.length} strategies
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[820px] rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="text-muted-foreground">
                    <TableHead>Strategy</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                    <TableHead className="text-right">
                      Avg % Funds / trade
                    </TableHead>
                    <TableHead className="text-right">
                      Portfolio share
                    </TableHead>
                    <TableHead className="text-right">
                      Peak daily alloc
                    </TableHead>
                    <TableHead className="text-right">Net P/L</TableHead>
                    <TableHead className="text-right">ROM%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocationRows.map((row) => (
                    <TableRow key={row.strategy}>
                      <TableCell className="font-medium">
                        {row.strategy}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.trades}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.avgAlloc.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.portfolioShare.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.peakDaily.toFixed(1)}%
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs",
                          row.netPL >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {fmtUsd(row.netPL)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.rom.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <KellyScalingPlayground
        strategies={allocationRows.map((r) => ({
          name: r.strategy,
          avgFundsPerTrade: r.avgAlloc,
          pf: r.pf,
          rom: r.rom,
          maxMarginUsed: r.maxCapitalUsed,
          clusterCorrelation: r.clusterCorrelation,
        }))}
        baselineMaxDD={baselineKellyResult?.estMaxDdPct ?? 0}
        kellyResults={kellyScaleResults}
      />

      {/* Advanced Kelly Optimizer v3 */}
      <div className="rounded-2xl border border-border bg-card p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                Kelly Optimizer (Advanced)
              </h2>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground"
                title="PF and ROM% drive raw Kelly. Margin/tier taper it. Portfolio Kelly is scaled to hit target Max DD using the true equity curve."
              >
                ?
              </button>
            </div>
            {kellyV3Result && (
              <p className="mt-1 text-xs text-muted-foreground">
                Baseline Max DD:{" "}
                <span className="font-mono">
                  {kellyV3Result.baselineMaxDdPct.toFixed(1)}%
                </span>
                {" · "}
                Est. Max DD:{" "}
                <span className="font-mono">
                  {kellyV3Result.estMaxDdPct.toFixed(1)}%
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Target Max DD %
              </span>
              <Input
                type="number"
                className="h-8 w-16 rounded-md border border-border bg-background px-2 text-xs font-mono"
                value={targetMaxDdPct}
                min={5}
                max={40}
                step={0.5}
                onChange={(e) => setTargetMaxDdPct(Number(e.target.value) || 0)}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-border"
                checked={lockRealizedWeights}
                onChange={(e) => setLockRealizedWeights(e.target.checked)}
              />
              <span>Lock realized weights</span>
            </label>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportKellyCsv}
              disabled={!kellyV3Result}
            >
              Export CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="border-b border-border text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 text-left font-medium">Strategy</th>
                <th className="px-2 py-2 text-right font-medium">PF</th>
                <th className="px-2 py-2 text-right font-medium">ROM%</th>
                <th className="px-2 py-2 text-right font-medium">
                  Margin spike
                </th>
                <th className="px-2 py-2 text-right font-medium">Base Kelly</th>
                <th className="px-2 py-2 text-right font-medium">
                  After tiers/margin
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  Final (portfolio Kelly)
                </th>
              </tr>
            </thead>
            <tbody>
              {!kellyV3Result && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    Not enough data to compute Kelly yet.
                  </td>
                </tr>
              )}

              {kellyV3Result?.rows.map((row) => (
                <tr
                  key={row.name}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="py-2 pr-4 text-left font-medium text-[11px]">
                    {row.name}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {row.pf.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {row.romPct.toFixed(1)}%
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {(row.marginSpikeFactor * 100).toFixed(0)}%
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {row.rawKellyPct.toFixed(1)}%
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {row.baseKellyPct.toFixed(1)}%
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-emerald-400">
                    {row.finalKellyPct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {kellyV3Result && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <div>
              Portfolio Kelly:{" "}
              <span className="font-mono">
                {(kellyV3Result.portfolioKellyScale * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              Est. Max DD:{" "}
              <span className="font-mono">
                {kellyV3Result.estMaxDdPct.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Withdrawal Simulator v2 */}
      <div className="rounded-2xl border border-border bg-card p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                Withdrawal Simulator
              </h2>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground"
                title="Simulates withdrawing % of monthly profit or fixed $ from your portfolio, using real backtest P/L and compounding."
              >
                ?
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Profit-based withdrawals; changing % just re-runs the sim on the
              original log.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Starting balance
              </span>
              <Input
                type="number"
                value={startingBalance}
                onChange={(e) =>
                  setStartingBalance(Number(e.target.value) || 0)
                }
                className="h-8 w-24 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Base capital
              </span>
              <Input
                type="number"
                value={baseCapital}
                onChange={(e) => setBaseCapital(Number(e.target.value) || 0)}
                className="h-8 w-24 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Withdrawal mode
              </span>
              <div className="flex flex-wrap gap-2">
                {(
                  ["none", "percentOfProfit", "fixedDollar"] as WithdrawalMode[]
                ).map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={withdrawalMode === mode ? "default" : "outline"}
                    onClick={() => setWithdrawalMode(mode)}
                    className="h-8 text-xs"
                  >
                    {mode === "none"
                      ? "None"
                      : mode === "percentOfProfit"
                      ? "Percent"
                      : "Fixed $"}
                  </Button>
                ))}
              </div>
            </div>

            {withdrawalMode === "percentOfProfit" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Percent of monthly profit
                </span>
                <Input
                  type="number"
                  value={withdrawPercent}
                  min={0}
                  max={100}
                  step={0.25}
                  onChange={(e) =>
                    setWithdrawPercent(Number(e.target.value) || 0)
                  }
                  className="h-8 w-20 text-xs"
                />
              </div>
            )}

            {withdrawalMode === "fixedDollar" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Fixed $ per month
                </span>
                <Input
                  type="number"
                  value={withdrawalFixed}
                  min={0}
                  step={100}
                  onChange={(e) =>
                    setWithdrawalFixed(Number(e.target.value) || 0)
                  }
                  className="h-8 w-24 text-xs"
                />
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                setStartingBalance(160_000);
                setBaseCapital(160_000);
                setWithdrawalMode("none");
                setWithdrawPercent(30);
                setWithdrawalFixed(0);
                setResetToStartMonthly(false);
              }}
            >
              Reset to start
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={handleExportWithdrawalCsv}
            >
              Export CSV
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Daily P/L Log (Optional)
            </div>
            <Input
              type="file"
              accept=".csv"
              className="h-8 w-full max-w-sm text-xs file:text-xs file:font-medium"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  setDailyLog(null);
                  return;
                }
                const text = await file.text();
                const rows = parseWithdrawalDailyCsv(text);
                setDailyLog(rows);
              }}
            />
            <div className="text-[10px] text-muted-foreground">
              Overrides monthly baseline
            </div>
            {dailyLog && (
              <Badge
                variant="outline"
                className="h-5 border-emerald-500/50 text-[10px] text-emerald-500"
              >
                Overrides monthly baseline • Loaded {dailyLog.length} days
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Switch
              checked={withdrawOnlyProfitable}
              onCheckedChange={setWithdrawOnlyProfitable}
            />
            <span>Withdraw only on profitable months</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={normalizeOneLot}
              onCheckedChange={setNormalizeOneLot}
            />
            <span>Normalize to 1-lot (divide P/L & basis by contracts)</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={resetToStartMonthly}
              onCheckedChange={setResetToStartMonthly}
            />
            <span>
              Reset equity to starting balance each month (withdraw any excess)
            </span>
          </div>
        </div>

        <div className="h-[300px] w-full mt-6 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={withdrawalSim.points}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#333"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#888" }}
                tickLine={false}
                axisLine={false}
                minTickGap={30}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "#888" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) =>
                  `$${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`
                }
                domain={["auto", "auto"]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "#fbbf24" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (val > 0 ? `$${val}` : "")}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                itemStyle={{ color: "#e5e7eb" }}
                labelStyle={{ color: "#9ca3af", marginBottom: "4px" }}
                formatter={(value: number, name: string) => [
                  fmtUsd(value),
                  name === "equity"
                    ? "Equity"
                    : name === "equityBase"
                    ? "Base Equity"
                    : "Withdrawal",
                ]}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="equityEnd"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorEquity)"
                strokeWidth={2}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="equityBase"
                stroke="#6b7280"
                strokeDasharray="4 4"
                dot={false}
                strokeWidth={1.5}
                activeDot={false}
              />
              <Bar
                yAxisId="right"
                dataKey="withdrawal"
                fill="#fbbf24"
                opacity={0.8}
                barSize={20}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">P/L (scaled)</TableHead>
                <TableHead className="text-right">Withdrawal</TableHead>
                <TableHead className="text-right">Ending balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawalSim.points.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-mono text-xs">
                    {row.month}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {fmtUsd(row.pnlScaled)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-amber-300">
                    {fmtUsd(row.withdrawal)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {fmtUsd(row.equityEnd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-[11px] text-muted-foreground">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <div className="uppercase tracking-wide text-[10px]">
              Total Withdrawn
            </div>
            <div className="text-lg font-semibold text-amber-300">
              {fmtUsd(withdrawalSim.totalWithdrawn)}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <div className="uppercase tracking-wide text-[10px]">
              Final Equity
            </div>
            <div className="text-lg font-semibold">
              {fmtUsd(withdrawalSim.finalEquity)}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <div className="uppercase tracking-wide text-[10px]">CAGR</div>
            <div className="text-lg font-semibold">
              {withdrawalSim.cagrPct.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <div className="uppercase tracking-wide text-[10px]">Max DD</div>
            <div className="text-lg font-semibold">
              {withdrawalSim.maxDrawdownPct.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsGrid({ stats }: { stats: AvgPLStats }) {
  const items = [
    { label: "Avg winning day", value: stats.avgWinningDay },
    { label: "Avg losing day", value: stats.avgLosingDay },
    { label: "Avg winning week", value: stats.avgWinningWeek },
    { label: "Avg losing week", value: stats.avgLosingWeek },
    { label: "Avg winning month", value: stats.avgWinningMonth },
    { label: "Avg losing month", value: stats.avgLosingMonth },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-3">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              {item.label}
            </div>
            <div
              className={cn(
                "text-lg font-semibold",
                item.value >= 0 ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {fmtUsd(item.value)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// legacy helper components removed for brevity
