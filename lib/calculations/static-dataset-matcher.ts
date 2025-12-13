/**
 * Static Dataset Matcher
 *
 * Matches trades to static dataset rows based on configurable matching strategies.
 * Used for correlating trades with market data (VIX, SPX, etc.) at trade entry time.
 */

import type { Trade } from '../models/trade'
import type {
  StaticDataset,
  StaticDatasetRow,
  MatchStrategy,
  DatasetMatchResult,
  DatasetMatchStats,
} from '../models/static-dataset'

/**
 * Combine trade date and time into a single timestamp
 */
export function combineDateAndTime(dateOpened: Date, timeOpened: string): Date {
  const date = new Date(dateOpened)

  // Parse time string (HH:mm:ss or H:mm:ss)
  const timeParts = timeOpened.split(':')
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0], 10)
    const minutes = parseInt(timeParts[1], 10)
    const seconds = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0

    if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
      date.setHours(hours, minutes, seconds, 0)
    }
  }

  return date
}

/**
 * Match a single trade to a dataset row using the specified strategy
 */
export function matchTradeToDataset(
  trade: Trade,
  rows: StaticDatasetRow[],
  strategy: MatchStrategy
): StaticDatasetRow | null {
  if (rows.length === 0) {
    return null
  }

  const tradeTimestamp = combineDateAndTime(trade.dateOpened, trade.timeOpened)
  const tradeTime = tradeTimestamp.getTime()

  switch (strategy) {
    case 'exact':
      return matchExact(rows, tradeTime)

    case 'same-day':
      return matchSameDay(rows, tradeTimestamp)

    case 'nearest-before':
      return matchNearestBefore(rows, tradeTime)

    case 'nearest-after':
      return matchNearestAfter(rows, tradeTime)

    case 'nearest':
      return matchNearest(rows, tradeTime)

    default:
      return null
  }
}

/**
 * Get the date-only portion of a timestamp as YYYY-MM-DD string
 * This normalizes both Date objects and date strings to a comparable format
 */
function getDateOnly(date: Date): string {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Find a row that matches the same calendar day as the trade
 * Uses binary search for efficiency
 */
function matchSameDay(rows: StaticDatasetRow[], tradeTimestamp: Date): StaticDatasetRow | null {
  const tradeDateStr = getDateOnly(tradeTimestamp)

  // Binary search to find any row on the same day
  let left = 0
  let right = rows.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const rowDateStr = getDateOnly(new Date(rows[mid].timestamp))

    if (rowDateStr === tradeDateStr) {
      return rows[mid]
    } else if (rowDateStr < tradeDateStr) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return null
}

/**
 * Find an exact timestamp match
 */
function matchExact(rows: StaticDatasetRow[], tradeTime: number): StaticDatasetRow | null {
  // Use binary search for efficiency
  let left = 0
  let right = rows.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const rowTime = new Date(rows[mid].timestamp).getTime()

    if (rowTime === tradeTime) {
      return rows[mid]
    } else if (rowTime < tradeTime) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return null
}

/**
 * Find the nearest row at or before the trade time
 */
function matchNearestBefore(rows: StaticDatasetRow[], tradeTime: number): StaticDatasetRow | null {
  // Binary search for the rightmost element <= tradeTime
  let left = 0
  let right = rows.length - 1
  let result: StaticDatasetRow | null = null

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const rowTime = new Date(rows[mid].timestamp).getTime()

    if (rowTime <= tradeTime) {
      result = rows[mid]
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return result
}

/**
 * Find the nearest row at or after the trade time
 */
function matchNearestAfter(rows: StaticDatasetRow[], tradeTime: number): StaticDatasetRow | null {
  // Binary search for the leftmost element >= tradeTime
  let left = 0
  let right = rows.length - 1
  let result: StaticDatasetRow | null = null

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const rowTime = new Date(rows[mid].timestamp).getTime()

    if (rowTime >= tradeTime) {
      result = rows[mid]
      right = mid - 1
    } else {
      left = mid + 1
    }
  }

  return result
}

/**
 * Find the nearest row by absolute time difference
 */
function matchNearest(rows: StaticDatasetRow[], tradeTime: number): StaticDatasetRow | null {
  // Find candidates using binary search
  const before = matchNearestBefore(rows, tradeTime)
  const after = matchNearestAfter(rows, tradeTime)

  if (!before && !after) {
    return null
  }

  if (!before) {
    return after
  }

  if (!after) {
    return before
  }

  // Compare distances
  const beforeDiff = Math.abs(tradeTime - new Date(before.timestamp).getTime())
  const afterDiff = Math.abs(new Date(after.timestamp).getTime() - tradeTime)

  return beforeDiff <= afterDiff ? before : after
}

/**
 * Match a trade to a dataset and return detailed result
 */
export function matchTradeToDatasetWithDetails(
  trade: Trade,
  dataset: StaticDataset,
  rows: StaticDatasetRow[]
): DatasetMatchResult {
  const tradeTimestamp = combineDateAndTime(trade.dateOpened, trade.timeOpened)
  const matchedRow = matchTradeToDataset(trade, rows, dataset.matchStrategy)

  let matchedTimestamp: Date | null = null
  let timeDifferenceMs: number | null = null

  if (matchedRow) {
    matchedTimestamp = new Date(matchedRow.timestamp)
    timeDifferenceMs = matchedTimestamp.getTime() - tradeTimestamp.getTime()
  }

  return {
    datasetId: dataset.id,
    datasetName: dataset.name,
    matchedRow,
    matchedTimestamp,
    timeDifferenceMs,
  }
}

/**
 * Match multiple trades to a dataset and return all results
 */
export function matchTradesToDataset(
  trades: Trade[],
  dataset: StaticDataset,
  rows: StaticDatasetRow[]
): DatasetMatchResult[] {
  return trades.map((trade) => matchTradeToDatasetWithDetails(trade, dataset, rows))
}

/**
 * Calculate match statistics for preview display
 */
export function calculateMatchStats(
  trades: Trade[],
  dataset: StaticDataset,
  rows: StaticDatasetRow[]
): DatasetMatchStats {
  const totalTrades = trades.length

  if (totalTrades === 0 || rows.length === 0) {
    return {
      totalTrades,
      matchedTrades: 0,
      outsideDateRange: 0,
      matchPercentage: 0,
    }
  }

  const datasetStart = new Date(dataset.dateRange.start).getTime()
  const datasetEnd = new Date(dataset.dateRange.end).getTime()

  let matchedTrades = 0
  let outsideDateRange = 0

  for (const trade of trades) {
    const tradeTimestamp = combineDateAndTime(trade.dateOpened, trade.timeOpened)
    const tradeTime = tradeTimestamp.getTime()

    // Check if trade is outside dataset date range
    if (tradeTime < datasetStart || tradeTime > datasetEnd) {
      outsideDateRange++
      continue
    }

    // Try to match
    const match = matchTradeToDataset(trade, rows, dataset.matchStrategy)
    if (match) {
      matchedTrades++
    }
  }

  const matchPercentage = totalTrades > 0
    ? Math.round((matchedTrades / totalTrades) * 1000) / 10
    : 0

  return {
    totalTrades,
    matchedTrades,
    outsideDateRange,
    matchPercentage,
  }
}

/**
 * Get matched values for a trade from all available datasets
 * Returns a map of datasetName -> columnName -> value
 */
export function getMatchedValuesForTrade(
  trade: Trade,
  datasets: Array<{ dataset: StaticDataset; rows: StaticDatasetRow[] }>
): Record<string, Record<string, number | string>> {
  const result: Record<string, Record<string, number | string>> = {}

  for (const { dataset, rows } of datasets) {
    const matchedRow = matchTradeToDataset(trade, rows, dataset.matchStrategy)

    if (matchedRow) {
      result[dataset.name] = { ...matchedRow.values }
    }
  }

  return result
}

/**
 * Get a specific value from matched datasets for a trade
 * Field format: "datasetName.columnName" (e.g., "vix.close")
 */
export function getMatchedFieldValue(
  trade: Trade,
  field: string,
  datasets: Array<{ dataset: StaticDataset; rows: StaticDatasetRow[] }>
): number | string | null {
  const dotIndex = field.indexOf('.')
  if (dotIndex === -1) {
    return null
  }

  const datasetName = field.substring(0, dotIndex)
  const columnName = field.substring(dotIndex + 1)

  const datasetInfo = datasets.find((d) => d.dataset.name === datasetName)
  if (!datasetInfo) {
    return null
  }

  const matchedRow = matchTradeToDataset(trade, datasetInfo.rows, datasetInfo.dataset.matchStrategy)
  if (!matchedRow) {
    return null
  }

  const value = matchedRow.values[columnName]
  return value !== undefined ? value : null
}

/**
 * Format time difference for display
 */
export function formatTimeDifference(diffMs: number | null): string {
  if (diffMs === null) {
    return 'No match'
  }

  const absDiff = Math.abs(diffMs)
  const sign = diffMs < 0 ? '-' : '+'

  if (absDiff < 1000) {
    return 'Exact match'
  }

  if (absDiff < 60000) {
    const seconds = Math.round(absDiff / 1000)
    return `${sign}${seconds}s`
  }

  if (absDiff < 3600000) {
    const minutes = Math.round(absDiff / 60000)
    return `${sign}${minutes}m`
  }

  if (absDiff < 86400000) {
    const hours = Math.round(absDiff / 3600000)
    return `${sign}${hours}h`
  }

  const days = Math.round(absDiff / 86400000)
  return `${sign}${days}d`
}
