import { MissedProfitTrade } from "./missed-profit-analyzer";

export interface TPResult {
  tpPercent: number;
  netPL: number;
  winRate: number;
  avgPL: number;
  trades: number;
}

export interface StrategyTPRecommendation {
  strategy: string;
  bestTP: TPResult | null;
  grid: TPResult[];
}

export interface TPOptimizerResult {
  strategies: StrategyTPRecommendation[];
  gridPoints: number[];
}

/**
 * Simulate single take-profit exits across a grid of TP percentages.
 * Assumes each trade has premiumUsed (absolute dollars), plPercent (actual),
 * and maxProfitPct (MFE).
 */
export function simulateTPGrid(
  trades: MissedProfitTrade[],
  tpPercents: number[] = buildDefaultGrid()
): TPOptimizerResult {
  const byStrategy = new Map<string, MissedProfitTrade[]>();
  trades.forEach((t) => {
    const key = t.strategyName || "Unknown";
    if (!byStrategy.has(key)) byStrategy.set(key, []);
    byStrategy.get(key)!.push(t);
  });

  const strategies: StrategyTPRecommendation[] = [];

  byStrategy.forEach((strategyTrades, strategy) => {
    const grid: TPResult[] = tpPercents.map((tp) => {
      let netPL = 0;
      let wins = 0;

      strategyTrades.forEach((trade) => {
        const premium = Math.abs(trade.premiumUsed || 0);
        const actualPct = trade.plPercent || 0;
        const mfe = trade.maxProfitPct || 0;
        const exitPct = mfe >= tp ? tp : actualPct;
        const plDollar = (exitPct / 100) * premium;

        netPL += plDollar;
        if (plDollar > 0) wins += 1;
      });

      const tradesCount = strategyTrades.length || 1;

      return {
        tpPercent: tp,
        netPL,
        winRate: (wins / strategyTrades.length) * 100,
        avgPL: netPL / tradesCount,
        trades: strategyTrades.length,
      };
    });

    const bestTP = grid.slice().sort((a, b) => b.netPL - a.netPL)[0] || null;
    strategies.push({ strategy, bestTP, grid });
  });

  strategies.sort((a, b) => (b.bestTP?.netPL || 0) - (a.bestTP?.netPL || 0));

  return {
    strategies,
    gridPoints: tpPercents,
  };
}

function buildDefaultGrid() {
  const points: number[] = [];
  for (let tp = 10; tp <= 300; tp += 10) {
    points.push(tp);
  }
  return points;
}
