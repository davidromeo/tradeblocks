/**
 * Calculations Engine - Main exports
 *
 * Provides comprehensive calculation functionality for portfolio analysis.
 */

export * from './portfolio-stats'
export * from './performance'
export * from './walk-forward-analyzer'
export * from './walk-forward-verdict'
export * from './correlation'
export * from './monte-carlo'
export * from './tail-risk-analysis'
export * from './kelly'
export * from './daily-exposure'
export * from './margin-timeline'
export * from './streak-analysis'
export * from './flexible-filter'
export * from './regime-comparison'
export * from './table-aggregation'
export * from './threshold-analysis'
export * from './static-dataset-matcher'
export * from './trend-detection'
export * from './period-segmentation'
export * from './rolling-metrics'
export * from './mc-regime-comparison'
export * from './walk-forward-degradation'
export * from './trade-matching'
export * from './live-alignment'
// Re-export from cumulative-distribution excluding conflicting name
export {
  type CumulativeDistributionPoint,
  type CumulativeDistributionAnalysis,
  type DistributionStats,
  type ThresholdTradeoff,
  calculateCumulativeDistribution,
  findOptimalThreshold as findOptimalDistributionThreshold,
} from './cumulative-distribution'
export * from './walk-forward-interpretation'
export * from './enrich-trades'
export * from './statistical-utils'
export * from './mfe-mae'

// Re-export types for convenience
export * from '../models/portfolio-stats'

// Calculation cache interface
export interface CalculationCache {
  portfolioStats?: unknown
  performanceMetrics?: unknown
  strategyStats?: unknown
  lastCalculated: Date
  dataHash: string
}

// Utility function to generate data hash for caching
export function generateDataHash(trades: unknown[], dailyLogs?: unknown[]): string {
  const data = {
    tradeCount: trades.length,
    firstTradeDate: trades.length > 0 ? (trades[0] as { dateOpened?: string })?.dateOpened : null,
    lastTradeDate: trades.length > 0 ? (trades[trades.length - 1] as { dateOpened?: string })?.dateOpened : null,
    dailyLogCount: dailyLogs?.length || 0,
  }

  return btoa(JSON.stringify(data))
}

// Calculation orchestrator
export class CalculationOrchestrator {
  private cache = new Map<string, CalculationCache>()

  /**
   * Calculate all metrics for a block
   */
  async calculateAll(
    blockId: string,
    trades: unknown[],
    dailyLogs?: unknown[],
    config?: unknown
  ): Promise<{
    portfolioStats: unknown
    strategyStats: unknown
    performanceMetrics: unknown
    calculationTime: number
  }> {
    const startTime = Date.now()

    // Check cache
    const dataHash = generateDataHash(trades, dailyLogs)
    const cached = this.cache.get(blockId)

    if (cached && cached.dataHash === dataHash) {
      return {
        portfolioStats: cached.portfolioStats,
        strategyStats: cached.strategyStats,
        performanceMetrics: cached.performanceMetrics,
        calculationTime: Date.now() - startTime,
      }
    }

    // Calculate fresh results
    const calculator = new PortfolioStatsCalculator(config as Partial<AnalysisConfig>)
    const portfolioStats = calculator.calculatePortfolioStats(trades as Trade[], dailyLogs as DailyLogEntry[])
    const strategyStats = calculator.calculateStrategyStats(trades as Trade[])
    const performanceMetrics = PerformanceCalculator.calculatePerformanceMetrics(trades as Trade[], dailyLogs as DailyLogEntry[])

    // Cache results
    this.cache.set(blockId, {
      portfolioStats,
      strategyStats,
      performanceMetrics,
      lastCalculated: new Date(),
      dataHash,
    })

    return {
      portfolioStats,
      strategyStats,
      performanceMetrics,
      calculationTime: Date.now() - startTime,
    }
  }

  /**
   * Clear cache for a specific block
   */
  clearCache(blockId: string): void {
    this.cache.delete(blockId)
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size
  }
}

// Global calculation orchestrator instance
export const calculationOrchestrator = new CalculationOrchestrator()

// Import legacy calculation classes for compatibility
import { PortfolioStatsCalculator } from './portfolio-stats'
import { PerformanceCalculator } from './performance'
import { Trade } from '../models/trade'
import { DailyLogEntry } from '../models/daily-log'
import { AnalysisConfig } from '../models/portfolio-stats'
