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

/**
 * Trend Score: integer -5 to +5 based on 5 conditions.
 * Takes parallel arrays of equal length (from computeEMA, computeSMA, computeRSI).
 *
 * Conditions (each +1 bullish, -1 bearish):
 * 1. close > EMA21: +1, else -1
 * 2. EMA21 > SMA50: +1, else -1
 * 3. close > SMA50: +1, else -1
 * 4. RSI_14 > 50: +1, else -1
 * 5. close > 20-day high (prior 20 bars, excluding today): +1, else -1
 *
 * Returns NaN where any required input is NaN.
 */
export function computeTrendScore(
  closes: number[],
  ema21: number[],
  sma50: number[],
  rsi14: number[]
): number[] {
  const n = closes.length;
  const result = new Array<number>(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    // All inputs must be valid numbers
    if (isNaN(ema21[i]) || isNaN(sma50[i]) || isNaN(rsi14[i])) continue;

    // 5th condition: need 20 prior bars for 20-day high excluding today
    // If we don't have 20 prior bars, skip the 5th condition (use 0)
    let condition5 = 0;
    if (i >= 20) {
      let priorHigh = -Infinity;
      for (let j = i - 20; j < i; j++) {
        if (closes[j] > priorHigh) priorHigh = closes[j];
      }
      condition5 = closes[i] > priorHigh ? 1 : -1;
    }

    const score =
      (closes[i] > ema21[i] ? 1 : -1) +
      (ema21[i] > sma50[i] ? 1 : -1) +
      (closes[i] > sma50[i] ? 1 : -1) +
      (rsi14[i] > 50 ? 1 : -1) +
      condition5;

    result[i] = score;
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
      row.VIX_High != null && row.VIX_Open != null && row.VIX_Open !== 0
        ? ((row.VIX_High - row.VIX_Open) / row.VIX_Open) * 100
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
      row.VIX_Open != null && prevVIXClose != null && prevVIXClose !== 0
        ? ((row.VIX_Open - prevVIXClose) / prevVIXClose) * 100
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
 * 5: High      25 <= VIX < 35
 * 6: Extreme   VIX >= 35
 */
export function classifyVolRegime(vixClose: number): number {
  if (vixClose < 13) return 1;
  if (vixClose < 16) return 2;
  if (vixClose < 20) return 3;
  if (vixClose < 25) return 4;
  if (vixClose < 35) return 5;
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
  // Flat tolerance: both adjacent ratios within 1% of 1.0
  const ratio9dToVix = vix9dClose / vixClose;
  const ratioVixTo3m = vixClose / vix3mClose;

  const isFlat =
    Math.abs(ratio9dToVix - 1) < 0.01 && Math.abs(ratioVixTo3m - 1) < 0.01;

  if (isFlat) return 0;

  // Contango: short-dated < mid < long-dated (normal upward slope)
  if (vix9dClose < vixClose && vixClose < vix3mClose) return 1;

  // Backwardation: any inversion
  return -1;
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
