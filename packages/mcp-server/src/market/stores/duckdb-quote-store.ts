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
