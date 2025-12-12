export interface DailyPnLPoint {
  date: string; // "2023-05-01"
  pl: number;  // portfolio P/L for that day (backtest basis)
}

export interface KellyV3StrategyInput {
  name: string;
  pf: number;
  romPct: number;
  avgFundsPctPerTrade: number;
  marginSpikeFactor?: number;
  tier?: number;
}

export interface KellyV3Row {
  name: string;
  pf: number;
  romPct: number;
  marginSpikeFactor: number;
  rawKellyPct: number;
  baseKellyPct: number;
  finalKellyPct: number;
}

export interface KellyV3CurvePoint {
  scale: number;     // 0.55, 0.80, 0.85, 0.90, 1.00
  maxDdPct: number;  // max drawdown %
  cagrPct: number;   // CAGR %
}

export interface KellyV3Params {
  dailyPnl: DailyPnLPoint[];
  startingCapital: number;
  targetMaxDdPct: number;
  strategies: KellyV3StrategyInput[];
  lockRealizedWeights: boolean;
}

export interface KellyV3Result {
  baselineMaxDdPct: number;
  portfolioKellyScale: number;
  estMaxDdPct: number;
  rows: KellyV3Row[];
  curve: KellyV3CurvePoint[];
}

function computeEquityCurve(dailyPnl: DailyPnLPoint[], startingCapital: number, scale: number): number[] {
  const equity: number[] = [];
  let current = startingCapital;
  for (const p of dailyPnl) {
    current += p.pl * scale;
    equity.push(current);
  }
  return equity;
}

function computeMaxDrawdownPct(equity: number[]): number {
  if (!equity.length) return 0;
  let peak = equity[0];
  let maxDd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd * 100;
}

function computeCagrPct(equity: number[], startingCapital: number, tradingDaysPerYear = 252): number {
  if (!equity.length || startingCapital <= 0) return 0;
  const ending = equity[equity.length - 1];
  const years = equity.length / tradingDaysPerYear;
  if (years <= 0) return 0;
  const cagr = Math.pow(ending / startingCapital, 1 / years) - 1;
  return cagr * 100;
}

export function computeAdvancedKellyV3(params: KellyV3Params): KellyV3Result {
  const { dailyPnl, startingCapital, targetMaxDdPct, strategies, lockRealizedWeights } = params;

  if (!dailyPnl.length || !strategies.length || startingCapital <= 0) {
    return {
      baselineMaxDdPct: 0,
      portfolioKellyScale: 1,
      estMaxDdPct: 0,
      rows: [],
      curve: [],
    };
  }

  // Baseline equity and DD at 1.0x
  const baselineEquity = computeEquityCurve(dailyPnl, startingCapital, 1.0);
  const baselineMaxDdPct = computeMaxDrawdownPct(baselineEquity);

  // Curve across candidate scales
  const candidateScales = [0.55, 0.8, 0.85, 0.9, 1.0];
  const curve: KellyV3CurvePoint[] = candidateScales.map((scale) => {
    const eq = computeEquityCurve(dailyPnl, startingCapital, scale);
    return {
      scale,
      maxDdPct: computeMaxDrawdownPct(eq),
      cagrPct: computeCagrPct(eq, startingCapital),
    };
  });

  // Choose scale closest to target DD (prefer under target)
  const clippedTarget = Math.max(5, Math.min(40, targetMaxDdPct || baselineMaxDdPct));
  let chosen = curve[0];
  for (const pt of curve) {
    if (pt.maxDdPct <= clippedTarget) {
      if (pt.maxDdPct > chosen.maxDdPct || chosen.maxDdPct > clippedTarget) {
        chosen = pt;
      }
    }
  }
  if (chosen.maxDdPct > clippedTarget) {
    chosen = curve.reduce((best, pt) => (pt.maxDdPct < best.maxDdPct ? pt : best));
  }
  const portfolioKellyScale = chosen.scale;
  const estMaxDdPct = chosen.maxDdPct;

  // Risk weights
  const riskScores = strategies.map((s) => {
    const pfEdge = Math.max(0, s.pf - 1);
    const romBoost = 1 + s.romPct / 50;
    const marginPenalty = 1 + (s.marginSpikeFactor ?? 0);
    const tierPenalty = s.tier === 1 ? 1 : s.tier === 2 ? 1.1 : 1.25;
    let score = (pfEdge * romBoost) / (marginPenalty * tierPenalty);
    if (score <= 0 && s.avgFundsPctPerTrade > 0) {
      score = s.avgFundsPctPerTrade / 100;
    }
    return Math.max(score, 0.0001);
  });

  const totalRisk = riskScores.reduce((a, b) => a + b, 0) || 1;
  let realizedTotal = strategies.reduce((sum, s) => sum + (s.avgFundsPctPerTrade || 0), 0);
  if (realizedTotal <= 0) realizedTotal = 1;

  const rows: KellyV3Row[] = strategies.map((s, idx) => {
    const marginSpikeFactor = s.marginSpikeFactor ?? 0;
    const baseWeight = lockRealizedWeights
      ? (s.avgFundsPctPerTrade || 0.01) / realizedTotal
      : riskScores[idx] / totalRisk;
    const rawKellyPct = baseWeight * 100;
    const baseKellyPct = rawKellyPct;
    const finalKellyPct = baseKellyPct * portfolioKellyScale;
    return {
      name: s.name,
      pf: s.pf,
      romPct: s.romPct,
      marginSpikeFactor,
      rawKellyPct,
      baseKellyPct,
      finalKellyPct,
    };
  });

  return {
    baselineMaxDdPct,
    portfolioKellyScale,
    estMaxDdPct,
    rows,
    curve,
  };
}
