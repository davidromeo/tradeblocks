import { create } from 'zustand'
import { Trade } from '@/lib/models/trade'
import { ReportingTrade } from '@/lib/models/reporting-trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { calculateAdvancedMetrics, calculateTradeMetrics } from '@/lib/services/calendar-data'
import { PortfolioStatsCalculator } from '@/lib/calculations/portfolio-stats'
import { normalizeTradesToOneLot } from '@/lib/utils/trade-normalization'

/**
 * Scaling modes for P&L display
 * - raw: Show actual numbers as-is
 * - perContract: Normalize to per-contract (1 lot)
 * - toReported: Scale actual DOWN to match backtest (reported) contract counts
 */
export type ScalingMode = 'raw' | 'perContract' | 'toReported'

/**
 * Calendar view mode
 */
export type CalendarViewMode = 'week' | 'month'

/**
 * Date display mode - which date to use for placing trades on the calendar
 * - entry: Show trades by their opening/entry date
 * - exit: Show trades by their closing/exit date
 */
export type DateDisplayMode = 'entry' | 'exit'

/**
 * Navigation view state for breadcrumb navigation
 */
export type NavigationView = 'calendar' | 'day' | 'trade'

/**
 * Data display mode - which data to show in calendar cells
 * - backtest: Show only backtest data
 * - actual: Show only actual data
 * - both: Show both backtest and actual data
 */
export type DataDisplayMode = 'backtest' | 'actual' | 'both'

/**
 * Matched strategy pair (exact name match or user-linked)
 */
export interface StrategyMatch {
  backtestStrategy: string
  actualStrategy: string
  isAutoMatched: boolean // true if exact name match, false if user-linked
}

/**
 * Daily aggregated data for calendar display
 */
export interface CalendarDayData {
  date: string // YYYY-MM-DD
  // Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual live trading
  backtestTrades: Trade[]
  actualTrades: ReportingTrade[]
  backtestPl: number
  actualPl: number
  backtestTradeCount: number
  actualTradeCount: number
  hasBacktest: boolean
  hasActual: boolean
  // Matched data (when both exist)
  matchedStrategies: string[]
  unmatchedBacktestStrategies: string[]
  unmatchedActualStrategies: string[]
  // Margin data - sum of marginReq for trades open on this day (only from backtest/Trade type)
  totalMargin: number
}

/**
 * Weekly aggregated data for sidebar
 */
export interface CalendarWeekData {
  weekNumber: number
  startDate: string // YYYY-MM-DD (Monday)
  endDate: string // YYYY-MM-DD (Sunday)
  backtestPl: number
  actualPl: number
  tradingDays: number
  slippage: number | null // Only when both backtest and actual exist
}

/**
 * Trade detail for side-by-side comparison
 */
export interface TradeComparison {
  backtestTrade: ReportingTrade | null
  actualTrade: Trade | null
  strategy: string
  date: string
  // Scaled values based on current scaling mode
  scaledBacktestPl: number | null
  scaledActualPl: number | null
  slippage: number | null
}

/**
 * Performance stats for the selected time period
 */
export interface CalendarPerformanceStats {
  // Basic metrics
  totalPl: number
  winRate: number
  tradeCount: number
  tradingDays: number

  // Advanced metrics from daily logs (require time series)
  sharpe: number | null
  sortino: number | null
  maxDrawdown: number | null
  cagr: number | null
  calmar: number | null

  // Trade-based metrics
  avgRom: number | null // Return on Margin - only available for backtest trades (Trade type)
  avgPremiumCapture: number | null

  // Data source indicator - which trades are being used for calculations
  dataSource: 'backtest' | 'actual' | 'none'
}

/**
 * Comparison stats for the selected time period
 */
export interface CalendarComparisonStats {
  backtestPl: number
  actualPl: number
  totalSlippage: number
  matchRate: number // Percentage of strategies that matched
  unmatchedBacktestCount: number
  unmatchedActualCount: number
}

interface TradingCalendarState {
  // Loading state
  isLoading: boolean
  error: string | null

  // Block context
  blockId: string | null

  // Raw data from DB
  // Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual live trading
  backtestTrades: Trade[]
  actualTrades: ReportingTrade[]
  dailyLogs: DailyLogEntry[]

  // Strategy matching
  strategyMatches: StrategyMatch[]
  unmatchedBacktestStrategies: string[]
  unmatchedActualStrategies: string[]

  // Computed calendar data
  calendarDays: Map<string, CalendarDayData>
  calendarWeeks: CalendarWeekData[]

  // View state
  scalingMode: ScalingMode
  calendarViewMode: CalendarViewMode
  dateDisplayMode: DateDisplayMode
  dataDisplayMode: DataDisplayMode
  navigationView: NavigationView
  showMargin: boolean

  // Current month/date being viewed
  viewDate: Date // The month/week being displayed

  // Selected items for navigation
  selectedDate: string | null // YYYY-MM-DD for day view
  selectedTradeId: string | null // For trade detail view
  selectedStrategy: string | null // Strategy name for trade detail

  // Computed stats (update with view changes)
  performanceStats: CalendarPerformanceStats | null
  comparisonStats: CalendarComparisonStats | null

  // Actions
  loadCalendarData: (blockId: string) => Promise<void>
  setScalingMode: (mode: ScalingMode) => void
  setCalendarViewMode: (mode: CalendarViewMode) => void
  setDateDisplayMode: (mode: DateDisplayMode) => void
  setDataDisplayMode: (mode: DataDisplayMode) => void
  setShowMargin: (show: boolean) => void
  setViewDate: (date: Date) => void

  // Navigation actions
  navigateToDay: (date: string) => void
  navigateToTrade: (strategy: string, date: string) => void
  navigateBack: () => void
  setNavigationFromUrl: (view: NavigationView, date: string | null, strategy: string | null) => void

  // Strategy matching actions
  linkStrategies: (backtestStrategy: string, actualStrategy: string) => void
  unlinkStrategies: (backtestStrategy: string, actualStrategy: string) => void

  // Reset
  reset: () => void
}

/**
 * Get unique strategies from trades
 */
function getUniqueStrategies(trades: Array<{ strategy: string }>): string[] {
  return [...new Set(trades.map(t => t.strategy))].sort()
}

/**
 * Format date to YYYY-MM-DD in local timezone
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD date key back to a local Date object.
 *
 * IMPORTANT: Using new Date('YYYY-MM-DD') parses as UTC midnight,
 * which can shift the date when displayed in local time.
 * This function creates a Date at midnight local time instead.
 */
function parseDateKey(dateKey: string): Date {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    const [, year, month, day] = match
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }
  // Fallback - but this shouldn't happen with valid date keys
  return new Date(dateKey)
}

/**
 * Calculate auto-matched strategies (exact name match)
 */
function calculateAutoMatches(
  backtestStrategies: string[],
  actualStrategies: string[]
): { matches: StrategyMatch[], unmatchedBacktest: string[], unmatchedActual: string[] } {
  const matches: StrategyMatch[] = []
  const unmatchedBacktest: string[] = []
  const unmatchedActual: string[] = []

  const actualSet = new Set(actualStrategies)
  const matchedActual = new Set<string>()

  for (const btStrategy of backtestStrategies) {
    if (actualSet.has(btStrategy)) {
      matches.push({
        backtestStrategy: btStrategy,
        actualStrategy: btStrategy,
        isAutoMatched: true
      })
      matchedActual.add(btStrategy)
    } else {
      unmatchedBacktest.push(btStrategy)
    }
  }

  for (const actualStrategy of actualStrategies) {
    if (!matchedActual.has(actualStrategy)) {
      unmatchedActual.push(actualStrategy)
    }
  }

  return { matches, unmatchedBacktest, unmatchedActual }
}

/**
 * Get the date key for a trade based on the display mode
 */
function getTradeDate(trade: ReportingTrade | Trade, dateDisplayMode: DateDisplayMode): Date {
  if (dateDisplayMode === 'exit') {
    // Use dateClosed if available, otherwise fall back to dateOpened
    if ('dateClosed' in trade && trade.dateClosed) {
      return trade.dateClosed
    }
  }
  return trade.dateOpened
}

/**
 * Build calendar day data from trades
 * Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual live trading
 */
function buildCalendarDays(
  backtestTrades: Trade[],
  actualTrades: ReportingTrade[],
  strategyMatches: StrategyMatch[],
  dateDisplayMode: DateDisplayMode = 'entry'
): Map<string, CalendarDayData> {
  const days = new Map<string, CalendarDayData>()

  // Create a lookup for strategy matches
  const matchLookup = new Map<string, string>() // backtest -> actual
  const reverseMatchLookup = new Map<string, string>() // actual -> backtest
  for (const match of strategyMatches) {
    matchLookup.set(match.backtestStrategy, match.actualStrategy)
    reverseMatchLookup.set(match.actualStrategy, match.backtestStrategy)
  }

  // Group backtest trades by date
  for (const trade of backtestTrades) {
    const dateKey = formatDateKey(getTradeDate(trade, dateDisplayMode))

    if (!days.has(dateKey)) {
      days.set(dateKey, {
        date: dateKey,
        backtestTrades: [],
        actualTrades: [],
        backtestPl: 0,
        actualPl: 0,
        backtestTradeCount: 0,
        actualTradeCount: 0,
        hasBacktest: false,
        hasActual: false,
        matchedStrategies: [],
        unmatchedBacktestStrategies: [],
        unmatchedActualStrategies: [],
        totalMargin: 0
      })
    }

    const day = days.get(dateKey)!
    day.backtestTrades.push(trade)
    day.backtestPl += trade.pl
    day.backtestTradeCount++
    day.hasBacktest = true
    // Add margin from backtest trades (only Trade type has marginReq)
    day.totalMargin += trade.marginReq || 0
  }

  // Group actual trades by date
  for (const trade of actualTrades) {
    const dateKey = formatDateKey(getTradeDate(trade, dateDisplayMode))

    if (!days.has(dateKey)) {
      days.set(dateKey, {
        date: dateKey,
        backtestTrades: [],
        actualTrades: [],
        backtestPl: 0,
        actualPl: 0,
        backtestTradeCount: 0,
        actualTradeCount: 0,
        hasBacktest: false,
        hasActual: false,
        matchedStrategies: [],
        unmatchedBacktestStrategies: [],
        unmatchedActualStrategies: [],
        totalMargin: 0
      })
    }

    const day = days.get(dateKey)!
    day.actualTrades.push(trade)
    day.actualPl += trade.pl
    day.actualTradeCount++
    day.hasActual = true
  }

  // Calculate matched/unmatched strategies per day
  for (const [, day] of days) {
    const btStrategies = new Set(day.backtestTrades.map(t => t.strategy))
    const actualStrategies = new Set(day.actualTrades.map(t => t.strategy))

    const matched: string[] = []
    const unmatchedBt: string[] = []
    const unmatchedActual: string[] = []

    for (const btStrategy of btStrategies) {
      const actualMatch = matchLookup.get(btStrategy)
      if (actualMatch && actualStrategies.has(actualMatch)) {
        matched.push(btStrategy)
      } else {
        unmatchedBt.push(btStrategy)
      }
    }

    for (const actualStrategy of actualStrategies) {
      const btMatch = reverseMatchLookup.get(actualStrategy)
      if (!btMatch || !btStrategies.has(btMatch)) {
        unmatchedActual.push(actualStrategy)
      }
    }

    day.matchedStrategies = matched
    day.unmatchedBacktestStrategies = unmatchedBt
    day.unmatchedActualStrategies = unmatchedActual
  }

  return days
}

/**
 * Get scaled backtest P/L for comparison stats
 *
 * Scaling modes:
 * - raw: Show backtest P/L as-is
 * - perContract: Normalize to per-contract (divide by contract count)
 * - toReported: Scale backtest DOWN to match actual (reported) contract counts
 */
function getScaledBacktestPl(dayData: CalendarDayData, scalingMode: ScalingMode): number {
  if (!dayData.hasBacktest) return 0

  if (scalingMode === 'perContract') {
    const totalContracts = dayData.backtestTrades.reduce((sum, t) => sum + t.numContracts, 0)
    return totalContracts > 0 ? dayData.backtestPl / totalContracts : 0
  }

  if (scalingMode === 'toReported' && dayData.hasActual) {
    // Scale backtest DOWN to match actual (reported) contract counts
    // Backtest (Trade) typically has more contracts, actual (ReportingTrade) has fewer
    const btContracts = dayData.backtestTrades.reduce((sum, t) => sum + t.numContracts, 0)
    const actualContracts = dayData.actualTrades.reduce((sum, t) => sum + t.numContracts, 0)
    if (btContracts > 0 && actualContracts > 0) {
      return dayData.backtestPl * (actualContracts / btContracts)
    }
  }

  // raw shows backtest as-is
  return dayData.backtestPl
}

/**
 * Get scaled actual P/L for comparison stats
 *
 * Scaling modes:
 * - raw: Show actual P/L as-is
 * - perContract: Normalize to per-contract (divide by contract count)
 * - toReported: Show actual P/L as-is (backtest is scaled down to match)
 */
function getScaledActualPl(dayData: CalendarDayData, scalingMode: ScalingMode): number {
  if (!dayData.hasActual) return 0

  if (scalingMode === 'perContract') {
    const totalContracts = dayData.actualTrades.reduce((sum, t) => sum + t.numContracts, 0)
    return totalContracts > 0 ? dayData.actualPl / totalContracts : 0
  }

  // For 'raw' and 'toReported', show actual as-is
  return dayData.actualPl
}

/**
 * Calculate performance stats for visible date range
 */
function calculatePerformanceStats(
  days: Map<string, CalendarDayData>,
  viewDate: Date,
  viewMode: CalendarViewMode,
  dailyLogs: DailyLogEntry[],
  backtestTrades: Trade[],
  scalingMode: ScalingMode = 'raw',
  dateDisplayMode: DateDisplayMode = 'exit'
): CalendarPerformanceStats {
  // Get date range based on view mode
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  let startDate: Date
  let endDate: Date

  if (viewMode === 'month') {
    startDate = new Date(year, month, 1)
    endDate = new Date(year, month + 1, 0)
  } else {
    // Week view - get Sunday to Saturday (matching getWeekGridDates in calendar-data.ts)
    startDate = new Date(viewDate)
    startDate.setDate(viewDate.getDate() - viewDate.getDay()) // Go to Sunday
    endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6) // Saturday
  }

  const startKey = formatDateKey(startDate)
  const endKey = formatDateKey(endDate)

  // Determine if we should use actual trades (when available) or backtest
  let hasActualInRange = false
  for (const [dateKey, day] of days) {
    if (dateKey >= startKey && dateKey <= endKey && day.hasActual) {
      hasActualInRange = true
      break
    }
  }
  const useActual = hasActualInRange

  // Calculate trade-based metrics
  const tradeMetrics = calculateTradeMetrics(days, startKey, endKey, useActual)

  // If no trades in the date range, return null for advanced metrics
  // We shouldn't show performance stats for empty periods
  if (tradeMetrics.tradeCount === 0) {
    return {
      totalPl: 0,
      winRate: 0,
      tradeCount: 0,
      tradingDays: 0,
      sharpe: null,
      sortino: null,
      maxDrawdown: null,
      cagr: null,
      calmar: null,
      avgRom: null,
      avgPremiumCapture: null,
      dataSource: 'none'
    }
  }

  // When scaling is active (perContract), we must use trade-based calculations
  // because daily logs represent raw portfolio values that don't scale properly.
  // This matches the behavior in performance-snapshot.ts
  const useTradeBasedCalculation = scalingMode === 'perContract' || dailyLogs.length < 2

  if (useTradeBasedCalculation && backtestTrades.length > 0) {
    // Filter trades to date range using the appropriate date based on display mode
    const tradesInRange = backtestTrades.filter(t => {
      const tradeDate = formatDateKey(getTradeDate(t, dateDisplayMode))
      return tradeDate >= startKey && tradeDate <= endKey
    })

    if (tradesInRange.length >= 2) {
      // Use normalizeTradesToOneLot for proper equity curve reconstruction
      // This matches what block stats does when "normalize to 1 lot" is enabled
      const scaledTrades = scalingMode === 'perContract'
        ? normalizeTradesToOneLot(tradesInRange)
        : tradesInRange

      const calculator = new PortfolioStatsCalculator()
      const portfolioStats = calculator.calculatePortfolioStats(scaledTrades)

      return {
        totalPl: tradeMetrics.totalPl,
        winRate: tradeMetrics.winRate,
        tradeCount: tradeMetrics.tradeCount,
        tradingDays: tradeMetrics.tradingDays,
        sharpe: portfolioStats.sharpeRatio ?? null,
        sortino: portfolioStats.sortinoRatio ?? null,
        maxDrawdown: portfolioStats.maxDrawdown ?? null,
        cagr: portfolioStats.cagr ?? null,
        calmar: portfolioStats.calmarRatio ?? null,
        avgRom: tradeMetrics.avgRom,
        avgPremiumCapture: tradeMetrics.avgPremiumCapture,
        dataSource: useActual ? 'actual' : 'backtest'
      }
    }
  }

  // Use daily logs for advanced metrics when not scaling
  const advancedMetrics = calculateAdvancedMetrics(dailyLogs, startKey, endKey)

  return {
    totalPl: tradeMetrics.totalPl,
    winRate: tradeMetrics.winRate,
    tradeCount: tradeMetrics.tradeCount,
    tradingDays: tradeMetrics.tradingDays,
    sharpe: advancedMetrics.sharpe,
    sortino: advancedMetrics.sortino,
    maxDrawdown: advancedMetrics.maxDrawdown,
    cagr: advancedMetrics.cagr,
    calmar: advancedMetrics.calmar,
    avgRom: tradeMetrics.avgRom,
    avgPremiumCapture: tradeMetrics.avgPremiumCapture,
    dataSource: useActual ? 'actual' : 'backtest'
  }
}

/**
 * Calculate comparison stats for visible date range
 */
function calculateComparisonStats(
  days: Map<string, CalendarDayData>,
  viewDate: Date,
  viewMode: CalendarViewMode,
  strategyMatches: StrategyMatch[],
  unmatchedBacktest: string[],
  unmatchedActual: string[],
  scalingMode: ScalingMode = 'raw'
): CalendarComparisonStats | null {
  // Get date range
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  let startDate: Date
  let endDate: Date

  if (viewMode === 'month') {
    startDate = new Date(year, month, 1)
    endDate = new Date(year, month + 1, 0)
  } else {
    // Week view - get Sunday to Saturday (matching getWeekGridDates in calendar-data.ts)
    startDate = new Date(viewDate)
    startDate.setDate(viewDate.getDate() - viewDate.getDay()) // Go to Sunday
    endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6) // Saturday
  }

  const startKey = formatDateKey(startDate)
  const endKey = formatDateKey(endDate)

  let backtestPl = 0
  let actualPl = 0
  let hasAnyActual = false

  for (const [dateKey, day] of days) {
    if (dateKey >= startKey && dateKey <= endKey) {
      backtestPl += getScaledBacktestPl(day, scalingMode)
      actualPl += getScaledActualPl(day, scalingMode)
      if (day.hasActual) hasAnyActual = true
    }
  }

  // Only show comparison stats if there are actual trades
  if (!hasAnyActual) return null

  const totalStrategies = strategyMatches.length + unmatchedBacktest.length + unmatchedActual.length
  const matchRate = totalStrategies > 0
    ? (strategyMatches.length / totalStrategies) * 100
    : 0

  return {
    backtestPl,
    actualPl,
    totalSlippage: actualPl - backtestPl,
    matchRate,
    unmatchedBacktestCount: unmatchedBacktest.length,
    unmatchedActualCount: unmatchedActual.length
  }
}

const initialState = {
  isLoading: false,
  error: null,
  blockId: null,
  backtestTrades: [],
  actualTrades: [],
  dailyLogs: [],
  strategyMatches: [],
  unmatchedBacktestStrategies: [],
  unmatchedActualStrategies: [],
  calendarDays: new Map<string, CalendarDayData>(),
  calendarWeeks: [],
  scalingMode: 'raw' as ScalingMode,
  calendarViewMode: 'month' as CalendarViewMode,
  dateDisplayMode: 'exit' as DateDisplayMode,
  dataDisplayMode: 'both' as DataDisplayMode,
  navigationView: 'calendar' as NavigationView,
  showMargin: false,
  viewDate: new Date(),
  selectedDate: null,
  selectedTradeId: null,
  selectedStrategy: null,
  performanceStats: null,
  comparisonStats: null
}

export const useTradingCalendarStore = create<TradingCalendarState>((set, get) => ({
  ...initialState,

  loadCalendarData: async (blockId: string) => {
    set({ isLoading: true, error: null, blockId })

    try {
      const {
        getTradesByBlock,
        getReportingTradesByBlock,
        getDailyLogsByBlock,
        getBlock
      } = await import('@/lib/db')

      // Load all data for the block
      // Note: tradeLog (Trade) = backtest data, reportingLog (ReportingTrade) = actual live trading
      const [backtestTrades, actualTrades, dailyLogs, block] = await Promise.all([
        getTradesByBlock(blockId),
        getReportingTradesByBlock(blockId),
        getDailyLogsByBlock(blockId),
        getBlock(blockId)
      ])

      // Get existing strategy alignments from block if any
      const existingMappings = block?.strategyAlignment?.mappings ?? []

      // Get unique strategies
      const backtestStrategies = getUniqueStrategies(backtestTrades)
      const actualStrategies = getUniqueStrategies(actualTrades)

      // Calculate auto-matches first
      const autoMatchResult = calculateAutoMatches(backtestStrategies, actualStrategies)

      // Merge with existing user-defined mappings
      const userMappings = existingMappings
        .filter(m => m.reportingStrategies.length > 0 && m.liveStrategies.length > 0)
        .map(m => ({
          backtestStrategy: m.reportingStrategies[0],
          actualStrategy: m.liveStrategies[0],
          isAutoMatched: false
        }))

      // Combine: auto-matches take precedence, then add user mappings for remaining
      const allMatches = [...autoMatchResult.matches]
      const autoMatchedBacktest = new Set(autoMatchResult.matches.map(m => m.backtestStrategy))
      const autoMatchedActual = new Set(autoMatchResult.matches.map(m => m.actualStrategy))

      for (const userMatch of userMappings) {
        if (!autoMatchedBacktest.has(userMatch.backtestStrategy) &&
            !autoMatchedActual.has(userMatch.actualStrategy)) {
          allMatches.push(userMatch)
        }
      }

      // Recalculate unmatched after applying user mappings
      const matchedBacktest = new Set(allMatches.map(m => m.backtestStrategy))
      const matchedActual = new Set(allMatches.map(m => m.actualStrategy))
      const unmatchedBacktest = backtestStrategies.filter(s => !matchedBacktest.has(s))
      const unmatchedActual = actualStrategies.filter(s => !matchedActual.has(s))

      // Build calendar data (default to 'exit' date display mode)
      const defaultDateDisplayMode: DateDisplayMode = 'exit'
      const calendarDays = buildCalendarDays(backtestTrades, actualTrades, allMatches, defaultDateDisplayMode)

      // Determine initial view date - latest trade date or today
      let viewDate = new Date()
      const allDates = [...calendarDays.keys()].sort()
      if (allDates.length > 0) {
        viewDate = parseDateKey(allDates[allDates.length - 1])
      }

      // Determine default scaling mode:
      // - If we have both backtest AND actual trades, default to 'toReported'
      // - Otherwise use 'raw'
      const defaultScalingMode: ScalingMode =
        backtestTrades.length > 0 && actualTrades.length > 0
          ? 'toReported'
          : 'raw'

      // Calculate initial stats with default scaling mode
      const performanceStats = calculatePerformanceStats(
        calendarDays,
        viewDate,
        'month',
        dailyLogs,
        backtestTrades,
        defaultScalingMode,
        defaultDateDisplayMode
      )
      const comparisonStats = calculateComparisonStats(
        calendarDays,
        viewDate,
        'month',
        allMatches,
        unmatchedBacktest,
        unmatchedActual,
        defaultScalingMode
      )

      set({
        isLoading: false,
        backtestTrades,
        actualTrades,
        dailyLogs,
        strategyMatches: allMatches,
        unmatchedBacktestStrategies: unmatchedBacktest,
        unmatchedActualStrategies: unmatchedActual,
        calendarDays,
        viewDate,
        performanceStats,
        comparisonStats,
        scalingMode: defaultScalingMode
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load calendar data'
      })
    }
  },

  setScalingMode: (mode) => {
    const state = get()
    // Recalculate stats with new scaling mode
    const performanceStats = calculatePerformanceStats(
      state.calendarDays,
      state.viewDate,
      state.calendarViewMode,
      state.dailyLogs,
      state.backtestTrades,
      mode,
      state.dateDisplayMode
    )
    const comparisonStats = calculateComparisonStats(
      state.calendarDays,
      state.viewDate,
      state.calendarViewMode,
      state.strategyMatches,
      state.unmatchedBacktestStrategies,
      state.unmatchedActualStrategies,
      mode
    )
    set({ scalingMode: mode, performanceStats, comparisonStats })
  },

  setCalendarViewMode: (mode) => {
    const state = get()
    const performanceStats = calculatePerformanceStats(
      state.calendarDays,
      state.viewDate,
      mode,
      state.dailyLogs,
      state.backtestTrades,
      state.scalingMode,
      state.dateDisplayMode
    )
    const comparisonStats = calculateComparisonStats(
      state.calendarDays,
      state.viewDate,
      mode,
      state.strategyMatches,
      state.unmatchedBacktestStrategies,
      state.unmatchedActualStrategies,
      state.scalingMode
    )
    set({ calendarViewMode: mode, performanceStats, comparisonStats })
  },

  setDateDisplayMode: (mode) => {
    const state = get()
    // Rebuild calendar days with new date display mode
    const calendarDays = buildCalendarDays(
      state.backtestTrades,
      state.actualTrades,
      state.strategyMatches,
      mode
    )
    // Recalculate stats with the new date display mode
    const performanceStats = calculatePerformanceStats(
      calendarDays,
      state.viewDate,
      state.calendarViewMode,
      state.dailyLogs,
      state.backtestTrades,
      state.scalingMode,
      mode
    )
    const comparisonStats = calculateComparisonStats(
      calendarDays,
      state.viewDate,
      state.calendarViewMode,
      state.strategyMatches,
      state.unmatchedBacktestStrategies,
      state.unmatchedActualStrategies,
      state.scalingMode
    )
    set({ dateDisplayMode: mode, calendarDays, performanceStats, comparisonStats })
  },

  setDataDisplayMode: (mode) => {
    set({ dataDisplayMode: mode })
  },

  setShowMargin: (show) => {
    set({ showMargin: show })
  },

  setViewDate: (date) => {
    const state = get()
    const performanceStats = calculatePerformanceStats(
      state.calendarDays,
      date,
      state.calendarViewMode,
      state.dailyLogs,
      state.backtestTrades,
      state.scalingMode,
      state.dateDisplayMode
    )
    const comparisonStats = calculateComparisonStats(
      state.calendarDays,
      date,
      state.calendarViewMode,
      state.strategyMatches,
      state.unmatchedBacktestStrategies,
      state.unmatchedActualStrategies,
      state.scalingMode
    )
    set({ viewDate: date, performanceStats, comparisonStats })
  },

  navigateToDay: (date) => {
    set({ navigationView: 'day', selectedDate: date })
  },

  navigateToTrade: (strategy, date) => {
    set({
      navigationView: 'trade',
      selectedStrategy: strategy,
      selectedDate: date
    })
  },

  navigateBack: () => {
    const state = get()
    if (state.navigationView === 'trade') {
      set({ navigationView: 'day', selectedStrategy: null })
    } else if (state.navigationView === 'day') {
      set({ navigationView: 'calendar', selectedDate: null })
    }
  },

  setNavigationFromUrl: (view, date, strategy) => {
    set({
      navigationView: view,
      selectedDate: date,
      selectedStrategy: strategy
    })
  },

  linkStrategies: async (backtestStrategy, actualStrategy) => {
    const state = get()

    // Add new match
    const newMatch: StrategyMatch = {
      backtestStrategy,
      actualStrategy,
      isAutoMatched: false
    }

    const updatedMatches = [...state.strategyMatches, newMatch]
    const updatedUnmatchedBacktest = state.unmatchedBacktestStrategies.filter(
      s => s !== backtestStrategy
    )
    const updatedUnmatchedActual = state.unmatchedActualStrategies.filter(
      s => s !== actualStrategy
    )

    // Rebuild calendar days with new matches (respect current dateDisplayMode)
    const calendarDays = buildCalendarDays(
      state.backtestTrades,
      state.actualTrades,
      updatedMatches,
      state.dateDisplayMode
    )

    // Recalculate stats with current scaling mode
    const performanceStats = calculatePerformanceStats(
      calendarDays,
      state.viewDate,
      state.calendarViewMode,
      state.dailyLogs,
      state.backtestTrades,
      state.scalingMode,
      state.dateDisplayMode
    )
    const comparisonStats = calculateComparisonStats(
      calendarDays,
      state.viewDate,
      state.calendarViewMode,
      updatedMatches,
      updatedUnmatchedBacktest,
      updatedUnmatchedActual,
      state.scalingMode
    )

    set({
      strategyMatches: updatedMatches,
      unmatchedBacktestStrategies: updatedUnmatchedBacktest,
      unmatchedActualStrategies: updatedUnmatchedActual,
      calendarDays,
      performanceStats,
      comparisonStats
    })

    // Persist to block
    if (state.blockId) {
      try {
        const { getBlock, updateBlock } = await import('@/lib/db')
        const block = await getBlock(state.blockId)
        if (block) {
          const existingMappings = block.strategyAlignment?.mappings ?? []
          const now = new Date()
          const newMapping = {
            id: crypto.randomUUID(),
            reportingStrategies: [backtestStrategy],
            liveStrategies: [actualStrategy],
            createdAt: now,
            updatedAt: now
          }
          await updateBlock(state.blockId, {
            strategyAlignment: {
              version: 1,
              updatedAt: now,
              mappings: [...existingMappings, newMapping]
            }
          })
        }
      } catch (error) {
        console.error('Failed to persist strategy mapping:', error)
      }
    }
  },

  unlinkStrategies: async (backtestStrategy, actualStrategy) => {
    const state = get()

    // Find and remove the match (only allow unlinking user-defined matches)
    const matchToRemove = state.strategyMatches.find(
      m => m.backtestStrategy === backtestStrategy &&
           m.actualStrategy === actualStrategy &&
           !m.isAutoMatched
    )

    if (!matchToRemove) return // Can't unlink auto-matches

    const updatedMatches = state.strategyMatches.filter(
      m => !(m.backtestStrategy === backtestStrategy && m.actualStrategy === actualStrategy)
    )
    const updatedUnmatchedBacktest = [...state.unmatchedBacktestStrategies, backtestStrategy]
    const updatedUnmatchedActual = [...state.unmatchedActualStrategies, actualStrategy]

    // Rebuild calendar days (respect current dateDisplayMode)
    const calendarDays = buildCalendarDays(
      state.backtestTrades,
      state.actualTrades,
      updatedMatches,
      state.dateDisplayMode
    )

    // Recalculate stats with current scaling mode
    const performanceStats = calculatePerformanceStats(
      calendarDays,
      state.viewDate,
      state.calendarViewMode,
      state.dailyLogs,
      state.backtestTrades,
      state.scalingMode,
      state.dateDisplayMode
    )
    const comparisonStats = calculateComparisonStats(
      calendarDays,
      state.viewDate,
      state.calendarViewMode,
      updatedMatches,
      updatedUnmatchedBacktest,
      updatedUnmatchedActual,
      state.scalingMode
    )

    set({
      strategyMatches: updatedMatches,
      unmatchedBacktestStrategies: updatedUnmatchedBacktest,
      unmatchedActualStrategies: updatedUnmatchedActual,
      calendarDays,
      performanceStats,
      comparisonStats
    })

    // Remove from persisted block
    if (state.blockId) {
      try {
        const { getBlock, updateBlock } = await import('@/lib/db')
        const block = await getBlock(state.blockId)
        if (block) {
          const existingMappings = block.strategyAlignment?.mappings ?? []
          const updatedMappings = existingMappings.filter(
            m => !(m.reportingStrategies.includes(backtestStrategy) &&
                   m.liveStrategies.includes(actualStrategy))
          )
          await updateBlock(state.blockId, {
            strategyAlignment: {
              version: 1,
              updatedAt: new Date(),
              mappings: updatedMappings
            }
          })
        }
      } catch (error) {
        console.error('Failed to remove strategy mapping:', error)
      }
    }
  },

  reset: () => {
    set(initialState)
  }
}))
