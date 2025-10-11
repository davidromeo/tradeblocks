import { describe, it, expect } from '@jest/globals'

import { processChartData, buildPerformanceSnapshot } from '../../lib/services/performance-snapshot'
import { calculateInitialCapital } from '../../lib/processing/capital-calculator'
import { mockTrades } from '../data/mock-trades'
import { mockDailyLogs } from '../data/mock-daily-logs'

describe('performance-store chart data', () => {
  it('uses daily logs to drive drawdown when available', async () => {
    const result = await processChartData(mockTrades, mockDailyLogs)

    const expectedMaxDrawdown = Math.max(
      ...mockDailyLogs.map(log => Math.abs(log.drawdownPct ?? 0))
    )

    const chartMaxDrawdown = Math.min(...result.drawdownData.map(point => point.drawdownPct))

    expect(Math.abs(chartMaxDrawdown)).toBeCloseTo(expectedMaxDrawdown, 3)

    const lastEquityPoint = result.equityCurve[result.equityCurve.length - 1]
    const lastDailyLog = mockDailyLogs[mockDailyLogs.length - 1]

    expect(lastEquityPoint.equity).toBe(lastDailyLog.netLiquidity)
  })

  it('falls back to trade-based equity when daily logs are missing', async () => {
    const result = await processChartData(mockTrades)

    const expectedInitialCapital = calculateInitialCapital(mockTrades)
    const firstPoint = result.equityCurve[0]

    expect(firstPoint.equity).toBe(expectedInitialCapital)
    expect(firstPoint.highWaterMark).toBe(expectedInitialCapital)

    const closedTrades = mockTrades
      .filter(trade => trade.dateClosed)
      .sort((a, b) =>
        new Date(a.dateClosed ?? a.dateOpened).getTime() -
        new Date(b.dateClosed ?? b.dateOpened).getTime()
      )

    if (closedTrades.length > 0) {
      const lastClosedTrade = closedTrades[closedTrades.length - 1]
      const lastPoint = result.equityCurve[result.equityCurve.length - 1]

      expect(lastPoint.equity).toBe(lastClosedTrade.fundsAtClose)

      let peak = expectedInitialCapital
      let maxDrawdown = 0
      let equity = expectedInitialCapital

      closedTrades.forEach(trade => {
        const nextEquity = typeof trade.fundsAtClose === 'number'
          ? trade.fundsAtClose
          : equity + trade.pl

        peak = Math.max(peak, nextEquity)
        if (peak > 0) {
          const drawdown = (peak - nextEquity) / peak * 100
          maxDrawdown = Math.max(maxDrawdown, drawdown)
        }

        equity = nextEquity
      })

      const chartMaxDrawdown = Math.abs(Math.min(...result.drawdownData.map(point => point.drawdownPct)))
      expect(chartMaxDrawdown).toBeCloseTo(maxDrawdown, 6)
    }
  })

  it('builds snapshots that respect strategy filters', async () => {
    const unfiltered = await buildPerformanceSnapshot({ trades: mockTrades, dailyLogs: mockDailyLogs })
    const snapshot = await buildPerformanceSnapshot({
      trades: mockTrades,
      dailyLogs: mockDailyLogs,
      filters: { strategies: ['Long Call'] },
      riskFreeRate: 2
    })

    expect(snapshot.filteredTrades.every(trade => (trade.strategy || 'Unknown') === 'Long Call')).toBe(true)
    expect(snapshot.portfolioStats.totalTrades).toBeLessThan(unfiltered.portfolioStats.totalTrades)
  })
})
