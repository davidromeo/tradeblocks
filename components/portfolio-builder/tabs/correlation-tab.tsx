"use client";

/**
 * Correlation Tab - Cross-block correlation analysis
 *
 * Shows correlation between selected blocks' daily returns,
 * helping users understand diversification potential.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { getTradesByBlock } from "@/lib/db";
import { Trade } from "@/lib/models/trade";
import { truncateStrategyName } from "@/lib/utils";
import { normalizeTradesToContracts } from "@/lib/utils/trade-normalization";
import { SizingConfig, BlockSizingStats } from "@/lib/models/mega-block";
import { Info } from "lucide-react";
import { useTheme } from "next-themes";
import type { Data, Layout, PlotData } from "plotly.js";
import { useEffect, useState, useMemo } from "react";

interface SelectedBlock {
  blockId: string;
  name: string;
  sizingConfig: SizingConfig;
  stats?: BlockSizingStats;
}

interface BlockReturns {
  blockId: string;
  name: string;
  dailyReturns: Record<string, number>; // dateKey -> total P&L for that day
}

interface CorrelationTabProps {
  selectedBlocks: SelectedBlock[];
}

/**
 * Calculate Pearson correlation between two arrays
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Get date key from trade for grouping
 */
function getDateKey(trade: Trade): string {
  const date = new Date(trade.dateOpened);
  return date.toISOString().split("T")[0];
}

export function CorrelationTab({ selectedBlocks }: CorrelationTabProps) {
  const { theme } = useTheme();
  const [blockReturns, setBlockReturns] = useState<BlockReturns[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load trades and calculate daily returns for each block
  useEffect(() => {
    async function loadBlockReturns() {
      if (selectedBlocks.length === 0) {
        setBlockReturns([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const returnsPromises = selectedBlocks.map(async (block) => {
        try {
          const rawTrades = await getTradesByBlock(block.blockId);
          // Apply per-trade normalization if maxContracts is specified
          const trades = block.sizingConfig?.maxContracts !== undefined
            ? normalizeTradesToContracts(rawTrades, block.sizingConfig.maxContracts)
            : rawTrades;

          // Aggregate P&L by date
          const dailyReturns: Record<string, number> = {};
          for (const trade of trades) {
            const dateKey = getDateKey(trade);
            dailyReturns[dateKey] = (dailyReturns[dateKey] || 0) + trade.pl;
          }

          return {
            blockId: block.blockId,
            name: block.name,
            dailyReturns,
          };
        } catch (error) {
          console.error(`Failed to load trades for block ${block.blockId}:`, error);
          return {
            blockId: block.blockId,
            name: block.name,
            dailyReturns: {},
          };
        }
      });

      const results = await Promise.all(returnsPromises);
      setBlockReturns(results);
      setIsLoading(false);
    }

    loadBlockReturns();
  }, [selectedBlocks]);

  // Calculate correlation matrix
  const { correlationMatrix, sharedDays } = useMemo(() => {
    if (blockReturns.length < 2) {
      return { correlationMatrix: null, sharedDays: null };
    }

    const n = blockReturns.length;
    const matrix: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));
    const days: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    // Get all unique dates across all blocks
    const allDates = new Set<string>();
    for (const block of blockReturns) {
      Object.keys(block.dailyReturns).forEach((d) => allDates.add(d));
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
          days[i][j] = Object.keys(blockReturns[i].dailyReturns).length;
          continue;
        }

        // Find shared dates between the two blocks
        const returnsI = blockReturns[i].dailyReturns;
        const returnsJ = blockReturns[j].dailyReturns;

        const sharedDates = Object.keys(returnsI).filter(
          (date) => date in returnsJ
        );

        if (sharedDates.length < 2) {
          matrix[i][j] = NaN;
          days[i][j] = sharedDates.length;
          continue;
        }

        const xValues = sharedDates.map((d) => returnsI[d]);
        const yValues = sharedDates.map((d) => returnsJ[d]);

        matrix[i][j] = pearsonCorrelation(xValues, yValues);
        days[i][j] = sharedDates.length;
      }
    }

    return { correlationMatrix: matrix, sharedDays: days };
  }, [blockReturns]);

  // Generate Plotly heatmap
  const { plotData, layout } = useMemo(() => {
    if (!correlationMatrix || blockReturns.length < 2) {
      return { plotData: [], layout: {} };
    }

    const isDark = theme === "dark";
    const blockNames = blockReturns.map((b) => b.name);

    // Colorscale matching existing correlation matrix page
    const colorscale = isDark
      ? [
          [0, "#1e40af"],
          [0.25, "#3b82f6"],
          [0.45, "#93c5fd"],
          [0.5, "#334155"],
          [0.55, "#fca5a5"],
          [0.75, "#ef4444"],
          [1, "#991b1b"],
        ]
      : [
          [0, "#053061"],
          [0.25, "#2166ac"],
          [0.45, "#d1e5f0"],
          [0.5, "#f7f7f7"],
          [0.55, "#fddbc7"],
          [0.75, "#d6604d"],
          [1, "#67001f"],
        ];

    // Create hover text with sample sizes
    const hoverText = correlationMatrix.map((row, i) =>
      row.map((val, j) => {
        if (isNaN(val)) return "Insufficient data";
        const days = sharedDays?.[i]?.[j] || 0;
        return `${blockNames[i]} vs ${blockNames[j]}<br>Correlation: ${val.toFixed(3)}<br>Shared days: ${days}`;
      })
    );

    const data: Data[] = [
      {
        type: "heatmap",
        z: correlationMatrix,
        x: blockNames,
        y: blockNames,
        colorscale: colorscale as unknown as PlotData["colorscale"],
        zmin: -1,
        zmax: 1,
        text: hoverText,
        hovertemplate: "%{text}<extra></extra>",
        showscale: true,
        colorbar: {
          title: "Correlation",
          titleside: "right",
          tickvals: [-1, -0.5, 0, 0.5, 1],
        },
      } as unknown as Data,
    ];

    // Add text annotations for correlation values
    const annotations = correlationMatrix.flatMap((row, i) =>
      row.map((val, j) => ({
        x: blockNames[j],
        y: blockNames[i],
        text: isNaN(val) ? "—" : val.toFixed(2),
        showarrow: false,
        font: {
          color: Math.abs(val) > 0.5 || isNaN(val) ? "white" : isDark ? "#94a3b8" : "#475569",
          size: 12,
        },
      }))
    );

    const plotLayout: Partial<Layout> = {
      annotations,
      xaxis: {
        side: "bottom",
        tickangle: -45,
      },
      yaxis: {
        autorange: "reversed",
      },
      margin: { l: 120, r: 50, t: 30, b: 100 },
    };

    return { plotData: data, layout: plotLayout };
  }, [correlationMatrix, blockReturns, sharedDays, theme]);

  // Calculate summary stats with pair info
  const summaryStats = useMemo(() => {
    if (!correlationMatrix || correlationMatrix.length < 2) return null;

    interface PairInfo {
      value: number;
      pair: [string, string];
      sampleSize: number;
    }

    let strongest: PairInfo | null = null;
    let weakest: PairInfo | null = null;
    const offDiagonalValues: number[] = [];

    for (let i = 0; i < correlationMatrix.length; i++) {
      for (let j = i + 1; j < correlationMatrix.length; j++) {
        const val = correlationMatrix[i][j];
        const sampleSize = sharedDays?.[i]?.[j] ?? 0;

        if (!isNaN(val)) {
          offDiagonalValues.push(val);

          const pairInfo: PairInfo = {
            value: val,
            pair: [blockReturns[i].name, blockReturns[j].name],
            sampleSize,
          };

          if (!strongest || val > strongest.value) {
            strongest = pairInfo;
          }
          if (!weakest || val < weakest.value) {
            weakest = pairInfo;
          }
        }
      }
    }

    if (offDiagonalValues.length === 0) return null;

    const avg =
      offDiagonalValues.reduce((a, b) => a + b, 0) / offDiagonalValues.length;

    return {
      avgCorrelation: avg,
      strongest,
      weakest,
      pairCount: offDiagonalValues.length,
    };
  }, [correlationMatrix, sharedDays, blockReturns]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Block Correlation Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (blockReturns.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Block Correlation Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Select at least 2 blocks to see correlation analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">What does this show?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This heatmap shows how your blocks&apos; returns move together. High positive correlation (+1.0) means blocks
                move in the same direction, while negative correlation (-1.0) means they move opposite. Low correlation (~0)
                indicates good diversification potential.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Analysis */}
      {summaryStats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Strongest */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Strongest:
                </div>
                {summaryStats.strongest ? (
                  <>
                    <div className="text-xl font-bold text-red-600 dark:text-red-300">
                      {summaryStats.strongest.value.toFixed(2)}
                      <span className="text-xs font-normal text-muted-foreground ml-2">
                        (n={summaryStats.strongest.sampleSize})
                      </span>
                    </div>
                    <div
                      className="text-[10px] text-muted-foreground truncate"
                      title={`${summaryStats.strongest.pair[0]} ↔ ${summaryStats.strongest.pair[1]}`}
                    >
                      {truncateStrategyName(summaryStats.strongest.pair[0], 15)} ↔{" "}
                      {truncateStrategyName(summaryStats.strongest.pair[1], 15)}
                    </div>
                  </>
                ) : (
                  <div className="text-xl font-bold text-muted-foreground">—</div>
                )}
              </div>

              {/* Weakest */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Weakest:
                </div>
                {summaryStats.weakest ? (
                  <>
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-300">
                      {summaryStats.weakest.value.toFixed(2)}
                      <span className="text-xs font-normal text-muted-foreground ml-2">
                        (n={summaryStats.weakest.sampleSize})
                      </span>
                    </div>
                    <div
                      className="text-[10px] text-muted-foreground truncate"
                      title={`${summaryStats.weakest.pair[0]} ↔ ${summaryStats.weakest.pair[1]}`}
                    >
                      {truncateStrategyName(summaryStats.weakest.pair[0], 15)} ↔{" "}
                      {truncateStrategyName(summaryStats.weakest.pair[1], 15)}
                    </div>
                  </>
                ) : (
                  <div className="text-xl font-bold text-muted-foreground">—</div>
                )}
              </div>

              {/* Average */}
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Average:
                </div>
                <div className="text-xl font-bold">
                  {summaryStats.avgCorrelation.toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {blockReturns.length} blocks · Pearson, shared days
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap */}
      <ChartWrapper
        title="Block Correlation Matrix"
        description="Pearson correlation of daily P&L between blocks. Lower correlation suggests better diversification."
        data={plotData}
        layout={{
          ...layout,
          height: Math.max(300, blockReturns.length * 60 + 150),
        }}
      />
    </div>
  );
}

export default CorrelationTab;
