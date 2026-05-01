import type { DuckDBConnection } from "@duckdb/node-api";
import { existsSync } from "fs";
import * as path from "path";
import { resolveMarketDir } from "../db/market-datasets.js";
import { computeFractionalDte } from "./option-time.js";
import {
  describeReadParquetColumns,
  escapeSqlLiteral,
  type GreekColumn,
  quoteParquetGreekProjection,
  quoteParquetMidExpr,
  readParquetFilesSql,
} from "./quote-parquet-projection.js";

export interface OptionQuoteSnapshotRow {
  underlying: string;
  date: string;
  ticker: string;
  time: string;
  contract_type: "call" | "put";
  strike: number;
  expiration: string;
  dte: number;
  bid: number;
  ask: number;
  mid: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  greeks_source: "massive" | "thetadata" | "computed" | null;
  greeks_revision: number | null;
}

export interface OptionQuoteLegFilter {
  contractType: "call" | "put";
  dteMin: number;
  dteMax: number;
  strikeMin?: number;
  strikeMax?: number;
}

export interface ReadOptionQuoteSnapshotsWindowParams {
  conn: DuckDBConnection;
  dataDir: string;
  underlying: string;
  dates: string[];
  timeStart: string;
  timeEnd: string;
  tickers?: string[];
  strikes?: number[];
  strikeMin?: number;
  strikeMax?: number;
  dteMin?: number;
  dteMax?: number;
  contractTypes?: Array<"call" | "put">;
  // Per-leg OR-combined predicates. When provided, replaces the flat
  // dteMin/dteMax/contractTypes/strikeMin/strikeMax path with
  // `(leg1 predicates) OR (leg2 predicates) OR ...`. Each leg's full filter
  // is also applied in JS post-filtering so rows must match at least one leg.
  legFilters?: OptionQuoteLegFilter[];
  // Restricts which greek columns the SQL projects from parquet. Defaults to
  // all five (back-compat). When a subset is passed, unrequested greeks come
  // back as null and DuckDB skips their column chunks at parquet scan time.
  // Use ['delta'] or ['delta','iv'] for candidate-snapshot reads where the
  // downstream consumer does not inspect gamma/theta/vega from snapshot rows.
  neededGreeks?: readonly GreekColumn[];
  perfLabel?: string;
}

export interface OptionQuoteSnapshotLookup {
  date: string;
  time: string;
  strike: number;
  contractType: "call" | "put";
  dteMin: number;
  dteMax: number;
}

function optionQuotePartitionFile(dataDir: string, underlying: string, date: string): string {
  return path.join(
    resolveMarketDir(dataDir),
    "option_quote_minutes",
    `underlying=${underlying}`,
    `date=${date}`,
    "data.parquet",
  );
}

function optionChainPartitionFile(dataDir: string, underlying: string, date: string): string {
  return path.join(
    resolveMarketDir(dataDir),
    "option_chain",
    `underlying=${underlying}`,
    `date=${date}`,
    "data.parquet",
  );
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

function quoteSnapshotLookupJoinKey(
  date: string,
  time: string,
  contractType: OptionQuoteSnapshotLookup["contractType"],
  strike: number,
): string {
  return `${date}|${time.slice(0, 5)}|${contractType}|${Number(strike).toFixed(4)}`;
}

function buildLegPredicateSql(leg: OptionQuoteLegFilter): string {
  const predicates: string[] = [];
  predicates.push(`q.contract_type = '${escapeSqlLiteral(leg.contractType)}'`);
  const minWholeDays = Math.max(0, Math.floor(leg.dteMin) - 1);
  const maxWholeDays = Math.max(minWholeDays, Math.ceil(leg.dteMax));
  const dayDiffExpr = `date_diff('day', CAST(q.date AS DATE), CAST(q.expiration AS DATE))`;
  predicates.push(`${dayDiffExpr} >= ${minWholeDays}`);
  predicates.push(`${dayDiffExpr} <= ${maxWholeDays}`);
  if (leg.strikeMin != null && Number.isFinite(leg.strikeMin)) {
    predicates.push(`q.strike >= ${Number(leg.strikeMin.toFixed(6))}`);
  }
  if (leg.strikeMax != null && Number.isFinite(leg.strikeMax)) {
    predicates.push(`q.strike <= ${Number(leg.strikeMax.toFixed(6))}`);
  }
  return `(${predicates.join(" AND ")})`;
}

function rowMatchesAnyLegFilter(
  legFilters: OptionQuoteLegFilter[],
  contractType: OptionQuoteSnapshotRow["contract_type"],
  strike: number,
  dte: number,
): boolean {
  // Compare floor(dte) against the integer DTE window — mirrors
  // selectDeltaContractFromQuoteSnapshots and selectOffsetContractFromQuoteSnapshots
  // in entry-resolver.ts. Using the raw fractional value excludes rows whose
  // date_diff is exactly dteMax but have a non-zero fractional remainder.
  const dteFloor = Math.max(0, Math.floor(dte));
  for (const leg of legFilters) {
    if (leg.contractType !== contractType) continue;
    if (dteFloor < leg.dteMin || dteFloor > leg.dteMax) continue;
    if (leg.strikeMin != null && strike < leg.strikeMin) continue;
    if (leg.strikeMax != null && strike > leg.strikeMax) continue;
    return true;
  }
  return false;
}

export async function readOptionQuoteSnapshotsWindow(
  params: ReadOptionQuoteSnapshotsWindowParams,
): Promise<Map<string, OptionQuoteSnapshotRow[]>> {
  const {
    conn,
    dataDir,
    underlying,
    dates,
    timeStart,
    timeEnd,
    tickers,
    strikes,
    strikeMin,
    strikeMax,
    dteMin,
    dteMax,
    contractTypes,
    legFilters,
    neededGreeks,
    perfLabel,
  } = params;

  const dateFiles = dates
    .map((date) => ({
      quote: optionQuotePartitionFile(dataDir, underlying, date),
    }))
    .filter(({ quote }) => existsSync(quote));
  const out = new Map<string, OptionQuoteSnapshotRow[]>();
  if (dateFiles.length === 0) return out;

  const filters: string[] = [
    "q.time >= $1",
    "q.time <= $2",
    "q.ask > 0",
    "q.bid >= 0",
  ];
  const bind: Array<string | number> = [timeStart, timeEnd];
  if (tickers && tickers.length > 0) {
    const tickerList = tickers.map((ticker) => `'${escapeSqlLiteral(ticker)}'`).join(", ");
    filters.push(`q.ticker IN (${tickerList})`);
  }
  if (strikes && strikes.length > 0) {
    const strikeList = [...new Set(strikes.map((strike) => Number(strike)).filter(Number.isFinite))]
      .map((strike) => Number(strike.toFixed(6)))
      .join(", ");
    if (strikeList.length > 0) filters.push(`q.strike IN (${strikeList})`);
  }
  const activeLegFilters = legFilters && legFilters.length > 0
    ? legFilters.filter((leg) => Number.isFinite(leg.dteMin) && Number.isFinite(leg.dteMax))
    : [];
  if (activeLegFilters.length > 0) {
    const legClauses = activeLegFilters.map((leg) => buildLegPredicateSql(leg));
    filters.push(`(${legClauses.join(" OR ")})`);
  } else {
    if (contractTypes && contractTypes.length > 0) {
      const typeList = contractTypes.map((type) => `'${escapeSqlLiteral(type)}'`).join(", ");
      filters.push(`q.contract_type IN (${typeList})`);
    }
    if (strikeMin != null && Number.isFinite(strikeMin)) {
      filters.push(`q.strike >= ${Number(strikeMin.toFixed(6))}`);
    }
    if (strikeMax != null && Number.isFinite(strikeMax)) {
      filters.push(`q.strike <= ${Number(strikeMax.toFixed(6))}`);
    }
    if (dteMin != null || dteMax != null) {
      // Coarse SQL pruning keeps long-dated expirations out of the materialized
      // result set. The exact fractional DTE check below remains authoritative
      // because entry time contributes a partial day.
      const minWholeDays = Math.max(0, Math.floor(dteMin ?? 0) - 1);
      const maxWholeDays = Math.max(minWholeDays, Math.ceil(dteMax ?? 3660));
      const dayDiffExpr = `date_diff('day', CAST(q.date AS DATE), CAST(q.expiration AS DATE))`;
      filters.push(`${dayDiffExpr} >= ${minWholeDays}`);
      filters.push(`${dayDiffExpr} <= ${maxWholeDays}`);
    }
  }

  const quoteSource = readParquetFilesSql(dateFiles.map(({ quote }) => quote));
  const quoteColumns = await describeReadParquetColumns(conn, quoteSource);
  const quoteGreekProjection = quoteParquetGreekProjection(quoteColumns, "q", neededGreeks);
  const quoteMidExpr = quoteParquetMidExpr(quoteColumns, "q");
  const perf = process.env.QUOTE_STORE_PERF_DEBUG === "1";
  const queryStart = perf ? Date.now() : 0;
  const reader = await conn.runAndReadAll(
    `WITH parsed_quotes AS (
       SELECT q.*,
              substr(q.ticker, length(q.ticker) - 14, 6) AS expiry_yymmdd,
              substr(q.ticker, length(q.ticker) - 8, 1) AS option_cp,
              try_cast(substr(q.ticker, length(q.ticker) - 7, 8) AS DOUBLE) / 1000 AS strike
         FROM ${quoteSource} AS q
        WHERE length(q.ticker) >= 15
      ),
      quote_meta AS (
       SELECT *,
              CASE option_cp WHEN 'P' THEN 'put' ELSE 'call' END AS contract_type,
              concat(
                '20',
                substr(expiry_yymmdd, 1, 2),
                '-',
                substr(expiry_yymmdd, 3, 2),
                '-',
                substr(expiry_yymmdd, 5, 2)
              ) AS expiration
         FROM parsed_quotes
        WHERE option_cp IN ('C', 'P')
          AND strike IS NOT NULL
      )
     SELECT q.underlying, q.date, q.ticker, q.time,
            q.contract_type, q.strike, q.expiration,
            q.bid, q.ask, ${quoteMidExpr} AS mid,
            ${quoteGreekProjection},
            date_diff('day', CAST(q.date AS DATE), CAST(q.expiration AS DATE)) AS dte_days
       FROM quote_meta AS q
     WHERE ${filters.join(" AND ")}`,
    bind as (string | number | boolean | null | bigint)[],
  );
  const rows = reader.getRows();
  if (perf && perfLabel) {
    console.log(
      `    [P] ${perfLabel} dates=${dateFiles.length} rows=${rows.length} ` +
      `window=${timeStart}-${timeEnd} queryMs=${Date.now() - queryStart}`,
    );
  }

  // Dedup by (ticker,date,time,expiration) was a legacy safety for overlapping
  // date windows. option_quote_minutes is unique per (underlying,date,ticker,time)
  // by construction, and readOptionQuoteSnapshotsWindow scopes by date-partition
  // files + WHERE on time — so duplicates cannot appear unless the same file is
  // listed twice in dateFiles. The filter above already dedups dateFiles.
  for (const row of rows) {
    const date = String(row[1]);
    const time = String(row[3]);
    const contractType = String(row[4]) as OptionQuoteSnapshotRow["contract_type"];
    const strike = Number(row[5]);
    // dte from SQL (integer day count). Every in-JS consumer applies Math.floor()
    // before comparison, so the fractional-time portion that computeFractionalDte
    // used to emit was unused after the DTE envelope checks pushed to SQL.
    const dte = Number(row[17]);
    if (activeLegFilters.length > 0) {
      if (!rowMatchesAnyLegFilter(activeLegFilters, contractType, strike, dte)) continue;
    } else {
      if (dteMin != null && dte < dteMin) continue;
      if (dteMax != null && dte > dteMax) continue;
    }

    const item: OptionQuoteSnapshotRow = {
      underlying: String(row[0]),
      date,
      ticker: String(row[2]),
      time,
      contract_type: contractType,
      strike,
      expiration: String(row[6]),
      dte,
      bid: Number(row[7]),
      ask: Number(row[8]),
      mid: row[9] == null ? (Number(row[7]) + Number(row[8])) / 2 : Number(row[9]),
      delta: row[10] == null ? null : Number(row[10]),
      gamma: row[11] == null ? null : Number(row[11]),
      theta: row[12] == null ? null : Number(row[12]),
      vega: row[13] == null ? null : Number(row[13]),
      iv: row[14] == null ? null : Number(row[14]),
      greeks_source: row[15] == null ? null : String(row[15]) as OptionQuoteSnapshotRow["greeks_source"],
      greeks_revision: row[16] == null ? null : Number(row[16]),
    };
    const bucket = out.get(item.ticker);
    if (bucket) bucket.push(item);
    else out.set(item.ticker, [item]);
  }

  return out;
}

// Ranked SQL helpers (RankedQuoteLegTarget, ReadRankedOptionQuoteSnapshotsWindowParams,
// readRankedOptionQuoteSnapshotsWindow, rankedDeltaColumnAvailable,
// serializeRankedLegTargets) were deleted in Phase 2 Task E2 along with the
// chunk-batch loadCandidateQuoteSnapshots* path that was their only caller.
// The V3 entry pipeline reads quotes per-date through the QuoteStore window
// API (`stores.quote.readWindow`), which doesn't need ranked CTEs.

export async function readOptionQuoteSnapshotsForLookups(params: {
  conn: DuckDBConnection;
  dataDir: string;
  underlying: string;
  lookups: OptionQuoteSnapshotLookup[];
  perfLabel?: string;
  chunkSize?: number;
}): Promise<Map<string, OptionQuoteSnapshotRow[]>> {
  const {
    conn,
    dataDir,
    underlying,
    perfLabel,
    chunkSize = 1000,
  } = params;

  const rangeByJoinKey = new Map<string, Array<{ dteMin: number; dteMax: number }>>();
  const dedupedLookups: OptionQuoteSnapshotLookup[] = [];
  const seenLookupKeys = new Set<string>();
  for (const lookup of params.lookups) {
    const normalizedTime = lookup.time.slice(0, 5);
    const lookupKey = [
      lookup.date,
      normalizedTime,
      lookup.contractType,
      Number(lookup.strike).toFixed(4),
      lookup.dteMin,
      lookup.dteMax,
    ].join("|");
    if (seenLookupKeys.has(lookupKey)) continue;
    seenLookupKeys.add(lookupKey);
    dedupedLookups.push({
      ...lookup,
      time: normalizedTime,
    });
    const joinKey = quoteSnapshotLookupJoinKey(
      lookup.date,
      normalizedTime,
      lookup.contractType,
      lookup.strike,
    );
    const existing = rangeByJoinKey.get(joinKey);
    if (existing) existing.push({ dteMin: lookup.dteMin, dteMax: lookup.dteMax });
    else rangeByJoinKey.set(joinKey, [{ dteMin: lookup.dteMin, dteMax: lookup.dteMax }]);
  }

  const dates = [...new Set(dedupedLookups.map((lookup) => lookup.date))];
  const dateFiles = new Map<string, { quote: string; chain: string }>();
  for (const date of dates) {
    const quote = optionQuotePartitionFile(dataDir, underlying, date);
    const chain = optionChainPartitionFile(dataDir, underlying, date);
    if (existsSync(quote) && existsSync(chain)) {
      dateFiles.set(date, { quote, chain });
    }
  }

  const activeLookups = dedupedLookups.filter((lookup) => dateFiles.has(lookup.date));
  const out = new Map<string, OptionQuoteSnapshotRow[]>();
  if (activeLookups.length === 0) return out;

  const perf = process.env.QUOTE_STORE_PERF_DEBUG === "1";
  const seenRows = new Set<string>();
  let totalSourceRows = 0;
  const start = perf ? Date.now() : 0;

  for (const chunk of chunkValues(activeLookups, chunkSize)) {
    const chunkDates = [...new Set(chunk.map((lookup) => lookup.date))];
    const quoteFilePaths = chunkDates
      .map((date) => dateFiles.get(date)?.quote)
      .filter((value): value is string => Boolean(value));
    const quoteSource = quoteFilePaths.length > 0 ? readParquetFilesSql(quoteFilePaths) : "";
    const chainFiles = chunkDates
      .map((date) => dateFiles.get(date)?.chain)
      .filter((value): value is string => Boolean(value))
      .map((filePath) => `'${escapeSqlLiteral(filePath)}'`)
      .join(", ");
    if (!quoteSource || !chainFiles) continue;
    const quoteColumns = await describeReadParquetColumns(conn, quoteSource);
    const quoteGreekProjection = quoteParquetGreekProjection(quoteColumns, "q");
    const quoteMidExpr = quoteParquetMidExpr(quoteColumns, "q");

    const bind: Array<string | number> = [];
    const valuesSql = chunk.map((lookup) => {
      const base = bind.length;
      bind.push(lookup.date, lookup.time, lookup.contractType, Number(lookup.strike.toFixed(4)));
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    }).join(", ");

    const reader = await conn.runAndReadAll(
      `WITH lookups(date, time5, contract_type, strike) AS (
         VALUES ${valuesSql}
       )
       SELECT DISTINCT
              q.underlying,
              q.date,
              q.ticker,
              substr(q.time, 1, 5) AS time5,
              c.contract_type,
              c.strike,
              c.expiration,
              q.bid,
              q.ask,
              ${quoteMidExpr} AS mid,
              ${quoteGreekProjection}
         FROM ${quoteSource} AS q
         JOIN read_parquet([${chainFiles}], hive_partitioning=true) AS c
           USING (underlying, date, ticker)
         JOIN lookups AS l
           ON q.date = l.date
          AND substr(q.time, 1, 5) = l.time5
          AND c.contract_type = l.contract_type
          AND c.strike = l.strike
        WHERE q.ask > 0
          AND q.bid >= 0
        ORDER BY q.ticker, q.date, time5, c.expiration`,
      bind as (string | number | boolean | null | bigint)[],
    );

    for (const row of reader.getRows()) {
      totalSourceRows++;
      const date = String(row[1]);
      const time = String(row[3]);
      const contractType = String(row[4]) as OptionQuoteSnapshotRow["contract_type"];
      const strike = Number(row[5]);
      const dte = computeFractionalDte(date, time, String(row[6]));
      const dteFloor = Math.max(0, Math.floor(dte));
      const ranges = rangeByJoinKey.get(quoteSnapshotLookupJoinKey(date, time, contractType, strike));
      if (!ranges || !ranges.some((range) => dteFloor >= range.dteMin && dteFloor <= range.dteMax)) {
        continue;
      }

      const item: OptionQuoteSnapshotRow = {
        underlying: String(row[0]),
        date,
        ticker: String(row[2]),
        time,
        contract_type: contractType,
        strike,
        expiration: String(row[6]),
        dte,
        bid: Number(row[7]),
        ask: Number(row[8]),
        mid: row[9] == null ? (Number(row[7]) + Number(row[8])) / 2 : Number(row[9]),
        delta: row[10] == null ? null : Number(row[10]),
        gamma: row[11] == null ? null : Number(row[11]),
        theta: row[12] == null ? null : Number(row[12]),
        vega: row[13] == null ? null : Number(row[13]),
        iv: row[14] == null ? null : Number(row[14]),
        greeks_source: row[15] == null ? null : String(row[15]) as OptionQuoteSnapshotRow["greeks_source"],
        greeks_revision: row[16] == null ? null : Number(row[16]),
      };
      const rowKey = `${item.ticker}|${item.date}|${item.time}|${item.expiration}`;
      if (seenRows.has(rowKey)) continue;
      seenRows.add(rowKey);
      const bucket = out.get(item.ticker);
      if (bucket) bucket.push(item);
      else out.set(item.ticker, [item]);
    }
  }

  if (perf && perfLabel) {
    const matchedRows = [...out.values()].reduce((total, rows) => total + rows.length, 0);
    console.log(
      `    [P] ${perfLabel} lookups=${activeLookups.length} sourceRows=${totalSourceRows} ` +
      `matchedRows=${matchedRows} queryMs=${Date.now() - start}`,
    );
  }

  return out;
}
