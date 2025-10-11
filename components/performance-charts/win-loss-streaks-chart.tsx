"use client"

import { useMemo } from 'react'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { ChartWrapper } from './chart-wrapper'
import type { PlotData, Layout } from 'plotly.js'

export function WinLossStreaksChart() {
  const data = usePerformanceStore(state => state.data)

  const { plotData, layout, statistics } = useMemo(() => {
    if (!data?.streakData) {
      return { plotData: [], layout: {}, statistics: null }
    }

    const { winDistribution, lossDistribution, statistics } = data.streakData

    // Get streak lengths
    const winLengths = Object.keys(winDistribution).map(Number).sort((a, b) => a - b)
    const lossLengths = Object.keys(lossDistribution).map(Number).sort((a, b) => a - b)

    if (winLengths.length === 0 && lossLengths.length === 0) {
      return { plotData: [], layout: {}, statistics: null }
    }

    const traces: Partial<PlotData>[] = []

    // Win streaks trace (right side, positive Y-axis)
    if (winLengths.length > 0) {
      const winCounts = winLengths.map(length => winDistribution[length])

      traces.push({
        y: winLengths,
        x: winCounts,
        type: 'bar',
        orientation: 'h',
        name: 'Win Streaks',
        marker: {
          color: '#10b981',
        },
        hovertemplate: '<b>Win Streak:</b> %{y} trades<br><b>Occurrences:</b> %{x}<extra></extra>',
      })
    }

    // Loss streaks trace (left side, negative Y-axis and negative X-axis)
    if (lossLengths.length > 0) {
      const lossCounts = lossLengths.map(length => lossDistribution[length])

      traces.push({
        y: lossLengths.map(length => -length), // Negative Y-axis values for losses
        x: lossCounts.map(count => -count), // Negative X-axis values for left side
        type: 'bar',
        orientation: 'h',
        name: 'Loss Streaks',
        marker: {
          color: '#ef4444',
        },
        customdata: lossCounts,
        hovertemplate: '<b>Loss Streak:</b> %{y} trades<br><b>Occurrences:</b> %{customdata}<extra></extra>',
      })
    }

    // Calculate Y-axis range for the center line
    const maxWinLength = winLengths.length > 0 ? Math.max(...winLengths) : 0
    const maxLossLength = lossLengths.length > 0 ? Math.max(...lossLengths) : 0

    const chartLayout: Partial<Layout> = {
      xaxis: {
        title: {
          text: '← Loss Streaks | Win Streaks →',
        },
        showgrid: true,
        zeroline: true,
        zerolinewidth: 2,
      },
      yaxis: {
        title: {
          text: 'Streak Length (Trades)',
        },
        showgrid: true,
        zeroline: true,
        zerolinewidth: 2,
      },
      barmode: 'overlay',
      hovermode: 'closest',
      showlegend: true,
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'center',
        x: 0.5,
      },
      margin: {
        t: 60,
        r: 40,
        b: 60,
        l: 60,
      },
      shapes: [
        {
          type: 'line',
          x0: 0,
          x1: 0,
          y0: -maxLossLength - 0.5,
          y1: maxWinLength + 0.5,
          yref: 'y',
          line: {
            color: 'rgba(148, 163, 184, 0.5)',
            width: 1,
          },
        },
      ],
    }

    return { plotData: traces, layout: chartLayout, statistics }
  }, [data?.streakData])

  const tooltip = {
    flavor: "Building momentum - when your blocks stack smoothly versus when they keep toppling over.",
    detailed: "Winning and losing streaks are natural in trading, but their patterns tell important stories. Long streaks might indicate strong strategy alignment or the need for position size adjustments. Understanding your streak tendencies helps with psychological preparation and knowing when variance is normal versus when changes are needed."
  };

  if (!statistics) {
    return (
      <ChartWrapper
        title="🎯 Win/Loss Streak Analysis"
        description="No streak data available"
        tooltip={tooltip}
        data={[]}
        layout={{}}
        style={{ width: '100%', height: '400px' }}
      />
    )
  }

  return (
    <ChartWrapper
      title="🎯 Win/Loss Streak Analysis"
      description="Distribution of consecutive wins and losses"
      tooltip={tooltip}
      data={plotData}
      layout={layout}
      style={{ width: '100%', height: '450px' }}
    />
  )
}
