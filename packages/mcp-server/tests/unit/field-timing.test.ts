/**
 * Unit tests for field classification and LAG CTE builder.
 *
 * Validates:
 * - Every spx_daily column (except date) has a timing annotation
 * - Derived sets cover all classified columns with correct counts
 * - Sets are mutually exclusive
 * - Known pitfall classifications are correct (Return_5D, Prev_Return_Pct, etc.)
 * - buildLookaheadFreeQuery() produces valid lookahead-free SQL
 */

// @ts-expect-error - importing from bundled output
import {
  OPEN_KNOWN_FIELDS,
  CLOSE_KNOWN_FIELDS,
  STATIC_FIELDS,
  buildLookaheadFreeQuery,
  SCHEMA_DESCRIPTIONS,
} from '../../dist/test-exports.js';

const spxColumns = SCHEMA_DESCRIPTIONS.market.tables.spx_daily.columns;

describe('Field Classification', () => {
  test('every spx_daily column except date has a timing annotation', () => {
    for (const [name, desc] of Object.entries(spxColumns) as [string, { timing?: string }][]) {
      if (name === 'date') {
        expect(desc.timing).toBeUndefined();
        continue;
      }
      expect(desc.timing).toBeDefined();
      expect(['open', 'close', 'static']).toContain(desc.timing);
    }
  });

  test('date column has no timing annotation', () => {
    expect(spxColumns.date.timing).toBeUndefined();
  });
});

describe('Derived Sets', () => {
  test('derived sets cover all 55 classified columns', () => {
    const allClassified = new Set([
      ...OPEN_KNOWN_FIELDS,
      ...CLOSE_KNOWN_FIELDS,
      ...STATIC_FIELDS,
    ]);

    // Get all non-date columns
    const nonDateColumns = Object.keys(spxColumns).filter(name => name !== 'date');

    expect(allClassified.size).toBe(55);
    expect(allClassified.size).toBe(nonDateColumns.length);

    // Every non-date column should be in exactly one set
    for (const col of nonDateColumns) {
      expect(allClassified.has(col)).toBe(true);
    }
  });

  test('derived sets are mutually exclusive', () => {
    // Check all three pairwise: open vs close, open vs static, close vs static
    for (const field of OPEN_KNOWN_FIELDS) {
      expect(CLOSE_KNOWN_FIELDS.has(field)).toBe(false);
      expect(STATIC_FIELDS.has(field)).toBe(false);
    }
    for (const field of CLOSE_KNOWN_FIELDS) {
      expect(OPEN_KNOWN_FIELDS.has(field)).toBe(false);
      expect(STATIC_FIELDS.has(field)).toBe(false);
    }
    for (const field of STATIC_FIELDS) {
      expect(OPEN_KNOWN_FIELDS.has(field)).toBe(false);
      expect(CLOSE_KNOWN_FIELDS.has(field)).toBe(false);
    }
  });

  test('OPEN_KNOWN_FIELDS has exactly 8 fields', () => {
    expect(OPEN_KNOWN_FIELDS.size).toBe(8);
  });

  test('CLOSE_KNOWN_FIELDS has exactly 44 fields', () => {
    expect(CLOSE_KNOWN_FIELDS.size).toBe(44);
  });

  test('STATIC_FIELDS has exactly 3 fields', () => {
    expect(STATIC_FIELDS.size).toBe(3);
  });

  // Specific classification correctness (guards against known pitfalls)
  test('Return_5D is close-derived (not open-known)', () => {
    expect(CLOSE_KNOWN_FIELDS.has('Return_5D')).toBe(true);
    expect(OPEN_KNOWN_FIELDS.has('Return_5D')).toBe(false);
  });

  test('Return_20D is close-derived (not open-known)', () => {
    expect(CLOSE_KNOWN_FIELDS.has('Return_20D')).toBe(true);
    expect(OPEN_KNOWN_FIELDS.has('Return_20D')).toBe(false);
  });

  test('Prev_Return_Pct is open-known (not close-derived)', () => {
    expect(OPEN_KNOWN_FIELDS.has('Prev_Return_Pct')).toBe(true);
    expect(CLOSE_KNOWN_FIELDS.has('Prev_Return_Pct')).toBe(false);
  });

  test('Consecutive_Days is close-derived', () => {
    expect(CLOSE_KNOWN_FIELDS.has('Consecutive_Days')).toBe(true);
  });

  test('date is not in any derived set', () => {
    expect(OPEN_KNOWN_FIELDS.has('date')).toBe(false);
    expect(CLOSE_KNOWN_FIELDS.has('date')).toBe(false);
    expect(STATIC_FIELDS.has('date')).toBe(false);
  });
});

describe('buildLookaheadFreeQuery', () => {
  test('produces SQL with WITH lagged AS CTE', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('WITH lagged AS');
  });

  test('passes open-known fields through without LAG', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    // Open-known fields should appear as plain quoted identifiers, not wrapped in LAG()
    expect(sql).toContain('"Prior_Close"');
    expect(sql).toContain('"Gap_Pct"');
    // They should NOT be inside LAG() calls
    expect(sql).not.toMatch(/LAG\("Prior_Close"\)/);
    expect(sql).not.toMatch(/LAG\("Gap_Pct"\)/);
  });

  test('wraps close-derived fields in LAG()', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('LAG("close") OVER (ORDER BY date) AS "prev_close"');
    expect(sql).toContain('LAG("RSI_14") OVER (ORDER BY date) AS "prev_RSI_14"');
  });

  test('passes static fields through without LAG', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('"Day_of_Week"');
    expect(sql).not.toMatch(/LAG\("Day_of_Week"\)/);
  });

  test('uses parameterized placeholders for dates', () => {
    const { sql, params } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('$1');
    expect(params).toEqual(['2025-01-06']);
  });

  test('handles multiple dates with correct placeholders', () => {
    const dates = ['2025-01-06', '2025-01-07', '2025-01-08'];
    const { sql, params } = buildLookaheadFreeQuery(dates);
    expect(sql).toContain('$1, $2, $3');
    expect(params).toEqual(dates);
  });

  test('uses ORDER BY date in LAG window (not calendar arithmetic)', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('OVER (ORDER BY date)');
    expect(sql).not.toContain('DATEADD');
    expect(sql).not.toContain('INTERVAL');
  });
});
