import { Trade } from '@/lib/models/trade'
import { computeTotalMaxProfit, computeTotalMaxLoss, computeTotalPremium, type EfficiencyBasis } from '@/lib/metrics/trade-efficiency'
import { yieldToMain, checkCancelled } from '@/lib/utils/async-helpers'

export type NormalizationBasis = 'premium' | 'margin'
export const NORMALIZATION_BASES: NormalizationBasis[] = ['premium', 'margin']

export interface NormalizedExcursionMetrics {
  denominator: number
  mfePercent: number
  maePercent: number
  plPercent: number
}

/**
 * Data point for a single trade's MFE/MAE metrics
 */
export interface MFEMAEDataPoint {
  tradeNumber: number
  date: Date
  strategy: string

  // Raw values (normalized)
  mfe: number // Maximum Favorable Excursion (total max profit)
  mae: number // Maximum Adverse Excursion (total max loss)
  pl: number // Realized P&L

  // Percentage values (normalized by denominator)
  mfePercent?: number
  maePercent?: number
  plPercent?: number

  // Efficiency metrics
  profitCapturePercent?: number // (pl / mfe) * 100 - what % of peak profit was captured
  excursionRatio?: number // mfe / mae - reward-to-risk ratio

  // Context
  denominator?: number
  basis: EfficiencyBasis
  isWinner: boolean
  marginReq: number
  premium?: number
  normalizedBy: Partial<Record<NormalizationBasis, NormalizedExcursionMetrics>>

  // Trade details for tooltips
  openingPrice: number
  closingPrice?: number
  numContracts: number
  avgClosingCost?: number
  fundsAtClose: number
  openingCommissionsFees: number
  closingCommissionsFees?: number
  openingShortLongRatio: number
  closingShortLongRatio?: number
  openingVix?: number
  closingVix?: number
  gap?: number
  movement?: number
  maxProfit?: number
  maxLoss?: number
  shortLongRatioChange?: number
  shortLongRatioChangePct?: number
}

/**
 * Aggregated MFE/MAE statistics
 */
export interface MFEMAEStats {
  avgMFEPercent: number
  avgMAEPercent: number
  avgProfitCapturePercent: number
  avgExcursionRatio: number

  winnerAvgProfitCapture: number
  loserAvgProfitCapture: number

  medianMFEPercent: number
  medianMAEPercent: number

  totalTrades: number
  tradesWithMFE: number
  tradesWithMAE: number
}

/**
 * Distribution bucket for histograms
 */
export interface DistributionBucket {
  bucket: string
  mfeCount: number
  maeCount: number
  range: [number, number]
}

/**
 * Calculates MFE/MAE metrics for a single trade
 */
export function calculateTradeExcursionMetrics(trade: Trade, tradeNumber: number): MFEMAEDataPoint | null {
  const totalMFE = computeTotalMaxProfit(trade)
  const totalMAE = computeTotalMaxLoss(trade)

  // Skip trades without excursion data
  if (!totalMFE && !totalMAE) {
    return null
  }

  // Determine denominator for percentage calculations
  const totalPremium = computeTotalPremium(trade)
  const margin = typeof trade.marginReq === 'number' && isFinite(trade.marginReq) && trade.marginReq !== 0
    ? Math.abs(trade.marginReq)
    : undefined

  let denominator: number | undefined
  let basis: EfficiencyBasis = 'unknown'

  const denominators: Partial<Record<NormalizationBasis, number>> = {}

  if (totalPremium && totalPremium > 0) {
    denominators.premium = totalPremium
    denominator = totalPremium
    basis = 'premium'
  }

  if (margin && margin > 0) {
    denominators.margin = margin
    if (!denominator) {
      denominator = margin
      basis = 'margin'
    }
  }

  if (!denominator && totalMFE && totalMFE > 0) {
    denominator = totalMFE
    basis = 'maxProfit'
  }

  const normalizedBy: MFEMAEDataPoint['normalizedBy'] = {}

  const hasOpeningSLR = typeof trade.openingShortLongRatio === 'number' && isFinite(trade.openingShortLongRatio) && trade.openingShortLongRatio !== 0
  const hasClosingSLR = typeof trade.closingShortLongRatio === 'number' && isFinite(trade.closingShortLongRatio)
  const shortLongRatioChange = hasOpeningSLR && hasClosingSLR
    ? trade.closingShortLongRatio! / trade.openingShortLongRatio
    : undefined
  const shortLongRatioChangePct = hasOpeningSLR && hasClosingSLR
    ? ((trade.closingShortLongRatio! - trade.openingShortLongRatio) / trade.openingShortLongRatio) * 100
    : undefined

  NORMALIZATION_BASES.forEach(currentBasis => {
    const denom = denominators[currentBasis]
    if (!denom || denom <= 0) {
      return
    }

    const mfePercent = totalMFE ? (totalMFE / denom) * 100 : 0
    const maePercent = totalMAE ? (totalMAE / denom) * 100 : 0
    const plPercent = (trade.pl / denom) * 100

    normalizedBy[currentBasis] = {
      denominator: denom,
      mfePercent,
      maePercent,
      plPercent
    }
  })

  const dataPoint: MFEMAEDataPoint = {
    tradeNumber,
    date: trade.dateOpened,
    strategy: trade.strategy || 'Unknown',
    mfe: totalMFE || 0,
    mae: totalMAE || 0,
    pl: trade.pl,
    isWinner: trade.pl > 0,
    marginReq: trade.marginReq,
    premium: totalPremium,
    basis,
    normalizedBy,
    openingPrice: trade.openingPrice,
    closingPrice: trade.closingPrice,
    numContracts: trade.numContracts,
    avgClosingCost: trade.avgClosingCost,
    fundsAtClose: trade.fundsAtClose,
    openingCommissionsFees: trade.openingCommissionsFees,
    closingCommissionsFees: trade.closingCommissionsFees,
    openingShortLongRatio: trade.openingShortLongRatio,
    closingShortLongRatio: trade.closingShortLongRatio,
    openingVix: trade.openingVix,
    closingVix: trade.closingVix,
    gap: trade.gap,
    movement: trade.movement,
    maxProfit: trade.maxProfit,
    maxLoss: trade.maxLoss,
    shortLongRatioChange,
    shortLongRatioChangePct,
  }

  // Calculate percentages if we have a denominator
  if (denominator && denominator > 0) {
    dataPoint.denominator = denominator

    if (totalMFE) {
      dataPoint.mfePercent = (totalMFE / denominator) * 100
    }
    if (totalMAE) {
      dataPoint.maePercent = (totalMAE / denominator) * 100
    }
    dataPoint.plPercent = (trade.pl / denominator) * 100
  }

  // Profit capture: what % of max profit was actually captured
  if (totalMFE && totalMFE > 0) {
    dataPoint.profitCapturePercent = (trade.pl / totalMFE) * 100
  }

  // Excursion ratio: reward/risk
  if (totalMFE && totalMAE && totalMAE > 0) {
    dataPoint.excursionRatio = totalMFE / totalMAE
  }

  return dataPoint
}

/**
 * Processes all trades to generate MFE/MAE data points
 */
export function calculateMFEMAEData(trades: Trade[]): MFEMAEDataPoint[] {
  const dataPoints: MFEMAEDataPoint[] = []

  trades.forEach((trade, index) => {
    const point = calculateTradeExcursionMetrics(trade, index + 1)
    if (point) {
      dataPoints.push(point)
    }
  })

  return dataPoints
}

/**
 * Async version of calculateMFEMAEData with yielding for large datasets
 */
export async function calculateMFEMAEDataAsync(
  trades: Trade[],
  signal?: AbortSignal
): Promise<MFEMAEDataPoint[]> {
  const dataPoints: MFEMAEDataPoint[] = []

  for (let i = 0; i < trades.length; i++) {
    const point = calculateTradeExcursionMetrics(trades[i], i + 1)
    if (point) {
      dataPoints.push(point)
    }

    // Yield every 100 trades to keep UI responsive
    if (i % 100 === 0 && i > 0) {
      checkCancelled(signal)
      await yieldToMain()
    }
  }

  return dataPoints
}

/**
 * Calculates aggregate statistics from MFE/MAE data points
 */
export function calculateMFEMAEStats(dataPoints: MFEMAEDataPoint[]): Partial<Record<NormalizationBasis, MFEMAEStats>> {
  if (dataPoints.length === 0) {
    return {}
  }

  const withProfitCapture = dataPoints.filter(d => d.profitCapturePercent !== undefined)
  const winners = withProfitCapture.filter(d => d.isWinner)
  const losers = withProfitCapture.filter(d => !d.isWinner)
  const withExcursionRatio = dataPoints.filter(d => d.excursionRatio !== undefined)

  const globalAvgProfitCapture = withProfitCapture.length > 0
    ? withProfitCapture.reduce((sum, d) => sum + (d.profitCapturePercent || 0), 0) / withProfitCapture.length
    : 0
  const globalWinnerAvgProfitCapture = winners.length > 0
    ? winners.reduce((sum, d) => sum + (d.profitCapturePercent || 0), 0) / winners.length
    : 0
  const globalLoserAvgProfitCapture = losers.length > 0
    ? losers.reduce((sum, d) => sum + (d.profitCapturePercent || 0), 0) / losers.length
    : 0
  const globalAvgExcursionRatio = withExcursionRatio.length > 0
    ? withExcursionRatio.reduce((sum, d) => sum + (d.excursionRatio || 0), 0) / withExcursionRatio.length
    : 0

  const median = (values: number[]): number => {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  const results: Partial<Record<NormalizationBasis, MFEMAEStats>> = {}

  NORMALIZATION_BASES.forEach(basis => {
    const pointsWithBasis = dataPoints.filter(point => point.normalizedBy?.[basis])
    if (pointsWithBasis.length === 0) {
      return
    }

    const normalizedMetrics = pointsWithBasis.map(point => point.normalizedBy![basis]!)
    const mfePercents = normalizedMetrics.map(metrics => metrics.mfePercent)
    const maePercents = normalizedMetrics.map(metrics => metrics.maePercent)

    const withMFE = pointsWithBasis.filter(d => d.mfe > 0)
    const withMAE = pointsWithBasis.filter(d => d.mae > 0)

    results[basis] = {
      avgMFEPercent: mfePercents.length > 0
        ? mfePercents.reduce((sum, value) => sum + value, 0) / mfePercents.length
        : 0,
      avgMAEPercent: maePercents.length > 0
        ? maePercents.reduce((sum, value) => sum + value, 0) / maePercents.length
        : 0,
      avgProfitCapturePercent: globalAvgProfitCapture,
      avgExcursionRatio: globalAvgExcursionRatio,
      winnerAvgProfitCapture: globalWinnerAvgProfitCapture,
      loserAvgProfitCapture: globalLoserAvgProfitCapture,
      medianMFEPercent: median(mfePercents),
      medianMAEPercent: median(maePercents),
      totalTrades: pointsWithBasis.length,
      tradesWithMFE: withMFE.length,
      tradesWithMAE: withMAE.length,
    }
  })

  return results
}

/**
 * Creates distribution buckets for histogram visualization
 */
export function createExcursionDistribution(
  dataPoints: MFEMAEDataPoint[],
  bucketSize: number = 10
): DistributionBucket[] {
  const mfeValues = dataPoints.filter(d => d.mfePercent !== undefined).map(d => d.mfePercent!)
  const maeValues = dataPoints.filter(d => d.maePercent !== undefined).map(d => d.maePercent!)

  if (mfeValues.length === 0 && maeValues.length === 0) {
    return []
  }

  const allValues = [...mfeValues, ...maeValues]
  const maxValue = Math.max(...allValues)
  const numBuckets = Math.max(1, Math.ceil(maxValue / bucketSize))

  const buckets: DistributionBucket[] = []

  for (let i = 0; i < numBuckets; i++) {
    const rangeStart = i * bucketSize
    const rangeEnd = (i + 1) * bucketSize
    const isLastBucket = i === numBuckets - 1

    const inBucket = (value: number) =>
      value >= rangeStart && (isLastBucket ? value <= rangeEnd : value < rangeEnd)

    const mfeCount = mfeValues.filter(inBucket).length
    const maeCount = maeValues.filter(inBucket).length

    buckets.push({
      bucket: `${rangeStart}-${rangeEnd}%`,
      mfeCount,
      maeCount,
      range: [rangeStart, rangeEnd]
    })
  }

  return buckets
}

/**
 * Async version of createExcursionDistribution with yielding for large datasets
 * Uses O(n) single-pass bucketing instead of O(n*buckets) repeated filtering
 */
export async function createExcursionDistributionAsync(
  dataPoints: MFEMAEDataPoint[],
  bucketSize: number = 10,
  signal?: AbortSignal
): Promise<DistributionBucket[]> {
  if (dataPoints.length === 0) {
    return []
  }

  checkCancelled(signal)
  await yieldToMain()

  // First pass: find max value and count values in a single iteration
  let maxMfe = 0
  let maxMae = 0
  const mfeBucketCounts: Map<number, number> = new Map()
  const maeBucketCounts: Map<number, number> = new Map()

  for (let i = 0; i < dataPoints.length; i++) {
    const d = dataPoints[i]

    if (d.mfePercent !== undefined) {
      maxMfe = Math.max(maxMfe, d.mfePercent)
      const bucketIndex = Math.floor(d.mfePercent / bucketSize)
      mfeBucketCounts.set(bucketIndex, (mfeBucketCounts.get(bucketIndex) || 0) + 1)
    }

    if (d.maePercent !== undefined) {
      maxMae = Math.max(maxMae, d.maePercent)
      const bucketIndex = Math.floor(d.maePercent / bucketSize)
      maeBucketCounts.set(bucketIndex, (maeBucketCounts.get(bucketIndex) || 0) + 1)
    }

    // Yield every 200 items to keep UI responsive
    if (i % 200 === 0 && i > 0) {
      checkCancelled(signal)
      await yieldToMain()
    }
  }

  const maxValue = Math.max(maxMfe, maxMae)
  if (maxValue === 0) {
    return []
  }

  checkCancelled(signal)
  await yieldToMain()

  const numBuckets = Math.max(1, Math.ceil(maxValue / bucketSize))
  const buckets: DistributionBucket[] = []

  // Build buckets from pre-computed counts (very fast, no filtering needed)
  for (let i = 0; i < numBuckets; i++) {
    const rangeStart = i * bucketSize
    const rangeEnd = (i + 1) * bucketSize

    buckets.push({
      bucket: `${rangeStart}-${rangeEnd}%`,
      mfeCount: mfeBucketCounts.get(i) || 0,
      maeCount: maeBucketCounts.get(i) || 0,
      range: [rangeStart, rangeEnd]
    })
  }

  return buckets
}
