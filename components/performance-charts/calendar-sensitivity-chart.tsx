"use client"

import React, { useMemo, useState } from 'react'
import { ChartWrapper, createBarChartLayout } from './chart-wrapper'
import type { Layout, PlotData } from 'plotly.js'
import type { Trade } from '@/lib/models/trade'
import type { CalendarEvent, CalendarEventType } from '@/lib/models/calendar-event'
import { CALENDAR_EVENT_TYPE_LABELS } from '@/lib/models/calendar-event'
import { analyzeCalendarSensitivity } from '@/lib/calculations/calendar-sensitivity'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CalendarSensitivityChartProps {
  trades: Trade[]
  events: CalendarEvent[]
  className?: string
}

type ViewMode = 'avgPl' | 'winRate' | 'tradeCount'

export function CalendarSensitivityChart({ 
  trades, 
  events,
  className 
}: CalendarSensitivityChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('avgPl')
  const [selectedEventType, setSelectedEventType] = useState<CalendarEventType | 'all'>('all')

  const analysis = useMemo(() => {
    if (!trades.length || !events.length) {
      return null
    }

    // Filter events by selected type if not "all"
    const filteredEvents = selectedEventType === 'all' 
      ? events 
      : events.filter(e => e.type === selectedEventType)

    return analyzeCalendarSensitivity(trades, filteredEvents)
  }, [trades, events, selectedEventType])

  const { plotData, layout } = useMemo(() => {
    if (!analysis) {
      return { plotData: [], layout: {} }
    }

    // Prepare data for the chart
    const categories: string[] = []
    const eventValues: number[] = []
    const normalValues: number[] = []
    const eventCounts: number[] = []

    // Add data for each event type
    analysis.byEventType.forEach((stats, eventType) => {
      const label = CALENDAR_EVENT_TYPE_LABELS[eventType] || eventType
      categories.push(label)

      let eventValue = 0
      let normalValue = 0

      switch (viewMode) {
        case 'avgPl':
          eventValue = stats.avgPlEventDays
          normalValue = stats.avgPlNormalDays
          break
        case 'winRate':
          eventValue = stats.winRateEventDays
          normalValue = stats.winRateNormalDays
          break
        case 'tradeCount':
          eventValue = stats.tradesOnEventDays
          normalValue = stats.tradesOnNormalDays
          break
      }

      eventValues.push(eventValue)
      normalValues.push(normalValue)
      eventCounts.push(stats.tradesOnEventDays)
    })

    // Add "Normal Days" category
    categories.push('Normal Days')
    switch (viewMode) {
      case 'avgPl':
        eventValues.push(0) // No "event" value for normal days
        normalValues.push(analysis.normalDays.avgPl)
        break
      case 'winRate':
        eventValues.push(0)
        normalValues.push(analysis.normalDays.winRate)
        break
      case 'tradeCount':
        eventValues.push(0)
        normalValues.push(analysis.normalDays.tradeCount)
        break
    }
    eventCounts.push(analysis.normalDays.tradeCount)

    // Create bar traces
    const traces: Partial<PlotData>[] = []

    // Event days trace (exclude Normal Days category)
    if (categories.length > 1) {
      const eventCategories = categories.slice(0, -1)
      const eventValuesSliced = eventValues.slice(0, -1)
      const eventCountsSliced = eventCounts.slice(0, -1)

      traces.push({
        x: eventCategories,
        y: eventValuesSliced,
        type: 'bar',
        name: 'Event Days',
        marker: { color: '#ef4444' },
        hovertemplate: viewMode === 'avgPl'
          ? '<b>%{x}</b><br>Event Days: $%{y:.1f}<br>Trades: %{customdata}<extra></extra>'
          : viewMode === 'winRate'
          ? '<b>%{x}</b><br>Event Days: %{y:.1f}%<br>Trades: %{customdata}<extra></extra>'
          : '<b>%{x}</b><br>Event Days: %{y}<extra></extra>',
        customdata: eventCountsSliced,
      })
    }

    // Normal days trace
    traces.push({
      x: categories,
      y: normalValues,
      type: 'bar',
      name: 'Normal Days',
      marker: { color: '#22c55e' },
      hovertemplate: viewMode === 'avgPl'
        ? '<b>%{x}</b><br>Normal Days: $%{y:.1f}<br>Trades: %{customdata}<extra></extra>'
        : viewMode === 'winRate'
        ? '<b>%{x}</b><br>Normal Days: %{y:.1f}%<br>Trades: %{customdata}<extra></extra>'
        : '<b>%{x}</b><br>Normal Days: %{y}<extra></extra>',
      customdata: eventCounts,
    })

    // Determine y-axis title
    let yAxisTitle = ''
    switch (viewMode) {
      case 'avgPl':
        yAxisTitle = 'Average P/L ($)'
        break
      case 'winRate':
        yAxisTitle = 'Win Rate (%)'
        break
      case 'tradeCount':
        yAxisTitle = 'Number of Trades'
        break
    }

    const chartLayout: Partial<Layout> = {
      ...createBarChartLayout('', '', yAxisTitle),
      barmode: 'group',
      yaxis: {
        title: { text: yAxisTitle },
        showgrid: true,
        zeroline: true,
        zerolinecolor: '#e5e7eb',
        zerolinewidth: 1,
      },
      xaxis: {
        title: { text: '' },
        showgrid: false,
      },
      legend: {
        orientation: 'h',
        y: -0.15,
        x: 0.5,
        xanchor: 'center',
      },
      margin: {
        l: 60,
        r: 20,
        t: 20,
        b: 80,
      },
    }

    return { plotData: traces, layout: chartLayout }
  }, [analysis, viewMode])

  // Get unique event types for filter
  const eventTypes = useMemo(() => {
    const types = new Set<CalendarEventType>(events.map(e => e.type))
    return Array.from(types)
  }, [events])

  const tooltip = {
    flavor: "How do news days and special events impact your trading performance?",
    detailed: "This chart compares your trading performance on special event days (FOMC meetings, NFP releases, short weeks, etc.) versus normal trading days. Significant differences can help you decide whether to trade or sit out on these high-impact days."
  }

  const controls = (
    <div className="flex gap-2 flex-wrap items-center">
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => {
          if (value) setViewMode(value as ViewMode)
        }}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="avgPl" aria-label="View average P/L">
          Avg P/L
        </ToggleGroupItem>
        <ToggleGroupItem value="winRate" aria-label="View win rate">
          Win Rate
        </ToggleGroupItem>
        <ToggleGroupItem value="tradeCount" aria-label="View trade count">
          Count
        </ToggleGroupItem>
      </ToggleGroup>

      {eventTypes.length > 1 && (
        <Select
          value={selectedEventType}
          onValueChange={(value) => setSelectedEventType(value as CalendarEventType | 'all')}
        >
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="Filter events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {eventTypes.map(type => (
              <SelectItem key={type} value={type}>
                {CALENDAR_EVENT_TYPE_LABELS[type] || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )

  if (!analysis || plotData.length === 0) {
    return (
      <ChartWrapper
        title="📅 Calendar Sensitivity Analysis"
        description="Performance comparison on event days vs normal trading days"
        className={className}
        data={[]}
        layout={{}}
        tooltip={tooltip}
        actions={controls}
      />
    )
  }

  return (
    <ChartWrapper
      title="📅 Calendar Sensitivity Analysis"
      description="Performance comparison on event days vs normal trading days"
      className={className}
      data={plotData}
      layout={layout}
      style={{ height: '400px' }}
      tooltip={tooltip}
      actions={controls}
    />
  )
}
