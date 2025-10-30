import type { MarginTimeline } from "@/lib/calculations/margin-timeline";
import { Trade } from "@/lib/models/trade";

export interface RiskConstraintParams {
  trades: Trade[];
  startingCapital: number;
  strategyKellyMultipliers: Record<string, number | undefined>; // Percent multipliers (0-200)
  portfolioKellyPct: number; // Current global Kelly multiplier (percent)
  targetDrawdownPct: number; // Desired maximum drawdown (percent)
  maxScaleMultiplier?: number; // How many times more aggressive we search (default 5x)
  marginTimeline?: MarginTimeline;
  marginLimitPct?: number; // Maximum allowable margin usage (percent of capital)
}

export interface RiskConstraintResult {
  hasSufficientData: boolean;
  targetDrawdownPct: number;
  baselineDrawdownPct: number;
  currentDrawdownPct: number;
  currentPortfolioKellyPct: number;
  rawScale: number;
  rawPortfolioKellyPct: number;
  rawDrawdownPct: number;
  recommendedScale: number;
  recommendedPortfolioKellyPct: number;
  achievedDrawdownPct: number;
  maxAchievableDrawdownPct: number;
  uiCapDrawdownPct: number;
  constrainedByUiCap: boolean;
  constrainedBySearchLimit: boolean;
  constrainedByMargin: boolean;
  marginLimitPct: number;
  baseMarginMaxPct: number;
  rawMarginPct: number;
  achievedMarginPct: number;
  uiCapMarginPct: number;
}

/**
 * Calculate risk-constrained Kelly sizing by scaling historical P&L and
 * solving for the portfolio multiplier that respects a max drawdown target.
 */
export function computeRiskConstrainedKelly({
  trades,
  startingCapital,
  strategyKellyMultipliers,
  portfolioKellyPct,
  targetDrawdownPct,
  maxScaleMultiplier = 5,
  marginTimeline,
  marginLimitPct = 100,
}: RiskConstraintParams): RiskConstraintResult {
  const safeStartingCapital = Number.isFinite(startingCapital) ? startingCapital : 0;
  if (safeStartingCapital <= 0 || !Array.isArray(trades) || trades.length === 0) {
    return buildEmptyResult(targetDrawdownPct, portfolioKellyPct);
  }

  const sortedTrades = sortTradesByCloseDate(trades);
  const basePnlSeries = buildBasePnlSeries(sortedTrades, strategyKellyMultipliers);
  const hasNonZeroPnl = basePnlSeries.some((value) => value !== 0);

  if (!hasNonZeroPnl) {
    return buildEmptyResult(targetDrawdownPct, portfolioKellyPct);
  }

  const scaledDrawdown = (scale: number) =>
    calculateDrawdownForScale(basePnlSeries, safeStartingCapital, scale);

  const baselineDrawdownPct = scaledDrawdown(1);
  const currentScale = Math.max(portfolioKellyPct, 0) / 100;
  const currentDrawdownPct = scaledDrawdown(currentScale);

  const baseMarginSeries = marginTimeline
    ? buildBaseMarginSeries(marginTimeline, strategyKellyMultipliers)
    : [];
  const baseMarginMaxPct =
    baseMarginSeries.length > 0 ? Math.max(...baseMarginSeries) : 0;
  const safeMarginLimit =
    typeof marginLimitPct === "number" && Number.isFinite(marginLimitPct) && marginLimitPct >= 0
      ? marginLimitPct
      : Infinity;
  const hasMarginConstraint = safeMarginLimit !== Infinity;
  const drawdownActive = targetDrawdownPct > 0;
  const effectiveTarget = drawdownActive ? targetDrawdownPct : Number.POSITIVE_INFINITY;

  if (!drawdownActive && !hasMarginConstraint) {
    return {
      hasSufficientData: true,
      targetDrawdownPct,
      baselineDrawdownPct,
      currentDrawdownPct,
      currentPortfolioKellyPct: portfolioKellyPct,
      rawScale: 0,
      rawPortfolioKellyPct: 0,
      rawDrawdownPct: 0,
      recommendedScale: 0,
      recommendedPortfolioKellyPct: 0,
      achievedDrawdownPct: 0,
      maxAchievableDrawdownPct: 0,
      uiCapDrawdownPct: 0,
      constrainedByUiCap: false,
      constrainedBySearchLimit: false,
      constrainedByMargin: false,
      marginLimitPct: safeMarginLimit,
      baseMarginMaxPct,
      rawMarginPct: 0,
      achievedMarginPct: 0,
      uiCapMarginPct: baseMarginMaxPct * 2,
    };
  }

  const maxScale = Math.max(0.1, maxScaleMultiplier);
  const tolerance = 0.1; // percentage points

  let high = Math.max(1, currentScale || 1);
  let highDrawdown = scaledDrawdown(high);
  let searchLimited = false;

  // Expand search range until we exceed target drawdown or hit maxScale
  while (high < maxScale && highDrawdown < effectiveTarget - tolerance) {
    high = Math.min(maxScale, high * 2);
    highDrawdown = scaledDrawdown(high);
    if (high >= maxScale) {
      searchLimited = highDrawdown < effectiveTarget - tolerance;
      break;
    }
  }

  const constrainedBySearchLimit = drawdownActive ? searchLimited : false;
  let rawScale = high;
  let rawDrawdown = highDrawdown;

  if (drawdownActive && !constrainedBySearchLimit) {
    // Binary search between 0 and high to find scale that meets target drawdown
    let low = 0;
    let iterations = 0;
    while (iterations < 40) {
      iterations += 1;
      const mid = (low + high) / 2;
      const midDrawdown = scaledDrawdown(mid);

      if (Math.abs(midDrawdown - effectiveTarget) <= tolerance) {
        rawScale = mid;
        rawDrawdown = midDrawdown;
        break;
      }

      if (midDrawdown < effectiveTarget) {
        low = mid;
      } else {
        high = mid;
      }

      rawScale = mid;
      rawDrawdown = midDrawdown;
    }
  }

  // Clamp to search bounds and UI constraints
  const clampedScale = Math.max(0, Math.min(maxScale, rawScale));
  const uiMaxScale = 2; // UI caps Portfolio Kelly at 200%
  const scaleAfterUiClamp = Math.min(clampedScale, uiMaxScale);
  const constrainedByUiCap = scaleAfterUiClamp < clampedScale;

  const rawPortfolioKellyPct = Math.max(
    0,
    Number.parseFloat((clampedScale * 100).toFixed(1))
  );
  let recommendedPortfolioKellyPct = Math.max(
    0,
    Number.parseFloat((scaleAfterUiClamp * 100).toFixed(1))
  );

  const uiCapDrawdownPct = scaledDrawdown(uiMaxScale);
  const uiCapMarginPct = baseMarginMaxPct * uiMaxScale;

  let constrainedByMargin = false;
  let finalScale = scaleAfterUiClamp;

  if (baseMarginMaxPct > 0 && safeMarginLimit < Infinity) {
    const marginBound = safeMarginLimit / baseMarginMaxPct;
    if (marginBound < finalScale) {
      finalScale = Math.max(0, marginBound);
      constrainedByMargin = true;
    }
  }

  const rawMarginPct = baseMarginMaxPct * clampedScale;
  recommendedPortfolioKellyPct = Math.max(
    0,
    Number.parseFloat((finalScale * 100).toFixed(1))
  );
  const achievedDrawdownPct = scaledDrawdown(finalScale);
  const achievedMarginPct = baseMarginMaxPct * finalScale;

  return {
    hasSufficientData: true,
    targetDrawdownPct,
    baselineDrawdownPct,
    currentDrawdownPct,
    currentPortfolioKellyPct: portfolioKellyPct,
    rawScale: clampedScale,
    rawPortfolioKellyPct,
    rawDrawdownPct: constrainedBySearchLimit ? scaledDrawdown(maxScale) : rawDrawdown,
    recommendedScale: finalScale,
    recommendedPortfolioKellyPct,
    achievedDrawdownPct,
    maxAchievableDrawdownPct: scaledDrawdown(maxScale),
    uiCapDrawdownPct,
    constrainedByUiCap,
    constrainedBySearchLimit,
    constrainedByMargin,
    marginLimitPct: safeMarginLimit,
    baseMarginMaxPct,
    rawMarginPct,
    achievedMarginPct,
    uiCapMarginPct,
  };
}

function buildEmptyResult(
  targetDrawdownPct: number,
  portfolioKellyPct: number
): RiskConstraintResult {
  return {
    hasSufficientData: false,
    targetDrawdownPct,
    baselineDrawdownPct: 0,
    currentDrawdownPct: 0,
    currentPortfolioKellyPct: portfolioKellyPct,
    rawScale: 0,
    rawPortfolioKellyPct: 0,
    rawDrawdownPct: 0,
    recommendedScale: 0,
    recommendedPortfolioKellyPct: 0,
    achievedDrawdownPct: 0,
    maxAchievableDrawdownPct: 0,
    uiCapDrawdownPct: 0,
    constrainedByUiCap: false,
    constrainedBySearchLimit: false,
    constrainedByMargin: false,
    marginLimitPct: 0,
    baseMarginMaxPct: 0,
    rawMarginPct: 0,
    achievedMarginPct: 0,
    uiCapMarginPct: 0,
  };
}

function sortTradesByCloseDate(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const dateA = getTradeTimestamp(a);
    const dateB = getTradeTimestamp(b);
    if (dateA !== dateB) {
      return dateA - dateB;
    }

    const timeA = (a.timeClosed ?? a.timeOpened ?? "") || "";
    const timeB = (b.timeClosed ?? b.timeOpened ?? "") || "";
    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }

    // Stable fallback to avoid shuffling identical timestamps
    return 0;
  });
}

function getTradeTimestamp(trade: Trade): number {
  const date = trade.dateClosed ?? trade.dateOpened;
  if (!date) return Number.MAX_SAFE_INTEGER;

  try {
    const jsDate =
      date instanceof Date ? date : new Date(typeof date === "string" ? date : String(date));
    const time = jsDate.getTime();
    return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function buildBasePnlSeries(
  trades: Trade[],
  multipliers: Record<string, number | undefined>
): number[] {
  return trades.map((trade) => {
    const strategyName = trade.strategy || "Uncategorized";
    const multiplierPct = multipliers[strategyName];
    const multiplier = typeof multiplierPct === "number" ? multiplierPct / 100 : 1;
    const tradePl = typeof trade.pl === "number" && Number.isFinite(trade.pl) ? trade.pl : 0;
    return tradePl * multiplier;
  });
}

function calculateDrawdownForScale(
  pnlSeries: number[],
  startingCapital: number,
  scale: number
): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return 0;
  }

  let equity = startingCapital;
  let peak = startingCapital;
  let maxDrawdownPct = 0;

  for (const pnl of pnlSeries) {
    equity += pnl * scale;
    if (equity > peak) {
      peak = equity;
      continue;
    }

    if (peak <= 0) {
      continue;
    }

    const drawdownPct = ((peak - equity) / peak) * 100;
    if (drawdownPct > maxDrawdownPct) {
      maxDrawdownPct = drawdownPct;
    }
  }

  return maxDrawdownPct;
}

function buildBaseMarginSeries(
  marginTimeline: MarginTimeline,
  multipliers: Record<string, number | undefined>
): number[] {
  const seriesLength = marginTimeline.portfolioPct.length;
  if (seriesLength === 0) return [];

  const hasStrategyBreakdown = marginTimeline.strategyPct.size > 0;
  const result: number[] = [];

  for (let index = 0; index < seriesLength; index += 1) {
    if (hasStrategyBreakdown) {
      let total = 0;
      for (const [strategy, values] of marginTimeline.strategyPct.entries()) {
        const basePct = values[index] ?? 0;
        if (basePct === 0) continue;
        const multiplierPct = multipliers[strategy];
        const multiplier = typeof multiplierPct === "number" ? multiplierPct / 100 : 1;
        total += basePct * multiplier;
      }
      result.push(total);
    } else {
      const numericMultipliers: number[] = [];
      for (const value of Object.values(multipliers)) {
        if (typeof value === "number" && Number.isFinite(value)) {
          numericMultipliers.push(value / 100);
        }
      }

      const sum =
        numericMultipliers.length > 0
          ? numericMultipliers.reduce((accumulator, current) => accumulator + current, 0)
          : 0;
      const avgMultiplier =
        numericMultipliers.length > 0 ? sum / numericMultipliers.length : 1;
      const multiplier = Number.isFinite(avgMultiplier) && avgMultiplier > 0 ? avgMultiplier : 1;
      result.push((marginTimeline.portfolioPct[index] ?? 0) * multiplier);
    }
  }

  return result;
}
