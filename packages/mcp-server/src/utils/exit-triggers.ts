/**
 * Exit Trigger Evaluation Engine
 *
 * Pure logic module (no I/O, no DuckDB, no fetch) that evaluates 14 exit
 * trigger types against a greeks-enriched P&L path from trade replay.
 *
 * Provides the computational heart of the `analyze_exit_triggers` tool.
 */

import type { PnlPoint, ReplayLeg } from './trade-replay.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TriggerType =
  | 'profitTarget'
  | 'stopLoss'
  | 'trailingStop'
  | 'dteExit'
  | 'ditExit'
  | 'clockTimeExit'
  | 'underlyingPriceMove'
  | 'positionDelta'
  | 'perLegDelta'
  | 'vixMove'
  | 'vix9dMove'
  | 'vix9dVixRatio'
  | 'slRatioThreshold'
  | 'slRatioMove';

export interface ExitTriggerConfig {
  type: TriggerType;
  threshold: number;
  // Context-specific optional fields:
  expiry?: string;                              // YYYY-MM-DD for dteExit
  openDate?: string;                            // YYYY-MM-DD for ditExit
  clockTime?: string;                           // "HH:MM" for clockTimeExit (threshold ignored)
  trailAmount?: number;                         // Dollar trail for trailingStop
  // Data maps for triggers needing external prices:
  underlyingPrices?: Map<string, number>;        // timestamp -> price
  vixPrices?: Map<string, number>;               // timestamp -> VIX price
  vix9dPrices?: Map<string, number>;             // timestamp -> VIX9D price
  // S/L ratio inputs:
  spreadWidth?: number;                          // Width of spread in dollars
  contracts?: number;                            // Number of contracts
  multiplier?: number;                           // Default 100
}

export interface TriggerFireEvent {
  type: TriggerType;
  firedAt: string;          // Timestamp when trigger fired
  pnlAtFire: number;       // Strategy P&L when trigger fired
  index: number;            // Index into pnlPath
  detail?: string;          // Human-readable description
}

export interface ExitTriggerResult {
  triggers: TriggerFireEvent[];         // All triggers that fired (sorted by fire time)
  firstToFire: TriggerFireEvent | null; // Earliest trigger
  actualExit?: {
    timestamp: string;
    pnl: number;
    pnlDifference: number;             // firstToFire.pnl - actualExit.pnl
  };
  summary: string;
}

export interface LegGroupConfig {
  label: string;
  legIndices: number[];
  triggers: ExitTriggerConfig[];
}

export interface LegGroupResult {
  label: string;
  result: ExitTriggerResult;
  groupPnl: number[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Parse "YYYY-MM-DD" to a Date at local midnight. */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Extract date portion "YYYY-MM-DD" from timestamp "YYYY-MM-DD HH:MM". */
function extractDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/** Extract time portion "HH:MM" from timestamp "YYYY-MM-DD HH:MM". */
function extractTime(timestamp: string): string {
  return timestamp.slice(11, 16);
}

/** Calendar days between two dates (absolute). */
function calendarDaysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.abs(Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY));
}

/** Compute S/L ratio for spread positions. */
function computeSLRatio(
  point: PnlPoint,
  legs: ReplayLeg[],
  spreadWidth: number,
  contracts: number,
  multiplier: number,
): number {
  // Spread value = sum of abs(markPrice * quantity * multiplier) for short legs
  let spreadValue = 0;
  for (let i = 0; i < legs.length; i++) {
    if (legs[i].quantity < 0) {
      const markPrice = point.legPrices[i] ?? 0;
      spreadValue += Math.abs(markPrice * legs[i].quantity * legs[i].multiplier);
    }
  }
  const maxLoss = spreadWidth * contracts * multiplier;
  if (maxLoss === 0) return 0;
  return spreadValue / maxLoss;
}

// ---------------------------------------------------------------------------
// evaluateTrigger
// ---------------------------------------------------------------------------

/**
 * Evaluate a single trigger against the full P&L path.
 * Returns the first point where it fires, or null.
 */
export function evaluateTrigger(
  trigger: ExitTriggerConfig,
  pnlPath: PnlPoint[],
  legs: ReplayLeg[],
): TriggerFireEvent | null {
  if (pnlPath.length === 0) return null;

  const { type, threshold } = trigger;

  // State for triggers that track running values
  let runningMaxPnl = -Infinity;
  let initialSLRatio: number | null = null;
  let firstUnderlyingPrice: number | null = null;
  let firstVixPrice: number | null = null;
  let firstVix9dPrice: number | null = null;

  for (let i = 0; i < pnlPath.length; i++) {
    const point = pnlPath[i];
    const pnl = point.strategyPnl;

    // Update running max for trailingStop
    if (pnl > runningMaxPnl) runningMaxPnl = pnl;

    let fired = false;
    let detail: string | undefined;

    switch (type) {
      case 'profitTarget':
        if (pnl >= threshold) {
          fired = true;
          detail = `P&L $${pnl.toFixed(2)} >= target $${threshold.toFixed(2)}`;
        }
        break;

      case 'stopLoss':
        if (pnl <= -threshold) {
          fired = true;
          detail = `P&L $${pnl.toFixed(2)} <= stop -$${threshold.toFixed(2)}`;
        }
        break;

      case 'trailingStop': {
        const trailAmt = trigger.trailAmount ?? threshold;
        const dropdown = runningMaxPnl - pnl;
        if (dropdown >= trailAmt && runningMaxPnl > -Infinity) {
          fired = true;
          detail = `Dropdown $${dropdown.toFixed(2)} from max $${runningMaxPnl.toFixed(2)} >= trail $${trailAmt.toFixed(2)}`;
        }
        break;
      }

      case 'dteExit': {
        if (!trigger.expiry) break;
        const pointDate = parseDate(extractDate(point.timestamp));
        const expiryDate = parseDate(trigger.expiry);
        const dte = calendarDaysBetween(pointDate, expiryDate);
        // Only fire if point is before/on expiry
        if (pointDate <= expiryDate && dte <= threshold) {
          fired = true;
          detail = `DTE ${dte} <= threshold ${threshold}`;
        }
        break;
      }

      case 'ditExit': {
        if (!trigger.openDate) break;
        const pointDate = parseDate(extractDate(point.timestamp));
        const openDate = parseDate(trigger.openDate);
        const dit = calendarDaysBetween(openDate, pointDate);
        if (dit >= threshold) {
          fired = true;
          detail = `DIT ${dit} >= threshold ${threshold}`;
        }
        break;
      }

      case 'clockTimeExit': {
        const clockTime = trigger.clockTime ?? '15:00';
        const pointTime = extractTime(point.timestamp);
        if (pointTime >= clockTime) {
          fired = true;
          detail = `Time ${pointTime} >= ${clockTime}`;
        }
        break;
      }

      case 'underlyingPriceMove': {
        if (!trigger.underlyingPrices) break;
        const price = trigger.underlyingPrices.get(point.timestamp);
        if (price == null) break;
        if (firstUnderlyingPrice === null) {
          firstUnderlyingPrice = price;
          break; // Can't compute move on first price
        }
        const pctMove = ((price - firstUnderlyingPrice) / firstUnderlyingPrice) * 100;
        if (Math.abs(pctMove) >= threshold) {
          fired = true;
          detail = `Underlying moved ${pctMove.toFixed(2)}% (threshold ${threshold}%)`;
        }
        break;
      }

      case 'positionDelta': {
        const netDelta = point.netDelta ?? 0;
        if (Math.abs(netDelta) >= threshold) {
          fired = true;
          detail = `Net delta ${netDelta.toFixed(4)} >= threshold ${threshold}`;
        }
        break;
      }

      case 'perLegDelta': {
        if (!point.legGreeks) break;
        for (let li = 0; li < point.legGreeks.length; li++) {
          const legDelta = point.legGreeks[li].delta ?? 0;
          if (Math.abs(legDelta) >= threshold) {
            fired = true;
            detail = `Leg ${li} delta ${legDelta.toFixed(4)} >= threshold ${threshold}`;
            break;
          }
        }
        break;
      }

      case 'vixMove': {
        if (!trigger.vixPrices) break;
        const vix = trigger.vixPrices.get(point.timestamp);
        if (vix == null) break;
        if (firstVixPrice === null) {
          firstVixPrice = vix;
          break;
        }
        const pctMove = ((vix - firstVixPrice) / firstVixPrice) * 100;
        if (Math.abs(pctMove) >= threshold) {
          fired = true;
          detail = `VIX moved ${pctMove.toFixed(2)}% (threshold ${threshold}%)`;
        }
        break;
      }

      case 'vix9dMove': {
        if (!trigger.vix9dPrices) break;
        const vix9d = trigger.vix9dPrices.get(point.timestamp);
        if (vix9d == null) break;
        if (firstVix9dPrice === null) {
          firstVix9dPrice = vix9d;
          break;
        }
        const pctMove = ((vix9d - firstVix9dPrice) / firstVix9dPrice) * 100;
        if (Math.abs(pctMove) >= threshold) {
          fired = true;
          detail = `VIX9D moved ${pctMove.toFixed(2)}% (threshold ${threshold}%)`;
        }
        break;
      }

      case 'vix9dVixRatio': {
        if (!trigger.vixPrices || !trigger.vix9dPrices) break;
        const vix = trigger.vixPrices.get(point.timestamp);
        const vix9d = trigger.vix9dPrices.get(point.timestamp);
        if (vix == null || vix9d == null || vix === 0) break;
        const ratio = vix9d / vix;
        // If threshold >= 1, fire when ratio >= threshold (contango deepening)
        // If threshold < 1, fire when ratio <= threshold (backwardation)
        const crosses = threshold >= 1 ? ratio >= threshold : ratio <= threshold;
        if (crosses) {
          fired = true;
          detail = `VIX9D/VIX ratio ${ratio.toFixed(4)} crossed threshold ${threshold}`;
        }
        break;
      }

      case 'slRatioThreshold': {
        const sw = trigger.spreadWidth ?? 0;
        const ct = trigger.contracts ?? 1;
        const mp = trigger.multiplier ?? 100;
        if (sw === 0) break;
        const slRatio = computeSLRatio(point, legs, sw, ct, mp);
        if (slRatio >= threshold) {
          fired = true;
          detail = `S/L ratio ${slRatio.toFixed(4)} >= threshold ${threshold}`;
        }
        break;
      }

      case 'slRatioMove': {
        const sw = trigger.spreadWidth ?? 0;
        const ct = trigger.contracts ?? 1;
        const mp = trigger.multiplier ?? 100;
        if (sw === 0) break;
        const slRatio = computeSLRatio(point, legs, sw, ct, mp);
        if (initialSLRatio === null) {
          initialSLRatio = slRatio;
          break; // Can't compute change on first point
        }
        const change = Math.abs(slRatio - initialSLRatio);
        if (change >= threshold) {
          fired = true;
          detail = `S/L ratio change ${change.toFixed(4)} from initial ${initialSLRatio.toFixed(4)} >= threshold ${threshold}`;
        }
        break;
      }
    }

    if (fired) {
      return {
        type,
        firedAt: point.timestamp,
        pnlAtFire: pnl,
        index: i,
        detail,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// computeGroupPnl
// ---------------------------------------------------------------------------

/**
 * Compute per-group P&L at each timestamp from leg prices.
 * groupPnl[t] = sum over legIndices of (legPrices[i] - entryPrice[i]) * quantity[i] * multiplier[i]
 */
function computeGroupPnl(
  pnlPath: PnlPoint[],
  legs: ReplayLeg[],
  legIndices: number[],
): number[] {
  return pnlPath.map((point) => {
    let groupPnl = 0;
    for (const idx of legIndices) {
      if (idx < legs.length && idx < point.legPrices.length) {
        const leg = legs[idx];
        const markPrice = point.legPrices[idx];
        groupPnl += (markPrice - leg.entryPrice) * leg.quantity * leg.multiplier;
      }
    }
    return groupPnl;
  });
}

// ---------------------------------------------------------------------------
// analyzeExitTriggers
// ---------------------------------------------------------------------------

/**
 * Run all triggers against the P&L path, find first-to-fire,
 * compute actual exit comparison, and evaluate leg group triggers.
 */
export function analyzeExitTriggers(config: {
  pnlPath: PnlPoint[];
  legs: ReplayLeg[];
  triggers: ExitTriggerConfig[];
  actualExitTimestamp?: string;
  legGroups?: LegGroupConfig[];
}): {
  overall: ExitTriggerResult;
  legGroups?: LegGroupResult[];
} {
  const { pnlPath, legs, triggers, actualExitTimestamp, legGroups } = config;

  // Evaluate all triggers
  const fireEvents: TriggerFireEvent[] = [];
  for (const trigger of triggers) {
    const event = evaluateTrigger(trigger, pnlPath, legs);
    if (event) {
      fireEvents.push(event);
    }
  }

  // Sort by fire index (earliest first)
  fireEvents.sort((a, b) => a.index - b.index);

  const firstToFire = fireEvents.length > 0 ? fireEvents[0] : null;

  // Actual exit comparison
  let actualExit: ExitTriggerResult['actualExit'];
  if (actualExitTimestamp && firstToFire) {
    // Find closest point to actualExitTimestamp
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < pnlPath.length; i++) {
      // Simple string comparison — timestamps are lexicographically ordered
      const dist = Math.abs(pnlPath[i].timestamp.localeCompare(actualExitTimestamp));
      if (pnlPath[i].timestamp === actualExitTimestamp) {
        closestIdx = i;
        break;
      }
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    // Fallback: use last point if actualExitTimestamp is after all points
    if (actualExitTimestamp > pnlPath[pnlPath.length - 1].timestamp) {
      closestIdx = pnlPath.length - 1;
    }
    const actualPnl = pnlPath[closestIdx].strategyPnl;
    actualExit = {
      timestamp: pnlPath[closestIdx].timestamp,
      pnl: actualPnl,
      pnlDifference: firstToFire.pnlAtFire - actualPnl,
    };
  }

  // Build summary
  let summary: string;
  if (!firstToFire) {
    summary = `No triggers fired across ${pnlPath.length} data points.`;
  } else if (actualExit) {
    const betterWorse = actualExit.pnlDifference > 0 ? 'better' : 'worse';
    summary = `${firstToFire.type} fired at ${firstToFire.firedAt} (P&L $${firstToFire.pnlAtFire.toFixed(2)}). ` +
      `Actual exit at ${actualExit.timestamp} (P&L $${actualExit.pnl.toFixed(2)}). ` +
      `Trigger was $${Math.abs(actualExit.pnlDifference).toFixed(2)} ${betterWorse}.`;
  } else {
    summary = `${firstToFire.type} fired first at ${firstToFire.firedAt} (P&L $${firstToFire.pnlAtFire.toFixed(2)}). ` +
      `${fireEvents.length} trigger(s) fired total.`;
  }

  const overall: ExitTriggerResult = {
    triggers: fireEvents,
    firstToFire,
    actualExit,
    summary,
  };

  // Leg group evaluation
  let legGroupResults: LegGroupResult[] | undefined;
  if (legGroups && legGroups.length > 0) {
    legGroupResults = legGroups.map((group) => {
      const groupPnlArr = computeGroupPnl(pnlPath, legs, group.legIndices);

      // Build a synthetic PnlPoint[] for this group with groupPnl as strategyPnl
      const groupPath: PnlPoint[] = pnlPath.map((point, idx) => ({
        ...point,
        strategyPnl: groupPnlArr[idx],
        // Filter legPrices/legGreeks to only this group's legs
        legPrices: group.legIndices.map((li) => point.legPrices[li] ?? 0),
        legGreeks: point.legGreeks
          ? group.legIndices.map((li) => point.legGreeks![li])
          : undefined,
      }));

      // Build group legs subset
      const groupLegs = group.legIndices.map((li) => legs[li]);

      // Evaluate per-group triggers
      const groupFireEvents: TriggerFireEvent[] = [];
      for (const trigger of group.triggers) {
        const event = evaluateTrigger(trigger, groupPath, groupLegs);
        if (event) groupFireEvents.push(event);
      }
      groupFireEvents.sort((a, b) => a.index - b.index);

      const groupFirstToFire = groupFireEvents.length > 0 ? groupFireEvents[0] : null;

      // Actual exit for group
      let groupActualExit: ExitTriggerResult['actualExit'];
      if (actualExitTimestamp && groupFirstToFire) {
        let closestIdx = pnlPath.length - 1;
        for (let i = 0; i < pnlPath.length; i++) {
          if (pnlPath[i].timestamp === actualExitTimestamp) {
            closestIdx = i;
            break;
          }
        }
        if (actualExitTimestamp > pnlPath[pnlPath.length - 1].timestamp) {
          closestIdx = pnlPath.length - 1;
        }
        const actualGroupPnl = groupPnlArr[closestIdx];
        groupActualExit = {
          timestamp: pnlPath[closestIdx].timestamp,
          pnl: actualGroupPnl,
          pnlDifference: groupFirstToFire.pnlAtFire - actualGroupPnl,
        };
      }

      const groupSummary = groupFirstToFire
        ? `${group.label}: ${groupFirstToFire.type} fired at ${groupFirstToFire.firedAt} (group P&L $${groupFirstToFire.pnlAtFire.toFixed(2)})`
        : `${group.label}: No triggers fired.`;

      return {
        label: group.label,
        result: {
          triggers: groupFireEvents,
          firstToFire: groupFirstToFire,
          actualExit: groupActualExit,
          summary: groupSummary,
        },
        groupPnl: groupPnlArr,
      };
    });
  }

  return {
    overall,
    legGroups: legGroupResults,
  };
}
