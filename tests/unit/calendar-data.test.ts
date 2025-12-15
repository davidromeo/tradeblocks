/**
 * Unit tests for Trading Calendar data service
 */

import {
  scaleBacktestPl,
  getActualPlPerContract,
  getBacktestPlPerContract,
  scaleTradeValues,
  aggregateTradesByStrategy,
  scaleStrategyComparison,
  formatCurrency,
  formatPercent,
  getPlColorClass,
  getPlBackgroundClass,
  calculateMaxAbsPl,
  getMonthGridDates,
  getWeekGridDates,
  groupDatesByWeek,
  StrategyDayComparison,
} from '@/lib/services/calendar-data'
import { Trade } from '@/lib/models/trade'
import { ReportingTrade } from '@/lib/models/reporting-trade'
import { CalendarDayData, StrategyMatch } from '@/lib/stores/trading-calendar-store'

// Helper to create a backtest trade (Trade from tradelog.csv)
function createBacktestTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    dateOpened: new Date('2025-01-15'),
    timeOpened: '09:30:00',
    openingPrice: 100,
    legs: 'SPY 0DTE',
    premium: 500,
    pl: 200,
    numContracts: 1,
    fundsAtClose: 100000,
    marginReq: 5000,
    strategy: 'Test Strategy',
    openingCommissionsFees: 5,
    closingCommissionsFees: 5,
    openingShortLongRatio: 0,
    ...overrides,
  }
}

// Helper to create an actual trade (ReportingTrade from strategylog.csv)
function createActualTrade(overrides: Partial<ReportingTrade> = {}): ReportingTrade {
  return {
    strategy: 'Test Strategy',
    dateOpened: new Date('2025-01-15T09:30:00'),
    openingPrice: 100,
    legs: 'SPY 0DTE',
    initialPremium: 500,
    numContracts: 1,
    pl: 180,
    ...overrides,
  }
}

// Helper to create calendar day data
function createDayData(overrides: Partial<CalendarDayData> = {}): CalendarDayData {
  return {
    date: '2025-01-15',
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
    totalMargin: 0,
    ...overrides,
  }
}

describe('Calendar Data Service', () => {
  describe('scaleBacktestPl', () => {
    it('should scale P&L to target contract count', () => {
      const trade = createBacktestTrade({ pl: 300, numContracts: 3 })
      expect(scaleBacktestPl(trade, 1)).toBe(100) // 300/3 * 1 = 100
      expect(scaleBacktestPl(trade, 6)).toBe(600) // 300/3 * 6 = 600
      expect(scaleBacktestPl(trade, 10)).toBe(1000) // 300/3 * 10 = 1000
    })

    it('should handle zero contracts', () => {
      const trade = createBacktestTrade({ pl: 300, numContracts: 0 })
      expect(scaleBacktestPl(trade, 5)).toBe(0)
    })

    it('should handle negative P&L', () => {
      const trade = createBacktestTrade({ pl: -300, numContracts: 3 })
      expect(scaleBacktestPl(trade, 1)).toBe(-100)
      expect(scaleBacktestPl(trade, 6)).toBe(-600)
    })
  })

  describe('getActualPlPerContract', () => {
    it('should calculate P&L per contract (no commissions in ReportingTrade)', () => {
      const trade = createActualTrade({
        pl: 200,
        numContracts: 2,
      })
      // Simple P/L division - ReportingTrade doesn't have commissions
      expect(getActualPlPerContract(trade)).toBe(100)
    })

    it('should handle zero contracts', () => {
      const trade = createActualTrade({ numContracts: 0 })
      expect(getActualPlPerContract(trade)).toBe(0)
    })
  })

  describe('getBacktestPlPerContract', () => {
    it('should calculate P&L per contract accounting for commissions', () => {
      const trade = createBacktestTrade({
        pl: 310,
        numContracts: 3,
        openingCommissionsFees: 5,
        closingCommissionsFees: 5,
      })
      // Net P/L = 310 - 10 = 300, per contract = 100
      expect(getBacktestPlPerContract(trade)).toBe(100)
    })

    it('should handle zero contracts', () => {
      const trade = createBacktestTrade({ numContracts: 0 })
      expect(getBacktestPlPerContract(trade)).toBe(0)
    })

    it('should handle undefined commissions', () => {
      const trade = createBacktestTrade({
        pl: 300,
        numContracts: 3,
        openingCommissionsFees: undefined,
        closingCommissionsFees: undefined,
      })
      expect(getBacktestPlPerContract(trade)).toBe(100)
    })
  })

  describe('scaleTradeValues', () => {
    describe('raw mode', () => {
      it('should return raw values without scaling', () => {
        const btTrade = createBacktestTrade({ pl: 300, numContracts: 3 })
        const actualTrade = createActualTrade({ pl: 800, numContracts: 8 })

        const result = scaleTradeValues(btTrade, actualTrade, 'raw')

        expect(result.backtest?.pl).toBe(300)
        expect(result.backtest?.contracts).toBe(3)
        expect(result.actual?.pl).toBe(800)
        expect(result.actual?.contracts).toBe(8)
        expect(result.slippage).toBeNull() // Not meaningful in raw mode
      })

      it('should handle null backtest trade', () => {
        const actualTrade = createActualTrade({ pl: 800, numContracts: 8 })
        const result = scaleTradeValues(null, actualTrade, 'raw')

        expect(result.backtest).toBeNull()
        expect(result.actual?.pl).toBe(800)
      })

      it('should handle null actual trade', () => {
        const btTrade = createBacktestTrade({ pl: 300, numContracts: 3 })
        const result = scaleTradeValues(btTrade, null, 'raw')

        expect(result.backtest?.pl).toBe(300)
        expect(result.actual).toBeNull()
      })
    })

    describe('perContract mode', () => {
      it('should normalize values to 1 contract', () => {
        // Trade (backtest) uses 'premium', ReportingTrade (actual) uses 'initialPremium'
        const btTrade = createBacktestTrade({
          pl: 310, // 300 net after 10 commission
          numContracts: 3,
          premium: 600,
          openingCommissionsFees: 5,
          closingCommissionsFees: 5,
        })
        const actualTrade = createActualTrade({
          pl: 800,
          numContracts: 8,
          initialPremium: 800,
        })

        const result = scaleTradeValues(btTrade, actualTrade, 'perContract')

        // Backtest: (310-10)/3 = 100 per contract (net of commissions)
        expect(result.backtest?.pl).toBe(100)
        expect(result.backtest?.contracts).toBe(1)
        expect(result.backtest?.premium).toBe(200) // 600/3

        // Actual: 800/8 = 100 per contract (no commissions in ReportingTrade)
        expect(result.actual?.pl).toBe(100)
        expect(result.actual?.contracts).toBe(1)
        expect(result.actual?.premium).toBe(100) // 800/8

        // Slippage: actual - backtest = 100 - 100 = 0
        expect(result.slippage).toBe(0)
      })

      it('should calculate slippage per contract', () => {
        const btTrade = createBacktestTrade({
          pl: 300,
          numContracts: 3,
          openingCommissionsFees: 0,
          closingCommissionsFees: 0,
        })
        const actualTrade = createActualTrade({
          pl: 240,
          numContracts: 3,
        })

        const result = scaleTradeValues(btTrade, actualTrade, 'perContract')

        // BT per contract: 100, Actual per contract: 80
        expect(result.backtest?.pl).toBe(100)
        expect(result.actual?.pl).toBe(80)
        expect(result.slippage).toBe(-20) // 80 - 100 = -20 (worse)
      })
    })

    describe('toReported mode', () => {
      it('should scale backtest DOWN to match actual (reported) contract count', () => {
        // Real-world: backtest (Trade) has large contracts, actual (ReportingTrade) has small contracts
        const btTrade = createBacktestTrade({
          pl: 1000,
          numContracts: 10,
          premium: 5000,
          openingCommissionsFees: 0,
          closingCommissionsFees: 0,
        })
        const actualTrade = createActualTrade({
          pl: 75,
          numContracts: 1,
          initialPremium: 500,
        })

        const result = scaleTradeValues(btTrade, actualTrade, 'toReported')

        // Scale BT DOWN to 1 contract: 1000 * (1/10) = 100
        expect(result.backtest?.pl).toBe(100)
        expect(result.backtest?.contracts).toBe(1)
        expect(result.backtest?.premium).toBe(500) // 5000 * (1/10)

        // Actual unchanged
        expect(result.actual?.pl).toBe(75)
        expect(result.actual?.contracts).toBe(1)

        // Slippage: actual - scaled backtest = 75 - 100 = -25 (worse)
        expect(result.slippage).toBe(-25)
      })

      it('should handle missing actual trade', () => {
        const btTrade = createBacktestTrade({ pl: 100, numContracts: 1 })
        const result = scaleTradeValues(btTrade, null, 'toReported')

        expect(result.backtest?.pl).toBe(100)
        expect(result.actual).toBeNull()
        expect(result.slippage).toBeNull()
      })

      it('should handle missing backtest trade', () => {
        const actualTrade = createActualTrade({ pl: 750, numContracts: 10 })
        const result = scaleTradeValues(null, actualTrade, 'toReported')

        expect(result.backtest).toBeNull()
        expect(result.actual?.pl).toBe(750)
        expect(result.slippage).toBeNull()
      })
    })
  })

  describe('aggregateTradesByStrategy', () => {
    it('should aggregate backtest trades by strategy', () => {
      const dayData = createDayData({
        date: '2025-01-15',
        backtestTrades: [
          createBacktestTrade({ strategy: 'Strategy A', pl: 100 }),
          createBacktestTrade({ strategy: 'Strategy A', pl: 150 }),
          createBacktestTrade({ strategy: 'Strategy B', pl: 200 }),
        ],
        hasBacktest: true,
        backtestTradeCount: 3,
      })

      const result = aggregateTradesByStrategy(dayData, [])

      expect(result).toHaveLength(2)

      const stratA = result.find(r => r.strategy === 'Strategy A')
      expect(stratA?.backtest?.totalPl).toBe(250) // 100 + 150
      expect(stratA?.backtest?.tradeCount).toBe(2)

      const stratB = result.find(r => r.strategy === 'Strategy B')
      expect(stratB?.backtest?.totalPl).toBe(200)
      expect(stratB?.backtest?.tradeCount).toBe(1)
    })

    it('should match backtest and actual by strategy mapping', () => {
      const dayData = createDayData({
        date: '2025-01-15',
        backtestTrades: [
          createBacktestTrade({ strategy: 'BT Strategy', pl: 100 }),
        ],
        actualTrades: [
          createActualTrade({ strategy: 'Live Strategy', pl: 90 }),
        ],
        hasBacktest: true,
        hasActual: true,
      })

      const matches: StrategyMatch[] = [{
        backtestStrategy: 'BT Strategy',
        actualStrategy: 'Live Strategy',
        isAutoMatched: false,
      }]

      const result = aggregateTradesByStrategy(dayData, matches)

      expect(result).toHaveLength(1)
      expect(result[0].strategy).toBe('BT Strategy')
      expect(result[0].isMatched).toBe(true)
      expect(result[0].backtest?.totalPl).toBe(100)
      expect(result[0].actual?.totalPl).toBe(90)
      expect(result[0].scaled.slippage).toBe(-10)
    })

    it('should include unmatched actual strategies separately', () => {
      const dayData = createDayData({
        date: '2025-01-15',
        backtestTrades: [
          createBacktestTrade({ strategy: 'Strategy A', pl: 100 }),
        ],
        actualTrades: [
          createActualTrade({ strategy: 'Strategy B', pl: 200 }),
        ],
        hasBacktest: true,
        hasActual: true,
      })

      const result = aggregateTradesByStrategy(dayData, [])

      expect(result).toHaveLength(2)

      const stratA = result.find(r => r.strategy === 'Strategy A')
      expect(stratA?.backtest?.totalPl).toBe(100)
      expect(stratA?.actual).toBeNull()
      expect(stratA?.isMatched).toBe(false)

      const stratB = result.find(r => r.strategy === 'Strategy B')
      expect(stratB?.backtest).toBeNull()
      expect(stratB?.actual?.totalPl).toBe(200)
      expect(stratB?.isMatched).toBe(false)
    })

    it('should sort results by strategy name', () => {
      const dayData = createDayData({
        backtestTrades: [
          createBacktestTrade({ strategy: 'Zebra' }),
          createBacktestTrade({ strategy: 'Alpha' }),
          createBacktestTrade({ strategy: 'Middle' }),
        ],
        hasBacktest: true,
      })

      const result = aggregateTradesByStrategy(dayData, [])

      expect(result.map(r => r.strategy)).toEqual(['Alpha', 'Middle', 'Zebra'])
    })
  })

  describe('scaleStrategyComparison', () => {
    const createComparison = (): StrategyDayComparison => ({
      strategy: 'Test',
      date: '2025-01-15',
      backtest: {
        trades: [],
        totalPl: 300,
        totalPremium: 600,
        totalContracts: 3,
        tradeCount: 1,
      },
      actual: {
        trades: [],
        totalPl: 750,
        totalPremium: 5000,
        totalContracts: 10,
        tradeCount: 1,
        totalCommissions: 50,
      },
      isMatched: true,
      scaled: {
        backtestPl: 300,
        actualPl: 750,
        slippage: 450,
        slippagePercent: 150,
      },
    })

    it('should return unchanged for raw mode', () => {
      const comparison = createComparison()
      const result = scaleStrategyComparison(comparison, 'raw')

      expect(result.scaled.backtestPl).toBe(300)
      expect(result.scaled.actualPl).toBe(750)
    })

    it('should normalize to per-contract in perContract mode', () => {
      const comparison = createComparison()
      const result = scaleStrategyComparison(comparison, 'perContract')

      // BT: 300/3 = 100 per contract
      expect(result.scaled.backtestPl).toBe(100)
      // Actual: 750/10 = 75 per contract
      expect(result.scaled.actualPl).toBe(75)
      // Slippage: 75 - 100 = -25
      expect(result.scaled.slippage).toBe(-25)
      // Slippage %: -25 / 100 * 100 = -25%
      expect(result.scaled.slippagePercent).toBe(-25)
    })

    it('should scale backtest to reported in toReported mode', () => {
      const comparison = createComparison()
      const result = scaleStrategyComparison(comparison, 'toReported')

      // BT scaled: 300 * (10/3) = 1000
      expect(result.scaled.backtestPl).toBe(1000)
      // Actual unchanged
      expect(result.scaled.actualPl).toBe(750)
      // Slippage: 750 - 1000 = -250
      expect(result.scaled.slippage).toBe(-250)
    })

    it('should handle missing backtest in toReported mode', () => {
      const comparison: StrategyDayComparison = {
        strategy: 'Test',
        date: '2025-01-15',
        backtest: null,
        actual: {
          trades: [],
          totalPl: 750,
          totalPremium: 5000,
          totalContracts: 10,
          tradeCount: 1,
          totalCommissions: 50,
        },
        isMatched: false,
        scaled: {
          backtestPl: null,
          actualPl: 750,
          slippage: null,
          slippagePercent: null,
        },
      }
      const result = scaleStrategyComparison(comparison, 'toReported')

      // Returns unchanged when backtest is missing
      expect(result.scaled.backtestPl).toBeNull()
      expect(result.scaled.actualPl).toBe(750)
    })
  })

  describe('formatCurrency', () => {
    it('should format positive values', () => {
      expect(formatCurrency(1234)).toBe('$1,234')
      expect(formatCurrency(0)).toBe('$0')
    })

    it('should format negative values', () => {
      expect(formatCurrency(-1234)).toBe('-$1,234')
    })

    it('should format compact values', () => {
      expect(formatCurrency(1500, true)).toBe('$1.5K')
      expect(formatCurrency(1500000, true)).toBe('$1.50M')
      expect(formatCurrency(-2500, true)).toBe('-$2.5K')
    })

    it('should not compact small values', () => {
      expect(formatCurrency(500, true)).toBe('$500')
    })
  })

  describe('formatPercent', () => {
    it('should format positive percentages with plus sign', () => {
      expect(formatPercent(10.5)).toBe('+10.5%')
      expect(formatPercent(0)).toBe('+0.0%')
    })

    it('should format negative percentages', () => {
      expect(formatPercent(-10.5)).toBe('-10.5%')
    })
  })

  describe('getPlColorClass', () => {
    it('should return green for positive', () => {
      expect(getPlColorClass(100)).toBe('text-green-500')
    })

    it('should return red for negative', () => {
      expect(getPlColorClass(-100)).toBe('text-red-500')
    })

    it('should return muted for zero', () => {
      expect(getPlColorClass(0)).toBe('text-muted-foreground')
    })
  })

  describe('getPlBackgroundClass', () => {
    it('should return empty for zero P/L', () => {
      expect(getPlBackgroundClass(0, 1000)).toBe('')
    })

    it('should return empty for zero maxAbsPl', () => {
      expect(getPlBackgroundClass(100, 0)).toBe('')
    })

    it('should return high intensity green for large positive', () => {
      expect(getPlBackgroundClass(900, 1000)).toBe('bg-green-900/40')
    })

    it('should return medium intensity green for medium positive', () => {
      expect(getPlBackgroundClass(500, 1000)).toBe('bg-green-900/25')
    })

    it('should return low intensity green for small positive', () => {
      expect(getPlBackgroundClass(200, 1000)).toBe('bg-green-900/15')
    })

    it('should return high intensity red for large negative', () => {
      expect(getPlBackgroundClass(-900, 1000)).toBe('bg-red-900/40')
    })

    it('should return medium intensity red for medium negative', () => {
      expect(getPlBackgroundClass(-500, 1000)).toBe('bg-red-900/25')
    })

    it('should return low intensity red for small negative', () => {
      expect(getPlBackgroundClass(-200, 1000)).toBe('bg-red-900/15')
    })
  })

  describe('calculateMaxAbsPl', () => {
    it('should find max absolute P/L across days', () => {
      const days = new Map<string, CalendarDayData>([
        ['2025-01-01', createDayData({ backtestPl: 100, hasBacktest: true })],
        ['2025-01-02', createDayData({ actualPl: -500, hasActual: true })],
        ['2025-01-03', createDayData({ backtestPl: 300, hasBacktest: true })],
      ])

      expect(calculateMaxAbsPl(days)).toBe(500)
    })

    it('should prefer actual P/L when both exist', () => {
      const days = new Map<string, CalendarDayData>([
        ['2025-01-01', createDayData({
          backtestPl: 1000,
          actualPl: 200,
          hasBacktest: true,
          hasActual: true,
        })],
      ])

      expect(calculateMaxAbsPl(days)).toBe(200)
    })

    it('should return 0 for empty map', () => {
      const days = new Map<string, CalendarDayData>()
      expect(calculateMaxAbsPl(days)).toBe(0)
    })
  })

  describe('getMonthGridDates', () => {
    it('should return full weeks for the month', () => {
      // January 2025 starts on Wednesday, ends on Friday
      const dates = getMonthGridDates(2025, 0)

      // Should start on Sunday Dec 29, 2024
      expect(dates[0].getDate()).toBe(29)
      expect(dates[0].getMonth()).toBe(11) // December

      // Should end on Saturday Feb 1, 2025
      const lastDate = dates[dates.length - 1]
      expect(lastDate.getDate()).toBe(1)
      expect(lastDate.getMonth()).toBe(1) // February

      // Should be 5 weeks = 35 days
      expect(dates.length).toBe(35)
    })

    it('should handle months starting on Sunday', () => {
      // June 2025 starts on Sunday
      const dates = getMonthGridDates(2025, 5)

      expect(dates[0].getDate()).toBe(1)
      expect(dates[0].getMonth()).toBe(5) // June
    })
  })

  describe('getWeekGridDates', () => {
    it('should return 7 days starting from Sunday', () => {
      const date = new Date('2025-01-15') // Wednesday
      const dates = getWeekGridDates(date)

      expect(dates.length).toBe(7)
      // Should start on Sunday Jan 12
      expect(dates[0].getDate()).toBe(12)
      expect(dates[0].getDay()).toBe(0) // Sunday
      // Should end on Saturday Jan 18
      expect(dates[6].getDate()).toBe(18)
      expect(dates[6].getDay()).toBe(6) // Saturday
    })

    it('should handle date on Sunday', () => {
      // Use explicit local date to avoid timezone issues
      const date = new Date(2025, 0, 12) // Sunday Jan 12
      const dates = getWeekGridDates(date)

      expect(dates[0].getDay()).toBe(0) // First day is Sunday
      expect(dates[6].getDay()).toBe(6) // Last day is Saturday
      expect(dates.length).toBe(7)
    })

    it('should handle date on Saturday', () => {
      // Use explicit local date to avoid timezone issues
      const date = new Date(2025, 0, 18) // Saturday Jan 18
      const dates = getWeekGridDates(date)

      expect(dates[0].getDay()).toBe(0) // First day is Sunday
      expect(dates[6].getDay()).toBe(6) // Last day is Saturday
      expect(dates.length).toBe(7)
    })
  })

  describe('groupDatesByWeek', () => {
    it('should group dates by ISO week number', () => {
      // Use explicit local dates to avoid timezone issues
      const dates = [
        new Date(2025, 0, 6), // Monday, Week 2
        new Date(2025, 0, 7), // Tuesday, Week 2
        new Date(2025, 0, 13), // Monday, Week 3
        new Date(2025, 0, 14), // Tuesday, Week 3
        new Date(2025, 0, 15), // Wednesday, Week 3
      ]

      const grouped = groupDatesByWeek(dates)

      // Should have 2 distinct weeks
      expect(grouped.size).toBe(2)

      // Each group should have correct count
      const weekCounts = Array.from(grouped.values()).map(v => v.length).sort()
      expect(weekCounts).toEqual([2, 3])
    })
  })
})
