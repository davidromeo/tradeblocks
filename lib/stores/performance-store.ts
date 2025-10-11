import { create } from 'zustand'
import { Trade } from '@/lib/models/trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { PortfolioStats } from '@/lib/models/portfolio-stats'
import {
  buildPerformanceSnapshot,
  SnapshotFilters,
  SnapshotChartData
} from '@/lib/services/performance-snapshot'

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
  preset: 'all' | 'ytd' | '1y' | '6m' | '3m' | '1m'
}

export interface ChartSettings {
  equityScale: 'linear' | 'log'
  showDrawdownAreas: boolean
  showTrend: boolean
  maWindow: number
  rollingMetricType: 'win_rate' | 'sharpe' | 'profit_factor'
}

export interface PerformanceData extends SnapshotChartData {
  trades: Trade[]
  allTrades: Trade[]
  dailyLogs: DailyLogEntry[]
  allDailyLogs: DailyLogEntry[]
  portfolioStats: PortfolioStats | null
}

interface PerformanceStore {
  isLoading: boolean
  error: string | null
  dateRange: DateRange
  selectedStrategies: string[]
  data: PerformanceData | null
  chartSettings: ChartSettings
  setDateRange: (dateRange: DateRange) => void
  setSelectedStrategies: (strategies: string[]) => void
  updateChartSettings: (settings: Partial<ChartSettings>) => void
  fetchPerformanceData: (blockId: string) => Promise<void>
  applyFilters: () => Promise<void>
  reset: () => void
}

const initialDateRange: DateRange = {
  from: undefined,
  to: undefined,
  preset: 'all'
}

const initialChartSettings: ChartSettings = {
  equityScale: 'linear',
  showDrawdownAreas: true,
  showTrend: true,
  maWindow: 30,
  rollingMetricType: 'win_rate'
}

function buildSnapshotFilters(dateRange: DateRange, strategies: string[]): SnapshotFilters {
  const filters: SnapshotFilters = {}

  if (dateRange.from || dateRange.to) {
    filters.dateRange = {
      from: dateRange.from,
      to: dateRange.to
    }
  }

  if (strategies.length > 0) {
    filters.strategies = strategies
  }

  return filters
}

export const usePerformanceStore = create<PerformanceStore>((set, get) => ({
  isLoading: false,
  error: null,
  dateRange: initialDateRange,
  selectedStrategies: [],
  data: null,
  chartSettings: initialChartSettings,

  setDateRange: (dateRange) => {
    set({ dateRange })
    get().applyFilters().catch(console.error)
  },

  setSelectedStrategies: (selectedStrategies) => {
    set({ selectedStrategies })
    get().applyFilters().catch(console.error)
  },

  updateChartSettings: (settings) => {
    set(state => ({
      chartSettings: { ...state.chartSettings, ...settings }
    }))
  },

  fetchPerformanceData: async (blockId: string) => {
    set({ isLoading: true, error: null })

    try {
      const { getTradesByBlock, getDailyLogsByBlock } = await import('@/lib/db')
      const [trades, dailyLogs] = await Promise.all([
        getTradesByBlock(blockId),
        getDailyLogsByBlock(blockId)
      ])

      const filters = buildSnapshotFilters(get().dateRange, get().selectedStrategies)
      const snapshot = await buildPerformanceSnapshot({
        trades,
        dailyLogs,
        filters,
        riskFreeRate: 2.0
      })

      set({
        data: {
          trades: snapshot.filteredTrades,
          allTrades: trades,
          dailyLogs: snapshot.filteredDailyLogs,
          allDailyLogs: dailyLogs,
          portfolioStats: snapshot.portfolioStats,
          ...snapshot.chartData
        },
        isLoading: false
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load performance data',
        isLoading: false
      })
    }
  },

  applyFilters: async () => {
    const { data, dateRange, selectedStrategies } = get()
    if (!data) return

    const filters = buildSnapshotFilters(dateRange, selectedStrategies)

    const snapshot = await buildPerformanceSnapshot({
      trades: data.allTrades,
      dailyLogs: data.allDailyLogs,
      filters,
      riskFreeRate: 2.0
    })

    set(state => ({
      data: state.data ? {
        ...state.data,
        trades: snapshot.filteredTrades,
        dailyLogs: snapshot.filteredDailyLogs,
        portfolioStats: snapshot.portfolioStats,
        ...snapshot.chartData
      } : null
    }))
  },

  reset: () => {
    set({
      isLoading: false,
      error: null,
      dateRange: initialDateRange,
      selectedStrategies: [],
      data: null,
      chartSettings: initialChartSettings
    })
  }
}))

// Re-export for existing unit tests that rely on chart processing helpers
export { processChartData } from '@/lib/services/performance-snapshot'
