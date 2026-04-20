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

  /**
   * Write bars for a single (ticker, date) partition from a user-supplied SELECT.
   *
   * The SELECT must produce columns matching `market.spot`
   * (ticker, date, time, open, high, low, close, bid, ask). Rows are expected
   * to belong to the single partition named in `partition` — the caller is
   * responsible for filtering upstream; mixed partitions are not rejected
   * but will be written to the named partition's location (Parquet) or the
   * single table (DuckDB).
   *
   * Parquet mode: `COPY (select) TO spot/ticker=X/date=Y/data.parquet` via
   * the shared staging-table helper.
   *
   * DuckDB mode: `INSERT OR REPLACE INTO market.spot (cols...) <select>`.
   */
  abstract writeFromSelect(
    partition: { ticker: string; date: string },
    selectSql: string,
  ): Promise<{ rowCount: number }>;

  abstract readBars(ticker: string, from: string, to: string): Promise<BarRow[]>;
  abstract readDailyBars(ticker: string, from: string, to: string): Promise<BarRow[]>;
  abstract getCoverage(ticker: string, from: string, to: string): Promise<CoverageReport>;
}
