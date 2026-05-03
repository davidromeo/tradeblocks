/**
 * contract-selector.ts
 *
 * Pure strike selection engine for the options strategy system.
 *
 * Resolves strategy leg definitions into specific option contracts from a historical chain.
 * All 5 strike selection methods are implemented:
 *   1. delta         - Select contract whose |delta| is nearest to target
 *   2. otm_pct       - Select strike nearest to spot * (1 ± pct) for calls/puts
 *   3. atm           - Select strike nearest to underlying price
 *   4. fixed_premium - Select strike whose BS theoretical price is nearest to target
 *   5. offset        - Place child leg N points from parent; exact=true skips on miss, exact=false snaps
 *
 * Decisions:
 *   - D-06/D-08: Uses underlying_price input (entry time), NOT daily close — no lookahead
 *   - D-03/D-07: Uses iv_estimate from ATM option at entry_time
 *   - D-10: offset exact=true skips on miss, exact=false snaps directionally
 *   - D-11: max_width never skips — snaps to nearest contract within ceiling
 *
 * Pure math module — no I/O, no DuckDB, no fetch.
 */

import {
  bsDelta,
  bachelierDelta,
  bsPrice,
  bachelierPrice,
  BACHELIER_DTE_THRESHOLD,
} from './black-scholes.js';
import type { ContractRow } from './chain-loader.js';
import type { StrikeSpec } from './strategy-schema.js';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * Options passed to every selection function.
 * All values come from entry_time data — no daily close data involved (D-06/D-08).
 */
export interface SelectionOptions {
  /** Spot price at entry_time (NOT daily close) */
  underlying_price: number;
  /** Annualized IV from ATM option at entry_time (D-03/D-07) */
  iv_estimate: number;
  /** Risk-free rate, default 0.045 */
  r?: number;
  /** Dividend yield, default 0.015 */
  q?: number;
  /** Resolved parent strike (required for offset and max_width) */
  parent_strike?: number;
  /** Entry time as "HH:MM" — used to compute intraday remaining time for 0 DTE */
  entry_time?: string;
  /**
   * Per-strike implied volatility map (strike → annualized IV).
   * When provided, selectByDelta uses each contract's own IV instead of the flat
   * iv_estimate. This accounts for the volatility skew, producing more accurate
   * delta values and strike selection that matches OO's behavior.
   * Falls back to iv_estimate for strikes not in the map.
   */
  iv_by_strike?: Map<number, number>;
  /** Direct per-contract delta map when a persisted greek exists for the entry minute. */
  delta_by_ticker?: Map<string, number>;
  /** Target DTE for offset legs — when multiple contracts match the exact strike,
   *  prefer the one closest to this DTE. Prevents picking the shortest expiration
   *  in the tolerance window (which would invert a calendar spread). */
  dte_target?: number;
}

/**
 * Result of a strike selection attempt.
 * Either a selected contract or a skipped result with a reason.
 */
export type SelectionResult =
  | { selected: ContractRow }
  | { skipped: true; reason: string };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Apply max_width constraint: filter contracts to those within max_width points
 * of parent_strike. Per D-11: never skip for max_width — if no contracts remain,
 * return the single contract closest to parent_strike.
 */
function applyMaxWidth(
  contracts: ContractRow[],
  parent_strike: number,
  max_width: number,
): ContractRow[] {
  const within = contracts.filter(
    (c) => Math.abs(c.strike - parent_strike) <= max_width,
  );
  if (within.length > 0) return within;

  // Nothing within max_width — snap to nearest single contract (never skip)
  const nearest = contracts.reduce((best, c) =>
    Math.abs(c.strike - parent_strike) < Math.abs(best.strike - parent_strike) ? c : best,
  );
  return [nearest];
}

/**
 * Compute remaining time to expiration in years.
 * For 0 DTE, uses intraday remaining time from entry_time to 16:00 close.
 * For non-zero DTE, uses calendar day count.
 */
function computeT(dte: number, entryTime?: string): number {
  if (dte === 0 && entryTime) {
    // Intraday: compute hours remaining until 16:00 ET close
    const [hh, mm] = entryTime.split(':').map(Number);
    const entryMinutes = hh * 60 + mm;
    const closeMinutes = 16 * 60; // 16:00 ET
    const remainingMinutes = Math.max(closeMinutes - entryMinutes, 1);
    return remainingMinutes / (365 * 24 * 60); // fraction of a year
  }
  return dte / 365;
}

// Module-level entry_time for delta/price computations during selection
let _selectionEntryTime: string | undefined;

/**
 * Compute option delta using the appropriate model.
 * Switches to Bachelier for very short DTE (< BACHELIER_DTE_THRESHOLD days).
 */
function computeDelta(
  c: ContractRow,
  S: number,
  r: number,
  q: number,
  sigma: number,
): number {
  const T = computeT(c.dte, _selectionEntryTime);
  if (T < BACHELIER_DTE_THRESHOLD / 365) {
    // Bachelier normal vol — convert log-normal to normal approximation
    // sigma_n ≈ S * sigma (rough approximation for ATM)
    const sigma_n = S * sigma;
    return bachelierDelta(c.contract_type, S, c.strike, T, r, q, sigma_n);
  }
  return bsDelta(c.contract_type, S, c.strike, T, r, q, sigma);
}

/**
 * Compute option theoretical price using the appropriate model.
 */
function computePrice(
  c: ContractRow,
  S: number,
  r: number,
  q: number,
  sigma: number,
): number {
  const T = computeT(c.dte, _selectionEntryTime);
  if (T < BACHELIER_DTE_THRESHOLD / 365) {
    const sigma_n = S * sigma;
    return bachelierPrice(c.contract_type, S, c.strike, T, r, q, sigma_n);
  }
  return bsPrice(c.contract_type, S, c.strike, T, r, q, sigma);
}

// ---------------------------------------------------------------------------
// Exported selection functions
// ---------------------------------------------------------------------------

/**
 * Select the contract whose |delta| is nearest to target_delta.
 *
 * @param contracts  - Filtered option chain (same type, same expiry preferred)
 * @param target_delta - Target absolute delta (e.g., 0.16 for 16-delta put)
 * @param opts         - Selection options including underlying_price and iv_estimate
 * @param max_width    - Optional max distance in points from opts.parent_strike
 */
export function selectByDelta(
  contracts: ContractRow[],
  target_delta: number,
  opts: SelectionOptions,
  max_width?: number,
): SelectionResult {
  if (contracts.length === 0) {
    return { skipped: true, reason: 'no_contracts_after_filter' };
  }

  const {
    underlying_price: S,
    iv_estimate: sigma,
    r = 0.045,
    q = 0.015,
    parent_strike,
    iv_by_strike,
    delta_by_ticker,
  } = opts;
  _selectionEntryTime = opts.entry_time;
  const preferConservativeTarget = (iv_by_strike?.size ?? 0) === 0 && (delta_by_ticker?.size ?? 0) === 0;

  let pool = contracts;
  if (max_width != null && parent_strike != null) {
    pool = applyMaxWidth(pool, parent_strike, max_width);
  }

  type DeltaCandidate = {
    contract: ContractRow;
    absDelta: number;
    dist: number;
    dteDist: number;
  };

  // DTE-first ranking: when the caller supplies opts.dte_target, prefer the
  // contract whose DTE is closest to target; delta is only the tiebreaker.
  // DTE drives the trade's structural risk profile (multi-leg spread geometry,
  // theta/gamma/vega exposure); delta is a strike-level refinement. Treating
  // delta as primary makes selection fragile to tiny greek perturbations.
  // When dte_target is absent, dteDist is 0 for all candidates and behavior
  // degenerates to pure delta-distance ranking (back-compat).
  const dteTarget = opts.dte_target;

  let bestContract = pool[0];
  let bestDist = Infinity;
  let bestDteDist = Infinity;
  let bestBelowOrEqual: DeltaCandidate | null = null;

  for (const c of pool) {
    const persistedDelta = delta_by_ticker?.get(c.ticker);
    // Apply log-moneyness vol skew for delta computation.
    // Calibrated against OO DC fill prices: put IV ≈ 1.10x ATM, call IV ≈ 0.85x ATM.
    // β_put=-2.5 gives 5/11 exact put matches; β_call=-7.0 gives 5/11 exact call matches.
    let delta: number;
    if (persistedDelta != null) {
      delta = persistedDelta;
    } else {
      let strikeIv: number;
      if (iv_by_strike?.has(c.strike)) {
        strikeIv = iv_by_strike.get(c.strike)!;
      } else {
        const logMoneyness = Math.log(c.strike / S);
        const beta = logMoneyness < 0 ? -2.5 : -7.0;
        strikeIv = Math.max(sigma * (1 + beta * logMoneyness), 0.01);
      }
      delta = computeDelta(c, S, r, q, strikeIv);
    }
    const absDelta = Math.abs(delta);
    const dist = Math.abs(absDelta - Math.abs(target_delta));
    const dteDist = dteTarget != null ? Math.abs(c.dte - dteTarget) : 0;
    if (
      dteDist < bestDteDist
      || (dteDist === bestDteDist && dist < bestDist)
    ) {
      bestDteDist = dteDist;
      bestDist = dist;
      bestContract = c;
    }
    if (absDelta <= Math.abs(target_delta)) {
      if (
        bestBelowOrEqual == null
        || dteDist < bestBelowOrEqual.dteDist
        || (dteDist === bestBelowOrEqual.dteDist && dist < bestBelowOrEqual.dist)
      ) {
        bestBelowOrEqual = { contract: c, absDelta, dist, dteDist };
      }
    }
  }

  return { selected: preferConservativeTarget ? (bestBelowOrEqual?.contract ?? bestContract) : bestContract };
}

/**
 * Select the strike nearest to spot * (1 ± pct).
 * pct is a decimal (e.g., 0.05 for 5%).
 * Direction is inferred from contract_type of the first contract in the array.
 *
 * @param contracts  - Filtered option chain (all same contract_type)
 * @param pct        - OTM fraction (decimal), e.g., 0.05 for 5% OTM
 * @param opts       - Selection options including underlying_price
 * @param max_width  - Optional max distance in points from opts.parent_strike
 */
export function selectByOtmPct(
  contracts: ContractRow[],
  pct: number,
  opts: SelectionOptions,
  max_width?: number,
): SelectionResult {
  if (contracts.length === 0) {
    return { skipped: true, reason: 'no_contracts_after_filter' };
  }

  const { underlying_price: S, parent_strike } = opts;
  const contract_type = contracts[0].contract_type;
  const targetStrike =
    contract_type === 'put' ? S * (1 - pct) : S * (1 + pct);

  let pool = contracts;
  if (max_width != null && parent_strike != null) {
    pool = applyMaxWidth(pool, parent_strike, max_width);
  }

  const selected = pool.reduce((best, c) =>
    Math.abs(c.strike - targetStrike) < Math.abs(best.strike - targetStrike) ? c : best,
  );

  return { selected };
}

/**
 * Select the strike nearest to the underlying price (ATM).
 *
 * @param contracts - Filtered option chain
 * @param opts      - Selection options including underlying_price
 */
export function selectAtm(
  contracts: ContractRow[],
  opts: SelectionOptions,
): SelectionResult {
  if (contracts.length === 0) {
    return { skipped: true, reason: 'no_contracts_after_filter' };
  }

  const { underlying_price: S } = opts;

  const selected = contracts.reduce((best, c) =>
    Math.abs(c.strike - S) < Math.abs(best.strike - S) ? c : best,
  );

  return { selected };
}

/**
 * Select the strike whose BS theoretical price is nearest to target_premium.
 *
 * @param contracts      - Filtered option chain
 * @param target_premium - Target option price
 * @param opts           - Selection options including underlying_price and iv_estimate
 * @param max_width      - Optional max distance in points from opts.parent_strike
 */
export function selectByFixedPremium(
  contracts: ContractRow[],
  target_premium: number,
  opts: SelectionOptions,
  max_width?: number,
): SelectionResult {
  if (contracts.length === 0) {
    return { skipped: true, reason: 'no_contracts_after_filter' };
  }

  const { underlying_price: S, iv_estimate: sigma, r = 0.045, q = 0.015, parent_strike } = opts;

  let pool = contracts;
  if (max_width != null && parent_strike != null) {
    pool = applyMaxWidth(pool, parent_strike, max_width);
  }

  let bestContract = pool[0];
  let bestDist = Infinity;

  for (const c of pool) {
    const price = computePrice(c, S, r, q, sigma);
    const dist = Math.abs(price - target_premium);
    if (dist < bestDist) {
      bestDist = dist;
      bestContract = c;
    }
  }

  return { selected: bestContract };
}

/**
 * Place child leg exactly N points from parent.
 *
 * @param contracts     - Filtered option chain
 * @param points        - Offset in points (positive = higher strike, negative = lower)
 * @param contract_type - Type of contracts in the chain ('call' | 'put')
 * @param exact         - If true, skip on no exact match; if false, snap directionally
 * @param opts          - Selection options; opts.parent_strike required
 * @param max_width     - Optional max distance in points from opts.parent_strike
 */
export function selectByOffset(
  contracts: ContractRow[],
  points: number,
  contract_type: 'call' | 'put',
  exact: boolean,
  opts: SelectionOptions,
  max_width?: number,
): SelectionResult {
  if (contracts.length === 0) {
    return { skipped: true, reason: 'no_contracts_after_filter' };
  }

  const { parent_strike } = opts;
  if (parent_strike == null) {
    return { skipped: true, reason: 'no_parent_strike_for_offset' };
  }

  const targetStrike = parent_strike + points;

  // Apply max_width constraint before offset resolution (D-11: never skip for max_width)
  let pool = contracts;
  if (max_width != null) {
    pool = applyMaxWidth(pool, parent_strike, max_width);
  }

  if (exact) {
    // Exact match required — when multiple expirations exist at the same strike,
    // prefer the one closest to dte_target to avoid inverting calendar spreads.
    const matches = pool.filter((c) => c.strike === targetStrike);
    if (matches.length === 0) {
      return { skipped: true, reason: 'no_exact_strike_at_offset' };
    }
    if (matches.length === 1 || opts.dte_target == null) {
      return { selected: matches[0] };
    }
    const best = matches.reduce((a, b) =>
      Math.abs(a.dte - opts.dte_target!) < Math.abs(b.dte - opts.dte_target!) ? a : b,
    );
    return { selected: best };
  }

  // Snap directionally
  if (contract_type === 'put') {
    // For puts: snap to nearest strike <= targetStrike (going further OTM = lower)
    const candidates = pool
      .filter((c) => c.strike <= targetStrike)
      .sort((a, b) => b.strike - a.strike); // descending — nearest first
    if (candidates.length === 0) {
      // max_width has constrained the pool and no candidates meet the directional condition.
      // When max_width was applied (never-skip semantics, D-11), pick nearest in pool.
      if (max_width != null) {
        const nearest = pool.reduce((best, c) =>
          Math.abs(c.strike - targetStrike) < Math.abs(best.strike - targetStrike) ? c : best,
        );
        return { selected: nearest };
      }
      return { skipped: true, reason: 'no_directional_strike_for_offset' };
    }
    return { selected: candidates[0] };
  } else {
    // For calls: snap to nearest strike >= targetStrike (going further OTM = higher)
    const candidates = pool
      .filter((c) => c.strike >= targetStrike)
      .sort((a, b) => a.strike - b.strike); // ascending — nearest first
    if (candidates.length === 0) {
      // max_width has constrained the pool and no candidates meet the directional condition.
      // When max_width was applied (never-skip semantics, D-11), pick nearest in pool.
      if (max_width != null) {
        const nearest = pool.reduce((best, c) =>
          Math.abs(c.strike - targetStrike) < Math.abs(best.strike - targetStrike) ? c : best,
        );
        return { selected: nearest };
      }
      return { skipped: true, reason: 'no_directional_strike_for_offset' };
    }
    return { selected: candidates[0] };
  }
}

/**
 * Dispatcher: routes a StrikeSpec to the appropriate selection function.
 *
 * @param spec      - Strike specification from strategy definition
 * @param contracts - Filtered option chain
 * @param opts      - Selection options (parent_strike required for offset/max_width)
 */
export function selectStrike(
  spec: StrikeSpec,
  contracts: ContractRow[],
  opts: SelectionOptions,
): SelectionResult {
  _selectionEntryTime = opts.entry_time;
  switch (spec.method) {
    case 'delta':
      return selectByDelta(contracts, spec.target, opts, spec.max_width);

    case 'otm_pct':
      return selectByOtmPct(contracts, spec.pct, opts, spec.max_width);

    case 'atm':
      return selectAtm(contracts, opts);

    case 'fixed_premium':
      return selectByFixedPremium(contracts, spec.premium, opts, spec.max_width);

    case 'offset': {
      const contract_type = contracts.length > 0 ? contracts[0].contract_type : 'put';
      return selectByOffset(
        contracts,
        spec.points,
        contract_type,
        spec.exact ?? true,
        opts,
        spec.max_width,
      );
    }
  }
}
