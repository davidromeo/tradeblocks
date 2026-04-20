/**
 * quote-enricher.ts
 *
 * Pure helpers for option-quote enrichment planning.
 *
 * Phase 4 Plan 04-03: the I/O fetch loop (`enrichQuotesForTickers`) and its
 * coverage-probe helper (`fetchExistingCoverage`) were deleted — reads never
 * trigger provider fetches (D-05 / SEP-01).
 *
 * Phase 4 Plan 04-06 (Wave 5): the transitional `enrichQuotesForTickers`
 * throw-stub is now DELETED — every caller routes through
 * `backfillQuotes(stores, ...)` from `utils/quote-backfill.ts`.
 *
 * Surviving public surface (this file):
 *   - shouldSkipEnrichment(barCount, threshold)   pure density check
 *   - buildEnrichmentPlan(input)                  pure planner — groups
 *                                                 (ticker, date) combos
 *                                                 needing enrichment.
 *                                                 Reused by backfillQuotes
 *                                                 (Plan 04-06 / B2 / Path A).
 *   - QuoteEnrichmentResult                       result-shape type — preserved
 *                                                 because internal callers may
 *                                                 still reference it; structurally
 *                                                 identical to BackfillQuotesResult
 *                                                 from quote-backfill.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichmentPlanItem {
  ticker: string;
  date: string;
  existingBarCount: number;
}

/**
 * Result shape returned by the (deleted) `enrichQuotesForTickers` function.
 * Plan 04-06 swapped every call site to `backfillQuotes` whose result type
 * (`BackfillQuotesResult`) is structurally identical. We keep this alias as a
 * stable internal type name; callers may import either.
 */
export interface QuoteEnrichmentResult {
  tickersProcessed: number;
  tickersSkipped: number;  // already dense
  rowsWritten: number;
  errors: Array<{ ticker: string; date: string; error: string }>;
  unsupportedReason?: string;
}

export interface EnrichmentPlanInput {
  tickers: Array<{ ticker: string; fromDate: string; toDate: string }>;
  existingCoverage: Map<string, number>;  // "ticker:date" → barCount
  providerSupportsQuotes: boolean;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Returns true if ticker/date already has dense enough data (>= densityThreshold bars).
 * Default threshold is 200 bars/day — roughly half the 390 market minutes, indicating
 * that quote enrichment has already been applied.
 */
export function shouldSkipEnrichment(barCount: number, densityThreshold = 200): boolean {
  return barCount >= densityThreshold;
}

/**
 * Build a list of ticker+date combos that need enrichment.
 *
 * Rules:
 *   - Returns empty if provider doesn't support quotes
 *   - Returns empty if tickers list is empty
 *   - Expands each ticker's fromDate→toDate range into individual dates
 *   - Skips dates where existing coverage is already dense (>= 200 bars)
 *
 * This is a pure function — no I/O, takes coverage as a pre-fetched Map.
 */
export function buildEnrichmentPlan(input: EnrichmentPlanInput): EnrichmentPlanItem[] {
  if (!input.providerSupportsQuotes) return [];
  if (input.tickers.length === 0) return [];

  const plan: EnrichmentPlanItem[] = [];

  for (const tickerSpec of input.tickers) {
    const dates = expandDateRange(tickerSpec.fromDate, tickerSpec.toDate);
    for (const date of dates) {
      const key = `${tickerSpec.ticker}:${date}`;
      const existingBarCount = input.existingCoverage.get(key) ?? 0;
      if (!shouldSkipEnrichment(existingBarCount)) {
        plan.push({
          ticker: tickerSpec.ticker,
          date,
          existingBarCount,
        });
      }
    }
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Expand a date range into individual YYYY-MM-DD dates (inclusive, calendar days).
 */
function expandDateRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const from = new Date(fromDate + 'T00:00:00Z');
  const to = new Date(toDate + 'T00:00:00Z');
  const current = new Date(from);
  while (current <= to) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Phase 4 Plan 04-06: the `enrichQuotesForTickers` throw-stub from plan 04-03
// is DELETED. Callers were migrated to `backfillQuotes(stores, ...)` from
// `utils/quote-backfill.ts` in this same plan.
// ---------------------------------------------------------------------------
