import { PortfolioStats } from './portfolio-stats'

export type WalkForwardOptimizationTarget =
  | 'netPl'
  | 'profitFactor'
  | 'sharpeRatio'
  | 'sortinoRatio'
  | 'calmarRatio'
  | 'cagr'
  | 'avgDailyPl'
  | 'winRate'

export type WalkForwardParameterRangeTuple = [min: number, max: number, step: number]

export type WalkForwardParameterRanges = Record<string, WalkForwardParameterRangeTuple>

export interface WalkForwardConfig {
  inSampleDays: number
  outOfSampleDays: number
  stepSizeDays: number
  optimizationTarget: WalkForwardOptimizationTarget
  parameterRanges: WalkForwardParameterRanges
  minInSampleTrades?: number
  minOutOfSampleTrades?: number
}

export interface WalkForwardWindow {
  inSampleStart: Date
  inSampleEnd: Date
  outOfSampleStart: Date
  outOfSampleEnd: Date
}

export interface WalkForwardPeriodResult extends WalkForwardWindow {
  optimalParameters: Record<string, number>
  inSampleMetrics: PortfolioStats
  outOfSampleMetrics: PortfolioStats
  targetMetricInSample: number
  targetMetricOutOfSample: number
}

export interface WalkForwardSummary {
  avgInSamplePerformance: number
  avgOutOfSamplePerformance: number
  degradationFactor: number
  parameterStability: number
  robustnessScore: number
}

export interface WalkForwardRunStats {
  totalPeriods: number
  evaluatedPeriods: number
  skippedPeriods: number
  totalParameterTests: number
  analyzedTrades: number
  durationMs: number
  consistencyScore: number
  averagePerformanceDelta: number
}

export interface WalkForwardResults {
  periods: WalkForwardPeriodResult[]
  summary: WalkForwardSummary
  stats: WalkForwardRunStats
}

export interface WalkForwardAnalysis {
  id: string
  blockId: string
  config: WalkForwardConfig
  results: WalkForwardResults
  createdAt: Date
  updatedAt?: Date
  notes?: string
}

export interface WalkForwardProgressEvent {
  phase: 'segmenting' | 'optimizing' | 'evaluating' | 'completed'
  currentPeriod: number
  totalPeriods: number
  testedCombinations?: number
  totalCombinations?: number
  window?: WalkForwardWindow
  message?: string
}

export interface WalkForwardComputation {
  config: WalkForwardConfig
  results: WalkForwardResults
  startedAt: Date
  completedAt: Date
}
