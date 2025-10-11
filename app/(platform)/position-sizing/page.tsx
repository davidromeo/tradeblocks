"use client";

import { MarginChart } from "@/components/position-sizing/margin-chart";
import { MarginStatisticsTable } from "@/components/position-sizing/margin-statistics-table";
import { PortfolioSummary } from "@/components/position-sizing/portfolio-summary";
import { StrategyKellyTable } from "@/components/position-sizing/strategy-kelly-table";
import {
  StrategyAnalysis,
  StrategyResults,
} from "@/components/position-sizing/strategy-results";
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
import { getDailyLogsByBlock } from "@/lib/db/daily-logs-store";
import { getTradesByBlock } from "@/lib/db/trades-store";
import { DailyLogEntry } from "@/lib/models/daily-log";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";
import { HelpCircle, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function PositionSizingPage() {
  const { activeBlockId } = useBlockStore();

  // State
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dailyLog, setDailyLog] = useState<DailyLogEntry[]>([]);
  const [startingCapital, setStartingCapital] = useState(100000);
  const [portfolioKellyPct, setPortfolioKellyPct] = useState(100);
  const [marginMode, setMarginMode] = useState<MarginMode>("fixed");
  const [kellyValues, setKellyValues] = useState<Record<string, number>>({});
  const [selectedStrategies, setSelectedStrategies] = useState<Set<string>>(
    new Set()
  );
  const [hasRun, setHasRun] = useState(false);
  const [allStrategiesKellyPct, setAllStrategiesKellyPct] = useState(100);

  // Load trades and daily log when active block changes
  useEffect(() => {
    if (activeBlockId) {
      Promise.all([
        getTradesByBlock(activeBlockId),
        getDailyLogsByBlock(activeBlockId),
      ]).then(([loadedTrades, loadedDailyLog]) => {
        setTrades(loadedTrades);
        setDailyLog(loadedDailyLog);

        // Auto-detect starting capital (prefer daily log when available)
        const calculatedCapital = PortfolioStatsCalculator.calculateInitialCapital(
          loadedTrades,
          loadedDailyLog.length > 0 ? loadedDailyLog : undefined
        );
        setStartingCapital(calculatedCapital > 0 ? calculatedCapital : 100000);

        // Initialize all strategies as selected with 100%
        const strategies = new Set(
          loadedTrades.map((t) => t.strategy || "Uncategorized")
        );
        setSelectedStrategies(strategies);

        const initialValues: Record<string, number> = {};
        strategies.forEach((s) => {
          initialValues[s] = 100;
        });
        setKellyValues(initialValues);
      });
    } else {
      setTrades([]);
      setDailyLog([]);
      setSelectedStrategies(new Set());
      setKellyValues({});
    }
  }, [activeBlockId]);

  // Get unique strategies with trade counts
  const strategyData = useMemo(() => {
    const strategyMap = new Map<string, number>();

    for (const trade of trades) {
      const strategy = trade.strategy || "Uncategorized";
      strategyMap.set(strategy, (strategyMap.get(strategy) || 0) + 1);
    }

    return Array.from(strategyMap.entries())
      .map(([name, tradeCount]) => ({ name, tradeCount }))
      .sort(
        (a, b) => b.tradeCount - a.tradeCount || a.name.localeCompare(b.name)
      );
  }, [trades]);

  // Calculate results when user clicks "Run Allocation"
  const runAllocation = () => {
    setHasRun(true);
  };

  // Results calculations (only when hasRun is true)
  const results = useMemo(() => {
    if (!hasRun || trades.length === 0) return null;

    // Calculate portfolio-level Kelly metrics
    const portfolioMetrics = calculateKellyMetrics(trades);

    // Calculate per-strategy Kelly metrics
    const strategyMetricsMap = calculateStrategyKellyMetrics(trades);

    // Get strategy names sorted by trade count
    const strategyNames = strategyData.map((s) => s.name);

    // Build margin timeline
    const marginTimeline = buildMarginTimeline(
      trades,
      strategyNames,
      startingCapital,
      marginMode,
      dailyLog.length > 0 ? dailyLog : undefined
    );

    // Calculate portfolio max margin
    const portfolioMaxMarginPct =
      marginTimeline.portfolioPct.length > 0
        ? Math.max(...marginTimeline.portfolioPct)
        : 0;

    // Calculate strategy analysis
    const strategyAnalysis: StrategyAnalysis[] = [];
    let totalAppliedWeight = 0;
    const totalTrades = trades.length;

    for (const strategy of strategyData) {
      const metrics = strategyMetricsMap.get(strategy.name)!;
      const inputPct = kellyValues[strategy.name] ?? 100;
      // Apply BOTH Portfolio Kelly and Strategy Kelly multipliers
      const appliedPct =
        metrics.percent * (portfolioKellyPct / 100) * (inputPct / 100);
      const maxMarginPct = calculateMaxMarginPct(marginTimeline, strategy.name);
      const allocationPct =
        maxMarginPct * (portfolioKellyPct / 100) * (inputPct / 100);
      const allocationDollars = (startingCapital * allocationPct) / 100;

      strategyAnalysis.push({
        name: strategy.name,
        tradeCount: strategy.tradeCount,
        kellyMetrics: metrics,
        inputPct,
        appliedPct,
        maxMarginPct,
        allocationPct,
        allocationDollars,
      });

      if (strategy.tradeCount > 0) {
        totalAppliedWeight += appliedPct * strategy.tradeCount;
      }
    }

    const weightedAppliedPct =
      totalTrades > 0 ? totalAppliedWeight / totalTrades : 0;
    const appliedCapital = (startingCapital * weightedAppliedPct) / 100;

    return {
      portfolioMetrics,
      strategyAnalysis,
      marginTimeline,
      strategyNames,
      weightedAppliedPct,
      appliedCapital,
      portfolioMaxMarginPct,
    };
  }, [
    hasRun,
    trades,
    dailyLog,
    strategyData,
    kellyValues,
    startingCapital,
    marginMode,
    portfolioKellyPct,
  ]);

  // Handlers
  const handleKellyChange = (strategy: string, value: number) => {
    setKellyValues((prev) => ({ ...prev, [strategy]: value }));
  };

  const handleSelectionChange = (strategy: string, selected: boolean) => {
    setSelectedStrategies((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(strategy);
      } else {
        next.delete(strategy);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedStrategies(new Set(strategyData.map((s) => s.name)));
    } else {
      setSelectedStrategies(new Set());
    }
  };

  // Empty state
  if (!activeBlockId) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Position Sizing</h1>
          <p className="text-muted-foreground">
            Optimize capital allocation using Kelly criterion
          </p>
        </div>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No active block selected. Please select or create a block to run
            position sizing analysis.
          </p>
        </Card>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Position Sizing</h1>
          <p className="text-muted-foreground">
            Optimize capital allocation using Kelly criterion
          </p>
        </div>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No trades available in the active block. Upload trades to perform
            position sizing analysis.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* How to Use This Page */}
      <Card className="p-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">How to Use This Page</h2>
          <p className="text-sm text-muted-foreground">
            Use this page to explore how Kelly-driven sizing could shape your
            backtests before you commit to a new allocation.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>
              Set your starting capital and portfolio-level Kelly fraction to
              mirror the account you plan to backtest.
            </li>
            <li>
              Review each strategy card and adjust the Kelly % to reflect
              conviction, correlation, or capital limits.
            </li>
            <li>
              Run Allocation to surface portfolio Kelly metrics, applied
              capital, and projected margin demand so you can translate findings
              into your backtest position rules.
            </li>
            <li>
              Iterate often—capture settings that feel sustainable, then take
              those parameters into your backtests for validation.
            </li>
          </ul>
          <p className="text-xs text-muted-foreground italic">
            Nothing here is a directive to size larger or smaller; it is a
            sandbox for stress-testing ideas with real trade history before you
            backtest or deploy.
          </p>
        </div>
      </Card>

      {/* Configuration Card */}
      <Card className="p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Configuration</h2>
            <HoverCard>
              <HoverCardTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground/60 cursor-help" />
              </HoverCardTrigger>
              <HoverCardContent className="w-80 p-0 overflow-hidden">
                <div className="space-y-3">
                  <div className="bg-primary/5 border-b px-4 py-3">
                    <h4 className="text-sm font-semibold text-primary">
                      Kelly Criterion Position Sizing
                    </h4>
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      Calculate optimal position sizes based on your trading
                      edge.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The Kelly criterion determines the mathematically optimal
                      percentage of capital to risk based on win rate and payoff
                      ratio. Adjust the Kelly multiplier to be more conservative
                      (50% = half Kelly) or aggressive (100% = full Kelly).
                    </p>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>

          {/* Global Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="starting-capital">Starting Capital ($)</Label>
              <Input
                id="starting-capital"
                type="number"
                value={startingCapital}
                onChange={(e) =>
                  setStartingCapital(parseInt(e.target.value) || 100000)
                }
                min={1000}
                step={1000}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="portfolio-kelly">
                  Portfolio Kelly Fraction (%)
                </Label>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80 p-0 overflow-hidden">
                    <div className="space-y-3">
                      <div className="bg-primary/5 border-b px-4 py-3">
                        <h4 className="text-sm font-semibold text-primary">
                          Kelly Fraction Multiplier
                        </h4>
                      </div>
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-sm font-medium text-foreground leading-relaxed">
                          Global risk multiplier applied to ALL strategies
                          before their individual Kelly %.
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Works as a two-layer system with Strategy Kelly %:
                        </p>
                        <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                          <li>25% = Very Conservative (1/4 Kelly)</li>
                          <li>50% = Conservative (half Kelly - recommended)</li>
                          <li>100% = Full Kelly (aggressive)</li>
                        </ul>
                        <div className="text-xs text-muted-foreground space-y-1 mt-2">
                          <p className="font-medium">Formula:</p>
                          <p className="font-mono text-[10px] bg-muted/50 p-1 rounded">
                            Allocation = Base Kelly × Portfolio % × Strategy %
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/20 pl-2">
                          Example: Base Kelly 40%, Portfolio 25%, Strategy 50% =
                          40% × 0.25 × 0.50 = 5% of capital
                        </p>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              <Input
                id="portfolio-kelly"
                type="number"
                value={portfolioKellyPct}
                onChange={(e) =>
                  setPortfolioKellyPct(parseInt(e.target.value) || 100)
                }
                min={0}
                max={200}
                step={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Margin Calculation Mode</Label>
              <RadioGroup
                value={marginMode}
                onValueChange={(value) => setMarginMode(value as MarginMode)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed" className="font-normal cursor-pointer">
                    Fixed Capital
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="compounding" id="compounding" />
                  <Label
                    htmlFor="compounding"
                    className="font-normal cursor-pointer"
                  >
                    Compounding
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Strategy Kelly Table */}
          <div className="space-y-3">
            <Label>Strategy Kelly Multipliers</Label>
            <StrategyKellyTable
              strategies={strategyData}
              kellyValues={kellyValues}
              selectedStrategies={selectedStrategies}
              onKellyChange={handleKellyChange}
              onSelectionChange={handleSelectionChange}
              onSelectAll={handleSelectAll}
            />
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            {/* Slider to set all selected strategies */}
            {selectedStrategies.size > 0 && (
              <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Apply Kelly % to {selectedStrategies.size} selected{" "}
                    {selectedStrategies.size === 1 ? "strategy" : "strategies"}
                  </Label>
                  <span className="text-sm font-semibold text-primary">
                    {allStrategiesKellyPct}%
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[allStrategiesKellyPct]}
                    onValueChange={(values) =>
                      setAllStrategiesKellyPct(values[0])
                    }
                    min={0}
                    max={200}
                    step={5}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const newValues: Record<string, number> = {};
                      selectedStrategies.forEach((strategy) => {
                        newValues[strategy] = allStrategiesKellyPct;
                      });
                      setKellyValues((prev) => ({ ...prev, ...newValues }));
                    }}
                  >
                    Apply
                  </Button>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setAllStrategiesKellyPct(25)}
                    className="hover:text-foreground"
                  >
                    25%
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setAllStrategiesKellyPct(50)}
                    className="hover:text-foreground"
                  >
                    50%
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setAllStrategiesKellyPct(75)}
                    className="hover:text-foreground"
                  >
                    75%
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setAllStrategiesKellyPct(100)}
                    className="hover:text-foreground"
                  >
                    100%
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setAllStrategiesKellyPct(125)}
                    className="hover:text-foreground"
                  >
                    125%
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setAllStrategiesKellyPct(150)}
                    className="hover:text-foreground"
                  >
                    150%
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  const resetValues: Record<string, number> = {};
                  strategyData.forEach((s) => {
                    resetValues[s.name] = 100;
                  });
                  setKellyValues(resetValues);
                  setAllStrategiesKellyPct(100);
                }}
              >
                Reset All to 100%
              </Button>
              <Button onClick={runAllocation} className="ml-auto gap-2">
                <Play className="h-4 w-4" />
                Run Allocation
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Results */}
      {results && (
        <>
          <PortfolioSummary
            portfolioMetrics={results.portfolioMetrics}
            weightedAppliedPct={results.weightedAppliedPct}
            startingCapital={startingCapital}
            appliedCapital={results.appliedCapital}
          />

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Strategy Analysis</h2>
            <StrategyResults strategies={results.strategyAnalysis} />
          </div>

          <MarginChart
            marginTimeline={results.marginTimeline}
            strategyNames={results.strategyNames}
          />

          <MarginStatisticsTable
            portfolioMaxMarginPct={results.portfolioMaxMarginPct}
            portfolioKellyPct={portfolioKellyPct}
            weightedAppliedPct={results.weightedAppliedPct}
            strategyAnalysis={results.strategyAnalysis}
          />
        </>
      )}
    </div>
  );
}
