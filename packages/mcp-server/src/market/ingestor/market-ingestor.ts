import type { MarketStores } from "../stores/index.js";
import type { MarketDataProvider, BarRow } from "../../utils/market-provider.js";
import { getProvider } from "../../utils/market-provider.js";
import { MassiveProvider } from "../../utils/providers/massive.js";
import { ThetaDataProvider } from "../../utils/providers/thetadata.js";
import { extractRoot } from "../tickers/resolver.js";
import { validateImportSelect } from "../../tools/sql.js";
import type {
  IngestBarsOptions,
  IngestQuotesOptions,
  IngestChainOptions,
  IngestFlatFileOptions,
  ComputeVixContextOptions,
  RefreshOptions,
  IngestResult,
  RefreshResult,
} from "./types.js";

export interface MarketIngestorDeps {
  stores: MarketStores;
  dataRoot: string;
  providerFactory?: () => MarketDataProvider;
}

export class MarketIngestor {
  constructor(private readonly deps: MarketIngestorDeps) {}

  async ingestBars(opts: IngestBarsOptions): Promise<IngestResult> {
    const provider = this.resolveProvider(opts.provider);
    const timespan = opts.timespan ?? "1d";

    if (opts.dryRun) {
      return { status: "skipped", rowsWritten: 0, details: { reason: "dry_run" } };
    }

    let totalRows = 0;
    let minDate: string | undefined;
    let maxDate: string | undefined;

    for (const ticker of opts.tickers) {
      const normalizedTicker = ticker.toUpperCase();
      const bars = await provider.fetchBars({
        ticker: normalizedTicker,
        from: opts.from,
        to: opts.to,
        ...this.timespanToProviderArgs(timespan),
        assetClass: this.detectAssetClass(normalizedTicker),
      });

      if (bars.length === 0) continue;

      const byDate = this.groupBarsByDate(bars);
      for (const [date, dayBars] of byDate) {
        await this.deps.stores.spot.writeBars(normalizedTicker, date, dayBars);
        totalRows += dayBars.length;
        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
      }
    }

    const enrichment = opts.skipEnrichment || !minDate
      ? null
      : await this.triggerPerTickerEnrichment(opts.tickers, minDate, maxDate!);

    return {
      status: "ok",
      rowsWritten: totalRows,
      dateRange: minDate ? { from: minDate, to: maxDate! } : undefined,
      enrichment,
    };
  }

  private resolveProvider(override?: "massive" | "thetadata"): MarketDataProvider {
    // Priority: per-call override > injected factory > env-driven singleton.
    if (override) {
      return override === "thetadata" ? new ThetaDataProvider() : new MassiveProvider();
    }
    if (this.deps.providerFactory) return this.deps.providerFactory();
    return getProvider();
  }

  private timespanToProviderArgs(timespan: string): { timespan: "day" | "minute" | "hour"; multiplier: number } {
    switch (timespan) {
      case "1d": return { timespan: "day", multiplier: 1 };
      case "1m": return { timespan: "minute", multiplier: 1 };
      case "5m": return { timespan: "minute", multiplier: 5 };
      case "15m": return { timespan: "minute", multiplier: 15 };
      case "1h": return { timespan: "hour", multiplier: 1 };
      default: throw new Error(`Unknown timespan: ${timespan}`);
    }
  }

  private detectAssetClass(ticker: string): "stock" | "index" | "option" {
    const VIX_FAMILY = new Set(["VIX", "VIX9D", "VIX3M", "VXN", "SPX", "NDX"]);
    if (VIX_FAMILY.has(ticker)) return "index";
    if (/^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(ticker)) return "option";
    return "stock";
  }

  private groupBarsByDate(bars: BarRow[]): Map<string, BarRow[]> {
    const map = new Map<string, BarRow[]>();
    for (const bar of bars) {
      const list = map.get(bar.date) ?? [];
      list.push(bar);
      map.set(bar.date, list);
    }
    return map;
  }

  private async triggerPerTickerEnrichment(
    tickers: string[],
    from: string,
    to: string,
  ): Promise<{ from: string; to: string }> {
    for (const ticker of tickers) {
      await this.deps.stores.enriched.compute(ticker.toUpperCase(), from, to);
    }
    return { from, to };
  }

  async ingestQuotes(opts: IngestQuotesOptions): Promise<IngestResult> {
    const hasTickers = opts.tickers && opts.tickers.length > 0;
    const hasUnderlyings = opts.underlyings && opts.underlyings.length > 0;
    if (hasTickers === hasUnderlyings) {
      return {
        status: "error",
        rowsWritten: 0,
        error: "ingestQuotes requires exactly one of { tickers, underlyings } to be non-empty",
      };
    }

    const provider = this.resolveProvider(opts.provider);
    const caps = provider.capabilities();

    if (!caps.quotes) {
      return {
        status: "unsupported",
        rowsWritten: 0,
        error: `Provider ${provider.name} does not support quote fetch (capability.quotes=${caps.quotes})`,
      };
    }

    if (opts.dryRun) {
      return { status: "skipped", rowsWritten: 0, details: { reason: "dry_run" } };
    }

    return hasUnderlyings
      ? this.ingestQuotesByUnderlying(provider, opts.underlyings!, opts.from, opts.to)
      : this.ingestQuotesByTicker(provider, opts.tickers!, opts.from, opts.to);
  }

  /**
   * Per-ticker path: one provider call per OCC ticker over the full [from, to]
   * range. Works on any provider that implements `fetchQuotes`. Used by
   * backtesters that already know the exact contracts they care about.
   */
  private async ingestQuotesByTicker(
    provider: MarketDataProvider,
    tickers: string[],
    from: string,
    to: string,
  ): Promise<IngestResult> {
    if (typeof provider.fetchQuotes !== "function") {
      return {
        status: "unsupported",
        rowsWritten: 0,
        error: `Provider ${provider.name} does not implement fetchQuotes (per-ticker path)`,
      };
    }

    let totalRows = 0;
    let minDate: string | undefined;
    let maxDate: string | undefined;

    for (const ticker of tickers) {
      const quotes = await provider.fetchQuotes(ticker, from, to);
      const written = await this.writeQuotesForTicker(ticker, quotes);
      totalRows += written.rowsWritten;
      if (written.minDate && (!minDate || written.minDate < minDate)) minDate = written.minDate;
      if (written.maxDate && (!maxDate || written.maxDate > maxDate)) maxDate = written.maxDate;
    }

    return {
      status: "ok",
      rowsWritten: totalRows,
      dateRange: minDate ? { from: minDate, to: maxDate! } : undefined,
    };
  }

  /**
   * Bulk path: one wildcard call per (underlying, date) returning every
   * contract's minute quotes in a single response. Capability-gated on
   * `bulkByRoot` + presence of `fetchBulkQuotes` — returns `unsupported` on
   * per-ticker-only providers (Massive).
   */
  private async ingestQuotesByUnderlying(
    provider: MarketDataProvider,
    underlyings: string[],
    from: string,
    to: string,
  ): Promise<IngestResult> {
    const caps = provider.capabilities();
    if (!caps.bulkByRoot || typeof provider.fetchBulkQuotes !== "function") {
      return {
        status: "unsupported",
        rowsWritten: 0,
        error: `Provider ${provider.name} does not support bulk-by-underlying quotes (capability.bulkByRoot=${caps.bulkByRoot})`,
      };
    }

    const dates = this.enumerateDates(from, to);
    let totalRows = 0;
    let minDate: string | undefined;
    let maxDate: string | undefined;

    for (const underlying of underlyings) {
      const upperUnderlying = underlying.toUpperCase();
      for (const date of dates) {
        const written = await this.drainBulkQuotes(provider, upperUnderlying, date);
        if (written > 0) {
          totalRows += written;
          if (!minDate || date < minDate) minDate = date;
          if (!maxDate || date > maxDate) maxDate = date;
        }
      }
    }

    return {
      status: "ok",
      rowsWritten: totalRows,
      dateRange: minDate ? { from: minDate, to: maxDate! } : undefined,
    };
  }

  /**
   * Consume the entire bulk-quote stream for one (underlying, date) and write
   * once at the end. Mid-stream flushing is NOT safe here: `writeQuotes` ->
   * `writeParquetAtomic` performs `COPY ... TO '<partitionFile>'` which
   * *overwrites* the partition — splitting one day into multiple writes would
   * leave only the final flush on disk. Peak heap is ~O(rows × row-size) per
   * underlying per day (~700MB for a full SPX day), which matches what the
   * old wildcard-bulk drain script ran at before it was retired.
   */
  private async drainBulkQuotes(
    provider: MarketDataProvider,
    upperUnderlying: string,
    date: string,
  ): Promise<number> {
    // Tickers → resolved underlying mapping is cached per call; the typical
    // case is all contracts mapping to the same underlying (e.g. SPX + SPXW
    // → "SPX"), so the per-underlying bucket is almost always a single key.
    const tickerRegistry = this.deps.stores.quote.tickers;
    const resolvedCache = new Map<string, string>();
    const bucket = new Map<string, Array<{ occ_ticker: string; timestamp: string; bid: number; ask: number }>>();

    const stream = provider.fetchBulkQuotes!({ underlying: upperUnderlying, date });
    for await (const chunk of stream) {
      for (const row of chunk) {
        const root = extractRoot(row.ticker);
        let resolvedUnderlying = resolvedCache.get(root);
        if (resolvedUnderlying === undefined) {
          resolvedUnderlying = tickerRegistry.resolve(root);
          resolvedCache.set(root, resolvedUnderlying);
        }
        let list = bucket.get(resolvedUnderlying);
        if (!list) {
          list = [];
          bucket.set(resolvedUnderlying, list);
        }
        list.push({ occ_ticker: row.ticker, timestamp: row.timestamp, bid: row.bid, ask: row.ask });
      }
    }

    let totalRows = 0;
    for (const [resolvedUnderlying, rows] of bucket) {
      if (rows.length === 0) continue;
      await this.deps.stores.quote.writeQuotes(resolvedUnderlying, date, rows);
      totalRows += rows.length;
    }
    return totalRows;
  }

  private async writeQuotesForTicker(
    ticker: string,
    quotes: Map<string, { bid: number; ask: number }>,
  ): Promise<{ rowsWritten: number; minDate?: string; maxDate?: string }> {
    const root = extractRoot(ticker);
    const underlying = this.deps.stores.quote.tickers.resolve(root);

    const byDate = new Map<string, Array<{ occ_ticker: string; timestamp: string; bid: number; ask: number }>>();
    for (const [key, { bid, ask }] of quotes) {
      const spaceIdx = key.indexOf(" ");
      if (spaceIdx === -1) continue;
      const date = key.slice(0, spaceIdx);
      const list = byDate.get(date) ?? [];
      list.push({ occ_ticker: ticker, timestamp: key, bid, ask });
      byDate.set(date, list);
    }

    let rowsWritten = 0;
    let minDate: string | undefined;
    let maxDate: string | undefined;
    for (const [date, rows] of byDate) {
      await this.deps.stores.quote.writeQuotes(underlying, date, rows);
      rowsWritten += rows.length;
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }
    return { rowsWritten, minDate, maxDate };
  }

  async ingestChain(opts: IngestChainOptions): Promise<IngestResult> {
    const provider = this.resolveProvider(opts.provider);

    if (typeof provider.fetchContractList !== "function") {
      return {
        status: "unsupported",
        rowsWritten: 0,
        error: `Provider ${provider.name} does not support fetchContractList`,
      };
    }

    if (opts.dryRun) {
      return { status: "skipped", rowsWritten: 0, details: { reason: "dry_run" } };
    }

    let totalRows = 0;

    for (const underlying of opts.underlyings) {
      const upperUnderlying = underlying.toUpperCase();
      // Enumerate trading dates in [from, to] and fetch the chain as-of each date.
      const dates = this.enumerateDates(opts.from, opts.to);
      for (const date of dates) {
        const result = await provider.fetchContractList!({
          underlying: upperUnderlying,
          as_of: date,
          expired: true,
        });

        if (result.contracts.length === 0) continue;

        // Map ContractReference → ContractRow (add underlying, date, compute dte).
        const rows = result.contracts.map((c) => ({
          underlying: upperUnderlying,
          date,
          ticker: c.ticker,
          contract_type: c.contract_type,
          strike: c.strike,
          expiration: c.expiration,
          dte: this.computeDte(date, c.expiration),
          exercise_style: c.exercise_style,
        }));

        await this.deps.stores.chain.writeChain(upperUnderlying, date, rows);
        totalRows += rows.length;
      }
    }

    return {
      status: "ok",
      rowsWritten: totalRows,
      dateRange: { from: opts.from, to: opts.to },
    };
  }

  private enumerateDates(from: string, to: string): string[] {
    const dates: string[] = [];
    const current = new Date(`${from}T12:00:00Z`);
    const end = new Date(`${to}T12:00:00Z`);
    while (current <= end) {
      const y = current.getUTCFullYear();
      const m = String(current.getUTCMonth() + 1).padStart(2, "0");
      const d = String(current.getUTCDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
  }

  private computeDte(asOf: string, expiration: string): number {
    const msPerDay = 86_400_000;
    const asOfMs = new Date(`${asOf}T12:00:00Z`).getTime();
    const expMs = new Date(`${expiration}T12:00:00Z`).getTime();
    return Math.max(0, Math.round((expMs - asOfMs) / msPerDay));
  }

  /**
   * Generic flat-file ingest — the LLM is the parser.
   *
   * The caller (typically an LLM that has sniffed the file via run_sql +
   * read_parquet/read_csv and compared columns to describe_database) supplies:
   *   - filePath:    local path to a file DuckDB can read
   *   - datasetType: which store to write to
   *   - selectSql:   a SELECT that produces the store's canonical columns
   *   - partition:   the target (ticker/underlying, date) partition
   *
   * No provider is called — downloads happen beforehand (via the provider's
   * own tools, rclone, or the user pasting a file). The store's writeFromSelect
   * handles mode-routing (Parquet COPY vs DuckDB INSERT) so this dispatch
   * layer stays provider-agnostic and format-agnostic.
   */
  async ingestFlatFile(opts: IngestFlatFileOptions): Promise<IngestResult> {
    const selectError = validateImportSelect(opts.selectSql);
    if (selectError) {
      return { status: "error", rowsWritten: 0, error: selectError };
    }

    if (opts.dryRun) {
      return { status: "skipped", rowsWritten: 0, details: { reason: "dry_run" } };
    }

    const partitionDate = opts.partition.date;
    if (!partitionDate) {
      return { status: "error", rowsWritten: 0, error: "partition.date is required" };
    }

    try {
      switch (opts.datasetType) {
        case "spot_bars": {
          const ticker = opts.partition.ticker;
          if (!ticker) {
            return { status: "error", rowsWritten: 0, error: "partition.ticker is required for datasetType='spot_bars'" };
          }
          const { rowCount } = await this.deps.stores.spot.writeFromSelect(
            { ticker: ticker.toUpperCase(), date: partitionDate },
            opts.selectSql,
          );
          return { status: "ok", rowsWritten: rowCount, dateRange: { from: partitionDate, to: partitionDate } };
        }
        case "option_quotes": {
          const underlying = opts.partition.underlying;
          if (!underlying) {
            return { status: "error", rowsWritten: 0, error: "partition.underlying is required for datasetType='option_quotes'" };
          }
          const { rowCount } = await this.deps.stores.quote.writeFromSelect(
            { underlying: underlying.toUpperCase(), date: partitionDate },
            opts.selectSql,
          );
          return { status: "ok", rowsWritten: rowCount, dateRange: { from: partitionDate, to: partitionDate } };
        }
        case "option_chain": {
          const underlying = opts.partition.underlying;
          if (!underlying) {
            return { status: "error", rowsWritten: 0, error: "partition.underlying is required for datasetType='option_chain'" };
          }
          const { rowCount } = await this.deps.stores.chain.writeFromSelect(
            { underlying: underlying.toUpperCase(), date: partitionDate },
            opts.selectSql,
          );
          return { status: "ok", rowsWritten: rowCount, dateRange: { from: partitionDate, to: partitionDate } };
        }
        default: {
          const _exhaustive: never = opts.datasetType;
          return { status: "error", rowsWritten: 0, error: `Unknown datasetType: ${String(_exhaustive)}` };
        }
      }
    } catch (err) {
      return { status: "error", rowsWritten: 0, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async computeVixContext(opts: ComputeVixContextOptions): Promise<IngestResult> {
    // Pure read-from-cache + compute + write. No provider call.
    await this.deps.stores.enriched.computeContext(opts.from, opts.to);
    return {
      status: "ok",
      rowsWritten: 0,
      dateRange: { from: opts.from, to: opts.to },
    };
  }

  async refresh(opts: RefreshOptions): Promise<RefreshResult> {
    const VIX_FAMILY = new Set(["VIX", "VIX9D", "VIX3M", "VXN"]);
    const computeCtxFlag = opts.computeVixContext ?? true;
    const errors: string[] = [];

    // Step 1 — spot ingest per ticker (asOf = from = to).
    const spotResults: IngestResult[] = [];
    for (const ticker of opts.spotTickers) {
      const result = await this.ingestBars({
        tickers: [ticker],
        from: opts.asOf,
        to: opts.asOf,
        timespan: "1d",
        provider: opts.provider,
      });
      spotResults.push(result);
      if (result.status === "error") errors.push(`spot ${ticker}: ${result.error}`);
    }

    // Step 2 — chain ingest per underlying
    const chainResults: IngestResult[] = [];
    for (const underlying of opts.chainUnderlyings ?? []) {
      const result = await this.ingestChain({
        underlyings: [underlying],
        from: opts.asOf,
        to: opts.asOf,
        provider: opts.provider,
      });
      chainResults.push(result);
      if (result.status === "error") errors.push(`chain ${underlying}: ${result.error}`);
    }

    // Step 3 — quote ingest (single batch — provider handles the list)
    const quoteResults: IngestResult[] = [];
    if (opts.quoteTickers && opts.quoteTickers.length > 0) {
      const result = await this.ingestQuotes({
        tickers: opts.quoteTickers,
        from: opts.asOf,
        to: opts.asOf,
        provider: opts.provider,
      });
      quoteResults.push(result);
      if (result.status === "error") errors.push(`quotes: ${result.error}`);
    }

    // Step 4 — VIX context (only if flag AND any VIX-family ticker in spot list)
    let vixContext: IngestResult | null = null;
    const hasVixFamily = opts.spotTickers.some((t) => VIX_FAMILY.has(t.toUpperCase()));
    if (computeCtxFlag && hasVixFamily) {
      vixContext = await this.computeVixContext({ from: opts.asOf, to: opts.asOf });
      if (vixContext.status === "error") errors.push(`vix context: ${vixContext.error}`);
    }

    // Coverage report — shallow summary per ticker
    const coverage: Record<string, { totalDates: number; dateRange?: { from: string; to: string } }> = {};
    for (const ticker of opts.spotTickers) {
      try {
        const cov = await this.deps.stores.spot.getCoverage(ticker.toUpperCase(), opts.asOf, opts.asOf);
        coverage[ticker] = {
          totalDates: cov.totalDates,
          dateRange: cov.earliest && cov.latest ? { from: cov.earliest, to: cov.latest } : undefined,
        };
      } catch {
        coverage[ticker] = { totalDates: 0 };
      }
    }

    return {
      status: errors.length > 0 ? "error" : "ok",
      perOperation: { spot: spotResults, chain: chainResults, quotes: quoteResults, vixContext },
      coverage,
      errors,
    };
  }
}
