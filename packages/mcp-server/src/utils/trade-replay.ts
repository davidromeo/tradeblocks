/**
 * Trade Replay Pure Logic Module
 *
 * OCC ticker construction, tradelog legs string parsing, multi-leg P&L path
 * computation with HL2 mark pricing, and MFE/MAE calculation.
 *
 * All functions are pure — no fetch, no DuckDB.
 */

import type { MassiveBarRow } from './massive-client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A parsed leg from a tradelog "legs" string (before OCC ticker resolution). */
export interface ParsedLeg {
  root: string;            // "SPY", "SPX", "SPXW"
  strike: number;          // Numeric strike price
  type: 'C' | 'P';        // Call or Put
  quantity: number;        // +1 or -1 (direction derived from position in spread)
}

/** A fully resolved leg ready for replay (after OCC ticker construction). */
export interface ReplayLeg {
  occTicker: string;       // Full OCC ticker for Massive API fetch
  quantity: number;        // Positive = long, negative = short
  entryPrice: number;      // Per-contract entry price
  multiplier: number;      // 100 for standard equity/index options
}

/** A single point on the strategy P&L path. */
export interface PnlPoint {
  timestamp: string;       // "YYYY-MM-DD HH:MM" ET
  strategyPnl: number;     // Combined P&L across all legs at this minute
  legPrices: number[];     // HL2 mark price for each leg at this minute
}

/** Complete replay result with P&L path, MFE/MAE, and metadata. */
export interface ReplayResult {
  pnlPath: PnlPoint[];
  mfe: number;             // Max of strategyPnl series
  mae: number;             // Min of strategyPnl series
  mfeTimestamp: string;    // When MFE occurred
  maeTimestamp: string;    // When MAE occurred
  totalPnl: number;        // Final P&L at last bar
  legs: ReplayLeg[];       // The legs that were replayed
}

// ---------------------------------------------------------------------------
// parseLegsString
// ---------------------------------------------------------------------------

// Compact format with root: "SPY 470C", "SPX 4500P", "SPY 0.50C"
const COMPACT_LEG_RE = /^([A-Z]+)\s+(\d+(?:\.\d+)?)\s*(C|P)$/i;

// Compact format without root (subsequent legs in spreads): "465C", "500C"
const COMPACT_NO_ROOT_RE = /^(\d+(?:\.\d+)?)\s*(C|P)$/i;

// Verbose format: "SPY Jan25 470 Call", "SPX Feb25 4500 Put"
const VERBOSE_LEG_RE = /^([A-Z]+)\s+\w+\s+(\d+(?:\.\d+)?)\s+(Call|Put)$/i;

/**
 * Parse a tradelog "legs" string into structured ParsedLeg objects.
 *
 * Supported formats:
 *   - "SPY 470C" (single leg)
 *   - "SPY 470C/465C" (two-leg spread, "/" delimiter)
 *   - "SPY 490C/500C/510C" (butterfly)
 *   - "SPY Jan25 470 Call" (verbose format)
 *
 * Convention: first leg is bought (+1), subsequent legs alternate -1, +1, -1.
 *
 * @throws Error if legs string is empty or cannot be parsed
 */
export function parseLegsString(legsStr: string): ParsedLeg[] {
  if (!legsStr || legsStr.trim() === '') {
    throw new Error('Cannot parse legs "" — use hypothetical mode with explicit strikes');
  }

  const parts = legsStr.includes('/') ? legsStr.split('/') : [legsStr];
  const legs: ParsedLeg[] = [];
  let inheritedRoot = '';

  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i].trim();
    let root: string;
    let strike: number;
    let type: 'C' | 'P';

    const compactMatch = raw.match(COMPACT_LEG_RE);
    if (compactMatch) {
      root = compactMatch[1].toUpperCase();
      strike = parseFloat(compactMatch[2]);
      type = compactMatch[3].toUpperCase() as 'C' | 'P';
    } else {
      // Try compact without root (e.g., "465C" in "SPY 470C/465C")
      const noRootMatch = raw.match(COMPACT_NO_ROOT_RE);
      if (noRootMatch && inheritedRoot) {
        root = inheritedRoot;
        strike = parseFloat(noRootMatch[1]);
        type = noRootMatch[2].toUpperCase() as 'C' | 'P';
      } else {
        const verboseMatch = raw.match(VERBOSE_LEG_RE);
        if (verboseMatch) {
          root = verboseMatch[1].toUpperCase();
          strike = parseFloat(verboseMatch[2]);
          type = verboseMatch[3].toLowerCase() === 'call' ? 'C' : 'P';
        } else {
          throw new Error(
            `Cannot parse legs "${legsStr}" — use hypothetical mode with explicit strikes`
          );
        }
      }
    }

    // Propagate root to subsequent legs that may omit it
    if (i === 0) inheritedRoot = root;

    // First leg is bought (+1), subsequent alternate -1, +1, -1...
    const quantity = i === 0 ? 1 : (i % 2 === 0 ? 1 : -1);

    legs.push({ root, strike, type, quantity });
  }

  return legs;
}

// ---------------------------------------------------------------------------
// buildOccTicker
// ---------------------------------------------------------------------------

/**
 * Build an OCC-format option ticker from components.
 *
 * Format: {root}{YYMMDD}{C|P}{strike*1000 padded to 8 digits}
 *
 * Example: SPY, 2025-01-17, C, 470 -> "SPY250117C00470000"
 */
export function buildOccTicker(
  root: string,
  expiry: string,
  type: 'C' | 'P',
  strike: number,
): string {
  // Extract YYMMDD from "YYYY-MM-DD"
  const [yyyy, mm, dd] = expiry.split('-');
  const yy = yyyy.slice(2);

  // Strike * 1000 padded to 8 digits
  const strikeInt = Math.round(strike * 1000);
  const strikePadded = String(strikeInt).padStart(8, '0');

  return `${root}${yy}${mm}${dd}${type}${strikePadded}`;
}

// ---------------------------------------------------------------------------
// computeStrategyPnlPath
// ---------------------------------------------------------------------------

/**
 * Combine per-leg minute bars into a single strategy P&L path.
 *
 * Mark price at each minute = HL2 = (high + low) / 2.
 * Combined P&L = sum across legs of (currentHL2 - entryPrice) * quantity * multiplier.
 *
 * Only includes timestamps where ALL legs have a bar.
 * Returns empty array if any leg has no bars.
 */
export function computeStrategyPnlPath(
  legs: ReplayLeg[],
  barsByLeg: MassiveBarRow[][],
): PnlPoint[] {
  if (legs.length === 0 || barsByLeg.length === 0) return [];

  // Check if any leg has no bars
  for (const bars of barsByLeg) {
    if (bars.length === 0) return [];
  }

  // Build maps of timestamp -> bar for each leg
  const legMaps: Map<string, MassiveBarRow>[] = barsByLeg.map((bars) => {
    const map = new Map<string, MassiveBarRow>();
    for (const bar of bars) {
      const ts = `${bar.date} ${bar.time ?? ''}`.trim();
      map.set(ts, bar);
    }
    return map;
  });

  // Use first leg's timestamps as reference, filter to only those present in all legs
  const refTimestamps: string[] = [];
  for (const bar of barsByLeg[0]) {
    const ts = `${bar.date} ${bar.time ?? ''}`.trim();
    const allHave = legMaps.every((m) => m.has(ts));
    if (allHave) refTimestamps.push(ts);
  }

  // Build P&L path
  const path: PnlPoint[] = [];
  for (const ts of refTimestamps) {
    let strategyPnl = 0;
    const legPrices: number[] = [];

    for (let i = 0; i < legs.length; i++) {
      const bar = legMaps[i].get(ts)!;
      const hl2 = (bar.high + bar.low) / 2;
      legPrices.push(hl2);
      strategyPnl += (hl2 - legs[i].entryPrice) * legs[i].quantity * legs[i].multiplier;
    }

    path.push({ timestamp: ts, strategyPnl, legPrices });
  }

  return path;
}

// ---------------------------------------------------------------------------
// computeReplayMfeMae
// ---------------------------------------------------------------------------

/**
 * Compute MFE (Maximum Favorable Excursion) and MAE (Maximum Adverse Excursion)
 * from a P&L path.
 *
 * MFE = max of strategyPnl series
 * MAE = min of strategyPnl series
 */
export function computeReplayMfeMae(pnlPath: PnlPoint[]): {
  mfe: number;
  mae: number;
  mfeTimestamp: string;
  maeTimestamp: string;
} {
  if (pnlPath.length === 0) {
    return { mfe: 0, mae: 0, mfeTimestamp: '', maeTimestamp: '' };
  }

  let mfe = pnlPath[0].strategyPnl;
  let mae = pnlPath[0].strategyPnl;
  let mfeTimestamp = pnlPath[0].timestamp;
  let maeTimestamp = pnlPath[0].timestamp;

  for (let i = 1; i < pnlPath.length; i++) {
    const pnl = pnlPath[i].strategyPnl;
    if (pnl > mfe) {
      mfe = pnl;
      mfeTimestamp = pnlPath[i].timestamp;
    }
    if (pnl < mae) {
      mae = pnl;
      maeTimestamp = pnlPath[i].timestamp;
    }
  }

  return { mfe, mae, mfeTimestamp, maeTimestamp };
}
