import { PortfolioStats, StrategyStats, PerformanceMetrics } from './portfolio-stats'
import { StrategyAlignment } from './strategy-alignment'
import { EquityCurve } from './equity-curve'
// import { Trade } from './trade'
// import { DailyLog } from './daily-log'

/**
 * Enhanced Block interface for processed trading data
 * Extends the basic block with references to parsed and calculated data
 */
export interface ProcessedBlock {
  // Basic block metadata
  id: string
  name: string
  description?: string
  isActive: boolean
  created: Date
  lastModified: Date

  // File metadata (pre-processing)
  tradeLog: {
    fileName: string
    fileSize: number
    originalRowCount: number  // Raw CSV rows
    processedRowCount: number  // Valid trades after cleaning
    uploadedAt: Date
  }

  dailyLog?: {
    fileName: string
    fileSize: number
    originalRowCount: number
    processedRowCount: number
    uploadedAt: Date
  }

  reportingLog?: {
    fileName: string
    fileSize: number
    originalRowCount: number
    processedRowCount: number
    uploadedAt: Date
  }

  // Processing status
  processingStatus: 'pending' | 'processing' | 'completed' | 'error'
  processingError?: string
  lastProcessedAt?: Date

  // Calculated statistics (computed from processed data)
  portfolioStats?: PortfolioStats
  strategyStats?: Record<string, StrategyStats>
  performanceMetrics?: PerformanceMetrics

  // Strategy alignment metadata for comparison workflows
  strategyAlignment?: {
    version: number
    updatedAt: Date
    mappings: StrategyAlignment[]
  }

  // Data references (stored in IndexedDB)
  dataReferences: {
    tradesStorageKey: string  // Key for trades in IndexedDB
    dailyLogStorageKey?: string  // Key for daily log in IndexedDB
    calculationsStorageKey?: string  // Key for cached calculations
    reportingLogStorageKey?: string  // Key for reporting log in IndexedDB
  }

  // Analysis configuration
  analysisConfig: {
    riskFreeRate: number
    useBusinessDaysOnly: boolean
    annualizationFactor: number
    confidenceLevel: number
  }
}

/**
 * Basic block interface (backward compatibility)
 */
export interface Block {
  id: string
  name: string
  description?: string
  isActive: boolean
  created: Date
  lastModified: Date
  tradeLog: {
    fileName: string
    rowCount: number
    fileSize: number
  }
  dailyLog?: {
    fileName: string
    rowCount: number
    fileSize: number
  }
  reportingLog?: {
    fileName: string
    rowCount: number
    fileSize: number
  }
  stats: {
    totalPnL: number
    winRate: number
    totalTrades: number
    avgWin: number
    avgLoss: number
  }
  strategyAlignment?: {
    mappings: StrategyAlignment[]
    updatedAt: Date
  }
}

/**
 * Block creation request (for new uploads)
 */
export interface CreateBlockRequest {
  name: string
  description?: string
  tradeLogFile: File
  dailyLogFile?: File
  analysisConfig?: Partial<ProcessedBlock['analysisConfig']>
}

/**
 * Block update request
 */
export interface UpdateBlockRequest {
  name?: string
  description?: string
  analysisConfig?: Partial<ProcessedBlock['analysisConfig']>
}

/**
 * File upload progress
 */
export interface UploadProgress {
  stage: 'uploading' | 'parsing' | 'processing' | 'calculating' | 'storing'
  progress: number  // 0-100
  message: string
  details?: {
    totalRows?: number
    processedRows?: number
    errors?: string[]
  }
}

/**
 * Block processing result
 */
export interface ProcessingResult {
  success: boolean
  block?: ProcessedBlock
  errors?: string[]
  warnings?: string[]
  stats?: {
    tradesProcessed: number
    dailyEntriesProcessed: number
    processingTimeMs: number
  }
}

/**
 * Block type discriminator
 */
export type BlockType = 'trade-based' | 'equity-curve' | 'super'

/**
 * Generic Block for equity curve data (without trade-level detail)
 * Contains one or more strategy equity curves
 */
export interface GenericBlock {
  // Basic block metadata
  id: string
  name: string
  description?: string
  type: 'equity-curve'  // Discriminator
  isActive: boolean
  created: Date
  lastModified: Date

  // Equity curve metadata
  equityCurves: Array<{
    strategyName: string
    fileName: string
    fileSize: number
    originalRowCount: number
    processedRowCount: number
    uploadedAt: Date
    startingCapital: number
  }>

  // Processing status
  processingStatus: 'pending' | 'processing' | 'completed' | 'error'
  processingError?: string
  lastProcessedAt?: Date

  // Calculated statistics (computed from equity curves)
  portfolioStats?: PortfolioStats
  strategyStats?: Record<string, StrategyStats>
  performanceMetrics?: PerformanceMetrics

  // Correlation matrix for multiple strategies
  correlationMatrix?: {
    strategies: string[]
    pearson: number[][]
    spearman?: number[][]
    kendall?: number[][]
  }

  // Data references (stored in IndexedDB)
  dataReferences: {
    equityCurveStorageKeys: Record<string, string>  // strategyName -> storage key
    calculationsStorageKey?: string
  }

  // Analysis configuration
  analysisConfig: {
    riskFreeRate: number
    useBusinessDaysOnly: boolean
    annualizationFactor: number
    confidenceLevel: number
  }
}

/**
 * Date alignment strategy for combining blocks with different date ranges
 */
export type DateAlignmentStrategy = 'intersection' | 'union-fill-zero' | 'union-forward-fill'

/**
 * Super Block for combining multiple blocks (trade-based + equity-curve)
 * Provides portfolio-level analytics across different data sources
 */
export interface SuperBlock {
  // Basic block metadata
  id: string
  name: string
  description?: string
  type: 'super'  // Discriminator
  isActive: boolean
  created: Date
  lastModified: Date

  // Component blocks
  componentBlocks: Array<{
    blockId: string
    blockType: 'trade-based' | 'equity-curve'
    blockName: string
    weight?: number  // Optional weighting for portfolio allocation
    addedAt: Date
  }>

  // Date alignment configuration
  dateAlignment: {
    strategy: DateAlignmentStrategy
    alignedDateRange: {
      start: Date
      end: Date
    }
  }

  // Processing status
  processingStatus: 'pending' | 'processing' | 'completed' | 'error'
  processingError?: string
  lastProcessedAt?: Date

  // Combined statistics (computed from all component blocks)
  portfolioStats?: PortfolioStats
  componentStats?: Record<string, PortfolioStats>  // Per-component stats

  // Correlation matrix across all strategies from all blocks
  correlationMatrix?: {
    strategies: string[]
    pearson: number[][]
    spearman?: number[][]
    kendall?: number[][]
  }

  // Data quality indicators
  dataQuality: {
    hasTradeData: boolean  // Any component has trade-level data
    hasDailyLogs: boolean  // Any component has daily logs
    hasEquityCurves: boolean  // Any component has equity curves
    alignmentWarnings: string[]  // Warnings about date mismatches, etc.
  }

  // Analysis configuration
  analysisConfig: {
    riskFreeRate: number
    useBusinessDaysOnly: boolean
    annualizationFactor: number
    confidenceLevel: number
  }
}

/**
 * Union type for all block types
 */
export type AnyBlock = ProcessedBlock | GenericBlock | SuperBlock

/**
 * Type guard for ProcessedBlock
 */
export function isProcessedBlock(block: AnyBlock): block is ProcessedBlock {
  return !('type' in block) || block.type === undefined
}

/**
 * Type guard for GenericBlock
 */
export function isGenericBlock(block: AnyBlock): block is GenericBlock {
  return 'type' in block && block.type === 'equity-curve'
}

/**
 * Type guard for SuperBlock
 */
export function isSuperBlock(block: AnyBlock): block is SuperBlock {
  return 'type' in block && block.type === 'super'
}
