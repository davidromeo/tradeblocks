"use client"

import { MetricCard } from "@/components/metric-card"
import { Card, CardContent } from "@/components/ui/card"
import type { WalkForwardResults } from "@/lib/models/walk-forward"

interface RobustnessMetricsProps {
  results: WalkForwardResults | null
  targetMetricLabel: string
}

export function RobustnessMetrics({ results, targetMetricLabel }: RobustnessMetricsProps) {
  if (!results) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Execute a walk-forward run to unlock robustness insights.
        </CardContent>
      </Card>
    )
  }

  const { summary, stats } = results
  const efficiencyPct = summary.avgInSamplePerformance !== 0
    ? summary.degradationFactor * 100
    : 0

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Efficiency Ratio"
        value={Number.isFinite(efficiencyPct) ? efficiencyPct : 0}
        format="percentage"
        tooltip={{
          flavor: "How well out-of-sample performance held up relative to the training window.",
          detailed: `A value near 100% means the strategy maintained ${targetMetricLabel} gains when exposed to unseen data.`,
        }}
        isPositive={efficiencyPct >= 90}
      />
      <MetricCard
        title="Parameter Stability"
        value={summary.parameterStability * 100}
        format="percentage"
        tooltip={{
          flavor: "Measures how noisy the optimal parameters are across walk-forward steps.",
          detailed: "High stability implies position sizing or risk limits do not drastically swing between windows, which usually improves robustness.",
        }}
        isPositive={summary.parameterStability >= 0.7}
      />
      <MetricCard
        title="Consistency Score"
        value={(stats.consistencyScore || 0) * 100}
        format="percentage"
        tooltip={{
          flavor: "Percent of periods where out-of-sample performance stayed non-negative.",
          detailed: "Consistency above 60% often indicates the strategy adapts well to new market regimes.",
        }}
        isPositive={stats.consistencyScore >= 0.6}
      />
      <MetricCard
        title="Avg Performance Delta"
        value={stats.averagePerformanceDelta}
        subtitle={`${targetMetricLabel} difference`}
        format="number"
        tooltip={{
          flavor: "Average absolute change between in-sample and out-of-sample scoring.",
          detailed: "Smaller deltas reflect smoother degradation when rolling forward.",
        }}
        isPositive={stats.averagePerformanceDelta >= 0}
      />
      <MetricCard
        title="Robustness Score"
        value={summary.robustnessScore * 100}
        format="percentage"
        tooltip={{
          flavor: "Blends efficiency, stability, and consistency into a single quality gauge.",
          detailed: "Use this reading to compare different blocks or parameter presets at a glance.",
        }}
        className="md:col-span-2 lg:col-span-4"
        isPositive={summary.robustnessScore >= 0.6}
      />
    </div>
  )
}
