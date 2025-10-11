/**
 * Strategy results grid showing per-strategy Kelly metrics and allocation guidance
 */

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

interface StrategyResultsProps {
  strategies: StrategyAnalysis[];
}

export function StrategyResults({
  strategies,
}: StrategyResultsProps) {
  if (strategies.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No strategies available for analysis.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {strategies.map((strategy) => {
        const hasValidKelly = strategy.kellyMetrics.hasValidKelly;
        const hasOnlyWins = strategy.kellyMetrics.avgWin > 0 && strategy.kellyMetrics.avgLoss === 0;
        const hasOnlyLosses = strategy.kellyMetrics.avgWin === 0 && strategy.kellyMetrics.avgLoss > 0;

        const payoffDisplay =
          isFinite(strategy.kellyMetrics.payoffRatio) &&
          strategy.kellyMetrics.payoffRatio > 0
            ? `${strategy.kellyMetrics.payoffRatio.toFixed(2)}x`
            : "--";

        const avgWinDisplay =
          strategy.kellyMetrics.avgWin > 0
            ? `$${strategy.kellyMetrics.avgWin.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            : "--";

        const avgLossDisplay =
          strategy.kellyMetrics.avgLoss > 0
            ? `-$${strategy.kellyMetrics.avgLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            : "--";

        return (
          <Card key={strategy.name} className="p-4">
            <div className="space-y-4">
              {/* Strategy name and badges */}
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <h3 className="font-semibold leading-snug min-h-[3rem] flex items-center">
                  {strategy.name}
                </h3>
                <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                  <Badge variant="secondary">
                    {strategy.tradeCount} {strategy.tradeCount === 1 ? "trade" : "trades"}
                  </Badge>
                  {!hasValidKelly && hasOnlyWins && (
                    <Badge variant="outline">
                      Kelly N/A - Only wins
                    </Badge>
                  )}
                  {!hasValidKelly && hasOnlyLosses && (
                    <Badge variant="outline">
                      Kelly N/A - Only losses
                    </Badge>
                  )}
                  {!hasValidKelly && !hasOnlyWins && !hasOnlyLosses && strategy.tradeCount > 0 && (
                    <Badge variant="outline">
                      Kelly N/A - No P/L data
                    </Badge>
                  )}
                  {hasValidKelly && strategy.kellyMetrics.percent <= 0 && (
                    <Badge variant="destructive">
                      Negative expectancy
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Kelly percentages */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {hasValidKelly
                    ? `Full Kelly ${strategy.kellyMetrics.percent.toFixed(1)}%`
                    : "Kelly calculation unavailable"}
                </p>
                {hasValidKelly && (
                  <Badge variant="outline">
                    Applied {strategy.appliedPct.toFixed(1)}%
                  </Badge>
                )}
              </div>

              {hasValidKelly && (
                <p className="text-xs text-muted-foreground">
                  Kelly multiplier: {strategy.inputPct.toFixed(0)}%
                </p>
              )}

              {/* Win rate and payoff ratio */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="text-sm font-semibold">
                    {(strategy.kellyMetrics.winRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-muted-foreground">Win/Loss Ratio</p>
                  <p className="text-sm font-semibold">{payoffDisplay}</p>
                </div>
              </div>

              {/* Average win/loss */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Average Win</p>
                  <p className="text-sm font-semibold text-green-600">
                    {avgWinDisplay}
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-muted-foreground">Average Loss</p>
                  <p className="text-sm font-semibold text-red-600">
                    {avgLossDisplay}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Allocation guidance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground">Max margin used</p>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Max Margin Used
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              Peak margin requirement observed historically for this strategy.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Higher values indicate more capital-intensive strategies. This represents the maximum percentage of your starting capital that was needed at any point to support all open positions in this strategy.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                  <p className="text-sm font-semibold">
                    {strategy.maxMarginPct.toFixed(1)}%
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground">Applied capital</p>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Applied Capital
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              Starting capital × this strategy&apos;s applied % after Kelly.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Use this as the maximum capital you intend to commit to the strategy when configuring backtest sizing rules. This represents the total capital allocated to this strategy based on your Kelly settings.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                  <p className="text-sm font-semibold">
                    ${strategy.allocationDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground">
                      Reference allocation %
                    </p>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Reference Allocation %
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              Historical max margin × your Kelly %.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Use this percentage as the per-trade margin allocation guideline when setting up your backtest. This helps you size positions appropriately given the historical capital requirements and your chosen Kelly fraction.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                  <p className="text-sm font-semibold">
                    {strategy.allocationPct.toFixed(1)}%
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-muted-foreground">
                      Reference allocation $
                    </p>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Reference Allocation $
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              Starting capital × reference allocation %.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Map this dollar amount to your backtest&apos;s per-trade allocation limit so it mirrors the Kelly-based guidance above. This provides the concrete dollar figure for position sizing in your strategy.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                  <p className="text-sm font-semibold">
                    ${strategy.allocationDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
