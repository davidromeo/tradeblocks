import { analyzeMissedProfit, MissedProfitTrade } from "./missed-profit-analyzer";
import { simulateTPGrid } from "./tp-grid-optimizer";

export interface StrategyComparisonRow {
  strategy: string;
  actualPL: number;
  missedProfit: number;
  bestTP?: number;
  optimizedPL?: number;
  improvement?: number;
}

export interface StrategyComparisonResult {
  rows: StrategyComparisonRow[];
}

export function buildStrategyComparison(trades: MissedProfitTrade[]): StrategyComparisonResult {
  const missed = analyzeMissedProfit(trades);
  const tp = simulateTPGrid(trades);

  const actualByStrategy = new Map<string, number>();
  trades.forEach((t) => {
    const key = t.strategyName || "Unknown";
    const actualPL =
      typeof t.plDollar === "number"
        ? t.plDollar
        : (t.plPercent / 100) * Math.abs(t.premiumUsed || 0);
    actualByStrategy.set(key, (actualByStrategy.get(key) || 0) + actualPL);
  });

  const rows = new Map<string, StrategyComparisonRow>();

  missed.byStrategy.forEach((m) => {
    rows.set(m.strategy, {
      strategy: m.strategy,
      actualPL: actualByStrategy.get(m.strategy) || 0,
      missedProfit: m.missedDollar,
    });
  });

  tp.strategies.forEach((s) => {
    const row = rows.get(s.strategy) || {
      strategy: s.strategy,
      actualPL: actualByStrategy.get(s.strategy) || 0,
      missedProfit: 0,
    };
    if (s.bestTP) {
      row.bestTP = s.bestTP.tpPercent;
      row.optimizedPL = s.bestTP.netPL;
      row.improvement = (row.optimizedPL || 0) - (row.actualPL || 0);
    }
    rows.set(s.strategy, row);
  });

  const ordered = Array.from(rows.values()).sort(
    (a, b) => (b.optimizedPL || b.actualPL) - (a.optimizedPL || a.actualPL)
  );

  return { rows: ordered };
}
