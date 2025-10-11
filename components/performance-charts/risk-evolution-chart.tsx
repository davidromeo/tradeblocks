"use client"

import React, { useMemo } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'

interface RiskEvolutionChartProps {
  className?: string
}

export function RiskEvolutionChart({ className }: RiskEvolutionChartProps) {
  const { data } = usePerformanceStore()

  const { plotData, layout } = useMemo(() => {
    if (!data?.rollingMetrics || data.rollingMetrics.length === 0) {
      return { plotData: [], layout: {} }
    }

    const { rollingMetrics } = data

    const dates = rollingMetrics.map(m => m.date)
    const volatility = rollingMetrics.map(m => m.volatility)

    const trace: Partial<PlotData> = {
      x: dates,
      y: volatility,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Volatility',
      line: {
        color: '#3b82f6',
        width: 2
      },
      marker: {
        size: 4
      },
      hovertemplate: '<b>%{x}</b><br>Volatility: $%{y:.2f}<extra></extra>'
    }

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: { text: 'Date' },
        showgrid: true
      },
      yaxis: {
        title: { text: 'Volatility ($)' },
        showgrid: true
      },
      showlegend: false,
      hovermode: 'closest'
    }

    return { plotData: [trace], layout: chartLayout }
  }, [data])

  const tooltip = {
    flavor: "Your construction style evolution - are you building bolder structures or laying more careful foundations over time?",
    detailed: "Risk evolution tracks how your exposure to volatility and drawdowns changes over time. Increasing risk might indicate growing confidence, larger position sizes, or changing market conditions. Decreasing risk could show improved discipline or more conservative positioning. Both trends provide insights into your trading development."
  }

  if (!data || !data.rollingMetrics || data.rollingMetrics.length === 0) {
    return (
      <ChartWrapper
        title="⚠️ Risk Evolution"
        description="Rolling volatility as a risk indicator (30-trade window)"
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
      title="⚠️ Risk Evolution"
      description="Rolling volatility as a risk indicator over time (30-trade window)"
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '350px' }}
      tooltip={tooltip}
    />
  )
}
