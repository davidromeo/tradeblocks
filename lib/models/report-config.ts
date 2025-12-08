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
export type ChartType = 'scatter' | 'line' | 'bar' | 'histogram' | 'box' | 'table' | 'threshold'

/**
 * Human-readable labels for chart types
 */
export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  scatter: 'Scatter Plot',
  line: 'Line Chart',
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
 * Categories for organizing preset reports
 */
export type ReportCategory = 'market' | 'mfe-mae' | 'returns' | 'timing' | 'risk' | 'threshold'

/**
 * Human-readable labels for report categories
 */
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  market: 'Market Analysis',
  'mfe-mae': 'MFE/MAE Analysis',
  returns: 'Return Metrics',
  timing: 'Timing Analysis',
  risk: 'Risk Analysis',
  threshold: 'Threshold Analysis'
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
  yAxis2?: ChartAxisConfig    // Secondary Y-axis (right side) for scatter/line charts
  yAxis3?: ChartAxisConfig    // Tertiary Y-axis (far right) for scatter/line charts
  colorBy?: ChartAxisConfig   // Optional color encoding
  sizeBy?: ChartAxisConfig    // Optional size encoding (scatter only)
  tableBuckets?: number[]     // Bucket thresholds for table type (e.g., [15, 20, 25, 30])
  tableColumns?: string[]     // Selected columns for table type (e.g., ['count', 'winRate', 'pl:avg'])
  thresholdMetric?: ThresholdMetric  // Secondary Y-axis metric for threshold chart (default: 'pl')
  category?: ReportCategory   // Category for grouping preset reports in menus
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
  | 'dateOpenedTimestamp'
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
 * Field category for organizing fields in UI
 */
export type FieldCategory = 'market' | 'returns' | 'risk' | 'trade' | 'timing'

/**
 * Human-readable labels for field categories
 */
export const FIELD_CATEGORY_LABELS: Record<FieldCategory, string> = {
  market: 'Market',
  returns: 'Returns',
  risk: 'Risk (MFE/MAE)',
  trade: 'Trade Details',
  timing: 'Timing'
}

/**
 * Order for field categories in dropdowns
 */
export const FIELD_CATEGORY_ORDER: FieldCategory[] = [
  'market',
  'returns',
  'risk',
  'trade',
  'timing'
]

/**
 * Field metadata for UI display
 */
export interface FieldInfo {
  field: ReportField
  label: string
  category: FieldCategory
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

  // Return metrics
  { field: 'pl', label: 'Profit/Loss', category: 'returns', unit: '$', description: 'Trade P&L in dollars' },
  { field: 'netPl', label: 'Net P/L', category: 'returns', unit: '$', description: 'P&L after fees' },
  { field: 'rom', label: 'Return on Margin', category: 'returns', unit: '%', description: 'P/L / Margin * 100' },
  { field: 'premiumEfficiency', label: 'Premium Efficiency', category: 'returns', unit: '%', description: 'P/L / Premium * 100' },
  { field: 'isWinner', label: 'Is Winner', category: 'returns', description: '1 if profitable, 0 if loss' },

  // Risk metrics (MFE/MAE)
  { field: 'mfePercent', label: 'MFE %', category: 'risk', unit: '%', description: 'Maximum Favorable Excursion %' },
  { field: 'maePercent', label: 'MAE %', category: 'risk', unit: '%', description: 'Maximum Adverse Excursion %' },
  { field: 'profitCapturePercent', label: 'Profit Capture %', category: 'risk', unit: '%', description: 'P/L / MFE * 100' },
  { field: 'excursionRatio', label: 'Excursion Ratio', category: 'risk', description: 'MFE / MAE (reward/risk)' },
  { field: 'rMultiple', label: 'R-Multiple', category: 'risk', description: 'P/L / MAE (risk units won/lost)' },

  // Trade details
  { field: 'premium', label: 'Premium', category: 'trade', unit: '$', description: 'Premium collected' },
  { field: 'marginReq', label: 'Margin Required', category: 'trade', unit: '$', description: 'Margin requirement' },
  { field: 'openingPrice', label: 'Opening Price', category: 'trade', unit: '$', description: 'Trade opening price' },
  { field: 'closingPrice', label: 'Closing Price', category: 'trade', unit: '$', description: 'Trade closing price' },
  { field: 'numContracts', label: 'Contracts', category: 'trade', description: 'Number of contracts' },
  { field: 'totalFees', label: 'Total Fees', category: 'trade', unit: '$', description: 'Opening + closing fees' },
  { field: 'openingCommissionsFees', label: 'Opening Fees', category: 'trade', unit: '$', description: 'Opening commissions and fees' },
  { field: 'closingCommissionsFees', label: 'Closing Fees', category: 'trade', unit: '$', description: 'Closing commissions and fees' },
  { field: 'maxProfit', label: 'Max Profit', category: 'trade', unit: '$', description: 'Maximum potential profit' },
  { field: 'maxLoss', label: 'Max Loss', category: 'trade', unit: '$', description: 'Maximum potential loss' },

  // Timing
  { field: 'tradeNumber', label: 'Trade #', category: 'timing', description: '1-indexed trade sequence' },
  { field: 'dateOpenedTimestamp', label: 'Date Opened', category: 'timing', description: 'Trade entry date (for time-series charts)' },
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
 * Get fields grouped by category, ordered by FIELD_CATEGORY_ORDER
 */
export function getFieldsByCategory(): Map<FieldCategory, FieldInfo[]> {
  const grouped = new Map<FieldCategory, FieldInfo[]>()

  // Initialize in the correct order
  for (const category of FIELD_CATEGORY_ORDER) {
    grouped.set(category, [])
  }

  // Add fields to their categories
  for (const field of REPORT_FIELDS) {
    grouped.get(field.category)?.push(field)
  }

  return grouped
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
