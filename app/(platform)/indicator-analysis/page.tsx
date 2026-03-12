"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Data, Layout } from "plotly.js";

import {
  cn,
  getTradesByBlock,
  matchTradesToDataset,
  pearsonCorrelation,
  getRanks,
} from "@tradeblocks/lib";
import type { StaticDataset, Trade } from "@tradeblocks/lib";
import { useBlockStore, useStaticDatasetsStore } from "@tradeblocks/lib/stores";

import { MetricCard } from "@/components/metric-card";
import { NoActiveBlock } from "@/components/no-active-block";
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Statistics helpers (pure functions, no external stats lib)
// ============================================================

function sigStars(p: number): string {
  if (p < 0.001) return " ***";
  if (p < 0.01) return " **";
  if (p < 0.05) return " *";
  return "";
}

/** Spearman rank correlation with approximate two-tailed p-value */
function spearmanR(
  x: number[],
  y: number[]
): { rho: number; pValue: number; n: number } {
  const n = x.length;
  if (n < 4) return { rho: NaN, pValue: NaN, n };
  const rankX = getRanks(x);
  const rankY = getRanks(y);
  const rho = pearsonCorrelation(rankX, rankY);
  // t distribution approximation
  const tStat = rho * Math.sqrt((n - 2) / Math.max(1 - rho * rho, 1e-12));
  // Two-tailed p-value via normal approximation (adequate for n > 10)
  const pValue = Math.min(1, 2 * (1 - normalCDF(Math.abs(tStat))));
  return { rho, pValue, n };
}

/** Standard normal CDF (Abramowitz & Stegun approximation) */
function normalCDF(x: number): number {
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-x * x)));
}

/** Normalised mutual information (0 = independent, 1 = perfect) */
function mutualInformation(x: number[], y: number[], k: number): number {
  const n = x.length;
  if (n < 2 * k) return NaN;

  const rankX = getRanks(x);
  const rankY = getRanks(y);

  // Map ranks to equal-frequency bin indices
  const binOf = (rank: number) =>
    Math.min(k - 1, Math.floor((rank / n) * k));

  // Joint count matrix
  const joint: number[][] = Array.from({ length: k }, () =>
    new Array(k).fill(0)
  );
  for (let i = 0; i < n; i++) {
    joint[binOf(rankX[i])][binOf(rankY[i])]++;
  }

  // Marginals
  const px = joint.map((row) => row.reduce((s, v) => s + v, 0) / n);
  const py = Array.from({ length: k }, (_, j) =>
    joint.reduce((s, row) => s + row[j], 0) / n
  );

  let mi = 0;
  let hy = 0;
  for (let i = 0; i < k; i++) {
    if (px[i] > 0) {
      for (let j = 0; j < k; j++) {
        const pij = joint[i][j] / n;
        if (pij > 0) {
          mi += pij * Math.log2(pij / (px[i] * py[j]));
        }
      }
    }
    if (py[i] > 0) hy -= py[i] * Math.log2(py[i]);
  }
  return hy > 0 ? Math.max(0, Math.min(1, mi / hy)) : 0;
}

/** Two-sample KS test splitting on indicator median */
function ksTest(
  indicatorValues: number[],
  plValues: number[]
): { d: number; pValue: number } {
  const n = indicatorValues.length;
  if (n < 4) return { d: 0, pValue: 1 };

  const sorted = [...indicatorValues].sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)];

  const group1: number[] = [];
  const group2: number[] = [];
  for (let i = 0; i < n; i++) {
    if (indicatorValues[i] <= median) group1.push(plValues[i]);
    else group2.push(plValues[i]);
  }
  if (group1.length === 0 || group2.length === 0) return { d: 0, pValue: 1 };

  group1.sort((a, b) => a - b);
  group2.sort((a, b) => a - b);

  // Merge and compute empirical CDFs
  const allVals = [...new Set([...group1, ...group2])].sort((a, b) => a - b);
  const n1 = group1.length,
    n2 = group2.length;
  let d = 0,
    i1 = 0,
    i2 = 0;
  for (const v of allVals) {
    while (i1 < n1 && group1[i1] <= v) i1++;
    while (i2 < n2 && group2[i2] <= v) i2++;
    d = Math.max(d, Math.abs(i1 / n1 - i2 / n2));
  }

  // Kolmogorov approximation
  const nEff = (n1 * n2) / (n1 + n2);
  const lambda =
    (Math.sqrt(nEff) + 0.12 + 0.11 / Math.sqrt(nEff)) * d;
  const pValue = Math.min(1, 2 * Math.exp(-2 * lambda * lambda));
  return { d, pValue };
}

// ============================================================
// Bin types and builder
// ============================================================

interface BinResult {
  label: string;
  min: number;
  max: number;
  plValues: number[];
  indicatorValues: number[];
}

function buildEqualFreqBins(
  pairs: Array<{ indicatorValue: number; plValue: number }>,
  numBins: number
): BinResult[] {
  if (pairs.length === 0) return [];
  const sorted = [...pairs].sort((a, b) => a.indicatorValue - b.indicatorValue);
  const n = sorted.length;
  const bins: BinResult[] = [];
  const chunkSize = Math.ceil(n / numBins);

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(v);

  for (let i = 0; i < numBins; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, n);
    if (start >= n) break;
    const chunk = sorted.slice(start, end);
    const min = chunk[0].indicatorValue;
    const max = chunk[chunk.length - 1].indicatorValue;
    bins.push({
      label: `Bin ${i + 1}\n${fmt(min)} – ${fmt(max)}`,
      min,
      max,
      plValues: chunk.map((p) => p.plValue),
      indicatorValues: chunk.map((p) => p.indicatorValue),
    });
  }
  return bins;
}

// ============================================================
// Types
// ============================================================

interface AnalysisResult {
  bins: BinResult[];
  pairs: Array<{
    indicatorValue: number;
    plValue: number;
    dateOpened: Date;
  }>;
  spearman: { rho: number; pValue: number; n: number };
  mi: number;
  ks: { d: number; pValue: number };
  selectedColumn: string;
  numBins: number;
}

// ============================================================
// OLS helper (inline, no external lib)
// ============================================================

function olsSlope(
  x: number[],
  y: number[]
): { slope: number; intercept: number } {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0 };
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ============================================================
// Component
// ============================================================

const BIN_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#14b8a6",
];

export default function IndicatorAnalysisPage() {
  // --- Store ---
  const activeBlockId = useBlockStore((s) => s.activeBlockId);
  const datasets = useStaticDatasetsStore((s) => s.datasets);
  const dsInitialized = useStaticDatasetsStore((s) => s.isInitialized);
  const loadDatasets = useStaticDatasetsStore((s) => s.loadDatasets);
  const getDatasetRows = useStaticDatasetsStore((s) => s.getDatasetRows);

  // --- Local state ---
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [plMetric, setPlMetric] = useState<"total" | "perContract">("total");
  const [numBins, setNumBins] = useState(5);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [isRunning, setIsRunning] = useState(false);
  const [tooFewMatches, setTooFewMatches] = useState(false);

  // --- Init datasets store ---
  useEffect(() => {
    if (!dsInitialized) loadDatasets().catch(console.error);
  }, [dsInitialized, loadDatasets]);

  // --- Load trades when active block changes ---
  useEffect(() => {
    if (!activeBlockId) {
      setTrades([]);
      setAnalysisResult(null);
      return;
    }
    setTradesLoading(true);
    setAnalysisResult(null);
    getTradesByBlock(activeBlockId)
      .then(setTrades)
      .catch(console.error)
      .finally(() => setTradesLoading(false));
  }, [activeBlockId]);

  // --- Reset column when dataset changes ---
  useEffect(() => {
    setSelectedColumn("");
    setAnalysisResult(null);
    setTooFewMatches(false);
  }, [selectedDatasetId]);

  // --- Derived ---
  const selectedDataset: StaticDataset | null = useMemo(
    () => datasets.find((d) => d.id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId]
  );

  const canRun = Boolean(
    activeBlockId &&
      selectedDataset &&
      selectedColumn &&
      trades.length > 0 &&
      !tradesLoading
  );

  // --- Run analysis ---
  const runAnalysis = useCallback(async () => {
    if (!activeBlockId || !selectedDataset || !selectedColumn) return;
    setIsRunning(true);
    setTooFewMatches(false);
    try {
      const rows = await getDatasetRows(selectedDataset.id);
      const matchResults = matchTradesToDataset(trades, selectedDataset, rows);

      // Positional zip: matchResults[i] corresponds to trades[i]
      const pairs = trades
        .map((trade, i) => ({ trade, match: matchResults[i] }))
        .filter(({ match }) => match.matchedRow !== null)
        .flatMap(({ trade, match }) => {
          const raw = match.matchedRow!.values[selectedColumn];
          const iv = typeof raw === "number" ? raw : parseFloat(String(raw));
          if (!isFinite(iv)) return [];
          const pl =
            plMetric === "total"
              ? trade.pl
              : trade.pl / Math.max(1, trade.numContracts);
          return [
            {
              indicatorValue: iv,
              plValue: pl,
              dateOpened: trade.dateOpened,
            },
          ];
        });

      if (pairs.length < 4) {
        setTooFewMatches(true);
        setAnalysisResult(null);
        return;
      }

      const xArr = pairs.map((p) => p.indicatorValue);
      const yArr = pairs.map((p) => p.plValue);

      setAnalysisResult({
        bins: buildEqualFreqBins(
          pairs.map((p) => ({
            indicatorValue: p.indicatorValue,
            plValue: p.plValue,
          })),
          numBins
        ),
        pairs,
        spearman: spearmanR(xArr, yArr),
        mi: mutualInformation(xArr, yArr, numBins),
        ks: ksTest(xArr, yArr),
        selectedColumn,
        numBins,
      });
    } catch (err) {
      console.error("Indicator analysis failed:", err);
    } finally {
      setIsRunning(false);
    }
  }, [
    activeBlockId,
    selectedDataset,
    selectedColumn,
    trades,
    plMetric,
    numBins,
    getDatasetRows,
  ]);

  // --- Bin table rows ---
  const binTableRows = useMemo(() => {
    if (!analysisResult) return [];
    return analysisResult.bins.map((bin, i) => {
      const pnls = bin.plValues;
      const wins = pnls.filter((v) => v > 0).length;
      const avgPl = pnls.reduce((s, v) => s + v, 0) / pnls.length;
      const sortedPnl = [...pnls].sort((a, b) => a - b);
      const mid = Math.floor(sortedPnl.length / 2);
      const median =
        sortedPnl.length % 2 === 0
          ? (sortedPnl[mid - 1] + sortedPnl[mid]) / 2
          : sortedPnl[mid];
      const variance =
        pnls.reduce((s, v) => s + (v - avgPl) ** 2, 0) / pnls.length;
      return {
        binNum: i + 1,
        label: bin.label.replace("\n", " "),
        count: pnls.length,
        avgPl,
        winRate: (wins / pnls.length) * 100,
        median,
        stdDev: Math.sqrt(variance),
      };
    });
  }, [analysisResult]);

  // --- Summary stats ---
  const summaryStats = useMemo(() => {
    if (!analysisResult) return null;
    const { spearman, mi, ks } = analysisResult;
    const fmtP = (p: number) =>
      p < 0.0001
        ? "p < 0.0001"
        : `p = ${p.toFixed(4)}`;
    return {
      spearman: {
        value: isFinite(spearman.rho) ? spearman.rho.toFixed(3) : "N/A",
        subtitle: isFinite(spearman.pValue)
          ? `${fmtP(spearman.pValue)}${sigStars(spearman.pValue)}  n = ${spearman.n}`
          : "Insufficient data",
        isPositive: (spearman.rho ?? 0) > 0,
      },
      mi: {
        value: isFinite(mi) ? mi.toFixed(3) : "N/A",
        subtitle: "Normalized MI (0 = none, 1 = perfect)",
        isPositive: isFinite(mi) && mi > 0.05,
      },
      ks: {
        value: isFinite(ks.d) ? ks.d.toFixed(3) : "N/A",
        subtitle: isFinite(ks.pValue)
          ? `${fmtP(ks.pValue)}${sigStars(ks.pValue)}`
          : "Insufficient data",
        isPositive: isFinite(ks.pValue) && ks.pValue < 0.05,
      },
    };
  }, [analysisResult]);

  // --- Violin / Box chart ---
  const [violinData, violinLayout] = useMemo((): [
    Data[],
    Partial<Layout>,
  ] => {
    if (!analysisResult) return [[], {}];
    const { bins } = analysisResult;
    const traces: Data[] = bins.map((bin, i) => {
      const useViolin = bin.plValues.length >= 10;
      return {
        type: useViolin ? "violin" : "box",
        y: bin.plValues,
        name: bin.label.replace("\n", " "),
        marker: { color: BIN_COLORS[i % BIN_COLORS.length] },
        ...(useViolin
          ? { box: { visible: true }, meanline: { visible: true } }
          : {}),
      } as Data;
    });
    const layout: Partial<Layout> = {
      xaxis: { title: { text: analysisResult.selectedColumn } },
      yaxis: { title: { text: "P&L" }, zeroline: true },
      showlegend: false,
    };
    return [traces, layout];
  }, [analysisResult]);

  // --- Scatter + OLS chart ---
  const [scatterData, scatterLayout] = useMemo((): [
    Data[],
    Partial<Layout>,
  ] => {
    if (!analysisResult) return [[], {}];
    const { bins, pairs } = analysisResult;

    const scatterTraces: Data[] = bins.map((bin, i) => ({
      type: "scatter",
      mode: "markers",
      name: bin.label.replace("\n", " "),
      x: bin.indicatorValues,
      y: bin.plValues,
      marker: {
        color: BIN_COLORS[i % BIN_COLORS.length],
        size: 6,
        opacity: 0.7,
      },
    }));

    const xAll = pairs.map((p) => p.indicatorValue);
    const yAll = pairs.map((p) => p.plValue);
    const { slope, intercept } = olsSlope(xAll, yAll);
    const xMin = Math.min(...xAll);
    const xMax = Math.max(...xAll);

    const trendTrace: Data = {
      type: "scatter",
      mode: "lines",
      name: "Trend (OLS)",
      x: [xMin, xMax],
      y: [slope * xMin + intercept, slope * xMax + intercept],
      line: { color: "#94a3b8", dash: "dash", width: 2 },
    };

    const layout: Partial<Layout> = {
      xaxis: { title: { text: analysisResult.selectedColumn } },
      yaxis: { title: { text: "P&L" }, zeroline: true },
      showlegend: true,
      hovermode: "closest",
    };

    return [[...scatterTraces, trendTrace], layout];
  }, [analysisResult]);

  // --- Rolling correlation chart ---
  const [rollingData, rollingLayout] = useMemo((): [
    Data[],
    Partial<Layout>,
  ] => {
    if (!analysisResult) return [[], {}];
    const { pairs } = analysisResult;

    const sorted = [...pairs].sort(
      (a, b) => a.dateOpened.getTime() - b.dateOpened.getTime()
    );
    if (sorted.length < 30) return [[], {}];

    const WINDOW = 30;
    const xDates: string[] = [];
    const yCorrs: number[] = [];

    for (let i = WINDOW - 1; i < sorted.length; i++) {
      const win = sorted.slice(i - WINDOW + 1, i + 1);
      const wx = win.map((p) => p.indicatorValue);
      const wy = win.map((p) => p.plValue);
      const { rho } = spearmanR(wx, wy);
      if (isFinite(rho)) {
        // Use local date string to preserve calendar date (Eastern Time)
        const d = sorted[i].dateOpened;
        xDates.push(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        );
        yCorrs.push(rho);
      }
    }

    if (xDates.length === 0) return [[], {}];

    const trace: Data = {
      type: "scatter",
      mode: "lines",
      name: "Rolling Spearman r",
      x: xDates,
      y: yCorrs,
      line: { color: "#3b82f6", width: 2 },
    };

    const layout: Partial<Layout> = {
      xaxis: { title: { text: "Date" } },
      yaxis: { title: { text: "Spearman r" }, range: [-1, 1], zeroline: true },
      showlegend: false,
      shapes: [
        {
          type: "line",
          x0: xDates[0],
          x1: xDates[xDates.length - 1],
          y0: 0,
          y1: 0,
          line: { color: "#94a3b8", dash: "dot", width: 1 },
        },
      ],
    };

    return [[trace], layout];
  }, [analysisResult]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            {/* Dataset */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Dataset</label>
              <Select
                value={selectedDatasetId}
                onValueChange={setSelectedDatasetId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select dataset…" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Indicator Column */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Indicator Column</label>
              <Select
                value={selectedColumn}
                onValueChange={setSelectedColumn}
                disabled={!selectedDatasetId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select column…" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedDataset?.columns ?? []).map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* P&L Metric */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">P&L Metric</label>
              <Select
                value={plMetric}
                onValueChange={(v) =>
                  setPlMetric(v as "total" | "perContract")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Total P&L</SelectItem>
                  <SelectItem value="perContract">P&L per Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bins */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Bins</label>
              <Select
                value={String(numBins)}
                onValueChange={(v) => setNumBins(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5 (default)</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={runAnalysis} disabled={!canRun || isRunning}>
              {isRunning ? "Running…" : "Run Analysis"}
            </Button>
            {tradesLoading && (
              <span className="text-sm text-muted-foreground">
                Loading trades…
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* No active block */}
      {!activeBlockId ? (
        <NoActiveBlock description="Select a block to run indicator correlation analysis." />
      ) : (
        <>
          {/* Too few matches warning */}
          {tooFewMatches && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardContent className="pt-4 text-sm text-amber-700 dark:text-amber-400">
                Not enough matched trades (&lt; 4) for the selected indicator
                column. Check that the dataset date range overlaps with your
                block and that the column contains numeric values.
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {analysisResult && summaryStats && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <MetricCard
                  title="Spearman r"
                  value={summaryStats.spearman.value}
                  subtitle={summaryStats.spearman.subtitle}
                  isPositive={summaryStats.spearman.isPositive}
                  format="decimal"
                  decimalPlaces={3}
                />
                <MetricCard
                  title="Mutual Information"
                  value={summaryStats.mi.value}
                  subtitle={summaryStats.mi.subtitle}
                  isPositive={summaryStats.mi.isPositive}
                  format="decimal"
                  decimalPlaces={3}
                />
                <MetricCard
                  title="KS Statistic"
                  value={summaryStats.ks.value}
                  subtitle={summaryStats.ks.subtitle}
                  isPositive={summaryStats.ks.isPositive}
                  format="decimal"
                  decimalPlaces={3}
                />
              </div>

              {/* Bin table */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Bin Summary — {analysisResult.selectedColumn}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4">Bin</th>
                          <th className="pb-2 pr-4">Range</th>
                          <th className="pb-2 pr-4">Trades</th>
                          <th className="pb-2 pr-4">Avg P&L</th>
                          <th className="pb-2 pr-4">Win %</th>
                          <th className="pb-2 pr-4">Median P&L</th>
                          <th className="pb-2">Std Dev</th>
                        </tr>
                      </thead>
                      <tbody>
                        {binTableRows.map((row) => (
                          <tr
                            key={row.binNum}
                            className="border-b last:border-0"
                          >
                            <td className="py-2 pr-4 font-medium">
                              {row.binNum}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {row.label}
                            </td>
                            <td className="py-2 pr-4">{row.count}</td>
                            <td
                              className={cn(
                                "py-2 pr-4 font-medium",
                                row.avgPl >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              )}
                            >
                              {row.avgPl.toFixed(2)}
                            </td>
                            <td className="py-2 pr-4">
                              {row.winRate.toFixed(1)}%
                            </td>
                            <td className="py-2 pr-4">
                              {row.median.toFixed(2)}
                            </td>
                            <td className="py-2">{row.stdDev.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Violin / Box chart */}
              <ChartWrapper
                title="P&L Distribution by Bin"
                description="Equal-frequency bins. Violin when n ≥ 10 per bin, box otherwise."
                data={violinData}
                layout={violinLayout}
              />

              {/* Scatter + OLS */}
              <ChartWrapper
                title={`Indicator vs P&L — ${analysisResult.selectedColumn}`}
                description="Each point is a matched trade. Dashed line is OLS regression."
                data={scatterData}
                layout={scatterLayout}
              />

              {/* Rolling correlation */}
              {rollingData.length > 0 && (
                <ChartWrapper
                  title="Rolling Correlation (30-trade window)"
                  description="Spearman r over a sliding window of 30 trades, sorted by open date."
                  data={rollingData}
                  layout={rollingLayout}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
