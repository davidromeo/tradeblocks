/**
 * QuoteStore — Abstract base for option minute-quote storage.
 *
 * Phase 1 shipped a single-ticker placeholder signature. Plan 02-03 Task 1
 * replaces it in-place with the multi-ticker grouped-series shape that
 * matches the primary consumer pattern: bulk
 * `ticker IN (...) AND date BETWEEN ...` → group-by-ticker. Per CONTEXT.md
 * D-06 / D-08 the signature swap is safe because no Phase 4 consumer has
 * migrated onto the Phase 1 placeholder.
 *
 * All OCC tickers in a single `readQuotes` batch MUST resolve to the same
 * underlying (D-07). Concrete subclasses validate this before issuing SQL and
 * throw clearly when a mixed batch arrives (first-iteration behavior — may
 * relax to transparent grouping if a real Phase 4 consumer needs it).
 *
 * Concrete subclasses (ParquetQuoteStore, DuckdbQuoteStore) ship in Plan
 * 02-03 Task 3.
 */
import type { StoreContext, QuoteRow, CoverageReport } from "./types.js";

export abstract class QuoteStore {
  constructor(protected readonly ctx: StoreContext) {}

  /**
   * Public accessor for the underlying TickerRegistry (WR-03).
   *
   * Several pipeline-side helpers need to resolve OCC roots → underlyings
   * BEFORE they can group calls per-underlying (Pitfall 4 — readQuotes /
   * writeQuotes both enforce single-underlying batches). Exposing the
   * registry through a public getter beats reaching into `store["ctx"]`
   * via bracket notation, which silently bypasses TypeScript's `protected`
   * modifier and creates a hidden coupling to the internal field name.
   */
  public get tickers() {
    return this.ctx.tickers;
  }

  abstract writeQuotes(
    underlying: string,
    date: string,
    quotes: QuoteRow[],
  ): Promise<void>;

  /**
   * Read quotes for a batch of OCC tickers over a date range.
   *
   * All tickers MUST resolve to the same underlying via
   * `extractRoot(...)` + `ctx.tickers.resolve(...)` (validated by the concrete
   * implementation per D-07). Returns a Map keyed by OCC ticker; values are
   * timestamp-sorted arrays of QuoteRow for that contract across the range.
   */
  abstract readQuotes(
    occTickers: string[],
    from: string,
    to: string,
  ): Promise<Map<string, QuoteRow[]>>;

  abstract getCoverage(
    underlying: string,
    from: string,
    to: string,
  ): Promise<CoverageReport>;
}
