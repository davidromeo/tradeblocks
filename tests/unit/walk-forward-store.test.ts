import { describe, expect, it, beforeEach } from '@jest/globals'
import { useWalkForwardStore, DEFAULT_WALK_FORWARD_CONFIG, WALK_FORWARD_PRESETS } from '@/lib/stores/walk-forward-store'
import { mockTrades } from '../data/mock-trades'
import { mockDailyLogs } from '../data/mock-daily-logs'
import { PortfolioStats } from '@/lib/models/portfolio-stats'
import type { WalkForwardAnalysis } from '@/lib/models/walk-forward'
import * as db from '@/lib/db'
import { WalkForwardAnalyzer } from '@/lib/calculations/walk-forward-analyzer'

jest.mock('@/lib/db', () => ({
  getTradesByBlock: jest.fn(),
  getDailyLogsByBlock: jest.fn(),
  saveWalkForwardAnalysis: jest.fn(),
  getWalkForwardAnalysesByBlock: jest.fn(),
}))

const mockedDb = db as jest.Mocked<typeof db>
const analyzeSpy = jest.spyOn(WalkForwardAnalyzer.prototype, 'analyze')

const baseStats: PortfolioStats = {
  totalTrades: 5,
  totalPl: 500,
  winningTrades: 3,
  losingTrades: 2,
  breakEvenTrades: 0,
  winRate: 0.6,
  avgWin: 220,
  avgLoss: -160,
  maxWin: 400,
  maxLoss: -320,
  sharpeRatio: 1.2,
  sortinoRatio: 1.5,
  calmarRatio: 0.9,
  cagr: 0.12,
  kellyPercentage: 0.45,
  maxDrawdown: 8,
  avgDailyPl: 45,
  totalCommissions: 25,
  netPl: 475,
  profitFactor: 1.6,
  initialCapital: 10_000,
  maxWinStreak: 2,
  maxLossStreak: 1,
  currentStreak: 1,
  timeInDrawdown: 0.2,
  monthlyWinRate: 0.6,
  weeklyWinRate: 0.5,
}

function createMockAnalysis(blockId = 'block-1'): WalkForwardAnalysis {
  const period = {
    inSampleStart: new Date('2024-01-01'),
    inSampleEnd: new Date('2024-01-31'),
    outOfSampleStart: new Date('2024-02-01'),
    outOfSampleEnd: new Date('2024-02-15'),
    optimalParameters: { kellyMultiplier: 1, maxDrawdownPct: 10 },
    inSampleMetrics: baseStats,
    outOfSampleMetrics: { ...baseStats, netPl: 320, totalPl: 340 },
    targetMetricInSample: 475,
    targetMetricOutOfSample: 320,
  }

  return {
    id: 'analysis-1',
    blockId,
    config: DEFAULT_WALK_FORWARD_CONFIG,
    results: {
      periods: [period],
      summary: {
        avgInSamplePerformance: 475,
        avgOutOfSamplePerformance: 320,
        degradationFactor: 0.67,
        parameterStability: 0.85,
        robustnessScore: 0.74,
      },
      stats: {
        totalPeriods: 1,
        evaluatedPeriods: 1,
        skippedPeriods: 0,
        totalParameterTests: 6,
        analyzedTrades: 10,
        durationMs: 1500,
        consistencyScore: 1,
        averagePerformanceDelta: -155,
      },
    },
    createdAt: new Date('2024-02-20'),
  }
}

function resetStoreState(): void {
  useWalkForwardStore.setState({
    config: {
      ...DEFAULT_WALK_FORWARD_CONFIG,
      parameterRanges: { ...DEFAULT_WALK_FORWARD_CONFIG.parameterRanges },
    },
    isRunning: false,
    progress: null,
    error: null,
    results: null,
    history: [],
    presets: WALK_FORWARD_PRESETS,
  })
}

beforeEach(() => {
  resetStoreState()
  jest.clearAllMocks()
  mockedDb.getTradesByBlock.mockResolvedValue(mockTrades)
  mockedDb.getDailyLogsByBlock.mockResolvedValue(mockDailyLogs)
  mockedDb.saveWalkForwardAnalysis.mockResolvedValue()
  mockedDb.getWalkForwardAnalysesByBlock.mockResolvedValue([])
  analyzeSpy.mockResolvedValue({
    config: DEFAULT_WALK_FORWARD_CONFIG,
    results: createMockAnalysis().results,
    startedAt: new Date('2024-02-20T00:00:00Z'),
    completedAt: new Date('2024-02-20T00:10:00Z'),
  })
})

describe('walk-forward store configuration helpers', () => {
  it('updates config values and parameter ranges', () => {
    const store = useWalkForwardStore.getState()
    store.updateConfig({ inSampleDays: 30 })
    store.setParameterRange('kellyMultiplier', [0.25, 1, 0.25])

    const state = useWalkForwardStore.getState()
    expect(state.config.inSampleDays).toBe(30)
    expect(state.config.parameterRanges.kellyMultiplier).toEqual([0.25, 1, 0.25])
  })

  it('applies presets to configuration', () => {
    const store = useWalkForwardStore.getState()
    store.applyPreset('conservative')

    const state = useWalkForwardStore.getState()
    expect(state.config.inSampleDays).toBe(30)
    expect(state.config.parameterRanges.maxDrawdownPct).toEqual([5, 15, 5])
  })
})

describe('walk-forward store analysis workflow', () => {
  it('runs analysis, persists results, and updates history', async () => {
    await useWalkForwardStore.getState().runAnalysis('block-1')
    const state = useWalkForwardStore.getState()

    expect(analyzeSpy).toHaveBeenCalled()
    expect(mockedDb.saveWalkForwardAnalysis).toHaveBeenCalledTimes(1)
    expect(state.results).not.toBeNull()
    expect(state.history.length).toBe(1)
    expect(state.isRunning).toBe(false)

    const csv = state.exportResultsAsCsv()
    const json = state.exportResultsAsJson()
    expect(csv).toContain('Summary')
    expect(json).toContain('"blockId"')
  })

  it('loads history from IndexedDB', async () => {
    const mockAnalysis = createMockAnalysis()
    mockedDb.getWalkForwardAnalysesByBlock.mockResolvedValue([mockAnalysis])

    await useWalkForwardStore.getState().loadHistory('block-1')
    const state = useWalkForwardStore.getState()

    expect(state.history[0].id).toBe(mockAnalysis.id)
    expect(state.results?.id).toBe(mockAnalysis.id)
  })

  it('selects an analysis from history', () => {
    const first = createMockAnalysis()
    const second = { ...createMockAnalysis(), id: 'analysis-2', createdAt: new Date('2024-02-21') }

    useWalkForwardStore.setState({ history: [first, second], results: first })
    useWalkForwardStore.getState().selectAnalysis('analysis-2')

    expect(useWalkForwardStore.getState().results?.id).toBe('analysis-2')
  })
})
