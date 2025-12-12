export interface MissedProfitTrade {
  id?: string | number;
  premiumUsed: number; // entry debit/credit absolute dollars
  plDollar: number; // actual exit P/L in dollars
  plPercent: number; // actual exit P/L %
  maxProfitPct: number; // MFE as percent return
  maxLossPct?: number; // MAE as percent return (not used yet)
  strategyName?: string;
  openedOn?: Date | string;
  closedOn?: Date | string;
}

export interface MissedProfitDetail {
  trade: MissedProfitTrade;
  missedPct: number;
  missedDollar: number;
  captureEfficiency: number; // 0..1
}

export interface MissedProfitResult {
  totalMissedDollar: number;
  totalMissedPct: number;
  avgMissedPct: number;
  avgMissedDollar: number;
  tradesAnalyzed: number;
  bestCapturedPct: number; // lowest missed pct
  worstMissedPct: number; // highest missed pct
  details: MissedProfitDetail[];
  byStrategy: {
    strategy: string;
    missedDollar: number;
    missedPct: number;
    trades: number;
    plDollarActual: number;
    premiumUsedTotal: number;
  }[];
  histogram: { bucket: string; count: number }[];
}

export function analyzeMissedProfit(trades: MissedProfitTrade[]): MissedProfitResult {
  let totalMissedDollar = 0;
  let totalMissedPct = 0;
  let bestCapturedPct = Number.POSITIVE_INFINITY;
  let worstMissedPct = 0;

  const details: MissedProfitDetail[] = trades.map((t) => {
    const premium = Math.abs(t.premiumUsed) || 0;
    const actualPct = t.plPercent || 0;

    let missedPct = (t.maxProfitPct || 0) - actualPct;
    if (missedPct < 0) missedPct = 0;

    const missedDollar = (missedPct / 100) * premium;
    const efficiency =
      (t.maxProfitPct || 0) > 0 ? Math.max(0, Math.min(1, actualPct / t.maxProfitPct)) : 0;

    totalMissedDollar += missedDollar;
    totalMissedPct += missedPct;
    bestCapturedPct = Math.min(bestCapturedPct, missedPct);
    worstMissedPct = Math.max(worstMissedPct, missedPct);

    return {
      trade: t,
      missedPct,
      missedDollar,
      captureEfficiency: efficiency,
    };
  });

  const byStrategyMap = new Map<
    string,
    {
      strategy: string;
      missedDollar: number;
      missedPct: number;
      trades: number;
      plDollarActual: number;
      premiumUsedTotal: number;
    }
  >();
  details.forEach((d) => {
    const key = d.trade.strategyName || "Unknown";
    if (!byStrategyMap.has(key)) {
      byStrategyMap.set(key, {
        strategy: key,
        missedDollar: 0,
        missedPct: 0,
        trades: 0,
        plDollarActual: 0,
        premiumUsedTotal: 0,
      });
    }
    const agg = byStrategyMap.get(key)!;
    agg.missedDollar += d.missedDollar;
    agg.missedPct += d.missedPct;
    agg.trades += 1;
    agg.plDollarActual += d.trade.plDollar || 0;
    agg.premiumUsedTotal += Math.abs(d.trade.premiumUsed || 0);
  });

  const histogram = buildHistogram(details.map((d) => d.missedPct));

  return {
    totalMissedDollar,
    totalMissedPct,
    avgMissedPct: trades.length > 0 ? totalMissedPct / trades.length : 0,
    avgMissedDollar: trades.length > 0 ? totalMissedDollar / trades.length : 0,
    tradesAnalyzed: trades.length,
    bestCapturedPct: bestCapturedPct === Number.POSITIVE_INFINITY ? 0 : bestCapturedPct,
    worstMissedPct,
    details,
    byStrategy: Array.from(byStrategyMap.values()).sort(
      (a, b) => b.missedDollar - a.missedDollar
    ),
    histogram,
  };
}

function buildHistogram(values: number[], bucketSize = 10): { bucket: string; count: number }[] {
  if (values.length === 0) return [];
  const buckets = new Map<string, number>();
  values.forEach((v) => {
    const bucketFloor = Math.floor(v / bucketSize) * bucketSize;
    const label = `${bucketFloor}-${bucketFloor + bucketSize}%`;
    buckets.set(label, (buckets.get(label) || 0) + 1);
  });
  return Array.from(buckets.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => {
      const [aStart] = a.bucket.split("-").map((x) => parseFloat(x));
      const [bStart] = b.bucket.split("-").map((x) => parseFloat(x));
      return aStart - bStart;
    });
}
