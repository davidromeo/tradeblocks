/**
 * Calendar Sensitivity Analysis
 *
 * Analyzes trading performance sensitivity to calendar events
 * (news days, short weeks, holidays, etc.)
 */

import type { Trade } from '@/lib/models/trade'
import type {
  CalendarEvent,
  CalendarEventType,
  CalendarEventStats,
  CalendarSensitivityAnalysis,
  CalendarEventMatch,
} from '@/lib/models/calendar-event'

/**
 * Match trades to calendar events
 * Returns an array of matches for each trade
 */
export function matchTradesToCalendarEvents(
  trades: Trade[],
  events: CalendarEvent[]
): Map<string, CalendarEventMatch[]> {
  const tradeMatches = new Map<string, CalendarEventMatch[]>()

  trades.forEach(trade => {
    const tradeDate = new Date(trade.dateOpened)
    // Normalize to start of day for comparison
    tradeDate.setHours(0, 0, 0, 0)

    const matches: CalendarEventMatch[] = []

    events.forEach(event => {
      const eventDate = new Date(event.date)
      eventDate.setHours(0, 0, 0, 0)

      // Check if trade date matches event date
      if (tradeDate.getTime() === eventDate.getTime()) {
        matches.push({
          event,
          datasetId: event.type, // Using type as dataset ID for now
          timeDifferenceMs: 0,
        })
      }
      // If event has an endDate (period events), check if trade falls within
      else if (event.endDate) {
        const endDate = new Date(event.endDate)
        endDate.setHours(0, 0, 0, 0)

        if (tradeDate >= eventDate && tradeDate <= endDate) {
          matches.push({
            event,
            datasetId: event.type,
            timeDifferenceMs: tradeDate.getTime() - eventDate.getTime(),
          })
        }
      }
    })

    if (matches.length > 0) {
      tradeMatches.set(trade.id, matches)
    }
  })

  return tradeMatches
}

/**
 * Calculate statistics for a specific event type
 */
export function calculateEventTypeStats(
  trades: Trade[],
  eventType: CalendarEventType,
  tradeMatches: Map<string, CalendarEventMatch[]>
): CalendarEventStats {
  const tradesOnEventDays: Trade[] = []
  const tradesOnNormalDays: Trade[] = []

  trades.forEach(trade => {
    const matches = tradeMatches.get(trade.id) || []
    const hasEventOfType = matches.some(m => m.event.type === eventType)

    if (hasEventOfType) {
      tradesOnEventDays.push(trade)
    } else {
      tradesOnNormalDays.push(trade)
    }
  })

  // Calculate stats for event days
  const eventDaysStats = calculateBasicStats(tradesOnEventDays)
  const normalDaysStats = calculateBasicStats(tradesOnNormalDays)

  return {
    eventType,
    totalTrades: trades.length,
    tradesOnEventDays: tradesOnEventDays.length,
    tradesOnNormalDays: tradesOnNormalDays.length,
    avgPlEventDays: eventDaysStats.avgPl,
    avgPlNormalDays: normalDaysStats.avgPl,
    winRateEventDays: eventDaysStats.winRate,
    winRateNormalDays: normalDaysStats.winRate,
    eventDaysPercent: trades.length > 0 
      ? (tradesOnEventDays.length / trades.length) * 100 
      : 0,
  }
}

/**
 * Calculate basic statistics for a list of trades
 */
function calculateBasicStats(trades: Trade[]): { avgPl: number; winRate: number } {
  if (trades.length === 0) {
    return { avgPl: 0, winRate: 0 }
  }

  const totalPl = trades.reduce((sum, trade) => sum + (trade.pl || 0), 0)
  const avgPl = totalPl / trades.length

  const winners = trades.filter(trade => (trade.pl || 0) > 0).length
  const winRate = (winners / trades.length) * 100

  return { avgPl, winRate }
}

/**
 * Perform comprehensive calendar sensitivity analysis
 */
export function analyzeCalendarSensitivity(
  trades: Trade[],
  events: CalendarEvent[]
): CalendarSensitivityAnalysis {
  // Match all trades to events
  const tradeMatches = matchTradesToCalendarEvents(trades, events)

  // Calculate overall stats
  const overallStats = calculateBasicStats(trades)

  // Get unique event types
  const eventTypes = new Set<CalendarEventType>(events.map(e => e.type))

  // Calculate stats for each event type
  const byEventType = new Map<CalendarEventType, CalendarEventStats>()
  eventTypes.forEach(eventType => {
    const stats = calculateEventTypeStats(trades, eventType, tradeMatches)
    byEventType.set(eventType, stats)
  })

  // Calculate stats for normal days (no events)
  const tradesWithNoEvents = trades.filter(trade => !tradeMatches.has(trade.id))
  const normalDaysStats = calculateBasicStats(tradesWithNoEvents)

  return {
    overall: {
      totalTrades: trades.length,
      avgPl: overallStats.avgPl,
      winRate: overallStats.winRate,
    },
    byEventType,
    normalDays: {
      tradeCount: tradesWithNoEvents.length,
      avgPl: normalDaysStats.avgPl,
      winRate: normalDaysStats.winRate,
    },
  }
}

/**
 * Filter trades to only those on event days
 */
export function filterTradesByEventType(
  trades: Trade[],
  events: CalendarEvent[],
  eventTypes: CalendarEventType[]
): Trade[] {
  const tradeMatches = matchTradesToCalendarEvents(trades, events)

  return trades.filter(trade => {
    const matches = tradeMatches.get(trade.id) || []
    return matches.some(m => eventTypes.includes(m.event.type))
  })
}

/**
 * Filter trades to only those NOT on event days
 */
export function filterTradesExcludingEvents(
  trades: Trade[],
  events: CalendarEvent[],
  eventTypes?: CalendarEventType[]
): Trade[] {
  const tradeMatches = matchTradesToCalendarEvents(trades, events)

  return trades.filter(trade => {
    const matches = tradeMatches.get(trade.id) || []
    
    if (matches.length === 0) {
      return true // No events on this day
    }

    // If specific event types provided, exclude only those types
    if (eventTypes && eventTypes.length > 0) {
      return !matches.some(m => eventTypes.includes(m.event.type))
    }

    // Otherwise, exclude all event days
    return false
  })
}

/**
 * Group trades by event type
 */
export function groupTradesByEventType(
  trades: Trade[],
  events: CalendarEvent[]
): Map<CalendarEventType | 'none', Trade[]> {
  const tradeMatches = matchTradesToCalendarEvents(trades, events)
  const groups = new Map<CalendarEventType | 'none', Trade[]>()

  // Initialize groups for all event types
  const eventTypes = new Set<CalendarEventType>(events.map(e => e.type))
  eventTypes.forEach(type => groups.set(type, []))
  groups.set('none', [])

  trades.forEach(trade => {
    const matches = tradeMatches.get(trade.id) || []

    if (matches.length === 0) {
      // No events on this day
      groups.get('none')!.push(trade)
    } else {
      // Add to each matching event type
      matches.forEach(match => {
        const group = groups.get(match.event.type) || []
        group.push(trade)
        groups.set(match.event.type, group)
      })
    }
  })

  return groups
}

/**
 * Calculate day-by-day comparison for visualization
 */
export interface DayComparisonData {
  date: Date
  pl: number
  hasEvent: boolean
  eventTypes: CalendarEventType[]
  eventNames: string[]
}

export function calculateDayComparison(
  trades: Trade[],
  events: CalendarEvent[]
): DayComparisonData[] {
  const tradesByDay = new Map<string, Trade[]>()
  const eventsByDay = new Map<string, CalendarEvent[]>()

  // Group trades by day
  trades.forEach(trade => {
    const dateKey = formatDateKey(new Date(trade.dateOpened))
    const dayTrades = tradesByDay.get(dateKey) || []
    dayTrades.push(trade)
    tradesByDay.set(dateKey, dayTrades)
  })

  // Group events by day
  events.forEach(event => {
    const dateKey = formatDateKey(new Date(event.date))
    const dayEvents = eventsByDay.get(dateKey) || []
    dayEvents.push(event)
    eventsByDay.set(dateKey, dayEvents)
  })

  // Create comparison data
  const comparisonData: DayComparisonData[] = []

  tradesByDay.forEach((dayTrades, dateKey) => {
    const date = parseDateKey(dateKey)
    const dayEvents = eventsByDay.get(dateKey) || []
    const totalPl = dayTrades.reduce((sum, trade) => sum + (trade.pl || 0), 0)

    comparisonData.push({
      date,
      pl: totalPl,
      hasEvent: dayEvents.length > 0,
      eventTypes: dayEvents.map(e => e.type),
      eventNames: dayEvents.map(e => e.name),
    })
  })

  // Sort by date
  comparisonData.sort((a, b) => a.date.getTime() - b.date.getTime())

  return comparisonData
}

/**
 * Helper: Format date as string key (YYYY-MM-DD)
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Helper: Parse date key back to Date
 */
function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}
