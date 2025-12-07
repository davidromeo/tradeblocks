"use client"

import { useMemo, useState } from "react"
import type { Layout, PlotData } from "plotly.js"
import { ChartWrapper } from "./chart-wrapper"
import { Input } from "@/components/ui/input"
import { usePerformanceStore } from "@/lib/stores/performance-store"
import { format } from "date-fns"

interface MarginUtilizationTableProps {
  className?: string
}

// Color gradient from green (low utilization) to red (high utilization)
function getBucketColor(index: number, total: number): string {
  const colors = [
    "#10b981", // emerald-500
    "#34d399", // emerald-400
    "#6ee7b7", // emerald-300
    "#fcd34d", // amber-300
    "#fbbf24", // amber-400
    "#f59e0b", // amber-500
    "#f97316", // orange-500
    "#ef4444", // red-500
    "#dc2626", // red-600
    "#b91c1c", // red-700
  ]
  const colorIndex = Math.min(Math.floor((index / total) * colors.length), colors.length - 1)
  return colors[colorIndex]
}

function getBucketLabel(
  utilizationPct: number,
  bucketSize: number,
  maxThreshold: number
): string {
  if (utilizationPct >= maxThreshold) {
    return `${maxThreshold}%+`
  }
  const lowerBound = Math.floor(utilizationPct / bucketSize) * bucketSize
  const upperBound = lowerBound + bucketSize
  return `${lowerBound}-${upperBound}%`
}

interface ChartData {
  months: string[]
  monthLabels: string[]
  bucketLabels: string[]
  // bucketCounts[bucketIndex][monthIndex] = count of trades
  bucketCounts: number[][]
}

function transformToChartData(
  marginUtilization: Array<{
    date: string
    marginReq: number
    fundsAtClose: number
    numContracts: number
    pl: number
  }>,
  initialCapital: number,
  bucketSize: number,
  maxThreshold: number
): ChartData {
  if (!marginUtilization || marginUtilization.length === 0 || initialCapital <= 0) {
    return { months: [], monthLabels: [], bucketLabels: [], bucketCounts: [] }
  }

  // Group trades by month and bucket
  const monthBucketCounts = new Map<string, Map<string, number>>()
  const allMonths = new Set<string>()

  // Generate all bucket labels in order
  const bucketLabels: string[] = []
  for (let i = 0; i < maxThreshold; i += bucketSize) {
    bucketLabels.push(`${i}-${i + bucketSize}%`)
  }
  bucketLabels.push(`${maxThreshold}%+`)

  for (const entry of marginUtilization) {
    if (entry.marginReq <= 0) continue

    const utilizationPct = (entry.marginReq / initialCapital) * 100
    const bucketLabel = getBucketLabel(utilizationPct, bucketSize, maxThreshold)

    const date = new Date(entry.date)
    // Use sortable key for ordering
    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`

    allMonths.add(monthKey)

    if (!monthBucketCounts.has(monthKey)) {
      monthBucketCounts.set(monthKey, new Map())
    }
    const bucketMap = monthBucketCounts.get(monthKey)!
    bucketMap.set(bucketLabel, (bucketMap.get(bucketLabel) || 0) + 1)
  }

  const sortedMonths = Array.from(allMonths).sort()

  // Format month labels like "May '22"
  const monthLabels = sortedMonths.map((monthKey) => {
    const [year, month] = monthKey.split("-")
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    return format(date, "MMM ''yy")
  })

  // Build counts array: bucketCounts[bucketIndex][monthIndex]
  const bucketCounts: number[][] = bucketLabels.map((label) =>
    sortedMonths.map((monthKey) => {
      const bucketMap = monthBucketCounts.get(monthKey)
      return bucketMap?.get(label) || 0
    })
  )

  return {
    months: sortedMonths,
    monthLabels,
    bucketLabels,
    bucketCounts,
  }
}

export function MarginUtilizationTable({ className }: MarginUtilizationTableProps) {
  const { data } = usePerformanceStore()

  const [bucketSize, setBucketSize] = useState<number>(1)
  const [maxThreshold, setMaxThreshold] = useState<number>(10)

  const initialCapital = data?.portfolioStats?.initialCapital ?? 0

  const { plotData, layout } = useMemo(() => {
    if (!data?.marginUtilization || data.marginUtilization.length === 0 || initialCapital <= 0) {
      return { plotData: [], layout: {} }
    }

    const chartData = transformToChartData(
      data.marginUtilization,
      initialCapital,
      bucketSize,
      maxThreshold
    )

    if (chartData.months.length === 0) {
      return { plotData: [], layout: {} }
    }

    // Create stacked area traces - one per bucket
    const traces: Partial<PlotData>[] = chartData.bucketLabels.map((label, index) => ({
      x: chartData.monthLabels,
      y: chartData.bucketCounts[index],
      type: "scatter" as const,
      mode: "lines" as const,
      name: label,
      stackgroup: "one",
      groupnorm: "percent" as const,
      fillcolor: getBucketColor(index, chartData.bucketLabels.length),
      line: {
        width: 0.5,
        color: getBucketColor(index, chartData.bucketLabels.length),
      },
      hovertemplate: `<b>${label}</b><br>%{y:.1f}% of trades<extra></extra>`,
    }))

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: { text: "" },
        showgrid: false,
        tickangle: -45,
      },
      yaxis: {
        title: { text: "% of Trades" },
        showgrid: true,
        range: [0, 100],
        ticksuffix: "%",
      },
      hovermode: "closest" as const,
      showlegend: true,
      legend: {
        orientation: "h" as const,
        yanchor: "bottom" as const,
        y: 1.02,
        xanchor: "center" as const,
        x: 0.5,
        traceorder: "normal" as const,
      },
      margin: {
        t: 80,
        r: 30,
        b: 80,
        l: 60,
      },
    }

    return { plotData: traces, layout: chartLayout }
  }, [data?.marginUtilization, initialCapital, bucketSize, maxThreshold])

  const tooltip = {
    flavor: "How is your margin utilization distributed over time?",
    detailed:
      "This chart shows how your margin utilization changes month over month. Each colored band represents a percentage range of your starting capital used as margin. Watch for trends - are you taking on more margin over time?",
  }

  const headerControls = (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Bucket:</span>
        <Input
          type="number"
          min={1}
          max={50}
          value={bucketSize}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            if (!isNaN(val) && val >= 1 && val <= 50) {
              setBucketSize(val)
            }
          }}
          className="w-16 h-8 text-center"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Max:</span>
        <Input
          type="number"
          min={1}
          max={100}
          value={maxThreshold}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            if (!isNaN(val) && val >= 1 && val <= 100) {
              setMaxThreshold(val)
            }
          }}
          className="w-16 h-8 text-center"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
    </div>
  )

  // Handle empty states
  if (!data?.marginUtilization || data.marginUtilization.length === 0) {
    return (
      <ChartWrapper
        title="📊 Margin Utilization Distribution"
        description="Distribution of margin usage as % of starting capital over time"
        className={className}
        data={[]}
        layout={{}}
        tooltip={tooltip}
        actions={headerControls}
      />
    )
  }

  if (initialCapital <= 0) {
    return (
      <ChartWrapper
        title="📊 Margin Utilization Distribution"
        description="Unable to calculate: starting capital is not set"
        className={className}
        data={[]}
        layout={{}}
        tooltip={tooltip}
        actions={headerControls}
      />
    )
  }

  return (
    <ChartWrapper
      title="📊 Margin Utilization Distribution"
      description="Distribution of margin usage as % of starting capital over time"
      className={className}
      data={plotData as PlotData[]}
      layout={layout}
      style={{ height: "350px" }}
      tooltip={tooltip}
      actions={headerControls}
    />
  )
}
