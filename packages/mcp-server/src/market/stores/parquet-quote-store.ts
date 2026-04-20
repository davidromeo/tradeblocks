/**
 * ParquetQuoteStore — option minute NBBO quotes persisted as underlying-first
 * Hive-partitioned Parquet files
 * (option_quote_minutes/underlying=X/date=Y/data.parquet).
 *
 * D-06 / D-08: readQuotes accepts a batch of OCC tickers plus a date range and
 * returns Map<occTicker, QuoteRow[]> with timestamp-sorted values per
 * contract. Matches the primary multi-ticker consumer pattern (bulk
 * `ticker IN (...) AND date BETWEEN ...` → group-by-ticker).
 *
 * D-07 / Pitfall 4: all OCC tickers in a single call MUST resolve to the same
 * underlying. First-iteration behavior is to throw a clear error naming both
 * conflicting tickers — consumers must group reads by underlying themselves.
 *
 * D-02 reminder: no method body inspects `ctx.parquetMode`.
 */
import { existsSync } from "fs";
import * as path from "path";
import { QuoteStore } from "./quote-store.js";
import type { QuoteRow, CoverageReport } from "./types.js";
import { buildReadQuotesSQL } from "./quote-sql.js";
import { listPartitionValues } from "./coverage.js";
import {
  resolveMarketDir,
  writeQuoteMinutesPartition,
} from "../../db/market-datasets.js";
import { extractRoot } from "../tickers/resolver.js";

export class ParquetQuoteStore extends QuoteStore {
  async writeQuotes(
    underlying: string,
    date: string,
    quotes: QuoteRow[],
  ): Promise<void> {
    if (quotes.length === 0) return;
    // Append rows via DuckDBAppender (typed per-column, no SQL parse overhead)
    // rather than a parameterized INSERT with O(N) placeholders — the latter
    // forces DuckDB to parse a multi-megabyte SQL statement before a single
    // row lands, which was the dominant wall-clock cost on a 5M-row SPX day.
    const staging = `_quote_write_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await this.ctx.conn.run(
      `CREATE TEMP TABLE "${staging}" (
         underlying VARCHAR, date VARCHAR, ticker VARCHAR, time VARCHAR,
         bid DOUBLE, ask DOUBLE, mid DOUBLE,
         last_updated_ns BIGINT, source VARCHAR
       )`,
    );
    try {
      const appender = await this.ctx.conn.createAppender(staging);
      try {
        for (const q of quotes) {
          // QuoteRow.timestamp is "YYYY-MM-DD HH:MM" — split into date/time.
          // If the timestamp omits the time (legacy producers), default to 09:30.
          const spaceIdx = q.timestamp.indexOf(" ");
          const qdate = spaceIdx === -1 ? date : q.timestamp.slice(0, spaceIdx);
          const qtime = spaceIdx === -1 ? "09:30" : q.timestamp.slice(spaceIdx + 1);
          appender.appendVarchar(underlying);
          appender.appendVarchar(qdate);
          appender.appendVarchar(q.occ_ticker);
          appender.appendVarchar(qtime);
          appender.appendDouble(q.bid);
          appender.appendDouble(q.ask);
          appender.appendDouble((q.bid + q.ask) / 2);
          appender.appendNull(); // last_updated_ns — not tracked in QuoteRow
          appender.appendNull(); // source — not tracked
          appender.endRow();
        }
        appender.flushSync();
      } finally {
        appender.closeSync();
      }
      await writeQuoteMinutesPartition(this.ctx.conn, {
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

  async readQuotes(
    occTickers: string[],
    from: string,
    to: string,
  ): Promise<Map<string, QuoteRow[]>> {
    if (occTickers.length === 0) return new Map();
    // D-07: validate all tickers resolve to the same underlying BEFORE any SQL
    // runs. A mixed batch is almost always a bug in the caller; surface it
    // with both conflicting OCC tickers + resolved underlyings for debugging.
    const firstUnderlying = this.ctx.tickers.resolve(
      extractRoot(occTickers[0]),
    );
    for (const t of occTickers) {
      const u = this.ctx.tickers.resolve(extractRoot(t));
      if (u !== firstUnderlying) {
        throw new Error(
          `QuoteStore.readQuotes: mixed underlyings in batch — ` +
            `${occTickers[0]} resolves to ${firstUnderlying}, ${t} resolves to ${u}. ` +
            `Consumers must group reads by underlying.`,
        );
      }
    }
    const { sql, params } = buildReadQuotesSQL(
      firstUnderlying,
      occTickers,
      from,
      to,
    );
    const reader = await this.ctx.conn.runAndReadAll(
      sql,
      params as (string | number | boolean | null | bigint)[],
    );
    const out = new Map<string, QuoteRow[]>();
    // Builder projects: ticker, date, time, bid, ask, mid, last_updated_ns
    for (const row of reader.getRows()) {
      const occ = String(row[0]);
      const date = String(row[1]);
      const time = String(row[2]);
      const qr: QuoteRow = {
        occ_ticker: occ,
        timestamp: `${date} ${time}`,
        bid: Number(row[3]),
        ask: Number(row[4]),
      };
      let arr = out.get(occ);
      if (!arr) {
        arr = [];
        out.set(occ, arr);
      }
      arr.push(qr);
    }
    return out;
  }

  async getCoverage(
    underlying: string,
    from: string,
    to: string,
  ): Promise<CoverageReport> {
    const dir = path.join(
      resolveMarketDir(this.ctx.dataDir),
      "option_quote_minutes",
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
