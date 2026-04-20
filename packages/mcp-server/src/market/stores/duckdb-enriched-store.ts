/**
 * DuckdbEnrichedStore — thin wrapper over the existing `market-enricher.ts`
 * runEnrichment pipeline (D-14 / D-15) for the DuckDB physical-table backend.
 *
 * Reads share the SAME SQL as ParquetEnrichedStore because the
 * `market.enriched` identifier resolves to the physical table in this mode
 * and to the Parquet view in the other (CONTEXT.md D-04). The write path
 * (compute/computeContext) injects SpotStore + the watermark adapter into
 * the enricher; the math stays in `market-enricher.ts`.
 *
 * D-02 reminder: no method body inspects `ctx.parquetMode`.
 */
import { EnrichedStore, type EnrichedReadOpts } from "./enriched-store.js";
import { SpotStore } from "./spot-store.js";
import type { StoreContext, CoverageReport } from "./types.js";
import { buildReadEnrichedSQL } from "./enriched-sql.js";
import { runEnrichment } from "../../utils/market-enricher.js";
import {
  getEnrichedThrough,
  upsertEnrichedThrough,
} from "../../db/json-adapters.js";

export class DuckdbEnrichedStore extends EnrichedStore {
  constructor(
    ctx: StoreContext,
    private readonly spotStore: SpotStore,
  ) {
    super(ctx);
  }

  async compute(ticker: string, _from: string, _to: string): Promise<void> {
    await runEnrichment(
      this.ctx.conn,
      ticker,
      { dataDir: this.ctx.dataDir },
      {
        spotStore: this.spotStore,
        watermarkStore: {
          get: (t) => getEnrichedThrough(t, this.ctx.dataDir),
          upsert: (t, v) => upsertEnrichedThrough(t, v, this.ctx.dataDir),
        },
      },
    );
  }

  async computeContext(_from: string, _to: string): Promise<void> {
    for (const ticker of ["VIX", "VIX9D", "VIX3M"]) {
      await runEnrichment(
        this.ctx.conn,
        ticker,
        { dataDir: this.ctx.dataDir },
        {
          spotStore: this.spotStore,
          watermarkStore: {
            get: (t) => getEnrichedThrough(t, this.ctx.dataDir),
            upsert: (t, v) => upsertEnrichedThrough(t, v, this.ctx.dataDir),
          },
        },
      );
    }
  }

  async read(opts: EnrichedReadOpts): Promise<Record<string, unknown>[]> {
    const { sql, params } = buildReadEnrichedSQL({
      ticker: opts.ticker,
      from: opts.from,
      to: opts.to,
      includeContext: !!opts.includeContext,
      includeOhlcv: !!opts.includeOhlcv,
    });
    const reader = await this.ctx.conn.runAndReadAll(
      sql,
      params as (string | number | boolean | null | bigint)[],
    );
    const names = reader.columnNames();
    return reader
      .getRows()
      .map((row) =>
        Object.fromEntries(names.map((n, i) => [n, row[i]])),
      );
  }

  async getCoverage(ticker: string): Promise<CoverageReport> {
    // D-27: coverage answers "what rows exist" directly from the enriched
    // table — not from the watermark JSON.
    const reader = await this.ctx.conn.runAndReadAll(
      `SELECT DISTINCT date FROM market.enriched WHERE ticker = $1 ORDER BY date`,
      [ticker],
    );
    const dates = reader.getRows().map((r) => String(r[0]));
    return {
      earliest: dates[0] ?? null,
      latest: dates[dates.length - 1] ?? null,
      missingDates: [],
      totalDates: dates.length,
    };
  }
}
