/**
 * Calendar data service
 *
 * Provides utility functions for aggregating and scaling trade data
 * for the Trading Calendar feature.
 */

import { std, mean } from 'mathjs'
import { Trade } from '@/lib/models/trade'
import { ReportingTrade } from '@/lib/models/reporting-trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { ScalingMode, StrategyMatch, CalendarDayData } from '@/lib/stores/trading-calendar-store'
import { PortfolioStatsCalculator } from '@/lib/calculations/portfolio-stats'

/**
 * Configuration for risk metric calculations
 */
const RISK_FREE_RATE = 2.0 // 2% annual
const ANNUALIZATION_FACTOR = 252 // Business days

/**
 * Scaled trade values based on the current scaling mode
 */
export interface ScaledTradeValues {
  pl: number
  premium: number
  contracts: number
  plPerContract: number
}

/**
 * Strategy day comparison - aggregated data for one strategy on one day
 * Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual live trading
 */
export interface StrategyDayComparison {
  strategy: string
  date: string
  backtest: {
    trades: Trade[]
    totalPl: number
    totalPremium: number
    totalContracts: number
    tradeCount: number
    totalCommissions: number
  } | null
  actual: {
    trades: ReportingTrade[]
    totalPl: number
    totalPremium: number
    totalContracts: number
    tradeCount: number
  } | null
  isMatched: boolean
  // Scaled values
  scaled: {
    backtestPl: number | null
    actualPl: number | null
    slippage: number | null
    slippagePercent: number | null
  }
}

/**
 * Scale a backtest trade's P&L to a target contract count
 * Note: Trade (from tradelog.csv) = backtest
 */
export function scaleBacktestPl(
  trade: Trade,
  targetContracts: number
): number {
  if (trade.numContracts === 0) return 0
  const plPerContract = trade.pl / trade.numContracts
  return plPerContract * targetContracts
}

/**
 * Get P&L per contract for an actual trade (ReportingTrade from strategylog.csv)
 */
export function getActualPlPerContract(trade: ReportingTrade): number {
  if (trade.numContracts === 0) return 0
  return trade.pl / trade.numContracts
}

/**
 * Get P&L per contract for a backtest trade (Trade from tradelog.csv, accounting for commissions)
 */
export function getBacktestPlPerContract(trade: Trade): number {
  if (trade.numContracts === 0) return 0
  const totalCommissions = (trade.openingCommissionsFees ?? 0) + (trade.closingCommissionsFees ?? 0)
  const netPl = trade.pl - totalCommissions
  return netPl / trade.numContracts
}

/**
 * Scale trade values based on scaling mode
 * Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual
 */
export function scaleTradeValues(
  backtestTrade: Trade | null,
  actualTrade: ReportingTrade | null,
  scalingMode: ScalingMode
): { backtest: ScaledTradeValues | null, actual: ScaledTradeValues | null, slippage: number | null } {
  if (scalingMode === 'raw') {
    return {
      backtest: backtestTrade ? {
        pl: backtestTrade.pl,
        premium: backtestTrade.premium,
        contracts: backtestTrade.numContracts,
        plPerContract: getBacktestPlPerContract(backtestTrade)
      } : null,
      actual: actualTrade ? {
        pl: actualTrade.pl,
        premium: actualTrade.initialPremium,
        contracts: actualTrade.numContracts,
        plPerContract: getActualPlPerContract(actualTrade)
      } : null,
      slippage: null // Not meaningful in raw mode with different contract counts
    }
  }

  if (scalingMode === 'perContract') {
    const btPerContract = backtestTrade ? getBacktestPlPerContract(backtestTrade) : null
    const actualPerContract = actualTrade ? getActualPlPerContract(actualTrade) : null

    return {
      backtest: backtestTrade ? {
        pl: btPerContract!,
        premium: backtestTrade.numContracts > 0 ? backtestTrade.premium / backtestTrade.numContracts : 0,
        contracts: 1,
        plPerContract: btPerContract!
      } : null,
      actual: actualTrade ? {
        pl: actualPerContract!,
        premium: actualTrade.numContracts > 0 ? actualTrade.initialPremium / actualTrade.numContracts : 0,
        contracts: 1,
        plPerContract: actualPerContract!
      } : null,
      slippage: btPerContract !== null && actualPerContract !== null
        ? actualPerContract - btPerContract
        : null
    }
  }

  // scalingMode === 'toReported'
  // Scale backtest DOWN to match actual (reported) contract count
  // backtest = Trade (large contracts), actual = ReportingTrade (small contracts = reported live trading)
  if (!actualTrade || !backtestTrade) {
    return {
      backtest: backtestTrade ? {
        pl: backtestTrade.pl,
        premium: backtestTrade.premium,
        contracts: backtestTrade.numContracts,
        plPerContract: getBacktestPlPerContract(backtestTrade)
      } : null,
      actual: actualTrade ? {
        pl: actualTrade.pl,
        premium: actualTrade.initialPremium,
        contracts: actualTrade.numContracts,
        plPerContract: getActualPlPerContract(actualTrade)
      } : null,
      slippage: null
    }
  }

  // Scale backtest DOWN to match actual (reported) contract count
  const targetContracts = actualTrade.numContracts
  const scaleFactor = backtestTrade.numContracts > 0
    ? targetContracts / backtestTrade.numContracts
    : 0
  const scaledBacktestPl = backtestTrade.pl * scaleFactor
  const scaledBacktestPremium = backtestTrade.premium * scaleFactor

  return {
    backtest: {
      pl: scaledBacktestPl,
      premium: scaledBacktestPremium,
      contracts: targetContracts,
      plPerContract: getBacktestPlPerContract(backtestTrade)
    },
    actual: {
      pl: actualTrade.pl,
      premium: actualTrade.initialPremium,
      contracts: actualTrade.numContracts,
      plPerContract: getActualPlPerContract(actualTrade)
    },
    slippage: actualTrade.pl - scaledBacktestPl
  }
}

/**
 * Aggregate trades by strategy for a single day
 */
export function aggregateTradesByStrategy(
  dayData: CalendarDayData,
  strategyMatches: StrategyMatch[]
): StrategyDayComparison[] {
  const comparisons: StrategyDayComparison[] = []

  // Create lookup maps
  const matchLookup = new Map<string, string>() // backtest -> actual
  const reverseMatchLookup = new Map<string, string>() // actual -> backtest
  for (const match of strategyMatches) {
    matchLookup.set(match.backtestStrategy, match.actualStrategy)
    reverseMatchLookup.set(match.actualStrategy, match.backtestStrategy)
  }

  // Group backtest trades by strategy (Trade from tradelog.csv)
  const btByStrategy = new Map<string, Trade[]>()
  for (const trade of dayData.backtestTrades) {
    const existing = btByStrategy.get(trade.strategy) ?? []
    existing.push(trade)
    btByStrategy.set(trade.strategy, existing)
  }

  // Group actual trades by strategy (ReportingTrade from strategylog.csv)
  const actualByStrategy = new Map<string, ReportingTrade[]>()
  for (const trade of dayData.actualTrades) {
    const existing = actualByStrategy.get(trade.strategy) ?? []
    existing.push(trade)
    actualByStrategy.set(trade.strategy, existing)
  }

  // Process matched strategies
  const processedActual = new Set<string>()

  for (const [btStrategy, btTrades] of btByStrategy) {
    const actualStrategy = matchLookup.get(btStrategy)
    const actualTrades = actualStrategy ? actualByStrategy.get(actualStrategy) : undefined

    if (actualTrades && actualStrategy) {
      processedActual.add(actualStrategy)
    }

    const btAgg = aggregateBacktestTrades(btTrades)
    const actualAgg = actualTrades ? aggregateActualTrades(actualTrades) : null

    comparisons.push({
      strategy: btStrategy,
      date: dayData.date,
      backtest: btAgg,
      actual: actualAgg,
      isMatched: actualAgg !== null,
      scaled: {
        backtestPl: btAgg.totalPl,
        actualPl: actualAgg?.totalPl ?? null,
        slippage: actualAgg ? actualAgg.totalPl - btAgg.totalPl : null,
        slippagePercent: actualAgg && btAgg.totalPl !== 0
          ? ((actualAgg.totalPl - btAgg.totalPl) / Math.abs(btAgg.totalPl)) * 100
          : null
      }
    })
  }

  // Add unmatched actual strategies
  for (const [actualStrategy, actualTrades] of actualByStrategy) {
    if (processedActual.has(actualStrategy)) continue

    const actualAgg = aggregateActualTrades(actualTrades)

    comparisons.push({
      strategy: actualStrategy,
      date: dayData.date,
      backtest: null,
      actual: actualAgg,
      isMatched: false,
      scaled: {
        backtestPl: null,
        actualPl: actualAgg.totalPl,
        slippage: null,
        slippagePercent: null
      }
    })
  }

  // Sort by strategy name
  return comparisons.sort((a, b) => a.strategy.localeCompare(b.strategy))
}

/**
 * Aggregate backtest trades (Trade from tradelog.csv)
 */
function aggregateBacktestTrades(trades: Trade[]) {
  return {
    trades,
    totalPl: trades.reduce((sum, t) => sum + t.pl, 0),
    totalPremium: trades.reduce((sum, t) => sum + t.premium, 0),
    totalContracts: trades.reduce((sum, t) => sum + t.numContracts, 0),
    tradeCount: trades.length,
    totalCommissions: trades.reduce((sum, t) =>
      sum + (t.openingCommissionsFees ?? 0) + (t.closingCommissionsFees ?? 0), 0)
  }
}

/**
 * Aggregate actual trades (ReportingTrade from strategylog.csv)
 */
function aggregateActualTrades(trades: ReportingTrade[]) {
  return {
    trades,
    totalPl: trades.reduce((sum, t) => sum + t.pl, 0),
    totalPremium: trades.reduce((sum, t) => sum + t.initialPremium, 0),
    totalContracts: trades.reduce((sum, t) => sum + t.numContracts, 0),
    tradeCount: trades.length
  }
}

/**
 * Scale aggregated strategy comparison values
 */
export function scaleStrategyComparison(
  comparison: StrategyDayComparison,
  scalingMode: ScalingMode
): StrategyDayComparison {
  if (scalingMode === 'raw') {
    return comparison
  }

  if (scalingMode === 'perContract') {
    const btContracts = comparison.backtest?.totalContracts ?? 0
    const actualContracts = comparison.actual?.totalContracts ?? 0

    const scaledBtPl = btContracts > 0
      ? comparison.backtest!.totalPl / btContracts
      : null
    const scaledActualPl = actualContracts > 0
      ? comparison.actual!.totalPl / actualContracts
      : null

    return {
      ...comparison,
      scaled: {
        backtestPl: scaledBtPl,
        actualPl: scaledActualPl,
        slippage: scaledBtPl !== null && scaledActualPl !== null
          ? scaledActualPl - scaledBtPl
          : null,
        slippagePercent: scaledBtPl !== null && scaledActualPl !== null && scaledBtPl !== 0
          ? ((scaledActualPl - scaledBtPl) / Math.abs(scaledBtPl)) * 100
          : null
      }
    }
  }

  // scalingMode === 'toReported'
  // Scale backtest (Trade, more contracts) DOWN to match actual (ReportingTrade, fewer contracts)
  if (!comparison.backtest || !comparison.actual) {
    return comparison
  }

  const btContracts = comparison.backtest.totalContracts
  const actualContracts = comparison.actual.totalContracts

  if (actualContracts === 0 || btContracts === 0) {
    return comparison
  }

  // Scale backtest P/L DOWN to match actual (reported) contract count
  const scaleFactor = actualContracts / btContracts
  const scaledBacktestPl = comparison.backtest.totalPl * scaleFactor
  const actualPl = comparison.actual.totalPl

  return {
    ...comparison,
    scaled: {
      backtestPl: scaledBacktestPl,
      actualPl: actualPl,
      slippage: actualPl - scaledBacktestPl,
      slippagePercent: scaledBacktestPl !== 0
        ? ((actualPl - scaledBacktestPl) / Math.abs(scaledBacktestPl)) * 100
        : null
    }
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    const absValue = Math.abs(value)
    if (absValue >= 1000000) {
      return `${value < 0 ? '-' : ''}$${(absValue / 1000000).toFixed(2)}M`
    }
    return `${value < 0 ? '-' : ''}$${(absValue / 1000).toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

/**
 * Get color class based on P/L value
 */
export function getPlColorClass(pl: number): string {
  if (pl > 0) return 'text-green-500'
  if (pl < 0) return 'text-red-500'
  return 'text-muted-foreground'
}

/**
 * Get background style for calendar day cells
 * Handles mismatch cases (backtest vs actual disagree) with a distinct color
 * Returns a className string
 */
export function getDayBackgroundStyle(
  backtestPl: number | null,
  actualPl: number | null
): { className?: string } {
  const btPositive = backtestPl !== null && backtestPl > 0
  const btNegative = backtestPl !== null && backtestPl < 0
  const actPositive = actualPl !== null && actualPl > 0
  const actNegative = actualPl !== null && actualPl < 0

  // Check for mismatch: one positive, one negative
  const isMismatch =
    (btPositive && actNegative) || (btNegative && actPositive)

  if (isMismatch) {
    // Muted violet for mismatch - visually distinct from green/red
    return { className: 'bg-violet-900/25' }
  }

  // No mismatch - use single color based on available data (prefer actual)
  const primaryPl = actualPl !== null ? actualPl : backtestPl
  if (primaryPl === null || primaryPl === 0) return {}

  if (primaryPl > 0) {
    return { className: 'bg-green-900/25' }
  } else {
    return { className: 'bg-red-900/25' }
  }
}

/**
 * Calculate max absolute P/L across calendar days for heatmap scaling
 */
export function calculateMaxAbsPl(days: Map<string, CalendarDayData>): number {
  let maxAbs = 0
  for (const day of days.values()) {
    const pl = day.hasActual ? day.actualPl : day.backtestPl
    maxAbs = Math.max(maxAbs, Math.abs(pl))
  }
  return maxAbs
}

/**
 * Get dates for a month grid (includes padding days from adjacent months)
 */
export function getMonthGridDates(year: number, month: number): Date[] {
  const dates: Date[] = []

  // First day of the month
  const firstDay = new Date(year, month, 1)
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0)

  // Start from Sunday of the week containing the first day
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - firstDay.getDay())

  // End on Saturday of the week containing the last day
  const endDate = new Date(lastDay)
  const daysToAdd = 6 - lastDay.getDay()
  endDate.setDate(lastDay.getDate() + daysToAdd)

  // Generate all dates
  const current = new Date(startDate)
  while (current <= endDate) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Get dates for a week grid
 */
export function getWeekGridDates(date: Date): Date[] {
  const dates: Date[] = []
  const startOfWeek = new Date(date)

  // Get to Sunday
  startOfWeek.setDate(date.getDate() - date.getDay())

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    dates.push(d)
  }

  return dates
}

/**
 * Group dates by week for weekly summary calculation
 */
export function groupDatesByWeek(dates: Date[]): Map<number, Date[]> {
  const weeks = new Map<number, Date[]>()

  for (const date of dates) {
    const weekNum = getISOWeekNumber(date)
    const existing = weeks.get(weekNum) ?? []
    existing.push(date)
    weeks.set(weekNum, existing)
  }

  return weeks
}

/**
 * Get ISO week number
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Format date to YYYY-MM-DD key
 */
function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Advanced performance metrics calculated from daily logs
 */
export interface AdvancedPerformanceMetrics {
  sharpe: number | null
  sortino: number | null
  maxDrawdown: number | null
  cagr: number | null
  calmar: number | null
}

/**
 * Trade-based metrics calculated from trade data
 */
export interface TradeBasedMetrics {
  winRate: number
  avgRom: number | null // Return on Margin - only for actual trades
  avgPremiumCapture: number | null
  totalPl: number
  tradeCount: number
  tradingDays: number
}

/**
 * Calculate advanced metrics from daily log entries filtered to a date range.
 * If daily logs don't have enough data, returns null values - the caller is
 * responsible for falling back to trade-based calculations (using PortfolioStatsCalculator).
 * These metrics require a time series of daily returns.
 */
export function calculateAdvancedMetrics(
  dailyLogs: DailyLogEntry[],
  startDate: string,
  endDate: string
): AdvancedPerformanceMetrics {
  // Filter daily logs to date range
  const filteredLogs = dailyLogs.filter(log => {
    const logKey = formatDateKey(log.date)
    return logKey >= startDate && logKey <= endDate
  }).sort((a, b) => a.date.getTime() - b.date.getTime())

  // If we have daily logs, use them
  if (filteredLogs.length >= 2) {
    return calculateMetricsFromDailyLogs(filteredLogs)
  }

  // No data available - caller should fall back to trade-based calculation
  return {
    sharpe: null,
    sortino: null,
    maxDrawdown: null,
    cagr: null,
    calmar: null
  }
}

/**
 * Calculate advanced metrics from daily log entries
 */
function calculateMetricsFromDailyLogs(
  filteredLogs: DailyLogEntry[]
): AdvancedPerformanceMetrics {
  // Calculate daily returns from net liquidity
  const dailyReturns: number[] = []
  for (let i = 1; i < filteredLogs.length; i++) {
    const prevValue = filteredLogs[i - 1].netLiquidity
    const currentValue = filteredLogs[i].netLiquidity
    if (prevValue > 0) {
      const dailyReturn = (currentValue - prevValue) / prevValue
      dailyReturns.push(dailyReturn)
    }
  }

  if (dailyReturns.length < 2) {
    return {
      sharpe: null,
      sortino: null,
      maxDrawdown: filteredLogs.length > 0
        ? Math.max(...filteredLogs.map(l => Math.abs(l.drawdownPct || 0)))
        : null,
      cagr: null,
      calmar: null
    }
  }

  // Calculate Sharpe Ratio
  const avgDailyReturn = mean(dailyReturns) as number
  const stdDev = std(dailyReturns, 'uncorrected') as number
  const dailyRiskFreeRate = RISK_FREE_RATE / 100 / ANNUALIZATION_FACTOR
  const excessReturn = avgDailyReturn - dailyRiskFreeRate
  const sharpe = stdDev > 0
    ? (excessReturn / stdDev) * Math.sqrt(ANNUALIZATION_FACTOR)
    : null

  // Calculate Sortino Ratio
  const excessReturns = dailyReturns.map(ret => ret - dailyRiskFreeRate)
  const avgExcessReturn = mean(excessReturns) as number
  const negativeExcessReturns = excessReturns.filter(ret => ret < 0)
  let sortino: number | null = null
  if (negativeExcessReturns.length > 0) {
    const downsideDeviation = std(negativeExcessReturns, 'biased') as number
    if (downsideDeviation > 1e-10) {
      sortino = (avgExcessReturn / downsideDeviation) * Math.sqrt(ANNUALIZATION_FACTOR)
    }
  }

  // Max Drawdown from daily log drawdownPct
  const maxDrawdown = Math.max(...filteredLogs.map(l => Math.abs(l.drawdownPct || 0)))

  // CAGR calculation
  const startValue = filteredLogs[0].netLiquidity
  const endValue = filteredLogs[filteredLogs.length - 1].netLiquidity
  const startDateObj = filteredLogs[0].date
  const endDateObj = filteredLogs[filteredLogs.length - 1].date
  const totalYears = (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365.25)

  let cagr: number | null = null
  if (totalYears > 0 && startValue > 0 && endValue > 0) {
    cagr = (Math.pow(endValue / startValue, 1 / totalYears) - 1) * 100
  }

  // Calmar Ratio = CAGR / Max Drawdown
  const calmar = cagr !== null && maxDrawdown > 0 ? cagr / maxDrawdown : null

  return {
    sharpe,
    sortino,
    maxDrawdown,
    cagr,
    calmar
  }
}

/**
 * Calculate trade-based metrics from trades in a date range
 * Works with both actual trades (Trade) and backtest trades (ReportingTrade)
 *
 * Note: avgRom is ALWAYS calculated from backtest trades (Trade type) since only
 * they have marginReq. This ensures RoM is available even when useActual is true.
 */
export function calculateTradeMetrics(
  calendarDays: Map<string, CalendarDayData>,
  startDate: string,
  endDate: string,
  useActual: boolean
): TradeBasedMetrics {
  let totalPl = 0
  let tradeCount = 0
  let tradingDays = 0
  let winningDays = 0
  let totalRom = 0
  let romCount = 0
  let totalPremiumCapture = 0
  let premiumCaptureCount = 0

  for (const [dateKey, day] of calendarDays) {
    if (dateKey < startDate || dateKey > endDate) continue

    const hasTrades = useActual ? day.hasActual : day.hasBacktest
    if (!hasTrades) continue

    tradingDays++
    const dayPl = useActual ? day.actualPl : day.backtestPl
    totalPl += dayPl
    if (dayPl > 0) winningDays++

    if (useActual) {
      // Actual trades (ReportingTrade) - calculate premium capture
      for (const trade of day.actualTrades) {
        tradeCount++
        if (trade.initialPremium !== 0) {
          const capture = (trade.pl / Math.abs(trade.initialPremium)) * 100
          totalPremiumCapture += capture
          premiumCaptureCount++
        }
      }
    } else {
      // Backtest trades (Trade) - calculate premium capture and count
      for (const trade of day.backtestTrades) {
        tradeCount++

        // Premium capture
        if (trade.premium !== 0) {
          const capture = (trade.pl / Math.abs(trade.premium)) * 100
          totalPremiumCapture += capture
          premiumCaptureCount++
        }
      }
    }

    // ALWAYS calculate RoM from backtest trades since only Trade type has marginReq
    // This ensures avgRom is available regardless of useActual setting
    for (const trade of day.backtestTrades) {
      if (trade.marginReq > 0) {
        const rom = (trade.pl / trade.marginReq) * 100
        totalRom += rom
        romCount++
      }
    }
  }

  return {
    winRate: tradingDays > 0 ? (winningDays / tradingDays) * 100 : 0,
    avgRom: romCount > 0 ? totalRom / romCount : null,
    avgPremiumCapture: premiumCaptureCount > 0 ? totalPremiumCapture / premiumCaptureCount : null,
    totalPl,
    tradeCount,
    tradingDays
  }
}

/**
 * Calculate Return on Margin for actual trades (Trade type only)
 * ReportingTrade doesn't have marginReq field
 */
export function calculateAvgRomFromTrades(trades: Trade[]): number | null {
  const tradesWithMargin = trades.filter(t => t.marginReq > 0)
  if (tradesWithMargin.length === 0) return null

  const totalRom = tradesWithMargin.reduce((sum, t) => {
    return sum + (t.pl / t.marginReq) * 100
  }, 0)

  return totalRom / tradesWithMargin.length
}

/**
 * Calculate average premium capture for trades
 */
export function calculateAvgPremiumCapture(
  backtestTrades: Trade[],
  actualTrades: ReportingTrade[],
  useActual: boolean
): number | null {
  if (useActual) {
    const tradesWithPremium = actualTrades.filter(t => t.initialPremium !== 0)
    if (tradesWithPremium.length === 0) return null

    const totalCapture = tradesWithPremium.reduce((sum, t) => {
      return sum + (t.pl / Math.abs(t.initialPremium)) * 100
    }, 0)

    return totalCapture / tradesWithPremium.length
  } else {
    const tradesWithPremium = backtestTrades.filter(t => t.premium !== 0)
    if (tradesWithPremium.length === 0) return null

    const totalCapture = tradesWithPremium.reduce((sum, t) => {
      return sum + (t.pl / Math.abs(t.premium)) * 100
    }, 0)

    return totalCapture / tradesWithPremium.length
  }
}

/**
 * Day-specific performance metrics
 * These are metrics that can be calculated for a single day of trading
 * Uses the same calculation approach as the block stats page
 */
export interface DayPerformanceMetrics {
  maxDrawdown: number | null  // Max drawdown for the day's trades
  avgRom: number | null       // Average Return on Margin
  avgPremiumCapture: number | null  // Average premium captured
}

/**
 * Calculate performance metrics for a single day
 * Uses PortfolioStatsCalculator for consistency with block stats page
 */
export function calculateDayMetrics(
  dayData: CalendarDayData
): DayPerformanceMetrics {
  // Use backtest trades (Trade type) since they have the full data needed for calculations
  // (marginReq, premium, fundsAtClose, etc.)
  const trades = dayData.backtestTrades

  if (trades.length === 0) {
    return {
      maxDrawdown: null,
      avgRom: null,
      avgPremiumCapture: null
    }
  }

  // Use PortfolioStatsCalculator for max drawdown - same as block stats
  const calculator = new PortfolioStatsCalculator({ riskFreeRate: 2.0 })
  const portfolioStats = calculator.calculatePortfolioStats(trades)

  // Max drawdown from portfolio stats
  const maxDrawdown = portfolioStats.maxDrawdown > 0 ? portfolioStats.maxDrawdown : null

  // Calculate Avg RoM (same approach as block stats)
  let avgRom: number | null = null
  const tradesWithMargin = trades.filter(t => t.marginReq > 0)
  if (tradesWithMargin.length > 0) {
    const totalRom = tradesWithMargin.reduce((sum, t) => {
      return sum + (t.pl / t.marginReq) * 100
    }, 0)
    avgRom = totalRom / tradesWithMargin.length
  }

  // Calculate Avg Premium Capture
  let avgPremiumCapture: number | null = null
  const tradesWithPremium = trades.filter(t => t.premium !== 0)
  if (tradesWithPremium.length > 0) {
    const totalCapture = tradesWithPremium.reduce((sum, t) => {
      return sum + (t.pl / Math.abs(t.premium)) * 100
    }, 0)
    avgPremiumCapture = totalCapture / tradesWithPremium.length
  }

  return {
    maxDrawdown,
    avgRom,
    avgPremiumCapture
  }
}
