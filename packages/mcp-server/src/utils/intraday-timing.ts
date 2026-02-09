/**
 * Intraday Checkpoint Timing Utilities
 *
 * Handles temporal filtering for per-timestamp checkpoint data from intraday tables
 * (market.spx_15min and market.vix_intraday). This is fundamentally different from the
 * open/close binary classification model in field-timing.ts:
 *
 * - field-timing.ts: Each field is classified as "open" or "close" (known before or after market close)
 * - intraday-timing.ts: Each checkpoint has a specific timestamp (e.g., 09:30, 09:45, 10:00)
 *   and is known AT that exact time. A trade entered at 09:35 sees P_0930 but NOT P_0945.
 *
 * The temporal semantics ensure lookahead-free enrichment: only checkpoint values that
 * were observable at the trade's entry time are included in the output.
 *
 * Used by enrich_trades (includeIntradayContext=true) and potentially by future tools.
 */

// =============================================================================
// Checkpoint Time Constants
// =============================================================================

/**
 * SPX 15-minute price checkpoints as HHMM integers for fast comparison.
 * Corresponds to P_HHMM columns in market.spx_15min (26 checkpoints from 09:30 to 15:45).
 */
export const SPX_CHECKPOINTS = [
  930, 945, 1000, 1015, 1030, 1045, 1100, 1115, 1130, 1145,
  1200, 1215, 1230, 1245, 1300, 1315, 1330, 1345, 1400, 1415,
  1430, 1445, 1500, 1515, 1530, 1545,
] as const;

/**
 * VIX intraday checkpoints as HHMM integers for fast comparison.
 * Corresponds to VIX_HHMM columns in market.vix_intraday (14 checkpoints).
 * Note: VIX uses ~30-minute intervals (NOT 15-minute like SPX),
 * with an irregular final step from 1530 to 1545.
 */
export const VIX_CHECKPOINTS = [
  930, 1000, 1030, 1100, 1130, 1200, 1230, 1300,
  1330, 1400, 1430, 1500, 1530, 1545,
] as const;

// =============================================================================
// Outcome Field Constants (day-level aggregates requiring end-of-day data)
// =============================================================================

/**
 * SPX 15-minute table fields that are day-level aggregates (percentage moves, MOC, afternoon).
 * These require end-of-day data and are NOT available at trade entry time.
 * Only returned when both includeIntradayContext=true AND includeOutcomeFields=true.
 */
export const SPX_15MIN_OUTCOME_FIELDS = [
  'Pct_0930_to_1000', 'Pct_0930_to_1200', 'Pct_0930_to_1500', 'Pct_0930_to_Close',
  'MOC_15min', 'MOC_30min', 'MOC_45min', 'MOC_60min',
  'Afternoon_Move',
] as const;

/**
 * VIX intraday table fields that are day-level aggregates (moves, spike/crush flags).
 * These require end-of-day data and are NOT available at trade entry time.
 * Only returned when both includeIntradayContext=true AND includeOutcomeFields=true.
 */
export const VIX_OUTCOME_FIELDS = [
  'VIX_Day_High', 'VIX_Day_Low',
  'VIX_Morning_Move', 'VIX_Afternoon_Move', 'VIX_Power_Hour_Move',
  'VIX_Last_30min_Move', 'VIX_Full_Day_Move', 'VIX_First_Hour_Move',
  'VIX_Intraday_Range_Pct', 'VIX_Spike_From_Open', 'VIX_Spike_Flag',
  'VIX_Crush_From_Open', 'VIX_Crush_Flag', 'VIX_Close_In_Range',
] as const;

/**
 * VIX OHLC fields that are outcome (high/low/close not known at entry).
 * VIX `open` is known at open, so it is NOT included here.
 */
export const VIX_OHLC_OUTCOME_FIELDS = ['high', 'low', 'close'] as const;

// =============================================================================
// Time Parsing
// =============================================================================

/**
 * Parse a timeOpened string (HH:mm:ss format, Eastern Time) to HHMM integer
 * for comparison against checkpoint times.
 *
 * Examples:
 * - "09:30:00" -> 930
 * - "09:35:00" -> 935
 * - "14:30:00" -> 1430
 * - "00:00:00" -> 0 (default for missing times; results in empty knownCheckpoints)
 *
 * @param timeStr - Time string in HH:mm:ss format
 * @returns HHMM integer (e.g., 930 for 09:30, 1430 for 14:30)
 */
export function parseTimeToHHMM(timeStr: string): number {
  if (!timeStr || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 0;
  return hours * 100 + minutes;
}

// =============================================================================
// Checkpoint Filtering Functions
// =============================================================================

/**
 * Get SPX checkpoint field names known at or before the given trade time.
 * A checkpoint at time T is considered "known" at time T (the price has printed).
 *
 * Example: tradeTimeHHMM=935 returns ["P_0930"] (P_0945 is NOT known yet).
 * Example: tradeTimeHHMM=1030 returns ["P_0930", "P_0945", "P_1000", "P_1015", "P_1030"].
 *
 * @param tradeTimeHHMM - Trade entry time as HHMM integer
 * @returns Array of SPX checkpoint column names (e.g., ["P_0930", "P_0945"])
 */
export function getKnownSpxCheckpoints(tradeTimeHHMM: number): string[] {
  return SPX_CHECKPOINTS
    .filter(cp => cp <= tradeTimeHHMM)
    .map(cp => `P_${String(cp).padStart(4, '0')}`);
}

/**
 * Get VIX checkpoint field names known at or before the given trade time.
 * A checkpoint at time T is considered "known" at time T (the value has printed).
 *
 * Example: tradeTimeHHMM=935 returns ["VIX_0930"] (VIX_1000 is NOT known yet).
 * Example: tradeTimeHHMM=1030 returns ["VIX_0930", "VIX_1000", "VIX_1030"].
 *
 * @param tradeTimeHHMM - Trade entry time as HHMM integer
 * @returns Array of VIX checkpoint column names (e.g., ["VIX_0930", "VIX_1000"])
 */
export function getKnownVixCheckpoints(tradeTimeHHMM: number): string[] {
  return VIX_CHECKPOINTS
    .filter(cp => cp <= tradeTimeHHMM)
    .map(cp => `VIX_${String(cp).padStart(4, '0')}`);
}

// =============================================================================
// Intraday Context Types and Builder
// =============================================================================

/**
 * Per-trade intraday market context with temporal filtering.
 * Only contains checkpoint values that were observable at the trade's entry time.
 */
export interface IntradayContext {
  /** Original timeOpened string from the trade (e.g., "09:35:00") */
  tradeEntryTime: string;
  /** Parsed HHMM integer for programmatic use (e.g., 935) */
  tradeEntryTimeHHMM: number;
  /** SPX intraday checkpoint data, or null if no spx_15min data for this date */
  spx: {
    /** Checkpoints known at entry time (e.g., { P_0930: 5234.50 }) */
    knownCheckpoints: Record<string, number>;
    /** The latest checkpoint at or before entry time, or null if none */
    nearestCheckpoint: { time: string; price: number } | null;
    /** Percent move from day open to nearest checkpoint, or null if unavailable */
    moveFromOpen: number | null;
  } | null;
  /** VIX intraday checkpoint data, or null if no vix_intraday data for this date */
  vix: {
    /** Checkpoints known at entry time (e.g., { VIX_0930: 14.25 }) */
    knownCheckpoints: Record<string, number>;
    /** The latest checkpoint at or before entry time, or null if none */
    nearestCheckpoint: { time: string; value: number } | null;
  } | null;
}

/**
 * Build intraday context for a single trade, filtering checkpoints to only those
 * known at the trade's entry time.
 *
 * Temporal semantics:
 * - A checkpoint at time T is "known" at time T (the price/value has printed)
 * - A trade at 09:35 sees P_0930 (known at 09:30) but NOT P_0945 (known at 09:45)
 * - timeOpened="00:00:00" (default for missing times) results in empty knownCheckpoints
 *   because no market checkpoints exist at or before 00:00
 *
 * @param tradeTimeOpened - Trade's timeOpened string (HH:mm:ss format)
 * @param spxData - Wide-format row from market.spx_15min for the trade date, or null
 * @param vixData - Wide-format row from market.vix_intraday for the trade date, or null
 * @returns IntradayContext with filtered checkpoints, or null if both data sources are null
 */
export function buildIntradayContext(
  tradeTimeOpened: string,
  spxData: Record<string, unknown> | null,
  vixData: Record<string, unknown> | null,
): IntradayContext | null {
  if (!spxData && !vixData) return null;

  const tradeTimeHHMM = parseTimeToHHMM(tradeTimeOpened);

  // Build SPX context
  let spxContext: IntradayContext['spx'] = null;
  if (spxData) {
    const knownCheckpoints: Record<string, number> = {};
    let nearestTime: string | null = null;
    let nearestPrice: number | null = null;

    const knownFields = getKnownSpxCheckpoints(tradeTimeHHMM);
    for (const field of knownFields) {
      const val = spxData[field];
      if (val !== null && val !== undefined) {
        const numVal = typeof val === 'bigint' ? Number(val) : val as number;
        knownCheckpoints[field] = numVal;
        // Track nearest (last in sorted order since checkpoints are ascending)
        nearestTime = field.replace('P_', '');
        nearestPrice = numVal;
      }
    }

    // Compute moveFromOpen: ((nearestPrice - openPrice) / openPrice) * 100
    let moveFromOpen: number | null = null;
    const openVal = spxData['open'];
    if (nearestPrice !== null && openVal !== null && openVal !== undefined) {
      const openPrice = typeof openVal === 'bigint' ? Number(openVal) : openVal as number;
      if (openPrice > 0) {
        moveFromOpen = Math.round(((nearestPrice - openPrice) / openPrice) * 10000) / 100;
      }
    }

    spxContext = {
      knownCheckpoints,
      nearestCheckpoint: nearestPrice !== null ? { time: nearestTime!, price: nearestPrice } : null,
      moveFromOpen,
    };
  }

  // Build VIX context
  let vixContext: IntradayContext['vix'] = null;
  if (vixData) {
    const knownCheckpoints: Record<string, number> = {};
    let nearestTime: string | null = null;
    let nearestValue: number | null = null;

    const knownFields = getKnownVixCheckpoints(tradeTimeHHMM);
    for (const field of knownFields) {
      const val = vixData[field];
      if (val !== null && val !== undefined) {
        const numVal = typeof val === 'bigint' ? Number(val) : val as number;
        knownCheckpoints[field] = numVal;
        nearestTime = field.replace('VIX_', '');
        nearestValue = numVal;
      }
    }

    vixContext = {
      knownCheckpoints,
      nearestCheckpoint: nearestValue !== null ? { time: nearestTime!, value: nearestValue } : null,
    };
  }

  return {
    tradeEntryTime: tradeTimeOpened,
    tradeEntryTimeHHMM: tradeTimeHHMM,
    spx: spxContext,
    vix: vixContext,
  };
}
