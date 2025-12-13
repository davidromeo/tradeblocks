"use client"

import { MetricCard } from "@/components/metric-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

  // Calculate percentage-based delta: (OOS - IS) / |IS| * 100
  // This shows how much performance changed as a percentage of the in-sample baseline
  const avgDeltaPct = summary.avgInSamplePerformance !== 0
    ? (stats.averagePerformanceDelta / Math.abs(summary.avgInSamplePerformance)) * 100
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
        value={Number.isFinite(avgDeltaPct) ? avgDeltaPct : 0}
        subtitle={`% change from in-sample`}
        format="percentage"
        tooltip={{
          flavor: "Average percentage change between in-sample and out-of-sample performance.",
          detailed: "Shows how much the target metric shifts when moving from optimization to forward-testing. Values near 0% indicate stable performance; large negative values suggest overfitting.",
        }}
        isPositive={avgDeltaPct >= -10}
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

      {/* Diversification Metrics - only shown when diversification analysis was enabled */}
      {(summary.avgCorrelationAcrossPeriods !== undefined ||
        summary.avgTailDependenceAcrossPeriods !== undefined ||
        summary.avgEffectiveFactors !== undefined) && (
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Diversification Metrics</CardTitle>
            <CardDescription className="text-xs">
              Average values across all walk-forward periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {summary.avgCorrelationAcrossPeriods !== undefined && (
                <MetricCard
                  title="Avg Correlation"
                  value={summary.avgCorrelationAcrossPeriods}
                  format="decimal"
                  decimalPlaces={3}
                  tooltip={{
                    flavor: "Average pairwise correlation between strategies across all periods.",
                    detailed: "Lower values indicate better diversification. Values below 0.5 are generally good; below 0.3 is excellent.",
                  }}
                  isPositive={summary.avgCorrelationAcrossPeriods < 0.5}
                />
              )}
              {summary.avgTailDependenceAcrossPeriods !== undefined && (
                <MetricCard
                  title="Avg Tail Dependence"
                  value={summary.avgTailDependenceAcrossPeriods}
                  format="decimal"
                  decimalPlaces={3}
                  tooltip={{
                    flavor: "Average joint tail risk between strategies across all periods.",
                    detailed: "Measures how often strategies experience extreme losses together. Lower is better.",
                  }}
                  isPositive={summary.avgTailDependenceAcrossPeriods < 0.4}
                />
              )}
              {summary.avgEffectiveFactors !== undefined && (
                <MetricCard
                  title="Effective Factors"
                  value={summary.avgEffectiveFactors}
                  format="decimal"
                  decimalPlaces={2}
                  tooltip={{
                    flavor: "Average number of independent risk factors across all periods.",
                    detailed: "Higher values indicate better diversification. Close to the number of strategies means each contributes unique risk/return.",
                  }}
                  isPositive={summary.avgEffectiveFactors >= 2}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
