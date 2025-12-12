import type { DailyPnLPoint } from "@/lib/analytics/pl-analytics";

export interface EquityCurvePoint {
  date: string;
  equity: number;
  drawdownPct: number; // 0..100
}

export interface KellyScaleResult {
  scale: number;
  portfolioKellyPct: number;
  estMaxDdPct: number;
  equityCurve: EquityCurvePoint[];
}

/**
 * Build an equity curve at a given Kelly scale and return curve + max DD.
 */
export function buildEquityCurve(
  dailyPnl: DailyPnLPoint[],
  startingCapital: number,
  scale: number
): { curve: EquityCurvePoint[]; maxDdPct: number } {
  let equity = startingCapital;
  let peak = startingCapital;
  let maxDdPct = 0;
  const curve: EquityCurvePoint[] = [];

  for (const point of dailyPnl) {
    equity += point.pl * scale;
    peak = Math.max(peak, equity);
    const drawdownPct = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    maxDdPct = Math.max(maxDdPct, drawdownPct);
    curve.push({ date: point.date, equity, drawdownPct });
  }

  return { curve, maxDdPct };
}

/**
 * Compute DD / equity curves for multiple Kelly scales.
 */
export function computeKellyScaleResults(params: {
  dailyPnl: DailyPnLPoint[];
  startingCapital: number;
  baselinePortfolioKellyPct: number;
  kellyScales: number[];
}): KellyScaleResult[] {
  const { dailyPnl, startingCapital, baselinePortfolioKellyPct, kellyScales } = params;
  return kellyScales.map((scale) => {
    const { curve, maxDdPct } = buildEquityCurve(dailyPnl, startingCapital, scale);
    return {
      scale,
      portfolioKellyPct: baselinePortfolioKellyPct * scale,
      estMaxDdPct: maxDdPct,
      equityCurve: curve,
    };
  });
}

/**
 * Pick the Kelly scale that best fits a DD band; falls back to closest to upper bound.
 */
export function pickKellyScaleForDdBand(
  results: KellyScaleResult[],
  targetMinDdPct: number,
  targetMaxDdPct: number
): KellyScaleResult | undefined {
  if (results.length === 0) return undefined;

  const inBand = results
    .filter((r) => r.estMaxDdPct >= targetMinDdPct && r.estMaxDdPct <= targetMaxDdPct)
    .sort((a, b) => a.estMaxDdPct - b.estMaxDdPct);

  if (inBand.length > 0) return inBand[0];

  const sortedByDistance = [...results].sort((a, b) => {
    const da = Math.abs(a.estMaxDdPct - targetMaxDdPct);
    const db = Math.abs(b.estMaxDdPct - targetMaxDdPct);
    return da - db;
  });
  return sortedByDistance[0];
}
