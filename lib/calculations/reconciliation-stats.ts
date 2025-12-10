/**
 * Statistical analysis for trade reconciliation
 *
 * Provides paired t-test, correlation analysis, and statistical interpretation
 * for comparing backtested vs reported trading performance.
 */

import { NormalizedTrade } from '@/lib/services/trade-reconciliation'
import { getRanks } from './statistical-utils'

export interface MatchedPair {
  backtested: NormalizedTrade
  reported: NormalizedTrade
}

export interface EquityCurvePoint {
  date: string
  tradeNumber: number
  backtestedEquity: number
  reportedEquity: number
  difference: number
  percentDifference: number
}

export interface SeparateEquityCurvePoint {
  date: string
  tradeNumber: number
  equity: number
  tradeType: 'backtested' | 'reported'
}

export interface TTestResult {
  tStatistic: number
  pValue: number
  degreesOfFreedom: number
  meanDifference: number
  standardError: number
  confidenceInterval: [number, number]
  isSignificant: boolean // p < 0.05
  interpretation: string
}

export interface CorrelationMetrics {
  pearsonR: number
  spearmanRho: number
  interpretation: string
}

/**
 * Calculate paired t-test for matched trade pairs
 *
 * Tests the null hypothesis that there is no significant difference between
 * backtested and reported P/L. Uses two-tailed test with alpha = 0.05.
 *
 * @param pairs - Array of matched trade pairs
 * @returns T-test results with statistical interpretation
 */
export function calculatePairedTTest(pairs: MatchedPair[]): TTestResult | null {
  if (pairs.length === 0) {
    return null
  }

  if (pairs.length === 1) {
    // Cannot perform t-test with single observation
    const diff = pairs[0].reported.pl - pairs[0].backtested.pl
    return {
      tStatistic: 0,
      pValue: 1,
      degreesOfFreedom: 0,
      meanDifference: diff,
      standardError: 0,
      confidenceInterval: [diff, diff],
      isSignificant: false,
      interpretation: 'Insufficient data for statistical analysis (n=1)',
    }
  }

  // Calculate paired differences (reported - backtested)
  const differences = pairs.map(pair => pair.reported.pl - pair.backtested.pl)
  const n = differences.length

  // Calculate mean difference
  const meanDiff = differences.reduce((sum, d) => sum + d, 0) / n

  // Calculate sample variance (using n-1 for sample)
  const variance = differences.reduce(
    (sum, d) => sum + Math.pow(d - meanDiff, 2),
    0
  ) / (n - 1)

  const stdDev = Math.sqrt(variance)
  const stdError = stdDev / Math.sqrt(n)

  // Calculate t-statistic
  // t = (mean_diff - 0) / (stdDev / sqrt(n))
  const tStatistic = stdError > 0 ? meanDiff / stdError : 0

  const degreesOfFreedom = n - 1

  // Calculate two-tailed p-value
  const pValue = calculateTwoTailedPValue(Math.abs(tStatistic), degreesOfFreedom)

  // Calculate 95% confidence interval
  const tCritical = getTCriticalValue(degreesOfFreedom)
  const marginOfError = tCritical * stdError
  const confidenceInterval: [number, number] = [
    meanDiff - marginOfError,
    meanDiff + marginOfError,
  ]

  const isSignificant = pValue < 0.05

  const interpretation = interpretTTestResult(
    tStatistic,
    pValue,
    meanDiff,
    n
  )

  return {
    tStatistic,
    pValue,
    degreesOfFreedom,
    meanDifference: meanDiff,
    standardError: stdError,
    confidenceInterval,
    isSignificant,
    interpretation,
  }
}

/**
 * Interpret t-test results in plain language
 */
function interpretTTestResult(
  tStatistic: number,
  pValue: number,
  meanDiff: number,
  n: number
): string {
  if (n < 2) {
    return 'Insufficient data for statistical analysis'
  }

  const direction = meanDiff > 0 ? 'higher' : 'lower'
  const absDirection = Math.abs(meanDiff)

  if (pValue < 0.001) {
    return `Highly significant difference (p<0.001): Reported P/L is ${direction} by $${absDirection.toFixed(2)} on average. This difference is extremely unlikely to be due to chance.`
  }

  if (pValue < 0.01) {
    return `Very significant difference (p<0.01): Reported P/L is ${direction} by $${absDirection.toFixed(2)} on average. Strong evidence of systematic difference.`
  }

  if (pValue < 0.05) {
    return `Significant difference (p<0.05): Reported P/L is ${direction} by $${absDirection.toFixed(2)} on average. This difference is statistically significant.`
  }

  if (pValue < 0.10) {
    return `Marginally significant (p<0.10): Reported P/L is ${direction} by $${absDirection.toFixed(2)} on average. Weak evidence of difference.`
  }

  return `No significant difference (p=${pValue.toFixed(3)}): While reported P/L is ${direction} by $${absDirection.toFixed(2)} on average, this could easily be due to chance.`
}

/**
 * Calculate Pearson correlation coefficient between backtested and reported P/L
 *
 * Measures the linear relationship between the two variables.
 * Range: -1 (perfect negative) to +1 (perfect positive)
 *
 * @param pairs - Array of matched trade pairs
 * @returns Correlation coefficient
 */
export function calculatePearsonCorrelation(pairs: MatchedPair[]): number | null {
  if (pairs.length < 2) {
    return null
  }

  const backtestedPl = pairs.map(p => p.backtested.pl)
  const reportedPl = pairs.map(p => p.reported.pl)

  const n = pairs.length

  // Calculate means
  const meanBacktested = backtestedPl.reduce((sum, val) => sum + val, 0) / n
  const meanReported = reportedPl.reduce((sum, val) => sum + val, 0) / n

  // Calculate covariance and standard deviations
  let covariance = 0
  let varBacktested = 0
  let varReported = 0

  for (let i = 0; i < n; i++) {
    const diffBacktested = backtestedPl[i] - meanBacktested
    const diffReported = reportedPl[i] - meanReported

    covariance += diffBacktested * diffReported
    varBacktested += diffBacktested * diffBacktested
    varReported += diffReported * diffReported
  }

  const stdDevBacktested = Math.sqrt(varBacktested)
  const stdDevReported = Math.sqrt(varReported)

  if (stdDevBacktested === 0 || stdDevReported === 0) {
    // No variation in one or both variables
    return null
  }

  return covariance / (stdDevBacktested * stdDevReported)
}

/**
 * Calculate Spearman rank correlation coefficient
 *
 * Non-parametric measure of rank correlation. More robust to outliers
 * than Pearson correlation.
 *
 * @param pairs - Array of matched trade pairs
 * @returns Spearman's rho
 */
export function calculateSpearmanCorrelation(pairs: MatchedPair[]): number | null {
  if (pairs.length < 2) {
    return null
  }

  // Convert values to ranks
  const backtestedRanks = getRanks(pairs.map(p => p.backtested.pl))
  const reportedRanks = getRanks(pairs.map(p => p.reported.pl))

  // Calculate Pearson correlation on ranks
  const n = pairs.length

  const meanBacktested = backtestedRanks.reduce((sum, val) => sum + val, 0) / n
  const meanReported = reportedRanks.reduce((sum, val) => sum + val, 0) / n

  let covariance = 0
  let varBacktested = 0
  let varReported = 0

  for (let i = 0; i < n; i++) {
    const diffBacktested = backtestedRanks[i] - meanBacktested
    const diffReported = reportedRanks[i] - meanReported

    covariance += diffBacktested * diffReported
    varBacktested += diffBacktested * diffBacktested
    varReported += diffReported * diffReported
  }

  const stdDevBacktested = Math.sqrt(varBacktested)
  const stdDevReported = Math.sqrt(varReported)

  if (stdDevBacktested === 0 || stdDevReported === 0) {
    return null
  }

  return covariance / (stdDevBacktested * stdDevReported)
}

/**
 * Calculate correlation metrics and provide interpretation
 */
export function calculateCorrelationMetrics(pairs: MatchedPair[]): CorrelationMetrics | null {
  const pearsonR = calculatePearsonCorrelation(pairs)
  const spearmanRho = calculateSpearmanCorrelation(pairs)

  if (pearsonR === null || spearmanRho === null) {
    return null
  }

  const interpretation = interpretCorrelation(pearsonR, spearmanRho)

  return {
    pearsonR,
    spearmanRho,
    interpretation,
  }
}

/**
 * Interpret correlation strength
 */
function interpretCorrelation(pearsonR: number, spearmanRho: number): string {
  const r = Math.abs(pearsonR)

  let strength: string
  if (r >= 0.9) {
    strength = 'Very strong'
  } else if (r >= 0.7) {
    strength = 'Strong'
  } else if (r >= 0.5) {
    strength = 'Moderate'
  } else if (r >= 0.3) {
    strength = 'Weak'
  } else {
    strength = 'Very weak'
  }

  const direction = pearsonR >= 0 ? 'positive' : 'negative'

  let message = `${strength} ${direction} correlation (r=${pearsonR.toFixed(3)})`

  // Check if Spearman differs significantly from Pearson
  if (Math.abs(spearmanRho - pearsonR) > 0.1) {
    message += `. Rank correlation (ρ=${spearmanRho.toFixed(3)}) suggests ${Math.abs(spearmanRho) > r ? 'monotonic relationship with outliers' : 'non-monotonic relationship'}.`
  } else {
    message += '. Backtested and reported P/L ' + (r >= 0.5 ? 'closely track each other' : 'show limited relationship') + '.'
  }

  return message
}

/**
 * Calculate two-tailed p-value for t-statistic
 * Uses approximation for moderate to large sample sizes
 */
function calculateTwoTailedPValue(absTStatistic: number, df: number): number {
  if (df < 1) {
    return 1
  }

  // For large df (>30), t-distribution approximates normal distribution
  if (df > 30) {
    return 2 * (1 - normalCDF(absTStatistic))
  }

  // Use t-distribution approximation for smaller samples
  return 2 * (1 - tCDF(absTStatistic, df))
}

/**
 * Cumulative distribution function for standard normal distribution
 * Using Abramowitz and Stegun approximation
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-x * x / 2)
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))

  return x > 0 ? 1 - prob : prob
}

/**
 * Cumulative distribution function for t-distribution
 * Using Hill's approximation (1970) for better accuracy
 */
function tCDF(t: number, df: number): number {
  // Use Hill's algorithm for t-distribution CDF
  // This is more accurate than simple normal approximation

  const x = t
  const v = df

  // For very large df, use normal approximation
  if (v > 100) {
    return normalCDF(x)
  }

  // Hill's approximation (unused in simplified implementation)

  if (v === 1) {
    // Cauchy distribution
    return 0.5 + Math.atan(x) / Math.PI
  }

  if (v === 2) {
    return 0.5 + x / (2 * Math.sqrt(2 + x * x))
  }

  // For other cases, use beta function approximation
  const z = v / (v + x * x)
  const betaApprox = incompleteBeta(v / 2, 0.5, z)

  return x < 0 ? betaApprox / 2 : 1 - betaApprox / 2
}

/**
 * Approximate incomplete beta function
 * Used for t-distribution CDF calculation
 */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  // Use continued fraction approximation for better accuracy
  const bt = Math.exp(
    a * Math.log(x) +
    b * Math.log(1 - x) -
    logBeta(a, b)
  )

  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaContinuedFraction(a, b, x) / a
  } else {
    return 1 - bt * betaContinuedFraction(b, a, 1 - x) / b
  }
}

/**
 * Log beta function
 */
function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b)
}

/**
 * Log gamma function using Stirling's approximation
 */
function logGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677,
    24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5
  ]

  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015

  for (let j = 0; j < 6; j++) {
    ser += cof[j] / ++y
  }

  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

/**
 * Continued fraction for incomplete beta function
 */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIter = 100
  const eps = 3e-7

  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - qab * x / qap

  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d
  let h = d

  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    h *= d * c

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    const del = d * c
    h *= del

    if (Math.abs(del - 1) < eps) break
  }

  return h
}

/**
 * Get critical t-value for given degrees of freedom
 * Returns value for two-tailed test with 95% confidence (alpha = 0.05)
 */
function getTCriticalValue(df: number): number {
  // Common critical values for 95% confidence (alpha = 0.05)
  // For two-tailed test, we use alpha/2 = 0.025
  const criticalValues: Record<number, number> = {
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571,
    6: 2.447,
    7: 2.365,
    8: 2.306,
    9: 2.262,
    10: 2.228,
    15: 2.131,
    20: 2.086,
    25: 2.060,
    30: 2.042,
    40: 2.021,
    50: 2.009,
    60: 2.000,
    80: 1.990,
    100: 1.984,
    120: 1.980,
  }

  // Find closest df in lookup table
  if (df in criticalValues) {
    return criticalValues[df]
  }

  // Interpolate or use closest value
  const keys = Object.keys(criticalValues).map(Number).sort((a, b) => a - b)

  for (let i = 0; i < keys.length - 1; i++) {
    if (df >= keys[i] && df <= keys[i + 1]) {
      // Linear interpolation
      const t1 = criticalValues[keys[i]]
      const t2 = criticalValues[keys[i + 1]]
      const weight = (df - keys[i]) / (keys[i + 1] - keys[i])
      return t1 + weight * (t2 - t1)
    }
  }

  // For very large df (>120), use normal approximation
  return 1.96 // z-critical for 95% confidence
}

/**
 * Calculate dual equity curves from matched trade pairs
 *
 * Builds cumulative P/L curves for both backtested and reported trades,
 * allowing visualization of performance divergence over time.
 *
 * @param pairs - Array of matched trade pairs (must be sorted by date)
 * @param initialCapital - Starting capital for both curves
 * @param normalizeTo1Lot - If true, normalize P/L to per-contract basis
 * @returns Array of equity curve points
 */
export function calculateDualEquityCurves(
  pairs: MatchedPair[],
  initialCapital = 0,
  normalizeTo1Lot = false
): EquityCurvePoint[] {
  if (pairs.length === 0) {
    return []
  }

  const equityCurve: EquityCurvePoint[] = []
  let backtestedEquity = initialCapital
  let reportedEquity = initialCapital

  pairs.forEach((pair, index) => {
    // Calculate P/L (normalized or total)
    const backtestedPl = normalizeTo1Lot
      ? pair.backtested.pl / pair.backtested.contracts
      : pair.backtested.pl
    const reportedPl = normalizeTo1Lot
      ? pair.reported.pl / pair.reported.contracts
      : pair.reported.pl

    // Accumulate P/L
    backtestedEquity += backtestedPl
    reportedEquity += reportedPl

    // Calculate difference metrics
    const difference = reportedEquity - backtestedEquity
    const percentDifference = backtestedEquity !== 0
      ? ((reportedEquity - backtestedEquity) / backtestedEquity) * 100
      : 0

    equityCurve.push({
      date: pair.reported.dateOpened.toISOString(), // Use reported date (should match backtested)
      tradeNumber: index + 1,
      backtestedEquity,
      reportedEquity,
      difference,
      percentDifference,
    })
  })

  return equityCurve
}

/**
 * Calculate separate equity curves from all trades (not just matched pairs)
 *
 * Builds independent cumulative P/L curves for backtested and reported trades.
 * Unlike calculateDualEquityCurves, this shows the complete picture including
 * unmatched trades, allowing users to see the full performance story.
 *
 * @param backtestedTrades - Array of all backtested trades
 * @param reportedTrades - Array of all reported trades
 * @param initialCapital - Starting capital for both curves
 * @param normalizeTo1Lot - If true, normalize P/L to per-contract basis
 * @returns Object with separate arrays for backtested and reported equity curves
 */
export function calculateSeparateEquityCurves(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[],
  initialCapital = 0,
  normalizeTo1Lot = false
): { backtested: SeparateEquityCurvePoint[]; reported: SeparateEquityCurvePoint[] } {
  const buildCurve = (
    trades: NormalizedTrade[],
    tradeType: 'backtested' | 'reported'
  ): SeparateEquityCurvePoint[] => {
    if (trades.length === 0) {
      return []
    }

    // Sort trades by date
    const sortedTrades = [...trades].sort(
      (a, b) => a.dateOpened.getTime() - b.dateOpened.getTime()
    )

    const curve: SeparateEquityCurvePoint[] = []
    let equity = initialCapital

    sortedTrades.forEach((trade, index) => {
      const pl = normalizeTo1Lot ? trade.pl / trade.contracts : trade.pl
      equity += pl

      curve.push({
        date: trade.dateOpened.toISOString(),
        tradeNumber: index + 1,
        equity,
        tradeType,
      })
    })

    return curve
  }

  return {
    backtested: buildCurve(backtestedTrades, 'backtested'),
    reported: buildCurve(reportedTrades, 'reported'),
  }
}
