"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"
import type { WalkForwardResults } from "@/lib/models/walk-forward"
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react"
import { assessResults, type Assessment } from "@/lib/calculations/walk-forward-verdict"

interface WalkForwardSummaryProps {
  results: WalkForwardResults
}

const overallStyles: Record<Assessment, {
  border: string
  bg: string
  text: string
  icon: typeof CheckCircle2
}> = {
  good: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  moderate: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    icon: AlertTriangle,
  },
  concerning: {
    border: "border-l-rose-500",
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-400",
    icon: XCircle,
  },
}

const summaryMessages: Record<Assessment, string> = {
  good: "Your strategy held up well when tested on new data.",
  moderate: "Your strategy showed mixed results across different time periods.",
  concerning: "Your strategy may be overfit to historical data.",
}

function getEfficiencyLabel(pct: number): string {
  return `${Math.round(pct)}% of performance held up`
}

function getStabilityLabel(assessment: Assessment): string {
  switch (assessment) {
    case "good":
      return "Parameters were stable"
    case "moderate":
      return "Parameters were variable"
    case "concerning":
      return "Parameters were unstable"
  }
}

function getConsistencyLabel(consistencyPct: number, windowCount: number): string {
  const profitableCount = Math.round((consistencyPct / 100) * windowCount)
  return `${profitableCount} of ${windowCount} windows were profitable`
}

export function WalkForwardSummary({ results }: WalkForwardSummaryProps) {
  const assessment = assessResults(results)
  const style = overallStyles[assessment.overall]
  const Icon = style.icon

  const efficiencyPct = results.summary.degradationFactor * 100
  const consistencyPct = (results.stats.consistencyScore || 0) * 100
  const windowCount = results.periods.length

  return (
    <Card className={cn("border-l-4", style.border)}>
      <CardContent className="pt-6 space-y-6">
        {/* Large visual status indicator and summary */}
        <div className="flex items-start gap-4">
          <div className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            style.bg, style.text
          )}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className={cn("text-lg font-semibold", style.text)}>
              {assessment.overall === "good" ? "Looking Good" :
               assessment.overall === "moderate" ? "Mixed Results" :
               "Needs Attention"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {summaryMessages[assessment.overall]}
            </p>
          </div>
        </div>

        {/* Three key metrics in horizontal row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Efficiency"
            value={getEfficiencyLabel(efficiencyPct)}
            assessment={assessment.efficiency}
            tooltip="How well performance held up when tested on new data"
          />
          <MetricCard
            label="Stability"
            value={getStabilityLabel(assessment.stability)}
            assessment={assessment.stability}
            tooltip="How consistent the optimal settings were across time"
          />
          <MetricCard
            label="Consistency"
            value={getConsistencyLabel(consistencyPct, windowCount)}
            assessment={assessment.consistency}
            tooltip="How often the strategy stayed profitable on new data"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCard({
  label,
  value,
  assessment,
  tooltip,
}: {
  label: string
  value: string
  assessment: Assessment
  tooltip: string
}) {
  const colorClass = assessment === "good"
    ? "text-emerald-700 dark:text-emerald-400"
    : assessment === "moderate"
    ? "text-amber-700 dark:text-amber-400"
    : "text-rose-700 dark:text-rose-400"

  const bgClass = assessment === "good"
    ? "bg-emerald-500/5"
    : assessment === "moderate"
    ? "bg-amber-500/5"
    : "bg-rose-500/5"

  return (
    <div className={cn("rounded-lg p-3 space-y-1", bgClass)}>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <HoverCard>
          <HoverCardTrigger asChild>
            <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
          </HoverCardTrigger>
          <HoverCardContent className="w-64">
            <p className="text-sm">{tooltip}</p>
          </HoverCardContent>
        </HoverCard>
      </div>
      <p className={cn("text-sm font-medium", colorClass)}>
        {value}
      </p>
    </div>
  )
}
