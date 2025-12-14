/**
 * Reporting Trade Processor
 *
 * Parses the backtested strategy reporting CSV and converts it into
 * ReportingTrade objects ready for strategy alignment.
 */

import { ReportingTrade, RawReportingTradeData, REQUIRED_REPORTING_TRADE_COLUMNS, REPORTING_TRADE_COLUMN_ALIASES } from '../models/reporting-trade'
import { CSVParser, ParseProgress } from './csv-parser'
import { findMissingHeaders, normalizeHeaders } from '../utils/csv-headers'
import { ProcessingError, ValidationError } from '../models'
import { rawReportingTradeDataSchema, reportingTradeSchema } from '../models/validators'

export interface ReportingTradeProcessingConfig {
  maxRows?: number
  progressCallback?: (progress: ReportingTradeProcessingProgress) => void
}

export interface ReportingTradeProcessingProgress extends ParseProgress {
  stage: 'reading' | 'parsing' | 'validating' | 'converting' | 'completed'
  validTrades: number
  invalidTrades: number
}

export interface ReportingTradeProcessingResult {
  trades: ReportingTrade[]
  totalRows: number
  validTrades: number
  invalidTrades: number
  errors: ProcessingError[]
  warnings: string[]
  stats: {
    processingTimeMs: number
    strategies: string[]
    dateRange: { start: Date | null; end: Date | null }
    totalPL: number
  }
}

export class ReportingTradeProcessor {
  private config: Required<ReportingTradeProcessingConfig>

  constructor(config: ReportingTradeProcessingConfig = {}) {
    this.config = {
      maxRows: 50000,
      progressCallback: () => {},
      ...config,
    }
  }

  async processFile(file: File): Promise<ReportingTradeProcessingResult> {
    const startTime = Date.now()
    const errors: ProcessingError[] = []
    const warnings: string[] = []

    const csvParser = new CSVParser({
      maxRows: this.config.maxRows,
      progressCallback: (progress, rowsProcessed) => {
        this.config.progressCallback({
          stage: 'parsing',
          progress,
          rowsProcessed,
          totalRows: 0,
          errors: errors.length,
          validTrades: 0,
          invalidTrades: 0,
        })
      },
    })

    const parseResult = await csvParser.parseFileObject<RawReportingTradeData>(
      file,
      (row) => this.validateRawRow(row),
      (progress) => {
        this.config.progressCallback({
          ...progress,
          validTrades: 0,
          invalidTrades: 0,
        })
      }
    )

    errors.push(...parseResult.errors)
    warnings.push(...parseResult.warnings)

    const normalizedHeaders = normalizeHeaders(parseResult.headers, REPORTING_TRADE_COLUMN_ALIASES)
    const missingColumns = findMissingHeaders(normalizedHeaders, REQUIRED_REPORTING_TRADE_COLUMNS)
    if (missingColumns.length > 0) {
      throw new Error(`Missing required reporting trade columns: ${missingColumns.join(', ')}`)
    }

    this.config.progressCallback({
      stage: 'converting',
      progress: 0,
      rowsProcessed: 0,
      totalRows: parseResult.data.length,
      errors: errors.length,
      validTrades: 0,
      invalidTrades: 0,
    })

    const trades: ReportingTrade[] = []
    let validTrades = 0
    let invalidTrades = 0

    for (let i = 0; i < parseResult.data.length; i++) {
      const rawTrade = parseResult.data[i]
      try {
        const trade = this.convertToReportingTrade(rawTrade)
        trades.push(trade)
        validTrades++
      } catch (error) {
        invalidTrades++
        const validationError: ValidationError = {
          type: 'validation',
          message: `Reporting trade conversion failed at row ${i + 2}: ${error instanceof Error ? error.message : String(error)}`,
          field: 'unknown',
          value: rawTrade,
          expected: 'Valid reporting trade data',
        }
        errors.push(validationError)
      }

      if (i % 100 === 0 || i === parseResult.data.length - 1) {
        const progress = Math.round((i / parseResult.data.length) * 100)
        this.config.progressCallback({
          stage: 'converting',
          progress,
          rowsProcessed: i + 1,
          totalRows: parseResult.data.length,
          errors: errors.length,
          validTrades,
          invalidTrades,
        })
      }
    }

    trades.sort((a, b) => new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime())

    const processingTimeMs = Date.now() - startTime
    const strategies = Array.from(new Set(trades.map(t => t.strategy))).sort()
    const dates = trades.map(t => t.dateOpened)
    const dateRange = {
      start: dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null,
      end: dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null,
    }
    const totalPL = trades.reduce((sum, trade) => sum + trade.pl, 0)

    this.config.progressCallback({
      stage: 'completed',
      progress: 100,
      rowsProcessed: parseResult.totalRows,
      totalRows: parseResult.totalRows,
      errors: errors.length,
      validTrades,
      invalidTrades,
    })

    return {
      trades,
      totalRows: parseResult.totalRows,
      validTrades,
      invalidTrades,
      errors,
      warnings,
      stats: {
        processingTimeMs,
        strategies,
        dateRange,
        totalPL,
      },
    }
  }

  private validateRawRow(row: Record<string, string>): RawReportingTradeData | null {
    try {
      const normalizedRow: Record<string, string> = { ...row }
      Object.entries(REPORTING_TRADE_COLUMN_ALIASES).forEach(([alias, canonical]) => {
        if (normalizedRow[alias] !== undefined) {
          normalizedRow[canonical] = normalizedRow[alias]
          delete normalizedRow[alias]
        }
      })

      if (!normalizedRow['Strategy'] || normalizedRow['Strategy'].trim() === '') {
        normalizedRow['Strategy'] = 'Unknown'
      }

      const parsed = rawReportingTradeDataSchema.parse(normalizedRow)

      return parsed
    } catch {
      return null
    }
  }

  /**
   * Parse a YYYY-MM-DD date string preserving the calendar date.
   *
   * Option Omega exports dates in Eastern time. JavaScript's new Date('YYYY-MM-DD')
   * parses as UTC midnight, which when converted to local time can shift to the
   * previous day (e.g., Dec 11 UTC → Dec 10 7pm EST).
   *
   * This method creates a Date representing midnight local time on the specified
   * calendar date, so Dec 11 in the CSV becomes Dec 11 in the app regardless of timezone.
   */
  private parseDatePreservingCalendarDay(dateStr: string): Date {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) {
      const [, year, month, day] = match
      // Create date at midnight local time - this preserves the calendar date
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    }
    // Fall back to default parsing for other formats
    return new Date(dateStr)
  }

  private convertToReportingTrade(raw: RawReportingTradeData): ReportingTrade {
    const dateOpened = this.parseDatePreservingCalendarDay(raw['Date Opened'])
    if (Number.isNaN(dateOpened.getTime())) {
      throw new Error(`Invalid Date Opened value: ${raw['Date Opened']}`)
    }

    const dateClosed = raw['Date Closed'] ? this.parseDatePreservingCalendarDay(raw['Date Closed']) : undefined
    if (dateClosed && Number.isNaN(dateClosed.getTime())) {
      throw new Error(`Invalid Date Closed value: ${raw['Date Closed']}`)
    }

    const reportingTrade = {
      strategy: raw['Strategy'].trim(),
      dateOpened,
      openingPrice: parseFloat(raw['Opening Price']),
      legs: raw['Legs'].trim(),
      initialPremium: parseFloat(raw['Initial Premium']),
      numContracts: parseFloat(raw['No. of Contracts']),
      pl: parseFloat(raw['P/L']),
      closingPrice: raw['Closing Price'] ? parseFloat(raw['Closing Price']) : undefined,
      dateClosed,
      avgClosingCost: raw['Avg. Closing Cost'] ? parseFloat(raw['Avg. Closing Cost']) : undefined,
      reasonForClose: raw['Reason For Close']?.trim() || undefined,
    }

    return reportingTradeSchema.parse(reportingTrade)
  }
}
