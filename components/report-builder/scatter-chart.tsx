"use client";

/**
 * Scatter Chart
 *
 * Plotly scatter plot with 2D What-If Filter Explorer.
 * Features visual highlighting for in-range vs out-of-range points
 * and a rectangle overlay showing the selected region bounds.
 * Supports multiple Y-axes (y2, y3) for multi-metric comparison.
 * When multiple Y-axes are configured, user can select which Y-axis
 * to use for the What-If analysis.
 */

import { useMemo, useState, useCallback } from "react";
import type { Layout, PlotData, Shape } from "plotly.js";
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { EnrichedTrade } from "@/lib/models/enriched-trade";
import { ChartAxisConfig, getFieldInfo, ThresholdMetric } from "@/lib/models/report-config";
import { WhatIfExplorer2D, YAxisConfig } from "./what-if-explorer-2d";

/**
 * Colors for multi-axis traces
 */
const AXIS_COLORS = {
  y1: "rgb(59, 130, 246)", // Blue (primary)
  y2: "rgb(239, 68, 68)", // Red (secondary)
  y3: "rgb(34, 197, 94)", // Green (tertiary)
};

interface ScatterChartProps {
  trades: EnrichedTrade[];
  xAxis: ChartAxisConfig;
  yAxis: ChartAxisConfig;
  yAxis2?: ChartAxisConfig;
  yAxis3?: ChartAxisConfig;
  colorBy?: ChartAxisConfig;
  sizeBy?: ChartAxisConfig;
  metric?: ThresholdMetric;
  showWhatIf?: boolean;
  className?: string;
}

/**
 * Get numeric value from trade for a given field
 */
function getTradeValue(trade: EnrichedTrade, field: string): number | null {
  const value = (trade as unknown as Record<string, unknown>)[field];
  if (typeof value === "number" && isFinite(value)) {
    return value;
  }
  return null;
}

/**
 * Date fields that need special handling
 */
const DATE_FIELDS = new Set(["dateOpenedTimestamp"]);

function isDateField(field: string): boolean {
  return DATE_FIELDS.has(field);
}

function formatValueForHover(value: number, field: string): string {
  if (isDateField(field)) {
    return new Date(value).toLocaleDateString();
  }
  return value.toFixed(2);
}

function toPlotlyValue(value: number, field: string): number | string {
  if (isDateField(field)) {
    return new Date(value).toISOString();
  }
  return value;
}

/**
 * Calculate Y-axis range with padding
 */
function calculateAxisRange(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.1 || 1;
  return [min - padding, max + padding];
}

export function ScatterChart({
  trades,
  xAxis,
  yAxis,
  yAxis2,
  yAxis3,
  colorBy,
  sizeBy,
  metric = "plPct",
  showWhatIf = true,
  className,
}: ScatterChartProps) {
  // Check if we're using multi-axis mode
  const hasMultiAxis =
    (yAxis2 && yAxis2.field !== "none") || (yAxis3 && yAxis3.field !== "none");

  // Build list of Y axes for What-If analysis
  const whatIfYAxes = useMemo((): YAxisConfig[] => {
    const axes: YAxisConfig[] = [
      { field: yAxis.field, label: getFieldInfo(yAxis.field)?.label ?? yAxis.field },
    ];
    if (yAxis2 && yAxis2.field !== "none") {
      axes.push({
        field: yAxis2.field,
        label: getFieldInfo(yAxis2.field)?.label ?? yAxis2.field,
      });
    }
    if (yAxis3 && yAxis3.field !== "none") {
      axes.push({
        field: yAxis3.field,
        label: getFieldInfo(yAxis3.field)?.label ?? yAxis3.field,
      });
    }
    return axes;
  }, [yAxis, yAxis2, yAxis3]);

  // Track the selected range from What-If Explorer for visual highlighting
  // Only uses first Y axis for chart highlighting
  const [selectedRange, setSelectedRange] = useState<{
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  } | null>(null);

  const handleRangeChange = useCallback(
    (xMin: number, xMax: number, yMin: number, yMax: number) => {
      // Only update if What-If is enabled
      if (showWhatIf) {
        setSelectedRange({ xMin, xMax, yMin, yMax });
      }
    },
    [showWhatIf]
  );

  // Clear selected range when What-If is disabled
  const effectiveSelectedRange = showWhatIf ? selectedRange : null;

  const { traces, layout } = useMemo(() => {
    if (trades.length === 0) {
      return { traces: [], layout: {} };
    }

    const xInfo = getFieldInfo(xAxis.field);
    const yInfo = getFieldInfo(yAxis.field);
    const chartTraces: Partial<PlotData>[] = [];

    // Multi-axis mode - different rendering path
    if (hasMultiAxis) {
      // Build primary Y axis trace
      const y1Points: { x: number; y: number }[] = [];
      for (const trade of trades) {
        const x = getTradeValue(trade, xAxis.field);
        const y = getTradeValue(trade, yAxis.field);
        if (x !== null && y !== null) {
          y1Points.push({ x, y });
        }
      }

      if (y1Points.length > 0) {
        chartTraces.push({
          x: y1Points.map((p) => toPlotlyValue(p.x, xAxis.field)),
          y: y1Points.map((p) => p.y),
          type: "scatter",
          mode: "markers",
          marker: {
            color: AXIS_COLORS.y1,
            size: 8,
          },
          name: yInfo?.label ?? yAxis.field,
          hovertemplate: y1Points.map(
            (p) =>
              `${xInfo?.label ?? xAxis.field}: ${formatValueForHover(p.x, xAxis.field)}<br>` +
              `${yInfo?.label ?? yAxis.field}: ${p.y.toFixed(2)}<extra></extra>`
          ),
        });
      }

      // Build Y2 trace
      if (yAxis2 && yAxis2.field !== "none") {
        const y2Info = getFieldInfo(yAxis2.field);
        const y2Points: { x: number; y: number }[] = [];
        for (const trade of trades) {
          const x = getTradeValue(trade, xAxis.field);
          const y = getTradeValue(trade, yAxis2.field);
          if (x !== null && y !== null) {
            y2Points.push({ x, y });
          }
        }

        if (y2Points.length > 0) {
          chartTraces.push({
            x: y2Points.map((p) => toPlotlyValue(p.x, xAxis.field)),
            y: y2Points.map((p) => p.y),
            type: "scatter",
            mode: "markers",
            marker: {
              color: AXIS_COLORS.y2,
              size: 6,
            },
            yaxis: "y2",
            name: y2Info?.label ?? yAxis2.field,
            hovertemplate: y2Points.map(
              (p) =>
                `${xInfo?.label ?? xAxis.field}: ${formatValueForHover(p.x, xAxis.field)}<br>` +
                `${y2Info?.label ?? yAxis2.field}: ${p.y.toFixed(2)}<extra></extra>`
            ),
          });
        }
      }

      // Build Y3 trace
      if (yAxis3 && yAxis3.field !== "none") {
        const y3Info = getFieldInfo(yAxis3.field);
        const y3Points: { x: number; y: number }[] = [];
        for (const trade of trades) {
          const x = getTradeValue(trade, xAxis.field);
          const y = getTradeValue(trade, yAxis3.field);
          if (x !== null && y !== null) {
            y3Points.push({ x, y });
          }
        }

        if (y3Points.length > 0) {
          chartTraces.push({
            x: y3Points.map((p) => toPlotlyValue(p.x, xAxis.field)),
            y: y3Points.map((p) => p.y),
            type: "scatter",
            mode: "markers",
            marker: {
              color: AXIS_COLORS.y3,
              size: 6,
            },
            yaxis: "y3",
            name: y3Info?.label ?? yAxis3.field,
            hovertemplate: y3Points.map(
              (p) =>
                `${xInfo?.label ?? xAxis.field}: ${formatValueForHover(p.x, xAxis.field)}<br>` +
                `${y3Info?.label ?? yAxis3.field}: ${p.y.toFixed(2)}<extra></extra>`
            ),
          });
        }
      }

      // Calculate right margin based on number of axes
      const hasY3 = yAxis3 && yAxis3.field !== "none";
      const rightMargin = hasY3 ? 110 : 50;

      const chartLayout: Partial<Layout> = {
        xaxis: {
          title: { text: xInfo?.label ?? xAxis.field },
          zeroline: true,
          type: isDateField(xAxis.field) ? "date" : undefined,
        },
        yaxis: {
          title: { text: yInfo?.label ?? yAxis.field },
          zeroline: true,
          zerolinewidth: 1,
          zerolinecolor: "#94a3b8",
        },
        showlegend: true,
        legend: {
          x: 0,
          y: 1.1,
          xanchor: "left",
          yanchor: "bottom",
          orientation: "h" as const,
          bgcolor: "rgba(0,0,0,0)",
        },
        hovermode: "closest",
        margin: {
          t: 40,
          r: rightMargin,
          b: 60,
          l: 70,
        },
      };

      // Add Y2 axis config
      if (yAxis2 && yAxis2.field !== "none") {
        const y2Info = getFieldInfo(yAxis2.field);
        const y2Values: number[] = [];
        for (const trade of trades) {
          const v = getTradeValue(trade, yAxis2.field);
          if (v !== null) y2Values.push(v);
        }
        (chartLayout as Record<string, unknown>).yaxis2 = {
          title: { text: y2Info?.label ?? yAxis2.field },
          overlaying: "y",
          side: "right",
          zeroline: true,
          zerolinewidth: 1,
          zerolinecolor: "#94a3b8",
          range: calculateAxisRange(y2Values),
        };
      }

      // Add Y3 axis config
      if (yAxis3 && yAxis3.field !== "none") {
        const y3Info = getFieldInfo(yAxis3.field);
        const y3Values: number[] = [];
        for (const trade of trades) {
          const v = getTradeValue(trade, yAxis3.field);
          if (v !== null) y3Values.push(v);
        }
        (chartLayout as Record<string, unknown>).yaxis3 = {
          title: { text: y3Info?.label ?? yAxis3.field },
          overlaying: "y",
          side: "right",
          anchor: "free",
          position: 1,
          zeroline: true,
          zerolinewidth: 1,
          zerolinecolor: "#94a3b8",
          range: calculateAxisRange(y3Values),
          shift: 60,
        };
      }

      return { traces: chartTraces, layout: chartLayout };
    }

    // Single Y-axis mode with What-If highlighting support
    // Extract all points with their values
    const points: {
      x: number;
      y: number;
      xPlotly: number | string;
      pl: number;
      color: number | null;
      size: number | null;
      hover: string;
    }[] = [];

    // Collect size values for scaling
    const allSizeValues: number[] = [];
    if (sizeBy && sizeBy.field !== "none") {
      for (const trade of trades) {
        const s = getTradeValue(trade, sizeBy.field);
        if (s !== null) allSizeValues.push(Math.abs(s));
      }
    }
    const maxSizeValue = allSizeValues.length > 0 ? Math.max(...allSizeValues) : 1;

    for (const trade of trades) {
      const x = getTradeValue(trade, xAxis.field);
      const y = getTradeValue(trade, yAxis.field);

      if (x === null || y === null) continue;

      let color: number | null = null;
      if (colorBy && colorBy.field !== "none") {
        color = getTradeValue(trade, colorBy.field);
      }

      let size: number | null = null;
      if (sizeBy && sizeBy.field !== "none") {
        const s = getTradeValue(trade, sizeBy.field);
        if (s !== null) {
          size = Math.min(30, Math.max(6, (Math.abs(s) / (maxSizeValue || 1)) * 25 + 5));
        }
      }

      points.push({
        x,
        y,
        xPlotly: toPlotlyValue(x, xAxis.field),
        pl: trade.pl ?? 0,
        color,
        size,
        hover:
          `${xInfo?.label ?? xAxis.field}: ${formatValueForHover(x, xAxis.field)}<br>` +
          `${yInfo?.label ?? yAxis.field}: ${y.toFixed(2)}`,
      });
    }

    if (points.length === 0) {
      return { traces: [], layout: {} };
    }

    // If we have a selected range, create two traces: in-range and out-of-range
    // Also check if we're actually filtering (range doesn't cover all points)
    const isActuallyFiltering = effectiveSelectedRange && (
      points.some((p) => p.x < effectiveSelectedRange.xMin || p.x > effectiveSelectedRange.xMax ||
                        p.y < effectiveSelectedRange.yMin || p.y > effectiveSelectedRange.yMax)
    );

    if (effectiveSelectedRange && isActuallyFiltering) {
      const { xMin, xMax, yMin, yMax } = effectiveSelectedRange;
      const hasColorBy = colorBy && colorBy.field !== "none";

      const inRangePoints = points.filter(
        (p) => p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax
      );
      const outOfRangePoints = points.filter(
        (p) => p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax
      );

      // Out-of-range points (gray/faded)
      if (outOfRangePoints.length > 0) {
        chartTraces.push({
          x: outOfRangePoints.map((p) => p.xPlotly),
          y: outOfRangePoints.map((p) => p.y),
          mode: "markers",
          type: "scatter",
          marker: {
            color: "rgba(148, 163, 184, 0.4)", // Gray/faded
            size: outOfRangePoints.map((p) => p.size ?? 8),
          },
          hovertemplate: outOfRangePoints.map((p) => p.hover + "<extra>Outside Range</extra>"),
          name: "Outside Range",
          showlegend: true,
        });
      }

      // In-range points - apply colorBy if set, otherwise blue
      if (inRangePoints.length > 0) {
        if (hasColorBy && colorBy.field === "isWinner") {
          // Binary coloring for winners/losers (in range only)
          const winners = inRangePoints.filter((p) => p.color === 1);
          const losers = inRangePoints.filter((p) => p.color !== 1);

          if (losers.length > 0) {
            chartTraces.push({
              x: losers.map((p) => p.xPlotly),
              y: losers.map((p) => p.y),
              mode: "markers",
              type: "scatter",
              marker: {
                color: "rgb(239, 68, 68)", // Red
                size: losers.map((p) => p.size ?? 8),
              },
              hovertemplate: losers.map((p) => p.hover + "<extra>In Range - Loser</extra>"),
              name: "Losers (In Range)",
            });
          }

          if (winners.length > 0) {
            chartTraces.push({
              x: winners.map((p) => p.xPlotly),
              y: winners.map((p) => p.y),
              mode: "markers",
              type: "scatter",
              marker: {
                color: "rgb(34, 197, 94)", // Green
                size: winners.map((p) => p.size ?? 8),
              },
              hovertemplate: winners.map((p) => p.hover + "<extra>In Range - Winner</extra>"),
              name: "Winners (In Range)",
            });
          }
        } else if (hasColorBy) {
          // Continuous color scale for in-range points
          const colorValues = inRangePoints.map((p) => p.color ?? 0);
          const maxAbs = Math.max(...colorValues.map(Math.abs)) || 1;

          chartTraces.push({
            x: inRangePoints.map((p) => p.xPlotly),
            y: inRangePoints.map((p) => p.y),
            mode: "markers",
            type: "scatter",
            marker: {
              color: colorValues,
              colorscale: "RdYlBu",
              cmin: -maxAbs,
              cmax: maxAbs,
              showscale: true,
              colorbar: {
                title: { text: getFieldInfo(colorBy.field)?.label ?? colorBy.field },
              },
              size: inRangePoints.map((p) => p.size ?? 8),
            },
            hovertemplate: inRangePoints.map((p) => p.hover + "<extra>In Range</extra>"),
            name: "In Range",
          });
        } else {
          // Simple blue for in-range
          chartTraces.push({
            x: inRangePoints.map((p) => p.xPlotly),
            y: inRangePoints.map((p) => p.y),
            mode: "markers",
            type: "scatter",
            marker: {
              color: "rgb(59, 130, 246)", // Blue
              size: inRangePoints.map((p) => p.size ?? 8),
            },
            hovertemplate: inRangePoints.map((p) => p.hover + "<extra>In Range</extra>"),
            name: "In Range",
            showlegend: true,
          });
        }
      }
    } else {
      // No range selection - check for color encoding
      const hasColorBy = colorBy && colorBy.field !== "none";

      if (hasColorBy && colorBy.field === "isWinner") {
        // Binary coloring for winners/losers
        const winners = points.filter((p) => p.color === 1);
        const losers = points.filter((p) => p.color !== 1);

        if (losers.length > 0) {
          chartTraces.push({
            x: losers.map((p) => p.xPlotly),
            y: losers.map((p) => p.y),
            mode: "markers",
            type: "scatter",
            marker: {
              color: "rgb(239, 68, 68)", // Red
              size: losers.map((p) => p.size ?? 8),
            },
            hovertemplate: losers.map((p) => p.hover + "<extra></extra>"),
            name: "Losers",
          });
        }

        if (winners.length > 0) {
          chartTraces.push({
            x: winners.map((p) => p.xPlotly),
            y: winners.map((p) => p.y),
            mode: "markers",
            type: "scatter",
            marker: {
              color: "rgb(34, 197, 94)", // Green
              size: winners.map((p) => p.size ?? 8),
            },
            hovertemplate: winners.map((p) => p.hover + "<extra></extra>"),
            name: "Winners",
          });
        }
      } else if (hasColorBy) {
        // Continuous color scale
        const colorValues = points.map((p) => p.color ?? 0);
        const maxAbs = Math.max(...colorValues.map(Math.abs)) || 1;

        chartTraces.push({
          x: points.map((p) => p.xPlotly),
          y: points.map((p) => p.y),
          mode: "markers",
          type: "scatter",
          marker: {
            color: colorValues,
            colorscale: "RdYlBu",
            cmin: -maxAbs,
            cmax: maxAbs,
            showscale: true,
            colorbar: {
              title: { text: getFieldInfo(colorBy.field)?.label ?? colorBy.field },
            },
            size: points.map((p) => p.size ?? 8),
          },
          hovertemplate: points.map((p) => p.hover + "<extra></extra>"),
          name: "",
        });
      } else {
        // Simple blue scatter
        chartTraces.push({
          x: points.map((p) => p.xPlotly),
          y: points.map((p) => p.y),
          mode: "markers",
          type: "scatter",
          marker: {
            color: "rgb(59, 130, 246)",
            size: points.map((p) => p.size ?? 8),
          },
          hovertemplate: points.map((p) => p.hover + "<extra></extra>"),
          name: "",
        });
      }
    }

    // Build layout
    const hasColorBy = colorBy && colorBy.field !== "none";
    const showLegend =
      isActuallyFiltering ||
      (hasColorBy && colorBy.field === "isWinner");

    // Calculate dynamic right margin - need space for colorbar with continuous colorBy
    let rightMargin = 40;
    if (hasColorBy && colorBy.field !== "isWinner") {
      rightMargin = 100; // Space for color bar
    }

    // Add rectangle shape for selected range
    const shapes: Partial<Shape>[] = [];
    if (effectiveSelectedRange) {
      const { xMin, xMax, yMin, yMax } = effectiveSelectedRange;
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "y",
        x0: xMin,
        x1: xMax,
        y0: yMin,
        y1: yMax,
        line: {
          color: "rgb(59, 130, 246)",
          width: 2,
          dash: "dash",
        },
        fillcolor: "rgba(59, 130, 246, 0.05)",
      });
    }

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: { text: xInfo?.label ?? xAxis.field },
        zeroline: true,
        type: isDateField(xAxis.field) ? "date" : undefined,
      },
      yaxis: {
        title: { text: yInfo?.label ?? yAxis.field },
        zeroline: true,
        zerolinewidth: 1,
        zerolinecolor: "#94a3b8",
      },
      showlegend: showLegend,
      legend: showLegend
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
        t: showLegend ? 40 : 20,
        r: rightMargin,
        b: 60,
        l: 70,
      },
      shapes: shapes.length > 0 ? shapes : undefined,
    };

    return { traces: chartTraces, layout: chartLayout };
  }, [trades, xAxis, yAxis, yAxis2, yAxis3, colorBy, sizeBy, effectiveSelectedRange, hasMultiAxis]);

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
      {showWhatIf && (
        <WhatIfExplorer2D
          trades={trades}
          xAxisField={xAxis.field}
          yAxes={whatIfYAxes}
          metric={metric}
          onRangeChange={handleRangeChange}
        />
      )}
    </div>
  );
}

export default ScatterChart;
