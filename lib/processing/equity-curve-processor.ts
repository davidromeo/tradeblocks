/**
 * Equity Curve Processor
 *
 * Handles parsing and processing of generic equity curve CSV files.
 * Supports flexible column mapping, multiple date formats, and scientific notation.
 */

import {
  EquityCurveEntry,
  EquityCurve,
  EquityCurveUploadConfig,
  EquityCurveProcessingResult,
  DateFormat,
} from '../models/equity-curve'
import { ProcessingError } from '../models'
import { CSVParser, ParseProgress } from './csv-parser'

/**
 * Equity curve processing configuration
 */
export interface EquityCurveProcessingConfig {
  maxRows?: number
  strictValidation?: boolean
  progressCallback?: (progress: EquityCurveProcessingProgress) => void
}

/**
 * Equity curve processing progress
 */
export interface EquityCurveProcessingProgress extends ParseProgress {
  stage: 'reading' | 'parsing' | 'validating' | 'converting' | 'calculating' | 'completed'
  validEntries: number
  invalidEntries: number
  skippedRows: number
}

/**
 * Parse date string according to specified format
 */
function parseDate(dateStr: string, format: DateFormat): Date | null {
  const cleanDate = dateStr.trim()
  if (!cleanDate) return null

  try {
    let year: number, month: number, day: number

    switch (format) {
      case 'YYYY-MM-DD': {
        const match = cleanDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
        if (!match) return null
        ;[, year, month, day] = match.map(Number)
        break
      }
      case 'MM/DD/YYYY': {
        const match = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (!match) return null
        ;[, month, day, year] = match.map(Number)
        break
      }
      case 'DD/MM/YYYY': {
        const match = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (!match) return null
        ;[, day, month, year] = match.map(Number)
        break
      }
      case 'MM-DD-YYYY': {
        const match = cleanDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
        if (!match) return null
        ;[, month, day, year] = match.map(Number)
        break
      }
      case 'DD-MM-YYYY': {
        const match = cleanDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
        if (!match) return null
        ;[, day, month, year] = match.map(Number)
        break
      }
      case 'YYYY/MM/DD': {
        const match = cleanDate.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
        if (!match) return null
        ;[, year, month, day] = match.map(Number)
        break
      }
      default:
        return null
    }

    const date = new Date(year, month - 1, day)

    // Validate the date is real (e.g., not Feb 31)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null
    }

    return date
  } catch {
    return null
  }
}

/**
 * Parse numeric value with scientific notation support
 */
function parseNumeric(value: string): number | null {
  const cleaned = value.trim()
  if (!cleaned || cleaned.toLowerCase() === 'nan') return null

  try {
    // Remove currency symbols and commas
    const normalized = cleaned.replace(/[$,]/g, '')

    // Parse as float (handles scientific notation automatically)
    const parsed = parseFloat(normalized)

    if (isNaN(parsed) || !isFinite(parsed)) return null

    return parsed
  } catch {
    return null
  }
}

/**
 * Equity curve processor class
 */
export class EquityCurveProcessor {
  private config: Required<EquityCurveProcessingConfig>

  constructor(config: EquityCurveProcessingConfig = {}) {
    this.config = {
      maxRows: 50000,
      strictValidation: false,
      progressCallback: () => {},
      ...config,
    }
  }

  /**
   * Process equity curve file with user-defined column mapping
   */
  async processFile(
    file: File,
    uploadConfig: EquityCurveUploadConfig
  ): Promise<EquityCurveProcessingResult> {
    const startTime = Date.now()
    const errors: Array<{ row: number; message: string }> = []
    const warnings: string[] = []
    const skippedDates: Date[] = []

    try {
      // Validate file
      const fileValidation = CSVParser.validateCSVFile(file)
      if (!fileValidation.valid) {
        throw new Error(fileValidation.error)
      }

      // Configure CSV parser
      const csvParser = new CSVParser({
        maxRows: this.config.maxRows,
        progressCallback: (progress, rowsProcessed) => {
          this.config.progressCallback({
            stage: 'parsing',
            progress,
            rowsProcessed,
            totalRows: 0,
            errors: 0,
            validEntries: 0,
            invalidEntries: 0,
            skippedRows: 0,
          })
        },
      })

      // Parse CSV without validation (we'll handle that ourselves)
      const parseResult = await csvParser.parseFileObject(file)

      // Skip header row if configured
      const dataRows = uploadConfig.skipHeaderRow
        ? parseResult.data.slice(1)
        : parseResult.data

      if (dataRows.length === 0) {
        throw new Error('No data rows found in CSV')
      }

      // Extract column mapping
      const { dateColumn, dailyReturnColumn, marginReqColumn, accountValueColumn } =
        uploadConfig.columnMapping

      // Update progress for conversion stage
      this.config.progressCallback({
        stage: 'converting',
        progress: 0,
        rowsProcessed: 0,
        totalRows: dataRows.length,
        errors: errors.length,
        validEntries: 0,
        invalidEntries: 0,
        skippedRows: 0,
      })

      // Convert rows to equity curve entries
      const entries: EquityCurveEntry[] = []
      let validEntries = 0
      let invalidEntries = 0
      let skippedRows = 0
      let cumulativeReturn = 1.0 // For calculating account value

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        const rowNum = i + (uploadConfig.skipHeaderRow ? 2 : 1) // Account for 0-index and possible header

        try {
          // Convert row object to array of values
          const rowValues = Object.values(row)

          // Extract values by column index
          const dateStr = rowValues[dateColumn] as string
          const dailyReturnStr = rowValues[dailyReturnColumn] as string
          const marginReqStr = rowValues[marginReqColumn] as string
          const accountValueStr =
            accountValueColumn !== undefined ? (rowValues[accountValueColumn] as string) : undefined

          // Parse date
          const date = parseDate(dateStr, uploadConfig.dateFormat)
          if (!date) {
            // Skip row with missing date
            skippedRows++
            skippedDates.push(new Date(dateStr || 'Invalid'))
            warnings.push(`Row ${rowNum}: Skipped due to invalid or missing date: "${dateStr}"`)
            continue
          }

          // Parse daily return
          const dailyReturnPct = parseNumeric(dailyReturnStr)
          if (dailyReturnPct === null) {
            invalidEntries++
            errors.push({
              row: rowNum,
              message: `Invalid daily return value: "${dailyReturnStr}"`,
            })
            if (this.config.strictValidation) throw new Error(`Invalid daily return at row ${rowNum}`)
            continue
          }

          // Parse margin requirement
          const marginReq = parseNumeric(marginReqStr)
          if (marginReq === null) {
            invalidEntries++
            errors.push({
              row: rowNum,
              message: `Invalid margin requirement value: "${marginReqStr}"`,
            })
            if (this.config.strictValidation) throw new Error(`Invalid margin req at row ${rowNum}`)
            continue
          }

          // Calculate or parse account value
          let accountValue: number
          if (accountValueStr !== undefined && accountValueStr.trim() !== '') {
            const parsed = parseNumeric(accountValueStr)
            if (parsed === null) {
              invalidEntries++
              errors.push({
                row: rowNum,
                message: `Invalid account value: "${accountValueStr}"`,
              })
              if (this.config.strictValidation) throw new Error(`Invalid account value at row ${rowNum}`)
              continue
            }
            accountValue = parsed
          } else {
            // Calculate from cumulative returns
            cumulativeReturn *= 1 + dailyReturnPct
            accountValue = uploadConfig.startingCapital * cumulativeReturn
          }

          // Validate ranges
          if (marginReq < 0 || marginReq > 1) {
            warnings.push(
              `Row ${rowNum}: Margin requirement ${(marginReq * 100).toFixed(2)}% is outside normal range [0%, 100%]`
            )
          }

          if (Math.abs(dailyReturnPct) > 0.5) {
            warnings.push(
              `Row ${rowNum}: Daily return ${(dailyReturnPct * 100).toFixed(2)}% is unusually large (>50%)`
            )
          }

          // Create entry
          const entry: EquityCurveEntry = {
            date,
            dailyReturnPct,
            marginReq,
            accountValue,
            strategyName: uploadConfig.strategyName,
          }

          entries.push(entry)
          validEntries++
        } catch (error) {
          invalidEntries++
          errors.push({
            row: rowNum,
            message: `Entry conversion failed: ${error instanceof Error ? error.message : String(error)}`,
          })

          if (this.config.strictValidation) throw error
        }

        // Update progress periodically
        if (i % 100 === 0 || i === dataRows.length - 1) {
          const progress = Math.round((i / dataRows.length) * 100)
          this.config.progressCallback({
            stage: 'converting',
            progress,
            rowsProcessed: i + 1,
            totalRows: dataRows.length,
            errors: errors.length,
            validEntries,
            invalidEntries,
            skippedRows,
          })
        }
      }

      if (entries.length === 0) {
        throw new Error('No valid entries found in CSV')
      }

      // Sort entries by date
      entries.sort((a, b) => a.date.getTime() - b.date.getTime())

      // Calculate statistics
      this.config.progressCallback({
        stage: 'calculating',
        progress: 50,
        rowsProcessed: dataRows.length,
        totalRows: dataRows.length,
        errors: errors.length,
        validEntries,
        invalidEntries,
        skippedRows,
      })

      const dateRangeStart = entries[0].date
      const dateRangeEnd = entries[entries.length - 1].date
      const finalAccountValue = entries[entries.length - 1].accountValue
      const totalReturn = (finalAccountValue - uploadConfig.startingCapital) / uploadConfig.startingCapital

      // Calculate max drawdown
      let peak = uploadConfig.startingCapital
      let maxDrawdown = 0
      for (const entry of entries) {
        if (entry.accountValue > peak) {
          peak = entry.accountValue
        }
        const drawdown = (entry.accountValue - peak) / peak
        if (drawdown < maxDrawdown) {
          maxDrawdown = drawdown
        }
      }

      // Calculate volatility (std dev of returns)
      const returns = entries.map(e => e.dailyReturnPct)
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      const volatility = Math.sqrt(variance)

      // Calculate Sharpe ratio (annualized)
      const annualizationFactor = 252 // Trading days per year
      const annualizedReturn = avgReturn * annualizationFactor
      const annualizedVolatility = volatility * Math.sqrt(annualizationFactor)
      const sharpeRatio = annualizedVolatility > 0 ? annualizedReturn / annualizedVolatility : undefined

      const curve: EquityCurve = {
        strategyName: uploadConfig.strategyName,
        entries,
        uploadTimestamp: new Date(),
        filename: file.name,
        totalEntries: entries.length,
        skippedRows,
        dateRangeStart,
        dateRangeEnd,
        startingCapital: uploadConfig.startingCapital,
        finalAccountValue,
        totalReturn,
        maxDrawdown,
      }

      // Final progress update
      this.config.progressCallback({
        stage: 'completed',
        progress: 100,
        rowsProcessed: dataRows.length,
        totalRows: dataRows.length,
        errors: errors.length,
        validEntries,
        invalidEntries,
        skippedRows,
      })

      return {
        curve,
        totalRows: dataRows.length,
        validEntries,
        invalidEntries,
        skippedDates,
        errors,
        warnings,
        stats: {
          processingTimeMs: Date.now() - startTime,
          avgDailyReturn: avgReturn,
          volatility,
          sharpeRatio,
        },
      }
    } catch (error) {
      throw new Error(
        `Equity curve processing failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Preview CSV columns (first 5 rows) for column mapping UI
   */
  async previewCSV(file: File, skipHeaderRow: boolean = true): Promise<{
    headers: string[]
    preview: string[][]
    totalRows: number
  }> {
    const csvParser = new CSVParser({ maxRows: 10 })
    const result = await csvParser.parseFileObject(file)

    const headers = result.headers
    const dataRows = skipHeaderRow ? result.data.slice(1) : result.data
    const preview = dataRows.slice(0, 5).map(row => Object.values(row))

    return {
      headers,
      preview,
      totalRows: result.totalRows,
    }
  }
}
