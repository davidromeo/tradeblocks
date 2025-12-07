"use client"

/**
 * Report Builder Tab
 *
 * Main container for the Custom Report Builder.
 * Provides flexible filtering and chart building capabilities.
 */

import { useEffect, useMemo, useState } from 'react'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { useSettingsStore } from '@/lib/stores/settings-store'
import {
  FilterConfig,
  ChartType,
  ChartAxisConfig,
  ReportConfig,
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

  // Chart configuration state
  const [chartType, setChartType] = useState<ChartType>('scatter')
  const [xAxis, setXAxis] = useState<ChartAxisConfig>({ field: 'openingVix', label: 'Opening VIX' })
  const [yAxis, setYAxis] = useState<ChartAxisConfig>({ field: 'pl', label: 'Profit/Loss' })
  const [colorBy, setColorBy] = useState<ChartAxisConfig | undefined>(undefined)
  const [sizeBy, setSizeBy] = useState<ChartAxisConfig | undefined>(undefined)
  const [tableBuckets, setTableBuckets] = useState<number[]>(() => getDefaultBucketEdges('openingVix'))
  const [tableColumns, setTableColumns] = useState<string[]>(DEFAULT_TABLE_COLUMNS)

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
  }

  // Pre-compute enriched trades with derived fields (MFE%, MAE%, ROM, etc.)
  const enrichedTrades = useMemo(() => {
    if (!data?.allTrades || data.allTrades.length === 0) {
      return []
    }
    return enrichTrades(data.allTrades)
  }, [data?.allTrades])

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

  // Axis change handlers
  const handleXAxisChange = (field: string) => {
    setXAxis({ field, label: field })
    // Reset table buckets to defaults for new field
    setTableBuckets(getDefaultBucketEdges(field))
  }

  const handleYAxisChange = (field: string) => {
    setYAxis({ field, label: field })
  }

  const handleColorByChange = (field: string) => {
    if (field === 'none') {
      setColorBy(undefined)
    } else {
      setColorBy({ field, label: field })
    }
  }

  const handleSizeByChange = (field: string) => {
    if (field === 'none') {
      setSizeBy(undefined)
    } else {
      setSizeBy({ field, label: field })
    }
  }

  if (enrichedTrades.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No trade data available. Import a trade log to use the Report Builder.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Save/Load */}
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
          />
        </div>
      </div>

      {/* Main Content - Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
        {/* Left Panel - Filters */}
        <FilterPanel
          filterConfig={filterConfig}
          onFilterChange={setFilterConfig}
          filterResult={filterResult}
        />

        {/* Right Panel - Chart Builder */}
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
          onChartTypeChange={setChartType}
          onXAxisChange={handleXAxisChange}
          onYAxisChange={handleYAxisChange}
          onColorByChange={handleColorByChange}
          onSizeByChange={handleSizeByChange}
          onTableBucketsChange={setTableBuckets}
          onTableColumnsChange={setTableColumns}
        />
      </div>
    </div>
  )
}

export default ReportBuilderTab
