/**
 * Pure TypeScript indicator functions for the market enrichment pipeline.
 *
 * All functions are pure (no DB access, no side effects) and take number arrays
 * or structured inputs returning computed arrays or values.
 *
 * Formulas follow TradingView Pine Script conventions:
 * - RSI: Wilder smoothing seeded with SMA of first period changes
 * - ATR: Wilder smoothing seeded with SMA of first period TR values
 * - EMA: Standard EMA seeded with SMA of first period bars
 * - Bollinger Bands: Population stddev (N denominator)
 * - Realized Vol: Population stddev, annualized by sqrt(252)*100
 *
 * References:
 * - Wilder, J.W. (1978) "New Concepts in Technical Trading Systems"
 * - TradingView Pine Script documentation (ta.rsi, ta.atr, ta.ema, ta.bb)
 */

import type { DuckDBConnection } from "@duckdb/node-api";
import { upsertMarketImportMetadata } from "../sync/metadata.js";

// =============================================================================
// Interfaces
// =============================================================================

export interface BollingerBandRow {
  upper: number;
  middle: number;
  lower: number;
  /** position = (close - lower) / (upper - lower) */
  position: number;
  /** width = (upper - lower) / middle */
  width: number;
}

export interface ContextRow {
  date: string;
  VIX_Open?: number | null;
  VIX_Close?: number | null;
  VIX_High?: number | null;
  VIX_RTH_Open?: number | null;
  VIX9D_Open?: number | null;
  VIX9D_Close?: number | null;
  VIX3M_Open?: number | null;
  VIX3M_Close?: number | null;
}

export interface EnrichedContextRow extends ContextRow {
  VIX_Gap_Pct?: number | null;
  VIX_Change_Pct?: number | null;
  VIX9D_Change_Pct?: number | null;
  VIX3M_Change_Pct?: number | null;
  VIX9D_VIX_Ratio?: number | null;
  VIX_VIX3M_Ratio?: number | null;
  VIX_Spike_Pct?: number | null;
  Vol_Regime?: number | null;
  Term_Structure_State?: number | null;
  VIX_Percentile?: number | null;
}

// =============================================================================
// Primitive Indicators
// =============================================================================

/**
 * Wilder's RSI.
 * Input: closing prices ordered oldest→newest.
 * Returns array same length as input; first `period` entries are NaN (warmup).
 *
 * Formula:
 * - Seed avgGain/avgLoss from SMA of first `period` changes (bars 1..period)
 * - result[period] = 100 - 100/(1 + avgGain/avgLoss)
 * - Subsequent: avgGain = (prev*(period-1) + gain)/period (Wilder smoothing)
 */
export function computeRSI(closes: number[], period = 14): number[] {
  const result = new Array<number>(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  // Seed: average of first `period` gains and losses (changes at indices 1..period)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder smoothing for subsequent bars
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

/**
 * Wilder's Average True Range (ATR).
 * Returns array same length as input; first `period` entries are NaN.
 *
 * True Range = max(high - low, |high - prevClose|, |low - prevClose|)
 * TR can be computed from bar index 1 (needs prevClose).
 * First ATR = SMA of TR[1..period] (simple average of first `period` TR values).
 * ATR[i] for i > period: (ATR_prev * (period-1) + TR[i]) / period (Wilder)
 */
export function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number[] {
  const n = closes.length;
  const result = new Array<number>(n).fill(NaN);
  if (n < period + 1) return result;

  // Compute true ranges starting from index 1 (needs prevClose)
  const tr = new Array<number>(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    const prevClose = closes[i - 1];
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - prevClose),
      Math.abs(lows[i] - prevClose)
    );
  }

  // First ATR = SMA of TR[1..period]
  let atrSum = 0;
  for (let i = 1; i <= period; i++) {
    atrSum += tr[i];
  }
  let atr = atrSum / period;
  result[period] = atr;

  // Wilder smoothing for subsequent bars
  for (let i = period + 1; i < n; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result[i] = atr;
  }

  return result;
}

/**
 * Exponential Moving Average (EMA) with SMA seed (TradingView convention).
 * Returns array same length as input; first `period-1` entries are NaN.
 *
 * Seed: EMA[period-1] = SMA of first `period` bars
 * k = 2 / (period + 1)
 * EMA[i] = close[i] * k + EMA[i-1] * (1 - k)
 */
export function computeEMA(closes: number[], period: number): number[] {
  const n = closes.length;
  const result = new Array<number>(n).fill(NaN);
  if (n < period) return result;

  // Seed from SMA of first period bars
  let seed = 0;
  for (let i = 0; i < period; i++) {
    seed += closes[i];
  }
  seed /= period;
  result[period - 1] = seed;

  const k = 2 / (period + 1);
  for (let i = period; i < n; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k);
  }

  return result;
}

/**
 * Simple Moving Average (SMA).
 * Returns array same length as input; first `period-1` entries are NaN.
 * SMA[i] = average of closes[i-period+1..i]
 */
export function computeSMA(closes: number[], period: number): number[] {
  const n = closes.length;
  const result = new Array<number>(n).fill(NaN);

  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j];
    }
    result[i] = sum / period;
  }

  return result;
}

// =============================================================================
// Composite Indicators
// =============================================================================

/**
 * Bollinger Bands using population stddev (N denominator, TradingView convention).
 * Returns array same length as input; first `period-1` entries are null.
 *
 * Middle = SMA(period)
 * Upper = Middle + multiplier * stddev
 * Lower = Middle - multiplier * stddev
 * BB_Position = (close - lower) / (upper - lower)
 * BB_Width = (upper - lower) / middle
 */
export function computeBollingerBands(
  closes: number[],
  period = 20,
  multiplier = 2
): Array<BollingerBandRow | null> {
  const n = closes.length;
  const result: Array<BollingerBandRow | null> = new Array(n).fill(null);

  for (let i = period - 1; i < n; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    // Population stddev (N denominator)
    const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    const stddev = Math.sqrt(variance);

    const upper = mean + multiplier * stddev;
    const lower = mean - multiplier * stddev;
    const range = upper - lower;

    result[i] = {
      upper,
      middle: mean,
      lower,
      position: range > 0 ? (closes[i] - lower) / range : 0.5,
      width: mean > 0 ? range / mean : 0,
    };
  }

  return result;
}

/**
 * Realized Volatility using log returns, population stddev, annualized.
 * Returns array same length as input; first `period` entries are NaN
 * (need period+1 closes to compute period log returns).
 *
 * log_return[i] = ln(close[i] / close[i-1])
 * Vol[i] = stddev(log_returns[i-period+1..i], N) * sqrt(252) * 100
 */
export function computeRealizedVol(closes: number[], period: number): number[] {
  const n = closes.length;
  const result = new Array<number>(n).fill(NaN);

  // Compute log returns (one less than closes count)
  const logReturns = new Array<number>(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    logReturns[i] = Math.log(closes[i] / closes[i - 1]);
  }

  // Rolling stddev of log returns over `period` window
  // First valid: index = period (window uses log returns at i-period+1..i, earliest is i=period)
  for (let i = period; i < n; i++) {
    const window: number[] = [];
    for (let j = i - period + 1; j <= i; j++) {
      window.push(logReturns[j]);
    }

    const mean = window.reduce((a, b) => a + b, 0) / period;
    // Population stddev
    const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    result[i] = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  return result;
}

// =============================================================================
// Row-Level Helpers
// =============================================================================

/**
 * Consecutive up/down days counter.
 * Positive = consecutive up days, negative = consecutive down days.
 * Resets to 0 on flat day.
 * First element is always 0 (no prior bar).
 */
export function computeConsecutiveDays(closes: number[]): number[] {
  const n = closes.length;
  const result = new Array<number>(n).fill(0);

  for (let i = 1; i < n; i++) {
    if (closes[i] > closes[i - 1]) {
      // Up day: continue positive streak or start at +1
      result[i] = result[i - 1] >= 0 ? result[i - 1] + 1 : 1;
    } else if (closes[i] < closes[i - 1]) {
      // Down day: continue negative streak or start at -1
      result[i] = result[i - 1] <= 0 ? result[i - 1] - 1 : -1;
    } else {
      // Flat: reset to 0
      result[i] = 0;
    }
  }

  return result;
}

/**
 * Gap filled indicator.
 * Returns 1 if the price gap from prior close was filled intraday, 0 otherwise.
 *
 * Gap up (open > priorClose): filled if low <= priorClose
 * Gap down (open < priorClose): filled if high >= priorClose
 * No gap (open = priorClose): returns 0
 */
export function isGapFilled(
  open: number,
  high: number,
  low: number,
  priorClose: number
): number {
  if (open > priorClose && low <= priorClose) return 1;
  if (open < priorClose && high >= priorClose) return 1;
  return 0;
}

/**
 * Options expiration (OPEX) detection.
 * Takes a YYYY-MM-DD string; returns 1 if 3rd Friday of month, 0 otherwise.
 *
 * Uses string parsing (not new Date("YYYY-MM-DD")) to avoid timezone issues.
 * See CLAUDE.md Date Handling rules: calendar dates from CSVs use local Date constructor.
 */
export function isOpex(dateStr: string): number {
  // Parse via regex to avoid timezone issues (CLAUDE.md: use string parsing)
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) return 0;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed for Date constructor
  const day = parseInt(match[3], 10);

  // Use local Date constructor (avoids UTC midnight shift)
  // Check if this day is a Friday (getDay() === 5)
  const date = new Date(year, month, day);
  if (date.getDay() !== 5) return 0;

  // Find first Friday of month
  const firstDay = new Date(year, month, 1);
  const firstFridayDay = ((5 - firstDay.getDay() + 7) % 7) + 1; // day of month

  // Third Friday = first Friday + 14
  const thirdFriday = firstFridayDay + 14;

  return day === thirdFriday ? 1 : 0;
}

// =============================================================================
// Tier 2 VIX Functions
// =============================================================================

/**
 * Compute VIX-derived fields for market.context rows.
 * Takes sorted context rows (oldest first) with VIX OHLCV data.
 * Returns enriched rows with pct change, ratio, and spike fields.
 *
 * Fields requiring prior row (NaN on first row):
 * - VIX_Gap_Pct: (VIX_Open - prior VIX_Close) / prior VIX_Close * 100
 * - VIX_Change_Pct: (VIX_Close - prior VIX_Close) / prior VIX_Close * 100
 * - VIX9D_Change_Pct: (VIX9D_Close - VIX9D_Open) / VIX9D_Open * 100
 * - VIX3M_Change_Pct: (VIX3M_Close - VIX3M_Open) / VIX3M_Open * 100
 *
 * Same-day fields (no lookback needed):
 * - VIX9D_VIX_Ratio: VIX9D_Close / VIX_Close
 * - VIX_VIX3M_Ratio: VIX_Close / VIX3M_Close
 * - VIX_Spike_Pct: (VIX_High - VIX_Open) / VIX_Open * 100
 */
export function computeVIXDerivedFields(rows: ContextRow[]): EnrichedContextRow[] {
  return rows.map((row, i): EnrichedContextRow => {
    const prev = i > 0 ? rows[i - 1] : null;

    // Effective open: prefer RTH open from intraday bars, fall back to daily VIX_Open
    const effectiveOpen = row.VIX_RTH_Open ?? row.VIX_Open;

    // Same-day ratio and spike fields
    const VIX9D_VIX_Ratio =
      row.VIX9D_Close != null && row.VIX_Close != null && row.VIX_Close !== 0
        ? row.VIX9D_Close / row.VIX_Close
        : null;

    const VIX_VIX3M_Ratio =
      row.VIX_Close != null && row.VIX3M_Close != null && row.VIX3M_Close !== 0
        ? row.VIX_Close / row.VIX3M_Close
        : null;

    const VIX_Spike_Pct =
      row.VIX_High != null && effectiveOpen != null && effectiveOpen !== 0
        ? ((row.VIX_High - effectiveOpen) / effectiveOpen) * 100
        : null;

    // Intraday change fields (same-day open to close)
    const VIX9D_Change_Pct =
      row.VIX9D_Close != null && row.VIX9D_Open != null && row.VIX9D_Open !== 0
        ? ((row.VIX9D_Close - row.VIX9D_Open) / row.VIX9D_Open) * 100
        : null;

    const VIX3M_Change_Pct =
      row.VIX3M_Close != null && row.VIX3M_Open != null && row.VIX3M_Open !== 0
        ? ((row.VIX3M_Close - row.VIX3M_Open) / row.VIX3M_Open) * 100
        : null;

    // Prior-row dependent fields
    const prevVIXClose = prev?.VIX_Close ?? null;

    const VIX_Gap_Pct =
      effectiveOpen != null && prevVIXClose != null && prevVIXClose !== 0
        ? ((effectiveOpen - prevVIXClose) / prevVIXClose) * 100
        : null;

    const VIX_Change_Pct =
      row.VIX_Close != null && prevVIXClose != null && prevVIXClose !== 0
        ? ((row.VIX_Close - prevVIXClose) / prevVIXClose) * 100
        : null;

    return {
      ...row,
      VIX_Gap_Pct,
      VIX_Change_Pct,
      VIX9D_Change_Pct,
      VIX3M_Change_Pct,
      VIX9D_VIX_Ratio,
      VIX_VIX3M_Ratio,
      VIX_Spike_Pct,
    };
  });
}

/**
 * Classify VIX level into volatility regime 1-6.
 *
 * 1: Very Low  VIX < 13
 * 2: Low       13 <= VIX < 16
 * 3: Normal    16 <= VIX < 20
 * 4: Elevated  20 <= VIX < 25
 * 5: High      25 <= VIX < 30
 * 6: Extreme   VIX >= 30
 */
export function classifyVolRegime(vixClose: number): number {
  if (vixClose < 13) return 1;
  if (vixClose < 16) return 2;
  if (vixClose < 20) return 3;
  if (vixClose < 25) return 4;
  if (vixClose < 30) return 5;
  return 6;
}

/**
 * Classify VIX term structure state.
 * Returns:
 *   1  = Contango: VIX9D < VIX and VIX < VIX3M (normal, longer-dated vol is higher)
 *  -1  = Backwardation: VIX9D > VIX or VIX > VIX3M (inverted — fear in front)
 *   0  = Flat: all three within ~1% tolerance of each other
 *
 * Flatness check: both ratios VIX9D/VIX and VIX/VIX3M within 1% of 1.0
 */
export function classifyTermStructure(
  vix9dClose: number,
  vixClose: number,
  vix3mClose: number
): number {
  // Match PineScript: vix9dClose > vixClose ? -1 : vixClose > vix3mClose ? 0 : 1
  if (vix9dClose > vixClose) return -1;
  if (vixClose > vix3mClose) return 0;
  return 1;
}

/**
 * Rolling VIX percentile rank.
 * percentile[i] = count(v < vixCloses[i] in window [i-period+1..i]) / period * 100
 * Returns array same length as input; first `period-1` entries are NaN.
 */
export function computeVIXPercentile(vixCloses: number[], period = 252): number[] {
  const n = vixCloses.length;
  const result = new Array<number>(n).fill(NaN);

  for (let i = period - 1; i < n; i++) {
    const currentVal = vixCloses[i];
    let countLess = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (vixCloses[j] < currentVal) countLess++;
    }
    result[i] = (countLess / period) * 100;
  }

  return result;
}

// =============================================================================
// Enrichment Runner Types
// =============================================================================

export interface EnrichmentOptions {
  forceFull?: boolean;
}

export interface TierStatus {
  status: "complete" | "skipped" | "error";
  fieldsWritten?: number;
  reason?: string;
}

export interface EnrichmentResult {
  ticker: string;
  tier1: TierStatus;
  tier2: TierStatus;
  tier3: TierStatus;
  rowsEnriched: number;
  enrichedThrough: string | null;
}

// =============================================================================
// Enrichment Runner Private Helpers
// =============================================================================

/** Subtract N calendar days from a YYYY-MM-DD string, returns YYYY-MM-DD */
function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split("T")[0];
}

/** Parse YYYY-MM-DD to a local Date without timezone conversion */
function parseDateStr(dateStr: string): Date | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
}

/** Batch UPDATE market.daily with computed enrichment fields */
async function batchUpdateDaily(
  conn: DuckDBConnection,
  rows: Array<Record<string, unknown>>,
  columns: string[]
): Promise<void> {
  if (rows.length === 0) return;
  // Build VALUES list with $N params
  const allCols = ["ticker", "date", ...columns];
  const placeholders = rows
    .map((_, rowIdx) => {
      const params = allCols.map((__, colIdx) => `$${rowIdx * allCols.length + colIdx + 1}`);
      return `(${params.join(", ")})`;
    })
    .join(", ");
  const setClauses = columns.map((c) => `${c} = v.${c}`).join(", ");
  const sql = `
    UPDATE market.daily AS t
    SET ${setClauses}
    FROM (VALUES ${placeholders}) AS v(${allCols.join(", ")})
    WHERE t.ticker = v.ticker AND t.date = v.date
  `;
  const params = rows.flatMap((row) => allCols.map((col) => row[col] ?? null));
  await conn.run(sql, params as (string | number | boolean | null | bigint)[]);
}

/** Run Tier 2: enrich market.context with computed VIX fields */
async function runTier2(conn: DuckDBConnection): Promise<TierStatus> {
  // Check if VIX data exists
  const check = await conn.runAndReadAll(
    `SELECT COUNT(*) FROM market.context WHERE VIX_Close IS NOT NULL LIMIT 1`
  );
  const count = Number(check.getRows()[0]?.[0] ?? 0);
  if (count === 0) {
    return { status: "skipped", reason: "no VIX data in market.context — import context data first" };
  }

  // Fetch all context rows ordered by date
  const reader = await conn.runAndReadAll(
    `SELECT date, VIX_Open, VIX_Close, VIX_High, VIX9D_Open, VIX9D_Close, VIX3M_Open, VIX3M_Close
     FROM market.context ORDER BY date ASC`
  );
  const rawRows = reader.getRows();
  if (rawRows.length === 0) return { status: "skipped", reason: "no context rows" };

  // Query VIX RTH open from intraday bars (first bar in 09:30-09:32 window per date)
  const rthOpenByDate = new Map<string, number>();
  try {
    const rthReader = await conn.runAndReadAll(
      `SELECT date, open
       FROM market.intraday
       WHERE ticker = 'VIX'
         AND time >= '09:30' AND time <= '09:32'
       ORDER BY date, time ASC`
    );
    const rthRows = rthReader.getRows();
    for (const r of rthRows) {
      const dateStr = r[0] as string;
      // Keep first bar per date (earliest time in window)
      if (!rthOpenByDate.has(dateStr)) {
        const openVal = r[1] as number | null;
        if (openVal != null) {
          rthOpenByDate.set(dateStr, openVal);
        }
      }
    }
  } catch {
    // market.intraday may not have VIX data — gracefully continue with empty map
  }

  // Map to ContextRow objects
  const contextRows: ContextRow[] = rawRows.map((r) => ({
    date: r[0] as string,
    VIX_Open: r[1] as number | null,
    VIX_Close: r[2] as number | null,
    VIX_High: r[3] as number | null,
    VIX_RTH_Open: rthOpenByDate.get(r[0] as string) ?? null,
    VIX9D_Open: r[4] as number | null,
    VIX9D_Close: r[5] as number | null,
    VIX3M_Open: r[6] as number | null,
    VIX3M_Close: r[7] as number | null,
  }));

  // Compute VIX percentile using VIX_Close array
  const vixCloses = contextRows.map((r) => r.VIX_Close ?? NaN);
  const vixPercentiles = computeVIXPercentile(vixCloses, 252);

  // Enrich each row with derived fields
  const enrichedContext = computeVIXDerivedFields(contextRows);

  // Batch UPDATE market.context with Tier 2 fields
  const tier2Cols = [
    "VIX_RTH_Open",
    "VIX_Gap_Pct",
    "VIX_Change_Pct",
    "VIX9D_Change_Pct",
    "VIX3M_Change_Pct",
    "VIX9D_VIX_Ratio",
    "VIX_VIX3M_Ratio",
    "VIX_Spike_Pct",
    "Vol_Regime",
    "Term_Structure_State",
    "VIX_Percentile",
  ];

  // Build batch of rows with Tier 2 fields + percentile
  const updateRows = enrichedContext.map((r, i) => {
    const vc = r.VIX_Close ?? null;
    const v9 = r.VIX9D_Close ?? null;
    const v3m = r.VIX3M_Close ?? null;
    return {
      date: r.date,
      VIX_RTH_Open: r.VIX_RTH_Open ?? null,
      VIX_Gap_Pct: r.VIX_Gap_Pct ?? null,
      VIX_Change_Pct: r.VIX_Change_Pct ?? null,
      VIX9D_Change_Pct: r.VIX9D_Change_Pct ?? null,
      VIX3M_Change_Pct: r.VIX3M_Change_Pct ?? null,
      VIX9D_VIX_Ratio: r.VIX9D_VIX_Ratio ?? null,
      VIX_VIX3M_Ratio: r.VIX_VIX3M_Ratio ?? null,
      VIX_Spike_Pct: r.VIX_Spike_Pct ?? null,
      Vol_Regime: vc !== null ? classifyVolRegime(vc) : null,
      Term_Structure_State:
        v9 !== null && vc !== null && v3m !== null
          ? classifyTermStructure(v9, vc, v3m)
          : null,
      VIX_Percentile: isNaN(vixPercentiles[i]) ? null : vixPercentiles[i],
    };
  });

  // UPDATE market.context in batches of 500
  const BATCH_SIZE = 500;
  const allCols2 = ["date", ...tier2Cols];
  for (let start = 0; start < updateRows.length; start += BATCH_SIZE) {
    const batch = updateRows.slice(start, start + BATCH_SIZE);
    const placeholders = batch
      .map((_, rowIdx) => {
        const params = allCols2.map((__, colIdx) => `$${rowIdx * allCols2.length + colIdx + 1}`);
        return `(${params.join(", ")})`;
      })
      .join(", ");
    const setClauses = tier2Cols.map((c) => `${c} = v.${c}`).join(", ");
    const sql = `
      UPDATE market.context AS t
      SET ${setClauses}
      FROM (VALUES ${placeholders}) AS v(${allCols2.join(", ")})
      WHERE t.date = v.date
    `;
    const params = batch.flatMap((row) =>
      allCols2.map((col) => (row as Record<string, unknown>)[col] ?? null)
    );
    await conn.run(sql, params as (string | number | boolean | null | bigint)[]);
  }

  return { status: "complete", fieldsWritten: tier2Cols.length };
}

/** Check if any intraday data exists for a ticker */
async function hasTier3Data(conn: DuckDBConnection, ticker: string): Promise<boolean> {
  const r = await conn.runAndReadAll(
    `SELECT COUNT(*) FROM market.intraday WHERE ticker = $1 LIMIT 1`,
    [ticker]
  );
  return Number(r.getRows()[0]?.[0] ?? 0) > 0;
}

// =============================================================================
// Enrichment Runner
// =============================================================================

/**
 * Run all three tiers of market enrichment for a given ticker.
 *
 * Tier 1: Compute and write OHLCV-derived fields to market.daily using a
 *         200-day lookback window from the enriched_through watermark.
 * Tier 2: Compute and write VIX-derived fields to market.context.
 * Tier 3: Compute intraday timing fields (High_Time, Low_Time, High_Before_Low,
 *         Reversal_Type, Opening_Drive_Strength, Intraday_Realized_Vol) from
 *         market.intraday bars; skips gracefully if no intraday data exists.
 *
 * The enriched_through watermark is upserted into market._sync_metadata with
 * source='enrichment', ticker, target_table='daily' after a successful Tier 1 run.
 *
 * Note: wilder_state column exists but is NOT written (superseded by 200-day lookback).
 *
 * @param conn - Active DuckDB connection with market catalog attached
 * @param ticker - Normalized ticker symbol (e.g., "SPX")
 * @param opts - Options including forceFull (reset watermark and reprocess all rows)
 */
export async function runEnrichment(
  conn: DuckDBConnection,
  ticker: string,
  opts: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
  const { forceFull = false } = opts;

  // 1. Get enriched_through watermark
  const watermarkRow = await conn.runAndReadAll(
    `SELECT enriched_through FROM market._sync_metadata
     WHERE source = 'enrichment' AND ticker = $1 AND target_table = 'daily'`,
    [ticker]
  );
  const watermark: string | null = forceFull
    ? null
    : ((watermarkRow.getRows()[0]?.[0] as string | null) ?? null);

  // 2. Compute lookback start: watermark - 200 calendar days (as string comparison)
  const lookbackStart = watermark ? subtractDays(watermark, 200) : null;

  // 3. Fetch OHLCV rows from market.daily
  let fetchSql = `SELECT ticker, date, open, high, low, close FROM market.daily WHERE ticker = $1`;
  const fetchParams: unknown[] = [ticker];
  if (lookbackStart) {
    fetchSql += ` AND date >= $2`;
    fetchParams.push(lookbackStart);
  }
  fetchSql += ` ORDER BY date ASC`;
  const rawReader = await conn.runAndReadAll(fetchSql, fetchParams as (string | number | boolean | null | bigint)[]);
  const rawRows = rawReader.getRows();

  if (rawRows.length === 0) {
    return {
      ticker,
      tier1: { status: "skipped", reason: "no data in market.daily" },
      tier2: { status: "skipped", reason: "no daily data" },
      tier3: { status: "skipped", reason: "no daily data" },
      rowsEnriched: 0,
      enrichedThrough: null,
    };
  }

  // 4. Extract typed arrays from raw rows
  // Columns: ticker(0), date(1), open(2), high(3), low(4), close(5)
  const dates = rawRows.map((r) => r[1] as string);
  const opens = rawRows.map((r) => Number(r[2]));
  const highs = rawRows.map((r) => Number(r[3]));
  const lows = rawRows.map((r) => Number(r[4]));
  const closes = rawRows.map((r) => Number(r[5]));

  // 5. Compute Tier 1 indicators
  const rsi14 = computeRSI(closes, 14);
  const atrArr = computeATR(highs, lows, closes, 14);
  const ema21 = computeEMA(closes, 21);
  const sma50 = computeSMA(closes, 50);
  const bbArr = computeBollingerBands(closes, 20, 2);
  const rvol5 = computeRealizedVol(closes, 5);
  const rvol20 = computeRealizedVol(closes, 20);
  const consecutiveDays = computeConsecutiveDays(closes);

  // 6. Determine which rows to write back (only rows after watermark)
  const writeRows =
    watermark && !forceFull
      ? rawRows.map((_, i) => i).filter((i) => dates[i] > watermark)
      : rawRows.map((_, i) => i);

  if (writeRows.length === 0) {
    return {
      ticker,
      tier1: { status: "complete", fieldsWritten: 0, reason: "already up to date" },
      tier2: await runTier2(conn),
      tier3: {
        status: "skipped",
        reason: "no intraday data in market.intraday",
      },
      rowsEnriched: 0,
      enrichedThrough: watermark,
    };
  }

  // 7. Build enriched rows for batch UPDATE
  const enrichedRows = writeRows.map((i) => {
    const atrVal = atrArr[i];
    const atrPct = !isNaN(atrVal) && closes[i] > 0 ? (atrVal / closes[i]) * 100 : null;
    const priorClose = i > 0 ? closes[i - 1] : null;
    const priorReturn =
      i > 1 ? ((closes[i - 1] - closes[i - 2]) / closes[i - 2]) * 100 : null;
    const gapPct =
      priorClose !== null && priorClose > 0
        ? ((opens[i] - priorClose) / priorClose) * 100
        : null;
    const intradayRangePct =
      opens[i] > 0 ? ((highs[i] - lows[i]) / opens[i]) * 100 : null;
    const intradayReturnPct =
      opens[i] > 0 ? ((closes[i] - opens[i]) / opens[i]) * 100 : null;
    const hiLoRange = highs[i] - lows[i];
    const closePosInRange =
      hiLoRange > 0 ? (closes[i] - lows[i]) / hiLoRange : null;
    const ret5d =
      i >= 5 && closes[i - 5] > 0
        ? ((closes[i] - closes[i - 5]) / closes[i - 5]) * 100
        : null;
    const ret20d =
      i >= 20 && closes[i - 20] > 0
        ? ((closes[i] - closes[i - 20]) / closes[i - 20]) * 100
        : null;
    const bb = bbArr[i];
    const gapFilled =
      priorClose !== null ? isGapFilled(opens[i], highs[i], lows[i], priorClose) : null;
    const dateObj = parseDateStr(dates[i]);
    const dayOfWeek = dateObj ? dateObj.getDay() : null; // 0=Sun..6=Sat
    const monthVal = dateObj ? dateObj.getMonth() + 1 : null;
    const opex = isOpex(dates[i]);
    const ema21val = ema21[i];
    const sma50val = sma50[i];
    const priceVsEma21 =
      !isNaN(ema21val) && ema21val > 0
        ? ((closes[i] - ema21val) / ema21val) * 100
        : null;
    const priceVsSma50 =
      !isNaN(sma50val) && sma50val > 0
        ? ((closes[i] - sma50val) / sma50val) * 100
        : null;
    const rsi14val = rsi14[i];

    // Prior_Range_vs_ATR: prior day's (high - low) / ATR[i-1]
    // Known at market open (prior day range and ATR are available before trading begins).
    // First bar (i=0) has no prior day, so null. ATR[i-1] must be valid (non-NaN).
    let priorRangeVsATR: number | null = null;
    if (i > 0) {
      const priorATR = atrArr[i - 1];
      if (!isNaN(priorATR) && priorATR > 0) {
        priorRangeVsATR = (highs[i - 1] - lows[i - 1]) / priorATR;
      }
    }

    return {
      ticker,
      date: dates[i],
      Prior_Close: priorClose,
      Gap_Pct: gapPct,
      RSI_14: isNaN(rsi14val) ? null : rsi14val,
      ATR_Pct: atrPct,
      Price_vs_EMA21_Pct: priceVsEma21,
      Price_vs_SMA50_Pct: priceVsSma50,
      BB_Position: bb ? bb.position : null,
      BB_Width: bb ? bb.width : null,
      Realized_Vol_5D: isNaN(rvol5[i]) ? null : rvol5[i],
      Realized_Vol_20D: isNaN(rvol20[i]) ? null : rvol20[i],
      Return_5D: ret5d,
      Return_20D: ret20d,
      Intraday_Range_Pct: intradayRangePct,
      Intraday_Return_Pct: intradayReturnPct,
      Close_Position_In_Range: closePosInRange,
      Gap_Filled: gapFilled,
      Consecutive_Days: consecutiveDays[i],
      Prev_Return_Pct: priorReturn,
      Day_of_Week: dayOfWeek,
      Month: monthVal,
      Is_Opex: opex,
      Prior_Range_vs_ATR: priorRangeVsATR,
    };
  });

  // 8. Batch UPDATE via DuckDB VALUES CTE, batches of 500
  const BATCH_SIZE = 500;
  const columns = [
    "Prior_Close",
    "Gap_Pct",
    "RSI_14",
    "ATR_Pct",
    "Price_vs_EMA21_Pct",
    "Price_vs_SMA50_Pct",
    "BB_Position",
    "BB_Width",
    "Realized_Vol_5D",
    "Realized_Vol_20D",
    "Return_5D",
    "Return_20D",
    "Intraday_Range_Pct",
    "Intraday_Return_Pct",
    "Close_Position_In_Range",
    "Gap_Filled",
    "Consecutive_Days",
    "Prev_Return_Pct",
    "Day_of_Week",
    "Month",
    "Is_Opex",
    "Prior_Range_vs_ATR",
  ];
  for (let start = 0; start < enrichedRows.length; start += BATCH_SIZE) {
    const batch = enrichedRows.slice(start, start + BATCH_SIZE);
    await batchUpdateDaily(conn, batch, columns);
  }

  // 9. Run Tier 2 (VIX context enrichment)
  const tier2Result = await runTier2(conn);

  // 10. Tier 3 — intraday timing fields from market.intraday
  const tier3Result = await runTier3(conn, ticker, dates);

  // 11. Update enriched_through watermark
  const newWatermark = dates[dates.length - 1];
  await upsertMarketImportMetadata(conn, {
    source: "enrichment",
    ticker,
    target_table: "daily",
    max_date: null,
    enriched_through: newWatermark,
    synced_at: new Date(),
  });

  return {
    ticker,
    tier1: { status: "complete", fieldsWritten: columns.length },
    tier2: tier2Result,
    tier3: tier3Result,
    rowsEnriched: enrichedRows.length,
    enrichedThrough: newWatermark,
  };
}

// =============================================================================
// Tier 3: Intraday Timing Fields
// =============================================================================

/**
 * Convert HH:MM time string to decimal hours (e.g., "10:30" → 10.5).
 */
function hhmmToDecimalHours(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h + m / 60;
}

/**
 * Compute intraday timing fields from raw OHLCV bars for a single date.
 *
 * Pure function — no DB access. Exported for unit testing.
 *
 * Fields computed:
 * - highTime: Decimal hours when day high occurred (e.g., 10.5 = 10:30)
 * - lowTime: Decimal hours when day low occurred
 * - highBeforeLow: true if high occurred before low
 * - reversalType: +1 = morning high + afternoon low, -1 = morning low + afternoon high, 0 = trend day
 * - openingDriveStrength: (first 30-min range) / (full day range), 0-1 scale; 0 if day range is 0
 * - intradayRealizedVol: Annualized realized vol from intraday bar-to-bar log returns (decimal, not %)
 *
 * @param bars - Array of {time: "HH:MM", open, high, low, close} ordered by time (oldest first)
 * @returns Computed fields or null if bars is empty
 */
export function computeIntradayTimingFields(
  bars: Array<{ time: string; open: number; high: number; low: number; close: number }>
): {
  highTime: number;
  lowTime: number;
  highBeforeLow: boolean;
  reversalType: number;
  openingDriveStrength: number;
  intradayRealizedVol: number;
} | null {
  if (bars.length === 0) return null;

  let maxHigh = -Infinity;
  let minLow = Infinity;
  let highTimeStr = bars[0].time;
  let lowTimeStr = bars[0].time;

  for (const bar of bars) {
    if (bar.high > maxHigh) {
      maxHigh = bar.high;
      highTimeStr = bar.time;
    }
    if (bar.low < minLow) {
      minLow = bar.low;
      lowTimeStr = bar.time;
    }
  }

  const highTime = hhmmToDecimalHours(highTimeStr);
  const lowTime = hhmmToDecimalHours(lowTimeStr);
  const highBeforeLow = highTime < lowTime;

  // Reversal type: morning = before 12:00, afternoon = 12:00 or later
  const highInMorning = highTime < 12;
  const lowInMorning = lowTime < 12;
  const highInAfternoon = highTime >= 12;
  const lowInAfternoon = lowTime >= 12;

  let reversalType = 0;
  if (highInMorning && lowInAfternoon) reversalType = 1;     // High morning, low afternoon
  else if (lowInMorning && highInAfternoon) reversalType = -1; // Low morning, high afternoon

  // Opening Drive Strength: ratio of first-30-min range to full-day range
  // First 30 min = bars with time < 10:00 (market opens 09:30)
  const openingBars = bars.filter(b => hhmmToDecimalHours(b.time) < 10);
  let openingDriveStrength = 0;
  const fullDayRange = maxHigh - minLow;
  if (openingBars.length > 0 && fullDayRange > 0) {
    const openHigh = Math.max(...openingBars.map(b => b.high));
    const openLow = Math.min(...openingBars.map(b => b.low));
    openingDriveStrength = (openHigh - openLow) / fullDayRange;
  }

  // Intraday Realized Vol: annualized from bar-to-bar close log returns
  // Uses sqrt(252 * barsPerDay) annualization
  let intradayRealizedVol = 0;
  if (bars.length >= 2) {
    const logReturns: number[] = [];
    for (let i = 1; i < bars.length; i++) {
      if (bars[i - 1].close > 0 && bars[i].close > 0) {
        logReturns.push(Math.log(bars[i].close / bars[i - 1].close));
      }
    }
    if (logReturns.length > 0) {
      const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
      const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / logReturns.length;
      const barStdDev = Math.sqrt(variance);
      // Annualize: multiply by sqrt(barsPerDay * 252)
      // barsPerDay = number of bars we actually have (adapts to timeframe)
      intradayRealizedVol = barStdDev * Math.sqrt(bars.length * 252);
    }
  }

  return { highTime, lowTime, highBeforeLow, reversalType, openingDriveStrength, intradayRealizedVol };
}

/** Run Tier 3: compute intraday timing fields from market.intraday and write to market.daily */
async function runTier3(
  conn: DuckDBConnection,
  ticker: string,
  dates: string[]
): Promise<TierStatus> {
  // Check if intraday data exists for this ticker
  const hasData = await hasTier3Data(conn, ticker);
  if (!hasData) {
    return {
      status: "skipped",
      reason: "no intraday data in market.intraday — import intraday bars to populate Tier 3 fields",
    };
  }

  // Query intraday bars for all dates in the enrichment range
  const result = await conn.runAndReadAll(
    `SELECT date, time, open, high, low, close
     FROM market.intraday
     WHERE ticker = $1 AND date >= $2 AND date <= $3
     ORDER BY date, time`,
    [ticker, dates[0], dates[dates.length - 1]]
  );

  const rows = result.getRows();
  const columns = result.columnNames();
  const dateIdx = columns.indexOf("date");
  const timeIdx = columns.indexOf("time");
  const openIdx = columns.indexOf("open");
  const highIdx = columns.indexOf("high");
  const lowIdx = columns.indexOf("low");
  const closeIdx = columns.indexOf("close");

  // Group bars by date
  const barsByDate = new Map<string, Array<{ time: string; open: number; high: number; low: number; close: number }>>();
  for (const row of rows) {
    const dateStr = String(row[dateIdx]);
    const bar = {
      time: String(row[timeIdx]),
      open: Number(row[openIdx]),
      high: Number(row[highIdx]),
      low: Number(row[lowIdx]),
      close: Number(row[closeIdx]),
    };
    if (!barsByDate.has(dateStr)) barsByDate.set(dateStr, []);
    barsByDate.get(dateStr)!.push(bar);
  }

  if (barsByDate.size === 0) {
    return {
      status: "skipped",
      reason: "intraday data exists but no bars overlap with enrichment date range",
    };
  }

  // Compute timing fields for each date and batch update market.daily
  const tier3Cols = ["High_Time", "Low_Time", "High_Before_Low", "Reversal_Type", "Opening_Drive_Strength", "Intraday_Realized_Vol"];
  const enrichedRows: Array<Record<string, unknown>> = [];

  for (const [dateStr, bars] of barsByDate) {
    const timing = computeIntradayTimingFields(bars);
    if (!timing) continue;

    enrichedRows.push({
      ticker,
      date: dateStr,
      High_Time: timing.highTime,
      Low_Time: timing.lowTime,
      High_Before_Low: timing.highBeforeLow ? 1 : 0,
      Reversal_Type: timing.reversalType,
      Opening_Drive_Strength: timing.openingDriveStrength,
      Intraday_Realized_Vol: timing.intradayRealizedVol,
    });
  }

  // Batch update using the existing batchUpdateDaily helper
  const BATCH_SIZE = 500;
  for (let start = 0; start < enrichedRows.length; start += BATCH_SIZE) {
    const batch = enrichedRows.slice(start, start + BATCH_SIZE);
    await batchUpdateDaily(conn, batch, tier3Cols);
  }

  return { status: "complete", fieldsWritten: tier3Cols.length };
}
