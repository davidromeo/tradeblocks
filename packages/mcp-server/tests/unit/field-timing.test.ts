/**
 * Unit tests for field classification and LAG CTE builder.
 *
 * Validates:
 * - Every market.daily and market.context column (except key columns) has a timing annotation
 * - Derived sets cover all classified columns with correct counts
 * - Sets are mutually exclusive
 * - Known pitfall classifications are correct (Return_5D, Prev_Return_Pct, etc.)
 * - buildLookaheadFreeQuery() produces valid lookahead-free SQL with dual-table JOIN
 * - buildOutcomeQuery() produces valid same-day outcome SQL from both tables
 */

// @ts-expect-error - importing from bundled output
import {
  OPEN_KNOWN_FIELDS,
  CLOSE_KNOWN_FIELDS,
  STATIC_FIELDS,
  DAILY_OPEN_FIELDS,
  DAILY_CLOSE_FIELDS,
  DAILY_STATIC_FIELDS,
  CONTEXT_OPEN_FIELDS,
  CONTEXT_CLOSE_FIELDS,
  buildLookaheadFreeQuery,
  buildOutcomeQuery,
  SCHEMA_DESCRIPTIONS,
} from '../../dist/test-exports.js';

const dailyColumns = SCHEMA_DESCRIPTIONS.market.tables.daily.columns;
const contextColumns = SCHEMA_DESCRIPTIONS.market.tables.context.columns;

describe('Field Classification', () => {
  test('every classified market.daily column has a timing annotation', () => {
    for (const [name, desc] of Object.entries(dailyColumns) as [string, { timing?: string }][]) {
      if (name === 'date' || name === 'ticker') {
        expect(desc.timing).toBeUndefined();
        continue;
      }
      expect(desc.timing).toBeDefined();
      expect(['open', 'close', 'static']).toContain(desc.timing);
    }
  });

  test('every classified market.context column has a timing annotation', () => {
    for (const [name, desc] of Object.entries(contextColumns) as [string, { timing?: string }][]) {
      if (name === 'date') {
        expect(desc.timing).toBeUndefined();
        continue;
      }
      expect(desc.timing).toBeDefined();
      expect(['open', 'close', 'static']).toContain(desc.timing);
    }
  });

  test('date column has no timing annotation (daily)', () => {
    expect(dailyColumns.date.timing).toBeUndefined();
  });

  test('date column has no timing annotation (context)', () => {
    expect(contextColumns.date.timing).toBeUndefined();
  });
});

describe('Derived Sets', () => {
  test('derived sets cover all 48 classified columns across both tables', () => {
    const allClassified = new Set([
      ...OPEN_KNOWN_FIELDS,
      ...CLOSE_KNOWN_FIELDS,
      ...STATIC_FIELDS,
    ]);

    // Get all classified columns from daily (exclude key columns without timing)
    const dailyClassified = Object.keys(dailyColumns).filter(
      name => name !== 'date' && name !== 'ticker'
    );
    // Get all classified columns from context (exclude date key)
    const contextClassified = Object.keys(contextColumns).filter(
      name => name !== 'date'
    );

    const totalClassified = dailyClassified.length + contextClassified.length;

    expect(allClassified.size).toBe(51);
    expect(allClassified.size).toBe(totalClassified);

    // Every classified column should be in exactly one set
    for (const col of [...dailyClassified, ...contextClassified]) {
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

  test('OPEN_KNOWN_FIELDS has exactly 10 fields (5 daily + 5 context)', () => {
    expect(OPEN_KNOWN_FIELDS.size).toBe(10);
    // Daily open-known: open, Prior_Close, Gap_Pct, Prev_Return_Pct, Prior_Range_vs_ATR
    expect(DAILY_OPEN_FIELDS.size).toBe(5);
    // Context open-known: VIX_Open, VIX_RTH_Open, VIX_Gap_Pct, VIX9D_Open, VIX3M_Open
    expect(CONTEXT_OPEN_FIELDS.size).toBe(5);
  });

  test('CLOSE_KNOWN_FIELDS has exactly 38 fields (24 daily + 14 context)', () => {
    expect(CLOSE_KNOWN_FIELDS.size).toBe(38);
    // Daily close-derived: 18 Tier1 + 4 Tier3 + 2 Tier3 (Opening_Drive_Strength, Intraday_Realized_Vol) = 24
    expect(DAILY_CLOSE_FIELDS.size).toBe(24);
    // Context close-derived: 14
    expect(CONTEXT_CLOSE_FIELDS.size).toBe(14);
  });

  test('STATIC_FIELDS has exactly 3 fields (all from daily)', () => {
    expect(STATIC_FIELDS.size).toBe(3);
    expect(DAILY_STATIC_FIELDS.size).toBe(3);
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

  test('Prior_Range_vs_ATR is open-known (new field — prior day range/ATR known at open)', () => {
    expect(OPEN_KNOWN_FIELDS.has('Prior_Range_vs_ATR')).toBe(true);
    expect(CLOSE_KNOWN_FIELDS.has('Prior_Range_vs_ATR')).toBe(false);
  });

  test('Consecutive_Days is close-derived', () => {
    expect(CLOSE_KNOWN_FIELDS.has('Consecutive_Days')).toBe(true);
  });

  test('BB_Width is close-derived (volatility compression — only known after close)', () => {
    expect(CLOSE_KNOWN_FIELDS.has('BB_Width')).toBe(true);
    expect(OPEN_KNOWN_FIELDS.has('BB_Width')).toBe(false);
  });

  test('Realized_Vol_5D is close-derived', () => {
    expect(CLOSE_KNOWN_FIELDS.has('Realized_Vol_5D')).toBe(true);
    expect(OPEN_KNOWN_FIELDS.has('Realized_Vol_5D')).toBe(false);
  });

  test('Vol_Regime is close-derived (from market.context)', () => {
    expect(CLOSE_KNOWN_FIELDS.has('Vol_Regime')).toBe(true);
    expect(OPEN_KNOWN_FIELDS.has('Vol_Regime')).toBe(false);
    expect(CONTEXT_CLOSE_FIELDS.has('Vol_Regime')).toBe(true);
  });

  test('VIX_Open is open-known (from market.context)', () => {
    expect(OPEN_KNOWN_FIELDS.has('VIX_Open')).toBe(true);
    expect(CLOSE_KNOWN_FIELDS.has('VIX_Open')).toBe(false);
    expect(CONTEXT_OPEN_FIELDS.has('VIX_Open')).toBe(true);
  });

  test('VIX_Gap_Pct is open-known (from market.context)', () => {
    expect(OPEN_KNOWN_FIELDS.has('VIX_Gap_Pct')).toBe(true);
    expect(CLOSE_KNOWN_FIELDS.has('VIX_Gap_Pct')).toBe(false);
    expect(CONTEXT_OPEN_FIELDS.has('VIX_Gap_Pct')).toBe(true);
  });

  test('date and ticker are not in any derived set', () => {
    expect(OPEN_KNOWN_FIELDS.has('date')).toBe(false);
    expect(CLOSE_KNOWN_FIELDS.has('date')).toBe(false);
    expect(STATIC_FIELDS.has('date')).toBe(false);
    expect(OPEN_KNOWN_FIELDS.has('ticker')).toBe(false);
    expect(CLOSE_KNOWN_FIELDS.has('ticker')).toBe(false);
    expect(STATIC_FIELDS.has('ticker')).toBe(false);
  });
});

describe('buildLookaheadFreeQuery', () => {
  test('produces SQL with WITH joined AS and lagged AS CTEs', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('WITH joined AS');
    expect(sql).toContain('lagged AS');
  });

  test('JOINs market.daily with market.context', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('FROM market.daily d');
    expect(sql).toContain('LEFT JOIN market.context c ON d.date = c.date');
  });

  test('passes open-known fields through without LAG', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    // Daily open-known fields should appear as plain identifiers, not wrapped in LAG()
    expect(sql).toContain('"Prior_Close"');
    expect(sql).toContain('"Gap_Pct"');
    // Context open-known fields should also pass through
    expect(sql).toContain('"VIX_Open"');
    // They should NOT be inside LAG() calls
    expect(sql).not.toMatch(/LAG\("Prior_Close"\)/);
    expect(sql).not.toMatch(/LAG\("Gap_Pct"\)/);
    expect(sql).not.toMatch(/LAG\("VIX_Open"\)/);
  });

  test('wraps close-derived fields in LAG() with PARTITION BY ticker', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('LAG("close") OVER (PARTITION BY ticker ORDER BY date) AS "prev_close"');
    expect(sql).toContain('LAG("RSI_14") OVER (PARTITION BY ticker ORDER BY date) AS "prev_RSI_14"');
    // Context close-derived fields also get LAG
    expect(sql).toContain('LAG("Vol_Regime") OVER (PARTITION BY ticker ORDER BY date) AS "prev_Vol_Regime"');
    expect(sql).toContain('LAG("VIX_Close") OVER (PARTITION BY ticker ORDER BY date) AS "prev_VIX_Close"');
  });

  test('passes static fields through without LAG', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('"Day_of_Week"');
    expect(sql).not.toMatch(/LAG\("Day_of_Week"\)/);
  });

  test('uses parameterized placeholders for dates', () => {
    const { sql, params } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('$1');
    expect(params[0]).toBe('2025-01-06');
  });

  test('handles multiple dates with correct placeholders', () => {
    const dates = ['2025-01-06', '2025-01-07', '2025-01-08'];
    const { sql, params } = buildLookaheadFreeQuery(dates);
    expect(sql).toContain('$1, $2, $3');
    expect(params[0]).toBe('2025-01-06');
    expect(params[1]).toBe('2025-01-07');
    expect(params[2]).toBe('2025-01-08');
  });

  test('uses PARTITION BY ticker in LAG window (not calendar arithmetic)', () => {
    const { sql } = buildLookaheadFreeQuery(['2025-01-06']);
    expect(sql).toContain('PARTITION BY ticker ORDER BY date');
    expect(sql).not.toContain('DATEADD');
    expect(sql).not.toContain('INTERVAL');
  });

  test('produces valid SQL with empty dates array', () => {
    const { sql, params } = buildLookaheadFreeQuery([]);
    // Empty input returns a no-match query instead of invalid WHERE date IN ()
    expect(sql).toContain('WHERE 1=0');
    expect(params).toEqual([]);
  });

  test('supports ticker+date lookup keys with ticker-partitioned LAG', () => {
    const { sql, params } = buildLookaheadFreeQuery([
      { ticker: 'SPX', date: '2025-01-06' },
      { ticker: 'MSFT', date: '2025-01-06' },
    ]);

    expect(sql).toContain('WITH requested(ticker, date) AS');
    expect(sql).toContain('PARTITION BY ticker ORDER BY date');
    expect(sql).toContain('lagged.ticker = requested.ticker');
    expect(sql).toContain('lagged.date = requested.date');
    expect(params).toEqual(['SPX', '2025-01-06', 'MSFT', '2025-01-06']);
  });

  test('ticker overload also JOINs market.daily with market.context', () => {
    const { sql } = buildLookaheadFreeQuery([
      { ticker: 'SPX', date: '2025-01-06' },
    ]);
    expect(sql).toContain('FROM market.daily d');
    expect(sql).toContain('LEFT JOIN market.context c ON d.date = c.date');
  });
});

describe('buildOutcomeQuery', () => {
  test('produces SELECT with close-derived fields from both tables', () => {
    const { sql } = buildOutcomeQuery(['2025-01-06']);
    // Should include daily close-derived fields
    expect(sql).toContain('"close"');
    expect(sql).toContain('"RSI_14"');
    // Should include context close-derived fields
    expect(sql).toContain('"Vol_Regime"');
    expect(sql).toContain('"VIX_Close"');
  });

  test('queries from market.daily LEFT JOIN market.context', () => {
    const { sql } = buildOutcomeQuery(['2025-01-06']);
    expect(sql).toContain('FROM market.daily');
    expect(sql).toContain('LEFT JOIN market.context');
  });

  test('uses parameterized placeholders', () => {
    const { sql, params } = buildOutcomeQuery(['2025-01-06', '2025-01-07']);
    expect(sql).toContain('$1, $2');
    expect(params[0]).toBe('2025-01-06');
    expect(params[1]).toBe('2025-01-07');
  });

  test('does NOT use LAG (returns same-day values)', () => {
    const { sql } = buildOutcomeQuery(['2025-01-06']);
    expect(sql).not.toContain('LAG(');
    expect(sql).not.toContain('prev_');
  });

  test('includes all close-derived fields from both tables', () => {
    const { sql } = buildOutcomeQuery(['2025-01-06']);
    // Count quoted field names — each CLOSE_KNOWN_FIELD should appear as "fieldName"
    for (const field of CLOSE_KNOWN_FIELDS) {
      expect(sql).toContain(`"${field}"`);
    }
  });

  test('should NOT include open-known or static fields', () => {
    const { sql } = buildOutcomeQuery(['2025-01-06']);
    // Open-known and static fields should not be selected
    // (they are NOT in CLOSE_KNOWN_FIELDS, so not in the outcome query's close columns)
    // But note: these fields are selected with table aliases so just verify no Gap_Pct in select
    expect(sql).not.toContain('"Gap_Pct"');
    expect(sql).not.toContain('"Day_of_Week"');
    expect(sql).not.toContain('"VIX_Open"');
  });

  test('supports ticker+date outcome queries', () => {
    const { sql, params } = buildOutcomeQuery([
      { ticker: 'SPX', date: '2025-01-06' },
      { ticker: 'MSFT', date: '2025-01-07' },
    ]);

    expect(sql).toContain('WITH requested(ticker, date) AS');
    expect(sql).toContain('SELECT m.ticker, m.date');
    expect(sql).toContain('m.ticker = requested.ticker');
    expect(sql).toContain('m.date = requested.date');
    expect(params).toEqual(['SPX', '2025-01-06', 'MSFT', '2025-01-07']);
  });
});
