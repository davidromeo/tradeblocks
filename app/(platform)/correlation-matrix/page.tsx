"use client";

import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/lib/calculations/correlation";
import { getTradesByBlock } from "@/lib/db/trades-store";
import { Trade } from "@/lib/models/trade";
import { useBlockStore } from "@/lib/stores/block-store";
import { Info } from "lucide-react";
import { useTheme } from "next-themes";
import type { Data, Layout } from "plotly.js";
import { useEffect, useMemo, useState } from "react";

export default function CorrelationMatrixPage() {
  const { theme } = useTheme();
  const activeBlockId = useBlockStore(
    (state) => state.blocks.find((b) => b.isActive)?.id
  );
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<"pearson" | "spearman" | "kendall">(
    "pearson"
  );

  useEffect(() => {
    async function loadTrades() {
      if (!activeBlockId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const loadedTrades = await getTradesByBlock(activeBlockId);
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

    const matrix = calculateCorrelationMatrix(trades, method);
    const stats = calculateCorrelationAnalytics(matrix);

    return { correlationMatrix: matrix, analytics: stats };
  }, [trades, method]);

  const { plotData, layout } = useMemo(() => {
    if (!correlationMatrix) {
      return { plotData: [], layout: {} };
    }

    const { strategies, correlationData } = correlationMatrix;
    const isDark = theme === "dark";

    // Create heatmap with better contrast
    // Different colorscales for light and dark modes
    const colorscale = isDark
      ? [
          // Dark mode: Brighter, more vibrant colors
          [0, "#1e40af"], // Bright blue for -1
          [0.25, "#3b82f6"], // Medium bright blue for -0.5
          [0.45, "#93c5fd"], // Light blue approaching 0
          [0.5, "#334155"], // Neutral gray for 0
          [0.55, "#fca5a5"], // Light red leaving 0
          [0.75, "#ef4444"], // Medium bright red for 0.5
          [1, "#991b1b"], // Strong red for 1
        ]
      : [
          // Light mode: Darker, more saturated colors
          [0, "#053061"], // Strong dark blue for -1
          [0.25, "#2166ac"], // Medium blue for -0.5
          [0.45, "#d1e5f0"], // Light blue approaching 0
          [0.5, "#f7f7f7"], // White/light gray for 0
          [0.55, "#fddbc7"], // Light red leaving 0
          [0.75, "#d6604d"], // Medium red for 0.5
          [1, "#67001f"], // Strong dark red for 1
        ];

    const heatmapData = {
      z: correlationData,
      x: strategies,
      y: strategies,
      type: "heatmap" as const,
      colorscale,
      zmid: 0,
      zmin: -1,
      zmax: 1,
      text: correlationData.map((row) => row.map((val) => val.toFixed(2))) as unknown as string,
      texttemplate: "%{text}",
      textfont: {
        size: 10,
        color: correlationData.map((row) =>
          row.map((val) => {
            // Dynamic text color based on value and theme
            const absVal = Math.abs(val);
            if (isDark) {
              // In dark mode, use lighter text for strong correlations
              return absVal > 0.5 ? "#ffffff" : "#e2e8f0";
            } else {
              // In light mode, use white for strong, black for weak
              return absVal > 0.5 ? "#ffffff" : "#000000";
            }
          })
        ) as unknown as string,
      },
      hovertemplate:
        "<b>%{y} ↔ %{x}</b><br>Correlation: %{z:.3f}<extra></extra>",
      colorbar: {
        title: { text: "Correlation", side: "right" },
        tickmode: "linear",
        tick0: -1,
        dtick: 0.5,
      },
    };

    const heatmapLayout: Partial<Layout> = {
      xaxis: {
        side: "bottom",
        tickangle: -45,
        tickmode: "linear",
        automargin: true,
      },
      yaxis: {
        autorange: "reversed",
        tickmode: "linear",
        automargin: true,
      },
      margin: {
        l: 200,
        r: 100,
        t: 40,
        b: 200,
      },
    };

    return { plotData: [heatmapData as unknown as Data], layout: heatmapLayout };
  }, [correlationMatrix, theme]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading correlation data...</div>
      </div>
    );
  }

  if (!activeBlockId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No active block selected</p>
          <p className="text-sm text-muted-foreground">
            Please activate a block from the Block Management page
          </p>
        </div>
      </div>
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

  const isDark = theme === "dark";

  return (
    <div className="space-y-6">
      {/* Explanation Banner */}
      <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Title */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Info className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">What does this show?</h3>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              This correlation matrix shows how your trading strategies move
              together. Values range from -1 to +1:
            </p>

            {/* Correlation Types */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: isDark ? 'rgba(153, 27, 27, 0.2)' : 'rgba(103, 0, 31, 0.1)' }}>
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: isDark ? '#991b1b' : '#67001f' }} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium" style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>
                    +1.0
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Perfect positive correlation (strategies always move together)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(247, 247, 247, 0.8)' }}>
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: isDark ? '#334155' : '#f7f7f7', border: '1px solid', borderColor: isDark ? '#64748b' : '#cbd5e1' }} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    0.0
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No correlation (strategies move independently)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: isDark ? 'rgba(30, 64, 175, 0.2)' : 'rgba(5, 48, 97, 0.1)' }}>
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: isDark ? '#1e40af' : '#053061' }} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium" style={{ color: isDark ? '#93c5fd' : '#2563eb' }}>
                    -1.0
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Perfect negative correlation (strategies move opposite)
                  </p>
                </div>
              </div>
            </div>

            {/* Method Badges */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-medium">
                  PEARSON
                </Badge>
                <span className="text-muted-foreground">
                  Linear relationships (normal)
                </span>
              </div>
              <div className="hidden sm:block text-muted-foreground">•</div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400 font-medium">
                  SPEARMAN/KENDALL
                </Badge>
                <span className="text-muted-foreground">
                  Rank-based (non-linear patterns)
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <ChartWrapper
        title="Correlation Heatmap"
        description="Visual representation of strategy correlations"
        data={plotData}
        layout={layout}
        style={{ height: "600px" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Method:</span>
          <Select
            value={method}
            onValueChange={(value) =>
              setMethod(value as "pearson" | "spearman" | "kendall")
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pearson">Pearson (Linear)</SelectItem>
              <SelectItem value="spearman">Spearman (Rank)</SelectItem>
              <SelectItem value="kendall">Kendall (Rank)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </ChartWrapper>

      {/* Quick Analysis */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📊 Quick Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium" style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>
                  Strongest:
                </div>
                <div className="text-2xl font-bold" style={{ color: isDark ? '#991b1b' : '#67001f' }}>
                  {analytics.strongest.value.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {analytics.strongest.pair[0]} ↔ {analytics.strongest.pair[1]}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium" style={{ color: isDark ? '#93c5fd' : '#2563eb' }}>
                  Weakest:
                </div>
                <div className="text-2xl font-bold" style={{ color: isDark ? '#1e40af' : '#053061' }}>
                  {analytics.weakest.value.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {analytics.weakest.pair[0]} ↔ {analytics.weakest.pair[1]}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">
                  Average:
                </div>
                <div className="text-2xl font-bold">
                  {analytics.averageCorrelation.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {analytics.strategyCount} strategies analyzed
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
