/**
 * greeks-attribution.ts
 *
 * MCP tool: get_greeks_attribution
 *
 * Decomposes a block's P&L into Greek components. Two modes:
 *   - summary: block-level attribution percentages across all trades
 *   - instance: single trade time-series of Greek P&L contributions
 */

import type { FactorContribution } from "../utils/greeks-decomposition.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttributionEntry {
  factor: string;
  pnl: number;
  pct: number;
}

export interface AttributionSummaryResult {
  block_id: string;
  trades_decomposed: number;
  trades_skipped: number;
  trades_total: number;
  total_pnl: number;
  attribution: AttributionEntry[];
  precision: "high" | "low";
  hint?: string;
}

export interface AttributionStepEntry {
  date: string;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  residual: number;
  charm?: number;
  vanna?: number;
}

export interface AttributionInstanceResult {
  block_id: string;
  trade_index: number;
  trade_date: string;
  total_pnl: number;
  steps: AttributionStepEntry[];
  attribution: AttributionEntry[];
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

const COLLAPSE_MAP: Record<string, string> = {
  charm: "delta",
  vanna: "vega",
};

const FACTOR_ORDER: string[] = ["theta", "vega", "delta", "gamma", "residual", "charm", "vanna"];

export function collapseFactors(
  factors: FactorContribution[],
  detailed: boolean,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const f of factors) {
    const targetName = (!detailed && COLLAPSE_MAP[f.factor]) || f.factor;
    totals.set(targetName, (totals.get(targetName) ?? 0) + f.totalPnl);
  }
  return totals;
}

export function computeAttribution(
  totals: Map<string, number>,
  totalPnl: number,
): AttributionEntry[] {
  const entries: AttributionEntry[] = [];
  for (const [factor, pnl] of totals) {
    entries.push({
      factor,
      pnl: Math.round(pnl * 100) / 100,
      pct: totalPnl !== 0 ? Math.round((pnl / totalPnl) * 1000) / 10 : 0,
    });
  }
  entries.sort((a, b) => {
    const ai = FACTOR_ORDER.indexOf(a.factor);
    const bi = FACTOR_ORDER.indexOf(b.factor);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return entries;
}

export function assessPrecision(
  residualPnl: number,
  totalPnl: number,
): { precision: "high" | "low"; hint?: string } {
  if (totalPnl === 0) return { precision: "high" };
  const residualPct = Math.abs(residualPnl / totalPnl) * 100;
  if (residualPct > 25) {
    return {
      precision: "low",
      hint: `Residual is ${Math.round(residualPct)}%. Re-run with skip_quotes=false for NBBO-based pricing.`,
    };
  }
  return { precision: "high" };
}
