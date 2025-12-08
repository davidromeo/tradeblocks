"use client";

/**
 * Threshold Analysis Chart
 *
 * A specialized chart for evaluating filter thresholds.
 * Shows 4 series with dual Y-axes:
 * - Primary axis (left, 0-100%): Cumulative % of trades, Cumulative % of P/L
 * - Secondary axis (right, $): Avg P/L above threshold, Avg P/L below threshold
 *
 * Helps users identify optimal entry/exit filter levels by showing:
 * - What % of trades would be filtered at each threshold
 * - What % of profits come from trades at each threshold
 * - Expected average returns above vs below each threshold
 */

import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { calculateThresholdAnalysis } from "@/lib/calculations/threshold-analysis";
import { EnrichedTrade } from "@/lib/models/enriched-trade";
import {
  ChartAxisConfig,
  ThresholdMetric,
  getFieldInfo,
} from "@/lib/models/report-config";
import { ArrowUp, ArrowDown, Sparkles, ChevronDown, RotateCcw } from "lucide-react";
import type { Layout, PlotData } from "plotly.js";
import { useCallback, useMemo, useState } from "react";

type OptimizeStrategy = "maxTotalPl" | "bestAvgCustom" | "reset";

interface TradeWithData {
  trade: EnrichedTrade;
  xValue: number;
  pl: number;
  plPct: number;
  rom: number;
}

interface ThresholdChartProps {
  trades: EnrichedTrade[];
  xAxis: ChartAxisConfig;
  metric?: ThresholdMetric; // 'pl', 'plPct', or 'rom' - defaults to 'plPct'
  className?: string;
}

export function ThresholdChart({
  trades,
  xAxis,
  metric = "plPct",
  className,
}: ThresholdChartProps) {
  // Calculate analysis
  const analysis = useMemo(() => {
    if (trades.length === 0) return null;
    return calculateThresholdAnalysis(trades, xAxis.field);
  }, [trades, xAxis.field]);

  // Get min/max X values from the data
  const { dataMinX, dataMaxX } = useMemo(() => {
    if (!analysis || analysis.dataPoints.length === 0) {
      return { dataMinX: 0, dataMaxX: 1 };
    }
    const values = analysis.dataPoints.map((d) => d.xValue);
    return {
      dataMinX: Math.min(...values),
      dataMaxX: Math.max(...values),
    };
  }, [analysis]);

  // What-if explorer state - actual X value range
  const [rangeValues, setRangeValues] = useState<[number, number]>([dataMinX, dataMaxX]);

  // Minimum % of trades to keep for "Best Avg" optimization
  const [minKeptPct, setMinKeptPct] = useState(50);
  const [minKeptPctInput, setMinKeptPctInput] = useState("50");

  // Update range when data changes
  useMemo(() => {
    if (analysis && analysis.dataPoints.length > 0) {
      setRangeValues([dataMinX, dataMaxX]);
    }
  }, [analysis, dataMinX, dataMaxX]);

  // Calculate what-if results based on current range
  const whatIfResults = useMemo(() => {
    if (!analysis || analysis.dataPoints.length === 0 || trades.length === 0) {
      return null;
    }

    // Build trade data with both X value and metric values
    const tradesWithData = trades
      .map((trade) => {
        const xValue = (trade as unknown as Record<string, unknown>)[xAxis.field];
        return {
          trade,
          xValue: typeof xValue === "number" && isFinite(xValue) ? xValue : null,
          pl: trade.pl ?? 0,
          plPct: trade.premiumEfficiency ?? 0,
          rom: trade.rom ?? 0,
        };
      })
      .filter((t) => t.xValue !== null) as Array<{
        trade: EnrichedTrade;
        xValue: number;
        pl: number;
        plPct: number;
        rom: number;
      }>;

    if (tradesWithData.length === 0) return null;

    // Get metric value for a trade
    const getMetricValue = (t: { pl: number; plPct: number; rom: number }) => {
      switch (metric) {
        case "rom": return t.rom;
        case "plPct": return t.plPct;
        default: return t.pl;
      }
    };

    // Filter trades by range
    const [minVal, maxVal] = rangeValues;
    const keptTrades = tradesWithData.filter(
      (t) => t.xValue >= minVal && t.xValue <= maxVal
    );
    const excludedTrades = tradesWithData.filter(
      (t) => t.xValue < minVal || t.xValue > maxVal
    );

    // Calculate metrics (averages based on selected metric)
    const allAvg = tradesWithData.length > 0
      ? tradesWithData.reduce((sum, t) => sum + getMetricValue(t), 0) / tradesWithData.length
      : 0;
    const keptAvg = keptTrades.length > 0
      ? keptTrades.reduce((sum, t) => sum + getMetricValue(t), 0) / keptTrades.length
      : 0;
    const excludedAvg = excludedTrades.length > 0
      ? excludedTrades.reduce((sum, t) => sum + getMetricValue(t), 0) / excludedTrades.length
      : 0;

    // Calculate total P/L $ amounts
    const allTotalPl = tradesWithData.reduce((sum, t) => sum + t.pl, 0);
    const keptTotalPl = keptTrades.reduce((sum, t) => sum + t.pl, 0);
    const excludedTotalPl = excludedTrades.reduce((sum, t) => sum + t.pl, 0);

    return {
      rangeMin: minVal,
      rangeMax: maxVal,
      totalTrades: tradesWithData.length,
      keptTrades: keptTrades.length,
      excludedTrades: excludedTrades.length,
      keptPct: (keptTrades.length / tradesWithData.length) * 100,
      allAvg,
      keptAvg,
      excludedAvg,
      improvement: keptAvg - allAvg,
      // Total P/L amounts
      allTotalPl,
      keptTotalPl,
      excludedTotalPl,
    };
  }, [analysis, trades, xAxis.field, rangeValues, metric]);

  // Build trade data for optimization (memoized separately since it's used by optimize)
  const tradesWithData = useMemo((): TradeWithData[] => {
    return trades
      .map((trade) => {
        const xValue = (trade as unknown as Record<string, unknown>)[xAxis.field];
        return {
          trade,
          xValue: typeof xValue === "number" && isFinite(xValue) ? xValue : null,
          pl: trade.pl ?? 0,
          plPct: trade.premiumEfficiency ?? 0,
          rom: trade.rom ?? 0,
        };
      })
      .filter((t): t is TradeWithData => t.xValue !== null);
  }, [trades, xAxis.field]);

  // Optimization function
  const findOptimalRange = useCallback(
    (strategy: OptimizeStrategy): [number, number] | null => {
      if (tradesWithData.length < 3) return null;

      const sortedByX = [...tradesWithData].sort((a, b) => a.xValue - b.xValue);
      const xValues = sortedByX.map((t) => t.xValue);
      const uniqueX = [...new Set(xValues)].sort((a, b) => a - b);

      if (uniqueX.length < 2) return null;

      // Get metric value based on current selection
      const getMetricValue = (t: TradeWithData) => {
        switch (metric) {
          case "rom": return t.rom;
          case "plPct": return t.plPct;
          default: return t.pl;
        }
      };

      // Helper to evaluate a range
      const evaluateRange = (minX: number, maxX: number) => {
        const kept = tradesWithData.filter((t) => t.xValue >= minX && t.xValue <= maxX);
        if (kept.length === 0) return { keptCount: 0, keptPct: 0, totalPl: 0, avgMetric: 0 };

        const totalPl = kept.reduce((sum, t) => sum + t.pl, 0);
        const avgMetric = kept.reduce((sum, t) => sum + getMetricValue(t), 0) / kept.length;
        const keptPct = (kept.length / tradesWithData.length) * 100;

        return { keptCount: kept.length, keptPct, totalPl, avgMetric };
      };

      let bestRange: [number, number] | null = null;
      let bestScore = -Infinity;

      // Try all combinations of start/end points from unique X values
      // For performance, sample if there are too many unique values
      const sampleSize = Math.min(uniqueX.length, 30);
      const step = Math.max(1, Math.floor(uniqueX.length / sampleSize));
      const sampledX = uniqueX.filter((_, i) => i % step === 0 || i === uniqueX.length - 1);

      for (let i = 0; i < sampledX.length; i++) {
        for (let j = i; j < sampledX.length; j++) {
          const minX = sampledX[i];
          const maxX = sampledX[j];
          const result = evaluateRange(minX, maxX);

          let score: number;

          switch (strategy) {
            case "maxTotalPl":
              // Maximize total P/L, with slight penalty for excluding too many trades
              score = result.totalPl * (0.5 + 0.5 * (result.keptPct / 100));
              break;

            case "bestAvgCustom":
              // Best average metric while keeping at least minKeptPct% of trades
              if (result.keptPct < minKeptPct) continue;
              score = result.avgMetric;
              break;

            default:
              continue;
          }

          if (score > bestScore) {
            bestScore = score;
            bestRange = [minX, maxX];
          }
        }
      }

      return bestRange;
    },
    [tradesWithData, metric, minKeptPct]
  );

  // Handle optimize button click
  const handleOptimize = useCallback(
    (strategy: OptimizeStrategy) => {
      if (strategy === "reset") {
        setRangeValues([dataMinX, dataMaxX]);
        return;
      }

      const optimalRange = findOptimalRange(strategy);
      if (optimalRange) {
        setRangeValues(optimalRange);
      }
    },
    [findOptimalRange, dataMinX, dataMaxX]
  );

  const { traces, layout } = useMemo(() => {
    if (!analysis || analysis.dataPoints.length === 0) {
      return { traces: [], layout: {} };
    }

    const xValues = analysis.dataPoints.map((d) => d.xValue);
    const xInfo = getFieldInfo(xAxis.field);
    const fieldLabel = xInfo?.label ?? xAxis.field;

    // Trace 1: Cumulative % of trades (primary Y-axis)
    const cumulativeTradesTrace: Partial<PlotData> = {
      x: xValues,
      y: analysis.dataPoints.map((d) => d.cumulativeTradesPct),
      type: "scatter",
      mode: "lines",
      name: "Cumulative Trades %",
      line: {
        color: "rgb(59, 130, 246)", // Blue
        width: 2,
      },
      hovertemplate: analysis.dataPoints.map(
        (d) =>
          `${fieldLabel}: ${d.xValue.toFixed(2)}<br>` +
          `Trades ≤ threshold: ${d.cumulativeTradesPct.toFixed(1)}%<br>` +
          `(${d.tradesBelow} of ${analysis.totalTrades} trades)<extra></extra>`
      ),
      yaxis: "y",
    };

    // Trace 2: Cumulative % of P/L (primary Y-axis)
    const cumulativePlTrace: Partial<PlotData> = {
      x: xValues,
      y: analysis.dataPoints.map((d) => d.cumulativePlPct),
      type: "scatter",
      mode: "lines",
      name: "Cumulative P/L %",
      line: {
        color: "rgb(16, 185, 129)", // Teal
        width: 2,
      },
      hovertemplate: analysis.dataPoints.map(
        (d) =>
          `${fieldLabel}: ${d.xValue.toFixed(2)}<br>` +
          `P/L ≤ threshold: ${d.cumulativePlPct.toFixed(1)}%<extra></extra>`
      ),
      yaxis: "y",
    };

    // Determine metric labels and formatting
    const metricLabel = metric === "rom" ? "ROM" : "P/L";
    const metricUnit = metric === "pl" ? "$" : "%";
    const formatValue = (v: number | null) => {
      if (v === null) return "N/A";
      if (metric === "pl") return `$${v.toFixed(0)}`;
      return `${v.toFixed(1)}%`;
    };

    // Get the correct values based on metric
    const getAboveValue = (d: (typeof analysis.dataPoints)[0]) => {
      switch (metric) {
        case "rom":
          return d.avgRomAbove;
        case "plPct":
          return d.avgPlPctAbove;
        default:
          return d.avgPlAbove;
      }
    };
    const getBelowValue = (d: (typeof analysis.dataPoints)[0]) => {
      switch (metric) {
        case "rom":
          return d.avgRomBelow;
        case "plPct":
          return d.avgPlPctBelow;
        default:
          return d.avgPlBelow;
      }
    };

    // Create a short field name for legend (e.g., "VIX" from "Opening VIX")
    const shortFieldName = fieldLabel.replace(/^(Opening|Closing|Avg)\s+/i, '');

    // Trace 3: Avg metric above threshold (secondary Y-axis)
    const avgAboveTrace: Partial<PlotData> = {
      x: xValues,
      y: analysis.dataPoints.map(getAboveValue),
      type: "scatter",
      mode: "markers",
      name: `Avg ${metricLabel} (High ${shortFieldName})`,
      marker: {
        color: "rgb(249, 115, 22)", // Orange - neutral color for "above"
        size: 6,
      },
      hovertemplate: analysis.dataPoints.map(
        (d) =>
          `${fieldLabel}: ${d.xValue.toFixed(2)}<br>` +
          `Avg ${metricLabel} (>${d.xValue.toFixed(2)}): ${formatValue(
            getAboveValue(d)
          )}<br>` +
          `Trades: ${d.tradesAbove}<extra></extra>`
      ),
      yaxis: "y2",
    };

    // Trace 4: Avg metric below threshold (secondary Y-axis)
    const avgBelowTrace: Partial<PlotData> = {
      x: xValues,
      y: analysis.dataPoints.map(getBelowValue),
      type: "scatter",
      mode: "markers",
      name: `Avg ${metricLabel} (Low ${shortFieldName})`,
      marker: {
        color: "rgb(139, 92, 246)", // Violet - neutral color for "below"
        size: 6,
      },
      hovertemplate: analysis.dataPoints.map(
        (d) =>
          `${fieldLabel}: ${d.xValue.toFixed(2)}<br>` +
          `Avg ${metricLabel} (≤${d.xValue.toFixed(2)}): ${formatValue(
            getBelowValue(d)
          )}<br>` +
          `Trades: ${d.tradesBelow}<extra></extra>`
      ),
      yaxis: "y2",
    };

    const chartTraces = [
      cumulativeTradesTrace,
      cumulativePlTrace,
      avgAboveTrace,
      avgBelowTrace,
    ];

    // Calculate range for secondary axis (with padding)
    const allMetricValues = analysis.dataPoints
      .flatMap((d) => [getAboveValue(d), getBelowValue(d)])
      .filter((v): v is number => v !== null);
    const minMetric =
      allMetricValues.length > 0 ? Math.min(...allMetricValues) : 0;
    const maxMetric =
      allMetricValues.length > 0 ? Math.max(...allMetricValues) : 100;
    const metricPadding = (maxMetric - minMetric) * 0.1;

    // Calculate range for primary axis (cumulative %)
    // Cumulative P/L % can go outside 0-100 when early trades have different P/L signs
    const allCumulativeValues = analysis.dataPoints.flatMap((d) => [
      d.cumulativeTradesPct,
      d.cumulativePlPct,
    ]);
    const minCumulative = Math.min(0, ...allCumulativeValues); // Always include 0
    const maxCumulative = Math.max(100, ...allCumulativeValues); // Always include 100
    const cumulativePadding = (maxCumulative - minCumulative) * 0.05;

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: { text: fieldLabel },
        zeroline: false,
      },
      yaxis: {
        title: { text: "Cumulative %" },
        range: [
          minCumulative - cumulativePadding,
          maxCumulative + cumulativePadding,
        ],
        zeroline: true,
        zerolinewidth: 1,
        zerolinecolor: "#94a3b8",
        ticksuffix: "%",
      },
      yaxis2: {
        title: { text: `Avg ${metricLabel} (${metricUnit})` },
        overlaying: "y",
        side: "right",
        range: [minMetric - metricPadding, maxMetric + metricPadding],
        zeroline: true,
        zerolinewidth: 1,
        zerolinecolor: "#94a3b8",
        tickprefix: metric === "pl" ? "$" : "",
        ticksuffix: metric === "pl" ? "" : "%",
      },
      showlegend: true,
      legend: {
        x: 0.5,
        y: 1.0,
        xanchor: "center",
        yanchor: "bottom",
        orientation: "h",
        bgcolor: "rgba(0,0,0,0)",
      },
      hovermode: "closest",
      margin: {
        t: 50,
        r: 80,
        b: 60,
        l: 70,
      },
    };

    return { traces: chartTraces, layout: chartLayout };
  }, [analysis, xAxis, metric]);

  // Get field info for synopsis
  const xInfo = getFieldInfo(xAxis.field);
  const fieldLabel = xInfo?.label ?? xAxis.field;
  const metricLabel = metric === "rom" ? "ROM" : metric === "plPct" ? "P/L %" : "P/L";

  // Format metric value
  const formatMetric = (v: number | null) => {
    if (v === null) return "N/A";
    if (metric === "pl") return `$${v.toFixed(0)}`;
    return `${v.toFixed(1)}%`;
  };

  if (trades.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        No data available for threshold analysis
      </div>
    );
  }

  return (
    <div>
      <ChartWrapper
        title=""
        className={className}
        data={traces as PlotData[]}
        layout={layout}
        style={{ height: "400px" }}
      />

      {/* What-If Explorer */}
      {whatIfResults && (
        <div className="mt-3 p-3 bg-muted/30 rounded-lg border text-sm">
          <div className="font-medium mb-3">What-If Filter Explorer</div>

          {/* Range Slider with Optimize */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Keep trades where {fieldLabel} is between:
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {whatIfResults.rangeMin.toFixed(2)} - {whatIfResults.rangeMax.toFixed(2)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
                      <Sparkles className="h-3 w-3" />
                      Optimize
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => handleOptimize("maxTotalPl")}>
                      Maximize Total P/L
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5">
                      <div className="text-xs text-muted-foreground mb-1.5">Best Avg (keep min % of trades)</div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={minKeptPctInput}
                          onChange={(e) => setMinKeptPctInput(e.target.value)}
                          onBlur={() => {
                            const val = parseInt(minKeptPctInput, 10);
                            if (!isNaN(val) && val >= 10 && val <= 100) {
                              setMinKeptPct(val);
                              setMinKeptPctInput(String(val));
                            } else {
                              setMinKeptPctInput(String(minKeptPct));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = parseInt(minKeptPctInput, 10);
                              if (!isNaN(val) && val >= 10 && val <= 100) {
                                setMinKeptPct(val);
                                setMinKeptPctInput(String(val));
                                handleOptimize("bestAvgCustom");
                              }
                            }
                          }}
                          className="h-7 w-16 text-xs"
                          min={10}
                          max={100}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleOptimize("bestAvgCustom")}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleOptimize("reset")} className="text-muted-foreground">
                      <RotateCcw className="h-3 w-3 mr-2" />
                      Reset to Full Range
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <Slider
              value={rangeValues}
              onValueChange={(v) => setRangeValues(v as [number, number])}
              min={dataMinX}
              max={dataMaxX}
              step={(dataMaxX - dataMinX) / 100}
              className="w-full"
            />
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t">
            {/* Filter info */}
            <div>
              <div className="text-muted-foreground text-xs">
                {fieldLabel} Range
              </div>
              <div className="font-medium">
                {whatIfResults.rangeMin.toFixed(2)} - {whatIfResults.rangeMax.toFixed(2)}
              </div>
            </div>

            {/* Kept trades */}
            <div>
              <div className="text-muted-foreground text-xs flex items-center gap-1">
                <ArrowUp className="h-3 w-3 text-green-500" />
                In Range ({whatIfResults.keptTrades} trades)
              </div>
              <div
                className={`font-medium ${
                  whatIfResults.keptAvg > 0
                    ? "text-green-600 dark:text-green-400"
                    : whatIfResults.keptAvg < 0
                    ? "text-red-600 dark:text-red-400"
                    : ""
                }`}
              >
                Avg {metricLabel}: {formatMetric(whatIfResults.keptAvg)}
              </div>
            </div>

            {/* Excluded trades */}
            <div>
              <div className="text-muted-foreground text-xs flex items-center gap-1">
                <ArrowDown className="h-3 w-3 text-red-500" />
                Outside ({whatIfResults.excludedTrades} trades)
              </div>
              <div
                className={`font-medium ${
                  whatIfResults.excludedAvg > 0
                    ? "text-green-600 dark:text-green-400"
                    : whatIfResults.excludedAvg < 0
                    ? "text-red-600 dark:text-red-400"
                    : ""
                }`}
              >
                Avg {metricLabel}: {formatMetric(whatIfResults.excludedAvg)}
              </div>
            </div>

            {/* Impact */}
            <div>
              <div className="text-muted-foreground text-xs">vs All Trades</div>
              <div
                className={`font-medium ${
                  whatIfResults.improvement > 0
                    ? "text-green-600 dark:text-green-400"
                    : whatIfResults.improvement < 0
                    ? "text-red-600 dark:text-red-400"
                    : ""
                }`}
              >
                {whatIfResults.improvement > 0 ? "+" : ""}
                {formatMetric(whatIfResults.improvement)}
              </div>
            </div>
          </div>

          {/* Total P/L Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t">
            <div>
              <div className="text-muted-foreground text-xs">Total P/L (All)</div>
              <div className={`font-medium ${whatIfResults.allTotalPl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                ${whatIfResults.allTotalPl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Total P/L (In Range)</div>
              <div className={`font-medium ${whatIfResults.keptTotalPl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                ${whatIfResults.keptTotalPl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Total P/L (Outside)</div>
              <div className={`font-medium ${whatIfResults.excludedTotalPl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                ${whatIfResults.excludedTotalPl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">P/L Change if Filtered</div>
              <div className={`font-medium ${-whatIfResults.excludedTotalPl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {-whatIfResults.excludedTotalPl >= 0 ? "+" : ""}${(-whatIfResults.excludedTotalPl).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-3 pt-2 border-t text-xs text-muted-foreground">
            Keeping {whatIfResults.keptPct.toFixed(0)}% of trades ({whatIfResults.keptTrades} of {whatIfResults.totalTrades}).
            {" "}All trades avg: {formatMetric(whatIfResults.allAvg)}
          </div>
        </div>
      )}
    </div>
  );
}

export default ThresholdChart;
