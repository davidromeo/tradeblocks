/**
 * Margin Utilization Analysis table showing how Kelly settings affect margin requirements
 */

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

interface MarginStatistic {
  name: string;
  historicalMax: number;
  kellyPct: number;
  projectedMargin: number;
  allocated: number;
  isPortfolio: boolean;
}

interface MarginStatisticsTableProps {
  portfolioMaxMarginPct: number;
  portfolioKellyPct: number;
  weightedAppliedPct: number;
  strategyAnalysis: StrategyAnalysis[];
}

export function MarginStatisticsTable({
  portfolioMaxMarginPct,
  portfolioKellyPct,
  weightedAppliedPct,
  strategyAnalysis,
}: MarginStatisticsTableProps) {
  // Build statistics
  const statistics: MarginStatistic[] = [];

  // Portfolio row
  if (portfolioMaxMarginPct > 0 && portfolioKellyPct > 0) {
    statistics.push({
      name: "Portfolio",
      historicalMax: portfolioMaxMarginPct,
      kellyPct: portfolioKellyPct,
      projectedMargin: portfolioMaxMarginPct * (portfolioKellyPct / 100),
      allocated: weightedAppliedPct,
      isPortfolio: true,
    });
  }

  // Strategy rows
  for (const analysis of strategyAnalysis) {
    if (analysis.maxMarginPct > 0 && analysis.inputPct > 0) {
      const projectedMargin = analysis.maxMarginPct * (analysis.inputPct / 100);
      statistics.push({
        name: analysis.name,
        historicalMax: analysis.maxMarginPct,
        kellyPct: analysis.inputPct,
        projectedMargin,
        allocated: analysis.appliedPct,
        isPortfolio: false,
      });
    }
  }

  // Sort strategies by projected margin (descending)
  const portfolioStats = statistics.filter((s) => s.isPortfolio);
  const strategyStats = statistics
    .filter((s) => !s.isPortfolio)
    .sort((a, b) => b.projectedMargin - a.projectedMargin);

  if (statistics.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">📊 Margin Utilization Analysis</h3>
            <HoverCard>
              <HoverCardTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground/60 cursor-help" />
              </HoverCardTrigger>
              <HoverCardContent className="w-80 p-0 overflow-hidden">
                <div className="space-y-3">
                  <div className="bg-primary/5 border-b px-4 py-3">
                    <h4 className="text-sm font-semibold text-primary">
                      Margin Utilization Analysis
                    </h4>
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      Analyzes how your Kelly settings affect margin requirements across strategies.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This table helps you understand the capital requirements for each strategy at your chosen Kelly fraction. Compare projected margin needs against allocated capital to ensure you have sufficient margin for your position sizing strategy.
                    </p>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </div>
          <p className="text-xs text-muted-foreground">
            How your Kelly settings affect margin requirements
          </p>
        </div>

        {/* Explanation */}
        <Alert>
          <div className="text-xs space-y-2">
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Historical Max:</strong> Highest margin usage observed
                historically.
              </li>
              <li>
                <strong>Projected Margin:</strong> Projected margin need at your Kelly
                %. Example: 80% historical max with a 25% Kelly uses ~20% margin.
              </li>
              <li>
                <strong>Allocated:</strong> How much capital this strategy gets based
                on its calculated Kelly criterion and your Kelly % setting.
              </li>
            </ul>
          </div>
        </Alert>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Strategy</TableHead>
                <TableHead className="text-right w-[17.5%]">
                  <div className="flex items-center justify-end gap-1">
                    Historical Max
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Historical Max
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              Highest margin usage observed historically.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Peak margin requirement as % of starting capital when trades were actually placed. This represents the maximum capital commitment that was needed at any point in your trading history.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                </TableHead>
                <TableHead className="text-right w-[17.5%]">
                  <div className="flex items-center justify-end gap-1">
                    Kelly %
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Kelly %
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              Your current Kelly fraction setting for this strategy.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              This is the multiplier applied to the optimal Kelly percentage. For example, 25% means you&apos;re using a quarter Kelly fraction to reduce risk and volatility.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                </TableHead>
                <TableHead className="text-right w-[17.5%]">
                  <div className="flex items-center justify-end gap-1">
                    Projected Margin
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Projected Margin
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              Expected margin requirement at your Kelly fraction.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Calculated as Historical Max × (Kelly % / 100). For example, if historical max was 80% and you&apos;re using 25% Kelly, projected margin is ~20%. This estimates how much margin you&apos;ll need if you trade at your chosen Kelly fraction.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                </TableHead>
                <TableHead className="text-right w-[17.5%]">
                  <div className="flex items-center justify-end gap-1">
                    Allocated
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-0 overflow-hidden">
                        <div className="space-y-3">
                          <div className="bg-primary/5 border-b px-4 py-3">
                            <h4 className="text-sm font-semibold text-primary">
                              Allocated
                            </h4>
                          </div>
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                              Capital allocated to this strategy after Kelly adjustment.
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Calculated as Optimal Kelly × (Kelly % / 100). This is the percentage of your starting capital that should be dedicated to this strategy based on the Kelly criterion and your risk tolerance settings.
                            </p>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Portfolio row */}
              {portfolioStats.map((stat) => (
                <TableRow key={stat.name} className="font-semibold">
                  <TableCell>{stat.name}</TableCell>
                  <TableCell className="text-right">
                    {stat.historicalMax.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {stat.kellyPct.toFixed(0)}%
                  </TableCell>
                  <TableCell
                    className={`text-right ${
                      stat.projectedMargin <= stat.allocated
                        ? "text-blue-600"
                        : "text-orange-600"
                    }`}
                  >
                    {stat.projectedMargin.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {stat.allocated.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}

              {/* Strategy rows */}
              {strategyStats.map((stat) => (
                <TableRow key={stat.name}>
                  <TableCell className="text-sm">{stat.name}</TableCell>
                  <TableCell className="text-right text-sm">
                    {stat.historicalMax.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {stat.kellyPct.toFixed(0)}%
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm ${
                      stat.projectedMargin <= stat.allocated
                        ? "text-blue-600"
                        : "text-orange-600"
                    }`}
                  >
                    {stat.projectedMargin.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {stat.allocated.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Color coding explanation */}
        <Alert>
          <AlertDescription className="text-xs">
            <strong>Color coding:</strong>{" "}
            <span className="text-blue-600 font-medium">Blue</span> = Expected margin
            ≤ Allocated capital (good).{" "}
            <span className="text-orange-600 font-medium">Orange</span> = Expected
            margin &gt; Allocated capital (may need more capital or lower Kelly %).
          </AlertDescription>
        </Alert>
      </div>
    </Card>
  );
}
