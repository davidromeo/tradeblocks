/**
 * DuckdbQuoteStore — option minute NBBO quotes persisted as DuckDB physical
 * table `market.option_quote_minutes`. Phase 1 D-12 / Pitfall 1 executed a
 * DROP+recreate with `underlying` as the first key; the Phase 1 schema already
 * has the correct shape.
 *
 * Writes via `INSERT OR REPLACE INTO market.option_quote_minutes` with
 * positional placeholders; reads via the shared buildReadQuotesSQL that
 * filters on `underlying = $1`. Coverage via SELECT DISTINCT.
 *
 * D-02 reminder: no method body inspects `ctx.parquetMode`.
 */
import { QuoteStore } from "./quote-store.js";
import type { QuoteRow, CoverageReport } from "./types.js";
import { buildReadQuotesSQL } from "./quote-sql.js";
import { extractRoot } from "../tickers/resolver.js";

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export class DuckdbQuoteStore extends QuoteStore {
  async writeQuotes(
    underlying: string,
    date: string,
    quotes: QuoteRow[],
  ): Promise<void> {
    if (quotes.length === 0) return;
    const placeholders = quotes
      .map((_, i) => {
        const b = i * 9;
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
      })
      .join(", ");
    const params: unknown[] = quotes.flatMap((q) => {
      const [qdate, qtime] = q.timestamp.split(" ");
      const mid = (q.bid + q.ask) / 2;
      return [
        underlying,
        qdate ?? date,
        q.occ_ticker,
        qtime ?? "09:30",
        q.bid,
        q.ask,
        mid,
        null,
        null,
      ];
    });
    await this.ctx.conn.run(
      `INSERT OR REPLACE INTO market.option_quote_minutes
         (underlying, date, ticker, time, bid, ask, mid, last_updated_ns, source)
       VALUES ${placeholders}`,
      params as (string | number | boolean | null | bigint)[],
    );
  }

  async writeFromSelect(
    _partition: { underlying: string; date: string },
    selectSql: string,
  ): Promise<{ rowCount: number }> {
    const result = await this.ctx.conn.run(
      `INSERT OR REPLACE INTO market.option_quote_minutes
         (underlying, date, ticker, time, bid, ask, mid, last_updated_ns, source)
       ${selectSql}`,
    );
    return { rowCount: Number(result.rowsChanged) };
  }

  async readQuotes(
    occTickers: string[],
    from: string,
    to: string,
  ): Promise<Map<string, QuoteRow[]>> {
    if (occTickers.length === 0) return new Map();
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

  override async readQuotesBulk(
    tickersByDate: Map<string, Set<string>>,
    timeStart: string,
    timeEnd: string,
  ): Promise<Map<string, QuoteRow[]>> {
    const out = new Map<string, QuoteRow[]>();
    if (tickersByDate.size === 0) return out;

    const perf = process.env.MARKET_PERF_DEBUG === "1";

    for (const [underlying, perDate] of this.groupTickersByUnderlying(tickersByDate)) {
      const occUnion = new Set<string>();
      const wantedPairs: string[] = [];

      for (const [date, occs] of perDate) {
        if (occs.size === 0) continue;
        for (const occ of occs) {
          occUnion.add(occ);
          wantedPairs.push(`('${escapeSqlLiteral(date)}', '${escapeSqlLiteral(occ)}')`);
        }
      }

      if (wantedPairs.length === 0) continue;

      const sql = `WITH wanted(date, ticker) AS (
                     VALUES ${wantedPairs.join(", ")}
                   )
                   SELECT q.ticker, q.date, q.time, q.bid, q.ask
                   FROM market.option_quote_minutes AS q
                   JOIN wanted AS w
                     ON q.date = w.date AND q.ticker = w.ticker
                   WHERE q.underlying = $1
                     AND q.time >= $2 AND q.time <= $3
                   ORDER BY q.ticker, q.date, q.time`;

      const queryStart = perf ? Date.now() : 0;
      const reader = await this.ctx.conn.runAndReadAll(
        sql,
        [underlying, timeStart, timeEnd] as (string | number | boolean | null | bigint)[],
      );
      const rows = reader.getRows();
      if (perf) {
        console.log(
          `    [P] readQuotesBulk underlying=${underlying} dates=${perDate.size} ` +
          `tickers=${occUnion.size} rows=${rows.length} queryMs=${Date.now() - queryStart}`,
        );
      }
      for (const row of rows) {
        const occ = String(row[0]);
        const date = String(row[1]);
        const time = String(row[2]);
        const quote: QuoteRow = {
          occ_ticker: occ,
          timestamp: `${date} ${time}`,
          bid: Number(row[3]),
          ask: Number(row[4]),
        };
        const bucket = out.get(occ);
        if (bucket) bucket.push(quote);
        else out.set(occ, [quote]);
      }
    }

    return out;
  }

  async getCoverage(
    underlying: string,
    from: string,
    to: string,
  ): Promise<CoverageReport> {
    const reader = await this.ctx.conn.runAndReadAll(
      `SELECT DISTINCT date FROM market.option_quote_minutes
         WHERE underlying = $1 AND date >= $2 AND date <= $3
         ORDER BY date`,
      [underlying, from, to],
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
