import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { RiskConstraintResult } from "@/lib/calculations/risk-constrained-kelly";
import { AlertTriangle, HelpCircle, Info } from "lucide-react";

interface RiskConstraintSummaryProps {
  result: RiskConstraintResult;
  onApply: (portfolioKellyPct: number) => void;
  drawdownEnabled: boolean;
  marginEnabled: boolean;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return `${value.toFixed(1)}%`;
}

export function RiskConstraintSummary({
  result,
  onApply,
  drawdownEnabled,
  marginEnabled,
}: RiskConstraintSummaryProps) {
  const {
    hasSufficientData,
    targetDrawdownPct,
    baselineDrawdownPct,
    currentDrawdownPct,
    currentPortfolioKellyPct,
    rawPortfolioKellyPct,
    rawDrawdownPct,
    recommendedPortfolioKellyPct,
    achievedDrawdownPct,
    uiCapDrawdownPct,
    constrainedByUiCap,
    constrainedBySearchLimit,
    constrainedByMargin,
    marginLimitPct,
    baseMarginMaxPct,
    rawMarginPct,
    achievedMarginPct,
    uiCapMarginPct,
  } = result;

  if (!hasSufficientData) {
    return (
      <Card className="p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Risk-Constrained Kelly</h2>
            <HelpTooltip />
          </div>
          <p className="text-sm text-muted-foreground">
            We need at least one closed trade with non-zero P&amp;L to estimate a drawdown profile.
            Upload more trades or adjust your filters, then rerun the allocation.
          </p>
        </div>
      </Card>
    );
  }

  const projectedDelta =
    recommendedPortfolioKellyPct - currentPortfolioKellyPct;
  const isRecommendationActionable = Math.abs(projectedDelta) >= 0.5;

  const recommendationTone =
    projectedDelta < -0.5
      ? "Constrain risk"
      : projectedDelta > 0.5
        ? "You can scale up"
        : "You're already aligned";

  const needsUiOverride = constrainedByUiCap && drawdownEnabled;
  const needsMoreData = drawdownEnabled && constrainedBySearchLimit && !constrainedByUiCap;
  const marginLimited = constrainedByMargin && marginEnabled;
  const hasMarginData = marginEnabled && baseMarginMaxPct > 0;

  const warnings: ReactNode[] = [];

  if (marginLimited) {
    warnings.push(
      <p key="margin">
        Margin usage would breach the {formatPercent(marginLimitPct)} limit. Without that guardrail
        we&apos;d expect about {formatPercent(rawMarginPct)} of capital tied up in margin, so the
        recommendation holds you to roughly {formatPercent(achievedMarginPct)}.
      </p>
    );
  }

  if (needsUiOverride) {
    warnings.push(
      <p key="ui-cap">
        Hitting the {formatPercent(targetDrawdownPct)} target would require roughly{" "}
        {rawPortfolioKellyPct.toFixed(1)}% portfolio Kelly based on the historical path. The UI caps
        the slider at 200%, which projects {formatPercent(uiCapDrawdownPct)} drawdown and{" "}
        {formatPercent(uiCapMarginPct)} margin.
      </p>
    );
  }

  if (needsMoreData) {
    warnings.push(
      <p key="search-limit">
        The drawdown target wasn&apos;t reached even after exploring up to{" "}
        {rawPortfolioKellyPct.toFixed(1)}% Kelly ({formatPercent(rawDrawdownPct)} projected drawdown).
        Review whether your historical sample captures stressed conditions or widen the target.
      </p>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Risk-Constrained Kelly</h2>
          <HelpTooltip />
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {recommendationTone}
        </span>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricBlock
          label="Current Setting"
          value={`${currentPortfolioKellyPct.toFixed(1)}% Kelly`}
          sublabel={`Projected drawdown ${formatPercent(currentDrawdownPct)}`}
          tooltip="Portfolio Kelly fraction that was active when you clicked Run Allocation. The drawdown beneath shows how the historical path behaved at that size."
        />
        <MetricBlock
          label="Recommended Kelly"
          value={`${recommendedPortfolioKellyPct.toFixed(1)}%`}
          sublabel={`Projected drawdown ${formatPercent(achievedDrawdownPct)}`}
          tooltip="Kelly fraction suggested after applying the enabled drawdown and/or margin guardrails to your trade history."
        />
        {drawdownEnabled && (
          <>
            <MetricBlock
              label="Target Max Drawdown"
              value={formatPercent(targetDrawdownPct)}
              sublabel="Constraint applied to the solver"
              tooltip="The maximum drawdown threshold you provided. The solver scales Kelly sizing until the historical path touches this level—or until another constraint stops it."
            />
            <MetricBlock
              label="Full Kelly (100%)"
              value={formatPercent(baselineDrawdownPct)}
              sublabel="Historical drawdown with no additional scaling"
              tooltip="Baseline drawdown from your historical trades at 100% portfolio Kelly before applying extra multipliers."
            />
          </>
        )}
        {drawdownEnabled &&
          (needsUiOverride || needsMoreData) &&
          rawPortfolioKellyPct !== recommendedPortfolioKellyPct && (
            <MetricBlock
              label="Kelly Needed To Hit Target"
              value={`${rawPortfolioKellyPct.toFixed(1)}%`}
              sublabel={`Projected drawdown ${formatPercent(rawDrawdownPct)}`}
              tooltip="Kelly fraction the solver would need to reach the drawdown target if no other limits (UI cap or margin guardrail) intervened."
            />
          )}
      </div>

      {hasMarginData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricBlock
            label="Margin Limit"
            value={formatPercent(marginLimitPct)}
            sublabel="Maximum capital allowed in margin"
            tooltip="Upper bound you set for peak margin usage. Recommendations cannot exceed this percentage of starting capital."
          />
          <MetricBlock
            label="Base Margin (Strategy Kelly)"
            value={formatPercent(baseMarginMaxPct)}
            sublabel="Peak margin % at 100% portfolio Kelly with your strategy multipliers"
            tooltip="Highest margin utilisation observed in history when all strategies run at 100% portfolio Kelly with their individual multipliers."
          />
          <MetricBlock
            label="Projected Margin (Recommended)"
            value={formatPercent(achievedMarginPct)}
            sublabel="Expected peak margin if you adopt the suggestion"
            tooltip="Projected peak margin usage after applying the recommended Kelly fraction, useful for checking brokerage requirements."
          />
          {(marginLimited || needsUiOverride) && (
            <MetricBlock
              label="Margin at Kelly Needed"
              value={formatPercent(rawMarginPct)}
              sublabel="Peak margin % at the Kelly required to hit the drawdown target"
              tooltip="What margin exposure would look like if you sized to the unconstrained Kelly level required to meet the drawdown target."
            />
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50/60 p-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5 flex-none" />
          <div className="space-y-2 text-sm leading-relaxed">{warnings}</div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          variant="default"
          disabled={!isRecommendationActionable}
          onClick={() => onApply(Number(recommendedPortfolioKellyPct.toFixed(1)))}
        >
          Apply &amp; Run ({recommendedPortfolioKellyPct.toFixed(1)}% Kelly)
        </Button>
      </div>
    </Card>
  );
}

interface MetricBlockProps {
  label: string;
  value: string;
  sublabel?: string;
  tooltip?: string;
}

function MetricBlock({ label, value, sublabel, tooltip }: MetricBlockProps) {
  return (
    <div className="space-y-1 rounded-md border border-muted p-3">
      <div className="flex items-center gap-1">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        {tooltip ? (
          <HoverCard>
            <HoverCardTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
            </HoverCardTrigger>
            <HoverCardContent className="w-72 p-0 overflow-hidden">
              <div className="space-y-3">
                <div className="bg-primary/5 border-b px-4 py-3">
                  <h4 className="text-sm font-semibold text-primary">{label}</h4>
                </div>
                <div className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed">
                  {tooltip}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : null}
      </div>
      <p className="text-lg font-semibold">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

function HelpTooltip() {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <HelpCircle className="h-4 w-4 text-muted-foreground/60 cursor-help" />
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0 overflow-hidden">
        <div className="space-y-3">
          <div className="bg-primary/5 border-b px-4 py-3">
            <h4 className="text-sm font-semibold text-primary">
              Risk-Constrained Kelly Position Sizing
            </h4>
          </div>
          <div className="px-4 pb-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              We scale historical trade P&amp;L by your per-strategy Kelly multipliers and solve for
              the global portfolio fraction that keeps maximum drawdown beneath your target.
            </p>
            <p>
              Drawdown projections assume linear scaling of P&amp;L with position size. Use them as a
              guide—not a guarantee—and validate with forward tests or Monte Carlo stress runs.
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
