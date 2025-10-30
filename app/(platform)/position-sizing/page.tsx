"use client";

import { MarginChart } from "@/components/position-sizing/margin-chart";
import { MarginStatisticsTable } from "@/components/position-sizing/margin-statistics-table";
import { PortfolioSummary } from "@/components/position-sizing/portfolio-summary";
import { RiskConstraintSummary } from "@/components/position-sizing/risk-constraint-summary";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateKellyMetrics,
  calculateStrategyKellyMetrics,
} from "@/lib/calculations/kelly";
import { computeRiskConstrainedKelly } from "@/lib/calculations/risk-constrained-kelly";
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
import { useEffect, useMemo, useState, type ReactNode } from "react";

interface ConstraintToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  children?: (state: { checked: boolean }) => ReactNode;
}

interface RunInputs {
  startingCapital: number;
  portfolioKellyPct: number;
  marginMode: MarginMode;
  kellyValues: Record<string, number>;
  maxDrawdownTargetPct: number;
  maxMarginLimitPct: number;
  enableDrawdownConstraint: boolean;
  enableMarginConstraint: boolean;
}

type StrategySortOption = "name" | "winRate" | "normalizedKelly";

const STRATEGY_SORT_OPTIONS: Array<{ value: StrategySortOption; label: string }> = [
  { value: "name", label: "Name (A→Z)" },
  { value: "winRate", label: "Win Rate (High→Low)" },
  { value: "normalizedKelly", label: "Normalized Kelly % (High→Low)" },
];

function sortStrategies(
  strategies: StrategyAnalysis[],
  option: StrategySortOption
): StrategyAnalysis[] {
  const sorted = [...strategies];
  switch (option) {
    case "winRate":
      return sorted.sort((a, b) => {
        const diff = b.kellyMetrics.winRate - a.kellyMetrics.winRate;
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
    case "normalizedKelly":
      return sorted.sort((a, b) => {
        const aKelly = a.kellyMetrics.normalizedKellyPct ?? a.kellyMetrics.percent;
        const bKelly = b.kellyMetrics.normalizedKellyPct ?? b.kellyMetrics.percent;
        const diff = (bKelly ?? 0) - (aKelly ?? 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
    case "name":
    default:
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function ConstraintToggle({
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: ConstraintToggleProps) {
  return (
    <div className="rounded-md border border-muted-foreground/20 bg-muted/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {children ? <div className="space-y-2">{children({ checked })}</div> : null}
    </div>
  );
}

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
  const [allStrategiesKellyPct, setAllStrategiesKellyPct] = useState(100);
  const [maxDrawdownTargetPct, setMaxDrawdownTargetPct] = useState(20);
  const [maxMarginLimitPct, setMaxMarginLimitPct] = useState(100);
  const [enableDrawdownConstraint, setEnableDrawdownConstraint] = useState(true);
  const [enableMarginConstraint, setEnableMarginConstraint] = useState(true);
  const [strategySortOption, setStrategySortOption] = useState<StrategySortOption>("name");
  const [lastRunInputs, setLastRunInputs] = useState<RunInputs | null>(null);

  // Load trades and daily log when active block changes
  useEffect(() => {
    setLastRunInputs(null);
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
    setLastRunInputs({
      startingCapital,
      portfolioKellyPct,
      marginMode,
      kellyValues: { ...kellyValues },
      maxDrawdownTargetPct,
      maxMarginLimitPct,
      enableDrawdownConstraint,
      enableMarginConstraint,
    });
  };

  // Results calculations based on the most recent Run Allocation snapshot
  const results = useMemo(() => {
    if (!lastRunInputs || trades.length === 0) return null;

    const {
      startingCapital: runStartingCapital,
      portfolioKellyPct: runPortfolioKellyPct,
      marginMode: runMarginMode,
      kellyValues: runKellyValues,
      maxDrawdownTargetPct: runDrawdownTarget,
      maxMarginLimitPct: runMarginLimit,
      enableDrawdownConstraint: runDrawdownEnabled,
      enableMarginConstraint: runMarginEnabled,
    } = lastRunInputs;

    // Calculate portfolio-level Kelly metrics with starting capital for validation
    const portfolioMetrics = calculateKellyMetrics(trades, runStartingCapital);

    // Calculate per-strategy Kelly metrics with starting capital for validation
    const strategyMetricsMap = calculateStrategyKellyMetrics(trades, runStartingCapital);

    // Get strategy names sorted by trade count
    const strategyNames = strategyData.map((s) => s.name);

    // Build margin timeline using run configuration
    const marginTimeline = buildMarginTimeline(
      trades,
      strategyNames,
      runStartingCapital,
      runMarginMode,
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
      const inputPct = runKellyValues[strategy.name] ?? 100;

      // Use normalized Kelly when available (more accurate for position sizing)
      const effectiveKellyPct = metrics.normalizedKellyPct ?? metrics.percent;

      // Apply BOTH Portfolio Kelly and Strategy Kelly multipliers
      const appliedPct =
        effectiveKellyPct * (runPortfolioKellyPct / 100) * (inputPct / 100);
      const maxMarginPct = calculateMaxMarginPct(marginTimeline, strategy.name);
      const allocationPct =
        maxMarginPct * (runPortfolioKellyPct / 100) * (inputPct / 100);
      const allocationDollars = (runStartingCapital * allocationPct) / 100;

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
    const appliedCapital = (runStartingCapital * weightedAppliedPct) / 100;

    const riskConstraint =
      runDrawdownEnabled || runMarginEnabled
        ? computeRiskConstrainedKelly({
            trades,
            startingCapital: runStartingCapital,
            strategyKellyMultipliers: runKellyValues,
            portfolioKellyPct: runPortfolioKellyPct,
            targetDrawdownPct: runDrawdownEnabled ? runDrawdownTarget : 0,
            marginTimeline,
            marginLimitPct: runMarginEnabled ? runMarginLimit : Infinity,
          })
        : null;

    return {
      portfolioMetrics,
      strategyAnalysis,
      marginTimeline,
      strategyNames,
      weightedAppliedPct,
      appliedCapital,
      portfolioMaxMarginPct,
      riskConstraint,
      startingCapitalUsed: runStartingCapital,
      portfolioKellyPctUsed: runPortfolioKellyPct,
      drawdownTargetUsed: runDrawdownTarget,
      marginLimitUsed: runMarginLimit,
      drawdownConstraintEnabled: runDrawdownEnabled,
      marginConstraintEnabled: runMarginEnabled,
    };
  }, [lastRunInputs, trades, dailyLog, strategyData]);

  const sortedStrategies = useMemo(() => {
    if (!results) return [];
    return sortStrategies(results.strategyAnalysis, strategySortOption);
  }, [results, strategySortOption]);

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
              Toggle <strong>Apply Drawdown Target</strong> to set the maximum
              peak-to-trough loss you want to allow, and <strong>Apply Margin
              Limit</strong> to cap projected margin usage. These guardrails
              only influence the recommendations after you click <em>Run
              Allocation</em>.
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
            backtest or deploy. Recommendations come from historical scaling and
            are <strong>not</strong> produced by re-running your backtest, so
            expect differences once you validate inside your strategy engine.
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
                onChange={(e) => {
                  const next = parseFloat(e.target.value);
                  setPortfolioKellyPct(Number.isFinite(next) ? next : 100);
                }}
                min={0}
                max={200}
                step={1}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConstraintToggle
              label="Apply Drawdown Target"
              description="Scale Kelly so projected max drawdown stays beneath your target."
              checked={enableDrawdownConstraint}
              onCheckedChange={setEnableDrawdownConstraint}
            >
              {({ checked }) => (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="max-drawdown-target">Max Drawdown Target (%)</Label>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Risk-Constrained Kelly
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              Choose the largest drawdown you&apos;re willing to stomach.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              We&apos;ll scale historical trade P&amp;L using your per-strategy Kelly percentages
                              and solve for the portfolio fraction that keeps maximum drawdown beneath this limit.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                  <Input
                    id="max-drawdown-target"
                    type="number"
                    value={maxDrawdownTargetPct}
                    onChange={(e) => {
                      const next = parseFloat(e.target.value);
                      setMaxDrawdownTargetPct(Number.isFinite(next) ? Math.max(0, next) : 0);
                    }}
                    min={0}
                    max={100}
                    step={0.5}
                    disabled={!checked}
                  />
                </div>
              )}
            </ConstraintToggle>
            <ConstraintToggle
              label="Apply Margin Limit"
              description="Cap Kelly sizing when projected margin usage exceeds your limit."
              checked={enableMarginConstraint}
              onCheckedChange={setEnableMarginConstraint}
            >
              {({ checked }) => (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="max-margin-limit">Max Margin Usage (%)</Label>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Portfolio Margin Guardrail
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              Cap projected peak margin as a percentage of starting capital.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              We scale historical margin requirements alongside Kelly sizing to keep recommendations
                              within your brokerage or personal limits.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                  <Input
                    id="max-margin-limit"
                    type="number"
                    value={maxMarginLimitPct}
                    onChange={(e) => {
                      const next = parseFloat(e.target.value);
                      setMaxMarginLimitPct(Number.isFinite(next) ? Math.max(0, next) : 0);
                    }}
                    min={0}
                    max={400}
                    step={5}
                    disabled={!checked}
                  />
                </div>
              )}
            </ConstraintToggle>
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
            startingCapital={results.startingCapitalUsed}
            appliedCapital={results.appliedCapital}
          />

          {results.riskConstraint && (
            <RiskConstraintSummary
              result={results.riskConstraint}
              drawdownEnabled={results.drawdownConstraintEnabled}
              marginEnabled={results.marginConstraintEnabled}
              onApply={(pct) => {
                setPortfolioKellyPct(pct);
                setLastRunInputs({
                  startingCapital,
                  portfolioKellyPct: pct,
                  marginMode,
                  kellyValues: { ...kellyValues },
                  maxDrawdownTargetPct,
                  maxMarginLimitPct,
                  enableDrawdownConstraint,
                  enableMarginConstraint,
                });
              }}
            />
          )}

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Strategy Analysis</h2>
              <Select
                value={strategySortOption}
                onValueChange={(value) => setStrategySortOption(value as StrategySortOption)}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Sort strategies" />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <StrategyResults
              strategies={sortedStrategies}
              startingCapital={results.startingCapitalUsed}
            />
          </div>

          <MarginChart
            marginTimeline={results.marginTimeline}
            strategyNames={results.strategyNames}
          />

          <MarginStatisticsTable
            portfolioMaxMarginPct={results.portfolioMaxMarginPct}
            portfolioKellyPct={results.portfolioKellyPctUsed}
            weightedAppliedPct={results.weightedAppliedPct}
            strategyAnalysis={sortedStrategies}
          />
        </>
      )}
    </div>
  );
}
