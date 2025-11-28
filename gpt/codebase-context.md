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
4. Multiple file entries, each consisting of:
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

## Additional Info

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
    comparison-blocks/
      page.tsx
    correlation-matrix/
      page.tsx
    performance-blocks/
      page.tsx
    position-sizing/
      page.tsx
    risk-simulator/
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
    mfe-mae-scatter-chart.tsx
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
  reconciliation-charts/
    DualEquityCurveChart.tsx
    ReconciliationMetrics.tsx
    SlippageDistributionChart.tsx
  risk-simulator/
    distribution-charts.tsx
    equity-curve-chart.tsx
    statistics-cards.tsx
    trading-frequency-card.tsx
  walk-forward/
    analysis-chart.tsx
    period-selector.tsx
    robustness-metrics.tsx
    run-switcher.tsx
  app-sidebar.tsx
  block-dialog.tsx
  block-metrics-table.tsx
  block-switch-dialog.tsx
  chart-area-interactive.tsx
  data-table.tsx
  match-review-dialog.tsx
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
    index.ts
    kelly.ts
    margin-timeline.ts
    mfe-mae.ts
    monte-carlo.ts
    performance.ts
    portfolio-stats.ts
    reconciliation-stats.ts
    slippage-analysis.ts
    streak-analysis.ts
    walk-forward-analyzer.ts
  db/
    blocks-store.ts
    combined-trades-cache.ts
    daily-logs-store.ts
    index.ts
    performance-snapshot-cache.ts
    reporting-logs-store.ts
    trades-store.ts
    walk-forward-store.ts
  metrics/
    trade-efficiency.ts
  models/
    block.ts
    daily-log.ts
    index.ts
    portfolio-stats.ts
    reporting-trade.ts
    strategy-alignment.ts
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
    trade-processor.ts
  services/
    performance-snapshot.ts
    trade-reconciliation.ts
  stores/
    block-store.ts
    comparison-store.ts
    performance-store.ts
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
⋮----
export default function AppleIcon()
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
⋮----
export default function Icon()
```

## File: app/layout.tsx
```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
⋮----
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
```

## File: app/page.tsx
```typescript
import { redirect } from "next/navigation";
⋮----
export default function Home()
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

## File: components/performance-charts/vix-regime-chart.tsx
```typescript
import { useMemo } from 'react'
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
⋮----
interface VixRegimeChartProps {
  className?: string
}
⋮----
/**
 * Volatility regimes derived from long-run VIX observations.
 * - Low volatility: VIX ≤ 18 (below long-term average of ~19)
 * - Medium volatility: 18 < VIX ≤ 25 (historically elevated)
 * - High volatility: VIX > 25 (stress conditions)
 */
⋮----
const bubbleSize = (pl: number) =>
⋮----
const buildTrace = (entries: typeof openingEntries, isOpening: boolean): Partial<PlotData> => (
⋮----
const buildSummary = (entries: typeof openingEntries, axisSuffix: '' | '2') =>
⋮----
const regimeShapes = (forOpening: boolean): Layout['shapes'] =>
⋮----
// Create title annotations for each subplot
⋮----
// Add a horizontal divider line between the two charts
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

## File: components/reconciliation-charts/DualEquityCurveChart.tsx
```typescript
import { ChartWrapper, createLineChartLayout } from "@/components/performance-charts/chart-wrapper"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EquityCurvePoint, SeparateEquityCurvePoint } from "@/lib/calculations/reconciliation-stats"
import type { Layout, PlotData } from "plotly.js"
import { useState } from "react"
⋮----
interface DualEquityCurveChartProps {
  matchedData: EquityCurvePoint[] | null
  allTradesData: { backtested: SeparateEquityCurvePoint[]; reported: SeparateEquityCurvePoint[] } | null
  normalizeTo1Lot?: boolean
  className?: string
}
⋮----
// Determine which data to use
⋮----
// Build traces based on mode
⋮----
// Matched mode - show paired trades
⋮----
color: "#3b82f6", // blue
⋮----
shape: "hv", // Step function
⋮----
color: "#10b981", // green
⋮----
shape: "hv", // Step function
⋮----
// All trades mode - show separate curves
⋮----
color: "#3b82f6", // blue
⋮----
color: "#10b981", // green
⋮----
// Calculate y-axis range
⋮----
// Use at least 10% of max absolute value as padding to avoid zero range
⋮----
// Build description
```

## File: components/reconciliation-charts/ReconciliationMetrics.tsx
```typescript
import { MetricCard } from "@/components/metric-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateDualEquityCurves, calculateSeparateEquityCurves, MatchedPair } from "@/lib/calculations/reconciliation-stats"
import { AlignedTradeSet, AlignmentMetrics } from "@/lib/services/trade-reconciliation"
import { cn } from "@/lib/utils"
import { DualEquityCurveChart } from "./DualEquityCurveChart"
import { SlippageDistributionChart, computeSlippageDistribution } from "./SlippageDistributionChart"
⋮----
interface ReconciliationMetricsProps {
  metrics: AlignmentMetrics
  alignment: AlignedTradeSet // Need full alignment to calculate session-based match rate
  normalizeTo1Lot?: boolean
  className?: string
}
⋮----
alignment: AlignedTradeSet // Need full alignment to calculate session-based match rate
⋮----
// Calculate session-based match rate (more accurate than trade-based)
⋮----
// Calculate derived metrics
⋮----
const formatCurrency = (value: number) => new Intl.NumberFormat("en-US",
⋮----
// Compute matched pairs for equity curve
⋮----
// Sort pairs by date for equity curve
⋮----
// Calculate separate equity curves for all trades (matched + unmatched)
⋮----
{/* Match Quality & Trade Counts - Compact Grid */}
⋮----
{/* Match Rate - Larger span */}
⋮----
{/* Title */}
⋮----
{/* Value */}
⋮----
{/* Subtitle */}
⋮----
{/* Backtested Trades */}
⋮----
{/* Reported Trades */}
⋮----
{/* Unmatched Sessions */}
⋮----
{/* Performance Delta Metrics */}
⋮----
{/* Statistical Significance Card */}
⋮----
{/* Key Stats */}
⋮----
{/* Confidence Interval */}
⋮----
{/* Correlation Card */}
```

## File: components/reconciliation-charts/SlippageDistributionChart.tsx
```typescript
import { ChartWrapper, createHistogramLayout } from "@/components/performance-charts/chart-wrapper"
import { AlignedTradeSet, NormalizedTrade } from "@/lib/services/trade-reconciliation"
import type { PlotData } from "plotly.js"
⋮----
export interface SlippageDistributionData {
  slippages: number[]
  positive: number[]
  neutral: number[]
  negative: number[]
  mean: number
  median: number
  p10: number
  p25: number
  p75: number
  p90: number
  count: number
  positiveCount: number
  neutralCount: number
  negativeCount: number
  min: number
  max: number
}
⋮----
function getPercentile(values: number[], percentile: number): number
⋮----
export function computeSlippageDistribution(
  alignment: AlignedTradeSet,
  normalizeTo1Lot = false,
): SlippageDistributionData | null
⋮----
const normalizePremium = (trade: NormalizedTrade)
⋮----
interface SlippageDistributionChartProps {
  data: SlippageDistributionData | null
  normalizeTo1Lot?: boolean
  className?: string
}
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
export function TradingFrequencyCard(
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

## File: components/chart-area-interactive.tsx
```typescript
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
⋮----
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
⋮----
export function ChartAreaInteractive()
⋮----
tickFormatter=
⋮----
return new Date(value).toLocaleDateString("en-US",
```

## File: components/data-table.tsx
```typescript
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheckFilled,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconPlus,
  IconTrendingUp,
} from "@tabler/icons-react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"
import { z } from "zod"
⋮----
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
⋮----
// Create a separate component for the drag handle
function DragHandle(
⋮----
e.preventDefault()
toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)),
⋮----
function handleDragEnd(event: DragEndEvent)
⋮----
checked=
⋮----
column.toggleVisibility(!!value)
⋮----
const isMobile = useIsMobile()
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
⋮----
{/* Subtitle */}
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
  children: React.ReactNode;
  className?: string;
  gridCols?: 2 | 3 | 4 | 5;
}
⋮----
{/* Section Header */}
⋮----
{/* Metrics Grid */}
<div className=
```

## File: components/mode-toggle.tsx
```typescript
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { IconMoonStars, IconSun } from "@tabler/icons-react"
⋮----
import { Button } from "@/components/ui/button"
⋮----
export function ModeToggle()
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
// Calculate initial capital from first trade
⋮----
// Use actual portfolio values from fundsAtClose (legacy approach)
⋮----
// Update peak
⋮----
// Calculate drawdown from current peak
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

## File: lib/calculations/reconciliation-stats.ts
```typescript
/**
 * Statistical analysis for trade reconciliation
 *
 * Provides paired t-test, correlation analysis, and statistical interpretation
 * for comparing backtested vs reported trading performance.
 */
⋮----
import { NormalizedTrade } from '@/lib/services/trade-reconciliation'
⋮----
export interface MatchedPair {
  backtested: NormalizedTrade
  reported: NormalizedTrade
}
⋮----
export interface EquityCurvePoint {
  date: string
  tradeNumber: number
  backtestedEquity: number
  reportedEquity: number
  difference: number
  percentDifference: number
}
⋮----
export interface SeparateEquityCurvePoint {
  date: string
  tradeNumber: number
  equity: number
  tradeType: 'backtested' | 'reported'
}
⋮----
export interface TTestResult {
  tStatistic: number
  pValue: number
  degreesOfFreedom: number
  meanDifference: number
  standardError: number
  confidenceInterval: [number, number]
  isSignificant: boolean // p < 0.05
  interpretation: string
}
⋮----
isSignificant: boolean // p < 0.05
⋮----
export interface CorrelationMetrics {
  pearsonR: number
  spearmanRho: number
  interpretation: string
}
⋮----
/**
 * Calculate paired t-test for matched trade pairs
 *
 * Tests the null hypothesis that there is no significant difference between
 * backtested and reported P/L. Uses two-tailed test with alpha = 0.05.
 *
 * @param pairs - Array of matched trade pairs
 * @returns T-test results with statistical interpretation
 */
export function calculatePairedTTest(pairs: MatchedPair[]): TTestResult | null
⋮----
// Cannot perform t-test with single observation
⋮----
// Calculate paired differences (reported - backtested)
⋮----
// Calculate mean difference
⋮----
// Calculate sample variance (using n-1 for sample)
⋮----
// Calculate t-statistic
// t = (mean_diff - 0) / (stdDev / sqrt(n))
⋮----
// Calculate two-tailed p-value
⋮----
// Calculate 95% confidence interval
⋮----
/**
 * Interpret t-test results in plain language
 */
function interpretTTestResult(
  tStatistic: number,
  pValue: number,
  meanDiff: number,
  n: number
): string
⋮----
/**
 * Calculate Pearson correlation coefficient between backtested and reported P/L
 *
 * Measures the linear relationship between the two variables.
 * Range: -1 (perfect negative) to +1 (perfect positive)
 *
 * @param pairs - Array of matched trade pairs
 * @returns Correlation coefficient
 */
export function calculatePearsonCorrelation(pairs: MatchedPair[]): number | null
⋮----
// Calculate means
⋮----
// Calculate covariance and standard deviations
⋮----
// No variation in one or both variables
⋮----
/**
 * Calculate Spearman rank correlation coefficient
 *
 * Non-parametric measure of rank correlation. More robust to outliers
 * than Pearson correlation.
 *
 * @param pairs - Array of matched trade pairs
 * @returns Spearman's rho
 */
export function calculateSpearmanCorrelation(pairs: MatchedPair[]): number | null
⋮----
// Convert values to ranks
⋮----
// Calculate Pearson correlation on ranks
⋮----
/**
 * Convert values to ranks (average rank for ties)
 */
function getRanks(values: number[]): number[]
⋮----
// Find all items with same value (ties)
⋮----
// Assign average rank to all ties
⋮----
/**
 * Calculate correlation metrics and provide interpretation
 */
export function calculateCorrelationMetrics(pairs: MatchedPair[]): CorrelationMetrics | null
⋮----
/**
 * Interpret correlation strength
 */
function interpretCorrelation(pearsonR: number, spearmanRho: number): string
⋮----
// Check if Spearman differs significantly from Pearson
⋮----
/**
 * Calculate two-tailed p-value for t-statistic
 * Uses approximation for moderate to large sample sizes
 */
function calculateTwoTailedPValue(absTStatistic: number, df: number): number
⋮----
// For large df (>30), t-distribution approximates normal distribution
⋮----
// Use t-distribution approximation for smaller samples
⋮----
/**
 * Cumulative distribution function for standard normal distribution
 * Using Abramowitz and Stegun approximation
 */
function normalCDF(x: number): number
⋮----
/**
 * Cumulative distribution function for t-distribution
 * Using Hill's approximation (1970) for better accuracy
 */
function tCDF(t: number, df: number): number
⋮----
// Use Hill's algorithm for t-distribution CDF
// This is more accurate than simple normal approximation
⋮----
// For very large df, use normal approximation
⋮----
// Hill's approximation (unused in simplified implementation)
⋮----
// Cauchy distribution
⋮----
// For other cases, use beta function approximation
⋮----
/**
 * Approximate incomplete beta function
 * Used for t-distribution CDF calculation
 */
function incompleteBeta(a: number, b: number, x: number): number
⋮----
// Use continued fraction approximation for better accuracy
⋮----
/**
 * Log beta function
 */
function logBeta(a: number, b: number): number
⋮----
/**
 * Log gamma function using Stirling's approximation
 */
function logGamma(x: number): number
⋮----
/**
 * Continued fraction for incomplete beta function
 */
function betaContinuedFraction(a: number, b: number, x: number): number
⋮----
/**
 * Get critical t-value for given degrees of freedom
 * Returns value for two-tailed test with 95% confidence (alpha = 0.05)
 */
function getTCriticalValue(df: number): number
⋮----
// Common critical values for 95% confidence (alpha = 0.05)
// For two-tailed test, we use alpha/2 = 0.025
⋮----
// Find closest df in lookup table
⋮----
// Interpolate or use closest value
⋮----
// Linear interpolation
⋮----
// For very large df (>120), use normal approximation
return 1.96 // z-critical for 95% confidence
⋮----
/**
 * Calculate dual equity curves from matched trade pairs
 *
 * Builds cumulative P/L curves for both backtested and reported trades,
 * allowing visualization of performance divergence over time.
 *
 * @param pairs - Array of matched trade pairs (must be sorted by date)
 * @param initialCapital - Starting capital for both curves
 * @param normalizeTo1Lot - If true, normalize P/L to per-contract basis
 * @returns Array of equity curve points
 */
export function calculateDualEquityCurves(
  pairs: MatchedPair[],
  initialCapital = 0,
  normalizeTo1Lot = false
): EquityCurvePoint[]
⋮----
// Calculate P/L (normalized or total)
⋮----
// Accumulate P/L
⋮----
// Calculate difference metrics
⋮----
date: pair.reported.dateOpened.toISOString(), // Use reported date (should match backtested)
⋮----
/**
 * Calculate separate equity curves from all trades (not just matched pairs)
 *
 * Builds independent cumulative P/L curves for backtested and reported trades.
 * Unlike calculateDualEquityCurves, this shows the complete picture including
 * unmatched trades, allowing users to see the full performance story.
 *
 * @param backtestedTrades - Array of all backtested trades
 * @param reportedTrades - Array of all reported trades
 * @param initialCapital - Starting capital for both curves
 * @param normalizeTo1Lot - If true, normalize P/L to per-contract basis
 * @returns Object with separate arrays for backtested and reported equity curves
 */
export function calculateSeparateEquityCurves(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[],
  initialCapital = 0,
  normalizeTo1Lot = false
):
⋮----
const buildCurve = (
    trades: NormalizedTrade[],
    tradeType: 'backtested' | 'reported'
): SeparateEquityCurvePoint[] =>
⋮----
// Sort trades by date
```

## File: lib/calculations/slippage-analysis.ts
```typescript
/**
 * Slippage analysis for trade reconciliation
 *
 * Provides statistical analysis of slippage patterns, outlier detection,
 * and trend analysis for comparing backtested vs reported performance.
 */
⋮----
import { NormalizedTrade } from '@/lib/services/trade-reconciliation'
⋮----
export interface MatchedPair {
  backtested: NormalizedTrade
  reported: NormalizedTrade
}
⋮----
export interface SlippageDistribution {
  mean: number
  median: number
  mode: number | null
  stdDev: number
  percentiles: {
    p10: number
    p25: number
    p50: number
    p75: number
    p90: number
    p95: number
    p99: number
  }
  skewness: number
  kurtosis: number
}
⋮----
export interface SlippageOutliers {
  count: number
  tradeIds: string[]
  averageOutlierSlippage: number
  threshold: number // 2 std deviations
}
⋮----
threshold: number // 2 std deviations
⋮----
export interface SlippageTrend {
  slope: number // positive = worsening, negative = improving
  intercept: number
  isImproving: boolean
  rSquared: number
  interpretation: string
}
⋮----
slope: number // positive = worsening, negative = improving
⋮----
export interface SlippageAnalysis {
  distribution: SlippageDistribution
  outliers: SlippageOutliers
  trend: SlippageTrend
  byTimeOfDay: Record<string, number> // "09:30" -> avg slippage
  byDayOfWeek: Record<string, number> // "Monday" -> avg slippage
}
⋮----
byTimeOfDay: Record<string, number> // "09:30" -> avg slippage
byDayOfWeek: Record<string, number> // "Monday" -> avg slippage
⋮----
/**
 * Calculate comprehensive slippage analysis
 *
 * @param pairs - Array of matched trade pairs
 * @returns Complete slippage analysis
 */
export function calculateSlippageAnalysis(pairs: MatchedPair[]): SlippageAnalysis | null
⋮----
/**
 * Calculate slippage distribution statistics
 *
 * Slippage = reported premium - backtested premium
 * Positive = better than expected, Negative = worse than expected
 */
export function calculateSlippageDistribution(pairs: MatchedPair[]): SlippageDistribution
⋮----
// Mean
⋮----
// Median
⋮----
// Mode (most frequent value, binned)
⋮----
// Standard deviation (sample)
⋮----
// Percentiles
⋮----
// Skewness (measure of asymmetry)
⋮----
// Kurtosis (measure of tail heaviness)
⋮----
) / n - 3 // excess kurtosis
⋮----
/**
 * Identify outlier trades with excessive slippage
 *
 * Outliers are defined as trades with slippage > 2 standard deviations from mean
 */
export function identifySlippageOutliers(
  pairs: MatchedPair[],
  distribution?: SlippageDistribution
): SlippageOutliers
⋮----
/**
 * Calculate slippage trend over time using linear regression
 *
 * Returns slope (change per trade) and whether slippage is improving
 */
export function calculateSlippageTrend(pairs: MatchedPair[]): SlippageTrend
⋮----
// Sort pairs by time
⋮----
// X values: trade index (0, 1, 2, ...)
// Y values: slippage
⋮----
const meanX = (n - 1) / 2 // mean of 0, 1, 2, ..., n-1
⋮----
// Calculate slope and intercept using least squares regression
⋮----
// Calculate R-squared
let ssRes = 0 // sum of squares of residuals
let ssTot = 0 // total sum of squares
⋮----
// Negative slope = improving (slippage decreasing over time)
⋮----
/**
 * Interpret slippage trend
 */
function interpretSlippageTrend(slope: number, rSquared: number, isImproving: boolean): string
⋮----
/**
 * Calculate average slippage by time of day
 *
 * Groups trades by hour and returns average slippage for each hour
 */
export function calculateSlippageByTimeOfDay(pairs: MatchedPair[]): Record<string, number>
⋮----
/**
 * Calculate average slippage by day of week
 */
export function calculateSlippageByDayOfWeek(pairs: MatchedPair[]): Record<string, number>
⋮----
/**
 * Calculate percentile value from sorted array
 */
function calculatePercentile(sorted: number[], percentile: number): number
⋮----
/**
 * Calculate mode (most frequent value, binned to nearest 0.5)
 *
 * Returns null if distribution is too uniform
 */
function calculateMode(values: number[]): number | null
⋮----
// Bin values to nearest 0.5 for mode calculation
⋮----
// Find bin with highest frequency
⋮----
// Only return mode if it appears in at least 10% of trades
⋮----
/**
 * Calculate slippage per contract for each pair
 *
 * Useful for normalizing slippage across different contract sizes
 */
export function calculateSlippagePerContract(pairs: MatchedPair[]): number[]
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
export function computeTotalMaxProfit(trade: Trade): number | undefined
⋮----
export function computeTotalMaxLoss(trade: Trade): number | undefined
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
}
⋮----
dailyPl: number  // P/L for the day
dailyPlPct: number  // P/L percentage
drawdownPct: number  // Drawdown percentage
blockId?: string  // Optional block ID for linking to trades
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
  openingPrice: number
  legs: string
  initialPremium: number
  numContracts: number
  pl: number
  closingPrice?: number
  dateClosed?: Date
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
  "Opening Price": string
  "Legs": string
  "Initial Premium": string
  "No. of Contracts": string
  "P/L": string
  "Closing Price"?: string
  "Date Closed"?: string
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

## File: lib/models/validators.ts
```typescript
import { z } from 'zod'
⋮----
/**
 * Zod schema for validating raw trade data from CSV
 */
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

## File: lib/processing/daily-log-processor.ts
```typescript
/**
 * Daily Log Processor
 *
 * Handles parsing and processing of daily log CSV files from OptionOmega.
 * Converts raw CSV data to validated DailyLogEntry objects.
 */
⋮----
import { DailyLogEntry, REQUIRED_DAILY_LOG_COLUMNS } from '../models/daily-log'
// import { DAILY_LOG_COLUMN_MAPPING } from '../models/daily-log'
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
private validateRawDailyLogData(row: Record<string, string>, _rowIndex: number): Record<string, string> | null
⋮----
// Set default values for missing optional fields
⋮----
// Ensure required columns have values
⋮----
// Basic format validation (detailed validation happens in conversion)
⋮----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
import { Trade, TRADE_COLUMN_ALIASES, REQUIRED_TRADE_COLUMNS } from '../models/trade'
// import { TRADE_COLUMN_MAPPING } from '../models/trade'
import { ValidationError, ProcessingError } from '../models'
import { rawTradeDataSchema, tradeSchema } from '../models/validators'
import { CSVParser, ParseProgress } from './csv-parser'
import { findMissingHeaders, normalizeHeaders } from '../utils/csv-headers'
// import { CSVParseResult } from './csv-parser'
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
private validateRawTradeData(row: Record<string, string>, _rowIndex: number): Record<string, string> | null
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
⋮----
// Return null for invalid rows - they'll be counted as invalid
⋮----
/**
   * Convert validated CSV row to Trade object
   */
private convertToTrade(rawData: Record<string, string>): Trade
⋮----
// Parse dates
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
// Final validation with Zod schema
⋮----
/**
   * Process CSV content directly (for testing)
   */
async processCSVContent(content: string): Promise<TradeProcessingResult>
⋮----
// Create a mock File object for testing
```

## File: lib/stores/comparison-store.ts
```typescript
import { create } from 'zustand'
import { StrategyAlignment } from '@/lib/models/strategy-alignment'
import {
  ReconciliationPayload,
  buildTradeReconciliation,
} from '@/lib/services/trade-reconciliation'
⋮----
interface ComparisonStoreState {
  isLoading: boolean
  error: string | null
  data: ReconciliationPayload | null
  lastBlockId: string | null
  refresh: (blockId: string, alignments: StrategyAlignment[], normalizeTo1Lot?: boolean) => Promise<void>
  reset: () => void
}
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

## File: components/performance-charts/monthly-returns-chart.tsx
```typescript
import React, { useMemo, useState } from 'react'
import { ChartWrapper, createBarChartLayout } from './chart-wrapper'
import { usePerformanceStore } from '@/lib/stores/performance-store'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Layout, PlotData } from 'plotly.js'
⋮----
interface MonthlyReturnsChartProps {
  className?: string
}
⋮----
type ViewMode = 'dollars' | 'percent'
⋮----
// Flatten the data for chronological bar chart (matching legacy)
⋮----
// Only include months with non-zero values (matching legacy line 670)
⋮----
// Format label based on view mode
⋮----
// Color bars based on positive/negative values
⋮----
tickangle: 45, // Angle labels for readability
⋮----
b: 80, // More bottom margin for angled labels
⋮----
if (value) setViewMode(value as ViewMode)
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
⋮----
checked=
```

## File: components/sidebar-active-blocks.tsx
```typescript
import {
  IconArrowsShuffle,
  IconCheck,
  IconFileSpreadsheet,
  IconRefresh,
} from "@tabler/icons-react";
import { useState } from "react";
⋮----
import { useIsMobile } from "@/hooks/use-mobile";
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
const formatDate = (date: Date) =>
⋮----
// Mobile compact version - just block name and switch button
⋮----
// Desktop full version
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
/**
 * Minimum required columns for a valid trade log
 */
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
⋮----
function EmptyState(
```

## File: components/match-review-dialog.tsx
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { TradePair } from "@/lib/models/strategy-alignment";
import type { NormalizedTrade } from "@/lib/services/trade-reconciliation";
import type { AlignedTradeSet } from "@/lib/stores/comparison-store";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowLeft, CheckCircle2, Link2, Loader2, RotateCcw, Unlock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
⋮----
interface MatchReviewDialogProps {
  alignment: AlignedTradeSet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tradePairs: TradePair[]) => void;
  normalizeTo1Lot?: boolean;
  onNormalizeTo1LotChange?: (value: boolean) => void;
}
⋮----
interface SessionStats {
  session: string;
  matchedCount: number;
  unmatchedBacktestedCount: number;
  unmatchedReportedCount: number;
  backtestedCount: number;
  reportedCount: number;
  matchableCount: number;
  matchRate: number;
  hasUnmatched: boolean;
}
⋮----
function buildAutoPairsForSession(
  backtested: NormalizedTrade[],
  reported: NormalizedTrade[],
): TradePair[]
⋮----
const [loadedPairs, setLoadedPairs] = useState<TradePair[]>([]); // Track originally loaded pairs
⋮----
const [showBackConfirm, setShowBackConfirm] = useState(false); // Confirm before going back with unsaved changes
⋮----
// Track the alignment ID to detect when we switch to a different strategy comparison
⋮----
// Track if we just saved to skip the next alignment update
⋮----
// Keep a stable alignment reference during saves to prevent flashing
⋮----
// Use stable alignment during save to prevent flash
⋮----
// Skip state reset if we just saved - alignment data will match our local state
⋮----
stableAlignmentRef.current = null; // Clear stable ref after save completes
⋮----
// Build pairs from the session data
// Use the isPaired flag to distinguish actual pairs from unmatched trades
// that happen to be displayed side-by-side
⋮----
// Only load items that are actual pairs (from matchResult.pairs)
// Items with isPaired=false are just unmatched trades displayed together
⋮----
setLoadedPairs(newLoadedPairs); // Track what was originally loaded
⋮----
// Only reset session/filters if we're opening the dialog or switching alignments
⋮----
setSelectedSession(null); // Reset to session selection view
setSessionFilter('all'); // Reset filter
setDateRangeFilter('all'); // Reset date filter
⋮----
const handleUnlockPair = (pair: TradePair) =>
⋮----
const handleCreateManualPair = () =>
⋮----
// Insert the pair in chronological order based on backtested trade time
⋮----
// Sort by backtested trade sortTime
⋮----
const handleResetToAuto = () =>
⋮----
const confirmResetToAuto = () =>
⋮----
const handleSave = () =>
⋮----
// Store current alignment to prevent flash during refresh
⋮----
setLoadedPairs(confirmedPairs); // Update loaded pairs after save
⋮----
const handleClose = (nextOpen: boolean) =>
⋮----
// Calculate session stats
⋮----
// If no session selected, show session selection view
⋮----
// Match status filter
⋮----
// Date range filter
⋮----
// Session detail view - filter trades to selected session
⋮----
// Get paired trade IDs for this session
⋮----
// Get unmatched trades for this session
⋮----
// Build trade lookup maps (still need full alignment for lookups)
⋮----
// Check if there are unsaved changes
⋮----
const confirmBackToSessions = () =>
⋮----
// Reset to loaded state
⋮----
onOpenAutoFocus=
⋮----
{/* Confirmed Pairs Section */}
⋮----
{/* Unmatched Trades Section */}
⋮----
{/* Backtested Trades */}
⋮----
{/* Reported Trades */}
⋮----
{/* Create Pair Button */}
⋮----
// Always display premium as the per-contract (per-share) value traders expect
⋮----
// Always display premium as the per-contract (per-share) value traders expect
⋮----
Premium:
⋮----
// Session format is typically "YYYY-MM-DD"
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
getPopoverAnimationClass(),
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
{/* Attribution links in dialog for mobile */}
⋮----
{/* eslint-disable-next-line @next/next/no-img-element */}
⋮----
// Mobile compact version - minimal footer that stays fixed at bottom
⋮----
// Desktop compact version
⋮----
{/* eslint-disable-next-line @next/next/no-img-element */}
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

## File: lib/services/trade-reconciliation.ts
```typescript
import {
    calculateCorrelationMetrics,
    calculatePairedTTest,
    CorrelationMetrics,
    MatchedPair as StatMatchedPair,
    TTestResult,
} from '@/lib/calculations/reconciliation-stats'
import { getReportingTradesByBlock, getTradesByBlock } from '@/lib/db'
import { ReportingTrade } from '@/lib/models/reporting-trade'
import { MatchOverrides, StrategyAlignment, TradePair } from '@/lib/models/strategy-alignment'
import { Trade } from '@/lib/models/trade'
⋮----
const MATCH_TOLERANCE_MS = 30 * 60 * 1000 // 30 minutes
⋮----
export interface NormalizedTrade {
  id: string
  strategy: string
  dateOpened: Date
  timeOpened?: string
  sortTime: number
  session: string
  dateClosed?: Date
  premiumPerContract: number
  totalPremium: number
  contracts: number
  pl: number
  openingFees: number
  closingFees: number
  legs?: string
}
⋮----
export interface TradeSessionMatchItem {
  backtested?: NormalizedTrade
  reported?: NormalizedTrade
  autoBacktested: boolean
  autoReported: boolean
  includedBacktested: boolean
  includedReported: boolean
  isPaired: boolean  // true if from matchResult.pairs, false if from unmatched loop
}
⋮----
isPaired: boolean  // true if from matchResult.pairs, false if from unmatched loop
⋮----
export interface TradeSessionMatch {
  session: string
  items: TradeSessionMatchItem[]
}
⋮----
export interface AlignmentMetrics {
  backtested: TradeTotals
  reported: TradeTotals
  delta: TradeDeltaTotals
  matchRate: number
  slippagePerContract: number
  sizeVariance: number
  tTest: TTestResult | null
  correlation: CorrelationMetrics | null
  matched: {
    tradeCount: number
    totalSlippage: number
    backtestedAvgPremiumPerContract: number
    backtestedContractBaseline: number
  }
  notes?: string
}
⋮----
export interface AlignedTradeSet {
  alignmentId: string
  backtestedStrategy: string
  reportedStrategy: string
  backtestedTrades: NormalizedTrade[]
  reportedTrades: NormalizedTrade[]
  metrics: AlignmentMetrics
  sessions: TradeSessionMatch[]
  autoSelectedBacktestedIds: string[]
  autoSelectedReportedIds: string[]
  selectedBacktestedIds: string[]
  selectedReportedIds: string[]
}
⋮----
export interface TradeTotals {
  tradeCount: number
  totalPl: number
  avgPl: number
  totalPremium: number
  totalContracts: number
  totalFees: number
  avgPremiumPerContract: number
}
⋮----
export type TradeDeltaTotals = TradeTotals
⋮----
export interface ReconciliationPayload {
  alignments: AlignedTradeSet[]
  unmappedReported: string[]
  unmappedBacktested: string[]
}
⋮----
interface MatchedPair {
  backtested: NormalizedTrade
  reported: NormalizedTrade
}
⋮----
interface AutoMatchResult {
  pairs: MatchedPair[]
  unmatchedBacktested: NormalizedTrade[]
  unmatchedReported: NormalizedTrade[]
}
⋮----
export async function buildTradeReconciliation(
  blockId: string,
  alignments: StrategyAlignment[],
  normalizeTo1Lot = false,
): Promise<ReconciliationPayload>
⋮----
function buildAlignmentSet(
  alignment: StrategyAlignment,
  backtestedByStrategy: Map<string, NormalizedTrade[]>,
  reportedByStrategy: Map<string, NormalizedTrade[]>,
  normalizeTo1Lot: boolean,
): AlignedTradeSet
⋮----
// Build lookup maps for trades by ID
⋮----
// Determine if we should use explicit pairs or auto-match
⋮----
// Use explicit trade pairs from overrides
⋮----
// With explicit pairs, selected IDs should honor explicit selections when provided.
⋮----
// Auto IDs are those marked as non-manual
⋮----
// Fall back to auto-matching
⋮----
// Use legacy selectedIds if available, otherwise use auto-matched IDs
⋮----
function normalizeBacktestedTrade(trade: Trade): NormalizedTrade
⋮----
// OptionOmega-style CSV exports encode premium in cents (e.g. 1360 -> $13.60).
// Prefer the precision flag captured during CSV parsing; fall back to legacy detection
// for trades saved before that metadata existed.
⋮----
function normalizeReportedTrade(trade: ReportingTrade): NormalizedTrade
⋮----
function autoMatchTrades(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[],
): AutoMatchResult
⋮----
function buildMatchResultFromPairs(
  tradePairs: TradePair[],
  backtestedById: Map<string, NormalizedTrade>,
  reportedById: Map<string, NormalizedTrade>,
  allBacktested: NormalizedTrade[],
  allReported: NormalizedTrade[],
): AutoMatchResult
⋮----
// Build pairs from explicit pairing data
⋮----
// Identify unmatched trades
⋮----
/**
 * Extract option type from trade legs
 * Helps match Calls with Calls and Puts with Puts in strategies with concurrent positions
 */
function extractOptionType(legs: string | undefined): 'call' | 'put' | 'mixed' | 'unknown'
⋮----
function findBestWithinTolerance(
  reported: NormalizedTrade,
  candidates: NormalizedTrade[],
): NormalizedTrade | undefined
⋮----
// Extract option type from reported trade
⋮----
// Find the closest match by time within tolerance, preferring matching option types
⋮----
// Prefer matching option types, then fall back to closest time
⋮----
bestIdx < 0 || // No match yet
(matchesType && !bestMatchesType) || // This matches type, current best doesn't
(matchesType === bestMatchesType && diff < bestDiff) // Same type-match status, closer time
⋮----
function buildSessionMatches(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[],
  matchResult: AutoMatchResult,
  selectedBacktestedIds: Set<string>,
  selectedReportedIds: Set<string>,
  autoBacktestedIds: Set<string>,
  autoReportedIds: Set<string>,
): TradeSessionMatch[]
⋮----
type SessionData = {
    pairs: TradeSessionMatchItem[]
    unmatchedBack: NormalizedTrade[]
    unmatchedReported: NormalizedTrade[]
  }
⋮----
const ensureSession = (session: string): SessionData =>
⋮----
isPaired: true,  // This item represents an actual pair
⋮----
const sortByTime = (item: TradeSessionMatchItem)
⋮----
isPaired: false,  // This item is just unmatched trades displayed together
⋮----
function buildMetrics(
  selectedBacktested: NormalizedTrade[],
  selectedReported: NormalizedTrade[],
  matchedPairs: MatchedPair[],
  normalizeTo1Lot: boolean,
): AlignmentMetrics
⋮----
const normalizedContractWeight = (trade: NormalizedTrade): number
⋮----
const normalizedPremium = (trade: NormalizedTrade): number
⋮----
// Calculate match rate as percentage of matched pairs out of the larger dataset
// This gives a more realistic alignment quality metric
⋮----
// Calculate statistical metrics for matched pairs
⋮----
function normalizeTradeForStats(trade: NormalizedTrade, normalizeTo1Lot: boolean): NormalizedTrade
⋮----
function calculateTradeTotals(trades: NormalizedTrade[], normalizeTo1Lot: boolean): TradeTotals
⋮----
// Scale values to per-contract if normalization is enabled
⋮----
function calculateDeltaTotals(
  backtested: TradeTotals,
  reported: TradeTotals,
): TradeDeltaTotals
⋮----
function filterBacktestedTrades(
  backtestedTrades: NormalizedTrade[],
  reportedTrades: NormalizedTrade[],
): NormalizedTrade[]
⋮----
function resolveSortTime(dateOpened: Date, timeOpened?: string): number
⋮----
const pad = (value: string)
⋮----
function buildTradeId(
  strategy: string,
  dateOpened: Date,
  timeOpened: string | undefined,
  contracts: number,
  pl: number,
): string
⋮----
function formatSession(date: Date): string
⋮----
function groupByStrategy(trades: NormalizedTrade[]): Map<string, NormalizedTrade[]>
⋮----
function groupBySession(trades: NormalizedTrade[]): Map<string, NormalizedTrade[]>
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
{/* Last Modified */}
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
{/* Last Modified */}
⋮----

⋮----
{/* Actions */}
⋮----
{/* Progress dialog for recalculation */}
⋮----
// Reset state and retry
⋮----
{/* Loading skeleton */}
⋮----
{/* Confirmation dialog for clearing all data */}
```

## File: app/(platform)/comparison-blocks/page.tsx
```typescript
import { MatchReviewDialog } from "@/components/match-review-dialog";
import { NoActiveBlock } from "@/components/no-active-block";
import { ReconciliationMetrics } from "@/components/reconciliation-charts/ReconciliationMetrics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getBlock,
  getReportingTradesByBlock,
  getTradesByBlockWithOptions,
  updateBlock as updateProcessedBlock,
} from "@/lib/db";
import { StrategyAlignment } from "@/lib/models/strategy-alignment";
import { useBlockStore } from "@/lib/stores/block-store";
import { useComparisonStore } from "@/lib/stores/comparison-store";
import { cn } from "@/lib/utils";
import {
  downloadCsv,
  downloadJson,
  generateExportFilename,
  toCsvRow,
} from "@/lib/utils/export-helpers";
import { Check, Download, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
⋮----
interface SelectableStrategy {
  name: string;
  count: number;
  totalPl: number;
}
⋮----
function buildStrategySummary(
  strategies: string[],
  values: { strategy: string; pl: number }[]
): SelectableStrategy[]
⋮----
// Clear alignments immediately to prevent stale data
⋮----
const load = async () =>
⋮----
const handleOpenMatchDialog = (alignmentId: string) =>
⋮----
// Memoize to keep stable reference during loading/refreshes
⋮----
// Only show comparison data if it matches the current block
⋮----
// Only count as matched if isPaired is true (actual pair from matchResult.pairs)
// Items with both trades but isPaired=false are just unmatched trades displayed together
⋮----
// Export functions
const exportAsJson = () =>
⋮----
const exportAsCsv = () =>
⋮----
// Metadata
⋮----
// Summary
⋮----
// Per-alignment metrics
⋮----
const handleSaveMatchOverrides = async (
    alignmentId: string,
    tradePairs: import("@/lib/models/strategy-alignment").TradePair[]
) =>
⋮----
// selectedBacktestedIds and selectedReportedIds should contain ALL trades
// to ensure they're included in stats calculations.
// The tradePairs array is the authoritative source for what's actually paired.
// The isPaired flag in session items distinguishes real pairs from unmatched trades.
⋮----
// Refresh comparison with the new alignments
⋮----
// Keep the dialog open so the user can navigate back to sessions
⋮----
const persistAlignments = async (nextAlignments: StrategyAlignment[]) =>
⋮----
const resetDialogState = () =>
⋮----
const openCreateDialog = () =>
⋮----
const openEditDialog = (mapping: StrategyAlignment) =>
⋮----
const handleDialogClose = (open: boolean) =>
⋮----
const removeMapping = async (id: string) =>
⋮----
const upsertMapping = async () =>
⋮----
{/* Statistical Analysis Section - Show detailed metrics for selected alignment */}
⋮----
{/* Reconciliation Metrics Dashboard */}
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
{/* Header with title */}
⋮----
{/* Content */}
⋮----
{/* Flavor text */}
⋮----
{/* Detailed explanation */}
⋮----
// Utility function to create common chart configurations
⋮----
// Common layout configurations
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
onKellyChange(strategy.name, values[0])
⋮----
onBlur=
⋮----
{/* Summary footer */}
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

## File: lib/calculations/correlation.ts
```typescript
import { Trade } from "@/lib/models/trade";
import { mean } from "mathjs";
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
/**
 * Convert array of values to ranks (handling ties with average rank)
 */
function getRanks(values: number[]): number[]
⋮----
// Find all tied values
⋮----
// Assign average rank to all tied values
const averageRank = (i + j + 1) / 2; // +1 because ranks are 1-indexed
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
 */
export async function deleteDatabase(): Promise<void>
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
⋮----
type WalkForwardPresetKey = 'conservative' | 'moderate' | 'aggressive'
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
  runAnalysis: (blockId: string) => Promise<void>
  cancelAnalysis: () => void
  loadHistory: (blockId: string) => Promise<void>
  updateConfig: (config: Partial<Omit<WalkForwardConfig, 'parameterRanges'>>) => void
  setParameterRange: (key: string, range: WalkForwardParameterRangeTuple) => void
  applyPreset: (preset: WalkForwardPresetKey) => void
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
// Max profit/loss: sum if available for all trades, otherwise undefined
⋮----
// Use margin requirement as ground truth for worst-case loss.
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
checked=
⋮----
toggleChart(chart.id)
⋮----
{/* Note about other exports */}
⋮----
{/* Right: Instructions */}
```

## File: components/walk-forward/period-selector.tsx
```typescript
import { IconPlayerPlay } from "@tabler/icons-react"
import { HelpCircle, Loader2, Square } from "lucide-react"
import { useMemo } from "react"
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
const handleRun = async () =>
⋮----
onChange=
⋮----
updateConfig(
```

## File: components/app-sidebar.tsx
```typescript
import {
  IconChartHistogram,
  IconGauge,
  IconLayoutDashboard,
  IconLink,
  IconReportAnalytics,
  IconRouteSquare,
  IconSparkles,
  IconStack2,
  IconTimelineEvent,
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
⋮----
{/* Scroll indicator - subtle gradient fade at bottom */}
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
import { buildPerformanceSnapshot } from "@/lib/services/performance-snapshot";
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
import { useComparisonStore } from "@/lib/stores/comparison-store";
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
setIsProcessing(true); // Restore for remaining operations
⋮----
// Track if we need to clear caches/comparison data
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
// Clear comparison data since reporting trades changed
⋮----
// Clear comparison data since reporting log was removed
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
onDrop=
⋮----
onChange=
⋮----

⋮----
{/* Block Details */}
⋮----
{/* File Uploads */}
⋮----
{/* Processing Status */}
⋮----
{/* Errors */}
⋮----
{/* Options */}
⋮----
setSetAsActive(checked === true)
⋮----
{/* Combine Leg Groups toggle */}
⋮----
{/* Progress dialog for pre-calculation */}
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
// Delete the main TradeBlocksDB
⋮----
// Also delete the cache database if it exists
⋮----
req.onblocked = () => resolve(); // Continue even if blocked
⋮----
// Ignore cache deletion errors
⋮----
// Clear all tradeblocks-related localStorage entries
⋮----
// Even if delete fails, try to reload - user can try again
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
setAllStrategiesKellyPct(normalizeKellyValue(values[0]))
⋮----
selectedStrategies.forEach((strategy) =>
setKellyValues((prev) => (
⋮----
{/* Action buttons */}
⋮----
setKellyValues(resetValues);
setAllStrategiesKellyPct(100);
⋮----
{/* Results */}
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
{/* Column 3 - Trades Per Year */}
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
Best for strategies with fixed position sizes.
⋮----
fixed dollar amounts.
⋮----
setResampleMethod(value as "trades" | "daily" | "percentage")
⋮----
{/* Worst-Case Scenario Injection */}
⋮----
{/* Enable Toggle */}
⋮----
{/* Percentage Slider */}
⋮----
setWorstCasePercentage(values[0])
⋮----
{/* Injection Mode */}
⋮----
{/* Loss Sizing */}
⋮----
{/* Percentage Basis */}
⋮----
{/* Advanced Settings */}
⋮----
{/* Use Recent Data Slider */}
⋮----
setResamplePercentage(values[0])
⋮----
{/* Random Seed */}
⋮----
{/* Action Buttons */}
⋮----
{/* Results */}
⋮----
{/* Equity Curve Chart */}
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
  Download,
  Gauge,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
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
{/* Basic Overview */}
⋮----

⋮----
{/* Return Metrics */}
⋮----
{/* Risk & Drawdown */}
⋮----
{/* Consistency Metrics */}
⋮----
{/* Execution Efficiency */}
⋮----
{/* Strategy Breakdown */}
⋮----
winRate: stat.winRate * 100, // Convert to percentage
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
import { MFEMAEScatterChart } from "@/components/performance-charts/mfe-mae-scatter-chart";
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
⋮----
// UI Components
import { MultiSelect } from "@/components/multi-select";
import { NoActiveBlock } from "@/components/no-active-block";
import { PerformanceExportDialog } from "@/components/performance-export-dialog";
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
import { SizingModeToggle } from "@/components/sizing-mode-toggle";
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
{/* Tab 5: Excursion Analysis */}
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
setPeriodRange([Math.min(a, b), Math.max(a, b)]);
⋮----
<TableCell className=
```

## File: components/performance-charts/mfe-mae-scatter-chart.tsx
```typescript
import React, { useEffect, useMemo, useState } from "react"
import { ChartWrapper } from "./chart-wrapper"
import { usePerformanceStore } from "@/lib/stores/performance-store"
import type { Layout, PlotData } from "plotly.js"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  NORMALIZATION_BASES,
  type MFEMAEDataPoint,
  type NormalizationBasis
} from "@/lib/calculations/mfe-mae"
import type { EfficiencyBasis } from "@/lib/metrics/trade-efficiency"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
⋮----
type AxisValueFormat =
  | { type: "currency"; maximumFractionDigits?: number }
  | { type: "percent"; maximumFractionDigits?: number }
  | { type: "number"; maximumFractionDigits?: number }
⋮----
interface AxisOption {
  value: string
  label: string
  axisLabel: string
  format: AxisValueFormat
  accessor: (point: MFEMAEDataPoint) => number | null
}
⋮----
function isFiniteNumber(value: number | null): value is number
⋮----
function formatAxisValue(value: number, format: AxisValueFormat): string
⋮----
interface PresetConfig {
  id: string
  label: string
  description: string
  xMetric: string
  yMetric: string
  // Additional layout customizations per preset
  layoutCustomizations?: Partial<Layout>
  // Special trace handling (e.g., reference lines, zones)
  addSpecialTraces?: (points: { point: MFEMAEDataPoint; xValue: number; yValue: number }[], xMetric: string, yMetric: string) => Partial<PlotData>[]
}
⋮----
// Additional layout customizations per preset
⋮----
// Special trace handling (e.g., reference lines, zones)
⋮----
interface DriftBucketConfig {
  label: string
  min: number
  max: number
}
⋮----
const addOption = (option: AxisOption) =>
⋮----
const makeNormalizedAccessor = (
      basis: NormalizationBasis,
      key: "maePercent" | "mfePercent" | "plPercent"
) => (point: MFEMAEDataPoint) =>
⋮----
// Available presets based on data
⋮----
// Initialize or update metrics when preset changes
⋮----
// Keep selectedPreset valid
⋮----
// Handle preset selection
⋮----
// Custom mode or preset not available - use fallback logic
const findFirstAvailable = (preferred: string[], exclude?: string) =>
⋮----
// Detect when user manually changes axes (switch to custom mode)
const handleXMetricChange = (value: string) =>
⋮----
const handleYMetricChange = (value: string) =>
⋮----
type SlrMode = "ratio" | "percent" | null
const slrModeFromMetric = (metric?: string | null): SlrMode =>
⋮----
// Helper to build typed custom-data payloads for Plotly
interface TooltipData {
    trade: number
    strategy: string
    date: string
    xLabel: string
    yLabel: string
    xFormatted: string
    yFormatted: string
    maeRaw: string
    mfeRaw: string
    pl: string
    profitCapture: string
    excursionRatio: string
    basisLabel: string
    premiumDenominator: string
    marginDenominator: string
    premiumPlPercent: string
    marginPlPercent: string
    openingSlr: string
    closingSlr: string
    slrDrift: string
  }
⋮----
type PlotCustomData = TooltipData
⋮----
const toCustomData = (entry:
⋮----
// Add diagonal line for MFE vs MAE charts
⋮----
// Add preset-specific traces
⋮----
// Base layout
⋮----
// Merge with preset-specific layout customizations
⋮----
interface SlrTableRow {
    label: string
    count: number
    winRate: number
    avgPlPercent: number
    avgPlDollar: number
  }
⋮----
// Get current preset for description
⋮----
{/* Preset Selector */}
⋮----
{/* Axis Selectors - Always rendered but hidden when not in custom mode */}
```

## File: lib/stores/performance-store.ts
```typescript
import { DailyLogEntry } from '@/lib/models/daily-log'
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
}
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
// Check if we can use cached snapshot (default view with no filters)
⋮----
riskFreeRate === 2.0 // explicit parity with block-stats page default
⋮----
// Use cached data - much faster!
// Still need raw trades for groupedLegOutcomes
⋮----
// Cache miss or filters applied - compute normally
⋮----
// Re-export for existing unit tests that rely on chart processing helpers
⋮----
function filterTradesForSnapshot(trades: Trade[], filters: SnapshotFilters): Trade[]
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
