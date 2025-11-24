"use client";

import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  TrendingUp,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WalkForwardAnalysisChart } from "@/components/walk-forward/analysis-chart";
import { WalkForwardPeriodSelector } from "@/components/walk-forward/period-selector";
import { RobustnessMetrics } from "@/components/walk-forward/robustness-metrics";
import { RunSwitcher } from "@/components/walk-forward/run-switcher";
import { WalkForwardOptimizationTarget } from "@/lib/models/walk-forward";
import { useBlockStore } from "@/lib/stores/block-store";
import { useWalkForwardStore } from "@/lib/stores/walk-forward-store";
import { cn } from "@/lib/utils";

const TARGET_LABELS: Record<WalkForwardOptimizationTarget, string> = {
  netPl: "Net Profit",
  profitFactor: "Profit Factor",
  sharpeRatio: "Sharpe Ratio",
  sortinoRatio: "Sortino Ratio",
  calmarRatio: "Calmar Ratio",
  cagr: "CAGR",
  avgDailyPl: "Avg Daily P/L",
  winRate: "Win Rate",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WalkForwardPage() {
  const activeBlock = useBlockStore((state) => {
    const activeId = state.activeBlockId;
    return activeId
      ? state.blocks.find((block) => block.id === activeId) ?? null
      : null;
  });
  const blockIsLoading = useBlockStore((state) => state.isLoading);
  const isInitialized = useBlockStore((state) => state.isInitialized);
  const loadBlocks = useBlockStore((state) => state.loadBlocks);

  const results = useWalkForwardStore((state) => state.results);
  const history = useWalkForwardStore((state) => state.history);
  const config = useWalkForwardStore((state) => state.config);
  const loadHistory = useWalkForwardStore((state) => state.loadHistory);
  const selectAnalysis = useWalkForwardStore((state) => state.selectAnalysis);
  const deleteAnalysis = useWalkForwardStore((state) => state.deleteAnalysis);
  const exportResultsAsCsv = useWalkForwardStore(
    (state) => state.exportResultsAsCsv
  );
  const exportResultsAsJson = useWalkForwardStore(
    (state) => state.exportResultsAsJson
  );

  const [showFailingOnly, setShowFailingOnly] = useState(false);
  const [minOosTrades, setMinOosTrades] = useState(0);
  const [periodRange, setPeriodRange] = useState<[number, number]>([1, 1]);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});

  const activeBlockId = activeBlock?.id ?? null;

  useEffect(() => {
    if (!isInitialized) {
      loadBlocks().catch(console.error);
    }
  }, [isInitialized, loadBlocks]);

  useEffect(() => {
    if (activeBlockId) {
      loadHistory(activeBlockId).catch(console.error);
    }
  }, [activeBlockId, loadHistory]);

  useEffect(() => {
    if (results?.results.periods?.length) {
      setPeriodRange([1, results.results.periods.length]);
    }
  }, [results?.results.periods?.length]);

  const targetMetricLabel =
    TARGET_LABELS[
      (results?.config.optimizationTarget ??
        config.optimizationTarget) as WalkForwardOptimizationTarget
    ] ?? "Net Profit";

  const insights = useMemo(() => {
    if (!results) return [];
    const { periods, summary, stats } = results.results;
    if (!periods.length) return [];

    const avgKelly =
      periods.reduce(
        (sum, period) => sum + (period.optimalParameters.kellyMultiplier ?? 0),
        0
      ) / periods.length;
    const bestPeriod = periods.reduce((best, period) => {
      return period.targetMetricOutOfSample > best.targetMetricOutOfSample
        ? period
        : best;
    }, periods[0]);

    const consistency = Math.round((stats.consistencyScore ?? 0) * 100);
    const efficiency = Math.round(summary.degradationFactor * 100);

    return [
      `Out-of-sample performance retained ${efficiency}% of ${targetMetricLabel} on average.`,
      `Kelly multiplier averaged ${avgKelly.toFixed(2)}x, suggesting a ${
        avgKelly > 1 ? "growth" : "capital preservation"
      } bias.`,
      `Best OOS window (${formatDate(
        bestPeriod.outOfSampleStart
      )} → ${formatDate(
        bestPeriod.outOfSampleEnd
      )}) delivered ${bestPeriod.targetMetricOutOfSample.toFixed(
        2
      )} ${targetMetricLabel}.`,
      `Consistency: ${consistency}% of windows stayed non-negative after rolling forward.`,
    ];
  }, [results, targetMetricLabel]);

  const formatMetricValue = (value: number) => {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value);
    const fractionDigits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  };

  const getEfficiencyStatus = (pct: number) => {
    if (pct >= 90) {
      return {
        label: "Robust",
        chipClass: "bg-emerald-50 text-emerald-700",
        icon: TrendingUp,
        iconClass: "text-emerald-600",
        action:
          "OOS almost mirrors IS. You can lean into this sizing with confidence.",
        lineColor: "#10b981",
      };
    }
    if (pct >= 70) {
      return {
        label: "Monitor",
        chipClass: "bg-amber-50 text-amber-700",
        icon: Activity,
        iconClass: "text-amber-600",
        action:
          "Slight degradation — keep the parameters but monitor drawdowns closely.",
        lineColor: "#f59e0b",
      };
    }
    return {
      label: "Attention",
      chipClass: "bg-rose-50 text-rose-700",
      icon: AlertTriangle,
      iconClass: "text-rose-600",
      action:
        "OOS fell off a cliff. Re-run optimization or throttle position sizes here.",
      lineColor: "#f43f5e",
    };
  };

  const periodSummaries = useMemo(() => {
    if (!results) return [];
    return results.results.periods.map((period, index) => {
      const degradation =
        period.targetMetricInSample !== 0
          ? period.targetMetricOutOfSample / period.targetMetricInSample
          : 0;

      const efficiencyPct = Number.isFinite(degradation)
        ? degradation * 100
        : 0;
      const status = getEfficiencyStatus(efficiencyPct);

      const parameterSummary = Object.entries(period.optimalParameters).map(
        ([key, value]) => {
          const prettyKey = (() => {
            if (key.startsWith("strategy:"))
              return `Strategy ${key.replace("strategy:", "")}`;
            switch (key) {
              case "kellyMultiplier":
                return "Kelly Multiplier";
              case "fixedFractionPct":
                return "Fixed Fraction %";
              case "maxDrawdownPct":
                return "Max Drawdown %";
              case "maxDailyLossPct":
                return "Max Daily Loss %";
              case "consecutiveLossLimit":
                return "Consecutive Loss Limit";
              default:
                return key;
            }
          })();

          const formattedValue = key.toLowerCase().includes("pct")
            ? `${value.toFixed(2)}%`
            : value.toFixed(2);

          return `${prettyKey}: ${formattedValue}`;
        }
      );

      return {
        label: `Period ${index + 1}`,
        inSampleRange: `${formatDate(period.inSampleStart)} → ${formatDate(
          period.inSampleEnd
        )}`,
        outSampleRange: `${formatDate(period.outOfSampleStart)} → ${formatDate(
          period.outOfSampleEnd
        )}`,
        inSampleMetric: period.targetMetricInSample,
        outSampleMetric: period.targetMetricOutOfSample,
        efficiencyPct,
        status,
        oosDrawdown: period.outOfSampleMetrics.maxDrawdown,
        oosTrades: period.outOfSampleMetrics.totalTrades,
        parameters: parameterSummary,
      };
    });
  }, [results]);

  const rangeFilteredSummaries = useMemo(() => {
    const [start, end] = periodRange;
    return periodSummaries.filter((_, idx) => {
      const n = idx + 1;
      return n >= start && n <= end;
    });
  }, [periodSummaries, periodRange]);

  const filteredPeriodSummaries = useMemo(() => {
    return rangeFilteredSummaries.filter((period) => {
      if (showFailingOnly && period.efficiencyPct >= 60) return false;
      if (minOosTrades > 0 && (period.oosTrades ?? 0) < minOosTrades)
        return false;
      return true;
    });
  }, [rangeFilteredSummaries, showFailingOnly, minOosTrades]);

  const miniBars = useMemo(() => {
    return filteredPeriodSummaries.map((period) => {
      const isVal = period.inSampleMetric;
      const oosVal = period.outSampleMetric;
      const maxVal = Math.max(Math.abs(isVal), Math.abs(oosVal), 1);
      const isWidth = Math.min(100, (Math.abs(isVal) / maxVal) * 100);
      const oosWidth = Math.min(100, (Math.abs(oosVal) / maxVal) * 100);
      return {
        label: period.label,
        isVal,
        oosVal,
        isWidth,
        oosWidth,
        status: period.status,
        oosTrades: period.oosTrades,
        oosDrawdown: period.oosDrawdown,
      };
    });
  }, [filteredPeriodSummaries]);

  const periodCount = results?.results.periods.length ?? 0;

  const handleExport = (format: "csv" | "json") => {
    const payload =
      format === "csv" ? exportResultsAsCsv() : exportResultsAsJson();
    if (!payload) return;

    const blob = new Blob([payload], {
      type: format === "csv" ? "text/csv;charset=utf-8;" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      format === "csv"
        ? "walk-forward-summary.csv"
        : "walk-forward-summary.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!isInitialized || blockIsLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading blocks...
        </div>
      </div>
    );
  }

  if (!activeBlock) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select a Block</CardTitle>
          <CardDescription>
            Choose a block from the sidebar to configure walk-forward
            optimization.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Once a block is active you can orchestrate rolling
          in-sample/out-of-sample testing and visualize robustness.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <RunSwitcher
        history={history}
        currentId={results?.id ?? null}
        onSelect={selectAnalysis}
        onDelete={deleteAnalysis}
      />

      <WalkForwardPeriodSelector
        blockId={activeBlockId}
        addon={
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">How it works</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>How to Use This Page</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Walk-forward analysis validates your strategy by repeatedly optimizing on historical data (in-sample)
                      and testing on unseen future data (out-of-sample).
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Pick in-sample / out-of-sample windows that match your timeframe and data depth.</li>
                      <li>Select an optimization target (Sharpe, Net Profit, etc.) that matches your risk goals.</li>
                      <li>Set parameter ranges for sizing and risk controls to sweep combinations.</li>
                      <li>Run to see how optimal parameters shift across regimes and how OOS performance holds up.</li>
                      <li>Use efficiency and consistency scores to judge robustness vs. overfitting.</li>
                    </ul>
                    <p className="text-xs italic text-muted-foreground">
                      A robust strategy usually retains ~60–80% of in-sample performance out-of-sample; large drop-offs can signal overfitting.
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        }
      />

      <RobustnessMetrics
        results={results?.results ?? null}
        targetMetricLabel={targetMetricLabel}
      />
      <Card>
        <CardHeader>
          <CardTitle>Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {results && insights.length > 0 ? (
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {insights.map((insight, index) => (
                <li key={index}>{insight}</li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Run at least one analysis to surface suggestions.
            </div>
          )}
        </CardContent>
      </Card>
      <WalkForwardAnalysisChart
        periods={results?.results.periods ?? []}
        targetMetricLabel={targetMetricLabel}
      />

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Window Table</CardTitle>
              <CardDescription>
                Scan retention, drawdowns, and samples quickly. Use filters to
                surface weak slices.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!results}
                onClick={() => handleExport("csv")}
                size="sm"
              >
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                disabled={!results}
                onClick={() => handleExport("json")}
                size="sm"
              >
                <Download className="mr-2 h-4 w-4" />
                JSON
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={showFailingOnly}
                onCheckedChange={(v) => setShowFailingOnly(Boolean(v))}
              />
              <span className="text-muted-foreground">
                Only failing windows (&lt;60% retention)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                Min OOS trades
              </span>
              <div className="w-32">
                <Slider
                  min={0}
                  max={Math.max(
                    ...periodSummaries.map((p) => p.oosTrades ?? 0),
                    20
                  )}
                  step={1}
                  value={[minOosTrades]}
                  onValueChange={(v) => setMinOosTrades(v[0] ?? 0)}
                />
              </div>
              <Badge variant="secondary" className="text-xs">
                {minOosTrades}
              </Badge>
            </div>
            {periodCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  Window range
                </span>
                <div className="w-44">
                  <Slider
                    min={1}
                    max={periodCount}
                    step={1}
                    value={[periodRange[0], periodRange[1]]}
                    onValueChange={(v) => {
                      if (!v || v.length < 2) return;
                      const [a, b] = v as [number, number];
                      setPeriodRange([Math.min(a, b), Math.max(a, b)]);
                    }}
                  />
                </div>
                <Badge variant="secondary" className="text-xs">
                  {periodRange[0]}–{periodRange[1]} / {periodCount}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPeriodSummaries.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {periodSummaries.length === 0
                ? "Run the analysis to populate this table."
                : "No windows match the current filters."}
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ maxHeight: 560 }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Window</TableHead>
                    <TableHead>IS Range</TableHead>
                    <TableHead>OOS Range</TableHead>
                    <TableHead className="text-right">OOS Retention</TableHead>
                    <TableHead className="text-right">Delta</TableHead>
                    <TableHead className="text-right">OOS Trades</TableHead>
                    <TableHead className="text-right">Max DD</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeriodSummaries.map((period) => {
                    const delta =
                      period.outSampleMetric - period.inSampleMetric;
                    const deltaClass =
                      delta >= 0 ? "text-emerald-600" : "text-rose-600";
                    const StatusIcon = period.status.icon;
                    const isOpen = Boolean(openDetails[period.label]);

                    return (
                      <React.Fragment key={period.label}>
                        <TableRow>
                          <TableCell className="font-medium">
                            <button
                              className="inline-flex items-center gap-2 text-left font-semibold"
                              onClick={() =>
                                setOpenDetails((prev) => ({
                                  ...prev,
                                  [period.label]: !prev[period.label],
                                }))
                              }
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {period.label}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {period.inSampleRange}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {period.outSampleRange}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {period.efficiencyPct.toFixed(1)}%
                          </TableCell>
                          <TableCell className={cn("text-right", deltaClass)}>
                            {delta >= 0 ? "+" : ""}
                            {formatMetricValue(delta)}
                          </TableCell>
                          <TableCell className="text-right">
                            {period.oosTrades ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {period.oosDrawdown != null
                              ? `${Math.abs(period.oosDrawdown).toFixed(2)}%`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs",
                                period.status.chipClass
                              )}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {period.status.label}
                            </span>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow>
                            <TableCell colSpan={9} className="bg-muted/30">
                              <div className="grid gap-6 p-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs",
                                        period.status.chipClass
                                      )}
                                    >
                                      <period.status.icon className="h-3 w-3" />
                                      {period.status.label}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                                      <span>IS</span>
                                      <span className="font-semibold text-foreground">
                                        {formatMetricValue(
                                          period.inSampleMetric
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                                      <span>OOS</span>
                                      <span className="font-semibold text-foreground">
                                        {formatMetricValue(
                                          period.outSampleMetric
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="space-y-2 w-full max-w-full">
                                    <div
                                      className="h-2 rounded-full bg-blue-500/15"
                                      title="IS P&L scaled within this window"
                                    >
                                      <div
                                        className="h-2 rounded-full bg-blue-500"
                                        style={{
                                          width: `${
                                            miniBars.find(
                                              (m) => m.label === period.label
                                            )?.isWidth ?? 0
                                          }%`,
                                        }}
                                      />
                                    </div>
                                    <div
                                      className="h-2 rounded-full bg-orange-500/15"
                                      title="OOS P&L scaled within this window"
                                    >
                                      <div
                                        className="h-2 rounded-full bg-orange-500"
                                        style={{
                                          width: `${
                                            miniBars.find(
                                              (m) => m.label === period.label
                                            )?.oosWidth ?? 0
                                          }%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground">
                                    Winning parameters
                                  </p>
                                  {period.parameters.length ? (
                                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                                      {period.parameters.map((item) => (
                                        <div
                                          key={`${period.label}-${item}`}
                                          className="flex items-center justify-between rounded-md bg-muted px-2 py-1 text-[11px]"
                                        >
                                          <span className="font-mono text-foreground/80">
                                            {item.split(":")[0]}:
                                          </span>
                                          <span className="font-mono text-foreground">
                                            {item
                                              .split(":")
                                              .slice(1)
                                              .join(":")
                                              .trim()}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      No parameter adjustments captured.
                                    </p>
                                  )}
                                </div>
                                <div className="col-span-full text-[11px] text-muted-foreground space-y-1">
                                  <div>
                                    Bar length shows relative |P&L| within this
                                    window (IS vs OOS).
                                  </div>
                                  <div className="text-muted-foreground/80">
                                    Note: Only the winning combo per window is
                                    stored; non-winning parameter tries are not
                                    persisted.
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
