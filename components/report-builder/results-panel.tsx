"use client"

/**
 * Results Panel
 *
 * Right panel of the Report Builder showing the chart builder and comparison stats.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { EnrichedTrade } from '@/lib/models/enriched-trade'
import {
  ChartType,
  ChartAxisConfig,
  CHART_TYPE_LABELS
} from '@/lib/models/report-config'
import { RegimeComparisonStats } from '@/lib/calculations/regime-comparison'
import { ComparisonSummaryCard } from './comparison-summary-card'
import { ChartAxisSelector } from './chart-axis-selector'
import { CustomChart } from './custom-chart'
import { CustomTable } from './custom-table'
import { BucketEditor } from './bucket-editor'

interface ResultsPanelProps {
  trades: EnrichedTrade[]
  filteredTrades: EnrichedTrade[]
  comparisonStats: RegimeComparisonStats | null
  chartType: ChartType
  xAxis: ChartAxisConfig
  yAxis: ChartAxisConfig
  colorBy?: ChartAxisConfig
  sizeBy?: ChartAxisConfig
  tableBuckets: number[]
  onChartTypeChange: (type: ChartType) => void
  onXAxisChange: (field: string) => void
  onYAxisChange: (field: string) => void
  onColorByChange: (field: string) => void
  onSizeByChange: (field: string) => void
  onTableBucketsChange: (buckets: number[]) => void
}

export function ResultsPanel({
  trades,
  filteredTrades,
  comparisonStats,
  chartType,
  xAxis,
  yAxis,
  colorBy,
  sizeBy,
  tableBuckets,
  onChartTypeChange,
  onXAxisChange,
  onYAxisChange,
  onColorByChange,
  onSizeByChange,
  onTableBucketsChange
}: ResultsPanelProps) {
  // Check if we're showing a filtered subset
  const isFiltered = filteredTrades.length !== trades.length

  return (
    <div className="space-y-4">
      {/* Chart Configuration */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Chart</CardTitle>
            <Select
              value={chartType}
              onValueChange={(v) => onChartTypeChange(v as ChartType)}
            >
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHART_TYPE_LABELS).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Axis selectors - 2 columns */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <ChartAxisSelector
              label="X Axis"
              value={xAxis.field}
              onChange={onXAxisChange}
            />
            {chartType === 'table' ? (
              <BucketEditor
                field={xAxis.field}
                value={tableBuckets}
                onChange={onTableBucketsChange}
              />
            ) : chartType !== 'histogram' ? (
              <ChartAxisSelector
                label="Y Axis"
                value={yAxis.field}
                onChange={onYAxisChange}
              />
            ) : (
              <div /> // Empty placeholder for grid alignment
            )}
            {chartType === 'scatter' && (
              <>
                <ChartAxisSelector
                  label="Color By"
                  value={colorBy?.field ?? 'none'}
                  onChange={onColorByChange}
                  allowNone
                />
                <ChartAxisSelector
                  label="Size By"
                  value={sizeBy?.field ?? 'none'}
                  onChange={onSizeByChange}
                  allowNone
                />
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {chartType === 'table' ? (
            <CustomTable
              trades={filteredTrades}
              xAxis={xAxis}
              bucketEdges={tableBuckets}
            />
          ) : (
            <CustomChart
              trades={filteredTrades}
              chartType={chartType}
              xAxis={xAxis}
              yAxis={yAxis}
              colorBy={colorBy}
              sizeBy={sizeBy}
            />
          )}

          {/* Trade count */}
          <div className="text-sm text-muted-foreground text-center mt-2">
            Showing {filteredTrades.length} of {trades.length} trades
            {isFiltered && (
              <span className="ml-1">
                ({((filteredTrades.length / trades.length) * 100).toFixed(1)}%)
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Stats - Only show when filtered */}
      {isFiltered && comparisonStats && (
        <ComparisonSummaryCard stats={comparisonStats} />
      )}
    </div>
  )
}

export default ResultsPanel
