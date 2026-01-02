"use client";

/**
 * Block Stats Tab - Comprehensive statistics for the combined mega block
 *
 * Displays all portfolio metrics for the weighted combination of selected blocks,
 * reusing the same MetricCard and MetricSection components as the Block Stats page.
 */

import { MetricCard } from "@/components/metric-card";
import { MetricSection } from "@/components/metric-section";
import { StrategyBreakdownTable } from "@/components/strategy-breakdown-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  loadMegaBlockPerformance,
  MegaBlockPerformanceData,
} from "@/lib/services/mega-block";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";
import { StrategyStats } from "@/lib/models/portfolio-stats";
import {
  calculatePremiumEfficiencyPercent,
  computeTotalPremium,
} from "@/lib/metrics/trade-efficiency";
import { SizingConfig, BlockSizingStats } from "@/lib/models/mega-block";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Gauge,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface SelectedBlock {
  blockId: string;
  name: string;
  sizingConfig: SizingConfig;
  stats?: BlockSizingStats;
}

interface BlockStatsTabProps {
  selectedBlocks: SelectedBlock[];
  startingCapital: number;
}

export function BlockStatsTab({
  selectedBlocks,
  startingCapital,
}: BlockStatsTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MegaBlockPerformanceData | null>(null);
  const [strategyStats, setStrategyStats] = useState<Record<string, StrategyStats>>({});

  // Track last loaded config to avoid unnecessary reloads
  const lastLoadedRef = useRef<string>("");

  // Load mega block performance data
  useEffect(() => {
    async function loadStats() {
      if (selectedBlocks.length < 2) {
        setData(null);
        setStrategyStats({});
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

        setData(performanceData);

        // Calculate strategy stats from merged trades
        const calculator = new PortfolioStatsCalculator({ riskFreeRate: 2.0 });
        const strategies = calculator.calculateStrategyStats(performanceData.trades);
        setStrategyStats(strategies);

        lastLoadedRef.current = configKey;
      } catch (err) {
        console.error("Failed to load mega block stats:", err);
        setError(err instanceof Error ? err.message : "Failed to load statistics");
      } finally {
        setIsLoading(false);
      }
    }

    loadStats();
  }, [selectedBlocks, startingCapital]);

  // Helper functions for derived metrics
  const getDateRange = () => {
    if (!data || data.trades.length === 0) return "No trades";

    const sortedTrades = [...data.trades].sort(
      (a, b) => new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
    );

    const startDate = new Date(sortedTrades[0].dateOpened).toLocaleDateString();
    const endDate = new Date(
      sortedTrades[sortedTrades.length - 1].dateOpened
    ).toLocaleDateString();

    return `${startDate} to ${endDate}`;
  };

  const getAvgReturnOnMargin = () => {
    if (!data) return 0;

    const tradesWithMargin = data.trades.filter(
      (trade) => trade.marginReq && trade.marginReq > 0
    );
    if (tradesWithMargin.length === 0) return 0;

    const totalReturnOnMargin = tradesWithMargin.reduce((sum, trade) => {
      const rom = (trade.pl / trade.marginReq!) * 100;
      return sum + rom;
    }, 0);

    return totalReturnOnMargin / tradesWithMargin.length;
  };

  const getStdDevOfRoM = () => {
    if (!data) return 0;

    const tradesWithMargin = data.trades.filter(
      (trade) => trade.marginReq && trade.marginReq > 0
    );
    if (tradesWithMargin.length === 0) return 0;

    const avgRoM = getAvgReturnOnMargin();
    const roms = tradesWithMargin.map((trade) => (trade.pl / trade.marginReq!) * 100);

    const variance =
      roms.reduce((sum, rom) => sum + Math.pow(rom - avgRoM, 2), 0) / roms.length;
    return Math.sqrt(variance);
  };

  const getBestTrade = () => {
    if (!data || data.trades.length === 0) return 0;

    return Math.max(
      ...data.trades.map((trade) => {
        if (!trade.marginReq || trade.marginReq <= 0) return 0;
        return (trade.pl / trade.marginReq) * 100;
      })
    );
  };

  const getWorstTrade = () => {
    if (!data || data.trades.length === 0) return 0;

    return Math.min(
      ...data.trades.map((trade) => {
        if (!trade.marginReq || trade.marginReq <= 0) return 0;
        return (trade.pl / trade.marginReq) * 100;
      })
    );
  };

  const getCommissionShareOfPremium = () => {
    if (!data || data.trades.length === 0) return 0;

    const totals = data.trades.reduce(
      (acc, trade) => {
        const totalPremium = computeTotalPremium(trade) ?? 0;
        const commissions =
          (trade.openingCommissionsFees ?? 0) + (trade.closingCommissionsFees ?? 0);

        return {
          premium: acc.premium + totalPremium,
          commissions: acc.commissions + commissions,
        };
      },
      { premium: 0, commissions: 0 }
    );

    if (totals.premium === 0) return 0;
    return (totals.commissions / totals.premium) * 100;
  };

  const getAvgPremiumEfficiency = () => {
    if (!data || data.trades.length === 0) return 0;

    const efficiencies = data.trades
      .map((trade) => calculatePremiumEfficiencyPercent(trade).percentage)
      .filter((value): value is number => typeof value === "number" && isFinite(value));

    if (efficiencies.length === 0) return 0;
    return efficiencies.reduce((sum, value) => sum + value, 0) / efficiencies.length;
  };

  const getAvgHoldingPeriodHours = () => {
    if (!data) return 0;

    const tradesWithClose = data.trades.filter((trade) => trade.dateClosed);
    if (tradesWithClose.length === 0) return 0;

    const totalHours = tradesWithClose.reduce((sum, trade) => {
      const openDate = new Date(trade.dateOpened);
      const closeDate = trade.dateClosed ? new Date(trade.dateClosed) : openDate;
      if (isNaN(openDate.getTime()) || isNaN(closeDate.getTime())) return sum;
      const hours = (closeDate.getTime() - openDate.getTime()) / (1000 * 60 * 60);
      return sum + Math.max(0, hours);
    }, 0);

    return totalHours / tradesWithClose.length;
  };

  const getAvgContracts = () => {
    if (!data || data.trades.length === 0) return 0;

    const totalContracts = data.trades.reduce(
      (sum, trade) => sum + (trade.numContracts ?? 0),
      0
    );
    return totalContracts / data.trades.length;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Statistics</CardTitle>
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
          <CardTitle>Portfolio Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Statistics</h3>
            <p className="text-muted-foreground text-center max-w-md">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || selectedBlocks.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Select at least 2 blocks to see combined portfolio statistics.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { portfolioStats } = data;
  const commissionShare = getCommissionShareOfPremium();
  const avgPremiumEfficiency = getAvgPremiumEfficiency();
  const avgHoldingHours = Number(getAvgHoldingPeriodHours().toFixed(1));
  const avgContracts = Number(getAvgContracts().toFixed(2));

  return (
    <div className="space-y-6">
      {/* Basic Overview */}
      <MetricSection
        title="Basic Overview"
        icon={<BarChart3 className="w-4 h-4" />}
        badge={
          <Badge variant="outline" className="text-xs">
            <Calendar className="w-3 h-3 mr-1" />
            {getDateRange()}
          </Badge>
        }
        gridCols={3}
      >
        <MetricCard
          title="Number of Trades"
          value={portfolioStats?.totalTrades || 0}
          format="number"
          tooltip={{
            flavor: "Total trades in the combined portfolio.",
            detailed:
              "Total number of trades across all selected blocks after merging and weighting.",
          }}
        />
        <MetricCard
          title="Starting Capital"
          value={startingCapital}
          format="currency"
          tooltip={{
            flavor: "Initial portfolio allocation for the mega block.",
            detailed:
              "The starting capital you specified for the combined portfolio, used for percentage-based calculations.",
          }}
        />
        <MetricCard
          title="Avg Return on Margin"
          value={getAvgReturnOnMargin()}
          format="percentage"
          isPositive={getAvgReturnOnMargin() > 0}
          tooltip={{
            flavor: "Average return relative to margin per trade.",
            detailed:
              "Average return on margin across all weighted trades in the combined portfolio.",
          }}
        />
        <MetricCard
          title="Std Dev of RoM"
          value={getStdDevOfRoM()}
          format="percentage"
          tooltip={{
            flavor: "Variability in return on margin.",
            detailed:
              "Standard deviation of Return on Margin shows consistency of capital efficiency.",
          }}
        />
        <MetricCard
          title="Best Trade"
          value={getBestTrade()}
          format="percentage"
          isPositive={getBestTrade() > 0}
          tooltip={{
            flavor: "Highest return on margin from a single trade.",
            detailed: "The best-performing trade by return on margin in the combined portfolio.",
          }}
        />
        <MetricCard
          title="Worst Trade"
          value={getWorstTrade()}
          format="percentage"
          isPositive={getWorstTrade() > 0}
          tooltip={{
            flavor: "Lowest return on margin from a single trade.",
            detailed: "The worst-performing trade by return on margin in the combined portfolio.",
          }}
        />
      </MetricSection>

      {/* Return Metrics */}
      <MetricSection
        title="Return Metrics"
        icon={<TrendingUp className="w-4 h-4" />}
        badge="COMBINED PORTFOLIO"
        badgeVariant="secondary"
        gridCols={5}
      >
        <MetricCard
          title="Total P/L"
          value={portfolioStats?.totalPl || 0}
          format="currency"
          isPositive={(portfolioStats?.totalPl || 0) > 0}
          size="lg"
          tooltip={{
            flavor: "Total profit or loss from the combined portfolio.",
            detailed: "Sum of all weighted trade P&L across selected blocks.",
          }}
        />
        <MetricCard
          title="CAGR"
          value={portfolioStats?.cagr || 0}
          format="percentage"
          isPositive={(portfolioStats?.cagr || 0) > 0}
          tooltip={{
            flavor: "Compound Annual Growth Rate.",
            detailed: "Annualized return rate for the combined portfolio.",
          }}
        />
        <MetricCard
          title="Avg RoM"
          value={getAvgReturnOnMargin()}
          format="percentage"
          isPositive={getAvgReturnOnMargin() > 0}
          tooltip={{
            flavor: "Average Return on Margin.",
            detailed: "How efficiently the combined portfolio uses margin.",
          }}
        />
        <MetricCard
          title="Win Rate"
          value={(portfolioStats?.winRate || 0) * 100}
          format="percentage"
          isPositive={(portfolioStats?.winRate || 0) > 0.5}
          tooltip={{
            flavor: "Percentage of profitable trades.",
            detailed: "Win rate across all weighted trades in the combined portfolio.",
          }}
        />
        <MetricCard
          title="Loss Rate"
          value={(1 - (portfolioStats?.winRate || 0)) * 100}
          format="percentage"
          isPositive={false}
          tooltip={{
            flavor: "Percentage of losing trades.",
            detailed: "Inverse of win rate for the combined portfolio.",
          }}
        />
      </MetricSection>

      {/* Risk & Drawdown */}
      <MetricSection
        title="Risk & Drawdown"
        icon={<AlertTriangle className="w-4 h-4" />}
        badge="COMBINED PORTFOLIO"
        badgeVariant="secondary"
        gridCols={5}
      >
        <MetricCard
          title="Max Drawdown"
          value={portfolioStats?.maxDrawdown || 0}
          format="percentage"
          isPositive={false}
          tooltip={{
            flavor: "Maximum peak-to-trough decline.",
            detailed: "Worst percentage drawdown experienced by the combined portfolio.",
          }}
        />
        <MetricCard
          title="Time in DD"
          value={portfolioStats?.timeInDrawdown || 0}
          format="percentage"
          tooltip={{
            flavor: "Time spent below peak equity.",
            detailed: "Percentage of time the portfolio was in drawdown.",
          }}
        />
        <MetricCard
          title="Sharpe Ratio"
          value={portfolioStats?.sharpeRatio || 0}
          format="ratio"
          isPositive={(portfolioStats?.sharpeRatio || 0) > 0}
          tooltip={{
            flavor: "Risk-adjusted return measure.",
            detailed: "Excess return per unit of volatility. Higher is better.",
          }}
        />
        <MetricCard
          title="Sortino Ratio"
          value={portfolioStats?.sortinoRatio || 0}
          format="ratio"
          isPositive={(portfolioStats?.sortinoRatio || 0) > 0}
          tooltip={{
            flavor: "Downside risk-adjusted return.",
            detailed: "Like Sharpe but only penalizes downside volatility.",
          }}
        />
        <MetricCard
          title="Calmar Ratio"
          value={portfolioStats?.calmarRatio || 0}
          format="ratio"
          isPositive={(portfolioStats?.calmarRatio || 0) > 0}
          tooltip={{
            flavor: "CAGR divided by max drawdown.",
            detailed: "Return relative to worst drawdown experienced.",
          }}
        />
      </MetricSection>

      {/* Consistency Metrics */}
      <MetricSection
        title="Consistency Metrics"
        icon={<Target className="w-4 h-4" />}
        badge="COMBINED PORTFOLIO"
        badgeVariant="outline"
        gridCols={5}
      >
        <MetricCard
          title="Win Streak"
          value={portfolioStats?.maxWinStreak || 0}
          format="number"
          isPositive={true}
          tooltip={{
            flavor: "Maximum consecutive winning trades.",
            detailed: "Longest streak of profitable trades in the combined portfolio.",
          }}
        />
        <MetricCard
          title="Loss Streak"
          value={portfolioStats?.maxLossStreak || 0}
          format="number"
          isPositive={false}
          tooltip={{
            flavor: "Maximum consecutive losing trades.",
            detailed: "Longest streak of losing trades in the combined portfolio.",
          }}
        />
        <MetricCard
          title="Monthly WR"
          value={portfolioStats?.monthlyWinRate || 0}
          format="percentage"
          isPositive={(portfolioStats?.monthlyWinRate || 0) > 50}
          tooltip={{
            flavor: "Percentage of profitable months.",
            detailed: "Monthly win rate for the combined portfolio.",
          }}
        />
        <MetricCard
          title="Weekly WR"
          value={portfolioStats?.weeklyWinRate || 0}
          format="percentage"
          isPositive={(portfolioStats?.weeklyWinRate || 0) > 50}
          tooltip={{
            flavor: "Percentage of profitable weeks.",
            detailed: "Weekly win rate for the combined portfolio.",
          }}
        />
        <MetricCard
          title="Kelly %"
          value={portfolioStats?.kellyPercentage || 0}
          format="percentage"
          isPositive={(portfolioStats?.kellyPercentage || 0) > 0}
          tooltip={{
            flavor: "Optimal position size by Kelly Criterion.",
            detailed: "Theoretical optimal allocation percentage based on edge and odds.",
          }}
        />
      </MetricSection>

      {/* Execution Efficiency */}
      <MetricSection
        title="Execution Efficiency"
        icon={<Gauge className="w-4 h-4" />}
        badge="TRADE-LEVEL"
        badgeVariant="outline"
        gridCols={4}
      >
        <MetricCard
          title="Commission vs Premium"
          value={commissionShare}
          format="percentage"
          isPositive={commissionShare < 20}
          tooltip={{
            flavor: "Fee drag relative to premium collected.",
            detailed: "How much of collected premium is consumed by commissions.",
          }}
        />
        <MetricCard
          title="Avg Premium Capture"
          value={avgPremiumEfficiency}
          format="percentage"
          isPositive={avgPremiumEfficiency > 0}
          tooltip={{
            flavor: "Realized edge vs theoretical max.",
            detailed: "How efficiently trades harvest their theoretical upside.",
          }}
        />
        <MetricCard
          title="Avg Holding (hrs)"
          value={avgHoldingHours}
          format="number"
          tooltip={{
            flavor: "Typical time capital stays tied up.",
            detailed: "Average hours from entry to close across the portfolio.",
          }}
        />
        <MetricCard
          title="Avg Contracts"
          value={avgContracts}
          format="number"
          tooltip={{
            flavor: "Average position size (weighted).",
            detailed: "Average contract count after applying block weights.",
          }}
        />
      </MetricSection>

      {/* Strategy Breakdown */}
      <StrategyBreakdownTable
        data={Object.values(strategyStats).map((stat) => ({
          strategy: stat.strategyName,
          trades: stat.tradeCount,
          totalPL: stat.totalPl,
          winRate: stat.winRate * 100,
          avgWin: stat.avgWin,
          avgLoss: stat.avgLoss,
          profitFactor: stat.profitFactor,
        }))}
      />
    </div>
  );
}

export default BlockStatsTab;
