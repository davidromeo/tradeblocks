"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"
import type { WalkForwardResults, WalkForwardPeriodResult } from "@/lib/models/walk-forward"
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, TrendingUp, Shield, Settings2 } from "lucide-react"

interface WalkForwardVerdictProps {
  results: WalkForwardResults
  targetMetricLabel: string
}

type Assessment = "good" | "moderate" | "concerning"

interface VerdictAssessment {
  overall: Assessment
  title: string
  description: string
  efficiency: Assessment
  stability: Assessment
  consistency: Assessment
}

function assessResults(results: WalkForwardResults): VerdictAssessment {
  const { summary, stats } = results
  const efficiencyPct = summary.degradationFactor * 100
  const stabilityPct = summary.parameterStability * 100
  const consistencyPct = (stats.consistencyScore || 0) * 100

  // Individual assessments
  const efficiency: Assessment =
    efficiencyPct >= 80 ? "good" :
    efficiencyPct >= 60 ? "moderate" : "concerning"

  const stability: Assessment =
    stabilityPct >= 70 ? "good" :
    stabilityPct >= 50 ? "moderate" : "concerning"

  const consistency: Assessment =
    consistencyPct >= 70 ? "good" :
    consistencyPct >= 50 ? "moderate" : "concerning"

  // Calculate overall from component scores
  const scores = { good: 2, moderate: 1, concerning: 0 }
  const totalScore = scores[efficiency] + scores[stability] + scores[consistency]

  const overall: Assessment =
    totalScore >= 5 ? "good" :
    totalScore >= 3 ? "moderate" : "concerning"

  // Generate title and description based on overall assessment
  let title: string
  let description: string

  if (overall === "good") {
    title = "Strategy shows robust out-of-sample performance"
    description = "Your parameter settings held up well when tested on unseen data. The optimization appears to capture genuine market edge rather than fitting to historical noise."
  } else if (overall === "moderate") {
    title = "Strategy shows mixed out-of-sample results"
    description = "Some windows performed well, but there's meaningful variation. Consider whether the edge is consistent enough for your risk tolerance, or if parameter adjustments might help."
  } else {
    title = "Strategy may be overfit to historical data"
    description = "Out-of-sample performance degraded significantly from the training windows. The optimized parameters might be fitting to noise rather than real market patterns."
  }

  return {
    overall,
    title,
    description,
    efficiency,
    stability,
    consistency,
  }
}

function getRecommendedParameters(periods: WalkForwardPeriodResult[]): {
  params: Record<string, { value: number; range: [number, number]; stable: boolean }>
  hasSuggestions: boolean
} {
  if (periods.length === 0) {
    return { params: {}, hasSuggestions: false }
  }

  // Collect all parameter keys
  const allKeys = new Set<string>()
  for (const period of periods) {
    for (const key of Object.keys(period.optimalParameters)) {
      allKeys.add(key)
    }
  }

  const params: Record<string, { value: number; range: [number, number]; stable: boolean }> = {}

  for (const key of allKeys) {
    const values = periods
      .map((p) => p.optimalParameters[key])
      .filter((v) => v !== undefined && v !== null) as number[]

    if (values.length === 0) continue

    const min = Math.min(...values)
    const max = Math.max(...values)
    const mean = values.reduce((a, b) => a + b, 0) / values.length

    // Calculate coefficient of variation for stability
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : 0

    // Consider stable if CV < 0.3 (less than 30% variation)
    const stable = cv < 0.3

    params[key] = {
      value: Number(mean.toFixed(3)),
      range: [Number(min.toFixed(3)), Number(max.toFixed(3))],
      stable,
    }
  }

  return {
    params,
    hasSuggestions: Object.keys(params).length > 0
  }
}

function formatParameterName(key: string): string {
  if (key.startsWith("strategy:")) {
    return `Weight: ${key.replace("strategy:", "")}`
  }
  switch (key) {
    case "kellyMultiplier": return "Kelly Multiplier"
    case "fixedFractionPct": return "Fixed Fraction %"
    case "maxDrawdownPct": return "Max Drawdown %"
    case "maxDailyLossPct": return "Max Daily Loss %"
    case "consecutiveLossLimit": return "Consecutive Loss Limit"
    default: return key
  }
}

const assessmentStyles: Record<Assessment, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  good: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  moderate: {
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    icon: AlertTriangle,
  },
  concerning: {
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-400",
    icon: XCircle,
  },
}

export function WalkForwardVerdict({ results, targetMetricLabel }: WalkForwardVerdictProps) {
  const assessment = assessResults(results)
  const { params, hasSuggestions } = getRecommendedParameters(results.periods)
  const style = assessmentStyles[assessment.overall]
  const Icon = style.icon

  return (
    <div className="space-y-4">
      {/* Main Verdict Card */}
      <Card className={cn("border-l-4", {
        "border-l-emerald-500": assessment.overall === "good",
        "border-l-amber-500": assessment.overall === "moderate",
        "border-l-rose-500": assessment.overall === "concerning",
      })}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              style.bg, style.text
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className={cn("text-base font-semibold", style.text)}>
                {assessment.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {assessment.description}
              </p>

              {/* Component Assessment Badges */}
              <div className="flex flex-wrap gap-3 pt-2">
                <AssessmentBadge
                  label="Efficiency"
                  assessment={assessment.efficiency}
                  tooltip={`How well out-of-sample ${targetMetricLabel} held up compared to in-sample optimization.`}
                />
                <AssessmentBadge
                  label="Stability"
                  assessment={assessment.stability}
                  tooltip="How consistent the optimal parameters were across different time windows."
                />
                <AssessmentBadge
                  label="Consistency"
                  assessment={assessment.consistency}
                  tooltip="Percentage of windows where out-of-sample performance stayed non-negative."
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Parameters */}
      {hasSuggestions && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Parameter Observations</CardTitle>
              <HoverCard>
                <HoverCardTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <p className="text-sm">
                    These values represent the average optimal parameters found across all walk-forward windows.
                    <strong className="block mt-2">Note:</strong> These are observations, not recommendations.
                    Market conditions change, and past optimal parameters may not be ideal going forward.
                  </p>
                </HoverCardContent>
              </HoverCard>
            </div>
            <CardDescription className="text-xs">
              Average values across {results.periods.length} optimization windows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(params).map(([key, data]) => (
                <ParameterSuggestion
                  key={key}
                  name={formatParameterName(key)}
                  value={data.value}
                  range={data.range}
                  stable={data.stable}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
              Parameters marked as &quot;stable&quot; showed less than 30% variation across windows.
              Higher stability suggests the parameter value may be more reliable, but always validate
              against current market conditions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Interpretation Guide */}
      <Card className="border-dashed">
        <CardHeader className="py-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Understanding These Results</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span>Efficiency Ratio</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Measures how much of your in-sample performance carried over to out-of-sample testing.
                80%+ suggests real edge; below 60% may indicate overfitting.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-violet-500" />
                <span>Parameter Stability</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Shows how much optimal parameters jumped around between windows.
                Stable parameters (70%+) suggest a more robust strategy.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Consistency Score</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage of windows where out-of-sample performance was positive.
                High consistency (70%+) means the strategy adapts well to new data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AssessmentBadge({
  label,
  assessment,
  tooltip
}: {
  label: string
  assessment: Assessment
  tooltip: string
}) {
  const style = assessmentStyles[assessment]
  const assessmentLabel = assessment === "good" ? "Good" : assessment === "moderate" ? "Mixed" : "Low"

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "cursor-help text-xs gap-1.5",
            style.bg,
            style.text,
            "border-transparent"
          )}
        >
          {label}: {assessmentLabel}
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-64">
        <p className="text-sm">{tooltip}</p>
      </HoverCardContent>
    </HoverCard>
  )
}

function ParameterSuggestion({
  name,
  value,
  range,
  stable,
}: {
  name: string
  value: number
  range: [number, number]
  stable: boolean
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{name}</span>
        {stable && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            Stable
          </Badge>
        )}
      </div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">
        Range: {range[0]} – {range[1]}
      </div>
    </div>
  )
}
