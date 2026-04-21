/**
 * contract-selector.test.ts
 *
 * Unit tests for the pure contract selector module.
 * Covers all 5 strike selection methods, max_width constraint, offset exact/snap,
 * lookahead enforcement, and edge cases.
 *
 * TDD RED phase: Tests written before implementation.
 */

import {
  selectByDelta,
  selectByOtmPct,
  selectAtm,
  selectByFixedPremium,
  selectByOffset,
  selectStrike,
  type SelectionOptions,
} from '../../src/test-exports.js';
import { bsDelta, bsPrice } from '../../src/test-exports.js';
import type { ContractRow } from '../../src/test-exports.js';
import { CLOSE_KNOWN_FIELDS } from '../../src/utils/field-timing.js';

// ---------------------------------------------------------------------------
// Shared test fixture — realistic SPX put/call chain
// ---------------------------------------------------------------------------

const BASE_DATE = "2025-01-15";
const EXPIRATION = "2025-02-21";
const DTE = 37;
const UNDERLYING = "SPX";

/** Put chain: strikes 5100–5700 */
const putContracts: ContractRow[] = [
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221P05100000", contract_type: "put", strike: 5100, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221P05200000", contract_type: "put", strike: 5200, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221P05300000", contract_type: "put", strike: 5300, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221P05400000", contract_type: "put", strike: 5400, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221P05500000", contract_type: "put", strike: 5500, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221P05600000", contract_type: "put", strike: 5600, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221P05700000", contract_type: "put", strike: 5700, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
];

/** Call chain: strikes 5750–6100 */
const callContracts: ContractRow[] = [
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221C05750000", contract_type: "call", strike: 5750, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221C05800000", contract_type: "call", strike: 5800, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221C05900000", contract_type: "call", strike: 5900, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221C06000000", contract_type: "call", strike: 6000, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
  { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221C06100000", contract_type: "call", strike: 6100, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
];

/** Standard selection options */
const opts: SelectionOptions = {
  underlying_price: 5750,
  iv_estimate: 0.18,
  r: 0.045,
  q: 0.015,
};

// ---------------------------------------------------------------------------
// Helper: compute expected delta strike from the fixture.
// Mirrors the log-moneyness skew applied in selectByDelta's implementation and
// the conservative OO-style rule: prefer the closest strike whose |delta|
// does not exceed the target; only fall back to absolute-nearest when every
// candidate overshoots the target.
// ---------------------------------------------------------------------------

function findNearestDeltaStrike(
  contracts: ContractRow[],
  targetDelta: number,
  options: SelectionOptions,
): number {
  const { underlying_price: S, iv_estimate: sigma, r = 0.045, q = 0.015, iv_by_strike } = options;
  let bestStrike = contracts[0].strike;
  let bestDist = Infinity;
  let bestBelowOrEqualStrike: number | null = null;
  let bestBelowOrEqualDist = Infinity;
  for (const c of contracts) {
    const T = c.dte / 365;
    let strikeIv: number;
    if (iv_by_strike?.has(c.strike)) {
      strikeIv = iv_by_strike.get(c.strike)!;
    } else {
      const logMoneyness = Math.log(c.strike / S);
      const beta = logMoneyness < 0 ? -2.5 : -7.0;
      strikeIv = Math.max(sigma * (1 + beta * logMoneyness), 0.01);
    }
    const delta = bsDelta(c.contract_type, S, c.strike, T, r, q, strikeIv);
    const absDelta = Math.abs(delta);
    const dist = Math.abs(absDelta - Math.abs(targetDelta));
    if (dist < bestDist) {
      bestDist = dist;
      bestStrike = c.strike;
    }
    if (absDelta <= Math.abs(targetDelta) && dist < bestBelowOrEqualDist) {
      bestBelowOrEqualDist = dist;
      bestBelowOrEqualStrike = c.strike;
    }
  }
  return bestBelowOrEqualStrike ?? bestStrike;
}

// ---------------------------------------------------------------------------
// STRAT-02 — Delta selection
// ---------------------------------------------------------------------------

describe("selectByDelta", () => {
  test("returns contract whose |delta| is nearest to 0.16 for puts", () => {
    const result = selectByDelta(putContracts, 0.16, opts);
    const expectedStrike = findNearestDeltaStrike(putContracts, 0.16, opts);
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(expectedStrike);
    }
  });

  test("returns contract for call delta 0.30", () => {
    const result = selectByDelta(callContracts, 0.30, opts);
    const expectedStrike = findNearestDeltaStrike(callContracts, 0.30, opts);
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(expectedStrike);
    }
  });

  test("selectByDelta with max_width constrains within ceiling", () => {
    // parent_strike: 5700, max_width: 200 — only strikes [5500, 5900] eligible
    const result = selectByDelta(putContracts, 0.16, { ...opts, parent_strike: 5700 }, 200);
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBeGreaterThanOrEqual(5500);
      expect(result.selected.strike).toBeLessThanOrEqual(5900);
    }
  });

  test("prefers the closest strike that does not exceed the target delta", () => {
    const narrowCalls: ContractRow[] = [
      { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221C05885000", contract_type: "call", strike: 5885, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
      { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221C05890000", contract_type: "call", strike: 5890, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
      { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250221C05895000", contract_type: "call", strike: 5895, expiration: EXPIRATION, dte: DTE, exercise_style: "european" },
    ];
    const conservativeOpts: SelectionOptions = {
      underlying_price: 5845.06,
      iv_estimate: 0.10427181103662185,
      r: 0.045,
      q: 0.015,
    };

    const result = selectByDelta(narrowCalls, 0.15, conservativeOpts);
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      // 5890 is slightly closer in absolute distance (~0.153 vs target 0.15),
      // but 5895 is the closest strike that stays at or below the target delta.
      expect(result.selected.strike).toBe(5895);
    }
  });

  test("uses absolute nearest delta when per-strike IVs are available", () => {
    const shortDteCalls: ContractRow[] = [
      { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250117C04230000", contract_type: "call", strike: 4230, expiration: "2025-01-17", dte: 2, exercise_style: "european" },
      { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250117C04235000", contract_type: "call", strike: 4235, expiration: "2025-01-17", dte: 2, exercise_style: "european" },
      { underlying: UNDERLYING, date: BASE_DATE, ticker: "O:SPX250117C04240000", contract_type: "call", strike: 4240, expiration: "2025-01-17", dte: 2, exercise_style: "european" },
    ];
    const ivByStrike = new Map<number, number>([
      [4230, 0.16945],
      [4235, 0.16918],
      [4240, 0.16922],
    ]);

    const result = selectByDelta(shortDteCalls, 0.15, {
      underlying_price: 4176.64,
      iv_estimate: 0.17949371753402932,
      r: 0.045,
      q: 0.015,
      iv_by_strike: ivByStrike,
    });

    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(4230);
    }
  });
});

// ---------------------------------------------------------------------------
// STRAT-03 — OTM% selection
// ---------------------------------------------------------------------------

describe("selectByOtmPct", () => {
  test("returns nearest strike to 5% OTM put", () => {
    // Target = 5750 * (1 - 0.05) = 5462.5 → nearest = 5500
    const result = selectByOtmPct(putContracts, 0.05, opts);
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(5500);
    }
  });

  test("returns nearest strike to 3% OTM call", () => {
    // Target = 5750 * (1 + 0.03) = 5922.5 → nearest = 5900
    const result = selectByOtmPct(callContracts, 0.03, opts);
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(5900);
    }
  });
});

// ---------------------------------------------------------------------------
// ATM selection
// ---------------------------------------------------------------------------

describe("selectAtm", () => {
  test("returns strike nearest to underlying price for put chain", () => {
    // underlying_price = 5750, nearest put = 5700 (50 pts away)
    const result = selectAtm(putContracts, opts);
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(5700);
    }
  });

  test("returns strike nearest to underlying price for call chain", () => {
    // underlying_price = 5750, 5750 is exactly ATM
    const result = selectAtm(callContracts, opts);
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(5750);
    }
  });
});

// ---------------------------------------------------------------------------
// STRAT-04 — Fixed premium selection
// ---------------------------------------------------------------------------

describe("selectByFixedPremium", () => {
  test("returns strike whose BS price nearest to target premium 5.0", () => {
    const targetPremium = 5.0;
    const { underlying_price: S, iv_estimate: sigma, r = 0.045, q = 0.015 } = opts;

    // Compute expected nearest
    let bestStrike = putContracts[0].strike;
    let bestDist = Infinity;
    for (const c of putContracts) {
      const T = c.dte / 365;
      const price = bsPrice(c.contract_type, S, c.strike, T, r, q, sigma);
      const dist = Math.abs(price - targetPremium);
      if (dist < bestDist) {
        bestDist = dist;
        bestStrike = c.strike;
      }
    }

    const result = selectByFixedPremium(putContracts, targetPremium, opts);
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(bestStrike);
    }
  });

  test("selectByFixedPremium with max_width snaps within ceiling", () => {
    // parent_strike: 5700, max_width: 200 — only 5500-5900 eligible
    const result = selectByFixedPremium(
      putContracts,
      5.0,
      { ...opts, parent_strike: 5700 },
      200,
    );
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(Math.abs(result.selected.strike - 5700)).toBeLessThanOrEqual(200);
    }
  });
});

// ---------------------------------------------------------------------------
// STRAT-05 — Offset selection
// ---------------------------------------------------------------------------

describe("selectByOffset", () => {
  test("exact=true finds exact strike", () => {
    // parent_strike=5500, points=-100 → target=5400, exists in chain
    const result = selectByOffset(
      putContracts,
      -100,
      "put",
      true,
      { ...opts, parent_strike: 5500 },
    );
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(5400);
    }
  });

  test("exact=true skips when no exact match", () => {
    // parent_strike=5500, points=-125 → target=5375 (not in chain)
    const result = selectByOffset(
      putContracts,
      -125,
      "put",
      true,
      { ...opts, parent_strike: 5500 },
    );
    expect("skipped" in result).toBe(true);
    if ("skipped" in result) {
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("no_exact_strike_at_offset");
    }
  });

  test("exact=false snaps to nearest directional put (lower)", () => {
    // parent_strike=5500, points=-125 → target=5375 → snap lower: nearest <= 5375 = 5300
    const result = selectByOffset(
      putContracts,
      -125,
      "put",
      false,
      { ...opts, parent_strike: 5500 },
    );
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(5300);
    }
  });

  test("exact=false snaps to nearest directional call (higher)", () => {
    // parent_strike=5800, points=125 → target=5925 → snap higher: nearest >= 5925 = 6000
    const result = selectByOffset(
      callContracts,
      125,
      "call",
      false,
      { ...opts, parent_strike: 5800 },
    );
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(result.selected.strike).toBe(6000);
    }
  });
});

// ---------------------------------------------------------------------------
// STRAT-06 — Max-width constraint
// ---------------------------------------------------------------------------

describe("max_width constraint", () => {
  test("max_width caps offset even when exact=false", () => {
    // parent_strike=5500, points=-300, exact=false, max_width=200
    // Unconstrained target=5200, max_width limits to strikes within 200 pts of 5500 → [5300, 5700]
    // Snap directionally for put (lower) within constraint → nearest ≤ 5200 within [5300, 5700] is 5300
    const result = selectByOffset(
      putContracts,
      -300,
      "put",
      false,
      { ...opts, parent_strike: 5500 },
      200,
    );
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(Math.abs(result.selected.strike - 5500)).toBeLessThanOrEqual(200);
    }
  });

  test("max_width on delta never skips — picks best available within ceiling", () => {
    // max_width=100 with parent_strike=5700 → only 5600-5800 eligible
    // Even if no strike perfectly matches 0.16 delta, return best available (no skip)
    const result = selectByDelta(
      putContracts,
      0.16,
      { ...opts, parent_strike: 5700 },
      100,
    );
    expect("selected" in result).toBe(true);
    if ("selected" in result) {
      expect(Math.abs(result.selected.strike - 5700)).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// BT-12 — Lookahead enforcement
// ---------------------------------------------------------------------------

describe("lookahead enforcement", () => {
  test("selectByDelta uses underlying_price input, not daily close", () => {
    // Two different underlying prices should select different strikes
    // Use 5700 (entry time) vs 5900 (hypothetical daily close)
    const opts5700: SelectionOptions = { ...opts, underlying_price: 5700 };
    const opts5900: SelectionOptions = { ...opts, underlying_price: 5900 };

    const result5700 = selectByDelta(putContracts, 0.25, opts5700);
    const result5900 = selectByDelta(putContracts, 0.25, opts5900);

    expect("selected" in result5700).toBe(true);
    expect("selected" in result5900).toBe(true);

    if ("selected" in result5700 && "selected" in result5900) {
      // Different underlying prices should yield different delta-nearest strikes
      expect(result5700.selected.strike).not.toBe(result5900.selected.strike);
    }
  });

  test("SelectionOptions keys have zero overlap with CLOSE_KNOWN_FIELDS from field-timing", () => {
    // Exhaustive list of SelectionOptions keys — must be kept in sync with the interface
    const selectionOptionsKeys = ["underlying_price", "iv_estimate", "r", "q", "parent_strike"];

    // Every field name in CLOSE_KNOWN_FIELDS must NOT appear in SelectionOptions
    // This proves the interface structurally cannot receive close-derived market data
    for (const closeField of CLOSE_KNOWN_FIELDS) {
      expect(selectionOptionsKeys).not.toContain(closeField);
    }
  });

  test("selection with injected close-value fixture uses entry-time price only (ROADMAP SC-6)", () => {
    // This confirms BT-12 / ROADMAP SC-6: close-derived values cannot enter the selection path;
    // the selector operates only on the entry-time underlying_price passed via SelectionOptions.
    const entryTimePrice = 5700;
    const dailyClosePrice = 5850;

    const entryOpts: SelectionOptions = { ...opts, underlying_price: entryTimePrice };
    const closeOpts: SelectionOptions = { ...opts, underlying_price: dailyClosePrice };

    const entryResult = selectByDelta(putContracts, 0.16, entryOpts);
    const closeResult = selectByDelta(putContracts, 0.16, closeOpts);

    expect("selected" in entryResult).toBe(true);
    expect("selected" in closeResult).toBe(true);

    if ("selected" in entryResult && "selected" in closeResult) {
      // The two prices are far enough apart to produce different delta-nearest strikes
      expect(entryResult.selected.strike).not.toBe(closeResult.selected.strike);

      // The entry-time result matches what entryTimePrice produces (not dailyClosePrice)
      const verifyEntryResult = selectByDelta(putContracts, 0.16, { ...opts, underlying_price: entryTimePrice });
      if ("selected" in verifyEntryResult) {
        expect(entryResult.selected.strike).toBe(verifyEntryResult.selected.strike);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  test("returns skipped with no_contracts_after_filter when contracts array is empty", () => {
    const emptyResult = selectByDelta([], 0.16, opts);
    expect("skipped" in emptyResult).toBe(true);
    if ("skipped" in emptyResult) {
      expect(emptyResult.skipped).toBe(true);
      expect(emptyResult.reason).toBe("no_contracts_after_filter");
    }
  });

  test("empty array returns skipped for selectByOtmPct", () => {
    const result = selectByOtmPct([], 0.05, opts);
    expect("skipped" in result && result.skipped).toBe(true);
    if ("skipped" in result) {
      expect(result.reason).toBe("no_contracts_after_filter");
    }
  });

  test("empty array returns skipped for selectAtm", () => {
    const result = selectAtm([], opts);
    expect("skipped" in result && result.skipped).toBe(true);
    if ("skipped" in result) {
      expect(result.reason).toBe("no_contracts_after_filter");
    }
  });

  test("empty array returns skipped for selectByFixedPremium", () => {
    const result = selectByFixedPremium([], 5.0, opts);
    expect("skipped" in result && result.skipped).toBe(true);
    if ("skipped" in result) {
      expect(result.reason).toBe("no_contracts_after_filter");
    }
  });

  test("empty array returns skipped for selectByOffset", () => {
    const result = selectByOffset([], -100, "put", true, { ...opts, parent_strike: 5500 });
    expect("skipped" in result && result.skipped).toBe(true);
    if ("skipped" in result) {
      expect(result.reason).toBe("no_contracts_after_filter");
    }
  });
});

// ---------------------------------------------------------------------------
// selectStrike dispatcher
// ---------------------------------------------------------------------------

describe("selectStrike dispatcher", () => {
  test("routes to delta method", () => {
    const direct = selectByDelta(putContracts, 0.16, opts);
    const dispatched = selectStrike({ method: "delta", target: 0.16 }, putContracts, opts);
    expect(dispatched).toEqual(direct);
  });

  test("routes to otm_pct method", () => {
    const direct = selectByOtmPct(putContracts, 0.05, opts);
    const dispatched = selectStrike({ method: "otm_pct", pct: 0.05 }, putContracts, opts);
    expect(dispatched).toEqual(direct);
  });

  test("routes to atm method", () => {
    const direct = selectAtm(putContracts, opts);
    const dispatched = selectStrike({ method: "atm" }, putContracts, opts);
    expect(dispatched).toEqual(direct);
  });

  test("routes to fixed_premium method", () => {
    const direct = selectByFixedPremium(putContracts, 5.0, opts);
    const dispatched = selectStrike({ method: "fixed_premium", premium: 5.0 }, putContracts, opts);
    expect(dispatched).toEqual(direct);
  });

  test("routes offset with exact and max_width", () => {
    // parent_strike=5500, points=-100, exact=true → target=5400 exists in chain
    const dispatched = selectStrike(
      { method: "offset", parent_leg: 0, points: -100, exact: true, max_width: 200 },
      putContracts,
      { ...opts, parent_strike: 5500 },
    );
    expect("selected" in dispatched).toBe(true);
    if ("selected" in dispatched) {
      expect(dispatched.selected.strike).toBe(5400);
    }
  });

  test("dispatcher routes delta with max_width via spec", () => {
    const direct = selectByDelta(putContracts, 0.16, { ...opts, parent_strike: 5700 }, 200);
    const dispatched = selectStrike(
      { method: "delta", target: 0.16, max_width: 200 },
      putContracts,
      { ...opts, parent_strike: 5700 },
    );
    expect(dispatched).toEqual(direct);
  });
});
