export interface TPAnalysisTrade {
  id?: string | number;
  strategyName: string;
  premiumUsed: number;
  pl: number;
  plPercent: number;
  maxProfitPct: number;
}

export interface StrategyTPSummary {
  strategy: string;
  trades: number;
  actualPL: number;
  actualCapturePct: number;
  bestTPPct: number | null;
  optimizedPL: number;
  optimizedCapturePct: number;
  extraProfit: number;
  extraCapturePct: number;
}

/**
 * Compute per-strategy single-TP optimization using MFE (maxProfitPct).
 * For each strategy, sweep TP% levels and pick the TP that yields the highest net P/L.
 */
export function computeSingleTPSummary(
  trades: TPAnalysisTrade[],
  tpGrid: number[] = [20, 40, 60, 80, 100, 120, 140, 160, 200]
): StrategyTPSummary[] {
  const byStrategy = new Map<string, TPAnalysisTrade[]>();

  trades.forEach((t) => {
    const key = t.strategyName || "Unknown";
    if (!byStrategy.has(key)) byStrategy.set(key, []);
    byStrategy.get(key)!.push(t);
  });

  const results: StrategyTPSummary[] = [];

  byStrategy.forEach((stratTrades, strategy) => {
    if (stratTrades.length === 0) return;

    const actualPL = stratTrades.reduce((sum, t) => sum + (t.pl || 0), 0);
    const totalPremium = stratTrades.reduce(
      (sum, t) => sum + Math.max(0, t.premiumUsed || 0),
      0
    );
    const actualCapturePct =
      totalPremium > 0 ? (actualPL / totalPremium) * 100 : 0;

    let bestTPPct: number | null = null;
    let bestOptimizedPL = actualPL;
    let bestCapturePct = actualCapturePct;

    for (const tp of tpGrid) {
      let simulatedPL = 0;

      for (const t of stratTrades) {
        const basis = Math.max(0, t.premiumUsed || 0);
        const maxPct = t.maxProfitPct ?? 0;
        const actualPl = t.pl || 0;

        if (basis <= 0 || maxPct <= 0) {
          simulatedPL += actualPl;
          continue;
        }

        const maxDollar = (maxPct / 100) * basis;
        const tpPctEffective = Math.min(tp, maxPct);
        const profitAtTP = (tpPctEffective / maxPct) * maxDollar;
        const tradeSimPL = actualPl < 0 ? actualPl : profitAtTP;

        simulatedPL += tradeSimPL;
      }

      const capPct =
        totalPremium > 0 ? (simulatedPL / totalPremium) * 100 : 0;

      if (
        bestTPPct === null ||
        simulatedPL > bestOptimizedPL ||
        (simulatedPL === bestOptimizedPL && capPct > bestCapturePct)
      ) {
        bestTPPct = tp;
        bestOptimizedPL = simulatedPL;
        bestCapturePct = capPct;
      }
    }

    results.push({
      strategy,
      trades: stratTrades.length,
      actualPL,
      actualCapturePct,
      bestTPPct,
      optimizedPL: bestOptimizedPL,
      optimizedCapturePct: bestCapturePct,
      extraProfit: bestOptimizedPL - actualPL,
      extraCapturePct: bestCapturePct - actualCapturePct,
    });
  });

  return results.sort((a, b) => b.extraProfit - a.extraProfit);
}
