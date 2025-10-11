"use client"

import React, { useMemo } from 'react'
import { ChartWrapper, createBarChartLayout } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'

interface MonthlyReturnsChartProps {
  className?: string
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function MonthlyReturnsChart({ className }: MonthlyReturnsChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout } = useMemo(() => {
    if (!data?.monthlyReturns) {
      return { plotData: [], layout: {} }
    }

    const { monthlyReturns } = data

    // Flatten the data for chronological bar chart (matching legacy)
    const allMonths: string[] = []
    const allValues: number[] = []
    const allLabels: string[] = []

    const years = Object.keys(monthlyReturns).map(Number).sort()

    for (const year of years) {
      const yearData = monthlyReturns[year]
      for (let monthIdx = 1; monthIdx <= 12; monthIdx++) {
        // Only include months with non-zero values (matching legacy line 670)
        if (monthIdx in yearData && yearData[monthIdx] !== 0) {
          const value = yearData[monthIdx]
          allMonths.push(`${MONTH_NAMES[monthIdx - 1]} ${year}`)
          allValues.push(value)
          allLabels.push(`$${value >= 0 ? '+' : ''}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
        }
      }
    }

    if (allValues.length === 0) {
      return { plotData: [], layout: {} }
    }

    // Color bars based on positive/negative values
    const colors = allValues.map(v => v >= 0 ? '#16a34a' : '#dc2626')

    const barTrace: Partial<PlotData> = {
      x: allMonths,
      y: allValues,
      type: 'bar',
      marker: { color: colors },
      text: allLabels,
      textposition: 'inside',
      textfont: {
        size: 10,
        color: 'white'
      },
      hovertemplate: '<b>%{x}</b><br>Return: %{text}<extra></extra>'
    }

    const chartLayout: Partial<Layout> = {
      ...createBarChartLayout('', 'Month', 'Monthly Return ($)'),
      xaxis: {
        title: { text: 'Month' },
        showgrid: false,
        tickangle: 45, // Angle labels for readability
      },
      yaxis: {
        title: { text: 'Monthly Return ($)' },
        showgrid: true,
        zeroline: true,
        zerolinewidth: 1,
      },
      showlegend: false,
      margin: {
        t: 60,
        r: 40,
        b: 80, // More bottom margin for angled labels
        l: 80
      }
    }

    return { plotData: [barTrace], layout: chartLayout }
  }, [data])

  const tooltip = {
    flavor: "Your trading foundation year by year - which months added strong blocks and which needed rebuilding.",
    detailed: "Monthly performance patterns can reveal seasonal effects, consistency issues, and how your strategy performs across different market environments. Some strategies work better in certain market conditions that tend to cluster around calendar periods. This helps identify when to be more or less aggressive."
  }

  if (!data || !data.monthlyReturns || Object.keys(data.monthlyReturns).length === 0) {
    return (
      <ChartWrapper
        title="📅 Monthly Returns"
        description="Monthly profit and loss over time"
        className={className}
        data={[]}
        layout={{}}
        style={{ height: '300px' }}
        tooltip={tooltip}
      />
    )
  }

  return (
    <ChartWrapper
      title="📅 Monthly Returns"
      description="Monthly profit and loss performance across trading periods"
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '350px' }}
      tooltip={tooltip}
    />
  )
}
