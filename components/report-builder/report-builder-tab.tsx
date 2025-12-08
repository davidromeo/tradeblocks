"use client"

/**
 * Report Builder Tab
 *
 * Main container for the Custom Report Builder.
 * Provides flexible filtering and chart building capabilities.
 */

import { useEffect, useMemo, useState } from 'react'
import { Filter, ChevronRight } from 'lucide-react'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { useSettingsStore } from '@/lib/stores/settings-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FilterConfig,
  ChartType,
  ChartAxisConfig,
  ReportConfig,
  ThresholdMetric,
  createEmptyFilterConfig,
  DEFAULT_TABLE_COLUMNS
} from '@/lib/models/report-config'
import { applyFilters, FlexibleFilterResult } from '@/lib/calculations/flexible-filter'
import { enrichTrades } from '@/lib/calculations/enrich-trades'
import { calculateRegimeComparison, RegimeComparisonStats } from '@/lib/calculations/regime-comparison'
import { getDefaultBucketEdges } from '@/lib/calculations/table-aggregation'
import { FilterPanel } from './filter-panel'
import { ResultsPanel } from './results-panel'
import { SavedReportsDropdown } from './saved-reports-dropdown'
import { SaveReportDialog } from './save-report-dialog'

export function ReportBuilderTab() {
  const data = usePerformanceStore((state) => state.data)
  const initialize = useSettingsStore((state) => state.initialize)

  // Initialize settings store on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  // Filter state
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(createEmptyFilterConfig())
  const [showFilters, setShowFilters] = useState(false)

  // Chart configuration state
  const [chartType, setChartType] = useState<ChartType>('scatter')
  const [xAxis, setXAxis] = useState<ChartAxisConfig>({ field: 'openingVix', label: 'Opening VIX' })
  const [yAxis, setYAxis] = useState<ChartAxisConfig>({ field: 'pl', label: 'Profit/Loss' })
  const [colorBy, setColorBy] = useState<ChartAxisConfig | undefined>(undefined)
  const [sizeBy, setSizeBy] = useState<ChartAxisConfig | undefined>(undefined)
  const [tableBuckets, setTableBuckets] = useState<number[]>(() => getDefaultBucketEdges('openingVix'))
  const [tableColumns, setTableColumns] = useState<string[]>(DEFAULT_TABLE_COLUMNS)
  const [thresholdMetric, setThresholdMetric] = useState<ThresholdMetric>('plPct')
  const [reportName, setReportName] = useState<string | undefined>(undefined)

  // Load a saved report
  const handleLoadReport = (report: ReportConfig) => {
    setFilterConfig(report.filter)
    setChartType(report.chartType)
    setXAxis(report.xAxis)
    setYAxis(report.yAxis)
    setColorBy(report.colorBy)
    setSizeBy(report.sizeBy)
    setTableBuckets(report.tableBuckets ?? getDefaultBucketEdges(report.xAxis.field))
    setTableColumns(report.tableColumns ?? DEFAULT_TABLE_COLUMNS)
    setThresholdMetric(report.thresholdMetric ?? 'plPct')
    setReportName(report.name)
  }

  // Pre-compute enriched trades with derived fields (MFE%, MAE%, ROM, etc.)
  // Uses data.trades which respects top-level filters (date range, strategy, normalize to 1 lot)
  const enrichedTrades = useMemo(() => {
    if (!data?.trades || data.trades.length === 0) {
      return []
    }
    return enrichTrades(data.trades)
  }, [data?.trades])

  // Calculate filtered results using enriched trades
  const filterResult = useMemo((): FlexibleFilterResult | null => {
    if (enrichedTrades.length === 0) {
      return null
    }
    return applyFilters(enrichedTrades, filterConfig)
  }, [enrichedTrades, filterConfig])

  // Calculate comparison stats
  const comparisonStats = useMemo((): RegimeComparisonStats | null => {
    if (!filterResult || enrichedTrades.length === 0) {
      return null
    }
    return calculateRegimeComparison(filterResult.filteredTrades, enrichedTrades)
  }, [filterResult, enrichedTrades])

  // Clear report name when config changes (no longer matches saved report)
  const clearReportName = () => setReportName(undefined)

  // Axis change handlers
  const handleXAxisChange = (field: string) => {
    setXAxis({ field, label: field })
    // Reset table buckets to defaults for new field
    setTableBuckets(getDefaultBucketEdges(field))
    clearReportName()
  }

  const handleYAxisChange = (field: string) => {
    setYAxis({ field, label: field })
    clearReportName()
  }

  const handleColorByChange = (field: string) => {
    if (field === 'none') {
      setColorBy(undefined)
    } else {
      setColorBy({ field, label: field })
    }
    clearReportName()
  }

  const handleSizeByChange = (field: string) => {
    if (field === 'none') {
      setSizeBy(undefined)
    } else {
      setSizeBy({ field, label: field })
    }
    clearReportName()
  }

  const handleChartTypeChange = (type: ChartType) => {
    setChartType(type)
    clearReportName()
  }

  const handleTableBucketsChange = (buckets: number[]) => {
    setTableBuckets(buckets)
    clearReportName()
  }

  const handleTableColumnsChange = (columns: string[]) => {
    setTableColumns(columns)
    clearReportName()
  }

  const handleThresholdMetricChange = (metric: ThresholdMetric) => {
    setThresholdMetric(metric)
    clearReportName()
  }

  if (enrichedTrades.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No trade data available. Import a trade log to use the Report Builder.
      </div>
    )
  }

  const activeFilterCount = filterConfig.conditions.filter(c => c.enabled).length

  return (
    <div className="space-y-4">
      {/* Header with Save/Load and Filter Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SavedReportsDropdown onSelect={handleLoadReport} />
          <SaveReportDialog
            filterConfig={filterConfig}
            chartType={chartType}
            xAxis={xAxis}
            yAxis={yAxis}
            colorBy={colorBy}
            sizeBy={sizeBy}
            tableBuckets={tableBuckets}
            tableColumns={tableColumns}
            thresholdMetric={thresholdMetric}
          />
        </div>
        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
          <ChevronRight className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-90' : ''}`} />
        </Button>
      </div>

      {/* Main Content - Chart with optional Filter Panel */}
      <div className={`grid grid-cols-1 gap-6 ${showFilters ? 'lg:grid-cols-[1fr_300px]' : ''}`}>
        {/* Left Panel - Chart Builder (takes full width when filters hidden) */}
        <ResultsPanel
          trades={enrichedTrades}
          filteredTrades={filterResult?.filteredTrades ?? enrichedTrades}
          comparisonStats={comparisonStats}
          chartType={chartType}
          xAxis={xAxis}
          yAxis={yAxis}
          colorBy={colorBy}
          sizeBy={sizeBy}
          tableBuckets={tableBuckets}
          tableColumns={tableColumns}
          thresholdMetric={thresholdMetric}
          reportName={reportName}
          onChartTypeChange={handleChartTypeChange}
          onXAxisChange={handleXAxisChange}
          onYAxisChange={handleYAxisChange}
          onColorByChange={handleColorByChange}
          onSizeByChange={handleSizeByChange}
          onTableBucketsChange={handleTableBucketsChange}
          onTableColumnsChange={handleTableColumnsChange}
          onThresholdMetricChange={handleThresholdMetricChange}
        />

        {/* Right Panel - Filters (only shown when toggled) */}
        {showFilters && (
          <FilterPanel
            filterConfig={filterConfig}
            onFilterChange={setFilterConfig}
            filterResult={filterResult}
          />
        )}
      </div>
    </div>
  )
}

export default ReportBuilderTab
