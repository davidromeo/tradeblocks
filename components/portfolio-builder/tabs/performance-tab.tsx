"use client";

/**
 * Performance Tab - Full performance analysis for the combined mega block
 *
 * Reuses all performance chart components from the blocks page by loading
 * mega block data into the performance store.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  loadMegaBlockPerformance,
  MegaBlockPerformanceData,
} from "@/lib/services/mega-block";
import { usePerformanceStore } from "@/lib/stores/performance-store";
import { AlertTriangle, BarChart3, Gauge, TrendingUp, Zap } from "lucide-react";
import { useEffect, useState, useRef } from "react";

// Chart Components
import { DayOfWeekChart } from "@/components/performance-charts/day-of-week-chart";
import { DrawdownChart } from "@/components/performance-charts/drawdown-chart";
import { EquityCurveChart } from "@/components/performance-charts/equity-curve-chart";
import { ExitReasonChart } from "@/components/performance-charts/exit-reason-chart";
import { HoldingDurationChart } from "@/components/performance-charts/holding-duration-chart";
import { MarginUtilizationChart } from "@/components/performance-charts/margin-utilization-chart";
import { MarginUtilizationTable } from "@/components/performance-charts/margin-utilization-table";
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
import { SizingConfig, BlockSizingStats } from "@/lib/models/mega-block";

interface SelectedBlock {
  blockId: string;
  name: string;
  sizingConfig: SizingConfig;
  stats?: BlockSizingStats;
}

interface PerformanceTabProps {
  selectedBlocks: SelectedBlock[];
  startingCapital: number;
}

export function PerformanceTab({
  selectedBlocks,
  startingCapital,
}: PerformanceTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localData, setLocalData] = useState<MegaBlockPerformanceData | null>(null);

  // Track last loaded config to avoid unnecessary reloads
  const lastLoadedRef = useRef<string>("");

  // Load mega block performance data
  useEffect(() => {
    async function loadPerformance() {
      if (selectedBlocks.length < 2) {
        setLocalData(null);
        setIsLoading(false);
        return;
      }

      // Create a key to detect if we need to reload
      const configKey = JSON.stringify({
        blocks: selectedBlocks.map((b) => ({
          id: b.blockId,
          sizingConfig: b.sizingConfig,
          hasStats: !!b.stats,
        })),
        capital: startingCapital,
      });

      // Skip if already loaded with same config
      if (configKey === lastLoadedRef.current) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const performanceData = await loadMegaBlockPerformance({
          sourceBlocks: selectedBlocks.map((b) => ({
            blockId: b.blockId,
            sizingConfig: b.sizingConfig,
            stats: b.stats,
          })),
          portfolioCapital: startingCapital,
        });

        setLocalData(performanceData);
        lastLoadedRef.current = configKey;
      } catch (err) {
        console.error("Failed to load mega block performance:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load performance data"
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadPerformance();
  }, [selectedBlocks, startingCapital]);

  // Sync local data to the performance store so charts can read from it
  useEffect(() => {
    if (localData) {
      // Directly set the store's data field
      // Note: We need to add dailyLogs and allDailyLogs for type compatibility
      usePerformanceStore.setState({
        data: {
          ...localData,
          dailyLogs: [],
          allDailyLogs: [],
          enrichedTrades: [], // Empty for now - could be computed if needed
        },
        isLoading: false,
        error: null,
      });
    }
  }, [localData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
            <p className="text-muted-foreground text-center max-w-md">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!localData || selectedBlocks.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Select at least 2 blocks to see performance analysis for the combined
            portfolio.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabbed Interface - mirrors performance-blocks page */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" className="px-2.5 sm:px-3">
            <code className="flex items-center gap-1 text-[13px] [&>svg]:h-4 [&>svg]:w-4">
              <BarChart3 /> Overview
            </code>
          </TabsTrigger>
          <TabsTrigger value="returns" className="px-2.5 sm:px-3">
            <code className="flex items-center gap-1 text-[13px] [&>svg]:h-4 [&>svg]:w-4">
              <TrendingUp /> Returns Analysis
            </code>
          </TabsTrigger>
          <TabsTrigger value="risk" className="px-2.5 sm:px-3">
            <code className="flex items-center gap-1 text-[13px] [&>svg]:h-4 [&>svg]:w-4">
              <Gauge /> Risk & Margin
            </code>
          </TabsTrigger>
          <TabsTrigger value="efficiency" className="px-2.5 sm:px-3">
            <code className="flex items-center gap-1 text-[13px] [&>svg]:h-4 [&>svg]:w-4">
              <Zap /> Trade Efficiency
            </code>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6">
          <EquityCurveChart />
          <DrawdownChart />
          <WinLossStreaksChart />
        </TabsContent>

        {/* Tab 2: Returns Analysis */}
        <TabsContent value="returns" className="space-y-6">
          <MonthlyReturnsChart />
          <ReturnDistributionChart />
          <DayOfWeekChart />
          <TradeSequenceChart />
          <RollingMetricsChart />
          <VixRegimeChart />
        </TabsContent>

        {/* Tab 3: Risk & Margin */}
        <TabsContent value="risk" className="space-y-6">
          <ROMTimelineChart />
          <GroupedLegOutcomesChart />
          <MarginUtilizationChart />
          <MarginUtilizationTable />
          <RiskEvolutionChart />
          <HoldingDurationChart />
        </TabsContent>

        {/* Tab 4: Trade Efficiency */}
        <TabsContent value="efficiency" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ExitReasonChart />
            <PremiumEfficiencyChart />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PerformanceTab;
