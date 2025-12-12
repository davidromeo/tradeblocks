export interface KellyMetricInput {
  name: string;
  pf?: number; // profit factor
  rom?: number; // ROM% (return on margin)
  maxMarginUsed?: number; // absolute dollars of max margin/premium used
  clusterCorrelation?: number; // average correlation within cluster (0-1 range expected)
}

/**
 * Normalize a numeric series to 0..1. If min==max or no finite values, returns 0.5 for all.
 */
function minMax(values: number[]): (v: number | undefined) => number {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return () => 0.5;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max === min) return () => 0.5;
  return (v) => {
    if (v === undefined || !Number.isFinite(v)) return 0.5;
    return (v - min) / (max - min);
  };
}

/**
 * Compute advanced Kelly weights per strategy using PF, ROM%, margin spikes, and correlation.
 * Returns a map of strategy name -> weight percentage (sums to 100).
 */
export function computeAdvancedKelly(strategies: KellyMetricInput[]): Record<string, number> {
  if (strategies.length === 0) return {};

  const pfNorm = minMax(strategies.map((s) => s.pf ?? 0));
  const romNorm = minMax(strategies.map((s) => s.rom ?? 0));

  const scores = strategies.map((s) => {
    const pfScore = pfNorm(s.pf ?? 0);
    const romScore = romNorm(s.rom ?? 0);

    // Margin penalty: heavier margin use -> lower score (bounded to keep >0)
    const marginVal = s.maxMarginUsed ?? 0;
    const marginPenalty = 1 / (1 + Math.log1p(Math.max(0, marginVal)));

    // Correlation penalty: higher intra-cluster corr -> lower score
    const corrVal = Math.max(0, Math.min(1, s.clusterCorrelation ?? 0));
    const corrPenalty = 1 / (1 + corrVal);

    // Even weights across factors; tune later if needed
    const score = 0.25 * pfScore + 0.25 * romScore + 0.25 * marginPenalty + 0.25 * corrPenalty;
    return { name: s.name, score };
  });

  const total = scores.reduce((sum, s) => sum + s.score, 0);
  if (total <= 0) {
    const even = 100 / strategies.length;
    return strategies.reduce<Record<string, number>>((acc, s) => {
      acc[s.name] = even;
      return acc;
    }, {});
  }

  return scores.reduce<Record<string, number>>((acc, s) => {
    acc[s.name] = (s.score / total) * 100;
    return acc;
  }, {});
}
