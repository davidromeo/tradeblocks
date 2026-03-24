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
import { fetchBarsWithCache } from "../utils/bar-cache.js";
import {
  parseLegsString,
  buildOccTicker,
  computeStrategyPnlPath,
  computeReplayMfeMae,
  type ReplayLeg,
  type ReplayResult,
  type GreeksConfig,
} from "../utils/trade-replay.js";
import type { BarRow } from "../utils/market-provider.js";

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
  format: z
    .enum(["full", "summary", "sampled"])
    .default("sampled")
    .describe(
      "Output format: 'sampled' returns path sampled at ~15min intervals (default), " +
      "'full' returns complete minute-by-minute P&L path, " +
      "'summary' returns MFE/MAE/P&L without minute-level path"
    ),
  close_at: z
    .enum(["trade", "expiry"])
    .default("trade")
    .describe(
      "When to end the P&L path: 'trade' (default) truncates at the trade's actual close time, " +
      "'expiry' shows full path through option expiry. Only applies to tradelog mode."
    ),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** Convert OO expiry hint "Mar 13" + year "2026" → "2026-03-13" */
function resolveOOExpiryHint(hint: string, year: string): string {
  const [mon, day] = hint.split(' ');
  const mm = MONTH_MAP[mon] ?? '01';
  const dd = day.padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Derive fetch date range from OO leg expiryHints.
 *
 * For calendar spreads (different expiries): min(expiry)→max(expiry).
 * For single-expiry trades: tradeOpenDate→expiry.
 * Returns null if no legs have expiryHint (caller falls back to trade dates).
 */
export function resolveOODateRange(
  parsedLegs: import("../utils/trade-replay.js").ParsedLegOO[],
  tradeYear: string,
  tradeOpenDate: string,
): { from: string; to: string } | null {
  const hints = parsedLegs
    .filter(l => l.expiryHint)
    .map(l => resolveOOExpiryHint(l.expiryHint!, tradeYear));

  if (hints.length === 0) return null;

  const sorted = [...hints].sort();
  const minDate = sorted[0];
  const maxDate = sorted[sorted.length - 1];

  if (minDate === maxDate) {
    // Single expiry — fetch from trade open to expiry
    return { from: tradeOpenDate, to: maxDate };
  }
  // Calendar spread — near-term to far-term expiry
  return { from: minDate, to: maxDate };
}

// ---------------------------------------------------------------------------
// Handler (exported for testing)
// ---------------------------------------------------------------------------

export async function handleReplayTrade(
  params: z.infer<typeof replayTradeSchema>,
  baseDir: string,
  injectedConn?: import("@duckdb/node-api").DuckDBConnection
): Promise<ReplayResult> {
  const { legs: inputLegs, block_id, trade_index, multiplier, close_at } = params;
  let { open_date, close_date } = params;
  let tradeCloseTimestamp: string | undefined; // "YYYY-MM-DD HH:MM" when trade actually closed

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
    const conn = injectedConn ?? await getConnection(baseDir);

    const result = await conn.runAndReadAll(
      `SELECT legs, premium, date_opened, date_closed, ticker, num_contracts, time_closed
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
    const timeClosed = String(row[6] ?? "");

    // Build actual trade close timestamp for path truncation
    if (dateClosed && timeClosed) {
      // time_closed is "HH:MM:SS" or "HH:MM" — normalize to "HH:MM"
      const normalizedTime = timeClosed.slice(0, 5);
      tradeCloseTimestamp = `${dateClosed} ${normalizedTime}`;
    }

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
    const root = ticker || parsedLegs[0].root;
    const perContractPremium =
      numContracts > 0 ? premium / numContracts : premium;

    // OO format provides per-leg entry price, contract count, and expiry hint
    const hasOOData = parsedLegs.some(l => l.entryPrice !== undefined);

    // Resolve per-leg expiry: OO expiryHint ("Mar 13") + year from trade date
    const tradeYear = (open_date || dateOpened).split('-')[0];

    // Override fetch date range from OO expiryHints when available
    if (hasOOData) {
      const ooRange = resolveOODateRange(parsedLegs, tradeYear, open_date || dateOpened);
      if (ooRange) {
        open_date = ooRange.from;
        close_date = ooRange.to;
      }
    }

    replayLegs = parsedLegs.map((leg) => {
      let legExpiry = close_date!;
      if (hasOOData && leg.expiryHint) {
        legExpiry = resolveOOExpiryHint(leg.expiryHint, tradeYear);
      }
      return {
        occTicker: buildOccTicker(root, legExpiry, leg.type, leg.strike),
        quantity: hasOOData
          ? leg.quantity * (leg.contracts ?? 1)
          : leg.quantity * (numContracts > 0 ? numContracts : 1),
        entryPrice: hasOOData
          ? leg.entryPrice!
          : perContractPremium / parsedLegs.length,
        multiplier,
      };
    });
  } else {
    throw new Error(
      "Provide either legs[] for hypothetical mode or block_id + trade_index for tradelog mode"
    );
  }

  // ----- Fetch minute bars for each leg -----
  // Index options often trade under a weekly root on Massive (e.g., SPX→SPXW).
  // If the primary root fetch returns empty, retry with the mapped fallback root.
  const ROOT_FALLBACK_MAP: Record<string, string> = {
    SPX: 'SPXW',
    NDX: 'NDXP',
    RUT: 'RUTW',
  };

  const fetchLegBars = async (occTicker: string): Promise<BarRow[]> => {
    const bars = await fetchBarsWithCache({
      ticker: occTicker,
      from: open_date!,
      to: close_date!,
      timespan: 'minute',
      assetClass: 'option',
      conn: injectedConn,
      baseDir,
    });
    if (bars.length > 0) return bars;

    // Fallback root retry (SPX→SPXW, NDX→NDXP, RUT→RUTW)
    const rootMatch = occTicker.match(/^([A-Z]+)/);
    const root = rootMatch ? rootMatch[1] : '';
    const fallbackRoot = ROOT_FALLBACK_MAP[root];
    if (fallbackRoot && !occTicker.startsWith(fallbackRoot)) {
      const fallbackTicker = fallbackRoot + occTicker.slice(root.length);
      const fallbackBars = await fetchBarsWithCache({
        ticker: fallbackTicker,
        from: open_date!,
        to: close_date!,
        timespan: 'minute',
        assetClass: 'option',
        conn: injectedConn,
        baseDir,
      });
      if (fallbackBars.length > 0) {
        const leg = replayLegs.find(l => l.occTicker === occTicker);
        if (leg) leg.occTicker = fallbackTicker;
        return fallbackBars;
      }
    }
    return [];
  };

  const barsByLeg = await Promise.all(
    replayLegs.map((leg) => fetchLegBars(leg.occTicker))
  );

  // ----- Fetch underlying bars + build greeks config -----
  // Reverse-map weekly roots back to standard root for underlying fetch
  const REVERSE_ROOT_MAP: Record<string, string> = {
    SPXW: 'SPX', NDXP: 'NDX', RUTW: 'RUT',
  };
  const DIVIDEND_YIELDS: Record<string, number> = {
    SPX: 0.015, SPXW: 0.015, NDX: 0.015, NDXP: 0.015,
  };

  // Extract root from first leg's OCC ticker
  const firstRootMatch = replayLegs[0]?.occTicker.match(/^([A-Z]+)/);
  const rawRoot = firstRootMatch ? firstRootMatch[1] : '';
  const underlyingTicker = REVERSE_ROOT_MAP[rawRoot] ?? rawRoot;
  const dividendYield = DIVIDEND_YIELDS[rawRoot] ?? 0;

  // Fetch underlying minute bars via shared cache utility (cache-read → API → cache-write)
  let underlyingBars: BarRow[] = await fetchBarsWithCache({
    ticker: underlyingTicker,
    from: open_date!,
    to: close_date!,
    timespan: 'minute',
    assetClass: underlyingTicker === 'SPX' || underlyingTicker === 'NDX' || underlyingTicker === 'RUT' ? 'index' : 'stock',
    conn: injectedConn,
    baseDir,
  });

  // Daily fallback when minute bars unavailable
  if (underlyingBars.length === 0) {
    try {
      const conn = injectedConn ?? await getConnection(baseDir);
      const result = await conn.runAndReadAll(
        `SELECT date, close FROM market.daily
         WHERE ticker = '${underlyingTicker}'
         AND date >= '${open_date}' AND date <= '${close_date}'
         ORDER BY date`
      );
      const dailyRows = result.getRows();
      underlyingBars = dailyRows.map(r => ({
        date: String(r[0]),
        open: Number(r[1]),
        high: Number(r[1]),
        low: Number(r[1]),
        close: Number(r[1]),
        volume: 0,
        ticker: underlyingTicker,
      }));
    } catch {
      // No fallback available — greeks will be omitted
    }
  }

  // Build underlying price map for greeks config
  const underlyingPrices = new Map<string, number>();
  for (const b of underlyingBars) {
    const ts = `${b.date} ${b.time ?? ''}`.trim();
    underlyingPrices.set(ts, (b.high + b.low) / 2);
  }

  // Build sorted timestamps array for tolerant nearest-timestamp lookup (D-07/D-08)
  const sortedTimestamps = Array.from(underlyingPrices.keys())
    .filter(k => k.includes(' '))  // Only intraday timestamps, not date-only keys
    .sort();

  // IVP lookup from market.daily VIX ticker (normalized schema)
  let ivpByDate: Map<string, number> | undefined;
  try {
    const conn = injectedConn ?? await getConnection(baseDir);
    const ivpResult = await conn.runAndReadAll(
      `SELECT date, ivp FROM market.daily
       WHERE ticker = 'VIX'
       AND date >= '${open_date}' AND date <= '${close_date}'
       AND ivp IS NOT NULL
       ORDER BY date`
    );
    const ivpRows = ivpResult.getRows();
    if (ivpRows.length > 0) {
      ivpByDate = new Map();
      for (const r of ivpRows) {
        ivpByDate.set(String(r[0]), Number(r[1]));
      }
    }
  } catch {
    // IVP is optional enrichment — don't fail
  }

  // Build GreeksConfig
  let greeksConfig: GreeksConfig | undefined;
  if (underlyingPrices.size > 0) {
    greeksConfig = {
      underlyingPrices,
      sortedTimestamps,
      legs: replayLegs.map(leg => {
        // Extract strike, type, expiry from OCC ticker: ROOT{YYMMDD}{C|P}{strike*1000}
        const occMatch = leg.occTicker.match(/^[A-Z]+(\d{6})([CP])(\d{8})$/);
        if (!occMatch) return { strike: 0, type: 'C' as const, expiryDate: '' };
        const yymmdd = occMatch[1];
        const type = occMatch[2] as 'C' | 'P';
        const strike = parseInt(occMatch[3], 10) / 1000;
        const expiryDate = `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
        return { strike, type, expiryDate };
      }),
      riskFreeRate: 0.045,
      dividendYield,
      ivpByDate,
    };
  }

  // ----- Compute P&L path + MFE/MAE -----
  let fullPath = computeStrategyPnlPath(replayLegs, barsByLeg, greeksConfig);
  let { mfe, mae, mfeTimestamp, maeTimestamp } =
    computeReplayMfeMae(fullPath);
  let totalPnl = fullPath.length > 0 ? fullPath[fullPath.length - 1].strategyPnl : 0;

  // Compute greeks warning (D-12): warn when >50% of leg-timestamps have null greeks
  let greeksNullCount = 0;
  let greeksTotalCount = 0;
  for (const point of fullPath) {
    if (point.legGreeks) {
      for (const lg of point.legGreeks) {
        greeksTotalCount++;
        if (lg.delta === null) greeksNullCount++;
      }
    }
  }
  const greeksWarning = greeksTotalCount > 0 && greeksNullCount / greeksTotalCount > 0.5
    ? `Greeks unavailable for ${greeksNullCount} of ${greeksTotalCount} leg-timestamps (0DTE options use Bachelier model; some legs may have insufficient time value for IV computation)`
    : null;

  // Apply format filter
  // Truncate path at trade close timestamp when close_at === "trade" (default)
  // This ensures decompose_greeks and exit triggers only analyze the actual holding period
  if (close_at === "trade" && tradeCloseTimestamp && fullPath.length > 0) {
    const truncIdx = fullPath.findIndex(p => p.timestamp > tradeCloseTimestamp!);
    if (truncIdx > 0) {
      fullPath = fullPath.slice(0, truncIdx);
      // Recompute MFE/MAE/totalPnl on truncated path
      mfe = -Infinity;
      mae = Infinity;
      for (const p of fullPath) {
        if (p.strategyPnl > mfe) { mfe = p.strategyPnl; mfeTimestamp = p.timestamp; }
        if (p.strategyPnl < mae) { mae = p.strategyPnl; maeTimestamp = p.timestamp; }
      }
      totalPnl = fullPath[fullPath.length - 1].strategyPnl;
    }
  }

  const { format } = params;
  let pnlPath: typeof fullPath;
  if (format === "summary") {
    // Return only MFE, MAE, and boundary points (first, last, MFE timestamp, MAE timestamp)
    const keyTimestamps = new Set([
      fullPath[0]?.timestamp,
      fullPath[fullPath.length - 1]?.timestamp,
      mfeTimestamp,
      maeTimestamp,
    ]);
    pnlPath = fullPath.filter(p => keyTimestamps.has(p.timestamp));
  } else if (format === "sampled") {
    // Sample at ~15min intervals (keep every 15th bar, plus first/last/MFE/MAE)
    const keyTimestamps = new Set([mfeTimestamp, maeTimestamp]);
    pnlPath = fullPath.filter((p, i) =>
      i === 0 || i === fullPath.length - 1 || i % 15 === 0 || keyTimestamps.has(p.timestamp)
    );
  } else {
    pnlPath = fullPath;
  }

  return {
    pnlPath,
    mfe,
    mae,
    mfeTimestamp,
    maeTimestamp,
    totalPnl,
    totalBars: fullPath.length,
    legs: replayLegs,
    greeksWarning,
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
        "Replay a trade using historical minute-level option bars. " +
        "Uses cached bars from market.intraday if available; fetches from Massive.com API on cache miss (requires MASSIVE_API_KEY). " +
        "Returns minute-by-minute P&L path with MFE (Maximum Favorable Excursion) and MAE (Maximum Adverse Excursion). " +
        "Two modes: (A) Hypothetical — provide explicit legs with strikes, expiry, entry prices. " +
        "(B) Tradelog — provide block_id + trade_index to replay an existing trade from your data.",
      inputSchema: replayTradeSchema,
    },
    async (params) => {
      try {
        const result = await handleReplayTrade(params, baseDir);

        const summary =
          `Replayed ${result.legs.length}-leg strategy from ${params.open_date ?? "trade dates"} to ${params.close_date ?? "trade dates"}: ` +
          `$${result.totalPnl.toFixed(2)} P&L, MFE=$${result.mfe.toFixed(2)}, MAE=$${result.mae.toFixed(2)}, ` +
          `${result.pnlPath.length} minute bars, greeks=${result.pnlPath[0]?.legGreeks ? 'yes' : 'no'}`;

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
