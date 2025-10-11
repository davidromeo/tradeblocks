"use client";

import { useEffect, useState } from 'react'
import { useBlockStore } from '@/lib/stores/block-store'
import { usePerformanceStore, type DateRange } from '@/lib/stores/performance-store'
import { AlertTriangle, Loader2, Calendar } from 'lucide-react'

// Chart Components
import { EquityCurveChart } from '@/components/performance-charts/equity-curve-chart'
import { DrawdownChart } from '@/components/performance-charts/drawdown-chart'
import { DayOfWeekChart } from '@/components/performance-charts/day-of-week-chart'
import { ReturnDistributionChart } from '@/components/performance-charts/return-distribution-chart'
import { WinLossStreaksChart } from '@/components/performance-charts/win-loss-streaks-chart'
import { MonthlyReturnsChart } from '@/components/performance-charts/monthly-returns-chart'
import { TradeSequenceChart } from '@/components/performance-charts/trade-sequence-chart'
import { RollingMetricsChart } from '@/components/performance-charts/rolling-metrics-chart'
import { RiskEvolutionChart } from '@/components/performance-charts/risk-evolution-chart'
import { ROMTimelineChart } from '@/components/performance-charts/rom-timeline-chart'

// UI Components
import { MultiSelect } from '@/components/multi-select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function PerformanceBlocksPage() {
  const [isInitialized, setIsInitialized] = useState(false)

  // Block store
  const activeBlock = useBlockStore(state => {
    const activeBlockId = state.activeBlockId
    return activeBlockId ? state.blocks.find(block => block.id === activeBlockId) : null
  })
  const isBlockLoading = useBlockStore(state => state.isLoading)
  const blockIsInitialized = useBlockStore(state => state.isInitialized)
  const loadBlocks = useBlockStore(state => state.loadBlocks)

  // Performance store
  const {
    isLoading,
    error,
    fetchPerformanceData,
    data,
    dateRange,
    setDateRange,
    setSelectedStrategies
  } = usePerformanceStore()

  // Initialize blocks if needed
  useEffect(() => {
    if (!blockIsInitialized) {
      loadBlocks().catch(console.error)
    }
  }, [blockIsInitialized, loadBlocks])

  // Fetch performance data when active block changes
  useEffect(() => {
    if (activeBlock && !isInitialized) {
      fetchPerformanceData(activeBlock.id)
        .then(() => setIsInitialized(true))
        .catch(console.error)
    }
  }, [activeBlock?.id, activeBlock, fetchPerformanceData, isInitialized])

  // Helper functions
  const getDateRange = () => {
    if (!data || data.trades.length === 0) return "No trades"

    const sortedTrades = [...data.trades].sort((a, b) =>
      new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
    )

    const startDate = new Date(sortedTrades[0].dateOpened).toLocaleDateString()
    const endDate = new Date(sortedTrades[sortedTrades.length - 1].dateOpened).toLocaleDateString()

    return `${startDate} to ${endDate}`
  }

  const getStrategyOptions = () => {
    if (!data || data.allTrades.length === 0) return []

    const uniqueStrategies = [...new Set(data.allTrades.map(trade => trade.strategy || 'Unknown'))]
    return uniqueStrategies.map(strategy => ({
      label: strategy,
      value: strategy,
    }))
  }

  // Show loading state
  if (!blockIsInitialized || isBlockLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading blocks...</p>
        </div>
      </div>
    )
  }

  // Show message if no active block
  if (!activeBlock) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Active Block Selected</h3>
          <p className="text-muted-foreground mb-4">
            Please select a block from the sidebar to view its performance analysis.
          </p>
        </div>
      </div>
    )
  }

  // Show loading state for performance data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading {activeBlock.name} performance data...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Performance Data</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
        </div>
      </div>
    )
  }

  // Show empty state if no data
  if (!data || data.allTrades.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Trade Data</h3>
          <p className="text-muted-foreground mb-4">
            This block doesn&apos;t contain any trades yet. Upload trading data to see performance analytics.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Date Range</Label>
          <Select
            value={dateRange.preset}
            onValueChange={(value) => setDateRange({ ...dateRange, preset: value as DateRange['preset'] })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="1y">Last 12 Months</SelectItem>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="3m">Last 3 Months</SelectItem>
              <SelectItem value="1m">Last Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 flex-1 min-w-[250px]">
          <Label>Strategies</Label>
          <MultiSelect
            options={getStrategyOptions()}
            onValueChange={setSelectedStrategies}
            placeholder="All strategies"
            maxCount={3}
            className="w-full"
          />
        </div>
        <Badge variant="outline" className="text-xs">
          <Calendar className="w-3 h-3 mr-1" />
          {getDateRange()}
        </Badge>
      </div>

      {/* Main Equity Analysis - Full Width */}
      <EquityCurveChart />

      {/* Drawdown Analysis - Full Width */}
      <DrawdownChart />

      {/* Win/Loss Streaks - Full Width */}
      <WinLossStreaksChart />

      {/* Return on Margin Timeline - Full Width */}
      <ROMTimelineChart />

      {/* Distribution and Pattern Analysis - Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReturnDistributionChart />
        <DayOfWeekChart />
      </div>

      {/* Monthly and Trade Analysis - Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyReturnsChart />
        <TradeSequenceChart />
      </div>

      {/* Rolling Analysis - Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RollingMetricsChart />
        <RiskEvolutionChart />
      </div>
    </div>
  )
}
