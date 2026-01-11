/**
 * Trade Enrichment
 *
 * Computes all derived fields for trades to enable flexible
 * filtering and charting in the Report Builder.
 */

import { Trade } from '@/lib/models/trade'
import { EnrichedTrade } from '@/lib/models/enriched-trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { calculateMFEMAEData, MFEMAEDataPoint } from './mfe-mae'
import type { StaticDataset, StaticDatasetRow } from '@/lib/models/static-dataset'
import { getMatchedValuesForTrade } from './static-dataset-matcher'

/**
 * Static dataset with its rows for matching
 */
export interface StaticDatasetWithRows {
  dataset: StaticDataset
  rows: StaticDatasetRow[]
}

/**
 * Options for enriching trades
 */
export interface EnrichTradesOptions {
  /** Daily log entries to join custom fields from (by date) */
  dailyLogs?: DailyLogEntry[]
  /** Static datasets with their rows for timestamp-based matching */
  staticDatasets?: StaticDatasetWithRows[]
}

/**
 * Creates a date key string for matching trades to daily logs
 * Format: YYYY-MM-DD in UTC to avoid timezone issues
 */
function getDateKey(date: Date): string {
  const d = new Date(date)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * Builds a lookup map from date to daily log custom fields
 */
function buildDailyCustomFieldsMap(dailyLogs: DailyLogEntry[]): Map<string, Record<string, number | string>> {
  const map = new Map<string, Record<string, number | string>>()
  for (const entry of dailyLogs) {
    if (entry.customFields && Object.keys(entry.customFields).length > 0) {
      const key = getDateKey(entry.date)
      map.set(key, entry.customFields)
    }
  }
  return map
}

/**
 * Computes the duration of a trade in hours
 */
function computeDurationHours(trade: Trade): number | undefined {
  if (!trade.dateClosed || !trade.timeClosed) {
    return undefined
  }

  try {
    // Parse opening datetime
    const openingDate = new Date(trade.dateOpened)
    const [openHours, openMinutes, openSeconds] = trade.timeOpened.split(':').map(Number)
    openingDate.setHours(openHours, openMinutes, openSeconds || 0, 0)

    // Parse closing datetime
    const closingDate = new Date(trade.dateClosed)
    const [closeHours, closeMinutes, closeSeconds] = trade.timeClosed.split(':').map(Number)
    closingDate.setHours(closeHours, closeMinutes, closeSeconds || 0, 0)

    // Calculate difference in hours
    const diffMs = closingDate.getTime() - openingDate.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    return diffHours > 0 ? diffHours : undefined
  } catch {
    return undefined
  }
}

/**
 * Extracts hour of day from trade opening time string (HH:MM:SS format)
 * The time in the CSV is already in Eastern Time
 */
function extractHourOfDay(timeOpened: string): number | undefined {
  try {
    const [hours] = timeOpened.split(':').map(Number)
    return !isNaN(hours) && hours >= 0 && hours <= 23 ? hours : undefined
  } catch {
    return undefined
  }
}

/**
 * Extracts time of day as minutes since midnight from trade opening time string (HH:MM:SS format)
 * This provides exact time precision for scatter plots, unlike hourOfDay which buckets to the hour.
 * Example: "11:45:00" -> 705 (11 * 60 + 45)
 */
function extractTimeOfDayMinutes(timeOpened: string): number | undefined {
  try {
    const [hours, minutes] = timeOpened.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) return undefined
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined
    return hours * 60 + minutes
  } catch {
    return undefined
  }
}

/**
 * Calculates ISO week number for a given date
 * ISO weeks start on Monday and week 1 contains the first Thursday of the year
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // Set to nearest Thursday (current date + 4 - current day number, making Sunday=7)
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return weekNo
}

/**
 * Enriches a single trade with all derived fields
 */
function enrichSingleTrade(
  trade: Trade,
  index: number,
  mfeMaePoint?: MFEMAEDataPoint,
  dailyCustomFields?: Record<string, number | string>,
  staticDatasetFields?: Record<string, Record<string, number | string>>
): EnrichedTrade {
  const totalFees = trade.openingCommissionsFees + (trade.closingCommissionsFees ?? 0)
  const netPl = trade.pl - totalFees

  // VIX changes
  const hasVixData = trade.openingVix != null && trade.closingVix != null
  const vixChange = hasVixData ? trade.closingVix! - trade.openingVix! : undefined
  const vixChangePct = hasVixData && trade.openingVix !== 0
    ? ((trade.closingVix! - trade.openingVix!) / trade.openingVix!) * 100
    : undefined

  // Return metrics
  const rom = trade.marginReq > 0 ? (trade.pl / trade.marginReq) * 100 : undefined
  // Premium in CSV is per-contract, P/L is total across all contracts
  // Multiply premium by contracts to get total premium for accurate P/L %
  const totalPremium = trade.premium * trade.numContracts
  const premiumEfficiency = totalPremium !== 0 ? (trade.pl / Math.abs(totalPremium)) * 100 : undefined
  const plPct = premiumEfficiency // Alias for easier discovery
  const netPlPct = totalPremium !== 0 ? (netPl / Math.abs(totalPremium)) * 100 : undefined

  // Risk multiple: P/L divided by MAE (how many R's won/lost)
  const rMultiple = mfeMaePoint?.mae && mfeMaePoint.mae > 0
    ? trade.pl / mfeMaePoint.mae
    : undefined

  // Parse date (may be Date object or ISO string from IndexedDB)
  // The date in the CSV is stored as Eastern Time date, parsed as UTC midnight
  // Use getUTCDay() to get the correct day without timezone shift
  const dateOpened = new Date(trade.dateOpened)

  return {
    ...trade,
    // MFE/MAE metrics from pre-calculated data
    mfePercent: mfeMaePoint?.mfePercent,
    maePercent: mfeMaePoint?.maePercent,
    profitCapturePercent: mfeMaePoint?.profitCapturePercent,
    excursionRatio: mfeMaePoint?.excursionRatio,
    shortLongRatioChange: mfeMaePoint?.shortLongRatioChange,
    shortLongRatioChangePct: mfeMaePoint?.shortLongRatioChangePct,

    // Return metrics
    rom,
    premiumEfficiency,
    plPct,
    netPlPct,

    // Timing (data is already in Eastern Time from the CSV)
    durationHours: computeDurationHours(trade),
    dayOfWeek: dateOpened.getUTCDay(),
    hourOfDay: extractHourOfDay(trade.timeOpened),
    timeOfDayMinutes: extractTimeOfDayMinutes(trade.timeOpened),
    dayOfMonth: dateOpened.getUTCDate(),
    monthOfYear: dateOpened.getUTCMonth() + 1, // 1-12 instead of 0-11
    weekOfYear: getISOWeekNumber(dateOpened),
    dateOpenedTimestamp: dateOpened.getTime(),

    // Costs & Net
    totalFees,
    netPl,

    // VIX changes
    vixChange,
    vixChangePct,

    // Risk metrics
    rMultiple,
    isWinner: trade.pl > 0 ? 1 : 0,

    // Sequential
    tradeNumber: index + 1,

    // Daily custom fields (joined by trade date)
    dailyCustomFields,

    // Static dataset fields (matched by timestamp)
    staticDatasetFields,
  }
}

/**
 * Enriches all trades with derived fields
 *
 * Uses calculateMFEMAEData() for MFE/MAE metrics and computes
 * additional derived fields like ROM, duration, VIX changes, etc.
 *
 * @param trades - Array of trades to enrich
 * @param options - Optional configuration including daily logs and static datasets
 */
export function enrichTrades(trades: Trade[], options?: EnrichTradesOptions): EnrichedTrade[] {
  // Calculate MFE/MAE data for all trades
  const mfeMaeData = calculateMFEMAEData(trades)

  // Create a map for quick lookup (tradeNumber is 1-indexed)
  const mfeMaeMap = new Map<number, MFEMAEDataPoint>(
    mfeMaeData.map(d => [d.tradeNumber - 1, d])
  )

  // Build daily custom fields lookup map if daily logs are provided
  const dailyCustomFieldsMap = options?.dailyLogs
    ? buildDailyCustomFieldsMap(options.dailyLogs)
    : undefined

  // Enrich each trade
  return trades.map((trade, index) => {
    const mfeMaePoint = mfeMaeMap.get(index)

    // Look up daily custom fields for this trade's date
    let dailyCustomFields: Record<string, number | string> | undefined
    if (dailyCustomFieldsMap) {
      const dateKey = getDateKey(trade.dateOpened)
      dailyCustomFields = dailyCustomFieldsMap.get(dateKey)
    }

    // Match static dataset values by timestamp
    let staticDatasetFields: Record<string, Record<string, number | string>> | undefined
    if (options?.staticDatasets && options.staticDatasets.length > 0) {
      staticDatasetFields = getMatchedValuesForTrade(trade, options.staticDatasets)
      // Only include if we got matches
      if (Object.keys(staticDatasetFields).length === 0) {
        staticDatasetFields = undefined
      }
    }

    return enrichSingleTrade(trade, index, mfeMaePoint, dailyCustomFields, staticDatasetFields)
  })
}

export default enrichTrades
