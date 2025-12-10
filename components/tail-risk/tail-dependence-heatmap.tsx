"use client";

import { ChartWrapper } from "@/components/performance-charts/chart-wrapper";
import { TailRiskAnalysisResult } from "@/lib/models/tail-risk";
import { truncateStrategyName } from "@/lib/utils";
import { useTheme } from "next-themes";
import type { Data, Layout } from "plotly.js";
import { useMemo } from "react";

interface TailDependenceHeatmapProps {
  result: TailRiskAnalysisResult;
  actions?: React.ReactNode;
}

export function TailDependenceHeatmap({
  result,
  actions,
}: TailDependenceHeatmapProps) {
  const { theme } = useTheme();

  const { plotData, layout } = useMemo(() => {
    const { strategies, tailDependenceMatrix } = result;
    const isDark = theme === "dark";

    // Truncate strategy names for axis labels
    const truncatedStrategies = strategies.map((s) =>
      truncateStrategyName(s, 40)
    );

    // Symmetrize the matrix for display (average of both directions)
    const symmetricMatrix = tailDependenceMatrix.map((row, i) =>
      row.map((val, j) =>
        i === j
          ? 1.0
          : (tailDependenceMatrix[i][j] + tailDependenceMatrix[j][i]) / 2
      )
    );

    // Color scale: 0 (low tail dependence) to 1 (high tail dependence)
    // Using a different scale than correlation since values are always positive
    const colorscale = isDark
      ? [
          [0, "#1e3a5f"], // Dark blue for low dependence
          [0.25, "#2563eb"], // Blue
          [0.5, "#fbbf24"], // Yellow/amber for medium
          [0.75, "#f97316"], // Orange
          [1, "#dc2626"], // Red for high dependence
        ]
      : [
          [0, "#dbeafe"], // Light blue for low dependence
          [0.25, "#60a5fa"], // Blue
          [0.5, "#fde68a"], // Yellow for medium
          [0.75, "#fb923c"], // Orange
          [1, "#b91c1c"], // Dark red for high dependence
        ];

    const heatmapData = {
      z: symmetricMatrix,
      x: truncatedStrategies,
      y: truncatedStrategies,
      type: "heatmap" as const,
      colorscale,
      zmin: 0,
      zmax: 1,
      text: symmetricMatrix.map((row) =>
        row.map((val) => val.toFixed(2))
      ) as unknown as string,
      texttemplate: "%{text}",
      textfont: {
        size: 10,
        color: symmetricMatrix.map((row) =>
          row.map((val) => {
            // Dynamic text color based on value and theme
            if (isDark) {
              return val > 0.5 ? "#ffffff" : "#e2e8f0";
            } else {
              return val > 0.6 ? "#ffffff" : "#000000";
            }
          })
        ) as unknown as string,
      },
      // Use full strategy names in hover tooltip
      hovertemplate:
        "<b>%{customdata[0]} ↔ %{customdata[1]}</b><br>Tail Dependence: %{z:.3f}<extra></extra>",
      customdata: symmetricMatrix.map((row, yIndex) =>
        row.map((_, xIndex) => [strategies[yIndex], strategies[xIndex]])
      ),
      colorbar: {
        title: { text: "Tail Dep.", side: "right" as const },
        tickmode: "linear" as const,
        tick0: 0,
        dtick: 0.25,
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

    return {
      plotData: [heatmapData as unknown as Data],
      layout: heatmapLayout,
    };
  }, [result, theme]);

  return (
    <ChartWrapper
      title="Tail Dependence Heatmap"
      description="How likely strategies are to have extreme losses together"
      tooltip={{
        flavor:
          "Shows the probability that one strategy is in its worst days when another strategy is also having its worst days.",
        detailed:
          "Unlike regular correlation which measures average co-movement, tail dependence specifically captures extreme co-movement. A value of 0.7 means when Strategy A has a bad day (bottom 10%), there's a 70% chance Strategy B is also having a bad day. High tail dependence (red) indicates strategies that blow up together on market stress days, even if their day-to-day correlation appears low.",
      }}
      data={plotData}
      layout={layout}
      style={{ height: "600px" }}
      actions={actions}
    />
  );
}
