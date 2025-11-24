// Core data models
export * from './trade'
export * from './daily-log'
export * from './portfolio-stats'
export * from './strategy-alignment'
export * from './block'
export * from './walk-forward'

// Type utilities
export type ProcessingStage = 'uploading' | 'parsing' | 'processing' | 'calculating' | 'storing'
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error'

// Error types
export interface ProcessingError {
  type: 'validation' | 'parsing' | 'calculation' | 'storage'
  message: string
  details?: Record<string, unknown>
  rowNumber?: number
  columnName?: string
}

export interface ValidationError extends ProcessingError {
  type: 'validation'
  field: string
  value: unknown
  expected: string
}

export interface ParsingError extends ProcessingError {
  type: 'parsing'
  line: number
  column?: string
  raw: string
}

// Re-export commonly used types
export type { AnalysisConfig, TimePeriod } from './portfolio-stats'
