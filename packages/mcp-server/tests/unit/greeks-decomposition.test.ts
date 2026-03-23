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

  test('multi-step path accumulates correctly', () => {
    const ts1 = '2025-01-10 09:31';
    const ts2 = '2025-01-10 09:32';
    const ts3 = '2025-01-10 09:33';
    const prices = new Map<string, number>([[ts1, 100], [ts2, 101], [ts3, 103]]);

    const config: GreeksDecompositionConfig = {
      pnlPath: [
        point(ts1, 0, { netDelta: 0.5 }),
        point(ts2, 0.5, { netDelta: 0.6 }), // delta changed at step 2
        point(ts3, 1.7),
      ],
      legs: [leg(1)],
      underlyingPrices: prices,
    };

    const result = decomposeGreeks(config);
    const delta = result.factors.find(f => f.factor === 'delta')!;

    // Step 1: 0.5 * 1 = 0.5
    // Step 2: 0.6 * 2 = 1.2
    expect(delta.steps).toHaveLength(2);
    expect(delta.steps[0]).toBeCloseTo(0.5, 4);
    expect(delta.steps[1]).toBeCloseTo(1.2, 4);
    expect(delta.totalPnl).toBeCloseTo(1.7, 4);

    expect(result.stepCount).toBe(2);
  });
});
