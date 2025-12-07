/**
 * Table Aggregation Logic
 *
 * Buckets trades by a field and calculates aggregate statistics per bucket.
 * Similar to the S/L Drift Outcome Table but generalized for any field.
 */

import { EnrichedTrade } from '@/lib/models/enriched-trade'
import { getFieldInfo } from '@/lib/models/report-config'

/**
 * A single row in the aggregated table
 */
export interface TableRow {
  label: string        // Bucket label (e.g., "< 20", "20-25", "≥ 30")
  count: number        // Trade count in bucket
  winRate: number      // % of winning trades
  avgPlPercent: number // Average P&L as % of premium
  avgPlDollar: number  // Average P&L in dollars
  totalPl: number      // Total P&L in dollars
}

/**
 * Get the value of a field from a trade
 */
function getTradeValue(trade: EnrichedTrade, field: string): number | null {
  const value = (trade as unknown as Record<string, unknown>)[field]
  if (typeof value === 'number' && isFinite(value)) {
    return value
  }
  return null
}

/**
 * Format a bucket label based on field info
 */
function formatBucketLabel(
  min: number | null,
  max: number | null,
  fieldUnit?: string
): string {
  const unit = fieldUnit ?? ''

  if (min === null) {
    // First bucket: < max
    return `< ${max}${unit}`
  }
  if (max === null) {
    // Last bucket: ≥ min
    return `≥ ${min}${unit}`
  }
  // Middle bucket: min - max
  return `${min} - ${max}${unit}`
}

/**
 * Build aggregated table rows from trades
 *
 * @param trades - Array of enriched trades to aggregate
 * @param xField - Field name to bucket by
 * @param bucketEdges - Array of threshold values (e.g., [15, 20, 25, 30])
 * @returns Array of TableRow with aggregated statistics
 */
export function buildTableRows(
  trades: EnrichedTrade[],
  xField: string,
  bucketEdges: number[]
): TableRow[] {
  if (!bucketEdges || bucketEdges.length === 0 || trades.length === 0) {
    return []
  }

  // Sort bucket edges ascending
  const sortedEdges = [...bucketEdges].sort((a, b) => a - b)

  // Get field info for unit display
  const fieldInfo = getFieldInfo(xField)
  const fieldUnit = fieldInfo?.unit ?? ''

  // Create bucket definitions
  // For edges [15, 20, 25, 30], create buckets:
  // < 15, 15-20, 20-25, 25-30, ≥ 30
  interface BucketDef {
    min: number | null
    max: number | null
    label: string
    trades: EnrichedTrade[]
  }

  const buckets: BucketDef[] = []

  // First bucket: < first edge
  buckets.push({
    min: null,
    max: sortedEdges[0],
    label: formatBucketLabel(null, sortedEdges[0], fieldUnit),
    trades: []
  })

  // Middle buckets: between consecutive edges
  for (let i = 0; i < sortedEdges.length - 1; i++) {
    buckets.push({
      min: sortedEdges[i],
      max: sortedEdges[i + 1],
      label: formatBucketLabel(sortedEdges[i], sortedEdges[i + 1], fieldUnit),
      trades: []
    })
  }

  // Last bucket: ≥ last edge
  buckets.push({
    min: sortedEdges[sortedEdges.length - 1],
    max: null,
    label: formatBucketLabel(sortedEdges[sortedEdges.length - 1], null, fieldUnit),
    trades: []
  })

  // Assign trades to buckets
  for (const trade of trades) {
    const value = getTradeValue(trade, xField)
    if (value === null) continue

    // Find the appropriate bucket
    for (const bucket of buckets) {
      const matchesMin = bucket.min === null || value >= bucket.min
      const matchesMax = bucket.max === null || value < bucket.max

      if (matchesMin && matchesMax) {
        bucket.trades.push(trade)
        break
      }
    }
  }

  // Calculate statistics for each bucket
  return buckets
    .filter(bucket => bucket.trades.length > 0)
    .map(bucket => {
      const count = bucket.trades.length
      const winners = bucket.trades.filter(t => (t.isWinner ?? 0) === 1).length
      const winRate = (winners / count) * 100

      // Calculate average P&L
      const totalPl = bucket.trades.reduce((sum, t) => sum + (t.pl ?? 0), 0)
      const avgPlDollar = totalPl / count

      // Calculate average P&L as % of premium
      const plPercents = bucket.trades
        .filter(t => t.premium && t.premium > 0)
        .map(t => ((t.pl ?? 0) / t.premium!) * 100)
      const avgPlPercent = plPercents.length > 0
        ? plPercents.reduce((sum, p) => sum + p, 0) / plPercents.length
        : 0

      return {
        label: bucket.label,
        count,
        winRate,
        avgPlPercent,
        avgPlDollar,
        totalPl
      }
    })
}

/**
 * Parse bucket edges from a comma-separated string
 * Returns null if invalid input
 */
export function parseBucketEdges(input: string): number[] | null {
  if (!input || !input.trim()) {
    return null
  }

  const parts = input.split(',').map(s => s.trim())
  const numbers: number[] = []

  for (const part of parts) {
    const num = parseFloat(part)
    if (isNaN(num) || !isFinite(num)) {
      return null
    }
    numbers.push(num)
  }

  if (numbers.length === 0) {
    return null
  }

  // Sort and dedupe
  const unique = [...new Set(numbers)].sort((a, b) => a - b)
  return unique
}

/**
 * Format bucket edges to a comma-separated string
 */
export function formatBucketEdges(buckets: number[]): string {
  return buckets.join(', ')
}

/**
 * Get default bucket edges for a field based on its typical range
 */
export function getDefaultBucketEdges(field: string): number[] {
  // Provide sensible defaults for common fields
  switch (field) {
    case 'openingVix':
    case 'closingVix':
      return [15, 20, 25, 30, 35]
    case 'openingShortLongRatio':
    case 'closingShortLongRatio':
      return [0.5, 0.75, 1.0, 1.25, 1.5]
    case 'mfePercent':
    case 'maePercent':
      return [10, 25, 50, 75, 100]
    case 'rom':
      return [-20, -10, 0, 10, 20, 30]
    case 'durationHours':
      return [1, 2, 4, 8, 24]
    case 'gap':
      return [-2, -1, 0, 1, 2]
    default:
      // Generic defaults
      return [0, 25, 50, 75, 100]
  }
}
