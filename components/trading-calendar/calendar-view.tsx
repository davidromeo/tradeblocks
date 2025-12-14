'use client'

import { useMemo } from 'react'
import { useTradingCalendarStore, CalendarDayData, ScalingMode } from '@/lib/stores/trading-calendar-store'
import {
  formatCurrency,
  getPlBackgroundClass,
  getMonthGridDates,
  getWeekGridDates
} from '@/lib/services/calendar-data'
import { cn } from '@/lib/utils'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Format date to YYYY-MM-DD in local timezone
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculate max absolute P/L across calendar days for heatmap scaling
 * Uses the primary display value (actual if available, otherwise backtest)
 */
function calculateMaxAbsPlScaled(days: Map<string, CalendarDayData>, scalingMode: ScalingMode): number {
  let maxAbs = 0
  for (const day of days.values()) {
    // Use actual if available, otherwise backtest (same logic as primaryPl in cell)
    const pl = day.hasActual
      ? getScaledActualPlForMax(day, scalingMode)
      : getScaledBacktestPlForMax(day, scalingMode)
    maxAbs = Math.max(maxAbs, Math.abs(pl))
  }
  return maxAbs
}

// Helper functions for max calculation (defined before usage)
function getScaledBacktestPlForMax(dayData: CalendarDayData, scalingMode: ScalingMode): number {
  if (!dayData.hasBacktest) return 0
  if (scalingMode === 'perContract') {
    const totalContracts = dayData.backtestTrades.reduce((sum, t) => sum + t.numContracts, 0)
    return totalContracts > 0 ? dayData.backtestPl / totalContracts : 0
  }
  if (scalingMode === 'toReported' && dayData.hasActual) {
    // Scale backtest DOWN to match actual (reported) contract counts
    const btContracts = dayData.backtestTrades.reduce((sum, t) => sum + t.numContracts, 0)
    const actualContracts = dayData.actualTrades.reduce((sum, t) => sum + t.numContracts, 0)
    if (btContracts > 0 && actualContracts > 0) {
      return dayData.backtestPl * (actualContracts / btContracts)
    }
  }
  return dayData.backtestPl
}

function getScaledActualPlForMax(dayData: CalendarDayData, scalingMode: ScalingMode): number {
  if (!dayData.hasActual) return 0
  if (scalingMode === 'perContract') {
    const totalContracts = dayData.actualTrades.reduce((sum, t) => sum + t.numContracts, 0)
    return totalContracts > 0 ? dayData.actualPl / totalContracts : 0
  }
  // For 'toReported', actual stays as-is (we scale backtest down to match actual)
  return dayData.actualPl
}

interface CalendarDayCellProps {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  onClick: () => void
}

/**
 * Get scaled backtest P/L for display
 */
function getScaledBacktestPl(dayData: CalendarDayData, scalingMode: ScalingMode): number {
  if (!dayData.hasBacktest) return 0

  if (scalingMode === 'perContract') {
    const totalContracts = dayData.backtestTrades.reduce((sum, t) => sum + t.numContracts, 0)
    return totalContracts > 0 ? dayData.backtestPl / totalContracts : 0
  }

  if (scalingMode === 'toReported' && dayData.hasActual) {
    // Scale backtest DOWN to match actual (reported) contract counts
    const btContracts = dayData.backtestTrades.reduce((sum, t) => sum + t.numContracts, 0)
    const actualContracts = dayData.actualTrades.reduce((sum, t) => sum + t.numContracts, 0)
    if (btContracts > 0 && actualContracts > 0) {
      return dayData.backtestPl * (actualContracts / btContracts)
    }
  }

  // raw shows backtest as-is
  return dayData.backtestPl
}

/**
 * Get scaled actual P/L for display
 */
function getScaledActualPl(dayData: CalendarDayData, scalingMode: ScalingMode): number {
  if (!dayData.hasActual) return 0

  if (scalingMode === 'perContract') {
    const totalContracts = dayData.actualTrades.reduce((sum, t) => sum + t.numContracts, 0)
    return totalContracts > 0 ? dayData.actualPl / totalContracts : 0
  }

  // For 'raw' and 'toReported', actual stays as-is (we scale backtest down to match actual)
  return dayData.actualPl
}

function CalendarDayCell({ date, isCurrentMonth, isToday, onClick }: CalendarDayCellProps) {
  const { calendarDays, scalingMode, dataDisplayMode } = useTradingCalendarStore()

  const dateKey = formatDateKey(date)
  const dayData = calendarDays.get(dateKey)

  // Calculate max P/L for heatmap scaling (using the primary display value)
  const maxAbsPl = useMemo(() => calculateMaxAbsPlScaled(calendarDays, scalingMode), [calendarDays, scalingMode])

  const hasTrades = dayData && (dayData.hasBacktest || dayData.hasActual)
  const hasBacktestData = dayData?.hasBacktest ?? false
  const hasActualData = dayData?.hasActual ?? false

  // Determine what to show based on display mode
  const showBacktest = (dataDisplayMode === 'backtest' || dataDisplayMode === 'both') && hasBacktestData
  const showActual = (dataDisplayMode === 'actual' || dataDisplayMode === 'both') && hasActualData

  // Get both P/L values
  const backtestPl = dayData ? getScaledBacktestPl(dayData, scalingMode) : 0
  const actualPl = dayData ? getScaledActualPl(dayData, scalingMode) : 0

  // Primary P/L for heatmap based on display mode
  const primaryPl = dataDisplayMode === 'backtest'
    ? backtestPl
    : dataDisplayMode === 'actual'
      ? actualPl
      : (hasActualData ? actualPl : backtestPl)

  // Get background color based on primary P/L
  const bgClass = hasTrades ? getPlBackgroundClass(primaryPl, maxAbsPl) : ''

  return (
    <button
      onClick={onClick}
      disabled={!hasTrades}
      className={cn(
        "relative flex flex-col items-start p-2 min-h-[100px] border-b border-r border-border/50 transition-colors",
        isCurrentMonth ? "bg-background" : "bg-muted/30",
        hasTrades && "hover:bg-accent cursor-pointer",
        !hasTrades && "cursor-default",
        bgClass,
        isToday && "ring-2 ring-primary ring-inset"
      )}
    >
      {/* Date number */}
      <span className={cn(
        "text-sm font-medium",
        !isCurrentMonth && "text-muted-foreground",
        isToday && "text-primary font-bold"
      )}>
        {date.getDate()}
      </span>

      {/* Trade data */}
      {hasTrades && (
        <div className="flex flex-col items-start mt-1 w-full gap-0.5">
          {/* Single data source mode - larger, simpler display */}
          {dataDisplayMode !== 'both' ? (
            <>
              {showBacktest && (
                <div className="flex flex-col">
                  <span className={cn(
                    "text-lg font-semibold",
                    backtestPl > 0 && "text-green-500",
                    backtestPl < 0 && "text-red-500",
                    backtestPl === 0 && "text-muted-foreground"
                  )}>
                    {formatCurrency(backtestPl, true)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dayData?.backtestTradeCount} {dayData?.backtestTradeCount === 1 ? 'trade' : 'trades'}
                  </span>
                </div>
              )}
              {showActual && (
                <div className="flex flex-col">
                  <span className={cn(
                    "text-lg font-semibold",
                    actualPl > 0 && "text-green-500",
                    actualPl < 0 && "text-red-500",
                    actualPl === 0 && "text-muted-foreground"
                  )}>
                    {formatCurrency(actualPl, true)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dayData?.actualTradeCount} {dayData?.actualTradeCount === 1 ? 'trade' : 'trades'}
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Both mode - compact with dots */
            <>
              {showBacktest && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className={cn(
                    "text-sm font-medium",
                    backtestPl > 0 && "text-green-500",
                    backtestPl < 0 && "text-red-500",
                    backtestPl === 0 && "text-muted-foreground"
                  )}>
                    {formatCurrency(backtestPl, true)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({dayData?.backtestTradeCount})
                  </span>
                </div>
              )}
              {showActual && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                  <span className={cn(
                    "text-sm font-medium",
                    actualPl > 0 && "text-green-500",
                    actualPl < 0 && "text-red-500",
                    actualPl === 0 && "text-muted-foreground"
                  )}>
                    {formatCurrency(actualPl, true)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({dayData?.actualTradeCount})
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </button>
  )
}

interface WeeklySummaryProps {
  dates: Date[]
}

function WeeklySummary({ dates }: WeeklySummaryProps) {
  const { calendarDays, scalingMode, dataDisplayMode } = useTradingCalendarStore()

  // Calculate week totals for both backtest and actual (using scaled values)
  const weekStats = useMemo(() => {
    let backtestPl = 0
    let actualPl = 0
    let backtestDays = 0
    let actualDays = 0

    for (const date of dates) {
      const dateKey = formatDateKey(date)
      const dayData = calendarDays.get(dateKey)

      if (dayData) {
        if (dayData.hasBacktest) {
          backtestPl += getScaledBacktestPl(dayData, scalingMode)
          backtestDays++
        }
        if (dayData.hasActual) {
          actualPl += getScaledActualPl(dayData, scalingMode)
          actualDays++
        }
      }
    }

    return { backtestPl, actualPl, backtestDays, actualDays }
  }, [dates, calendarDays, scalingMode])

  // Determine what to show based on display mode
  const showBacktest = (dataDisplayMode === 'backtest' || dataDisplayMode === 'both') && weekStats.backtestDays > 0
  const showActual = (dataDisplayMode === 'actual' || dataDisplayMode === 'both') && weekStats.actualDays > 0

  const hasTrades = showBacktest || showActual

  if (!hasTrades) {
    return (
      <div className="flex flex-col items-end justify-center p-2 min-h-[100px] border-b border-border/50 bg-muted/20">
        <span className="text-xs text-muted-foreground">-</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start justify-center p-2 min-h-[100px] border-b border-border/50 bg-muted/20 gap-0.5">
      {/* Single data source mode - larger, simpler display */}
      {dataDisplayMode !== 'both' ? (
        <>
          {showBacktest && (
            <div className="flex flex-col">
              <span className={cn(
                "text-lg font-bold",
                weekStats.backtestPl > 0 && "text-green-500",
                weekStats.backtestPl < 0 && "text-red-500"
              )}>
                {formatCurrency(weekStats.backtestPl, true)}
              </span>
              <span className="text-xs text-muted-foreground">
                {weekStats.backtestDays} {weekStats.backtestDays === 1 ? 'day' : 'days'}
              </span>
            </div>
          )}
          {showActual && (
            <div className="flex flex-col">
              <span className={cn(
                "text-lg font-bold",
                weekStats.actualPl > 0 && "text-green-500",
                weekStats.actualPl < 0 && "text-red-500"
              )}>
                {formatCurrency(weekStats.actualPl, true)}
              </span>
              <span className="text-xs text-muted-foreground">
                {weekStats.actualDays} {weekStats.actualDays === 1 ? 'day' : 'days'}
              </span>
            </div>
          )}
        </>
      ) : (
        /* Both mode - compact with dots */
        <>
          {showBacktest && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              <span className={cn(
                "text-sm font-bold",
                weekStats.backtestPl > 0 && "text-green-500",
                weekStats.backtestPl < 0 && "text-red-500"
              )}>
                {formatCurrency(weekStats.backtestPl, true)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({weekStats.backtestDays}d)
              </span>
            </div>
          )}
          {showActual && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
              <span className={cn(
                "text-sm font-bold",
                weekStats.actualPl > 0 && "text-green-500",
                weekStats.actualPl < 0 && "text-red-500"
              )}>
                {formatCurrency(weekStats.actualPl, true)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({weekStats.actualDays}d)
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function CalendarView() {
  const {
    viewDate,
    calendarViewMode,
    dataDisplayMode,
    navigateToDay
  } = useTradingCalendarStore()

  const today = new Date()
  const todayKey = formatDateKey(today)

  // Get dates to display based on view mode
  const gridDates = useMemo(() => {
    if (calendarViewMode === 'month') {
      return getMonthGridDates(viewDate.getFullYear(), viewDate.getMonth())
    }
    return getWeekGridDates(viewDate)
  }, [viewDate, calendarViewMode])

  // Group dates by week for weekly summaries
  const weeks = useMemo(() => {
    const result: Date[][] = []
    for (let i = 0; i < gridDates.length; i += 7) {
      result.push(gridDates.slice(i, i + 7))
    }
    return result
  }, [gridDates])

  const currentMonth = viewDate.getMonth()

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-[repeat(7,1fr)_140px] bg-muted/50">
        {WEEKDAY_LABELS.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-r border-border/50"
          >
            {day}
          </div>
        ))}
        <div className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-border/50">
          Weekly
        </div>
      </div>

      {/* Calendar grid */}
      <div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-[repeat(7,1fr)_140px]">
            {week.map((date) => {
              const dateKey = formatDateKey(date)
              const isCurrentMonth = date.getMonth() === currentMonth
              const isToday = dateKey === todayKey

              return (
                <CalendarDayCell
                  key={dateKey}
                  date={date}
                  isCurrentMonth={isCurrentMonth}
                  isToday={isToday}
                  onClick={() => navigateToDay(dateKey)}
                />
              )
            })}
            <WeeklySummary dates={week} />
          </div>
        ))}
      </div>

      {/* Legend - only show when in "both" mode */}
      {dataDisplayMode === 'both' && (
        <div className="flex items-center gap-4 p-3 bg-muted/30 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Backtest</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Actual</span>
          </div>
        </div>
      )}
    </div>
  )
}
