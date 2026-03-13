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
import type { StaticDataset, StaticDatasetRow, Trade } from "@tradeblocks/lib";
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
// Statistics helpers
// ============================================================

function sigStars(p: number): string {
  if (p < 0.001) return " ***";
  if (p < 0.01) return " **";
  if (p < 0.05) return " *";
  return "";
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
  const tStat = rho * Math.sqrt((n - 2) / Math.max(1 - rho * rho, 1e-12));
  const pValue = Math.min(1, 2 * (1 - normalCDF(Math.abs(tStat))));
  return { rho, pValue, n };
}

/** Normalised mutual information (0 = independent, 1 = perfect) */
function mutualInformation(x: number[], y: number[], k: number): number {
  const n = x.length;
  if (n < 2 * k) return NaN;
  const rankX = getRanks(x);
  const rankY = getRanks(y);
  const binOf = (rank: number) => Math.min(k - 1, Math.floor((rank / n) * k));
  const joint: number[][] = Array.from({ length: k }, () =>
    new Array(k).fill(0)
  );
  for (let i = 0; i < n; i++) joint[binOf(rankX[i])][binOf(rankY[i])]++;
  const px = joint.map((row) => row.reduce((s, v) => s + v, 0) / n);
  const py = Array.from({ length: k }, (_, j) =>
    joint.reduce((s, row) => s + row[j], 0) / n
  );
  let mi = 0, hy = 0;
  for (let i = 0; i < k; i++) {
    if (px[i] > 0)
      for (let j = 0; j < k; j++) {
        const pij = joint[i][j] / n;
        if (pij > 0) mi += pij * Math.log2(pij / (px[i] * py[j]));
      }
    if (py[i] > 0) hy -= py[i] * Math.log2(py[i]);
  }
  return hy > 0 ? Math.max(0, Math.min(1, mi / hy)) : 0;
}

/** Two-sample KS test splitting on X median */
function ksTest(
  xValues: number[],
  yValues: number[]
): { d: number; pValue: number } {
  const n = xValues.length;
  if (n < 4) return { d: 0, pValue: 1 };
  const sorted = [...xValues].sort((a, b) => a - b);
  const median = sorted[Math.floor(n / 2)];
  const group1: number[] = [], group2: number[] = [];
  for (let i = 0; i < n; i++)
    (xValues[i] <= median ? group1 : group2).push(yValues[i]);
  if (!group1.length || !group2.length) return { d: 0, pValue: 1 };
  group1.sort((a, b) => a - b);
  group2.sort((a, b) => a - b);
  const allVals = [...new Set([...group1, ...group2])].sort((a, b) => a - b);
  const n1 = group1.length, n2 = group2.length;
  let d = 0, i1 = 0, i2 = 0;
  for (const v of allVals) {
    while (i1 < n1 && group1[i1] <= v) i1++;
    while (i2 < n2 && group2[i2] <= v) i2++;
    d = Math.max(d, Math.abs(i1 / n1 - i2 / n2));
  }
  const nEff = (n1 * n2) / (n1 + n2);
  const lambda = (Math.sqrt(nEff) + 0.12 + 0.11 / Math.sqrt(nEff)) * d;
  return { d, pValue: Math.min(1, 2 * Math.exp(-2 * lambda * lambda)) };
}

/**
 * Two-sided one-sample t-test H₀: μ = 0
 * t = mean / (std / √n), p = 2*(1 - Φ(|t|))
 */
function tTestOneSample(values: number[]): { t: number; pValue: number } {
  const n = values.length;
  if (n < 2) return { t: NaN, pValue: NaN };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  if (std < 1e-12) return { t: Infinity, pValue: 0 };
  const t = mean / (std / Math.sqrt(n));
  return { t, pValue: Math.min(1, 2 * (1 - normalCDF(Math.abs(t)))) };
}

// ============================================================
// Bin types and builder
// ============================================================

interface BinResult {
  label: string;
  min: number;
  max: number;
  yValues: number[];
  xValues: number[];
}

function buildEqualFreqBins(
  pairs: Array<{ xValue: number; yValue: number }>,
  numBins: number
): BinResult[] {
  if (!pairs.length) return [];
  const sorted = [...pairs].sort((a, b) => a.xValue - b.xValue);
  const n = sorted.length;
  const chunkSize = Math.ceil(n / numBins);
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(v);
  const bins: BinResult[] = [];
  for (let i = 0; i < numBins; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, n);
    if (start >= n) break;
    const chunk = sorted.slice(start, end);
    bins.push({
      label: `Bin ${i + 1}\n${fmt(chunk[0].xValue)} – ${fmt(chunk[chunk.length - 1].xValue)}`,
      min: chunk[0].xValue,
      max: chunk[chunk.length - 1].xValue,
      yValues: chunk.map((p) => p.yValue),
      xValues: chunk.map((p) => p.xValue),
    });
  }
  return bins;
}

// ============================================================
// OLS helper
// ============================================================

function olsSlope(x: number[], y: number[]): { slope: number; intercept: number } {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0 };
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  return { slope, intercept: (sumY - slope * sumX) / n };
}

// ============================================================
// Types
// ============================================================

type AxisSource = "dataset" | "trade-pl";

interface AnalysisResult {
  bins: BinResult[];
  pairs: Array<{ xValue: number; yValue: number; date: Date }>;
  spearman: { rho: number; pValue: number; n: number };
  mi: number;
  ks: { d: number; pValue: number };
  xLabel: string;
  yLabel: string;
  yIsPl: boolean;
  numBins: number;
}

// ============================================================
// Date helpers
// ============================================================

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function joinDatasetsByDate(
  rowsX: StaticDatasetRow[],
  colX: string,
  rowsY: StaticDatasetRow[],
  colY: string
): Array<{ xValue: number; yValue: number; date: Date }> {
  const mapY = new Map<string, number>();
  for (const row of rowsY) {
    const raw = row.values[colY];
    const v = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (isFinite(v)) mapY.set(dateKey(row.timestamp), v);
  }
  const pairs: Array<{ xValue: number; yValue: number; date: Date }> = [];
  for (const row of rowsX) {
    const raw = row.values[colX];
    const xv = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (!isFinite(xv)) continue;
    const yv = mapY.get(dateKey(row.timestamp));
    if (yv === undefined) continue;
    pairs.push({ xValue: xv, yValue: yv, date: row.timestamp });
  }
  return pairs;
}

// ============================================================
// Constants
// ============================================================

const BIN_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#14b8a6",
];

// ============================================================
// Sub-component: Dataset + Column selector
// ============================================================

function DatasetColumnSelect({
  label,
  datasets,
  datasetId,
  column,
  onDatasetChange,
  onColumnChange,
}: {
  label: string;
  datasets: StaticDataset[];
  datasetId: string;
  column: string;
  onDatasetChange: (v: string) => void;
  onColumnChange: (v: string) => void;
}) {
  const ds = datasets.find((d) => d.id === datasetId) ?? null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label} — Dataset
        </label>
        <Select value={datasetId} onValueChange={onDatasetChange}>
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
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label} — Column
        </label>
        <Select value={column} onValueChange={onColumnChange} disabled={!datasetId}>
          <SelectTrigger>
            <SelectValue placeholder="Select column…" />
          </SelectTrigger>
          <SelectContent>
            {(ds?.columns ?? []).map((col) => (
              <SelectItem key={col} value={col}>{col}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export default function IndicatorAnalysisPage() {
  // --- Store ---
  const activeBlockId = useBlockStore((s) => s.activeBlockId);
  const datasets = useStaticDatasetsStore((s) => s.datasets);
  const dsInitialized = useStaticDatasetsStore((s) => s.isInitialized);
  const loadDatasets = useStaticDatasetsStore((s) => s.loadDatasets);
  const getDatasetRows = useStaticDatasetsStore((s) => s.getDatasetRows);

  // --- Axis state ---
  const [xSource, setXSource] = useState<AxisSource>("dataset");
  const [xDatasetId, setXDatasetId] = useState("");
  const [xColumn, setXColumn] = useState("");

  const [ySource, setYSource] = useState<AxisSource>("trade-pl");
  const [yDatasetId, setYDatasetId] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [yPlMetric, setYPlMetric] = useState<"total" | "perContract">("total");

  const [numBins, setNumBins] = useState(5);

  // --- UI toggles ---
  const [showTimeSeries, setShowTimeSeries] = useState(false);

  // --- Trade state ---
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  // --- Result state ---
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [tooFewMatches, setTooFewMatches] = useState(false);

  // --- Init ---
  useEffect(() => {
    if (!dsInitialized) loadDatasets().catch(console.error);
  }, [dsInitialized, loadDatasets]);

  const needsTrades = xSource === "trade-pl" || ySource === "trade-pl";

  useEffect(() => {
    if (!needsTrades || !activeBlockId) { setTrades([]); return; }
    setTradesLoading(true);
    setAnalysisResult(null);
    getTradesByBlock(activeBlockId)
      .then(setTrades)
      .catch(console.error)
      .finally(() => setTradesLoading(false));
  }, [activeBlockId, needsTrades]);

  useEffect(() => { setXColumn(""); setAnalysisResult(null); setTooFewMatches(false); }, [xDatasetId]);
  useEffect(() => { setYColumn(""); setAnalysisResult(null); setTooFewMatches(false); }, [yDatasetId]);
  useEffect(() => { setAnalysisResult(null); setTooFewMatches(false); }, [xSource, ySource]);

  // --- canRun ---
  const xReady = xSource === "trade-pl"
    ? Boolean(activeBlockId && trades.length > 0 && !tradesLoading)
    : Boolean(xDatasetId && xColumn);
  const yReady = ySource === "trade-pl"
    ? Boolean(activeBlockId && trades.length > 0 && !tradesLoading)
    : Boolean(yDatasetId && yColumn);
  const canRun = xReady && yReady && !isRunning;

  // --- Derived ---
  const xDataset = useMemo(() => datasets.find((d) => d.id === xDatasetId) ?? null, [datasets, xDatasetId]);
  const yDataset = useMemo(() => datasets.find((d) => d.id === yDatasetId) ?? null, [datasets, yDatasetId]);

  const xLabel = xSource === "trade-pl" ? "Trade P&L" : xColumn || xDataset?.name || "X";
  const yLabel = ySource === "trade-pl"
    ? (yPlMetric === "total" ? "P&L (Total)" : "P&L (per Contract)")
    : yColumn || yDataset?.name || "Y";

  // --- Run analysis ---
  const runAnalysis = useCallback(async () => {
    setIsRunning(true);
    setTooFewMatches(false);
    try {
      let pairs: Array<{ xValue: number; yValue: number; date: Date }> = [];

      if (xSource === "dataset" && ySource === "trade-pl") {
        if (!xDataset || !xColumn || !activeBlockId) return;
        const rows = await getDatasetRows(xDataset.id);
        const matchResults = matchTradesToDataset(trades, xDataset, rows);
        pairs = trades
          .map((trade, i) => ({ trade, match: matchResults[i] }))
          .filter(({ match }) => match.matchedRow !== null)
          .flatMap(({ trade, match }) => {
            const raw = match.matchedRow!.values[xColumn];
            const xv = typeof raw === "number" ? raw : parseFloat(String(raw));
            if (!isFinite(xv)) return [];
            const yv = yPlMetric === "total" ? trade.pl : trade.pl / Math.max(1, trade.numContracts);
            return [{ xValue: xv, yValue: yv, date: trade.dateOpened }];
          });
      } else if (xSource === "trade-pl" && ySource === "dataset") {
        if (!yDataset || !yColumn || !activeBlockId) return;
        const rows = await getDatasetRows(yDataset.id);
        const matchResults = matchTradesToDataset(trades, yDataset, rows);
        pairs = trades
          .map((trade, i) => ({ trade, match: matchResults[i] }))
          .filter(({ match }) => match.matchedRow !== null)
          .flatMap(({ trade, match }) => {
            const raw = match.matchedRow!.values[yColumn];
            const yv = typeof raw === "number" ? raw : parseFloat(String(raw));
            if (!isFinite(yv)) return [];
            const xv = yPlMetric === "total" ? trade.pl : trade.pl / Math.max(1, trade.numContracts);
            return [{ xValue: xv, yValue: yv, date: trade.dateOpened }];
          });
      } else if (xSource === "dataset" && ySource === "dataset") {
        if (!xDataset || !xColumn || !yDataset || !yColumn) return;
        const [rowsX, rowsY] = await Promise.all([
          getDatasetRows(xDataset.id),
          getDatasetRows(yDataset.id),
        ]);
        pairs = joinDatasetsByDate(rowsX, xColumn, rowsY, yColumn);
      } else {
        if (!activeBlockId || !trades.length) return;
        pairs = trades
          .filter((t) => isFinite(t.pl))
          .map((t) => ({ xValue: t.pl / Math.max(1, t.numContracts), yValue: t.pl, date: t.dateOpened }));
      }

      if (pairs.length < 4) { setTooFewMatches(true); setAnalysisResult(null); return; }

      const xArr = pairs.map((p) => p.xValue);
      const yArr = pairs.map((p) => p.yValue);

      setAnalysisResult({
        bins: buildEqualFreqBins(pairs.map((p) => ({ xValue: p.xValue, yValue: p.yValue })), numBins),
        pairs,
        spearman: spearmanR(xArr, yArr),
        mi: mutualInformation(xArr, yArr, numBins),
        ks: ksTest(xArr, yArr),
        xLabel, yLabel,
        yIsPl: ySource === "trade-pl",
        numBins,
      });
    } catch (err) {
      console.error("Indicator analysis failed:", err);
    } finally {
      setIsRunning(false);
    }
  }, [xSource, ySource, xDataset, xColumn, yDataset, yColumn, yPlMetric, trades, activeBlockId, numBins, xLabel, yLabel, getDatasetRows]);

  // --- Bin table rows (with Sharpe + p-value) ---
  const binTableRows = useMemo(() => {
    if (!analysisResult) return [];
    return analysisResult.bins.map((bin, i) => {
      const ys = bin.yValues;
      const n = ys.length;
      const wins = ys.filter((v) => v > 0).length;
      const avgY = ys.reduce((s, v) => s + v, 0) / n;
      const sortedY = [...ys].sort((a, b) => a - b);
      const mid = Math.floor(sortedY.length / 2);
      const median = sortedY.length % 2 === 0
        ? (sortedY[mid - 1] + sortedY[mid]) / 2
        : sortedY[mid];
      // Population std for Sharpe (consistent with bin display)
      const variance = ys.reduce((s, v) => s + (v - avgY) ** 2, 0) / n;
      const stdDev = Math.sqrt(variance);
      const sharpe = stdDev > 1e-12 ? avgY / stdDev : NaN;
      // Two-sided t-test H₀: μ = 0 (uses sample std, n-1)
      const { pValue } = tTestOneSample(ys);
      return { binNum: i + 1, label: bin.label.replace("\n", " "), count: n, avgY, winRate: (wins / n) * 100, median, stdDev, sharpe, pValue };
    });
  }, [analysisResult]);

  // --- Summary stats cards ---
  const summaryStats = useMemo(() => {
    if (!analysisResult) return null;
    const { spearman, mi, ks } = analysisResult;
    const fmtP = (p: number) => p < 0.0001 ? "p < 0.0001" : `p = ${p.toFixed(4)}`;
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

  // --- Time series charts (X over time, Y over time) ---
  const [tsXData, tsXLayout] = useMemo((): [Data[], Partial<Layout>] => {
    if (!analysisResult) return [[], {}];
    const sorted = [...analysisResult.pairs].sort((a, b) => a.date.getTime() - b.date.getTime());
    return [
      [{
        type: "scatter",
        mode: "lines+markers",
        name: analysisResult.xLabel,
        x: sorted.map((p) => dateKey(p.date)),
        y: sorted.map((p) => p.xValue),
        line: { color: "#3b82f6", width: 1.5 },
        marker: { size: 3 },
      } as Data],
      {
        xaxis: { title: { text: "Date" } },
        yaxis: { title: { text: analysisResult.xLabel }, zeroline: false },
        showlegend: false,
        hovermode: "x unified",
      },
    ];
  }, [analysisResult]);

  const [tsYData, tsYLayout] = useMemo((): [Data[], Partial<Layout>] => {
    if (!analysisResult) return [[], {}];
    const sorted = [...analysisResult.pairs].sort((a, b) => a.date.getTime() - b.date.getTime());
    return [
      [{
        type: "scatter",
        mode: "lines+markers",
        name: analysisResult.yLabel,
        x: sorted.map((p) => dateKey(p.date)),
        y: sorted.map((p) => p.yValue),
        line: { color: "#10b981", width: 1.5 },
        marker: { size: 3 },
        fill: analysisResult.yIsPl ? "tozeroy" : undefined,
        fillcolor: analysisResult.yIsPl ? "rgba(16,185,129,0.08)" : undefined,
      } as Data],
      {
        xaxis: { title: { text: "Date" } },
        yaxis: { title: { text: analysisResult.yLabel }, zeroline: analysisResult.yIsPl },
        showlegend: false,
        hovermode: "x unified",
      },
    ];
  }, [analysisResult]);

  // --- Violin / Box chart ---
  const [violinData, violinLayout] = useMemo((): [Data[], Partial<Layout>] => {
    if (!analysisResult) return [[], {}];
    const traces: Data[] = analysisResult.bins.map((bin, i) => ({
      type: bin.yValues.length >= 10 ? "violin" : "box",
      y: bin.yValues,
      name: bin.label.replace("\n", " "),
      marker: { color: BIN_COLORS[i % BIN_COLORS.length] },
      ...(bin.yValues.length >= 10 ? { box: { visible: true }, meanline: { visible: true } } : {}),
    } as Data));
    return [traces, {
      xaxis: { title: { text: analysisResult.xLabel } },
      yaxis: { title: { text: analysisResult.yLabel }, zeroline: true },
      showlegend: false,
    }];
  }, [analysisResult]);

  // --- Scatter + OLS ---
  const [scatterData, scatterLayout] = useMemo((): [Data[], Partial<Layout>] => {
    if (!analysisResult) return [[], {}];
    const { bins, pairs } = analysisResult;
    const scatterTraces: Data[] = bins.map((bin, i) => ({
      type: "scatter", mode: "markers",
      name: bin.label.replace("\n", " "),
      x: bin.xValues, y: bin.yValues,
      marker: { color: BIN_COLORS[i % BIN_COLORS.length], size: 6, opacity: 0.7 },
    }));
    const xAll = pairs.map((p) => p.xValue);
    const yAll = pairs.map((p) => p.yValue);
    const { slope, intercept } = olsSlope(xAll, yAll);
    const xMin = Math.min(...xAll), xMax = Math.max(...xAll);
    return [
      [...scatterTraces, {
        type: "scatter", mode: "lines", name: "Trend (OLS)",
        x: [xMin, xMax], y: [slope * xMin + intercept, slope * xMax + intercept],
        line: { color: "#94a3b8", dash: "dash", width: 2 },
      } as Data],
      {
        xaxis: { title: { text: analysisResult.xLabel } },
        yaxis: { title: { text: analysisResult.yLabel }, zeroline: true },
        showlegend: true, hovermode: "closest",
      },
    ];
  }, [analysisResult]);

  // --- Rolling correlation ---
  const [rollingData, rollingLayout] = useMemo((): [Data[], Partial<Layout>] => {
    if (!analysisResult) return [[], {}];
    const sorted = [...analysisResult.pairs].sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sorted.length < 30) return [[], {}];
    const WINDOW = 30;
    const xDates: string[] = [], yCorrs: number[] = [];
    for (let i = WINDOW - 1; i < sorted.length; i++) {
      const win = sorted.slice(i - WINDOW + 1, i + 1);
      const { rho } = spearmanR(win.map((p) => p.xValue), win.map((p) => p.yValue));
      if (isFinite(rho)) { xDates.push(dateKey(sorted[i].date)); yCorrs.push(rho); }
    }
    if (!xDates.length) return [[], {}];
    return [
      [{ type: "scatter", mode: "lines", name: "Rolling Spearman r", x: xDates, y: yCorrs, line: { color: "#3b82f6", width: 2 } } as Data],
      {
        xaxis: { title: { text: "Date" } },
        yaxis: { title: { text: "Spearman r" }, range: [-1, 1], zeroline: true },
        showlegend: false,
        shapes: [{ type: "line", x0: xDates[0], x1: xDates[xDates.length - 1], y0: 0, y1: 0, line: { color: "#94a3b8", dash: "dot", width: 1 } }],
      },
    ];
  }, [analysisResult]);

  // ============================================================
  // Render
  // ============================================================

  const showNoActiveBlock = needsTrades && !activeBlockId;

  return (
    <div className="space-y-6">

      {/* ── Controls ── */}
      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

            {/* X-Axis panel */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-primary text-primary-foreground">X</span>
                <span className="font-medium text-sm">X-Axis</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</label>
                <Select value={xSource} onValueChange={(v) => setXSource(v as AxisSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dataset">Static Dataset</SelectItem>
                    <SelectItem value="trade-pl">Trade P&L</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {xSource === "dataset" ? (
                <DatasetColumnSelect label="X" datasets={datasets} datasetId={xDatasetId} column={xColumn} onDatasetChange={setXDatasetId} onColumnChange={setXColumn} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">P&L Metric</label>
                  <Select value={yPlMetric} onValueChange={(v) => setYPlMetric(v as "total" | "perContract")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total P&L</SelectItem>
                      <SelectItem value="perContract">P&L per Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Y-Axis panel */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold bg-primary text-primary-foreground">Y</span>
                <span className="font-medium text-sm">Y-Axis</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</label>
                <Select value={ySource} onValueChange={(v) => setYSource(v as AxisSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trade-pl">Trade P&L</SelectItem>
                    <SelectItem value="dataset">Static Dataset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {ySource === "trade-pl" ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">P&L Metric</label>
                  <Select value={yPlMetric} onValueChange={(v) => setYPlMetric(v as "total" | "perContract")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total P&L</SelectItem>
                      <SelectItem value="perContract">P&L per Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <DatasetColumnSelect label="Y" datasets={datasets} datasetId={yDatasetId} column={yColumn} onDatasetChange={setYDatasetId} onColumnChange={setYColumn} />
              )}
            </div>
          </div>

          {/* Bins + Run + Time Series toggle */}
          <div className="flex flex-wrap items-end gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Bins</label>
              <Select value={String(numBins)} onValueChange={(v) => setNumBins(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5 (default)</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runAnalysis} disabled={!canRun || isRunning}>
              {isRunning ? "Running…" : "Run Analysis"}
            </Button>
            <Button
              variant={showTimeSeries ? "default" : "outline"}
              onClick={() => setShowTimeSeries((v) => !v)}
              disabled={!analysisResult}
              className="ml-auto"
            >
              {showTimeSeries ? "Hide Time Series" : "Show Time Series"}
            </Button>
            {tradesLoading && (
              <span className="text-sm text-muted-foreground self-end pb-1">Loading trades…</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Optional: Time Series charts (directly after Controls) ── */}
      {showTimeSeries && analysisResult && (
        <>
          <ChartWrapper
            title={`${analysisResult.xLabel} over Time`}
            description="X-axis values sorted by date."
            data={tsXData}
            layout={tsXLayout}
          />
          <ChartWrapper
            title={`${analysisResult.yLabel} over Time`}
            description="Y-axis values sorted by date."
            data={tsYData}
            layout={tsYLayout}
          />
        </>
      )}

      {/* ── No active block ── */}
      {showNoActiveBlock ? (
        <NoActiveBlock description="Select a block to use Trade P&L as an axis." />
      ) : (
        <>
          {tooFewMatches && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardContent className="pt-4 text-sm text-amber-700 dark:text-amber-400">
                Not enough matched data points (&lt; 4). Check that the dataset(s) and block date ranges overlap, and that the selected columns contain numeric values.
              </CardContent>
            </Card>
          )}

          {analysisResult && summaryStats && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <MetricCard title="Spearman r" value={summaryStats.spearman.value} subtitle={summaryStats.spearman.subtitle} isPositive={summaryStats.spearman.isPositive} format="decimal" decimalPlaces={3} />
                <MetricCard title="Mutual Information" value={summaryStats.mi.value} subtitle={summaryStats.mi.subtitle} isPositive={summaryStats.mi.isPositive} format="decimal" decimalPlaces={3} />
                <MetricCard title="KS Statistic" value={summaryStats.ks.value} subtitle={summaryStats.ks.subtitle} isPositive={summaryStats.ks.isPositive} format="decimal" decimalPlaces={3} />
              </div>

              {/* Bin table */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Bin Summary — {analysisResult.xLabel} → {analysisResult.yLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4">Bin</th>
                          <th className="pb-2 pr-4">X Range</th>
                          <th className="pb-2 pr-4">n</th>
                          <th className="pb-2 pr-4">Avg {analysisResult.yLabel}</th>
                          {analysisResult.yIsPl && <th className="pb-2 pr-4">Win %</th>}
                          <th className="pb-2 pr-4">Median</th>
                          <th className="pb-2 pr-4">Std Dev</th>
                          <th className="pb-2 pr-4">Sharpe</th>
                          <th className="pb-2">p-value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {binTableRows.map((row) => (
                          <tr key={row.binNum} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{row.binNum}</td>
                            <td className="py-2 pr-4 text-muted-foreground">{row.label}</td>
                            <td className="py-2 pr-4">{row.count}</td>
                            <td className={cn("py-2 pr-4 font-medium",
                              analysisResult.yIsPl ? (row.avgY >= 0 ? "text-green-600" : "text-red-600") : ""
                            )}>
                              {row.avgY.toFixed(2)}
                            </td>
                            {analysisResult.yIsPl && (
                              <td className="py-2 pr-4">{row.winRate.toFixed(1)}%</td>
                            )}
                            <td className="py-2 pr-4">{row.median.toFixed(2)}</td>
                            <td className="py-2 pr-4">{row.stdDev.toFixed(2)}</td>
                            <td className={cn("py-2 pr-4 font-medium",
                              isFinite(row.sharpe)
                                ? row.sharpe >= 0.5 ? "text-green-600" : row.sharpe <= -0.5 ? "text-red-600" : ""
                                : "text-muted-foreground"
                            )}>
                              {isFinite(row.sharpe) ? row.sharpe.toFixed(2) : "—"}
                            </td>
                            <td className={cn("py-2",
                              isFinite(row.pValue) && row.pValue < 0.05 ? "font-medium" : "text-muted-foreground"
                            )}>
                              {isFinite(row.pValue)
                                ? `${row.pValue < 0.0001 ? "<0.0001" : row.pValue.toFixed(4)}${sigStars(row.pValue)}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Violin / Box */}
              <ChartWrapper
                title={`Y Distribution by Bin — ${analysisResult.yLabel}`}
                description="Equal-frequency bins along X-axis. Violin when n ≥ 10 per bin, box otherwise."
                data={violinData}
                layout={violinLayout}
              />

              {/* Scatter + OLS */}
              <ChartWrapper
                title={`${analysisResult.xLabel} vs ${analysisResult.yLabel}`}
                description="Each point is one matched data pair. Dashed line is OLS regression."
                data={scatterData}
                layout={scatterLayout}
              />

              {/* Rolling correlation */}
              {rollingData.length > 0 && (
                <ChartWrapper
                  title="Rolling Correlation (30-point window)"
                  description="Spearman r over a sliding window of 30 data points, sorted by date."
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
