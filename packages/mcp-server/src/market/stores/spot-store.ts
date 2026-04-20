/**
 * SpotStore — Abstract base for spot (intraday + daily) bar storage.
 *
 * Phase 1: Signatures only. Phase 2: ParquetSpotStore / DuckdbSpotStore implement these.
 *
 * The `abstract` keyword enforces at compile time that every subclass provides
 * an implementation of all four methods (STORE-05 contract).
 */
import type { StoreContext, BarRow, CoverageReport } from "./types.js";

export abstract class SpotStore {
  constructor(protected readonly ctx: StoreContext) {}

  /**
   * Public accessor for the data directory root (WR-03).
   *
   * Pipeline-side helpers (e.g., `executeFetchPlan`) need the absolute base
   * directory when no explicit `baseDir` is supplied — the flat-import-log
   * JSON adapter writes its dedupe ledger under `{dataDir}/market/.flat-import-log/`.
   * Exposing this through a public getter beats reaching into `store["ctx"]`
   * via bracket notation, which silently bypasses TypeScript's `protected`
   * modifier and creates a hidden coupling to the internal field name.
   */
  public get dataDir(): string {
    return this.ctx.dataDir;
  }

  abstract writeBars(ticker: string, date: string, bars: BarRow[]): Promise<void>;
  abstract readBars(ticker: string, from: string, to: string): Promise<BarRow[]>;
  abstract readDailyBars(ticker: string, from: string, to: string): Promise<BarRow[]>;
  abstract getCoverage(ticker: string, from: string, to: string): Promise<CoverageReport>;
}
