/**
 * Unit tests for pure TypeScript indicator functions in market-enricher.ts.
 *
 * Validates:
 * - computeRSI: Wilder smoothing, NaN warmup, all-up/all-down edge cases
 * - computeATR: SMA-seeded first value, Wilder smoothing subsequent values
 * - computeEMA: SMA-seeded, correct k=2/(period+1)
 * - computeSMA: rolling average, NaN for insufficient data
 * - computeBollingerBands: population stddev, position, width
 * - computeRealizedVol: log returns, population stddev, annualized
 * - computeConsecutiveDays: streak counting with sign and reset
 * - isGapFilled: gap detection logic
 * - isOpex: 3rd Friday of month detection via string parsing
 * - computeVIXDerivedFields: pct changes, ratios, lookback-safe
 * - classifyVolRegime: 1-6 classification by VIX level
 * - classifyTermStructure: contango/backwardation/flat
 * - computeVIXPercentile: rolling rank as percentile
 */

// @ts-expect-error - importing from bundled output
import {
  computeRSI,
  computeATR,
  computeEMA,
  computeSMA,
  computeBollingerBands,
  computeRealizedVol,
  computeConsecutiveDays,
  isGapFilled,
  isOpex,
  computeVIXDerivedFields,
  classifyVolRegime,
  classifyTermStructure,
  computeVIXPercentile,
} from '../../dist/test-exports.js';

// =============================================================================
// computeRSI
// =============================================================================

describe('computeRSI', () => {
  test('returns array of same length as input', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(computeRSI(closes, 14)).toHaveLength(20);
  });

  test('first period values are NaN', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const rsi = computeRSI(closes, 14);
    for (let i = 0; i < 14; i++) {
      expect(isNaN(rsi[i])).toBe(true);
    }
    // Index 14 should be a real value (first RSI)
    expect(isNaN(rsi[14])).toBe(false);
  });

  test('RSI = 100 when all bars are up days', () => {
    // 20 consecutive up days — avgLoss = 0, RSI = 100
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const rsi = computeRSI(closes, 14);
    expect(rsi[14]).toBe(100);
  });

  test('RSI = 0 when all bars are down days', () => {
    // 20 consecutive down days — avgGain = 0, RSI = 0
    const closes = Array.from({ length: 20 }, (_, i) => 200 - i);
    const rsi = computeRSI(closes, 14);
    expect(rsi[14]).toBe(0);
  });

  test('hand-verified 3-bar RSI(2): [10, 12, 11] => ~66.67', () => {
    // Period 2, 3 bars: [10, 12, 11]
    // Initial seed (first period=2 changes): change[1]=+2 (gain), (no loss yet)
    // avgGain = 2/2 = 1, avgLoss = 0/2 = 0
    // RSI[2]: first bar — avgGain=1, avgLoss=0 → RSI = 100 - 100/(1 + 1/0) → 100 (all gains)
    // Wait — index 2 is the third bar. Seed uses bars 0..1 (period=2 changes from bar 0 to 1).
    // change at index 1: close[1]-close[0] = 12-10 = +2 → gain=2
    // avgGain = 2/2 = 1, avgLoss = 0
    // result[2] = RSI at index 2 = 100 - 100/(1 + avgGain/avgLoss)
    // But avgLoss=0 → RSI = 100? No — that's only if it's all gains in the SEED period.
    // Seed period is 1..period (inclusive), so bars 1..2: changes are [+2, -1]
    // avgGain = 2/2 = 1, avgLoss = 1/2 = 0.5
    // RSI[period=2] = 100 - 100/(1 + 1/0.5) = 100 - 100/3 = 66.67
    const closes = [10, 12, 11];
    const rsi = computeRSI(closes, 2);
    expect(isNaN(rsi[0])).toBe(true);
    expect(isNaN(rsi[1])).toBe(true);
    expect(rsi[2]).toBeCloseTo(66.67, 1);
  });

  test('returns all NaN for insufficient data (length < period + 1)', () => {
    const closes = [100, 101]; // only 2 bars, period=14
    const rsi = computeRSI(closes, 14);
    for (const v of rsi) {
      expect(isNaN(v)).toBe(true);
    }
  });

  test('uses Wilder smoothing (not SMA) for subsequent values', () => {
    // After the seed period, subsequent RSI uses: avgGain = (prev * (p-1) + gain) / p
    // With all-up then one down day (large drop), RSI drops below 100
    const closes = [
      ...Array.from({ length: 15 }, (_, i) => 100 + i), // 15 consecutive up days
      99, // one large down day — down from 114 to 99 = -15 points loss vs 1-point avg gain
    ];
    const rsi = computeRSI(closes, 14);
    // At index 14 (after 14 up days), RSI = 100
    expect(rsi[14]).toBe(100);
    // At index 15 (one big down day): Wilder: avgGain=(1*13+0)/14≈0.929, avgLoss=(0*13+15)/14≈1.071
    // RSI = 100 - 100/(1 + 0.929/1.071) ≈ 100 - 100/1.133 ≈ 46.43
    // This verifies Wilder smoothing is working — large loss immediately moves RSI significantly
    expect(rsi[15]).toBeLessThan(100);
    expect(rsi[15]).toBeLessThan(60); // Large drop should push RSI well below 60
    expect(rsi[15]).toBeGreaterThan(0); // But not to 0 (still some prior gain memory)
  });
});

// =============================================================================
// computeATR
// =============================================================================

describe('computeATR', () => {
  test('returns array of same length as input', () => {
    const n = 20;
    const highs = Array.from({ length: n }, () => 105);
    const lows = Array.from({ length: n }, () => 95);
    const closes = Array.from({ length: n }, () => 100);
    expect(computeATR(highs, lows, closes, 14)).toHaveLength(n);
  });

  test('first period values are NaN', () => {
    const n = 20;
    const highs = Array.from({ length: n }, (_, i) => 100 + i + 5);
    const lows = Array.from({ length: n }, (_, i) => 100 + i - 5);
    const closes = Array.from({ length: n }, (_, i) => 100 + i);
    const atr = computeATR(highs, lows, closes, 14);
    for (let i = 0; i < 14; i++) {
      expect(isNaN(atr[i])).toBe(true);
    }
    // Index 14 should be first real ATR
    expect(isNaN(atr[14])).toBe(false);
  });

  test('first ATR equals SMA of first period TR values', () => {
    // Constant bars: high-low = 10, no gap (open = close)
    // TR[i] = max(10, |hi-prevClose|, |lo-prevClose|) = 10 for all (since prev close = close = 100)
    const n = 20;
    const highs = Array.from({ length: n }, () => 105);
    const lows = Array.from({ length: n }, () => 95);
    const closes = Array.from({ length: n }, () => 100);
    const atr = computeATR(highs, lows, closes, 14);
    // TR[1..14] = 10 each, SMA = 10
    expect(atr[14]).toBeCloseTo(10, 5);
  });

  test('subsequent ATR uses Wilder smoothing', () => {
    // After seeding at ATR=10, next TR=20 => ATR = (10*13 + 20)/14 = 150/14 ≈ 10.71
    const n = 20;
    const highs = Array.from({ length: n }, () => 105);
    const lows = Array.from({ length: n }, () => 95);
    const closes = Array.from({ length: n }, () => 100);
    // At index 15 (i=15), TR = max(hi-lo, ...) but change highs/lows at that position
    highs[15] = 110;
    lows[15] = 90;
    const atr = computeATR(highs, lows, closes, 14);
    // TR at index 15 = 20, prev ATR = 10 => new ATR = (10*13 + 20)/14
    expect(atr[15]).toBeCloseTo((10 * 13 + 20) / 14, 4);
  });

  test('True Range considers gap from prior close', () => {
    // Day 0: close=100, Day 1: high=102, low=101, close=101 → gap up of 1
    // TR[1] = max(102-101, |102-100|, |101-100|) = max(1, 2, 1) = 2
    const highs = [105, 102];
    const lows = [95, 101];
    const closes = [100, 101];
    // period = 1: first ATR = TR[1] = 2
    const atr = computeATR(highs, lows, closes, 1);
    expect(atr[1]).toBeCloseTo(2, 5);
  });
});

// =============================================================================
// computeEMA
// =============================================================================

describe('computeEMA', () => {
  test('returns array of same length as input', () => {
    const closes = [1, 2, 3, 4, 5];
    expect(computeEMA(closes, 3)).toHaveLength(5);
  });

  test('first period-1 values are NaN', () => {
    const closes = [1, 2, 3, 4, 5];
    const ema = computeEMA(closes, 3);
    expect(isNaN(ema[0])).toBe(true);
    expect(isNaN(ema[1])).toBe(true);
    // Index 2 is the first valid EMA
    expect(isNaN(ema[2])).toBe(false);
  });

  test('seeds from SMA of first period bars (TradingView convention)', () => {
    // EMA(3) on [1,2,3,4,5]: seed = (1+2+3)/3 = 2.0
    const closes = [1, 2, 3, 4, 5];
    const ema = computeEMA(closes, 3);
    expect(ema[2]).toBeCloseTo(2.0, 10);
  });

  test('hand-verified EMA(3) on [1,2,3,4,5]', () => {
    // Seed at index 2: EMA[2] = (1+2+3)/3 = 2.0
    // k = 2/(3+1) = 0.5
    // EMA[3] = 4 * 0.5 + 2.0 * 0.5 = 2 + 1 = 3.0
    // EMA[4] = 5 * 0.5 + 3.0 * 0.5 = 2.5 + 1.5 = 4.0
    const closes = [1, 2, 3, 4, 5];
    const ema = computeEMA(closes, 3);
    expect(ema[2]).toBeCloseTo(2.0, 10);
    expect(ema[3]).toBeCloseTo(3.0, 10);
    expect(ema[4]).toBeCloseTo(4.0, 10);
  });

  test('returns all NaN for insufficient data', () => {
    const closes = [100]; // only 1 bar, period=3
    const ema = computeEMA(closes, 3);
    for (const v of ema) {
      expect(isNaN(v)).toBe(true);
    }
  });
});

// =============================================================================
// computeSMA
// =============================================================================

describe('computeSMA', () => {
  test('returns array of same length as input', () => {
    const closes = [1, 2, 3, 4, 5];
    expect(computeSMA(closes, 3)).toHaveLength(5);
  });

  test('first period-1 values are NaN', () => {
    const closes = [1, 2, 3, 4, 5];
    const sma = computeSMA(closes, 3);
    expect(isNaN(sma[0])).toBe(true);
    expect(isNaN(sma[1])).toBe(true);
    expect(isNaN(sma[2])).toBe(false);
  });

  test('hand-verified SMA(3) on [1,2,3,4,5]', () => {
    const closes = [1, 2, 3, 4, 5];
    const sma = computeSMA(closes, 3);
    expect(sma[2]).toBeCloseTo(2, 10); // (1+2+3)/3
    expect(sma[3]).toBeCloseTo(3, 10); // (2+3+4)/3
    expect(sma[4]).toBeCloseTo(4, 10); // (3+4+5)/3
  });

  test('single bar period returns closes as-is (no NaN)', () => {
    const closes = [10, 20, 30];
    const sma = computeSMA(closes, 1);
    expect(sma).toEqual([10, 20, 30]);
  });
});

// =============================================================================
// computeBollingerBands
// =============================================================================

describe('computeBollingerBands', () => {
  test('returns array of same length as input', () => {
    const closes = Array.from({ length: 25 }, () => 100);
    expect(computeBollingerBands(closes, 20, 2)).toHaveLength(25);
  });

  test('first period-1 entries are null', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
    const bb = computeBollingerBands(closes, 20, 2);
    for (let i = 0; i < 19; i++) {
      expect(bb[i]).toBeNull();
    }
    expect(bb[19]).not.toBeNull();
  });

  test('flat prices produce BB_Width of 0 (no stddev)', () => {
    // All prices = 100 → stddev = 0 → upper = lower = 100 → width = 0
    const closes = Array.from({ length: 25 }, () => 100);
    const bb = computeBollingerBands(closes, 20, 2);
    expect(bb[19]).not.toBeNull();
    expect(bb[19]!.width).toBeCloseTo(0, 10);
    expect(bb[19]!.upper).toBeCloseTo(100, 10);
    expect(bb[19]!.lower).toBeCloseTo(100, 10);
  });

  test('uses population stddev (N denominator)', () => {
    // 3-period BB on [1,2,3,4,5]: test at index 4 (window=[3,4,5])
    // mean = 4, deviations = [-1,0,1], sum sq = 2
    // pop stddev = sqrt(2/3), sample stddev = sqrt(2/2) = 1
    const closes = [1, 2, 3, 4, 5];
    const bb = computeBollingerBands(closes, 3, 1);
    expect(bb[2]).not.toBeNull();
    // width = (upper - lower) / middle = 2*stddev/mean
    // pop stddev of [1,2,3] = sqrt(((1-2)^2 + (2-2)^2 + (3-2)^2)/3) = sqrt(2/3) ≈ 0.8165
    const expectedStddev = Math.sqrt(2 / 3);
    expect(bb[2]!.upper).toBeCloseTo(2 + expectedStddev, 5);
    expect(bb[2]!.lower).toBeCloseTo(2 - expectedStddev, 5);
  });

  test('BB_Position is between 0 and 1 for price within bands', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 95 + i * 0.5);
    const bb = computeBollingerBands(closes, 20, 2);
    const lastRow = bb[24];
    expect(lastRow).not.toBeNull();
    expect(lastRow!.position).toBeGreaterThanOrEqual(0);
    expect(lastRow!.position).toBeLessThanOrEqual(1);
  });

  test('BB_Width is (upper - lower) / middle', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
    const bb = computeBollingerBands(closes, 20, 2);
    const row = bb[24];
    expect(row).not.toBeNull();
    const expected = (row!.upper - row!.lower) / row!.middle;
    expect(row!.width).toBeCloseTo(expected, 10);
  });
});

// =============================================================================
// computeRealizedVol
// =============================================================================

describe('computeRealizedVol', () => {
  test('returns array of same length as input', () => {
    const closes = Array.from({ length: 10 }, (_, i) => 100 + i);
    expect(computeRealizedVol(closes, 5)).toHaveLength(10);
  });

  test('first period values are NaN (indices 0..period-1 are NaN)', () => {
    // With period=5: log returns exist from index 1 onward.
    // Window [i-4..i] of log returns: first valid window is [1..5] at i=5.
    // So indices 0..4 are NaN, index 5 is first valid vol.
    const closes = Array.from({ length: 10 }, (_, i) => 100 + i);
    const vol = computeRealizedVol(closes, 5);
    for (let i = 0; i < 5; i++) {
      expect(isNaN(vol[i])).toBe(true);
    }
    // First valid vol at index 5 (window of log returns [1..5])
    expect(isNaN(vol[5])).toBe(false);
  });

  test('constant prices produce vol of 0', () => {
    // All same price → log returns = 0 → stddev = 0 → vol = 0
    const closes = Array.from({ length: 10 }, () => 100);
    const vol = computeRealizedVol(closes, 5);
    // First valid at index 5 (window of log returns [1..5])
    for (let i = 0; i < closes.length; i++) {
      if (!isNaN(vol[i])) {
        expect(vol[i]).toBeCloseTo(0, 10);
      }
    }
  });

  test('uses population stddev (N denominator) not sample (N-1)', () => {
    // Hand-verify with known returns: log returns [0.01, 0.01, 0.01, 0.01, -0.01] (not exactly)
    // Use simple: period=2 on 3 prices [100, 110, 99]
    // log_return[1] = ln(110/100) ≈ 0.09531
    // log_return[2] = ln(99/110) ≈ -0.10536
    // mean = (0.09531 + (-0.10536)) / 2 = -0.005025
    // pop_var = ((0.09531 - (-0.005025))^2 + ((-0.10536) - (-0.005025))^2) / 2
    // = (0.10034^2 + (-0.10034)^2) / 2 = (0.010068 + 0.010068) / 2 = 0.010068
    // pop_std = sqrt(0.010068) ≈ 0.10034
    // annualized = 0.10034 * sqrt(252) * 100 ≈ 15.93%
    const closes = [100, 110, 99];
    const vol = computeRealizedVol(closes, 2);
    const lr1 = Math.log(110 / 100);
    const lr2 = Math.log(99 / 110);
    const mean = (lr1 + lr2) / 2;
    const popStd = Math.sqrt(((lr1 - mean) ** 2 + (lr2 - mean) ** 2) / 2);
    const expected = popStd * Math.sqrt(252) * 100;
    expect(vol[2]).toBeCloseTo(expected, 3);
  });

  test('values are annualized (much larger than raw daily stddev)', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 2);
    const vol = computeRealizedVol(closes, 20);
    // Annualization factor is sqrt(252) ≈ 15.87, so vol should be in percentage range
    for (let i = 0; i < closes.length; i++) {
      if (!isNaN(vol[i])) {
        expect(vol[i]).toBeGreaterThan(0); // non-zero for varying prices
        expect(vol[i]).toBeLessThan(1000); // sanity check
      }
    }
  });
});

// =============================================================================
// computeConsecutiveDays
// =============================================================================

describe('computeConsecutiveDays', () => {
  test('returns array of same length as input', () => {
    const closes = [1, 2, 3, 2, 2, 4];
    expect(computeConsecutiveDays(closes)).toHaveLength(6);
  });

  test('hand-verified: [1,2,3,2,2,4] => [0,1,2,-1,0,1]', () => {
    const closes = [1, 2, 3, 2, 2, 4];
    const result = computeConsecutiveDays(closes);
    expect(result).toEqual([0, 1, 2, -1, 0, 1]);
  });

  test('first element is always 0 (no prior bar)', () => {
    const closes = [100, 200];
    const result = computeConsecutiveDays(closes);
    expect(result[0]).toBe(0);
  });

  test('consecutive up days increment positive counter', () => {
    const closes = [1, 2, 3, 4, 5];
    const result = computeConsecutiveDays(closes);
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  test('consecutive down days increment negative counter', () => {
    const closes = [5, 4, 3, 2, 1];
    const result = computeConsecutiveDays(closes);
    expect(result).toEqual([0, -1, -2, -3, -4]);
  });

  test('flat day resets to 0', () => {
    const closes = [1, 2, 2, 3]; // up, flat, up
    const result = computeConsecutiveDays(closes);
    expect(result).toEqual([0, 1, 0, 1]);
  });

  test('direction reversal resets counter to 1 or -1', () => {
    // Up streak then a down: counter goes from positive to -1
    const closes = [1, 2, 3, 2]; // up,up,down
    const result = computeConsecutiveDays(closes);
    expect(result).toEqual([0, 1, 2, -1]);
  });

  test('empty array returns empty array', () => {
    expect(computeConsecutiveDays([])).toEqual([]);
  });
});

// =============================================================================
// isGapFilled
// =============================================================================

describe('isGapFilled', () => {
  test('gap up filled when low touches prior close', () => {
    // Gap up: open=102 > priorClose=100, low=99 touches below priorClose → filled
    expect(isGapFilled(102, 110, 99, 100)).toBe(1);
  });

  test('gap up NOT filled when low stays above prior close', () => {
    // Gap up: open=102 > priorClose=100, low=101 > priorClose → not filled
    expect(isGapFilled(102, 110, 101, 100)).toBe(0);
  });

  test('gap down filled when high touches prior close', () => {
    // Gap down: open=98 < priorClose=100, high=101 touches above priorClose → filled
    expect(isGapFilled(98, 101, 90, 100)).toBe(1);
  });

  test('gap down NOT filled when high stays below prior close', () => {
    // Gap down: open=98 < priorClose=100, high=99 < priorClose → not filled
    expect(isGapFilled(98, 99, 90, 100)).toBe(0);
  });

  test('no gap returns 0', () => {
    // open = priorClose (no gap)
    expect(isGapFilled(100, 110, 90, 100)).toBe(0);
  });

  test('exact touch counts as filled (boundary condition)', () => {
    // Gap up: open=102, low=100 exactly touches priorClose=100 → filled
    expect(isGapFilled(102, 110, 100, 100)).toBe(1);
  });
});

// =============================================================================
// isOpex
// =============================================================================

describe('isOpex', () => {
  test('returns 1 for 3rd Friday of January 2025 (2025-01-17)', () => {
    // Jan 2025: 1st is Wednesday, first Friday is 3rd, third Friday is 17th
    expect(isOpex('2025-01-17')).toBe(1);
  });

  test('returns 0 for a non-opex Friday (2025-01-10 = 2nd Friday)', () => {
    expect(isOpex('2025-01-10')).toBe(0);
  });

  test('returns 0 for 4th Friday (2025-01-24)', () => {
    expect(isOpex('2025-01-24')).toBe(0);
  });

  test('returns 0 for a non-Friday (2025-01-16 = Thursday)', () => {
    expect(isOpex('2025-01-16')).toBe(0);
  });

  test('returns 1 for 3rd Friday of March 2025 (2025-03-21)', () => {
    // March 2025: 1st is Saturday, first Friday is 7th, third Friday is 21st
    expect(isOpex('2025-03-21')).toBe(1);
  });

  test('returns 1 for 3rd Friday of November 2025 (2025-11-21)', () => {
    // November 2025: 1st is Saturday, first Friday is 7th, third Friday is 21st
    expect(isOpex('2025-11-21')).toBe(1);
  });

  test('returns 0 for middle of month non-Friday', () => {
    expect(isOpex('2025-06-15')).toBe(0);
  });

  test('handles date string parsing without timezone issues', () => {
    // This test verifies that string parsing is used, not Date("YYYY-MM-DD") which would be UTC midnight
    // The function should work on any timezone server
    expect(isOpex('2025-02-21')).toBe(1); // 3rd Friday of Feb 2025
  });
});

// =============================================================================
// computeVIXDerivedFields
// =============================================================================

describe('computeVIXDerivedFields', () => {
  const mockRows = [
    {
      date: '2025-01-06',
      VIX_Open: 14.0,
      VIX_Close: 13.5,
      VIX_High: 14.5,
      VIX9D_Open: 12.0,
      VIX9D_Close: 11.8,
      VIX3M_Open: 16.0,
      VIX3M_Close: 15.8,
    },
    {
      date: '2025-01-07',
      VIX_Open: 13.8,
      VIX_Close: 14.2,
      VIX_High: 14.5,
      VIX9D_Open: 11.9,
      VIX9D_Close: 12.1,
      VIX3M_Open: 15.9,
      VIX3M_Close: 16.1,
    },
  ];

  test('returns array of same length as input', () => {
    const result = computeVIXDerivedFields(mockRows);
    expect(result).toHaveLength(2);
  });

  test('first row has NaN for pct change fields (no prior row)', () => {
    const result = computeVIXDerivedFields(mockRows);
    expect(isNaN(result[0].VIX_Gap_Pct) || result[0].VIX_Gap_Pct == null).toBe(true);
    expect(isNaN(result[0].VIX_Change_Pct) || result[0].VIX_Change_Pct == null).toBe(true);
  });

  test('second row VIX_Change_Pct computed from prior VIX_Close', () => {
    // VIX_Change_Pct = (VIX_Close[1] - VIX_Close[0]) / VIX_Close[0] * 100
    // = (14.2 - 13.5) / 13.5 * 100 = 0.7/13.5*100 ≈ 5.185
    const result = computeVIXDerivedFields(mockRows);
    const expected = (14.2 - 13.5) / 13.5 * 100;
    expect(result[1].VIX_Change_Pct).toBeCloseTo(expected, 3);
  });

  test('second row VIX_Gap_Pct computed from prior VIX_Close and current VIX_Open', () => {
    // VIX_Gap_Pct = (VIX_Open[1] - VIX_Close[0]) / VIX_Close[0] * 100
    // = (13.8 - 13.5) / 13.5 * 100 = 0.3/13.5*100 ≈ 2.222
    const result = computeVIXDerivedFields(mockRows);
    const expected = (13.8 - 13.5) / 13.5 * 100;
    expect(result[1].VIX_Gap_Pct).toBeCloseTo(expected, 3);
  });

  test('ratio fields computed same-day (no lookback needed)', () => {
    // VIX9D_VIX_Ratio = VIX9D_Close / VIX_Close (same row)
    // Row 0: 11.8 / 13.5 ≈ 0.8741
    const result = computeVIXDerivedFields(mockRows);
    expect(result[0].VIX9D_VIX_Ratio).toBeCloseTo(11.8 / 13.5, 4);
  });

  test('VIX_VIX3M_Ratio computed same-day', () => {
    // Row 0: VIX_Close / VIX3M_Close = 13.5 / 15.8 ≈ 0.8544
    const result = computeVIXDerivedFields(mockRows);
    expect(result[0].VIX_VIX3M_Ratio).toBeCloseTo(13.5 / 15.8, 4);
  });

  test('VIX_Spike_Pct computed same-day from high and open', () => {
    // Row 0: (VIX_High - VIX_Open) / VIX_Open * 100 = (14.5 - 14.0) / 14.0 * 100 ≈ 3.571
    const result = computeVIXDerivedFields(mockRows);
    const expected = (14.5 - 14.0) / 14.0 * 100;
    expect(result[0].VIX_Spike_Pct).toBeCloseTo(expected, 3);
  });

  test('uses VIX_RTH_Open for VIX_Gap_Pct when available', () => {
    const rows = [
      { date: '2025-01-06', VIX_Open: 14.0, VIX_Close: 13.5, VIX_High: 14.5,
        VIX9D_Open: 12.0, VIX9D_Close: 11.8, VIX3M_Open: 16.0, VIX3M_Close: 15.8 },
      { date: '2025-01-07', VIX_Open: 13.8, VIX_RTH_Open: 14.1, VIX_Close: 14.2, VIX_High: 14.5,
        VIX9D_Open: 11.9, VIX9D_Close: 12.1, VIX3M_Open: 15.9, VIX3M_Close: 16.1 },
    ];
    const result = computeVIXDerivedFields(rows);
    // VIX_Gap_Pct should use VIX_RTH_Open (14.1), not VIX_Open (13.8)
    // = (14.1 - 13.5) / 13.5 * 100
    const expected = (14.1 - 13.5) / 13.5 * 100;
    expect(result[1].VIX_Gap_Pct).toBeCloseTo(expected, 3);
  });

  test('uses VIX_RTH_Open for VIX_Spike_Pct when available', () => {
    const rows = [
      { date: '2025-01-07', VIX_Open: 13.8, VIX_RTH_Open: 14.1, VIX_Close: 14.2, VIX_High: 15.0,
        VIX9D_Open: 11.9, VIX9D_Close: 12.1, VIX3M_Open: 15.9, VIX3M_Close: 16.1 },
    ];
    const result = computeVIXDerivedFields(rows);
    // VIX_Spike_Pct = (VIX_High - effectiveOpen) / effectiveOpen * 100
    // = (15.0 - 14.1) / 14.1 * 100
    const expected = (15.0 - 14.1) / 14.1 * 100;
    expect(result[0].VIX_Spike_Pct).toBeCloseTo(expected, 3);
  });

  test('falls back to VIX_Open for VIX_Gap_Pct when VIX_RTH_Open is null', () => {
    const rows = [
      { date: '2025-01-06', VIX_Open: 14.0, VIX_Close: 13.5, VIX_High: 14.5,
        VIX9D_Open: 12.0, VIX9D_Close: 11.8, VIX3M_Open: 16.0, VIX3M_Close: 15.8 },
      { date: '2025-01-07', VIX_Open: 13.8, VIX_RTH_Open: null, VIX_Close: 14.2, VIX_High: 14.5,
        VIX9D_Open: 11.9, VIX9D_Close: 12.1, VIX3M_Open: 15.9, VIX3M_Close: 16.1 },
    ];
    const result = computeVIXDerivedFields(rows);
    // Should use VIX_Open (13.8) since VIX_RTH_Open is null
    const expected = (13.8 - 13.5) / 13.5 * 100;
    expect(result[1].VIX_Gap_Pct).toBeCloseTo(expected, 3);
  });

  test('falls back to VIX_Open for VIX_Spike_Pct when VIX_RTH_Open is undefined', () => {
    // Row without VIX_RTH_Open property at all (simulates pre-RTH-enrichment data)
    const rows = [
      { date: '2025-01-07', VIX_Open: 13.8, VIX_Close: 14.2, VIX_High: 14.5,
        VIX9D_Open: 11.9, VIX9D_Close: 12.1, VIX3M_Open: 15.9, VIX3M_Close: 16.1 },
    ];
    const result = computeVIXDerivedFields(rows);
    // effectiveOpen = undefined ?? 13.8 = 13.8
    const expected = (14.5 - 13.8) / 13.8 * 100;
    expect(result[0].VIX_Spike_Pct).toBeCloseTo(expected, 3);
  });
});

// =============================================================================
// classifyVolRegime
// =============================================================================

describe('classifyVolRegime', () => {
  test('VIX < 13 returns 1 (Very Low)', () => {
    expect(classifyVolRegime(12)).toBe(1);
    expect(classifyVolRegime(12.99)).toBe(1);
  });

  test('13 <= VIX < 16 returns 2 (Low)', () => {
    expect(classifyVolRegime(13)).toBe(2);
    expect(classifyVolRegime(14)).toBe(2);
    expect(classifyVolRegime(15.99)).toBe(2);
  });

  test('16 <= VIX < 20 returns 3 (Normal)', () => {
    expect(classifyVolRegime(16)).toBe(3);
    expect(classifyVolRegime(18)).toBe(3);
    expect(classifyVolRegime(19.99)).toBe(3);
  });

  test('20 <= VIX < 25 returns 4 (Elevated)', () => {
    expect(classifyVolRegime(20)).toBe(4);
    expect(classifyVolRegime(22)).toBe(4);
    expect(classifyVolRegime(24.99)).toBe(4);
  });

  test('25 <= VIX < 30 returns 5 (High)', () => {
    expect(classifyVolRegime(25)).toBe(5);
    expect(classifyVolRegime(27)).toBe(5);
    expect(classifyVolRegime(29.99)).toBe(5);
  });

  test('VIX >= 30 returns 6 (Extreme)', () => {
    expect(classifyVolRegime(30)).toBe(6);
    expect(classifyVolRegime(35)).toBe(6);
    expect(classifyVolRegime(80)).toBe(6);
  });
});

// =============================================================================
// classifyTermStructure
// =============================================================================

describe('classifyTermStructure', () => {
  test('returns 1 (contango) when VIX9D < VIX and VIX < VIX3M', () => {
    expect(classifyTermStructure(10, 15, 20)).toBe(1);
  });

  test('returns 1 (contango) when VIX9D <= VIX and VIX <= VIX3M', () => {
    // PineScript: cascading conditional — falls through to 1
    expect(classifyTermStructure(12, 18, 25)).toBe(1);
  });

  test('returns -1 (backwardation) when VIX9D > VIX', () => {
    expect(classifyTermStructure(20, 15, 10)).toBe(-1);
  });

  test('returns 0 (flat/partial inversion) when VIX > VIX3M but VIX9D <= VIX', () => {
    // PineScript: vix9d > vix ? -1 : vix > vix3m ? 0 : 1
    // VIX9D=10 not > VIX=20, but VIX=20 > VIX3M=15 → 0
    expect(classifyTermStructure(10, 20, 15)).toBe(0);
  });

  test('returns 1 when all equal (perfectly flat)', () => {
    // PineScript: 15 > 15 is false, 15 > 15 is false → falls through to 1
    expect(classifyTermStructure(15, 15, 15)).toBe(1);
  });

  test('returns 1 when VIX9D slightly less than VIX (no tolerance)', () => {
    // PineScript has no tolerance — strict comparison
    expect(classifyTermStructure(14.9, 15.0, 15.1)).toBe(1);
  });
});

// =============================================================================
// computeVIXPercentile
// =============================================================================

describe('computeVIXPercentile', () => {
  test('returns array of same length as input', () => {
    const closes = Array.from({ length: 20 }, () => 15);
    expect(computeVIXPercentile(closes, 10)).toHaveLength(20);
  });

  test('first period-1 values are NaN', () => {
    const closes = Array.from({ length: 15 }, (_, i) => 10 + i);
    const pct = computeVIXPercentile(closes, 10);
    for (let i = 0; i < 9; i++) {
      expect(isNaN(pct[i])).toBe(true);
    }
    expect(isNaN(pct[9])).toBe(false);
  });

  test('constant VIX values produce 0 percentile (value not strictly less than itself)', () => {
    // All same: count(v < 15 in window) = 0 → percentile = 0/period * 100 = 0
    const closes = Array.from({ length: 15 }, () => 15);
    const pct = computeVIXPercentile(closes, 10);
    for (let i = 9; i < 15; i++) {
      expect(pct[i]).toBeCloseTo(0, 10);
    }
  });

  test('highest value in window has high percentile', () => {
    // Ascending: last value is highest, percentile should be close to 100
    const closes = Array.from({ length: 15 }, (_, i) => i + 1); // [1,2,...,15]
    const pct = computeVIXPercentile(closes, 10);
    // At index 14 (value=15), window=[6,7,...,15], count(v < 15) = 9 → 9/10*100 = 90%
    expect(pct[14]).toBeCloseTo(90, 5);
  });

  test('lowest value in window has 0 percentile', () => {
    // Descending then stable: at some point value is lowest in window
    const closes = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 5]; // value 1 at index 9
    const pct = computeVIXPercentile(closes, 10);
    // At index 9 (value=1), window=[10,9,8,7,6,5,4,3,2,1], count(v<1) = 0 → 0%
    expect(pct[9]).toBeCloseTo(0, 5);
  });

  test('percentile rank is count of strictly less than (not less-or-equal)', () => {
    // Window of 5 values: [10, 20, 30, 40, 50], query for 30
    // count(v < 30) = 2 → 2/5*100 = 40%
    const closes = [10, 20, 30, 40, 50];
    const pct = computeVIXPercentile(closes, 5);
    // At index 4 (value=50), window=[10,20,30,40,50], count(v < 50) = 4 → 80%
    expect(pct[4]).toBeCloseTo(80, 5);
  });
});
