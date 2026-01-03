/**
 * Calendar Event Filter Helpers
 * 
 * Convenient helper functions for filtering trades based on calendar events.
 * These utilities make it easy to implement blackout day filtering as described
 * in the original issue.
 */

import type { Trade } from '@/lib/models/trade'
import type { CalendarEvent, CalendarEventType } from '@/lib/models/calendar-event'
import { 
  filterTradesByEventType, 
  filterTradesExcludingEvents,
  analyzeCalendarSensitivity,
} from '@/lib/calculations/calendar-sensitivity'
import { generateCalendarEventsForRange } from '@/lib/services/calendar-event-generator'

/**
 * Get the year range from trades
 */
export function getTradeYearRange(trades: Trade[]): { minYear: number; maxYear: number } {
  if (trades.length === 0) {
    const currentYear = new Date().getFullYear()
    return { minYear: currentYear, maxYear: currentYear }
  }

  const years = trades.map(trade => new Date(trade.dateOpened).getFullYear())
  return {
    minYear: Math.min(...years),
    maxYear: Math.max(...years),
  }
}

/**
 * Get calendar events for a trade set
 * Automatically generates events for the date range of the trades
 */
export function getCalendarEventsForTrades(trades: Trade[]): CalendarEvent[] {
  const { minYear, maxYear } = getTradeYearRange(trades)
  return generateCalendarEventsForRange(minYear, maxYear)
}

/**
 * Filter out blackout days (news days, short weeks, etc.)
 * This is the main use case from the original issue
 * 
 * @example
 * ```typescript
 * // Remove all FOMC and NFP days
 * const cleanTrades = excludeBlackoutDays(trades, ['fomc_meeting', 'nonfarm_payroll'])
 * 
 * // Remove all short weeks
 * const noShortWeeks = excludeBlackoutDays(trades, ['short_week'])
 * ```
 */
export function excludeBlackoutDays(
  trades: Trade[],
  eventTypes: CalendarEventType[]
): Trade[] {
  const events = getCalendarEventsForTrades(trades)
  return filterTradesExcludingEvents(trades, events, eventTypes)
}

/**
 * Get only trades on specific event days
 * Useful for analyzing performance on those days separately
 * 
 * @example
 * ```typescript
 * // Get only FOMC day trades
 * const fomcTrades = includeOnlyEventDays(trades, ['fomc_meeting'])
 * ```
 */
export function includeOnlyEventDays(
  trades: Trade[],
  eventTypes: CalendarEventType[]
): Trade[] {
  const events = getCalendarEventsForTrades(trades)
  return filterTradesByEventType(trades, events, eventTypes)
}

/**
 * Split trades into event days and normal days
 * This matches the workflow described in the issue:
 * - Run trades on all days
 * - Separate out blackout days
 * - Analyze them separately
 * 
 * @example
 * ```typescript
 * const { eventDayTrades, normalDayTrades } = splitByEventDays(
 *   trades,
 *   ['fomc_meeting', 'short_week']
 * )
 * 
 * // Now you can analyze them separately
 * const eventStats = calculatePortfolioStats(eventDayTrades)
 * const normalStats = calculatePortfolioStats(normalDayTrades)
 * ```
 */
export function splitByEventDays(
  trades: Trade[],
  eventTypes: CalendarEventType[]
): {
  eventDayTrades: Trade[]
  normalDayTrades: Trade[]
} {
  const events = getCalendarEventsForTrades(trades)
  
  return {
    eventDayTrades: filterTradesByEventType(trades, events, eventTypes),
    normalDayTrades: filterTradesExcludingEvents(trades, events, eventTypes),
  }
}

/**
 * Quick sensitivity analysis for common event types
 * Returns a summary that's easy to display or log
 * 
 * @example
 * ```typescript
 * const summary = getEventSensitivitySummary(trades)
 * 
 * console.log(`FOMC days: ${summary.fomc_meeting.avgPlEventDays.toFixed(2)}`)
 * console.log(`Normal days: ${summary.fomc_meeting.avgPlNormalDays.toFixed(2)}`)
 * console.log(`Difference: ${summary.fomc_meeting.difference.toFixed(2)}`)
 * ```
 */
export function getEventSensitivitySummary(trades: Trade[]) {
  const events = getCalendarEventsForTrades(trades)
  const analysis = analyzeCalendarSensitivity(trades, events)

  const summary: Record<string, {
    avgPlEventDays: number
    avgPlNormalDays: number
    difference: number
    winRateEventDays: number
    winRateNormalDays: number
    tradeCountEventDays: number
    tradeCountNormalDays: number
  }> = {}

  analysis.byEventType.forEach((stats, eventType) => {
    summary[eventType] = {
      avgPlEventDays: stats.avgPlEventDays,
      avgPlNormalDays: stats.avgPlNormalDays,
      difference: stats.avgPlEventDays - stats.avgPlNormalDays,
      winRateEventDays: stats.winRateEventDays,
      winRateNormalDays: stats.winRateNormalDays,
      tradeCountEventDays: stats.tradesOnEventDays,
      tradeCountNormalDays: stats.tradesOnNormalDays,
    }
  })

  return summary
}

/**
 * Recommend which event types to avoid based on performance
 * Returns event types where performance is significantly worse
 * 
 * @param trades - All trades
 * @param minTradeCount - Minimum trades on event days to consider (default: 5)
 * @param performanceThreshold - Threshold for "significantly worse" in $ (default: -50)
 * 
 * @example
 * ```typescript
 * const avoid = recommendEventTypesToAvoid(trades)
 * console.log('Consider avoiding:', avoid.map(e => e.eventType))
 * ```
 */
export function recommendEventTypesToAvoid(
  trades: Trade[],
  minTradeCount = 5,
  performanceThreshold = -50
): Array<{
  eventType: CalendarEventType
  avgPlEventDays: number
  avgPlNormalDays: number
  difference: number
  tradeCount: number
}> {
  const events = getCalendarEventsForTrades(trades)
  const analysis = analyzeCalendarSensitivity(trades, events)

  const recommendations: Array<{
    eventType: CalendarEventType
    avgPlEventDays: number
    avgPlNormalDays: number
    difference: number
    tradeCount: number
  }> = []

  analysis.byEventType.forEach((stats, eventType) => {
    // Only recommend if we have enough data
    if (stats.tradesOnEventDays < minTradeCount) {
      return
    }

    const difference = stats.avgPlEventDays - stats.avgPlNormalDays

    // If performance is significantly worse on event days
    if (difference < performanceThreshold) {
      recommendations.push({
        eventType,
        avgPlEventDays: stats.avgPlEventDays,
        avgPlNormalDays: stats.avgPlNormalDays,
        difference,
        tradeCount: stats.tradesOnEventDays,
      })
    }
  })

  // Sort by most negative difference first
  recommendations.sort((a, b) => a.difference - b.difference)

  return recommendations
}

/**
 * Get a clean trade set with recommended blackout days removed
 * This is a convenience function that combines analysis and filtering
 * 
 * @example
 * ```typescript
 * const { cleanTrades, removedEventTypes, stats } = getCleanTradeSet(trades)
 * 
 * console.log(`Removed ${removedEventTypes.length} event types`)
 * console.log(`Kept ${cleanTrades.length} of ${trades.length} trades`)
 * ```
 */
export function getCleanTradeSet(
  trades: Trade[],
  options?: {
    minTradeCount?: number
    performanceThreshold?: number
  }
) {
  const recommendations = recommendEventTypesToAvoid(
    trades,
    options?.minTradeCount,
    options?.performanceThreshold
  )

  const removedEventTypes = recommendations.map(r => r.eventType)
  const cleanTrades = removedEventTypes.length > 0
    ? excludeBlackoutDays(trades, removedEventTypes)
    : trades

  return {
    cleanTrades,
    removedEventTypes,
    originalTradeCount: trades.length,
    cleanTradeCount: cleanTrades.length,
    removedTradeCount: trades.length - cleanTrades.length,
    recommendations,
  }
}
