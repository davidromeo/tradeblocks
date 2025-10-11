import { Trade } from '@/lib/models/trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { PortfolioStats } from '@/lib/models/portfolio-stats'
import { PortfolioStatsCalculator } from '@/lib/calculations/portfolio-stats'

export interface SnapshotDateRange {
  from?: Date
  to?: Date
}

export interface SnapshotFilters {
  dateRange?: SnapshotDateRange
  strategies?: string[]
}

interface SnapshotOptions {
  trades: Trade[]
  dailyLogs?: DailyLogEntry[]
  filters?: SnapshotFilters
  riskFreeRate?: number
}

export interface SnapshotChartData {
  equityCurve: Array<{ date: string; equity: number; highWaterMark: number; tradeNumber: number }>
  drawdownData: Array<{ date: string; drawdownPct: number }>
  dayOfWeekData: Array<{ day: string; count: number; avgPl: number }>
  returnDistribution: number[]
  streakData: {
    winDistribution: Record<number, number>
    lossDistribution: Record<number, number>
    statistics: {
      maxWinStreak: number
      maxLossStreak: number
      avgWinStreak: number
      avgLossStreak: number
    }
  }
  monthlyReturns: Record<number, Record<number, number>>
  tradeSequence: Array<{ tradeNumber: number; pl: number; date: string }>
  romTimeline: Array<{ date: string; rom: number }>
  rollingMetrics: Array<{ date: string; winRate: number; sharpeRatio: number; profitFactor: number; volatility: number }>
}

export interface PerformanceSnapshot {
  filteredTrades: Trade[]
  filteredDailyLogs: DailyLogEntry[]
  portfolioStats: PortfolioStats
  chartData: SnapshotChartData
}

export async function buildPerformanceSnapshot(options: SnapshotOptions): Promise<PerformanceSnapshot> {
  const riskFreeRate = typeof options.riskFreeRate === 'number' ? options.riskFreeRate : 2.0
  const strategies = options.filters?.strategies?.length ? options.filters?.strategies : undefined
  const dateRange = options.filters?.dateRange

  let filteredTrades = [...options.trades]
  let filteredDailyLogs = options.dailyLogs ? [...options.dailyLogs] : undefined

  if (dateRange?.from || dateRange?.to) {
    filteredTrades = filteredTrades.filter(trade => {
      const tradeDate = new Date(trade.dateOpened)
      if (dateRange.from && tradeDate < dateRange.from) return false
      if (dateRange.to && tradeDate > dateRange.to) return false
      return true
    })

    if (filteredDailyLogs) {
      filteredDailyLogs = filteredDailyLogs.filter(entry => {
        const entryDate = new Date(entry.date)
        if (dateRange.from && entryDate < dateRange.from) return false
        if (dateRange.to && entryDate > dateRange.to) return false
        return true
      })
    }
  }

  if (strategies) {
    filteredTrades = filteredTrades.filter(trade =>
      strategies.includes(trade.strategy || 'Unknown')
    )

    filteredDailyLogs = undefined
  }

  const calculator = new PortfolioStatsCalculator({ riskFreeRate })
  const portfolioStats = calculator.calculatePortfolioStats(
    filteredTrades,
    filteredDailyLogs,
    Boolean(strategies && strategies.length > 0)
  )

  const chartData = await processChartData(filteredTrades, filteredDailyLogs)

  return {
    filteredTrades,
    filteredDailyLogs: filteredDailyLogs ?? [],
    portfolioStats,
    chartData
  }
}

export async function processChartData(
  trades: Trade[],
  dailyLogs?: DailyLogEntry[]
): Promise<SnapshotChartData> {
  const { equityCurve, drawdownData } = buildEquityAndDrawdown(trades, dailyLogs)

  const dayOfWeekData = calculateDayOfWeekData(trades)

  const returnDistribution = trades
    .filter(trade => trade.marginReq && trade.marginReq > 0)
    .map(trade => (trade.pl / trade.marginReq!) * 100)

  const streakData = calculateStreakData(trades)

  const monthlyReturns = calculateMonthlyReturns(trades)

  const tradeSequence = trades.map((trade, index) => ({
    tradeNumber: index + 1,
    pl: trade.pl,
    date: new Date(trade.dateOpened).toISOString()
  }))

  const romTimeline = trades
    .filter(trade => trade.marginReq && trade.marginReq > 0)
    .map(trade => ({
      date: new Date(trade.dateOpened).toISOString(),
      rom: (trade.pl / trade.marginReq!) * 100
    }))

  const rollingMetrics = calculateRollingMetrics(trades)

  return {
    equityCurve,
    drawdownData,
    dayOfWeekData,
    returnDistribution,
    streakData,
    monthlyReturns,
    tradeSequence,
    romTimeline,
    rollingMetrics
  }
}

function buildEquityAndDrawdown(
  trades: Trade[],
  dailyLogs?: DailyLogEntry[]
) {
  if (dailyLogs && dailyLogs.length > 0) {
    return buildEquityAndDrawdownFromDailyLogs(trades, dailyLogs)
  }

  const equityCurve = calculateEquityCurveFromTrades(trades)

  const drawdownData = equityCurve.map(point => {
    const { equity, highWaterMark, date } = point
    if (!isFinite(highWaterMark) || highWaterMark === 0) {
      return { date, drawdownPct: 0 }
    }

    const drawdownPct = ((equity - highWaterMark) / highWaterMark) * 100
    return { date, drawdownPct }
  })

  return { equityCurve, drawdownData }
}

function buildEquityAndDrawdownFromDailyLogs(
  trades: Trade[],
  dailyLogs: DailyLogEntry[]
) {
  const sortedLogs = [...dailyLogs].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  if (sortedLogs.length === 0) {
    return { equityCurve: [], drawdownData: [] }
  }

  const tradesSortedByClose = trades
    .filter(trade => trade.dateClosed)
    .sort((a, b) =>
      new Date(a.dateClosed ?? a.dateOpened).getTime() -
      new Date(b.dateClosed ?? b.dateOpened).getTime()
    )

  let closedTradeCount = 0
  let highWaterMark = Number.NEGATIVE_INFINITY

  const equityCurve: SnapshotChartData['equityCurve'] = []
  const drawdownData: SnapshotChartData['drawdownData'] = []

  sortedLogs.forEach(entry => {
    const entryDate = new Date(entry.date)

    while (
      closedTradeCount < tradesSortedByClose.length &&
      new Date(
        tradesSortedByClose[closedTradeCount].dateClosed ?? tradesSortedByClose[closedTradeCount].dateOpened
      ).getTime() <= entryDate.getTime()
    ) {
      closedTradeCount += 1
    }

    const equity = getEquityValueFromDailyLog(entry)
    if (!isFinite(equity)) {
      return
    }

    if (!isFinite(highWaterMark) || equity > highWaterMark) {
      highWaterMark = equity
    }

    const drawdownPct = typeof entry.drawdownPct === 'number' && !Number.isNaN(entry.drawdownPct)
      ? entry.drawdownPct
      : highWaterMark > 0
        ? ((equity - highWaterMark) / highWaterMark) * 100
        : 0

    const isoDate = entryDate.toISOString()

    equityCurve.push({
      date: isoDate,
      equity,
      highWaterMark,
      tradeNumber: closedTradeCount
    })

    drawdownData.push({
      date: isoDate,
      drawdownPct
    })
  })

  return { equityCurve, drawdownData }
}

function getEquityValueFromDailyLog(entry: DailyLogEntry): number {
  const candidates = [entry.netLiquidity, entry.currentFunds, entry.tradingFunds]
  for (const value of candidates) {
    if (typeof value === 'number' && isFinite(value)) {
      return value
    }
  }
  return 0
}

function calculateEquityCurveFromTrades(trades: Trade[]) {
  const closedTrades = trades.filter(trade => trade.dateClosed).sort((a, b) => {
    const dateA = new Date(a.dateClosed ?? a.dateOpened).getTime()
    const dateB = new Date(b.dateClosed ?? b.dateOpened).getTime()
    if (dateA === dateB) {
      return (a.timeClosed || '').localeCompare(b.timeClosed || '')
    }
    return dateA - dateB
  })

  if (closedTrades.length === 0) {
    const fallbackTrades = [...trades].sort((a, b) =>
      new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
    )

    if (fallbackTrades.length === 0) {
      const now = new Date().toISOString()
      return [{
        date: now,
        equity: 0,
        highWaterMark: 0,
        tradeNumber: 0
      }]
    }

    let initialCapital = PortfolioStatsCalculator.calculateInitialCapital(fallbackTrades)
    if (!isFinite(initialCapital) || initialCapital <= 0) {
      initialCapital = 100000
    }

    let runningEquity = initialCapital
    let highWaterMark = runningEquity

    const initialDate = new Date(fallbackTrades[0].dateOpened)

    const curve: SnapshotChartData['equityCurve'] = [{
      date: initialDate.toISOString(),
      equity: runningEquity,
      highWaterMark,
      tradeNumber: 0
    }]

    fallbackTrades.forEach((trade, index) => {
      runningEquity += trade.pl
      highWaterMark = Math.max(highWaterMark, runningEquity)

      const baseDate = new Date(trade.dateOpened)
      const uniqueDate = new Date(baseDate.getTime() + (index + 1) * 1000)

      curve.push({
        date: uniqueDate.toISOString(),
        equity: runningEquity,
        highWaterMark,
        tradeNumber: index + 1
      })
    })

    return curve
  }

  let initialCapital = PortfolioStatsCalculator.calculateInitialCapital(closedTrades)
  if (!isFinite(initialCapital) || initialCapital <= 0) {
    initialCapital = 100000
  }

  let runningEquity = initialCapital
  let highWaterMark = runningEquity

  const firstCloseDate = new Date(closedTrades[0].dateClosed ?? closedTrades[0].dateOpened)
  const initialDate = new Date(firstCloseDate.getTime() - 1000)

  const curve: SnapshotChartData['equityCurve'] = [{
    date: initialDate.toISOString(),
    equity: runningEquity,
    highWaterMark,
    tradeNumber: 0
  }]

  closedTrades.forEach((trade, index) => {
    const equity = typeof trade.fundsAtClose === 'number' && isFinite(trade.fundsAtClose)
      ? trade.fundsAtClose
      : runningEquity + trade.pl

    runningEquity = equity
    highWaterMark = Math.max(highWaterMark, runningEquity)

    const closeDate = new Date(trade.dateClosed ?? trade.dateOpened)
    const uniqueDate = new Date(closeDate.getTime() + (index + 1) * 1000)

    curve.push({
      date: uniqueDate.toISOString(),
      equity: runningEquity,
      highWaterMark,
      tradeNumber: index + 1
    })
  })

  return curve
}

function calculateDayOfWeekData(trades: Trade[]) {
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const dayData: Record<string, { count: number; totalPl: number }> = {}

  trades.forEach(trade => {
    const tradeDate = trade.dateOpened instanceof Date ? trade.dateOpened : new Date(trade.dateOpened)
    const jsDay = tradeDate.getUTCDay()

    const pythonWeekday = jsDay === 0 ? 6 : jsDay - 1
    const day = dayNames[pythonWeekday]

    if (!dayData[day]) {
      dayData[day] = { count: 0, totalPl: 0 }
    }
    dayData[day].count++
    dayData[day].totalPl += trade.pl
  })

  return Object.entries(dayData).map(([day, data]) => ({
    day,
    count: data.count,
    avgPl: data.count > 0 ? data.totalPl / data.count : 0
  }))
}

function calculateStreakData(trades: Trade[]) {
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
  )

  const winStreaks: number[] = []
  const lossStreaks: number[] = []
  let currentStreak = 0
  let isWinStreak = false

  sortedTrades.forEach(trade => {
    const isWin = trade.pl > 0

    if (currentStreak === 0) {
      currentStreak = 1
      isWinStreak = isWin
    } else if ((isWinStreak && isWin) || (!isWinStreak && !isWin)) {
      currentStreak++
    } else {
      if (isWinStreak) {
        winStreaks.push(currentStreak)
      } else {
        lossStreaks.push(currentStreak)
      }
      currentStreak = 1
      isWinStreak = isWin
    }
  })

  if (currentStreak > 0) {
    if (isWinStreak) {
      winStreaks.push(currentStreak)
    } else {
      lossStreaks.push(currentStreak)
    }
  }

  const winDistribution: Record<number, number> = {}
  const lossDistribution: Record<number, number> = {}

  winStreaks.forEach(streak => {
    winDistribution[streak] = (winDistribution[streak] || 0) + 1
  })

  lossStreaks.forEach(streak => {
    lossDistribution[streak] = (lossDistribution[streak] || 0) + 1
  })

  return {
    winDistribution,
    lossDistribution,
    statistics: {
      maxWinStreak: Math.max(...winStreaks, 0),
      maxLossStreak: Math.max(...lossStreaks, 0),
      avgWinStreak: winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b) / winStreaks.length : 0,
      avgLossStreak: lossStreaks.length > 0 ? lossStreaks.reduce((a, b) => a + b) / lossStreaks.length : 0
    }
  }
}

function calculateMonthlyReturns(trades: Trade[]) {
  const monthlyData: Record<string, number> = {}

  trades.forEach(trade => {
    const date = new Date(trade.dateOpened)
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() + 1
    const monthKey = `${year}-${String(month).padStart(2, '0')}`

    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + trade.pl
  })

  const monthlyReturns: Record<number, Record<number, number>> = {}
  const years = new Set<number>()

  trades.forEach(trade => {
    years.add(new Date(trade.dateOpened).getUTCFullYear())
  })

  Array.from(years).sort().forEach(year => {
    monthlyReturns[year] = {}
    for (let month = 1; month <= 12; month++) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`
      monthlyReturns[year][month] = monthlyData[monthKey] || 0
    }
  })

  return monthlyReturns
}

function calculateRollingMetrics(trades: Trade[]) {
  const windowSize = 30
  const metrics: SnapshotChartData['rollingMetrics'] = []

  for (let i = windowSize - 1; i < trades.length; i++) {
    const windowTrades = trades.slice(i - windowSize + 1, i + 1)
    const wins = windowTrades.filter(t => t.pl > 0).length
    const winRate = wins / windowTrades.length

    const returns = windowTrades.map(t => t.pl)
    const avgReturn = returns.reduce((a, b) => a + b) / returns.length
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length
    const volatility = Math.sqrt(variance)

    const positiveReturns = returns.filter(r => r > 0).reduce((a, b) => a + b, 0)
    const negativeReturns = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0))
    const profitFactor = negativeReturns > 0 ? positiveReturns / negativeReturns : positiveReturns > 0 ? 999 : 0

    const sharpeRatio = volatility > 0 ? (avgReturn - 0) / volatility : 0

    metrics.push({
      date: new Date(windowTrades[windowTrades.length - 1].dateOpened).toISOString(),
      winRate: winRate * 100,
      sharpeRatio,
      profitFactor,
      volatility
    })
  }

  return metrics
}
