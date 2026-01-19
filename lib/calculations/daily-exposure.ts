/**
 * Daily exposure calculation using a sweep-line algorithm.
 *
 * Instead of O(N×M) checking all trades for each day, we use O(N+M) by:
 * 1. Pre-computing exposure change events (opens add margin, closes remove it)
 * 2. Sorting events chronologically
 * 3. Sweeping through dates and accumulating exposure changes
 */

import type { Trade } from '@/lib/models/trade'

/**
 * Daily exposure data point
 */
export interface DailyExposurePoint {
  date: string
  exposure: number
  exposurePercent: number
  openPositions: number
}

/**
 * Peak exposure data
 */
export interface PeakExposure {
  date: string
  exposure: number
  exposurePercent: number
}

/**
 * Equity curve point for percentage calculations
 */
export interface EquityCurvePoint {
  date: string
  equity: number
}

/**
 * Result of daily exposure calculation
 */
export interface DailyExposureResult {
  dailyExposure: DailyExposurePoint[]
  peakDailyExposure: PeakExposure | null
  peakDailyExposurePercent: PeakExposure | null
}

/**
 * Get a finite number from a value, or undefined if not a finite number
 */
function getFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && isFinite(value)) {
    return value
  }
  return undefined
}

/**
 * Format a date to YYYY-MM-DD string
 */
function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Calculate daily exposure using a sweep-line algorithm.
 *
 * @param trades - Array of trades to analyze
 * @param equityCurve - Array of equity curve points for percentage calculations
 * @returns Daily exposure time series and peak exposure points
 */
export function calculateDailyExposure(
  trades: Trade[],
  equityCurve: EquityCurvePoint[]
): DailyExposureResult {
  if (trades.length === 0) {
    return { dailyExposure: [], peakDailyExposure: null, peakDailyExposurePercent: null }
  }

  // Build a map of equity by date for percentage calculations
  const equityByDate = new Map<string, number>()
  for (const point of equityCurve) {
    const dateKey = point.date.slice(0, 10)
    equityByDate.set(dateKey, point.equity)
  }

  // Build exposure change events: +margin on open day, -margin on day AFTER close
  type ExposureEvent = { dateKey: string; marginDelta: number; positionDelta: number }
  const events: ExposureEvent[] = []

  for (const trade of trades) {
    const margin = getFiniteNumber(trade.marginReq) ?? 0
    if (margin <= 0) continue

    const openDate = new Date(trade.dateOpened)
    if (isNaN(openDate.getTime())) continue
    openDate.setHours(0, 0, 0, 0)
    const openKey = formatDateKey(openDate)

    // Add margin on open date
    events.push({ dateKey: openKey, marginDelta: margin, positionDelta: 1 })

    // Remove margin on day AFTER close (so close day still shows as open)
    if (trade.dateClosed) {
      const closeDate = new Date(trade.dateClosed)
      if (!isNaN(closeDate.getTime())) {
        closeDate.setHours(0, 0, 0, 0)
        closeDate.setDate(closeDate.getDate() + 1) // Day after close
        const closeKey = formatDateKey(closeDate)
        events.push({ dateKey: closeKey, marginDelta: -margin, positionDelta: -1 })
      }
    }
    // If no close date, position stays open indefinitely (no removal event)
  }

  if (events.length === 0) {
    return { dailyExposure: [], peakDailyExposure: null, peakDailyExposurePercent: null }
  }

  // Sort events by date
  events.sort((a, b) => a.dateKey.localeCompare(b.dateKey))

  // Aggregate events by date into a map of daily deltas
  const dailyDeltas = new Map<string, { marginDelta: number; positionDelta: number }>()
  for (const event of events) {
    const existing = dailyDeltas.get(event.dateKey) ?? { marginDelta: 0, positionDelta: 0 }
    existing.marginDelta += event.marginDelta
    existing.positionDelta += event.positionDelta
    dailyDeltas.set(event.dateKey, existing)
  }

  // Find date range from events
  const sortedDates = Array.from(dailyDeltas.keys()).sort()
  const minDateKey = sortedDates[0]
  const maxDateKey = sortedDates[sortedDates.length - 1]

  // Sweep through dates, accumulating exposure
  const dailyExposure: DailyExposurePoint[] = []
  let peakDailyExposure: PeakExposure | null = null
  let peakDailyExposurePercent: PeakExposure | null = null
  let lastKnownEquity = 0

  let runningExposure = 0
  let runningPositions = 0

  const currentDate = new Date(minDateKey + 'T00:00:00.000Z')
  const endDate = new Date(maxDateKey + 'T00:00:00.000Z')

  while (currentDate <= endDate) {
    const dateKey = formatDateKey(currentDate)

    // Apply any deltas for this day
    const delta = dailyDeltas.get(dateKey)
    if (delta) {
      runningExposure += delta.marginDelta
      runningPositions += delta.positionDelta
    }

    // Get equity for percentage calculation
    const equity = equityByDate.get(dateKey) ?? lastKnownEquity
    if (equity > 0) lastKnownEquity = equity

    const exposurePercent = equity > 0 ? (runningExposure / equity) * 100 : 0

    // Only include days with open positions
    if (runningPositions > 0 && runningExposure > 0) {
      dailyExposure.push({
        date: currentDate.toISOString(),
        exposure: runningExposure,
        exposurePercent,
        openPositions: runningPositions
      })

      // Track peak exposure (by dollar amount)
      if (!peakDailyExposure || runningExposure > peakDailyExposure.exposure) {
        peakDailyExposure = {
          date: currentDate.toISOString(),
          exposure: runningExposure,
          exposurePercent
        }
      }

      // Track peak exposure (by percentage)
      if (!peakDailyExposurePercent || exposurePercent > peakDailyExposurePercent.exposurePercent) {
        peakDailyExposurePercent = {
          date: currentDate.toISOString(),
          exposure: runningExposure,
          exposurePercent
        }
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return { dailyExposure, peakDailyExposure, peakDailyExposurePercent }
}
