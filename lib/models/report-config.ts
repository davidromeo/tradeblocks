/**
 * Report Configuration Types
 *
 * Defines the structure for flexible report configurations including
 * filter conditions and chart settings.
 */

/**
 * Filter operators for comparing trade field values
 */
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between'

/**
 * Human-readable labels for filter operators
 */
export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: 'between'
}

/**
 * A single filter condition
 */
export interface FilterCondition {
  id: string
  field: string              // Field name from Trade
  operator: FilterOperator
  value: number              // Primary value
  value2?: number            // Second value for 'between' operator
  enabled: boolean
}

/**
 * Filter configuration with multiple conditions
 */
export interface FilterConfig {
  conditions: FilterCondition[]
  logic: 'and' | 'or'        // How to combine conditions (AND only for now)
}

/**
 * Chart axis configuration
 */
export interface ChartAxisConfig {
  field: string              // Field name from Trade
  label?: string             // Custom display label
  scale?: 'linear' | 'log'   // Axis scale type
}

/**
 * Supported chart types
 */
export type ChartType = 'scatter' | 'bar' | 'histogram' | 'box' | 'table' | 'threshold'

/**
 * Human-readable labels for chart types
 */
export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  scatter: 'Scatter Plot',
  bar: 'Bar Chart',
  histogram: 'Histogram',
  box: 'Box Plot',
  table: 'Table',
  threshold: 'Threshold Analysis'
}

/**
 * Metric options for threshold analysis secondary Y-axis
 */
export type ThresholdMetric = 'pl' | 'plPct' | 'rom'

/**
 * Human-readable labels for threshold metrics
 */
export const THRESHOLD_METRIC_LABELS: Record<ThresholdMetric, string> = {
  pl: 'Avg P/L ($)',
  plPct: 'Avg P/L (%)',
  rom: 'Avg ROM (%)'
}

/**
 * Full report configuration combining filters and chart settings
 */
export interface ReportConfig {
  id: string
  name: string
  filter: FilterConfig
  chartType: ChartType
  xAxis: ChartAxisConfig
  yAxis: ChartAxisConfig
  colorBy?: ChartAxisConfig   // Optional color encoding
  sizeBy?: ChartAxisConfig    // Optional size encoding (scatter only)
  tableBuckets?: number[]     // Bucket thresholds for table type (e.g., [15, 20, 25, 30])
  tableColumns?: string[]     // Selected columns for table type (e.g., ['count', 'winRate', 'pl:avg'])
  thresholdMetric?: ThresholdMetric  // Secondary Y-axis metric for threshold chart (default: 'pl')
  isBuiltIn?: boolean         // True for preset reports
  createdAt: string
  updatedAt: string
}

/**
 * Available fields that can be used for filtering and chart axes
 * Combines base Trade fields with derived EnrichedTrade fields
 */
export type ReportField =
  // Market conditions
  | 'openingVix'
  | 'closingVix'
  | 'openingShortLongRatio'
  | 'closingShortLongRatio'
  | 'gap'
  | 'movement'
  // Performance metrics (base)
  | 'pl'
  | 'premium'
  | 'marginReq'
  | 'openingPrice'
  | 'closingPrice'
  | 'numContracts'
  | 'openingCommissionsFees'
  | 'closingCommissionsFees'
  | 'maxProfit'
  | 'maxLoss'
  // Derived: MFE/MAE metrics
  | 'mfePercent'
  | 'maePercent'
  | 'profitCapturePercent'
  | 'excursionRatio'
  | 'shortLongRatioChange'
  | 'shortLongRatioChangePct'
  // Derived: Return metrics
  | 'rom'
  | 'premiumEfficiency'
  // Derived: Timing
  | 'durationHours'
  | 'dayOfWeek'
  | 'hourOfDay'
  // Derived: Costs & Net
  | 'totalFees'
  | 'netPl'
  // Derived: VIX changes
  | 'vixChange'
  | 'vixChangePct'
  // Derived: Risk metrics
  | 'rMultiple'
  | 'isWinner'
  // Derived: Sequential
  | 'tradeNumber'

/**
 * Field metadata for UI display
 */
export interface FieldInfo {
  field: ReportField
  label: string
  category: 'market' | 'performance' | 'timing'
  unit?: string
  description?: string
}

/**
 * All available fields with their metadata
 * Includes base Trade fields and derived EnrichedTrade fields
 */
export const REPORT_FIELDS: FieldInfo[] = [
  // Market conditions
  { field: 'openingVix', label: 'Opening VIX', category: 'market', description: 'VIX at trade entry' },
  { field: 'closingVix', label: 'Closing VIX', category: 'market', description: 'VIX at trade exit' },
  { field: 'vixChange', label: 'VIX Change', category: 'market', description: 'Closing VIX - Opening VIX' },
  { field: 'vixChangePct', label: 'VIX Change %', category: 'market', unit: '%', description: 'VIX percentage change' },
  { field: 'openingShortLongRatio', label: 'Opening S/L Ratio', category: 'market', description: 'Short/Long ratio at entry' },
  { field: 'closingShortLongRatio', label: 'Closing S/L Ratio', category: 'market', description: 'Short/Long ratio at exit' },
  { field: 'shortLongRatioChange', label: 'S/L Ratio Change', category: 'market', description: 'Closing SLR / Opening SLR' },
  { field: 'shortLongRatioChangePct', label: 'S/L Ratio Change %', category: 'market', unit: '%', description: 'S/L ratio percentage change' },
  { field: 'gap', label: 'Gap %', category: 'market', unit: '%', description: 'Opening gap percentage' },
  { field: 'movement', label: 'Movement', category: 'market', description: 'Price movement during trade' },

  // Performance metrics (base)
  { field: 'pl', label: 'Profit/Loss', category: 'performance', unit: '$', description: 'Trade P&L in dollars' },
  { field: 'netPl', label: 'Net P/L', category: 'performance', unit: '$', description: 'P&L after fees' },
  { field: 'premium', label: 'Premium', category: 'performance', unit: '$', description: 'Premium collected' },
  { field: 'marginReq', label: 'Margin Required', category: 'performance', unit: '$', description: 'Margin requirement' },
  { field: 'rom', label: 'Return on Margin', category: 'performance', unit: '%', description: 'P/L / Margin * 100' },
  { field: 'premiumEfficiency', label: 'Premium Efficiency', category: 'performance', unit: '%', description: 'P/L / Premium * 100' },
  { field: 'openingPrice', label: 'Opening Price', category: 'performance', unit: '$', description: 'Trade opening price' },
  { field: 'closingPrice', label: 'Closing Price', category: 'performance', unit: '$', description: 'Trade closing price' },
  { field: 'numContracts', label: 'Contracts', category: 'performance', description: 'Number of contracts' },
  { field: 'totalFees', label: 'Total Fees', category: 'performance', unit: '$', description: 'Opening + closing fees' },
  { field: 'openingCommissionsFees', label: 'Opening Fees', category: 'performance', unit: '$', description: 'Opening commissions and fees' },
  { field: 'closingCommissionsFees', label: 'Closing Fees', category: 'performance', unit: '$', description: 'Closing commissions and fees' },
  { field: 'maxProfit', label: 'Max Profit', category: 'performance', unit: '$', description: 'Maximum potential profit' },
  { field: 'maxLoss', label: 'Max Loss', category: 'performance', unit: '$', description: 'Maximum potential loss' },
  { field: 'isWinner', label: 'Is Winner', category: 'performance', description: '1 if profitable, 0 if loss' },
  { field: 'tradeNumber', label: 'Trade #', category: 'performance', description: '1-indexed trade sequence' },

  // MFE/MAE metrics
  { field: 'mfePercent', label: 'MFE %', category: 'performance', unit: '%', description: 'Maximum Favorable Excursion %' },
  { field: 'maePercent', label: 'MAE %', category: 'performance', unit: '%', description: 'Maximum Adverse Excursion %' },
  { field: 'profitCapturePercent', label: 'Profit Capture %', category: 'performance', unit: '%', description: 'P/L / MFE * 100' },
  { field: 'excursionRatio', label: 'Excursion Ratio', category: 'performance', description: 'MFE / MAE (reward/risk)' },
  { field: 'rMultiple', label: 'R-Multiple', category: 'performance', description: 'P/L / MAE (risk units won/lost)' },

  // Timing
  { field: 'durationHours', label: 'Duration (hrs)', category: 'timing', unit: 'hrs', description: 'Trade holding period in hours' },
  { field: 'dayOfWeek', label: 'Day of Week', category: 'timing', description: '0=Sun, 1=Mon, ..., 6=Sat' },
  { field: 'hourOfDay', label: 'Hour of Day', category: 'timing', description: 'Hour trade was opened (0-23)' }
]

/**
 * Get field info by field name
 */
export function getFieldInfo(field: string): FieldInfo | undefined {
  return REPORT_FIELDS.find(f => f.field === field)
}

/**
 * Get fields grouped by category
 */
export function getFieldsByCategory(): Record<string, FieldInfo[]> {
  return REPORT_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = []
    }
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, FieldInfo[]>)
}

/**
 * Create an empty filter config
 */
export function createEmptyFilterConfig(): FilterConfig {
  return {
    conditions: [],
    logic: 'and'
  }
}

/**
 * Create a new filter condition with defaults
 */
export function createFilterCondition(field: ReportField = 'openingVix'): FilterCondition {
  return {
    id: crypto.randomUUID(),
    field,
    operator: 'gt',
    value: 0,
    enabled: true
  }
}

/**
 * Create a default report config
 */
export function createDefaultReportConfig(): Omit<ReportConfig, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'New Report',
    filter: createEmptyFilterConfig(),
    chartType: 'scatter',
    xAxis: { field: 'openingVix', label: 'Opening VIX' },
    yAxis: { field: 'pl', label: 'Profit/Loss' }
  }
}

// ============================================================================
// Table Column Configuration
// ============================================================================

/**
 * Aggregation types for table columns
 */
export type AggregationType = 'avg' | 'sum' | 'min' | 'max' | 'count' | 'winRate'

/**
 * Table column option for MultiSelect
 */
export interface TableColumnOption {
  value: string  // Format: "field:aggregation" or special like "count", "winRate"
  label: string
}

/**
 * Table column group for MultiSelect
 */
export interface TableColumnGroup {
  heading: string
  options: TableColumnOption[]
}

/**
 * Predefined table column options grouped by category
 * Value format: "field:aggregation" (e.g., "pl:avg") or special values ("count", "winRate")
 */
export const TABLE_COLUMN_OPTIONS: TableColumnGroup[] = [
  {
    heading: 'Core',
    options: [
      { value: 'count', label: 'Trades' },
      { value: 'winRate', label: 'Win Rate' }
    ]
  },
  {
    heading: 'P&L',
    options: [
      { value: 'pl:avg', label: 'Avg P&L ($)' },
      { value: 'pl:sum', label: 'Total P&L ($)' },
      { value: 'rom:avg', label: 'Avg ROM (%)' }
    ]
  },
  {
    heading: 'Risk',
    options: [
      { value: 'mfePercent:avg', label: 'Avg MFE (%)' },
      { value: 'maePercent:avg', label: 'Avg MAE (%)' },
      { value: 'profitCapturePercent:avg', label: 'Avg Profit Capture (%)' },
      { value: 'rMultiple:avg', label: 'Avg R-Multiple' }
    ]
  },
  {
    heading: 'Timing',
    options: [
      { value: 'durationHours:avg', label: 'Avg Duration (hrs)' }
    ]
  },
  {
    heading: 'Market',
    options: [
      { value: 'openingVix:avg', label: 'Avg Opening VIX' },
      { value: 'vixChange:avg', label: 'Avg VIX Change' }
    ]
  }
]

/**
 * Default selected table columns
 */
export const DEFAULT_TABLE_COLUMNS: string[] = ['count', 'winRate', 'pl:avg', 'rom:avg']

/**
 * Get all table column options as a flat array
 */
export function getAllTableColumnOptions(): TableColumnOption[] {
  return TABLE_COLUMN_OPTIONS.flatMap(group => group.options)
}

/**
 * Parse a column value into field and aggregation
 * Special values: "count" -> { field: 'count', aggregation: 'count' }
 *                "winRate" -> { field: 'isWinner', aggregation: 'winRate' }
 * Regular values: "pl:avg" -> { field: 'pl', aggregation: 'avg' }
 */
export function parseColumnValue(value: string): { field: string; aggregation: AggregationType } {
  if (value === 'count') {
    return { field: 'count', aggregation: 'count' }
  }
  if (value === 'winRate') {
    return { field: 'isWinner', aggregation: 'winRate' }
  }
  const [field, aggregation] = value.split(':')
  return {
    field: field || value,
    aggregation: (aggregation as AggregationType) || 'avg'
  }
}

/**
 * Get label for a column value
 */
export function getColumnLabel(value: string): string {
  const option = getAllTableColumnOptions().find(opt => opt.value === value)
  return option?.label ?? value
}

/**
 * Get unit for formatting a column value
 */
export function getColumnUnit(value: string): string | undefined {
  const { field } = parseColumnValue(value)
  if (field === 'count') return undefined
  if (field === 'isWinner') return '%'
  const fieldInfo = getFieldInfo(field)
  return fieldInfo?.unit
}
