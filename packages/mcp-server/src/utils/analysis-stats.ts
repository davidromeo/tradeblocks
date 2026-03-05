/**
 * Shared Analysis Statistics
 *
 * Reusable stat computation extracted from analyze_regime_performance.
 * Used by portfolio_structure_map, analyze_structure_fit, and
 * analyze_regime_performance to compute per-slice statistics from P&L arrays.
 */

/**
 * Statistics for a slice (segment, bucket, group) of trades.
 */
export interface SliceStats {
  tradeCount: number;
  wins: number;
  losses: number;
  /** Win rate as percentage (0-100) */
  winRate: number;
  totalPl: number;
  avgPl: number;
  avgWin: number;
  avgLoss: number;
  /** Gross wins / gross losses. null if no losses but has wins. 0 if no wins or empty. */
  profitFactor: number | null;
}

/**
 * Round a number to 2 decimal places.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute statistics for an array of P&L values.
 * Wins are P&L > 0, losses are P&L <= 0.
 * All numeric values are rounded to 2 decimal places.
 *
 * @param pls - Array of P&L values (positive = win, zero/negative = loss)
 * @returns Computed slice statistics
 */
export function computeSliceStats(pls: number[]): SliceStats {
  if (pls.length === 0) {
    return {
      tradeCount: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPl: 0,
      avgPl: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
    };
  }

  const winPls = pls.filter((p) => p > 0);
  const lossPls = pls.filter((p) => p <= 0);

  const wins = winPls.length;
  const losses = lossPls.length;
  const winRate = (wins / pls.length) * 100;
  const totalPl = pls.reduce((sum, p) => sum + p, 0);
  const avgPl = totalPl / pls.length;

  const avgWin = wins > 0 ? winPls.reduce((s, p) => s + p, 0) / wins : 0;
  const avgLoss = losses > 0 ? lossPls.reduce((s, p) => s + p, 0) / losses : 0;

  const grossWins = winPls.reduce((s, p) => s + p, 0);
  const grossLosses = Math.abs(lossPls.reduce((s, p) => s + p, 0));

  let profitFactor: number | null;
  if (grossLosses > 0) {
    profitFactor = grossWins / grossLosses;
  } else if (grossWins > 0) {
    profitFactor = null; // All winners, no losses to divide by
  } else {
    profitFactor = 0;
  }

  return {
    tradeCount: pls.length,
    wins,
    losses,
    winRate: round2(winRate),
    totalPl: round2(totalPl),
    avgPl: round2(avgPl),
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    profitFactor: profitFactor !== null ? round2(profitFactor) : null,
  };
}
