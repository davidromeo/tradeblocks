"use client";

/**
 * Tail Risk Tab - Joint tail risk analysis for selected blocks
 *
 * Shows the Joint Tail Risk Heatmap - how likely blocks are to have
 * extreme losses together, measuring diversification during stress periods.
 * Reuses the existing TailDependenceHeatmap and TailRiskSummaryCards components.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { TailDependenceHeatmap } from "@/components/tail-risk/tail-dependence-heatmap";
import { TailRiskSummaryCards } from "@/components/tail-risk/tail-risk-summary-cards";
import { getTradesByBlock } from "@/lib/db";
import { Trade } from "@/lib/models/trade";
import { TailRiskAnalysisResult } from "@/lib/models/tail-risk";
import { normalizeTradesToContracts } from "@/lib/utils/trade-normalization";
import {
  kendallTau,
  kendallTauToPearson,
  probabilityIntegralTransform,
} from "@/lib/calculations/statistical-utils";
import { eigs, matrix } from "mathjs";
import { SizingConfig, BlockSizingStats } from "@/lib/models/mega-block";
import { Info } from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";

interface SelectedBlock {
  blockId: string;
  name: string;
  sizingConfig: SizingConfig;
  stats?: BlockSizingStats;
}

interface BlockDailyReturns {
  blockId: string;
  name: string;
  dailyReturns: Record<string, number>;
}

interface TailRiskTabProps {
  selectedBlocks: SelectedBlock[];
}

// Minimum tail observations for valid estimates
const MIN_TAIL_OBSERVATIONS_FLOOR = 5;

function getMinTailObservations(tailThreshold: number, sharedTradingDays: number): number {
  const expectedTailDays = tailThreshold * sharedTradingDays;
  const scaledMinimum = Math.ceil(expectedTailDays * 0.1);
  return Math.max(MIN_TAIL_OBSERVATIONS_FLOOR, scaledMinimum);
}

function getDateKey(trade: Trade): string {
  const date = new Date(trade.dateOpened);
  return date.toISOString().split("T")[0];
}

export function TailRiskTab({ selectedBlocks }: TailRiskTabProps) {
  const [blockReturns, setBlockReturns] = useState<BlockDailyReturns[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tailThreshold, setTailThreshold] = useState(0.1); // 10th percentile

  // Load trades and calculate daily returns
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

  // Perform tail risk analysis adapted for blocks
  const tailRiskResult = useMemo((): TailRiskAnalysisResult | null => {
    if (blockReturns.length < 2) return null;

    const startTime = performance.now();
    const varianceThreshold = 0.8;

    // Get all unique dates and build aligned returns matrix
    const allDates = new Set<string>();
    for (const block of blockReturns) {
      Object.keys(block.dailyReturns).forEach((d) => allDates.add(d));
    }
    const sortedDates = Array.from(allDates).sort();

    if (sortedDates.length < 30) {
      // Not enough data for meaningful analysis
      return null;
    }

    // Build aligned returns and traded mask
    const strategies = blockReturns.map((b) => b.name);
    const n = strategies.length;
    const returns: number[][] = [];
    const tradedMask: boolean[][] = [];

    for (const block of blockReturns) {
      const blockReturnsArray: number[] = [];
      const blockMask: boolean[] = [];

      for (const date of sortedDates) {
        const traded = date in block.dailyReturns;
        blockMask.push(traded);
        // Use raw returns for correlation analysis (not scaled by position size)
        blockReturnsArray.push(traded ? block.dailyReturns[date] : 0);
      }

      returns.push(blockReturnsArray);
      tradedMask.push(blockMask);
    }

    // Apply Probability Integral Transform
    const transformedReturns = returns.map((strategyReturns) =>
      probabilityIntegralTransform(strategyReturns)
    );

    // Compute copula correlation matrix using Kendall's tau
    const copulaCorrelationMatrix: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          row.push(1.0);
        } else {
          const tau = kendallTau(transformedReturns[i], transformedReturns[j]);
          row.push(kendallTauToPearson(tau));
        }
      }
      copulaCorrelationMatrix.push(row);
    }

    // Eigenvalue decomposition
    let eigenvalues: number[] = new Array(n).fill(1);
    let eigenvectors: number[][] = strategies.map((_, i) =>
      new Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))
    );
    let explainedVariance: number[] = new Array(n).fill(0).map((_, i) => (i + 1) / n);
    let effectiveFactors = n;

    try {
      const result = eigs(matrix(copulaCorrelationMatrix));

      // Extract eigenvalues
      const rawValues = (
        Array.isArray(result.values)
          ? result.values
          : (result.values as { toArray: () => unknown[] }).toArray()
      ) as (number | { re: number; im: number })[];

      eigenvalues = [];
      for (const val of rawValues) {
        if (typeof val === "number") {
          eigenvalues.push(val);
        } else if (val && typeof val === "object" && "re" in val) {
          eigenvalues.push(val.re);
        }
      }

      // Extract eigenvectors
      type EigenvectorEntry = {
        value: number | { re: number };
        vector: { toArray: () => (number | { re: number })[] };
      };
      const rawVectors = result.eigenvectors as EigenvectorEntry[];
      eigenvectors = [];
      for (const ev of rawVectors) {
        const vecArray = ev.vector.toArray();
        const vec = vecArray.map((v) => (typeof v === "number" ? v : v.re));
        eigenvectors.push(vec);
      }

      // Sort by eigenvalue descending
      const indexed = eigenvalues.map((val, idx) => ({ val, idx }));
      indexed.sort((a, b) => b.val - a.val);
      eigenvalues = indexed.map((item) => item.val);
      eigenvectors = indexed.map((item) => eigenvectors[item.idx]);

      // Calculate explained variance
      const totalVariance = eigenvalues.reduce((sum, val) => sum + val, 0);
      let cumulative = 0;
      explainedVariance = eigenvalues.map((val) => {
        cumulative += val / totalVariance;
        return cumulative;
      });

      // Find effective factors
      for (let i = 0; i < explainedVariance.length; i++) {
        if (explainedVariance[i] >= varianceThreshold) {
          effectiveFactors = i + 1;
          break;
        }
      }
    } catch (error) {
      console.warn("Eigenvalue decomposition failed:", error);
    }

    // Calculate threshold values for tail identification
    const thresholdValues = transformedReturns.map((rets, i) => {
      const actualReturns = rets.filter((_, t) => tradedMask[i][t]);
      const m = actualReturns.length;
      if (m === 0) return 0;

      const sorted = [...actualReturns].sort((a, b) => a - b);
      const pos = tailThreshold * (m - 1);
      const lower = Math.floor(pos);
      const upper = Math.ceil(pos);
      const frac = pos - lower;

      if (lower === upper || upper >= m) {
        return sorted[Math.max(0, Math.min(lower, m - 1))];
      }
      return sorted[lower] * (1 - frac) + sorted[upper] * frac;
    });

    // Identify tail observations
    const inTail: boolean[][] = transformedReturns.map((rets, i) =>
      rets.map((val, t) => tradedMask[i][t] && val <= thresholdValues[i])
    );

    // Compute joint tail risk matrix
    const jointTailRiskMatrix: number[][] = [];
    let insufficientDataPairs = 0;

    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          row.push(1.0);
          continue;
        }

        let sharedTradingDays = 0;
        let bothInTail = 0;
        let iInTailAndBothTraded = 0;

        for (let t = 0; t < sortedDates.length; t++) {
          if (tradedMask[i][t] && tradedMask[j][t]) {
            sharedTradingDays++;
            if (inTail[i][t]) {
              iInTailAndBothTraded++;
              if (inTail[j][t]) {
                bothInTail++;
              }
            }
          }
        }

        const minTailObs = getMinTailObservations(tailThreshold, sharedTradingDays);

        if (iInTailAndBothTraded < minTailObs) {
          row.push(NaN);
          insufficientDataPairs++;
        } else {
          row.push(bothInTail / iInTailAndBothTraded);
        }
      }
      jointTailRiskMatrix.push(row);
    }

    // Calculate analytics
    let highest = { value: -Infinity, pair: ["", ""] as [string, string] };
    let lowest = { value: Infinity, pair: ["", ""] as [string, string] };
    let sum = 0;
    let validCount = 0;
    let highRiskCount = 0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const valIJ = jointTailRiskMatrix[i][j];
        const valJI = jointTailRiskMatrix[j][i];

        if (Number.isNaN(valIJ) || Number.isNaN(valJI)) continue;

        const value = (valIJ + valJI) / 2;
        sum += value;
        validCount++;

        if (value > highest.value) {
          highest = { value, pair: [strategies[i], strategies[j]] };
        }
        if (value < lowest.value) {
          lowest = { value, pair: [strategies[i], strategies[j]] };
        }
        if (value > 0.5) {
          highRiskCount++;
        }
      }
    }

    const analytics = validCount > 0
      ? {
          highestJointTailRisk: highest,
          lowestJointTailRisk: lowest,
          averageJointTailRisk: sum / validCount,
          highRiskPairsPct: highRiskCount / validCount,
        }
      : {
          highestJointTailRisk: { value: 0, pair: ["", ""] as [string, string] },
          lowestJointTailRisk: { value: 0, pair: ["", ""] as [string, string] },
          averageJointTailRisk: 0,
          highRiskPairsPct: 0,
        };

    // Calculate marginal contributions
    const firstEigenvector = eigenvectors[0] || new Array(n).fill(0);
    const sumAbsLoadings = firstEigenvector.reduce((s, val) => s + Math.abs(val), 0);

    const marginalContributions = strategies.map((strategy, i) => {
      const concentrationScore =
        sumAbsLoadings > 0 ? Math.abs(firstEigenvector[i]) / sumAbsLoadings : 1 / n;

      let sumJointRisk = 0;
      let validPairs = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const valIJ = jointTailRiskMatrix[i][j];
          const valJI = jointTailRiskMatrix[j][i];
          if (!Number.isNaN(valIJ) && !Number.isNaN(valJI)) {
            sumJointRisk += (valIJ + valJI) / 2;
            validPairs++;
          }
        }
      }
      const avgTailDependence = validPairs > 0 ? sumJointRisk / validPairs : 0;
      const tailRiskContribution = (concentrationScore * 0.5 + avgTailDependence * 0.5) * 100;

      return {
        strategy,
        tailRiskContribution,
        concentrationScore,
        avgTailDependence,
      };
    });

    marginalContributions.sort((a, b) => b.tailRiskContribution - a.tailRiskContribution);

    return {
      strategies,
      tradingDaysUsed: sortedDates.length,
      dateRange: {
        start: new Date(sortedDates[0]),
        end: new Date(sortedDates[sortedDates.length - 1]),
      },
      tailThreshold,
      varianceThreshold,
      copulaCorrelationMatrix,
      jointTailRiskMatrix,
      insufficientDataPairs,
      eigenvalues,
      eigenvectors,
      explainedVariance,
      effectiveFactors,
      analytics,
      marginalContributions,
      computedAt: new Date(),
      computationTimeMs: performance.now() - startTime,
    };
  }, [blockReturns, tailThreshold]);

  const handleTailThresholdChange = useCallback((value: number[]) => {
    setTailThreshold(value[0]);
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tail Risk Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tailRiskResult || blockReturns.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tail Risk Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Select at least 2 blocks to see tail risk analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="border-l-4 border-l-amber-500 dark:border-l-amber-400">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">What is Joint Tail Risk?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Unlike regular correlation which measures average co-movement, joint tail risk
                captures how likely blocks are to have extreme losses together. A value of 70%
                means when Block A has a bad day (bottom {(tailThreshold * 100).toFixed(0)}%),
                there&apos;s a 70% chance Block B is also having a bad day.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <div className="flex items-center gap-4">
        <Label className="text-xs whitespace-nowrap">
          Tail Percentile: {(tailThreshold * 100).toFixed(0)}%
        </Label>
        <Slider
          value={[tailThreshold]}
          onValueChange={handleTailThresholdChange}
          min={0.05}
          max={0.25}
          step={0.01}
          className="w-48"
        />
        <p className="text-xs text-muted-foreground">
          (worst {(tailThreshold * 100).toFixed(0)}% of days)
        </p>
      </div>

      {/* Summary Cards */}
      <TailRiskSummaryCards result={tailRiskResult} />

      {/* Joint Tail Risk Heatmap */}
      <TailDependenceHeatmap result={tailRiskResult} />
    </div>
  );
}

export default TailRiskTab;
