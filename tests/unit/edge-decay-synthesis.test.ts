import {
  synthesizeEdgeDecay,
} from '@tradeblocks/lib'
import type {
  Trade,
} from '@tradeblocks/lib'

// ---------------------------------------------------------------------------
// Test helper: create a Trade with sensible defaults
// ---------------------------------------------------------------------------

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    dateOpened: new Date('2024-01-15'),
    timeOpened: '09:30:00',
    openingPrice: 100,
    legs: 'SPX Put Spread',
    premium: 1.5,
    pl: 100,
    numContracts: 1,
    fundsAtClose: 100100,
    marginReq: 5000,
    strategy: 'Iron Condor',
    openingCommissionsFees: 1.5,
    closingCommissionsFees: 1.5,
    openingShortLongRatio: 1.0,
    ...overrides,
  }
}

/**
 * Generate N trades with controllable win rate on consecutive days.
 */
function generateTradeSet(
  count: number,
  options?: {
    winRate?: number
    avgPl?: number
    startDate?: Date
    strategy?: string
  },
): Trade[] {
  const winRate = options?.winRate ?? 0.7
  const avgWin = options?.avgPl ?? 200
  const avgLoss = -(Math.abs(options?.avgPl ?? 200) * 0.5)
  const startDate = options?.startDate ?? new Date(2024, 0, 1)
  const strategy = options?.strategy ?? 'Iron Condor'

  const trades: Trade[] = []
  let runningFunds = 100000

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)

    const isWin = i < Math.round(count * winRate)
    const pl = isWin ? avgWin : avgLoss
    runningFunds += pl

    trades.push(
      makeTrade({
        dateOpened: date,
        timeOpened: `09:${String(30 + (i % 30)).padStart(2, '0')}:00`,
        pl,
        fundsAtClose: runningFunds,
        strategy,
      }),
    )
  }

  return trades
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('synthesizeEdgeDecay', () => {
  test('1. Basic structure: returns summary, observations, signals, metadata', () => {
    const trades = generateTradeSet(60)
    const result = synthesizeEdgeDecay(trades, undefined)

    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('observations')
    expect(result).toHaveProperty('signals')
    expect(result).toHaveProperty('metadata')
  })

  test('2. All 5 signals present with available boolean', () => {
    const trades = generateTradeSet(60)
    const result = synthesizeEdgeDecay(trades, undefined)

    expect(result.signals).toHaveProperty('periodMetrics')
    expect(result.signals).toHaveProperty('rollingMetrics')
    expect(result.signals).toHaveProperty('regimeComparison')
    expect(result.signals).toHaveProperty('walkForward')
    expect(result.signals).toHaveProperty('liveAlignment')

    // Each signal has available boolean
    expect(typeof result.signals.periodMetrics.available).toBe('boolean')
    expect(typeof result.signals.rollingMetrics.available).toBe('boolean')
    expect(typeof result.signals.regimeComparison.available).toBe('boolean')
    expect(typeof result.signals.walkForward.available).toBe('boolean')
    expect(typeof result.signals.liveAlignment.available).toBe('boolean')
  })

  test('3. MC graceful skip on small block (< 30 trades)', () => {
    const trades = generateTradeSet(25)
    const result = synthesizeEdgeDecay(trades, undefined)

    // Should NOT throw
    expect(result.signals.regimeComparison.available).toBe(false)
    expect(result.signals.regimeComparison.reason).toBeDefined()
    expect(typeof result.signals.regimeComparison.reason).toBe('string')
  })

  test('4. Live alignment graceful skip when actualTrades is undefined', () => {
    const trades = generateTradeSet(60)
    const result = synthesizeEdgeDecay(trades, undefined)

    expect(result.signals.liveAlignment.available).toBe(false)
    expect(result.signals.liveAlignment.reason).toBe('no reporting log')
  })

  test('5. Rolling series excluded from output; recentVsHistorical, seasonalAverages, dataQuality included', () => {
    const trades = generateTradeSet(60)
    const result = synthesizeEdgeDecay(trades, undefined)

    const rollingDetail = result.signals.rollingMetrics.detail
    expect(rollingDetail).toBeDefined()
    expect(rollingDetail).not.toHaveProperty('series')
    expect(rollingDetail).toHaveProperty('recentVsHistorical')
    expect(rollingDetail).toHaveProperty('seasonalAverages')
    expect(rollingDetail).toHaveProperty('dataQuality')
  })

  test('6. Monthly truncation: at most 12 entries for > 12 months of data', () => {
    // Generate trades spanning > 12 months (450+ days)
    const trades = generateTradeSet(500, {
      startDate: new Date(2022, 0, 1),
    })
    const result = synthesizeEdgeDecay(trades, undefined)

    const periodDetail = result.signals.periodMetrics.detail
    expect(periodDetail).toBeDefined()
    expect(periodDetail!.monthly.length).toBeLessThanOrEqual(12)
    // Should be the most recent 12 months
    if (periodDetail!.monthly.length > 1) {
      const lastMonth = periodDetail!.monthly[periodDetail!.monthly.length - 1]
      const firstMonth = periodDetail!.monthly[0]
      expect(lastMonth.periodKey > firstMonth.periodKey).toBe(true)
    }
  })

  test('7. Factual observations are structured data objects', () => {
    const trades = generateTradeSet(60)
    const result = synthesizeEdgeDecay(trades, undefined)

    // Should have at least some observations
    expect(Array.isArray(result.observations)).toBe(true)

    for (const obs of result.observations) {
      expect(obs).toHaveProperty('signal')
      expect(obs).toHaveProperty('metric')
      expect(obs).toHaveProperty('current')
      expect(obs).toHaveProperty('comparison')
      expect(obs).toHaveProperty('delta')
      expect(obs).toHaveProperty('percentChange')

      expect(typeof obs.signal).toBe('string')
      expect(typeof obs.metric).toBe('string')
      expect(typeof obs.current).toBe('number')
      expect(typeof obs.comparison).toBe('number')
      expect(typeof obs.delta).toBe('number')
      // percentChange is number | null
      expect(obs.percentChange === null || typeof obs.percentChange === 'number').toBe(true)
    }
  })

  test('8. Observations are exhaustive (no threshold filtering) -- all metric comparisons included', () => {
    // Use 500 trades with explicit recentWindow=50 so there's a clear
    // recent vs historical split for rolling metrics
    const trades = generateTradeSet(500, {
      startDate: new Date(2022, 0, 1),
    })
    const result = synthesizeEdgeDecay(trades, undefined, { recentWindow: 50 })

    // Should have a substantial number of observations -- at least from rolling and MC
    // Rolling: 8 metrics in recentVsHistorical
    // MC: 4 metrics (always available for 500 trades)
    // That's at least 12 minimum. With WF and period trends, likely more.
    expect(result.observations.length).toBeGreaterThanOrEqual(12)

    // Verify all rolling recentVsHistorical metrics are present as observations
    const rollingObs = result.observations.filter((o) => o.signal === 'rollingMetrics')
    expect(rollingObs.length).toBeGreaterThanOrEqual(8) // all 8 metrics

    // Verify all MC comparison metrics present (500 trades always qualifies)
    expect(result.signals.regimeComparison.available).toBe(true)
    const mcObs = result.observations.filter((o) => o.signal === 'regimeComparison')
    expect(mcObs.length).toBe(4) // all 4 MC metrics
  })

  test('9. recentWindow option honored', () => {
    const trades = generateTradeSet(100)
    const result = synthesizeEdgeDecay(trades, undefined, { recentWindow: 50 })

    expect(result.metadata.recentWindow).toBe(50)
  })

  test('10. Default recentWindow auto-calculation', () => {
    const trades = generateTradeSet(500, {
      startDate: new Date(2022, 0, 1),
    })
    const result = synthesizeEdgeDecay(trades, undefined)

    // calculateDefaultRecentWindow(500): max(round(500*0.2), 200) = max(100, 200) = 200
    expect(result.metadata.recentWindow).toBe(200)
  })

  test('11. Summary contains key numbers', () => {
    const trades = generateTradeSet(60)
    const result = synthesizeEdgeDecay(trades, undefined)

    expect(result.summary).toHaveProperty('totalTrades')
    expect(result.summary).toHaveProperty('recentWindow')
    expect(result.summary).toHaveProperty('recentWinRate')
    expect(result.summary).toHaveProperty('historicalWinRate')
    expect(result.summary).toHaveProperty('recentProfitFactor')
    expect(result.summary).toHaveProperty('historicalProfitFactor')
    expect(result.summary).toHaveProperty('observationCount')

    expect(typeof result.summary.totalTrades).toBe('number')
    expect(typeof result.summary.recentWinRate).toBe('number')
    expect(typeof result.summary.historicalWinRate).toBe('number')
  })

  test('12a. topObservations contains only rate-type metrics (no dollar metrics)', () => {
    const trades = generateTradeSet(500, {
      startDate: new Date(2022, 0, 1),
    })
    const result = synthesizeEdgeDecay(trades, undefined, { recentWindow: 50 })

    // topObservations should only contain rate-type metrics
    for (const obs of result.summary.topObservations) {
      expect(obs.metricType).toBe('rate')
    }

    // Verify dollar metrics are NOT in topObservations
    const dollarMetrics = new Set(['avgWin', 'avgLoss', 'avgReturn', 'netPl'])
    for (const obs of result.summary.topObservations) {
      expect(dollarMetrics.has(obs.metric)).toBe(false)
    }
  })

  test('12b. Dollar-type observations exist in full observations array', () => {
    const trades = generateTradeSet(500, {
      startDate: new Date(2022, 0, 1),
    })
    const result = synthesizeEdgeDecay(trades, undefined, { recentWindow: 50 })

    // Dollar metrics should be present in the full observations array
    const dollarObs = result.observations.filter(o => o.metricType === 'dollar')
    expect(dollarObs.length).toBeGreaterThan(0)

    // Each dollar observation should have metricType 'dollar'
    for (const obs of dollarObs) {
      expect(obs.metricType).toBe('dollar')
    }

    // Rate observations should also be present
    const rateObs = result.observations.filter(o => o.metricType === 'rate')
    expect(rateObs.length).toBeGreaterThan(0)
  })

  test('12c. All observations have metricType field', () => {
    const trades = generateTradeSet(60)
    const result = synthesizeEdgeDecay(trades, undefined)

    for (const obs of result.observations) {
      expect(['dollar', 'rate']).toContain(obs.metricType)
    }
  })

  test('12. Metadata completeness', () => {
    const trades = generateTradeSet(60)
    const result = synthesizeEdgeDecay(trades, undefined)

    expect(result.metadata).toHaveProperty('totalTrades')
    expect(result.metadata).toHaveProperty('recentWindow')
    expect(result.metadata).toHaveProperty('signalsRun')
    expect(result.metadata).toHaveProperty('signalsSkipped')
    expect(result.metadata).toHaveProperty('dateRange')

    expect(result.metadata.totalTrades).toBe(60)
    expect(typeof result.metadata.signalsRun).toBe('number')
    expect(typeof result.metadata.signalsSkipped).toBe('number')
    expect(result.metadata.signalsRun + result.metadata.signalsSkipped).toBe(5)
    expect(result.metadata.dateRange).toHaveProperty('start')
    expect(result.metadata.dateRange).toHaveProperty('end')
  })
})
