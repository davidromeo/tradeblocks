"use client"

import { ChartWrapper, createLineChartLayout } from "@/components/performance-charts/chart-wrapper"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EquityCurvePoint, SeparateEquityCurvePoint } from "@/lib/calculations/reconciliation-stats"
import type { Layout, PlotData } from "plotly.js"
import { useState } from "react"

interface DualEquityCurveChartProps {
  matchedData: EquityCurvePoint[] | null
  allTradesData: { backtested: SeparateEquityCurvePoint[]; reported: SeparateEquityCurvePoint[] } | null
  normalizeTo1Lot?: boolean
  className?: string
}

export function DualEquityCurveChart({
  matchedData,
  allTradesData,
  normalizeTo1Lot = false,
  className
}: DualEquityCurveChartProps) {
  // Determine which data is available
  const hasMatchedData = matchedData && matchedData.length > 0
  const hasAllTradesData = allTradesData && (allTradesData.backtested.length > 0 || allTradesData.reported.length > 0)

  // Default to "all" mode if no matched data, otherwise "matched"
  const defaultMode = hasMatchedData ? "matched" : "all"
  const [yAxisScale, setYAxisScale] = useState<"linear" | "log">("linear")
  const [tradeMode, setTradeMode] = useState<"matched" | "all">(defaultMode)

  if (!hasMatchedData && !hasAllTradesData) {
    return (
      <div className={className}>
        <div className="text-center p-8 text-muted-foreground">
          No trade data available for equity curve comparison
        </div>
      </div>
    )
  }

  // Build traces based on mode
  let traces: Partial<PlotData>[] = []
  let allEquityValues: number[] = []
  let finalInfo: { matchedCount?: number; backtestedCount?: number; reportedCount?: number; finalDifference?: number; finalPercentDiff?: number } = {}

  if (tradeMode === "matched" && hasMatchedData) {
    // Matched mode - show paired trades
    const backtestedTrace: Partial<PlotData> = {
      x: matchedData.map(point => point.date),
      y: matchedData.map(point => point.backtestedEquity),
      type: "scatter",
      mode: "lines",
      name: "Backtested P/L",
      line: {
        color: "#3b82f6", // blue
        width: 2,
        shape: "hv", // Step function
      },
      hovertemplate:
        "<b>Date:</b> %{x}<br>" +
        "<b>Backtested:</b> $%{y:,.2f}<br>" +
        "<b>Trade #:</b> %{customdata}<br>" +
        "<extra></extra>",
      customdata: matchedData.map(point => point.tradeNumber),
    }

    const reportedTrace: Partial<PlotData> = {
      x: matchedData.map(point => point.date),
      y: matchedData.map(point => point.reportedEquity),
      type: "scatter",
      mode: "lines",
      name: "Reported P/L",
      line: {
        color: "#10b981", // green
        width: 2,
        shape: "hv", // Step function
      },
      hovertemplate:
        "<b>Date:</b> %{x}<br>" +
        "<b>Reported:</b> $%{y:,.2f}<br>" +
        "<b>Trade #:</b> %{customdata}<br>" +
        "<extra></extra>",
      customdata: matchedData.map(point => point.tradeNumber),
    }

    traces = [backtestedTrace, reportedTrace]
    allEquityValues = [
      ...matchedData.map(p => p.backtestedEquity),
      ...matchedData.map(p => p.reportedEquity),
    ]

    const finalPoint = matchedData[matchedData.length - 1]
    finalInfo = {
      matchedCount: matchedData.length,
      finalDifference: finalPoint.difference,
      finalPercentDiff: finalPoint.percentDifference,
    }
  } else if (tradeMode === "all" && hasAllTradesData) {
    // All trades mode - show separate curves
    const backtestedTrace: Partial<PlotData> = {
      x: allTradesData.backtested.map(point => point.date),
      y: allTradesData.backtested.map(point => point.equity),
      type: "scatter",
      mode: "lines",
      name: "Backtested P/L (All)",
      line: {
        color: "#3b82f6", // blue
        width: 2,
        shape: "hv",
      },
      hovertemplate:
        "<b>Date:</b> %{x}<br>" +
        "<b>Backtested:</b> $%{y:,.2f}<br>" +
        "<b>Trade #:</b> %{customdata}<br>" +
        "<extra></extra>",
      customdata: allTradesData.backtested.map(point => point.tradeNumber),
    }

    const reportedTrace: Partial<PlotData> = {
      x: allTradesData.reported.map(point => point.date),
      y: allTradesData.reported.map(point => point.equity),
      type: "scatter",
      mode: "lines",
      name: "Reported P/L (All)",
      line: {
        color: "#10b981", // green
        width: 2,
        shape: "hv",
      },
      hovertemplate:
        "<b>Date:</b> %{x}<br>" +
        "<b>Reported:</b> $%{y:,.2f}<br>" +
        "<b>Trade #:</b> %{customdata}<br>" +
        "<extra></extra>",
      customdata: allTradesData.reported.map(point => point.tradeNumber),
    }

    traces = [backtestedTrace, reportedTrace]
    allEquityValues = [
      ...allTradesData.backtested.map(p => p.equity),
      ...allTradesData.reported.map(p => p.equity),
    ]

    finalInfo = {
      backtestedCount: allTradesData.backtested.length,
      reportedCount: allTradesData.reported.length,
    }
  }

  // Calculate y-axis range (with safeguards for empty data)
  const minEquity = allEquityValues.length > 0 ? Math.min(...allEquityValues) : -100
  const maxEquity = allEquityValues.length > 0 ? Math.max(...allEquityValues) : 100
  const equityRange = maxEquity - minEquity
  // Use at least 10% of max absolute value as padding to avoid zero range
  const padding = equityRange > 0 ? equityRange * 0.1 : Math.max(Math.abs(maxEquity) * 0.1, 100)

  const layout: Partial<Layout> = {
    ...createLineChartLayout("", "Date", "Cumulative P/L ($)"),
    xaxis: {
      title: { text: "Date" },
      showgrid: true,
    },
    yaxis: {
      title: {
        text: "Cumulative P/L ($)",
        standoff: 50,
      },
      showgrid: true,
      zeroline: true,
      zerolinewidth: 2,
      zerolinecolor: "#e5e7eb",
      type: yAxisScale,
      tickformat: "$,.0f",
      range: yAxisScale === "linear" ? [minEquity - padding, maxEquity + padding] : undefined,
    },
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "right",
      x: 1,
    },
    hovermode: "x unified",
  }

  const controls = (
    <div className="flex items-center gap-3">
      {normalizeTo1Lot && (
        <Badge variant="secondary" className="text-xs">
          Per Contract
        </Badge>
      )}
      <ToggleGroup
        type="single"
        value={tradeMode}
        onValueChange={(value: "matched" | "all") => {
          if (value) setTradeMode(value)
        }}
        className="border rounded-md p-1"
      >
        <ToggleGroupItem value="matched" className="text-xs px-3 py-1" disabled={!hasMatchedData}>
          Matched
        </ToggleGroupItem>
        <ToggleGroupItem value="all" className="text-xs px-3 py-1" disabled={!hasAllTradesData}>
          All Trades
        </ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup
        type="single"
        value={yAxisScale}
        onValueChange={(value: "linear" | "log") => {
          if (value) setYAxisScale(value)
        }}
        className="border rounded-md p-1"
      >
        <ToggleGroupItem value="linear" className="text-xs px-3 py-1">
          Linear
        </ToggleGroupItem>
        <ToggleGroupItem value="log" className="text-xs px-3 py-1">
          Log
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )

  // Build description
  const normalizationNote = normalizeTo1Lot ? " (per contract)" : ""
  let description = ""
  if (tradeMode === "matched" && finalInfo.matchedCount) {
    description = `Comparing ${finalInfo.matchedCount} matched trades${normalizationNote}. Final difference: $${finalInfo.finalDifference!.toFixed(2)} (${finalInfo.finalPercentDiff! > 0 ? "+" : ""}${finalInfo.finalPercentDiff!.toFixed(2)}%)`
  } else if (tradeMode === "all") {
    description = `Showing all trades${normalizationNote}: ${finalInfo.backtestedCount} backtested, ${finalInfo.reportedCount} reported`
  }

  return (
    <div className={className}>
      <ChartWrapper
        title="Dual Equity Curve"
        description={description}
        tooltip={{
          flavor: "Side-by-side comparison of backtested vs reported performance over time",
          detailed: tradeMode === "matched"
            ? "This chart shows how your actual (reported) performance compares to your backtested expectations for matched trades. Divergence between the lines reveals slippage, commission differences, or execution variations accumulating over time."
            : "This chart shows all trades from both backtested and reported data, including unmatched trades. This gives you the complete picture of what was planned vs what actually executed.",
        }}
        data={traces}
        layout={layout}
        style={{ height: "400px" }}
      >
        {controls}
      </ChartWrapper>
    </div>
  )
}
