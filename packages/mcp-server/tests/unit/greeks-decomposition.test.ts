import {
  decomposeGreeks,
  computeTimeDeltaDays,
  type GreeksDecompositionConfig,
  type GreeksDecompositionResult,
} from '../../src/test-exports.js';

import type { PnlPoint, ReplayLeg } from '../../src/test-exports.js';

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

/** Build a minimal PnlPoint with optional greeks fields. */
function point(
  timestamp: string,
  strategyPnl: number,
  opts?: {
    netDelta?: number | null;
    netGamma?: number | null;
    netTheta?: number | null;
    netVega?: number | null;
    legGreeks?: Array<{ delta: number | null; gamma: number | null; theta: number | null; vega: number | null; iv: number | null }>;
  },
): PnlPoint {
  return {
    timestamp,
    strategyPnl,
    legPrices: [],
    netDelta: opts?.netDelta ?? null,
    netGamma: opts?.netGamma ?? null,
    netTheta: opts?.netTheta ?? null,
    netVega: opts?.netVega ?? null,
    legGreeks: opts?.legGreeks,
  };
}

/** Build a minimal ReplayLeg. */
function leg(quantity: number, multiplier = 100): ReplayLeg {
  return { occTicker: 'TEST', quantity, entryPrice: 1.0, multiplier };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeTimeDeltaDays', () => {
  test('same day, 1 minute apart', () => {
    const dt = computeTimeDeltaDays('2025-01-10 09:31', '2025-01-10 09:32');
    expect(dt).toBeCloseTo(1 / 390, 6);
  });

  test('same day, 60 minutes apart', () => {
    const dt = computeTimeDeltaDays('2025-01-10 09:30', '2025-01-10 10:30');
    expect(dt).toBeCloseTo(60 / 390, 6);
  });

  test('same timestamp returns 0', () => {
    const dt = computeTimeDeltaDays('2025-01-10 10:00', '2025-01-10 10:00');
    expect(dt).toBe(0);
  });

  test('cross-day returns positive value > 0', () => {
    const dt = computeTimeDeltaDays('2025-01-10 15:00', '2025-01-13 09:30');
    expect(dt).toBeGreaterThan(0);
  });
});

describe('single-factor attribution', () => {
  const baseTimestamp1 = '2025-01-10 09:31';
  const baseTimestamp2 = '2025-01-10 09:32';

  test('delta only: underlying up $1 with netDelta=0.5 -> deltaPnl=0.50', () => {
    const prices = new Map<string, number>([
      [baseTimestamp1, 100],
      [baseTimestamp2, 101],
    ]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(baseTimestamp1, 0, { netDelta: 0.5 }),
        point(baseTimestamp2, 0.50), // actual matches delta expectation
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    const delta = result.factors.find(f => f.factor === 'delta')!;
    expect(delta.totalPnl).toBeCloseTo(0.50, 4);
    expect(delta.steps).toHaveLength(1);
    expect(delta.steps[0]).toBeCloseTo(0.50, 4);
  });

  test('gamma only: underlying up $1 with netGamma=0.01 -> gammaPnl=0.005', () => {
    const prices = new Map<string, number>([
      [baseTimestamp1, 100],
      [baseTimestamp2, 101],
    ]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(baseTimestamp1, 0, { netGamma: 0.01 }),
        point(baseTimestamp2, 0.005),
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    const gamma = result.factors.find(f => f.factor === 'gamma')!;
    expect(gamma.totalPnl).toBeCloseTo(0.005, 6);
  });

  test('theta only: 1 minute passes with netTheta=-5.0 -> thetaPnl=-5.0/390', () => {
    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(baseTimestamp1, 0, { netTheta: -5.0 }),
        point(baseTimestamp2, -5.0 / 390),
      ],
      legs: [leg(1)],
    };

    const result = decomposeGreeks(config);
    const theta = result.factors.find(f => f.factor === 'theta')!;
    expect(theta.totalPnl).toBeCloseTo(-5.0 / 390, 6);
  });

  test('vega only: IV rises 1% (0.01 decimal) with netVega=10 -> vegaPnl=10.0', () => {
    // IV change of 0.01 decimal = 1% point, vega is per 1% IV move
    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(baseTimestamp1, 0, {
          netVega: 10,
          legGreeks: [{ delta: 0.5, gamma: 0.01, theta: -5, vega: 10, iv: 0.20 }],
        }),
        point(baseTimestamp2, 10.0, {
          legGreeks: [{ delta: 0.5, gamma: 0.01, theta: -5, vega: 10, iv: 0.21 }],
        }),
      ],
      legs: [leg(1)],
    };

    const result = decomposeGreeks(config);
    const vega = result.factors.find(f => f.factor === 'vega')!;
    // netVega=10, ivChange=(0.21-0.20)*100=1.0 -> vegaPnl=10*1=10
    expect(vega.totalPnl).toBeCloseTo(10.0, 4);
  });
});

describe('multi-factor attribution', () => {
  test('residual = actual - sum(delta + gamma + theta + vega)', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const prices = new Map<string, number>([[ts1, 100], [ts2, 102]]);

    const actualPnl = 5.0;
    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, {
          netDelta: 0.5,
          netGamma: 0.02,
          netTheta: -10,
          netVega: 5,
          legGreeks: [{ delta: 0.5, gamma: 0.02, theta: -10, vega: 5, iv: 0.25 }],
        }),
        point(ts2, actualPnl, {
          legGreeks: [{ delta: 0.5, gamma: 0.02, theta: -10, vega: 5, iv: 0.26 }],
        }),
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);

    // delta = 0.5 * 2 = 1.0
    // gamma = 0.5 * 0.02 * 4 = 0.04
    // theta = -10 * (1/390)
    // vega = 5 * (0.01 * 100) = 5.0  (1% IV change)
    const delta = result.factors.find(f => f.factor === 'delta')!;
    const gamma = result.factors.find(f => f.factor === 'gamma')!;
    const theta = result.factors.find(f => f.factor === 'theta')!;
    const vega = result.factors.find(f => f.factor === 'vega')!;
    const residual = result.factors.find(f => f.factor === 'residual')!;

    const attributed = delta.totalPnl + gamma.totalPnl + theta.totalPnl + vega.totalPnl;
    expect(residual.totalPnl).toBeCloseTo(actualPnl - attributed, 6);
    expect(result.totalAttributed).toBeCloseTo(attributed, 6);
    expect(result.totalResidual).toBeCloseTo(residual.totalPnl, 6);
    expect(result.totalPnlChange).toBeCloseTo(actualPnl, 6);
  });

  test('factors are sorted by abs(totalPnl) descending', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const prices = new Map<string, number>([[ts1, 100], [ts2, 105]]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, {
          netDelta: 1.0, // delta = 1.0 * 5 = 5.0 (dominant)
          netGamma: 0.001, // gamma = 0.5 * 0.001 * 25 = 0.0125 (tiny)
          netTheta: -0.5, // theta = -0.5/390 (tiny)
          netVega: 0.1,
          legGreeks: [{ delta: 1, gamma: 0.001, theta: -0.5, vega: 0.1, iv: 0.20 }],
        }),
        point(ts2, 5.2, {
          legGreeks: [{ delta: 1, gamma: 0.001, theta: -0.5, vega: 0.1, iv: 0.20 }],
        }),
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    // Delta should be first (largest abs contribution)
    for (let i = 0; i < result.factors.length - 1; i++) {
      expect(Math.abs(result.factors[i].totalPnl)).toBeGreaterThanOrEqual(
        Math.abs(result.factors[i + 1].totalPnl),
      );
    }
  });

  test('pctOfTotal sums to ~100%', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const prices = new Map<string, number>([[ts1, 100], [ts2, 102]]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, {
          netDelta: 0.5,
          netGamma: 0.01,
          netTheta: -5,
          netVega: 3,
          legGreeks: [{ delta: 0.5, gamma: 0.01, theta: -5, vega: 3, iv: 0.25 }],
        }),
        point(ts2, 2.0, {
          legGreeks: [{ delta: 0.5, gamma: 0.01, theta: -5, vega: 3, iv: 0.26 }],
        }),
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    const totalPct = result.factors.reduce((s, f) => s + f.pctOfTotal, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });
});

describe('leg group vega', () => {
  test('front month IV drops, back month IV rises -> divergent vega P&L', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, {
          netVega: 0, // Net vega near zero for calendar
          legGreeks: [
            { delta: 0, gamma: 0, theta: 0, vega: 15, iv: 0.30 },  // front month: short
            { delta: 0, gamma: 0, theta: 0, vega: 20, iv: 0.25 },  // back month: long
          ],
        }),
        point(ts2, 0, {
          legGreeks: [
            { delta: 0, gamma: 0, theta: 0, vega: 15, iv: 0.28 },  // IV dropped 2%
            { delta: 0, gamma: 0, theta: 0, vega: 20, iv: 0.27 },  // IV rose 2%
          ],
        }),
      ],
      legs: [
        leg(-1, 100),  // front month: short 1
        leg(1, 100),   // back month: long 1
      ],
      legGroups: [
        { label: 'front_month', legIndices: [0] },
        { label: 'back_month', legIndices: [1] },
      ],
    };

    const result = decomposeGreeks(config);
    expect(result.legGroupVega).toBeDefined();
    expect(result.legGroupVega).toHaveLength(2);

    const front = result.legGroupVega!.find(g => g.label === 'front_month')!;
    const back = result.legGroupVega!.find(g => g.label === 'back_month')!;

    // Front month: short vega, IV dropped -> positive P&L for shorts
    // legVega = 15 * (-1) * 100/100 = -15 (short position)
    // ivChange = (0.28 - 0.30) * 100 = -2.0
    // groupVegaPnl = -15 * -2.0 = 30.0
    expect(front.totalVegaPnl).toBeCloseTo(30.0, 2);

    // Back month: long vega, IV rose -> positive P&L for longs
    // legVega = 20 * 1 * 100/100 = 20 (long position)
    // ivChange = (0.27 - 0.25) * 100 = 2.0
    // groupVegaPnl = 20 * 2.0 = 40.0
    expect(back.totalVegaPnl).toBeCloseTo(40.0, 2);

    // They should differ because IVs moved differently
    expect(front.totalVegaPnl).not.toEqual(back.totalVegaPnl);
  });

  test('leg groups are omitted when not configured', () => {
    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point('2025-01-10 09:31', 0, { netDelta: 0.5 }),
        point('2025-01-10 09:32', 1.0),
      ],
      legs: [leg(1)],
    };

    const result = decomposeGreeks(config);
    expect(result.legGroupVega).toBeUndefined();
  });
});

describe('edge cases', () => {
  test('empty path returns stepCount=0', () => {
    const result = decomposeGreeks({
      pnlPath: [],
      legs: [],
    });

    expect(result.stepCount).toBe(0);
    expect(result.totalPnlChange).toBe(0);
    expect(result.totalAttributed).toBe(0);
    expect(result.totalResidual).toBe(0);
    expect(result.factors).toHaveLength(5);
    result.factors.forEach(f => {
      expect(f.totalPnl).toBe(0);
      expect(f.steps).toHaveLength(0);
    });
  });

  test('single-point path returns stepCount=0', () => {
    const result = decomposeGreeks({
      pnlPath: [point('2025-01-10 09:31', 0)],
      legs: [leg(1)],
    });

    expect(result.stepCount).toBe(0);
    expect(result.totalPnlChange).toBe(0);
  });

  test('path without legGreeks -> all P&L goes to residual', () => {
    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point('2025-01-10 09:31', 0),
        point('2025-01-10 09:32', 5.0),
        point('2025-01-10 09:33', 3.0),
      ],
      legs: [leg(1)],
    };

    const result = decomposeGreeks(config);
    const residual = result.factors.find(f => f.factor === 'residual')!;

    // All P&L should be residual since no greeks and no underlying prices
    expect(residual.totalPnl).toBeCloseTo(3.0, 6);
    expect(result.totalResidual).toBeCloseTo(3.0, 6);

    // Other factors should be zero
    for (const f of result.factors) {
      if (f.factor !== 'residual') {
        expect(f.totalPnl).toBe(0);
      }
    }
  });

  test('path with null netDelta/netGamma -> those factors are 0', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const prices = new Map<string, number>([[ts1, 100], [ts2, 105]]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, { netDelta: null, netGamma: null, netTheta: -5 }),
        point(ts2, -5.0 / 390),
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    const delta = result.factors.find(f => f.factor === 'delta')!;
    const gamma = result.factors.find(f => f.factor === 'gamma')!;

    expect(delta.totalPnl).toBe(0);
    expect(gamma.totalPnl).toBe(0);
  });

  test('summary string is human-readable', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const prices = new Map<string, number>([[ts1, 100], [ts2, 101]]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, { netDelta: 0.5 }),
        point(ts2, 0.50),
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    expect(result.summary).toContain('P&L of');
    expect(result.summary).toContain('delta');
  });

  test('multi-step path accumulates correctly (midpoint greeks)', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const ts3 = '2025-01-10 09:33';
    const prices = new Map<string, number>([[ts1, 100], [ts2, 101], [ts3, 103]]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, { netDelta: 0.5 }),
        point(ts2, 0.55, { netDelta: 0.6 }), // delta changed at step 2
        point(ts3, 1.75),
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    const delta = result.factors.find(f => f.factor === 'delta')!;

    // Step 1: midpoint = (0.5 + 0.6)/2 = 0.55, underlying change = 1 -> 0.55
    // Step 2: midpoint = (0.6 + 0.6)/2 = 0.6 (next has no netDelta, falls back to cur), underlying change = 2 -> 1.2
    expect(delta.steps).toHaveLength(2);
    expect(delta.steps[0]).toBeCloseTo(0.55, 4);
    expect(delta.steps[1]).toBeCloseTo(1.2, 4);
    expect(delta.totalPnl).toBeCloseTo(1.75, 4);

    expect(result.stepCount).toBe(2);
  });
});

describe('midpoint greeks attribution', () => {
  test('delta uses midpoint when next point has valid netDelta', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const prices = new Map<string, number>([
      [ts1, 100],
      [ts2, 101],
    ]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, { netDelta: 0.5 }),
        point(ts2, 0.60, { netDelta: 0.7 }), // rapidly changing delta
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    const delta = result.factors.find(f => f.factor === 'delta')!;

    // midpoint = (0.5 + 0.7) / 2 = 0.6; underlying change = 1
    // delta_pnl = 0.6 * 1 = 0.60 (NOT 0.5 * 1 = 0.50 from start-of-interval)
    expect(delta.totalPnl).toBeCloseTo(0.60, 4);
    expect(delta.steps[0]).toBeCloseTo(0.60, 4);
  });

  test('delta falls back to start-of-interval when next point netDelta is null', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const prices = new Map<string, number>([
      [ts1, 100],
      [ts2, 101],
    ]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, { netDelta: 0.5 }),
        point(ts2, 0.50, { netDelta: null }), // next has null netDelta
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    const delta = result.factors.find(f => f.factor === 'delta')!;

    // Falls back to start-of-interval: midpoint = (0.5 + 0.5) / 2 = 0.5
    expect(delta.totalPnl).toBeCloseTo(0.50, 4);
  });

  test('midpoint formula applies to gamma', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const prices = new Map<string, number>([[ts1, 100], [ts2, 101]]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, { netGamma: 0.01 }),
        point(ts2, 0, { netGamma: 0.03 }), // gamma changes
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    const gamma = result.factors.find(f => f.factor === 'gamma')!;

    // midGamma = (0.01 + 0.03) / 2 = 0.02; underlyingChange = 1
    // gammaPnl = 0.5 * 0.02 * 1^2 = 0.01
    expect(gamma.totalPnl).toBeCloseTo(0.01, 6);
  });

  test('midpoint formula applies to theta', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, { netTheta: -4.0 }),
        point(ts2, 0, { netTheta: -6.0 }), // theta changes
      ],
      legs: [leg(1)],
    };

    const result = decomposeGreeks(config);
    const theta = result.factors.find(f => f.factor === 'theta')!;

    // midTheta = (-4 + -6) / 2 = -5.0; dt = 1/390
    expect(theta.totalPnl).toBeCloseTo(-5.0 / 390, 6);
  });

  test('midpoint formula applies to vega', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, {
          netVega: 8,
          legGreeks: [{ delta: 0, gamma: 0, theta: 0, vega: 8, iv: 0.20 }],
        }),
        point(ts2, 10.0, {
          netVega: 12,
          legGreeks: [{ delta: 0, gamma: 0, theta: 0, vega: 12, iv: 0.21 }],
        }),
      ],
      legs: [leg(1)],
    };

    const result = decomposeGreeks(config);
    const vega = result.factors.find(f => f.factor === 'vega')!;

    // midVega = (8 + 12) / 2 = 10; ivChange = (0.21 - 0.20) * 100 = 1.0
    // vegaPnl = 10 * 1.0 = 10.0
    expect(vega.totalPnl).toBeCloseTo(10.0, 4);
  });
});

describe('numerical greeks fallback', () => {
  /**
   * Build a scenario where model-based residual > 80%.
   * No underlying prices and no greeks means all P&L goes to residual.
   * Total residual = 10, totalPnlChange = 10 -> residualPct = 100% > 80%
   * -> numerical fallback activates.
   */
  function highResidualConfig(): GreeksDecompositionConfig {
    const underlyingPrices = new Map<string, number>([
      ['2025-01-10 09:31', 100],
      ['2025-01-10 09:32', 101],
      ['2025-01-10 09:33', 102],
    ]);
    return {
      pnlPath: [
        // No greeks set -> all P&L goes to residual in model mode
        point('2025-01-10 09:31', 0),
        point('2025-01-10 09:32', 6),
        point('2025-01-10 09:33', 10),
      ],
      legs: [leg(1)],
      underlyingPrices,
    };
  }

  test('method is "numerical" when model residual > 80%', () => {
    const result = decomposeGreeks(highResidualConfig());
    expect(result.method).toBe('numerical');
  });

  test('method is "model" when model residual <= 80%', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const prices = new Map<string, number>([[ts1, 100], [ts2, 101]]);

    // delta explains nearly all P&L -> low residual
    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, { netDelta: 0.5 }),
        point(ts2, 0.50), // actual = 0.50, attributed delta = 0.5 * 1 = 0.50, residual = 0
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    expect(result.method).toBe('model');
  });

  test('numerical fallback includes delta, gamma, time_and_vol factors', () => {
    const result = decomposeGreeks(highResidualConfig());
    const factorNames = result.factors.map(f => f.factor);
    expect(factorNames).toContain('delta');
    expect(factorNames).toContain('gamma');
    expect(factorNames).toContain('time_and_vol');
  });

  test('numerical fallback: realized delta from option price / underlying change', () => {
    // Underlying goes from 100 to 101 (+1), strategy P&L goes from 0 to 6
    // realizedDelta = 6 / 1 = 6 (large realized delta — big P&L move relative to underlying)
    // At step 1: prevRealizedDelta = null -> gammaPnl = 0
    // pureDeltaPnl = actualChange - gammaPnl = 6 - 0 = 6
    // Then underlying goes 101 to 102 (+1), P&L 6 -> 10 (+4)
    // realizedDelta2 = 4 / 1 = 4
    // deltaChange = 4 - 6 = -2, gammaPnl = 0.5 * (-2) * 1 = -1
    // pureDeltaPnl = 4 - (-1) = 5
    const result = decomposeGreeks(highResidualConfig());

    const delta = result.factors.find(f => f.factor === 'delta')!;
    const gamma = result.factors.find(f => f.factor === 'gamma')!;

    expect(delta).toBeDefined();
    expect(gamma).toBeDefined();
    // Delta step 1: pureDeltaPnl = 6, step 2: pureDeltaPnl = 5
    expect(delta.totalPnl).toBeCloseTo(6 + 5, 4);
    // Gamma step 2: -1 (only step 2 has prev delta)
    expect(gamma.totalPnl).toBeCloseTo(-1, 4);
  });

  test('numerical fallback skips intervals where underlying barely moves', () => {
    // Same underlying price -> underlyingChange < 0.01 -> skip delta/gamma, put all in residual
    const prices = new Map<string, number>([
      ['2025-01-10 09:31', 100],
      ['2025-01-10 09:32', 100.001], // < 0.01 change
      ['2025-01-10 09:33', 101],
      ['2025-01-10 09:34', 102],
    ]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point('2025-01-10 09:31', 0),
        point('2025-01-10 09:32', 3),  // theta/vol P&L during flat underlying
        point('2025-01-10 09:33', 5),
        point('2025-01-10 09:34', 10),
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    // When underlying barely moves, the change goes to time_and_vol (residual)
    // Step 1 (barely moves): residual += 3
    const timeAndVol = result.factors.find(f => f.factor === 'time_and_vol')!;
    expect(timeAndVol).toBeDefined();
    // Step 1 contributes 3 to time_and_vol because underlying change < 0.01
    expect(timeAndVol.steps[0]).toBeCloseTo(3, 4);
  });

  test('numerical result has warning about >80% residual', () => {
    const result = decomposeGreeks(highResidualConfig());
    expect(result.warning).toBeTruthy();
    expect(result.warning).toContain('numerical');
  });

  test('model result method is "model" when returning empty path', () => {
    const result = decomposeGreeks({ pnlPath: [], legs: [] });
    expect(result.method).toBe('model');
  });
});
