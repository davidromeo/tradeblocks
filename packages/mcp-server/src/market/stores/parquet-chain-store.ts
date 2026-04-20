/**
 * ParquetChainStore — option chain snapshots persisted as underlying-first
 * Hive-partitioned Parquet files (option_chain/underlying=X/date=Y/data.parquet).
 *
 * Writes flow through `writeChainPartition` (Phase 1 typed helper); reads use
 * `buildReadChainSQL` against the `market.option_chain` view registered by
 * `createMarketParquetViews`. Coverage via filesystem enumeration (D-26).
 *
 * Note: Phase 3 reorganizes existing `option_chain/date=Y/` directories into
 * `option_chain/underlying=X/date=Y/`. Phase 2 only writes the new layout
 * when the store is called; it does not migrate pre-existing data.
 *
 * D-02 reminder: no method body inspects `ctx.parquetMode`.
 */
import { existsSync } from "fs";
import * as path from "path";
import { ChainStore } from "./chain-store.js";
import type { ContractRow, CoverageReport } from "./types.js";
import { buildReadChainSQL } from "./chain-sql.js";
import { listPartitionValues } from "./coverage.js";
import {
  resolveMarketDir,
  writeChainPartition,
} from "../../db/market-datasets.js";

export class ParquetChainStore extends ChainStore {
  async writeChain(
    underlying: string,
    date: string,
    rows: ContractRow[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const staging = `_chain_write_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await this.ctx.conn.run(
      `CREATE TEMP TABLE "${staging}" (
         underlying VARCHAR, date VARCHAR, ticker VARCHAR,
         contract_type VARCHAR, strike DOUBLE, expiration VARCHAR,
         dte INTEGER, exercise_style VARCHAR
       )`,
    );
    try {
      const placeholders = rows
        .map((_, i) => {
          const b = i * 8;
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`;
        })
        .join(", ");
      const params: unknown[] = rows.flatMap((r) => [
        underlying,
        date,
        r.ticker,
        r.contract_type,
        r.strike,
        r.expiration,
        r.dte ?? null,
        r.exercise_style ?? null,
      ]);
      await this.ctx.conn.run(
        `INSERT INTO "${staging}" VALUES ${placeholders}`,
        params as (string | number | boolean | null | bigint)[],
      );
      await writeChainPartition(this.ctx.conn, {
        dataDir: this.ctx.dataDir,
        underlying,
        date,
        selectQuery: `SELECT * FROM "${staging}"`,
      });
    } finally {
      try {
        await this.ctx.conn.run(`DROP TABLE IF EXISTS "${staging}"`);
      } catch {
        /* best-effort */
      }
    }
  }

  async writeFromSelect(
    partition: { underlying: string; date: string },
    selectSql: string,
  ): Promise<{ rowCount: number }> {
    return writeChainPartition(this.ctx.conn, {
      dataDir: this.ctx.dataDir,
      underlying: partition.underlying,
      date: partition.date,
      selectQuery: selectSql,
    });
  }

  async readChain(
    underlying: string,
    date: string,
  ): Promise<ContractRow[]> {
    const { sql, params } = buildReadChainSQL(underlying, date);
    const reader = await this.ctx.conn.runAndReadAll(
      sql,
      params as (string | number | boolean | null | bigint)[],
    );
    return reader.getRows().map((r) => ({
      underlying: String(r[0]),
      date: String(r[1]),
      ticker: String(r[2]),
      contract_type: String(r[3]) as ContractRow["contract_type"],
      strike: Number(r[4]),
      expiration: String(r[5]),
      dte: Number(r[6]),
      exercise_style: String(r[7]),
    }));
  }

  async getCoverage(
    underlying: string,
    from: string,
    to: string,
  ): Promise<CoverageReport> {
    const dir = path.join(
      resolveMarketDir(this.ctx.dataDir),
      "option_chain",
      `underlying=${underlying}`,
    );
    if (!existsSync(dir)) {
      return { earliest: null, latest: null, missingDates: [], totalDates: 0 };
    }
    const allDates = listPartitionValues(dir, "date");
    const dates = allDates.filter((d) => d >= from && d <= to);
    return {
      earliest: dates[0] ?? null,
      latest: dates[dates.length - 1] ?? null,
      missingDates: [],
      totalDates: dates.length,
    };
  }
}
