import { Trade } from '../models/trade'
import { DailyLogEntry } from '../models/daily-log'
import {
  WalkForwardConfig,
  WalkForwardComputation,
  WalkForwardParameterRanges,
  WalkForwardPeriodResult,
  WalkForwardProgressEvent,
  WalkForwardResults,
  WalkForwardSummary,
  WalkForwardWindow,
} from '../models/walk-forward'
import { PortfolioStatsCalculator } from './portfolio-stats'
import { calculateKellyMetrics } from './kelly'
import { PortfolioStats } from '../models/portfolio-stats'

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_MIN_IN_SAMPLE_TRADES = 10
const DEFAULT_MIN_OUT_SAMPLE_TRADES = 3
const DEFAULT_FIXED_FRACTION_PCT = 2
const MAX_PARAMETER_COMBINATIONS = 20000
const YIELD_EVERY = 50

interface AnalyzeOptions {
  trades: Trade[]
  /**
   * Daily portfolio logs. Reserved for future use to enable more accurate
   * equity curve calculations during walk-forward periods. Currently unused.
   */
  dailyLogs?: DailyLogEntry[]
  config: WalkForwardConfig
  signal?: AbortSignal
  onProgress?: (event: WalkForwardProgressEvent) => void
}

interface ScalingBaseline {
  baseKellyFraction: number
  avgContracts: number
}

interface CombinationIterator {
  values: Array<Record<string, number>>
  count: number
}

export class WalkForwardAnalyzer {
  // Cache for trade timestamps to avoid repeated Date parsing
  private tradeTimestampCache = new Map<Trade, number>()

  private getTradeTimestamp(trade: Trade): number {
    let ts = this.tradeTimestampCache.get(trade)
    if (ts === undefined) {
      ts = new Date(trade.dateOpened).getTime()
      this.tradeTimestampCache.set(trade, ts)
    }
    return ts
  }

  async analyze(options: AnalyzeOptions): Promise<WalkForwardComputation> {
    this.ensureValidConfig(options.config)

    // Clear cache for new analysis
    this.tradeTimestampCache.clear()

    const sortedTrades = this.sortTrades(options.trades)
    const calculator = new PortfolioStatsCalculator()
    const startedAt = new Date()

    if (sortedTrades.length === 0) {
      const emptyResults = this.buildResults([], options.config, 0, 0, sortedTrades.length, startedAt)
      return {
        config: options.config,
        results: emptyResults,
        startedAt,
        completedAt: new Date(),
      }
    }

    const windows = this.buildWindows(sortedTrades, options.config)
    options.onProgress?.({
      phase: 'segmenting',
      currentPeriod: 0,
      totalPeriods: windows.length,
      message: `Prepared ${windows.length} optimization windows`,
    })

    const periods: WalkForwardPeriodResult[] = []
    let skippedPeriods = 0
    let totalParameterTests = 0

    for (let index = 0; index < windows.length; index++) {
      this.throwIfAborted(options.signal)

      const window = windows[index]
      const inSampleTrades = this.filterTrades(sortedTrades, window.inSampleStart, window.inSampleEnd)
      const outSampleTrades = this.filterTrades(sortedTrades, window.outOfSampleStart, window.outOfSampleEnd)

      const minInSample = options.config.minInSampleTrades ?? DEFAULT_MIN_IN_SAMPLE_TRADES
      const minOutSample = options.config.minOutOfSampleTrades ?? DEFAULT_MIN_OUT_SAMPLE_TRADES

      if (inSampleTrades.length < minInSample || outSampleTrades.length < minOutSample) {
        skippedPeriods++
        continue
      }

      const combinationIterator = this.buildCombinationIterator(options.config.parameterRanges || {})
      if (combinationIterator.count > MAX_PARAMETER_COMBINATIONS) {
        throw new Error(
          `Walk-forward parameter grid too large (${combinationIterator.count.toLocaleString()} combinations). ` +
          `Reduce ranges or increase step sizes.`
        )
      }

      options.onProgress?.({
        phase: 'optimizing',
        currentPeriod: index + 1,
        totalPeriods: windows.length,
        totalCombinations: combinationIterator.count,
        testedCombinations: 0,
        window,
      })

      const baseline = this.buildScalingBaseline(inSampleTrades)
      const inSampleInitialCapital = PortfolioStatsCalculator.calculateInitialCapital(inSampleTrades)
      const outSampleInitialCapital = PortfolioStatsCalculator.calculateInitialCapital(outSampleTrades)

      let tested = 0
      let bestCombo: {
        params: Record<string, number>
        inSampleStats: PortfolioStats
        score: number
      } | null = null

      for (const params of combinationIterator.values) {
        this.throwIfAborted(options.signal)
        tested++

        const scaledInSampleTrades = this.applyScenario(
          inSampleTrades,
          params,
          baseline,
          inSampleInitialCapital
        )
        const inSampleStats = calculator.calculatePortfolioStats(scaledInSampleTrades)

        if (!this.isRiskAcceptable(params, inSampleStats, scaledInSampleTrades)) {
          continue
        }

        const targetValue = this.getTargetMetricValue(inSampleStats, options.config.optimizationTarget)
        if (!Number.isFinite(targetValue)) {
          continue
        }

        if (!bestCombo || targetValue > bestCombo.score) {
          bestCombo = {
            params: { ...params },
            inSampleStats,
            score: targetValue,
          }
        }

        if (tested % YIELD_EVERY === 0) {
          await this.yieldToEventLoop()
        }

        options.onProgress?.({
          phase: 'optimizing',
          currentPeriod: index + 1,
          totalPeriods: windows.length,
          totalCombinations: combinationIterator.count,
          testedCombinations: tested,
          window,
        })
      }

      totalParameterTests += tested

      if (!bestCombo) {
        skippedPeriods++
        continue
      }

      const scaledOutSampleTrades = this.applyScenario(
        outSampleTrades,
        bestCombo.params,
        baseline,
        outSampleInitialCapital
      )
      const outSampleStats = calculator.calculatePortfolioStats(scaledOutSampleTrades)

      const period: WalkForwardPeriodResult = {
        ...window,
        optimalParameters: bestCombo.params,
        inSampleMetrics: bestCombo.inSampleStats,
        outOfSampleMetrics: outSampleStats,
        targetMetricInSample: bestCombo.score,
        targetMetricOutOfSample: this.getTargetMetricValue(outSampleStats, options.config.optimizationTarget),
      }

      periods.push(period)

      options.onProgress?.({
        phase: 'evaluating',
        currentPeriod: index + 1,
        totalPeriods: windows.length,
        testedCombinations: tested,
        totalCombinations: combinationIterator.count,
        window,
      })
    }

    const completedAt = new Date()
    const results = this.buildResults(
      periods,
      options.config,
      windows.length,
      totalParameterTests,
      sortedTrades.length,
      startedAt,
      completedAt,
      skippedPeriods
    )

    options.onProgress?.({
      phase: 'completed',
      currentPeriod: windows.length,
      totalPeriods: windows.length,
      message: 'Walk-forward analysis complete',
    })

    return {
      config: options.config,
      results,
      startedAt,
      completedAt,
    }
  }

  private ensureValidConfig(config: WalkForwardConfig): void {
    if (config.inSampleDays <= 0) {
      throw new Error('inSampleDays must be greater than zero')
    }
    if (config.outOfSampleDays <= 0) {
      throw new Error('outOfSampleDays must be greater than zero')
    }
    if (config.stepSizeDays <= 0) {
      throw new Error('stepSizeDays must be greater than zero')
    }
  }

  private sortTrades(trades: Trade[]): Trade[] {
    return [...trades].sort((a, b) => {
      const dateA = this.getTradeTimestamp(a)
      const dateB = this.getTradeTimestamp(b)
      if (dateA !== dateB) return dateA - dateB
      return (a.timeOpened || '').localeCompare(b.timeOpened || '')
    })
  }

  private filterTrades(trades: Trade[], start: Date, end: Date): Trade[] {
    const startMs = start.getTime()
    // Add full day to end date to include all trades on that day regardless of time
    const endMs = end.getTime() + DAY_MS - 1
    return trades.filter((trade) => {
      const tradeDate = this.getTradeTimestamp(trade)
      return tradeDate >= startMs && tradeDate <= endMs
    })
  }

  private buildWindows(trades: Trade[], config: WalkForwardConfig): WalkForwardWindow[] {
    if (trades.length === 0) return []

    const firstDate = this.floorToUTCDate(new Date(trades[0].dateOpened))
    const lastDate = this.floorToUTCDate(new Date(trades[trades.length - 1].dateOpened))
    const windows: WalkForwardWindow[] = []

    let cursor = firstDate.getTime()

    while (cursor < lastDate.getTime()) {
      const inSampleStart = new Date(cursor)
      const inSampleEnd = new Date(cursor + (config.inSampleDays - 1) * DAY_MS)
      const outOfSampleStart = new Date(inSampleEnd.getTime() + DAY_MS)
      const outOfSampleEnd = new Date(outOfSampleStart.getTime() + (config.outOfSampleDays - 1) * DAY_MS)

      if (outOfSampleStart > lastDate) {
        break
      }

      windows.push({
        inSampleStart,
        inSampleEnd,
        outOfSampleStart,
        outOfSampleEnd,
      })

      cursor += config.stepSizeDays * DAY_MS
    }

    return windows
  }

  private floorToUTCDate(date: Date): Date {
    const floored = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    return floored
  }

  private buildCombinationIterator(parameterRanges: WalkForwardParameterRanges): CombinationIterator {
    const entries = Object.entries(parameterRanges || {})
    if (entries.length === 0) {
      return { values: [{}], count: 1 }
    }

    const values = entries.map(([key, [min, max, step]]) => ({
      key,
      values: this.buildRangeValues(min, max, step),
    }))

    const combinations: Array<Record<string, number>> = []

    const recurse = (index: number, current: Record<string, number>) => {
      if (index === values.length) {
        combinations.push({ ...current })
        return
      }

      const entry = values[index]
      entry.values.forEach((value) => {
        current[entry.key] = value
        recurse(index + 1, current)
      })
    }

    recurse(0, {})

    return { values: combinations, count: combinations.length }
  }

  private buildRangeValues(min: number, max: number, step: number): number[] {
    if (max < min) {
      throw new Error(`Invalid parameter range: max (${max}) must be >= min (${min}).`)
    }
    if (step <= 0) {
      throw new Error(`Invalid parameter step size (${step}). Step must be positive.`)
    }

    const values: number[] = []
    const totalSteps = Math.floor((max - min) / step)
    for (let i = 0; i <= totalSteps; i++) {
      const value = min + i * step
      values.push(Number(value.toFixed(6)))
    }

    if (!values.includes(Number(max.toFixed(6)))) {
      values.push(Number(max.toFixed(6)))
    }

    return values
  }

  private buildScalingBaseline(trades: Trade[]): ScalingBaseline {
    const kellyMetrics = calculateKellyMetrics(trades)
    const avgContracts =
      trades.length > 0
        ? trades.reduce((sum, trade) => sum + Math.abs(trade.numContracts || 0), 0) / trades.length
        : 1

    return {
      baseKellyFraction: kellyMetrics.fraction || 0,
      avgContracts: avgContracts > 0 ? avgContracts : 1,
    }
  }

  private applyScenario(
    trades: Trade[],
    params: Record<string, number>,
    baseline: ScalingBaseline,
    initialCapitalOverride?: number
  ): Trade[] {
    if (trades.length === 0) return []

    const initialCapital =
      typeof initialCapitalOverride === 'number'
        ? initialCapitalOverride
        : PortfolioStatsCalculator.calculateInitialCapital(trades)

    const positionMultiplier = this.calculatePositionMultiplier(params, baseline)
    const strategyWeights = this.buildStrategyWeights(params)

    // trades are already sorted from filterTrades() which preserves sortedTrades order
    let runningEquity = initialCapital

    return trades.map((trade) => {
      const strategyWeight = strategyWeights[this.normalizeStrategyKey(trade.strategy)] ?? 1
      const scale = positionMultiplier * strategyWeight
      const scaledPl = trade.pl * scale

      runningEquity += scaledPl

      // Only include fields used by PortfolioStatsCalculator to reduce object copy overhead
      return {
        pl: scaledPl,
        dateOpened: trade.dateOpened,
        timeOpened: trade.timeOpened,
        dateClosed: trade.dateClosed,
        timeClosed: trade.timeClosed,
        fundsAtClose: runningEquity,
        openingCommissionsFees: trade.openingCommissionsFees * Math.abs(scale),
        closingCommissionsFees: trade.closingCommissionsFees * Math.abs(scale),
        strategy: trade.strategy,
      } as Trade
    })
  }

  private calculatePositionMultiplier(params: Record<string, number>, baseline: ScalingBaseline): number {
    let multiplier = 1

    if (typeof params.kellyMultiplier === 'number' && params.kellyMultiplier > 0) {
      multiplier *= params.kellyMultiplier
    }

    if (typeof params.fixedFractionPct === 'number' && params.fixedFractionPct > 0) {
      multiplier *= params.fixedFractionPct / DEFAULT_FIXED_FRACTION_PCT
    }

    if (typeof params.fixedContracts === 'number' && params.fixedContracts > 0) {
      const baseContracts = baseline.avgContracts > 0 ? baseline.avgContracts : 1
      multiplier *= params.fixedContracts / baseContracts
    }

    return Math.max(multiplier, 0)
  }

  private buildStrategyWeights(params: Record<string, number>): Record<string, number> {
    const weights: Record<string, number> = {}
    Object.entries(params).forEach(([key, value]) => {
      if (key.startsWith('strategy:')) {
        const strategyName = key.slice('strategy:'.length)
        weights[this.normalizeStrategyKey(strategyName)] = Math.max(0, value)
      }
    })
    return weights
  }

  private normalizeStrategyKey(strategy?: string): string {
    return (strategy || 'Unknown').toLowerCase()
  }

  private isRiskAcceptable(
    params: Record<string, number>,
    stats: PortfolioStats,
    scaledTrades: Trade[]
  ): boolean {
    if (typeof params.maxDrawdownPct === 'number' && stats.maxDrawdown > params.maxDrawdownPct) {
      return false
    }

    if (typeof params.consecutiveLossLimit === 'number') {
      const maxLosses = this.calculateMaxConsecutiveLosses(scaledTrades)
      if (maxLosses > params.consecutiveLossLimit) {
        return false
      }
    }

    if (typeof params.maxDailyLossPct === 'number') {
      const initialCapital = PortfolioStatsCalculator.calculateInitialCapital(scaledTrades)
      const maxDailyLoss = this.calculateMaxDailyLossPct(scaledTrades, initialCapital)
      if (maxDailyLoss > params.maxDailyLossPct) {
        return false
      }
    }

    return true
  }

  private calculateMaxConsecutiveLosses(trades: Trade[]): number {
    let maxLosses = 0
    let currentLosses = 0

    // trades are already sorted from applyScenario()
    trades.forEach((trade) => {
      if (trade.pl < 0) {
        currentLosses++
        maxLosses = Math.max(maxLosses, currentLosses)
      } else {
        currentLosses = 0
      }
    })

    return maxLosses
  }

  private calculateMaxDailyLossPct(trades: Trade[], initialCapital: number): number {
    if (initialCapital === 0) return 0

    const lossesByDay = new Map<string, number>()

    trades.forEach((trade) => {
      const dateKey = this.normalizeDateKey(trade.dateClosed || trade.dateOpened)
      lossesByDay.set(dateKey, (lossesByDay.get(dateKey) || 0) + trade.pl)
    })

    let maxLossPct = 0

    lossesByDay.forEach((pl) => {
      if (pl < 0) {
        const lossPct = (Math.abs(pl) / initialCapital) * 100
        maxLossPct = Math.max(maxLossPct, lossPct)
      }
    })

    return maxLossPct
  }

  private normalizeDateKey(date: Date | string): string {
    const parsed = new Date(date)
    return parsed.toISOString().split('T')[0]
  }

  private getTargetMetricValue(stats: PortfolioStats, target: WalkForwardConfig['optimizationTarget']): number {
    switch (target) {
      case 'profitFactor':
        return stats.profitFactor ?? Number.NEGATIVE_INFINITY
      case 'sharpeRatio':
        return stats.sharpeRatio ?? Number.NEGATIVE_INFINITY
      case 'sortinoRatio':
        return stats.sortinoRatio ?? Number.NEGATIVE_INFINITY
      case 'calmarRatio':
        return stats.calmarRatio ?? Number.NEGATIVE_INFINITY
      case 'cagr':
        return stats.cagr ?? Number.NEGATIVE_INFINITY
      case 'avgDailyPl':
        return stats.avgDailyPl ?? Number.NEGATIVE_INFINITY
      case 'winRate':
        return stats.winRate ?? Number.NEGATIVE_INFINITY
      case 'netPl':
      default:
        return stats.netPl ?? Number.NEGATIVE_INFINITY
    }
  }

  private async yieldToEventLoop(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new Error('Walk-forward analysis aborted')
    }
  }

  private buildResults(
    periods: WalkForwardPeriodResult[],
    config: WalkForwardConfig,
    totalPeriods: number,
    totalParameterTests: number,
    analyzedTrades: number,
    startedAt: Date,
    completedAt: Date = new Date(),
    skippedPeriods = 0
  ): WalkForwardResults {
    const summary = this.calculateSummary(periods)
    const stats = {
      totalPeriods,
      evaluatedPeriods: periods.length,
      skippedPeriods,
      totalParameterTests,
      analyzedTrades,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      consistencyScore: this.calculateConsistencyScore(periods),
      averagePerformanceDelta: this.calculateAveragePerformanceDelta(periods),
    }

    const robustnessScore = this.calculateRobustnessScore(summary, stats.consistencyScore)

    return {
      periods,
      summary: { ...summary, robustnessScore },
      stats,
    }
  }

  private calculateSummary(periods: WalkForwardPeriodResult[]): WalkForwardSummary {
    if (periods.length === 0) {
      return {
        avgInSamplePerformance: 0,
        avgOutOfSamplePerformance: 0,
        degradationFactor: 0,
        parameterStability: 0,
        robustnessScore: 0,
      }
    }

    const inSampleValues = periods.map((p) => p.targetMetricInSample).filter((value) => Number.isFinite(value))
    const outSampleValues = periods.map((p) => p.targetMetricOutOfSample).filter((value) => Number.isFinite(value))

    const avgInSample =
      inSampleValues.length > 0
        ? inSampleValues.reduce((sum, value) => sum + value, 0) / inSampleValues.length
        : 0
    const avgOutSample =
      outSampleValues.length > 0
        ? outSampleValues.reduce((sum, value) => sum + value, 0) / outSampleValues.length
        : 0

    const degradationFactor = avgInSample !== 0 ? avgOutSample / avgInSample : 0
    const parameterStability = this.calculateParameterStability(periods)

    return {
      avgInSamplePerformance: avgInSample,
      avgOutOfSamplePerformance: avgOutSample,
      degradationFactor,
      parameterStability,
      robustnessScore: 0,
    }
  }

  private calculateParameterStability(periods: WalkForwardPeriodResult[]): number {
    if (periods.length <= 1) return 1

    const parameterKeys = new Set<string>()
    periods.forEach((period) => {
      Object.keys(period.optimalParameters).forEach((key) => parameterKeys.add(key))
    })

    if (parameterKeys.size === 0) return 1

    const stabilityScores: number[] = []

    parameterKeys.forEach((key) => {
      const values = periods
        .map((period) => period.optimalParameters[key])
        .filter((value): value is number => typeof value === 'number')

      if (values.length <= 1) {
        stabilityScores.push(1)
        return
      }

      const mean =
        values.reduce((sum, value) => sum + value, 0) / values.length
      const variance =
        values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
      const stdDev = Math.sqrt(variance)

      // Normalize by mean to avoid requiring parameter ranges here
      const normalizedStd = mean !== 0 ? Math.min(Math.abs(stdDev / mean), 1) : Math.min(stdDev, 1)
      stabilityScores.push(1 - normalizedStd)
    })

    const avgStability = stabilityScores.reduce((sum, value) => sum + value, 0) / stabilityScores.length
    return Math.min(Math.max(avgStability, 0), 1)
  }

  private calculateConsistencyScore(periods: WalkForwardPeriodResult[]): number {
    if (periods.length === 0) return 0
    const profitable = periods.filter((period) => period.targetMetricOutOfSample >= 0)
    return profitable.length / periods.length
  }

  private calculateAveragePerformanceDelta(periods: WalkForwardPeriodResult[]): number {
    if (periods.length === 0) return 0
    const deltas = periods.map(
      (period) => period.targetMetricOutOfSample - period.targetMetricInSample
    )
    return deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length
  }

  private calculateRobustnessScore(summary: WalkForwardSummary, consistencyScore: number): number {
    const efficiencyScore = this.normalize(summary.degradationFactor, 0, 2)
    const stabilityScore = Math.min(Math.max(summary.parameterStability, 0), 1)
    const consistency = Math.min(Math.max(consistencyScore, 0), 1)

    const score = (efficiencyScore + stabilityScore + consistency) / 3
    return Math.min(Math.max(score, 0), 1)
  }

  private normalize(value: number, min: number, max: number): number {
    if (max === min) return 0
    const clamped = Math.max(Math.min(value, max), min)
    return (clamped - min) / (max - min)
  }
}
