/**
 * Unit tests for daily exposure calculation using sweep-line algorithm.
 *
 * Tests verify:
 * - Basic exposure calculation with single and multiple trades
 * - Overlapping positions (concurrent margin accumulation)
 * - Percentage exposure calculation with equity curve
 * - Peak exposure tracking (by dollars and percentage)
 * - Edge cases (empty input, no margin, invalid dates, open positions)
 */

import {
  calculateDailyExposure,
  DailyExposurePoint,
  EquityCurvePoint,
} from '@/lib/calculations/daily-exposure'
import { Trade } from '@/lib/models/trade'

// Helper to create a date at noon Eastern Time (avoids timezone boundary issues)
// The algorithm converts to UTC via toISOString(), so we need dates that won't shift
// Noon ET = 17:00 UTC (EST) or 16:00 UTC (EDT), both safely in the same calendar day
function etDate(dateStr: string): Date {
  // Parse as noon Eastern by using a time that's definitely during the target date in ET
  return new Date(dateStr + 'T17:00:00.000Z') // 12:00 PM EST (worst case)
}

// Helper to create a minimal valid trade
function createTrade(overrides: Partial<Trade>): Trade {
  return {
    dateOpened: etDate('2024-01-01'),
    timeOpened: '09:30:00',
    openingPrice: 100,
    legs: 'SPY 450 C',
    premium: 1.0,
    pl: 100,
    numContracts: 1,
    fundsAtClose: 10100,
    marginReq: 1000,
    strategy: 'TestStrategy',
    openingCommissionsFees: 1,
    closingCommissionsFees: 1,
    openingShortLongRatio: 1,
    dateClosed: etDate('2024-01-02'),
    timeClosed: '15:00:00',
    closingPrice: 101,
    ...overrides,
  }
}

// Helper to create equity curve point
function createEquityPoint(date: string, equity: number): EquityCurvePoint {
  return { date, equity }
}

// Helper to extract date string from ISO format
function dateKey(isoString: string): string {
  return isoString.slice(0, 10)
}

describe('calculateDailyExposure', () => {
  describe('basic functionality', () => {
    it('should return empty result for empty trades array', () => {
      const result = calculateDailyExposure([], [])

      expect(result.dailyExposure).toEqual([])
      expect(result.peakDailyExposure).toBeNull()
      expect(result.peakDailyExposurePercent).toBeNull()
    })

    it('should calculate exposure for single trade spanning multiple days', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-03'),
          marginReq: 1000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      // Should have exposure for 01-01, 01-02, 01-03 (close day still open)
      expect(result.dailyExposure.length).toBe(3)

      // All days should show $1000 exposure, 1 position
      result.dailyExposure.forEach(point => {
        expect(point.exposure).toBe(1000)
        expect(point.openPositions).toBe(1)
      })
    })

    it('should accumulate exposure for overlapping trades', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-03'),
          marginReq: 1000,
        }),
        createTrade({
          dateOpened: etDate('2024-01-02'),
          dateClosed: etDate('2024-01-04'),
          marginReq: 2000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      // Find exposure by date
      const exposureByDate = new Map<string, DailyExposurePoint>()
      result.dailyExposure.forEach(p => exposureByDate.set(dateKey(p.date), p))

      // 01-01: Trade 1 open (1000)
      expect(exposureByDate.get('2024-01-01')?.exposure).toBe(1000)
      expect(exposureByDate.get('2024-01-01')?.openPositions).toBe(1)

      // 01-02: Trade 1 + Trade 2 (1000 + 2000 = 3000)
      expect(exposureByDate.get('2024-01-02')?.exposure).toBe(3000)
      expect(exposureByDate.get('2024-01-02')?.openPositions).toBe(2)

      // 01-03: Trade 1 closes at end, Trade 2 still open (1000 + 2000 = 3000)
      // Note: close day still shows position as open
      expect(exposureByDate.get('2024-01-03')?.exposure).toBe(3000)
      expect(exposureByDate.get('2024-01-03')?.openPositions).toBe(2)

      // 01-04: Trade 1 closed (removed day after), Trade 2 closes at end (2000)
      expect(exposureByDate.get('2024-01-04')?.exposure).toBe(2000)
      expect(exposureByDate.get('2024-01-04')?.openPositions).toBe(1)
    })

    it('should handle trade opening and closing on same day', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-01'),
          marginReq: 1000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      // Should have exactly one day of exposure
      expect(result.dailyExposure.length).toBe(1)
      expect(dateKey(result.dailyExposure[0].date)).toBe('2024-01-01')
      expect(result.dailyExposure[0].exposure).toBe(1000)
      expect(result.dailyExposure[0].openPositions).toBe(1)
    })
  })

  describe('percentage exposure calculation', () => {
    it('should calculate exposurePercent using equity curve', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-02'),
          marginReq: 1000,
        }),
      ]

      const equityCurve = [
        createEquityPoint('2024-01-01T00:00:00.000Z', 10000),
        createEquityPoint('2024-01-02T00:00:00.000Z', 10100),
      ]

      const result = calculateDailyExposure(trades, equityCurve)

      // Find exposure by date
      const exposureByDate = new Map<string, DailyExposurePoint>()
      result.dailyExposure.forEach(p => exposureByDate.set(dateKey(p.date), p))

      // 01-01: 1000 / 10000 = 10%
      expect(exposureByDate.get('2024-01-01')?.exposurePercent).toBeCloseTo(10, 5)

      // 01-02: 1000 / 10100 ≈ 9.9%
      expect(exposureByDate.get('2024-01-02')?.exposurePercent).toBeCloseTo(9.9, 1)
    })

    it('should use last known equity for dates without equity data', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-05'),
          marginReq: 1000,
        }),
      ]

      // Only have equity for 01-01 and 01-03
      const equityCurve = [
        createEquityPoint('2024-01-01T00:00:00.000Z', 10000),
        createEquityPoint('2024-01-03T00:00:00.000Z', 11000),
      ]

      const result = calculateDailyExposure(trades, equityCurve)

      const exposureByDate = new Map<string, DailyExposurePoint>()
      result.dailyExposure.forEach(p => exposureByDate.set(dateKey(p.date), p))

      // 01-01: has equity data (10000) → 10%
      expect(exposureByDate.get('2024-01-01')?.exposurePercent).toBeCloseTo(10, 5)

      // 01-02: no equity data, use last known (10000) → 10%
      expect(exposureByDate.get('2024-01-02')?.exposurePercent).toBeCloseTo(10, 5)

      // 01-03: has equity data (11000) → ~9.09%
      expect(exposureByDate.get('2024-01-03')?.exposurePercent).toBeCloseTo(9.09, 1)

      // 01-04: no equity data, use last known (11000) → ~9.09%
      expect(exposureByDate.get('2024-01-04')?.exposurePercent).toBeCloseTo(9.09, 1)
    })

    it('should return 0% when equity is zero or not available', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-02'),
          marginReq: 1000,
        }),
      ]

      // No equity curve provided
      const result = calculateDailyExposure(trades, [])

      result.dailyExposure.forEach(point => {
        expect(point.exposurePercent).toBe(0)
      })
    })
  })

  describe('peak exposure tracking', () => {
    it('should track peak exposure by dollar amount', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-05'),
          marginReq: 1000,
        }),
        createTrade({
          dateOpened: etDate('2024-01-02'),
          dateClosed: etDate('2024-01-03'),
          marginReq: 2000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      // Peak should be on 01-02 or 01-03 when both trades overlap (3000)
      expect(result.peakDailyExposure).not.toBeNull()
      expect(result.peakDailyExposure?.exposure).toBe(3000)
      expect(['2024-01-02', '2024-01-03']).toContain(
        dateKey(result.peakDailyExposure!.date)
      )
    })

    it('should track peak exposure by percentage', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-03'),
          marginReq: 1000,
        }),
      ]

      // Equity decreases over time, so percentage increases
      const equityCurve = [
        createEquityPoint('2024-01-01T00:00:00.000Z', 10000), // 10%
        createEquityPoint('2024-01-02T00:00:00.000Z', 5000), // 20%
        createEquityPoint('2024-01-03T00:00:00.000Z', 8000), // 12.5%
      ]

      const result = calculateDailyExposure(trades, equityCurve)

      // Peak percentage should be on 01-02 (20%)
      expect(result.peakDailyExposurePercent).not.toBeNull()
      expect(result.peakDailyExposurePercent?.exposurePercent).toBeCloseTo(20, 5)
      expect(dateKey(result.peakDailyExposurePercent!.date)).toBe('2024-01-02')
    })

    it('should handle case where peak dollar and peak percent are on different dates', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-02'),
          marginReq: 5000,
        }),
        createTrade({
          dateOpened: etDate('2024-01-03'),
          dateClosed: etDate('2024-01-04'),
          marginReq: 2000,
        }),
      ]

      const equityCurve = [
        createEquityPoint('2024-01-01T00:00:00.000Z', 100000), // 5%
        createEquityPoint('2024-01-02T00:00:00.000Z', 100000), // 5%
        createEquityPoint('2024-01-03T00:00:00.000Z', 5000), // 40%
        createEquityPoint('2024-01-04T00:00:00.000Z', 5000), // 40%
      ]

      const result = calculateDailyExposure(trades, equityCurve)

      // Peak dollar: 01-01 or 01-02 ($5000)
      expect(result.peakDailyExposure?.exposure).toBe(5000)

      // Peak percent: 01-03 or 01-04 (40%)
      expect(result.peakDailyExposurePercent?.exposurePercent).toBeCloseTo(40, 5)
    })
  })

  describe('edge cases', () => {
    it('should skip trades with zero or negative margin', () => {
      const trades = [
        createTrade({ marginReq: 0 }),
        createTrade({ marginReq: -100 }),
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-02'),
          marginReq: 1000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      // Only the valid trade should be counted
      expect(result.dailyExposure.length).toBe(2) // 01-01 and 01-02
      result.dailyExposure.forEach(point => {
        expect(point.exposure).toBe(1000)
        expect(point.openPositions).toBe(1)
      })
    })

    it('should skip trades with invalid dates', () => {
      const trades = [
        createTrade({ dateOpened: new Date('invalid'), marginReq: 1000 }),
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-02'),
          marginReq: 1000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      expect(result.dailyExposure.length).toBe(2)
    })

    it('should handle trades without close date (open positions)', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: undefined,
          marginReq: 1000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      // With no close date, we only have the open event
      // The date range is just the open date
      expect(result.dailyExposure.length).toBe(1)
      expect(dateKey(result.dailyExposure[0].date)).toBe('2024-01-01')
      expect(result.dailyExposure[0].exposure).toBe(1000)
      expect(result.dailyExposure[0].openPositions).toBe(1)
    })

    it('should handle trade with invalid close date', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: new Date('invalid'),
          marginReq: 1000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      // Invalid close date is treated like no close date
      expect(result.dailyExposure.length).toBe(1)
    })

    it('should handle non-finite margin values', () => {
      const trades = [
        createTrade({ marginReq: NaN }),
        createTrade({ marginReq: Infinity }),
        createTrade({ marginReq: -Infinity }),
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-02'),
          marginReq: 1000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      // Only the valid trade should be counted
      expect(result.dailyExposure.length).toBe(2)
      result.dailyExposure.forEach(point => {
        expect(point.exposure).toBe(1000)
      })
    })

    it('should return empty result when all trades have zero margin', () => {
      const trades = [createTrade({ marginReq: 0 }), createTrade({ marginReq: 0 })]

      const result = calculateDailyExposure(trades, [])

      expect(result.dailyExposure).toEqual([])
      expect(result.peakDailyExposure).toBeNull()
      expect(result.peakDailyExposurePercent).toBeNull()
    })
  })

  describe('sweep-line algorithm correctness', () => {
    it('should correctly handle multiple trades opening and closing on same dates', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-03'),
          marginReq: 1000,
        }),
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-03'),
          marginReq: 500,
        }),
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-02'),
          marginReq: 200,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      const exposureByDate = new Map<string, DailyExposurePoint>()
      result.dailyExposure.forEach(p => exposureByDate.set(dateKey(p.date), p))

      // 01-01: All three trades open (1000 + 500 + 200 = 1700)
      expect(exposureByDate.get('2024-01-01')?.exposure).toBe(1700)
      expect(exposureByDate.get('2024-01-01')?.openPositions).toBe(3)

      // 01-02: Trade 3 closes at end of day, still counted (1000 + 500 + 200 = 1700)
      expect(exposureByDate.get('2024-01-02')?.exposure).toBe(1700)
      expect(exposureByDate.get('2024-01-02')?.openPositions).toBe(3)

      // 01-03: Trade 3 removed (day after close), trades 1 & 2 close at end (1000 + 500 = 1500)
      expect(exposureByDate.get('2024-01-03')?.exposure).toBe(1500)
      expect(exposureByDate.get('2024-01-03')?.openPositions).toBe(2)
    })

    it('should output dates in chronological order', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-05'),
          dateClosed: etDate('2024-01-06'),
          marginReq: 1000,
        }),
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-02'),
          marginReq: 500,
        }),
        createTrade({
          dateOpened: etDate('2024-01-03'),
          dateClosed: etDate('2024-01-04'),
          marginReq: 200,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      // Extract dates and verify they're in order
      const dates = result.dailyExposure.map(p => dateKey(p.date))

      for (let i = 1; i < dates.length; i++) {
        expect(dates[i] >= dates[i - 1]).toBe(true)
      }
    })

    it('should fill gaps between event dates', () => {
      // Trade that spans many days with no other events
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-10'),
          marginReq: 1000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      // Should have 10 days (01-01 through 01-10 inclusive)
      expect(result.dailyExposure.length).toBe(10)

      // All should have same exposure
      result.dailyExposure.forEach(point => {
        expect(point.exposure).toBe(1000)
        expect(point.openPositions).toBe(1)
      })
    })
  })

  describe('regression tests', () => {
    it('should count close day as having open position', () => {
      // This is an important semantic: on the day a trade closes,
      // it should still be counted as having an open position for exposure purposes
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-02'),
          marginReq: 1000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      const exposureByDate = new Map<string, DailyExposurePoint>()
      result.dailyExposure.forEach(p => exposureByDate.set(dateKey(p.date), p))

      // Both open day and close day should show position
      expect(exposureByDate.get('2024-01-01')?.openPositions).toBe(1)
      expect(exposureByDate.get('2024-01-02')?.openPositions).toBe(1)
    })

    it('should not include day after close in exposure', () => {
      const trades = [
        createTrade({
          dateOpened: etDate('2024-01-01'),
          dateClosed: etDate('2024-01-02'),
          marginReq: 1000,
        }),
      ]

      const result = calculateDailyExposure(trades, [])

      const dates = result.dailyExposure.map(p => dateKey(p.date))

      // Should NOT include 01-03 (day after close)
      expect(dates).not.toContain('2024-01-03')
    })
  })
})
