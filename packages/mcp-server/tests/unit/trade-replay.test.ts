import {
  parseLegsString,
  buildOccTicker,
  computeStrategyPnlPath,
  computeReplayMfeMae,
  type ReplayLeg,
  type PnlPoint,
  type MassiveBarRow,
} from '../../src/test-exports.js';

describe('parseLegsString', () => {
  it('parses single call leg', () => {
    const result = parseLegsString('SPY 470C');
    expect(result).toEqual([{ root: 'SPY', strike: 470, type: 'C', quantity: 1 }]);
  });

  it('parses two-leg call spread', () => {
    const result = parseLegsString('SPY 470C/465C');
    expect(result).toEqual([
      { root: 'SPY', strike: 470, type: 'C', quantity: 1 },
      { root: 'SPY', strike: 465, type: 'C', quantity: -1 },
    ]);
  });

  it('parses two-leg put spread', () => {
    const result = parseLegsString('SPX 4500P/4450P');
    expect(result).toEqual([
      { root: 'SPX', strike: 4500, type: 'P', quantity: 1 },
      { root: 'SPX', strike: 4450, type: 'P', quantity: -1 },
    ]);
  });

  it('parses three-leg butterfly', () => {
    const result = parseLegsString('SPY 490C/500C/510C');
    expect(result).toHaveLength(3);
    expect(result[0].quantity).toBe(1);
    expect(result[1].quantity).toBe(-1);
    expect(result[2].quantity).toBe(1);
  });

  it('throws for legs without strikes (hypothetical mode)', () => {
    expect(() => parseLegsString('SPX Put Spread')).toThrow('hypothetical mode');
  });

  it('throws for empty string', () => {
    expect(() => parseLegsString('')).toThrow();
  });

  it('parses verbose format "SPY Jan25 470 Call"', () => {
    const result = parseLegsString('SPY Jan25 470 Call');
    expect(result).toEqual([{ root: 'SPY', strike: 470, type: 'C', quantity: 1 }]);
  });

  it('parses verbose format with Put', () => {
    const result = parseLegsString('SPY Feb25 350 Put');
    expect(result).toEqual([{ root: 'SPY', strike: 350, type: 'P', quantity: 1 }]);
  });

  it('parses fractional strikes', () => {
    const result = parseLegsString('SPY 0.50C');
    expect(result).toEqual([{ root: 'SPY', strike: 0.5, type: 'C', quantity: 1 }]);
  });
});

describe('buildOccTicker', () => {
  it('builds standard call ticker', () => {
    expect(buildOccTicker('SPY', '2025-01-17', 'C', 470)).toBe('SPY250117C00470000');
  });

  it('builds index put ticker', () => {
    expect(buildOccTicker('SPX', '2025-12-19', 'P', 4500)).toBe('SPX251219P04500000');
  });

  it('handles penny strike', () => {
    expect(buildOccTicker('SPY', '2025-01-17', 'C', 0.50)).toBe('SPY250117C00000500');
  });

  it('handles weekly root', () => {
    expect(buildOccTicker('SPXW', '2025-01-17', 'C', 4500)).toBe('SPXW250117C04500000');
  });
});

describe('computeStrategyPnlPath', () => {
  it('computes P&L for single leg with 3 bars', () => {
    const legs: ReplayLeg[] = [
      { occTicker: 'SPY250117C00470000', quantity: 1, entryPrice: 5.00, multiplier: 100 },
    ];
    const bars: MassiveBarRow[][] = [[
      { date: '2025-01-17', time: '09:31', open: 5.40, high: 5.60, low: 5.40, close: 5.55, volume: 100, ticker: 'SPY250117C00470000' },
      { date: '2025-01-17', time: '09:32', open: 4.70, high: 4.90, low: 4.70, close: 4.85, volume: 100, ticker: 'SPY250117C00470000' },
      { date: '2025-01-17', time: '09:33', open: 5.10, high: 5.30, low: 5.10, close: 5.25, volume: 100, ticker: 'SPY250117C00470000' },
    ]];

    const result = computeStrategyPnlPath(legs, bars);
    expect(result).toHaveLength(3);
    // HL2 = (5.60+5.40)/2=5.50, (4.90+4.70)/2=4.80, (5.30+5.10)/2=5.20
    // P&L = (HL2 - 5.00) * 1 * 100 = 50, -20, 20
    expect(result[0].strategyPnl).toBeCloseTo(50, 5);
    expect(result[1].strategyPnl).toBeCloseTo(-20, 5);
    expect(result[2].strategyPnl).toBeCloseTo(20, 5);
  });

  it('computes P&L for two-leg spread', () => {
    const legs: ReplayLeg[] = [
      { occTicker: 'LEG1', quantity: 1, entryPrice: 5.00, multiplier: 100 },
      { occTicker: 'LEG2', quantity: -1, entryPrice: 3.00, multiplier: 100 },
    ];
    const bars: MassiveBarRow[][] = [
      [{ date: '2025-01-17', time: '09:31', open: 5.40, high: 6.00, low: 5.40, close: 5.80, volume: 10, ticker: 'LEG1' }],
      [{ date: '2025-01-17', time: '09:31', open: 3.40, high: 4.00, low: 3.40, close: 3.80, volume: 10, ticker: 'LEG2' }],
    ];

    const result = computeStrategyPnlPath(legs, bars);
    expect(result).toHaveLength(1);
    // Leg1: (5.70 - 5.00) * 1 * 100 = 70
    // Leg2: (3.70 - 3.00) * -1 * 100 = -70
    // Combined = 0
    expect(result[0].strategyPnl).toBeCloseTo(0, 5);
  });

  it('returns empty array for empty bars', () => {
    const legs: ReplayLeg[] = [
      { occTicker: 'X', quantity: 1, entryPrice: 1.00, multiplier: 100 },
    ];
    const result = computeStrategyPnlPath(legs, [[]]);
    expect(result).toEqual([]);
  });

  it('includes legPrices in each point', () => {
    const legs: ReplayLeg[] = [
      { occTicker: 'LEG1', quantity: 1, entryPrice: 5.00, multiplier: 100 },
    ];
    const bars: MassiveBarRow[][] = [[
      { date: '2025-01-17', time: '09:31', open: 5.40, high: 5.60, low: 5.40, close: 5.55, volume: 100, ticker: 'LEG1' },
    ]];

    const result = computeStrategyPnlPath(legs, bars);
    expect(result[0].legPrices).toEqual([5.50]);
  });
});

describe('computeReplayMfeMae', () => {
  it('finds MFE and MAE in mixed path', () => {
    const path: PnlPoint[] = [
      { timestamp: '2025-01-17 09:31', strategyPnl: 50, legPrices: [] },
      { timestamp: '2025-01-17 09:32', strategyPnl: -20, legPrices: [] },
      { timestamp: '2025-01-17 09:33', strategyPnl: 100, legPrices: [] },
      { timestamp: '2025-01-17 09:34', strategyPnl: -10, legPrices: [] },
      { timestamp: '2025-01-17 09:35', strategyPnl: 30, legPrices: [] },
    ];

    const result = computeReplayMfeMae(path);
    expect(result.mfe).toBe(100);
    expect(result.mae).toBe(-20);
    expect(result.mfeTimestamp).toBe('2025-01-17 09:33');
    expect(result.maeTimestamp).toBe('2025-01-17 09:32');
  });

  it('handles all positive path', () => {
    const path: PnlPoint[] = [
      { timestamp: '2025-01-17 09:31', strategyPnl: 10, legPrices: [] },
      { timestamp: '2025-01-17 09:32', strategyPnl: 50, legPrices: [] },
      { timestamp: '2025-01-17 09:33', strategyPnl: 30, legPrices: [] },
    ];

    const result = computeReplayMfeMae(path);
    expect(result.mfe).toBe(50);
    expect(result.mae).toBe(10);
  });

  it('returns zeros for empty path', () => {
    const result = computeReplayMfeMae([]);
    expect(result.mfe).toBe(0);
    expect(result.mae).toBe(0);
    expect(result.mfeTimestamp).toBe('');
    expect(result.maeTimestamp).toBe('');
  });

  it('handles single point', () => {
    const path: PnlPoint[] = [
      { timestamp: '2025-01-17 09:31', strategyPnl: 42, legPrices: [] },
    ];

    const result = computeReplayMfeMae(path);
    expect(result.mfe).toBe(42);
    expect(result.mae).toBe(42);
    expect(result.mfeTimestamp).toBe('2025-01-17 09:31');
    expect(result.maeTimestamp).toBe('2025-01-17 09:31');
  });
});
