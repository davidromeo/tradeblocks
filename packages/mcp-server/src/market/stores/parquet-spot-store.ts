/**
 * ParquetSpotStore — spot minute bars persisted as ticker-first Hive-partitioned
 * Parquet files (spot/ticker=X/date=Y/data.parquet).
 *
 * Writes flow through `writeSpotPartition` (Phase 1 typed helper); reads use
 * the shared SQL builders from `./spot-sql.ts` against the `market.spot`
 * view that `createMarketParquetViews` registers when partitions exist.
 * Coverage uses filesystem enumeration via `listPartitionValues` (D-26).
 *
 * D-02 reminder: no method body inspects `ctx.parquetMode` — the factory
 * chooses the backend once at construction and every method is monomorphic.
 */
import { existsSync } from "fs";
import * as path from "path";
import { SpotStore } from "./spot-store.js";
import type { BarRow, CoverageReport } from "./types.js";
import { buildReadBarsSQL, buildReadDailyBarsSQL } from "./spot-sql.js";
import { listPartitionValues } from "./coverage.js";
import {
  resolveMarketDir,
  writeSpotPartition,
} from "../../db/market-datasets.js";

export class ParquetSpotStore extends SpotStore {
  async writeBars(
    ticker: string,
    date: string,
    bars: BarRow[],
  ): Promise<void> {
    if (bars.length === 0) return;
    const staging = `_spot_write_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await this.ctx.conn.run(
      `CREATE TEMP TABLE "${staging}" (
         ticker VARCHAR, date VARCHAR, time VARCHAR,
         open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE,
         bid DOUBLE, ask DOUBLE
       )`,
    );
    try {
      const placeholders = bars
        .map((_, i) => {
          const b = i * 9;
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
        })
        .join(", ");
      const params: unknown[] = bars.flatMap((b) => [
        ticker,
        date,
        b.time ?? "09:30",
        b.open,
        b.high,
        b.low,
        b.close,
        b.bid ?? null,
        b.ask ?? null,
      ]);
      await this.ctx.conn.run(
        `INSERT INTO "${staging}" VALUES ${placeholders}`,
        params as (string | number | boolean | null | bigint)[],
      );
      await writeSpotPartition(this.ctx.conn, {
        dataDir: this.ctx.dataDir,
        ticker,
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

  async readBars(
    ticker: string,
    from: string,
    to: string,
  ): Promise<BarRow[]> {
    const { sql, params } = buildReadBarsSQL(ticker, from, to);
    const reader = await this.ctx.conn.runAndReadAll(
      sql,
      params as (string | number | boolean | null | bigint)[],
    );
    return reader.getRows().map((r) => ({
      ticker: String(r[0]),
      date: String(r[1]),
      time: String(r[2]),
      open: Number(r[3]),
      high: Number(r[4]),
      low: Number(r[5]),
      close: Number(r[6]),
      bid: r[7] == null ? undefined : Number(r[7]),
      ask: r[8] == null ? undefined : Number(r[8]),
      volume: 0,
    }));
  }

  async readDailyBars(
    ticker: string,
    from: string,
    to: string,
  ): Promise<BarRow[]> {
    const { sql, params } = buildReadDailyBarsSQL(ticker, from, to);
    const reader = await this.ctx.conn.runAndReadAll(
      sql,
      params as (string | number | boolean | null | bigint)[],
    );
    return reader.getRows().map((r) => ({
      ticker: String(r[0]),
      date: String(r[1]),
      time: "09:30",
      open: Number(r[2]),
      high: Number(r[3]),
      low: Number(r[4]),
      close: Number(r[5]),
      bid: r[6] == null ? undefined : Number(r[6]),
      ask: r[7] == null ? undefined : Number(r[7]),
      volume: 0,
    }));
  }

  async getCoverage(
    ticker: string,
    from: string,
    to: string,
  ): Promise<CoverageReport> {
    const tickerDir = path.join(
      resolveMarketDir(this.ctx.dataDir),
      "spot",
      `ticker=${ticker}`,
    );
    if (!existsSync(tickerDir)) {
      return { earliest: null, latest: null, missingDates: [], totalDates: 0 };
    }
    const allDates = listPartitionValues(tickerDir, "date");
    const dates = allDates.filter((d) => d >= from && d <= to);
    return {
      earliest: dates[0] ?? null,
      latest: dates[dates.length - 1] ?? null,
      missingDates: [],
      totalDates: dates.length,
    };
  }
}
