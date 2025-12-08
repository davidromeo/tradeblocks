/**
 * Trade Enrichment
 *
 * Computes all derived fields for trades to enable flexible
 * filtering and charting in the Report Builder.
 */

import { Trade } from '@/lib/models/trade'
import { EnrichedTrade } from '@/lib/models/enriched-trade'
import { calculateMFEMAEData, MFEMAEDataPoint } from './mfe-mae'

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
 * Enriches a single trade with all derived fields
 */
function enrichSingleTrade(
  trade: Trade,
  index: number,
  mfeMaePoint?: MFEMAEDataPoint
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

    // Timing (data is already in Eastern Time from the CSV)
    durationHours: computeDurationHours(trade),
    dayOfWeek: dateOpened.getUTCDay(),
    hourOfDay: extractHourOfDay(trade.timeOpened),
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
  }
}

/**
 * Enriches all trades with derived fields
 *
 * Uses calculateMFEMAEData() for MFE/MAE metrics and computes
 * additional derived fields like ROM, duration, VIX changes, etc.
 */
export function enrichTrades(trades: Trade[]): EnrichedTrade[] {
  // Calculate MFE/MAE data for all trades
  const mfeMaeData = calculateMFEMAEData(trades)

  // Create a map for quick lookup (tradeNumber is 1-indexed)
  const mfeMaeMap = new Map<number, MFEMAEDataPoint>(
    mfeMaeData.map(d => [d.tradeNumber - 1, d])
  )

  // Enrich each trade
  return trades.map((trade, index) => {
    const mfeMaePoint = mfeMaeMap.get(index)
    return enrichSingleTrade(trade, index, mfeMaePoint)
  })
}

export default enrichTrades
