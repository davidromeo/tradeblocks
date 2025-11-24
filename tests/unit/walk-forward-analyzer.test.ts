import { describe, expect, it } from '@jest/globals'
import { WalkForwardAnalyzer } from '@/lib/calculations/walk-forward-analyzer'
import { WalkForwardConfig } from '@/lib/models/walk-forward'
import { Trade } from '@/lib/models/trade'

const DAY_MS = 24 * 60 * 60 * 1000

function createTestTrades(
  pls: number[],
  startDate = '2024-01-02',
  intervalDays = 3,
  startingFunds = 50_000
): Trade[] {
  const trades: Trade[] = []
  let fundsAtClose = startingFunds

  pls.forEach((pl, index) => {
    const openDate = new Date(new Date(startDate).getTime() + index * intervalDays * DAY_MS)
    const closeDate = new Date(openDate.getTime() + DAY_MS)
    fundsAtClose += pl

    trades.push({
      dateOpened: openDate,
      timeOpened: '09:30:00',
      openingPrice: 100,
      legs: 'Test',
      premium: 100,
      closingPrice: 110,
      dateClosed: closeDate,
      timeClosed: '15:45:00',
      avgClosingCost: 110,
      reasonForClose: 'Test',
      pl,
      numContracts: 1,
      fundsAtClose,
      marginReq: 1_000,
      strategy: index % 2 === 0 ? 'Momentum' : 'Mean Reversion',
      openingCommissionsFees: 1,
      closingCommissionsFees: 1,
      openingShortLongRatio: 0,
      closingShortLongRatio: 0,
      openingVix: 18,
      closingVix: 18,
    })
  })

  return trades
}

describe('WalkForwardAnalyzer', () => {
  it('segments trades and optimizes parameters across rolling windows', async () => {
    const trades = createTestTrades(
      [500, -250, 650, -100, 300, -400, 700, 200, -150, 450, -200, 550],
      '2024-01-02',
      3,
      40_000
    )

    const config: WalkForwardConfig = {
      inSampleDays: 18,
      outOfSampleDays: 9,
      stepSizeDays: 9,
      optimizationTarget: 'netPl',
      parameterRanges: {
        kellyMultiplier: [0.5, 1.5, 0.5],
        maxDrawdownPct: [5, 15, 5],
        maxDailyLossPct: [2, 6, 2],
      },
      minInSampleTrades: 3,
      minOutOfSampleTrades: 2,
    }

    const analyzer = new WalkForwardAnalyzer()
    const result = await analyzer.analyze({ trades, config })

    expect(result.results.periods.length).toBeGreaterThan(0)
    expect(result.results.stats.totalParameterTests).toBeGreaterThan(0)

    const firstPeriod = result.results.periods[0]
    expect(firstPeriod.inSampleMetrics.totalTrades).toBeGreaterThan(0)
    expect(firstPeriod.outOfSampleMetrics.totalTrades).toBeGreaterThan(0)
    expect(firstPeriod.optimalParameters.kellyMultiplier).toBeGreaterThan(0)
  })

  it('respects drawdown limits when selecting optimal parameters', async () => {
    const trades = createTestTrades(
      [800, -2600, 900, -1800, 700, -2200, 600, -1900, 500, -2100],
      '2024-02-01',
      2,
      10_000
    )

    const config: WalkForwardConfig = {
      inSampleDays: 12,
      outOfSampleDays: 6,
      stepSizeDays: 6,
      optimizationTarget: 'netPl',
      parameterRanges: {
        kellyMultiplier: [0.5, 1.0, 0.5],
        maxDrawdownPct: [10, 25, 15],
        maxDailyLossPct: [10, 20, 10],
      },
      minInSampleTrades: 3,
      minOutOfSampleTrades: 2,
    }

    const analyzer = new WalkForwardAnalyzer()
    const result = await analyzer.analyze({ trades, config })

    expect(result.results.periods.length).toBeGreaterThan(0)

    result.results.periods.forEach((period) => {
      const threshold = period.optimalParameters.maxDrawdownPct
      if (typeof threshold === 'number') {
        expect(period.inSampleMetrics.maxDrawdown).toBeLessThanOrEqual(threshold + 1e-6)
      }
    })
  })

  it('supports cancellation via AbortController', async () => {
    const trades = createTestTrades(
      Array.from({ length: 30 }, (_, idx) => (idx % 2 === 0 ? 400 : -350)),
      '2024-03-01',
      1,
      25_000
    )

    const config: WalkForwardConfig = {
      inSampleDays: 10,
      outOfSampleDays: 5,
      stepSizeDays: 3,
      optimizationTarget: 'netPl',
      parameterRanges: {
        kellyMultiplier: [0.5, 1.5, 0.25],
        fixedFractionPct: [2, 6, 1],
        maxDrawdownPct: [5, 15, 5],
      },
      minInSampleTrades: 5,
      minOutOfSampleTrades: 3,
    }

    const analyzer = new WalkForwardAnalyzer()
    const controller = new AbortController()
    controller.abort()

    await expect(
      analyzer.analyze({ trades, config, signal: controller.signal })
    ).rejects.toThrow('Walk-forward analysis aborted')
  })
})
