import { describe, it, expect, beforeEach, jest } from '@jest/globals'

import { buildTradeReconciliation } from '@/lib/services/trade-reconciliation'
import type { StrategyAlignment } from '@/lib/models/strategy-alignment'
import type { Trade } from '@/lib/models/trade'
import type { ReportingTrade } from '@/lib/models/reporting-trade'
import type { StoredTrade } from '@/lib/db/trades-store'
import type { StoredReportingTrade } from '@/lib/db/reporting-logs-store'

jest.mock('@/lib/db', () => ({
  getTradesByBlock: jest.fn(),
  getReportingTradesByBlock: jest.fn(),
}))

const { getTradesByBlock, getReportingTradesByBlock } = jest.requireMock('@/lib/db') as {
  getTradesByBlock: jest.MockedFunction<(blockId: string) => Promise<StoredTrade[]>>
  getReportingTradesByBlock: jest.MockedFunction<(blockId: string) => Promise<StoredReportingTrade[]>>
}

describe('trade reconciliation matching', () => {
  const alignment: StrategyAlignment = {
    id: 'alignment-1',
    liveStrategies: ['Live Strategy'],
    reportingStrategies: ['Backtest Strategy'],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  }

  const buildBacktestedTrade = (overrides: Partial<Trade> = {}): Trade => ({
    dateOpened: new Date('2025-09-17'),
    timeOpened: '09:35:00',
    openingPrice: 100,
    legs: 'SPY 0DTE',
    premium: 655,
    pl: 211.91,
    numContracts: 1,
    fundsAtClose: 100000,
    marginReq: 5000,
    strategy: 'Live Strategy',
    openingCommissionsFees: 0,
    closingCommissionsFees: 0,
    openingShortLongRatio: 0,
    ...overrides,
  })

  const buildReportedTrade = (overrides: Partial<ReportingTrade> = {}): ReportingTrade => ({
    strategy: 'Backtest Strategy',
    dateOpened: new Date('2025-09-17T09:35:00'),
    openingPrice: 100,
    legs: 'SPY 0DTE',
    initialPremium: 655,
    numContracts: 1,
    pl: 211.91,
    ...overrides,
  })

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('should auto match trades that share a session even when time parsing shifts the Date backward by timezone', async () => {
    const backtestedTrade = buildBacktestedTrade()
    const reportedTrade = buildReportedTrade()

    getTradesByBlock.mockResolvedValue([{ ...backtestedTrade, blockId: 'block-1' }])
    getReportingTradesByBlock.mockResolvedValue([
      { ...reportedTrade, blockId: 'block-1' },
    ])

    const result = await buildTradeReconciliation('block-1', [alignment])
    const [alignedSet] = result.alignments

    const expectedBacktestedId = [
      backtestedTrade.strategy,
      backtestedTrade.dateOpened.toISOString(),
      backtestedTrade.timeOpened,
      backtestedTrade.numContracts,
      Number(backtestedTrade.pl.toFixed(2)),
    ].join('|')

    const expectedReportedId = [
      reportedTrade.strategy,
      reportedTrade.dateOpened.toISOString(),
      'na',
      reportedTrade.numContracts,
      Number(reportedTrade.pl.toFixed(2)),
    ].join('|')

    expect(alignedSet.autoSelectedBacktestedIds).toContain(expectedBacktestedId)
    expect(alignedSet.autoSelectedReportedIds).toContain(expectedReportedId)
    expect(alignedSet.sessions).toHaveLength(1)

    const [session] = alignedSet.sessions
    expect(session.session).toBe('2025-09-17')

    const [item] = session.items
    expect(item.backtested?.id).toBe(expectedBacktestedId)
    expect(item.reported?.id).toBe(expectedReportedId)
    expect(item.autoBacktested).toBe(true)
    expect(item.autoReported).toBe(true)
  })
})
