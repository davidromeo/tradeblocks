/**
 * Trade Replay Tools
 *
 * MCP tool for replaying trades using historical minute-level option bars
 * from Massive.com. Supports two modes:
 *   A) Hypothetical replay — explicit legs with strikes/expiry/dates
 *   B) Tradelog replay — block_id + trade_index to replay from existing trade data
 *
 * Tools registered:
 *   - replay_trade — Replay a trade and compute minute-by-minute P&L path with MFE/MAE
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConnection } from "../db/connection.js";
import { createToolOutput } from "../utils/output-formatter.js";
import { fetchBars } from "../utils/massive-client.js";
import {
  parseLegsString,
  buildOccTicker,
  computeStrategyPnlPath,
  computeReplayMfeMae,
  type ReplayLeg,
  type ReplayResult,
} from "../utils/trade-replay.js";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const replayTradeSchema = z.object({
  // Mode A: Hypothetical / explicit legs
  legs: z
    .array(
      z.object({
        ticker: z.string().describe("Underlying ticker, e.g., 'SPY', 'SPX'"),
        strike: z.number().describe("Strike price"),
        type: z.enum(["C", "P"]).describe("Call or Put"),
        expiry: z.string().describe("Expiration date YYYY-MM-DD"),
        quantity: z.number().describe("Positive = long, negative = short"),
        entry_price: z
          .number()
          .describe("Per-contract entry price (premium paid/received)"),
      })
    )
    .optional()
    .describe("Explicit leg definitions for hypothetical replay"),

  // Mode B: Tradelog replay
  block_id: z.string().optional().describe("Block ID to load trade from"),
  trade_index: z
    .number()
    .optional()
    .describe(
      "0-based index of trade in block's tradelog (ordered by date_opened)"
    ),

  // Common fields
  open_date: z
    .string()
    .optional()
    .describe(
      "Trade open date YYYY-MM-DD (required for hypothetical mode, auto-resolved for tradelog mode)"
    ),
  close_date: z
    .string()
    .optional()
    .describe(
      "Trade close date YYYY-MM-DD (required for hypothetical, auto-resolved for tradelog)"
    ),
  multiplier: z
    .number()
    .default(100)
    .describe("Contract multiplier (default 100 for standard options)"),
});

// ---------------------------------------------------------------------------
// Handler (exported for testing)
// ---------------------------------------------------------------------------

export async function handleReplayTrade(
  params: z.infer<typeof replayTradeSchema>,
  baseDir: string
): Promise<ReplayResult> {
  const { legs: inputLegs, block_id, trade_index, multiplier } = params;
  let { open_date, close_date } = params;

  let replayLegs: ReplayLeg[];

  if (inputLegs && inputLegs.length > 0) {
    // ----- Mode A: Hypothetical replay -----
    if (!open_date || !close_date) {
      throw new Error(
        "open_date and close_date are required for hypothetical replay mode"
      );
    }

    replayLegs = inputLegs.map((leg) => ({
      occTicker: buildOccTicker(leg.ticker, leg.expiry, leg.type, leg.strike),
      quantity: leg.quantity,
      entryPrice: leg.entry_price,
      multiplier,
    }));
  } else if (block_id !== undefined && trade_index !== undefined) {
    // ----- Mode B: Tradelog replay -----
    const conn = await getConnection(baseDir);

    const result = await conn.runAndReadAll(
      `SELECT legs, premium, date_opened, date_closed, ticker, num_contracts
       FROM trades.trade_data
       WHERE block_id = '${block_id.replace(/'/g, "''")}'
       ORDER BY date_opened
       LIMIT 1 OFFSET ${trade_index}`
    );

    const rows = result.getRows();
    if (rows.length === 0) {
      throw new Error(
        `No trade found at index ${trade_index} in block "${block_id}"`
      );
    }

    const row = rows[0];
    const legsStr = String(row[0] ?? "");
    const premium = Number(row[1] ?? 0);
    const dateOpened = String(row[2] ?? "");
    const dateClosed = String(row[3] ?? "");
    const ticker = String(row[4] ?? "");
    const numContracts = Number(row[5] ?? 1);

    // Use trade dates if not provided
    open_date = open_date || dateOpened;
    close_date = close_date || dateClosed;

    // Parse legs from tradelog
    let parsedLegs;
    try {
      parsedLegs = parseLegsString(legsStr);
    } catch {
      throw new Error(
        `Cannot parse legs "${legsStr}" from tradelog — use hypothetical mode with explicit strikes`
      );
    }

    // Build ReplayLeg[] from parsed legs
    // Expiry approximated as close_date (best available without explicit expiry in tradelog)
    const root = ticker || parsedLegs[0].root;
    const perContractPremium =
      numContracts > 0 ? premium / numContracts : premium;

    replayLegs = parsedLegs.map((leg) => ({
      occTicker: buildOccTicker(
        root,
        close_date!,
        leg.type,
        leg.strike
      ),
      quantity: leg.quantity * (numContracts > 0 ? numContracts : 1),
      entryPrice: perContractPremium / parsedLegs.length,
      multiplier,
    }));
  } else {
    throw new Error(
      "Provide either legs[] for hypothetical mode or block_id + trade_index for tradelog mode"
    );
  }

  // ----- Fetch minute bars for each leg -----
  const barsByLeg = await Promise.all(
    replayLegs.map((leg) =>
      fetchBars({
        ticker: leg.occTicker,
        from: open_date!,
        to: close_date!,
        timespan: "minute",
        assetClass: "option",
      })
    )
  );

  // ----- Compute P&L path + MFE/MAE -----
  const pnlPath = computeStrategyPnlPath(replayLegs, barsByLeg);
  const { mfe, mae, mfeTimestamp, maeTimestamp } =
    computeReplayMfeMae(pnlPath);
  const totalPnl = pnlPath.length > 0 ? pnlPath[pnlPath.length - 1].strategyPnl : 0;

  return {
    pnlPath,
    mfe,
    mae,
    mfeTimestamp,
    maeTimestamp,
    totalPnl,
    legs: replayLegs,
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerReplayTools(
  server: McpServer,
  baseDir: string
): void {
  server.registerTool(
    "replay_trade",
    {
      description:
        "Replay a trade using historical minute-level option bars from Massive.com. " +
        "Returns minute-by-minute P&L path with MFE (Maximum Favorable Excursion) and MAE (Maximum Adverse Excursion). " +
        "Two modes: (A) Hypothetical — provide explicit legs with strikes, expiry, entry prices. " +
        "(B) Tradelog — provide block_id + trade_index to replay an existing trade from your data. " +
        "Requires MASSIVE_API_KEY environment variable.",
      inputSchema: replayTradeSchema,
    },
    async (params) => {
      try {
        const result = await handleReplayTrade(params, baseDir);

        const summary =
          `Replayed ${result.legs.length}-leg strategy from ${params.open_date ?? "trade dates"} to ${params.close_date ?? "trade dates"}: ` +
          `$${result.totalPnl.toFixed(2)} P&L, MFE=$${result.mfe.toFixed(2)}, MAE=$${result.mae.toFixed(2)}, ` +
          `${result.pnlPath.length} minute bars`;

        return createToolOutput(summary, result);
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error replaying trade: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
