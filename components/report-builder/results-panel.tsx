"use client";

/**
 * Results Panel
 *
 * Right panel of the Report Builder showing the chart builder and comparison stats.
 */

import { MultiSelect } from "@/components/multi-select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegimeComparisonStats } from "@/lib/calculations/regime-comparison";
import { EnrichedTrade } from "@/lib/models/enriched-trade";
import {
  CHART_TYPE_LABELS,
  ChartAxisConfig,
  ChartType,
  TABLE_COLUMN_OPTIONS,
  THRESHOLD_METRIC_LABELS,
  ThresholdMetric,
} from "@/lib/models/report-config";
import { BucketEditor } from "./bucket-editor";
import { ChartAxisSelector } from "./chart-axis-selector";
import { ComparisonSummaryCard } from "./comparison-summary-card";
import { CustomChart } from "./custom-chart";
import { CustomTable } from "./custom-table";
import { ThresholdChart } from "./threshold-chart";

interface ResultsPanelProps {
  trades: EnrichedTrade[];
  filteredTrades: EnrichedTrade[];
  comparisonStats: RegimeComparisonStats | null;
  chartType: ChartType;
  xAxis: ChartAxisConfig;
  yAxis: ChartAxisConfig;
  yAxis2?: ChartAxisConfig;
  yAxis3?: ChartAxisConfig;
  colorBy?: ChartAxisConfig;
  sizeBy?: ChartAxisConfig;
  tableBuckets: number[];
  tableColumns: string[];
  thresholdMetric: ThresholdMetric;
  reportName?: string; // Name of loaded/saved report
  onChartTypeChange: (type: ChartType) => void;
  onXAxisChange: (field: string) => void;
  onYAxisChange: (field: string) => void;
  onYAxis2Change: (field: string) => void;
  onYAxis3Change: (field: string) => void;
  onColorByChange: (field: string) => void;
  onSizeByChange: (field: string) => void;
  onTableBucketsChange: (buckets: number[]) => void;
  onTableColumnsChange: (columns: string[]) => void;
  onThresholdMetricChange: (metric: ThresholdMetric) => void;
}

export function ResultsPanel({
  trades,
  filteredTrades,
  comparisonStats,
  chartType,
  xAxis,
  yAxis,
  yAxis2,
  yAxis3,
  colorBy,
  sizeBy,
  tableBuckets,
  tableColumns,
  thresholdMetric,
  reportName,
  onChartTypeChange,
  onXAxisChange,
  onYAxisChange,
  onYAxis2Change,
  onYAxis3Change,
  onColorByChange,
  onSizeByChange,
  onTableBucketsChange,
  onTableColumnsChange,
  onThresholdMetricChange,
}: ResultsPanelProps) {
  // Check if we're showing a filtered subset
  const isFiltered = filteredTrades.length !== trades.length;

  // Determine number of columns for non-scatter/line layouts
  const getGridCols = () => {
    if (chartType === "histogram") return "grid-cols-2"; // type + x
    if (chartType === "threshold") return "grid-cols-2 lg:grid-cols-3"; // type + x + metric
    if (chartType === "table") return "grid-cols-2"; // type + x (buckets on second row)
    return "grid-cols-2 lg:grid-cols-3"; // type + x + y (bar, box)
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* Chart Configuration */}
      <Card className="min-w-0">
        <CardHeader className="pb-2 space-y-2">
          {/* Report title (only shown when a report is loaded) */}
          {reportName && (
            <h3 className="text-base font-semibold">{reportName}</h3>
          )}

          {/* Compact controls row */}
          {chartType === "scatter" || chartType === "line" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2 items-end">
              {/* Chart type selector */}
              <div className="min-w-0">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Chart Type
                </Label>
                <Select
                  value={chartType}
                  onValueChange={(v) => onChartTypeChange(v as ChartType)}
                >
                  <SelectTrigger className="h-8 w-full">
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

              {/* X Axis */}
              <ChartAxisSelector
                label="X Axis"
                value={xAxis.field}
                onChange={onXAxisChange}
              />

              {/* Y axes on the same row for better balance */}
              <ChartAxisSelector
                label="Y Axis (Primary)"
                value={yAxis.field}
                onChange={onYAxisChange}
              />
              <ChartAxisSelector
                label="Y Axis 2 (Right)"
                value={yAxis2?.field ?? "none"}
                onChange={onYAxis2Change}
                allowNone
              />
              <ChartAxisSelector
                label="Y Axis 3 (Far Right)"
                value={yAxis3?.field ?? "none"}
                onChange={onYAxis3Change}
                allowNone
              />
            </div>
          ) : (
            <div className={`grid ${getGridCols()} gap-2 items-end`}>
              {/* Chart type selector */}
              <div className="min-w-0">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Chart Type
                </Label>
                <Select
                  value={chartType}
                  onValueChange={(v) => onChartTypeChange(v as ChartType)}
                >
                  <SelectTrigger className="h-8 w-full">
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

              {/* X Axis / Group By / Analyze Field */}
              <ChartAxisSelector
                label={
                  chartType === "table"
                    ? "Group By"
                    : chartType === "threshold"
                    ? "Analyze Field"
                    : "X Axis"
                }
                value={xAxis.field}
                onChange={onXAxisChange}
              />

              {/* Y Axis (for bar, box) */}
              {(chartType === "bar" || chartType === "box") && (
                <ChartAxisSelector
                  label="Y Axis"
                  value={yAxis.field}
                  onChange={onYAxisChange}
                />
              )}

              {/* Metric selector for threshold */}
              {chartType === "threshold" && (
                <div className="min-w-0">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Metric
                  </Label>
                  <Select
                    value={thresholdMetric}
                    onValueChange={(v) =>
                      onThresholdMetricChange(v as ThresholdMetric)
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(THRESHOLD_METRIC_LABELS).map(
                        ([metric, label]) => (
                          <SelectItem key={metric} value={metric}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Scatter-specific secondary controls - Color/Size inline */}
          {chartType === "scatter" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-2 items-end">
              <ChartAxisSelector
                label="Color By"
                value={colorBy?.field ?? "none"}
                onChange={onColorByChange}
                allowNone
                className="xl:col-span-2"
              />
              <ChartAxisSelector
                label="Size By"
                value={sizeBy?.field ?? "none"}
                onChange={onSizeByChange}
                allowNone
                className="xl:col-span-2"
              />
              <div className="hidden xl:block" />
            </div>
          )}

          {/* Table-specific controls (buckets and columns) */}
          {chartType === "table" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <BucketEditor
                field={xAxis.field}
                value={tableBuckets}
                onChange={onTableBucketsChange}
              />
              <div className="min-w-0">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Columns
                </Label>
                <MultiSelect
                  options={TABLE_COLUMN_OPTIONS}
                  defaultValue={tableColumns}
                  onValueChange={onTableColumnsChange}
                  placeholder="Select columns..."
                  maxCount={4}
                  hideSelectAll
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className={chartType === "table" ? "overflow-hidden" : ""}>
          {chartType === "table" ? (
            <CustomTable
              trades={filteredTrades}
              xAxis={xAxis}
              bucketEdges={tableBuckets}
              selectedColumns={tableColumns}
            />
          ) : chartType === "threshold" ? (
            <ThresholdChart
              trades={filteredTrades}
              xAxis={xAxis}
              metric={thresholdMetric}
            />
          ) : (
            <CustomChart
              trades={filteredTrades}
              chartType={chartType}
              xAxis={xAxis}
              yAxis={yAxis}
              yAxis2={yAxis2}
              yAxis3={yAxis3}
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
  );
}

export default ResultsPanel;
