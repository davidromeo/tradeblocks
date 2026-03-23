/**
 * Batch Exit Analysis Engine Tests
 *
 * Tests for the pure batch analysis engine that evaluates exit policies
 * against replay results and computes aggregate statistics.
 */

import {
  analyzeBatch,
  computeAggregateStats,
  type BatchExitConfig,
  type TradeInput,
  type TradeExitResult,
} from '../../src/utils/batch-exit-analysis.js';
import type { PnlPoint, ReplayLeg } from '../../src/utils/trade-replay.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Build a simple linear P&L path from start to end over N minutes. */
function buildPath(start: number, end: number, steps: number): PnlPoint[] {
  return Array.from({ length: steps }, (_, i) => {
    const pnl = start + ((end - start) * i) / (steps - 1);
    const hour = 9 + Math.floor((30 + i) / 60);
    const minute = (30 + i) % 60;
    return {
      timestamp: `2026-01-05 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      strategyPnl: pnl,
      legPrices: [5.0, 3.0],
    };
  });
}

const DEFAULT_LEGS: ReplayLeg[] = [
  { occTicker: 'SPY260105C00470000', quantity: -1, entryPrice: 5.0, multiplier: 100 },
  { occTicker: 'SPY260105C00465000', quantity: 1, entryPrice: 3.0, multiplier: 100 },
];

/** Build a TradeInput with a given P&L path and actual P&L. */
function buildTradeInput(
  index: number,
  actualPnl: number,
  path: PnlPoint[],
  dateOpened = '2026-01-05',
): TradeInput {
  return {
    tradeIndex: index,
    dateOpened,
    actualPnl,
    pnlPath: path,
    legs: DEFAULT_LEGS,
  };
}

const PROFIT_TARGET_CONFIG: BatchExitConfig = {
  candidatePolicy: [{ type: 'profitTarget', threshold: 200 }],
  baselineMode: 'actual',
  format: 'full',
};

// ---------------------------------------------------------------------------
// Test 1: analyzeBatch with empty trades array
// ---------------------------------------------------------------------------

describe('analyzeBatch', () => {
  test('empty trades array returns zero-count aggregate stats', () => {
    const result = analyzeBatch([], PROFIT_TARGET_CONFIG);
    expect(result.aggregate.totalTrades).toBe(0);
    expect(result.aggregate.winningTrades).toBe(0);
    expect(result.aggregate.losingTrades).toBe(0);
    expect(result.aggregate.winRate).toBe(0);
    expect(result.aggregate.totalPnl).toBe(0);
    expect(result.aggregate.avgPnl).toBe(0);
    expect(result.aggregate.profitFactor).toBe(0);
    expect(result.aggregate.sharpeRatio).toBeNull();
    expect(result.triggerAttribution).toEqual([]);
    expect(result.perTrade).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Test 2: All winning trades (profitTarget fires)
  // ---------------------------------------------------------------------------

  test('3 winning trades with profitTarget returns correct win rate and total P&L', () => {
    // Each trade goes to $300 (exceeds $200 profit target at some point)
    const trades = [0, 1, 2].map(i =>
      buildTradeInput(i, 200, buildPath(0, 300, 10))
    );

    const result = analyzeBatch(trades, PROFIT_TARGET_CONFIG);

    expect(result.aggregate.totalTrades).toBe(3);
    expect(result.aggregate.winningTrades).toBe(3);
    expect(result.aggregate.losingTrades).toBe(0);
    expect(result.aggregate.winRate).toBe(1.0);
    // candidatePnl = $200 (trigger fires at threshold) * 3 trades
    expect(result.aggregate.totalPnl).toBeCloseTo(600, 0);
    expect(result.aggregate.avgPnl).toBeCloseTo(200, 0);
  });

  // ---------------------------------------------------------------------------
  // Test 3: Mixed wins/losses — correct profit factor
  // ---------------------------------------------------------------------------

  test('mixed wins/losses returns correct profit factor', () => {
    // 2 winning trades at $200, 1 losing trade at -$150
    const winPath = buildPath(0, 300, 10);  // hits $200 profit target
    const lossPath = buildPath(0, -150, 10); // no trigger fires

    const trades = [
      buildTradeInput(0, 200, winPath, '2026-01-03'),
      buildTradeInput(1, 200, winPath, '2026-01-04'),
      buildTradeInput(2, -150, lossPath, '2026-01-05'),
    ];

    const result = analyzeBatch(trades, PROFIT_TARGET_CONFIG);

    expect(result.aggregate.totalTrades).toBe(3);
    expect(result.aggregate.winningTrades).toBe(2);
    expect(result.aggregate.losingTrades).toBe(1);

    // profitFactor = sum(wins) / abs(sum(losses))
    // wins = 200 + 200 = 400, losses = |-150| = 150
    // profitFactor = 400/150 ≈ 2.667
    expect(result.aggregate.profitFactor).toBeCloseTo(400 / 150, 2);
  });

  // ---------------------------------------------------------------------------
  // Test 4: baseline="actual" computes delta as candidate - actual
  // ---------------------------------------------------------------------------

  test('baseline=actual computes candidate P&L delta correctly', () => {
    // Trade: path goes to $300 (profit target $200 fires)
    // actual P&L = $180
    // candidatePnl = $200 (trigger fires at threshold)
    // delta = $200 - $180 = $20
    const path = buildPath(0, 300, 10);
    const trade = buildTradeInput(0, 180, path);

    const result = analyzeBatch([trade], {
      ...PROFIT_TARGET_CONFIG,
      baselineMode: 'actual',
    });

    expect(result.perTrade[0].candidatePnl).toBeCloseTo(200, 1);
    expect(result.perTrade[0].baselinePnl).toBe(180);
    expect(result.perTrade[0].pnlDelta).toBeCloseTo(20, 1);
  });

  // ---------------------------------------------------------------------------
  // Test 5: baseline="holdToEnd" uses last P&L path point as baseline
  // ---------------------------------------------------------------------------

  test('baseline=holdToEnd uses last P&L path point as baseline', () => {
    // path goes from 0 to 300, last point = 300
    // profit target $200 fires → candidatePnl = $200
    // baselinePnl = $300 (last path point)
    // delta = $200 - $300 = -$100
    const path = buildPath(0, 300, 10);
    const trade = buildTradeInput(0, 250, path);  // actual = $250 (ignored in this mode)

    const result = analyzeBatch([trade], {
      ...PROFIT_TARGET_CONFIG,
      baselineMode: 'holdToEnd',
    });

    expect(result.perTrade[0].candidatePnl).toBeCloseTo(200, 1);
    expect(result.perTrade[0].baselinePnl).toBeCloseTo(300, 0);
    expect(result.perTrade[0].pnlDelta).toBeCloseTo(-100, 0);
  });

  // ---------------------------------------------------------------------------
  // Test 6: Per-trigger attribution counts trigger types
  // ---------------------------------------------------------------------------

  test('per-trigger attribution counts how many trades each trigger type fired first on', () => {
    // Mix: 2 profit target fires, 1 no trigger
    const winPath = buildPath(0, 300, 10);
    const lossPath = buildPath(0, -50, 10);

    const trades = [
      buildTradeInput(0, 200, winPath, '2026-01-03'),
      buildTradeInput(1, 200, winPath, '2026-01-04'),
      buildTradeInput(2, -50, lossPath, '2026-01-05'),
    ];

    const result = analyzeBatch(trades, PROFIT_TARGET_CONFIG);

    const profitTargetAttr = result.triggerAttribution.find(a => a.trigger === 'profitTarget');
    const noTriggerAttr = result.triggerAttribution.find(a => a.trigger === 'noTrigger');

    expect(profitTargetAttr).toBeDefined();
    expect(profitTargetAttr!.count).toBe(2);
    expect(noTriggerAttr).toBeDefined();
    expect(noTriggerAttr!.count).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Test 9: Trade where no trigger fires is counted in "noTrigger"
  // ---------------------------------------------------------------------------

  test('trade where no trigger fires is counted in noTrigger attribution category', () => {
    // Path never reaches profit target
    const flatPath = buildPath(0, 50, 10);
    const trade = buildTradeInput(0, 50, flatPath);

    const result = analyzeBatch([trade], PROFIT_TARGET_CONFIG);

    const noTrigger = result.triggerAttribution.find(a => a.trigger === 'noTrigger');
    expect(noTrigger).toBeDefined();
    expect(noTrigger!.count).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Test 10: format="summary" omits per-trade breakdown; "full" includes it
  // ---------------------------------------------------------------------------

  test('format=summary omits per-trade breakdown', () => {
    const path = buildPath(0, 300, 10);
    const trade = buildTradeInput(0, 200, path);

    const summaryResult = analyzeBatch([trade], {
      ...PROFIT_TARGET_CONFIG,
      format: 'summary',
    });
    expect(summaryResult.perTrade).toEqual([]);

    const fullResult = analyzeBatch([trade], {
      ...PROFIT_TARGET_CONFIG,
      format: 'full',
    });
    expect(fullResult.perTrade.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeAggregateStats tests
// ---------------------------------------------------------------------------

describe('computeAggregateStats', () => {
  // ---------------------------------------------------------------------------
  // Test 7: Max sequential drawdown from ordered trade P&Ls
  // ---------------------------------------------------------------------------

  test('computes max sequential drawdown from ordered trade P&Ls', () => {
    // Equity curve from P&Ls: 100, 150, 100, 200, 50
    // Cumulative: 100, 250, 350, 550, 600
    // Peak: 550, then 600... let's use: 100, -50, 200, -100
    // Cumsum: 100, 50, 250, 150
    // Peaks: 100→50 = -50 draw, 250→150 = -100 draw
    // Max drawdown = 100
    const results = buildTradeExitResults([100, -50, 200, -100]);
    const stats = computeAggregateStats(results);
    expect(stats.maxDrawdown).toBeCloseTo(100, 0);
  });

  // ---------------------------------------------------------------------------
  // Test 8: Sharpe ratio = mean/stddev of trade P&Ls (trade-level, not annualized)
  // ---------------------------------------------------------------------------

  test('computes Sharpe ratio as mean/stddev of trade P&Ls', () => {
    // P&Ls: 100, 200, 300 → mean=200, stddev(sample)=100
    // Sharpe = 200/100 = 2.0
    const results = buildTradeExitResults([100, 200, 300]);
    const stats = computeAggregateStats(results);
    expect(stats.sharpeRatio).toBeCloseTo(2.0, 5);
  });

  test('returns null Sharpe for fewer than 2 trades', () => {
    const results = buildTradeExitResults([200]);
    const stats = computeAggregateStats(results);
    expect(stats.sharpeRatio).toBeNull();
  });

  test('profit factor is Infinity when no losing trades', () => {
    const results = buildTradeExitResults([100, 200, 300]);
    const stats = computeAggregateStats(results);
    expect(stats.profitFactor).toBe(Infinity);
  });

  test('computes win/loss streaks correctly', () => {
    // W, W, L, W, L, L, L → maxWinStreak=2, maxLossStreak=3
    const results = buildTradeExitResults([100, 200, -50, 150, -100, -80, -30]);
    const stats = computeAggregateStats(results);
    expect(stats.maxWinStreak).toBe(2);
    expect(stats.maxLossStreak).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Helper for computeAggregateStats tests
// ---------------------------------------------------------------------------

function buildTradeExitResults(candidatePnls: number[]): TradeExitResult[] {
  return candidatePnls.map((pnl, i) => ({
    tradeIndex: i,
    dateOpened: `2026-01-${String(i + 1).padStart(2, '0')}`,
    actualPnl: pnl,
    candidatePnl: pnl,
    baselinePnl: pnl,
    pnlDelta: 0,
    triggerFired: pnl > 0 ? ('profitTarget' as const) : ('noTrigger' as const),
    fireTimestamp: pnl > 0 ? '2026-01-01 10:00' : null,
  }));
}
