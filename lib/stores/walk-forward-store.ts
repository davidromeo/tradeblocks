import { create } from 'zustand'
import { WalkForwardAnalyzer } from '@/lib/calculations/walk-forward-analyzer'
import {
  WalkForwardAnalysis,
  WalkForwardConfig,
  WalkForwardParameterRangeTuple,
  WalkForwardParameterRanges,
  WalkForwardProgressEvent,
} from '@/lib/models/walk-forward'

type WalkForwardPresetKey = 'conservative' | 'moderate' | 'aggressive'

interface WalkForwardPreset {
  label: string
  description: string
  config: Partial<Omit<WalkForwardConfig, 'parameterRanges'>>
  parameterRanges?: Partial<WalkForwardParameterRanges>
}

interface WalkForwardStore {
  config: WalkForwardConfig
  isRunning: boolean
  progress: WalkForwardProgressEvent | null
  error: string | null
  results: WalkForwardAnalysis | null
  history: WalkForwardAnalysis[]
  presets: Record<WalkForwardPresetKey, WalkForwardPreset>
  runAnalysis: (blockId: string) => Promise<void>
  cancelAnalysis: () => void
  loadHistory: (blockId: string) => Promise<void>
  updateConfig: (config: Partial<Omit<WalkForwardConfig, 'parameterRanges'>>) => void
  setParameterRange: (key: string, range: WalkForwardParameterRangeTuple) => void
  applyPreset: (preset: WalkForwardPresetKey) => void
  clearResults: () => void
  exportResultsAsJson: () => string | null
  exportResultsAsCsv: () => string | null
  selectAnalysis: (analysisId: string) => void
  deleteAnalysis: (analysisId: string) => Promise<void>
}

const analyzer = new WalkForwardAnalyzer()
let activeController: AbortController | null = null

const DEFAULT_PARAMETER_RANGES: WalkForwardParameterRanges = {
  kellyMultiplier: [0.5, 1.5, 0.25],
  fixedFractionPct: [2, 8, 1],
  maxDrawdownPct: [5, 20, 5],
  maxDailyLossPct: [2, 8, 2],
  consecutiveLossLimit: [2, 6, 1],
}

export const WALK_FORWARD_PRESETS: Record<WalkForwardPresetKey, WalkForwardPreset> = {
  conservative: {
    label: 'Conservative',
    description: 'Lower leverage, tighter risk controls',
    config: {
      inSampleDays: 30,
      outOfSampleDays: 10,
      stepSizeDays: 10,
    },
    parameterRanges: {
      kellyMultiplier: [0.25, 1, 0.25],
      maxDrawdownPct: [5, 15, 5],
      maxDailyLossPct: [2, 6, 2],
      consecutiveLossLimit: [2, 4, 1],
    },
  },
  moderate: {
    label: 'Moderate',
    description: 'Balanced trade-off between return and robustness',
    config: {
      inSampleDays: 45,
      outOfSampleDays: 15,
      stepSizeDays: 15,
    },
    parameterRanges: {
      kellyMultiplier: [0.5, 1.5, 0.25],
      fixedFractionPct: [2, 8, 1],
      maxDrawdownPct: [5, 20, 5],
    },
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Broader leverage sweep with wider risk tolerances',
    config: {
      inSampleDays: 60,
      outOfSampleDays: 20,
      stepSizeDays: 20,
    },
    parameterRanges: {
      kellyMultiplier: [0.75, 2, 0.25],
      fixedFractionPct: [4, 12, 2],
      maxDrawdownPct: [10, 30, 5],
      maxDailyLossPct: [4, 12, 2],
    },
  },
}

export const DEFAULT_WALK_FORWARD_CONFIG: WalkForwardConfig = {
  inSampleDays: 45,
  outOfSampleDays: 15,
  stepSizeDays: 15,
  optimizationTarget: 'netPl',
  parameterRanges: DEFAULT_PARAMETER_RANGES,
  minInSampleTrades: 15,
  minOutOfSampleTrades: 5,
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `walk-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toCsvRow(values: Array<string | number>): string {
  return values
    .map((value) => {
      if (typeof value === 'number') {
        if (Number.isFinite(value)) {
          return value.toString()
        }
        return ''
      }
      if (value === null || value === undefined) return ''
      const stringValue = value.toString()
      return stringValue.includes(',') ? `"${stringValue}"` : stringValue
    })
    .join(',')
}

function buildCsvFromAnalysis(analysis: WalkForwardAnalysis | null): string | null {
  if (!analysis) return null

  const header = toCsvRow([
    'IS Start',
    'IS End',
    'OOS Start',
    'OOS End',
    'Target IS',
    'Target OOS',
    'Kelly Multiplier',
    'Fixed Fraction %',
    'Max DD %',
    'Max Daily Loss %',
    'Consecutive Loss Limit',
  ])

  const rows = analysis.results.periods.map((period) => {
    const formatDate = (date: Date) => new Date(date).toISOString().split('T')[0]
    return toCsvRow([
      formatDate(period.inSampleStart),
      formatDate(period.inSampleEnd),
      formatDate(period.outOfSampleStart),
      formatDate(period.outOfSampleEnd),
      period.targetMetricInSample,
      period.targetMetricOutOfSample,
      period.optimalParameters.kellyMultiplier ?? '',
      period.optimalParameters.fixedFractionPct ?? '',
      period.optimalParameters.maxDrawdownPct ?? '',
      period.optimalParameters.maxDailyLossPct ?? '',
      period.optimalParameters.consecutiveLossLimit ?? '',
    ])
  })

  const summary = [
    '',
    'Summary',
    toCsvRow(['Avg IS Performance', analysis.results.summary.avgInSamplePerformance]),
    toCsvRow(['Avg OOS Performance', analysis.results.summary.avgOutOfSamplePerformance]),
    toCsvRow(['Efficiency Ratio (OOS/IS)', analysis.results.summary.degradationFactor]),
    toCsvRow(['Parameter Stability', analysis.results.summary.parameterStability]),
    toCsvRow(['Consistency Score', analysis.results.stats.consistencyScore]),
    toCsvRow(['Avg Performance Delta', analysis.results.stats.averagePerformanceDelta]),
  ]

  return [header, ...rows, ...summary].join('\n')
}

export const useWalkForwardStore = create<WalkForwardStore>((set, get) => ({
  config: DEFAULT_WALK_FORWARD_CONFIG,
  isRunning: false,
  progress: null,
  error: null,
  results: null,
  history: [],
  presets: WALK_FORWARD_PRESETS,

  updateConfig: (partialConfig) => {
    set((state) => ({
      config: { ...state.config, ...partialConfig },
    }))
  },

  setParameterRange: (key, range) => {
    const [min, max, step] = range
    const sanitizedMin = Number.isFinite(min) ? min : 0
    const sanitizedMax = Number.isFinite(max) ? Math.max(max, sanitizedMin) : sanitizedMin
    const sanitizedStep = Number.isFinite(step) && step > 0 ? step : 1

    set((state) => ({
      config: {
        ...state.config,
        parameterRanges: {
          ...state.config.parameterRanges,
          [key]: [sanitizedMin, sanitizedMax, sanitizedStep],
        },
      },
    }))
  },

  applyPreset: (presetKey) => {
    const preset = WALK_FORWARD_PRESETS[presetKey]
    if (!preset) return

    set((state) => {
      const presetRanges = preset.parameterRanges || {}
      const filteredRanges: WalkForwardParameterRanges = Object.entries(presetRanges)
        .filter(([, value]) => value !== undefined)
        .reduce((acc, [key, value]) => {
          acc[key] = value as WalkForwardParameterRangeTuple
          return acc
        }, {} as WalkForwardParameterRanges)

      return {
        config: {
          ...state.config,
          ...preset.config,
          parameterRanges: {
            ...state.config.parameterRanges,
            ...filteredRanges,
          },
        },
      }
    })
  },

  runAnalysis: async (blockId: string) => {
    if (!blockId) {
      set({ error: 'Select a block before running walk-forward analysis.' })
      return
    }

    if (get().isRunning) {
      return
    }

    set({ isRunning: true, progress: null, error: null })

    try {
      const db = await import('@/lib/db')
      const [trades, dailyLogs] = await Promise.all([
        db.getTradesByBlock(blockId),
        db.getDailyLogsByBlock(blockId),
      ])

      if (!trades || trades.length === 0) {
        set({
          isRunning: false,
          progress: null,
          error: 'No trades available for the selected block.',
        })
        return
      }

      activeController = new AbortController()

      const analysisResult = await analyzer.analyze({
        trades,
        dailyLogs,
        config: get().config,
        signal: activeController.signal,
        onProgress: (progress) => set({ progress }),
      })

      const record: WalkForwardAnalysis = {
        id: generateId(),
        blockId,
        config: JSON.parse(JSON.stringify(get().config)),
        results: analysisResult.results,
        createdAt: new Date(),
      }

      await db.saveWalkForwardAnalysis(record)

      set((state) => ({
        results: record,
        history: [record, ...state.history.filter((item) => item.id !== record.id)],
        isRunning: false,
        progress: null,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete analysis'
      const isAbort = message.toLowerCase().includes('aborted')
      set({
        error: isAbort ? null : message,
        isRunning: false,
        progress: null,
      })
    } finally {
      activeController = null
    }
  },

  cancelAnalysis: () => {
    if (activeController) {
      activeController.abort()
    }
    set({ isRunning: false, progress: null })
  },

  loadHistory: async (blockId: string) => {
    if (!blockId) return
    try {
      const db = await import('@/lib/db')
      const analyses = await db.getWalkForwardAnalysesByBlock(blockId)
      set({
        history: analyses,
        results: analyses.length > 0 ? analyses[0] : null,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load walk-forward history'
      set({ error: message })
    }
  },

  clearResults: () => {
    set({ results: null, progress: null, error: null })
  },

  selectAnalysis: (analysisId: string) => {
    set((state) => ({
      results: state.history.find((analysis) => analysis.id === analysisId) ?? state.results,
    }))
  },

  deleteAnalysis: async (analysisId: string) => {
    if (!analysisId) return
    try {
      const db = await import('@/lib/db')
      await db.deleteWalkForwardAnalysis(analysisId)

      set((state) => {
        const filtered = state.history.filter((item) => item.id !== analysisId)
        const nextCurrent = state.results?.id === analysisId ? filtered[0] ?? null : state.results
        return {
          history: filtered,
          results: nextCurrent,
          error: null,
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete analysis'
      set({ error: message })
    }
  },

  exportResultsAsJson: () => {
    const analysis = get().results
    if (!analysis) return null
    return JSON.stringify(
      {
        id: analysis.id,
        blockId: analysis.blockId,
        config: analysis.config,
        results: analysis.results,
      },
      null,
      2
    )
  },

  exportResultsAsCsv: () => {
    return buildCsvFromAnalysis(get().results)
  },
}))
