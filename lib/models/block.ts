import { PortfolioStats, StrategyStats, PerformanceMetrics } from './portfolio-stats'
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

  // Processing status
  processingStatus: 'pending' | 'processing' | 'completed' | 'error'
  processingError?: string
  lastProcessedAt?: Date

  // Calculated statistics (computed from processed data)
  portfolioStats?: PortfolioStats
  strategyStats?: Record<string, StrategyStats>
  performanceMetrics?: PerformanceMetrics

  // Data references (stored in IndexedDB)
  dataReferences: {
    tradesStorageKey: string  // Key for trades in IndexedDB
    dailyLogStorageKey?: string  // Key for daily log in IndexedDB
    calculationsStorageKey?: string  // Key for cached calculations
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
  stats: {
    totalPnL: number
    winRate: number
    totalTrades: number
    avgWin: number
    avgLoss: number
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