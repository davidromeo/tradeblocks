"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Info } from "lucide-react";

import MultiCorrelationPanel from "@/components/multi-correlation/MultiCorrelationPanel";
import { NoActiveBlock } from "@/components/no-active-block";
import { WorkspaceShell } from "@/components/workspace-shell";
import { StrategySeries, analyzeMultiCorrelation } from "@/lib/analytics/multi-correlation";
import { getBlock, getTradesByBlockWithOptions } from "@/lib/db";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";
import {
  downloadCsv,
  downloadJson,
  generateExportFilename,
} from "@/lib/utils/export-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const buildSeries = (trades: Trade[]): StrategySeries[] => {
  const byStrategy = new Map<
    string,
    {
      totals: Map<string, { pl: number; margin: number }>;
    }
  >();

  trades.forEach((t) => {
    const strategy = t.strategy || "Unknown";
    const dateKey = format(t.dateOpened, "yyyy-MM-dd");
    if (!byStrategy.has(strategy)) {
      byStrategy.set(strategy, { totals: new Map() });
    }
    const entry = byStrategy.get(strategy)!;
    const prev = entry.totals.get(dateKey) ?? { pl: 0, margin: 0 };
    entry.totals.set(dateKey, {
      pl: prev.pl + t.pl,
      margin: prev.margin + (t.marginReq ?? 0),
    });
  });

  const strategyKeys = Array.from(byStrategy.keys());
  const defaultWeight = strategyKeys.length > 0 ? 100 / strategyKeys.length : 0;

  return strategyKeys.map((key) => {
    const totals = byStrategy.get(key)!.totals;
    const points = Array.from(totals.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        pl: v.pl,
        margin: v.margin,
      }));

    return {
      id: key,
      name: key,
      weightPct: defaultWeight,
      points,
    };
  });
};

export default function MultiCorrelationPage() {
  const activeBlockId = useBlockStore(
    (state) => state.blocks.find((b) => b.isActive)?.id
  );
  const activeBlock = useBlockStore((state) =>
    state.blocks.find((b) => b.isActive)
  );
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrades() {
      if (!activeBlockId) {
        setTrades([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const processedBlock = await getBlock(activeBlockId);
        const combineLegGroups =
          processedBlock?.analysisConfig?.combineLegGroups ?? false;
        const loadedTrades = await getTradesByBlockWithOptions(activeBlockId, {
          combineLegGroups,
        });
        setTrades(loadedTrades);
      } catch (error) {
        console.error("Failed to load trades:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTrades();
  }, [activeBlockId]);

  const series = useMemo(() => buildSeries(trades), [trades]);
  const latestAnalysis = useMemo(
    () => analyzeMultiCorrelation(series, { method: "pearson", clusterThreshold: 0.4 }),
    [series]
  );

  const handleExportCsv = useCallback(() => {
    if (!activeBlock || series.length === 0) return;
    const lines: string[] = [];
    const { strategies, correlationMatrix, clusterExposures } = latestAnalysis;

    // Correlation matrix section
    lines.push(["Strategy", ...strategies].join(","));
    strategies.forEach((row, i) => {
      const rowVals = strategies.map((_, j) => correlationMatrix[i][j]?.toFixed(4) ?? "0");
      lines.push([row, ...rowVals].join(","));
    });

    // Cluster exposures section
    lines.push("");
    lines.push("Cluster,Strategies,TotalWeightPct,MeanCorrelation");
    clusterExposures.forEach((c) => {
      lines.push(
        [
          c.clusterId,
          c.strategyIds.join("; "),
          c.totalWeightPct.toFixed(2),
          c.meanCorrelation.toFixed(4),
        ].join(",")
      );
    });

    downloadCsv(
      lines,
      generateExportFilename(activeBlock.name, "multi-correlation", "csv")
    );
  }, [activeBlock, series, latestAnalysis]);

  const handleExportJson = useCallback(() => {
    if (!activeBlock || series.length === 0) return;
    const exportData = {
      exportedAt: new Date().toISOString(),
      block: {
        id: activeBlock.id,
        name: activeBlock.name,
      },
      settings: {
        method: "pearson",
        clusterThreshold: 0.4,
      },
      series: series.map((s) => ({
        id: s.id,
        name: s.name,
        weightPct: s.weightPct,
        pointCount: s.points.length,
      })),
      result: latestAnalysis,
    };

    downloadJson(
      exportData,
      generateExportFilename(activeBlock.name, "multi-correlation", "json")
    );
  }, [activeBlock, series, latestAnalysis]);

  if (!activeBlockId) {
    return <NoActiveBlock />;
  }

  return (
    <WorkspaceShell
      title="Multi-Correlation"
      label="New"
      description="Analyze correlation clusters, exposures, and diversification across strategies."
    >
      {loading ? (
        <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Loading trades...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Info className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold">What does this show?</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      This heatmap shows how your trading strategies move together. High positive correlation
                      (+1.0) means strategies move in the same direction, while negative correlation (-1.0)
                      means they move opposite. Low correlation (~0) indicates good diversification.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-medium">
                          PEARSON
                        </Badge>
                        <span className="text-muted-foreground">Linear relationships</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-orange-500 bg-orange-500/10 font-medium text-orange-700 dark:text-orange-400"
                        >
                          KENDALL/SPEARMAN
                        </Badge>
                        <span className="text-muted-foreground">Rank-based; handles outliers better</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportJson}>
                    <Download className="mr-2 h-4 w-4" />
                    Export JSON
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <MultiCorrelationPanel series={series} />
        </div>
      )}
    </WorkspaceShell>
  );
}
