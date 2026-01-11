"use client"

import React, { useMemo, useState } from 'react'
import { ChartWrapper, createLineChartLayout } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { useTheme } from 'next-themes'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { PlotData, Layout } from 'plotly.js'

interface DrawdownChartProps {
  className?: string
}

type ViewMode = 'dollars' | 'percent'

export function DrawdownChart({ className }: DrawdownChartProps) {
  const { data } = usePerformanceStore()
  const { theme } = useTheme()
  const [viewMode, setViewMode] = useState<ViewMode>('percent')

  const { plotData, layout } = useMemo(() => {
    if (!data?.drawdownData || !data?.equityCurve) {
      return { plotData: [], layout: {} }
    }

    const { drawdownData, equityCurve } = data

    // Create a map of date to equity/highWaterMark for quick lookup
    const equityMap = new Map<string, { equity: number; highWaterMark: number }>()
    equityCurve.forEach(point => {
      equityMap.set(point.date, { equity: point.equity, highWaterMark: point.highWaterMark })
    })

    // Calculate drawdown values based on view mode
    // Filter and map in one pass to ensure dates and values stay aligned
    const processedData: Array<{ date: string; drawdown: number }> = []

    drawdownData.forEach(point => {
      const equityData = equityMap.get(point.date)
      let drawdown: number

      if (viewMode === 'dollars') {
        if (equityData) {
          // Dollar drawdown: equity - highWaterMark (will be negative or zero)
          drawdown = equityData.equity - equityData.highWaterMark
        } else {
          // Fallback: if equity data not found, skip this point
          // This shouldn't happen since drawdownData is calculated from equityCurve,
          // but handle gracefully
          return
        }
      } else {
        // Percent drawdown: use the percentage value
        drawdown = point.drawdownPct
      }

      processedData.push({ date: point.date, drawdown })
    })

    // Extract arrays and find max drawdown
    const dates = processedData.map(d => d.date)
    const drawdownValues = processedData.map(d => d.drawdown)
    
    let maxDrawdownValue = 0
    let maxDrawdownDate = ''
    processedData.forEach(({ date, drawdown }) => {
      if (drawdown < maxDrawdownValue) {
        maxDrawdownValue = drawdown
        maxDrawdownDate = date
      }
    })

    const maxDrawdownPoint = {
      date: maxDrawdownDate,
      value: maxDrawdownValue
    }

    // Main drawdown area
    const drawdownTrace: Partial<PlotData> = {
      x: dates,
      y: drawdownValues,
      type: 'scatter' as const,
      mode: 'lines+markers', // Add markers to ensure all points are visible
      name: viewMode === 'dollars' ? 'Drawdown ($)' : 'Drawdown %',
      line: {
        color: '#ef4444',
        width: 1, // Make line visible
        shape: 'linear' // Preserve sharp changes, no smoothing
      },
      marker: {
        color: '#ef4444',
        size: 2, // Small markers
        opacity: 0.6
      },
      fill: 'tozeroy', // Fill to y=0 directly instead of tonexty
      fillcolor: 'rgba(239, 68, 68, 0.3)',
      hovertemplate: viewMode === 'dollars'
        ? '<b>Date:</b> %{x}<br>' +
          '<b>Drawdown:</b> $%{y:,.0f}<br>' +
          '<extra></extra>'
        : '<b>Date:</b> %{x}<br>' +
          '<b>Drawdown:</b> %{y:.2f}%<br>' +
          '<extra></extra>'
    }

    // Zero line (baseline)
    const zeroLineTrace: Partial<PlotData> = {
      x: dates,
      y: Array(dates.length).fill(0),
      type: 'scatter' as const,
      mode: 'lines',
      name: 'No Drawdown',
      line: { color: 'rgba(0,0,0,0.3)', width: 1 },
      showlegend: false,
      hoverinfo: 'skip'
    }

    // Maximum drawdown point
    const maxDrawdownLabel = viewMode === 'dollars'
      ? `Max Drawdown: $${Math.abs(maxDrawdownPoint.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : `Max Drawdown: ${maxDrawdownPoint.value.toFixed(1)}%`

    const maxDrawdownTrace: Partial<PlotData> = {
      x: [maxDrawdownPoint.date],
      y: [maxDrawdownPoint.value],
      type: 'scatter' as const,
      mode: 'markers',
      name: maxDrawdownLabel,
      marker: {
        color: '#dc2626',
        size: 12,
        symbol: 'x',
        line: { width: 2, color: '#991b1b' }
      },
      hovertemplate: viewMode === 'dollars'
        ? '<b>Maximum Drawdown</b><br>' +
          '<b>Date:</b> %{x}<br>' +
          '<b>Drawdown:</b> $%{y:,.0f}<br>' +
          '<extra></extra>'
        : '<b>Maximum Drawdown</b><br>' +
          '<b>Date:</b> %{x}<br>' +
          '<b>Drawdown:</b> %{y:.2f}%<br>' +
          '<extra></extra>'
    }

    const traces: Partial<PlotData>[] = [zeroLineTrace, drawdownTrace, maxDrawdownTrace]

    // Use the same max drawdown point for consistency
    const minDrawdown = maxDrawdownPoint.value

    // Both views should max at 0 on the y-axis
    // Add 10% padding below the minimum drawdown for better visualization
    const yAxisRange = [minDrawdown * 1.1, 0]

    const yAxisTitle = viewMode === 'dollars' ? 'Drawdown ($)' : 'Drawdown (%)'
    const yAxisTickFormat = viewMode === 'dollars' ? '$,.0f' : '.1f'

    // Calculate x-axis range from actual data to prevent extra blank space
    const xAxisRange = dates.length > 0 
      ? [dates[0], dates[dates.length - 1]]
      : undefined

    const chartLayout: Partial<Layout> = {
      ...createLineChartLayout('', 'Date', yAxisTitle),
      xaxis: {
        ...createLineChartLayout('', 'Date', yAxisTitle).xaxis,
        // Set explicit range to prevent extra blank space extending beyond actual data
        ...(xAxisRange && { range: xAxisRange })
      },
      yaxis: {
        title: {
          text: yAxisTitle,
          standoff: viewMode === 'dollars' ? 50 : 50 // Keep consistent standoff for alignment
        },
        showgrid: true,
        zeroline: true,
        zerolinecolor: '#000',
        zerolinewidth: 1,
        tickformat: yAxisTickFormat,
        range: yAxisRange, // Show from deepest drawdown to above zero
        fixedrange: false, // Allow zoom but start with our range
        type: 'linear' // Ensure linear scaling
      },
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'right',
        x: 1
      },
      annotations: [{
        x: maxDrawdownPoint.date,
        y: maxDrawdownPoint.value,
        text: 'Max DD',
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: 2,
        arrowcolor: theme === 'dark' ? '#f8fafc' : '#0f172a', // White in dark mode, black in light mode
        ax: 0,
        ay: -30,
        font: { size: 10, color: theme === 'dark' ? '#f8fafc' : '#0f172a' } // White in dark mode, black in light mode
      }],
      margin: {
        l: viewMode === 'dollars' ? 80 : 60, // More space for dollar labels
        r: 30,
        t: 60,
        b: 50
      }
    }


    return { plotData: traces, layout: chartLayout }
  }, [data, theme, viewMode])

  const tooltip = {
    flavor: "When your trading blocks tumbled - measuring how far you fell from your highest tower.",
    detailed: "Drawdowns show the worst-case scenarios you've experienced - how much your account declined from peak values. This is crucial for understanding your risk tolerance and whether your strategy's downside matches what you can psychologically and financially handle. Recovery time shows resilience."
  }

  const toggleControls = (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={(value) => {
        if (value) setViewMode(value as ViewMode)
      }}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value="dollars" aria-label="View in dollars">
        Dollars
      </ToggleGroupItem>
      <ToggleGroupItem value="percent" aria-label="View in percent">
        Percent
      </ToggleGroupItem>
    </ToggleGroup>
  )

  if (!data) {
    return (
      <ChartWrapper
        title="Drawdown"
        description="Visualize portfolio drawdown periods and recovery"
        className={className}
        data={[]}
        layout={{}}
        tooltip={tooltip}
        actions={toggleControls}
      />
    )
  }

  return (
    <ChartWrapper
      title="Drawdown"
      description="Visualize portfolio drawdown periods and recovery patterns"
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '400px' }}
      tooltip={tooltip}
      actions={toggleControls}
    />
  )
}