"use client";

import { NoActiveBlock } from "@/components/no-active-block";
import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  calculateCorrelationAnalytics,
  calculateCorrelationMatrix,
  CorrelationAlignment,
  CorrelationDateBasis,
  CorrelationMethod,
  CorrelationMatrix,
  CorrelationNormalization,
} from "@/lib/calculations/correlation";
import { getBlock, getTradesByBlockWithOptions } from "@/lib/db";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";
import {
  downloadCsv,
  downloadJson,
  generateExportFilename,
  toCsvRow,
} from "@/lib/utils/export-helpers";
import { cn } from "@/lib/utils";
import { Download, HelpCircle, Info } from "lucide-react";
import { useTheme } from "next-themes";
import type { Data, Layout, PlotData } from "plotly.js";
import { useCallback, useEffect, useMemo, useState } from "react";

const formatCompactUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

type ComboSize = 2 | 3 | 4;
type ComboSortKey = "corr" | "triggers" | "winRate" | "netPL";
type ComboSortDir = "asc" | "desc";
type SizingMode = "actual" | "oneLot" | "kelly" | "halfKelly";

export default function CorrelationMatrixPage() {
  const { theme } = useTheme();
  const activeBlockId = useBlockStore(
    (state) => state.blocks.find((b) => b.isActive)?.id
  );
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<CorrelationMethod>("kendall");
  const [alignment, setAlignment] = useState<CorrelationAlignment>("shared");
  const [normalization, setNormalization] =
    useState<CorrelationNormalization>("raw");
  const [dateBasis, setDateBasis] = useState<CorrelationDateBasis>("opened");
  const isDark = theme === "dark";
  const [minTriggers, setMinTriggers] = useState<number>(5);
  const [comboSize, setComboSize] = useState<ComboSize>(2);
  const [comboSortKey, setComboSortKey] = useState<ComboSortKey>("netPL");
  const [comboSortDir, setComboSortDir] = useState<ComboSortDir>("desc");
  const [sizingMode, setSizingMode] = useState<SizingMode>("actual");

  const normalizeReturnLocal = useCallback(
    (trade: Trade, mode: CorrelationNormalization) => {
      const sizedPL = (() => {
        const lots = Math.max(1, Math.abs(trade.numContracts ?? 1));
        if (sizingMode === "oneLot") {
          return trade.pl / lots;
        }
        if (sizingMode === "halfKelly") {
          return trade.pl * 0.5;
        }
        // "actual" and "kelly" both use recorded P/L; Kelly scaling would be handled upstream if present.
        return trade.pl;
      })();

      switch (mode) {
        case "margin":
          if (!trade.marginReq) return null;
          return sizedPL / trade.marginReq;
        case "notional": {
          const notional = Math.abs((trade.openingPrice || 0) * (trade.numContracts || 0));
          if (!notional) return null;
          return sizedPL / notional;
        }
        default:
          return sizedPL;
      }
    },
    [sizingMode]
  );

  const getTradeDateKeyLocal = (trade: Trade, basis: CorrelationDateBasis): string | null => {
    const date = basis === "closed" ? trade.dateClosed : trade.dateOpened;
    if (!date) return null;
    return date.toISOString().split("T")[0];
  };

  const kCombinations = <T,>(items: T[], k: number): T[][] => {
    const result: T[][] = [];
    const n = items.length;
    const combo: T[] = [];
    const backtrack = (start: number) => {
      if (combo.length === k) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < n; i++) {
        combo.push(items[i]);
        backtrack(i + 1);
        combo.pop();
      }
    };
    if (k <= n) backtrack(0);
    return result;
  };

  const analyticsContext = useMemo(
    () =>
      formatAnalyticsContext({
        method,
        alignment,
        normalization,
        dateBasis,
      }),
    [method, alignment, normalization, dateBasis]
  );

  useEffect(() => {
    async function loadTrades() {
      if (!activeBlockId) {
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

  const { correlationMatrix, analytics } = useMemo(() => {
    if (trades.length === 0) {
      return { correlationMatrix: null, analytics: null };
    }

    const matrix = calculateCorrelationMatrix(trades, {
      method,
      alignment,
      normalization,
      dateBasis,
    });
    const stats = calculateCorrelationAnalytics(matrix);

    return { correlationMatrix: matrix, analytics: stats };
  }, [trades, method, alignment, normalization, dateBasis]);

  const comboStats = useMemo(() => {
    if (!correlationMatrix) return [];
    const { strategies, pairStats } = correlationMatrix;
    const rows: {
      pair: string;
      triggered: number;
      wins: number;
      losses: number;
      winRate: number;
      netPL: number;
    }[] = [];

    for (let i = 0; i < strategies.length; i++) {
      for (let j = i + 1; j < strategies.length; j++) {
        const stats = pairStats?.[i]?.[j];
        if (!stats) continue;
        rows.push({
          pair: `${strategies[i]} ↔ ${strategies[j]}`,
          triggered: stats.triggered,
          wins: stats.wins,
          losses: stats.losses,
          winRate: stats.winRate,
          netPL: stats.netPL,
        });
      }
    }

    return rows.sort((a, b) => b.triggered - a.triggered);
  }, [correlationMatrix]);

  const { plotData, layout } = useMemo(() => {
    if (!correlationMatrix) {
      return { plotData: [], layout: {} };
    }

    const { strategies, correlationData, pairStats } = correlationMatrix;
    const correlationColorscale: PlotData["colorscale"] = [
      [0.0, "rgb(30, 64, 175)"], // blue-800
      [0.25, "rgb(59, 130, 246)"], // blue-500
      [0.5, "rgb(15, 23, 42)"], // slate-950 (near zero)
      [0.75, "rgb(244, 114, 182)"], // rose-400
      [1.0, "rgb(159, 18, 57)"], // rose-800
    ];

    const heatmapTextMatrix = correlationData.map((row) =>
      row.map((val) => val.toFixed(2))
    );

    const heatmapData: Partial<PlotData> = {
      z: correlationData,
      x: strategies,
      y: strategies,
      type: "heatmap" as const,
      colorscale: correlationColorscale,
      zmin: -1,
      zmax: 1,
      text: heatmapTextMatrix as unknown as string[],
      texttemplate: "%{text}",
      textfont: {
        size: 10,
        color: "#e5e7eb", // zinc-200
      },
      customdata: correlationData.map((row, yIndex) =>
        row.map((_, xIndex) => {
          const stats = pairStats?.[yIndex]?.[xIndex];
          return [
            strategies[yIndex],
            strategies[xIndex],
            stats?.triggered ?? 0,
            stats?.wins ?? 0,
            stats?.losses ?? 0,
            stats?.winRate ?? 0,
            stats?.netPL ?? 0,
          ];
        })
      ) as unknown as PlotData["customdata"],
      hovertemplate:
        "<b>%{customdata[0]} ↔ %{customdata[1]}</b><br>" +
        "Corr: %{z:.3f}<br>" +
        "Triggers: %{customdata[2]:.0f}<br>" +
        "Wins / Losses: %{customdata[3]:.0f} / %{customdata[4]:.0f}<br>" +
        "Win%: %{customdata[5]:.1f}%<br>" +
        "Net P/L: %{customdata[6]:,.0f}<extra></extra>",
      colorbar: {
        title: { text: "Correlation", side: "right" },
        tickmode: "linear",
        tick0: -1,
        dtick: 0.5,
      },
    };

    const heatmapLayout: Partial<Layout> = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      xaxis: {
        side: "bottom",
        tickangle: 45,
        tickmode: "linear",
        automargin: true,
        showgrid: false,
        zeroline: false,
        tickfont: { size: 10, color: "#9ca3af" },
      },
      yaxis: {
        autorange: "reversed",
        tickmode: "linear",
        automargin: true,
        showgrid: false,
        zeroline: false,
        tickfont: { size: 10, color: "#9ca3af" },
      },
      margin: {
        l: 150,
        r: 20,
        t: 20,
        b: 160,
      },
    };

    return { plotData: [heatmapData as unknown as Data], layout: heatmapLayout };
  }, [correlationMatrix]);

  const activeBlock = useBlockStore(
    (state) => state.blocks.find((block) => block.id === activeBlockId)
  );

  const comboPairs = useMemo(() => {
    if (!correlationMatrix) return [];
    const { strategies, correlationData } = correlationMatrix;

    const dailyMap: Record<string, Record<string, number>> = {};
    trades.forEach((trade) => {
      if (!trade.strategy || trade.strategy.trim() === "") return;
      const dateKey = getTradeDateKeyLocal(trade, dateBasis);
      if (!dateKey) return;
      const pl = normalizeReturnLocal(trade, normalization);
      if (pl === null) return;
      if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
      dailyMap[dateKey][trade.strategy] = (dailyMap[dateKey][trade.strategy] ?? 0) + pl;
    });

    const comboMap = new Map<
      string,
      {
        strategies: string[];
        triggers: number;
        wins: number;
        losses: number;
        netPL: number;
        corrAvg: number;
      }
    >();

    for (const [, plByStrategy] of Object.entries(dailyMap)) {
      const active = Object.entries(plByStrategy)
        .filter(([, pl]) => pl !== 0 && !Number.isNaN(pl))
        .map(([name]) => name);

      if (active.length < comboSize) continue;

      const combos = kCombinations(active, comboSize);
      for (const combo of combos) {
        const sorted = [...combo].sort();
        const key = sorted.join(" | ");
        const dayPL = sorted.reduce((sum, strat) => sum + (plByStrategy[strat] ?? 0), 0);

        let stats = comboMap.get(key);
        if (!stats) {
          let corrSum = 0;
          let corrCount = 0;
          for (let i = 0; i < sorted.length; i++) {
            for (let j = i + 1; j < sorted.length; j++) {
              const si = strategies.indexOf(sorted[i]);
              const sj = strategies.indexOf(sorted[j]);
              const c = si >= 0 && sj >= 0 ? Math.abs(correlationData[si]?.[sj] ?? 0) : 0;
              corrSum += c;
              corrCount += 1;
            }
          }
          const corrAvg = corrCount > 0 ? corrSum / corrCount : 0;
          stats = {
            strategies: sorted,
            triggers: 0,
            wins: 0,
            losses: 0,
            netPL: 0,
            corrAvg,
          };
          comboMap.set(key, stats);
        }

        stats.triggers += 1;
        stats.netPL += dayPL;
        if (dayPL > 0) stats.wins += 1;
        else if (dayPL < 0) stats.losses += 1;
      }
    }

    const pairs = Array.from(comboMap.values())
      .map((c) => ({
        strategies: c.strategies,
        correlation: c.corrAvg,
        triggers: c.triggers,
        wins: c.wins,
        losses: c.losses,
        winRate: c.triggers > 0 ? c.wins / c.triggers : 0,
        netPL: c.netPL,
      }))
      .filter((c) => c.triggers >= minTriggers);

    pairs.sort((p1, p2) => {
      const dir = comboSortDir === "asc" ? 1 : -1;
      switch (comboSortKey) {
        case "corr":
          return dir * (Math.abs(p1.correlation) - Math.abs(p2.correlation));
        case "triggers":
          return dir * (p1.triggers - p2.triggers);
        case "winRate":
          return dir * (p1.winRate - p2.winRate);
        case "netPL":
        default:
          return dir * (p1.netPL - p2.netPL);
      }
    });

    return pairs;
  }, [
    correlationMatrix,
    trades,
    dateBasis,
    normalization,
    comboSize,
    minTriggers,
    comboSortKey,
    comboSortDir,
    normalizeReturnLocal,
  ]);

  const handleComboSortClick = (key: ComboSortKey) => {
    setComboSortKey((prevKey) => {
      if (prevKey === key) {
        setComboSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setComboSortDir("desc");
      return key;
    });
  };

  const handleDownloadCsv = useCallback(() => {
    if (!correlationMatrix || !activeBlock) {
      return;
    }

    const lines = buildCorrelationCsvLines(correlationMatrix, {
      blockName: activeBlock.name,
      method,
      alignment,
      normalization,
      dateBasis,
    });

    downloadCsv(
      lines,
      generateExportFilename(activeBlock.name, "correlation", "csv")
    );
  }, [correlationMatrix, method, alignment, normalization, dateBasis, activeBlock]);

  const handleDownloadJson = useCallback(() => {
    if (!correlationMatrix || !activeBlock) {
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      block: {
        id: activeBlock.id,
        name: activeBlock.name,
      },
      settings: {
        method,
        alignment,
        normalization,
        dateBasis,
      },
      strategies: correlationMatrix.strategies,
      correlationMatrix: correlationMatrix.correlationData,
      analytics: analytics
        ? {
            strongest: analytics.strongest,
            weakest: analytics.weakest,
            averageCorrelation: analytics.averageCorrelation,
            strategyCount: analytics.strategyCount,
          }
        : null,
    };

    downloadJson(
      exportData,
      generateExportFilename(activeBlock.name, "correlation", "json")
    );
  }, [correlationMatrix, analytics, method, alignment, normalization, dateBasis, activeBlock]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading correlation data...</div>
      </div>
    );
  }

  if (!activeBlockId) {
    return (
      <NoActiveBlock description="Please select a block from the sidebar to view strategy correlations." />
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">
          No trades available for correlation analysis
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold">What does this show?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This heatmap shows how your trading strategies move together. High positive correlation (+1.0) means strategies
                move in the same direction, while negative correlation (-1.0) means they move opposite. Low correlation (~0)
                indicates good diversification.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-medium">PEARSON</Badge>
                  <span className="text-muted-foreground">Linear relationships</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400 font-medium">
                    KENDALL/SPEARMAN
                  </Badge>
                  <span className="text-muted-foreground">Rank-based (handles outliers better)</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calculation Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Method */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="method-select">Method</Label>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80 p-0 overflow-hidden">
                    <div className="space-y-3">
                      <div className="bg-primary/5 border-b px-4 py-3">
                        <h4 className="text-sm font-semibold text-primary">Correlation Method</h4>
                      </div>
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-sm font-medium text-foreground leading-relaxed">
                          Choose how to measure strategy relationships
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong>Kendall (recommended):</strong> Rank-based, robust to outliers. Best for options strategies with non-linear payoffs.<br/>
                          <strong>Spearman:</strong> Another rank-based method, similar to Kendall but faster for large datasets.<br/>
                          <strong>Pearson:</strong> Measures linear relationships. Best for normally distributed returns.
                        </p>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              <Select
                value={method}
                onValueChange={(value) =>
                  setMethod(value as "pearson" | "spearman" | "kendall")
                }
              >
                <SelectTrigger id="method-select">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kendall">Kendall (Rank)</SelectItem>
                  <SelectItem value="spearman">Spearman (Rank)</SelectItem>
                  <SelectItem value="pearson">Pearson (Linear)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {method === "pearson" && "Linear correlation"}
                {method === "kendall" && "Rank-based, outlier-resistant"}
                {method === "spearman" && "Rank-based, fast"}
              </p>
            </div>

            {/* Alignment */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="alignment-select">Alignment</Label>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80 p-0 overflow-hidden">
                    <div className="space-y-3">
                      <div className="bg-primary/5 border-b px-4 py-3">
                        <h4 className="text-sm font-semibold text-primary">Date Alignment</h4>
                      </div>
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-sm font-medium text-foreground leading-relaxed">
                          How to handle days when strategies don&apos;t trade
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong>Shared days (recommended):</strong> Only correlates on days where both strategies traded. Avoids artificial zeros.<br/>
                          <strong>Zero-fill:</strong> Treats non-trading days as $0 P/L. Can distort correlation for strategies that trade different frequencies.
                        </p>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              <Select
                value={alignment}
                onValueChange={(value) =>
                  setAlignment(value as CorrelationAlignment)
                }
              >
                <SelectTrigger id="alignment-select">
                  <SelectValue placeholder="Alignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Shared days</SelectItem>
                  <SelectItem value="zero-pad">Zero-fill</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {alignment === "shared" && "Only common trading days"}
                {alignment === "zero-pad" && "Fill missing days with $0"}
              </p>
            </div>

            {/* Return basis */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="return-basis-select">Return Basis</Label>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80 p-0 overflow-hidden">
                    <div className="space-y-3">
                      <div className="bg-primary/5 border-b px-4 py-3">
                        <h4 className="text-sm font-semibold text-primary">Return Normalization</h4>
                      </div>
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-sm font-medium text-foreground leading-relaxed">
                          How to scale returns for comparison
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong>Raw P/L:</strong> Absolute dollar returns (default).<br/>
                          <strong>Margin-normalized:</strong> Returns divided by margin requirement. Better for comparing strategies with different capital requirements.<br/>
                          <strong>1-lot normalized:</strong> Per-contract basis. Divides P/L by trade size (price × contracts) to show returns as if each trade was 1 lot.
                        </p>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              <Select
                value={normalization}
                onValueChange={(value) =>
                  setNormalization(value as CorrelationNormalization)
                }
              >
                <SelectTrigger id="return-basis-select">
                  <SelectValue placeholder="Return basis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">Raw P/L</SelectItem>
                  <SelectItem value="margin">Margin-normalized</SelectItem>
                  <SelectItem value="notional">1-lot normalized</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {normalization === "raw" && "Absolute dollar amounts"}
                {normalization === "margin" && "P/L ÷ Margin required"}
                {normalization === "notional" && "Per-contract returns"}
              </p>
            </div>

            {/* Date basis */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="date-basis-select">Date Basis</Label>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80 p-0 overflow-hidden">
                    <div className="space-y-3">
                      <div className="bg-primary/5 border-b px-4 py-3">
                        <h4 className="text-sm font-semibold text-primary">Date Basis</h4>
                      </div>
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-sm font-medium text-foreground leading-relaxed">
                          Which date to use for grouping trades
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong>Opened date (recommended):</strong> Groups by when trades were entered. Shows entry timing correlation.<br/>
                          <strong>Closed date:</strong> Groups by when trades were closed. Shows exit timing and P/L realization correlation.
                        </p>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              <Select
                value={dateBasis}
                onValueChange={(value) =>
                  setDateBasis(value as CorrelationDateBasis)
                }
              >
                <SelectTrigger id="date-basis-select">
                  <SelectValue placeholder="Date basis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opened">Opened date</SelectItem>
                  <SelectItem value="closed">Closed date</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {dateBasis === "opened" && "Group by entry date"}
                {dateBasis === "closed" && "Group by exit date"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <div className="mt-2 w-full overflow-x-auto">
        <div className="min-w-[900px]">
          <ChartWrapper
            title="Correlation Heatmap"
            description="Visual representation of strategy correlations"
            tooltip={{
              flavor: "Measures how your trading strategies move together over time.",
              detailed:
                "Warm colors indicate positive correlation (strategies tend to win/lose together), cool colors indicate negative correlation (strategies move opposite), and neutral indicates no correlation. Use this to identify diversification opportunities and understand portfolio risk.",
            }}
            data={plotData}
            layout={layout}
            style={{ height: "600px" }}
            actions={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCsv}
                  disabled={!correlationMatrix}
                >
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadJson}
                  disabled={!correlationMatrix}
                >
                  <Download className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            }
          />
        </div>
      </div>

{/* Quick Analysis */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">
                  Strongest:
                </div>
                <div className="text-2xl font-bold" style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>
                  {analytics.strongest.value.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {analytics.strongest.pair[0]} ↔ {analytics.strongest.pair[1]}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">
                  Weakest:
                </div>
                <div className="text-2xl font-bold" style={{ color: isDark ? '#93c5fd' : '#2563eb' }}>
                  {analytics.weakest.value.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {analytics.weakest.pair[0]} ↔ {analytics.weakest.pair[1]}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                  <span>Average</span>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground/70" />
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80 p-0 overflow-hidden">
                      <div className="space-y-3">
                        <div className="bg-primary/5 border-b px-4 py-3">
                          <h4 className="text-sm font-semibold text-primary">Average Correlation</h4>
                        </div>
                        <div className="px-4 pb-4 space-y-3">
                          <p className="text-sm font-medium text-foreground leading-relaxed">
                            Signed mean of all off-diagonal correlations
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Positive values indicate strategies tend to move together on average. Negative values suggest strategies tend to offset each other. Values near zero indicate diverse, uncorrelated strategies.
                          </p>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
                <div className="text-2xl font-bold">
                  {analytics.averageCorrelation.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {analytics.strategyCount} strategies · {analyticsContext}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-Correlation Combos */}
      {(comboPairs.length > 0 || comboStats.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Multi-Correlation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {comboPairs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Multi-Correlation Combos</h3>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-muted/60"
                    title="Each row is a strategy combo. A trigger is a day when all members traded together; Net P/L uses the current sizing mode."
                  >
                    ?
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Min combo triggers</span>
                    <input
                      type="number"
                      min={1}
                      className="w-20 rounded-md border bg-background px-2 py-1 text-xs"
                      value={minTriggers}
                      onChange={(e) => {
                        const raw = Number(e.target.value || 0);
                        setMinTriggers(raw > 0 ? raw : 1);
                      }}
                    />
                    <button
                      type="button"
                      className="flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/40 text-[10px] text-muted-foreground hover:bg-muted/40"
                      title="Combos = days when all strategies in the combo traded. Stats reflect those overlapping days only."
                    >
                      ?
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Combo size</span>
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                      value={comboSize}
                      onChange={(e) => setComboSize(Number(e.target.value) as ComboSize)}
                    >
                      <option value={2}>2-way</option>
                      <option value={3}>3-way</option>
                      <option value={4}>4-way</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Sizing</span>
                    <div className="inline-flex gap-1 rounded-lg border border-border/60 bg-background px-1 py-0.5">
                      {[
                        { id: "actual", label: "Actual" },
                        { id: "oneLot", label: "1-lot" },
                        { id: "kelly", label: "Kelly" },
                        { id: "halfKelly", label: "1/2 Kelly" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px]",
                            sizingMode === opt.id
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted/40"
                          )}
                          onClick={() => setSizingMode(opt.id as SizingMode)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Sort by</span>
                    <Select
                      value={comboSortKey}
                      onValueChange={(v) => setComboSortKey(v as ComboSortKey)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="netPL">Net P/L</SelectItem>
                        <SelectItem value="winRate">Win %</SelectItem>
                        <SelectItem value="triggers">Triggers</SelectItem>
                        <SelectItem value="corr">|Correlation|</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Showing <span className="font-semibold">{comboPairs.length}</span> combos matching filters
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border/60 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-2 text-left">Combo (size {comboSize})</th>
                        <th
                          className="cursor-pointer px-2 py-1 text-right hover:text-foreground"
                          onClick={() => handleComboSortClick("corr")}
                        >
                          Corr
                          {comboSortKey === "corr" && (comboSortDir === "asc" ? " ↑" : " ↓")}
                        </th>
                        <th
                          className="cursor-pointer px-2 py-1 text-right hover:text-foreground"
                          onClick={() => handleComboSortClick("triggers")}
                        >
                          Triggers
                          {comboSortKey === "triggers" && (comboSortDir === "asc" ? " ↑" : " ↓")}
                        </th>
                        <th
                          className="cursor-pointer px-2 py-1 text-right hover:text-foreground"
                          onClick={() => handleComboSortClick("winRate")}
                        >
                          Wins/Losses
                          {comboSortKey === "winRate" && (comboSortDir === "asc" ? " ↑" : " ↓")}
                        </th>
                        <th
                          className="cursor-pointer px-2 py-1 text-right hover:text-foreground"
                          onClick={() => handleComboSortClick("winRate")}
                        >
                          Win%
                          {comboSortKey === "winRate" && (comboSortDir === "asc" ? " ↑" : " ↓")}
                        </th>
                        <th
                          className="cursor-pointer px-2 py-1 text-right hover:text-foreground"
                          onClick={() => handleComboSortClick("netPL")}
                        >
                          Net P/L
                          {comboSortKey === "netPL" && (comboSortDir === "asc" ? " ↑" : " ↓")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comboPairs.slice(0, 50).map((p, idx) => (
                        <tr key={`${p.strategies.join("|")}-${idx}`} className={idx % 2 === 0 ? "bg-background/40" : ""}>
                          <td className="py-1 pr-2">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {p.strategies.join(" • ")}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-1 text-right">{p.correlation.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right">{p.triggers}</td>
                          <td className="px-2 py-1 text-right">
                            {p.wins}/{p.losses}
                          </td>
                          <td className="px-2 py-1 text-right">{(p.winRate * 100).toFixed(1)}%</td>
                          <td
                            className={cn(
                              "px-2 py-1 text-right font-semibold",
                              p.netPL >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}
                          >
                            {formatCompactUsd(p.netPL)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {comboStats.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Combo stats (co-trading days)
                </div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="px-2 py-1">Pair</th>
                        <th className="px-2 py-1 text-right">Triggered</th>
                        <th className="px-2 py-1 text-right">Wins</th>
                        <th className="px-2 py-1 text-right">Losses</th>
                        <th className="px-2 py-1 text-right">Win %</th>
                        <th className="px-2 py-1 text-right">Net P/L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comboStats.slice(0, 30).map((row) => (
                        <tr key={row.pair} className="border-t border-border/40">
                          <td className="px-2 py-1">{row.pair}</td>
                          <td className="px-2 py-1 text-right font-mono text-xs">{row.triggered}</td>
                          <td className="px-2 py-1 text-right font-mono text-xs text-emerald-500">
                            {row.wins}
                          </td>
                          <td className="px-2 py-1 text-right font-mono text-xs text-rose-500">
                            {row.losses}
                          </td>
                          <td className="px-2 py-1 text-right font-mono text-xs">
                            {row.winRate.toFixed(1)}%
                          </td>
                          <td className="px-2 py-1 text-right font-mono text-xs">
                            {formatCompactUsd(row.netPL)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface CsvMeta {
  blockName: string;
  method: string;
  alignment: string;
  normalization: string;
  dateBasis: string;
}

function buildCorrelationCsvLines(
  matrix: CorrelationMatrix,
  meta: CsvMeta
): string[] {
  const lines: string[] = [];

  lines.push(toCsvRow(["Generated At", new Date().toISOString()]));
  lines.push(toCsvRow(["Block", meta.blockName]));
  lines.push(toCsvRow(["Method", meta.method]));
  lines.push(toCsvRow(["Alignment", meta.alignment]));
  lines.push(toCsvRow(["Return Basis", meta.normalization]));
  lines.push(toCsvRow(["Date Basis", meta.dateBasis]));
  lines.push(toCsvRow(["Strategy Count", matrix.strategies.length]));

  lines.push("");

  lines.push(toCsvRow(["Strategy", ...matrix.strategies]));
  matrix.correlationData.forEach((row, index) => {
    lines.push(
      toCsvRow([
        matrix.strategies[index],
        ...row.map((value) => value.toFixed(6)),
      ])
    );
  });

  return lines;
}

interface AnalyticsContextArgs {
  method: CorrelationMethod;
  alignment: CorrelationAlignment;
  normalization: CorrelationNormalization;
  dateBasis: CorrelationDateBasis;
}

function formatAnalyticsContext({
  method,
  alignment,
  normalization,
  dateBasis,
}: AnalyticsContextArgs): string {
  const methodLabel =
    method === "pearson"
      ? "Pearson"
      : method === "spearman"
      ? "Spearman"
      : "Kendall";

  const alignmentLabel = alignment === "shared" ? "Shared days" : "Zero-filled";

  const normalizationLabel =
    normalization === "raw"
      ? "Raw P/L"
      : normalization === "margin"
      ? "Margin-normalized"
      : "1-lot normalized";

  const dateLabel = dateBasis === "opened" ? "Opened dates" : "Closed dates";

  return [methodLabel, alignmentLabel, normalizationLabel, dateLabel].join(", ");
}
