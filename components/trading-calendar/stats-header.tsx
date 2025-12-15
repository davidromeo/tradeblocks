"use client";

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
import {
  aggregateTradesByStrategy,
  calculateDayMetrics,
  formatPercent,
  scaleStrategyComparison,
} from "@/lib/services/calendar-data";
import {
  ScalingMode,
  useTradingCalendarStore,
} from "@/lib/stores/trading-calendar-store";
import { AlertTriangle, BarChart3, HelpCircle, TrendingUp } from "lucide-react";
import { useMemo } from "react";

interface StatsHeaderProps {
  onMatchStrategiesClick?: () => void;
}

export function StatsHeader({ onMatchStrategiesClick }: StatsHeaderProps) {
  const {
    performanceStats,
    comparisonStats,
    scalingMode,
    navigationView,
    selectedDate,
    calendarDays,
    strategyMatches,
    unmatchedBacktestStrategies,
    unmatchedActualStrategies,
    actualTrades,
    setScalingMode,
  } = useTradingCalendarStore();

  const hasActualTrades = actualTrades.length > 0;
  const hasUnmatched =
    unmatchedBacktestStrategies.length > 0 ||
    unmatchedActualStrategies.length > 0;

  // Check if viewing a specific day
  const isViewingDay = navigationView === "day" || navigationView === "trade";
  const dayData = selectedDate ? calendarDays.get(selectedDate) : undefined;

  // Calculate day-specific stats when viewing a day
  const dayStats = useMemo(() => {
    if (!isViewingDay || !dayData) return null;

    const comparisons = aggregateTradesByStrategy(dayData, strategyMatches);
    const scaledComparisons = comparisons.map((c) =>
      scaleStrategyComparison(c, scalingMode)
    );

    let scaledBacktestPl = 0;
    let scaledActualPl = 0;
    let matchedCount = 0;
    let winningStrategies = 0;

    for (const comparison of scaledComparisons) {
      if (comparison.scaled.backtestPl !== null) {
        scaledBacktestPl += comparison.scaled.backtestPl;
      }
      if (comparison.scaled.actualPl !== null) {
        scaledActualPl += comparison.scaled.actualPl;
      }
      if (comparison.isMatched) {
        matchedCount++;
      }
      // Count winning strategies based on which data is available
      const pl = comparison.scaled.actualPl ?? comparison.scaled.backtestPl;
      if (pl !== null && pl > 0) {
        winningStrategies++;
      }
    }

    const variance =
      dayData.hasBacktest && dayData.hasActual
        ? scaledActualPl - scaledBacktestPl
        : null;
    const variancePercent =
      variance !== null && scaledBacktestPl !== 0
        ? (variance / Math.abs(scaledBacktestPl)) * 100
        : null;

    const winRate =
      scaledComparisons.length > 0
        ? (winningStrategies / scaledComparisons.length) * 100
        : 0;

    // Calculate day-specific performance metrics
    const dayMetrics = calculateDayMetrics(dayData);

    return {
      backtestPl: scaledBacktestPl,
      actualPl: scaledActualPl,
      backtestTradeCount: dayData.backtestTradeCount,
      actualTradeCount: dayData.actualTradeCount,
      hasBacktest: dayData.hasBacktest,
      hasActual: dayData.hasActual,
      variance,
      variancePercent,
      strategyCount: scaledComparisons.length,
      matchedCount,
      winRate,
      // Day-specific metrics
      maxDrawdown: dayMetrics.maxDrawdown,
      avgRom: dayMetrics.avgRom,
      avgPremiumCapture: dayMetrics.avgPremiumCapture,
    };
  }, [isViewingDay, dayData, strategyMatches, scalingMode]);

  // Get P/L positive flag
  const isPositive = (value: number) => value > 0;

  // Build actions for Performance section header
  const performanceActions = hasActualTrades ? (
    <>
      {/* Scaling Mode Toggle */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">Scaling</Label>
          <HoverCard>
            <HoverCardTrigger asChild>
              <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
            </HoverCardTrigger>
            <HoverCardContent className="w-80 p-0 overflow-hidden">
              <div className="space-y-3">
                <div className="bg-primary/5 border-b px-4 py-3">
                  <h4 className="text-sm font-semibold text-primary">
                    P&L Scaling
                  </h4>
                </div>
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm text-foreground leading-relaxed">
                    Normalize P&L values for fair comparison between backtest
                    and actual.
                  </p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                    <li>
                      <strong>Raw Values:</strong> Show original P&L without
                      adjustment
                    </li>
                    <li>
                      <strong>Per Contract:</strong> Divide by contract count
                      for per-lot comparison
                    </li>
                    <li>
                      <strong>Scale to Reported:</strong> Scale backtest down to
                      match actual contract counts
                    </li>
                  </ul>
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <Select
          value={scalingMode}
          onValueChange={(value) => setScalingMode(value as ScalingMode)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="raw">Raw Values</SelectItem>
            <SelectItem value="perContract">Per Contract</SelectItem>
            <SelectItem value="toReported">Scale to Reported</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Unmatched strategies warning */}
      {hasUnmatched && (
        <Button
          variant="outline"
          size="sm"
          className="text-yellow-500 border-yellow-500/50 hover:bg-yellow-500/10"
          onClick={onMatchStrategiesClick}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          {unmatchedBacktestStrategies.length +
            unmatchedActualStrategies.length}{" "}
          unmatched
        </Button>
      )}
    </>
  ) : null;

  // Helper to format ratio values
  const formatRatio = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "-";
    return value.toFixed(2);
  };

  // Helper to format percentage values
  const formatPct = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "-";
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Comparison Stats - same structure, data changes based on context */}
      {(isViewingDay
        ? dayStats?.hasBacktest && dayStats?.hasActual
        : comparisonStats) && (
        <MetricSection
          title="Backtest vs Actual"
          icon={<BarChart3 className="h-4 w-4" />}
          gridCols={4}
          actions={performanceActions}
        >
          <MetricCard
            title="Backtest P&L"
            value={
              isViewingDay && dayStats
                ? dayStats.backtestPl
                : comparisonStats?.backtestPl ?? 0
            }
            format="currency"
            subtitle={
              isViewingDay && dayStats
                ? `${dayStats.backtestTradeCount} trades`
                : undefined
            }
            isPositive={isPositive(
              isViewingDay && dayStats
                ? dayStats.backtestPl
                : comparisonStats?.backtestPl ?? 0
            )}
            tooltip={{
              flavor: "Total P&L from backtest trades",
              detailed:
                "Sum of all backtest trade results (scaled if scaling mode is active)",
            }}
          />
          <MetricCard
            title="Actual P&L"
            value={
              isViewingDay && dayStats
                ? dayStats.actualPl
                : comparisonStats?.actualPl ?? 0
            }
            format="currency"
            subtitle={
              isViewingDay && dayStats
                ? `${dayStats.actualTradeCount} trades`
                : undefined
            }
            isPositive={isPositive(
              isViewingDay && dayStats
                ? dayStats.actualPl
                : comparisonStats?.actualPl ?? 0
            )}
            tooltip={{
              flavor: "Total P&L from actual trades",
              detailed: "Sum of all actual executed trade results",
            }}
          />
          <MetricCard
            title="Variance"
            value={
              isViewingDay && dayStats
                ? dayStats.variance ?? 0
                : comparisonStats?.totalSlippage ?? 0
            }
            format="currency"
            subtitle={
              isViewingDay && dayStats
                ? dayStats.variancePercent !== null
                  ? formatPercent(dayStats.variancePercent)
                  : undefined
                : comparisonStats && comparisonStats.backtestPl !== 0
                ? formatPercent(
                    (comparisonStats.totalSlippage /
                      Math.abs(comparisonStats.backtestPl)) *
                      100
                  )
                : undefined
            }
            isPositive={isPositive(
              isViewingDay && dayStats
                ? dayStats.variance ?? 0
                : comparisonStats?.totalSlippage ?? 0
            )}
            tooltip={{
              flavor: "Performance difference between actual and backtest",
              detailed:
                "Includes slippage, commissions, timing differences, and market impact. Positive means actual outperformed backtest.",
            }}
          />
          <MetricCard
            title="Match Rate"
            value={
              isViewingDay && dayStats
                ? dayStats.strategyCount > 0
                  ? `${Math.round(
                      (dayStats.matchedCount / dayStats.strategyCount) * 100
                    )}%`
                  : "-"
                : comparisonStats
                ? `${comparisonStats.matchRate.toFixed(0)}%`
                : "-"
            }
            subtitle={
              isViewingDay && dayStats
                ? dayStats.strategyCount - dayStats.matchedCount > 0
                  ? `${
                      dayStats.strategyCount - dayStats.matchedCount
                    } unmatched`
                  : "All matched"
                : comparisonStats &&
                  comparisonStats.unmatchedBacktestCount +
                    comparisonStats.unmatchedActualCount >
                    0
                ? `${
                    comparisonStats.unmatchedBacktestCount +
                    comparisonStats.unmatchedActualCount
                  } unmatched`
                : "All matched"
            }
            tooltip={{
              flavor: "Percentage of strategies that were matched",
              detailed:
                "How many backtest strategies have corresponding actual trades",
            }}
          />
        </MetricSection>
      )}

      {/* Performance Stats - 8 metrics in 2 rows */}
      <MetricSection
        title="Performance"
        icon={<TrendingUp className="h-4 w-4" />}
        gridCols={4}
      >
        {/* Row 1: CAGR, Win Rate, Sharpe, Sortino */}

        <MetricCard
          title="Win Rate"
          value={
            isViewingDay
              ? dayStats
                ? `${dayStats.winRate.toFixed(0)}%`
                : "-"
              : performanceStats
              ? `${performanceStats.winRate.toFixed(0)}%`
              : "-"
          }
          subtitle={
            isViewingDay
              ? dayStats
                ? `${dayStats.strategyCount} strategies`
                : "0 strategies"
              : performanceStats
              ? `${performanceStats.tradingDays} days · ${performanceStats.dataSource === 'actual' ? 'Actual' : 'Backtest'}`
              : undefined
          }
          tooltip={{
            flavor: isViewingDay
              ? "Percentage of profitable strategies"
              : "Percentage of profitable trading days",
            detailed: isViewingDay
              ? "Strategies with positive P&L divided by total strategies"
              : "Days with positive P&L divided by total trading days",
          }}
        />
        <MetricCard
          title="CAGR"
          value={
            isViewingDay
              ? "-"
              : performanceStats?.cagr !== null
              ? formatPct(performanceStats?.cagr)
              : "-"
          }
          isPositive={
            !isViewingDay && performanceStats?.cagr !== null
              ? isPositive(performanceStats?.cagr ?? 0)
              : undefined
          }
          tooltip={{
            flavor: "Compound Annual Growth Rate",
            detailed:
              "Annualized return rate assuming compounding. Requires multiple days of data.",
          }}
        />
        <MetricCard
          title="Sharpe"
          value={isViewingDay ? "-" : formatRatio(performanceStats?.sharpe)}
          isPositive={
            !isViewingDay && performanceStats?.sharpe !== null
              ? isPositive(performanceStats?.sharpe ?? 0)
              : undefined
          }
          tooltip={{
            flavor: "Risk-adjusted return measure",
            detailed:
              "Excess return per unit of total volatility. Higher is better. Requires multiple days of data.",
          }}
        />
        <MetricCard
          title="Sortino"
          value={isViewingDay ? "-" : formatRatio(performanceStats?.sortino)}
          isPositive={
            !isViewingDay && performanceStats?.sortino !== null
              ? isPositive(performanceStats?.sortino ?? 0)
              : undefined
          }
          tooltip={{
            flavor: "Downside risk-adjusted return",
            detailed:
              "Like Sharpe but only considers downside volatility. Higher is better. Requires multiple days of data.",
          }}
        />

        {/* Row 2: Max Drawdown, Calmar, Avg RoM, Avg Premium Capture */}
        <MetricCard
          title="Max Drawdown"
          value={
            isViewingDay
              ? dayStats?.maxDrawdown != null
                ? formatPct(dayStats.maxDrawdown)
                : "-"
              : performanceStats?.maxDrawdown != null
              ? formatPct(performanceStats.maxDrawdown)
              : "-"
          }
          subtitle={
            !isViewingDay && performanceStats?.maxDrawdown != null
              ? "Backtest"
              : undefined
          }
          isPositive={false}
          tooltip={{
            flavor: isViewingDay
              ? "Intraday peak-to-trough decline"
              : "Largest peak-to-trough decline",
            detailed: isViewingDay
              ? "Maximum percentage drop from intraday equity peak. Based on trade close times."
              : "Maximum percentage drop from a peak to a trough. Lower is better.",
          }}
        />
        <MetricCard
          title="Calmar"
          value={isViewingDay ? "-" : formatRatio(performanceStats?.calmar)}
          isPositive={
            !isViewingDay && performanceStats?.calmar != null
              ? isPositive(performanceStats.calmar)
              : undefined
          }
          tooltip={{
            flavor: "Return vs drawdown ratio",
            detailed:
              "CAGR divided by Max Drawdown. Higher is better. Measures return per unit of drawdown risk.",
          }}
        />
        <MetricCard
          title="Avg RoM"
          value={
            isViewingDay
              ? dayStats?.avgRom != null
                ? formatPct(dayStats.avgRom)
                : "-"
              : performanceStats?.avgRom != null
              ? formatPct(performanceStats.avgRom)
              : "-"
          }
          subtitle={
            (isViewingDay ? dayStats?.avgRom : performanceStats?.avgRom) != null
              ? "Backtest"
              : undefined
          }
          isPositive={
            isViewingDay
              ? dayStats?.avgRom != null
                ? isPositive(dayStats.avgRom)
                : undefined
              : performanceStats?.avgRom != null
              ? isPositive(performanceStats.avgRom)
              : undefined
          }
          tooltip={{
            flavor: "Average Return on Margin",
            detailed:
              "Average P&L divided by margin requirement per trade. Only available for backtest trades with margin data.",
          }}
        />
        <MetricCard
          title="Premium Capture"
          value={
            isViewingDay
              ? dayStats?.avgPremiumCapture != null
                ? formatPct(dayStats.avgPremiumCapture)
                : "-"
              : performanceStats?.avgPremiumCapture != null
              ? formatPct(performanceStats.avgPremiumCapture)
              : "-"
          }
          subtitle={
            !isViewingDay && performanceStats?.avgPremiumCapture != null
              ? performanceStats.dataSource === 'actual' ? 'Actual' : 'Backtest'
              : undefined
          }
          isPositive={
            isViewingDay
              ? dayStats?.avgPremiumCapture != null
                ? isPositive(dayStats.avgPremiumCapture)
                : undefined
              : performanceStats?.avgPremiumCapture != null
              ? isPositive(performanceStats.avgPremiumCapture)
              : undefined
          }
          tooltip={{
            flavor: "Average premium captured per trade",
            detailed:
              "Average P&L as a percentage of premium collected. Shows how much of the initial premium was captured as profit.",
          }}
        />
      </MetricSection>
    </div>
  );
}
