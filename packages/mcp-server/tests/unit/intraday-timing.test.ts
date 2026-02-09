/**
 * Unit tests for intraday checkpoint timing utilities.
 *
 * Validates:
 * - Checkpoint constant counts and ordering
 * - parseTimeToHHMM for various time formats
 * - getKnownSpxCheckpoints / getKnownVixCheckpoints temporal filtering
 * - buildIntradayContext with lookahead-free checkpoint filtering
 * - Edge cases: 00:00:00 (missing time), before market, after market, BigInt handling
 */

// @ts-expect-error - importing from bundled output
import {
  SPX_CHECKPOINTS,
  VIX_CHECKPOINTS,
  SPX_15MIN_OUTCOME_FIELDS,
  VIX_OUTCOME_FIELDS,
  VIX_OHLC_OUTCOME_FIELDS,
  parseTimeToHHMM,
  getKnownSpxCheckpoints,
  getKnownVixCheckpoints,
  buildIntradayContext,
} from '../../dist/test-exports.js';

// =============================================================================
// Checkpoint Constants
// =============================================================================

describe('Checkpoint Constants', () => {
  test('SPX_CHECKPOINTS has 26 entries (15-min intervals 09:30-15:45)', () => {
    expect(SPX_CHECKPOINTS).toHaveLength(26);
  });

  test('VIX_CHECKPOINTS has 14 entries (~30-min intervals)', () => {
    expect(VIX_CHECKPOINTS).toHaveLength(14);
  });

  test('SPX checkpoints are in ascending order', () => {
    for (let i = 1; i < SPX_CHECKPOINTS.length; i++) {
      expect(SPX_CHECKPOINTS[i]).toBeGreaterThan(SPX_CHECKPOINTS[i - 1]);
    }
  });

  test('VIX checkpoints are in ascending order', () => {
    for (let i = 1; i < VIX_CHECKPOINTS.length; i++) {
      expect(VIX_CHECKPOINTS[i]).toBeGreaterThan(VIX_CHECKPOINTS[i - 1]);
    }
  });

  test('SPX starts at 930 and ends at 1545', () => {
    expect(SPX_CHECKPOINTS[0]).toBe(930);
    expect(SPX_CHECKPOINTS[SPX_CHECKPOINTS.length - 1]).toBe(1545);
  });

  test('VIX starts at 930 and ends at 1545', () => {
    expect(VIX_CHECKPOINTS[0]).toBe(930);
    expect(VIX_CHECKPOINTS[VIX_CHECKPOINTS.length - 1]).toBe(1545);
  });

  test('every VIX checkpoint is also an SPX checkpoint', () => {
    const spxSet = new Set(SPX_CHECKPOINTS);
    for (const cp of VIX_CHECKPOINTS) {
      expect(spxSet.has(cp)).toBe(true);
    }
  });
});

// =============================================================================
// Outcome Field Constants
// =============================================================================

describe('Outcome Field Constants', () => {
  test('SPX_15MIN_OUTCOME_FIELDS has 9 fields', () => {
    expect(SPX_15MIN_OUTCOME_FIELDS).toHaveLength(9);
  });

  test('VIX_OUTCOME_FIELDS has 14 fields', () => {
    expect(VIX_OUTCOME_FIELDS).toHaveLength(14);
  });

  test('VIX_OHLC_OUTCOME_FIELDS has 3 fields (high, low, close -- not open)', () => {
    expect(VIX_OHLC_OUTCOME_FIELDS).toHaveLength(3);
    expect(VIX_OHLC_OUTCOME_FIELDS).toContain('high');
    expect(VIX_OHLC_OUTCOME_FIELDS).toContain('low');
    expect(VIX_OHLC_OUTCOME_FIELDS).toContain('close');
    expect(VIX_OHLC_OUTCOME_FIELDS).not.toContain('open');
  });

  test('SPX outcome fields include MOC and percentage move fields', () => {
    expect(SPX_15MIN_OUTCOME_FIELDS).toContain('MOC_30min');
    expect(SPX_15MIN_OUTCOME_FIELDS).toContain('Pct_0930_to_Close');
    expect(SPX_15MIN_OUTCOME_FIELDS).toContain('Afternoon_Move');
  });

  test('VIX outcome fields include spike/crush flags', () => {
    expect(VIX_OUTCOME_FIELDS).toContain('VIX_Spike_Flag');
    expect(VIX_OUTCOME_FIELDS).toContain('VIX_Crush_Flag');
    expect(VIX_OUTCOME_FIELDS).toContain('VIX_Full_Day_Move');
  });
});

// =============================================================================
// parseTimeToHHMM
// =============================================================================

describe('parseTimeToHHMM', () => {
  test('parses 09:30:00 to 930', () => {
    expect(parseTimeToHHMM('09:30:00')).toBe(930);
  });

  test('parses 09:35:00 to 935', () => {
    expect(parseTimeToHHMM('09:35:00')).toBe(935);
  });

  test('parses 14:30:00 to 1430', () => {
    expect(parseTimeToHHMM('14:30:00')).toBe(1430);
  });

  test('parses 00:00:00 to 0 (missing time default)', () => {
    expect(parseTimeToHHMM('00:00:00')).toBe(0);
  });

  test('parses 15:45:00 to 1545 (last checkpoint)', () => {
    expect(parseTimeToHHMM('15:45:00')).toBe(1545);
  });

  test('parses 16:00:00 to 1600 (after market close)', () => {
    expect(parseTimeToHHMM('16:00:00')).toBe(1600);
  });
});

// =============================================================================
// getKnownSpxCheckpoints
// =============================================================================

describe('getKnownSpxCheckpoints', () => {
  test('trade at 09:30 sees only P_0930', () => {
    const result = getKnownSpxCheckpoints(930);
    expect(result).toEqual(['P_0930']);
  });

  test('trade at 09:35 sees only P_0930 (not P_0945)', () => {
    const result = getKnownSpxCheckpoints(935);
    expect(result).toEqual(['P_0930']);
  });

  test('trade at 09:44 sees only P_0930 (one less than 09:45)', () => {
    const result = getKnownSpxCheckpoints(944);
    expect(result).toEqual(['P_0930']);
  });

  test('trade at 09:45 sees P_0930 and P_0945', () => {
    const result = getKnownSpxCheckpoints(945);
    expect(result).toEqual(['P_0930', 'P_0945']);
  });

  test('trade at 10:30 sees 5 checkpoints', () => {
    const result = getKnownSpxCheckpoints(1030);
    expect(result).toEqual(['P_0930', 'P_0945', 'P_1000', 'P_1015', 'P_1030']);
  });

  test('trade at 15:45 sees all 26 checkpoints', () => {
    const result = getKnownSpxCheckpoints(1545);
    expect(result).toHaveLength(26);
    expect(result[0]).toBe('P_0930');
    expect(result[result.length - 1]).toBe('P_1545');
  });

  test('trade at 16:00 (after market) sees all 26 checkpoints', () => {
    const result = getKnownSpxCheckpoints(1600);
    expect(result).toHaveLength(26);
  });

  test('trade at 00:00 (missing time) sees no checkpoints', () => {
    const result = getKnownSpxCheckpoints(0);
    expect(result).toEqual([]);
  });

  test('trade at 09:29 (before market) sees no checkpoints', () => {
    const result = getKnownSpxCheckpoints(929);
    expect(result).toEqual([]);
  });

  test('checkpoint names use P_HHMM format with zero-padded 4 digits', () => {
    const result = getKnownSpxCheckpoints(945);
    expect(result[0]).toBe('P_0930');
    expect(result[1]).toBe('P_0945');
  });
});

// =============================================================================
// getKnownVixCheckpoints
// =============================================================================

describe('getKnownVixCheckpoints', () => {
  test('trade at 09:30 sees only VIX_0930', () => {
    const result = getKnownVixCheckpoints(930);
    expect(result).toEqual(['VIX_0930']);
  });

  test('trade at 09:35 sees only VIX_0930 (next VIX checkpoint is 10:00)', () => {
    const result = getKnownVixCheckpoints(935);
    expect(result).toEqual(['VIX_0930']);
  });

  test('trade at 10:30 sees VIX_0930, VIX_1000, VIX_1030', () => {
    const result = getKnownVixCheckpoints(1030);
    expect(result).toEqual(['VIX_0930', 'VIX_1000', 'VIX_1030']);
  });

  test('trade at 15:45 sees all 14 VIX checkpoints', () => {
    const result = getKnownVixCheckpoints(1545);
    expect(result).toHaveLength(14);
  });

  test('trade at 00:00 sees no checkpoints', () => {
    const result = getKnownVixCheckpoints(0);
    expect(result).toEqual([]);
  });

  test('VIX has fewer checkpoints than SPX at same time (30-min vs 15-min)', () => {
    const spx = getKnownSpxCheckpoints(1200);
    const vix = getKnownVixCheckpoints(1200);
    expect(vix.length).toBeLessThan(spx.length);
  });
});

// =============================================================================
// buildIntradayContext
// =============================================================================

describe('buildIntradayContext', () => {
  // Mock SPX row with P_HHMM columns
  const mockSpxRow: Record<string, unknown> = {
    date: '2025-01-06',
    open: 5900.0,
    P_0930: 5900.0,
    P_0945: 5905.5,
    P_1000: 5910.0,
    P_1015: 5908.0,
    P_1030: 5912.5,
    P_1045: 5915.0,
  };

  // Mock VIX row with VIX_HHMM columns
  const mockVixRow: Record<string, unknown> = {
    date: '2025-01-06',
    open: 14.50,
    VIX_0930: 14.50,
    VIX_1000: 14.75,
    VIX_1030: 14.60,
  };

  test('returns null when both spxData and vixData are null', () => {
    const result = buildIntradayContext('09:35:00', null, null);
    expect(result).toBeNull();
  });

  test('returns context when only spxData is provided', () => {
    const result = buildIntradayContext('09:35:00', mockSpxRow, null);
    expect(result).not.toBeNull();
    expect(result.spx).not.toBeNull();
    expect(result.vix).toBeNull();
  });

  test('returns context when only vixData is provided', () => {
    const result = buildIntradayContext('09:35:00', null, mockVixRow);
    expect(result).not.toBeNull();
    expect(result.spx).toBeNull();
    expect(result.vix).not.toBeNull();
  });

  test('sets tradeEntryTime and tradeEntryTimeHHMM correctly', () => {
    const result = buildIntradayContext('09:35:00', mockSpxRow, null);
    expect(result.tradeEntryTime).toBe('09:35:00');
    expect(result.tradeEntryTimeHHMM).toBe(935);
  });

  // --- SPX temporal filtering ---

  test('trade at 09:35 sees only P_0930 in SPX knownCheckpoints', () => {
    const result = buildIntradayContext('09:35:00', mockSpxRow, null);
    expect(result.spx.knownCheckpoints).toEqual({ P_0930: 5900.0 });
  });

  test('trade at 10:00 sees P_0930, P_0945, P_1000 but not P_1015', () => {
    const result = buildIntradayContext('10:00:00', mockSpxRow, null);
    expect(result.spx.knownCheckpoints).toEqual({
      P_0930: 5900.0,
      P_0945: 5905.5,
      P_1000: 5910.0,
    });
    expect(result.spx.knownCheckpoints).not.toHaveProperty('P_1015');
  });

  test('nearestCheckpoint is the latest known checkpoint', () => {
    const result = buildIntradayContext('10:00:00', mockSpxRow, null);
    expect(result.spx.nearestCheckpoint).toEqual({ time: '1000', price: 5910.0 });
  });

  test('moveFromOpen calculates percent change from open to nearest', () => {
    // nearestPrice = 5910.0, openPrice = 5900.0
    // moveFromOpen = ((5910 - 5900) / 5900) * 100 = 0.17 (rounded to 2 decimal places)
    const result = buildIntradayContext('10:00:00', mockSpxRow, null);
    expect(result.spx.moveFromOpen).toBeCloseTo(0.17, 2);
  });

  // --- VIX temporal filtering ---

  test('trade at 09:35 sees only VIX_0930 in VIX knownCheckpoints', () => {
    const result = buildIntradayContext('09:35:00', null, mockVixRow);
    expect(result.vix.knownCheckpoints).toEqual({ VIX_0930: 14.50 });
  });

  test('trade at 10:30 sees VIX_0930, VIX_1000, VIX_1030', () => {
    const result = buildIntradayContext('10:30:00', null, mockVixRow);
    expect(result.vix.knownCheckpoints).toEqual({
      VIX_0930: 14.50,
      VIX_1000: 14.75,
      VIX_1030: 14.60,
    });
  });

  test('VIX nearestCheckpoint is the latest known VIX checkpoint', () => {
    const result = buildIntradayContext('10:30:00', null, mockVixRow);
    expect(result.vix.nearestCheckpoint).toEqual({ time: '1030', value: 14.60 });
  });

  // --- Edge cases ---

  test('timeOpened 00:00:00 returns empty knownCheckpoints (not null context)', () => {
    const result = buildIntradayContext('00:00:00', mockSpxRow, mockVixRow);
    expect(result).not.toBeNull();
    expect(result.tradeEntryTimeHHMM).toBe(0);
    expect(result.spx.knownCheckpoints).toEqual({});
    expect(result.spx.nearestCheckpoint).toBeNull();
    expect(result.spx.moveFromOpen).toBeNull();
    expect(result.vix.knownCheckpoints).toEqual({});
    expect(result.vix.nearestCheckpoint).toBeNull();
  });

  test('handles BigInt values from DuckDB by converting to Number', () => {
    const bigIntRow: Record<string, unknown> = {
      date: '2025-01-06',
      open: BigInt(5900),
      P_0930: BigInt(5900),
      P_0945: BigInt(5905),
    };
    const result = buildIntradayContext('09:45:00', bigIntRow, null);
    expect(result.spx.knownCheckpoints).toEqual({ P_0930: 5900, P_0945: 5905 });
    expect(typeof result.spx.knownCheckpoints['P_0930']).toBe('number');
  });

  test('handles null checkpoint values in data row (skips them)', () => {
    const sparseRow: Record<string, unknown> = {
      date: '2025-01-06',
      open: 5900.0,
      P_0930: 5900.0,
      P_0945: null,
      P_1000: 5910.0,
    };
    const result = buildIntradayContext('10:00:00', sparseRow, null);
    // P_0945 is null so should be skipped
    expect(result.spx.knownCheckpoints).toEqual({ P_0930: 5900.0, P_1000: 5910.0 });
    // nearestCheckpoint should be P_1000 (last non-null)
    expect(result.spx.nearestCheckpoint).toEqual({ time: '1000', price: 5910.0 });
  });

  test('moveFromOpen is null when open price is missing', () => {
    const noOpenRow: Record<string, unknown> = {
      date: '2025-01-06',
      P_0930: 5900.0,
    };
    const result = buildIntradayContext('09:30:00', noOpenRow, null);
    expect(result.spx.moveFromOpen).toBeNull();
  });

  test('both SPX and VIX populated when both provided', () => {
    const result = buildIntradayContext('10:30:00', mockSpxRow, mockVixRow);
    expect(result.spx).not.toBeNull();
    expect(result.vix).not.toBeNull();
    expect(Object.keys(result.spx.knownCheckpoints).length).toBeGreaterThan(0);
    expect(Object.keys(result.vix.knownCheckpoints).length).toBeGreaterThan(0);
  });
});
