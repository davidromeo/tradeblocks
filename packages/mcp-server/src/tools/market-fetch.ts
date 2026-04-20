// packages/mcp-server/src/tools/market-fetch.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { upgradeToReadWrite, downgradeToReadOnly } from "../db/connection.js";
import { MarketIngestor } from "../market/ingestor/index.js";
import type { MarketStores } from "../market/stores/index.js";
import { createToolOutput } from "../utils/output-formatter.js";

export function registerMarketFetchTools(
  server: McpServer,
  baseDir: string,
  stores: MarketStores,
): void {
  const ingestor = new MarketIngestor({ stores, dataRoot: baseDir });

  // fetch_bars
  server.registerTool(
    "fetch_bars",
    {
      description:
        "Fetch OHLCV bars for one or more tickers over a date range. " +
        "Uses the active market data provider (env MARKET_DATA_PROVIDER, default 'massive'; override per call via 'provider'). " +
        "Timespan selects granularity: '1d' = daily (default), '1m'/'5m'/'15m'/'1h' = intraday. " +
        "Writes to market.spot. Auto-runs per-ticker enrichment (RSI, ATR, EMA, etc.) after write — set skip_enrichment=true to disable. " +
        "Capabilities: both Massive and ThetaData support bar fetching. Massive index bars available from 2023-02-14; ThetaData has no declared floor.",
      inputSchema: z.object({
        tickers: z.array(z.string()).min(1).describe("Ticker symbols (e.g., ['SPX','VIX'])"),
        from: z.string().describe("Start date YYYY-MM-DD"),
        to: z.string().describe("End date YYYY-MM-DD"),
        timespan: z.enum(["1d", "1m", "5m", "15m", "1h"]).default("1d")
          .describe("Bar granularity. '1d' = daily; others = intraday."),
        provider: z.enum(["massive", "thetadata"]).optional()
          .describe("Optional per-call provider override. Defaults to env MARKET_DATA_PROVIDER."),
        skip_enrichment: z.boolean().default(false)
          .describe("Skip per-ticker enrichment (RSI/ATR/etc.) after write."),
        dry_run: z.boolean().default(false)
          .describe("Validate inputs and preview without writing."),
      }),
    },
    async ({ tickers, from, to, timespan, provider, skip_enrichment, dry_run }) => {
      await upgradeToReadWrite(baseDir);
      try {
        const result = await ingestor.ingestBars({
          tickers,
          from,
          to,
          timespan,
          provider,
          skipEnrichment: skip_enrichment,
          dryRun: dry_run,
        });
        const summary = dry_run
          ? `[DRY RUN] Would fetch bars for ${tickers.length} ticker(s)`
          : `${result.status}: wrote ${result.rowsWritten} bars for ${tickers.join(", ")}` +
            (result.dateRange ? ` (${result.dateRange.from} \u2192 ${result.dateRange.to})` : "");
        return createToolOutput(summary, result);
      } finally {
        await downgradeToReadOnly(baseDir);
      }
    },
  );

  // fetch_quotes
  server.registerTool(
    "fetch_quotes",
    {
      description:
        "Fetch NBBO minute-level option quotes. Two modes — pass EITHER 'tickers' (specific OCC contracts, per-ticker provider calls) OR 'underlyings' (every contract under a symbol, one wildcard call per (root, right) per date — ThetaData only). " +
        "Bulk mode collapses thousands of per-contract fetches to ~4 wire requests per SPX day; use it whenever you want full-chain coverage. " +
        "Writes to market.option_quote_minutes. Capability-gated: ThetaData supports both modes; Massive requires MASSIVE_DATA_TIER=quotes for the per-ticker mode and does not support bulk mode. " +
        "Returns status='unsupported' with a clear error when the active provider lacks the requested mode.",
      inputSchema: z.object({
        tickers: z.array(z.string()).min(1).optional()
          .describe("Option tickers in OCC format (e.g., 'SPXW260321C05800000'). No O: prefix. Mutually exclusive with 'underlyings'."),
        underlyings: z.array(z.string()).min(1).optional()
          .describe("Underlying symbols (e.g. ['SPX']). Bulk mode — returns every contract's minute quotes per date. Mutually exclusive with 'tickers'."),
        from: z.string().describe("Start date YYYY-MM-DD"),
        to: z.string().describe("End date YYYY-MM-DD"),
        provider: z.enum(["massive", "thetadata"]).optional(),
        dry_run: z.boolean().default(false),
      }),
    },
    async ({ tickers, underlyings, from, to, provider, dry_run }) => {
      await upgradeToReadWrite(baseDir);
      try {
        const result = await ingestor.ingestQuotes({
          tickers, underlyings, from, to, provider, dryRun: dry_run,
        });
        const mode = underlyings ? `bulk (${underlyings.join(",")})` : `per-ticker (${tickers?.length ?? 0})`;
        const summary =
          result.status === "unsupported" ? `Unsupported: ${result.error}` :
          result.status === "error" ? `Error: ${result.error}` :
          dry_run ? `[DRY RUN] Would fetch quotes: ${mode}` :
          `${result.status}: wrote ${result.rowsWritten} quote rows (${mode})`;
        return createToolOutput(summary, result);
      } finally {
        await downgradeToReadOnly(baseDir);
      }
    },
  );

  // fetch_chain
  server.registerTool(
    "fetch_chain",
    {
      description:
        "Fetch the historical option contract list for one or more underlyings over a date range. " +
        "Writes contract metadata to market.option_chain. Capability-gated on provider.fetchContractList. " +
        "Use for pre-populating the contract universe before running backtests or enriching quotes.",
      inputSchema: z.object({
        underlyings: z.array(z.string()).min(1).describe("Underlying tickers (e.g., ['SPX','QQQ'])"),
        from: z.string().describe("Start date YYYY-MM-DD"),
        to: z.string().describe("End date YYYY-MM-DD"),
        provider: z.enum(["massive", "thetadata"]).optional(),
        dry_run: z.boolean().default(false),
      }),
    },
    async ({ underlyings, from, to, provider, dry_run }) => {
      await upgradeToReadWrite(baseDir);
      try {
        const result = await ingestor.ingestChain({ underlyings, from, to, provider, dryRun: dry_run });
        const summary =
          result.status === "unsupported" ? `Unsupported: ${result.error}` :
          dry_run ? `[DRY RUN] Would fetch chain for ${underlyings.join(", ")}` :
          `${result.status}: wrote ${result.rowsWritten} contract rows`;
        return createToolOutput(summary, result);
      } finally {
        await downgradeToReadOnly(baseDir);
      }
    },
  );

  // import_flat_file
  server.registerTool(
    "import_flat_file",
    {
      description:
        "Bulk-import a single day of minute bars from a flat-file provider (Massive S3). " +
        "Much faster than per-ticker API calls for a full day of option bars. " +
        "Capability-gated: only Massive supports flat files. ThetaData returns status='unsupported'. " +
        "For multi-day imports, call this repeatedly (caller iterates).",
      inputSchema: z.object({
        date: z.string().describe("Trading date YYYY-MM-DD"),
        asset_class: z.enum(["option", "index"]).describe(
          "'option' for OPRA option bars, 'index' for us_indices bars (VIX, VIX9D, SPX)",
        ),
        underlying: z.string().describe("Underlying ticker to filter for (e.g., 'SPX')"),
        provider: z.enum(["massive"]).optional()
          .describe("Must be 'massive' or omitted — other providers unsupported."),
        dry_run: z.boolean().default(false),
      }),
    },
    async ({ date, asset_class, underlying, provider, dry_run }) => {
      await upgradeToReadWrite(baseDir);
      try {
        const result = await ingestor.ingestFlatFile({
          date, assetClass: asset_class, underlying, provider, dryRun: dry_run,
        });
        const summary =
          result.status === "unsupported" ? `Unsupported: ${result.error}` :
          dry_run ? `[DRY RUN] Would import ${asset_class} bars for ${underlying} on ${date}` :
          `${result.status}: imported ${result.rowsWritten} bars`;
        return createToolOutput(summary, result);
      } finally {
        await downgradeToReadOnly(baseDir);
      }
    },
  );

  // compute_vix_context
  server.registerTool(
    "compute_vix_context",
    {
      description:
        "Compute cross-ticker VIX context enrichment (Vol_Regime, Term_Structure_State, VIX ratios, etc.) for a date range. " +
        "Reads already-enriched VIX/VIX9D/VIX3M data from market.enriched; writes to market.enriched_context. " +
        "Call this AFTER ingesting all three VIX-family tickers for the date range — firing on incomplete data produces wrong values silently. " +
        "No provider call — pure read-compute-write.",
      inputSchema: z.object({
        from: z.string().describe("Start date YYYY-MM-DD"),
        to: z.string().describe("End date YYYY-MM-DD"),
      }),
    },
    async ({ from, to }) => {
      await upgradeToReadWrite(baseDir);
      try {
        const result = await ingestor.computeVixContext({ from, to });
        return createToolOutput(
          `${result.status}: computed VIX context for ${from} \u2192 ${to}`,
          result,
        );
      } finally {
        await downgradeToReadOnly(baseDir);
      }
    },
  );

  // refresh_market_data
  server.registerTool(
    "refresh_market_data",
    {
      description:
        "Composite daily-refresh driver. Calls fetch_bars \u2192 fetch_chain \u2192 fetch_quotes \u2192 compute_vix_context for a caller-supplied universe, then returns coverage report. " +
        "Intended for scheduled jobs (cron, /schedule skill, etc.) that populate the cache nightly with yesterday's data. " +
        "compute_vix_context auto-fires when any VIX-family ticker is in spot_tickers and compute_vix_context flag is true (default). " +
        "Per-operation errors surface in the result's 'errors' array — safe to monitor/alert on.",
      inputSchema: z.object({
        asOf: z.string().describe("Target date YYYY-MM-DD. Typically yesterday."),
        spot_tickers: z.array(z.string()).min(1).describe("Tickers to fetch daily bars for"),
        chain_underlyings: z.array(z.string()).optional().describe("Underlyings to fetch option chains for"),
        quote_tickers: z.array(z.string()).optional().describe("Option tickers to fetch minute quotes for"),
        compute_vix_context: z.boolean().default(true).describe(
          "If true and any VIX-family ticker is in spot_tickers, runs compute_vix_context at the end. Default true.",
        ),
        provider: z.enum(["massive", "thetadata"]).optional(),
      }),
    },
    async ({ asOf, spot_tickers, chain_underlyings, quote_tickers, compute_vix_context, provider }) => {
      await upgradeToReadWrite(baseDir);
      try {
        const result = await ingestor.refresh({
          asOf,
          spotTickers: spot_tickers,
          chainUnderlyings: chain_underlyings,
          quoteTickers: quote_tickers,
          computeVixContext: compute_vix_context,
          provider,
        });
        const summary =
          result.status === "error"
            ? `Refresh completed with ${result.errors.length} error(s): ${result.errors.join("; ")}`
            : `Refresh complete for ${asOf}: ${result.perOperation.spot.length} spot, ${result.perOperation.chain.length} chain, ${result.perOperation.quotes.length} quote operation(s)`;
        return createToolOutput(summary, result);
      } finally {
        await downgradeToReadOnly(baseDir);
      }
    },
  );
}
