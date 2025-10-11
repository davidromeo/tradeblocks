/**
 * Portfolio statistics based on legacy Python PortfolioStats class
 */
export interface PortfolioStats {
  totalTrades: number
  totalPl: number
  winningTrades: number
  losingTrades: number
  breakEvenTrades: number
  winRate: number  // 0-1 decimal, not percentage
  avgWin: number
  avgLoss: number
  maxWin: number
  maxLoss: number
  sharpeRatio?: number
  sortinoRatio?: number
  calmarRatio?: number
  cagr?: number  // Compound Annual Growth Rate
  kellyPercentage?: number
  maxDrawdown: number
  avgDailyPl: number
  totalCommissions: number
  netPl: number
  profitFactor: number
  initialCapital: number  // Starting portfolio value before any P/L
  // Streak and consistency metrics
  maxWinStreak?: number
  maxLossStreak?: number
  currentStreak?: number
  timeInDrawdown?: number  // Percentage of time in drawdown
  monthlyWinRate?: number
  weeklyWinRate?: number
}

/**
 * Strategy-specific statistics based on legacy Python StrategyStats class
 */
export interface StrategyStats {
  strategyName: string
  tradeCount: number
  totalPl: number
  winRate: number
  avgWin: number
  avgLoss: number
  maxWin: number
  maxLoss: number
  avgDte?: number  // Average days to expiration
  successRate: number
  profitFactor: number
}

/**
 * Performance metrics for charts and visualizations
 */
export interface PerformanceMetrics {
  cumulativePl: Array<{
    date: string
    cumulativePl: number
    tradePl: number
  }>
  drawdownData: Array<{
    date: string
    drawdown: number
    peak: number
  }>
  monthlyPl: Record<string, number>  // YYYY-MM -> P/L
  weeklyPl: Record<string, number>   // YYYY-WW -> P/L
  dailyPl: Record<string, number>    // YYYY-MM-DD -> P/L
}

/**
 * Analysis configuration settings
 */
export interface AnalysisConfig {
  riskFreeRate: number  // Annual risk-free rate for Sharpe/Sortino calculations
  useBusinessDaysOnly: boolean
  annualizationFactor: number  // 252 for business days, 365 for calendar days
  confidenceLevel: number  // 0.95 for 95% confidence
  drawdownThreshold: number  // Minimum drawdown % to consider significant
}

/**
 * Time period aggregation types
 */
export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'

/**
 * Calculation result with metadata
 */
export interface CalculationResult<T> {
  data: T
  calculatedAt: Date
  config: AnalysisConfig
  cacheKey: string
}

/**
 * Trade aggregation by strategy
 */
export interface StrategyBreakdown {
  [strategyName: string]: {
    trades: number
    totalPl: number
    winRate: number
    avgPl: number
    stats: StrategyStats
  }
}