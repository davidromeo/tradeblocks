/**
 * Greeks Decomposition Engine
 *
 * Decomposes a replay P&L path into ranked greek factor contributions
 * (delta, gamma, theta, vega, residual) with optional per-leg-group vega
 * attribution for calendar/double-calendar strategies.
 *
 * Pure logic module — no I/O, no DuckDB, no fetch.
 *
 * References:
 * - D-07: Factor contributions ranked by absolute magnitude
 * - D-08: Per-leg-group vega attribution (front vs back month)
 * - D-09: Step-by-step decomposition formula
 */

import type { PnlPoint, ReplayLeg } from './trade-replay.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FactorName = 'delta' | 'gamma' | 'theta' | 'vega' | 'residual';

export interface FactorContribution {
  factor: FactorName;
  totalPnl: number;          // Sum of step contributions
  pctOfTotal: number;        // % of total abs P&L move
  steps: number[];           // Per-step contribution values
}

export interface LegGroupVega {
  label: string;             // e.g., "front_month", "back_month"
  legIndices: number[];      // Which legs are in this group
  totalVegaPnl: number;      // Sum of vega P&L for this group
  avgIvChange: number;       // Average IV change for this group's legs
  steps: number[];           // Per-step vega contribution for this group
}

export interface GreeksDecompositionResult {
  factors: FactorContribution[];  // Sorted by abs(totalPnl) descending
  legGroupVega?: LegGroupVega[];  // Per-leg-group vega attribution
  totalPnlChange: number;         // Actual P&L change from first to last point
  totalAttributed: number;        // Sum of factor contributions (excl residual)
  totalResidual: number;          // Total residual
  stepCount: number;              // Number of steps (pnlPath.length - 1)
  summary: string;                // Human-readable summary
}

export interface LegGroupDef {
  label: string;
  legIndices: number[];
}

export interface GreeksDecompositionConfig {
  pnlPath: PnlPoint[];
  legs: ReplayLeg[];
  underlyingPrices?: Map<string, number>;  // timestamp -> underlying price
  legGroups?: LegGroupDef[];               // Optional leg grouping for per-group vega
}

// ---------------------------------------------------------------------------
// Time delta helper
// ---------------------------------------------------------------------------

const TRADING_MINUTES_PER_DAY = 390;

/**
 * Compute time delta in trading days between two timestamps.
 * Format: "YYYY-MM-DD HH:MM"
 *
 * Same day: minutes difference / 390
 * Cross day: calendar day difference (simplified — treats each gap as 1 day)
 */
export function computeTimeDeltaDays(ts1: string, ts2: string): number {
  const [date1, time1] = ts1.split(' ');
  const [date2, time2] = ts2.split(' ');

  if (date1 === date2) {
    // Same day: count minutes difference
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    const mins1 = h1 * 60 + m1;
    const mins2 = h2 * 60 + m2;
    const diffMins = Math.abs(mins2 - mins1);
    return diffMins / TRADING_MINUTES_PER_DAY;
  }

  // Cross-day: compute calendar day difference
  const d1 = new Date(date1 + 'T12:00:00'); // noon to avoid DST issues
  const d2 = new Date(date2 + 'T12:00:00');
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  // Add fractional day from time within each day
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  // Fraction of trading day for ts2's time (from market open ~9:30)
  const minsIntoDay2 = (h2 * 60 + m2) - (9 * 60 + 30);
  const fracDay2 = Math.max(0, minsIntoDay2) / TRADING_MINUTES_PER_DAY;
  // Fraction remaining in ts1's day
  const minsIntoDay1 = (h1 * 60 + m1) - (9 * 60 + 30);
  const fracDayRemaining1 = Math.max(0, 1 - minsIntoDay1 / TRADING_MINUTES_PER_DAY);

  // Total: remaining fraction of day1 + (diffDays - 1) full days + fraction of day2
  if (diffDays <= 1) {
    return fracDayRemaining1 + fracDay2;
  }
  return fracDayRemaining1 + (diffDays - 1) + fracDay2;
}

// ---------------------------------------------------------------------------
// Core decomposition
// ---------------------------------------------------------------------------

/**
 * Decompose a replay P&L path into ranked greek factor contributions.
 *
 * For each consecutive pair of points:
 *   delta_pnl = netDelta * underlyingChange
 *   gamma_pnl = 0.5 * netGamma * underlyingChange^2
 *   theta_pnl = netTheta * dt (days)
 *   vega_pnl  = netVega * ivChange (IV change in percentage points)
 *   residual  = actualChange - (delta + gamma + theta + vega)
 */
export function decomposeGreeks(config: GreeksDecompositionConfig): GreeksDecompositionResult {
  const { pnlPath, legs, underlyingPrices, legGroups } = config;

  // Edge case: empty or single-point path
  if (pnlPath.length <= 1) {
    const emptyFactors: FactorContribution[] = [
      { factor: 'delta', totalPnl: 0, pctOfTotal: 0, steps: [] },
      { factor: 'gamma', totalPnl: 0, pctOfTotal: 0, steps: [] },
      { factor: 'theta', totalPnl: 0, pctOfTotal: 0, steps: [] },
      { factor: 'vega', totalPnl: 0, pctOfTotal: 0, steps: [] },
      { factor: 'residual', totalPnl: 0, pctOfTotal: 0, steps: [] },
    ];
    return {
      factors: emptyFactors,
      legGroupVega: legGroups ? legGroups.map(g => ({
        label: g.label,
        legIndices: g.legIndices,
        totalVegaPnl: 0,
        avgIvChange: 0,
        steps: [],
      })) : undefined,
      totalPnlChange: 0,
      totalAttributed: 0,
      totalResidual: 0,
      stepCount: 0,
      summary: 'No P&L path to decompose (0 steps)',
    };
  }

  const stepCount = pnlPath.length - 1;

  // Accumulators for each factor
  const deltaSteps: number[] = [];
  const gammaSteps: number[] = [];
  const thetaSteps: number[] = [];
  const vegaSteps: number[] = [];
  const residualSteps: number[] = [];

  // Per-leg-group vega accumulators
  const groupSteps: number[][] | undefined = legGroups
    ? legGroups.map(() => [] as number[])
    : undefined;

  for (let i = 0; i < stepCount; i++) {
    const cur = pnlPath[i];
    const next = pnlPath[i + 1];

    const actualChange = next.strategyPnl - cur.strategyPnl;

    // Underlying price change
    let underlyingChange = 0;
    if (underlyingPrices) {
      const p1 = underlyingPrices.get(cur.timestamp);
      const p2 = underlyingPrices.get(next.timestamp);
      if (p1 !== undefined && p2 !== undefined) {
        underlyingChange = p2 - p1;
      }
    }

    // Time delta in days
    const dt = computeTimeDeltaDays(cur.timestamp, next.timestamp);

    // IV change: average across legs, converted to percentage points
    let ivChange = 0;
    if (cur.legGreeks && next.legGreeks) {
      let ivSum = 0;
      let ivCount = 0;
      const legCount = Math.min(cur.legGreeks.length, next.legGreeks.length);
      for (let j = 0; j < legCount; j++) {
        const iv1 = cur.legGreeks[j]?.iv;
        const iv2 = next.legGreeks[j]?.iv;
        if (iv1 !== null && iv1 !== undefined && iv2 !== null && iv2 !== undefined) {
          ivSum += (iv2 - iv1);
          ivCount++;
        }
      }
      if (ivCount > 0) {
        // Convert from decimal to percentage points (vega is per 1% IV move)
        ivChange = (ivSum / ivCount) * 100;
      }
    }

    // Factor contributions per D-09
    const deltaPnl = (cur.netDelta ?? 0) * underlyingChange;
    const gammaPnl = 0.5 * (cur.netGamma ?? 0) * underlyingChange * underlyingChange;
    const thetaPnl = (cur.netTheta ?? 0) * dt;
    const vegaPnl = (cur.netVega ?? 0) * ivChange;
    const residual = actualChange - deltaPnl - gammaPnl - thetaPnl - vegaPnl;

    deltaSteps.push(deltaPnl);
    gammaSteps.push(gammaPnl);
    thetaSteps.push(thetaPnl);
    vegaSteps.push(vegaPnl);
    residualSteps.push(residual);

    // Per-leg-group vega attribution
    if (legGroups && groupSteps && cur.legGreeks && next.legGreeks) {
      for (let g = 0; g < legGroups.length; g++) {
        const group = legGroups[g];
        let groupVegaPnl = 0;

        for (const j of group.legIndices) {
          if (j >= legs.length) continue;
          const curGreek = cur.legGreeks[j];
          const nextGreek = next.legGreeks[j];
          if (!curGreek || !nextGreek) continue;

          // Per-leg vega (position-weighted)
          const legVega = (curGreek.vega ?? 0) * legs[j].quantity * legs[j].multiplier / 100;

          // Per-leg IV change in percentage points
          const legIv1 = curGreek.iv;
          const legIv2 = nextGreek.iv;
          let legIvChange = 0;
          if (legIv1 !== null && legIv1 !== undefined && legIv2 !== null && legIv2 !== undefined) {
            legIvChange = (legIv2 - legIv1) * 100;
          }

          groupVegaPnl += legVega * legIvChange;
        }

        groupSteps[g].push(groupVegaPnl);
      }
    } else if (groupSteps) {
      // No greeks at this step — zero contribution for all groups
      for (let g = 0; g < legGroups!.length; g++) {
        groupSteps[g].push(0);
      }
    }
  }

  // Build factor contributions
  const sumSteps = (steps: number[]): number => steps.reduce((s, v) => s + v, 0);

  const rawFactors: Array<{ factor: FactorName; totalPnl: number; steps: number[] }> = [
    { factor: 'delta', totalPnl: sumSteps(deltaSteps), steps: deltaSteps },
    { factor: 'gamma', totalPnl: sumSteps(gammaSteps), steps: gammaSteps },
    { factor: 'theta', totalPnl: sumSteps(thetaSteps), steps: thetaSteps },
    { factor: 'vega', totalPnl: sumSteps(vegaSteps), steps: vegaSteps },
    { factor: 'residual', totalPnl: sumSteps(residualSteps), steps: residualSteps },
  ];

  // Sort by abs(totalPnl) descending
  rawFactors.sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl));

  // Compute pctOfTotal
  const totalAbsSum = rawFactors.reduce((s, f) => s + Math.abs(f.totalPnl), 0);
  const factors: FactorContribution[] = rawFactors.map(f => ({
    ...f,
    pctOfTotal: totalAbsSum > 0 ? (Math.abs(f.totalPnl) / totalAbsSum) * 100 : 0,
  }));

  const totalPnlChange = pnlPath[pnlPath.length - 1].strategyPnl - pnlPath[0].strategyPnl;
  const totalResidual = sumSteps(residualSteps);
  const totalAttributed = sumSteps(deltaSteps) + sumSteps(gammaSteps) + sumSteps(thetaSteps) + sumSteps(vegaSteps);

  // Build leg group vega results
  let legGroupVega: LegGroupVega[] | undefined;
  if (legGroups && groupSteps) {
    legGroupVega = legGroups.map((group, g) => {
      const steps = groupSteps[g];
      const totalVegaPnl = sumSteps(steps);

      // Average IV change across group's legs over all steps
      let totalIvChange = 0;
      let ivStepCount = 0;
      for (let i = 0; i < stepCount; i++) {
        const cur = pnlPath[i];
        const next = pnlPath[i + 1];
        if (!cur.legGreeks || !next.legGreeks) continue;

        for (const j of group.legIndices) {
          const iv1 = cur.legGreeks[j]?.iv;
          const iv2 = next.legGreeks[j]?.iv;
          if (iv1 !== null && iv1 !== undefined && iv2 !== null && iv2 !== undefined) {
            totalIvChange += (iv2 - iv1) * 100;
            ivStepCount++;
          }
        }
      }

      return {
        label: group.label,
        legIndices: group.legIndices,
        totalVegaPnl,
        avgIvChange: ivStepCount > 0 ? totalIvChange / ivStepCount : 0,
        steps,
      };
    });
  }

  // Build summary
  const summaryParts = factors
    .filter(f => f.factor !== 'residual')
    .map(f => `${f.factor} ${f.totalPnl.toFixed(2)} (${f.pctOfTotal.toFixed(0)}%)`);
  const residualFactor = factors.find(f => f.factor === 'residual');
  if (residualFactor && residualFactor.totalPnl !== 0) {
    summaryParts.push(`residual ${residualFactor.totalPnl.toFixed(2)} (${residualFactor.pctOfTotal.toFixed(0)}%)`);
  }
  const summary = `P&L of ${totalPnlChange.toFixed(2)}: ${summaryParts.join(', ')}`;

  return {
    factors,
    legGroupVega,
    totalPnlChange,
    totalAttributed,
    totalResidual,
    stepCount,
    summary,
  };
}
