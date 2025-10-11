"use client";

import { MetricCard } from "@/components/metric-card";
import { MetricSection } from "@/components/metric-section";
import { MultiSelect } from "@/components/multi-select";
import { StrategyBreakdownTable } from "@/components/strategy-breakdown-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Target,
  TrendingUp,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useBlockStore } from "@/lib/stores/block-store";
import { getTradesByBlock, getDailyLogsByBlock } from "@/lib/db";
import { Trade } from "@/lib/models/trade";
import { DailyLogEntry } from "@/lib/models/daily-log";
import { PortfolioStatsCalculator } from "@/lib/calculations/portfolio-stats";
import { buildPerformanceSnapshot } from "@/lib/services/performance-snapshot";
import { PortfolioStats, StrategyStats } from "@/lib/models/portfolio-stats";

// Strategy options will be dynamically generated from trades

export default function BlockStatsPage() {
  const [riskFreeRate, setRiskFreeRate] = useState("2");
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);

  // Data fetching state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Calculated metrics state
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);
  const [strategyStats, setStrategyStats] = useState<Record<string, StrategyStats>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([]);

  // Get active block from store
  const activeBlock = useBlockStore(state => {
    const activeBlockId = state.activeBlockId;
    return activeBlockId ? state.blocks.find(block => block.id === activeBlockId) : null;
  });
  const isLoading = useBlockStore(state => state.isLoading);
  const isInitialized = useBlockStore(state => state.isInitialized);
  const loadBlocks = useBlockStore(state => state.loadBlocks);

  // Load blocks if not initialized
  useEffect(() => {
    if (!isInitialized) {
      loadBlocks().catch(console.error);
    }
  }, [isInitialized, loadBlocks]);

  // Fetch trades and daily logs when active block changes
  useEffect(() => {
    if (!activeBlock) {
      setTrades([]);
      setDailyLogs([]);
      setDataError(null);
      return;
    }

    const fetchData = async () => {
      setIsLoadingData(true);
      setDataError(null);

      try {
        const [blockTrades, blockDailyLogs] = await Promise.all([
          getTradesByBlock(activeBlock.id),
          getDailyLogsByBlock(activeBlock.id)
        ]);

        setTrades(blockTrades);
        setDailyLogs(blockDailyLogs);
      } catch (error) {
        console.error('Failed to fetch block data:', error);
        setDataError(error instanceof Error ? error.message : 'Failed to fetch data');
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlock?.id]);

  // Calculate metrics when data or risk-free rate changes
  useEffect(() => {
    if (trades.length === 0) {
      setPortfolioStats(null);
      setStrategyStats({});
      setFilteredTrades([]);
      return;
    }

    const calculateMetrics = async () => {
      setIsCalculating(true);

      try {
        const riskFree = parseFloat(riskFreeRate) || 2.0;
        const snapshot = await buildPerformanceSnapshot({
          trades,
          dailyLogs,
          filters: selectedStrategies.length > 0 ? { strategies: selectedStrategies } : undefined,
          riskFreeRate: riskFree
        });

        setFilteredTrades(snapshot.filteredTrades);
        setPortfolioStats(snapshot.portfolioStats);

        const calculator = new PortfolioStatsCalculator({ riskFreeRate: riskFree });
        const strategies = calculator.calculateStrategyStats(snapshot.filteredTrades);
        setStrategyStats(strategies);
      } catch (error) {
        console.error('Failed to calculate metrics:', error);
        setDataError(error instanceof Error ? error.message : 'Failed to calculate metrics');
      } finally {
        setIsCalculating(false);
      }
    };

    calculateMetrics();
  }, [trades, dailyLogs, riskFreeRate, selectedStrategies]);

  // Helper functions
  const getDateRange = () => {
    if (filteredTrades.length === 0) return "No trades";

    const sortedTrades = [...filteredTrades].sort((a, b) =>
      new Date(a.dateOpened).getTime() - new Date(b.dateOpened).getTime()
    );

    const startDate = new Date(sortedTrades[0].dateOpened).toLocaleDateString();
    const endDate = new Date(sortedTrades[sortedTrades.length - 1].dateOpened).toLocaleDateString();

    return `${startDate} to ${endDate}`;
  };

  const getInitialCapital = () => {
    // Use the initial capital from portfolioStats which properly accounts for daily logs
    if (!portfolioStats) return 0;
    return portfolioStats.initialCapital;
  };

  const getAvgReturnOnMargin = () => {
    if (!portfolioStats) return 0;

    // Calculate average return on margin from filtered trades
    const tradesWithMargin = filteredTrades.filter(trade => trade.marginReq && trade.marginReq > 0);
    if (tradesWithMargin.length === 0) return 0;

    const totalReturnOnMargin = tradesWithMargin.reduce((sum, trade) => {
      const rom = (trade.pl / trade.marginReq!) * 100;
      return sum + rom;
    }, 0);

    return totalReturnOnMargin / tradesWithMargin.length;
  };

  const getStdDevOfRoM = () => {
    if (!portfolioStats) return 0;

    const tradesWithMargin = filteredTrades.filter(trade => trade.marginReq && trade.marginReq > 0);
    if (tradesWithMargin.length === 0) return 0;

    const avgRoM = getAvgReturnOnMargin();
    const roms = tradesWithMargin.map(trade => (trade.pl / trade.marginReq!) * 100);

    const variance = roms.reduce((sum, rom) => sum + Math.pow(rom - avgRoM, 2), 0) / roms.length;
    return Math.sqrt(variance);
  };

  const getBestTrade = () => {
    if (!portfolioStats || filteredTrades.length === 0) return 0;

    const bestTrade = Math.max(...filteredTrades.map(trade => {
      if (!trade.marginReq || trade.marginReq <= 0) return 0;
      return (trade.pl / trade.marginReq) * 100;
    }));

    return bestTrade;
  };

  const getWorstTrade = () => {
    if (!portfolioStats || filteredTrades.length === 0) return 0;

    const worstTrade = Math.min(...filteredTrades.map(trade => {
      if (!trade.marginReq || trade.marginReq <= 0) return 0;
      return (trade.pl / trade.marginReq) * 100;
    }));

    return worstTrade;
  };

  const getStrategyOptions = () => {
    if (trades.length === 0) return [];

    const uniqueStrategies = [...new Set(trades.map(trade => trade.strategy || 'Unknown'))];
    return uniqueStrategies.map(strategy => ({
      label: strategy,
      value: strategy,
    }));
  };

  // Show loading state
  if (!isInitialized || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading blocks...</p>
        </div>
      </div>
    );
  }

  // Show message if no active block
  if (!activeBlock) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Active Block Selected</h3>
          <p className="text-muted-foreground mb-4">
            Please select a block from the sidebar to view its statistics.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state for data
  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading {activeBlock.name} data...</p>
        </div>
      </div>
    );
  }

  // Show loading state for calculations
  if (isCalculating) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Calculating metrics...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (dataError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
          <p className="text-muted-foreground mb-4">{dataError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="risk-free-rate">Risk-free Rate (%)</Label>
          <Input
            id="risk-free-rate"
            type="number"
            value={riskFreeRate}
            onChange={(e) => setRiskFreeRate(e.target.value)}
            className="w-32"
            placeholder="2"
            min="0"
            max="10"
            step="0.1"
          />
        </div>
        <div className="space-y-2 flex-1 min-w-[250px]">
          <Label>Strategies</Label>
          <MultiSelect
            options={getStrategyOptions()}
            onValueChange={setSelectedStrategies}
            defaultValue={selectedStrategies}
            placeholder="All strategies"
            maxCount={3}
            className="w-full"
          />
        </div>
      </div>

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
            flavor:
              "Building blocks completed - the total foundation you've laid so far.",
            detailed:
              "Total number of trades executed. More trades provide more data for analysis but don't necessarily mean better performance. This number helps contextualize other statistics - win rates from 10 trades are less reliable than from 100 trades.",
          }}
        />
        <MetricCard
          title="Starting Capital"
          value={getInitialCapital()}
          format="currency"
          tooltip={{
            flavor: "Foundation funds - the base capital you started building with.",
            detailed: "The initial account value when trading began. This serves as the baseline for calculating percentage returns and total growth. Essential for understanding the scale of gains and losses relative to your original investment."
          }}
        />
        <MetricCard
          title="Avg Return on Margin"
          value={getAvgReturnOnMargin()}
          format="percentage"
          isPositive={getAvgReturnOnMargin() > 0}
          tooltip={{
            flavor: "Building efficiency - how much structure each margin block creates on average.",
            detailed: "Average return relative to margin required per trade. This is crucial for margin-based strategies like options trading. Higher values indicate more efficient use of buying power. Values vary significantly by strategy type and market conditions."
          }}
        />
        <MetricCard
          title="Std Dev of RoM"
          value={getStdDevOfRoM()}
          format="percentage"
          tooltip={{
            flavor: "Construction consistency - how much your building efficiency varies between projects.",
            detailed: "Standard deviation of Return on Margin shows the variability in your capital efficiency. Lower values indicate more consistent performance, while higher values suggest more volatile results. Helps assess the reliability of your average returns."
          }}
        />
        <MetricCard
          title="Best Trade"
          value={getBestTrade()}
          format="percentage"
          isPositive={getBestTrade() > 0}
          tooltip={{
            flavor: "Biggest building block - your most successful construction project to date.",
            detailed: "The highest return on margin achieved in a single trade. This represents your best-case scenario and shows the upside potential of your strategy. Extremely large best trades might indicate either great skill or significant risk-taking."
          }}
        />
        <MetricCard
          title="Worst Trade"
          value={getWorstTrade()}
          format="percentage"
          isPositive={getWorstTrade() > 0}
          tooltip={{
            flavor: "Biggest tumble - when your construction project needed the most rebuilding.",
            detailed: "The largest loss on margin for a single trade. This represents your worst-case scenario and indicates the downside risk of your strategy. Understanding this helps assess whether your risk management aligns with your tolerance for losses."
          }}
        />
      </MetricSection>

      {/* Return Metrics */}
      <MetricSection
        title="Return Metrics"
        icon={<TrendingUp className="w-4 h-4" />}
        badge="POSITION-SIZE DEPENDENT"
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
            flavor: "Net construction value - total profit or loss from all your building projects.",
            detailed: "Sum of all trade profits and losses. This is the absolute dollar amount gained or lost from trading activities. While important, it should be considered alongside the capital required to generate these returns."
          }}
        />
        <MetricCard
          title="CAGR"
          value={portfolioStats?.cagr || 0}
          format="percentage"
          isPositive={(portfolioStats?.cagr || 0) > 0}
          tooltip={{
            flavor: "Annual building rate - how fast your foundation grows each year.",
            detailed: "Compound Annual Growth Rate normalizes returns over time, showing the equivalent annual growth rate. This allows comparison across different time periods and strategies. Higher CAGR indicates faster wealth building, but consider it alongside risk metrics."
          }}
        />
        <MetricCard
          title="Avg RoM"
          value={getAvgReturnOnMargin()}
          format="percentage"
          isPositive={getAvgReturnOnMargin() > 0}
          tooltip={{
            flavor: "Standard building efficiency - typical value created per margin block.",
            detailed: "Average Return on Margin across all trades. This metric is especially relevant for options and other margin-based strategies, showing how effectively you use borrowed buying power. Compare this to risk-free rates for context."
          }}
        />
        <MetricCard
          title="Win Rate"
          value={(portfolioStats?.winRate || 0) * 100}
          format="percentage"
          isPositive={(portfolioStats?.winRate || 0) > 0.5}
          tooltip={{
            flavor: "Building success rate - percentage of projects that added value.",
            detailed: "Percentage of trades that were profitable. While higher win rates seem better, they don't tell the whole story. A strategy with 40% win rate but large winners can outperform a 80% win rate strategy with small winners."
          }}
        />
        <MetricCard
          title="Loss Rate"
          value={((1 - (portfolioStats?.winRate || 0)) * 100)}
          format="percentage"
          isPositive={false}
          tooltip={{
            flavor: "Rebuilding frequency - percentage of projects that required reconstruction.",
            detailed: "Percentage of trades that resulted in losses. This is simply the inverse of win rate. Understanding your loss frequency helps set expectations and plan for the psychological impact of inevitable losing trades."
          }}
        />
      </MetricSection>

      {/* Risk & Drawdown */}
      <MetricSection
        title="Risk & Drawdown"
        icon={<AlertTriangle className="w-4 h-4" />}
        badge="POSITION-SIZE DEPENDENT"
        badgeVariant="secondary"
        gridCols={5}
      >
        <MetricCard
          title="Max Drawdown"
          value={portfolioStats?.maxDrawdown || 0}
          format="percentage"
          isPositive={false}
          tooltip={{
            flavor: "Biggest foundation crack - the deepest your structure has sunk.",
            detailed: "Maximum percentage decline from a peak to subsequent trough. This represents your worst-case scenario and is crucial for understanding the downside risk of your strategy. Most traders find drawdowns over 20-30% psychologically challenging."
          }}
        />
        <MetricCard
          title="Time in DD"
          value={portfolioStats?.timeInDrawdown || 0}
          format="percentage"
          tooltip={{
            flavor: "Rebuilding time - percentage of time spent repairing foundation damage.",
            detailed: "Percentage of time the account was below previous peak values. Long periods in drawdown can be psychologically taxing and may indicate recovery issues. Strategies with quick recovery tend to be more sustainable."
          }}
        />
        <MetricCard
          title="Sharpe Ratio"
          value={portfolioStats?.sharpeRatio || 0}
          format="ratio"
          isPositive={(portfolioStats?.sharpeRatio || 0) > 0}
          tooltip={{
            flavor: "Risk-adjusted building score - how much extra return per unit of construction risk.",
            detailed: "Measures excess return per unit of volatility. Values above 1.0 are considered good, above 2.0 excellent. This helps compare strategies with different risk profiles by normalizing returns for the volatility experienced."
          }}
        />
        <MetricCard
          title="Sortino Ratio"
          value={portfolioStats?.sortinoRatio || 0}
          format="ratio"
          isPositive={(portfolioStats?.sortinoRatio || 0) > 0}
          tooltip={{
            flavor: "Downside-focused building score - return efficiency when accounting only for foundation damage.",
            detailed: "Similar to Sharpe ratio but only considers downside volatility, ignoring upside volatility. This provides a more accurate risk assessment since investors typically don't mind positive volatility. Higher values indicate better downside risk management."
          }}
        />
        <MetricCard
          title="Calmar Ratio"
          value={portfolioStats?.calmarRatio || 0}
          format="ratio"
          isPositive={(portfolioStats?.calmarRatio || 0) > 0}
          tooltip={{
            flavor: "Recovery building rate - annual growth compared to worst foundation damage.",
            detailed: "CAGR divided by maximum drawdown. This shows how much annual return you're getting relative to the worst decline experienced. Higher values indicate strategies that generate good returns without severe drawdowns."
          }}
        />
      </MetricSection>

      {/* Consistency Metrics */}
      <MetricSection
        title="Consistency Metrics"
        icon={<Target className="w-4 h-4" />}
        badge="POSITION-SIZE INDEPENDENT"
        badgeVariant="outline"
        gridCols={5}
      >
        <MetricCard
          title="Win Streak"
          value={portfolioStats?.maxWinStreak || 0}
          format="number"
          isPositive={true}
          tooltip={{
            flavor: "Longest building run - most consecutive successful projects completed.",
            detailed: "Maximum number of consecutive winning trades. Long win streaks can indicate good strategy alignment with market conditions, but they can also lead to overconfidence. Understanding your typical streak length helps with psychological preparation."
          }}
        />
        <MetricCard
          title="Loss Streak"
          value={portfolioStats?.maxLossStreak || 0}
          format="number"
          isPositive={false}
          tooltip={{
            flavor: "Longest rebuilding period - most consecutive projects that needed repairs.",
            detailed: "Maximum number of consecutive losing trades. Everyone experiences losing streaks, and knowing your worst helps with risk management and position sizing. Extended loss streaks might indicate strategy issues or unfavorable market conditions."
          }}
        />
        <MetricCard
          title="Monthly WR"
          value={portfolioStats?.monthlyWinRate || 0}
          format="percentage"
          isPositive={(portfolioStats?.monthlyWinRate || 0) > 50}
          tooltip={{
            flavor: "Monthly building success - percentage of months that added to your foundation.",
            detailed: "Percentage of months that were profitable. Monthly win rate provides insight into consistency over longer time periods. Higher monthly win rates indicate more predictable income generation and smoother equity curves."
          }}
        />
        <MetricCard
          title="Weekly WR"
          value={portfolioStats?.weeklyWinRate || 0}
          format="percentage"
          isPositive={(portfolioStats?.weeklyWinRate || 0) > 50}
          tooltip={{
            flavor: "Weekly building success - percentage of weeks that strengthened your structure.",
            detailed: "Percentage of weeks that were profitable. Weekly win rate shows shorter-term consistency and can help identify if your strategy works better in certain market conditions or time frames. Useful for weekly review cycles."
          }}
        />
        <MetricCard
          title="Kelly %"
          value={portfolioStats?.kellyPercentage || 0}
          format="percentage"
          isPositive={(portfolioStats?.kellyPercentage || 0) > 0}
          tooltip={{
            flavor: "Optimal foundation size - theoretical best percentage of capital per building project.",
            detailed: "Kelly Criterion suggests the optimal position size based on your win rate and average win/loss sizes. Positive values suggest profitable strategies, while negative values indicate unprofitable ones. Most traders use a fraction of Kelly due to its aggressive nature."
          }}
        />
      </MetricSection>

      {/* Strategy Breakdown */}
      <StrategyBreakdownTable data={Object.values(strategyStats).map(stat => ({
        strategy: stat.strategyName,
        trades: stat.tradeCount,
        totalPL: stat.totalPl,
        winRate: stat.winRate * 100, // Convert to percentage
        avgWin: stat.avgWin,
        avgLoss: stat.avgLoss,
        profitFactor: stat.profitFactor,
      }))} />
    </div>
  );
}
