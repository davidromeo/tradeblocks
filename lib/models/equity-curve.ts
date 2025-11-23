/**
 * Equity Curve models for generic strategy performance data
 * Used for importing strategy equity curves without trade-level detail
 */

/**
 * Single entry in an equity curve
 */
export interface EquityCurveEntry {
  date: Date
  dailyReturnPct: number  // Daily return as decimal (0.005 = 0.5%)
  marginReq: number  // Margin requirement as decimal (0.5 = 50%)
  accountValue: number  // Account value after this day's return
  strategyName: string  // Name of the strategy this entry belongs to
}

/**
 * Raw equity curve data as it comes from CSV before processing
 */
export interface RawEquityCurveData {
  [key: string]: string  // Flexible mapping - user defines columns
}

/**
 * Column mapping for equity curve CSV
 */
export interface EquityCurveColumnMapping {
  dateColumn: number  // Column index (0-based) for date
  dailyReturnColumn: number  // Column index for daily return %
  marginReqColumn: number  // Column index for margin requirement %
  accountValueColumn?: number  // Optional - can be calculated from returns
}

/**
 * Date format options for parsing
 */
export type DateFormat =
  | 'YYYY-MM-DD'
  | 'MM/DD/YYYY'
  | 'DD/MM/YYYY'
  | 'MM-DD-YYYY'
  | 'DD-MM-YYYY'
  | 'YYYY/MM/DD'

/**
 * Configuration for equity curve upload
 */
export interface EquityCurveUploadConfig {
  strategyName: string
  startingCapital: number
  columnMapping: EquityCurveColumnMapping
  dateFormat: DateFormat
  skipHeaderRow: boolean
}

/**
 * Processed equity curve collection with metadata
 */
export interface EquityCurve {
  strategyName: string
  entries: EquityCurveEntry[]
  uploadTimestamp: Date
  filename: string
  totalEntries: number
  skippedRows: number  // Rows with missing dates
  dateRangeStart: Date
  dateRangeEnd: Date
  startingCapital: number
  finalAccountValue: number
  totalReturn: number  // Total return as decimal
  maxDrawdown: number  // Max drawdown as decimal (negative)
}

/**
 * Equity curve processing result
 */
export interface EquityCurveProcessingResult {
  curve: EquityCurve
  totalRows: number
  validEntries: number
  invalidEntries: number
  skippedDates: Date[]  // Dates that were skipped due to missing data
  errors: Array<{
    row: number
    message: string
  }>
  warnings: string[]
  stats: {
    processingTimeMs: number
    avgDailyReturn: number
    volatility: number  // Standard deviation of returns
    sharpeRatio?: number
  }
}
