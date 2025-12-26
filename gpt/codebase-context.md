This file is a merged representation of the entire codebase, combined into a single document by Repomix.
The content has been processed where content has been compressed (code blocks are separated by ⋮---- delimiter).

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Content has been compressed - code blocks are separated by ⋮---- delimiter
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
app/
  (platform)/
    assistant/
      page.tsx
    block-stats/
      page.tsx
    blocks/
      page.tsx
    correlation-matrix/
      page.tsx
    performance-blocks/
      page.tsx
    position-sizing/
      page.tsx
    risk-simulator/
      page.tsx
    static-datasets/
      page.tsx
    tail-risk-analysis/
      page.tsx
    trading-calendar/
      page.tsx
    walk-forward/
      page.tsx
    layout.tsx
  apple-icon.tsx
  globals.css
  icon.tsx
  layout.tsx
  page.tsx
components/
  performance-charts/
    chart-wrapper.tsx
    day-of-week-chart.tsx
    drawdown-chart.tsx
    equity-curve-chart.tsx
    excursion-distribution-chart.tsx
    exit-reason-chart.tsx
    holding-duration-chart.tsx
    margin-utilization-chart.tsx
    margin-utilization-table.tsx
    monthly-returns-chart.tsx
    paired-leg-outcomes-chart.tsx
    performance-filters.tsx
    performance-metrics.tsx
    premium-efficiency-chart.tsx
    return-distribution-chart.tsx
    risk-evolution-chart.tsx
    rolling-metrics-chart.tsx
    rom-timeline-chart.tsx
    trade-sequence-chart.tsx
    vix-regime-chart.tsx
    win-loss-streaks-chart.tsx
  position-sizing/
    margin-chart.tsx
    margin-statistics-table.tsx
    portfolio-summary.tsx
    strategy-kelly-table.tsx
    strategy-results.tsx
  report-builder/
    bucket-editor.tsx
    chart-axis-selector.tsx
    comparison-summary-card.tsx
    cumulative-distribution-chart.tsx
    custom-chart.tsx
    custom-table.tsx
    filter-condition-row.tsx
    filter-panel.tsx
    histogram-chart.tsx
    index.ts
    metrics-guide-dialog.tsx
    preset-selector.tsx
    regime-breakdown-table.tsx
    report-builder-tab.tsx
    results-panel.tsx
    save-report-dialog.tsx
    saved-reports-dropdown.tsx
    scatter-chart.tsx
    threshold-chart.tsx
    what-if-explorer-2d.tsx
    what-if-explorer.tsx
  risk-simulator/
    distribution-charts.tsx
    equity-curve-chart.tsx
    statistics-cards.tsx
    trading-frequency-card.tsx
  static-datasets/
    dataset-card.tsx
    preview-modal.tsx
    upload-dialog.tsx
  tail-risk/
    marginal-contribution-chart.tsx
    scree-plot-chart.tsx
    tail-dependence-heatmap.tsx
    tail-risk-summary-cards.tsx
  trading-calendar/
    calendar-navigation.tsx
    calendar-view.tsx
    day-view.tsx
    equity-curve-chart.tsx
    match-strategies-dialog.tsx
    stats-header.tsx
    trade-detail-view.tsx
  walk-forward/
    analysis-chart.tsx
    period-selector.tsx
    robustness-metrics.tsx
    run-switcher.tsx
  app-sidebar.tsx
  block-dialog.tsx
  block-metrics-table.tsx
  block-switch-dialog.tsx
  database-reset-handler.tsx
  import-guide-dialog.tsx
  metric-card.tsx
  metric-section.tsx
  mode-toggle.tsx
  multi-select.tsx
  nav-documents.tsx
  nav-main.tsx
  nav-secondary.tsx
  nav-user.tsx
  no-active-block.tsx
  page-placeholder.tsx
  performance-export-dialog.tsx
  progress-dialog.tsx
  sidebar-active-blocks.tsx
  sidebar-footer-legal.tsx
  site-header.tsx
  sizing-mode-toggle.tsx
  strategy-breakdown-table.tsx
  theme-provider.tsx
hooks/
  use-mobile.ts
  use-progress-dialog.ts
lib/
  calculations/
    correlation.ts
    cumulative-distribution.ts
    enrich-trades.ts
    flexible-filter.ts
    index.ts
    kelly.ts
    margin-timeline.ts
    mfe-mae.ts
    monte-carlo.ts
    performance.ts
    portfolio-stats.ts
    regime-comparison.ts
    regime-filter.ts
    static-dataset-matcher.ts
    statistical-utils.ts
    streak-analysis.ts
    table-aggregation.ts
    tail-risk-analysis.ts
    threshold-analysis.ts
    walk-forward-analyzer.ts
  db/
    blocks-store.ts
    combined-trades-cache.ts
    daily-logs-store.ts
    enriched-trades-cache.ts
    index.ts
    performance-snapshot-cache.ts
    reporting-logs-store.ts
    static-dataset-rows-store.ts
    static-datasets-store.ts
    trades-store.ts
    walk-forward-store.ts
  metrics/
    trade-efficiency.ts
  models/
    block.ts
    daily-log.ts
    enriched-trade.ts
    index.ts
    portfolio-stats.ts
    regime.ts
    report-config.ts
    reporting-trade.ts
    static-dataset.ts
    strategy-alignment.ts
    tail-risk.ts
    trade.ts
    validators.ts
    walk-forward.ts
  processing/
    capital-calculator.ts
    csv-parser.ts
    daily-log-processor.ts
    data-loader.ts
    index.ts
    reporting-trade-processor.ts
    static-dataset-processor.ts
    trade-processor.ts
  services/
    calendar-data.ts
    performance-snapshot.ts
  stores/
    block-store.ts
    performance-store.ts
    settings-store.ts
    static-datasets-store.ts
    trading-calendar-store.ts
    walk-forward-store.ts
  utils/
    async-helpers.ts
    combine-leg-groups.ts
    csv-headers.ts
    export-helpers.ts
    performance-export.ts
    performance-helpers.ts
    time-conversions.ts
    trade-frequency.ts
    trade-normalization.ts
  utils.ts
```

# Files

## File: app/(platform)/correlation-matrix/page.tsx
```typescript
import { NoActiveBlock } from "@/components/no-active-block";
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateCorrelationAnalytics,
  calculateCorrelationMatrix,
  CorrelationAlignment,
  CorrelationDateBasis,
  CorrelationMethod,
  CorrelationMatrix,
  CorrelationNormalization,
} from "@/lib/calculations/correlation";
import { getBlock, getTradesByBlockWithOptions } from "@/lib/db";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";
import { truncateStrategyName } from "@/lib/utils";
import {
  downloadCsv,
  downloadJson,
  generateExportFilename,
  toCsvRow,
} from "@/lib/utils/export-helpers";
import { Download, HelpCircle, Info } from "lucide-react";
import { useTheme } from "next-themes";
import type { Data, Layout } from "plotly.js";
import { useCallback, useEffect, useMemo, useState } from "react";
⋮----
async function loadTrades()
⋮----
// Truncate strategy names for axis labels
⋮----
// Create heatmap with better contrast
// Different colorscales for light and dark modes
⋮----
// Dark mode: Brighter, more vibrant colors
[0, "#1e40af"], // Bright blue for -1
[0.25, "#3b82f6"], // Medium bright blue for -0.5
[0.45, "#93c5fd"], // Light blue approaching 0
[0.5, "#334155"], // Neutral gray for 0
[0.55, "#fca5a5"], // Light red leaving 0
[0.75, "#ef4444"], // Medium bright red for 0.5
[1, "#991b1b"], // Strong red for 1
⋮----
// Light mode: Darker, more saturated colors
[0, "#053061"], // Strong dark blue for -1
[0.25, "#2166ac"], // Medium blue for -0.5
[0.45, "#d1e5f0"], // Light blue approaching 0
[0.5, "#f7f7f7"], // White/light gray for 0
[0.55, "#fddbc7"], // Light red leaving 0
[0.75, "#d6604d"], // Medium red for 0.5
[1, "#67001f"], // Strong dark red for 1
⋮----
// Dynamic text color based on value and theme
⋮----
// In dark mode, use lighter text for strong correlations
⋮----
// In light mode, use white for strong, black for weak
⋮----
// Use full strategy names in hover tooltip
⋮----
{/* Info Banner */}
⋮----
{/* Controls */}
⋮----
{/* Method */}
⋮----
onValueChange=
⋮----
{/* Alignment */}
⋮----
{/* Return basis */}
⋮----
{/* Date basis */}
⋮----
{/* Heatmap */}
⋮----
{/* Quick Analysis */}
```

## File: app/(platform)/position-sizing/page.tsx
```typescript
import { NoActiveBlock } from "@/components/no-active-block";
import { MarginChart } from "@/components/position-sizing/margin-chart";
import { MarginStatisticsTable } from "@/components/position-sizing/margin-statistics-table";
import { PortfolioSummary } from "@/components/position-sizing/portfolio-summary";
import { StrategyKellyTable } from "@/components/position-sizing/strategy-kelly-table";
import {
  StrategyAnalysis,
  StrategyResults,
} from "@/components/position-sizing/strategy-results";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  calculateKellyMetrics,
  calculateStrategyKellyMetrics,
} from "@/lib/calculations/kelly";
import {
  buildMarginTimeline,
  calculateMaxMarginPct,
  type MarginMode,
} from "@/lib/calculations/margin-timeline";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";
import {
  getBlock,
  getDailyLogsByBlock,
  getTradesByBlockWithOptions,
} from "@/lib/db";
import { DailyLogEntry } from "@/lib/models/daily-log";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";
import {
  downloadCsv,
  downloadJson,
  generateExportFilename,
  toCsvRow,
} from "@/lib/utils/export-helpers";
import { AlertCircle, Download, HelpCircle, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
⋮----
interface RunConfig {
  startingCapital: number;
  portfolioKellyPct: number;
  marginMode: MarginMode;
  kellyValues: Record<string, number>;
}
⋮----
type StrategySortOption =
  | "name-asc"
  | "winrate-desc"
  | "kelly-desc"
  | "applied-desc"
  | "capital-desc"
  | "trades-desc";
⋮----
const normalizeKellyValue = (value: number): number =>
⋮----
// State
⋮----
// Load trades and daily log when active block changes
⋮----
const loadData = async () =>
⋮----
// Auto-detect starting capital (prefer daily log when available)
⋮----
// Initialize all strategies as selected with 100%
⋮----
// Get unique strategies with trade counts
⋮----
// Calculate results when user clicks "Run Allocation"
const runAllocation = () =>
⋮----
// Results calculations using the last run configuration
⋮----
// Calculate portfolio-level Kelly metrics with starting capital for validation
⋮----
// Calculate per-strategy Kelly metrics with starting capital for validation
⋮----
// Get strategy names sorted by trade count
⋮----
// Build margin timeline
⋮----
// Calculate portfolio max margin
⋮----
// Calculate strategy analysis
⋮----
// Use normalized Kelly when available (more accurate for position sizing)
⋮----
// Apply BOTH Portfolio Kelly and Strategy Kelly multipliers
⋮----
const compareByName = (a: StrategyAnalysis, b: StrategyAnalysis)
⋮----
// Handlers
const handleKellyChange = (strategy: string, value: number) =>
⋮----
const handleSelectionChange = (strategy: string, selected: boolean) =>
⋮----
const handleSelectAll = (selected: boolean) =>
⋮----
const handlePortfolioKellyInputChange = (value: string) =>
⋮----
// Allow users to clear the field while editing
⋮----
// Update numeric state eagerly so pending-change detection stays responsive
⋮----
const commitPortfolioKellyInput = () =>
⋮----
// Export functions
const exportAsJson = () =>
⋮----
const exportAsCsv = () =>
⋮----
// Metadata
⋮----
// Portfolio Summary
⋮----
// Strategy Analysis
⋮----
// Empty state
⋮----
{/* How to Use This Page */}
⋮----
{/* Configuration Card */}
⋮----
{/* Global Settings */}
⋮----
onValueChange=
⋮----
{/* Strategy Kelly Table */}
⋮----
{/* Quick Actions */}
⋮----
{/* Slider to set all selected strategies */}
⋮----
{/* Action buttons */}
⋮----
{/* Results */}
```

## File: app/(platform)/risk-simulator/page.tsx
```typescript
import { MultiSelect } from "@/components/multi-select";
import { NoActiveBlock } from "@/components/no-active-block";
import {
  DrawdownDistributionChart,
  ReturnDistributionChart,
} from "@/components/risk-simulator/distribution-charts";
import { StatisticsCards } from "@/components/risk-simulator/statistics-cards";
import { TradingFrequencyCard } from "@/components/risk-simulator/trading-frequency-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  runMonteCarloSimulation,
  type MonteCarloParams,
  type MonteCarloResult,
} from "@/lib/calculations/monte-carlo";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";
import {
  getBlock,
  getDailyLogsByBlock,
  getTradesByBlockWithOptions,
} from "@/lib/db";
import { DailyLogEntry } from "@/lib/models/daily-log";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";
import {
  getDefaultSimulationPeriod,
  percentageToTrades,
  timeToTrades,
  type TimeUnit,
} from "@/lib/utils/time-conversions";
import {
  downloadCsv,
  downloadJson,
  generateExportFilename,
  toCsvRow,
} from "@/lib/utils/export-helpers";
import { estimateTradesPerYear } from "@/lib/utils/trade-frequency";
import { Download, HelpCircle, Loader2, Play, RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import type { Data } from "plotly.js";
import { useEffect, useMemo, useState } from "react";
⋮----
// Simulation parameters
⋮----
// Worst-case scenario parameters
⋮----
// Chart display options
⋮----
// Simulation state
⋮----
// Get available strategies from active block
⋮----
// Helper function for MultiSelect options
const getStrategyOptions = () =>
⋮----
// Auto-calculate trades per year from actual data
⋮----
if (trades.length < 2) return 252; // Default
⋮----
// Get date range
⋮----
// Calculate years elapsed
⋮----
if (yearsElapsed < 0.01) return 252; // Too short to calculate
⋮----
// Calculate average trades per year
⋮----
return Math.max(10, avgTradesPerYear); // At least 10
⋮----
// Auto-calculate initial capital from trades data (prefer daily logs when available)
⋮----
if (trades.length === 0) return 100000; // Default
⋮----
// Load trades and daily logs when active block changes
⋮----
const loadData = async () =>
⋮----
// Update tradesPerYear and initialCapital when calculated values change
⋮----
// Set default simulation period based on trading frequency
⋮----
// Default to using the full history unless the user opts in to recency weighting
⋮----
// Calculate actual values from user-friendly inputs
⋮----
const runSimulation = async () =>
⋮----
// Give React a chance to render the loading state before crunching numbers
⋮----
// Filter trades by selected strategies if any are selected
⋮----
// Calculate resample window based on filtered trades
⋮----
// IMPORTANT: For percentage mode with filtered strategies from multi-strategy portfolios,
// we need to provide the historical initial capital to avoid contamination from
// other strategies' P&L in fundsAtClose values.
//
// The user's initialCapital in the UI represents what they want to START with for
// the simulation. We use this same value to reconstruct the capital trajectory
// when calculating percentage returns for filtered strategies.
⋮----
// We're excluding at least one strategy. Use the UI's initial capital
// so percentage returns are reconstructed from only the filtered P&L.
⋮----
historicalInitialCapital, // Only set when simulating a subset of strategies
strategy: undefined, // We pre-filter trades instead
⋮----
const resetSimulation = () =>
⋮----
// Export functions
const exportAsJson = () =>
⋮----
const exportAsCsv = () =>
⋮----
// Metadata section
⋮----
// Statistics section
⋮----
// Percentile trajectories (cumulative returns as decimals, e.g., 0.50 = 50% return)
⋮----
{/* Trading Frequency Card */}
⋮----
{/* Controls */}
⋮----
{/* Row 1: Main Parameters */}
⋮----
{/* Column 1 */}
⋮----
{/* Column 2 - Simulation Period */}
⋮----
{/* Column 4 - Initial Capital */}
⋮----
{/* Row 2: Strategy Filter */}
⋮----
options=
⋮----
{/* Sampling Method and Normalization - Info Card */}
⋮----
{/* Sampling Method and Normalization */}
⋮----
{/* Worst-Case Scenario Injection */}
⋮----
{/* Enable Toggle */}
⋮----
{/* Percentage Slider */}
⋮----
{/* Injection Mode */}
⋮----
onChange=
⋮----
{/* Loss Sizing */}
⋮----
{/* Percentage Basis */}
⋮----
{/* Advanced Settings */}
⋮----
{/* Use Recent Data Slider */}
⋮----
{/* Random Seed */}
⋮----
{/* Action Buttons */}
⋮----
{/* Results */}
⋮----
{/* Equity Curve Chart */}
⋮----
onClick=
⋮----
{/* Statistics Cards */}
⋮----
{/* Distribution Charts */}
⋮----
// Equity Curve Chart Component
⋮----
// Convert percentiles to portfolio values
const toPortfolioValue = (arr: number[])
⋮----
// Show individual simulation paths if requested
⋮----
// P5-P95 filled area (light gray)
⋮----
// P25-P75 filled area (light blue)
⋮----
// Median line
⋮----
// Initial capital line
```

## File: app/(platform)/walk-forward/page.tsx
```typescript
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  TrendingUp,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
⋮----
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WalkForwardAnalysisChart } from "@/components/walk-forward/analysis-chart";
import { WalkForwardPeriodSelector } from "@/components/walk-forward/period-selector";
import { RobustnessMetrics } from "@/components/walk-forward/robustness-metrics";
import { RunSwitcher } from "@/components/walk-forward/run-switcher";
import { WalkForwardOptimizationTarget } from "@/lib/models/walk-forward";
import { useBlockStore } from "@/lib/stores/block-store";
import { useWalkForwardStore } from "@/lib/stores/walk-forward-store";
import { cn } from "@/lib/utils";
import {
  downloadCsv,
  downloadFile,
  generateExportFilename,
} from "@/lib/utils/export-helpers";
⋮----
function formatDate(date: Date): string
⋮----
const formatMetricValue = (value: number) =>
⋮----
const getEfficiencyStatus = (pct: number) =>
⋮----
const handleExport = (format: "csv" | "json") =>
⋮----
// payload is already a JSON string from exportResultsAsJson
⋮----
<TableCell className=
⋮----
className=
```

## File: app/(platform)/layout.tsx
```typescript
import type { CSSProperties, ReactNode } from "react"
⋮----
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
⋮----
export default function PlatformLayout({
  children,
}: {
  children: ReactNode
})
```

## File: app/apple-icon.tsx
```typescript
import { ImageResponse } from "next/og";
```

## File: app/globals.css
```css
@theme inline {
⋮----
:root {
⋮----
.dark {
⋮----
@layer base {
⋮----
* {
body {
```

## File: app/icon.tsx
```typescript
import { ImageResponse } from "next/og";
```

## File: app/page.tsx
```typescript
import { redirect } from "next/navigation";
⋮----
export default function Home()
```

## File: components/performance-charts/day-of-week-chart.tsx
```typescript
import React, { useMemo, useState } from 'react'
import { ChartWrapper, createBarChartLayout } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Layout, PlotData } from 'plotly.js'
⋮----
interface DayOfWeekChartProps {
  className?: string
}
⋮----
type ViewMode = 'dollars' | 'percent'
⋮----
// Sort data by day order
⋮----
// Color bars based on profitability
⋮----
// Create text labels showing average P/L
⋮----
if (value) setViewMode(value as ViewMode)
```

## File: components/performance-charts/drawdown-chart.tsx
```typescript
import React, { useMemo } from 'react'
import { ChartWrapper, createLineChartLayout } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { useTheme } from 'next-themes'
import type { PlotData, Layout } from 'plotly.js'
⋮----
interface DrawdownChartProps {
  className?: string
}
⋮----
// Find maximum drawdown point (most negative value)
// Use explicit initial value to avoid potential reduce edge cases
⋮----
// Main drawdown area
⋮----
mode: 'lines+markers', // Add markers to ensure all points are visible
⋮----
width: 1, // Make line visible
shape: 'linear' // Preserve sharp changes, no smoothing
⋮----
size: 2, // Small markers
⋮----
fill: 'tozeroy', // Fill to y=0 directly instead of tonexty
⋮----
// Zero line (baseline)
⋮----
// Maximum drawdown point
⋮----
// Use the same max drawdown point for consistency
⋮----
standoff: 50 // Match equity curve chart spacing
⋮----
range: yAxisRange, // Show from deepest drawdown to above zero
fixedrange: false, // Allow zoom but start with our range
type: 'linear' // Ensure linear scaling
⋮----
arrowcolor: theme === 'dark' ? '#f8fafc' : '#0f172a', // White in dark mode, black in light mode
⋮----
font: { size: 10, color: theme === 'dark' ? '#f8fafc' : '#0f172a' } // White in dark mode, black in light mode
⋮----
l: 60, // Reduce left margin since percentage labels are shorter than dollar amounts
```

## File: components/performance-charts/equity-curve-chart.tsx
```typescript
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePerformanceStore } from "@/lib/stores/performance-store";
import type { Layout, PlotData } from "plotly.js";
import { useMemo } from "react";
import { ChartWrapper, createLineChartLayout } from "./chart-wrapper";
⋮----
interface EquityCurveChartProps {
  className?: string;
}
⋮----
// Main equity line
⋮----
// High water mark line
⋮----
// Create base layout
⋮----
// Add drawdown areas if enabled
⋮----
// Find drawdown periods
⋮----
// Handle case where drawdown continues to end
⋮----
// Add shapes for drawdown periods
⋮----
// Add legend entry for drawdown periods
⋮----
// Add shapes to layout
⋮----
if (value) updateChartSettings(
⋮----
updateChartSettings(
```

## File: components/performance-charts/excursion-distribution-chart.tsx
```typescript
import React, { useMemo } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'
⋮----
interface ExcursionDistributionChartProps {
  className?: string
}
⋮----
// MFE histogram
⋮----
// MAE histogram
```

## File: components/performance-charts/exit-reason-chart.tsx
```typescript
import { useMemo } from 'react'
import type { Layout, PlotData } from 'plotly.js'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
⋮----
interface ExitReasonChartProps {
  className?: string
}
```

## File: components/performance-charts/holding-duration-chart.tsx
```typescript
import { useMemo } from 'react'
import type { Layout, PlotData } from 'plotly.js'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
⋮----
interface HoldingDurationChartProps {
  className?: string
}
```

## File: components/performance-charts/paired-leg-outcomes-chart.tsx
```typescript
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { format } from 'date-fns'
import type { Layout, PlotData } from 'plotly.js'
import { useMemo } from 'react'
import { ChartWrapper } from './chart-wrapper'
⋮----
interface GroupedLegOutcomesChartProps {
  className?: string
}
⋮----
// Increased max points since scatter plots can handle more density
⋮----
// Sort chronologically for the scatter plot line (if we wanted lines, but markers are better here)
// The store already sorts them, but let's be safe for the axis.
⋮----
// X-Axis: Actual Date/Time
⋮----
// Combine date and time if available for precise plotting
⋮----
// Prepare detailed custom data for tooltip
⋮----
OUTCOME_LABELS[entry.outcome] ?? entry.outcome, // 0: Outcome Label
entry.legCount,                                 // 1: Leg Count
entry.positiveLegs,                             // 2: Positive Legs
entry.negativeLegs,                             // 3: Negative Legs
`${dateLabel}${timeLabel}`,                     // 4: Full Date/Time
entry.strategy                                  // 5: Strategy
⋮----
tickformat: '%b %d', // e.g. "Jan 01"
⋮----
showlegend: false, // Legend is redundant with color coding and tooltip
```

## File: components/performance-charts/performance-filters.tsx
```typescript
import { MultiSelect } from "@/components/multi-select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePerformanceStore } from "@/lib/stores/performance-store";
import { Calendar, Filter } from "lucide-react";
import { useMemo } from "react";
⋮----
interface PerformanceFiltersProps {
  className?: string;
}
⋮----
// Generate strategy options from trade data
⋮----
const handleDateRangeChange = (preset: string) =>
⋮----
const getFilterSummary = () =>
⋮----
{/* Date Range Selector */}
⋮----
{/* Strategy Filter */}
⋮----
{/* Filter Summary */}
⋮----
{/* Trade Count */}
```

## File: components/performance-charts/performance-metrics.tsx
```typescript
import React from 'react'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Calendar, Target, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
⋮----
interface PerformanceMetricsProps {
  className?: string
}
⋮----
interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: 'positive' | 'negative' | 'neutral'
  subtitle?: string
  format?: 'currency' | 'percentage' | 'number' | 'ratio'
}
⋮----
const formatValue = (val: string | number) =>
⋮----
<div className=
⋮----
// Calculate additional metrics
⋮----
const bestMonth = portfolioStats.totalPl > 0 ? '+$520,782' : 'N/A' // Placeholder - would need monthly calculation
const worstMonth = portfolioStats.totalPl < 0 ? '-$122,400' : 'N/A' // Placeholder
⋮----
const avgTradeDuration = trades.length > 0 ? '1.5 days' : 'N/A' // Placeholder
⋮----
{/* Additional metrics row */}
```

## File: components/performance-charts/premium-efficiency-chart.tsx
```typescript
import { useMemo } from 'react'
import type { Layout, PlotData } from 'plotly.js'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
⋮----
interface PremiumEfficiencyChartProps {
  className?: string
}
⋮----
// Calculate gross P/L (before commissions) and net P/L (after commissions)
⋮----
// Calculate summary stats
⋮----
// Gross P/L bars (before commissions)
⋮----
// Net P/L line (after commissions)
⋮----
const formatCurrency = (value: number)
```

## File: components/performance-charts/return-distribution-chart.tsx
```typescript
import { usePerformanceStore } from "@/lib/stores/performance-store";
import type { PlotData } from "plotly.js";
import { useMemo } from "react";
import { ChartWrapper, createHistogramLayout } from "./chart-wrapper";
⋮----
interface ReturnDistributionChartProps {
  className?: string;
}
⋮----
// Calculate statistics
⋮----
// Create histogram
⋮----
[0, "#ef4444"], // Red for losses
[0.5, "#f59e0b"], // Orange for small gains
[1, "#10b981"], // Green for large gains
⋮----
// Smart x-axis range
⋮----
// Add mean line as a trace (not a shape) so it can be toggled via legend
⋮----
// Add median line as a trace (not a shape) so it can be toggled via legend
⋮----
t: 100, // Increased top margin for legend
```

## File: components/performance-charts/risk-evolution-chart.tsx
```typescript
import React, { useMemo } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'
⋮----
interface RiskEvolutionChartProps {
  className?: string
}
```

## File: components/performance-charts/rolling-metrics-chart.tsx
```typescript
import React, { useMemo, useState } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
⋮----
interface RollingMetricsChartProps {
  className?: string
}
⋮----
type MetricType = 'win_rate' | 'profit_factor' | 'sharpe'
```

## File: components/performance-charts/win-loss-streaks-chart.tsx
```typescript
import { useMemo } from 'react'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { ChartWrapper } from './chart-wrapper'
import type { PlotData, Layout } from 'plotly.js'
⋮----
// Get streak lengths
⋮----
// Win streaks trace (right side, positive Y-axis)
⋮----
// Loss streaks trace (left side, negative Y-axis and negative X-axis)
⋮----
y: lossLengths.map(length => -length), // Negative Y-axis values for losses
x: lossCounts.map(count => -count), // Negative X-axis values for left side
⋮----
// Calculate Y-axis range for the center line
```

## File: components/position-sizing/margin-chart.tsx
```typescript
/**
 * Margin utilization chart showing portfolio and per-strategy margin over time
 */
⋮----
import { Card } from "@/components/ui/card";
import { MarginTimeline } from "@/lib/calculations/margin-timeline";
import { truncateStrategyName } from "@/lib/utils";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import type { Data } from "plotly.js";
import { useMemo } from "react";
⋮----
interface MarginChartProps {
  marginTimeline: MarginTimeline;
  strategyNames: string[];
}
⋮----
export function MarginChart({
  marginTimeline,
  strategyNames,
}: MarginChartProps)
⋮----
// Portfolio line (bold)
⋮----
// Per-strategy lines (dotted)
⋮----
if (!series.some((v) => v > 0)) continue; // Skip if no margin used
```

## File: components/position-sizing/margin-statistics-table.tsx
```typescript
/**
 * Margin Utilization Analysis table showing how Kelly settings affect margin requirements
 */
⋮----
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StrategyAnalysis } from "./strategy-results";
import { HelpCircle } from "lucide-react";
⋮----
interface MarginStatistic {
  name: string;
  historicalMax: number;
  kellyPct: number;
  projectedMargin: number;
  allocated: number;
  isPortfolio: boolean;
}
⋮----
interface MarginStatisticsTableProps {
  portfolioMaxMarginPct: number;
  portfolioKellyPct: number;
  weightedAppliedPct: number;
  strategyAnalysis: StrategyAnalysis[];
}
⋮----
export function MarginStatisticsTable({
  portfolioMaxMarginPct,
  portfolioKellyPct,
  weightedAppliedPct,
  strategyAnalysis,
}: MarginStatisticsTableProps)
⋮----
// Build statistics
⋮----
// Portfolio row
⋮----
// Strategy rows
⋮----
// Sort strategies by projected margin (descending)
⋮----
{/* Header */}
⋮----
{/* Explanation */}
⋮----
{/* Table */}
⋮----
{/* Portfolio row */}
⋮----
{/* Strategy rows */}
⋮----
{/* Color coding explanation */}
```

## File: components/position-sizing/portfolio-summary.tsx
```typescript
/**
 * Portfolio Kelly summary card showing aggregate metrics
 */
⋮----
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { KellyMetrics } from "@/lib/calculations/kelly";
import { HelpCircle } from "lucide-react";
⋮----
interface PortfolioSummaryProps {
  portfolioMetrics: KellyMetrics;
  weightedAppliedPct: number;
  startingCapital: number;
  appliedCapital: number;
}
⋮----
export function PortfolioSummary({
  portfolioMetrics,
  weightedAppliedPct,
  startingCapital,
  appliedCapital,
}: PortfolioSummaryProps)
⋮----
{/* Header */}
⋮----
{/* Metrics Grid */}
⋮----
{/* Capital Summary */}
```

## File: components/position-sizing/strategy-kelly-table.tsx
```typescript
/**
 * Strategy Kelly table with inline sliders for position sizing
 */
⋮----
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
⋮----
interface StrategyData {
  name: string;
  tradeCount: number;
}
⋮----
interface StrategyKellyTableProps {
  strategies: StrategyData[];
  kellyValues: Record<string, number>;
  selectedStrategies: Set<string>;
  onKellyChange: (strategy: string, value: number) => void;
  onSelectionChange: (strategy: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}
⋮----
// Filter strategies based on search
⋮----
{/* Search bar */}
⋮----
{/* Strategy table */}
⋮----
onKellyChange(strategy.name, Number(e.target.value))
⋮----
{/* Summary footer */}
```

## File: components/position-sizing/strategy-results.tsx
```typescript
/**
 * Strategy results grid showing per-strategy Kelly metrics and allocation guidance
 */
⋮----
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { KellyMetrics } from "@/lib/calculations/kelly";
import { AlertTriangle, HelpCircle, Info } from "lucide-react";
⋮----
export interface StrategyAnalysis {
  name: string;
  tradeCount: number;
  kellyMetrics: KellyMetrics;
  inputPct: number; // User's Kelly multiplier
  appliedPct: number; // Kelly % * (input % / 100)
  maxMarginPct: number;
  allocationPct: number; // Max margin * (input % / 100)
  allocationDollars: number;
}
⋮----
inputPct: number; // User's Kelly multiplier
appliedPct: number; // Kelly % * (input % / 100)
⋮----
allocationPct: number; // Max margin * (input % / 100)
⋮----
interface StrategyResultsProps {
  strategies: StrategyAnalysis[];
  startingCapital: number;
}
⋮----
// Check if any strategy has unrealistic values
⋮----
{/* Warning banner for unrealistic backtest data */}
⋮----
// Always use normalized metrics when available (more reliable for position sizing)
⋮----
// Always show percentage returns when normalized Kelly is available
⋮----
// Calculate applied capital based on display mode
⋮----
// Calculate recommended allocation dollars based on display mode
⋮----
{/* Strategy name and badges */}
⋮----
{/* Kelly percentages */}
⋮----
{/* Win rate and payoff ratio */}
⋮----
{/* Average win/loss */}
⋮----
{/* Allocation guidance */}
```

## File: components/risk-simulator/distribution-charts.tsx
```typescript
import { useMemo } from "react";
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import type { MonteCarloResult } from "@/lib/calculations/monte-carlo";
import type { Data } from "plotly.js";
import { useTheme } from "next-themes";
⋮----
interface ReturnDistributionChartProps {
  result: MonteCarloResult;
}
⋮----
// Get final returns from all simulations
⋮----
// Calculate percentiles manually
⋮----
// Histogram
⋮----
// Get histogram max for vertical line height
⋮----
// Add percentile lines
⋮----
// Get max drawdowns from all simulations (as percentages)
⋮----
// Calculate percentiles
⋮----
// Histogram
⋮----
// Get histogram max for vertical line height
⋮----
// Add percentile lines
```

## File: components/risk-simulator/equity-curve-chart.tsx
```typescript
import { useMemo } from "react";
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import type { MonteCarloResult } from "@/lib/calculations/monte-carlo";
import type { Data } from "plotly.js";
import { useTheme } from "next-themes";
⋮----
interface EquityCurveChartProps {
  result: MonteCarloResult;
  scaleType?: "linear" | "log";
  showIndividualPaths?: boolean;
  maxPathsToShow?: number;
}
⋮----
// Convert percentiles to percentage for display
const toPercent = (arr: number[])
⋮----
// Show individual simulation paths if requested
⋮----
// P5-P25 filled area (light red/orange)
⋮----
// P25-P50 filled area (light yellow/amber)
⋮----
// P50-P75 filled area (light green)
⋮----
// P75-P95 filled area (light blue/cyan)
⋮----
// Percentile lines
⋮----
// Zero line
```

## File: components/risk-simulator/statistics-cards.tsx
```typescript
import { Card } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { MonteCarloResult } from "@/lib/calculations/monte-carlo";
import {
  AlertOctagon,
  HelpCircle,
  Percent,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
⋮----
interface StatisticsCardsProps {
  result: MonteCarloResult;
}
⋮----
export function StatisticsCards(
⋮----
// Calculate annualized return
⋮----
// Use the final timestep of the 95th percentile equity curve for best-case return
⋮----
// Calculate drawdown percentiles
⋮----
{/* Key Metrics - Top Row */}
⋮----
{/* Expected Return */}
⋮----
{/* Probability of Profit */}
⋮----
{/* Expected Drawdown */}
⋮----
{/* Return Scenarios */}
⋮----
{/* Best Case */}
⋮----
{/* Most Likely */}
⋮----
{/* Worst Case */}
⋮----
{/* Drawdown Scenarios */}
⋮----
{/* Best Case Drawdown (P5 - mild) */}
⋮----
{/* Typical Drawdown (P50) */}
⋮----
{/* Worst Case Drawdown (P95 - severe) */}
```

## File: components/risk-simulator/trading-frequency-card.tsx
```typescript
import { Card } from "@/components/ui/card";
import { TrendingUp, Calendar, Activity } from "lucide-react";
import { useMemo } from "react";
import type { Trade } from "@/lib/models/trade";
⋮----
interface TradingFrequencyCardProps {
  trades: Trade[];
  tradesPerYear: number;
}
⋮----
// Get date range
⋮----
// Calculate time elapsed
⋮----
const monthsElapsed = daysElapsed / 30.44; // Average days per month
⋮----
// Calculate rates
⋮----
// Format the time period nicely
const formatTimePeriod = () =>
⋮----
// Format the trading rate nicely
const formatTradingRate = () =>
```

## File: components/walk-forward/analysis-chart.tsx
```typescript
import type { Data } from "plotly.js";
import { useEffect, useMemo, useState } from "react";
⋮----
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import type { WalkForwardPeriodResult } from "@/lib/models/walk-forward";
⋮----
interface WalkForwardAnalysisChartProps {
  periods: WalkForwardPeriodResult[];
  targetMetricLabel: string;
}
⋮----
const slicePeriods = (range: [number, number])
⋮----
const midpoint = (start: Date, end: Date)
⋮----
// Reduce tick clutter similar to parameter chart: limit to ~12 ticks
⋮----
const toLabel = (key: string) =>
⋮----
// Reduce tick clutter: show at most ~12 ticks across the window
⋮----
setTimelineRange([Math.min(a, b), Math.max(a, b)]);
⋮----
setParamRange([Math.min(a, b), Math.max(a, b)]);
```

## File: components/walk-forward/run-switcher.tsx
```typescript
import { format } from "date-fns"
import { History, PanelRight, Trash2 } from "lucide-react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import type { WalkForwardAnalysis } from "@/lib/models/walk-forward"
⋮----
interface RunSwitcherProps {
  history: WalkForwardAnalysis[]
  currentId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => Promise<void>
}
⋮----
const pills = history.slice(0, 12) // keep top section light; full list in drawer
```

## File: components/block-metrics-table.tsx
```typescript
interface MetricRow {
  category: string
  metric: string
  value: string
  change: string
  status: "positive" | "neutral" | "negative"
}
⋮----
export function BlockMetricsTable()
```

## File: components/block-switch-dialog.tsx
```typescript
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BlockDialog } from "@/components/block-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useBlockStore } from "@/lib/stores/block-store";
import {
  Search,
  Check,
  Activity,
  Calendar,
  Plus,
  Settings
} from "lucide-react";
⋮----
interface BlockSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
⋮----
const handleSelectBlock = (blockId: string) =>
⋮----
const handleManageBlocks = () =>
⋮----
const handleCreateBlock = () =>
⋮----
{/* Search */}
⋮----
{/* Block List */}
⋮----
{/* Block Header */}
⋮----
{/* File Indicators */}
⋮----
{/* Quick Actions */}
```

## File: components/metric-card.tsx
```typescript
import { Card, CardContent } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { HelpCircle, TrendingDown, TrendingUp } from "lucide-react";
⋮----
interface TooltipContent {
  flavor: string;
  detailed: string;
}
⋮----
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  tooltip?: TooltipContent;
  format?: "currency" | "percentage" | "number" | "ratio";
  isPositive?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}
⋮----
const formatValue = (val: string | number): string =>
⋮----
const getValueColor = () =>
⋮----
const getTrendIcon = () =>
⋮----
className=
⋮----
{/* Title Row */}
⋮----
{/* Header with title */}
⋮----
{/* Content */}
⋮----
{/* Flavor text */}
⋮----
{/* Detailed explanation */}
⋮----
{/* Value */}
```

## File: components/mode-toggle.tsx
```typescript
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { IconMoonStars, IconSun } from "@tabler/icons-react"
⋮----
import { Button } from "@/components/ui/button"
```

## File: components/multi-select.tsx
```typescript
import { cva, type VariantProps } from "class-variance-authority";
import {
  CheckIcon,
  ChevronDown,
  WandSparkles,
  XCircle,
  XIcon,
} from "lucide-react";
⋮----
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, truncateStrategyName } from "@/lib/utils";
⋮----
/**
 * Animation types and configurations
 */
export interface AnimationConfig {
  /** Badge animation type */
  badgeAnimation?: "bounce" | "pulse" | "wiggle" | "fade" | "slide" | "none";
  /** Popover animation type */
  popoverAnimation?: "scale" | "slide" | "fade" | "flip" | "none";
  /** Option hover animation type */
  optionHoverAnimation?: "highlight" | "scale" | "glow" | "none";
  /** Animation duration in seconds */
  duration?: number;
  /** Animation delay in seconds */
  delay?: number;
}
⋮----
/** Badge animation type */
⋮----
/** Popover animation type */
⋮----
/** Option hover animation type */
⋮----
/** Animation duration in seconds */
⋮----
/** Animation delay in seconds */
⋮----
/**
 * Variants for the multi-select component to handle different styles.
 * Uses class-variance-authority (cva) to define different styles based on "variant" prop.
 */
⋮----
/**
 * Option interface for MultiSelect component
 */
interface MultiSelectOption {
  /** The text to display for the option. */
  label: string;
  /** The unique value associated with the option. */
  value: string;
  /** Optional icon component to display alongside the option. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Whether this option is disabled */
  disabled?: boolean;
  /** Custom styling for the option */
  style?: {
    /** Custom badge color */
    badgeColor?: string;
    /** Custom icon color */
    iconColor?: string;
    /** Gradient background for badge */
    gradient?: string;
  };
}
⋮----
/** The text to display for the option. */
⋮----
/** The unique value associated with the option. */
⋮----
/** Optional icon component to display alongside the option. */
⋮----
/** Whether this option is disabled */
⋮----
/** Custom styling for the option */
⋮----
/** Custom badge color */
⋮----
/** Custom icon color */
⋮----
/** Gradient background for badge */
⋮----
/**
 * Group interface for organizing options
 */
interface MultiSelectGroup {
  /** Group heading */
  heading: string;
  /** Options in this group */
  options: MultiSelectOption[];
}
⋮----
/** Group heading */
⋮----
/** Options in this group */
⋮----
/**
 * Props for MultiSelect component
 */
interface MultiSelectProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "animationConfig"
    >,
    VariantProps<typeof multiSelectVariants> {
  /**
   * An array of option objects or groups to be displayed in the multi-select component.
   */
  options: MultiSelectOption[] | MultiSelectGroup[];
  /**
   * Callback function triggered when the selected values change.
   * Receives an array of the new selected values.
   */
  onValueChange: (value: string[]) => void;

  /** The default selected values when the component mounts. */
  defaultValue?: string[];

  /**
   * Placeholder text to be displayed when no values are selected.
   * Optional, defaults to "Select options".
   */
  placeholder?: string;

  /**
   * Animation duration in seconds for the visual effects (e.g., bouncing badges).
   * Optional, defaults to 0 (no animation).
   */
  animation?: number;

  /**
   * Advanced animation configuration for different component parts.
   * Optional, allows fine-tuning of various animation effects.
   */
  animationConfig?: AnimationConfig;

  /**
   * Maximum number of items to display. Extra selected items will be summarized.
   * Optional, defaults to 3.
   */
  maxCount?: number;

  /**
   * The modality of the popover. When set to true, interaction with outside elements
   * will be disabled and only popover content will be visible to screen readers.
   * Optional, defaults to false.
   */
  modalPopover?: boolean;

  /**
   * If true, renders the multi-select component as a child of another component.
   * Optional, defaults to false.
   */
  asChild?: boolean;

  /**
   * Additional class names to apply custom styles to the multi-select component.
   * Optional, can be used to add custom styles.
   */
  className?: string;

  /**
   * If true, disables the select all functionality.
   * Optional, defaults to false.
   */
  hideSelectAll?: boolean;

  /**
   * If true, shows search functionality in the popover.
   * If false, hides the search input completely.
   * Optional, defaults to true.
   */
  searchable?: boolean;

  /**
   * Custom empty state message when no options match search.
   * Optional, defaults to "No results found."
   */
  emptyIndicator?: React.ReactNode;

  /**
   * If true, allows the component to grow and shrink with its content.
   * If false, uses fixed width behavior.
   * Optional, defaults to false.
   */
  autoSize?: boolean;

  /**
   * If true, shows badges in a single line with horizontal scroll.
   * If false, badges wrap to multiple lines.
   * Optional, defaults to false.
   */
  singleLine?: boolean;

  /**
   * Custom CSS class for the popover content.
   * Optional, can be used to customize popover appearance.
   */
  popoverClassName?: string;

  /**
   * If true, disables the component completely.
   * Optional, defaults to false.
   */
  disabled?: boolean;

  /**
   * Responsive configuration for different screen sizes.
   * Allows customizing maxCount and other properties based on viewport.
   * Can be boolean true for default responsive behavior or an object for custom configuration.
   */
  responsive?:
    | boolean
    | {
        /** Configuration for mobile devices (< 640px) */
        mobile?: {
          maxCount?: number;
          hideIcons?: boolean;
          compactMode?: boolean;
        };
        /** Configuration for tablet devices (640px - 1024px) */
        tablet?: {
          maxCount?: number;
          hideIcons?: boolean;
          compactMode?: boolean;
        };
        /** Configuration for desktop devices (> 1024px) */
        desktop?: {
          maxCount?: number;
          hideIcons?: boolean;
          compactMode?: boolean;
        };
      };

  /**
   * Minimum width for the component.
   * Optional, defaults to auto-sizing based on content.
   * When set, component will not shrink below this width.
   */
  minWidth?: string;

  /**
   * Maximum width for the component.
   * Optional, defaults to 100% of container.
   * Component will not exceed container boundaries.
   */
  maxWidth?: string;

  /**
   * If true, automatically removes duplicate options based on their value.
   * Optional, defaults to false (shows warning in dev mode instead).
   */
  deduplicateOptions?: boolean;

  /**
   * If true, the component will reset its internal state when defaultValue changes.
   * Useful for React Hook Form integration and form reset functionality.
   * Optional, defaults to true.
   */
  resetOnDefaultValueChange?: boolean;

  /**
   * If true, automatically closes the popover after selecting an option.
   * Useful for single-selection-like behavior or mobile UX.
   * Optional, defaults to false.
   */
  closeOnSelect?: boolean;
}
⋮----
/**
   * An array of option objects or groups to be displayed in the multi-select component.
   */
⋮----
/**
   * Callback function triggered when the selected values change.
   * Receives an array of the new selected values.
   */
⋮----
/** The default selected values when the component mounts. */
⋮----
/**
   * Placeholder text to be displayed when no values are selected.
   * Optional, defaults to "Select options".
   */
⋮----
/**
   * Animation duration in seconds for the visual effects (e.g., bouncing badges).
   * Optional, defaults to 0 (no animation).
   */
⋮----
/**
   * Advanced animation configuration for different component parts.
   * Optional, allows fine-tuning of various animation effects.
   */
⋮----
/**
   * Maximum number of items to display. Extra selected items will be summarized.
   * Optional, defaults to 3.
   */
⋮----
/**
   * The modality of the popover. When set to true, interaction with outside elements
   * will be disabled and only popover content will be visible to screen readers.
   * Optional, defaults to false.
   */
⋮----
/**
   * If true, renders the multi-select component as a child of another component.
   * Optional, defaults to false.
   */
⋮----
/**
   * Additional class names to apply custom styles to the multi-select component.
   * Optional, can be used to add custom styles.
   */
⋮----
/**
   * If true, disables the select all functionality.
   * Optional, defaults to false.
   */
⋮----
/**
   * If true, shows search functionality in the popover.
   * If false, hides the search input completely.
   * Optional, defaults to true.
   */
⋮----
/**
   * Custom empty state message when no options match search.
   * Optional, defaults to "No results found."
   */
⋮----
/**
   * If true, allows the component to grow and shrink with its content.
   * If false, uses fixed width behavior.
   * Optional, defaults to false.
   */
⋮----
/**
   * If true, shows badges in a single line with horizontal scroll.
   * If false, badges wrap to multiple lines.
   * Optional, defaults to false.
   */
⋮----
/**
   * Custom CSS class for the popover content.
   * Optional, can be used to customize popover appearance.
   */
⋮----
/**
   * If true, disables the component completely.
   * Optional, defaults to false.
   */
⋮----
/**
   * Responsive configuration for different screen sizes.
   * Allows customizing maxCount and other properties based on viewport.
   * Can be boolean true for default responsive behavior or an object for custom configuration.
   */
⋮----
/** Configuration for mobile devices (< 640px) */
⋮----
/** Configuration for tablet devices (640px - 1024px) */
⋮----
/** Configuration for desktop devices (> 1024px) */
⋮----
/**
   * Minimum width for the component.
   * Optional, defaults to auto-sizing based on content.
   * When set, component will not shrink below this width.
   */
⋮----
/**
   * Maximum width for the component.
   * Optional, defaults to 100% of container.
   * Component will not exceed container boundaries.
   */
⋮----
/**
   * If true, automatically removes duplicate options based on their value.
   * Optional, defaults to false (shows warning in dev mode instead).
   */
⋮----
/**
   * If true, the component will reset its internal state when defaultValue changes.
   * Useful for React Hook Form integration and form reset functionality.
   * Optional, defaults to true.
   */
⋮----
/**
   * If true, automatically closes the popover after selecting an option.
   * Useful for single-selection-like behavior or mobile UX.
   * Optional, defaults to false.
   */
⋮----
/**
 * Imperative methods exposed through ref
 */
export interface MultiSelectRef {
  /**
   * Programmatically reset the component to its default value
   */
  reset: () => void;
  /**
   * Get current selected values
   */
  getSelectedValues: () => string[];
  /**
   * Set selected values programmatically
   */
  setSelectedValues: (values: string[]) => void;
  /**
   * Clear all selected values
   */
  clear: () => void;
  /**
   * Focus the component
   */
  focus: () => void;
}
⋮----
/**
   * Programmatically reset the component to its default value
   */
⋮----
/**
   * Get current selected values
   */
⋮----
/**
   * Set selected values programmatically
   */
⋮----
/**
   * Clear all selected values
   */
⋮----
/**
   * Focus the component
   */
⋮----
// asChild = false, // Not currently used
⋮----
const handleResize = () =>
⋮----
const getResponsiveSettings = () =>
⋮----
const getBadgeAnimationClass = () =>
⋮----
const getPopoverAnimationClass = () =>
⋮----
const handleInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>
) =>
⋮----
const toggleOption = (optionValue: string) =>
⋮----
const handleClear = () =>
⋮----
const handleTogglePopover = () =>
⋮----
const clearExtraOptions = () =>
⋮----
const toggleAll = () =>
⋮----
const getWidthConstraints = () =>
⋮----
className=
⋮----
event.stopPropagation();
handleClear();
⋮----
onSelect=
```

## File: components/nav-documents.tsx
```typescript
import {
  IconDots,
  IconFolder,
  IconShare3,
  IconTrash,
  type Icon,
} from "@tabler/icons-react"
⋮----
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
⋮----
export function NavDocuments({
  items,
}: {
  items: {
    name: string
    url: string
    icon: Icon
  }[]
})
```

## File: components/nav-main.tsx
```typescript
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type Icon } from "@tabler/icons-react"
⋮----
import { Badge } from "@/components/ui/badge"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
⋮----
type NavItem = {
  title: string
  href: string
  icon: Icon
  badge?: string
  soon?: boolean
}
```

## File: components/nav-secondary.tsx
```typescript
import Link from "next/link"
⋮----
import { type Icon } from "@tabler/icons-react"
⋮----
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
⋮----
export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    href: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>)
```

## File: components/nav-user.tsx
```typescript
import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconUserCircle,
} from "@tabler/icons-react"
⋮----
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
⋮----
export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
})
```

## File: components/no-active-block.tsx
```typescript
import { AlertTriangle } from "lucide-react";
⋮----
interface NoActiveBlockProps {
  /** Context-specific description shown below the title */
  description?: string;
}
⋮----
/** Context-specific description shown below the title */
⋮----
export function NoActiveBlock({
  description = "Please select a block from the sidebar to continue.",
}: NoActiveBlockProps)
```

## File: components/page-placeholder.tsx
```typescript
import { IconSparkles } from "@tabler/icons-react"
⋮----
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
⋮----
interface PlaceholderItem {
  title: string
  description: string
}
⋮----
interface PagePlaceholderProps {
  title: string
  description: string
  badge?: string
  items?: PlaceholderItem[]
  actionLabel?: string
  onActionClick?: () => void
}
```

## File: components/performance-export-dialog.tsx
```typescript
import { FileJson, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
⋮----
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PerformanceData } from "@/lib/stores/performance-store";
import {
  downloadCsv,
  downloadJson,
  generateExportFilename,
} from "@/lib/utils/export-helpers";
import {
  CHART_EXPORTS,
  exportMultipleCharts,
  getChartExportsByTab,
  getMultipleChartsJson,
} from "@/lib/utils/performance-export";
⋮----
interface PerformanceExportDialogProps {
  data: PerformanceData;
  blockName: string;
}
⋮----
const toggleChart = (chartId: string) =>
⋮----
const selectAll = () =>
⋮----
const clearAll = () =>
⋮----
const handleExportSelectedCsv = () =>
⋮----
const handleExportSelectedJson = () =>
```

## File: components/progress-dialog.tsx
```typescript
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
⋮----
interface ProgressDialogProps {
  open: boolean
  title: string
  step: string
  percent: number
  onCancel?: () => void
  cancelLabel?: string
  hideCancel?: boolean
}
⋮----
// Clamp and normalize percent so we never render >100 or negatives
```

## File: components/sidebar-footer-legal.tsx
```typescript
import { AlertTriangle, Github, ShieldQuestion } from "lucide-react";
import Link from "next/link";
⋮----
import { useIsMobile } from "@/hooks/use-mobile";
⋮----
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
⋮----
// Shared dialog content
⋮----
{/* eslint-disable-next-line @next/next/no-img-element */}
⋮----
// Mobile compact version - minimal footer that stays fixed at bottom
⋮----
// Desktop compact version
⋮----
{/* eslint-disable-next-line @next/next/no-img-element */}
```

## File: components/sizing-mode-toggle.tsx
```typescript
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
⋮----
interface SizingModeToggleProps {
  id: string
  label?: string
  title: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}
⋮----
export function SizingModeToggle({
  id,
  label = "Sizing Mode",
  title,
  checked,
  onCheckedChange,
  className,
}: SizingModeToggleProps)
⋮----
<div className=
```

## File: components/strategy-breakdown-table.tsx
```typescript
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
⋮----
interface StrategyData {
  strategy: string;
  trades: number;
  totalPL: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}
⋮----
interface StrategyBreakdownTableProps {
  data?: StrategyData[];
  className?: string;
}
⋮----
type SortField = keyof StrategyData;
type SortDirection = "asc" | "desc";
⋮----
const handleSort = (field: SortField) =>
⋮----
const formatCurrency = (value: number) =>
⋮----
const formatPercentage = (value: number) => `$
⋮----
const getProfitFactorColor = (value: number) =>
⋮----
const getPLColor = (value: number) =>
⋮----
interface TooltipContent {
    flavor: string;
    detailed: string;
  }
```

## File: components/theme-provider.tsx
```typescript
import { ThemeProvider as NextThemesProvider } from "next-themes"
⋮----
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>)
```

## File: hooks/use-mobile.ts
```typescript
export function useIsMobile()
⋮----
const onChange = () =>
```

## File: hooks/use-progress-dialog.ts
```typescript
import { useRef, useState, useCallback } from "react"
⋮----
type ProgressState = { open: boolean; step: string; percent: number }
⋮----
/**
 * Shared helper for long-running tasks that need a progress dialog and cancellation.
 * Manages AbortController lifecycle, clamping percent, and common state wiring.
 */
export function useProgressDialog()
⋮----
// Abort any in-flight work before starting a new one
⋮----
get signal(): AbortSignal | undefined
```

## File: lib/calculations/index.ts
```typescript
/**
 * Calculations Engine - Main exports
 *
 * Provides comprehensive calculation functionality for portfolio analysis.
 */
⋮----
// Re-export types for convenience
⋮----
// Calculation cache interface
export interface CalculationCache {
  portfolioStats?: unknown
  performanceMetrics?: unknown
  strategyStats?: unknown
  lastCalculated: Date
  dataHash: string
}
⋮----
// Utility function to generate data hash for caching
export function generateDataHash(trades: unknown[], dailyLogs?: unknown[]): string
⋮----
// Calculation orchestrator
export class CalculationOrchestrator
⋮----
/**
   * Calculate all metrics for a block
   */
async calculateAll(
    blockId: string,
    trades: unknown[],
    dailyLogs?: unknown[],
    config?: unknown
): Promise<
⋮----
// Check cache
⋮----
// Calculate fresh results
⋮----
// Cache results
⋮----
/**
   * Clear cache for a specific block
   */
clearCache(blockId: string): void
⋮----
/**
   * Clear all cache
   */
clearAllCache(): void
⋮----
/**
   * Get cache size
   */
getCacheSize(): number
⋮----
// Global calculation orchestrator instance
⋮----
// Import legacy calculation classes for compatibility
import { PortfolioStatsCalculator } from './portfolio-stats'
import { PerformanceCalculator } from './performance'
import { Trade } from '../models/trade'
import { DailyLogEntry } from '../models/daily-log'
import { AnalysisConfig } from '../models/portfolio-stats'
```

## File: lib/calculations/kelly.ts
```typescript
/**
 * Kelly Criterion calculations for position sizing
 */
⋮----
import { Trade } from "@/lib/models/trade";
⋮----
export interface KellyMetrics {
  fraction: number;
  percent: number;
  winRate: number;
  payoffRatio: number;
  avgWin: number;
  avgLoss: number;
  hasValidKelly: boolean; // Indicates if Kelly can be calculated

  // Enhanced metrics for realistic interpretation
  avgWinPct?: number; // Average win as percentage of risk/margin
  avgLossPct?: number; // Average loss as percentage of risk/margin
  calculationMethod?: 'absolute' | 'percentage'; // How Kelly was calculated
  hasUnrealisticValues?: boolean; // True if absolute values are unrealistic
  normalizedKellyPct?: number; // Kelly % using percentage returns (if available)
}
⋮----
hasValidKelly: boolean; // Indicates if Kelly can be calculated
⋮----
// Enhanced metrics for realistic interpretation
avgWinPct?: number; // Average win as percentage of risk/margin
avgLossPct?: number; // Average loss as percentage of risk/margin
calculationMethod?: 'absolute' | 'percentage'; // How Kelly was calculated
hasUnrealisticValues?: boolean; // True if absolute values are unrealistic
normalizedKellyPct?: number; // Kelly % using percentage returns (if available)
⋮----
/**
 * Detect if absolute P&L values are unrealistic (likely from unlimited compounding)
 */
function hasUnrealisticAbsoluteValues(avgWin: number, avgLoss: number, startingCapital?: number): boolean
⋮----
// If no starting capital provided, use heuristic thresholds
⋮----
// Values over $10M are likely unrealistic for most retail traders
⋮----
// If avg win/loss is more than 100x starting capital, likely unrealistic
⋮----
/**
 * Calculate Kelly using percentage returns based on margin requirement
 * This is more appropriate for compounding strategies with variable position sizes
 */
function calculateKellyFromReturns(trades: Trade[]):
⋮----
// Skip trades without margin data
⋮----
// Calculate return as percentage of margin (risk)
⋮----
/**
 * Calculate Kelly Criterion metrics for a set of trades
 *
 * Returns metrics with actual win rate but zero Kelly fraction if insufficient data
 * (no wins, no losses, or zero denominator)
 *
 * @param trades - Array of trades to analyze
 * @param startingCapital - Optional starting capital for unrealistic value detection
 */
export function calculateKellyMetrics(
  trades: Trade[],
  startingCapital?: number
): KellyMetrics
⋮----
// Standard absolute P&L calculation
⋮----
// Check if we can calculate valid Kelly metrics
⋮----
// Check if values are unrealistic (from compounding backtests)
⋮----
// Try to calculate percentage-based Kelly for more realistic results
⋮----
// Return actual stats but with zero Kelly fraction
⋮----
/**
 * Group trades by strategy and calculate Kelly metrics for each
 *
 * @param trades - Array of trades to analyze
 * @param startingCapital - Optional starting capital for unrealistic value detection
 */
export function calculateStrategyKellyMetrics(
  trades: Trade[],
  startingCapital?: number
): Map<string, KellyMetrics>
⋮----
// Group trades by strategy
⋮----
// Calculate Kelly metrics for each strategy
```

## File: lib/calculations/margin-timeline.ts
```typescript
/**
 * Margin timeline calculations for position sizing analysis
 */
⋮----
import { Trade } from "@/lib/models/trade";
import { DailyLogEntry } from "@/lib/models/daily-log";
⋮----
export interface MarginTimeline {
  dates: string[]; // ISO date strings
  portfolioPct: number[]; // Portfolio margin % of capital
  strategyPct: Map<string, number[]>; // Per-strategy margin % of capital
  netLiq: Map<string, number>; // Net liquidation value by date
  mode: "fixed" | "compounding";
}
⋮----
dates: string[]; // ISO date strings
portfolioPct: number[]; // Portfolio margin % of capital
strategyPct: Map<string, number[]>; // Per-strategy margin % of capital
netLiq: Map<string, number>; // Net liquidation value by date
⋮----
export type MarginMode = "fixed" | "compounding";
⋮----
/**
 * Get net liquidation value from daily log for a specific date
 */
function getNetLiqFromDailyLog(
  dailyLog: DailyLogEntry[] | undefined,
  dateStr: string
): number | null
⋮----
/**
 * Convert a Date object to YYYY-MM-DD string
 */
function toDateString(date: Date): string
⋮----
/**
 * Build a map of date -> net liquidation value
 */
function buildDateToNetLiq(
  trades: Trade[],
  dateKeys: string[],
  startingCapital: number,
  dailyLog?: DailyLogEntry[]
): Map<string, number>
⋮----
// Add PnL from any trades that closed before or on this date
⋮----
// Compare date strings (YYYY-MM-DD) to avoid timezone issues
⋮----
// If trade closed on or before current date, add its P&L
⋮----
// Try to get net liq from daily log first
⋮----
/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date
⋮----
/**
 * Build margin timeline showing margin utilization over time
 */
export function buildMarginTimeline(
  trades: Trade[],
  strategyNames: string[],
  startingCapital: number,
  marginMode: MarginMode,
  dailyLog?: DailyLogEntry[]
): MarginTimeline
⋮----
// Track margin by date and strategy
⋮----
// Build margin requirements for each date
⋮----
// Add margin for each day the trade was open
⋮----
// Sort dates chronologically
⋮----
// Build net liq timeline if compounding mode
⋮----
// Calculate margin percentages
⋮----
// Initialize series for each strategy
⋮----
// Determine denominator based on mode
⋮----
// Calculate per-strategy percentages
⋮----
/**
 * Calculate maximum margin percentage used for a strategy
 */
export function calculateMaxMarginPct(
  marginTimeline: MarginTimeline,
  strategy: string
): number
```

## File: lib/calculations/mfe-mae.ts
```typescript
import { Trade } from '@/lib/models/trade'
import { computeTotalMaxProfit, computeTotalMaxLoss, computeTotalPremium, type EfficiencyBasis } from '@/lib/metrics/trade-efficiency'
import { yieldToMain, checkCancelled } from '@/lib/utils/async-helpers'
⋮----
export type NormalizationBasis = 'premium' | 'margin'
⋮----
export interface NormalizedExcursionMetrics {
  denominator: number
  mfePercent: number
  maePercent: number
  plPercent: number
}
⋮----
/**
 * Data point for a single trade's MFE/MAE metrics
 */
export interface MFEMAEDataPoint {
  tradeNumber: number
  date: Date
  strategy: string

  // Raw values (normalized)
  mfe: number // Maximum Favorable Excursion (total max profit)
  mae: number // Maximum Adverse Excursion (total max loss)
  pl: number // Realized P&L

  // Percentage values (normalized by denominator)
  mfePercent?: number
  maePercent?: number
  plPercent?: number

  // Efficiency metrics
  profitCapturePercent?: number // (pl / mfe) * 100 - what % of peak profit was captured
  excursionRatio?: number // mfe / mae - reward-to-risk ratio

  // Context
  denominator?: number
  basis: EfficiencyBasis
  isWinner: boolean
  marginReq: number
  premium?: number
  normalizedBy: Partial<Record<NormalizationBasis, NormalizedExcursionMetrics>>

  // Trade details for tooltips
  openingPrice: number
  closingPrice?: number
  numContracts: number
  avgClosingCost?: number
  fundsAtClose: number
  openingCommissionsFees: number
  closingCommissionsFees?: number
  openingShortLongRatio: number
  closingShortLongRatio?: number
  openingVix?: number
  closingVix?: number
  gap?: number
  movement?: number
  maxProfit?: number
  maxLoss?: number
  shortLongRatioChange?: number
  shortLongRatioChangePct?: number
}
⋮----
// Raw values (normalized)
mfe: number // Maximum Favorable Excursion (total max profit)
mae: number // Maximum Adverse Excursion (total max loss)
pl: number // Realized P&L
⋮----
// Percentage values (normalized by denominator)
⋮----
// Efficiency metrics
profitCapturePercent?: number // (pl / mfe) * 100 - what % of peak profit was captured
excursionRatio?: number // mfe / mae - reward-to-risk ratio
⋮----
// Context
⋮----
// Trade details for tooltips
⋮----
/**
 * Aggregated MFE/MAE statistics
 */
export interface MFEMAEStats {
  avgMFEPercent: number
  avgMAEPercent: number
  avgProfitCapturePercent: number
  avgExcursionRatio: number

  winnerAvgProfitCapture: number
  loserAvgProfitCapture: number

  medianMFEPercent: number
  medianMAEPercent: number

  totalTrades: number
  tradesWithMFE: number
  tradesWithMAE: number
}
⋮----
/**
 * Distribution bucket for histograms
 */
export interface DistributionBucket {
  bucket: string
  mfeCount: number
  maeCount: number
  range: [number, number]
}
⋮----
/**
 * Calculates MFE/MAE metrics for a single trade
 */
export function calculateTradeExcursionMetrics(trade: Trade, tradeNumber: number): MFEMAEDataPoint | null
⋮----
// Skip trades without excursion data
⋮----
// Determine denominator for percentage calculations
⋮----
// Calculate percentages if we have a denominator
⋮----
// Profit capture: what % of max profit was actually captured
⋮----
// Excursion ratio: reward/risk
⋮----
/**
 * Processes all trades to generate MFE/MAE data points
 */
export function calculateMFEMAEData(trades: Trade[]): MFEMAEDataPoint[]
⋮----
/**
 * Async version of calculateMFEMAEData with yielding for large datasets
 */
export async function calculateMFEMAEDataAsync(
  trades: Trade[],
  signal?: AbortSignal
): Promise<MFEMAEDataPoint[]>
⋮----
// Yield every 100 trades to keep UI responsive
⋮----
/**
 * Calculates aggregate statistics from MFE/MAE data points
 */
export async function calculateMFEMAEStats(
  dataPoints: MFEMAEDataPoint[],
  signal?: AbortSignal
): Promise<Partial<Record<NormalizationBasis, MFEMAEStats>>>
⋮----
type BasisAggregate = {
    count: number
    mfeSum: number
    maeSum: number
    tradesWithMFE: number
    tradesWithMAE: number
    mfePercents: number[]
    maePercents: number[]
  }
⋮----
// Yield every 200 items to keep UI responsive during large runs
⋮----
const median = (values: number[]): number =>
⋮----
// Yield between basis computations in case arrays are large
⋮----
/**
 * Creates distribution buckets for histogram visualization
 */
export function createExcursionDistribution(
  dataPoints: MFEMAEDataPoint[],
  bucketSize: number = 10
): DistributionBucket[]
⋮----
const inBucket = (value: number)
⋮----
/**
 * Async version of createExcursionDistribution with yielding for large datasets
 * Uses O(n) single-pass bucketing instead of O(n*buckets) repeated filtering
 */
export async function createExcursionDistributionAsync(
  dataPoints: MFEMAEDataPoint[],
  bucketSize: number = 10,
  signal?: AbortSignal
): Promise<DistributionBucket[]>
⋮----
// First pass: collect values and find maxima
⋮----
// Yield every 200 items to keep UI responsive
⋮----
// Adapt bucket size to avoid generating an extreme number of buckets
// which can hang the main thread and blow up memory for outlier values.
// Keep bucket count practical for both computation and chart rendering
⋮----
// Second pass: bucket counts using the (possibly adjusted) bucket size
⋮----
const clampIndex = (value: number) =>
⋮----
// Ensure edge values fall into last bucket
⋮----
// Yield after bucketing to allow paint before building output array
⋮----
// Build buckets from pre-computed counts (very fast, no filtering needed)
⋮----
// Yield occasionally when bucket counts are large to keep UI responsive
```

## File: lib/calculations/monte-carlo.ts
```typescript
/**
 * Monte Carlo Risk Simulator
 *
 * Performs bootstrap resampling simulations to project future portfolio performance
 * and calculate risk metrics like Value at Risk (VaR) and maximum drawdown distributions.
 */
⋮----
import { Trade } from "@/lib/models/trade";
⋮----
/**
 * Parameters for Monte Carlo simulation
 */
export interface MonteCarloParams {
  /** Number of simulation paths to generate */
  numSimulations: number;

  /** Number of trades/days to project forward in each simulation */
  simulationLength: number;

  /**
   * Size of the resample pool (how many recent trades/days to sample from)
   * If undefined or larger than available data, uses all available data
   * Key improvement: Can be smaller than simulationLength for stress testing
   */
  resampleWindow?: number;

  /** Resample from individual trades, daily returns, or percentage returns */
  resampleMethod: "trades" | "daily" | "percentage";

  /** Starting capital for simulations */
  initialCapital: number;

  /**
   * Historical initial capital for calculating percentage returns
   * Only needed for filtered strategies from multi-strategy portfolios
   * If not provided, will infer from first trade's fundsAtClose
   */
  historicalInitialCapital?: number;

  /** Filter to specific strategy (optional) */
  strategy?: string;

  /** Expected number of trades per year (for annualization) */
  tradesPerYear: number;

  /** Random seed for reproducibility (optional) */
  randomSeed?: number;

  /** Normalize trades to 1-lot by scaling P&L by numContracts (optional) */
  normalizeTo1Lot?: boolean;

  /** Enable worst-case scenario injection (optional) */
  worstCaseEnabled?: boolean;

  /** Percentage of trades that should be max-loss scenarios (0-100) */
  worstCasePercentage?: number;

  /** How to inject worst-case trades: add to pool or guarantee in every simulation */
  worstCaseMode?: "pool" | "guarantee";

  /** What to base the percentage on: simulation length (default) or historical data */
  worstCaseBasedOn?: "simulation" | "historical";

  /** How to size each synthetic loss: absolute historical dollars or scale to account capital */
  worstCaseSizing?: "absolute" | "relative";
}
⋮----
/** Number of simulation paths to generate */
⋮----
/** Number of trades/days to project forward in each simulation */
⋮----
/**
   * Size of the resample pool (how many recent trades/days to sample from)
   * If undefined or larger than available data, uses all available data
   * Key improvement: Can be smaller than simulationLength for stress testing
   */
⋮----
/** Resample from individual trades, daily returns, or percentage returns */
⋮----
/** Starting capital for simulations */
⋮----
/**
   * Historical initial capital for calculating percentage returns
   * Only needed for filtered strategies from multi-strategy portfolios
   * If not provided, will infer from first trade's fundsAtClose
   */
⋮----
/** Filter to specific strategy (optional) */
⋮----
/** Expected number of trades per year (for annualization) */
⋮----
/** Random seed for reproducibility (optional) */
⋮----
/** Normalize trades to 1-lot by scaling P&L by numContracts (optional) */
⋮----
/** Enable worst-case scenario injection (optional) */
⋮----
/** Percentage of trades that should be max-loss scenarios (0-100) */
⋮----
/** How to inject worst-case trades: add to pool or guarantee in every simulation */
⋮----
/** What to base the percentage on: simulation length (default) or historical data */
⋮----
/** How to size each synthetic loss: absolute historical dollars or scale to account capital */
⋮----
/**
 * Result of a single simulation path
 */
export interface SimulationPath {
  /** Equity curve values for this simulation */
  equityCurve: number[];

  /** Final portfolio value */
  finalValue: number;

  /** Total return as percentage */
  totalReturn: number;

  /** Annualized return percentage */
  annualizedReturn: number;

  /** Maximum drawdown encountered in this simulation */
  maxDrawdown: number;

  /** Sharpe ratio for this simulation */
  sharpeRatio: number;
}
⋮----
/** Equity curve values for this simulation */
⋮----
/** Final portfolio value */
⋮----
/** Total return as percentage */
⋮----
/** Annualized return percentage */
⋮----
/** Maximum drawdown encountered in this simulation */
⋮----
/** Sharpe ratio for this simulation */
⋮----
/**
 * Statistical summary of all simulations
 */
export interface SimulationStatistics {
  /** Mean final portfolio value across all simulations */
  meanFinalValue: number;

  /** Median final portfolio value */
  medianFinalValue: number;

  /** Standard deviation of final values */
  stdFinalValue: number;

  /** Mean total return percentage */
  meanTotalReturn: number;

  /** Median total return percentage */
  medianTotalReturn: number;

  /** Mean annualized return percentage */
  meanAnnualizedReturn: number;

  /** Median annualized return percentage */
  medianAnnualizedReturn: number;

  /** Mean maximum drawdown across simulations */
  meanMaxDrawdown: number;

  /** Median maximum drawdown */
  medianMaxDrawdown: number;

  /** Mean Sharpe ratio */
  meanSharpeRatio: number;

  /** Probability of profit (% of simulations ending above initial capital) */
  probabilityOfProfit: number;

  /** Value at Risk at different confidence levels */
  valueAtRisk: {
    p5: number; // 5th percentile (95% VaR)
    p10: number; // 10th percentile (90% VaR)
    p25: number; // 25th percentile
  };
}
⋮----
/** Mean final portfolio value across all simulations */
⋮----
/** Median final portfolio value */
⋮----
/** Standard deviation of final values */
⋮----
/** Mean total return percentage */
⋮----
/** Median total return percentage */
⋮----
/** Mean annualized return percentage */
⋮----
/** Median annualized return percentage */
⋮----
/** Mean maximum drawdown across simulations */
⋮----
/** Median maximum drawdown */
⋮----
/** Mean Sharpe ratio */
⋮----
/** Probability of profit (% of simulations ending above initial capital) */
⋮----
/** Value at Risk at different confidence levels */
⋮----
p5: number; // 5th percentile (95% VaR)
p10: number; // 10th percentile (90% VaR)
p25: number; // 25th percentile
⋮----
/**
 * Percentile data for equity curves across all simulations
 */
export interface PercentileData {
  /** Step numbers (x-axis) */
  steps: number[];

  /** 5th percentile equity values */
  p5: number[];

  /** 25th percentile equity values */
  p25: number[];

  /** 50th percentile (median) equity values */
  p50: number[];

  /** 75th percentile equity values */
  p75: number[];

  /** 95th percentile equity values */
  p95: number[];
}
⋮----
/** Step numbers (x-axis) */
⋮----
/** 5th percentile equity values */
⋮----
/** 25th percentile equity values */
⋮----
/** 50th percentile (median) equity values */
⋮----
/** 75th percentile equity values */
⋮----
/** 95th percentile equity values */
⋮----
/**
 * Complete Monte Carlo simulation result
 */
export interface MonteCarloResult {
  /** All simulation paths */
  simulations: SimulationPath[];

  /** Percentile equity curves */
  percentiles: PercentileData;

  /** Statistical summary */
  statistics: SimulationStatistics;

  /** Parameters used for this simulation */
  parameters: MonteCarloParams;

  /** Timestamp when simulation was run */
  timestamp: Date;

  /** Number of trades/days actually available in resample pool */
  actualResamplePoolSize: number;
}
⋮----
/** All simulation paths */
⋮----
/** Percentile equity curves */
⋮----
/** Statistical summary */
⋮----
/** Parameters used for this simulation */
⋮----
/** Timestamp when simulation was run */
⋮----
/** Number of trades/days actually available in resample pool */
⋮----
/**
 * Bootstrap resampling utilities
 */
⋮----
/**
 * Scale trade P&L to 1-lot equivalent
 *
 * @param trade - Trade to scale
 * @returns Scaled P&L value (P&L per contract)
 */
export function scaleTradeToOneLot(trade: Trade): number
⋮----
/**
 * Resample from an array with replacement
 *
 * @param data - Array of values to sample from
 * @param sampleSize - Number of samples to draw
 * @param seed - Optional random seed for reproducibility
 * @returns Array of resampled values
 */
function resampleWithReplacement<T>(
  data: T[],
  sampleSize: number,
  seed?: number
): T[]
⋮----
/**
 * Create a seeded random number generator
 * Simple LCG (Linear Congruential Generator) for reproducibility
 *
 * @param seed - Integer seed value
 * @returns Function that returns random numbers in [0, 1)
 */
function createSeededRandom(seed: number): () => number
⋮----
// LCG parameters from Numerical Recipes
⋮----
/**
 * Create synthetic maximum-loss trades for worst-case scenario testing
 *
 * For each strategy in the provided trades:
 * - Finds the maximum margin requirement
 * - Calculates average number of contracts
 * - Creates synthetic trades that lose the full allocated margin
 *
 * @param trades - All available trades
 * @param percentage - Percentage of trades to create as max-loss (0-100)
 * @param simulationLength - Length of the simulation (number of trades)
 * @param basedOn - Whether to base percentage on "simulation" length or "historical" data count
 * @returns Array of synthetic max-loss trades
 */
export function createSyntheticMaxLossTrades(
  trades: Trade[],
  percentage: number,
  simulationLength: number,
  basedOn: "simulation" | "historical" = "simulation"
): Trade[]
⋮----
// Group trades by strategy
⋮----
function allocateSyntheticCounts(weights: number[], budget: number): number[]
⋮----
/**
 * Get the resample pool from trade data
 *
 * @param trades - All available trades
 * @param resampleWindow - Number of recent trades to use (undefined = all)
 * @param strategy - Optional strategy filter
 * @returns Array of trades to resample from
 */
export function getTradeResamplePool(
  trades: Trade[],
  resampleWindow?: number,
  strategy?: string
): Trade[]
⋮----
// Filter by strategy if specified
⋮----
// Sort by date to ensure consistent ordering
⋮----
// Apply resample window if specified
⋮----
// Take the most recent N trades
⋮----
/**
 * Resample trade P&L values with replacement
 *
 * @param trades - Trades to resample from
 * @param sampleSize - Number of trades to generate
 * @param seed - Optional random seed
 * @returns Array of resampled P&L values
 */
export function resampleTradePLs(
  trades: Trade[],
  sampleSize: number,
  seed?: number
): number[]
⋮----
/**
 * Calculate daily returns from trades
 * Groups trades by date and sums P&L for each day
 *
 * @param trades - Trades to aggregate
 * @param normalizeTo1Lot - Whether to scale P&L to 1-lot
 * @returns Array of { date, dailyPL } objects sorted by date
 */
export function calculateDailyReturns(
  trades: Trade[],
  normalizeTo1Lot?: boolean
): Array<
⋮----
// Group trades by date
⋮----
// Use ISO date string as key (YYYY-MM-DD)
⋮----
// Convert to sorted array
⋮----
/**
 * Get the resample pool from daily returns data
 *
 * @param dailyReturns - All daily returns
 * @param resampleWindow - Number of recent days to use (undefined = all)
 * @returns Array of daily P&L values to resample from
 */
export function getDailyResamplePool(
  dailyReturns: Array<{ date: string; dailyPL: number }>,
  resampleWindow?: number
): number[]
⋮----
// Already sorted by date from calculateDailyReturns
⋮----
// Apply resample window if specified
⋮----
// Take the most recent N days
⋮----
/**
 * Calculate percentage returns from trades based on capital at trade time
 * This properly accounts for compounding strategies where position sizes grow with equity
 *
 * IMPORTANT: For filtered strategies from multi-strategy portfolios, the initialCapital
 * parameter must be provided to avoid contamination from other strategies' P&L in fundsAtClose.
 *
 * @param trades - Trades to calculate percentage returns from
 * @param normalizeTo1Lot - Whether to scale P&L to 1-lot before calculating percentage
 * @param initialCapital - Starting capital for this strategy (required for accurate filtered results)
 * @returns Array of percentage returns (as decimals, e.g., 0.05 = 5%)
 */
export function calculatePercentageReturns(
  trades: Trade[],
  normalizeTo1Lot?: boolean,
  initialCapital?: number
): number[]
⋮----
// Sort trades by date to ensure proper chronological order
⋮----
// Determine starting capital
⋮----
// Use provided initial capital (for filtered strategies)
⋮----
// Infer from first trade's fundsAtClose (for single-strategy portfolios)
⋮----
// Account is busted, treat remaining returns as 0
⋮----
// Get trade P&L (optionally normalized)
⋮----
// Calculate percentage return based on current capital
⋮----
// Update capital for next trade using ONLY this strategy's P&L
// This ensures filtered strategies track their own capital independently
⋮----
/**
 * Get the resample pool from percentage returns data
 *
 * @param percentageReturns - All percentage returns
 * @param resampleWindow - Number of recent returns to use (undefined = all)
 * @returns Array of percentage returns to resample from
 */
export function getPercentageResamplePool(
  percentageReturns: number[],
  resampleWindow?: number
): number[]
⋮----
// Take the most recent N returns
⋮----
/**
 * Resample daily P&L values with replacement
 *
 * @param dailyPLs - Daily P&L values to resample from
 * @param sampleSize - Number of days to generate
 * @param seed - Optional random seed
 * @returns Array of resampled daily P&L values
 */
export function resampleDailyPLs(
  dailyPLs: number[],
  sampleSize: number,
  seed?: number
): number[]
⋮----
/**
 * Core Monte Carlo simulation engine
 */
⋮----
/**
 * Run a single simulation path and calculate its metrics
 *
 * @param resampledValues - Array of resampled values (either P&L or percentage returns)
 * @param initialCapital - Starting capital
 * @param tradesPerYear - Number of trades per year for annualization
 * @param isPercentageMode - Whether values are percentage returns (true) or dollar P&L (false)
 * @returns SimulationPath with equity curve and metrics
 */
function runSingleSimulation(
  resampledValues: number[],
  initialCapital: number,
  tradesPerYear: number,
  isPercentageMode: boolean = false
): SimulationPath
⋮----
// Track capital over time
⋮----
// Build equity curve (as cumulative returns from starting capital)
⋮----
// Value is a percentage return - apply it to current capital
⋮----
// Value is dollar P&L - add it to capital
⋮----
// Final metrics
⋮----
// Annualized return
⋮----
// Maximum drawdown
⋮----
// Sharpe ratio (using individual returns)
⋮----
/**
 * Calculate maximum drawdown from an equity curve
 *
 * @param equityCurve - Array of cumulative returns (as decimals, e.g., 0.5 = 50% gain)
 * @returns Maximum drawdown as a decimal (positive number for losses, e.g., 0.2 = 20% drawdown)
 */
function calculateMaxDrawdown(equityCurve: number[]): number
⋮----
let peak = 0; // Treat initial capital (0% return) as the starting peak
⋮----
// Calculate drawdown as percentage decline from peak
// Convert cumulative returns to portfolio values for calculation
// portfolioValue = initialCapital * (1 + cumulativeReturn)
// peakValue = initialCapital * (1 + peak)
// drawdown = (peakValue - currentValue) / peakValue
//          = (1 + peak - 1 - cumulativeReturn) / (1 + peak)
//          = (peak - cumulativeReturn) / (1 + peak)
⋮----
if (peak > -1) { // Avoid division by zero if portfolio goes to zero
⋮----
/**
 * Calculate Sharpe ratio from returns
 *
 * @param returns - Array of individual returns
 * @param periodsPerYear - Number of trading periods per year
 * @returns Sharpe ratio (annualized)
 */
function calculateSharpeRatio(
  returns: number[],
  periodsPerYear: number
): number
⋮----
// Mean return
⋮----
// Standard deviation (sample std dev with N-1)
⋮----
// Annualized Sharpe ratio (assuming risk-free rate = 0)
⋮----
/**
 * Run Monte Carlo simulation
 *
 * @param trades - Historical trade data
 * @param params - Simulation parameters
 * @returns MonteCarloResult with all simulations and analysis
 */
export function runMonteCarloSimulation(
  trades: Trade[],
  params: MonteCarloParams
): MonteCarloResult
⋮----
// Validate inputs
⋮----
// Get resample pool based on method
⋮----
// Individual trade P&L resampling
⋮----
// Extract P&L values, optionally scaling to 1-lot
⋮----
// Daily returns resampling
⋮----
// Percentage returns resampling (for compounding strategies)
⋮----
params.historicalInitialCapital // Use historical capital (if provided) to reconstruct trajectory
⋮----
// Validate resample pool size
⋮----
// Handle worst-case scenario injection
⋮----
// Create synthetic max-loss trades
⋮----
// Convert synthetic trades to P&L values based on resample method
⋮----
// If mode is "pool", add to resample pool
⋮----
// Run all simulations
⋮----
// Generate unique seed for each simulation if base seed provided
⋮----
// Resample P&Ls
⋮----
// Run simulation
⋮----
// Calculate percentiles
⋮----
// Calculate statistics
⋮----
/**
 * Calculate percentile curves across all simulations
 *
 * @param simulations - Array of simulation paths
 * @returns PercentileData with P5, P25, P50, P75, P95 curves
 */
function calculatePercentiles(
  simulations: SimulationPath[]
): PercentileData
⋮----
// For each step, collect all values at that step and calculate percentiles
⋮----
/**
 * Calculate a specific percentile from sorted data
 *
 * @param sortedData - Array of numbers sorted in ascending order
 * @param p - Percentile to calculate (0-100)
 * @returns Percentile value
 */
function percentile(sortedData: number[], p: number): number
⋮----
/**
 * Calculate aggregate statistics from all simulations
 *
 * @param simulations - Array of simulation paths
 * @param initialCapital - Starting capital
 * @returns SimulationStatistics
 */
function calculateStatistics(simulations: SimulationPath[]): SimulationStatistics
⋮----
// Sort for percentile calculations
⋮----
// Mean and median calculations
⋮----
// Standard deviation of final values
⋮----
// Probability of profit
⋮----
// Value at Risk
```

## File: lib/calculations/performance.ts
```typescript
/**
 * Performance Metrics Calculator
 *
 * Calculates performance data for charts and visualizations.
 * Based on legacy Python performance calculations.
 */
⋮----
import { Trade } from '../models/trade'
import { DailyLogEntry } from '../models/daily-log'
import { PerformanceMetrics, TimePeriod } from '../models/portfolio-stats'
⋮----
/**
 * Performance calculator for chart data and visualizations
 */
export class PerformanceCalculator
⋮----
/**
   * Calculate comprehensive performance metrics
   */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
static calculatePerformanceMetrics(trades: Trade[], _dailyLogEntries?: DailyLogEntry[]): PerformanceMetrics
⋮----
// Sort trades chronologically
⋮----
// Calculate cumulative P/L
⋮----
// Calculate drawdown data
⋮----
// Calculate aggregated P/L by time period
⋮----
/**
   * Calculate cumulative P/L over time
   */
private static calculateCumulativePL(sortedTrades: Trade[]): Array<
⋮----
// Group trades by date to handle multiple trades per day
⋮----
// Sort dates and calculate cumulative P/L
⋮----
/**
   * Calculate drawdown data for visualization
   */
private static calculateDrawdownData(cumulativePl: Array<
⋮----
/**
   * Aggregate P/L by time period
   */
private static aggregatePLByPeriod(trades: Trade[], period: TimePeriod): Record<string, number>
⋮----
/**
   * Generate date key for aggregation
   */
private static getDateKey(date: Date, period: TimePeriod): string
⋮----
/**
   * Get week number for a date
   */
private static getWeekNumber(date: Date): number
⋮----
/**
   * Calculate monthly returns (percentage)
   */
static calculateMonthlyReturns(trades: Trade[], initialCapital?: number): Record<string, number>
⋮----
/**
   * Calculate rolling Sharpe ratio
   */
static calculateRollingSharpe(
    trades: Trade[],
    windowDays: number = 30,
    riskFreeRate: number = 0.02
): Array<
⋮----
const dailyRiskFreeRate = riskFreeRate / 252 // Assume 252 trading days
⋮----
/**
   * Calculate win/loss streaks
   */
static calculateStreaks(trades: Trade[]):
⋮----
// Continue current streak
⋮----
// End previous streak and start new one
⋮----
// Update longest streaks
⋮----
// Start new streak
⋮----
// Handle final streak
⋮----
/**
   * Calculate trade distribution by P/L ranges
   */
static calculatePLDistribution(trades: Trade[], bucketSize: number = 500): Record<string, number>
```

## File: lib/calculations/streak-analysis.ts
```typescript
import { Trade } from '@/lib/models/trade'
⋮----
export interface StreakData {
  type: 'win' | 'loss'
  length: number
  totalPl: number
  trades: Trade[]
}
⋮----
export interface StreakDistribution {
  streaks: StreakData[]
  winDistribution: Record<number, number>
  lossDistribution: Record<number, number>
  statistics: {
    maxWinStreak: number
    maxLossStreak: number
    avgWinStreak: number
    avgLossStreak: number
    totalWinStreaks: number
    totalLossStreaks: number
  }
}
⋮----
/**
 * Calculate comprehensive win/loss streak analysis.
 * Based on legacy/app/calculations/performance.py::calculate_streak_distributions
 */
export function calculateStreakDistributions(trades: Trade[]): StreakDistribution
⋮----
// Sort trades chronologically
⋮----
// Identify all streaks
⋮----
// Continue current streak
⋮----
// End current streak and start new one
⋮----
// Don't forget the last streak
⋮----
// Calculate streak distribution
⋮----
// Count occurrences of each streak length
⋮----
// Calculate statistics
```

## File: lib/calculations/walk-forward-analyzer.ts
```typescript
import { Trade } from '../models/trade'
import { DailyLogEntry } from '../models/daily-log'
import {
  WalkForwardConfig,
  WalkForwardComputation,
  WalkForwardParameterRanges,
  WalkForwardPeriodResult,
  WalkForwardProgressEvent,
  WalkForwardResults,
  WalkForwardSummary,
  WalkForwardWindow,
} from '../models/walk-forward'
import { PortfolioStatsCalculator } from './portfolio-stats'
import { calculateKellyMetrics } from './kelly'
import { PortfolioStats } from '../models/portfolio-stats'
⋮----
interface AnalyzeOptions {
  trades: Trade[]
  /**
   * Daily portfolio logs. Reserved for future use to enable more accurate
   * equity curve calculations during walk-forward periods. Currently unused.
   */
  dailyLogs?: DailyLogEntry[]
  config: WalkForwardConfig
  signal?: AbortSignal
  onProgress?: (event: WalkForwardProgressEvent) => void
}
⋮----
/**
   * Daily portfolio logs. Reserved for future use to enable more accurate
   * equity curve calculations during walk-forward periods. Currently unused.
   */
⋮----
interface ScalingBaseline {
  baseKellyFraction: number
  avgContracts: number
}
⋮----
interface CombinationIterator {
  values: Array<Record<string, number>>
  count: number
}
⋮----
export class WalkForwardAnalyzer
⋮----
// Cache for trade timestamps to avoid repeated Date parsing
⋮----
private getTradeTimestamp(trade: Trade): number
⋮----
async analyze(options: AnalyzeOptions): Promise<WalkForwardComputation>
⋮----
// Clear cache for new analysis
⋮----
private ensureValidConfig(config: WalkForwardConfig): void
⋮----
private sortTrades(trades: Trade[]): Trade[]
⋮----
private filterTrades(trades: Trade[], start: Date, end: Date): Trade[]
⋮----
// Add full day to end date to include all trades on that day regardless of time
⋮----
private buildWindows(trades: Trade[], config: WalkForwardConfig): WalkForwardWindow[]
⋮----
private floorToUTCDate(date: Date): Date
⋮----
private buildCombinationIterator(parameterRanges: WalkForwardParameterRanges): CombinationIterator
⋮----
const recurse = (index: number, current: Record<string, number>) =>
⋮----
private buildRangeValues(min: number, max: number, step: number): number[]
⋮----
private buildScalingBaseline(trades: Trade[]): ScalingBaseline
⋮----
private applyScenario(
    trades: Trade[],
    params: Record<string, number>,
    baseline: ScalingBaseline,
    initialCapitalOverride?: number
): Trade[]
⋮----
// trades are already sorted from filterTrades() which preserves sortedTrades order
⋮----
// Only include fields used by PortfolioStatsCalculator to reduce object copy overhead
⋮----
private calculatePositionMultiplier(params: Record<string, number>, baseline: ScalingBaseline): number
⋮----
private buildStrategyWeights(params: Record<string, number>): Record<string, number>
⋮----
private normalizeStrategyKey(strategy?: string): string
⋮----
private isRiskAcceptable(
    params: Record<string, number>,
    stats: PortfolioStats,
    scaledTrades: Trade[]
): boolean
⋮----
private calculateMaxConsecutiveLosses(trades: Trade[]): number
⋮----
// trades are already sorted from applyScenario()
⋮----
private calculateMaxDailyLossPct(trades: Trade[], initialCapital: number): number
⋮----
private normalizeDateKey(date: Date | string): string
⋮----
private getTargetMetricValue(stats: PortfolioStats, target: WalkForwardConfig['optimizationTarget']): number
⋮----
private async yieldToEventLoop(): Promise<void>
⋮----
private throwIfAborted(signal?: AbortSignal): void
⋮----
private buildResults(
    periods: WalkForwardPeriodResult[],
    config: WalkForwardConfig,
    totalPeriods: number,
    totalParameterTests: number,
    analyzedTrades: number,
    startedAt: Date,
    completedAt: Date = new Date(),
    skippedPeriods = 0
): WalkForwardResults
⋮----
private calculateSummary(periods: WalkForwardPeriodResult[]): WalkForwardSummary
⋮----
private calculateParameterStability(periods: WalkForwardPeriodResult[]): number
⋮----
// Normalize by mean to avoid requiring parameter ranges here
⋮----
private calculateConsistencyScore(periods: WalkForwardPeriodResult[]): number
⋮----
private calculateAveragePerformanceDelta(periods: WalkForwardPeriodResult[]): number
⋮----
private calculateRobustnessScore(summary: WalkForwardSummary, consistencyScore: number): number
⋮----
private normalize(value: number, min: number, max: number): number
```

## File: lib/db/blocks-store.ts
```typescript
/**
 * Blocks Store - CRUD operations for trading blocks
 */
⋮----
import { ProcessedBlock, Block } from '../models/block'
import { STORES, withReadTransaction, withWriteTransaction, promisifyRequest, DatabaseError } from './index'
⋮----
/**
 * Create a new block
 */
export async function createBlock(blockData: Omit<ProcessedBlock, 'id' | 'created' | 'lastModified'>): Promise<ProcessedBlock>
⋮----
/**
 * Get block by ID
 */
export async function getBlock(blockId: string): Promise<ProcessedBlock | null>
⋮----
/**
 * Get all blocks
 */
export async function getAllBlocks(): Promise<ProcessedBlock[]>
⋮----
// Sort by last modified (newest first)
⋮----
/**
 * Get active block
 */
export async function getActiveBlock(): Promise<ProcessedBlock | null>
⋮----
/**
 * Update block
 */
export async function updateBlock(blockId: string, updates: Partial<ProcessedBlock>): Promise<ProcessedBlock>
⋮----
// Get existing block
⋮----
// Merge updates with lastModified timestamp
⋮----
/**
 * Set active block (deactivates all others)
 */
export async function setActiveBlock(blockId: string): Promise<void>
⋮----
// First, verify the block exists
⋮----
// Get all blocks and update their active status
⋮----
/**
 * Delete block and all associated data
 */
export async function deleteBlock(blockId: string): Promise<void>
⋮----
// Delete block
⋮----
// Delete associated trades
⋮----
// Delete associated daily logs
⋮----
// Delete associated reporting trades
⋮----
// Delete associated calculations
⋮----
/**
 * Get blocks count
 */
export async function getBlocksCount(): Promise<number>
⋮----
/**
 * Check if block name is unique
 */
export async function isBlockNameUnique(name: string, excludeId?: string): Promise<boolean>
⋮----
/**
 * Update block processing status
 */
export async function updateProcessingStatus(
  blockId: string,
  status: ProcessedBlock['processingStatus'],
  error?: string
): Promise<void>
⋮----
/**
 * Update block statistics
 */
export async function updateBlockStats(
  blockId: string,
  portfolioStats: ProcessedBlock['portfolioStats'],
  strategyStats?: ProcessedBlock['strategyStats'],
  performanceMetrics?: ProcessedBlock['performanceMetrics']
): Promise<void>
⋮----
/**
 * Convert ProcessedBlock to legacy Block format (for backward compatibility)
 */
export function toLegacyBlock(processedBlock: ProcessedBlock): Block
```

## File: lib/db/combined-trades-cache.ts
```typescript
/**
 * Combined Trades Cache
 *
 * Caches pre-calculated combined leg group trades in IndexedDB
 * to avoid expensive recalculation on every page load.
 */
⋮----
import { CombinedTrade } from "../utils/combine-leg-groups";
import {
  INDEXES,
  promisifyRequest,
  STORES,
  withReadTransaction,
  withWriteTransaction,
} from "./index";
⋮----
/**
 * Cache entry for combined trades
 */
interface CombinedTradesCache {
  id: string; // Format: `combined_trades_${blockId}`
  blockId: string;
  calculationType: "combined_trades";
  trades: CombinedTrade[];
  tradeCount: number;
  calculatedAt: Date;
}
⋮----
id: string; // Format: `combined_trades_${blockId}`
⋮----
/**
 * Generate the cache ID for a block
 */
function getCacheId(blockId: string): string
⋮----
/**
 * Store pre-calculated combined trades for a block
 */
export async function storeCombinedTradesCache(
  blockId: string,
  combinedTrades: CombinedTrade[]
): Promise<void>
⋮----
/**
 * Get cached combined trades for a block
 * Returns null if cache doesn't exist
 */
export async function getCombinedTradesCache(
  blockId: string
): Promise<CombinedTrade[] | null>
⋮----
// Restore Date objects that were serialized
⋮----
/**
 * Delete cached combined trades for a block
 */
export async function deleteCombinedTradesCache(
  blockId: string
): Promise<void>
⋮----
// Check if entry exists before trying to delete
⋮----
/**
 * Check if combined trades cache exists for a block
 */
export async function hasCombinedTradesCache(
  blockId: string
): Promise<boolean>
⋮----
/**
 * Invalidate all calculation caches for a block
 * (including combined trades cache)
 */
export async function invalidateBlockCaches(blockId: string): Promise<void>
```

## File: lib/db/daily-logs-store.ts
```typescript
/**
 * Daily Logs Store - CRUD operations for daily log data
 */
⋮----
import { DailyLogEntry } from '../models/daily-log'
import { STORES, INDEXES, withReadTransaction, withWriteTransaction, promisifyRequest } from './index'
⋮----
/**
 * Extended daily log entry with block association
 */
export interface StoredDailyLogEntry extends DailyLogEntry {
  blockId: string
  id?: number // Auto-generated by IndexedDB
}
⋮----
id?: number // Auto-generated by IndexedDB
⋮----
/**
 * Add daily log entries for a block (batch operation)
 */
export async function addDailyLogEntries(blockId: string, entries: DailyLogEntry[]): Promise<void>
⋮----
// Use Promise.all for better performance with large datasets
⋮----
/**
 * Get all daily log entries for a block
 */
export async function getDailyLogsByBlock(blockId: string): Promise<StoredDailyLogEntry[]>
⋮----
// Sort by date (chronological order)
⋮----
/**
 * Get daily log entries by date range for a block
 */
export async function getDailyLogsByDateRange(
  blockId: string,
  startDate: Date,
  endDate: Date
): Promise<StoredDailyLogEntry[]>
⋮----
// Create compound key range [blockId, startDate] to [blockId, endDate]
⋮----
/**
 * Get daily log entry for a specific date
 */
export async function getDailyLogByDate(blockId: string, date: Date): Promise<StoredDailyLogEntry | null>
⋮----
/**
 * Get daily log count by block
 */
export async function getDailyLogCountByBlock(blockId: string): Promise<number>
⋮----
/**
 * Delete all daily log entries for a block
 */
export async function deleteDailyLogsByBlock(blockId: string): Promise<void>
⋮----
/**
 * Update daily log entries for a block (replace all)
 */
export async function updateDailyLogsForBlock(blockId: string, entries: DailyLogEntry[]): Promise<void>
⋮----
// First delete existing entries
⋮----
// Then add new entries
⋮----
/**
 * Get daily log statistics for a block
 */
export async function getDailyLogStatistics(blockId: string): Promise<
⋮----
// Get date range
⋮----
// Final portfolio value (last entry)
⋮----
// Calculate max drawdown (most negative value)
⋮----
// Total P/L (sum of all daily P/L)
⋮----
// Average daily P/L
⋮----
/**
 * Get portfolio value over time (for charts)
 */
export async function getPortfolioValueTimeSeries(blockId: string): Promise<Array<
⋮----
/**
 * Get daily P/L aggregated by month
 */
export async function getMonthlyPl(blockId: string): Promise<Record<string, number>>
⋮----
/**
 * Get daily P/L aggregated by week
 */
export async function getWeeklyPl(blockId: string): Promise<Record<string, number>>
⋮----
/**
 * Export daily logs to CSV format
 */
export async function exportDailyLogsToCSV(blockId: string): Promise<string>
⋮----
// CSV headers
⋮----
// Convert entries to CSV rows
⋮----
// Combine headers and rows
⋮----
/**
 * Helper function to get week number
 */
function getWeekNumber(date: Date): number
```

## File: lib/db/performance-snapshot-cache.ts
```typescript
/**
 * Performance Snapshot Cache
 *
 * Caches pre-calculated performance snapshots in IndexedDB
 * to avoid expensive recalculation on every page load.
 */
⋮----
import { PortfolioStats } from "../models/portfolio-stats";
import { Trade } from "../models/trade";
import { DailyLogEntry } from "../models/daily-log";
import { SnapshotChartData } from "../services/performance-snapshot";
import {
  promisifyRequest,
  STORES,
  withReadTransaction,
  withWriteTransaction,
} from "./index";
⋮----
/**
 * Cache entry for performance snapshot
 */
interface PerformanceSnapshotCache {
  id: string; // Format: `performance_snapshot_${blockId}`
  blockId: string;
  calculationType: "performance_snapshot";
  portfolioStats: PortfolioStats;
  chartData: SnapshotChartData;
  filteredTrades: Trade[];
  filteredDailyLogs: DailyLogEntry[];
  calculatedAt: Date;
}
⋮----
id: string; // Format: `performance_snapshot_${blockId}`
⋮----
/**
 * Public interface for cached snapshot data
 */
export interface CachedPerformanceSnapshot {
  portfolioStats: PortfolioStats;
  chartData: SnapshotChartData;
  filteredTrades: Trade[];
  filteredDailyLogs: DailyLogEntry[];
  calculatedAt: Date;
}
⋮----
/**
 * Generate the cache ID for a block
 */
function getCacheId(blockId: string): string
⋮----
/**
 * Store pre-calculated performance snapshot for a block
 */
export async function storePerformanceSnapshotCache(
  blockId: string,
  snapshot: {
    portfolioStats: PortfolioStats;
    chartData: SnapshotChartData;
    filteredTrades: Trade[];
    filteredDailyLogs: DailyLogEntry[];
  }
): Promise<void>
⋮----
/**
 * Restore Date objects from serialized cache data
 */
function restoreDates<T extends { dateOpened?: Date | string; dateClosed?: Date | string | null }>(
  items: T[]
): T[]
⋮----
/**
 * Restore Date objects in daily logs
 */
function restoreDailyLogDates(logs: DailyLogEntry[]): DailyLogEntry[]
⋮----
/**
 * Restore Date objects in chart data
 */
function restoreChartDataDates(chartData: SnapshotChartData): SnapshotChartData
⋮----
// Most chart data uses ISO string dates, which is fine
// Only restore where Date objects are expected
⋮----
/**
 * Get cached performance snapshot for a block
 * Returns null if cache doesn't exist
 */
export async function getPerformanceSnapshotCache(
  blockId: string
): Promise<CachedPerformanceSnapshot | null>
⋮----
// Restore Date objects that were serialized
⋮----
/**
 * Delete cached performance snapshot for a block
 */
export async function deletePerformanceSnapshotCache(
  blockId: string
): Promise<void>
⋮----
// Check if entry exists before trying to delete
⋮----
/**
 * Check if performance snapshot cache exists for a block
 */
export async function hasPerformanceSnapshotCache(
  blockId: string
): Promise<boolean>
```

## File: lib/db/reporting-logs-store.ts
```typescript
/**
 * Reporting Logs Store - CRUD operations for reporting (backtest) trade data
 */
⋮----
import { ReportingTrade } from '../models/reporting-trade'
import { STORES, INDEXES, withReadTransaction, withWriteTransaction, promisifyRequest } from './index'
⋮----
export interface StoredReportingTrade extends ReportingTrade {
  blockId: string
  id?: number
}
⋮----
export async function addReportingTrades(blockId: string, trades: ReportingTrade[]): Promise<void>
⋮----
export async function getReportingTradesByBlock(blockId: string): Promise<StoredReportingTrade[]>
⋮----
export async function getReportingTradeCountByBlock(blockId: string): Promise<number>
⋮----
export async function getReportingStrategiesByBlock(blockId: string): Promise<string[]>
⋮----
export async function deleteReportingTradesByBlock(blockId: string): Promise<void>
⋮----
export async function updateReportingTradesForBlock(blockId: string, trades: ReportingTrade[]): Promise<void>
```

## File: lib/db/trades-store.ts
```typescript
/**
 * Trades Store - CRUD operations for trade data
 */
⋮----
import { Trade } from "../models/trade";
import {
  combineAllLegGroups,
  CombinedTrade,
} from "../utils/combine-leg-groups";
import {
  INDEXES,
  promisifyRequest,
  STORES,
  withReadTransaction,
  withWriteTransaction,
} from "./index";
import {
  deleteCombinedTradesCache,
  getCombinedTradesCache,
  storeCombinedTradesCache,
} from "./combined-trades-cache";
import { deletePerformanceSnapshotCache } from "./performance-snapshot-cache";
⋮----
// Track in-flight combined cache writes to avoid redundant work when multiple callers miss the cache simultaneously.
⋮----
/**
 * Extended trade with block association
 */
export interface StoredTrade extends Trade {
  blockId: string;
  id?: number; // Auto-generated by IndexedDB
}
⋮----
id?: number; // Auto-generated by IndexedDB
⋮----
/**
 * Add trades for a block (batch operation)
 */
export async function addTrades(
  blockId: string,
  trades: Trade[]
): Promise<void>
⋮----
// Use Promise.all for better performance with large datasets
⋮----
// Invalidate caches since trades changed
⋮----
/**
 * Get all trades for a block
 */
export async function getTradesByBlock(
  blockId: string
): Promise<StoredTrade[]>
⋮----
// Sort by date opened (chronological order)
⋮----
// If same date, sort by time
⋮----
/**
 * Get all trades for a block with optional leg group combining
 *
 * Uses cached combined trades when available for better performance.
 * Falls back to on-demand calculation if cache is missing.
 *
 * @param blockId - Block ID to fetch trades for
 * @param options.combineLegGroups - Whether to combine trades with same entry timestamp
 * @param options.skipCache - Force recalculation (bypass cache)
 * @returns Array of trades (combined or raw)
 */
export async function getTradesByBlockWithOptions(
  blockId: string,
  options: { combineLegGroups?: boolean; skipCache?: boolean } = {}
): Promise<(StoredTrade | (CombinedTrade &
⋮----
// If combining is enabled, check cache FIRST before fetching raw trades
// This avoids the expensive raw trade fetch when we have cached data
⋮----
// Add blockId back to cached trades
⋮----
// Fetch raw trades (only if not combining, or cache miss)
⋮----
// Cache miss: calculate combined trades on-demand
⋮----
// Add blockId back to combined trades
⋮----
function queueCombinedTradesCache(blockId: string, combinedTrades: CombinedTrade[])
⋮----
/**
 * Get trades by date range for a block
 */
export async function getTradesByDateRange(
  blockId: string,
  startDate: Date,
  endDate: Date
): Promise<StoredTrade[]>
⋮----
// Create compound key range [blockId, startDate] to [blockId, endDate]
⋮----
/**
 * Get trades by strategy for a block
 */
export async function getTradesByStrategy(
  blockId: string,
  strategy: string
): Promise<StoredTrade[]>
⋮----
// Filter by strategy (IndexedDB doesn't support compound queries easily)
⋮----
/**
 * Get unique strategies for a block
 */
export async function getStrategiesByBlock(blockId: string): Promise<string[]>
⋮----
/**
 * Get trade count by block
 */
export async function getTradeCountByBlock(blockId: string): Promise<number>
⋮----
/**
 * Delete all trades for a block
 */
export async function deleteTradesByBlock(blockId: string): Promise<void>
⋮----
// Invalidate caches since trades changed
⋮----
/**
 * Update trades for a block (replace all)
 */
export async function updateTradesForBlock(
  blockId: string,
  trades: Trade[]
): Promise<void>
⋮----
// First delete existing trades
⋮----
// Then add new trades
⋮----
// Invalidate caches since trades changed
⋮----
/**
 * Get trade statistics for a block (aggregated)
 */
export async function getTradeStatistics(blockId: string): Promise<
⋮----
// Get date range
⋮----
// Get unique strategies
⋮----
/**
 * Search trades by text (strategy, legs, reason for close)
 */
export async function searchTrades(
  blockId: string,
  query: string
): Promise<StoredTrade[]>
⋮----
/**
 * Get trades with pagination
 */
export async function getTradesPage(
  blockId: string,
  offset: number,
  limit: number
): Promise<
⋮----
/**
 * Export trades to CSV format (for backup/analysis)
 */
export async function exportTradesToCSV(blockId: string): Promise<string>
⋮----
// CSV headers
⋮----
// Convert trades to CSV rows
⋮----
// Format dateOpened - handle both Date objects and strings
⋮----
// Combine headers and rows
```

## File: lib/db/walk-forward-store.ts
```typescript
import { WalkForwardAnalysis } from '../models/walk-forward'
import { INDEXES, STORES, promisifyRequest, withReadTransaction, withWriteTransaction } from './index'
⋮----
export async function saveWalkForwardAnalysis(analysis: WalkForwardAnalysis): Promise<void>
⋮----
export async function getWalkForwardAnalysis(id: string): Promise<WalkForwardAnalysis | undefined>
⋮----
export async function getWalkForwardAnalysesByBlock(blockId: string): Promise<WalkForwardAnalysis[]>
⋮----
export async function deleteWalkForwardAnalysis(id: string): Promise<void>
⋮----
export async function deleteWalkForwardAnalysesByBlock(blockId: string): Promise<void>
```

## File: lib/models/index.ts
```typescript
// Core data models
⋮----
// Type utilities
export type ProcessingStage = 'uploading' | 'parsing' | 'processing' | 'calculating' | 'storing'
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error'
⋮----
// Error types
export interface ProcessingError {
  type: 'validation' | 'parsing' | 'calculation' | 'storage'
  message: string
  details?: Record<string, unknown>
  rowNumber?: number
  columnName?: string
}
⋮----
export interface ValidationError extends ProcessingError {
  type: 'validation'
  field: string
  value: unknown
  expected: string
}
⋮----
export interface ParsingError extends ProcessingError {
  type: 'parsing'
  line: number
  column?: string
  raw: string
}
⋮----
// Re-export commonly used types
```

## File: lib/models/portfolio-stats.ts
```typescript
/**
 * Portfolio statistics based on legacy Python PortfolioStats class
 */
export interface PortfolioStats {
  totalTrades: number
  totalPl: number
  winningTrades: number
  losingTrades: number
  breakEvenTrades: number
  winRate: number  // 0-1 decimal, not percentage
  avgWin: number
  avgLoss: number
  maxWin: number
  maxLoss: number
  sharpeRatio?: number
  sortinoRatio?: number
  calmarRatio?: number
  cagr?: number  // Compound Annual Growth Rate
  kellyPercentage?: number
  maxDrawdown: number
  avgDailyPl: number
  totalCommissions: number
  netPl: number
  profitFactor: number
  initialCapital: number  // Starting portfolio value before any P/L
  // Streak and consistency metrics
  maxWinStreak?: number
  maxLossStreak?: number
  currentStreak?: number
  timeInDrawdown?: number  // Percentage of time in drawdown
  monthlyWinRate?: number
  weeklyWinRate?: number
}
⋮----
winRate: number  // 0-1 decimal, not percentage
⋮----
cagr?: number  // Compound Annual Growth Rate
⋮----
initialCapital: number  // Starting portfolio value before any P/L
// Streak and consistency metrics
⋮----
timeInDrawdown?: number  // Percentage of time in drawdown
⋮----
/**
 * Strategy-specific statistics based on legacy Python StrategyStats class
 */
export interface StrategyStats {
  strategyName: string
  tradeCount: number
  totalPl: number
  winRate: number
  avgWin: number
  avgLoss: number
  maxWin: number
  maxLoss: number
  avgDte?: number  // Average days to expiration
  successRate: number
  profitFactor: number
}
⋮----
avgDte?: number  // Average days to expiration
⋮----
/**
 * Performance metrics for charts and visualizations
 */
export interface PerformanceMetrics {
  cumulativePl: Array<{
    date: string
    cumulativePl: number
    tradePl: number
  }>
  drawdownData: Array<{
    date: string
    drawdown: number
    peak: number
  }>
  monthlyPl: Record<string, number>  // YYYY-MM -> P/L
  weeklyPl: Record<string, number>   // YYYY-WW -> P/L
  dailyPl: Record<string, number>    // YYYY-MM-DD -> P/L
}
⋮----
monthlyPl: Record<string, number>  // YYYY-MM -> P/L
weeklyPl: Record<string, number>   // YYYY-WW -> P/L
dailyPl: Record<string, number>    // YYYY-MM-DD -> P/L
⋮----
/**
 * Analysis configuration settings
 */
export interface AnalysisConfig {
  riskFreeRate: number  // Annual risk-free rate for Sharpe/Sortino calculations
  useBusinessDaysOnly: boolean
  annualizationFactor: number  // 252 for business days, 365 for calendar days
  confidenceLevel: number  // 0.95 for 95% confidence
  drawdownThreshold: number  // Minimum drawdown % to consider significant
}
⋮----
riskFreeRate: number  // Annual risk-free rate for Sharpe/Sortino calculations
⋮----
annualizationFactor: number  // 252 for business days, 365 for calendar days
confidenceLevel: number  // 0.95 for 95% confidence
drawdownThreshold: number  // Minimum drawdown % to consider significant
⋮----
/**
 * Time period aggregation types
 */
export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'
⋮----
/**
 * Calculation result with metadata
 */
export interface CalculationResult<T> {
  data: T
  calculatedAt: Date
  config: AnalysisConfig
  cacheKey: string
}
⋮----
/**
 * Trade aggregation by strategy
 */
export interface StrategyBreakdown {
  [strategyName: string]: {
    trades: number
    totalPl: number
    winRate: number
    avgPl: number
    stats: StrategyStats
  }
}
```

## File: lib/models/strategy-alignment.ts
```typescript
/**
 * Mapping between reporting strategies (backtests) and live strategies (trade log)
 * used for comparison workflows.
 */
export interface StrategyAlignment {
  id: string
  reportingStrategies: string[]
  liveStrategies: string[]
  note?: string
  createdAt: Date
  updatedAt: Date
  matchOverrides?: MatchOverrides
}
⋮----
export interface MatchOverrides {
  selectedBacktestedIds: string[]
  selectedReportedIds: string[]
  tradePairs?: TradePair[]
}
⋮----
export interface TradePair {
  backtestedId: string
  reportedId: string
  manual: boolean  // true if user created, false if auto-matched
}
⋮----
manual: boolean  // true if user created, false if auto-matched
```

## File: lib/models/walk-forward.ts
```typescript
import { PortfolioStats } from './portfolio-stats'
⋮----
export type WalkForwardOptimizationTarget =
  | 'netPl'
  | 'profitFactor'
  | 'sharpeRatio'
  | 'sortinoRatio'
  | 'calmarRatio'
  | 'cagr'
  | 'avgDailyPl'
  | 'winRate'
⋮----
export type WalkForwardParameterRangeTuple = [min: number, max: number, step: number]
⋮----
export type WalkForwardParameterRanges = Record<string, WalkForwardParameterRangeTuple>
⋮----
export interface WalkForwardConfig {
  inSampleDays: number
  outOfSampleDays: number
  stepSizeDays: number
  optimizationTarget: WalkForwardOptimizationTarget
  parameterRanges: WalkForwardParameterRanges
  minInSampleTrades?: number
  minOutOfSampleTrades?: number
}
⋮----
export interface WalkForwardWindow {
  inSampleStart: Date
  inSampleEnd: Date
  outOfSampleStart: Date
  outOfSampleEnd: Date
}
⋮----
export interface WalkForwardPeriodResult extends WalkForwardWindow {
  optimalParameters: Record<string, number>
  inSampleMetrics: PortfolioStats
  outOfSampleMetrics: PortfolioStats
  targetMetricInSample: number
  targetMetricOutOfSample: number
}
⋮----
export interface WalkForwardSummary {
  avgInSamplePerformance: number
  avgOutOfSamplePerformance: number
  degradationFactor: number
  parameterStability: number
  robustnessScore: number
}
⋮----
export interface WalkForwardRunStats {
  totalPeriods: number
  evaluatedPeriods: number
  skippedPeriods: number
  totalParameterTests: number
  analyzedTrades: number
  durationMs: number
  consistencyScore: number
  averagePerformanceDelta: number
}
⋮----
export interface WalkForwardResults {
  periods: WalkForwardPeriodResult[]
  summary: WalkForwardSummary
  stats: WalkForwardRunStats
}
⋮----
export interface WalkForwardAnalysis {
  id: string
  blockId: string
  config: WalkForwardConfig
  results: WalkForwardResults
  createdAt: Date
  updatedAt?: Date
  notes?: string
}
⋮----
export interface WalkForwardProgressEvent {
  phase: 'segmenting' | 'optimizing' | 'evaluating' | 'completed'
  currentPeriod: number
  totalPeriods: number
  testedCombinations?: number
  totalCombinations?: number
  window?: WalkForwardWindow
  message?: string
}
⋮----
export interface WalkForwardComputation {
  config: WalkForwardConfig
  results: WalkForwardResults
  startedAt: Date
  completedAt: Date
}
```

## File: lib/processing/capital-calculator.ts
```typescript
/**
 * Capital Calculator
 *
 * Calculates initial capital and portfolio values based on legacy logic.
 * Uses first trade or daily log data as appropriate.
 */
⋮----
import { Trade } from '../models/trade'
import { DailyLogEntry } from '../models/daily-log'
⋮----
/**
 * Calculate initial capital from trades data
 * Uses the same logic as legacy: funds_at_close - pl from chronologically first trade
 */
export function calculateInitialCapitalFromTrades(trades: Trade[]): number
⋮----
// Sort trades chronologically (same logic as legacy)
⋮----
// Secondary sort by time
⋮----
// Tertiary sort by funds_at_close (lower first for simultaneous trades)
⋮----
// Initial capital = Funds at close - P/L (P/L already includes all fees)
⋮----
/**
 * Calculate initial capital from daily log data
 * Uses the earliest entry's net liquidity minus its daily P/L to get the starting balance
 */
export function calculateInitialCapitalFromDailyLog(entries: DailyLogEntry[]): number
⋮----
// Sort by date to get the earliest entry
⋮----
// Initial capital = Net Liquidity - Daily P/L
// This accounts for any P/L that occurred on the first day
⋮----
/**
 * Calculate initial capital with fallback logic (matches legacy behavior)
 * Prefers daily log data when available, falls back to trades
 */
export function calculateInitialCapital(
  trades: Trade[],
  dailyLogEntries?: DailyLogEntry[]
): number
⋮----
// Prefer daily log if available
⋮----
// Fall back to trades
⋮----
/**
 * Calculate portfolio value at a specific date
 * Uses initial capital + cumulative P/L up to that date
 */
export function calculatePortfolioValueAtDate(
  trades: Trade[],
  targetDate: Date,
  initialCapital?: number
): number
⋮----
// Filter trades up to target date
⋮----
// Sum P/L of relevant trades
⋮----
/**
 * Build portfolio value timeline from trades
 * Creates daily snapshots of portfolio value
 */
export function buildPortfolioTimeline(
  trades: Trade[],
  dailyLogEntries?: DailyLogEntry[]
): Array<
⋮----
// If we have daily log, prefer that for accuracy
⋮----
// Otherwise build from trade data
⋮----
// Group trades by date
⋮----
// Build timeline from trade data
⋮----
/**
 * Get portfolio value from daily log for a specific date
 * Used for linking trade data with daily log data
 */
export function getPortfolioValueFromDailyLog(
  dailyLogEntries: DailyLogEntry[],
  date: Date
): number | null
⋮----
/**
 * Interpolate portfolio values between known data points
 * Used when we have sparse daily log data
 */
export function interpolatePortfolioValues(
  knownValues: Array<{ date: Date; value: number }>,
  startDate: Date,
  endDate: Date
): Array<
⋮----
// Sort known values by date
⋮----
// Check if we have an exact match
⋮----
// Find surrounding values for interpolation
⋮----
// Linear interpolation between two points
⋮----
// Use last known value
⋮----
// Use next known value
⋮----
// No surrounding values, skip
```

## File: lib/processing/csv-parser.ts
```typescript
/**
 * CSV Parser Service
 *
 * Handles CSV file parsing with progress tracking, error handling,
 * and validation for TradeBlocks data.
 */
⋮----
import { ParsingError } from '../models'
// import { ProcessingError } from '../models'
⋮----
/**
 * CSV parsing configuration
 */
export interface CSVParseConfig {
  delimiter?: string
  quote?: string
  escape?: string
  skipEmptyLines?: boolean
  trimValues?: boolean
  maxRows?: number
  progressCallback?: (progress: number, rowsProcessed: number) => void
}
⋮----
/**
 * CSV parsing result
 */
export interface CSVParseResult<T = Record<string, string>> {
  data: T[]
  headers: string[]
  totalRows: number
  validRows: number
  errors: ParsingError[]
  warnings: string[]
}
⋮----
/**
 * CSV parsing progress info
 */
export interface ParseProgress {
  stage: 'reading' | 'parsing' | 'validating' | 'converting' | 'completed'
  progress: number // 0-100
  rowsProcessed: number
  totalRows: number
  errors: number
}
⋮----
progress: number // 0-100
⋮----
/**
 * Base CSV parser class with streaming support for large files
 */
export class CSVParser
⋮----
constructor(config: CSVParseConfig =
⋮----
maxRows: 100000, // Safety limit
⋮----
/**
   * Parse CSV file content
   */
async parseFile<T = Record<string, string>>(
    fileContent: string,
    validator?: (row: Record<string, string>, rowIndex: number) => T | null
): Promise<CSVParseResult<T>>
⋮----
// Split into lines and handle different line endings
⋮----
// Parse headers
⋮----
// Clean headers (remove BOM, trim whitespace)
⋮----
// Process data rows
⋮----
// Skip empty lines if configured
⋮----
// Create row object
⋮----
// Validate row if validator provided
⋮----
// Report progress
⋮----
// Check for truncation
⋮----
totalRows: totalRows - 1, // Excluding header
⋮----
/**
   * Parse CSV from File object with progress tracking
   */
async parseFileObject<T = Record<string, string>>(
    file: File,
    validator?: (row: Record<string, string>, rowIndex: number) => T | null,
    progressCallback?: (progress: ParseProgress) => void
): Promise<CSVParseResult<T>>
⋮----
// Update progress callback for parsing stage
⋮----
/**
   * Parse a single CSV line, handling quoted values and escapes
   */
private parseLine(line: string): string[]
⋮----
// Escaped quote
⋮----
i++ // Skip next character
⋮----
// Add the last field
⋮----
/**
   * Validate CSV file format before parsing
   */
static validateCSVFile(file: File):
⋮----
// Check file type
⋮----
// Check file size (50MB limit)
⋮----
// Check for empty file
⋮----
/**
   * Detect CSV delimiter from sample content
   */
static detectDelimiter(sampleContent: string): string
⋮----
const lines = sampleContent.split(/\r?\n/).slice(0, 5) // Check first 5 lines
```

## File: lib/processing/data-loader.ts
```typescript
/**
 * Data Loader
 *
 * Unified interface for loading trade and daily log data
 * Works in both browser (with File API) and Node.js (with strings)
 * Supports optional IndexedDB storage
 */
⋮----
import { Trade, TRADE_COLUMN_ALIASES, REQUIRED_TRADE_COLUMNS } from '../models/trade'
import { DailyLogEntry } from '../models/daily-log'
import { assertRequiredHeaders, normalizeHeaders, parseCsvLine } from '../utils/csv-headers'
// import { ProcessedBlock } from '../models/block'
⋮----
/**
 * Data source types
 */
export type DataSource = File | string | ArrayBuffer
⋮----
/**
 * Processing result
 */
export interface ProcessingResult<T> {
  data: T[]
  errors: ProcessingError[]
  warnings: string[]
  stats: ProcessingStats
}
⋮----
/**
 * Processing error
 */
export interface ProcessingError {
  row?: number
  field?: string
  message: string
  code?: string
}
⋮----
/**
 * Processing statistics
 */
export interface ProcessingStats {
  totalRows: number
  validRows: number
  invalidRows: number
  processingTimeMs: number
  dateRange?: { start: Date | null; end: Date | null }
}
⋮----
/**
 * CSV processor interface
 */
export interface CSVProcessor<T> {
  process(source: DataSource): Promise<ProcessingResult<T>>
  validate?(row: Record<string, unknown>): boolean
  transform?(row: Record<string, unknown>): T
}
⋮----
process(source: DataSource): Promise<ProcessingResult<T>>
validate?(row: Record<string, unknown>): boolean
transform?(row: Record<string, unknown>): T
⋮----
/**
 * Storage adapter interface
 */
export interface StorageAdapter {
  storeTrades(blockId: string, trades: Trade[]): Promise<void>
  storeDailyLogs(blockId: string, dailyLogs: DailyLogEntry[]): Promise<void>
  getTrades(blockId: string): Promise<Trade[]>
  getDailyLogs(blockId: string): Promise<DailyLogEntry[]>
  clear(blockId: string): Promise<void>
}
⋮----
storeTrades(blockId: string, trades: Trade[]): Promise<void>
storeDailyLogs(blockId: string, dailyLogs: DailyLogEntry[]): Promise<void>
getTrades(blockId: string): Promise<Trade[]>
getDailyLogs(blockId: string): Promise<DailyLogEntry[]>
clear(blockId: string): Promise<void>
⋮----
/**
 * Environment adapter interface
 */
export interface EnvironmentAdapter {
  readFile(source: DataSource): Promise<string>
  isAvailable(): boolean
}
⋮----
readFile(source: DataSource): Promise<string>
isAvailable(): boolean
⋮----
/**
 * Browser environment adapter (uses FileReader API)
 */
export class BrowserAdapter implements EnvironmentAdapter
⋮----
async readFile(source: DataSource): Promise<string>
⋮----
/**
 * Node.js environment adapter (works with strings and buffers)
 */
export class NodeAdapter implements EnvironmentAdapter
⋮----
// In Node.js tests, File objects don't exist
⋮----
/**
 * Database module interface for type safety
 */
interface DatabaseModule {
  addTrades: (blockId: string, trades: Trade[]) => Promise<void>
  getTradesByBlock: (blockId: string) => Promise<Array<Trade & { blockId: string; id?: number }>>
  deleteTradesByBlock: (blockId: string) => Promise<void>
}
⋮----
/**
 * IndexedDB storage adapter
 */
export class IndexedDBAdapter implements StorageAdapter
⋮----
constructor(private dbModule?: DatabaseModule)
⋮----
// Allow injection of db module for testing
⋮----
async getDB(): Promise<DatabaseModule>
⋮----
// Dynamic import to avoid issues in Node.js
⋮----
async storeTrades(blockId: string, trades: Trade[]): Promise<void>
⋮----
async storeDailyLogs(blockId: string, dailyLogs: DailyLogEntry[]): Promise<void>
⋮----
async getTrades(blockId: string): Promise<Trade[]>
⋮----
// Remove blockId and id from stored trades
⋮----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
⋮----
async getDailyLogs(blockId: string): Promise<DailyLogEntry[]>
⋮----
// Remove blockId and id from stored logs
⋮----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
⋮----
async clear(blockId: string): Promise<void>
⋮----
/**
 * Memory storage adapter (for testing)
 */
export class MemoryAdapter implements StorageAdapter
⋮----
clearAll(): void
⋮----
/**
 * Data loader options
 */
export interface DataLoaderOptions {
  environmentAdapter?: EnvironmentAdapter
  storageAdapter?: StorageAdapter
  tradeProcessor?: CSVProcessor<Trade>
  dailyLogProcessor?: CSVProcessor<DailyLogEntry>
}
⋮----
/**
 * Unified data loader
 */
export class DataLoader
⋮----
constructor(options: DataLoaderOptions =
⋮----
// Auto-detect environment if not provided
⋮----
/**
   * Load trades from a data source
   */
async loadTrades(source: DataSource): Promise<ProcessingResult<Trade>>
⋮----
// Read file content
⋮----
// Process with custom processor or default CSV parser
⋮----
// Node.js environment - use simple parsing
⋮----
// For browser, use the full TradeProcessor
⋮----
/**
   * Load daily logs from a data source
   */
async loadDailyLogs(source: DataSource): Promise<ProcessingResult<DailyLogEntry>>
⋮----
// Read file content
⋮----
// Process with custom processor or default CSV parser
⋮----
// For now, return empty result for daily logs in Node.js
⋮----
// For browser, use the full DailyLogProcessor
⋮----
/**
   * Load and store data for a block
   */
async loadBlockData(
    blockId: string,
    tradeSource: DataSource,
    dailyLogSource?: DataSource
): Promise<
⋮----
// Load trades
⋮----
// Store trades if storage adapter is available
⋮----
// Load daily logs if provided
⋮----
// Store daily logs if storage adapter is available
⋮----
/**
   * Get stored data for a block
   */
async getBlockData(blockId: string): Promise<
⋮----
/**
   * Clear stored data for a block
   */
async clearBlockData(blockId: string): Promise<void>
⋮----
/**
   * Get date range from trades
   */
private getDateRange(trades: Trade[]):
⋮----
/**
   * Simple CSV parser for Node.js environment
   */
private parseSimpleCSV(csvContent: string): Trade[]
⋮----
// Skip invalid rows
⋮----
/**
   * Create a DataLoader for testing
   */
static createForTesting(options: {
    useMemoryStorage?: boolean
    tradeProcessor?: CSVProcessor<Trade>
    dailyLogProcessor?: CSVProcessor<DailyLogEntry>
} =
⋮----
/**
   * Create a DataLoader for browser
   */
static createForBrowser(options: {
    useIndexedDB?: boolean
    dbModule?: DatabaseModule
} =
```

## File: lib/processing/index.ts
```typescript
/**
 * Processing Pipeline - Main exports
 *
 * Provides a unified interface for all CSV processing operations.
 */
⋮----
// Re-export validators for convenience
⋮----
// Unified processing types
export interface FileProcessingResult {
  success: boolean
  data?: unknown
  errors?: Array<{
    type: string
    message: string
    details?: unknown
  }>
  warnings?: string[]
  stats?: {
    processingTimeMs: number
    totalRows: number
    validRows: number
    invalidRows: number
  }
}
⋮----
// File type detection
export function detectFileType(file: File): 'trade-log' | 'daily-log' | 'unknown'
⋮----
// Check filename patterns
⋮----
// Default to trade log for generic CSV files
⋮----
// Utility function to create processing progress callback
interface ProgressInfo {
  stage: string
  progress: number
  rowsProcessed: number
  totalRows: number
  errors: number
  validEntries?: number
  validTrades?: number
  invalidEntries?: number
  invalidTrades?: number
}
⋮----
export function createProgressCallback(
  onProgress: (stage: string, progress: number, details?: unknown) => void
)
⋮----
// File size formatter
export function formatFileSize(bytes: number): string
⋮----
// Processing time formatter
export function formatProcessingTime(ms: number): string
```

## File: lib/utils/async-helpers.ts
```typescript
/**
 * Async Helper Utilities
 *
 * Shared utilities for async operations that need to yield to the main thread
 * to keep the UI responsive during expensive computations.
 */
⋮----
/**
 * Delay in milliseconds before starting computation to allow React to render
 */
⋮----
/**
 * Yield control to the main thread to prevent UI freezing.
 * Uses setTimeout(0) to create a macrotask break, allowing the browser
 * to process pending UI updates and repaints between chunks of work.
 *
 * Note: scheduler.yield() and requestIdleCallback don't reliably allow
 * repaints, so we use setTimeout which guarantees a macrotask boundary.
 */
export async function yieldToMain(): Promise<void>
⋮----
/**
 * Check if the operation has been cancelled via AbortSignal.
 * Throws AbortError if cancelled.
 */
export function checkCancelled(signal?: AbortSignal): void
⋮----
/**
 * Wait for React to render before starting computation.
 * This ensures progress dialogs are visible before heavy work begins.
 */
export async function waitForRender(): Promise<void>
```

## File: lib/utils/csv-headers.ts
```typescript
/**
 * CSV header utilities
 */
⋮----
export interface HeaderValidationOptions {
  /** Optional map of alternate header names to canonical names */
  aliases?: Record<string, string> | Readonly<Record<string, string>>
  /** Human-readable label used in error messages */
  contextLabel?: string
}
⋮----
/** Optional map of alternate header names to canonical names */
⋮----
/** Human-readable label used in error messages */
⋮----
/**
 * Remove UTF-8 byte order mark from a string if present
 */
export function stripBom(value: string): string
⋮----
/**
 * Parse a single CSV line into values, handling quoted fields and commas
 */
export function parseCsvLine(line: string): string[]
⋮----
// Escaped quote inside quoted value
⋮----
/**
 * Normalize a CSV header by trimming whitespace, stripping BOM, and applying aliases
 */
export function normalizeHeader(
  header: string,
  aliases?: Record<string, string> | Readonly<Record<string, string>>
): string
⋮----
/**
 * Normalize an array of headers
 */
export function normalizeHeaders(
  headers: string[],
  aliases?: Record<string, string> | Readonly<Record<string, string>>
): string[]
⋮----
/**
 * Validate that required headers are present. Returns the missing headers without throwing.
 */
export function findMissingHeaders(
  headers: string[],
  required: readonly string[]
): string[]
⋮----
/**
 * Ensure required headers are present, throwing an Error with a helpful message when missing.
 */
export function assertRequiredHeaders(
  headers: string[],
  required: readonly string[],
  options: HeaderValidationOptions = {}
): void
```

## File: lib/utils/export-helpers.ts
```typescript
/**
 * Utility functions for exporting data as CSV and JSON
 */
⋮----
/**
 * Escapes a value for safe CSV inclusion.
 * - Wraps in quotes if value contains comma, quote, or newline
 * - Doubles any existing quotes
 */
export function escapeCsvValue(value: unknown): string
⋮----
// If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
⋮----
/**
 * Joins an array of values into a CSV row, properly escaping each value
 */
export function toCsvRow(values: unknown[]): string
⋮----
/**
 * Creates and triggers a file download
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void
⋮----
/**
 * Downloads data as a JSON file
 */
export function downloadJson(data: unknown, filename: string): void
⋮----
/**
 * Downloads lines as a CSV file
 */
export function downloadCsv(lines: string[], filename: string): void
⋮----
/**
 * Sanitizes a block name for use in filenames
 * Replaces spaces and special characters with hyphens
 */
export function sanitizeFilename(name: string): string
⋮----
/**
 * Generates a filename with the current date
 */
export function generateExportFilename(
  blockName: string,
  suffix: string,
  extension: "json" | "csv"
): string
```

## File: lib/utils/performance-export.ts
```typescript
/**
 * Performance chart export utilities
 * Each export function generates CSV content for a specific chart's raw data
 */
⋮----
import { SnapshotChartData } from "@/lib/services/performance-snapshot";
import { toCsvRow } from "./export-helpers";
⋮----
export type ChartTab = (typeof TAB_ORDER)[number];
⋮----
export interface ChartExportConfig {
  id: string;
  name: string;
  description: string;
  tab: ChartTab;
  exportFn: (data: SnapshotChartData) => string[];
}
⋮----
/**
 * All available chart exports organized by tab
 */
⋮----
// Overview Tab
⋮----
// Win streaks
⋮----
// Loss streaks
⋮----
// Statistics
⋮----
// Returns Analysis Tab
⋮----
// Monthly returns percent
⋮----
// Detailed inputs (includes margin) when available
⋮----
// Add summary statistics
⋮----
// Risk & Margin Tab
⋮----
// Trade Efficiency Tab
⋮----
// Excursion Analysis Tab
⋮----
// Add distribution summary
⋮----
/**
 * Get chart exports grouped by tab
 */
export function getChartExportsByTab(): Record<string, ChartExportConfig[]>
⋮----
/**
 * Export multiple charts as a combined CSV
 */
export function exportMultipleCharts(
  data: SnapshotChartData,
  chartIds: string[]
): string[]
⋮----
lines.push(""); // Separator between charts
lines.push(""); // Extra line for readability
⋮----
/**
 * Export a single chart by ID as CSV
 */
export function exportSingleChart(
  data: SnapshotChartData,
  chartId: string
): string[] | null
⋮----
/**
 * Get raw JSON data for a single chart
 */
export function getChartJsonData(
  data: SnapshotChartData,
  chartId: string
): Record<string, unknown> | null
⋮----
/**
 * Get JSON data for multiple charts
 */
export function getMultipleChartsJson(
  data: SnapshotChartData,
  chartIds: string[]
): Record<string, unknown>
```

## File: lib/utils/performance-helpers.ts
```typescript
import { Trade } from '@/lib/models/trade'
import { groupTradesByEntry } from '@/lib/utils/combine-leg-groups'
⋮----
export type GroupedOutcome =
  | 'all_losses'
  | 'all_wins'
  | 'mixed'
  | 'neutral'
⋮----
export interface GroupedLegEntry {
  id: string
  dateOpened: string
  timeOpened: string
  strategy: string
  legCount: number
  positiveLegs: number
  negativeLegs: number
  outcome: GroupedOutcome
  combinedPl: number
  legPlValues: number[]
}
⋮----
export interface GroupedLegSummary {
  totalEntries: number
  allLosses: number
  allWins: number
  mixedOutcomes: number
  neutral: number
  totalAllLossMagnitude: number
}
⋮----
export interface GroupedLegOutcomes {
  entries: GroupedLegEntry[]
  summary: GroupedLegSummary
}
⋮----
export function classifyOutcome(positiveLegs: number, negativeLegs: number, legCount: number): GroupedOutcome
⋮----
export function deriveGroupedLegOutcomes(rawTrades: Trade[]): GroupedLegOutcomes | null
```

## File: lib/utils/time-conversions.ts
```typescript
/**
 * Utilities for converting between time periods and trade counts
 */
⋮----
export type TimeUnit = "years" | "months" | "days";
⋮----
/**
 * Convert a time period to number of trades based on trading frequency
 */
export function timeToTrades(
  value: number,
  unit: TimeUnit,
  tradesPerYear: number
): number
⋮----
/**
 * Convert number of trades to time period based on trading frequency
 */
export function tradesToTime(
  trades: number,
  tradesPerYear: number,
  targetUnit?: TimeUnit
):
⋮----
// If target unit is specified, use it
⋮----
// Auto-select the most appropriate unit
⋮----
/**
 * Convert a percentage of total trades to a trade count
 */
export function percentageToTrades(
  percentage: number,
  totalTrades: number
): number
⋮----
/**
 * Convert a trade count to percentage of total
 */
export function tradesToPercentage(
  trades: number,
  totalTrades: number
): number
⋮----
/**
 * Format a trade count with time context
 */
export function formatTradesWithTime(
  trades: number,
  tradesPerYear: number
): string
⋮----
/**
 * Get sensible default values based on trading frequency
 */
export function getDefaultSimulationPeriod(tradesPerYear: number):
⋮----
/**
 * Get sensible resample window based on total trades
 */
export function getDefaultResamplePercentage(totalTrades: number): number
⋮----
return 25; // Use last 25% for large datasets
⋮----
return 50; // Use last 50% for medium datasets
⋮----
return 75; // Use last 75% for smaller datasets
⋮----
return 100; // Use all trades for very small datasets
```

## File: lib/utils/trade-frequency.ts
```typescript
import { Trade } from "@/lib/models/trade";
⋮----
/**
 * Estimate annual trade frequency from a sample of trades.
 *
 * Ensures realistic pacing for strategy-filtered simulations where the global
 * portfolio frequency would otherwise overstate the number of opportunities.
 */
export function estimateTradesPerYear(
  sampleTrades: Trade[],
  fallback: number
): number
```

## File: lib/utils/trade-normalization.ts
```typescript
import { Trade } from '@/lib/models/trade'
⋮----
function scaleNumeric(value: number, factor: number): number
⋮----
function sortTradesChronologically(trades: Trade[]): Trade[]
⋮----
function calculateInitialCapitalPerLot(trades: Trade[]): number
⋮----
function normalizeTradeToOneLotInternal(trade: Trade): Trade
⋮----
export function normalizeTradeToOneLot(trade: Trade): Trade
⋮----
export function normalizeTradesToOneLot(trades: Trade[]): Trade[]
```

## File: lib/utils.ts
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
⋮----
export function cn(...inputs: ClassValue[])
⋮----
/**
 * Truncates a strategy name to a maximum length with ellipsis.
 *
 * @param strategyName - The full strategy name
 * @param maxLength - Maximum character length (default: 40)
 * @returns Truncated strategy name with ellipsis if needed
 *
 * @example
 * truncateStrategyName("move downic super long description...", 40)
 * // Returns: "move downic super long description th..."
 */
export function truncateStrategyName(
  strategyName: string,
  maxLength: number = 40
): string
```

## File: app/(platform)/assistant/page.tsx
```typescript
import { ChevronDown, ChevronRight, ExternalLink, FileJson, Info, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
⋮----
import { NoActiveBlock } from "@/components/no-active-block";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";
import {
  getBlock,
  getDailyLogsByBlock,
  getTradesByBlockWithOptions,
} from "@/lib/db";
import { PortfolioStats, StrategyStats } from "@/lib/models/portfolio-stats";
import {
  buildPerformanceSnapshot,
  SnapshotChartData,
} from "@/lib/services/performance-snapshot";
import { useBlockStore } from "@/lib/stores/block-store";
import { downloadJson, generateExportFilename } from "@/lib/utils/export-helpers";
import {
  CHART_EXPORTS,
  getChartExportsByTab,
  getMultipleChartsJson,
  TAB_ORDER,
} from "@/lib/utils/performance-export";
import { Trade } from "@/lib/models/trade";
⋮----
// Block store
⋮----
// Local data state
⋮----
// Load blocks if not initialized
⋮----
// Fetch trades and daily logs when active block changes
⋮----
const fetchData = async () =>
⋮----
// Calculate stats and chart data
⋮----
const toggleChart = (chartId: string) =>
⋮----
const selectAllCharts = () =>
⋮----
const clearAllCharts = () =>
⋮----
const handleExportForGPT = async () =>
⋮----
// Export block stats
⋮----
// Expose per-trade margin + P/L so GPT exports always carry ROM inputs
⋮----
// Export performance charts
⋮----
// Download the combined export
⋮----
const openGPT = () =>
⋮----
// Show loading state
⋮----
{/* Header */}
⋮----
{/* Main content */}
⋮----
{/* Left: Export panel */}
⋮----
{/* Block Stats */}
⋮----
setIncludeBlockStats(!!checked)
⋮----
{/* Performance Charts - Collapsible */}
⋮----
onCheckedChange=
⋮----
{/* Note about other exports */}
⋮----
{/* Right: Instructions */}
```

## File: app/(platform)/block-stats/page.tsx
```typescript
import { MetricCard } from "@/components/metric-card";
import { MetricSection } from "@/components/metric-section";
import { MultiSelect } from "@/components/multi-select";
import { NoActiveBlock } from "@/components/no-active-block";
import { StrategyBreakdownTable } from "@/components/strategy-breakdown-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SizingModeToggle } from "@/components/sizing-mode-toggle";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";
import {
  getBlock,
  getDailyLogsByBlock,
  getTradesByBlockWithOptions,
  getPerformanceSnapshotCache,
} from "@/lib/db";
import {
  calculatePremiumEfficiencyPercent,
  computeTotalPremium,
} from "@/lib/metrics/trade-efficiency";
import { DailyLogEntry } from "@/lib/models/daily-log";
import { PortfolioStats, StrategyStats } from "@/lib/models/portfolio-stats";
import { Trade } from "@/lib/models/trade";
import { buildPerformanceSnapshot } from "@/lib/services/performance-snapshot";
import { useBlockStore } from "@/lib/stores/block-store";
import {
  downloadCsv,
  downloadJson,
  generateExportFilename,
  toCsvRow,
} from "@/lib/utils/export-helpers";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarIcon,
  Download,
  Gauge,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { DateRange } from "react-day-picker";
⋮----
// Strategy options will be dynamically generated from trades
⋮----
// Data fetching state
⋮----
// Calculated metrics state
⋮----
// Get active block from store
⋮----
// Load blocks if not initialized
⋮----
// Handle date range changes
const handleDateRangeChange = (newDateRange: DateRange | undefined) =>
⋮----
// Fetch trades and daily logs when active block changes
// Uses cached performance snapshot for instant load when available
⋮----
const fetchData = async () =>
⋮----
// Clear previous block data to avoid showing stale charts while loading
⋮----
// Check for cached snapshot first (for instant load with default settings)
// Only use cache if we're using default settings (no filters, default risk-free rate, no normalization)
⋮----
// Use cached data directly - much faster!
⋮----
// Calculate strategy stats from cached trades
⋮----
// Cache miss or filters applied - fetch data normally
⋮----
// eslint-disable-next-line react-hooks/exhaustive-deps
⋮----
// Calculate metrics when data or risk-free rate changes
⋮----
const calculateMetrics = async () =>
⋮----
// Use a small delay to avoid closing the popover during selection
⋮----
// Helper functions
const getDateRange = () =>
⋮----
const getInitialCapital = () =>
⋮----
// Use the initial capital from portfolioStats which properly accounts for daily logs
⋮----
const getAvgReturnOnMargin = () =>
⋮----
// Calculate average return on margin from filtered trades
⋮----
const getStdDevOfRoM = () =>
⋮----
const getBestTrade = () =>
⋮----
const getWorstTrade = () =>
⋮----
const getCommissionShareOfPremium = () =>
⋮----
const getAvgPremiumEfficiency = () =>
⋮----
const getAvgHoldingPeriodHours = () =>
⋮----
const getAvgContracts = () =>
⋮----
const getStrategyOptions = () =>
⋮----
// Export functions
const buildExportData = () =>
⋮----
const exportAsJson = () =>
⋮----
const exportAsCsv = () =>
⋮----
// Metadata section
⋮----
// Portfolio Stats section
⋮----
// Strategy Breakdown section
⋮----
// Show loading state
⋮----
// Show message if no active block
⋮----
// Show loading state for data
⋮----
// Show error state
⋮----
{/* Controls */}
⋮----

⋮----
{/* Basic Overview */}
⋮----
{/* Risk & Drawdown */}
⋮----
{/* Strategy Breakdown */}
⋮----
winRate: stat.winRate * 100, // Convert to percentage
```

## File: app/layout.tsx
```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
⋮----
import { ThemeProvider } from "@/components/theme-provider";
import { DatabaseResetHandler } from "@/components/database-reset-handler";
import { cn } from "@/lib/utils";
⋮----
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>)
⋮----
className=
```

## File: components/performance-charts/chart-wrapper.tsx
```typescript
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import { useTheme } from "next-themes";
import type { Config, Data, Layout, PlotlyHTMLElement } from "plotly.js";
import React, { Suspense, useCallback, useEffect, useRef } from "react";
⋮----
interface Window {
    Plotly?: typeof import("plotly.js");
  }
⋮----
// Dynamic import to optimize bundle size
⋮----
interface TooltipContent {
  flavor: string;
  detailed: string;
}
⋮----
interface ChartWrapperProps {
  title: string;
  description?: string;
  tooltip?: TooltipContent;
  className?: string;
  actions?: React.ReactNode;
  headerAddon?: React.ReactNode;
  contentOverlay?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode; // deprecated; retained for backward compatibility
  data: Data[];
  layout: Partial<Layout>;
  config?: Partial<Config>;
  onInitialized?: (figure: unknown) => void;
  onUpdate?: (figure: unknown) => void;
  style?: React.CSSProperties;
}
⋮----
children?: React.ReactNode; // deprecated; retained for backward compatibility
⋮----
const ChartSkeleton = () => (
  <div className="space-y-3">
    <div className="space-y-2">
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-3 w-[300px]" />
    </div>
    <Skeleton className="h-[300px] w-full" />
  </div>
);
⋮----
// offsetParent will be null when hidden (e.g., inactive tab or collapsed)
⋮----
// Plotly.resize may return void or a promise depending on version; we safely ignore the return.
⋮----
// Handle manual resize when container changes
⋮----
const handleResize = () =>
⋮----
// Debounce resize calls to avoid thrashing Plotly resize
⋮----
// Set up ResizeObserver to detect container size changes
⋮----
// Also resize when theme changes (can affect layout)
⋮----
// Small delay to ensure theme changes are applied
⋮----
// Force a resize whenever the upstream data/layout objects change.
// This catches cases like switching run history, where the container size
// stays the same but Plotly needs to recompute its internal view box.
⋮----
// Enhanced layout with theme support
⋮----
// Ensure automargin is applied after layout.xaxis spread
⋮----
// Ensure automargin is applied after layout.yaxis spread
⋮----
// Provide fallback margins in case automargin has issues
⋮----
t: 60, // Increased top margin to give Plotly toolbar more space
⋮----
l: 90, // Larger left margin as fallback for automargin issues
⋮----
// Enhanced config with responsive behavior
⋮----
// Only render CardHeader if there's content to show
⋮----
<Card className=
⋮----
{/* Header with title */}
⋮----
{/* Content */}
⋮----
{/* Flavor text */}
⋮----
{/* Detailed explanation */}
⋮----
// Utility function to create common chart configurations
export const createChartConfig = (
  overrides?: Partial<Config>
): Partial<Config> => (
⋮----
// Common layout configurations
```

## File: components/performance-charts/margin-utilization-chart.tsx
```typescript
import { useMemo } from 'react'
import type { Layout, PlotData } from 'plotly.js'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
⋮----
interface MarginUtilizationChartProps {
  className?: string
}
```

## File: components/performance-charts/rom-timeline-chart.tsx
```typescript
import React, { useMemo, useState } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import type { Layout, PlotData } from 'plotly.js'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
⋮----
interface ROMTimelineChartProps {
  className?: string
}
⋮----
// ROM scatter plot
⋮----
// Moving average overlay
⋮----
// Only display MA if we have enough data points for a full window
⋮----
// Start from the first point where we have a full window
⋮----
// Calculate mean ROM
⋮----
// Add mean line as a trace (not a shape) so it can be toggled via legend
```

## File: components/performance-charts/trade-sequence-chart.tsx
```typescript
import React, { useMemo, useState } from 'react'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Layout, PlotData } from 'plotly.js'
⋮----
interface TradeSequenceChartProps {
  className?: string
  showTrend?: boolean
}
⋮----
type ViewMode = 'dollars' | 'percent'
⋮----
// Scatter plot for trade returns
⋮----
// Add trend line if enabled and we have enough data
⋮----
// Calculate linear regression (y = mx + b)
⋮----
if (value) setViewMode(value as ViewMode)
```

## File: components/report-builder/comparison-summary-card.tsx
```typescript
/**
 * Comparison Summary Card
 *
 * Shows side-by-side comparison of filtered vs full sample statistics.
 */
⋮----
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RegimeComparisonStats, formatStatWithDelta } from '@/lib/calculations/regime-comparison'
import { cn } from '@/lib/utils'
⋮----
interface ComparisonSummaryCardProps {
  stats: RegimeComparisonStats
  className?: string
}
⋮----
{/* Header Row */}
⋮----
{/* Metric Rows */}
⋮----
// Format the full sample value
```

## File: components/report-builder/cumulative-distribution-chart.tsx
```typescript
/**
 * Cumulative Distribution Chart
 *
 * Plotly chart showing cumulative distribution of trades by a field.
 */
⋮----
import { useMemo } from 'react'
import type { Layout, PlotData } from 'plotly.js'
import { ChartWrapper } from '@/components/performance-charts/chart-wrapper'
import { CumulativeDistributionAnalysis } from '@/lib/calculations/cumulative-distribution'
⋮----
interface CumulativeDistributionChartProps {
  analysis: CumulativeDistributionAnalysis
  showPl?: boolean
  className?: string
}
⋮----
// Trade count trace (primary y-axis)
⋮----
// Win rate trace (secondary y-axis)
⋮----
// Avg ROM trace
⋮----
// Optional P&L trace
⋮----
// Reference lines for statistics
```

## File: components/report-builder/index.ts
```typescript
/**
 * Report Builder Components
 *
 * Custom Report Builder for analyzing trades with flexible filters and charts.
 */
```

## File: components/report-builder/metrics-guide-dialog.tsx
```typescript
/**
 * Metrics Guide Dialog
 *
 * A help dialog that explains all available metrics in the Report Builder,
 * including descriptions and formulas.
 */
⋮----
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  REPORT_FIELDS,
  FIELD_CATEGORY_LABELS,
  FIELD_CATEGORY_ORDER,
  FieldCategory
} from '@/lib/models/report-config'
⋮----
/**
 * Group fields by category for display
 */
function getFieldsGroupedByCategory()
⋮----
// Initialize in the correct order
⋮----
// Add fields to their categories
```

## File: components/report-builder/preset-selector.tsx
```typescript
/**
 * Preset Selector
 *
 * Dropdown for selecting pre-defined report presets.
 */
⋮----
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ReportPreset, RegimeFilterConfig } from '@/lib/models/regime'
⋮----
interface PresetSelectorProps {
  presets: ReportPreset[]
  activeFilter: RegimeFilterConfig | null
  onSelect: (presetId: string) => void
}
⋮----
// Determine current preset if any matches the active filter
⋮----
// Simple match: same number of criteria and same regime IDs
```

## File: components/report-builder/regime-breakdown-table.tsx
```typescript
/**
 * Regime Breakdown Table
 *
 * Table showing statistics for each bucket within a regime.
 */
⋮----
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { RegimeBreakdownStats } from '@/lib/calculations/regime-comparison'
import { cn } from '@/lib/utils'
⋮----
interface RegimeBreakdownTableProps {
  stats: RegimeBreakdownStats
  className?: string
}
⋮----
const formatCurrency = (value: number)
⋮----
const formatPercent = (value: number) => `$
⋮----
<div className=
⋮----
<span className=
⋮----
{/* Total row */}
```

## File: components/tail-risk/marginal-contribution-chart.tsx
```typescript
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { TailRiskAnalysisResult } from "@/lib/models/tail-risk";
import { truncateStrategyName } from "@/lib/utils";
import { useTheme } from "next-themes";
import type { Data, Layout } from "plotly.js";
import { useMemo } from "react";
⋮----
interface MarginalContributionChartProps {
  result: TailRiskAnalysisResult;
}
⋮----
// Already sorted by contribution descending
⋮----
// Color gradient based on contribution
⋮----
// Dark mode: orange to red gradient
⋮----
// Light mode: yellow to red gradient
⋮----
y: truncatedNames.reverse(), // Reverse for top-to-bottom display
```

## File: components/tail-risk/scree-plot-chart.tsx
```typescript
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { TailRiskAnalysisResult } from "@/lib/models/tail-risk";
import { useTheme } from "next-themes";
import type { Data, Layout } from "plotly.js";
import { useMemo } from "react";
⋮----
interface ScreePlotChartProps {
  result: TailRiskAnalysisResult;
}
⋮----
// Bar chart for eigenvalues
⋮----
// Line chart for cumulative explained variance
⋮----
// Threshold line (configurable)
```

## File: components/trading-calendar/match-strategies-dialog.tsx
```typescript
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link2, Unlink, Lock } from 'lucide-react'
import { useTradingCalendarStore, StrategyMatch } from '@/lib/stores/trading-calendar-store'
import { cn } from '@/lib/utils'
⋮----
interface MatchStrategiesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}
⋮----
const handleLink = () =>
⋮----
const handleUnlink = (match: StrategyMatch) =>
⋮----
{/* Existing matches */}
⋮----
{/* Auto matches first */}
⋮----
{/* User matches */}
⋮----
onClick=
⋮----
{/* Unmatched strategies */}
⋮----
{/* Backtest strategies */}
⋮----
{/* Actual strategies */}
⋮----
{/* Link action */}
⋮----
{/* All matched state */}
⋮----
{/* No strategies state */}
```

## File: components/walk-forward/period-selector.tsx
```typescript
import { IconPlayerPlay } from "@tabler/icons-react"
import { HelpCircle, Loader2, Square, Sparkles } from "lucide-react"
import { useEffect, useMemo } from "react"
⋮----
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { WalkForwardOptimizationTarget } from "@/lib/models/walk-forward"
import { WALK_FORWARD_PRESETS, useWalkForwardStore } from "@/lib/stores/walk-forward-store"
⋮----
interface PeriodSelectorProps {
  blockId?: string | null
  addon?: React.ReactNode
}
⋮----
// Auto-configure when block changes
⋮----
const handleRun = async () =>
⋮----
onClick=
⋮----
onChange=
⋮----
updateConfig(
```

## File: components/walk-forward/robustness-metrics.tsx
```typescript
import { MetricCard } from "@/components/metric-card"
import { Card, CardContent } from "@/components/ui/card"
import type { WalkForwardResults } from "@/lib/models/walk-forward"
⋮----
interface RobustnessMetricsProps {
  results: WalkForwardResults | null
  targetMetricLabel: string
}
⋮----
export function RobustnessMetrics(
⋮----
// Calculate percentage-based delta: (OOS - IS) / |IS| * 100
// This shows how much performance changed as a percentage of the in-sample baseline
```

## File: components/database-reset-handler.tsx
```typescript
import { useEffect, useState } from "react"
⋮----
/**
 * Database Reset Handler
 *
 * This component runs early in the app lifecycle and checks for a special
 * URL parameter (?reset=true) to force a database reset. This is a last-resort
 * recovery mechanism when the database is so corrupted that the normal
 * "Clear Data & Reload" button doesn't work.
 *
 * Usage: Navigate to https://your-app.com/?reset=true
 *
 * The reset happens BEFORE IndexedDB is opened by any other part of the app,
 * which helps avoid the "blocked" issue that occurs when trying to delete
 * a database that has active connections.
 */
export function DatabaseResetHandler()
⋮----
// Check for reset parameter in URL
⋮----
// Start reset process
⋮----
const performReset = async () =>
⋮----
// Clear localStorage first (synchronous, always works)
⋮----
// Delete all TradeBlocks IndexedDB databases
⋮----
// Remove the reset parameter and reload
⋮----
// Small delay to let any pending deletions propagate
⋮----
// Replace history state so back button doesn't trigger reset again
⋮----
// Show a simple overlay during reset to prevent any other interactions
```

## File: components/import-guide-dialog.tsx
```typescript
/**
 * Import Guide Dialog
 *
 * A help dialog that explains CSV import format requirements,
 * available fields, and custom fields support.
 */
⋮----
import { HelpCircle, Download, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from '@/components/ui/badge'
⋮----
// Template CSVs
⋮----
// Trade log fields
⋮----
// Daily log fields
⋮----
function downloadTemplate(type: 'complete' | 'minimal' | 'daily-log')
⋮----
export function ImportGuideDialog()
⋮----
{/* Download Templates Section */}
⋮----
<DropdownMenuItem onClick=
⋮----
{/* Custom Fields Section */}
⋮----
{/* Trade Log Section */}
⋮----
{/* Required Fields */}
⋮----
{/* Optional Fields */}
⋮----
{/* Daily Log Section */}
⋮----
{/* Required Fields */}
⋮----
{/* Optional Fields */}
⋮----
{/* Tips Section */}
```

## File: components/metric-section.tsx
```typescript
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
⋮----
interface MetricSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: string | React.ReactNode;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  gridCols?: 2 | 3 | 4 | 5;
}
⋮----
<div className=
{/* Section Header */}
⋮----
{/* Metrics Grid */}
```

## File: components/sidebar-active-blocks.tsx
```typescript
import { IconArrowsShuffle, IconCheck } from "@tabler/icons-react";
import { useState } from "react";
⋮----
import { BlockSwitchDialog } from "@/components/block-switch-dialog";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { type Block } from "@/lib/stores/block-store";
⋮----
export function SidebarActiveBlocks(
⋮----
onClick=
```

## File: lib/calculations/correlation.ts
```typescript
import { Trade } from "@/lib/models/trade";
import { mean } from "mathjs";
import { getRanks } from "./statistical-utils";
⋮----
export type CorrelationMethod = "pearson" | "spearman" | "kendall";
export type CorrelationAlignment = "shared" | "zero-pad";
export type CorrelationNormalization = "raw" | "margin" | "notional";
export type CorrelationDateBasis = "opened" | "closed";
⋮----
export interface CorrelationOptions {
  method?: CorrelationMethod;
  alignment?: CorrelationAlignment;
  normalization?: CorrelationNormalization;
  dateBasis?: CorrelationDateBasis;
}
⋮----
export interface CorrelationMatrix {
  strategies: string[];
  correlationData: number[][];
}
⋮----
export interface CorrelationAnalytics {
  strongest: {
    value: number;
    pair: [string, string];
  };
  weakest: {
    value: number;
    pair: [string, string];
  };
  averageCorrelation: number;
  strategyCount: number;
}
⋮----
/**
 * Calculate correlation matrix between trading strategies based on daily returns
 */
export function calculateCorrelationMatrix(
  trades: Trade[],
  options: CorrelationOptions = {}
): CorrelationMatrix
⋮----
// Group trades by strategy and date
⋮----
// Skip trades without a strategy
⋮----
// Need at least 2 strategies
⋮----
// Need at least 2 data points for correlation
⋮----
// Kendall
⋮----
/**
 * Calculate Pearson correlation coefficient
 */
function pearsonCorrelation(x: number[], y: number[]): number
⋮----
/**
 * Calculate Spearman rank correlation coefficient
 */
function spearmanCorrelation(x: number[], y: number[]): number
⋮----
// Convert values to ranks
⋮----
// Calculate Pearson correlation on ranks
⋮----
/**
 * Calculate Kendall's tau correlation coefficient
 */
function kendallCorrelation(x: number[], y: number[]): number
⋮----
// Re-export getRanks for backwards compatibility
⋮----
function normalizeReturn(
  trade: Trade,
  mode: CorrelationNormalization
): number | null
⋮----
function getTradeDateKey(
  trade: Trade,
  basis: CorrelationDateBasis
): string
⋮----
/**
 * Calculate quick analytics from correlation matrix
 */
export function calculateCorrelationAnalytics(
  matrix: CorrelationMatrix
): CorrelationAnalytics
⋮----
// Find strongest and weakest correlations (excluding diagonal)
// Strongest = highest correlation (most positive)
// Weakest = lowest correlation (most negative)
⋮----
// Strongest is the most positive correlation
⋮----
// Weakest is the most negative correlation (minimum value)
```

## File: lib/calculations/cumulative-distribution.ts
```typescript
/**
 * Cumulative Distribution Calculations
 *
 * Generates data for SLR-style distribution charts showing:
 * - % of trades at or above each threshold
 * - % of P&L at or above each threshold
 * - Win rate at each threshold
 * - Average ROM at each threshold
 */
⋮----
import { mean, std, median } from 'mathjs'
import { Trade } from '@/lib/models/trade'
import { RegimeSourceField } from '@/lib/models/regime'
import { getTradeFieldValue, computeDerivedFields, DerivedTradeFields } from './regime-filter'
⋮----
/**
 * Single point in a cumulative distribution
 */
export interface CumulativeDistributionPoint {
  threshold: number
  // "At or above" metrics
  tradesAtOrAbove: number
  tradesAtOrAbovePercent: number
  plAtOrAbove: number
  plAtOrAbovePercent: number
  avgRomAtOrAbove: number
  winRateAtOrAbove: number
  // "At or below" metrics (inverse)
  tradesAtOrBelow: number
  tradesAtOrBelowPercent: number
  plAtOrBelow: number
  plAtOrBelowPercent: number
  avgRomAtOrBelow: number
  winRateAtOrBelow: number
}
⋮----
// "At or above" metrics
⋮----
// "At or below" metrics (inverse)
⋮----
/**
 * Statistics about the distribution
 */
export interface DistributionStats {
  min: number
  max: number
  mean: number
  median: number
  stdDev: number
  count: number
  missingCount: number
}
⋮----
/**
 * Complete cumulative distribution analysis
 */
export interface CumulativeDistributionAnalysis {
  field: RegimeSourceField
  fieldLabel: string
  points: CumulativeDistributionPoint[]
  stats: DistributionStats
}
⋮----
/**
 * Extract field values from trades along with trade data
 */
interface TradeWithValue {
  trade: Trade
  value: number
  rom?: number
}
⋮----
function extractTradeValues(
  trades: Trade[],
  field: RegimeSourceField,
  derivedFieldsMap?: Map<number, DerivedTradeFields>
): TradeWithValue[]
⋮----
/**
 * Calculate statistics for a subset of trades
 */
function calculateSubsetStats(entries: TradeWithValue[]):
⋮----
/**
 * Calculate cumulative distribution for a trade field
 *
 * Creates data points showing what % of trades/P&L occur at each threshold level.
 * Useful for charts like "SLR Distribution" showing trades at or above each ratio.
 *
 * @param trades - Trade data
 * @param field - Which field to analyze
 * @param numBuckets - Number of threshold points (default 50)
 * @param derivedFieldsMap - Optional pre-computed derived fields
 */
export function calculateCumulativeDistribution(
  trades: Trade[],
  field: RegimeSourceField,
  numBuckets: number = 50,
  derivedFieldsMap?: Map<number, DerivedTradeFields>
): CumulativeDistributionAnalysis
⋮----
// Extract valid values
⋮----
// Sort by value for cumulative calculation
⋮----
// Calculate statistics
⋮----
// Total P&L for percentage calculations
⋮----
// Generate threshold points
⋮----
// Entries at or above this threshold
⋮----
// Entries at or below this threshold
⋮----
// At or above
⋮----
// At or below
⋮----
/**
 * Find the optimal threshold for a given metric
 * Returns the threshold that maximizes the target metric
 */
export function findOptimalThreshold(
  analysis: CumulativeDistributionAnalysis,
  metric: 'winRateAtOrAbove' | 'avgRomAtOrAbove' | 'winRateAtOrBelow' | 'avgRomAtOrBelow',
  minSampleSize: number = 10
):
⋮----
/**
 * Calculate the tradeoff at a specific threshold
 * Shows what you gain vs what you give up by filtering at this level
 */
export interface ThresholdTradeoff {
  threshold: number
  // What you keep (at or above for high values, at or below for low values)
  keptTrades: number
  keptTradesPercent: number
  keptPl: number
  keptPlPercent: number
  keptWinRate: number
  keptAvgRom: number
  // What you exclude
  excludedTrades: number
  excludedTradesPercent: number
  excludedPl: number
  excludedPlPercent: number
  excludedWinRate: number
  excludedAvgRom: number
}
⋮----
// What you keep (at or above for high values, at or below for low values)
⋮----
// What you exclude
⋮----
/**
 * Calculate tradeoff analysis for a threshold (keeping values at or above)
 */
export function calculateThresholdTradeoff(
  analysis: CumulativeDistributionAnalysis,
  threshold: number
): ThresholdTradeoff | null
⋮----
// Find the closest point to the threshold
⋮----
const totalPl = analysis.points[0]?.plAtOrAbove ?? 0 // First point has all trades
⋮----
// Kept (at or above)
⋮----
// Excluded (below)
⋮----
/**
 * Generate distribution data for multiple fields at once
 */
export function calculateMultipleDistributions(
  trades: Trade[],
  fields: RegimeSourceField[],
  numBuckets: number = 50
): Map<RegimeSourceField, CumulativeDistributionAnalysis>
⋮----
// Pre-compute derived fields once for efficiency
```

## File: lib/calculations/portfolio-stats.ts
```typescript
/**
 * Portfolio Statistics Calculator
 *
 * Calculates comprehensive portfolio statistics from trade data.
 * Based on legacy Python implementation for consistency.
 * Uses math.js for statistical calculations to ensure numpy compatibility.
 *
 * Key improvements for consistency:
 * - Sharpe Ratio: Uses sample std (N-1) via math.js 'uncorrected' parameter
 * - Sortino Ratio: Uses population std (N) via math.js 'biased' parameter to match numpy.std()
 * - Mean calculations: Replaced manual reduce operations with math.js mean()
 * - Min/Max calculations: Using math.js min/max functions
 * - Daily returns: Fixed to use previous day's portfolio value as denominator
 *
 * This ensures our calculations match the legacy Python implementation exactly.
 */
⋮----
import { std, mean, min, max } from 'mathjs'
import { Trade } from '../models/trade'
import { DailyLogEntry } from '../models/daily-log'
import { PortfolioStats, StrategyStats, AnalysisConfig } from '../models/portfolio-stats'
⋮----
/**
 * Default analysis configuration
 */
⋮----
riskFreeRate: 2.0, // 2% annual
⋮----
annualizationFactor: 252, // Business days
⋮----
/**
 * Portfolio statistics calculator
 */
export class PortfolioStatsCalculator
⋮----
constructor(config: Partial<AnalysisConfig> =
⋮----
/**
   * Calculate comprehensive portfolio statistics
   */
calculatePortfolioStats(trades: Trade[], dailyLogEntries?: DailyLogEntry[], isStrategyFiltered = false): PortfolioStats
⋮----
// Filter out invalid trades and handle errors
⋮----
// Check for required fields
⋮----
// Validate date
⋮----
// Check commissions
⋮----
// For strategy-filtered analysis, we CANNOT use daily logs because they represent
// the full portfolio performance. Strategy filtering must use trade-based calculations only.
⋮----
? undefined  // Force trade-based calculations for strategy filtering
⋮----
// Debug logging removed for tests
⋮----
// Basic statistics
⋮----
// Win/Loss analysis
⋮----
// Max win/loss - handle empty arrays
⋮----
// Profit factor (gross profit / gross loss)
⋮----
// Drawdown calculation
⋮----
// Daily P/L calculation
⋮----
// Sharpe ratio (if we have daily data)
⋮----
// Advanced metrics
⋮----
// Streak calculations
⋮----
// Time in drawdown
⋮----
// Periodic win rates
⋮----
// Calculate initial capital (prefer daily logs when available)
⋮----
/**
   * Calculate strategy-specific statistics
   */
calculateStrategyStats(trades: Trade[]): Record<string, StrategyStats>
⋮----
// Group trades by strategy
⋮----
// Calculate stats for each strategy
⋮----
// Calculate average DTE if available
⋮----
successRate: portfolioStats.winRate, // Assuming success rate = win rate for now
⋮----
/**
   * Calculate maximum drawdown
   */
private calculateMaxDrawdown(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number
⋮----
// If we have daily log data, use it for more accurate drawdown
⋮----
// Match legacy: take absolute value of each drawdown, then find maximum
⋮----
// Daily log contains percentage values (e.g., -5.55), same as legacy Python
const drawdownPct = Math.abs(entry.drawdownPct || 0)  // Make sure it's positive
⋮----
// Otherwise calculate from trade data using legacy methodology
⋮----
// Filter to only closed trades that have fundsAtClose data
⋮----
// Sort trades by close date and time (legacy methodology)
⋮----
// Check for valid dates
⋮----
// Calculate initial capital using existing helper for consistency
⋮----
// Build an end-of-day equity series so intraday sequencing doesn't inflate drawdowns
⋮----
/**
   * Calculate average daily P/L
   */
private calculateAvgDailyPl(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number
⋮----
// Use daily log data if available
⋮----
// Otherwise calculate from trades
⋮----
// Group trades by date
⋮----
// Skip invalid dates
⋮----
/**
   * Calculate Sharpe ratio
   */
private calculateSharpeRatio(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number | undefined
⋮----
// Calculate returns from daily log data
⋮----
// Calculate from trade data grouped by day
⋮----
// Skip invalid dates
⋮----
// Convert P/L to returns
⋮----
// Calculate Sharpe ratio using math.js for statistical consistency
⋮----
const stdDev = std(dailyReturns, 'uncorrected') as number // Use sample std (N-1) for Sharpe
⋮----
// Annualize the Sharpe ratio
⋮----
/**
   * Calculate average days to expiration (DTE)
   */
private calculateAvgDTE(trades: Trade[]): number | undefined
⋮----
/**
   * Calculate Compound Annual Growth Rate (CAGR)
   */
private calculateCAGR(trades: Trade[]): number | undefined
⋮----
return cagr * 100  // Return as percentage
⋮----
/**
   * Calculate Sortino Ratio
   */
private calculateSortinoRatio(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number | undefined
⋮----
// Calculate excess returns (returns minus risk-free rate)
⋮----
// Only consider negative excess returns for downside deviation
⋮----
// Calculate downside deviation using math.js to match numpy.std behavior
// Use 'biased' for population std (divide by N) to match numpy default
⋮----
// Check for zero or near-zero downside deviation to prevent overflow
⋮----
/**
   * Calculate Calmar Ratio
   */
private calculateCalmarRatio(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number | undefined
⋮----
/**
   * Calculate Kelly Criterion Percentage
   */
private calculateKellyPercentage(trades: Trade[]): number | undefined
⋮----
return kellyPercentage * 100  // Return as percentage
⋮----
/**
   * Calculate win/loss streaks
   */
private calculateStreaks(trades: Trade[]):
⋮----
// Sort trades by date only (legacy methodology)
⋮----
if (trade.pl > 0) { // Winning trade
⋮----
} else if (trade.pl < 0) { // Losing trade
⋮----
} else { // Break-even trades (pl == 0) break both streaks (legacy behavior)
⋮----
// Calculate current streak as the most recent active streak
⋮----
/**
   * Calculate time in drawdown
   */
private calculateTimeInDrawdown(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number | undefined
⋮----
// If no daily log, calculate from trade data using legacy methodology
⋮----
// Filter to only closed trades with fundsAtClose data (legacy approach)
⋮----
// Sort by close date and time (legacy methodology)
⋮----
// Check for valid dates
⋮----
// Calculate initial capital from first trade
⋮----
// Track periods in drawdown (legacy methodology)
⋮----
// Update peak
⋮----
// Count if currently in drawdown
⋮----
/**
   * Calculate periodic win rates
   */
private calculatePeriodicWinRates(trades: Trade[]):
⋮----
// Group trades by month and week
⋮----
// Monthly grouping (YYYY-MM)
⋮----
// Weekly grouping (YYYY-WW)
⋮----
// Calculate monthly win rate
⋮----
// Calculate weekly win rate
⋮----
/**
   * Calculate daily returns for advanced metrics
   */
private calculateDailyReturns(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number[]
⋮----
// Calculate previous day's portfolio value (net liquidity minus today's P/L)
⋮----
// Calculate from trade data
⋮----
// Group trades by date
⋮----
// Calculate daily returns
⋮----
/**
   * Get empty statistics (for zero trades)
   */
private getEmptyStats(): PortfolioStats
⋮----
/**
   * Calculate initial capital from trades and/or daily logs
   *
   * @param trades - Trade data
   * @param dailyLogEntries - Optional daily log entries (preferred when available)
   * @returns Initial capital before any P/L
   *
   * When daily logs are provided, calculates: firstEntry.netLiquidity - firstEntry.dailyPl
   * Otherwise, calculates: firstTrade.fundsAtClose - firstTrade.pl
   */
static calculateInitialCapital(trades: Trade[], dailyLogEntries?: DailyLogEntry[]): number
⋮----
// Prefer daily log data when available for more accurate initial capital
⋮----
// Initial capital = Net Liquidity - Daily P/L
// This accounts for any P/L that occurred on the first day
⋮----
// Fall back to trade-based calculation
// Sort trades chronologically
⋮----
/**
   * Calculate portfolio value at any point in time
   */
static calculatePortfolioValueAtDate(trades: Trade[], targetDate: Date, initialCapital?: number): number
```

## File: lib/db/enriched-trades-cache.ts
```typescript
/**
 * Enriched Trades Cache
 *
 * Caches pre-calculated enriched trades in IndexedDB
 * to avoid expensive recalculation on every Report Builder load.
 *
 * Enriched trades include MFE/MAE, ROM, timing metrics, and other
 * derived fields that are expensive to compute for large portfolios.
 */
⋮----
import { EnrichedTrade } from "../models/enriched-trade";
import {
  promisifyRequest,
  STORES,
  withReadTransaction,
  withWriteTransaction,
} from "./index";
⋮----
/**
 * Cache entry for enriched trades
 */
interface EnrichedTradesCache {
  id: string; // Format: `enriched_trades_${blockId}`
  blockId: string;
  calculationType: "enriched_trades";
  trades: EnrichedTrade[];
  tradeCount: number;
  calculatedAt: Date;
}
⋮----
id: string; // Format: `enriched_trades_${blockId}`
⋮----
/**
 * Generate the cache ID for a block
 */
function getCacheId(blockId: string): string
⋮----
/**
 * Store pre-calculated enriched trades for a block
 */
export async function storeEnrichedTradesCache(
  blockId: string,
  enrichedTrades: EnrichedTrade[]
): Promise<void>
⋮----
/**
 * Get cached enriched trades for a block
 * Returns null if cache doesn't exist
 */
export async function getEnrichedTradesCache(
  blockId: string
): Promise<EnrichedTrade[] | null>
⋮----
// Restore Date objects that were serialized
⋮----
/**
 * Delete cached enriched trades for a block
 */
export async function deleteEnrichedTradesCache(
  blockId: string
): Promise<void>
⋮----
// Check if entry exists before trying to delete
⋮----
/**
 * Check if enriched trades cache exists for a block
 */
export async function hasEnrichedTradesCache(
  blockId: string
): Promise<boolean>
```

## File: lib/metrics/trade-efficiency.ts
```typescript
import { Trade } from '@/lib/models/trade'
⋮----
/**
 * Standard options multiplier used to convert per-contract values into notional dollars.
 * Equity and index option contracts typically control 100 shares, so premium/max profit
 * values need to be scaled by 100 to reflect the total economic exposure.
 */
⋮----
/**
 * Margin-to-notional ratio threshold that indicates a trade is lightly margined.
 * When gross notional is less than 50% of the posted margin requirement we treat
 * the trade as an option-style structure and apply the contract multiplier.
 */
⋮----
/**
 * Notional dollar threshold under which trades are considered "small". These trades
 * likely represent single-lot option structures, so we apply the option multiplier
 * even if there is no explicit margin requirement to compare against.
 */
⋮----
function getNormalizedContractCount(trade: Trade): number
⋮----
function applyOptionMultiplierIfNeeded(total: number, trade: Trade): number
⋮----
function normalisePerContractValue(value: number, trade: Trade, isPremium: boolean): number
⋮----
export function computeTotalPremium(trade: Trade): number | undefined
⋮----
/**
 * Computes total MFE (Maximum Favorable Excursion) in dollars.
 * OptionOmega exports maxProfit as a percentage of initial premium.
 */
export function computeTotalMaxProfit(trade: Trade): number | undefined
⋮----
// maxProfit is a percentage (e.g., 18.67 means 18.67% of initial premium)
⋮----
/**
 * Computes total MAE (Maximum Adverse Excursion) in dollars.
 * OptionOmega exports maxLoss as a percentage of initial premium.
 */
export function computeTotalMaxLoss(trade: Trade): number | undefined
⋮----
// maxLoss is a percentage (e.g., -12.65 means 12.65% loss of initial premium)
⋮----
export type EfficiencyBasis = 'premium' | 'maxProfit' | 'margin' | 'unknown'
⋮----
export interface PremiumEfficiencyResult {
  percentage?: number
  denominator?: number
  basis: EfficiencyBasis
}
⋮----
/**
 * Calculates a trade's premium efficiency percentage.
 *
 * The function searches for the most appropriate denominator to express trade performance:
 * 1. Total premium collected (preferred when available)
 * 2. Total maximum profit
 * 3. Margin requirement
 *
 * Once a denominator is selected, it normalizes the trade's P/L against that value to
 * compute an efficiency percentage. If no denominator can be derived or the resulting
 * ratio is not finite, only the basis is reported.
 *
 * @param trade Trade record including premium, max profit, margin requirement, and P/L.
 * @returns Object describing the efficiency percentage, denominator, and basis used.
 */
export function calculatePremiumEfficiencyPercent(trade: Trade): PremiumEfficiencyResult
```

## File: lib/models/block.ts
```typescript
import {
  PerformanceMetrics,
  PortfolioStats,
  StrategyStats,
} from "./portfolio-stats";
import { StrategyAlignment } from "./strategy-alignment";
// import { Trade } from './trade'
// import { DailyLog } from './daily-log'
⋮----
/**
 * Enhanced Block interface for processed trading data
 * Extends the basic block with references to parsed and calculated data
 */
export interface ProcessedBlock {
  // Basic block metadata
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  created: Date;
  lastModified: Date;

  // File metadata (pre-processing)
  tradeLog: {
    fileName: string;
    fileSize: number;
    originalRowCount: number; // Raw CSV rows
    processedRowCount: number; // Valid trades after cleaning
    uploadedAt: Date;
  };

  dailyLog?: {
    fileName: string;
    fileSize: number;
    originalRowCount: number;
    processedRowCount: number;
    uploadedAt: Date;
  };

  reportingLog?: {
    fileName: string;
    fileSize: number;
    originalRowCount: number;
    processedRowCount: number;
    uploadedAt: Date;
  };

  // Date range of trades (min/max dateOpened)
  dateRange?: {
    start: Date;
    end: Date;
  };

  // Processing status
  processingStatus: "pending" | "processing" | "completed" | "error";
  processingError?: string;
  lastProcessedAt?: Date;

  // Calculated statistics (computed from processed data)
  portfolioStats?: PortfolioStats;
  strategyStats?: Record<string, StrategyStats>;
  performanceMetrics?: PerformanceMetrics;

  // Strategy alignment metadata for comparison workflows
  strategyAlignment?: {
    version: number;
    updatedAt: Date;
    mappings: StrategyAlignment[];
  };

  // Data references (stored in IndexedDB)
  dataReferences: {
    tradesStorageKey: string; // Key for trades in IndexedDB
    dailyLogStorageKey?: string; // Key for daily log in IndexedDB
    calculationsStorageKey?: string; // Key for cached calculations
    reportingLogStorageKey?: string; // Key for reporting log in IndexedDB
  };

  // Analysis configuration
  analysisConfig: {
    riskFreeRate: number;
    useBusinessDaysOnly: boolean;
    annualizationFactor: number;
    confidenceLevel: number;
    combineLegGroups?: boolean; // For strategies with multiple entries per timestamp
  };
}
⋮----
// Basic block metadata
⋮----
// File metadata (pre-processing)
⋮----
originalRowCount: number; // Raw CSV rows
processedRowCount: number; // Valid trades after cleaning
⋮----
// Date range of trades (min/max dateOpened)
⋮----
// Processing status
⋮----
// Calculated statistics (computed from processed data)
⋮----
// Strategy alignment metadata for comparison workflows
⋮----
// Data references (stored in IndexedDB)
⋮----
tradesStorageKey: string; // Key for trades in IndexedDB
dailyLogStorageKey?: string; // Key for daily log in IndexedDB
calculationsStorageKey?: string; // Key for cached calculations
reportingLogStorageKey?: string; // Key for reporting log in IndexedDB
⋮----
// Analysis configuration
⋮----
combineLegGroups?: boolean; // For strategies with multiple entries per timestamp
⋮----
/**
 * Basic block interface (backward compatibility)
 */
export interface Block {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  created: Date;
  lastModified: Date;
  tradeLog: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  dailyLog?: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  reportingLog?: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  stats: {
    totalPnL: number;
    winRate: number;
    totalTrades: number;
    avgWin: number;
    avgLoss: number;
  };
  strategyAlignment?: {
    mappings: StrategyAlignment[];
    updatedAt: Date;
  };
}
⋮----
/**
 * Block creation request (for new uploads)
 */
export interface CreateBlockRequest {
  name: string;
  description?: string;
  tradeLogFile: File;
  dailyLogFile?: File;
  analysisConfig?: Partial<ProcessedBlock["analysisConfig"]>;
}
⋮----
/**
 * Block update request
 */
export interface UpdateBlockRequest {
  name?: string;
  description?: string;
  analysisConfig?: Partial<ProcessedBlock["analysisConfig"]>;
}
⋮----
/**
 * File upload progress
 */
export interface UploadProgress {
  stage: "uploading" | "parsing" | "processing" | "calculating" | "storing";
  progress: number; // 0-100
  message: string;
  details?: {
    totalRows?: number;
    processedRows?: number;
    errors?: string[];
  };
}
⋮----
progress: number; // 0-100
⋮----
/**
 * Block processing result
 */
export interface ProcessingResult {
  success: boolean;
  block?: ProcessedBlock;
  errors?: string[];
  warnings?: string[];
  stats?: {
    tradesProcessed: number;
    dailyEntriesProcessed: number;
    processingTimeMs: number;
  };
}
```

## File: lib/models/daily-log.ts
```typescript
/**
 * Daily log model based on legacy Python DailyLogEntry class
 * Represents daily portfolio performance data from OptionOmega
 */
export interface DailyLogEntry {
  date: Date
  netLiquidity: number
  currentFunds: number
  withdrawn: number
  tradingFunds: number
  dailyPl: number  // P/L for the day
  dailyPlPct: number  // P/L percentage
  drawdownPct: number  // Drawdown percentage
  blockId?: string  // Optional block ID for linking to trades

  /**
   * Custom fields from extra columns in the daily log CSV
   * Keys are the original column names, values are auto-detected as number or string
   * These fields can be joined to trades by date for analysis (e.g., dayOpenVix, spyOpen)
   */
  customFields?: Record<string, number | string>
}
⋮----
dailyPl: number  // P/L for the day
dailyPlPct: number  // P/L percentage
drawdownPct: number  // Drawdown percentage
blockId?: string  // Optional block ID for linking to trades
⋮----
/**
   * Custom fields from extra columns in the daily log CSV
   * Keys are the original column names, values are auto-detected as number or string
   * These fields can be joined to trades by date for analysis (e.g., dayOpenVix, spyOpen)
   */
⋮----
/**
 * Raw daily log data as it comes from CSV before processing
 */
export interface RawDailyLogData {
  "Date": string
  "Net Liquidity": string
  "Current Funds": string
  "Withdrawn": string
  "Trading Funds": string
  "P/L": string
  "P/L %": string
  "Drawdown %": string
}
⋮----
/**
 * Processed daily log collection with metadata
 */
export interface DailyLog {
  entries: DailyLogEntry[]
  uploadTimestamp: Date
  filename: string
  totalEntries: number
  dateRangeStart: Date
  dateRangeEnd: Date
  finalPortfolioValue: number
  maxDrawdown: number
}
⋮----
/**
 * Column mapping from CSV headers to DailyLogEntry interface properties
 */
⋮----
/**
 * Required columns for daily log processing
 */
```

## File: lib/models/regime.ts
```typescript
/**
 * Regime definitions for the Custom Report Builder
 *
 * Regimes allow users to define custom thresholds for filtering trades
 * by market conditions (VIX levels, SLR bands, time of day, etc.)
 */
⋮----
/**
 * Supported field types for regime filtering
 * Each type determines the UI component and validation logic
 */
export type RegimeFieldType =
  | 'numeric_threshold'    // For VIX, SLR, gap, excursion metrics
  | 'time_of_day'          // For timeOpened buckets
  | 'day_of_week'          // For day of week filtering
⋮----
| 'numeric_threshold'    // For VIX, SLR, gap, excursion metrics
| 'time_of_day'          // For timeOpened buckets
| 'day_of_week'          // For day of week filtering
⋮----
/**
 * Available trade fields that can be used for regime filtering
 */
export type RegimeSourceField =
  // Direct trade fields
  | 'openingVix'
  | 'closingVix'
  | 'openingShortLongRatio'
  | 'closingShortLongRatio'
  | 'gap'
  | 'movement'
  // Time-based fields
  | 'timeOpened'
  | 'dayOfWeek'
  // Derived fields (computed at analysis time)
  | 'durationHours'
  | 'mfePercent'
  | 'maePercent'
  | 'profitCapturePercent'
  | 'excursionRatio'
⋮----
// Direct trade fields
⋮----
// Time-based fields
⋮----
// Derived fields (computed at analysis time)
⋮----
/**
 * Human-readable labels for source fields
 */
⋮----
/**
 * Field type mapping for each source field
 */
⋮----
/**
 * Base interface for all regime bucket definitions
 */
export interface RegimeBucketBase {
  id: string               // UUID for unique identification
  name: string             // Display label (e.g., "Low VIX", "Morning Session")
  color?: string           // Optional color for charts (hex code)
}
⋮----
id: string               // UUID for unique identification
name: string             // Display label (e.g., "Low VIX", "Morning Session")
color?: string           // Optional color for charts (hex code)
⋮----
/**
 * Numeric threshold bucket (for VIX, SLR, gap, etc.)
 * Supports open-ended ranges via null min/max
 */
export interface NumericThresholdBucket extends RegimeBucketBase {
  type: 'numeric_threshold'
  min: number | null       // null = negative infinity
  max: number | null       // null = positive infinity
}
⋮----
min: number | null       // null = negative infinity
max: number | null       // null = positive infinity
⋮----
/**
 * Time of day bucket for trading session analysis
 * Times are in HH:mm format (24-hour)
 */
export interface TimeOfDayBucket extends RegimeBucketBase {
  type: 'time_of_day'
  startTime: string        // HH:mm format (24-hour)
  endTime: string          // HH:mm format (24-hour)
}
⋮----
startTime: string        // HH:mm format (24-hour)
endTime: string          // HH:mm format (24-hour)
⋮----
/**
 * Day of week bucket for weekly pattern analysis
 */
export interface DayOfWeekBucket extends RegimeBucketBase {
  type: 'day_of_week'
  days: number[]           // 0=Sunday, 1=Monday, ..., 6=Saturday
}
⋮----
days: number[]           // 0=Sunday, 1=Monday, ..., 6=Saturday
⋮----
/**
 * Union type for all bucket types
 */
export type RegimeBucket =
  | NumericThresholdBucket
  | TimeOfDayBucket
  | DayOfWeekBucket
⋮----
/**
 * Core regime definition that users create and manage
 */
export interface RegimeDefinition {
  id: string                           // UUID
  name: string                         // User-defined name (e.g., "VIX Regimes")
  description?: string                 // Optional description
  sourceField: RegimeSourceField       // Which trade field to analyze
  fieldType: RegimeFieldType           // Determines bucket type and UI
  buckets: RegimeBucket[]              // Ordered list of buckets
  isBuiltIn: boolean                   // true for system defaults (non-deletable)
  createdAt: string                    // ISO date string
  updatedAt: string                    // ISO date string
}
⋮----
id: string                           // UUID
name: string                         // User-defined name (e.g., "VIX Regimes")
description?: string                 // Optional description
sourceField: RegimeSourceField       // Which trade field to analyze
fieldType: RegimeFieldType           // Determines bucket type and UI
buckets: RegimeBucket[]              // Ordered list of buckets
isBuiltIn: boolean                   // true for system defaults (non-deletable)
createdAt: string                    // ISO date string
updatedAt: string                    // ISO date string
⋮----
/**
 * Filter criterion for selecting specific buckets within a regime
 */
export interface RegimeFilterCriterion {
  regimeId: string
  selectedBucketIds: string[]  // Empty = all buckets selected (no filter)
  enabled: boolean
}
⋮----
selectedBucketIds: string[]  // Empty = all buckets selected (no filter)
⋮----
/**
 * Complete filter configuration combining multiple regime criteria
 * All enabled criteria are combined with AND logic
 */
export interface RegimeFilterConfig {
  name?: string
  criteria: RegimeFilterCriterion[]
}
⋮----
/**
 * Preset report configuration
 */
export interface ReportPreset {
  id: string
  name: string
  description: string
  filter: RegimeFilterConfig
  visualization: 'comparison' | 'distribution' | 'scatter' | 'breakdown'
  isBuiltIn: boolean
}
⋮----
/**
 * Day of week constants
 */
⋮----
/**
 * Helper to create a numeric threshold bucket
 */
export function createNumericBucket(
  name: string,
  min: number | null,
  max: number | null,
  color?: string
): NumericThresholdBucket
⋮----
/**
 * Helper to create a time of day bucket
 */
export function createTimeOfDayBucket(
  name: string,
  startTime: string,
  endTime: string,
  color?: string
): TimeOfDayBucket
⋮----
/**
 * Helper to create a day of week bucket
 */
export function createDayOfWeekBucket(
  name: string,
  days: number[],
  color?: string
): DayOfWeekBucket
⋮----
/**
 * Validate numeric bucket ranges for overlaps
 */
export function validateNumericBuckets(buckets: NumericThresholdBucket[]): string[]
⋮----
// Sort by min value for overlap detection
⋮----
/**
 * Validate time of day buckets
 */
export function validateTimeOfDayBuckets(buckets: TimeOfDayBucket[]): string[]
⋮----
/**
 * Validate a complete regime definition
 */
export function validateRegimeDefinition(regime: RegimeDefinition): string[]
```

## File: lib/models/reporting-trade.ts
```typescript
/**
 * Reporting trade model represents backtested strategy executions coming from the
 * strategy-trade-log.csv export. These records are used to align theoretical
 * performance with the real trade log for a block.
 */
export interface ReportingTrade {
  strategy: string
  dateOpened: Date
  timeOpened?: string
  openingPrice: number
  legs: string
  initialPremium: number
  numContracts: number
  pl: number
  closingPrice?: number
  dateClosed?: Date
  timeClosed?: string
  avgClosingCost?: number
  reasonForClose?: string
}
⋮----
/**
 * Raw reporting trade data direct from the CSV prior to conversion.
 */
export interface RawReportingTradeData {
  "Strategy": string
  "Date Opened": string
  "Time Opened"?: string
  "Opening Price": string
  "Legs": string
  "Initial Premium": string
  "No. of Contracts": string
  "P/L": string
  "Closing Price"?: string
  "Date Closed"?: string
  "Time Closed"?: string
  "Avg. Closing Cost"?: string
  "Reason For Close"?: string
}
⋮----
/**
 * Required columns that must be present for a reporting log import to be valid.
 */
⋮----
/**
 * Column aliases to support slight variations in exports.
 */
```

## File: lib/processing/daily-log-processor.ts
```typescript
/**
 * Daily Log Processor
 *
 * Handles parsing and processing of daily log CSV files from OptionOmega.
 * Converts raw CSV data to validated DailyLogEntry objects.
 */
⋮----
import { DailyLogEntry, REQUIRED_DAILY_LOG_COLUMNS, DAILY_LOG_COLUMN_MAPPING } from '../models/daily-log'
⋮----
/**
 * Set of known daily log column names (canonical names from DAILY_LOG_COLUMN_MAPPING)
 * Used to identify custom columns that should be preserved
 */
⋮----
'Withdrawn', // Optional column that may not be in REQUIRED but is known
⋮----
import { ValidationError, ProcessingError } from '../models'
import { rawDailyLogDataSchema, dailyLogEntrySchema } from '../models/validators'
import { CSVParser, ParseProgress } from './csv-parser'
import { findMissingHeaders } from '../utils/csv-headers'
// import { CSVParseResult } from './csv-parser'
⋮----
/**
 * Daily log processing configuration
 */
export interface DailyLogProcessingConfig {
  maxEntries?: number
  strictValidation?: boolean
  progressCallback?: (progress: DailyLogProcessingProgress) => void
}
⋮----
/**
 * Daily log processing progress
 */
export interface DailyLogProcessingProgress extends ParseProgress {
  stage: 'reading' | 'parsing' | 'validating' | 'converting' | 'completed'
  validEntries: number
  invalidEntries: number
}
⋮----
/**
 * Daily log processing result
 */
export interface DailyLogProcessingResult {
  entries: DailyLogEntry[]
  totalRows: number
  validEntries: number
  invalidEntries: number
  errors: ProcessingError[]
  warnings: string[]
  stats: {
    processingTimeMs: number
    dateRange: { start: Date | null; end: Date | null }
    finalPortfolioValue: number
    maxDrawdown: number
    totalPL: number
  }
}
⋮----
/**
 * Daily log processor class
 */
export class DailyLogProcessor
⋮----
constructor(config: DailyLogProcessingConfig =
⋮----
maxEntries: 10000, // Reasonable limit for daily entries
⋮----
/**
   * Process daily log file
   */
async processFile(file: File, blockId?: string): Promise<DailyLogProcessingResult>
⋮----
// Validate file
⋮----
// Configure CSV parser
⋮----
// Parse CSV with validation
⋮----
// Collect parsing errors
⋮----
// Check for required columns
⋮----
// Update progress for conversion stage
⋮----
// Convert validated data to DailyLogEntry objects
⋮----
// Log conversion errors to console for debugging
⋮----
continue // Skip invalid row in non-strict mode
⋮----
throw error // Fail fast in strict mode
⋮----
// Update progress
⋮----
// Sort entries by date
⋮----
// Calculate statistics
⋮----
// Final progress update
⋮----
/**
   * Validate raw daily log data from CSV
   */
private validateRawDailyLogData(row: Record<string, string>, rowIndex: number): Record<string, string> | null
⋮----
// Set default values for missing optional fields
⋮----
// Ensure required columns have values
⋮----
// Basic format validation (detailed validation happens in conversion)
⋮----
// Log validation errors to console for debugging
⋮----
// Return null for invalid rows - they'll be counted as invalid
⋮----
/**
   * Convert validated CSV row to DailyLogEntry object
   */
private convertToDailyLogEntry(rawData: Record<string, string>, blockId?: string): DailyLogEntry
⋮----
// Parse date
⋮----
// Parse numeric values with error handling
const parseNumber = (value: string | undefined, fieldName: string, defaultValue?: number): number =>
⋮----
// Remove currency symbols, commas, and percentage signs
⋮----
// Build daily log entry object
⋮----
// Keep percentage values as they are from CSV to match legacy behavior
// Legacy Python expects percentage values (e.g., -5.55), not decimals (e.g., -0.0555)
⋮----
// Extract custom fields (columns not in KNOWN_DAILY_LOG_COLUMNS)
⋮----
// Auto-detect type: try to parse as number
⋮----
// Only add customFields if there are any
⋮----
// Final validation with Zod schema
⋮----
/**
   * Process CSV content directly (for testing)
   */
async processCSVContent(content: string, blockId?: string): Promise<DailyLogProcessingResult>
⋮----
// Create a mock File object for testing
⋮----
/**
   * Validate daily log data consistency
   */
static validateDataConsistency(entries: DailyLogEntry[]): string[]
⋮----
// Sort by date for chronological validation
⋮----
// Check for gaps in dates (more than 7 days)
⋮----
// Check for negative net liquidity
⋮----
// Check for extreme drawdowns (> 50%)
```

## File: lib/stores/walk-forward-store.ts
```typescript
import { create } from 'zustand'
import { WalkForwardAnalyzer } from '@/lib/calculations/walk-forward-analyzer'
import {
  WalkForwardAnalysis,
  WalkForwardConfig,
  WalkForwardParameterRangeTuple,
  WalkForwardParameterRanges,
  WalkForwardProgressEvent,
} from '@/lib/models/walk-forward'
import { toCsvRow } from '@/lib/utils/export-helpers'
import { Trade } from '@/lib/models/trade'
⋮----
type WalkForwardPresetKey = 'conservative' | 'moderate' | 'aggressive'
⋮----
export interface TradeFrequencyInfo {
  totalTrades: number
  tradingDays: number
  avgDaysBetweenTrades: number
  tradesPerMonth: number
}
⋮----
/**
 * Calculates trade frequency metrics from a list of trades.
 */
export function calculateTradeFrequency(trades: Trade[]): TradeFrequencyInfo | null
⋮----
/**
 * Generates sensible WFA configuration defaults based on trade frequency.
 * Ensures windows are large enough to capture sufficient trades for meaningful analysis.
 */
export function calculateAutoConfig(frequency: TradeFrequencyInfo): Partial<WalkForwardConfig>
⋮----
// Target: ~10-15 trades for in-sample, ~3-5 for out-of-sample
⋮----
// Calculate days needed to capture target trades
⋮----
// Apply reasonable bounds
// Minimum: 14 days IS, 7 days OOS (for high-frequency trading)
// Maximum: 180 days IS, 60 days OOS (for very low-frequency trading)
⋮----
// Step size: typically equal to OOS days for non-overlapping, or half for overlapping
⋮----
// Ensure we can create at least 3-4 windows with the available data
⋮----
// If we can't create enough windows, reduce window sizes proportionally
⋮----
// Calculate minimum trade thresholds based on frequency
// For low-frequency strategies, we need to be more lenient
⋮----
// High frequency: daily or more
⋮----
// Medium frequency: 2-3 per week
⋮----
// Low frequency: weekly
⋮----
// Very low frequency: bi-weekly or less
⋮----
interface WalkForwardPreset {
  label: string
  description: string
  config: Partial<Omit<WalkForwardConfig, 'parameterRanges'>>
  parameterRanges?: Partial<WalkForwardParameterRanges>
}
⋮----
interface WalkForwardStore {
  config: WalkForwardConfig
  isRunning: boolean
  progress: WalkForwardProgressEvent | null
  error: string | null
  results: WalkForwardAnalysis | null
  history: WalkForwardAnalysis[]
  presets: Record<WalkForwardPresetKey, WalkForwardPreset>
  tradeFrequency: TradeFrequencyInfo | null
  autoConfigApplied: boolean
  runAnalysis: (blockId: string) => Promise<void>
  cancelAnalysis: () => void
  loadHistory: (blockId: string) => Promise<void>
  updateConfig: (config: Partial<Omit<WalkForwardConfig, 'parameterRanges'>>) => void
  setParameterRange: (key: string, range: WalkForwardParameterRangeTuple) => void
  applyPreset: (preset: WalkForwardPresetKey) => void
  autoConfigureFromBlock: (blockId: string) => Promise<void>
  clearResults: () => void
  exportResultsAsJson: () => string | null
  exportResultsAsCsv: () => string | null
  selectAnalysis: (analysisId: string) => void
  deleteAnalysis: (analysisId: string) => Promise<void>
}
⋮----
function generateId(): string
⋮----
function buildCsvFromAnalysis(analysis: WalkForwardAnalysis | null): string | null
⋮----
const formatDate = (date: Date)
```

## File: app/(platform)/blocks/page.tsx
```typescript
import { BlockDialog } from "@/components/block-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBlockStore, type Block } from "@/lib/stores/block-store";
import { Activity, AlertTriangle, Calendar, ChevronDown, Download, Grid3X3, Info, List, Plus, Search, RotateCcw, Trash2 } from "lucide-react";
import React, { useCallback, useState } from "react";
import { ProgressDialog } from "@/components/progress-dialog";
import type { SnapshotProgress } from "@/lib/services/performance-snapshot";
import { waitForRender } from "@/lib/utils/async-helpers";
import { useProgressDialog } from "@/hooks/use-progress-dialog";
import { ImportGuideDialog } from "@/components/import-guide-dialog";
⋮----
const formatDate = (date: Date)
⋮----
const handleRecalculate = async () =>
⋮----
// Allow React to render the dialog before starting computation
⋮----
// If this block is active, also refresh the performance store
⋮----
{/* File Indicators */}
⋮----
{/* Date Range & Last Modified */}
⋮----
Data:
⋮----
<div>Updated:
⋮----
{/* Actions */}
⋮----
{/* Progress dialog for recalculation */}
⋮----
// Allow React to render the dialog before starting computation
⋮----
{/* Name and Description */}
⋮----
{/* File Indicators */}
⋮----
{/* Date Range & Last Modified */}
⋮----

⋮----
{/* Actions */}
⋮----
{/* Progress dialog for recalculation */}
⋮----
// Template with all standard fields (required + optional) - for complete closed trades
⋮----
// Template with only required fields - for open trades or minimal data
⋮----
// Template for daily log CSV
⋮----
// No need for useEffect here since AppSidebar handles loading
⋮----
// Filter blocks based on search query
⋮----
const handleNewBlock = () =>
⋮----
const handleEditBlock = (block: Block) =>
⋮----
const handleDownloadTemplate = (type: 'complete' | 'minimal' | 'daily-log') =>
⋮----
{/* Search and Controls */}
⋮----
<DropdownMenuItem onClick=
⋮----
{/* Blocks Grid */}
⋮----
onClick=
⋮----
// Reset state and retry
⋮----
{/* Loading skeleton */}
⋮----
{/* Confirmation dialog for clearing all data */}
```

## File: app/(platform)/performance-blocks/page.tsx
```typescript
import { useBlockStore } from "@/lib/stores/block-store";
import { usePerformanceStore } from "@/lib/stores/performance-store";
import { format } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  CalendarIcon,
  Gauge,
  Loader2,
  Proportions,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DateRange } from "react-day-picker";
⋮----
// Chart Components
import { DayOfWeekChart } from "@/components/performance-charts/day-of-week-chart";
import { DrawdownChart } from "@/components/performance-charts/drawdown-chart";
import { EquityCurveChart } from "@/components/performance-charts/equity-curve-chart";
import { ExitReasonChart } from "@/components/performance-charts/exit-reason-chart";
import { HoldingDurationChart } from "@/components/performance-charts/holding-duration-chart";
import { MarginUtilizationChart } from "@/components/performance-charts/margin-utilization-chart";
import { MarginUtilizationTable } from "@/components/performance-charts/margin-utilization-table";
// MFEMAEScatterChart now available via ReportBuilderTab presets
import { MonthlyReturnsChart } from "@/components/performance-charts/monthly-returns-chart";
import { GroupedLegOutcomesChart } from "@/components/performance-charts/paired-leg-outcomes-chart";
import { PremiumEfficiencyChart } from "@/components/performance-charts/premium-efficiency-chart";
import { ReturnDistributionChart } from "@/components/performance-charts/return-distribution-chart";
import { RiskEvolutionChart } from "@/components/performance-charts/risk-evolution-chart";
import { RollingMetricsChart } from "@/components/performance-charts/rolling-metrics-chart";
import { ROMTimelineChart } from "@/components/performance-charts/rom-timeline-chart";
import { TradeSequenceChart } from "@/components/performance-charts/trade-sequence-chart";
import { VixRegimeChart } from "@/components/performance-charts/vix-regime-chart";
import { WinLossStreaksChart } from "@/components/performance-charts/win-loss-streaks-chart";
import { ReportBuilderTab } from "@/components/report-builder";
⋮----
// UI Components
import { MultiSelect } from "@/components/multi-select";
import { NoActiveBlock } from "@/components/no-active-block";
import { PerformanceExportDialog } from "@/components/performance-export-dialog";
import { SizingModeToggle } from "@/components/sizing-mode-toggle";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
⋮----
// Block store
⋮----
// Performance store
⋮----
// Local state for date range picker
⋮----
// Handle date range changes
const handleDateRangeChange = (newDateRange: DateRange | undefined) =>
⋮----
// Initialize blocks if needed
⋮----
// Fetch performance data when active block changes
⋮----
// Helper functions
const getStrategyOptions = () =>
⋮----
// Show loading state
⋮----
// Show message if no active block
⋮----
// Show loading state for performance data
⋮----
// Show error state
⋮----
// Show empty state if no data
⋮----
{/* Controls */}
⋮----

⋮----
{/* Tabbed Interface */}
⋮----
{/* Tab 1: Overview */}
⋮----
{/* Tab 2: Returns Analysis */}
⋮----
{/* Tab 3: Risk & Margin */}
⋮----
{/* Tab 4: Trade Efficiency */}
⋮----
{/* Additional efficiency metrics can go here */}
⋮----
{/* Tab 5: Report Builder */}
```

## File: components/performance-charts/monthly-returns-chart.tsx
```typescript
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePerformanceStore } from "@/lib/stores/performance-store";
import type { Layout, PlotData } from "plotly.js";
import { useMemo, useState } from "react";
import { ChartWrapper, createBarChartLayout } from "./chart-wrapper";
⋮----
interface MonthlyReturnsChartProps {
  className?: string;
}
⋮----
type ViewMode = "dollars" | "percent";
type DisplayMode = "chronological" | "combined";
⋮----
interface BarTraceConfig {
  x: string[];
  y: number[];
  labels: string[];
  hoverFormat: string;
  customdata?: number[];
}
⋮----
function getBarColors(values: number[]): string[]
⋮----
function formatValueLabel(value: number, viewMode: ViewMode): string
⋮----
function createBarTrace(config: BarTraceConfig): Partial<PlotData>
⋮----
function createChartLayout(
  yAxisTitle: string,
  hasAngledLabels: boolean
): Partial<Layout>
⋮----
// Combined mode: aggregate all years for each month
⋮----
// Chronological mode: flatten the data for chronological bar chart
⋮----
// Only include months with non-zero values (matching legacy line 670)
⋮----
if (value) setDisplayMode(value as DisplayMode);
```

## File: components/report-builder/bucket-editor.tsx
```typescript
/**
 * Bucket Editor
 *
 * UI component for defining bucket thresholds for table output.
 * Uses a tag/chip interface where each threshold is a removable badge.
 */
⋮----
import { Label } from '@/components/ui/label'
import { NumericTagInput } from '@/components/ui/numeric-tag-input'
import { getDefaultBucketEdges } from '@/lib/calculations/table-aggregation'
⋮----
interface BucketEditorProps {
  field: string
  value: number[]
  onChange: (buckets: number[]) => void
  className?: string
}
⋮----
export function BucketEditor({
  field,
  value,
  onChange,
  className
}: BucketEditorProps)
⋮----
// Load defaults for current field
const handleLoadDefaults = () =>
```

## File: components/report-builder/custom-table.tsx
```typescript
/**
 * Custom Table
 *
 * Displays aggregated trade statistics in a table format,
 * bucketed by the X-axis field with user-defined thresholds.
 * Columns are dynamically rendered based on selection.
 */
⋮----
import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { EnrichedTrade } from '@/lib/models/enriched-trade'
import {
  ChartAxisConfig,
  getFieldInfo,
  getColumnLabel,
  getColumnUnit,
  DEFAULT_TABLE_COLUMNS
} from '@/lib/models/report-config'
import { buildTableRows, computeAggregation } from '@/lib/calculations/table-aggregation'
⋮----
interface CustomTableProps {
  trades: EnrichedTrade[]
  xAxis: ChartAxisConfig
  bucketEdges: number[]
  selectedColumns?: string[]
  className?: string
}
⋮----
/**
 * Format a number as currency
 */
function formatCurrency(value: number): string
⋮----
/**
 * Format a number as percentage
 */
function formatPercent(value: number): string
⋮----
/**
 * Format a number with appropriate precision
 */
function formatNumber(value: number): string
⋮----
/**
 * Format a value based on its unit
 */
function formatValue(value: number, unit?: string): string
⋮----
/**
 * Get CSS class for P&L value coloring (only for $ and % units)
 */
function getValueColorClass(value: number, unit?: string): string
⋮----
// Only color P&L and percentage values
⋮----
// Build table rows with selected columns
⋮----
// Get field info for header
⋮----
// Get column metadata
⋮----
// Calculate totals for each column
⋮----
// For count, sum up the bucket counts
⋮----
// For winRate, calculate from all trades
⋮----
// For averages, calculate from all trades
⋮----
// For sums, sum up the bucket sums
⋮----
// For min/max, skip in totals
⋮----
result[col.key] = NaN // Will display as '—'
```

## File: components/report-builder/histogram-chart.tsx
```typescript
/**
 * Histogram Chart
 *
 * Plotly histogram with What-If Filter Explorer for analyzing distributions
 * and exploring hypothetical filter thresholds.
 */
⋮----
import { useMemo, useState, useCallback } from "react";
import type { Layout, PlotData } from "plotly.js";
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { EnrichedTrade, getEnrichedTradeValue } from "@/lib/models/enriched-trade";
import { ChartAxisConfig, getFieldInfo, ThresholdMetric } from "@/lib/models/report-config";
import { WhatIfExplorer } from "./what-if-explorer";
⋮----
interface HistogramChartProps {
  trades: EnrichedTrade[];
  xAxis: ChartAxisConfig;
  metric?: ThresholdMetric;
  className?: string;
}
⋮----
// Use shared getEnrichedTradeValue from enriched-trade model
⋮----
// Track the selected range from What-If Explorer for visual highlighting
⋮----
// Extract values for histogram
⋮----
// If we have a selected range, create two traces: in-range and out-of-range
⋮----
// Determine bin size for consistent binning across both traces
⋮----
// Out-of-range bars (gray/faded)
⋮----
color: "rgba(148, 163, 184, 0.5)", // Gray/faded
⋮----
// In-range bars (blue/highlighted)
⋮----
color: "rgb(59, 130, 246)", // Blue
⋮----
// No range selection - single blue histogram
⋮----
barmode: "overlay", // Overlay the two histograms
⋮----
{/* What-If Filter Explorer */}
```

## File: components/report-builder/what-if-explorer.tsx
```typescript
/**
 * What-If Filter Explorer
 *
 * A shared component for exploring hypothetical filter ranges on trade data.
 * Used by threshold chart, histogram, and other single-axis analysis charts.
 *
 * Features:
 * - Dual-range slider for selecting X-axis value range
 * - Optimization strategies (maximize P/L, best avg with min % trades)
 * - Real-time stats: kept/excluded trades, avg metrics, total P/L
 */
⋮----
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { EnrichedTrade, getEnrichedTradeValue } from "@/lib/models/enriched-trade";
import { ThresholdMetric, getFieldInfo } from "@/lib/models/report-config";
import { ArrowUp, ArrowDown, Sparkles, ChevronDown, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
⋮----
type OptimizeStrategy = "maxTotalPl" | "bestAvgCustom" | "reset";
⋮----
interface TradeWithData {
  trade: EnrichedTrade;
  xValue: number;
  pl: number;
  plPct: number;
  rom: number;
}
⋮----
export interface WhatIfResults {
  rangeMin: number;
  rangeMax: number;
  totalTrades: number;
  keptTrades: number;
  excludedTrades: number;
  keptPct: number;
  allAvg: number;
  keptAvg: number;
  excludedAvg: number;
  improvement: number;
  allTotalPl: number;
  keptTotalPl: number;
  excludedTotalPl: number;
}
⋮----
interface WhatIfExplorerProps {
  trades: EnrichedTrade[];
  xAxisField: string;
  metric: ThresholdMetric; // 'pl', 'plPct', or 'rom'
  className?: string;
  /** Callback when range changes - can be used for chart highlighting */
  onRangeChange?: (min: number, max: number) => void;
}
⋮----
metric: ThresholdMetric; // 'pl', 'plPct', or 'rom'
⋮----
/** Callback when range changes - can be used for chart highlighting */
⋮----
export function WhatIfExplorer({
  trades,
  xAxisField,
  metric,
  className,
  onRangeChange,
}: WhatIfExplorerProps)
⋮----
// Build trade data with X values and metrics
⋮----
// Get min/max X values from the data
⋮----
// Range slider state
⋮----
// Minimum % of trades to keep for "Best Avg" optimization
⋮----
// Update range when data changes
⋮----
// Notify parent of range changes
⋮----
// Calculate what-if results based on current range
⋮----
// Get metric value for a trade
const getMetricValue = (t: TradeWithData) =>
⋮----
// Filter trades by range
⋮----
// Calculate metrics (averages based on selected metric)
⋮----
// Calculate total P/L $ amounts
⋮----
// Optimization function
⋮----
// Get metric value based on current selection
⋮----
// Helper to evaluate a range
const evaluateRange = (minX: number, maxX: number) =>
⋮----
// Try all combinations of start/end points from unique X values
// For performance, sample if there are too many unique values
⋮----
// Maximize total P/L, with slight penalty for excluding too many trades
⋮----
// Best average metric while keeping at least minKeptPct% of trades
⋮----
// Handle optimize button click
⋮----
// Get field info for display
⋮----
// Format metric value
const formatMetric = (v: number | null) =>
⋮----
{/* Range Slider with Optimize */}
⋮----
<DropdownMenuItem onClick=
⋮----
if (e.key === "Enter")
⋮----
onClick=
⋮----
onValueChange=
⋮----
{/* Results Grid */}
⋮----
{/* Filter info */}
⋮----
{/* Kept trades */}
⋮----
Avg
⋮----
{/* Excluded trades */}
⋮----
{/* Impact */}
⋮----
{/* Total P/L Summary */}
⋮----
{/* Summary */}
```

## File: components/tail-risk/tail-risk-summary-cards.tsx
```typescript
import { MetricCard } from "@/components/metric-card";
import { TailRiskAnalysisResult } from "@/lib/models/tail-risk";
⋮----
interface TailRiskSummaryCardsProps {
  result: TailRiskAnalysisResult;
}
⋮----
// Determine if values indicate good (positive) or bad (negative) risk
const isFactorGood = factorRatio >= 0.3; // More factors = better diversification
```

## File: components/trading-calendar/equity-curve-chart.tsx
```typescript
import { ChartWrapper, createLineChartLayout } from "@/components/performance-charts/chart-wrapper"
import { Badge } from "@/components/ui/badge"
import { Trade } from "@/lib/models/trade"
import { ReportingTrade } from "@/lib/models/reporting-trade"
import { useTradingCalendarStore, StrategyMatch, ScalingMode, CalendarViewMode } from "@/lib/stores/trading-calendar-store"
import type { Layout, PlotData } from "plotly.js"
import { useMemo } from "react"
⋮----
/**
 * Get the date range for the current calendar view
 */
function getViewDateRange(viewDate: Date, viewMode: CalendarViewMode):
⋮----
endDate: new Date(year, month + 1, 0, 23, 59, 59, 999) // End of last day of month
⋮----
// Week view - get Sunday to Saturday
⋮----
startDate.setDate(viewDate.getDate() - viewDate.getDay()) // Go to Sunday
⋮----
endDate.setDate(startDate.getDate() + 6) // Saturday
⋮----
/**
 * Format a date range for display
 */
function formatDateRange(startDate: Date, endDate: Date, viewMode: CalendarViewMode): string
⋮----
// Week view: show range
⋮----
interface EquityCurvePoint {
  date: string
  tradeNumber: number
  equity: number
}
⋮----
/**
 * Build a map of strategy -> first trade's contract count for scaling
 * Uses first trade's numContracts as "unit size" (not sum of all trades)
 */
function buildStrategyContractMap<T extends { strategy: string; numContracts: number }>(
  trades: T[]
): Map<string, number>
⋮----
// Only store the first trade's contract count per strategy (unit size)
⋮----
/**
 * Build equity curve from trades with proper scaling
 * Sorts by close date and calculates cumulative P&L
 *
 * @param trades The trades to process
 * @param scalingMode Current scaling mode
 * @param tradeType Whether these are backtest or actual trades
 * @param strategyMatches Strategy mappings for toReported scaling
 * @param actualContractMap Map of actual strategy -> contract count (for toReported backtest scaling)
 */
function buildEquityCurve(
  trades: (Trade | ReportingTrade)[],
  scalingMode: ScalingMode,
  tradeType: 'backtest' | 'actual',
  strategyMatches: StrategyMatch[],
  actualContractMap: Map<string, number>
): EquityCurvePoint[]
⋮----
// Build backtest -> actual strategy name mapping
⋮----
// Sort trades by close date (or open date if no close date)
⋮----
// Normalize to per-contract
⋮----
// Scale backtest DOWN to match actual contract counts
// Find the corresponding actual strategy
⋮----
// Scale factor = actualContracts / btContracts
⋮----
// If no match found, show raw value (unmatched strategy)
⋮----
// For 'actual' trades in toReported mode, no scaling needed - they stay as-is
⋮----
// Build equity curves filtered to current calendar view
⋮----
// Get the date range for the current calendar view
⋮----
// Filter trades to the current view period
const filterByDateRange = <T extends
⋮----
// Build contract count maps for scaling (from filtered trades)
⋮----
// All trades curves
⋮----
// Matched trades only curves
// Filter to only strategies that have a match
⋮----
// Build contract map from matched actual trades only
⋮----
// Don't show if no data at all
⋮----
// Select curves based on trade filter mode from store
⋮----
// Build traces
⋮----
color: "#3b82f6", // blue
⋮----
shape: "hv", // Step function
⋮----
color: "#a855f7", // purple (to match actual trades badge color in calendar)
⋮----
shape: "hv", // Step function
⋮----
// Calculate y-axis range
⋮----
// Calculate final difference for matched mode
⋮----
// Build scaling mode indicator
⋮----
// Build trade filter mode indicator
⋮----
// Build description
⋮----
// Format period for description
```

## File: lib/calculations/regime-comparison.ts
```typescript
/**
 * Regime Comparison Statistics
 *
 * Calculates comparison metrics between filtered and full trade samples.
 * Used to evaluate the performance impact of regime-based filters.
 */
⋮----
import { mean } from 'mathjs'
import { Trade } from '@/lib/models/trade'
import { RegimeDefinition } from '@/lib/models/regime'
import { groupTradesByBucket } from './regime-filter'
⋮----
/**
 * Statistics for comparing filtered vs full sample
 */
export interface RegimeComparisonStats {
  // Sample sizes
  filteredCount: number
  totalCount: number
  filteredPercent: number

  // Win rates
  filteredWinRate: number
  totalWinRate: number
  winRateDelta: number

  // Return on Margin
  filteredAvgRom: number
  totalAvgRom: number
  avgRomDelta: number

  // P&L metrics
  filteredTotalPl: number
  totalTotalPl: number
  filteredAvgPl: number
  totalAvgPl: number
  avgPlDelta: number

  // Profit factor
  filteredProfitFactor: number
  totalProfitFactor: number
  profitFactorDelta: number

  // Profit capture (if MFE data available)
  filteredAvgProfitCapture?: number
  totalAvgProfitCapture?: number
  profitCaptureDelta?: number

  // Risk metrics
  filteredMaxDrawdown?: number
  totalMaxDrawdown?: number
  filteredSharpeRatio?: number
  totalSharpeRatio?: number
}
⋮----
// Sample sizes
⋮----
// Win rates
⋮----
// Return on Margin
⋮----
// P&L metrics
⋮----
// Profit factor
⋮----
// Profit capture (if MFE data available)
⋮----
// Risk metrics
⋮----
/**
 * Statistics for a single bucket within a regime breakdown
 */
export interface BucketStats {
  bucketId: string
  bucketName: string
  color?: string
  tradeCount: number
  winCount: number
  lossCount: number
  winRate: number
  totalPl: number
  avgPl: number
  avgRom: number
  percentOfTrades: number
  percentOfPl: number
}
⋮----
/**
 * Full regime breakdown analysis
 */
export interface RegimeBreakdownStats {
  regimeId: string
  regimeName: string
  sourceField: string
  totalTrades: number
  totalPl: number
  bucketStats: BucketStats[]
  unmatchedCount: number
  unmatchedPl: number
}
⋮----
/**
 * Calculate Return on Margin values for trades
 */
function calculateRomValues(trades: Trade[]): number[]
⋮----
/**
 * Calculate profit factor (gross profit / gross loss)
 */
function calculateProfitFactor(trades: Trade[]): number
⋮----
/**
 * Calculate win rate as a percentage
 */
function calculateWinRate(trades: Trade[]): number
⋮----
/**
 * Calculate basic statistics for a set of trades
 */
function calculateTradeStats(trades: Trade[]):
⋮----
/**
 * Calculate comparison statistics between filtered and full trade samples
 *
 * @param filteredTrades - Trades matching the filter criteria
 * @param allTrades - Complete trade set
 * @returns Comparison statistics with deltas
 */
export function calculateRegimeComparison(
  filteredTrades: Trade[],
  allTrades: Trade[]
): RegimeComparisonStats
⋮----
// Sample sizes
⋮----
// Win rates
⋮----
// Return on Margin
⋮----
// P&L metrics
⋮----
// Profit factor
⋮----
/**
 * Calculate detailed breakdown statistics for a regime
 *
 * @param trades - All trades to analyze
 * @param regime - Regime definition with buckets
 * @returns Breakdown with stats per bucket
 */
export function calculateRegimeBreakdown(
  trades: Trade[],
  regime: RegimeDefinition
): RegimeBreakdownStats
⋮----
/**
 * Calculate multiple regime breakdowns at once
 */
export function calculateMultipleRegimeBreakdowns(
  trades: Trade[],
  regimes: RegimeDefinition[]
): RegimeBreakdownStats[]
⋮----
/**
 * Format comparison stat with delta indicator
 */
export function formatStatWithDelta(
  value: number,
  delta: number,
  format: 'percent' | 'currency' | 'decimal' = 'decimal',
  higherIsBetter: boolean = true
):
```

## File: lib/calculations/regime-filter.ts
```typescript
/**
 * Regime Filter Logic
 *
 * Filters trades by regime criteria with AND logic across multiple criteria.
 * Supports numeric thresholds, time of day, and day of week filtering.
 */
⋮----
import { Trade } from '@/lib/models/trade'
import {
  RegimeDefinition,
  RegimeBucket,
  NumericThresholdBucket,
  TimeOfDayBucket,
  DayOfWeekBucket,
  RegimeFilterConfig,
  RegimeFilterCriterion,
  RegimeSourceField
} from '@/lib/models/regime'
⋮----
/**
 * Derived fields that can be computed from a trade
 */
export interface DerivedTradeFields {
  durationHours?: number
  mfePercent?: number
  maePercent?: number
  profitCapturePercent?: number
  excursionRatio?: number
  dayOfWeek: number  // 0-6, Sunday-Saturday
  timeMinutes: number  // Minutes since midnight (0-1439)
}
⋮----
dayOfWeek: number  // 0-6, Sunday-Saturday
timeMinutes: number  // Minutes since midnight (0-1439)
⋮----
/**
 * Compute derived fields from a trade
 */
export function computeDerivedFields(trade: Trade): DerivedTradeFields
⋮----
// Parse time from HH:mm:ss format
⋮----
// Calculate duration if closed
⋮----
// Pull through MFE/MAE-derived fields when present (e.g., EnrichedTrade)
const maybeNumber = (val: unknown)
⋮----
/**
 * Get the value of a field from a trade for filtering
 */
export function getTradeFieldValue(
  trade: Trade,
  field: RegimeSourceField,
  derived: DerivedTradeFields
): number | undefined
⋮----
/**
 * Check if a value matches a numeric threshold bucket
 */
function matchesNumericBucket(value: number, bucket: NumericThresholdBucket): boolean
⋮----
// For buckets with both bounds, use >= min and < max
// For open-ended buckets, include the boundary
⋮----
// Open at bottom: value <= max
⋮----
// Open at top: value >= min
⋮----
// Bounded: min <= value < max (exclusive upper bound to avoid overlaps)
⋮----
/**
 * Check if a time value (minutes since midnight) matches a time of day bucket
 */
function matchesTimeOfDayBucket(timeMinutes: number, bucket: TimeOfDayBucket): boolean
⋮----
/**
 * Check if a day of week value matches a day of week bucket
 */
function matchesDayOfWeekBucket(dayOfWeek: number, bucket: DayOfWeekBucket): boolean
⋮----
/**
 * Check if a trade matches a specific bucket
 */
export function tradeMatchesBucket(
  trade: Trade,
  bucket: RegimeBucket,
  derived: DerivedTradeFields,
  sourceField: RegimeSourceField
): boolean
⋮----
/**
 * Assign a trade to the appropriate bucket within a regime
 * Returns the bucket ID or null if no match
 */
export function assignTradeToBucket(
  trade: Trade,
  regime: RegimeDefinition,
  derived?: DerivedTradeFields
): string | null
⋮----
/**
 * Check if a trade matches a filter criterion
 *
 * A trade matches if:
 * - The criterion is disabled (always matches)
 * - No specific buckets are selected (matches any bucket in the regime)
 * - The trade matches one of the selected buckets
 */
export function tradeMatchesCriterion(
  trade: Trade,
  criterion: RegimeFilterCriterion,
  regime: RegimeDefinition,
  derived?: DerivedTradeFields
): boolean
⋮----
// Disabled criteria always match
⋮----
// No specific buckets selected = any bucket matches
⋮----
// Trade matches if it falls into one of the selected buckets
⋮----
/**
 * Filter trades by regime criteria
 *
 * All enabled criteria are combined with AND logic:
 * - A trade must match ALL enabled criteria to be included
 * - If no criteria are enabled, all trades are returned
 *
 * @param trades - All trades to filter
 * @param config - Filter configuration with criteria
 * @param regimes - Map of regime ID to regime definition
 * @returns Trades that match ALL enabled criteria
 */
export function filterTradesByRegime(
  trades: Trade[],
  config: RegimeFilterConfig,
  regimes: Map<string, RegimeDefinition>
): Trade[]
⋮----
// No enabled filters = return all trades
⋮----
// ALL enabled criteria must match (AND logic)
⋮----
if (!regime) return true // Unknown regime = no filter
⋮----
/**
 * Result of filtering with additional metadata
 */
export interface FilterResult {
  filteredTrades: Trade[]
  excludedTrades: Trade[]
  matchCount: number
  totalCount: number
  matchPercent: number
}
⋮----
/**
 * Filter trades and return both matching and non-matching sets
 */
export function filterTradesWithResult(
  trades: Trade[],
  config: RegimeFilterConfig,
  regimes: Map<string, RegimeDefinition>
): FilterResult
⋮----
// No enabled filters = all trades match
⋮----
/**
 * Group trades by bucket within a regime
 * Returns a map of bucket ID to trades in that bucket
 */
export function groupTradesByBucket(
  trades: Trade[],
  regime: RegimeDefinition
): Map<string, Trade[]>
⋮----
// Initialize all buckets with empty arrays
⋮----
// Also track unmatched trades
⋮----
/**
 * Count trades per bucket within a regime
 * Useful for showing bucket counts in the filter UI
 */
export function countTradesPerBucket(
  trades: Trade[],
  regime: RegimeDefinition
): Map<string, number>
⋮----
// Initialize all buckets with zero
```

## File: lib/models/trade.ts
```typescript
/**
 * Trade model based on legacy Python Trade class
 * Represents individual trade record from portfolio CSV
 */
export interface Trade {
  // Core trade identification
  dateOpened: Date
  timeOpened: string // HH:mm:ss format
  openingPrice: number
  legs: string // Option legs description
  premium: number
  /**
   * Records how the premium value was encoded in the source CSV.
   * Some exports (OptionOmega) provide cents as whole numbers without decimals.
   */
  premiumPrecision?: 'dollars' | 'cents'

  // Closing information (optional for open trades)
  closingPrice?: number
  dateClosed?: Date
  timeClosed?: string
  avgClosingCost?: number
  reasonForClose?: string

  // Financial metrics
  pl: number // Profit/Loss
  numContracts: number
  fundsAtClose: number
  marginReq: number

  // Trade metadata
  strategy: string
  openingCommissionsFees: number
  closingCommissionsFees: number

  // Ratios and market data
  openingShortLongRatio: number
  closingShortLongRatio?: number
  openingVix?: number
  closingVix?: number

  // Additional metrics
  gap?: number
  movement?: number
  maxProfit?: number
  maxLoss?: number
  /**
   * Synthetic-only: ratio of the worst observed loss to account capital at the time
   * Used to scale synthetic losses relative to current account size
   */
  syntheticCapitalRatio?: number

  /**
   * Custom fields from extra columns in the trade CSV
   * Keys are the original column names, values are auto-detected as number or string
   */
  customFields?: Record<string, number | string>
}
⋮----
// Core trade identification
⋮----
timeOpened: string // HH:mm:ss format
⋮----
legs: string // Option legs description
⋮----
/**
   * Records how the premium value was encoded in the source CSV.
   * Some exports (OptionOmega) provide cents as whole numbers without decimals.
   */
⋮----
// Closing information (optional for open trades)
⋮----
// Financial metrics
pl: number // Profit/Loss
⋮----
// Trade metadata
⋮----
// Ratios and market data
⋮----
// Additional metrics
⋮----
/**
   * Synthetic-only: ratio of the worst observed loss to account capital at the time
   * Used to scale synthetic losses relative to current account size
   */
⋮----
/**
   * Custom fields from extra columns in the trade CSV
   * Keys are the original column names, values are auto-detected as number or string
   */
⋮----
/**
 * Raw trade data as it comes from CSV before processing
 */
export interface RawTradeData {
  "Date Opened": string
  "Time Opened": string
  "Opening Price": string
  "Legs": string
  "Premium": string
  "Closing Price"?: string
  "Date Closed"?: string
  "Time Closed"?: string
  "Avg. Closing Cost"?: string
  "Reason For Close"?: string
  "P/L": string
  "No. of Contracts": string
  "Funds at Close": string
  "Margin Req.": string
  "Strategy": string
  "Opening Commissions + Fees": string
  "Closing Commissions + Fees"?: string
  "Opening Short/Long Ratio": string
  "Closing Short/Long Ratio"?: string
  "Opening VIX"?: string
  "Closing VIX"?: string
  "Gap"?: string
  "Movement"?: string
  "Max Profit"?: string
  "Max Loss"?: string
}
⋮----
/**
 * Column mapping from CSV headers to Trade interface properties
 */
⋮----
/**
 * Column aliases for different CSV export variations
 */
⋮----
"P/L %": "P/L %", // Recognized but ignored (we calculate our own plPct)
⋮----
/**
 * Minimum required columns for a valid trade log
 */
```

## File: lib/models/validators.ts
```typescript
import { z } from 'zod'
⋮----
/**
 * Zod schema for validating raw trade data from CSV
 */
⋮----
}).passthrough() // Allow custom columns to pass through validation
⋮----
/**
 * Zod schema for validating processed trade data
 */
⋮----
/**
 * Zod schema for validating raw reporting trade data from strategy logs
 */
⋮----
/**
 * Zod schema for validating processed reporting trade data
 */
⋮----
/**
 * Zod schema for validating raw daily log data from CSV
 */
⋮----
}).passthrough() // Allow custom columns to pass through validation
⋮----
/**
 * Zod schema for validating processed daily log entry
 */
⋮----
drawdownPct: z.number().finite().max(0), // Drawdown should be negative or zero
⋮----
/**
 * Zod schema for portfolio statistics
 */
⋮----
/**
 * Zod schema for strategy statistics
 */
⋮----
/**
 * Zod schema for analysis configuration
 */
⋮----
/**
 * Zod schema for file validation
 */
⋮----
/**
 * Zod schema for block creation request
 */
⋮----
/**
 * Type exports for use with TypeScript
 */
export type RawTradeData = z.infer<typeof rawTradeDataSchema>
export type ValidatedTrade = z.infer<typeof tradeSchema>
export type RawReportingTradeData = z.infer<typeof rawReportingTradeDataSchema>
export type ValidatedReportingTrade = z.infer<typeof reportingTradeSchema>
export type RawDailyLogData = z.infer<typeof rawDailyLogDataSchema>
export type ValidatedDailyLogEntry = z.infer<typeof dailyLogEntrySchema>
export type ValidatedPortfolioStats = z.infer<typeof portfolioStatsSchema>
export type ValidatedStrategyStats = z.infer<typeof strategyStatsSchema>
export type ValidatedAnalysisConfig = z.infer<typeof analysisConfigSchema>
export type ValidatedFile = z.infer<typeof fileSchema>
export type ValidatedCreateBlockRequest = z.infer<typeof createBlockRequestSchema>
```

## File: lib/processing/reporting-trade-processor.ts
```typescript
/**
 * Reporting Trade Processor
 *
 * Parses the backtested strategy reporting CSV and converts it into
 * ReportingTrade objects ready for strategy alignment.
 */
⋮----
import { ReportingTrade, RawReportingTradeData, REQUIRED_REPORTING_TRADE_COLUMNS, REPORTING_TRADE_COLUMN_ALIASES } from '../models/reporting-trade'
import { CSVParser, ParseProgress } from './csv-parser'
import { findMissingHeaders, normalizeHeaders } from '../utils/csv-headers'
import { ProcessingError, ValidationError } from '../models'
import { rawReportingTradeDataSchema, reportingTradeSchema } from '../models/validators'
⋮----
export interface ReportingTradeProcessingConfig {
  maxRows?: number
  progressCallback?: (progress: ReportingTradeProcessingProgress) => void
}
⋮----
export interface ReportingTradeProcessingProgress extends ParseProgress {
  stage: 'reading' | 'parsing' | 'validating' | 'converting' | 'completed'
  validTrades: number
  invalidTrades: number
}
⋮----
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
⋮----
export class ReportingTradeProcessor
⋮----
constructor(config: ReportingTradeProcessingConfig =
⋮----
async processFile(file: File): Promise<ReportingTradeProcessingResult>
⋮----
private validateRawRow(row: Record<string, string>): RawReportingTradeData | null
⋮----
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
private parseDatePreservingCalendarDay(dateStr: string): Date
⋮----
// Create date at midnight local time - this preserves the calendar date
⋮----
// Fall back to default parsing for other formats
⋮----
/**
   * Parse a raw time string (e.g., "15:30:28.8096918") into a formatted time string (e.g., "3:30 PM")
   */
private parseTimeToFormatted(timeStr: string | undefined): string | undefined
⋮----
// Extract hours, minutes from format like "15:30:28.8096918"
⋮----
// Convert to 12-hour format
⋮----
private convertToReportingTrade(raw: RawReportingTradeData): ReportingTrade
```

## File: lib/processing/trade-processor.ts
```typescript
/**
 * Trade Processor
 *
 * Handles parsing and processing of trade log CSV files from OptionOmega.
 * Converts raw CSV data to validated Trade objects.
 */
⋮----
import { Trade, TRADE_COLUMN_ALIASES, REQUIRED_TRADE_COLUMNS, TRADE_COLUMN_MAPPING } from '../models/trade'
import { ValidationError, ProcessingError } from '../models'
import { rawTradeDataSchema, tradeSchema } from '../models/validators'
import { CSVParser, ParseProgress } from './csv-parser'
import { findMissingHeaders, normalizeHeaders } from '../utils/csv-headers'
⋮----
/**
 * Set of known trade column names (canonical names from TRADE_COLUMN_MAPPING)
 * Used to identify custom columns that should be preserved
 */
⋮----
/**
 * Trade processing configuration
 */
export interface TradeProcessingConfig {
  maxTrades?: number
  strictValidation?: boolean
  progressCallback?: (progress: TradeProcessingProgress) => void
}
⋮----
/**
 * Trade processing progress
 */
export interface TradeProcessingProgress extends ParseProgress {
  stage: 'reading' | 'parsing' | 'validating' | 'converting' | 'completed'
  validTrades: number
  invalidTrades: number
}
⋮----
/**
 * Trade processing result
 */
export interface TradeProcessingResult {
  trades: Trade[]
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
⋮----
/**
 * Trade processor class
 */
export class TradeProcessor
⋮----
constructor(config: TradeProcessingConfig =
⋮----
/**
   * Process trade log file
   */
async processFile(file: File): Promise<TradeProcessingResult>
⋮----
// Validate file
⋮----
// Configure CSV parser
⋮----
// Parse CSV with validation
⋮----
// Collect parsing errors
⋮----
// Check for required columns
⋮----
// Update progress for conversion stage
⋮----
// Convert validated data to Trade objects
⋮----
// Log conversion errors to console for debugging
⋮----
continue // Skip invalid row in non-strict mode
⋮----
throw error // Fail fast in strict mode
⋮----
// Update progress
⋮----
// Sort trades for consistent ordering (handles simultaneous trades)
⋮----
// Secondary sort by time
⋮----
// Tertiary sort by funds_at_close (lower first for simultaneous trades)
⋮----
// Calculate statistics
⋮----
// Final progress update
⋮----
/**
   * Validate raw trade data from CSV
   */
private validateRawTradeData(row: Record<string, string>, rowIndex: number): Record<string, string> | null
⋮----
// Apply column aliases to normalize variations
⋮----
// OptionOmega sometimes leaves strategy blank; default to Unknown so downstream stats still work
⋮----
// Ensure required columns have values
⋮----
// Set default values for missing optional fields
⋮----
// Basic format validation (detailed validation happens in conversion)
⋮----
// Log validation errors to console for debugging
⋮----
// Return null for invalid rows - they'll be counted as invalid
⋮----
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
private parseDatePreservingCalendarDay(dateStr: string): Date
⋮----
// Create date at midnight local time - this preserves the calendar date
⋮----
// Fall back to default parsing for other formats
⋮----
/**
   * Convert validated CSV row to Trade object
   */
private convertToTrade(rawData: Record<string, string>): Trade
⋮----
// Parse dates preserving calendar day
⋮----
// Normalize strategy name (handle empty strings)
⋮----
// Parse numeric values with error handling and NaN handling
const parseNumber = (value: string | undefined, fieldName: string, defaultValue?: number): number =>
⋮----
// Remove currency symbols and commas
⋮----
// Build trade object
⋮----
// Extract custom fields (columns not in KNOWN_TRADE_COLUMNS)
⋮----
// Auto-detect type: try to parse as number
⋮----
// Only add customFields if there are any
⋮----
// Final validation with Zod schema
⋮----
/**
   * Process CSV content directly (for testing)
   */
async processCSVContent(content: string): Promise<TradeProcessingResult>
⋮----
// Create a mock File object for testing
```

## File: lib/stores/block-store.ts
```typescript
import { create } from "zustand";
import { PortfolioStatsCalculator } from "../calculations/portfolio-stats";
import {
  deleteBlock as dbDeleteBlock,
  updateBlock as dbUpdateBlock,
  getAllBlocks,
  getBlock,
  getDailyLogsByBlock,
  getReportingTradesByBlock,
  updateBlockStats,
  storePerformanceSnapshotCache,
} from "../db";
import { buildPerformanceSnapshot, SnapshotProgress } from "../services/performance-snapshot";
import { ProcessedBlock } from "../models/block";
import { StrategyAlignment } from "../models/strategy-alignment";
⋮----
export interface Block {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  created: Date;
  lastModified: Date;
  tradeLog: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  dailyLog?: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  reportingLog?: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  stats: {
    totalPnL: number;
    winRate: number;
    totalTrades: number;
    avgWin: number;
    avgLoss: number;
  };
  strategyAlignment?: {
    mappings: StrategyAlignment[];
    updatedAt: Date;
  };
}
⋮----
interface BlockStore {
  // State
  blocks: Block[];
  activeBlockId: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  isStuck: boolean;
  error: string | null;

  // Actions
  loadBlocks: () => Promise<void>;
  setActiveBlock: (blockId: string) => void;
  clearActiveBlock: () => void;
  addBlock: (
    block: Omit<Block, "created"> | Omit<Block, "id" | "created">
  ) => Promise<void>;
  updateBlock: (id: string, updates: Partial<Block>) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  refreshBlock: (id: string) => Promise<void>;
  recalculateBlock: (
    id: string,
    onProgress?: (progress: SnapshotProgress) => void,
    signal?: AbortSignal
  ) => Promise<void>;
  clearAllData: () => Promise<void>;
}
⋮----
// State
⋮----
// Actions
⋮----
/**
 * Convert ProcessedBlock from DB to Block for UI
 */
function convertProcessedBlockToBlock(
  processedBlock: ProcessedBlock,
  tradeCount: number,
  dailyLogCount: number,
  reportingLogCount: number
): Block
⋮----
isActive: false, // Will be set by active block logic
⋮----
totalPnL: 0, // Will be calculated from trades
⋮----
// Timeout for detecting stuck loading state (30 seconds)
⋮----
// Initialize with empty state
⋮----
// Load blocks from IndexedDB
⋮----
// Prevent multiple concurrent loads
⋮----
// Create timeout for stuck detection
⋮----
// Main loading logic wrapped in a promise for racing
⋮----
// Restore active block ID from localStorage
⋮----
// Import getTradesByBlockWithOptions
⋮----
// Convert each ProcessedBlock to Block with trade/daily log counts
⋮----
// Use combineLegGroups setting from block config
⋮----
// Calculate stats from trades
⋮----
// Mark as active if this was the previously active block
⋮----
// Continue loading other blocks instead of failing completely
⋮----
// Set the active block ID if one was restored
⋮----
// Clear timeout on success to prevent unhandled rejection
⋮----
// Clear timeout to prevent duplicate errors
⋮----
// Check if this was a timeout
⋮----
// Actions
⋮----
// Save to localStorage for persistence
⋮----
// Remove from localStorage
⋮----
id: "id" in blockData ? blockData.id : crypto.randomUUID(), // Use provided ID or generate new one
⋮----
// Debug logging
⋮----
// Update state properly handling active block logic
⋮----
// If new block is active, deactivate all others and set new one as active
⋮----
// If new block is not active, just add it
⋮----
// If the new block is active, refresh it to load trades/daily logs
⋮----
// Use setTimeout to ensure the block is added to the state first
⋮----
// Update in IndexedDB
⋮----
// Add other updatable fields as needed
⋮----
// Update local state
⋮----
// Delete from IndexedDB
⋮----
// Update local state
⋮----
// If we deleted the active block, clear localStorage
⋮----
// If we deleted the active block, clear the active state
⋮----
// Use combineLegGroups setting from block config
⋮----
// Calculate fresh stats
⋮----
// Update in store
⋮----
// Get the block and its data
⋮----
// Use combineLegGroups setting from block config
⋮----
// Recalculate all stats using the current calculation engine
⋮----
// Update ProcessedBlock stats in database
⋮----
// Build and cache performance snapshot for instant page loads
⋮----
// Update lastModified timestamp
⋮----
// Calculate basic stats for the UI (Block interface)
⋮----
winRate: portfolioStats.winRate * 100, // Convert to percentage for Block interface
⋮----
// Create updated block for store
⋮----
// Update in store
⋮----
// Clear all data and reload (for recovery from corrupted state)
⋮----
// Helper to delete a database with timeout (won't hang on corruption)
const safeDeleteDb = (dbName: string, timeoutMs = 3000): Promise<void> =>
⋮----
req.onerror = () => { clearTimeout(timeout); resolve(); }; // Don't block on error
req.onblocked = () => { clearTimeout(timeout); resolve(); }; // Will complete after reload
⋮----
// Clear localStorage first (this is synchronous and always works)
⋮----
// Also clear sessionStorage
⋮----
// Delete the main TradeBlocksDB
⋮----
// Also delete the cache database if it exists
⋮----
// Force reload with cache bypass
⋮----
// Even if delete fails, reload anyway - the blocked deletion will
// complete once the page unloads and all connections are closed
```

## File: app/(platform)/tail-risk-analysis/page.tsx
```typescript
import { NoActiveBlock } from "@/components/no-active-block";
import { MarginalContributionChart } from "@/components/tail-risk/marginal-contribution-chart";
import { ScreePlotChart } from "@/components/tail-risk/scree-plot-chart";
import { TailDependenceHeatmap } from "@/components/tail-risk/tail-dependence-heatmap";
import { TailRiskSummaryCards } from "@/components/tail-risk/tail-risk-summary-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { performTailRiskAnalysis } from "@/lib/calculations/tail-risk-analysis";
import { getBlock, getTradesByBlockWithOptions } from "@/lib/db";
import {
  TailRiskAnalysisOptions,
  TailRiskAnalysisResult,
} from "@/lib/models/tail-risk";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";
import {
  downloadCsv,
  downloadJson,
  generateExportFilename,
  toCsvRow,
} from "@/lib/utils/export-helpers";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  CalendarIcon,
  ChevronDown,
  Download,
  HelpCircle,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
⋮----
// Analysis options
⋮----
// Load trades
⋮----
async function loadTrades()
⋮----
// Reset strategy filter when block changes
⋮----
// Get unique strategies from trades
⋮----
// Perform analysis
⋮----
// Export handlers
⋮----
// Convert matrices to labeled objects for readability
⋮----
// Convert eigenvalues to labeled array
⋮----
// Loading state
⋮----
// No block selected
⋮----
// No trades
⋮----
// Insufficient data warning
⋮----
{/* Info Banner */}
⋮----
{/* Controls */}
⋮----
{/* Row 1: Date Range, Strategies, Return Basis, Date Basis */}
⋮----
{/* Date Range */}
⋮----

⋮----
{/* Strategy Filter */}
⋮----
{/* Return Basis */}
⋮----
{/* Date Basis */}
⋮----
{/* Row 2: Tail Threshold, Variance Threshold */}
⋮----
{/* Tail Threshold */}
⋮----
setTailThreshold(val / 100);
setTailThresholdInput(String(val));
⋮----
if (e.key === "Enter")
⋮----
{/* Variance Threshold */}
⋮----
setVarianceThreshold(val / 100);
setVarianceThresholdInput(String(val));
⋮----
{/* Insufficient Data Warning */}
⋮----
{/* Insufficient Tail Observations Warning */}
⋮----
{/* Results */}
⋮----
{/* Summary Cards */}
⋮----
{/* Charts */}
⋮----
{/* Quick Insights */}
⋮----
// Interpretation Components
⋮----
// Determine overall assessment
⋮----
// Find strategies that provide diversification (low avg tail dependence)
```

## File: components/performance-charts/margin-utilization-table.tsx
```typescript
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePerformanceStore } from "@/lib/stores/performance-store";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Layout, PlotData } from "plotly.js";
import { useMemo, useState } from "react";
import { ChartWrapper } from "./chart-wrapper";
⋮----
type CapitalMode = "fixed" | "compounding";
⋮----
interface MarginUtilizationTableProps {
  className?: string;
}
⋮----
// Color gradient from green (low utilization) to red (high utilization)
function getBucketColor(index: number, total: number): string
⋮----
"#10b981", // emerald-500
"#34d399", // emerald-400
"#6ee7b7", // emerald-300
"#fcd34d", // amber-300
"#fbbf24", // amber-400
"#f59e0b", // amber-500
"#f97316", // orange-500
"#ef4444", // red-500
"#dc2626", // red-600
"#b91c1c", // red-700
⋮----
function getBucketLabel(
  utilizationPct: number,
  bucketSize: number,
  maxThreshold: number
): string
⋮----
interface ChartData {
  months: string[];
  monthLabels: string[];
  bucketLabels: string[];
  // bucketCounts[bucketIndex][monthIndex] = count of trades
  bucketCounts: number[][];
  // The actual bucket size used (may differ from input if capped)
  effectiveBucketSize: number;
}
⋮----
// bucketCounts[bucketIndex][monthIndex] = count of trades
⋮----
// The actual bucket size used (may differ from input if capped)
⋮----
interface BucketStats {
  label: string;
  color: string;
  tradeCount: number;
  percentOfTrades: number;
  avgPl: number;
  totalPl: number;
}
⋮----
function transformToChartData(
  marginUtilization: Array<{
    date: string;
    marginReq: number;
    fundsAtClose: number;
    numContracts: number;
    pl: number;
  }>,
  initialCapital: number,
  bucketSize: number,
  maxThreshold: number,
  capitalMode: CapitalMode
): ChartData
⋮----
// Group trades by month and bucket
⋮----
// Generate all bucket labels in order
⋮----
// Use fundsAtClose for compounding mode, initialCapital for fixed mode
⋮----
// Use sortable key for ordering
⋮----
// Format month labels like "May '22"
⋮----
// Build counts array: bucketCounts[bucketIndex][monthIndex]
⋮----
// Filter to only include buckets that have at least one trade
⋮----
function calculateBucketStats(
  marginUtilization: Array<{
    date: string;
    marginReq: number;
    fundsAtClose: number;
    numContracts: number;
    pl: number;
  }>,
  initialCapital: number,
  bucketSize: number,
  maxThreshold: number,
  capitalMode: CapitalMode
): BucketStats[]
⋮----
// Generate all bucket labels in order
⋮----
// Initialize bucket data
⋮----
// Use fundsAtClose for compounding mode, initialCapital for fixed mode
⋮----
// Build stats array
⋮----
// Create stacked area traces - one per bucket
⋮----
// Calculate bucket statistics for the summary table
⋮----
// Calculate totals for the summary table
⋮----
const handleBucketBlur = () =>
⋮----
const handleMaxBlur = () =>
⋮----
onValueChange=
⋮----
const formatCurrency = (value: number)
⋮----
const formatPercent = (value: number) => `$
⋮----
// Handle empty states
⋮----
className=
```

## File: components/performance-charts/vix-regime-chart.tsx
```typescript
import { useMemo, useState } from 'react'
import type { Layout, PlotData } from 'plotly.js'
import { ChartWrapper } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { NumericTagInput } from '@/components/ui/numeric-tag-input'
⋮----
/**
 * Default VIX regime thresholds
 */
⋮----
/**
 * Colors for regime buckets (from low to high volatility)
 */
⋮----
/**
 * Build bucket definitions from threshold values
 */
function buildBucketsFromThresholds(thresholds: number[])
⋮----
// First bucket: < first threshold
⋮----
// Middle buckets
⋮----
// Last bucket: >= last threshold
⋮----
interface VixRegimeChartProps {
  className?: string
}
⋮----
// Editable VIX thresholds
⋮----
// Build buckets from thresholds
⋮----
const bubbleSize = (pl: number) =>
⋮----
const buildTrace = (entries: typeof openingEntries, isOpening: boolean): Partial<PlotData> => (
⋮----
const buildSummary = (entries: typeof openingEntries, axisSuffix: '' | '2') =>
⋮----
// Use >= min and < max for all buckets except the last one which uses <= max
⋮----
const regimeShapes = (forOpening: boolean): Layout['shapes'] =>
⋮----
// Convert hex color to rgba with low opacity for background shading
const colorToRgba = (color: string | undefined, opacity: number): string =>
⋮----
// Parse hex color
⋮----
// Create title annotations for each subplot
⋮----
// Add a horizontal divider line between the two charts
⋮----
// Reset thresholds to defaults
const handleReset = () =>
⋮----
{/* Threshold Editor */}
⋮----
{/* Regime Statistics Tables */}
```

## File: components/report-builder/saved-reports-dropdown.tsx
```typescript
/**
 * Saved Reports Dropdown
 *
 * Dropdown to select and load saved report configurations.
 * Uses nested submenus to organize preset reports by category.
 */
⋮----
import { useEffect, useMemo } from 'react'
import {
  BarChart3,
  ChevronDown,
  LineChart,
  ScatterChart,
  SlidersHorizontal,
  Star,
  Table2,
  Trash2,
  TrendingUp
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useSettingsStore } from '@/lib/stores/settings-store'
import {
  ReportConfig,
  ReportCategory,
  ChartType,
  REPORT_CATEGORY_LABELS
} from '@/lib/models/report-config'
⋮----
// Map chart types to icons
⋮----
interface SavedReportsDropdownProps {
  onSelect: (report: ReportConfig) => void
}
⋮----
// Order for categories in the menu
⋮----
// Initialize store to load built-in reports
⋮----
// Group built-in reports by category
⋮----
const handleDelete = (e: React.MouseEvent, id: string) =>
⋮----
{/* Preset categories as submenus */}
```

## File: components/report-builder/what-if-explorer-2d.tsx
```typescript
/**
 * What-If Filter Explorer 2D
 *
 * A multi-dimensional What-If Explorer for scatter plots.
 * Allows filtering on X axis and one or more Y axes with rectangular region selection.
 *
 * Features:
 * - Range sliders for X axis and multiple Y axes
 * - Results grid showing in-range vs out-of-range stats
 * - Optimization strategies: per-axis, combined, and "optimize all Y axes"
 * - Detailed stats: count, avg metric, win rate, total P/L
 */
⋮----
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { EnrichedTrade, getEnrichedTradeValue } from "@/lib/models/enriched-trade";
import { ThresholdMetric, getFieldInfo } from "@/lib/models/report-config";
import { Sparkles, ChevronDown, RotateCcw, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
⋮----
type OptimizeStrategy = "maxTotalPl" | "bestAvgCustom" | "reset";
type OptimizeTarget = "x" | "y" | "all" | number; // number = specific Y axis index
⋮----
interface TradeWithData {
  trade: EnrichedTrade;
  xValue: number;
  yValues: number[]; // One value per Y axis
  pl: number;
  plPct: number;
  rom: number;
  isWinner: boolean;
}
⋮----
yValues: number[]; // One value per Y axis
⋮----
interface QuadrantStats {
  count: number;
  avgMetric: number;
  winRate: number;
  totalPl: number;
}
⋮----
export interface WhatIfResults2D {
  xRangeMin: number;
  xRangeMax: number;
  yRanges: Array<{ min: number; max: number }>;
  totalTrades: number;
  // Stats
  inRange: QuadrantStats;     // All criteria met (kept)
  outOfRange: QuadrantStats;  // At least one criterion not met
  // Summary
  keptPct: number;
  allAvg: number;
  allTotalPl: number;
  keptTotalPl: number;
  improvement: number;
}
⋮----
// Stats
inRange: QuadrantStats;     // All criteria met (kept)
outOfRange: QuadrantStats;  // At least one criterion not met
// Summary
⋮----
export interface YAxisConfig {
  field: string;
  label: string;
}
⋮----
/** Y-axis range with reference for Plotly shapes */
export interface YAxisRange {
  min: number;
  max: number;
  yref: string; // "y", "y2", or "y3"
}
⋮----
yref: string; // "y", "y2", or "y3"
⋮----
interface WhatIfExplorer2DProps {
  trades: EnrichedTrade[];
  xAxisField: string;
  /** Array of Y axis configurations - can be 1 to 3 Y axes */
  yAxes: YAxisConfig[];
  metric: ThresholdMetric; // 'pl', 'plPct', or 'rom'
  className?: string;
  /** Callback when range changes - for chart highlighting (all Y axes) */
  onRangeChange?: (xMin: number, xMax: number, yRanges: YAxisRange[]) => void;
}
⋮----
/** Array of Y axis configurations - can be 1 to 3 Y axes */
⋮----
metric: ThresholdMetric; // 'pl', 'plPct', or 'rom'
⋮----
/** Callback when range changes - for chart highlighting (all Y axes) */
⋮----
function calculateStats(
  trades: TradeWithData[],
  metric: ThresholdMetric
): QuadrantStats
⋮----
const getMetricValue = (t: TradeWithData) =>
⋮----
// Build trade data with X and Y values
⋮----
// Only include if X and ALL Y values are valid
⋮----
// Get min/max for X axis and each Y axis
⋮----
// Range slider state for X axis
⋮----
// Range slider state for each Y axis
⋮----
// Minimum % of trades to keep for "Best Avg" optimization
⋮----
// Update ranges when data or axes change
⋮----
// Notify parent of range changes (all Y axes for chart highlighting)
⋮----
// Build Y ranges with their Plotly axis references
⋮----
yref: index === 0 ? "y" : `y${index + 1}`, // "y", "y2", "y3"
⋮----
// Calculate what-if results based on current ranges
⋮----
// Classify trades: in range (all criteria met) vs out of range
⋮----
// Calculate stats
⋮----
// Overall stats
⋮----
// Optimization for a single axis
⋮----
axisIndex: number, // -1 for X, 0+ for Y axes
⋮----
// Sample if too many unique values
⋮----
// Get current ranges for OTHER axes (to constrain filtering)
⋮----
const evaluateRange = (min: number, max: number) =>
⋮----
// Check the axis being optimized
⋮----
// Check other axes with their current ranges
⋮----
// X must be in range
⋮----
// Other Y axes must be in range
⋮----
if (i === axisIndex) continue; // Skip the axis being optimized
⋮----
// If optimizing Y, X must also be in range
⋮----
// Optimization for all axes together using coordinate descent
// This is much more efficient than brute force - O(n * iterations) vs O(n^axes)
⋮----
// Sample unique values for each axis
const getSampledValues = (values: number[], maxSamples = 25) =>
⋮----
// Evaluate a complete set of ranges
const evaluateRanges = (
        xRange: [number, number],
        yRanges: Array<[number, number]>
) =>
⋮----
// Find best range for a single axis while holding others fixed
const optimizeAxis = (
        axisIndex: number, // -1 for X, 0+ for Y
        currentX: [number, number],
        currentYs: Array<[number, number]>
): [number, number] =>
⋮----
axisIndex: number, // -1 for X, 0+ for Y
⋮----
// Initialize with full ranges
⋮----
// Coordinate descent: optimize each axis in turn, repeat until convergence
const maxIterations = 3; // Usually converges in 2-3 iterations
⋮----
// Optimize X
⋮----
// Optimize each Y axis
⋮----
// Check for convergence
⋮----
if (currentScore <= prevScore) break; // No improvement, stop
⋮----
// Handle optimize button click
⋮----
// Get field info for display
⋮----
// Format metric value
const formatMetric = (v: number) =>
⋮----
// Format P/L value
const formatPl = (v: number) =>
⋮----
// Render optimization dropdown
const renderOptimizeDropdown = (target: OptimizeTarget, label: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
          <Sparkles className="h-3 w-3" />
          {label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => handleOptimize("maxTotalPl", target)}>
          Maximize Total P/L
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="text-xs text-muted-foreground mb-1.5">Best Avg (keep min % of trades)</div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={minKeptPctInput}
              onChange={(e) => setMinKeptPctInput(e.target.value)}
onBlur=
⋮----
<DropdownMenuItem onClick=
⋮----
if (e.key === "Enter")
⋮----
onClick=
⋮----
// Render stats cell
⋮----
{/* Header with global controls */}
⋮----
{/* Range Sliders */}
⋮----
{/* X-Axis Slider */}
⋮----
{/* Y-Axis Sliders */}
⋮----
// Color dots matching AXIS_COLORS in scatter-chart.tsx
⋮----
"rgb(59, 130, 246)",  // Blue (y1)
"rgb(249, 115, 22)", // Orange (y2)
"rgb(20, 184, 166)", // Teal (y3)
⋮----

⋮----
{/* Results Grid */}
⋮----
{/* Summary */}
⋮----
{/* Footer summary */}
```

## File: components/static-datasets/upload-dialog.tsx
```typescript
import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, AlertCircle, Loader2 } from "lucide-react"
import { CSVParser } from "@/lib/processing/csv-parser"
import { suggestDatasetName } from "@/lib/processing/static-dataset-processor"
import { useStaticDatasetsStore } from "@/lib/stores/static-datasets-store"
import type { ParseProgress } from "@/lib/processing/csv-parser"
⋮----
interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}
⋮----
// Validate file
⋮----
// Suggest name from filename
⋮----
const handleProgress = (progress: ParseProgress) =>
⋮----
// Reset and close
⋮----
{/* File Upload */}
⋮----
{/* Dataset Name */}
⋮----
{/* Upload Progress */}
⋮----
{/* Error */}
```

## File: components/tail-risk/tail-dependence-heatmap.tsx
```typescript
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { TailRiskAnalysisResult } from "@/lib/models/tail-risk";
import { truncateStrategyName } from "@/lib/utils";
import { useTheme } from "next-themes";
import type { Data, Layout } from "plotly.js";
import { useMemo } from "react";
⋮----
interface TailDependenceHeatmapProps {
  result: TailRiskAnalysisResult;
  actions?: React.ReactNode;
}
⋮----
// Truncate strategy names for axis labels
⋮----
// Symmetrize the matrix for display (average of both directions)
// NaN values indicate insufficient data for that pair
⋮----
// If either direction has insufficient data, mark the pair as NaN
⋮----
// Color scale: 0 (low joint tail risk) to 1 (high joint tail risk)
// Using a different scale than correlation since values are always positive
⋮----
[0, "#1e3a5f"], // Dark blue for low dependence
[0.25, "#2563eb"], // Blue
[0.5, "#fbbf24"], // Yellow/amber for medium
[0.75, "#f97316"], // Orange
[1, "#dc2626"], // Red for high dependence
⋮----
[0, "#dbeafe"], // Light blue for low dependence
[0.25, "#60a5fa"], // Blue
[0.5, "#fde68a"], // Yellow for medium
[0.75, "#fb923c"], // Orange
[1, "#b91c1c"], // Dark red for high dependence
⋮----
// For display, replace NaN with null so Plotly shows empty cells
// and prepare text labels
⋮----
// Grey text for N/A cells
⋮----
// Dynamic text color based on value and theme
⋮----
// Use full strategy names in hover tooltip
// Note: cells with null z-values (N/A) won't show hover, so single template works
```

## File: components/trading-calendar/day-view.tsx
```typescript
import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import { useTradingCalendarStore } from '@/lib/stores/trading-calendar-store'
import {
  formatCurrency,
  aggregateTradesByStrategy,
  scaleStrategyComparison
} from '@/lib/services/calendar-data'
import { cn } from '@/lib/utils'
⋮----
interface TradeCardProps {
  strategy: string
  backtestPl: number | null
  actualPl: number | null
  slippage: number | null
  slippagePercent: number | null
  isMatched: boolean
  reasonForClose?: string
  time?: string
  onClick: () => void
}
⋮----
{/* Strategy name row */}
⋮----
{/* P&L row - horizontal layout */}
⋮----
{/* Reason for close */}
⋮----
{/* Click indicator */}
⋮----
// Aggregate trades by strategy
⋮----
// Separate matched and unmatched
⋮----
{/* Matched strategies */}
⋮----
onClick=
⋮----
{/* Unmatched strategies - hidden when filter mode is 'matched' */}
```

## File: components/block-dialog.tsx
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { calculationOrchestrator } from "@/lib/calculations";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";
import {
  addDailyLogEntries,
  addReportingTrades,
  addTrades,
  createBlock,
  getBlock,
  deleteReportingTradesByBlock,
  updateDailyLogsForBlock,
  updateBlock as updateProcessedBlock,
  updateReportingTradesForBlock,
  updateTradesForBlock,
} from "@/lib/db";
import {
  storeCombinedTradesCache,
  deleteCombinedTradesCache,
} from "@/lib/db/combined-trades-cache";
import {
  storePerformanceSnapshotCache,
  deletePerformanceSnapshotCache,
} from "@/lib/db/performance-snapshot-cache";
import {
  storeEnrichedTradesCache,
  deleteEnrichedTradesCache,
} from "@/lib/db/enriched-trades-cache";
import { buildPerformanceSnapshot } from "@/lib/services/performance-snapshot";
import { enrichTrades } from "@/lib/calculations/enrich-trades";
import { combineAllLegGroupsAsync } from "@/lib/utils/combine-leg-groups";
import { REQUIRED_DAILY_LOG_COLUMNS } from "@/lib/models/daily-log";
import {
  REPORTING_TRADE_COLUMN_ALIASES,
  REQUIRED_REPORTING_TRADE_COLUMNS,
} from "@/lib/models/reporting-trade";
import type { StrategyAlignment } from "@/lib/models/strategy-alignment";
import {
  REQUIRED_TRADE_COLUMNS,
  TRADE_COLUMN_ALIASES,
  type Trade,
} from "@/lib/models/trade";
import {
  DailyLogProcessingProgress,
  DailyLogProcessingResult,
  DailyLogProcessor,
} from "@/lib/processing/daily-log-processor";
import {
  ReportingTradeProcessingProgress,
  ReportingTradeProcessingResult,
  ReportingTradeProcessor,
} from "@/lib/processing/reporting-trade-processor";
import {
  TradeProcessingProgress,
  TradeProcessingResult,
  TradeProcessor,
} from "@/lib/processing/trade-processor";
import { useBlockStore } from "@/lib/stores/block-store";
import { cn } from "@/lib/utils";
import {
  findMissingHeaders,
  normalizeHeaders,
  parseCsvLine,
} from "@/lib/utils/csv-headers";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle,
  Info,
  List,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ProgressDialog } from "@/components/progress-dialog";
import type { SnapshotProgress } from "@/lib/services/performance-snapshot";
import { waitForRender } from "@/lib/utils/async-helpers";
import { useProgressDialog } from "@/hooks/use-progress-dialog";
⋮----
interface Block {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  created: Date;
  lastModified: Date;
  tradeLog: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  dailyLog?: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  reportingLog?: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  stats: {
    totalPnL: number;
    winRate: number;
    totalTrades: number;
    avgWin: number;
    avgLoss: number;
  };
  strategyAlignment?: {
    mappings: StrategyAlignment[];
    updatedAt: Date;
  };
  tags?: string[];
  color?: string;
}
⋮----
interface FileUploadState {
  file: File | null;
  status:
    | "empty"
    | "dragover"
    | "uploaded"
    | "error"
    | "existing"
    | "processing";
  error?: string;
  existingFileName?: string;
  existingRowCount?: number;
  progress?: number;
  processedData?: {
    rowCount: number;
    dateRange?: { start: Date | null; end: Date | null };
    strategies?: string[];
    stats?: {
      processingTimeMs: number;
      strategies: string[];
      dateRange: { start: Date | null; end: Date | null };
      totalPL: number;
    };
  };
  requiresStrategyName?: boolean;
}
⋮----
type UploadType = "trade" | "daily" | "reporting";
⋮----
interface BlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "new" | "edit";
  block?: Block | null;
}
⋮----
type PreviewData = {
    trades?: TradeProcessingResult;
    dailyLogs?: DailyLogProcessingResult;
    reporting?: ReportingTradeProcessingResult;
    initialCapital?: number;
  };
⋮----
// Shared progress dialog controller (handles abort + clamped percent)
⋮----
interface ProcessFilesResult {
    preview: PreviewData;
    missingStrategies: number;
  }
⋮----
// Reset form when dialog opens/closes or mode changes
⋮----
// Reset when closing
⋮----
// Pre-populate for edit mode
⋮----
// Load combineLegGroups setting from ProcessedBlock
⋮----
// Reset for new mode
⋮----
// Clear preview data when a new trade file is selected
⋮----
// Validate file type
⋮----
// Clear preview data when a new trade file is selected
⋮----
// Reset the input value to allow re-selecting the same file
⋮----
// Reset the input value to allow re-selecting the same file
⋮----
const formatFileSize = (bytes: number) =>
⋮----
const processFiles = async (): Promise<ProcessFilesResult | null> =>
⋮----
// Process trade log
⋮----
// Process daily log if provided
⋮----
strategies: [], // Daily logs don't have strategies
⋮----
// Calculate initial capital
⋮----
// Calculate initial capital from trades only
⋮----
const handleSubmit = async () =>
⋮----
// Process files if new files were uploaded
⋮----
// Check if we need to process: either no preview exists OR the file changed
⋮----
if (!result) return; // Processing failed
⋮----
// In edit mode, process files if they were uploaded but not yet processed
⋮----
if (!result) return; // Processing failed
⋮----
// Create new block with processed data
⋮----
// Create block metadata
⋮----
// Save to IndexedDB
⋮----
// Add trades
⋮----
// Add daily log entries if present
⋮----
// Pre-calculate and cache performance snapshot for instant page loads
⋮----
// Show progress dialog BEFORE any heavy computation
setIsProcessing(false); // Hide old processing UI
⋮----
// Allow React to render the dialog before starting computation
⋮----
// If combining leg groups, do it with progress tracking
⋮----
// Scale combine progress to 0-30%
⋮----
// Build performance snapshot (30-95% if combining, 0-95% if not)
⋮----
// Store to cache (95-100%)
⋮----
// Pre-compute enriched trades for Report Builder
⋮----
// User cancelled - skip caching, save still succeeds
⋮----
setIsProcessing(true); // Restore for remaining operations
⋮----
// Calculate block stats for store
⋮----
// Add to Zustand store
⋮----
id: newBlock.id, // Use the actual ID from IndexedDB
⋮----
// Update existing block
⋮----
// Ensure we process the daily log if it was uploaded without running the full pipeline
⋮----
// Ensure we process the reporting log if it was uploaded without running the full pipeline
⋮----
// Get current block to check if combineLegGroups changed
⋮----
// Update analysisConfig if combineLegGroups changed
⋮----
// Clear cache since combining affects calculations
⋮----
// Handle combined trades cache based on new setting
⋮----
// Enabling: pre-calculate and cache combined trades
⋮----
// Show progress dialog BEFORE any heavy computation
setIsProcessing(false); // Hide old processing UI
⋮----
// Allow React to render the dialog before starting computation
⋮----
// Combine leg groups with progress (this was freezing UI before)
⋮----
// Scale combine progress to 0-30%
⋮----
// Build performance snapshot (30-95%)
⋮----
// Scale snapshot progress to 30-95%
⋮----
// Store to cache (95-100%)
⋮----
// Pre-compute enriched trades for Report Builder
⋮----
setIsProcessing(true); // Restore for remaining operations
⋮----
// Disabling: delete the cached combined trades
⋮----
// Rebuild performance snapshot with raw trades
⋮----
// Use progress dialog for pre-calculation
setIsProcessing(false); // Hide old processing UI
⋮----
// Allow React to render the dialog before starting computation
⋮----
// Scale to 0-95%
⋮----
// Store to cache (95-100%)
⋮----
// Pre-compute enriched trades for Report Builder
⋮----
setIsProcessing(true); // Restore for remaining operations
⋮----
// Track if we need to clear caches/comparison data
⋮----
// Update dateRange when trades are replaced
⋮----
// Save trades to IndexedDB (replace all existing trades)
⋮----
// Update combined trades cache if setting is enabled
⋮----
// Show progress dialog for combining (this can freeze UI with large files)
setIsProcessing(false); // Hide old processing UI
⋮----
setIsProcessing(true); // Restore for remaining operations
⋮----
// Ensure cache is cleared if trades were updated
⋮----
// Save daily log entries to IndexedDB (replace all existing entries)
⋮----
// User cleared the daily log
⋮----
// Clear calculation cache when any files are replaced or removed
⋮----
// Rebuild performance snapshot cache with updated data
// Skip if we already rebuilt due to combineLegGroups change
⋮----
// Use progress dialog for pre-calculation
setIsProcessing(false); // Hide old processing UI
⋮----
// Allow React to render the dialog before starting computation
⋮----
// Scale to 0-95%
⋮----
// Store to cache (95-100%)
⋮----
// Pre-compute enriched trades for Report Builder
⋮----
setIsProcessing(true); // Restore for remaining operations
⋮----
// No trades, delete the cache
⋮----
// Refresh the block to get updated stats from IndexedDB
⋮----
const handleDelete = async () =>
⋮----
// Delete from IndexedDB and update store
⋮----
// Close dialogs
⋮----
const getDialogTitle = ()
const getDialogDescription = ()
⋮----
const getSubmitButtonText = ()
const getSubmitButtonIcon = ()
⋮----
onDragLeave=
⋮----

⋮----
e.stopPropagation();
removeFile(type);
⋮----
{/* Block Details */}
⋮----
{/* File Uploads */}
⋮----
{/* Errors */}
⋮----
{/* Options */}
⋮----
setSetAsActive(checked === true)
⋮----
{/* Progress dialog for pre-calculation */}
```

## File: components/site-header.tsx
```typescript
import { usePathname } from "next/navigation";
import { useMemo } from "react";
⋮----
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
```

## File: lib/calculations/statistical-utils.ts
```typescript
/**
 * Statistical utility functions for copula analysis
 *
 * Provides:
 * - Normal CDF and quantile (inverse CDF) functions
 * - Probability Integral Transform (PIT) for copula estimation
 */
⋮----
/**
 * Error function approximation using Horner's method
 * Abramowitz and Stegun approximation 7.1.26
 * Maximum error: 1.5×10⁻⁷
 */
function erf(x: number): number
⋮----
/**
 * Standard normal cumulative distribution function (CDF)
 * Phi(x) = P(Z <= x) where Z ~ N(0,1)
 *
 * @param x - The value to evaluate
 * @returns Probability P(Z <= x) in range [0, 1]
 */
export function normalCDF(x: number): number
⋮----
/**
 * Standard normal quantile function (inverse CDF)
 * Returns x such that P(Z <= x) = p
 *
 * Uses the Beasley-Springer-Moro algorithm which provides
 * good accuracy across the full range (0, 1)
 *
 * @param p - Probability in range (0, 1)
 * @returns The quantile value x
 * @throws Error if p is not in (0, 1)
 */
export function normalQuantile(p: number): number
⋮----
// Coefficients for rational approximation
⋮----
// Boundary between central rational approximation and tail approximations
// This value optimizes accuracy across the full (0,1) range
⋮----
// Lower tail
⋮----
// Central region
⋮----
// Upper tail
⋮----
/**
 * Convert ranks to uniform [0, 1] using Hazen plotting position
 *
 * Uses (rank - 0.5) / n to avoid 0 and 1 which would cause
 * issues when transforming to normal quantiles
 *
 * @param ranks - Array of ranks (1-indexed)
 * @param n - Total number of observations
 * @returns Array of uniform values in (0, 1)
 */
export function ranksToUniform(ranks: number[], n: number): number[]
⋮----
/**
 * Convert array of values to ranks (handling ties with average rank)
 *
 * This is the canonical implementation used by correlation.ts,
 * reconciliation-stats.ts, and tail-risk-analysis.ts.
 *
 * @param values - Array of numeric values
 * @returns Array of ranks (1-indexed, ties get average rank)
 */
export function getRanks(values: number[]): number[]
⋮----
// Find all tied values
⋮----
// Assign average rank to all tied values
// For 0-indexed positions i through j-1, the 1-indexed ranks are (i+1) through j
// Average of consecutive integers (i+1) to j = (i+1 + j) / 2 = (i + j + 1) / 2
⋮----
/**
 * Apply Probability Integral Transform (PIT)
 *
 * Transforms arbitrary continuous data to standard normal distribution:
 * 1. Convert values to ranks
 * 2. Convert ranks to uniform [0, 1]
 * 3. Apply inverse normal CDF to get standard normal quantiles
 *
 * This is the key transformation for Gaussian copula estimation.
 * The resulting data has marginal N(0,1) distribution while preserving
 * the dependence structure.
 *
 * @param values - Array of numeric values
 * @returns Array of standard normal quantiles
 */
export function probabilityIntegralTransform(values: number[]): number[]
⋮----
// Single value maps to 0 (median of standard normal)
⋮----
/**
 * Compute Kendall's tau-b correlation coefficient between two arrays
 *
 * Kendall's tau is a rank-based correlation measure that is:
 * - More robust to outliers than Pearson correlation
 * - Based on concordant/discordant pairs rather than linear relationship
 * - Bounded in [-1, 1] like Pearson
 *
 * tau-b handles ties properly using the formula:
 * tau-b = (C - D) / sqrt((C + D + T_x) * (C + D + T_y))
 *
 * where C = concordant pairs, D = discordant pairs,
 * T_x = pairs tied only in x, T_y = pairs tied only in y
 *
 * @param x - First array
 * @param y - Second array
 * @returns Kendall's tau-b in [-1, 1], or 0 if inputs are invalid
 */
export function kendallTau(x: number[], y: number[]): number
⋮----
// Check for non-finite values
⋮----
// Compare all pairs
⋮----
// Tied in both - doesn't count
⋮----
// Tied only in x
⋮----
// Tied only in y
⋮----
// Concordant: same direction
⋮----
// Discordant: opposite direction
⋮----
// Guard against non-finite result
⋮----
/**
 * Convert Kendall's tau to Pearson correlation using the sin transformation
 *
 * This mapping preserves positive semi-definiteness of the correlation matrix,
 * which is essential for eigenvalue decomposition to produce valid results.
 *
 * The formula: r = sin(π * τ / 2)
 *
 * This is derived from the relationship between Kendall's tau and Pearson's r
 * for bivariate normal distributions.
 *
 * @param tau - Kendall's tau value in [-1, 1]
 * @returns Pearson-equivalent correlation in [-1, 1]
 */
export function kendallTauToPearson(tau: number): number
⋮----
/**
 * Compute Pearson correlation coefficient between two arrays
 *
 * @param x - First array
 * @param y - Second array
 * @returns Pearson correlation in [-1, 1], or 0 if inputs contain non-finite values
 */
export function pearsonCorrelation(x: number[], y: number[]): number
⋮----
// Guard against NaN/Infinity in inputs
⋮----
// Guard against non-finite result from numeric edge cases
```

## File: lib/calculations/threshold-analysis.ts
```typescript
/**
 * Threshold Analysis Calculations
 *
 * For any given field, calculates running cumulative statistics to help
 * identify optimal filter thresholds. Shows what happens if you filter
 * trades above or below each value.
 *
 * Outputs 4 series:
 * 1. Cumulative % of trades at or below X
 * 2. Cumulative % of total P/L from trades at or below X
 * 3. Average P/L (or ROM) for trades ABOVE X threshold
 * 4. Average P/L (or ROM) for trades BELOW X threshold
 */
⋮----
import { EnrichedTrade, getEnrichedTradeValue } from '@/lib/models/enriched-trade'
⋮----
/**
 * A single data point in the threshold analysis
 */
export interface ThresholdDataPoint {
  xValue: number                    // The threshold value (e.g., SLR = 0.5)
  cumulativeTradesPct: number       // % of total trades at or below this X
  cumulativePlPct: number           // % of total P/L from trades at or below this X
  avgPlAbove: number | null         // Avg P/L for trades > X (null if no trades)
  avgPlBelow: number | null         // Avg P/L for trades <= X (null if no trades)
  avgPlPctAbove: number | null      // Avg P/L % (P/L/premium*100) for trades > X
  avgPlPctBelow: number | null      // Avg P/L % (P/L/premium*100) for trades <= X
  avgRomAbove: number | null        // Avg ROM for trades > X (null if no trades)
  avgRomBelow: number | null        // Avg ROM for trades <= X (null if no trades)
  tradesAbove: number               // Count of trades > X
  tradesBelow: number               // Count of trades <= X
}
⋮----
xValue: number                    // The threshold value (e.g., SLR = 0.5)
cumulativeTradesPct: number       // % of total trades at or below this X
cumulativePlPct: number           // % of total P/L from trades at or below this X
avgPlAbove: number | null         // Avg P/L for trades > X (null if no trades)
avgPlBelow: number | null         // Avg P/L for trades <= X (null if no trades)
avgPlPctAbove: number | null      // Avg P/L % (P/L/premium*100) for trades > X
avgPlPctBelow: number | null      // Avg P/L % (P/L/premium*100) for trades <= X
avgRomAbove: number | null        // Avg ROM for trades > X (null if no trades)
avgRomBelow: number | null        // Avg ROM for trades <= X (null if no trades)
tradesAbove: number               // Count of trades > X
tradesBelow: number               // Count of trades <= X
⋮----
/**
 * Full result of threshold analysis
 */
export interface ThresholdAnalysisResult {
  field: string                     // The field being analyzed
  dataPoints: ThresholdDataPoint[]  // Sorted by xValue ascending
  totalTrades: number
  totalPl: number
}
⋮----
field: string                     // The field being analyzed
dataPoints: ThresholdDataPoint[]  // Sorted by xValue ascending
⋮----
// Use shared getEnrichedTradeValue from enriched-trade model
⋮----
/**
 * Calculate threshold analysis for a given field
 *
 * @param trades - Array of enriched trades
 * @param xField - Field to analyze (e.g., 'openingShortLongRatio', 'openingVix')
 * @param binCount - Number of unique X values to sample (default 50 for smooth curves)
 * @returns ThresholdAnalysisResult with data points for charting
 */
export function calculateThresholdAnalysis(
  trades: EnrichedTrade[],
  xField: string,
  binCount: number = 50
): ThresholdAnalysisResult
⋮----
// Extract valid X values and sort trades by X
⋮----
// Sort by X value
⋮----
// Calculate totals
⋮----
// Get unique X values to sample
// If fewer unique values than binCount, use all unique values
⋮----
// Sample evenly across the range
⋮----
// Dedupe in case of rounding
⋮----
// Calculate statistics for each threshold
⋮----
// Split trades by threshold
⋮----
// Cumulative percentages (trades at or below threshold)
⋮----
// Handle case where total P/L is 0 or negative
⋮----
// Average P/L above/below threshold
⋮----
// Average P/L % (premium efficiency) above/below threshold
⋮----
// Average ROM above/below threshold
⋮----
/**
 * Result of finding the optimal threshold
 */
export interface OptimalThresholdResult {
  threshold: number              // The X value with the largest gap
  gap: number                    // The difference (above - below)
  avgAbove: number | null        // Avg metric for trades > threshold
  avgBelow: number | null        // Avg metric for trades <= threshold
  tradesAbove: number
  tradesBelow: number
  recommendation: 'above' | 'below' | 'neutral'  // Which side performs better
}
⋮----
threshold: number              // The X value with the largest gap
gap: number                    // The difference (above - below)
avgAbove: number | null        // Avg metric for trades > threshold
avgBelow: number | null        // Avg metric for trades <= threshold
⋮----
recommendation: 'above' | 'below' | 'neutral'  // Which side performs better
⋮----
/**
 * Find the optimal threshold - the point where the gap between
 * above vs below average metrics is largest
 *
 * @param analysis - The threshold analysis result
 * @param metric - Which metric to use: 'pl', 'plPct', or 'rom'
 * @param minTradesPct - Minimum % of trades required on each side (default 10%)
 * @returns The optimal threshold info, or null if not enough data
 */
export function findOptimalThreshold(
  analysis: ThresholdAnalysisResult,
  metric: 'pl' | 'plPct' | 'rom' = 'plPct',
  minTradesPct: number = 10
): OptimalThresholdResult | null
⋮----
// Get the right metric values based on selection
const getAbove = (d: ThresholdDataPoint) =>
const getBelow = (d: ThresholdDataPoint) =>
⋮----
// Ensure minimum trades on each side
⋮----
// Calculate absolute gap (we want the largest difference either direction)
```

## File: lib/db/static-datasets-store.ts
```typescript
/**
 * Static Datasets Store - CRUD operations for static dataset metadata
 */
⋮----
import type { StaticDataset, MatchStrategy } from '../models/static-dataset'
import { STORES, withReadTransaction, withWriteTransaction, promisifyRequest } from './index'
⋮----
/**
 * Create a new static dataset
 */
export async function createStaticDataset(dataset: StaticDataset): Promise<void>
⋮----
/**
 * Get a static dataset by ID
 */
export async function getStaticDataset(id: string): Promise<StaticDataset | null>
⋮----
/**
 * Get a static dataset by name
 */
export async function getStaticDatasetByName(name: string): Promise<StaticDataset | null>
⋮----
/**
 * Get all static datasets
 */
export async function getAllStaticDatasets(): Promise<StaticDataset[]>
⋮----
// Sort by upload date (newest first)
⋮----
/**
 * Update a static dataset's match strategy
 */
export async function updateStaticDatasetMatchStrategy(
  id: string,
  matchStrategy: MatchStrategy
): Promise<void>
⋮----
/**
 * Update a static dataset's name
 */
export async function updateStaticDatasetName(id: string, name: string): Promise<void>
⋮----
/**
 * Delete a static dataset by ID
 * Note: This only deletes the metadata. Use deleteStaticDatasetWithRows for full deletion.
 */
export async function deleteStaticDataset(id: string): Promise<void>
⋮----
/**
 * Check if a dataset name is already in use
 */
export async function isDatasetNameTaken(name: string, excludeId?: string): Promise<boolean>
⋮----
/**
 * Get total count of static datasets
 */
export async function getStaticDatasetCount(): Promise<number>
```

## File: lib/models/tail-risk.ts
```typescript
/**
 * Type definitions for Tail Risk Analysis
 *
 * Gaussian copula-based analysis to measure tail dependence between strategies -
 * how likely they are to have extreme losses together, even if their day-to-day
 * correlation is low.
 */
⋮----
import { CorrelationDateBasis, CorrelationNormalization } from "../calculations/correlation";
⋮----
/**
 * Options for tail risk analysis
 */
export interface TailRiskAnalysisOptions {
  /**
   * Percentile threshold for defining "tail" events
   * Default: 0.10 (10th percentile = worst 10% of days)
   */
  tailThreshold?: number;

  /**
   * Minimum number of shared trading days required
   * Default: 30
   */
  minTradingDays?: number;

  /**
   * How to normalize returns for comparison
   * - raw: Absolute dollar P/L
   * - margin: P/L / margin requirement
   * - notional: P/L / (price × contracts)
   */
  normalization?: CorrelationNormalization;

  /**
   * Which date to use for grouping trades
   * - opened: Trade entry date
   * - closed: Trade exit date
   */
  dateBasis?: CorrelationDateBasis;

  /**
   * Filter trades by underlying ticker symbol
   * If provided, only include trades where the ticker matches
   */
  tickerFilter?: string;

  /**
   * Filter to specific strategies
   * If provided, only include these strategies in analysis
   */
  strategyFilter?: string[];

  /**
   * Filter trades to a specific date range
   * Uses the dateBasis field to determine which date to compare
   */
  dateRange?: {
    from?: Date;
    to?: Date;
  };

  /**
   * Variance threshold for determining effective factors
   * Default: 0.80 (80% of variance explained)
   * Range: 0.5 to 0.99
   */
  varianceThreshold?: number;
}
⋮----
/**
   * Percentile threshold for defining "tail" events
   * Default: 0.10 (10th percentile = worst 10% of days)
   */
⋮----
/**
   * Minimum number of shared trading days required
   * Default: 30
   */
⋮----
/**
   * How to normalize returns for comparison
   * - raw: Absolute dollar P/L
   * - margin: P/L / margin requirement
   * - notional: P/L / (price × contracts)
   */
⋮----
/**
   * Which date to use for grouping trades
   * - opened: Trade entry date
   * - closed: Trade exit date
   */
⋮----
/**
   * Filter trades by underlying ticker symbol
   * If provided, only include trades where the ticker matches
   */
⋮----
/**
   * Filter to specific strategies
   * If provided, only include these strategies in analysis
   */
⋮----
/**
   * Filter trades to a specific date range
   * Uses the dateBasis field to determine which date to compare
   */
⋮----
/**
   * Variance threshold for determining effective factors
   * Default: 0.80 (80% of variance explained)
   * Range: 0.5 to 0.99
   */
⋮----
/**
 * Marginal contribution of a strategy to portfolio tail risk
 */
export interface MarginalContribution {
  /** Strategy name */
  strategy: string;

  /**
   * Percentage reduction in portfolio tail risk if this strategy is removed
   * Higher values = strategy contributes more to tail risk
   */
  tailRiskContribution: number;

  /**
   * How much this strategy loads on the first principal factor
   * Range [0, 1] - higher values indicate the strategy is more aligned
   * with the primary source of portfolio tail risk
   */
  concentrationScore: number;

  /**
   * Average tail dependence with other strategies
   */
  avgTailDependence: number;
}
⋮----
/** Strategy name */
⋮----
/**
   * Percentage reduction in portfolio tail risk if this strategy is removed
   * Higher values = strategy contributes more to tail risk
   */
⋮----
/**
   * How much this strategy loads on the first principal factor
   * Range [0, 1] - higher values indicate the strategy is more aligned
   * with the primary source of portfolio tail risk
   */
⋮----
/**
   * Average tail dependence with other strategies
   */
⋮----
/**
 * Analytics derived from the joint tail risk matrix
 */
export interface TailRiskAnalytics {
  /**
   * Strategy pair with highest joint tail risk
   */
  highestJointTailRisk: {
    value: number;
    pair: [string, string];
  };

  /**
   * Strategy pair with lowest joint tail risk
   */
  lowestJointTailRisk: {
    value: number;
    pair: [string, string];
  };

  /**
   * Average joint tail risk across all strategy pairs
   */
  averageJointTailRisk: number;

  /**
   * Percentage of pairs with joint tail risk > 0.5
   * Indicates how much of the portfolio has high tail risk concentration
   */
  highRiskPairsPct: number;
}
⋮----
/**
   * Strategy pair with highest joint tail risk
   */
⋮----
/**
   * Strategy pair with lowest joint tail risk
   */
⋮----
/**
   * Average joint tail risk across all strategy pairs
   */
⋮----
/**
   * Percentage of pairs with joint tail risk > 0.5
   * Indicates how much of the portfolio has high tail risk concentration
   */
⋮----
/**
 * Complete result of tail risk analysis
 */
export interface TailRiskAnalysisResult {
  // Input metadata
  /** List of strategies included in analysis (sorted) */
  strategies: string[];

  /** Number of shared trading days used for analysis */
  tradingDaysUsed: number;

  /** Date range of the analysis */
  dateRange: {
    start: Date;
    end: Date;
  };

  /** Tail threshold used (e.g., 0.10 for 10th percentile) */
  tailThreshold: number;

  /** Variance threshold used for effective factors (e.g., 0.80 for 80%) */
  varianceThreshold: number;

  // Core results
  /**
   * Copula correlation matrix (Kendall's tau mapped to Pearson via sin transform)
   * This captures the dependence structure after removing marginal effects
   * Uses rank-based correlation for robustness and guaranteed PSD matrix
   * Size: strategies.length × strategies.length
   */
  copulaCorrelationMatrix: number[][];

  /**
   * Joint tail risk matrix (empirical tail co-probability)
   * Entry [i][j] = P(strategy j in tail | strategy i in tail)
   * Range [0, 1] for each entry, NaN if insufficient data
   * Size: strategies.length × strategies.length
   */
  jointTailRiskMatrix: number[][];

  /**
   * Number of strategy pairs with insufficient tail observations
   * These pairs have NaN in jointTailRiskMatrix
   */
  insufficientDataPairs: number;

  // Factor analysis
  /**
   * Eigenvalues of the copula correlation matrix (sorted descending)
   * Sum equals number of strategies (trace of correlation matrix)
   */
  eigenvalues: number[];

  /**
   * Eigenvectors corresponding to eigenvalues
   * Each row is an eigenvector
   */
  eigenvectors: number[][];

  /**
   * Cumulative proportion of variance explained
   * Entry i = sum of first (i+1) eigenvalues / total
   * Range [0, 1]
   */
  explainedVariance: number[];

  /**
   * Number of factors needed to explain 80% of variance
   * Interpretation: "You have N strategies but really K independent risk factors"
   */
  effectiveFactors: number;

  // Derived analytics
  /** Quick analytics from the tail dependence matrix */
  analytics: TailRiskAnalytics;

  /** Marginal contribution of each strategy to tail risk */
  marginalContributions: MarginalContribution[];

  // Computation metadata
  /** When the analysis was computed */
  computedAt: Date;

  /** Time taken to compute (milliseconds) */
  computationTimeMs: number;
}
⋮----
// Input metadata
/** List of strategies included in analysis (sorted) */
⋮----
/** Number of shared trading days used for analysis */
⋮----
/** Date range of the analysis */
⋮----
/** Tail threshold used (e.g., 0.10 for 10th percentile) */
⋮----
/** Variance threshold used for effective factors (e.g., 0.80 for 80%) */
⋮----
// Core results
/**
   * Copula correlation matrix (Kendall's tau mapped to Pearson via sin transform)
   * This captures the dependence structure after removing marginal effects
   * Uses rank-based correlation for robustness and guaranteed PSD matrix
   * Size: strategies.length × strategies.length
   */
⋮----
/**
   * Joint tail risk matrix (empirical tail co-probability)
   * Entry [i][j] = P(strategy j in tail | strategy i in tail)
   * Range [0, 1] for each entry, NaN if insufficient data
   * Size: strategies.length × strategies.length
   */
⋮----
/**
   * Number of strategy pairs with insufficient tail observations
   * These pairs have NaN in jointTailRiskMatrix
   */
⋮----
// Factor analysis
/**
   * Eigenvalues of the copula correlation matrix (sorted descending)
   * Sum equals number of strategies (trace of correlation matrix)
   */
⋮----
/**
   * Eigenvectors corresponding to eigenvalues
   * Each row is an eigenvector
   */
⋮----
/**
   * Cumulative proportion of variance explained
   * Entry i = sum of first (i+1) eigenvalues / total
   * Range [0, 1]
   */
⋮----
/**
   * Number of factors needed to explain 80% of variance
   * Interpretation: "You have N strategies but really K independent risk factors"
   */
⋮----
// Derived analytics
/** Quick analytics from the tail dependence matrix */
⋮----
/** Marginal contribution of each strategy to tail risk */
⋮----
// Computation metadata
/** When the analysis was computed */
⋮----
/** Time taken to compute (milliseconds) */
⋮----
/**
 * Intermediate data structure for aligned strategy returns
 */
export interface AlignedStrategyReturns {
  /** Strategy names (sorted) */
  strategies: string[];

  /** Sorted array of date keys (YYYY-MM-DD format) */
  dates: string[];

  /**
   * Returns matrix: strategies.length × dates.length
   * Entry [i][j] = return of strategy i on date j
   */
  returns: number[][];

  /**
   * Trading mask: strategies.length × dates.length
   * Entry [i][j] = true if strategy i actually traded on date j
   * (vs zero-padded for alignment)
   */
  tradedMask: boolean[][];
}
⋮----
/** Strategy names (sorted) */
⋮----
/** Sorted array of date keys (YYYY-MM-DD format) */
⋮----
/**
   * Returns matrix: strategies.length × dates.length
   * Entry [i][j] = return of strategy i on date j
   */
⋮----
/**
   * Trading mask: strategies.length × dates.length
   * Entry [i][j] = true if strategy i actually traded on date j
   * (vs zero-padded for alignment)
   */
```

## File: lib/services/performance-snapshot.ts
```typescript
import { Trade } from '@/lib/models/trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { PortfolioStats } from '@/lib/models/portfolio-stats'
import { PortfolioStatsCalculator } from '@/lib/calculations/portfolio-stats'
import {
  calculatePremiumEfficiencyPercent,
  computeTotalPremium,
  EfficiencyBasis
} from '@/lib/metrics/trade-efficiency'
import {
  calculateMFEMAEDataAsync,
  calculateMFEMAEStats,
  createExcursionDistributionAsync,
  type MFEMAEDataPoint,
  type MFEMAEStats,
  type DistributionBucket,
  type NormalizationBasis
} from '@/lib/calculations/mfe-mae'
import { normalizeTradesToOneLot } from '@/lib/utils/trade-normalization'
import { yieldToMain, checkCancelled } from '@/lib/utils/async-helpers'
⋮----
export interface SnapshotDateRange {
  from?: Date
  to?: Date
}
⋮----
export interface SnapshotFilters {
  dateRange?: SnapshotDateRange
  strategies?: string[]
}
⋮----
export interface SnapshotProgress {
  step: string
  percent: number
}
⋮----
interface SnapshotOptions {
  trades: Trade[]
  dailyLogs?: DailyLogEntry[]
  filters?: SnapshotFilters
  riskFreeRate?: number
  normalizeTo1Lot?: boolean
  onProgress?: (progress: SnapshotProgress) => void
  signal?: AbortSignal
}
⋮----
export interface SnapshotChartData {
  equityCurve: Array<{ date: string; equity: number; highWaterMark: number; tradeNumber: number }>
  drawdownData: Array<{ date: string; drawdownPct: number }>
  dayOfWeekData: Array<{ day: string; count: number; avgPl: number; avgPlPercent: number }>
  returnDistribution: number[]
  /**
   * Per-trade inputs for ROM histogram; keeps margin context for exports/LLMs
   */
  returnDistributionDetails?: Array<{
    tradeNumber: number
    date: string
    pl: number
    marginReq: number
    strategy?: string
    rom: number
  }>
  streakData: {
    winDistribution: Record<number, number>
    lossDistribution: Record<number, number>
    statistics: {
      maxWinStreak: number
      maxLossStreak: number
      avgWinStreak: number
      avgLossStreak: number
    }
  }
  monthlyReturns: Record<number, Record<number, number>>
  monthlyReturnsPercent: Record<number, Record<number, number>>
  tradeSequence: Array<{ tradeNumber: number; pl: number; rom: number; date: string; marginReq?: number }>
  romTimeline: Array<{ date: string; rom: number }>
  rollingMetrics: Array<{ date: string; winRate: number; sharpeRatio: number; profitFactor: number; volatility: number }>
  volatilityRegimes: Array<{ date: string; openingVix?: number; closingVix?: number; pl: number; rom?: number }>
  premiumEfficiency: Array<{
    tradeNumber: number
    date: string
    pl: number
    premium?: number
    avgClosingCost?: number
    maxProfit?: number
    maxLoss?: number
    totalCommissions?: number
    efficiencyPct?: number
    efficiencyDenominator?: number
    efficiencyBasis?: EfficiencyBasis
    totalPremium?: number
  }>
  marginUtilization: Array<{ date: string; marginReq: number; fundsAtClose: number; numContracts: number; pl: number }>
  exitReasonBreakdown: Array<{ reason: string; count: number; avgPl: number; totalPl: number }>
  holdingPeriods: Array<{ tradeNumber: number; dateOpened: string; dateClosed?: string; durationHours: number; pl: number; strategy: string }>
  mfeMaeData: MFEMAEDataPoint[]
  mfeMaeStats: Partial<Record<NormalizationBasis, MFEMAEStats>>
  mfeMaeDistribution: DistributionBucket[]
}
⋮----
/**
   * Per-trade inputs for ROM histogram; keeps margin context for exports/LLMs
   */
⋮----
export interface PerformanceSnapshot {
  filteredTrades: Trade[]
  filteredDailyLogs: DailyLogEntry[]
  portfolioStats: PortfolioStats
  chartData: SnapshotChartData
}
⋮----
export async function buildPerformanceSnapshot(options: SnapshotOptions): Promise<PerformanceSnapshot>
⋮----
// Check for cancellation at start
⋮----
// When filtering by strategy or normalizing, the `fundsAtClose` values from individual trades
// represent the entire account balance and include performance from trades outside the current filter.
// To avoid this data leakage, we rebuild the equity curve using cumulative P&L calculations instead of the absolute `fundsAtClose` values.
⋮----
// Yield after copying large arrays
⋮----
// Note: We intentionally keep filteredDailyLogs available here (not setting to undefined).
// While equity curve calculations use useFundsAtClose=false when strategies are filtered
// (to avoid data leakage from other strategies' fundsAtClose values), we still need
// daily logs for:
// 1. Custom field joining during trade enrichment (e.g., daily.vixOpen)
// 2. Monthly returns % calculations (which have appropriate fallbacks)
// The useFundsAtClose flag (line 123) already handles the equity curve concern.
⋮----
// Yield after heavy portfolio stats calculation
⋮----
export async function processChartData(
  trades: Trade[],
  dailyLogs?: DailyLogEntry[],
  options?: {
    useFundsAtClose?: boolean
    onProgress?: (progress: SnapshotProgress) => void
    signal?: AbortSignal
  }
): Promise<SnapshotChartData>
⋮----
// Yield after equity curve (can be heavy with many trades/logs)
⋮----
// Yield after day of week
⋮----
// Yield after streak data
⋮----
// Yield after monthly returns
⋮----
// Yield after monthly returns percent
⋮----
// Yield after trade sequence
⋮----
// Rolling metrics is O(n * windowSize) - most expensive calculation
⋮----
// Yield after volatility regimes
⋮----
// Yield after premium efficiency
⋮----
// Yield after margin utilization
⋮----
// Yield after exit reason breakdown
⋮----
// Yield after holding periods
⋮----
// MFE/MAE excursion analysis (async to yield during processing)
⋮----
// Yield after MFE/MAE stats
⋮----
// Yield after distributions to let UI paint before returning large object
⋮----
function buildEquityAndDrawdown(
  trades: Trade[],
  dailyLogs?: DailyLogEntry[],
  useFundsAtClose = true
)
⋮----
// When we shouldn't trust account-level equity (e.g., strategy filters or normalization),
// skip daily logs and rebuild from trade P&L instead of leaking other strategies.
⋮----
function calculateDailyDrawdownFromEquityCurve(
  equityCurve: SnapshotChartData['equityCurve']
): SnapshotChartData['drawdownData']
⋮----
// Collapse multiple trades on the same calendar day into a single end-of-day point
⋮----
// Seed the high water mark from the initial curve point so day-one drops are preserved
⋮----
const dayKey = point.date.slice(0, 10) // YYYY-MM-DD
⋮----
// Overwrite with the latest equity for that day (end-of-day)
⋮----
function buildEquityAndDrawdownFromDailyLogs(
  trades: Trade[],
  dailyLogs: DailyLogEntry[]
)
⋮----
function getEquityValueFromDailyLog(entry: DailyLogEntry): number
⋮----
function calculateEquityCurveFromTrades(trades: Trade[], useFundsAtClose: boolean)
⋮----
function calculateDayOfWeekData(trades: Trade[])
⋮----
// Calculate percentage return (ROM) if margin is available
⋮----
function calculateStreakData(trades: Trade[])
⋮----
function calculateMonthlyReturns(trades: Trade[])
⋮----
function calculateMonthlyReturnsPercent(
  trades: Trade[],
  dailyLogs?: DailyLogEntry[]
): Record<number, Record<number, number>>
⋮----
// If daily logs are available, use them for accurate balance tracking
⋮----
// Fallback to trade-based calculation
⋮----
function calculateMonthlyReturnsPercentFromDailyLogs(
  trades: Trade[],
  dailyLogs: DailyLogEntry[]
): Record<number, Record<number, number>>
⋮----
// Pre-compute trade-based percents for fallback months without balance data
⋮----
// Group trades by month to get P&L per month
⋮----
// Get starting balance for each month from daily logs
⋮----
// Calculate percentage returns
⋮----
// Calculate percentage: (monthPL / startingBalance) * 100
⋮----
// Fill in zeros for months without data
⋮----
function calculateMonthlyReturnsPercentFromTrades(
  trades: Trade[]
): Record<number, Record<number, number>>
⋮----
// Sort trades by date
⋮----
// Calculate initial capital
⋮----
// Group trades by month
⋮----
// Calculate percentage returns and update running capital
⋮----
// Update capital for next month (compounding)
⋮----
// Update startingCapital for any remaining trades in future months
⋮----
// Fill in zeros for months without data
⋮----
async function calculateRollingMetrics(trades: Trade[], signal?: AbortSignal)
⋮----
// Use sliding window approach to avoid repeated array operations
// Pre-extract P&L values for faster access
⋮----
// Initialize window state
⋮----
// Initialize first window
⋮----
// Process each position using sliding window
⋮----
// Yield every 100 iterations to keep UI responsive
⋮----
// Calculate metrics for current window
⋮----
// Calculate variance (need to iterate for this, but only over window)
⋮----
// Slide window to the next position (skip on final iteration—there is no next window to build)
⋮----
// Remove old value
⋮----
// Add new value
⋮----
function getFiniteNumber(value: unknown): number | undefined
⋮----
function calculateVolatilityRegimes(trades: Trade[])
⋮----
function calculatePremiumEfficiency(trades: Trade[])
⋮----
function calculateMarginUtilization(trades: Trade[])
⋮----
function calculateExitReasonBreakdown(trades: Trade[])
⋮----
function calculateHoldingPeriods(trades: Trade[])
```

## File: lib/utils/combine-leg-groups.ts
```typescript
/**
 * Leg Group Combining Utility
 *
 * For MEIC (Multiple Entry Iron Condor) and similar strategies where the backtester
 * creates separate trade records for each leg group (e.g., calls and puts) that were
 * opened simultaneously but may have different exit conditions/times.
 *
 * This utility groups trades by entry timestamp and combines them into single trade records.
 */
⋮----
import { Trade } from '../models/trade'
import { ReportingTrade } from '../models/reporting-trade'
import { yieldToMain, checkCancelled } from './async-helpers'
⋮----
/**
 * Key used to group trades that were opened at the same time
 */
export interface TradeGroupKey {
  dateOpened: string // ISO date string
  timeOpened: string
  strategy: string
}
⋮----
dateOpened: string // ISO date string
⋮----
/**
 * Result of combining multiple leg groups into a single trade
 */
export interface CombinedTrade extends Trade {
  originalTradeCount: number // Number of trades that were combined
  combinedLegs: string[] // Array of leg strings from each trade
}
⋮----
originalTradeCount: number // Number of trades that were combined
combinedLegs: string[] // Array of leg strings from each trade
⋮----
/**
 * Result of combining multiple ReportingTrade leg groups into a single trade
 */
export interface CombinedReportingTrade extends ReportingTrade {
  originalTradeCount: number // Number of trades that were combined
  combinedLegs: string[] // Array of leg strings from each trade
}
⋮----
originalTradeCount: number // Number of trades that were combined
combinedLegs: string[] // Array of leg strings from each trade
⋮----
/**
 * Type guard to check if a Trade is a CombinedTrade
 */
export function isCombinedTrade(trade: Trade): trade is CombinedTrade
⋮----
/**
 * Type guard to check if a ReportingTrade is a CombinedReportingTrade
 */
export function isCombinedReportingTrade(trade: ReportingTrade): trade is CombinedReportingTrade
⋮----
/**
 * Generate a unique key for grouping trades by entry timestamp
 */
function generateGroupKey(trade: Trade): string
⋮----
/**
 * Parse a group key back into its components
 * (Not currently used but kept for future API compatibility)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseGroupKey(key: string): TradeGroupKey
⋮----
/**
 * Group trades by their entry timestamp (date + time + strategy)
 * Returns a map where the key is the group identifier and value is array of trades
 */
export function groupTradesByEntry(trades: Trade[]): Map<string, Trade[]>
⋮----
/**
 * Combine a group of trades that were opened at the same time into a single trade record
 *
 * Rules for combining:
 * - Opening fields: Use first trade's values (they should be identical)
 * - Closing fields: Use the last closing time among all trades
 * - Premium: Sum of all premiums
 * - P/L: Sum of all P/Ls
 * - Commissions: Sum of all commissions
 * - Margin: Use the maximum margin requirement
 * - Contracts: Sum of all contracts
 * - Legs: Concatenate all leg descriptions
 * - Closing price: Use weighted average based on premiums
 * - Funds at close: Use final funds from last closed trade
 */
export function combineLegGroup(trades: Trade[]): CombinedTrade
⋮----
// Sort trades by closing time (or use original order if not closed)
⋮----
// Secondary sort by time if dates are equal
⋮----
// Use first trade as template (opening info should be identical)
⋮----
// Aggregate numeric values
⋮----
// Use the contract size of the first leg to represent the "Strategy Unit Size"
// e.g. A 10-lot Iron Condor has 4 legs of 10 contracts.
// We want the combined trade to say "10 contracts" (10 ICs), not 40.
⋮----
// For margin:
// - Debit trades (totalPremium < 0): Sum margin (e.g. Straddle = Call + Put cost)
// - Credit trades (totalPremium >= 0): Max margin (e.g. Iron Condor = Max(Call side, Put side))
⋮----
// Calculate weighted average closing price
⋮----
// Calculate total closing cost if all trades have it recorded
⋮----
// Combine leg descriptions
⋮----
// Use last trade's closing information (latest exit)
⋮----
// Calculate combined opening short/long ratio (weighted by premium)
⋮----
// For optional fields, use first trade's value or undefined
⋮----
// Max profit/loss handling:
// - For single trades (originalTradeCount === 1): preserve original percentage values from CSV
// - For combined trades (originalTradeCount > 1): derive dollar amounts from margin
⋮----
// Single trade: preserve original values (percentages from CSV)
⋮----
// Combined trades: sum maxProfit, use margin for maxLoss
⋮----
// Use margin requirement as ground truth for worst-case loss
⋮----
// Fallback: For debit trades, the max loss is at least the premium paid
⋮----
// Opening information (from first trade)
⋮----
// Closing information (from last closed trade)
⋮----
// Aggregated values
⋮----
// Strategy and ratios
⋮----
// Optional market data
⋮----
// Combined trade metadata
⋮----
export interface CombineLegGroupsProgress {
  step: string
  percent: number
}
⋮----
export interface CombineLegGroupsOptions {
  onProgress?: (progress: CombineLegGroupsProgress) => void
  signal?: AbortSignal
}
⋮----
/**
 * Process all trades and combine leg groups that share the same entry timestamp
 *
 * @param trades - Array of trades to process
 * @returns Array of trades with leg groups combined (single trades are preserved as-is)
 */
export function combineAllLegGroups(trades: Trade[]): CombinedTrade[]
⋮----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
⋮----
// Sort by date/time to maintain chronological order
⋮----
/**
 * Async version of combineAllLegGroups with progress reporting and cancellation support
 * Use this for large datasets to keep UI responsive
 *
 * @param trades - Array of trades to process
 * @param options - Progress callback and abort signal
 * @returns Array of trades with leg groups combined
 */
export async function combineAllLegGroupsAsync(
  trades: Trade[],
  options?: CombineLegGroupsOptions
): Promise<CombinedTrade[]>
⋮----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
⋮----
// Yield every 100 groups to keep UI responsive
⋮----
// Sort by date/time to maintain chronological order
⋮----
/**
 * Identify which trades would be affected by combining leg groups
 * Useful for showing users what will change before they enable the feature
 *
 * @returns Object with statistics about grouping
 */
export function analyzeLegGroups(trades: Trade[]):
⋮----
groupSizeDistribution: Record<number, number> // size -> count
⋮----
// =============================================================================
// ReportingTrade Combining Functions
// =============================================================================
⋮----
/**
 * Generate a unique key for grouping ReportingTrades by entry timestamp
 */
function generateReportingGroupKey(trade: ReportingTrade): string
⋮----
/**
 * Group ReportingTrades by their entry timestamp (date + time + strategy)
 * Returns a map where the key is the group identifier and value is array of trades
 */
export function groupReportingTradesByEntry(trades: ReportingTrade[]): Map<string, ReportingTrade[]>
⋮----
/**
 * Combine a group of ReportingTrades that were opened at the same time into a single trade record
 *
 * Rules for combining (simpler than Trade - fewer fields):
 * - Opening fields: Use first trade's values (should be identical)
 * - Closing fields: Use the last closing time among all trades
 * - Premium: Sum of all initial premiums
 * - P/L: Sum of all P/Ls
 * - Contracts: Use first trade's contract count (strategy unit size)
 * - Legs: Concatenate all leg descriptions
 */
export function combineReportingLegGroup(trades: ReportingTrade[]): CombinedReportingTrade
⋮----
// Sort trades by closing time
⋮----
// Aggregate numeric values
⋮----
const totalContracts = firstTrade.numContracts // Strategy unit size
⋮----
// Combine leg descriptions
⋮----
// Calculate total closing cost if all trades have it
⋮----
// Weighted average closing price
⋮----
/**
 * Process all ReportingTrades and combine leg groups that share the same entry timestamp
 *
 * @param trades - Array of ReportingTrades to process
 * @returns Array of trades with leg groups combined
 */
export function combineAllReportingLegGroups(trades: ReportingTrade[]): CombinedReportingTrade[]
⋮----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
⋮----
// Sort chronologically
```

## File: app/(platform)/trading-calendar/page.tsx
```typescript
import { NoActiveBlock } from "@/components/no-active-block";
import { CalendarNavigation } from "@/components/trading-calendar/calendar-navigation";
import { CalendarView } from "@/components/trading-calendar/calendar-view";
import { DayView } from "@/components/trading-calendar/day-view";
import { EquityCurveChart } from "@/components/trading-calendar/equity-curve-chart";
import { MatchStrategiesDialog } from "@/components/trading-calendar/match-strategies-dialog";
import { StatsHeader } from "@/components/trading-calendar/stats-header";
import { TradeDetailView } from "@/components/trading-calendar/trade-detail-view";
import { Card, CardContent } from "@/components/ui/card";
import { useBlockStore } from "@/lib/stores/block-store";
import { useTradingCalendarStore, NavigationView } from "@/lib/stores/trading-calendar-store";
import { Loader2 } from "lucide-react";
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
⋮----
// Wrapper component to handle Suspense boundary for useSearchParams
export default function TradingCalendarPage()
⋮----
// Track whether we're updating from URL (to prevent sync loop)
⋮----
// Sync URL to store on initial load and URL changes
⋮----
// Set flag to prevent store->URL sync from firing
⋮----
// No view param means calendar view
⋮----
// Mark initial URL as applied after first render
⋮----
// Reset flag after a tick to allow future store changes to sync to URL
⋮----
// Sync store state to URL when navigation changes
⋮----
// Don't sync if we're currently updating from URL (prevents loop)
⋮----
// Only update if URL actually changed
⋮----
// Update URL when store state changes (but not on initial load)
⋮----
// Load calendar data when active block changes
⋮----
// No active block state
⋮----
// Loading state
⋮----
// Error state
⋮----
{/* Stats header with metrics */}
⋮----
{/* Calendar card with navigation and content */}
⋮----
{/* Navigation controls - date range, back button, view options */}
⋮----
{/* Main content area - switches based on navigation state */}
⋮----
{/* Equity curve comparison chart - only show in calendar view when both data types exist */}
⋮----
{/* Strategy matching dialog */}
```

## File: components/trading-calendar/calendar-navigation.tsx
```typescript
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CalendarViewMode,
  DataDisplayMode,
  DateDisplayMode,
  useTradingCalendarStore,
} from "@/lib/stores/trading-calendar-store";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
⋮----
// Check if viewing a specific day
⋮----
// Navigation handlers
const navigatePrev = () =>
⋮----
const navigateNext = () =>
⋮----
const goToToday = () =>
⋮----
// Format view date label
⋮----
// Parse YYYY-MM-DD to local Date (avoids UTC timezone shift)
const parseDateKey = (dateKey: string): Date =>
⋮----
// Format Date to YYYY-MM-DD in local timezone
const formatDateKey = (date: Date): string =>
⋮----
// Parse selected date for day navigation (local timezone)
⋮----
// Format selected date for day view display
⋮----
// Day navigation handlers
const navigatePrevDay = () =>
⋮----
const navigateNextDay = () =>
⋮----
// Handle date selection from calendar picker in day view
const handleDaySelect = (date: Date | undefined) =>
⋮----
{/* Date Navigation - takes up ~2 columns worth of space */}
⋮----
{/* Day Picker Popover */}
⋮----
{/* Month Picker Popover */}
⋮----
{/* Back button when viewing day or trade - placed after date for layout stability */}
⋮----
{/* Spacer to push controls to the right */}
⋮----
{/* View Mode Toggle - hide when viewing day */}
⋮----
{/* Show Margin Toggle (only when backtest trades exist since margin only comes from backtest) */}
⋮----
{/* Date Display Mode - hide when viewing trade detail */}
⋮----
{/* Data Display Mode Toggle (only shown when both data sources exist) - hide when viewing trade detail */}
```

## File: components/trading-calendar/stats-header.tsx
```typescript
import { MetricCard } from "@/components/metric-card";
import { MetricSection } from "@/components/metric-section";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  aggregateTradesByStrategy,
  calculateDayMetrics,
  formatPercent,
  scaleStrategyComparison,
} from "@/lib/services/calendar-data";
import {
  ScalingMode,
  TradeFilterMode,
  useTradingCalendarStore,
} from "@/lib/stores/trading-calendar-store";
import { AlertTriangle, BarChart3, HelpCircle, TrendingUp } from "lucide-react";
import { useMemo } from "react";
⋮----
interface StatsHeaderProps {
  onMatchStrategiesClick?: () => void;
}
⋮----
// Check if viewing a specific day
⋮----
// Calculate day-specific stats when viewing a day
⋮----
// Filter comparisons based on trade filter mode
⋮----
// Count winning strategies based on which data is available
⋮----
// Calculate filtered trade counts
⋮----
// Determine if we have data after filtering
⋮----
// Calculate day-specific performance metrics
⋮----
// Day-specific metrics
⋮----
// Get P/L positive flag
const isPositive = (value: number)
⋮----
// Build actions for Performance section header
⋮----
{/* Scaling Mode Toggle */}
⋮----
onValueChange=
⋮----
{/* Trade Filter Toggle */}
⋮----
{/* Unmatched strategies warning */}
⋮----
// Helper to format ratio values
⋮----
// Helper to format percentage values
⋮----
// Check if we should show the comparison section
⋮----
{/* Standalone controls when comparison section is hidden but we have actual trades */}
⋮----
{/* Comparison Stats - same structure, data changes based on context */}
⋮----
{/* Performance Stats - 8 metrics in 2 rows */}
⋮----
{/* Row 1: CAGR, Win Rate, Sharpe, Sortino */}
⋮----
{/* Row 2: Max Drawdown, Calmar, Avg RoM, Avg Premium Capture */}
⋮----
isViewingDay
```

## File: lib/calculations/table-aggregation.ts
```typescript
/**
 * Table Aggregation Logic
 *
 * Buckets trades by a field and calculates aggregate statistics per bucket.
 * Similar to the S/L Drift Outcome Table but generalized for any field.
 */
⋮----
import { EnrichedTrade, getEnrichedTradeValue } from '@/lib/models/enriched-trade'
import {
  getFieldInfo,
  parseColumnValue,
  AggregationType,
  DEFAULT_TABLE_COLUMNS
} from '@/lib/models/report-config'
⋮----
/**
 * A single row in the aggregated table with dynamic column values
 */
export interface TableRow {
  label: string                    // Bucket label (e.g., "< 20", "20-25", "≥ 30")
  values: Record<string, number>   // Column values keyed by column value string (e.g., { 'count': 45, 'winRate': 67.5, 'pl:avg': 1234 })
}
⋮----
label: string                    // Bucket label (e.g., "< 20", "20-25", "≥ 30")
values: Record<string, number>   // Column values keyed by column value string (e.g., { 'count': 45, 'winRate': 67.5, 'pl:avg': 1234 })
⋮----
// Re-export shared getEnrichedTradeValue for backwards compatibility
⋮----
/**
 * Compute an aggregation over a set of trades
 */
export function computeAggregation(
  trades: EnrichedTrade[],
  field: string,
  aggregation: AggregationType
): number
⋮----
// Special cases for count and winRate
⋮----
// Get numeric values for the field
⋮----
/**
 * Format a bucket label based on field info
 */
function formatBucketLabel(
  min: number | null,
  max: number | null,
  fieldUnit?: string
): string
⋮----
// First bucket: < max
⋮----
// Last bucket: ≥ min
⋮----
// Middle bucket: min - max
⋮----
/**
 * Build aggregated table rows from trades
 *
 * @param trades - Array of enriched trades to aggregate
 * @param xField - Field name to bucket by
 * @param bucketEdges - Array of threshold values (e.g., [15, 20, 25, 30])
 * @param selectedColumns - Array of column value strings (e.g., ['count', 'winRate', 'pl:avg'])
 * @returns Array of TableRow with aggregated statistics
 */
export function buildTableRows(
  trades: EnrichedTrade[],
  xField: string,
  bucketEdges: number[],
  selectedColumns: string[] = DEFAULT_TABLE_COLUMNS
): TableRow[]
⋮----
// Sort bucket edges ascending
⋮----
// Get field info for unit display
⋮----
// Create bucket definitions
// For edges [15, 20, 25, 30], create buckets:
// < 15, 15-20, 20-25, 25-30, ≥ 30
interface BucketDef {
    min: number | null
    max: number | null
    label: string
    trades: EnrichedTrade[]
  }
⋮----
// First bucket: < first edge
⋮----
// Middle buckets: between consecutive edges
⋮----
// Last bucket: ≥ last edge
⋮----
// Assign trades to buckets
⋮----
// Find the appropriate bucket
⋮----
// Calculate statistics for each bucket based on selected columns
// Show all buckets, even empty ones, so user can see the full distribution
⋮----
// Compute each selected column
⋮----
/**
 * Parse bucket edges from a comma-separated string
 * Returns null if invalid input
 */
export function parseBucketEdges(input: string): number[] | null
⋮----
// Sort and dedupe
⋮----
/**
 * Format bucket edges to a comma-separated string
 */
export function formatBucketEdges(buckets: number[]): string
⋮----
/**
 * Get default bucket edges for a field based on its typical range
 */
export function getDefaultBucketEdges(field: string): number[]
⋮----
// Provide sensible defaults for common fields
⋮----
// Generic defaults
```

## File: lib/calculations/tail-risk-analysis.ts
```typescript
/**
 * Tail Risk Analysis using Gaussian Copula
 *
 * Measures tail dependence between strategies - how likely they are to have
 * extreme losses together, even if their day-to-day correlation is low.
 *
 * Key insight: Two strategies can have low Pearson correlation (0.2) but
 * high tail dependence (0.7), meaning they blow up together on big market moves.
 */
⋮----
import { eigs, matrix } from "mathjs";
import {
  AlignedStrategyReturns,
  MarginalContribution,
  TailRiskAnalysisOptions,
  TailRiskAnalysisResult,
  TailRiskAnalytics,
} from "../models/tail-risk";
import { Trade } from "../models/trade";
import {
  kendallTau,
  kendallTauToPearson,
  probabilityIntegralTransform,
} from "./statistical-utils";
⋮----
// Threshold for classifying a strategy pair as having "high" tail dependence
// Pairs above this value are flagged in analytics as concerning
⋮----
// Weights for marginal contribution calculation
// Equal weighting between concentration (factor loading) and average dependence
⋮----
// Minimum number of tail observations required for valid tail dependence calculation
// With fewer than this, the conditional probability P(j in tail | i in tail) is too noisy
// This is the absolute floor - dynamic minimum scales with sample size
⋮----
/**
 * Calculate dynamic minimum tail observations based on sample size
 * Scales with tailThreshold and actual observations to be more stringent for larger datasets
 * while maintaining a floor of 5 for small datasets
 */
function getMinTailObservations(
  tailThreshold: number,
  sharedTradingDays: number
): number
⋮----
// For larger datasets, require at least 10% of expected tail events
// This prevents accepting 5 observations when you have 500 potential tail days
⋮----
/**
 * Perform full Gaussian copula tail risk analysis
 *
 * @param trades - Array of trades to analyze
 * @param options - Analysis configuration options
 * @returns Complete tail risk analysis result
 */
export function performTailRiskAnalysis(
  trades: Trade[],
  options: TailRiskAnalysisOptions = {}
): TailRiskAnalysisResult
⋮----
// Validate and clamp thresholds to prevent degenerate calculations
// tailThreshold must be in (0, 1) - values at boundaries produce empty/full tails
⋮----
// varianceThreshold must be in (0, 1) for meaningful factor counting
⋮----
// Step 1: Filter trades
⋮----
// Extract ticker from legs or other fields
// For now, check if any leg contains the ticker
⋮----
// Filter by date range if provided
⋮----
// Include the entire "to" day by comparing to end of day
⋮----
// Step 2: Aggregate daily returns and align strategies
⋮----
// Handle edge cases
⋮----
// Step 3: Apply PIT to each strategy's returns
⋮----
// Step 4: Compute copula correlation matrix (Pearson on transformed data)
⋮----
// Step 5: Eigenvalue decomposition
⋮----
// Step 6: Estimate empirical joint tail risk (tail co-probability)
⋮----
// Step 7: Calculate analytics
⋮----
// Step 8: Calculate marginal contributions
⋮----
/**
 * Aggregate trades into daily returns and align to shared trading days
 */
function aggregateAndAlignReturns(
  trades: Trade[],
  normalization: "raw" | "margin" | "notional",
  dateBasis: "opened" | "closed"
): AlignedStrategyReturns
⋮----
// Group trades by strategy and date
⋮----
// Skip trades without a strategy
⋮----
// Use all dates (union) and zero-pad missing days
// This is necessary because strategies may trade on different schedules
// (e.g., Monday-only vs Friday-only strategies would have zero shared days)
⋮----
// Build aligned returns matrix with zero-padding for non-trading days
// Also track which days each strategy actually traded
⋮----
/**
 * Normalize trade return based on selected mode
 * Returns null for invalid/non-finite values to prevent corrupted calculations
 */
function normalizeReturn(
  trade: Trade,
  mode: "raw" | "margin" | "notional"
): number | null
⋮----
// Guard against NaN/Infinity from malformed data or division edge cases
⋮----
/**
 * Compute correlation matrix from transformed returns using Kendall's tau
 *
 * Uses Kendall's tau-b (rank-based) correlation, then maps to Pearson-equivalent
 * using sin(π * τ / 2). This approach:
 * 1. Is more robust to outliers than direct Pearson correlation
 * 2. Guarantees the resulting matrix is positive semi-definite
 * 3. Ensures valid eigenvalue decomposition (all eigenvalues >= 0)
 */
function computeCorrelationMatrix(transformedReturns: number[][]): number[][]
⋮----
// Compute Kendall's tau, then map to Pearson-equivalent
⋮----
/**
 * Perform eigenvalue decomposition and calculate explained variance
 */
function performEigenAnalysis(
  correlationMatrix: number[][],
  varianceThreshold: number = 0.8
):
⋮----
// Use mathjs eigs function
⋮----
// Extract eigenvalues (may be complex, take real parts)
⋮----
// Handle both array and MathCollection types
⋮----
// Extract eigenvectors
// Note: result.eigenvectors is an array of {value, vector} objects
// where vector is a DenseMatrix that needs .toArray() called on it
type EigenvectorEntry = {
      value: number | { re: number };
      vector: { toArray: () => (number | { re: number })[] };
    };
⋮----
// Sort by eigenvalue descending
⋮----
// Calculate explained variance
⋮----
// Find effective factors (configurable threshold)
⋮----
// Fallback for numerical issues (e.g., near-singular matrices)
⋮----
/**
 * Result of joint tail risk estimation including insufficient data tracking
 */
interface JointTailRiskResult {
  matrix: number[][];
  insufficientPairs: number;
}
⋮----
/**
 * Estimate empirical joint tail risk (tail co-probability) between strategies
 *
 * For each pair (i, j), calculates P(j in tail | i in tail)
 * where "in tail" means below the tailThreshold percentile.
 *
 * Key points:
 * 1. Only considers days where BOTH strategies actually traded (excludes zero-padded days)
 * 2. Requires minimum tail observations for valid estimates (returns NaN otherwise)
 * 3. Uses linear interpolation for threshold calculation
 */
function estimateJointTailRisk(
  transformedReturns: number[][],
  tradedMask: boolean[][],
  tailThreshold: number
): JointTailRiskResult
⋮----
// For each strategy, compute threshold using ONLY days they actually traded
// This prevents zero-padded days from affecting the percentile calculation
⋮----
// Filter to only actual trading days
⋮----
return 0; // No trades, threshold is meaningless
⋮----
// Identify which observations are in the tail for each strategy
// Only mark as "in tail" if:
// 1. The strategy actually traded that day (not zero-padded)
// 2. The return is at or below the threshold
⋮----
// Compute joint tail risk matrix
⋮----
// Count shared trading days and co-occurrences in tail
⋮----
// Only count days where both strategies actually traded
⋮----
// Calculate dynamic minimum based on shared trading days for this pair
⋮----
// Check if we have enough tail observations for a valid estimate
⋮----
row.push(NaN); // Insufficient data
⋮----
// P(j in tail | i in tail) on shared trading days
⋮----
/**
 * Calculate analytics from joint tail risk matrix
 */
function calculateTailRiskAnalytics(
  jointTailRiskMatrix: number[][],
  strategies: string[]
): TailRiskAnalytics
⋮----
// Joint tail risk is asymmetric: P(B in tail | A in tail) ≠ P(A in tail | B in tail)
// We average both directions for a single summary metric per pair
⋮----
// Skip pairs with insufficient data (NaN values)
⋮----
// Handle case where no valid pairs exist
⋮----
/**
 * Calculate marginal contribution of each strategy to portfolio tail risk
 */
function calculateMarginalContributions(
  _copulaCorrelationMatrix: number[][],
  jointTailRiskMatrix: number[][],
  eigenvectors: number[][],
  strategies: string[]
): MarginalContribution[]
⋮----
// Note: copulaCorrelationMatrix is passed for potential future use
// (e.g., incorporating copula-based risk measures) but currently unused
⋮----
// Get first eigenvector (dominant factor)
⋮----
// Concentration score: loading on first factor
⋮----
// Average joint tail risk with other strategies (skip NaN pairs)
⋮----
// Skip pairs with insufficient data
⋮----
// Tail risk contribution: weighted combination of concentration and avg dependence
// Higher concentration + higher avg dependence = higher contribution
⋮----
// Sort by contribution descending
⋮----
/**
 * Create empty result for edge cases
 */
function createEmptyResult(
  aligned: AlignedStrategyReturns,
  tailThreshold: number,
  varianceThreshold: number,
  startTime: number
): TailRiskAnalysisResult
```

## File: lib/stores/performance-store.ts
```typescript
import { enrichTrades, StaticDatasetWithRows } from '@/lib/calculations/enrich-trades'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { EnrichedTrade } from '@/lib/models/enriched-trade'
import { PortfolioStats } from '@/lib/models/portfolio-stats'
import { Trade } from '@/lib/models/trade'
import {
  buildPerformanceSnapshot,
  SnapshotChartData,
  SnapshotFilters
} from '@/lib/services/performance-snapshot'
import {
  deriveGroupedLegOutcomes,
  GroupedLegOutcomes
} from '@/lib/utils/performance-helpers'
import { create } from 'zustand'
⋮----
// Re-export types from helper if needed or redefine locally if they are store specific.
// The helper exported GroupedLegOutcomes, GroupedOutcome, etc.
⋮----
export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}
⋮----
export interface ChartSettings {
  equityScale: 'linear' | 'log'
  showDrawdownAreas: boolean
  showTrend: boolean
  maWindow: number
  rollingMetricType: 'win_rate' | 'sharpe' | 'profit_factor'
}
⋮----
// Re-export types for consumers
⋮----
export interface PerformanceData extends SnapshotChartData {
  trades: Trade[]
  allTrades: Trade[]
  allRawTrades: Trade[]
  dailyLogs: DailyLogEntry[]
  allDailyLogs: DailyLogEntry[]
  portfolioStats: PortfolioStats | null
  groupedLegOutcomes: GroupedLegOutcomes | null
  /** Pre-computed enriched trades for Report Builder (with MFE/MAE, ROM, timing, etc.) */
  enrichedTrades: EnrichedTrade[]
}
⋮----
/** Pre-computed enriched trades for Report Builder (with MFE/MAE, ROM, timing, etc.) */
⋮----
interface PerformanceStore {
  isLoading: boolean
  error: string | null
  dateRange: DateRange
  selectedStrategies: string[]
  data: PerformanceData | null
  chartSettings: ChartSettings
  normalizeTo1Lot: boolean
  setDateRange: (dateRange: DateRange) => void
  setSelectedStrategies: (strategies: string[]) => void
  updateChartSettings: (settings: Partial<ChartSettings>) => void
  fetchPerformanceData: (blockId: string) => Promise<void>
  applyFilters: () => Promise<void>
  setNormalizeTo1Lot: (value: boolean) => void
  reset: () => void
}
⋮----
function ensureRomDetails(chartData: SnapshotChartData, trades: Trade[]): SnapshotChartData
⋮----
function buildSnapshotFilters(dateRange: DateRange, strategies: string[]): SnapshotFilters
⋮----
// Selecting every available strategy should behave the same as selecting none.
// This prevents "(Select All)" in the UI from acting like a restrictive filter
// and keeps the output aligned with the default "All Strategies" view.
function normalizeStrategyFilter(selected: string[], trades?: Trade[]): string[]
⋮----
// If the user picked every strategy we know about, drop the filter so the
// snapshot uses the full data set (identical to the default state).
⋮----
// Clear existing data to avoid showing the previous block's charts while loading the new one
⋮----
// Fetch block to get analysis config
⋮----
// Load all static datasets with their rows for enrichment
⋮----
// Check if we can use cached snapshot (default view with no filters)
⋮----
riskFreeRate === 2.0 // explicit parity with block-stats page default
⋮----
// Use cached data - much faster!
// Still need raw trades for groupedLegOutcomes
⋮----
// Try to get cached enriched trades, fall back to computing them
// Note: Static datasets aren't cached - always compute fresh to pick up new datasets
⋮----
// Cache miss or static datasets present - compute enriched trades
⋮----
// Cache miss or filters applied - compute normally
⋮----
// Compute enriched trades for filtered result (smaller set = faster)
⋮----
// Load static datasets for enrichment
⋮----
// Compute enriched trades for the filtered result
⋮----
// Re-export for existing unit tests that rely on chart processing helpers
⋮----
function filterTradesForSnapshot(trades: Trade[], filters: SnapshotFilters): Trade[]
```

## File: components/report-builder/save-report-dialog.tsx
```typescript
/**
 * Save Report Dialog
 *
 * Modal dialog to save the current report configuration.
 */
⋮----
import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSettingsStore } from '@/lib/stores/settings-store'
import {
  FilterConfig,
  ChartType,
  ChartAxisConfig,
  ThresholdMetric,
  getFieldInfo,
  getColumnLabel,
  FILTER_OPERATOR_LABELS,
  CHART_TYPE_LABELS,
  THRESHOLD_METRIC_LABELS
} from '@/lib/models/report-config'
⋮----
interface SaveReportDialogProps {
  filterConfig: FilterConfig
  chartType: ChartType
  xAxis: ChartAxisConfig
  yAxis: ChartAxisConfig
  yAxis2?: ChartAxisConfig
  yAxis3?: ChartAxisConfig
  colorBy?: ChartAxisConfig
  sizeBy?: ChartAxisConfig
  tableBuckets?: number[]
  tableColumns?: string[]
  thresholdMetric?: ThresholdMetric
}
⋮----
const handleSave = () =>
⋮----
const handleKeyDown = (e: React.KeyboardEvent) =>
⋮----
onChange=
{/* X Axis label varies by chart type */}
⋮----
{/* Y Axis - not shown for table or histogram */}
⋮----
{/* Additional Y axes for scatter/line only */}
⋮----
{/* Color/Size for scatter only */}
⋮----
{/* Threshold metric */}
⋮----
{/* Table buckets and columns */}
```

## File: components/report-builder/scatter-chart.tsx
```typescript
/**
 * Scatter Chart
 *
 * Plotly scatter plot with 2D What-If Filter Explorer.
 * Features visual highlighting for in-range vs out-of-range points
 * and a rectangle overlay showing the selected region bounds.
 * Supports multiple Y-axes (y2, y3) for multi-metric comparison.
 * When multiple Y-axes are configured, user can select which Y-axis
 * to use for the What-If analysis.
 */
⋮----
import { useMemo, useState, useCallback } from "react";
import type { Layout, PlotData, Shape } from "plotly.js";
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { EnrichedTrade, getEnrichedTradeValue } from "@/lib/models/enriched-trade";
import { ChartAxisConfig, getFieldInfo, ThresholdMetric } from "@/lib/models/report-config";
import { WhatIfExplorer2D, YAxisConfig, YAxisRange } from "./what-if-explorer-2d";
⋮----
/**
 * Colors for multi-axis traces
 */
⋮----
y1: "rgb(59, 130, 246)", // Blue (primary)
y2: "rgb(249, 115, 22)", // Orange (secondary)
y3: "rgb(20, 184, 166)", // Teal (tertiary)
⋮----
interface ScatterChartProps {
  trades: EnrichedTrade[];
  xAxis: ChartAxisConfig;
  yAxis: ChartAxisConfig;
  yAxis2?: ChartAxisConfig;
  yAxis3?: ChartAxisConfig;
  colorBy?: ChartAxisConfig;
  sizeBy?: ChartAxisConfig;
  metric?: ThresholdMetric;
  showWhatIf?: boolean;
  className?: string;
}
⋮----
// Use shared getEnrichedTradeValue from enriched-trade model
⋮----
/**
 * Date fields that need special handling
 */
⋮----
function isDateField(field: string): boolean
⋮----
function formatValueForHover(value: number, field: string): string
⋮----
function toPlotlyValue(value: number, field: string): number | string
⋮----
/**
 * Calculate Y-axis range with padding
 */
function calculateAxisRange(values: number[]): [number, number]
⋮----
// Check if we're using multi-axis mode
⋮----
// Build list of Y axes for What-If analysis
⋮----
// Track the selected range from What-If Explorer for visual highlighting
// Now supports multiple Y axes for multi-axis bounding boxes
⋮----
// Only update if What-If is enabled
⋮----
// Clear selected range when What-If is disabled
⋮----
// Multi-axis mode - different rendering path
⋮----
// Calculate size values for scaling if sizeBy is configured
⋮----
const getMarkerSize = (index: number, baseSize: number): number =>
⋮----
// Build primary Y axis trace
⋮----
// Build Y2 trace
⋮----
// Build Y3 trace
⋮----
// Calculate right margin based on number of axes
⋮----
// Add Y2 axis config
⋮----
// Add Y3 axis config
⋮----
// Add rectangle shapes for selected range in multi-axis mode
⋮----
// Color palette matching AXIS_COLORS for each Y axis
⋮----
{ line: "rgb(59, 130, 246)", fill: "rgba(59, 130, 246, 0.05)" },   // Blue (y1)
{ line: "rgb(249, 115, 22)", fill: "rgba(249, 115, 22, 0.05)" },   // Orange (y2)
{ line: "rgb(20, 184, 166)", fill: "rgba(20, 184, 166, 0.05)" },   // Teal (y3)
⋮----
// Single Y-axis mode with What-If highlighting support
// Extract all points with their values
⋮----
// Collect size values for scaling
⋮----
// If we have a selected range, create two traces: in-range and out-of-range
// Also check if we're actually filtering (range doesn't cover all points)
// For single Y-axis mode, use first Y range
⋮----
// Out-of-range points (gray/faded)
⋮----
color: "rgba(148, 163, 184, 0.4)", // Gray/faded
⋮----
// In-range points - apply colorBy if set, otherwise blue
⋮----
// Binary coloring for winners/losers (in range only)
⋮----
color: "rgb(239, 68, 68)", // Red
⋮----
color: "rgb(34, 197, 94)", // Green
⋮----
// Continuous color scale for in-range points
⋮----
// Simple blue for in-range
⋮----
color: "rgb(59, 130, 246)", // Blue
⋮----
// No range selection - check for color encoding
⋮----
// Binary coloring for winners/losers
⋮----
color: "rgb(239, 68, 68)", // Red
⋮----
color: "rgb(34, 197, 94)", // Green
⋮----
// Continuous color scale
⋮----
// Simple blue scatter
⋮----
// Build layout
⋮----
// Calculate dynamic right margin - need space for colorbar with continuous colorBy
⋮----
rightMargin = 100; // Space for color bar
⋮----
// Add rectangle shapes for selected range - one per Y axis (color-coded)
⋮----
// Color palette matching AXIS_COLORS for each Y axis
⋮----
{ line: "rgb(59, 130, 246)", fill: "rgba(59, 130, 246, 0.05)" },   // Blue (y1)
{ line: "rgb(249, 115, 22)", fill: "rgba(249, 115, 22, 0.05)" },   // Orange (y2)
{ line: "rgb(139, 92, 246)", fill: "rgba(139, 92, 246, 0.05)" },   // Purple (y3)
⋮----
{/* What-If Filter Explorer */}
```

## File: components/static-datasets/dataset-card.tsx
```typescript
import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Database,
  Calendar,
  Columns3,
  Eye,
  Trash2,
  Pencil,
  Check,
  X,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import type { StaticDataset, MatchStrategy } from "@/lib/models/static-dataset"
import { MATCH_STRATEGY_LABELS, MATCH_STRATEGY_DESCRIPTIONS } from "@/lib/models/static-dataset"
import { useStaticDatasetsStore, makeMatchStatsCacheKey } from "@/lib/stores/static-datasets-store"
import type { Trade } from "@/lib/models/trade"
⋮----
interface DatasetCardProps {
  dataset: StaticDataset
  onPreview: (dataset: StaticDataset) => void
  /** Trades from the active block for computing match stats */
  trades?: Trade[]
  /** Block ID for caching match stats */
  blockId?: string
}
⋮----
/** Trades from the active block for computing match stats */
⋮----
/** Block ID for caching match stats */
⋮----
// Build the cache key for this specific dataset/block/strategy combo
⋮----
// Subscribe directly to the cached stats for this specific key
// This ensures re-render when this specific cache entry changes
⋮----
// Subscribe directly to computing state for this specific key
⋮----
// Trigger computation if not cached and not already computing
⋮----
// Check current state and trigger computation if needed
⋮----
const formatDate = (date: Date)
⋮----
const formatDateTime = (date: Date)
⋮----
{/* Stats */}
⋮----
{/* Match Stats Badge */}
⋮----
{/* Columns */}
⋮----
{/* Match Strategy */}
⋮----
{/* Footer */}
⋮----
{/* Delete Confirmation */}
```

## File: components/static-datasets/preview-modal.tsx
```typescript
import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, AlertTriangle, Filter } from "lucide-react"
import type { StaticDataset, StaticDatasetRow, DatasetMatchResult, MatchStrategy } from "@/lib/models/static-dataset"
import { MATCH_STRATEGY_LABELS, MATCH_STRATEGY_DESCRIPTIONS } from "@/lib/models/static-dataset"
import type { Trade } from "@/lib/models/trade"
import {
  matchTradesToDataset,
  calculateMatchStats,
  formatTimeDifference,
  combineDateAndTime,
} from "@/lib/calculations/static-dataset-matcher"
import { useStaticDatasetsStore } from "@/lib/stores/static-datasets-store"
import { useBlockStore } from "@/lib/stores/block-store"
import { getTradesByBlock } from "@/lib/db"
⋮----
interface PreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataset: StaticDataset | null
}
⋮----
interface PreviewData {
  trades: Trade[]
  rows: StaticDatasetRow[]
  matchResults: DatasetMatchResult[]
  stats: {
    totalTrades: number
    matchedTrades: number
    outsideDateRange: number
    matchPercentage: number
  }
}
⋮----
type FilterMode = "all" | "matched" | "unmatched"
⋮----
// Reset selected column and match strategy when dataset changes
⋮----
// Load preview data when modal opens or match strategy changes
⋮----
const loadPreviewData = async () =>
⋮----
// Load dataset rows and block trades in parallel
⋮----
// Create a dataset object with the current match strategy for calculations
⋮----
// Calculate matches using the current match strategy
⋮----
const formatTradeTime = (trade: Trade) =>
⋮----
const formatMatchedTime = (date: Date | null) =>
⋮----
const formatDateRange = (date: Date) =>
⋮----
// Use selected column or fall back to first column
⋮----
// Handle match strategy change - update local state and persist to store
const handleMatchStrategyChange = async (newStrategy: MatchStrategy) =>
⋮----
// Filter results based on filter mode
⋮----
{/* Loading State */}
⋮----
{/* Error State */}
⋮----
{/* Preview Data */}
⋮----
{/* Stats Summary */}
⋮----
Dataset:
⋮----
{/* Controls Row: Column Selector + Filter Toggle */}
⋮----
{/* Match Table */}
```

## File: lib/db/index.ts
```typescript
/**
 * IndexedDB Database Service for TradeBlocks
 *
 * Manages the client-side database for storing blocks, trades, and daily logs.
 * Uses a versioned schema with migration support.
 */
⋮----
// Types imported for reference (commented out to avoid unused warnings)
// import { ProcessedBlock } from '../models/block'
// import { Trade } from '../models/trade'
// import { DailyLogEntry } from '../models/daily-log'
// import { PortfolioStats, StrategyStats, PerformanceMetrics } from '../models/portfolio-stats'
⋮----
// Database configuration
⋮----
// Object store names
⋮----
// Index names
⋮----
/**
 * Database instance singleton
 */
⋮----
/**
 * Initialize the IndexedDB database
 */
export async function initializeDatabase(): Promise<IDBDatabase>
⋮----
// Create blocks store
⋮----
// Create trades store
⋮----
// Create daily logs store
⋮----
// Create reporting logs store
⋮----
// Create calculations store (for cached computations)
⋮----
// Create walk-forward analysis store
⋮----
// Create static datasets store (metadata)
⋮----
// Create static dataset rows store (data rows)
⋮----
/**
 * Get database instance (initialize if needed)
 */
export async function getDatabase(): Promise<IDBDatabase>
⋮----
/**
 * Close database connection
 */
export function closeDatabase(): void
⋮----
/**
 * Delete the entire database (for testing/reset)
 * This version is more robust for corrupted databases:
 * - Doesn't require opening the database first
 * - Has timeout to prevent hanging forever
 * - Resolves on blocked (since deletion completes after reload)
 */
export async function deleteDatabase(): Promise<void>
⋮----
// Close any existing connection (don't wait for it)
⋮----
// Ignore close errors - database might be in bad state
⋮----
// Timeout to prevent hanging forever on corrupted database
⋮----
resolve(); // Resolve anyway so we can reload
⋮----
// Still resolve - user can retry after page reload
⋮----
// Resolve instead of reject - the deletion will complete once all connections close
// After page reload, there will be no connections blocking it
⋮----
/**
 * Transaction helper for read operations
 */
export async function withReadTransaction<T>(
  stores: string | string[],
  callback: (transaction: IDBTransaction) => Promise<T>
): Promise<T>
⋮----
/**
 * Transaction helper for write operations
 */
export async function withWriteTransaction<T>(
  stores: string | string[],
  callback: (transaction: IDBTransaction) => Promise<T>
): Promise<T>
⋮----
/**
 * Generic helper for promisifying IDBRequest
 */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T>
⋮----
/**
 * Storage quota management
 */
export interface StorageInfo {
  quota: number;
  usage: number;
  available: number;
  persistent: boolean;
}
⋮----
/**
 * Get storage quota information
 */
export async function getStorageInfo(): Promise<StorageInfo>
⋮----
// Fallback for browsers without storage API
⋮----
/**
 * Request persistent storage
 */
export async function requestPersistentStorage(): Promise<boolean>
⋮----
/**
 * Database error types
 */
export class DatabaseError extends Error
⋮----
constructor(
    message: string,
    public readonly operation: string,
    public readonly store?: string,
    public readonly cause?: Error
)
⋮----
export class QuotaExceededError extends DatabaseError
⋮----
constructor(operation: string, store?: string)
⋮----
export class TransactionError extends DatabaseError
⋮----
constructor(
    message: string,
    operation: string,
    store?: string,
    cause?: Error
)
⋮----
// Re-export functions from individual stores
```

## File: lib/db/static-dataset-rows-store.ts
```typescript
/**
 * Static Dataset Rows Store - CRUD operations for static dataset data rows
 */
⋮----
import type { StaticDatasetRow, StoredStaticDatasetRow } from '../models/static-dataset'
import { STORES, INDEXES, withReadTransaction, withWriteTransaction, promisifyRequest } from './index'
⋮----
/**
 * Add rows for a static dataset (batch operation with chunking)
 * Processes in batches to avoid memory issues with large datasets
 */
export async function addStaticDatasetRows(
  datasetId: string,
  rows: Omit<StaticDatasetRow, 'datasetId'>[]
): Promise<void>
⋮----
// Process in chunks to avoid overwhelming memory/transaction
// 10,000 rows per chunk is a safe balance for most browsers
⋮----
/**
 * Get all rows for a static dataset
 */
export async function getStaticDatasetRows(datasetId: string): Promise<StoredStaticDatasetRow[]>
⋮----
// Sort by timestamp (chronological order)
⋮----
/**
 * Get rows for a dataset within a timestamp range
 */
export async function getStaticDatasetRowsByRange(
  datasetId: string,
  startTimestamp: Date,
  endTimestamp: Date
): Promise<StoredStaticDatasetRow[]>
⋮----
// Create compound key range [datasetId, startTimestamp] to [datasetId, endTimestamp]
⋮----
/**
 * Get row count for a dataset
 */
export async function getStaticDatasetRowCount(datasetId: string): Promise<number>
⋮----
/**
 * Delete all rows for a dataset
 */
export async function deleteStaticDatasetRows(datasetId: string): Promise<void>
⋮----
/**
 * Delete a static dataset and all its rows (full cleanup)
 */
export async function deleteStaticDatasetWithRows(datasetId: string): Promise<void>
⋮----
// Delete rows first
⋮----
// Then delete metadata
⋮----
/**
 * Get the date range covered by a dataset's rows
 */
export async function getStaticDatasetDateRange(
  datasetId: string
): Promise<
```

## File: lib/models/static-dataset.ts
```typescript
/**
 * Static Dataset Models
 *
 * Static datasets are global time-series data (VIX, SPX OHLC, etc.) that can be
 * matched to trades across any block based on configurable matching strategies.
 */
⋮----
/**
 * Match strategy determines how trade timestamps are matched to dataset rows
 */
export type MatchStrategy = 'exact' | 'same-day' | 'nearest-before' | 'nearest-after' | 'nearest'
⋮----
/**
 * Human-readable labels for match strategies
 */
⋮----
/**
 * Descriptions for match strategies (for tooltips/help text)
 */
⋮----
/**
 * Static dataset metadata - stored separately from rows for efficient listing
 */
export interface StaticDataset {
  /** Unique identifier */
  id: string

  /** User-provided name, used as field prefix in Report Builder (e.g., "vix" -> "vix.close") */
  name: string

  /** Original filename from upload */
  fileName: string

  /** When the dataset was uploaded */
  uploadedAt: Date

  /** Total number of data rows */
  rowCount: number

  /** Date range covered by the dataset */
  dateRange: {
    start: Date
    end: Date
  }

  /** Column names (excluding timestamp column which is always first) */
  columns: string[]

  /** How to match trade timestamps to dataset rows */
  matchStrategy: MatchStrategy
}
⋮----
/** Unique identifier */
⋮----
/** User-provided name, used as field prefix in Report Builder (e.g., "vix" -> "vix.close") */
⋮----
/** Original filename from upload */
⋮----
/** When the dataset was uploaded */
⋮----
/** Total number of data rows */
⋮----
/** Date range covered by the dataset */
⋮----
/** Column names (excluding timestamp column which is always first) */
⋮----
/** How to match trade timestamps to dataset rows */
⋮----
/**
 * A single row of static dataset data
 * Stored separately from metadata for performance with large datasets
 */
export interface StaticDatasetRow {
  /** Reference to parent dataset */
  datasetId: string

  /** Timestamp parsed from first column of CSV */
  timestamp: Date

  /** All other column values, keyed by column name */
  values: Record<string, number | string>
}
⋮----
/** Reference to parent dataset */
⋮----
/** Timestamp parsed from first column of CSV */
⋮----
/** All other column values, keyed by column name */
⋮----
/**
 * Stored version of StaticDatasetRow with auto-generated ID for IndexedDB
 */
export interface StoredStaticDatasetRow extends StaticDatasetRow {
  id?: number
}
⋮----
/**
 * Result of matching a trade to a static dataset
 */
export interface DatasetMatchResult {
  /** The dataset that was matched */
  datasetId: string

  /** The dataset name (for field prefixing) */
  datasetName: string

  /** The matched row, or null if no match found */
  matchedRow: StaticDatasetRow | null

  /** The timestamp that was matched (for display in preview) */
  matchedTimestamp: Date | null

  /** Time difference in milliseconds between trade and matched row (for diagnostics) */
  timeDifferenceMs: number | null
}
⋮----
/** The dataset that was matched */
⋮----
/** The dataset name (for field prefixing) */
⋮----
/** The matched row, or null if no match found */
⋮----
/** The timestamp that was matched (for display in preview) */
⋮----
/** Time difference in milliseconds between trade and matched row (for diagnostics) */
⋮----
/**
 * Aggregated match statistics for preview display
 */
export interface DatasetMatchStats {
  /** Total number of trades */
  totalTrades: number

  /** Number of trades that found a match */
  matchedTrades: number

  /** Number of trades outside dataset date range */
  outsideDateRange: number

  /** Match percentage (0-100) */
  matchPercentage: number
}
⋮----
/** Total number of trades */
⋮----
/** Number of trades that found a match */
⋮----
/** Number of trades outside dataset date range */
⋮----
/** Match percentage (0-100) */
```

## File: lib/processing/static-dataset-processor.ts
```typescript
/**
 * Static Dataset Processor
 *
 * Processes CSV files for static datasets (VIX, SPX OHLC, etc.)
 * First column is always the timestamp, remaining columns are data values.
 */
⋮----
import { CSVParser, type CSVParseResult, type ParseProgress } from './csv-parser'
import type { StaticDataset, StaticDatasetRow, MatchStrategy } from '../models/static-dataset'
⋮----
/**
 * Result of processing a static dataset CSV
 */
export interface StaticDatasetProcessResult {
  dataset: StaticDataset
  rows: Omit<StaticDatasetRow, 'datasetId'>[]
  warnings: string[]
  errors: string[]
}
⋮----
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
⋮----
/** User-provided name for the dataset (used as field prefix) */
⋮----
/** Original filename */
⋮----
/** Default match strategy */
⋮----
/** Progress callback */
⋮----
/**
 * Get the Eastern Time offset in minutes for a given date
 * Returns the offset from UTC in minutes (e.g., -300 for EST, -240 for EDT)
 */
function getEasternTimeOffset(date: Date): number
⋮----
return -300 // Fallback to EST
⋮----
/**
 * Convert a date/time in Eastern Time to UTC
 * Used for date-only formats where we want midnight Eastern Time, not UTC
 */
function easternToUtc(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0): Date
⋮----
// Create a UTC timestamp with the given components
⋮----
// Convert Eastern Time to UTC by subtracting the offset
⋮----
/**
 * Parse a timestamp string into a Date object
 * Supports common formats: ISO 8601, US date formats, Unix timestamps (seconds)
 *
 * IMPORTANT: Date-only formats (without time) are interpreted as midnight Eastern Time,
 * not UTC, since static datasets typically contain market data in US market time.
 */
function parseTimestamp(value: string): Date | null
⋮----
// Check for Unix timestamp (all digits, typically 10+ digits for seconds since epoch)
// Unix timestamps in seconds are ~10 digits (e.g., 1755541800 = Aug 2025)
// Unix timestamps in milliseconds are ~13 digits
⋮----
// If it's 13 digits, treat as milliseconds; otherwise treat as seconds
⋮----
// Check for date-only YYYY-MM-DD format (no time component)
// These should be interpreted as midnight Eastern Time, not UTC
⋮----
// Try ISO 8601 format with time (includes timezone info)
// Only use native parsing if there's a time component (T or space followed by time)
⋮----
// Try common date formats
// MM/DD/YYYY or MM-DD-YYYY (with optional time)
⋮----
// Has time component - use local time (same as before)
⋮----
// Date only - use Eastern Time midnight
⋮----
// Try YYYY/MM/DD or YYYY-MM-DD (with optional time)
⋮----
// Has time component - use local time (same as before)
⋮----
// Date only - use Eastern Time midnight
⋮----
/**
 * Parse a value string, attempting to convert to number if possible
 */
function parseValue(value: string): number | string
⋮----
// Remove currency symbols and commas
⋮----
// Remove percentage sign and convert
⋮----
// If it was a percentage, keep as decimal (user can interpret as needed)
⋮----
// Return original string if not a number
⋮----
/**
 * Generate a unique ID for a static dataset
 */
function generateDatasetId(): string
⋮----
/**
 * Process a static dataset CSV file
 */
export async function processStaticDatasetFile(
  file: File,
  options: ProcessStaticDatasetOptions
): Promise<StaticDatasetProcessResult>
⋮----
maxRows: 500000, // Allow larger files for time-series data
⋮----
// Parse CSV
⋮----
// Add parsing errors
⋮----
// Add parsing warnings
⋮----
// First column is timestamp, rest are data columns
⋮----
// Process rows
⋮----
// Track date range
⋮----
// Parse data values
⋮----
// Sort rows by timestamp
⋮----
// Filter out empty columns (columns where all values are empty strings)
⋮----
// Remove empty columns from row values
⋮----
// Create dataset metadata
⋮----
/**
 * Create an empty dataset for error cases
 */
function createEmptyDataset(options: ProcessStaticDatasetOptions): StaticDataset
⋮----
/**
 * Process a static dataset from file content string (for testing)
 */
export async function processStaticDatasetContent(
  content: string,
  options: ProcessStaticDatasetOptions
): Promise<StaticDatasetProcessResult>
⋮----
// Parse CSV
⋮----
// Add parsing errors
⋮----
// Add parsing warnings
⋮----
// First column is timestamp, rest are data columns
⋮----
// Process rows
⋮----
// Track date range
⋮----
// Parse data values
⋮----
// Sort rows by timestamp
⋮----
// Filter out empty columns (columns where all values are empty strings)
⋮----
// Remove empty columns from row values
⋮----
// Create dataset metadata
⋮----
/**
 * Validate a dataset name
 */
export function validateDatasetName(name: string):
⋮----
// Check length
⋮----
// Check for valid characters (alphanumeric, spaces, underscore, hyphen)
// Names can start with a letter or number
⋮----
// Check for reserved names
⋮----
/**
 * Suggest a dataset name from filename
 */
export function suggestDatasetName(fileName: string): string
⋮----
// Remove extension
⋮----
// Convert to valid name format
⋮----
.replace(/[^a-z0-9]+/g, '_') // Replace invalid chars with underscore
.replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
.replace(/_+/g, '_') // Collapse multiple underscores
⋮----
// Ensure it starts with a letter or number
⋮----
// Truncate if too long
```

## File: components/report-builder/custom-chart.tsx
```typescript
/**
 * Custom Chart
 *
 * Dynamic Plotly chart that renders based on user-selected axes and chart type.
 */
⋮----
import { useMemo } from 'react'
import type { Layout, PlotData } from 'plotly.js'
import { ChartWrapper } from '@/components/performance-charts/chart-wrapper'
import { EnrichedTrade, getEnrichedTradeValue } from '@/lib/models/enriched-trade'
import {
  ChartType,
  ChartAxisConfig,
  getFieldInfo
} from '@/lib/models/report-config'
⋮----
interface CustomChartProps {
  trades: EnrichedTrade[]
  chartType: ChartType
  xAxis: ChartAxisConfig
  yAxis: ChartAxisConfig
  yAxis2?: ChartAxisConfig  // Secondary Y-axis (right side)
  yAxis3?: ChartAxisConfig  // Tertiary Y-axis (far right)
  colorBy?: ChartAxisConfig
  sizeBy?: ChartAxisConfig
  className?: string
}
⋮----
yAxis2?: ChartAxisConfig  // Secondary Y-axis (right side)
yAxis3?: ChartAxisConfig  // Tertiary Y-axis (far right)
⋮----
/**
 * Colors for multi-axis traces
 */
⋮----
y1: 'rgb(59, 130, 246)',   // Blue (primary)
y2: 'rgb(239, 68, 68)',    // Red (secondary)
y3: 'rgb(34, 197, 94)'     // Green (tertiary)
⋮----
// Use shared getEnrichedTradeValue from enriched-trade model
⋮----
/**
 * Binary/categorical fields that should use discrete colors instead of continuous scale
 */
⋮----
/**
 * Check if a field should use categorical coloring
 */
function isBinaryField(field: string): boolean
⋮----
/**
 * Date/timestamp fields that should use date axis formatting
 */
⋮----
/**
 * Check if a field is a date/timestamp field
 */
function isDateField(field: string): boolean
⋮----
/**
 * Format a value for hover display based on field type
 */
function formatValueForHover(value: number, field: string): string
⋮----
/**
 * Convert a numeric value to a Plotly-compatible format
 * For date fields, converts timestamp to ISO string for proper axis handling
 */
function toPlotlyValue(value: number, field: string): number | string
⋮----
/**
 * Build traces for a scatter plot with categorical coloring (winners/losers)
 */
function buildCategoricalScatterTraces(
  trades: EnrichedTrade[],
  xAxis: ChartAxisConfig,
  yAxis: ChartAxisConfig,
  colorBy: ChartAxisConfig,
  sizeBy?: ChartAxisConfig
): Partial<PlotData>[]
⋮----
// Separate trades into winners and losers
⋮----
// Collect all size values first for scaling
⋮----
// Calculate size for this trade
⋮----
// Winners trace (green)
⋮----
color: 'rgb(34, 197, 94)', // Green
⋮----
// Losers trace (red)
⋮----
color: 'rgb(239, 68, 68)', // Red
⋮----
/**
 * Build traces for a scatter plot
 */
function buildScatterTraces(
  trades: EnrichedTrade[],
  xAxis: ChartAxisConfig,
  yAxis: ChartAxisConfig,
  colorBy?: ChartAxisConfig,
  sizeBy?: ChartAxisConfig
): Partial<PlotData>[]
⋮----
// Use categorical coloring for binary fields
⋮----
// Build hover text
⋮----
// Calculate size scaling if using size encoding
⋮----
// Calculate color scale bounds for symmetry around zero
⋮----
color: 'rgb(59, 130, 246)', // Default blue
⋮----
/**
 * Build traces for a histogram
 */
function buildHistogramTraces(
  trades: EnrichedTrade[],
  xAxis: ChartAxisConfig
): Partial<PlotData>[]
⋮----
/**
 * Build traces for a bar chart (aggregate Y by X buckets)
 */
function buildBarTraces(
  trades: EnrichedTrade[],
  xAxis: ChartAxisConfig,
  yAxis: ChartAxisConfig
): Partial<PlotData>[]
⋮----
// Group trades by X value buckets
⋮----
// Create bucket key (round to 1 decimal)
⋮----
// Calculate average Y for each bucket
⋮----
/**
 * Build traces for a line chart (sorted by X, shows trend)
 */
function buildLineTraces(
  trades: EnrichedTrade[],
  xAxis: ChartAxisConfig,
  yAxis: ChartAxisConfig
): Partial<PlotData>[]
⋮----
// Sort by X value for proper line rendering
⋮----
/**
 * Build traces for a box plot
 */
function buildBoxTraces(
  trades: EnrichedTrade[],
  xAxis: ChartAxisConfig,
  yAxis: ChartAxisConfig
): Partial<PlotData>[]
⋮----
// For box plots, we'll create quartile buckets of X and show Y distribution
⋮----
// Create quartile labels
⋮----
const getQuartile = (x: number): string =>
⋮----
/**
 * Build traces for additional Y-axes (y2, y3)
 */
function buildAdditionalAxisTraces(
  trades: EnrichedTrade[],
  xAxis: ChartAxisConfig,
  yAxis2?: ChartAxisConfig,
  yAxis3?: ChartAxisConfig,
  chartType?: ChartType
): Partial<PlotData>[]
⋮----
// Build Y2 trace
⋮----
// Sort by X for line charts
⋮----
// Build Y3 trace
⋮----
// Sort by X for line charts
⋮----
/**
 * Calculate Y-axis range with padding
 */
function calculateAxisRange(values: number[]): [number, number]
⋮----
// Check if we're using multi-axis (only for scatter/line)
⋮----
// When using multi-axis, don't use colorBy (it conflicts with axis coloring)
⋮----
// Build simple scatter for primary axis with axis color
⋮----
// For line charts with multi-axis, use axis colors
⋮----
// Add additional Y-axis traces for scatter/line
⋮----
// Show legend for categorical color fields OR when using multi-axis
⋮----
// Use date axis type for date fields
⋮----
// Calculate dynamic right margin based on number of axes
⋮----
rightMargin = 100 // Space for color bar
⋮----
// Y2 uses the default right side, Y3 shifts outward by 60px
⋮----
// Add Y2 axis config
⋮----
// Add Y3 axis config
```

## File: components/report-builder/filter-panel.tsx
```typescript
/**
 * Filter Panel
 *
 * Left panel of the Report Builder with flexible filter conditions.
 * Wrapped in React.memo for performance - only re-renders when props actually change.
 */
⋮----
import { memo } from 'react'
import { Lock, LockOpen, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import {
  FilterConfig,
  FilterCondition,
  StaticDatasetFieldInfo,
  createFilterCondition
} from '@/lib/models/report-config'
import { FlexibleFilterResult } from '@/lib/calculations/flexible-filter'
import { EnrichedTrade } from '@/lib/models/enriched-trade'
import { FilterConditionRow } from './filter-condition-row'
⋮----
interface FilterPanelProps {
  filterConfig: FilterConfig
  onFilterChange: (config: FilterConfig) => void
  filterResult: FlexibleFilterResult | null
  /** Enriched trades to extract custom fields from */
  trades?: EnrichedTrade[]
  /** Static datasets for field discovery */
  staticDatasets?: StaticDatasetFieldInfo[]
  /** Whether to keep filters when loading reports */
  keepFilters: boolean
  onKeepFiltersChange: (value: boolean) => void
}
⋮----
/** Enriched trades to extract custom fields from */
⋮----
/** Static datasets for field discovery */
⋮----
/** Whether to keep filters when loading reports */
⋮----
// Add a new filter condition
const handleAddCondition = () =>
⋮----
// Update an existing condition
const handleConditionChange = (updatedCondition: FilterCondition) =>
⋮----
// Remove a condition
const handleRemoveCondition = (conditionId: string) =>
⋮----
// Clear all conditions
const handleClearAll = () =>
⋮----
{/* Filter conditions */}
⋮----
{/* Add filter button */}
⋮----
{/* Filter summary */}
⋮----
{/* Clear button */}
```

## File: components/report-builder/threshold-chart.tsx
```typescript
/**
 * Threshold Analysis Chart
 *
 * A specialized chart for evaluating filter thresholds.
 * Shows 4 series with dual Y-axes:
 * - Primary axis (left, 0-100%): Cumulative % of trades, Cumulative % of P/L
 * - Secondary axis (right, $): Avg P/L above threshold, Avg P/L below threshold
 *
 * Helps users identify optimal entry/exit filter levels by showing:
 * - What % of trades would be filtered at each threshold
 * - What % of profits come from trades at each threshold
 * - Expected average returns above vs below each threshold
 */
⋮----
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { calculateThresholdAnalysis } from "@/lib/calculations/threshold-analysis";
import { EnrichedTrade } from "@/lib/models/enriched-trade";
import {
  ChartAxisConfig,
  ThresholdMetric,
  getFieldInfo,
} from "@/lib/models/report-config";
import type { Layout, PlotData } from "plotly.js";
import { useMemo } from "react";
import { WhatIfExplorer } from "./what-if-explorer";
⋮----
interface ThresholdChartProps {
  trades: EnrichedTrade[];
  xAxis: ChartAxisConfig;
  metric?: ThresholdMetric; // 'pl', 'plPct', or 'rom' - defaults to 'plPct'
  className?: string;
}
⋮----
metric?: ThresholdMetric; // 'pl', 'plPct', or 'rom' - defaults to 'plPct'
⋮----
// Calculate analysis
⋮----
// Trace 1: Cumulative % of trades (primary Y-axis)
⋮----
color: "rgb(59, 130, 246)", // Blue
⋮----
// Trace 2: Cumulative % of P/L (primary Y-axis)
⋮----
color: "rgb(16, 185, 129)", // Teal
⋮----
// Determine metric labels and formatting
⋮----
const formatValue = (v: number | null) =>
⋮----
// Get the correct values based on metric
const getAboveValue = (d: (typeof analysis.dataPoints)[0]) =>
const getBelowValue = (d: (typeof analysis.dataPoints)[0]) =>
⋮----
// Create a short field name for legend (e.g., "VIX" from "Opening VIX")
⋮----
// Trace 3: Avg metric above threshold (secondary Y-axis)
⋮----
color: "rgb(249, 115, 22)", // Orange - neutral color for "above"
⋮----
// Trace 4: Avg metric below threshold (secondary Y-axis)
⋮----
color: "rgb(139, 92, 246)", // Violet - neutral color for "below"
⋮----
// Calculate range for secondary axis (with padding)
⋮----
// Calculate range for primary axis (cumulative %)
// Cumulative P/L % can go outside 0-100 when early trades have different P/L signs
⋮----
const minCumulative = Math.min(0, ...allCumulativeValues); // Always include 0
const maxCumulative = Math.max(100, ...allCumulativeValues); // Always include 100
⋮----
{/* What-If Explorer - uses shared component */}
```

## File: components/trading-calendar/calendar-view.tsx
```typescript
import { useMemo } from 'react'
import { useTradingCalendarStore } from '@/lib/stores/trading-calendar-store'
import {
  formatCurrency,
  getDayBackgroundStyle,
  getMonthGridDates,
  getWeekGridDates,
  getFilteredScaledDayBacktestPl,
  getFilteredScaledDayActualPl,
  getFilteredTradeCounts,
  getScaledDayMargin
} from '@/lib/services/calendar-data'
import { cn } from '@/lib/utils'
⋮----
/**
 * Format date to YYYY-MM-DD in local timezone
 */
function formatDateKey(date: Date): string
⋮----
interface CalendarDayCellProps {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  onClick: () => void
}
⋮----
// Build matched strategy sets when in matched mode
⋮----
// Get filtered trade counts
⋮----
// In matched mode, only show days that have BOTH backtest AND actual trades from matched strategies
// This enables actual comparison. In all mode, show if either exists.
// IMPORTANT: Only show trade data for dates within the current month view
⋮----
// Determine what to show based on display mode
⋮----
// Get both P/L values (filtered)
⋮----
// Get background style - handles mismatch cases with stripes when showing both
⋮----
// Only check for mismatch when in 'both' mode and both data sources exist
⋮----
// Single mode - just use the displayed value
⋮----
{/* Top section: Date and P&L */}
⋮----
{/* Date number */}
⋮----
{/* Trade data */}
⋮----
{/* Single data source mode - larger, simpler display */}
⋮----
/* Both mode - compact with dots */
⋮----
{/* Bottom section: Margin - pinned to bottom */}
⋮----
// Build matched strategy sets when in matched mode
⋮----
// Calculate week totals for both backtest and actual (using scaled and filtered values)
// Only include dates from the current month in the weekly totals
⋮----
// Skip dates that are not in the current month
⋮----
// In matched mode, only count days that have BOTH backtest AND actual
⋮----
// Track max scaled margin for the week (only for included days)
⋮----
// Determine what to show based on display mode
⋮----
{/* Single data source mode - larger, simpler display */}
⋮----
<span className=
⋮----
/* Both mode - compact with dots */
⋮----
{/* Max margin for the week - only show when toggle is on and we have margin data */}
⋮----
// Get dates to display based on view mode
⋮----
// Group dates by week for weekly summaries
⋮----
{/* Weekday headers */}
⋮----
{/* Calendar grid */}
⋮----
onClick=
⋮----
{/* Legend */}
⋮----
{/* Data source legend - only show when in "both" mode */}
⋮----
{/* Background color legend */}
```

## File: lib/calculations/flexible-filter.ts
```typescript
/**
 * Flexible Filter Logic
 *
 * Applies user-defined filter conditions to trade data.
 * Works with EnrichedTrade objects which include derived fields.
 */
⋮----
import { EnrichedTrade } from '@/lib/models/enriched-trade'
import { FilterConfig, FilterCondition, FilterOperator } from '@/lib/models/report-config'
⋮----
/**
 * Result of applying filters to trades
 */
export interface FlexibleFilterResult {
  filteredTrades: EnrichedTrade[]
  totalCount: number
  matchCount: number
  matchPercent: number
}
⋮----
/**
 * Get the value of a field from a trade
 * Returns null if the field doesn't exist or has no value
 *
 * Supports:
 * - Standard fields: field name directly on trade (e.g., "openingVix")
 * - Custom trade fields: "custom.fieldName" (from trade.customFields)
 * - Daily custom fields: "daily.fieldName" (from trade.dailyCustomFields)
 * - Static dataset fields: "datasetName.column" (from trade.staticDatasetFields)
 */
function getTradeFieldValue(trade: EnrichedTrade, field: string): number | null
⋮----
// Handle custom trade fields (custom.fieldName)
⋮----
const customFieldName = field.slice(7) // Remove 'custom.' prefix
⋮----
// Handle daily custom fields (daily.fieldName)
⋮----
const dailyFieldName = field.slice(6) // Remove 'daily.' prefix
⋮----
// Handle static dataset fields (datasetName.column) - contains a dot but not custom. or daily.
⋮----
// Handle standard fields
⋮----
/**
 * Evaluate a single filter condition against a trade
 */
function evaluateCondition(trade: EnrichedTrade, condition: FilterCondition): boolean
⋮----
return true // Disabled conditions always pass
⋮----
// If the trade doesn't have this field, it doesn't match
⋮----
/**
 * Evaluate an operator comparison
 */
function evaluateOperator(
  value: number,
  operator: FilterOperator,
  compareValue: number,
  compareValue2?: number
): boolean
⋮----
/**
 * Apply filter conditions to a list of trades
 *
 * @param trades - The trades to filter
 * @param config - The filter configuration
 * @returns The filtered trades and statistics
 */
export function applyFilters(trades: EnrichedTrade[], config: FilterConfig): FlexibleFilterResult
⋮----
// If no conditions or all disabled, return all trades
⋮----
// Apply filters based on logic (AND or OR)
⋮----
// All conditions must pass
⋮----
// At least one condition must pass
⋮----
/**
 * Count trades matching each condition individually
 * Useful for showing condition impact in the UI
 */
export function countByCondition(
  trades: EnrichedTrade[],
  conditions: FilterCondition[]
): Map<string, number>
⋮----
/**
 * Get the range of values for a field across all trades
 * Useful for suggesting filter values
 */
export function getFieldRange(trades: EnrichedTrade[], field: string):
⋮----
/**
 * Get unique values for a field (useful for categorical filters)
 */
export function getUniqueValues(trades: EnrichedTrade[], field: string): number[]
```

## File: lib/services/calendar-data.ts
```typescript
/**
 * Calendar data service
 *
 * Provides utility functions for aggregating and scaling trade data
 * for the Trading Calendar feature.
 */
⋮----
import { std, mean } from 'mathjs'
import { Trade } from '@/lib/models/trade'
import { ReportingTrade } from '@/lib/models/reporting-trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { ScalingMode, StrategyMatch, CalendarDayData } from '@/lib/stores/trading-calendar-store'
import { PortfolioStatsCalculator } from '@/lib/calculations/portfolio-stats'
⋮----
/**
 * Configuration for risk metric calculations
 */
const RISK_FREE_RATE = 2.0 // 2% annual
const ANNUALIZATION_FACTOR = 252 // Business days
⋮----
/**
 * Scaled trade values based on the current scaling mode
 */
export interface ScaledTradeValues {
  pl: number
  premium: number
  contracts: number
  plPerContract: number
}
⋮----
/**
 * Strategy day comparison - aggregated data for one strategy on one day
 * Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual live trading
 */
export interface StrategyDayComparison {
  strategy: string
  date: string
  backtest: {
    trades: Trade[]
    totalPl: number
    totalPremium: number
    totalContracts: number
    /** First trade's contract count - used for scaling (strategy unit size) */
    unitContracts: number
    tradeCount: number
    totalCommissions: number
  } | null
  actual: {
    trades: ReportingTrade[]
    totalPl: number
    totalPremium: number
    totalContracts: number
    /** First trade's contract count - used for scaling (strategy unit size) */
    unitContracts: number
    tradeCount: number
  } | null
  isMatched: boolean
  // Scaled values
  scaled: {
    backtestPl: number | null
    actualPl: number | null
    slippage: number | null
    slippagePercent: number | null
  }
}
⋮----
/** First trade's contract count - used for scaling (strategy unit size) */
⋮----
/** First trade's contract count - used for scaling (strategy unit size) */
⋮----
// Scaled values
⋮----
/**
 * Scale a backtest trade's P&L to a target contract count
 * Note: Trade (from tradelog.csv) = backtest
 */
export function scaleBacktestPl(
  trade: Trade,
  targetContracts: number
): number
⋮----
/**
 * Get P&L per contract for an actual trade (ReportingTrade from strategylog.csv)
 */
export function getActualPlPerContract(trade: ReportingTrade): number
⋮----
/**
 * Get P&L per contract for a backtest trade (Trade from tradelog.csv, accounting for commissions)
 */
export function getBacktestPlPerContract(trade: Trade): number
⋮----
// =============================================================================
// Centralized Scaling Logic
// =============================================================================
⋮----
/**
 * Scaling context for a day or trade comparison
 * Extracts contract counts once to ensure consistency across all scaling calculations
 *
 * CRITICAL: Uses first trade's numContracts as "unit size", NOT the sum of all trades.
 * This is because numContracts represents the strategy's standard position size,
 * not the total across multiple legs/trades.
 */
export interface ScalingContext {
  btContracts: number      // First backtest trade's numContracts (unit size)
  actualContracts: number  // First actual trade's numContracts (unit size)
  hasBacktest: boolean
  hasActual: boolean
}
⋮----
btContracts: number      // First backtest trade's numContracts (unit size)
actualContracts: number  // First actual trade's numContracts (unit size)
⋮----
/**
 * Create scaling context from trades
 * Uses FIRST trade's contract count as "unit size" (not sum)
 *
 * @param backtestTrades Array of backtest trades (Trade from tradelog.csv)
 * @param actualTrades Array of actual trades (ReportingTrade from strategylog.csv)
 */
export function createScalingContext(
  backtestTrades: Trade[],
  actualTrades: ReportingTrade[]
): ScalingContext
⋮----
/**
 * Create scaling context from CalendarDayData
 * Convenience function for day-level scaling
 */
export function createScalingContextFromDay(dayData: CalendarDayData): ScalingContext
⋮----
/**
 * Calculate scale factor for a given mode and target
 * Returns null for raw mode (no scaling needed)
 *
 * Scaling rules:
 * - raw: No scaling (returns null)
 * - perContract: Divide by own contract count to get per-lot value
 * - toReported: Scale backtest DOWN to match actual contract count
 *
 * @param context Scaling context with contract counts
 * @param scalingMode Current scaling mode
 * @param target Which value we're scaling ('backtest' or 'actual')
 */
export function getScaleFactor(
  context: ScalingContext,
  scalingMode: ScalingMode,
  target: 'backtest' | 'actual'
): number | null
⋮----
// Divide by own contract count
⋮----
// scalingMode === 'toReported'
// Scale backtest DOWN to match actual contract count
// Actual stays as-is
⋮----
// Actual is unchanged in toReported mode
⋮----
/**
 * Apply scale factor to a P&L value
 * If scaleFactor is null, returns original value unchanged
 */
export function scalePl(pl: number, scaleFactor: number | null): number
⋮----
// =============================================================================
// Day-level Scaling Functions (for calendar cells)
// =============================================================================
⋮----
/**
 * Group trades by strategy for proper per-strategy scaling
 * A day may have multiple strategies with different contract counts
 */
function groupTradesByStrategy<T extends
⋮----
/**
 * Get scaled backtest P/L for a calendar day
 *
 * When a day has multiple strategies with different contract counts,
 * we must scale each strategy separately using its own contract count,
 * then sum the results.
 *
 * @param dayData Calendar day data
 * @param scalingMode Current scaling mode
 * @param strategyMatches Strategy mappings for toReported scaling (backtest -> actual name)
 */
export function getScaledDayBacktestPl(
  dayData: CalendarDayData,
  scalingMode: ScalingMode,
  strategyMatches: StrategyMatch[] = []
): number
⋮----
// Build backtest -> actual strategy name mapping for toReported mode
⋮----
// Group backtest trades by strategy
⋮----
// Group actual trades by strategy (needed for toReported mode)
⋮----
// Scale by own contract count
⋮----
// Look up the ACTUAL strategy name that corresponds to this backtest strategy
⋮----
// No matching actual or zero contracts - use raw value
⋮----
/**
 * Get scaled actual P/L for a calendar day
 *
 * Actual trades only scale in perContract mode (toReported leaves them as-is)
 *
 * @param dayData Calendar day data
 * @param scalingMode Current scaling mode
 */
export function getScaledDayActualPl(
  dayData: CalendarDayData,
  scalingMode: ScalingMode
): number
⋮----
// perContract mode - scale each strategy by its own contract count
⋮----
/**
 * Get scaled margin for a calendar day
 * Margin comes from backtest trades only, scaled per-strategy
 *
 * @param dayData Calendar day data
 * @param scalingMode Current scaling mode
 */
export function getScaledDayMargin(
  dayData: CalendarDayData,
  scalingMode: ScalingMode
): number
⋮----
// Group backtest trades by strategy
⋮----
// Group actual trades by strategy (needed for toReported mode)
⋮----
// =============================================================================
// Filtered Day-level Scaling Functions (for matched-only mode)
// =============================================================================
⋮----
/**
 * Get scaled backtest P/L for a calendar day, filtered to matched strategies only
 *
 * IMPORTANT: In matched mode, we only include backtest trades where the corresponding
 * actual trade ALSO exists on this same day. This ensures proper comparison.
 *
 * @param dayData Calendar day data
 * @param scalingMode Current scaling mode
 * @param matchedBacktestStrategies Set of backtest strategy names that have matches (globally)
 * @param strategyMatches Strategy mappings for toReported scaling (backtest -> actual name)
 */
export function getFilteredScaledDayBacktestPl(
  dayData: CalendarDayData,
  scalingMode: ScalingMode,
  matchedBacktestStrategies: Set<string> | null,
  strategyMatches: StrategyMatch[] = []
): number
⋮----
// If no filter, use standard function
⋮----
// Build backtest -> actual strategy name mapping
⋮----
// Get actual strategies present on THIS day
⋮----
// Filter backtest trades to only those where:
// 1. The strategy is in the global matched set
// 2. The corresponding actual strategy has trades on THIS day
⋮----
// Group filtered backtest trades by strategy
⋮----
// Group actual trades by strategy (needed for toReported mode)
⋮----
// Look up the ACTUAL strategy name that corresponds to this backtest strategy
⋮----
// This shouldn't happen since we filtered above, but fallback to raw
⋮----
/**
 * Get scaled actual P/L for a calendar day, filtered to matched strategies only
 *
 * IMPORTANT: In matched mode, we only include actual trades where the corresponding
 * backtest trade ALSO exists on this same day. This ensures proper comparison.
 *
 * @param dayData Calendar day data
 * @param scalingMode Current scaling mode
 * @param matchedActualStrategies Set of actual strategy names that have matches (globally)
 * @param strategyMatches Strategy mappings for filtering (backtest -> actual name)
 */
export function getFilteredScaledDayActualPl(
  dayData: CalendarDayData,
  scalingMode: ScalingMode,
  matchedActualStrategies: Set<string> | null,
  strategyMatches: StrategyMatch[] = []
): number
⋮----
// If no filter, use standard function
⋮----
// Build actual -> backtest strategy name mapping
⋮----
// Get backtest strategies present on THIS day
⋮----
// Filter actual trades to only those where:
// 1. The strategy is in the global matched set
// 2. The corresponding backtest strategy has trades on THIS day
⋮----
// perContract mode - scale each strategy by its own contract count
⋮----
/**
 * Get filtered trade counts for a calendar day
 *
 * IMPORTANT: In matched mode, we only count trades where BOTH backtest and actual
 * exist on the same day for that strategy. This ensures proper comparison.
 *
 * @param dayData Calendar day data
 * @param matchedBacktestStrategies Set of backtest strategy names that have matches (globally)
 * @param matchedActualStrategies Set of actual strategy names that have matches (globally)
 * @param strategyMatches Strategy mappings for filtering (backtest -> actual name)
 */
export function getFilteredTradeCounts(
  dayData: CalendarDayData,
  matchedBacktestStrategies: Set<string> | null,
  matchedActualStrategies: Set<string> | null,
  strategyMatches: StrategyMatch[] = []
):
⋮----
// Build mappings
⋮----
// Get strategies present on THIS day
⋮----
// Count backtest trades where actual exists on same day
⋮----
// Count actual trades where backtest exists on same day
⋮----
// =============================================================================
// Original Trade-level Scaling (preserved for backward compatibility)
// =============================================================================
⋮----
/**
 * Scale trade values based on scaling mode
 * Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual
 */
export function scaleTradeValues(
  backtestTrade: Trade | null,
  actualTrade: ReportingTrade | null,
  scalingMode: ScalingMode
):
⋮----
slippage: null // Not meaningful in raw mode with different contract counts
⋮----
// scalingMode === 'toReported'
// Scale backtest DOWN to match actual (reported) contract count
// backtest = Trade (large contracts), actual = ReportingTrade (small contracts = reported live trading)
⋮----
// Scale backtest DOWN to match actual (reported) contract count
⋮----
/**
 * Aggregate trades by strategy for a single day
 */
export function aggregateTradesByStrategy(
  dayData: CalendarDayData,
  strategyMatches: StrategyMatch[]
): StrategyDayComparison[]
⋮----
// Create lookup maps
const matchLookup = new Map<string, string>() // backtest -> actual
const reverseMatchLookup = new Map<string, string>() // actual -> backtest
⋮----
// Group backtest trades by strategy (Trade from tradelog.csv)
⋮----
// Group actual trades by strategy (ReportingTrade from strategylog.csv)
⋮----
// Process matched strategies
⋮----
// Add unmatched actual strategies
⋮----
// Sort by strategy name
⋮----
/**
 * Aggregate backtest trades (Trade from tradelog.csv)
 */
function aggregateBacktestTrades(trades: Trade[])
⋮----
// Unit size = first trade's contract count (for scaling), NOT the sum
⋮----
/**
 * Aggregate actual trades (ReportingTrade from strategylog.csv)
 */
function aggregateActualTrades(trades: ReportingTrade[])
⋮----
// Unit size = first trade's contract count (for scaling), NOT the sum
⋮----
/**
 * Scale aggregated strategy comparison values
 *
 * IMPORTANT: Uses unitContracts (first trade's count) for scaling, NOT totalContracts.
 * This is consistent with the centralized scaling functions.
 */
export function scaleStrategyComparison(
  comparison: StrategyDayComparison,
  scalingMode: ScalingMode
): StrategyDayComparison
⋮----
// Use unitContracts (first trade's count) for scaling, falling back to totalContracts for backward compat
⋮----
// scalingMode === 'toReported'
// Scale backtest (Trade, more contracts) DOWN to match actual (ReportingTrade, fewer contracts)
⋮----
// Scale backtest P/L DOWN to match actual (reported) contract count
⋮----
/**
 * Format currency for display
 */
export function formatCurrency(value: number, compact = false): string
⋮----
/**
 * Format percentage for display
 */
export function formatPercent(value: number): string
⋮----
/**
 * Get color class based on P/L value
 */
export function getPlColorClass(pl: number): string
⋮----
/**
 * Get background style for calendar day cells
 * Handles mismatch cases (backtest vs actual disagree) with a distinct color
 * Returns a className string
 */
export function getDayBackgroundStyle(
  backtestPl: number | null,
  actualPl: number | null
):
⋮----
// Check for mismatch: one positive, one negative
⋮----
// Muted violet for mismatch - visually distinct from green/red
⋮----
// No mismatch - use single color based on available data (prefer actual)
⋮----
/**
 * Calculate max absolute P/L across calendar days for heatmap scaling
 */
export function calculateMaxAbsPl(days: Map<string, CalendarDayData>): number
⋮----
/**
 * Get dates for a month grid (includes padding days from adjacent months)
 */
export function getMonthGridDates(year: number, month: number): Date[]
⋮----
// First day of the month
⋮----
// Last day of the month
⋮----
// Start from Sunday of the week containing the first day
⋮----
// End on Saturday of the week containing the last day
⋮----
// Generate all dates
⋮----
/**
 * Get dates for a week grid
 */
export function getWeekGridDates(date: Date): Date[]
⋮----
// Get to Sunday
⋮----
/**
 * Group dates by week for weekly summary calculation
 */
export function groupDatesByWeek(dates: Date[]): Map<number, Date[]>
⋮----
/**
 * Get ISO week number
 */
function getISOWeekNumber(date: Date): number
⋮----
/**
 * Format date to YYYY-MM-DD key
 */
function formatDateKey(date: Date): string
⋮----
/**
 * Advanced performance metrics calculated from daily logs
 */
export interface AdvancedPerformanceMetrics {
  sharpe: number | null
  sortino: number | null
  maxDrawdown: number | null
  cagr: number | null
  calmar: number | null
}
⋮----
/**
 * Trade-based metrics calculated from trade data
 */
export interface TradeBasedMetrics {
  winRate: number
  avgRom: number | null // Return on Margin - only for actual trades
  avgPremiumCapture: number | null
  totalPl: number
  tradeCount: number
  tradingDays: number
}
⋮----
avgRom: number | null // Return on Margin - only for actual trades
⋮----
/**
 * Calculate advanced metrics from daily log entries filtered to a date range.
 * If daily logs don't have enough data, returns null values - the caller is
 * responsible for falling back to trade-based calculations (using PortfolioStatsCalculator).
 * These metrics require a time series of daily returns.
 */
export function calculateAdvancedMetrics(
  dailyLogs: DailyLogEntry[],
  startDate: string,
  endDate: string
): AdvancedPerformanceMetrics
⋮----
// Filter daily logs to date range
⋮----
// If we have daily logs, use them
⋮----
// No data available - caller should fall back to trade-based calculation
⋮----
/**
 * Calculate advanced metrics from daily log entries
 */
function calculateMetricsFromDailyLogs(
  filteredLogs: DailyLogEntry[]
): AdvancedPerformanceMetrics
⋮----
// Calculate daily returns from net liquidity
⋮----
// Calculate Sharpe Ratio
⋮----
// Calculate Sortino Ratio
⋮----
// Max Drawdown from daily log drawdownPct
⋮----
// CAGR calculation
⋮----
// Calmar Ratio = CAGR / Max Drawdown
⋮----
/**
 * Calculate trade-based metrics from trades in a date range
 * Works with both actual trades (Trade) and backtest trades (ReportingTrade)
 *
 * Note: avgRom is ALWAYS calculated from backtest trades (Trade type) since only
 * they have marginReq. This ensures RoM is available even when useActual is true.
 */
export function calculateTradeMetrics(
  calendarDays: Map<string, CalendarDayData>,
  startDate: string,
  endDate: string,
  useActual: boolean
): TradeBasedMetrics
⋮----
// Actual trades (ReportingTrade) - calculate premium capture
⋮----
// Backtest trades (Trade) - calculate premium capture and count
⋮----
// Premium capture
⋮----
// ALWAYS calculate RoM from backtest trades since only Trade type has marginReq
// This ensures avgRom is available regardless of useActual setting
⋮----
/**
 * Calculate Return on Margin for actual trades (Trade type only)
 * ReportingTrade doesn't have marginReq field
 */
export function calculateAvgRomFromTrades(trades: Trade[]): number | null
⋮----
/**
 * Calculate average premium capture for trades
 */
export function calculateAvgPremiumCapture(
  backtestTrades: Trade[],
  actualTrades: ReportingTrade[],
  useActual: boolean
): number | null
⋮----
/**
 * Day-specific performance metrics
 * These are metrics that can be calculated for a single day of trading
 * Uses the same calculation approach as the block stats page
 */
export interface DayPerformanceMetrics {
  maxDrawdown: number | null  // Max drawdown for the day's trades
  avgRom: number | null       // Average Return on Margin
  avgPremiumCapture: number | null  // Average premium captured
}
⋮----
maxDrawdown: number | null  // Max drawdown for the day's trades
avgRom: number | null       // Average Return on Margin
avgPremiumCapture: number | null  // Average premium captured
⋮----
/**
 * Calculate performance metrics for a single day
 * Uses PortfolioStatsCalculator for consistency with block stats page
 */
export function calculateDayMetrics(
  dayData: CalendarDayData
): DayPerformanceMetrics
⋮----
// Use backtest trades (Trade type) since they have the full data needed for calculations
// (marginReq, premium, fundsAtClose, etc.)
⋮----
// Use PortfolioStatsCalculator for max drawdown - same as block stats
⋮----
// Max drawdown from portfolio stats
⋮----
// Calculate Avg RoM (same approach as block stats)
⋮----
// Calculate Avg Premium Capture
```

## File: lib/stores/settings-store.ts
```typescript
/**
 * Global Settings Store
 *
 * Manages saved report configurations for the Report Builder.
 * Settings are persisted to localStorage.
 */
⋮----
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ReportConfig } from '@/lib/models/report-config'
⋮----
// ============================================================================
// Built-in Saved Reports (Flexible Chart Builder)
// ============================================================================
⋮----
// Market Analysis
⋮----
// MFE/MAE Analysis
⋮----
// Return Metrics
⋮----
// Timing Analysis
⋮----
// Risk Analysis
⋮----
// Table Reports (grouped with Market Analysis)
⋮----
// Threshold Analysis
⋮----
// ============================================================================
// Store Interface
// ============================================================================
⋮----
interface SettingsStore {
  // State
  savedReports: ReportConfig[]
  isInitialized: boolean

  // Actions - Saved Reports
  saveReport: (report: Omit<ReportConfig, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>) => string
  updateReport: (id: string, updates: Partial<Omit<ReportConfig, 'id' | 'isBuiltIn'>>) => void
  deleteReport: (id: string) => void

  // Getters
  getReportById: (id: string) => ReportConfig | undefined

  // Initialization
  initialize: () => void
  reset: () => void
}
⋮----
// State
⋮----
// Actions - Saved Reports
⋮----
// Getters
⋮----
// Initialization
⋮----
// ============================================================================
// Store Implementation
// ============================================================================
⋮----
// Initial state
⋮----
// Initialize with built-in reports on first load
// Always merges built-in items to ensure they're present after updates
⋮----
// Get user-defined items (not built-in)
⋮----
// Always set built-ins + user items (ensures new built-ins are added on app updates)
⋮----
// Saved Reports management
⋮----
if (report?.isBuiltIn) return // Cannot update built-in reports
⋮----
if (report?.isBuiltIn) return // Cannot delete built-in reports
⋮----
// Getters
⋮----
// Reset to defaults
⋮----
// Only persist specific fields
⋮----
// Handle rehydration
⋮----
// Initialize will be called by the app to merge built-ins
⋮----
// ============================================================================
// Selectors (for use with shallow comparison)
// ============================================================================
⋮----
export const selectSavedReports = (state: SettingsStore)
```

## File: app/(platform)/static-datasets/page.tsx
```typescript
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Search, Database, Info } from "lucide-react"
import { useStaticDatasetsStore } from "@/lib/stores/static-datasets-store"
import { useBlockStore } from "@/lib/stores/block-store"
import { DatasetCard } from "@/components/static-datasets/dataset-card"
import { UploadDialog } from "@/components/static-datasets/upload-dialog"
import { PreviewModal } from "@/components/static-datasets/preview-modal"
import type { StaticDataset } from "@/lib/models/static-dataset"
import type { Trade } from "@/lib/models/trade"
import { getTradesByBlock } from "@/lib/db"
⋮----
// Load datasets on mount
⋮----
// Load active block trades for match stats
// Re-fetch when trade count changes (after import/recalculation)
⋮----
// Invalidate cached match stats for this block since trades may have changed
⋮----
const loadTrades = async () =>
⋮----
// Filter datasets based on search query
⋮----
const handlePreview = (dataset: StaticDataset) =>
⋮----
{/* Header */}
⋮----
<Button onClick=
⋮----
{/* Active Block Info */}
⋮----
{/* Datasets Section */}
⋮----
{/* Loading State */}
⋮----
{/* Search Empty State */}
⋮----
{/* Empty State */}
⋮----
{/* Dataset Grid */}
⋮----
{/* Upload Dialog */}
⋮----
{/* Preview Modal */}
```

## File: components/report-builder/chart-axis-selector.tsx
```typescript
/**
 * Chart Axis Selector
 *
 * Dropdown component for selecting a field to use as an axis in charts.
 * Uses nested submenus organized by field category.
 * Supports both static fields and custom fields from trade/daily log CSVs.
 */
⋮----
import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  getFieldsByCategoryWithAll,
  getFieldInfo,
  getAllCategoryLabels,
  FieldCategory,
  CustomFieldCategory,
  StaticDatasetFieldInfo
} from '@/lib/models/report-config'
import { EnrichedTrade } from '@/lib/models/enriched-trade'
⋮----
interface ChartAxisSelectorProps {
  label: string
  value: string
  onChange: (value: string) => void
  allowNone?: boolean
  className?: string
  /** Enriched trades to extract custom fields from */
  trades?: EnrichedTrade[]
  /** Static datasets for field discovery */
  staticDatasets?: StaticDatasetFieldInfo[]
}
⋮----
/** Enriched trades to extract custom fields from */
⋮----
/** Static datasets for field discovery */
⋮----
// Get the display label for the current value
⋮----
const handleSelect = (fieldValue: string) =>
⋮----
<DropdownMenuItem onClick=
⋮----
// Use category label from known categories, or the category name itself (for static datasets)
```

## File: components/app-sidebar.tsx
```typescript
import {
  IconCalendar,
  IconChartHistogram,
  IconDatabase,
  IconGauge,
  IconLayoutDashboard,
  IconReportAnalytics,
  IconRouteSquare,
  IconSparkles,
  IconStack2,
  IconTimelineEvent,
  IconTrendingDown,
} from "@tabler/icons-react";
import { Blocks } from "lucide-react";
import Link from "next/link";
⋮----
import { useBlockStore } from "@/lib/stores/block-store";
⋮----
import { NavMain } from "@/components/nav-main";
import { SidebarActiveBlocks } from "@/components/sidebar-active-blocks";
import { SidebarFooterLegal } from "@/components/sidebar-footer-legal";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
⋮----
export function AppSidebar(
⋮----
// Load blocks from IndexedDB on mount
```

## File: lib/calculations/static-dataset-matcher.ts
```typescript
/**
 * Static Dataset Matcher
 *
 * Matches trades to static dataset rows based on configurable matching strategies.
 * Used for correlating trades with market data (VIX, SPX, etc.) at trade entry time.
 */
⋮----
import type { Trade } from '../models/trade'
import type {
  StaticDataset,
  StaticDatasetRow,
  MatchStrategy,
  DatasetMatchResult,
  DatasetMatchStats,
} from '../models/static-dataset'
⋮----
/**
 * Combine trade date and time into a single timestamp
 *
 * IMPORTANT: Trade dates from CSV parsing are stored as UTC midnight (e.g., 2025-03-18T00:00:00Z)
 * because JavaScript parses YYYY-MM-DD format as UTC. The time string is in Eastern Time
 * (US market time from the trading platform).
 *
 * This function handles both:
 * 1. UTC midnight dates (from ISO string parsing) - uses UTC methods to extract calendar date
 * 2. Local midnight dates (from new Date(y,m,d)) - uses local methods to extract calendar date
 *
 * We then create the timestamp treating the time as Eastern Time, ensuring matching works
 * correctly regardless of the user's local timezone.
 */
export function combineDateAndTime(dateOpened: Date, timeOpened: string): Date
⋮----
// Determine if this is a UTC midnight date (from ISO string parsing)
// or a local midnight date (from new Date(y,m,d))
⋮----
// Extract calendar date using appropriate methods based on how date was created
⋮----
// Date was created from ISO string (e.g., new Date('2025-03-18'))
// Use UTC methods to get the calendar date
⋮----
// Date was created from components (e.g., new Date(2024, 0, 15))
// Use local methods to get the calendar date
⋮----
// Parse time string (HH:mm:ss or H:mm:ss)
⋮----
// Create the timestamp in UTC, treating the input time as Eastern Time
// Eastern Time is UTC-5 (EST) or UTC-4 (EDT)
⋮----
// Get the Eastern Time offset for this date (handles DST correctly)
⋮----
// Convert Eastern Time to UTC by subtracting the offset
// (offset is negative for west of UTC, so we subtract)
⋮----
/**
 * Get the Eastern Time offset in minutes for a given date
 * Returns the offset from UTC in minutes (e.g., -300 for EST, -240 for EDT)
 */
function getEasternTimeOffset(date: Date): number
⋮----
// Use Intl to get the actual offset for America/New_York
// This correctly handles DST transitions
⋮----
// Parse offset like "GMT-5" or "GMT-4"
⋮----
// Fallback: assume EST (-5 hours = -300 minutes)
⋮----
/**
 * Match a single trade to a dataset row using the specified strategy
 */
export function matchTradeToDataset(
  trade: Trade,
  rows: StaticDatasetRow[],
  strategy: MatchStrategy
): StaticDatasetRow | null
⋮----
/**
 * Get the date-only portion of a timestamp as YYYY-MM-DD string in Eastern Time
 * This ensures we're comparing calendar dates in the trading timezone
 */
function getDateOnly(date: Date): string
⋮----
// Format the date in Eastern Time to get the correct calendar date
⋮----
return formatter.format(date) // Returns YYYY-MM-DD format
⋮----
/**
 * Find a row that matches the same calendar day as the trade
 * Uses binary search for efficiency
 */
function matchSameDay(rows: StaticDatasetRow[], tradeTimestamp: Date): StaticDatasetRow | null
⋮----
// Binary search to find any row on the same day
⋮----
/**
 * Find an exact timestamp match
 */
function matchExact(rows: StaticDatasetRow[], tradeTime: number): StaticDatasetRow | null
⋮----
// Use binary search for efficiency
⋮----
/**
 * Find the nearest row at or before the trade time
 */
function matchNearestBefore(rows: StaticDatasetRow[], tradeTime: number): StaticDatasetRow | null
⋮----
// Binary search for the rightmost element <= tradeTime
⋮----
/**
 * Find the nearest row at or after the trade time
 */
function matchNearestAfter(rows: StaticDatasetRow[], tradeTime: number): StaticDatasetRow | null
⋮----
// Binary search for the leftmost element >= tradeTime
⋮----
/**
 * Find the nearest row by absolute time difference
 * Constrained to the same calendar day (in Eastern Time) to prevent
 * matching to data from days away when trade is outside dataset range
 */
function matchNearest(rows: StaticDatasetRow[], tradeTime: number): StaticDatasetRow | null
⋮----
// Find candidates using binary search
⋮----
// Get the trade's calendar date in Eastern Time
⋮----
// Filter candidates to same day only
⋮----
// Compare distances
⋮----
/**
 * Match a trade to a dataset and return detailed result
 */
export function matchTradeToDatasetWithDetails(
  trade: Trade,
  dataset: StaticDataset,
  rows: StaticDatasetRow[]
): DatasetMatchResult
⋮----
/**
 * Match multiple trades to a dataset and return all results
 */
export function matchTradesToDataset(
  trades: Trade[],
  dataset: StaticDataset,
  rows: StaticDatasetRow[]
): DatasetMatchResult[]
⋮----
/**
 * Calculate match statistics for preview display
 */
export function calculateMatchStats(
  trades: Trade[],
  dataset: StaticDataset,
  rows: StaticDatasetRow[]
): DatasetMatchStats
⋮----
// Extend end date to end-of-day (23:59:59.999 Eastern) so trades during the final day match
// Get the date in Eastern Time, then calculate end-of-day in that timezone
⋮----
const endDateStr = getDateOnly(endDate) // Gets YYYY-MM-DD in Eastern Time
⋮----
// Create 23:59:59.999 in Eastern Time
⋮----
// Convert from Eastern to UTC
⋮----
// Check if trade is outside dataset date range
⋮----
// Try to match
⋮----
/**
 * Get matched values for a trade from all available datasets
 * Returns a map of datasetName -> columnName -> value
 */
export function getMatchedValuesForTrade(
  trade: Trade,
  datasets: Array<{ dataset: StaticDataset; rows: StaticDatasetRow[] }>
): Record<string, Record<string, number | string>>
⋮----
/**
 * Get a specific value from matched datasets for a trade
 * Field format: "datasetName.columnName" (e.g., "vix.close")
 */
export function getMatchedFieldValue(
  trade: Trade,
  field: string,
  datasets: Array<{ dataset: StaticDataset; rows: StaticDatasetRow[] }>
): number | string | null
⋮----
/**
 * Format time difference for display
 */
export function formatTimeDifference(diffMs: number | null): string
```

## File: components/report-builder/filter-condition-row.tsx
```typescript
/**
 * Filter Condition Row
 *
 * A single filter condition editor with field, operator, and value inputs.
 * Supports both static fields and custom fields from trade/daily log CSVs.
 */
⋮----
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Still used for operator selector
⋮----
} from "@/components/ui/select"; // Still used for operator selector
import { Switch } from "@/components/ui/switch";
import {
  FILTER_OPERATOR_LABELS,
  FilterCondition,
  FilterOperator,
  FieldCategory,
  CustomFieldCategory,
  StaticDatasetFieldInfo,
  getFieldInfo,
  getFieldsByCategoryWithAll,
  getAllCategoryLabels,
} from "@/lib/models/report-config";
import { EnrichedTrade } from "@/lib/models/enriched-trade";
import { ChevronDown, X } from "lucide-react";
⋮----
interface FilterConditionRowProps {
  condition: FilterCondition;
  onChange: (condition: FilterCondition) => void;
  onRemove: () => void;
  /** Enriched trades to extract custom fields from */
  trades?: EnrichedTrade[];
  /** Static datasets for field discovery */
  staticDatasets?: StaticDatasetFieldInfo[];
}
⋮----
/** Enriched trades to extract custom fields from */
⋮----
/** Static datasets for field discovery */
⋮----
// Get the display label for the current field
⋮----
const handleFieldChange = (field: string) =>
⋮----
const handleOperatorChange = (operator: string) =>
⋮----
const handleValueBlur = () =>
⋮----
const handleValue2Blur = () =>
⋮----
const handleEnabledChange = (enabled: boolean) =>
⋮----
{/* Row 1: Toggle, Field selector, Remove button */}
⋮----
// Use category label from known categories, or the category name itself (for static datasets)
⋮----
handleFieldChange(field.field);
setFieldDropdownOpen(false);
⋮----
{/* Row 2: Operator and Value(s) */}
```

## File: lib/models/enriched-trade.ts
```typescript
/**
 * Enriched Trade Model
 *
 * Extends the base Trade interface with pre-computed derived fields
 * for use in the Report Builder and other analysis components.
 */
⋮----
import { Trade } from './trade'
⋮----
/**
 * Trade with all derived/calculated fields pre-computed
 */
export interface EnrichedTrade extends Trade {
  // MFE/MAE metrics (from calculateMFEMAEData)
  mfePercent?: number           // MFE as % of premium/margin
  maePercent?: number           // MAE as % of premium/margin
  profitCapturePercent?: number // P/L / MFE * 100 - what % of peak profit was captured
  excursionRatio?: number       // MFE / MAE (reward/risk ratio)
  shortLongRatioChange?: number // Closing SLR / Opening SLR
  shortLongRatioChangePct?: number // SLR % change

  // Return metrics
  rom?: number                  // Return on Margin (P/L / margin * 100)
  premiumEfficiency?: number    // P/L / premium * 100
  plPct?: number                // Alias for premiumEfficiency (P/L %)
  netPlPct?: number             // Net P/L / premium * 100 (after fees)

  // Timing
  durationHours?: number        // Holding period in hours
  dayOfWeek?: number            // 0-6 (Sun-Sat) when trade was opened
  hourOfDay?: number            // 0-23 when trade was opened
  timeOfDayMinutes?: number     // Minutes since midnight (e.g., 11:45 = 705)
  dayOfMonth?: number           // 1-31 when trade was opened
  monthOfYear?: number          // 1-12 (Jan-Dec) when trade was opened
  weekOfYear?: number           // ISO week number (1-52)
  dateOpenedTimestamp?: number  // Unix timestamp (ms) for charting over time

  // Costs & Net
  totalFees?: number            // Opening + closing fees
  netPl?: number                // P/L after fees

  // VIX changes
  vixChange?: number            // Closing VIX - Opening VIX
  vixChangePct?: number         // VIX % change

  // Risk metrics
  rMultiple?: number            // P/L / MAE (risk multiples won/lost)
  isWinner?: number             // 1 if win, 0 if loss (for aggregations)

  // Sequential
  tradeNumber?: number          // 1-indexed trade sequence

  // Custom fields from trade CSV (inherited from Trade.customFields)
  // customFields?: Record<string, number | string> - already inherited from Trade

  // Custom fields from daily log, joined by trade date
  // Prefixed with "daily." in field references for Report Builder
  dailyCustomFields?: Record<string, number | string>

  // Static dataset fields, matched by timestamp
  // Keyed by dataset name, containing matched column values
  // Field references use format "datasetName.column"
  staticDatasetFields?: Record<string, Record<string, number | string>>
}
⋮----
// MFE/MAE metrics (from calculateMFEMAEData)
mfePercent?: number           // MFE as % of premium/margin
maePercent?: number           // MAE as % of premium/margin
profitCapturePercent?: number // P/L / MFE * 100 - what % of peak profit was captured
excursionRatio?: number       // MFE / MAE (reward/risk ratio)
shortLongRatioChange?: number // Closing SLR / Opening SLR
shortLongRatioChangePct?: number // SLR % change
⋮----
// Return metrics
rom?: number                  // Return on Margin (P/L / margin * 100)
premiumEfficiency?: number    // P/L / premium * 100
plPct?: number                // Alias for premiumEfficiency (P/L %)
netPlPct?: number             // Net P/L / premium * 100 (after fees)
⋮----
// Timing
durationHours?: number        // Holding period in hours
dayOfWeek?: number            // 0-6 (Sun-Sat) when trade was opened
hourOfDay?: number            // 0-23 when trade was opened
timeOfDayMinutes?: number     // Minutes since midnight (e.g., 11:45 = 705)
dayOfMonth?: number           // 1-31 when trade was opened
monthOfYear?: number          // 1-12 (Jan-Dec) when trade was opened
weekOfYear?: number           // ISO week number (1-52)
dateOpenedTimestamp?: number  // Unix timestamp (ms) for charting over time
⋮----
// Costs & Net
totalFees?: number            // Opening + closing fees
netPl?: number                // P/L after fees
⋮----
// VIX changes
vixChange?: number            // Closing VIX - Opening VIX
vixChangePct?: number         // VIX % change
⋮----
// Risk metrics
rMultiple?: number            // P/L / MAE (risk multiples won/lost)
isWinner?: number             // 1 if win, 0 if loss (for aggregations)
⋮----
// Sequential
tradeNumber?: number          // 1-indexed trade sequence
⋮----
// Custom fields from trade CSV (inherited from Trade.customFields)
// customFields?: Record<string, number | string> - already inherited from Trade
⋮----
// Custom fields from daily log, joined by trade date
// Prefixed with "daily." in field references for Report Builder
⋮----
// Static dataset fields, matched by timestamp
// Keyed by dataset name, containing matched column values
// Field references use format "datasetName.column"
⋮----
/**
 * Get numeric value from an enriched trade for a given field
 *
 * Supports:
 * - Standard fields: field name directly on trade (e.g., "openingVix")
 * - Custom trade fields: "custom.fieldName" (from trade.customFields)
 * - Daily custom fields: "daily.fieldName" (from trade.dailyCustomFields)
 *
 * @param trade - The enriched trade to extract the value from
 * @param field - Field name (may be prefixed with "custom." or "daily.")
 * @returns The numeric value or null if not found/not a number
 */
export function getEnrichedTradeValue(trade: EnrichedTrade, field: string): number | null
⋮----
// Handle custom trade fields (custom.fieldName)
⋮----
const customFieldName = field.slice(7) // Remove 'custom.' prefix
⋮----
// Handle daily custom fields (daily.fieldName)
⋮----
const dailyFieldName = field.slice(6) // Remove 'daily.' prefix
⋮----
// Handle static dataset fields (datasetName.column) - contains a dot but not custom. or daily.
⋮----
// Handle standard fields
```

## File: lib/stores/static-datasets-store.ts
```typescript
/**
 * Static Datasets Store
 *
 * Zustand store for managing static datasets UI state and coordinating
 * with IndexedDB storage.
 */
⋮----
import { create } from 'zustand'
import type { StaticDataset, StaticDatasetRow, MatchStrategy } from '../models/static-dataset'
import {
  getAllStaticDatasets,
  createStaticDataset,
  updateStaticDatasetMatchStrategy,
  updateStaticDatasetName,
  isDatasetNameTaken,
} from '../db/static-datasets-store'
import {
  addStaticDatasetRows,
  getStaticDatasetRows,
  deleteStaticDatasetWithRows,
} from '../db/static-dataset-rows-store'
import {
  processStaticDatasetFile,
  validateDatasetName,
} from '../processing/static-dataset-processor'
import { calculateMatchStats } from '../calculations/static-dataset-matcher'
import type { ParseProgress } from '../processing/csv-parser'
import type { Trade } from '../models/trade'
import type { DatasetMatchStats } from '../models/static-dataset'
⋮----
/**
 * Cache key format: datasetId:blockId:matchStrategy
 * Exported for use in components that subscribe to specific cache entries
 */
export function makeMatchStatsCacheKey(datasetId: string, blockId: string, matchStrategy: MatchStrategy): string
⋮----
interface StaticDatasetsState {
  // State
  datasets: StaticDataset[]
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Cached rows for preview (loaded on demand)
  cachedRows: Map<string, StaticDatasetRow[]>

  // Cached match stats: key = datasetId:blockId:matchStrategy
  cachedMatchStats: Map<string, DatasetMatchStats>

  // Track which stats are currently being computed to avoid duplicates
  computingMatchStats: Set<string>

  // Actions
  loadDatasets: () => Promise<void>
  uploadDataset: (
    file: File,
    name: string,
    onProgress?: (progress: ParseProgress) => void
  ) => Promise<{ success: boolean; error?: string; dataset?: StaticDataset }>
  deleteDataset: (id: string) => Promise<void>
  updateMatchStrategy: (id: string, strategy: MatchStrategy) => Promise<void>
  renameDataset: (id: string, newName: string) => Promise<{ success: boolean; error?: string }>
  getDatasetRows: (id: string) => Promise<StaticDatasetRow[]>
  clearCachedRows: (id?: string) => void
  validateName: (name: string, excludeId?: string) => Promise<{ valid: boolean; error?: string }>

  // Match stats caching
  getMatchStats: (datasetId: string, blockId: string, matchStrategy: MatchStrategy) => DatasetMatchStats | null
  computeMatchStats: (datasetId: string, blockId: string, trades: Trade[], matchStrategy: MatchStrategy) => Promise<DatasetMatchStats | null>
  isComputingMatchStats: (datasetId: string, blockId: string, matchStrategy: MatchStrategy) => boolean
  invalidateMatchStatsForBlock: (blockId: string) => void
  invalidateMatchStatsForDataset: (datasetId: string) => void
}
⋮----
// State
⋮----
// Cached rows for preview (loaded on demand)
⋮----
// Cached match stats: key = datasetId:blockId:matchStrategy
⋮----
// Track which stats are currently being computed to avoid duplicates
⋮----
// Actions
⋮----
// Match stats caching
⋮----
// Initial state
⋮----
// Load all datasets from IndexedDB
⋮----
// Prevent multiple concurrent loads
⋮----
// Upload a new dataset
⋮----
// Trim name to prevent whitespace-only or padded names
⋮----
// Validate name format
⋮----
// Check if name is taken
⋮----
// Process the CSV file
⋮----
// Check for errors
⋮----
// Save to IndexedDB - metadata first, then rows
// If row insertion fails mid-way (chunked), we need to clean up
⋮----
// Row insertion failed - clean up the metadata and any partial rows
⋮----
// Update state
⋮----
// Delete a dataset
⋮----
// Remove from cached rows
⋮----
// Update match strategy
⋮----
// Invalidate cached match stats for this dataset since strategy changed
⋮----
// Rename a dataset
⋮----
// Trim name to prevent whitespace-only or padded names
⋮----
// Validate name format
⋮----
// Check if name is taken (excluding current dataset)
⋮----
// Get rows for a dataset (with caching)
⋮----
// Return cached rows if available
⋮----
// Load from IndexedDB
⋮----
// Cache the rows
⋮----
// Clear cached rows (all or for specific dataset)
⋮----
// Validate a dataset name
⋮----
// Validate format
⋮----
// Check uniqueness
⋮----
// Get cached match stats (returns null if not cached)
⋮----
// Compute and cache match stats
⋮----
// Return cached if available
⋮----
// Skip if already computing
⋮----
// Mark as computing
⋮----
// Find the dataset to get date range for the calculation
⋮----
// Clear computing flag before returning
⋮----
// Load rows (uses cache if available)
⋮----
// Calculate stats
⋮----
// Before caching, check if this computation was cancelled (invalidated)
// If the key was removed from computingMatchStats, don't write stale data
⋮----
// Computation was cancelled - don't cache stale results
⋮----
// Cache the result
⋮----
// Clear computing flag
⋮----
// Check if stats are being computed
⋮----
// Invalidate all cached stats for a block (when trades change)
⋮----
// Key format: datasetId:blockId:matchStrategy
⋮----
// Also clear in-flight computations for this block to prevent stale writes
⋮----
// Invalidate all cached stats for a dataset (when dataset changes)
⋮----
// Key format: datasetId:blockId:matchStrategy
⋮----
// Also clear in-flight computations for this dataset to prevent stale writes
⋮----
/**
 * Hook to get a specific dataset by ID
 */
export function useStaticDataset(id: string): StaticDataset | undefined
⋮----
/**
 * Hook to get all datasets
 */
export function useAllStaticDatasets(): StaticDataset[]
⋮----
/**
 * Hook to check if datasets are loaded
 */
export function useStaticDatasetsInitialized(): boolean
```

## File: lib/stores/trading-calendar-store.ts
```typescript
import { create } from 'zustand'
import { Trade } from '@/lib/models/trade'
import { ReportingTrade } from '@/lib/models/reporting-trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import {
  calculateAdvancedMetrics,
  calculateTradeMetrics,
  getFilteredScaledDayBacktestPl,
  getFilteredScaledDayActualPl
} from '@/lib/services/calendar-data'
import { PortfolioStatsCalculator } from '@/lib/calculations/portfolio-stats'
import { normalizeTradesToOneLot } from '@/lib/utils/trade-normalization'
⋮----
/**
 * Scaling modes for P&L display
 * - raw: Show actual numbers as-is
 * - perContract: Normalize to per-contract (1 lot)
 * - toReported: Scale actual DOWN to match backtest (reported) contract counts
 */
export type ScalingMode = 'raw' | 'perContract' | 'toReported'
⋮----
/**
 * Calendar view mode
 */
export type CalendarViewMode = 'week' | 'month'
⋮----
/**
 * Date display mode - which date to use for placing trades on the calendar
 * - entry: Show trades by their opening/entry date
 * - exit: Show trades by their closing/exit date
 */
export type DateDisplayMode = 'entry' | 'exit'
⋮----
/**
 * Navigation view state for breadcrumb navigation
 */
export type NavigationView = 'calendar' | 'day' | 'trade'
⋮----
/**
 * Data display mode - which data to show in calendar cells
 * - backtest: Show only backtest data
 * - actual: Show only actual data
 * - both: Show both backtest and actual data
 */
export type DataDisplayMode = 'backtest' | 'actual' | 'both'
⋮----
/**
 * Trade filter mode - which trades to include in calculations and displays
 * - all: Include all trades
 * - matched: Only include trades from matched strategies
 */
export type TradeFilterMode = 'all' | 'matched'
⋮----
/**
 * Matched strategy pair (exact name match or user-linked)
 */
export interface StrategyMatch {
  backtestStrategy: string
  actualStrategy: string
  isAutoMatched: boolean // true if exact name match, false if user-linked
}
⋮----
isAutoMatched: boolean // true if exact name match, false if user-linked
⋮----
/**
 * Daily aggregated data for calendar display
 */
export interface CalendarDayData {
  date: string // YYYY-MM-DD
  // Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual live trading
  backtestTrades: Trade[]
  actualTrades: ReportingTrade[]
  backtestPl: number
  actualPl: number
  backtestTradeCount: number
  actualTradeCount: number
  hasBacktest: boolean
  hasActual: boolean
  // Matched data (when both exist)
  matchedStrategies: string[]
  unmatchedBacktestStrategies: string[]
  unmatchedActualStrategies: string[]
  // Margin data - sum of marginReq for trades open on this day (only from backtest/Trade type)
  totalMargin: number
}
⋮----
date: string // YYYY-MM-DD
// Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual live trading
⋮----
// Matched data (when both exist)
⋮----
// Margin data - sum of marginReq for trades open on this day (only from backtest/Trade type)
⋮----
/**
 * Weekly aggregated data for sidebar
 */
export interface CalendarWeekData {
  weekNumber: number
  startDate: string // YYYY-MM-DD (Monday)
  endDate: string // YYYY-MM-DD (Sunday)
  backtestPl: number
  actualPl: number
  tradingDays: number
  slippage: number | null // Only when both backtest and actual exist
}
⋮----
startDate: string // YYYY-MM-DD (Monday)
endDate: string // YYYY-MM-DD (Sunday)
⋮----
slippage: number | null // Only when both backtest and actual exist
⋮----
/**
 * Trade detail for side-by-side comparison
 */
export interface TradeComparison {
  backtestTrade: ReportingTrade | null
  actualTrade: Trade | null
  strategy: string
  date: string
  // Scaled values based on current scaling mode
  scaledBacktestPl: number | null
  scaledActualPl: number | null
  slippage: number | null
}
⋮----
// Scaled values based on current scaling mode
⋮----
/**
 * Performance stats for the selected time period
 */
export interface CalendarPerformanceStats {
  // Basic metrics
  totalPl: number
  winRate: number
  tradeCount: number
  tradingDays: number

  // Advanced metrics from daily logs (require time series)
  sharpe: number | null
  sortino: number | null
  maxDrawdown: number | null
  cagr: number | null
  calmar: number | null

  // Trade-based metrics
  avgRom: number | null // Return on Margin - only available for backtest trades (Trade type)
  avgPremiumCapture: number | null

  // Data source indicator - which trades are being used for calculations
  dataSource: 'backtest' | 'actual' | 'none'
}
⋮----
// Basic metrics
⋮----
// Advanced metrics from daily logs (require time series)
⋮----
// Trade-based metrics
avgRom: number | null // Return on Margin - only available for backtest trades (Trade type)
⋮----
// Data source indicator - which trades are being used for calculations
⋮----
/**
 * Comparison stats for the selected time period
 */
export interface CalendarComparisonStats {
  backtestPl: number
  actualPl: number
  totalSlippage: number
  matchRate: number // Percentage of strategies that matched
  unmatchedBacktestCount: number
  unmatchedActualCount: number
}
⋮----
matchRate: number // Percentage of strategies that matched
⋮----
interface TradingCalendarState {
  // Loading state
  isLoading: boolean
  error: string | null

  // Block context
  blockId: string | null

  // Raw data from DB
  // Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual live trading
  backtestTrades: Trade[]
  actualTrades: ReportingTrade[]
  dailyLogs: DailyLogEntry[]

  // Strategy matching
  strategyMatches: StrategyMatch[]
  unmatchedBacktestStrategies: string[]
  unmatchedActualStrategies: string[]

  // Computed calendar data
  calendarDays: Map<string, CalendarDayData>
  calendarWeeks: CalendarWeekData[]

  // View state
  scalingMode: ScalingMode
  calendarViewMode: CalendarViewMode
  dateDisplayMode: DateDisplayMode
  dataDisplayMode: DataDisplayMode
  tradeFilterMode: TradeFilterMode
  navigationView: NavigationView
  showMargin: boolean
  combineLegGroups: boolean

  // Current month/date being viewed
  viewDate: Date // The month/week being displayed

  // Selected items for navigation
  selectedDate: string | null // YYYY-MM-DD for day view
  selectedTradeId: string | null // For trade detail view
  selectedStrategy: string | null // Strategy name for trade detail

  // Computed stats (update with view changes)
  performanceStats: CalendarPerformanceStats | null
  comparisonStats: CalendarComparisonStats | null

  // Actions
  loadCalendarData: (blockId: string) => Promise<void>
  setScalingMode: (mode: ScalingMode) => void
  setCalendarViewMode: (mode: CalendarViewMode) => void
  setDateDisplayMode: (mode: DateDisplayMode) => void
  setDataDisplayMode: (mode: DataDisplayMode) => void
  setTradeFilterMode: (mode: TradeFilterMode) => void
  setShowMargin: (show: boolean) => void
  setCombineLegGroups: (combine: boolean) => void
  setViewDate: (date: Date) => void

  // Navigation actions
  navigateToDay: (date: string) => void
  navigateToTrade: (strategy: string, date: string) => void
  navigateBack: () => void
  setNavigationFromUrl: (view: NavigationView, date: string | null, strategy: string | null) => void

  // Strategy matching actions
  linkStrategies: (backtestStrategy: string, actualStrategy: string) => void
  unlinkStrategies: (backtestStrategy: string, actualStrategy: string) => void

  // Reset
  reset: () => void
}
⋮----
// Loading state
⋮----
// Block context
⋮----
// Raw data from DB
// Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual live trading
⋮----
// Strategy matching
⋮----
// Computed calendar data
⋮----
// View state
⋮----
// Current month/date being viewed
viewDate: Date // The month/week being displayed
⋮----
// Selected items for navigation
selectedDate: string | null // YYYY-MM-DD for day view
selectedTradeId: string | null // For trade detail view
selectedStrategy: string | null // Strategy name for trade detail
⋮----
// Computed stats (update with view changes)
⋮----
// Actions
⋮----
// Navigation actions
⋮----
// Strategy matching actions
⋮----
// Reset
⋮----
/**
 * Get unique strategies from trades
 */
function getUniqueStrategies(trades: Array<
⋮----
/**
 * Format date to YYYY-MM-DD in local timezone
 */
function formatDateKey(date: Date): string
⋮----
/**
 * Parse a YYYY-MM-DD date key back to a local Date object.
 *
 * IMPORTANT: Using new Date('YYYY-MM-DD') parses as UTC midnight,
 * which can shift the date when displayed in local time.
 * This function creates a Date at midnight local time instead.
 */
function parseDateKey(dateKey: string): Date
⋮----
// Fallback - but this shouldn't happen with valid date keys
⋮----
/**
 * Calculate auto-matched strategies (exact name match)
 */
function calculateAutoMatches(
  backtestStrategies: string[],
  actualStrategies: string[]
):
⋮----
/**
 * Get the date key for a trade based on the display mode
 */
function getTradeDate(trade: ReportingTrade | Trade, dateDisplayMode: DateDisplayMode): Date
⋮----
// Use dateClosed if available, otherwise fall back to dateOpened
⋮----
/**
 * Build calendar day data from trades
 * Note: Trade (from tradelog.csv) = backtest, ReportingTrade (from strategylog.csv) = actual live trading
 */
function buildCalendarDays(
  backtestTrades: Trade[],
  actualTrades: ReportingTrade[],
  strategyMatches: StrategyMatch[],
  dateDisplayMode: DateDisplayMode = 'entry'
): Map<string, CalendarDayData>
⋮----
// Create a lookup for strategy matches
const matchLookup = new Map<string, string>() // backtest -> actual
const reverseMatchLookup = new Map<string, string>() // actual -> backtest
⋮----
// Group backtest trades by date
⋮----
// Add margin from backtest trades (only Trade type has marginReq)
⋮----
// Group actual trades by date
⋮----
// Calculate matched/unmatched strategies per day
⋮----
/**
 * Calculate performance stats for visible date range
 */
function calculatePerformanceStats(
  days: Map<string, CalendarDayData>,
  viewDate: Date,
  viewMode: CalendarViewMode,
  dailyLogs: DailyLogEntry[],
  backtestTrades: Trade[],
  scalingMode: ScalingMode = 'raw',
  dateDisplayMode: DateDisplayMode = 'exit',
  tradeFilterMode: TradeFilterMode = 'all',
  strategyMatches: StrategyMatch[] = []
): CalendarPerformanceStats
⋮----
// Get date range based on view mode
⋮----
// Week view - get Sunday to Saturday (matching getWeekGridDates in calendar-data.ts)
⋮----
startDate.setDate(viewDate.getDate() - viewDate.getDay()) // Go to Sunday
⋮----
endDate.setDate(startDate.getDate() + 6) // Saturday
⋮----
// Build matched strategy sets for filtering
⋮----
// Filter days data if in matched mode
⋮----
// Determine if we should use actual trades (when available) or backtest
⋮----
// Calculate trade-based metrics
⋮----
// If no trades in the date range, return null for advanced metrics
// We shouldn't show performance stats for empty periods
⋮----
// When scaling is active (perContract), we must use trade-based calculations
// because daily logs represent raw portfolio values that don't scale properly.
// This matches the behavior in performance-snapshot.ts
⋮----
// Filter backtest trades by matched strategies if in matched mode
⋮----
// Filter trades to date range using the appropriate date based on display mode
⋮----
// Use normalizeTradesToOneLot for proper equity curve reconstruction
// This matches what block stats does when "normalize to 1 lot" is enabled
⋮----
// Use daily logs for advanced metrics when not scaling
⋮----
/**
 * Calculate comparison stats for visible date range
 */
function calculateComparisonStats(
  days: Map<string, CalendarDayData>,
  viewDate: Date,
  viewMode: CalendarViewMode,
  strategyMatches: StrategyMatch[],
  unmatchedBacktest: string[],
  unmatchedActual: string[],
  scalingMode: ScalingMode = 'raw',
  tradeFilterMode: TradeFilterMode = 'all'
): CalendarComparisonStats | null
⋮----
// Get date range
⋮----
// Week view - get Sunday to Saturday (matching getWeekGridDates in calendar-data.ts)
⋮----
startDate.setDate(viewDate.getDate() - viewDate.getDay()) // Go to Sunday
⋮----
endDate.setDate(startDate.getDate() + 6) // Saturday
⋮----
// Build matched strategy sets for filtering
⋮----
// Build reverse mapping for checking same-day matches
⋮----
// Check if there are actual trades (filtered if in matched mode)
// In matched mode, only count if both backtest AND actual exist on the same day
⋮----
// Only show comparison stats if there are actual trades
⋮----
// In matched mode, all strategies are matched by definition
⋮----
// Load all data for the block
// Note: tradeLog (Trade) = backtest data, reportingLog (ReportingTrade) = actual live trading
⋮----
// Get existing strategy alignments from block if any
⋮----
// Get unique strategies
⋮----
// Calculate auto-matches first
⋮----
// Merge with existing user-defined mappings
⋮----
// Combine: auto-matches take precedence, then add user mappings for remaining
⋮----
// Recalculate unmatched after applying user mappings
⋮----
// Build calendar data (default to 'exit' date display mode)
⋮----
// Determine initial view date - latest trade date or today
⋮----
// Determine default scaling mode:
// - If we have both backtest AND actual trades, default to 'toReported'
// - Otherwise use 'raw'
⋮----
// Calculate initial stats with default scaling mode (default to 'all' for tradeFilterMode)
⋮----
// Recalculate stats with new scaling mode
⋮----
// Rebuild calendar days with new date display mode
⋮----
// Recalculate stats with the new date display mode
⋮----
// Recalculate stats with new trade filter mode
⋮----
// Add new match
⋮----
// Rebuild calendar days with new matches (respect current dateDisplayMode)
⋮----
// Recalculate stats with current scaling mode and trade filter mode
⋮----
// Persist to block
⋮----
// Find and remove the match (only allow unlinking user-defined matches)
⋮----
if (!matchToRemove) return // Can't unlink auto-matches
⋮----
// Rebuild calendar days (respect current dateDisplayMode)
⋮----
// Recalculate stats with current scaling mode and trade filter mode
⋮----
// Remove from persisted block
```

## File: components/trading-calendar/trade-detail-view.tsx
```typescript
import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { useTradingCalendarStore } from '@/lib/stores/trading-calendar-store'
import { Trade } from '@/lib/models/trade'
import { ReportingTrade } from '@/lib/models/reporting-trade'
import {
  formatCurrency,
  createScalingContext,
  getScaleFactor
} from '@/lib/services/calendar-data'
import {
  groupTradesByEntry,
  combineLegGroup,
  groupReportingTradesByEntry,
  combineReportingLegGroup,
  CombinedTrade,
  CombinedReportingTrade
} from '@/lib/utils/combine-leg-groups'
import { cn } from '@/lib/utils'
⋮----
/**
 * Normalize backtest premium to dollars
 * Backtest trades may store premium in cents (whole numbers without decimals)
 * while reporting trades store premium in dollars
 */
function normalizeBacktestPremium(trade: Trade | CombinedTrade): number
⋮----
interface DetailRowProps {
  label: string
  value: string | number | null | undefined
  format?: 'currency' | 'number' | 'text' | 'percent' | 'premium'
  scaleFactor?: number | null
}
⋮----
const formatValue = (val: string | number | null | undefined): string =>
⋮----
// Format as debit (db) or credit (cr)
⋮----
// Apply scaling if provided
⋮----
/**
 * Display legs with each leg on its own line
 * Leg format: "<contracts> <date> <strike> <type> <action> <price>"
 * Multiple legs separated by " | "
 * Strips the leading contract count since it's shown separately in the Contracts row
 */
⋮----
// Split by " | " to get individual legs
⋮----
// Strip leading contract count from each leg (it's shown in Contracts row)
⋮----
// =============================================================================
// Individual Leg Card (compact version for inside combined groups)
// =============================================================================
⋮----
// Normalize backtest premium from cents to dollars if needed
⋮----
<span className=
⋮----
// =============================================================================
// Combined Trade Group (expandable/collapsible)
// =============================================================================
⋮----
// Calculate scaled P&L for header display
⋮----
{/* Spacer to match "Show Backtest Details" button height when side-by-side */}
⋮----
{/* Additional Backtest Details - Collapsible */}
⋮----
{/* For combined trades (multiple legs), maxProfit/maxLoss are dollar amounts derived from margin */}
{/* For single trades, they are percentages of premium */}
⋮----
{/* Leg Details - Collapsible */}
⋮----
// =============================================================================
// Individual Trade Cards (for when combining is disabled)
// =============================================================================
⋮----
// Calculate scaled P&L for header display
⋮----
{/* Spacer to match "Show Backtest Details" button height when side-by-side */}
⋮----
{/* Additional Backtest Details - Collapsible */}
⋮----
// =============================================================================
// Trade Matching Utilities
// =============================================================================
⋮----
/**
 * Match actual and backtest trades by premium sign (credit vs debit)
 * This helps align corresponding positions in side-by-side view
 */
⋮----
// Separate trades by premium sign
⋮----
// Match credits first
⋮----
// Then match debits
⋮----
// =============================================================================
// Main Component
// =============================================================================
⋮----
// Find trades for this strategy on this day
⋮----
// Group and combine trades if toggle is enabled
⋮----
// Create centralized scaling context - uses first trade's contract count as "unit size"
⋮----
// Get scale factors from centralized functions
⋮----
// Scale totals based on scaling mode using centralized scaling
⋮----
// Apply scaling using centralized scale factors
⋮----
// Determine display contracts based on scaling mode
⋮----
// Calculate slippage only when we can meaningfully compare
⋮----
// Raw mode: slippage isn't meaningful with different contract counts
⋮----
// perContract or toReported: values are on same scale, slippage is meaningful
⋮----
// Match trades by premium sign for side-by-side alignment
⋮----
// Early return after all hooks
⋮----
{/* Strategy summary header */}
⋮----
{/* Left: Strategy name and badges */}
⋮----
{/* Right: P&L totals */}
⋮----
{/* Trade cards - side by side when both exist, full width when only one */}
⋮----
/* Side-by-side layout for matched strategies */
⋮----
{/* Actual column */}
⋮----
{/* Backtest column */}
⋮----
/* Full width for unmatched (only actual or only backtest) */
⋮----
/* Side-by-side layout with matched pairs (by premium sign) */
⋮----
{/* Actual (left) */}
⋮----
<div className="h-full" /> /* Empty placeholder */
⋮----
{/* Backtest (right) */}
⋮----
<div className="h-full" /> /* Empty placeholder */
⋮----
/* Full width for unmatched (only actual or only backtest) */
```

## File: lib/calculations/enrich-trades.ts
```typescript
/**
 * Trade Enrichment
 *
 * Computes all derived fields for trades to enable flexible
 * filtering and charting in the Report Builder.
 */
⋮----
import { Trade } from '@/lib/models/trade'
import { EnrichedTrade } from '@/lib/models/enriched-trade'
import { DailyLogEntry } from '@/lib/models/daily-log'
import { calculateMFEMAEData, MFEMAEDataPoint } from './mfe-mae'
import type { StaticDataset, StaticDatasetRow } from '@/lib/models/static-dataset'
import { getMatchedValuesForTrade } from './static-dataset-matcher'
⋮----
/**
 * Static dataset with its rows for matching
 */
export interface StaticDatasetWithRows {
  dataset: StaticDataset
  rows: StaticDatasetRow[]
}
⋮----
/**
 * Options for enriching trades
 */
export interface EnrichTradesOptions {
  /** Daily log entries to join custom fields from (by date) */
  dailyLogs?: DailyLogEntry[]
  /** Static datasets with their rows for timestamp-based matching */
  staticDatasets?: StaticDatasetWithRows[]
}
⋮----
/** Daily log entries to join custom fields from (by date) */
⋮----
/** Static datasets with their rows for timestamp-based matching */
⋮----
/**
 * Creates a date key string for matching trades to daily logs
 * Format: YYYY-MM-DD in UTC to avoid timezone issues
 */
function getDateKey(date: Date): string
⋮----
/**
 * Builds a lookup map from date to daily log custom fields
 */
function buildDailyCustomFieldsMap(dailyLogs: DailyLogEntry[]): Map<string, Record<string, number | string>>
⋮----
/**
 * Computes the duration of a trade in hours
 */
function computeDurationHours(trade: Trade): number | undefined
⋮----
// Parse opening datetime
⋮----
// Parse closing datetime
⋮----
// Calculate difference in hours
⋮----
/**
 * Extracts hour of day from trade opening time string (HH:MM:SS format)
 * The time in the CSV is already in Eastern Time
 */
function extractHourOfDay(timeOpened: string): number | undefined
⋮----
/**
 * Extracts time of day as minutes since midnight from trade opening time string (HH:MM:SS format)
 * This provides exact time precision for scatter plots, unlike hourOfDay which buckets to the hour.
 * Example: "11:45:00" -> 705 (11 * 60 + 45)
 */
function extractTimeOfDayMinutes(timeOpened: string): number | undefined
⋮----
/**
 * Calculates ISO week number for a given date
 * ISO weeks start on Monday and week 1 contains the first Thursday of the year
 */
function getISOWeekNumber(date: Date): number
⋮----
// Set to nearest Thursday (current date + 4 - current day number, making Sunday=7)
⋮----
// Get first day of year
⋮----
// Calculate full weeks to nearest Thursday
⋮----
/**
 * Enriches a single trade with all derived fields
 */
function enrichSingleTrade(
  trade: Trade,
  index: number,
  mfeMaePoint?: MFEMAEDataPoint,
  dailyCustomFields?: Record<string, number | string>,
  staticDatasetFields?: Record<string, Record<string, number | string>>
): EnrichedTrade
⋮----
// VIX changes
⋮----
// Return metrics
⋮----
// Premium in CSV is per-contract, P/L is total across all contracts
// Multiply premium by contracts to get total premium for accurate P/L %
⋮----
const plPct = premiumEfficiency // Alias for easier discovery
⋮----
// Risk multiple: P/L divided by MAE (how many R's won/lost)
⋮----
// Parse date (may be Date object or ISO string from IndexedDB)
// The date in the CSV is stored as Eastern Time date, parsed as UTC midnight
// Use getUTCDay() to get the correct day without timezone shift
⋮----
// MFE/MAE metrics from pre-calculated data
⋮----
// Return metrics
⋮----
// Timing (data is already in Eastern Time from the CSV)
⋮----
monthOfYear: dateOpened.getUTCMonth() + 1, // 1-12 instead of 0-11
⋮----
// Costs & Net
⋮----
// VIX changes
⋮----
// Risk metrics
⋮----
// Sequential
⋮----
// Daily custom fields (joined by trade date)
⋮----
// Static dataset fields (matched by timestamp)
⋮----
/**
 * Enriches all trades with derived fields
 *
 * Uses calculateMFEMAEData() for MFE/MAE metrics and computes
 * additional derived fields like ROM, duration, VIX changes, etc.
 *
 * @param trades - Array of trades to enrich
 * @param options - Optional configuration including daily logs and static datasets
 */
export function enrichTrades(trades: Trade[], options?: EnrichTradesOptions): EnrichedTrade[]
⋮----
// Calculate MFE/MAE data for all trades
⋮----
// Create a map for quick lookup (tradeNumber is 1-indexed)
⋮----
// Build daily custom fields lookup map if daily logs are provided
⋮----
// Enrich each trade
⋮----
// Look up daily custom fields for this trade's date
⋮----
// Match static dataset values by timestamp
⋮----
// Only include if we got matches
```

## File: components/report-builder/report-builder-tab.tsx
```typescript
/**
 * Report Builder Tab
 *
 * Main container for the Custom Report Builder.
 * Provides flexible filtering and chart building capabilities.
 */
⋮----
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Filter, ChevronRight } from 'lucide-react'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { useSettingsStore } from '@/lib/stores/settings-store'
import { useStaticDatasetsStore } from '@/lib/stores/static-datasets-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FilterConfig,
  ChartType,
  ChartAxisConfig,
  ReportConfig,
  ThresholdMetric,
  StaticDatasetFieldInfo,
  createEmptyFilterConfig,
  DEFAULT_TABLE_COLUMNS
} from '@/lib/models/report-config'
import { applyFilters, FlexibleFilterResult } from '@/lib/calculations/flexible-filter'
import { calculateRegimeComparison, RegimeComparisonStats } from '@/lib/calculations/regime-comparison'
import { getDefaultBucketEdges } from '@/lib/calculations/table-aggregation'
import { FilterPanel } from './filter-panel'
import { MetricsGuideDialog } from './metrics-guide-dialog'
import { ResultsPanel } from './results-panel'
import { SavedReportsDropdown } from './saved-reports-dropdown'
import { SaveReportDialog } from './save-report-dialog'
⋮----
// Initialize settings store and static datasets on mount
⋮----
// Convert static datasets to field info format for Report Builder
⋮----
// Filter state
⋮----
// Chart configuration state
⋮----
// Load a saved report
⋮----
// Only replace filters if keepFilters is off
⋮----
// Use pre-computed enriched trades from the performance store
// These are cached at upload time for instant access
⋮----
// Calculate filtered results using enriched trades
⋮----
// Calculate comparison stats
⋮----
// Axis change handlers - memoized to prevent child re-renders
⋮----
// Reset table buckets to defaults for new field
⋮----
{/* Header with Save/Load and Filter Toggle */}
⋮----
{/* Main Content - Chart with optional Filter Panel */}
⋮----
{/* Left Panel - Chart Builder (takes full width when filters hidden) */}
⋮----
{/* Right Panel - Filters (only shown when toggled) */}
```

## File: lib/models/report-config.ts
```typescript
/**
 * Report Configuration Types
 *
 * Defines the structure for flexible report configurations including
 * filter conditions and chart settings.
 */
⋮----
/**
 * Filter operators for comparing trade field values
 */
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between'
⋮----
/**
 * Human-readable labels for filter operators
 */
⋮----
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
⋮----
field: string              // Field name from Trade
⋮----
value: number              // Primary value
value2?: number            // Second value for 'between' operator
⋮----
/**
 * Filter configuration with multiple conditions
 */
export interface FilterConfig {
  conditions: FilterCondition[]
  logic: 'and' | 'or'        // How to combine conditions (AND only for now)
}
⋮----
logic: 'and' | 'or'        // How to combine conditions (AND only for now)
⋮----
/**
 * Chart axis configuration
 */
export interface ChartAxisConfig {
  field: string              // Field name from Trade
  label?: string             // Custom display label
  scale?: 'linear' | 'log'   // Axis scale type
}
⋮----
field: string              // Field name from Trade
label?: string             // Custom display label
scale?: 'linear' | 'log'   // Axis scale type
⋮----
/**
 * Supported chart types
 */
export type ChartType = 'scatter' | 'line' | 'bar' | 'histogram' | 'box' | 'table' | 'threshold'
⋮----
/**
 * Human-readable labels for chart types
 */
⋮----
/**
 * Metric options for threshold analysis secondary Y-axis
 */
export type ThresholdMetric = 'pl' | 'plPct' | 'rom'
⋮----
/**
 * Human-readable labels for threshold metrics
 */
⋮----
/**
 * Categories for organizing preset reports
 */
export type ReportCategory = 'market' | 'mfe-mae' | 'returns' | 'timing' | 'risk' | 'threshold'
⋮----
/**
 * Human-readable labels for report categories
 */
⋮----
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
⋮----
yAxis2?: ChartAxisConfig    // Secondary Y-axis (right side) for scatter/line charts
yAxis3?: ChartAxisConfig    // Tertiary Y-axis (far right) for scatter/line charts
colorBy?: ChartAxisConfig   // Optional color encoding
sizeBy?: ChartAxisConfig    // Optional size encoding (scatter only)
tableBuckets?: number[]     // Bucket thresholds for table type (e.g., [15, 20, 25, 30])
tableColumns?: string[]     // Selected columns for table type (e.g., ['count', 'winRate', 'pl:avg'])
thresholdMetric?: ThresholdMetric  // Secondary Y-axis metric for threshold chart (default: 'pl')
category?: ReportCategory   // Category for grouping preset reports in menus
isBuiltIn?: boolean         // True for preset reports
⋮----
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
  | 'plPct'
  | 'netPlPct'
  // Derived: Timing
  | 'durationHours'
  | 'dayOfWeek'
  | 'hourOfDay'
  | 'timeOfDayMinutes'
  | 'dayOfMonth'
  | 'monthOfYear'
  | 'weekOfYear'
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
⋮----
// Market conditions
⋮----
// Performance metrics (base)
⋮----
// Derived: MFE/MAE metrics
⋮----
// Derived: Return metrics
⋮----
// Derived: Timing
⋮----
// Derived: Costs & Net
⋮----
// Derived: VIX changes
⋮----
// Derived: Risk metrics
⋮----
// Derived: Sequential
⋮----
/**
 * Field category for organizing fields in UI
 */
export type FieldCategory = 'market' | 'returns' | 'risk' | 'trade' | 'timing'
⋮----
/**
 * Human-readable labels for field categories
 */
⋮----
/**
 * Order for field categories in dropdowns
 */
⋮----
/**
 * Field metadata for UI display
 */
export interface FieldInfo {
  field: ReportField
  label: string
  category: FieldCategory
  unit?: string
  description?: string
  formula?: string
}
⋮----
/**
 * All available fields with their metadata
 * Includes base Trade fields and derived EnrichedTrade fields
 */
⋮----
// Market conditions
⋮----
// Return metrics
⋮----
// Risk metrics (MFE/MAE)
⋮----
// Trade details
⋮----
// Timing
⋮----
/**
 * Get field info by field name
 * Checks static REPORT_FIELDS first, then looks for custom field patterns
 */
export function getFieldInfo(field: string): FieldInfo | undefined
⋮----
// Check static fields first
⋮----
// Check if it's a custom trade field (custom.fieldName)
⋮----
const customFieldName = field.slice(7) // Remove 'custom.' prefix
⋮----
// Check if it's a daily custom field (daily.fieldName)
⋮----
const dailyFieldName = field.slice(6) // Remove 'daily.' prefix
⋮----
// Check if it's a static dataset field (datasetName.columnName)
// Static dataset fields contain a dot but don't start with 'custom.' or 'daily.'
⋮----
/**
 * Get fields grouped by category, ordered by FIELD_CATEGORY_ORDER
 * Includes only static fields (no custom fields)
 */
export function getFieldsByCategory(): Map<FieldCategory, FieldInfo[]>
⋮----
// Initialize in the correct order
⋮----
// Add fields to their categories
⋮----
/**
 * Custom field category for organizing custom fields in UI
 * Note: Static datasets use their dataset name as the category dynamically
 */
export type CustomFieldCategory = 'custom' | 'dailyCustom'
⋮----
/**
 * Labels for custom field categories
 */
⋮----
/**
 * Extracts unique custom field names from an array of trades
 * Returns both trade custom fields and daily custom fields
 */
export interface ExtractedCustomFields {
  /** Custom fields from trade CSV (keys are field names without prefix) */
  tradeFields: string[]
  /** Custom fields from daily log CSV (keys are field names without prefix) */
  dailyFields: string[]
}
⋮----
/** Custom fields from trade CSV (keys are field names without prefix) */
⋮----
/** Custom fields from daily log CSV (keys are field names without prefix) */
⋮----
/**
 * Extract custom field names from enriched trades
 */
export function extractCustomFieldNames(trades: Array<{
  customFields?: Record<string, number | string>
  dailyCustomFields?: Record<string, number | string>
}>): ExtractedCustomFields
⋮----
// Return fields in insertion order (preserves CSV column order from first trade)
// Using Set preserves insertion order in modern JavaScript
⋮----
/**
 * Get fields grouped by category, including custom fields from trades
 * This is the dynamic version that includes custom fields discovered in the data
 */
export function getFieldsByCategoryWithCustom(trades: Array<{
  customFields?: Record<string, number | string>
  dailyCustomFields?: Record<string, number | string>
}>): Map<FieldCategory | CustomFieldCategory, FieldInfo[]>
⋮----
// Start with static fields
⋮----
// Initialize in the correct order
⋮----
// Add static fields to their categories
⋮----
// Extract custom fields from trades
⋮----
// Add custom trade fields category if there are any
⋮----
category: 'trade' as FieldCategory, // Will be shown in 'custom' category
⋮----
// Add daily custom fields category if there are any
⋮----
category: 'market' as FieldCategory, // Will be shown in 'dailyCustom' category
⋮----
/**
 * Get all field category labels including custom categories
 */
export function getAllCategoryLabels(): Record<FieldCategory | CustomFieldCategory, string>
⋮----
/**
 * Static dataset info for field discovery
 */
export interface StaticDatasetFieldInfo {
  datasetName: string
  columns: string[]
}
⋮----
/**
 * Get fields grouped by category, including custom fields AND static dataset fields
 * This is the full dynamic version for Report Builder
 * Static datasets each get their own category named after the dataset
 */
export function getFieldsByCategoryWithAll(
  trades: Array<{
    customFields?: Record<string, number | string>
    dailyCustomFields?: Record<string, number | string>
  }>,
  staticDatasets?: StaticDatasetFieldInfo[]
): Map<string, FieldInfo[]>
⋮----
// Start with the version that includes custom fields
⋮----
// Add static dataset fields - each dataset becomes its own category
⋮----
/**
 * Create an empty filter config
 */
export function createEmptyFilterConfig(): FilterConfig
⋮----
/**
 * Create a new filter condition with defaults
 */
export function createFilterCondition(field: ReportField = 'openingVix'): FilterCondition
⋮----
/**
 * Create a default report config
 */
export function createDefaultReportConfig(): Omit<ReportConfig, 'id' | 'createdAt' | 'updatedAt'>
⋮----
// ============================================================================
// Table Column Configuration
// ============================================================================
⋮----
/**
 * Aggregation types for table columns
 */
export type AggregationType = 'avg' | 'sum' | 'min' | 'max' | 'count' | 'winRate'
⋮----
/**
 * Table column option for MultiSelect
 */
export interface TableColumnOption {
  value: string  // Format: "field:aggregation" or special like "count", "winRate"
  label: string
}
⋮----
value: string  // Format: "field:aggregation" or special like "count", "winRate"
⋮----
/**
 * Table column group for MultiSelect
 */
export interface TableColumnGroup {
  heading: string
  options: TableColumnOption[]
}
⋮----
/**
 * Predefined table column options grouped by category
 * Value format: "field:aggregation" (e.g., "pl:avg") or special values ("count", "winRate")
 */
⋮----
/**
 * Default selected table columns
 */
⋮----
/**
 * Get all table column options as a flat array
 */
export function getAllTableColumnOptions(): TableColumnOption[]
⋮----
/**
 * Parse a column value into field and aggregation
 * Special values: "count" -> { field: 'count', aggregation: 'count' }
 *                "winRate" -> { field: 'isWinner', aggregation: 'winRate' }
 * Regular values: "pl:avg" -> { field: 'pl', aggregation: 'avg' }
 */
export function parseColumnValue(value: string):
⋮----
/**
 * Get label for a column value
 */
export function getColumnLabel(value: string): string
⋮----
/**
 * Get unit for formatting a column value
 */
export function getColumnUnit(value: string): string | undefined
```

## File: components/report-builder/results-panel.tsx
```typescript
/**
 * Results Panel
 *
 * Right panel of the Report Builder showing the chart builder and comparison stats.
 * Wrapped in React.memo for performance - only re-renders when props actually change.
 */
⋮----
import { memo } from "react";
import { MultiSelect } from "@/components/multi-select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RegimeComparisonStats } from "@/lib/calculations/regime-comparison";
import { EnrichedTrade } from "@/lib/models/enriched-trade";
import {
  CHART_TYPE_LABELS,
  ChartAxisConfig,
  ChartType,
  StaticDatasetFieldInfo,
  TABLE_COLUMN_OPTIONS,
  THRESHOLD_METRIC_LABELS,
  ThresholdMetric,
} from "@/lib/models/report-config";
import { HelpCircle } from "lucide-react";
import { BucketEditor } from "./bucket-editor";
import { ChartAxisSelector } from "./chart-axis-selector";
import { ComparisonSummaryCard } from "./comparison-summary-card";
import { CustomChart } from "./custom-chart";
import { CustomTable } from "./custom-table";
import { HistogramChart } from "./histogram-chart";
import { ScatterChart } from "./scatter-chart";
import { ThresholdChart } from "./threshold-chart";
⋮----
/**
 * Tooltip content for each chart type
 */
⋮----
/**
 * Tooltip component for chart type explanation
 */
function ChartTypeTooltip(
⋮----
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
  showWhatIf: boolean;
  staticDatasets?: StaticDatasetFieldInfo[];
  onShowWhatIfChange: (show: boolean) => void;
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
⋮----
reportName?: string; // Name of loaded/saved report
⋮----
// Check if we're showing a filtered subset
⋮----
// Determine number of columns for non-scatter/line layouts
const getGridCols = () =>
⋮----
if (chartType === "histogram") return "grid-cols-2 lg:grid-cols-3"; // type + x + metric
if (chartType === "threshold") return "grid-cols-2 lg:grid-cols-3"; // type + x + metric
if (chartType === "table") return "grid-cols-2"; // type + x (buckets on second row)
return "grid-cols-2 lg:grid-cols-3"; // type + x + y (bar, box)
⋮----
{/* Chart Configuration */}
⋮----
{/* Report title (only shown when a report is loaded) */}
⋮----
{/* Compact controls row */}
⋮----
{/* Chart type selector */}
⋮----
onValueChange=
⋮----
{/* X Axis */}
⋮----
{/* Y axes on the same row for better balance */}
⋮----
{/* Chart type selector */}
⋮----
{/* X Axis / Group By / Analyze Field */}
⋮----
{/* Y Axis (for bar, box) */}
⋮----
{/* Scatter-specific secondary controls - Color/Size/What-If */}
⋮----
{/* Table-specific controls (buckets and columns) */}
⋮----
{/* Comparison Stats - Only show when filtered */}
```
