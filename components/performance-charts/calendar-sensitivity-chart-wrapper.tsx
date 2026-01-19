"use client"

import React, { useMemo } from 'react'
import { CalendarSensitivityChart as BaseSensitivityChart } from './calendar-sensitivity-chart'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { generateCalendarEventsForRange } from '@/lib/services/calendar-event-generator'

interface CalendarSensitivityChartWrapperProps {
  className?: string
}

/**
 * Wrapper component that integrates with the Performance Store
 * This connects the calendar sensitivity chart to the existing performance data flow
 */
export function CalendarSensitivityChartWrapper({ className }: CalendarSensitivityChartWrapperProps) {
  const { data } = usePerformanceStore()

  // Generate calendar events for the date range of the trades
  const calendarEvents = useMemo(() => {
    if (!data?.trades || data.trades.length === 0) {
      return []
    }

    // Find min and max years from trades
    const years = data.trades.map(trade => new Date(trade.dateOpened).getFullYear())
    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)

    // Generate events for the full range, plus one year buffer on each side
    return generateCalendarEventsForRange(minYear - 1, maxYear + 1)
  }, [data?.trades])

  if (!data?.trades || data.trades.length === 0) {
    return (
      <BaseSensitivityChart
        trades={[]}
        events={[]}
        className={className}
      />
    )
  }

  return (
    <BaseSensitivityChart
      trades={data.trades}
      events={calendarEvents}
      className={className}
    />
  )
}
