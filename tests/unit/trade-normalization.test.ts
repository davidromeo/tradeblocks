import { describe, expect, it } from '@jest/globals'

import { Trade } from '@/lib/models/trade'
import {
  normalizeTradeToOneLot,
  normalizeTradesToOneLot,
  normalizeTradesToContracts,
} from '@/lib/utils/trade-normalization'

const baseTrade: Trade = {
  dateOpened: new Date('2024-01-01'),
  timeOpened: '09:30:00',
  openingPrice: 100,
  legs: 'Test',
  premium: 2,
  pl: 5000,
  numContracts: 5,
  fundsAtClose: 150000,
  marginReq: 25000,
  strategy: 'Test',
  openingCommissionsFees: 100,
  closingCommissionsFees: 50,
  openingShortLongRatio: 0.5,
}

describe('trade normalization helpers', () => {
  it('scales aggregate values down to a single contract', () => {
    const normalized = normalizeTradeToOneLot(baseTrade)

    expect(normalized.pl).toBeCloseTo(1000)
    expect(normalized.marginReq).toBeCloseTo(5000)
    expect(normalized.fundsAtClose).toBeCloseTo(30000)
    expect(normalized.openingCommissionsFees).toBeCloseTo(20)
    expect(normalized.closingCommissionsFees).toBeCloseTo(10)
    expect(normalized.numContracts).toBe(1)
  })

  it('leaves single-lot trades unchanged and preserves references order', () => {
    const trades: Trade[] = [
      { ...baseTrade, numContracts: 1, pl: 100, fundsAtClose: 10100 },
      { ...baseTrade, numContracts: 2, pl: 200, fundsAtClose: 10200 },
    ]

    const normalized = normalizeTradesToOneLot(trades)

    expect(normalized).toHaveLength(2)
    expect(normalized[0].pl).toBe(100)
    expect(normalized[0].fundsAtClose).toBe(10100)
    expect(normalized[0].numContracts).toBe(1)

    expect(normalized[1].pl).toBe(100)
    expect(normalized[1].fundsAtClose).toBe(10200)
  })

  it('reconstructs a synthetic equity curve when contract sizes vary', () => {
    const trades: Trade[] = [
      {
        ...baseTrade,
        dateClosed: new Date('2024-01-02'),
        timeClosed: '11:00:00',
        numContracts: 20,
        pl: -4000,
        fundsAtClose: 2_000_000,
      },
      {
        ...baseTrade,
        dateOpened: new Date('2024-01-03'),
        dateClosed: new Date('2024-01-04'),
        timeClosed: '11:00:00',
        numContracts: 80,
        pl: 16000,
        fundsAtClose: 2_010_000,
      },
    ]

    const normalized = normalizeTradesToOneLot(trades)

    const firstCapital = (trades[0].fundsAtClose - trades[0].pl) / trades[0].numContracts
    expect(normalized[0].fundsAtClose).toBeCloseTo(firstCapital - 200)
    expect(normalized[1].fundsAtClose).toBeCloseTo(firstCapital - 200 + 200)
  })

  it('handles CombinedTrade by treating it as a single unit if numContracts represents strategy size', () => {
    // Simulate a 1-lot Iron Condor (4 legs, 1 contract each)
    // If combined, numContracts should be 1 (representing 1 IC).
    // P/L = 100.
    
    const combinedTrade: Trade = {
      ...baseTrade,
      strategy: 'Iron Condor',
      legs: 'Short Call | Long Call | Short Put | Long Put',
      numContracts: 1, // 1 lot of IC
      pl: 100,
      marginReq: 1000,
    }

    const normalized = normalizeTradeToOneLot(combinedTrade)

    // Should divide by 1, preserving the P/L of the 1-lot strategy
    expect(normalized.pl).toBe(100)
    expect(normalized.marginReq).toBe(1000)
  })

  describe('premium handling', () => {
    const tradeWithCentsPremium: Trade = {
      ...baseTrade,
      premium: -830, // cents per contract
      premiumPrecision: 'cents',
      numContracts: 112,
      pl: 11200,
      marginReq: 92960,
      maxProfit: 18.67, // percentage
      maxLoss: -12.65,  // percentage
    }

    it('converts cents premium to dollars when normalizing', () => {
      const normalized = normalizeTradeToOneLot(tradeWithCentsPremium)

      // Premium should be converted from cents to dollars per contract
      expect(normalized.premium).toBe(-8.30)
      expect(normalized.premiumPrecision).toBe('dollars')
    })

    it('preserves maxProfit and maxLoss percentages (does not scale)', () => {
      const normalized = normalizeTradeToOneLot(tradeWithCentsPremium)

      // maxProfit and maxLoss are percentages and should NOT be scaled
      expect(normalized.maxProfit).toBe(18.67)
      expect(normalized.maxLoss).toBe(-12.65)
    })

    it('maintains correct premium efficiency after normalization', () => {
      // Original trade efficiency: P&L / totalPremium
      // totalPremium = 830 cents * 112 contracts * 100 option multiplier / 100 = $92,960
      // Original efficiency = 11200 / 92960 * 100 = 12.05%

      const normalized = normalizeTradeToOneLot(tradeWithCentsPremium)

      // After normalization:
      // totalPremium = 8.30 dollars * 1 contract * 100 option multiplier = $830
      // Normalized efficiency = (11200/112) / 830 * 100 = 12.05%

      // The efficiency should remain approximately the same
      const originalEfficiency = (tradeWithCentsPremium.pl / 92960) * 100
      const normalizedEfficiency = (normalized.pl / (8.30 * 1 * 100)) * 100

      expect(normalizedEfficiency).toBeCloseTo(originalEfficiency, 1)
    })

    it('handles trade already at 1 lot with cents precision', () => {
      const oneLotTrade: Trade = {
        ...baseTrade,
        premium: -830, // cents
        premiumPrecision: 'cents',
        numContracts: 1,
        pl: 100,
        marginReq: 830,
      }

      const normalized = normalizeTradeToOneLot(oneLotTrade)

      // Should still convert cents to dollars even if already 1 lot
      expect(normalized.premium).toBe(-8.30)
      expect(normalized.premiumPrecision).toBe('dollars')
    })
  })

  describe('normalizeTradesToContracts', () => {
    const tradeWithCentsPremium: Trade = {
      ...baseTrade,
      premium: -830, // cents per contract
      premiumPrecision: 'cents',
      numContracts: 112,
      pl: 11200,
      marginReq: 92960,
      maxProfit: 18.67,
      maxLoss: -12.65,
    }

    it('normalizes to specified target contracts', () => {
      const normalized = normalizeTradesToContracts([tradeWithCentsPremium], 10)
      const trade = normalized[0]

      expect(trade.numContracts).toBe(10)
      expect(trade.pl).toBeCloseTo(1000, 0) // 11200 * 10/112
    })

    it('converts cents to dollars when normalizing', () => {
      const normalized = normalizeTradesToContracts([tradeWithCentsPremium], 10)
      const trade = normalized[0]

      expect(trade.premium).toBe(-8.30)
      expect(trade.premiumPrecision).toBe('dollars')
    })

    it('does not scale maxProfit/maxLoss percentages', () => {
      const normalized = normalizeTradesToContracts([tradeWithCentsPremium], 10)
      const trade = normalized[0]

      expect(trade.maxProfit).toBe(18.67)
      expect(trade.maxLoss).toBe(-12.65)
    })
  })
})
