"use client";

/**
 * Histogram Chart
 *
 * Plotly histogram with What-If Filter Explorer for analyzing distributions
 * and exploring hypothetical filter thresholds.
 */

import { useMemo, useState, useCallback } from "react";
import type { Layout, PlotData } from "plotly.js";
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { EnrichedTrade, getEnrichedTradeValue } from "@/lib/models/enriched-trade";
import { ChartAxisConfig, getFieldInfo, ThresholdMetric } from "@/lib/models/report-config";
import { WhatIfExplorer } from "./what-if-explorer";

interface HistogramChartProps {
  trades: EnrichedTrade[];
  xAxis: ChartAxisConfig;
  metric?: ThresholdMetric;
  className?: string;
}

// Use shared getEnrichedTradeValue from enriched-trade model
const getTradeValue = getEnrichedTradeValue;

export function HistogramChart({
  trades,
  xAxis,
  metric = "plPct",
  className,
}: HistogramChartProps) {
  // Track the selected range from What-If Explorer for visual highlighting
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null);

  const handleRangeChange = useCallback((min: number, max: number) => {
    setSelectedRange([min, max]);
  }, []);

  const { traces, layout } = useMemo(() => {
    if (trades.length === 0) {
      return { traces: [], layout: {} };
    }

    // Extract values for histogram
    const allValues: number[] = [];
    for (const trade of trades) {
      const x = getTradeValue(trade, xAxis.field);
      if (x !== null) {
        allValues.push(x);
      }
    }

    if (allValues.length === 0) {
      return { traces: [], layout: {} };
    }

    const xInfo = getFieldInfo(xAxis.field);
    const chartTraces: Partial<PlotData>[] = [];

    // If we have a selected range, create two traces: in-range and out-of-range
    if (selectedRange) {
      const [rangeMin, rangeMax] = selectedRange;
      const inRangeValues = allValues.filter((v) => v >= rangeMin && v <= rangeMax);
      const outOfRangeValues = allValues.filter((v) => v < rangeMin || v > rangeMax);

      // Determine bin size for consistent binning across both traces
      const min = Math.min(...allValues);
      const max = Math.max(...allValues);
      const binCount = Math.min(50, Math.ceil(Math.sqrt(allValues.length)));
      const binSize = (max - min) / binCount || 1;

      // Out-of-range bars (gray/faded)
      if (outOfRangeValues.length > 0) {
        chartTraces.push({
          x: outOfRangeValues,
          type: "histogram",
          marker: {
            color: "rgba(148, 163, 184, 0.5)", // Gray/faded
          },
          xbins: {
            start: min,
            end: max,
            size: binSize,
          },
          name: "Outside Range",
          hovertemplate: `${xInfo?.label ?? xAxis.field}: %{x}<br>Count: %{y}<extra>Outside Range</extra>`,
        });
      }

      // In-range bars (blue/highlighted)
      if (inRangeValues.length > 0) {
        chartTraces.push({
          x: inRangeValues,
          type: "histogram",
          marker: {
            color: "rgb(59, 130, 246)", // Blue
          },
          xbins: {
            start: min,
            end: max,
            size: binSize,
          },
          name: "In Range",
          hovertemplate: `${xInfo?.label ?? xAxis.field}: %{x}<br>Count: %{y}<extra>In Range</extra>`,
        });
      }
    } else {
      // No range selection - single blue histogram
      chartTraces.push({
        x: allValues,
        type: "histogram",
        marker: {
          color: "rgb(59, 130, 246)",
        },
        name: xInfo?.label ?? xAxis.field,
        hovertemplate: `${xInfo?.label ?? xAxis.field}: %{x}<br>Count: %{y}<extra></extra>`,
      });
    }

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: { text: xInfo?.label ?? xAxis.field },
        zeroline: false,
      },
      yaxis: {
        title: { text: "Count" },
        zeroline: true,
        zerolinewidth: 1,
        zerolinecolor: "#94a3b8",
      },
      barmode: "overlay", // Overlay the two histograms
      showlegend: selectedRange !== null,
      legend: selectedRange
        ? {
            x: 0,
            y: 1.1,
            xanchor: "left",
            yanchor: "bottom",
            orientation: "h" as const,
            bgcolor: "rgba(0,0,0,0)",
          }
        : undefined,
      hovermode: "closest",
      margin: {
        t: selectedRange ? 40 : 20,
        r: 40,
        b: 60,
        l: 70,
      },
    };

    return { traces: chartTraces, layout: chartLayout };
  }, [trades, xAxis, selectedRange]);

  if (trades.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        No data available for chart
      </div>
    );
  }

  return (
    <div className={className}>
      <ChartWrapper
        title=""
        data={traces as PlotData[]}
        layout={layout}
        style={{ height: "400px" }}
      />

      {/* What-If Filter Explorer */}
      <WhatIfExplorer
        trades={trades}
        xAxisField={xAxis.field}
        metric={metric}
        onRangeChange={handleRangeChange}
      />
    </div>
  );
}

export default HistogramChart;
