import {
  evaluateTrigger,
  analyzeExitTriggers,
  type ExitTriggerConfig,
  type TriggerType,
  type LegGroupConfig,
} from '../../dist/utils/exit-triggers.js';
import type { PnlPoint, ReplayLeg, GreeksResult } from '../../dist/utils/trade-replay.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a synthetic PnlPoint[] from P&L values. */
function buildTestPath(
  pnls: number[],
  opts?: {
    deltas?: number[];
    legPrices?: number[][];
    legGreeks?: GreeksResult[][];
    startTime?: string;
  },
): PnlPoint[] {
  const start = opts?.startTime ?? '2026-01-05 09:30';
  const [datePart, timePart] = start.split(' ');
  const [hh, mm] = timePart.split(':').map(Number);

  return pnls.map((pnl, i) => {
    const minute = mm + i;
    const hour = hh + Math.floor(minute / 60);
    const m = minute % 60;
    const ts = `${datePart} ${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return {
      timestamp: ts,
      strategyPnl: pnl,
      legPrices: opts?.legPrices?.[i] ?? [5.0, 3.0],
      netDelta: opts?.deltas?.[i] ?? null,
      legGreeks: opts?.legGreeks?.[i],
    };
  });
}

const DEFAULT_LEGS: ReplayLeg[] = [
  { occTicker: 'SPY260105C00470000', quantity: -1, entryPrice: 5.0, multiplier: 100 },
  { occTicker: 'SPY260105C00465000', quantity: 1, entryPrice: 3.0, multiplier: 100 },
];

// A path that goes up, peaks, then drops
const STANDARD_PNLS = [0, 50, 100, 200, 300, 250, 150, 50, -100, -200];
const STANDARD_DELTAS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.85, 0.75, 0.6, 0.4, 0.3];

// ---------------------------------------------------------------------------
// evaluateTrigger — individual trigger type tests
// ---------------------------------------------------------------------------

describe('evaluateTrigger', () => {
  const path = buildTestPath(STANDARD_PNLS, { deltas: STANDARD_DELTAS });

  describe('profitTarget', () => {
    it('fires when P&L >= threshold', () => {
      const trigger: ExitTriggerConfig = { type: 'profitTarget', threshold: 200 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('profitTarget');
      expect(result!.index).toBe(3); // pnl=200
      expect(result!.pnlAtFire).toBe(200);
    });

    it('returns null when threshold never reached', () => {
      const trigger: ExitTriggerConfig = { type: 'profitTarget', threshold: 500 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });
  });

  describe('stopLoss', () => {
    it('fires when P&L <= -threshold', () => {
      const trigger: ExitTriggerConfig = { type: 'stopLoss', threshold: 100 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('stopLoss');
      expect(result!.index).toBe(8); // pnl=-100
      expect(result!.pnlAtFire).toBe(-100);
    });

    it('returns null when loss threshold not reached', () => {
      const trigger: ExitTriggerConfig = { type: 'stopLoss', threshold: 300 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });
  });

  describe('trailingStop', () => {
    it('fires when P&L drops trailAmount below running max', () => {
      const trigger: ExitTriggerConfig = { type: 'trailingStop', threshold: 100 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('trailingStop');
      // Running max hits 300 at index 4, then drops to 150 at index 6 (dropdown=150 >= 100)
      expect(result!.index).toBe(6);
      expect(result!.pnlAtFire).toBe(150);
    });

    it('uses trailAmount when provided', () => {
      const trigger: ExitTriggerConfig = { type: 'trailingStop', threshold: 999, trailAmount: 50 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      // Running max 300 at index 4, dropdown to 250 at index 5 = 50 >= 50
      expect(result!.index).toBe(5);
    });

    it('returns null when trail never exceeded', () => {
      const trigger: ExitTriggerConfig = { type: 'trailingStop', threshold: 600 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });
  });

  describe('dteExit', () => {
    it('fires when DTE drops to threshold', () => {
      // Path timestamps are on 2026-01-05, expiry 2026-01-07 -> DTE=2
      const trigger: ExitTriggerConfig = {
        type: 'dteExit',
        threshold: 3,
        expiry: '2026-01-07',
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('dteExit');
      expect(result!.index).toBe(0); // DTE=2 <= 3 from the first point
    });

    it('returns null when DTE is above threshold', () => {
      const trigger: ExitTriggerConfig = {
        type: 'dteExit',
        threshold: 1,
        expiry: '2026-01-10', // DTE=5
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });

    it('returns null without expiry config', () => {
      const trigger: ExitTriggerConfig = { type: 'dteExit', threshold: 3 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });
  });

  describe('ditExit', () => {
    it('fires when days-in-trade exceeds threshold', () => {
      const trigger: ExitTriggerConfig = {
        type: 'ditExit',
        threshold: 3,
        openDate: '2026-01-02', // opened 3 days ago
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ditExit');
      expect(result!.index).toBe(0); // DIT=3 >= 3
    });

    it('returns null when DIT below threshold', () => {
      const trigger: ExitTriggerConfig = {
        type: 'ditExit',
        threshold: 10,
        openDate: '2026-01-04',
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });
  });

  describe('clockTimeExit', () => {
    it('fires at specified time', () => {
      const trigger: ExitTriggerConfig = {
        type: 'clockTimeExit',
        threshold: 0,
        clockTime: '09:35',
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(5); // 09:35
      expect(result!.firedAt).toBe('2026-01-05 09:35');
    });

    it('defaults to 15:00', () => {
      // All timestamps are 09:30-09:39 — won't reach 15:00
      const trigger: ExitTriggerConfig = { type: 'clockTimeExit', threshold: 0 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });
  });

  describe('underlyingPriceMove', () => {
    it('fires on % move from open', () => {
      const underlyingPrices = new Map<string, number>();
      path.forEach((p, i) => {
        // Start at 500, move up 2% at index 3
        underlyingPrices.set(p.timestamp, i < 3 ? 500 : 510);
      });
      const trigger: ExitTriggerConfig = {
        type: 'underlyingPriceMove',
        threshold: 1.5, // 1.5%
        underlyingPrices,
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('underlyingPriceMove');
      // Index 0 sets first price (500). Indices 1,2 are still 500 (0% move).
      // Index 3: 510/500 = 2% >= 1.5% threshold
      expect(result!.index).toBe(3);
    });

    it('returns null without underlyingPrices map', () => {
      const trigger: ExitTriggerConfig = {
        type: 'underlyingPriceMove',
        threshold: 1,
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });
  });

  describe('positionDelta', () => {
    it('fires when abs(netDelta) >= threshold', () => {
      const trigger: ExitTriggerConfig = { type: 'positionDelta', threshold: 0.85 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(4); // delta=0.9 >= 0.85
    });

    it('returns null when delta stays below threshold', () => {
      const trigger: ExitTriggerConfig = { type: 'positionDelta', threshold: 1.0 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });
  });

  describe('perLegDelta', () => {
    it('fires when any single leg delta exceeds threshold', () => {
      const legGreeks: GreeksResult[][] = STANDARD_PNLS.map((_, i) => [
        { delta: 0.3 + i * 0.05, gamma: 0.01, theta: -0.5, vega: 0.1, iv: 0.2 },
        { delta: -(0.2 + i * 0.03), gamma: 0.01, theta: -0.5, vega: 0.1, iv: 0.2 },
      ]);
      const pathWithGreeks = buildTestPath(STANDARD_PNLS, { deltas: STANDARD_DELTAS, legGreeks });
      const trigger: ExitTriggerConfig = { type: 'perLegDelta', threshold: 0.6 };
      const result = evaluateTrigger(trigger, pathWithGreeks, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('perLegDelta');
      // Leg 0 delta: 0.3, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60 -> fires at i=6
      expect(result!.index).toBe(6);
    });

    it('returns null without legGreeks', () => {
      const trigger: ExitTriggerConfig = { type: 'perLegDelta', threshold: 0.5 };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });
  });

  describe('vixMove', () => {
    it('fires on VIX % move', () => {
      const vixPrices = new Map<string, number>();
      path.forEach((p, i) => {
        vixPrices.set(p.timestamp, i < 5 ? 20 : 23); // 15% spike at index 5
      });
      const trigger: ExitTriggerConfig = {
        type: 'vixMove',
        threshold: 10, // 10%
        vixPrices,
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(5); // 20->23 = 15% >= 10%
    });
  });

  describe('vix9dMove', () => {
    it('fires on VIX9D % move', () => {
      const vix9dPrices = new Map<string, number>();
      path.forEach((p, i) => {
        vix9dPrices.set(p.timestamp, i < 3 ? 18 : 22); // 22% spike
      });
      const trigger: ExitTriggerConfig = {
        type: 'vix9dMove',
        threshold: 20,
        vix9dPrices,
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(3);
    });
  });

  describe('vix9dVixRatio', () => {
    it('fires when ratio crosses threshold (contango deepening)', () => {
      const vixPrices = new Map<string, number>();
      const vix9dPrices = new Map<string, number>();
      path.forEach((p, i) => {
        vixPrices.set(p.timestamp, 20);
        vix9dPrices.set(p.timestamp, i < 4 ? 20 : 24); // ratio 1.0 -> 1.2
      });
      const trigger: ExitTriggerConfig = {
        type: 'vix9dVixRatio',
        threshold: 1.15,
        vixPrices,
        vix9dPrices,
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(4); // 24/20 = 1.2 >= 1.15
    });

    it('fires when ratio drops below threshold (backwardation)', () => {
      const vixPrices = new Map<string, number>();
      const vix9dPrices = new Map<string, number>();
      path.forEach((p, i) => {
        vixPrices.set(p.timestamp, 20);
        vix9dPrices.set(p.timestamp, i < 3 ? 19 : 17); // ratio 0.95 -> 0.85
      });
      const trigger: ExitTriggerConfig = {
        type: 'vix9dVixRatio',
        threshold: 0.9,
        vixPrices,
        vix9dPrices,
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(3); // 17/20 = 0.85 <= 0.9
    });
  });

  describe('slRatioThreshold', () => {
    it('fires when S/L ratio >= threshold', () => {
      // Short leg (index 0, qty=-1): markPrice * |-1| * 100
      // Initially: 5.0 * 1 * 100 = 500
      // maxLoss = spreadWidth * contracts * multiplier = 5 * 1 * 100 = 500
      // S/L ratio = 500/500 = 1.0
      const trigger: ExitTriggerConfig = {
        type: 'slRatioThreshold',
        threshold: 1.0,
        spreadWidth: 5,
        contracts: 1,
        multiplier: 100,
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('slRatioThreshold');
      expect(result!.index).toBe(0); // S/L ratio = 1.0 from start
    });

    it('returns null when spreadWidth is 0', () => {
      const trigger: ExitTriggerConfig = {
        type: 'slRatioThreshold',
        threshold: 0.5,
        spreadWidth: 0,
      };
      const result = evaluateTrigger(trigger, path, DEFAULT_LEGS);
      expect(result).toBeNull();
    });
  });

  describe('slRatioMove', () => {
    it('fires when S/L ratio changes by threshold from initial', () => {
      // Build a path where short leg price changes significantly
      const legPrices = STANDARD_PNLS.map((_, i) => [5.0 + i * 0.5, 3.0]); // short leg price rises
      const pathWithPrices = buildTestPath(STANDARD_PNLS, { legPrices });
      const trigger: ExitTriggerConfig = {
        type: 'slRatioMove',
        threshold: 0.3,
        spreadWidth: 5,
        contracts: 1,
        multiplier: 100,
      };
      // Initial S/L: (5.0 * 1 * 100) / 500 = 1.0
      // At index 4: (7.0 * 1 * 100) / 500 = 1.4, change = 0.4 >= 0.3
      const result = evaluateTrigger(trigger, pathWithPrices, DEFAULT_LEGS);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('slRatioMove');
      // Index 0 sets initial. Index 1: 5.5->1.1, change=0.1. Index 2: 6.0->1.2, change=0.2. Index 3: 6.5->1.3, change=0.3
      expect(result!.index).toBe(3);
    });
  });

  it('returns null on empty path', () => {
    const trigger: ExitTriggerConfig = { type: 'profitTarget', threshold: 100 };
    const result = evaluateTrigger(trigger, [], DEFAULT_LEGS);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// analyzeExitTriggers — orchestrator tests
// ---------------------------------------------------------------------------

describe('analyzeExitTriggers', () => {
  const path = buildTestPath(STANDARD_PNLS, { deltas: STANDARD_DELTAS });

  it('identifies first-to-fire when multiple triggers fire', () => {
    const triggers: ExitTriggerConfig[] = [
      { type: 'profitTarget', threshold: 200 }, // fires at index 3
      { type: 'stopLoss', threshold: 100 },     // fires at index 8
    ];
    const result = analyzeExitTriggers({ pnlPath: path, legs: DEFAULT_LEGS, triggers });
    expect(result.overall.triggers).toHaveLength(2);
    expect(result.overall.firstToFire).not.toBeNull();
    expect(result.overall.firstToFire!.type).toBe('profitTarget');
    expect(result.overall.firstToFire!.index).toBe(3);
  });

  it('returns null firstToFire when no triggers fire', () => {
    const triggers: ExitTriggerConfig[] = [
      { type: 'profitTarget', threshold: 500 },
    ];
    const result = analyzeExitTriggers({ pnlPath: path, legs: DEFAULT_LEGS, triggers });
    expect(result.overall.triggers).toHaveLength(0);
    expect(result.overall.firstToFire).toBeNull();
    expect(result.overall.summary).toContain('No triggers fired');
  });

  it('computes actual exit comparison correctly', () => {
    const triggers: ExitTriggerConfig[] = [
      { type: 'profitTarget', threshold: 200 }, // fires at index 3 (pnl=200)
    ];
    // Actual exit at index 7 (pnl=50)
    const result = analyzeExitTriggers({
      pnlPath: path,
      legs: DEFAULT_LEGS,
      triggers,
      actualExitTimestamp: '2026-01-05 09:37',
    });
    expect(result.overall.actualExit).toBeDefined();
    expect(result.overall.actualExit!.pnl).toBe(50);
    expect(result.overall.actualExit!.pnlDifference).toBe(150); // 200 - 50
    expect(result.overall.summary).toContain('better');
  });

  it('handles actual exit after all path points', () => {
    const triggers: ExitTriggerConfig[] = [
      { type: 'profitTarget', threshold: 100 }, // fires at index 2 (pnl=100)
    ];
    const result = analyzeExitTriggers({
      pnlPath: path,
      legs: DEFAULT_LEGS,
      triggers,
      actualExitTimestamp: '2026-01-05 10:00', // well after last point
    });
    expect(result.overall.actualExit).toBeDefined();
    // Should use last point (index 9, pnl=-200)
    expect(result.overall.actualExit!.pnl).toBe(-200);
    expect(result.overall.actualExit!.pnlDifference).toBe(300); // 100 - (-200)
  });

  it('generates summary with trigger info', () => {
    const triggers: ExitTriggerConfig[] = [
      { type: 'profitTarget', threshold: 200 },
      { type: 'stopLoss', threshold: 100 },
    ];
    const result = analyzeExitTriggers({ pnlPath: path, legs: DEFAULT_LEGS, triggers });
    expect(result.overall.summary).toContain('profitTarget');
    expect(result.overall.summary).toContain('2 trigger(s) fired total');
  });
});

// ---------------------------------------------------------------------------
// Leg groups
// ---------------------------------------------------------------------------

describe('leg groups', () => {
  it('computes per-group P&L correctly', () => {
    // Two legs: leg 0 (short call, qty=-1, entry=5.0), leg 1 (long call, qty=1, entry=3.0)
    const legPrices = [
      [5.0, 3.0],  // index 0: both at entry
      [4.5, 3.5],  // index 1: leg0 dropped, leg1 rose
      [4.0, 4.0],  // index 2
    ];
    const pnls = [0, 100, 200]; // overall P&L
    const path = buildTestPath(pnls, { legPrices });

    const legGroups: LegGroupConfig[] = [
      {
        label: 'short_call',
        legIndices: [0],
        triggers: [{ type: 'profitTarget', threshold: 40 }],
      },
      {
        label: 'long_call',
        legIndices: [1],
        triggers: [{ type: 'profitTarget', threshold: 80 }],
      },
    ];

    const result = analyzeExitTriggers({
      pnlPath: path,
      legs: DEFAULT_LEGS,
      triggers: [],
      legGroups,
    });

    expect(result.legGroups).toBeDefined();
    expect(result.legGroups).toHaveLength(2);

    // short_call group: pnl = (markPrice - 5.0) * (-1) * 100
    // index 0: (5.0-5.0)*-1*100 = 0
    // index 1: (4.5-5.0)*-1*100 = 50
    // index 2: (4.0-5.0)*-1*100 = 100
    const shortCallGroup = result.legGroups![0];
    expect(shortCallGroup.label).toBe('short_call');
    expect(shortCallGroup.groupPnl[0]).toBe(0);
    expect(shortCallGroup.groupPnl[1]).toBe(50);
    expect(shortCallGroup.groupPnl[2]).toBe(100);

    // short_call profitTarget at 40 fires at index 1 (groupPnl=50)
    expect(shortCallGroup.result.firstToFire).not.toBeNull();
    expect(shortCallGroup.result.firstToFire!.index).toBe(1);
    expect(shortCallGroup.result.firstToFire!.pnlAtFire).toBe(50);

    // long_call group: pnl = (markPrice - 3.0) * 1 * 100
    // index 0: 0, index 1: 50, index 2: 100
    const longCallGroup = result.legGroups![1];
    expect(longCallGroup.label).toBe('long_call');
    expect(longCallGroup.groupPnl[0]).toBe(0);
    expect(longCallGroup.groupPnl[1]).toBe(50);
    expect(longCallGroup.groupPnl[2]).toBe(100);

    // long_call profitTarget at 80 fires at index 2 (groupPnl=100)
    expect(longCallGroup.result.firstToFire).not.toBeNull();
    expect(longCallGroup.result.firstToFire!.index).toBe(2);
  });

  it('evaluates per-group triggers independently of other groups', () => {
    const legPrices = [
      [5.0, 3.0],
      [6.0, 2.0], // leg 0 got worse (short), leg 1 dropped (long lost value)
      [7.0, 1.0],
    ];
    const path = buildTestPath([0, -100, -200], { legPrices });

    const legGroups: LegGroupConfig[] = [
      {
        label: 'short_call',
        legIndices: [0],
        triggers: [{ type: 'stopLoss', threshold: 50 }], // fires when group pnl <= -50
      },
      {
        label: 'long_call',
        legIndices: [1],
        triggers: [{ type: 'stopLoss', threshold: 50 }],
      },
    ];

    const result = analyzeExitTriggers({
      pnlPath: path,
      legs: DEFAULT_LEGS,
      triggers: [],
      legGroups,
    });

    // short_call pnl: (mark - 5.0) * -1 * 100
    // index 1: (6.0-5.0)*-1*100 = -100 => stopLoss fires at pnl=-100 (>= -50 threshold)
    const shortCall = result.legGroups![0];
    expect(shortCall.result.firstToFire).not.toBeNull();
    expect(shortCall.result.firstToFire!.type).toBe('stopLoss');
    expect(shortCall.result.firstToFire!.index).toBe(1);

    // long_call pnl: (mark - 3.0) * 1 * 100
    // index 1: (2.0-3.0)*1*100 = -100 => stopLoss fires
    const longCall = result.legGroups![1];
    expect(longCall.result.firstToFire).not.toBeNull();
    expect(longCall.result.firstToFire!.index).toBe(1);
  });
});
