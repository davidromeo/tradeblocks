/**
 * Static Dataset Processor
 *
 * Processes CSV files for static datasets (VIX, SPX OHLC, etc.)
 * First column is always the timestamp, remaining columns are data values.
 */

import { CSVParser, type CSVParseResult, type ParseProgress } from './csv-parser'
import type { StaticDataset, StaticDatasetRow, MatchStrategy } from '../models/static-dataset'

/**
 * Result of processing a static dataset CSV
 */
export interface StaticDatasetProcessResult {
  dataset: StaticDataset
  rows: Omit<StaticDatasetRow, 'datasetId'>[]
  warnings: string[]
  errors: string[]
}

/**
 * Options for processing a static dataset
 */
export interface ProcessStaticDatasetOptions {
  /** User-provided name for the dataset (used as field prefix) */
  name: string
  /** Original filename */
  fileName: string
  /** Default match strategy */
  matchStrategy?: MatchStrategy
  /** Progress callback */
  progressCallback?: (progress: ParseProgress) => void
}

/**
 * Parse a timestamp string into a Date object
 * Supports common formats: ISO 8601, US date formats, etc.
 */
function parseTimestamp(value: string): Date | null {
  if (!value || value.trim() === '') {
    return null
  }

  const trimmed = value.trim()

  // Try ISO 8601 format first (most reliable)
  const isoDate = new Date(trimmed)
  if (!isNaN(isoDate.getTime())) {
    return isoDate
  }

  // Try common date formats
  // MM/DD/YYYY or MM-DD-YYYY
  const usDateMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (usDateMatch) {
    const [, month, day, year, hours, minutes, seconds] = usDateMatch
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hours ? parseInt(hours) : 0,
      minutes ? parseInt(minutes) : 0,
      seconds ? parseInt(seconds) : 0
    )
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  // Try YYYY/MM/DD or YYYY-MM-DD
  const isoDateMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (isoDateMatch) {
    const [, year, month, day, hours, minutes, seconds] = isoDateMatch
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      hours ? parseInt(hours) : 0,
      minutes ? parseInt(minutes) : 0,
      seconds ? parseInt(seconds) : 0
    )
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  return null
}

/**
 * Parse a value string, attempting to convert to number if possible
 */
function parseValue(value: string): number | string {
  if (!value || value.trim() === '') {
    return ''
  }

  const trimmed = value.trim()

  // Remove currency symbols and commas
  const cleaned = trimmed.replace(/[$,€£¥]/g, '').replace(/,/g, '')

  // Remove percentage sign and convert
  const isPercentage = cleaned.endsWith('%')
  const numericStr = isPercentage ? cleaned.slice(0, -1) : cleaned

  const parsed = parseFloat(numericStr)

  if (!isNaN(parsed) && isFinite(parsed)) {
    // If it was a percentage, keep as decimal (user can interpret as needed)
    return isPercentage ? parsed / 100 : parsed
  }

  // Return original string if not a number
  return trimmed
}

/**
 * Generate a unique ID for a static dataset
 */
function generateDatasetId(): string {
  return `sd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Process a static dataset CSV file
 */
export async function processStaticDatasetFile(
  file: File,
  options: ProcessStaticDatasetOptions
): Promise<StaticDatasetProcessResult> {
  const parser = new CSVParser({
    maxRows: 500000, // Allow larger files for time-series data
    skipEmptyLines: true,
    trimValues: true,
  })

  const warnings: string[] = []
  const errors: string[] = []

  // Parse CSV
  const parseResult: CSVParseResult = await parser.parseFileObject(
    file,
    undefined,
    options.progressCallback
  )

  // Add parsing errors
  for (const error of parseResult.errors) {
    errors.push(error.message)
  }

  // Add parsing warnings
  warnings.push(...parseResult.warnings)

  if (parseResult.data.length === 0) {
    errors.push('No data rows found in CSV file')
    return {
      dataset: createEmptyDataset(options),
      rows: [],
      warnings,
      errors,
    }
  }

  // First column is timestamp, rest are data columns
  const headers = parseResult.headers
  if (headers.length < 2) {
    errors.push('CSV must have at least 2 columns (timestamp + at least one data column)')
    return {
      dataset: createEmptyDataset(options),
      rows: [],
      warnings,
      errors,
    }
  }

  const timestampColumn = headers[0]
  const dataColumns = headers.slice(1)

  // Process rows
  const rows: Omit<StaticDatasetRow, 'datasetId'>[] = []
  let minTimestamp: Date | null = null
  let maxTimestamp: Date | null = null
  let invalidTimestampCount = 0

  for (let i = 0; i < parseResult.data.length; i++) {
    const rawRow = parseResult.data[i] as Record<string, string>
    const timestampValue = rawRow[timestampColumn]

    const timestamp = parseTimestamp(timestampValue)
    if (!timestamp) {
      invalidTimestampCount++
      if (invalidTimestampCount <= 5) {
        warnings.push(`Row ${i + 2}: Invalid timestamp "${timestampValue}"`)
      }
      continue
    }

    // Track date range
    if (!minTimestamp || timestamp < minTimestamp) {
      minTimestamp = timestamp
    }
    if (!maxTimestamp || timestamp > maxTimestamp) {
      maxTimestamp = timestamp
    }

    // Parse data values
    const values: Record<string, number | string> = {}
    for (const column of dataColumns) {
      values[column] = parseValue(rawRow[column])
    }

    rows.push({
      timestamp,
      values,
    })
  }

  if (invalidTimestampCount > 5) {
    warnings.push(`... and ${invalidTimestampCount - 5} more rows with invalid timestamps`)
  }

  if (rows.length === 0) {
    errors.push('No valid data rows found (all timestamps were invalid)')
    return {
      dataset: createEmptyDataset(options),
      rows: [],
      warnings,
      errors,
    }
  }

  // Sort rows by timestamp
  rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  // Create dataset metadata
  const dataset: StaticDataset = {
    id: generateDatasetId(),
    name: options.name,
    fileName: options.fileName,
    uploadedAt: new Date(),
    rowCount: rows.length,
    dateRange: {
      start: minTimestamp!,
      end: maxTimestamp!,
    },
    columns: dataColumns,
    matchStrategy: options.matchStrategy ?? 'nearest-before',
  }

  return {
    dataset,
    rows,
    warnings,
    errors,
  }
}

/**
 * Create an empty dataset for error cases
 */
function createEmptyDataset(options: ProcessStaticDatasetOptions): StaticDataset {
  return {
    id: generateDatasetId(),
    name: options.name,
    fileName: options.fileName,
    uploadedAt: new Date(),
    rowCount: 0,
    dateRange: {
      start: new Date(),
      end: new Date(),
    },
    columns: [],
    matchStrategy: options.matchStrategy ?? 'nearest-before',
  }
}

/**
 * Process a static dataset from file content string (for testing)
 */
export async function processStaticDatasetContent(
  content: string,
  options: ProcessStaticDatasetOptions
): Promise<StaticDatasetProcessResult> {
  const parser = new CSVParser({
    maxRows: 500000,
    skipEmptyLines: true,
    trimValues: true,
  })

  const warnings: string[] = []
  const errors: string[] = []

  // Parse CSV
  const parseResult: CSVParseResult = await parser.parseFile(content)

  // Add parsing errors
  for (const error of parseResult.errors) {
    errors.push(error.message)
  }

  // Add parsing warnings
  warnings.push(...parseResult.warnings)

  if (parseResult.data.length === 0) {
    errors.push('No data rows found in CSV file')
    return {
      dataset: createEmptyDataset(options),
      rows: [],
      warnings,
      errors,
    }
  }

  // First column is timestamp, rest are data columns
  const headers = parseResult.headers
  if (headers.length < 2) {
    errors.push('CSV must have at least 2 columns (timestamp + at least one data column)')
    return {
      dataset: createEmptyDataset(options),
      rows: [],
      warnings,
      errors,
    }
  }

  const timestampColumn = headers[0]
  const dataColumns = headers.slice(1)

  // Process rows
  const rows: Omit<StaticDatasetRow, 'datasetId'>[] = []
  let minTimestamp: Date | null = null
  let maxTimestamp: Date | null = null
  let invalidTimestampCount = 0

  for (let i = 0; i < parseResult.data.length; i++) {
    const rawRow = parseResult.data[i] as Record<string, string>
    const timestampValue = rawRow[timestampColumn]

    const timestamp = parseTimestamp(timestampValue)
    if (!timestamp) {
      invalidTimestampCount++
      if (invalidTimestampCount <= 5) {
        warnings.push(`Row ${i + 2}: Invalid timestamp "${timestampValue}"`)
      }
      continue
    }

    // Track date range
    if (!minTimestamp || timestamp < minTimestamp) {
      minTimestamp = timestamp
    }
    if (!maxTimestamp || timestamp > maxTimestamp) {
      maxTimestamp = timestamp
    }

    // Parse data values
    const values: Record<string, number | string> = {}
    for (const column of dataColumns) {
      values[column] = parseValue(rawRow[column])
    }

    rows.push({
      timestamp,
      values,
    })
  }

  if (invalidTimestampCount > 5) {
    warnings.push(`... and ${invalidTimestampCount - 5} more rows with invalid timestamps`)
  }

  if (rows.length === 0) {
    errors.push('No valid data rows found (all timestamps were invalid)')
    return {
      dataset: createEmptyDataset(options),
      rows: [],
      warnings,
      errors,
    }
  }

  // Sort rows by timestamp
  rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  // Create dataset metadata
  const dataset: StaticDataset = {
    id: generateDatasetId(),
    name: options.name,
    fileName: options.fileName,
    uploadedAt: new Date(),
    rowCount: rows.length,
    dateRange: {
      start: minTimestamp!,
      end: maxTimestamp!,
    },
    columns: dataColumns,
    matchStrategy: options.matchStrategy ?? 'nearest-before',
  }

  return {
    dataset,
    rows,
    warnings,
    errors,
  }
}

/**
 * Validate a dataset name
 */
export function validateDatasetName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Name is required' }
  }

  const trimmed = name.trim()

  // Check length
  if (trimmed.length > 50) {
    return { valid: false, error: 'Name must be 50 characters or less' }
  }

  // Check for valid characters (alphanumeric, spaces, underscore, hyphen)
  if (!/^[a-zA-Z][a-zA-Z0-9_ -]*$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Name must start with a letter and contain only letters, numbers, spaces, underscores, and hyphens',
    }
  }

  // Check for reserved names
  const reservedNames = ['custom', 'daily', 'trade', 'market', 'timing', 'risk', 'returns']
  if (reservedNames.includes(trimmed.toLowerCase())) {
    return { valid: false, error: `"${trimmed}" is a reserved name` }
  }

  return { valid: true }
}

/**
 * Suggest a dataset name from filename
 */
export function suggestDatasetName(fileName: string): string {
  // Remove extension
  const baseName = fileName.replace(/\.[^/.]+$/, '')

  // Convert to valid name format
  const suggested = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') // Replace invalid chars with underscore
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .replace(/_+/g, '_') // Collapse multiple underscores

  // Ensure it starts with a letter
  if (!/^[a-z]/.test(suggested)) {
    return 'data_' + suggested
  }

  // Truncate if too long
  if (suggested.length > 50) {
    return suggested.substring(0, 50)
  }

  return suggested || 'dataset'
}
