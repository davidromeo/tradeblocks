import {
  MissedProfitTrade,
  analyzeMissedProfit,
} from "./missed-profit-analyzer";
import { simulateTPGrid } from "./tp-grid-optimizer";

export interface StrategyTPSummaryRow {
  strategy: string;
  trades: number;
  actualPL: number;
  actualCapturePct: number;
  totalPremium: number;
  missedDollar: number;
  missedPctAvg: number;
  bestTPPct: number | null;
  bestTPNetPL: number | null;
  deltaPL: number | null;
  improvementPct: number | null;
}

export function buildStrategyTPSummary(
  trades: MissedProfitTrade[]
): StrategyTPSummaryRow[] {
  const missed = analyzeMissedProfit(trades);
  const tp = simulateTPGrid(trades);

  const rows = missed.byStrategy.map((m) => {
    const actualPL = safeNumber(m.plDollarActual);
    const totalPremium = safeNumber(m.premiumUsedTotal);
    const actualCapturePct =
      totalPremium > 0 ? (actualPL / totalPremium) * 100 : 0;
    const missedPctAvg = m.trades > 0 ? m.missedPct / m.trades : 0;

    const tpEntry = tp.strategies.find((s) => s.strategy === m.strategy);
    const bestTPPct = tpEntry?.bestTP?.tpPercent ?? null;
    const bestTPNetPL = tpEntry?.bestTP?.netPL ?? null;
    const deltaPL =
      bestTPNetPL != null && !Number.isNaN(bestTPNetPL)
        ? bestTPNetPL - actualPL
        : null;
    const improvementPct =
      deltaPL != null && Math.abs(actualPL) > 1e-6
        ? (deltaPL / actualPL) * 100
        : null;

    return {
      strategy: m.strategy,
      trades: m.trades,
      actualPL,
      actualCapturePct,
      totalPremium,
      missedDollar: safeNumber(m.missedDollar),
      missedPctAvg,
      bestTPPct,
      bestTPNetPL,
      deltaPL,
      improvementPct,
    };
  });

  return rows.sort(
    (a, b) => (b.deltaPL ?? 0) - (a.deltaPL ?? 0)
  );
}

function safeNumber(v: number | undefined | null) {
  return Number.isFinite(v || 0) ? (v as number) : 0;
}
