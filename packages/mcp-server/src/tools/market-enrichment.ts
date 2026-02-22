/**
 * Market Enrichment Tools
 *
 * MCP tool for computing technical indicator fields from raw OHLCV data in
 * market.daily and VIX context fields in market.context.
 *
 * Tools registered:
 *   - enrich_market_data — Run three-tier enrichment pipeline for a ticker
 *
 * Follows the RW lifecycle:
 *   upgradeToReadWrite → enrichment → downgradeToReadOnly (in finally)
 *
 * Tier 1: Computes ~22 fields from market.daily OHLCV (RSI, ATR, EMA, SMA, BB, realized vol, etc.)
 * Tier 2: Computes VIX regime fields in market.context (Vol_Regime, Term_Structure_State, VIX_Percentile, etc.)
 * Tier 3: Intraday timing fields (High_Time, Low_Time, Reversal_Type) — always skipped until intraday CSV format is updated
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConnection, upgradeToReadWrite, downgradeToReadOnly } from "../db/connection.js";
import { createToolOutput } from "../utils/output-formatter.js";
import { runEnrichment } from "../utils/market-enricher.js";

/**
 * Register market enrichment MCP tools on the given server.
 *
 * @param server  - McpServer instance to register tools on
 * @param baseDir - Base data directory (passed to connection helpers)
 */
export function registerMarketEnrichmentTools(server: McpServer, baseDir: string): void {
  server.registerTool(
    "enrich_market_data",
    {
      description:
        "Compute technical indicator fields from raw OHLCV data in market.daily and VIX regime fields in market.context. " +
        "Runs three enrichment tiers: " +
        "Tier 1 (always) computes ~22 fields from daily OHLCV: RSI_14, ATR_Pct, Price_vs_EMA21_Pct, Price_vs_SMA50_Pct, Trend_Score, BB_Position, BB_Width, Realized_Vol_5D, Realized_Vol_20D, Return_5D, Return_20D, Gap_Pct, Intraday_Range_Pct, Intraday_Return_Pct, Close_Position_In_Range, Gap_Filled, Consecutive_Days, Prev_Return_Pct, Prior_Close, Day_of_Week, Month, Is_Opex. " +
        "Tier 2 (if VIX data in market.context) computes VIX regime fields: Vol_Regime, Term_Structure_State, VIX_Percentile, VIX_Gap_Pct, VIX_Change_Pct, VIX ratios, VIX_Spike_Pct. " +
        "Tier 3 (if intraday bars in market.intraday) computes timing fields. Currently always skipped — intraday data format update required. " +
        "Uses 200-day lookback window for Wilder smoothing warmup. Tracks enriched_through watermark in market._sync_metadata. " +
        "Call after import_market_csv or import_from_database to populate computed fields. " +
        "Use force_full=true to recompute all rows from scratch (needed after formula changes).",
      inputSchema: z.object({
        ticker: z
          .string()
          .describe(
            "Ticker symbol to enrich (e.g., 'SPX', 'QQQ'). Must match an existing ticker in market.daily."
          ),
        force_full: z
          .boolean()
          .default(false)
          .describe(
            "If true, clears the enriched_through watermark and recomputes all rows from scratch. " +
            "Use when indicator formulas have changed or you suspect drift."
          ),
      }),
    },
    async ({ ticker, force_full }) => {
      await upgradeToReadWrite(baseDir);
      try {
        const conn = await getConnection(baseDir);
        const result = await runEnrichment(conn, ticker, { forceFull: force_full });

        const tierSummary = [
          `Tier 1 (daily indicators): ${result.tier1.status}${result.tier1.fieldsWritten !== undefined ? ` (${result.tier1.fieldsWritten} fields)` : ""}${result.tier1.reason ? ` — ${result.tier1.reason}` : ""}`,
          `Tier 2 (VIX regime): ${result.tier2.status}${result.tier2.fieldsWritten !== undefined ? ` (${result.tier2.fieldsWritten} fields)` : ""}${result.tier2.reason ? ` — ${result.tier2.reason}` : ""}`,
          `Tier 3 (intraday timing): ${result.tier3.status}${result.tier3.reason ? ` — ${result.tier3.reason}` : ""}`,
        ].join("\n");

        const summary =
          `Enrichment complete for ${result.ticker}.\n` +
          `Rows enriched: ${result.rowsEnriched}\n` +
          `Enriched through: ${result.enrichedThrough ?? "N/A"}\n\n` +
          tierSummary;

        return createToolOutput(summary, result);
      } finally {
        await downgradeToReadOnly(baseDir);
      }
    }
  );
}
