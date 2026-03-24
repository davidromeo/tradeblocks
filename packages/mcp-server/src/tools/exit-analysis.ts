/**
 * Exit Analysis Tools
 *
 * MCP tools for analyzing exit triggers and decomposing P&L into greek factor
 * contributions. Both tools run trade replay internally -- a single tool call
 * fetches data, replays the trade, and analyzes the results.
 *
 * Tools registered:
 *   - analyze_exit_triggers -- Evaluate 14 trigger types against a replay P&L path
 *   - decompose_greeks -- Decompose P&L into delta/gamma/theta/vega/residual factors
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createToolOutput } from "../utils/output-formatter.js";
import { handleReplayTrade } from "./replay.js";
import { fetchBars } from "../utils/massive-client.js";
import {
  analyzeExitTriggers,
  type ExitTriggerConfig,
  type LegGroupConfig,
} from "../utils/exit-triggers.js";
import {
  decomposeGreeks,
  type LegGroupDef,
} from "../utils/greeks-decomposition.js";

// ---------------------------------------------------------------------------
// Shared trigger type enum
// ---------------------------------------------------------------------------

const triggerTypeEnum = z.enum([
  'profitTarget', 'stopLoss', 'trailingStop',
  'dteExit', 'ditExit', 'clockTimeExit',
  'underlyingPriceMove', 'positionDelta', 'perLegDelta',
  'vixMove', 'vix9dMove', 'vix9dVixRatio',
  'slRatioThreshold', 'slRatioMove',
]);

const triggerConfigSchema = z.object({
  type: triggerTypeEnum,
  threshold: z.number(),
  unit: z.enum(['percent', 'dollar']).default('dollar').optional(),
  expiry: z.string().optional(),
  openDate: z.string().optional(),
  clockTime: z.string().optional(),
  trailAmount: z.number().optional(),
  spreadWidth: z.number().optional(),
  contracts: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Leg schema (shared between both tools)
// ---------------------------------------------------------------------------

const legSchema = z.object({
  ticker: z.string(),
  strike: z.number(),
  type: z.enum(["C", "P"]),
  expiry: z.string(),
  quantity: z.number(),
  entry_price: z.number(),
});

// ---------------------------------------------------------------------------
// analyze_exit_triggers schema
// ---------------------------------------------------------------------------

export const analyzeExitTriggersSchema = z.object({
  // Replay inputs (same as replay_trade per D-02)
  legs: z.array(legSchema).optional(),
  block_id: z.string().optional(),
  trade_index: z.number().optional(),
  open_date: z.string().optional(),
  close_date: z.string().optional(),
  multiplier: z.number().default(100),

  // Trigger configs per D-03
  triggers: z.array(triggerConfigSchema)
    .describe("Exit triggers to evaluate against the P&L path"),

  // Per D-05
  actual_exit_timestamp: z.string().optional()
    .describe("Actual exit time for comparison (format: YYYY-MM-DD HH:MM)"),

  // Per D-06
  leg_groups: z.array(z.object({
    label: z.string(),
    leg_indices: z.array(z.number()),
    triggers: z.array(triggerConfigSchema),
  })).optional().describe("Per-leg-group exit triggers for multi-structure strategies"),

  format: z.enum(["summary", "full"]).default("summary")
    .describe("'summary' omits per-step trigger states, 'full' includes all fire events"),
});

// ---------------------------------------------------------------------------
// decompose_greeks schema
// ---------------------------------------------------------------------------

export const decomposeGreeksSchema = z.object({
  // Same replay inputs
  legs: z.array(legSchema).optional(),
  block_id: z.string().optional(),
  trade_index: z.number().optional(),
  open_date: z.string().optional(),
  close_date: z.string().optional(),
  multiplier: z.number().default(100),

  // Per D-08
  leg_groups: z.array(z.object({
    label: z.string(),
    leg_indices: z.array(z.number()),
  })).optional().describe("Leg grouping for per-group vega attribution (e.g., front_month vs back_month)"),

  format: z.enum(["summary", "full"]).default("summary")
    .describe("'summary' shows ranked factors, 'full' includes per-step contributions"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Reverse-map weekly roots to standard root for underlying/VIX fetching
const REVERSE_ROOT_MAP: Record<string, string> = {
  SPXW: 'SPX', NDXP: 'NDX', RUTW: 'RUT',
};

/**
 * Extract the underlying root ticker from the first replay leg's OCC ticker.
 * Maps weekly roots (SPXW, NDXP) back to their standard root.
 */
function extractUnderlyingTicker(occTicker: string): string {
  const rootMatch = occTicker.match(/^([A-Z]+)/);
  const rawRoot = rootMatch ? rootMatch[1] : '';
  return REVERSE_ROOT_MAP[rawRoot] ?? rawRoot;
}

/**
 * Fetch VIX or VIX9D minute bars and build a timestamp->price map.
 */
async function fetchPriceMap(
  ticker: string,
  from: string,
  to: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const bars = await fetchBars({
      ticker,
      from,
      to,
      timespan: "minute",
      assetClass: "index",
    });
    for (const b of bars) {
      const ts = `${b.date} ${b.time ?? ''}`.trim();
      map.set(ts, (b.high + b.low) / 2);
    }
  } catch {
    // VIX/VIX9D data is best-effort
  }
  return map;
}

// ---------------------------------------------------------------------------
// handleAnalyzeExitTriggers
// ---------------------------------------------------------------------------

export async function handleAnalyzeExitTriggers(
  params: z.infer<typeof analyzeExitTriggersSchema>,
  baseDir: string,
  injectedConn?: import("@duckdb/node-api").DuckDBConnection,
): Promise<ReturnType<typeof analyzeExitTriggers>> {
  const {
    legs: inputLegs, block_id, trade_index,
    open_date, close_date, multiplier,
    triggers, actual_exit_timestamp, leg_groups,
  } = params;

  // 1. Run replay to get full P&L path with greeks
  const replayResult = await handleReplayTrade(
    {
      legs: inputLegs,
      block_id,
      trade_index,
      open_date,
      close_date,
      multiplier,
      format: 'full',
    },
    baseDir,
    injectedConn,
  );

  const pnlPath = replayResult.pnlPath;
  const replayLegs = replayResult.legs;

  // Compute entry cost for percentage-based triggers (D-11)
  const entryCost = replayLegs.reduce((sum, leg) => {
    return sum + leg.entryPrice * leg.quantity * leg.multiplier;
  }, 0);

  if (pnlPath.length === 0) {
    return {
      overall: {
        triggers: [],
        firstToFire: null,
        summary: 'No P&L data available from replay.',
      },
    };
  }

  // 2. Determine date range from replay path
  const firstDate = pnlPath[0].timestamp.slice(0, 10);
  const lastDate = pnlPath[pnlPath.length - 1].timestamp.slice(0, 10);

  // 3. Check which external data maps are needed
  const allTriggerTypes = new Set(triggers.map(t => t.type));
  const groupTriggerTypes = new Set(
    (leg_groups ?? []).flatMap(g => g.triggers.map(t => t.type))
  );
  for (const t of groupTriggerTypes) allTriggerTypes.add(t);

  // Determine underlying ticker for underlying price triggers
  const underlyingTicker = extractUnderlyingTicker(replayLegs[0].occTicker);

  // Fetch VIX/VIX9D/underlying price maps as needed
  let vixPrices: Map<string, number> | undefined;
  let vix9dPrices: Map<string, number> | undefined;
  let underlyingPrices: Map<string, number> | undefined;

  const needsVix = allTriggerTypes.has('vixMove') || allTriggerTypes.has('vix9dVixRatio');
  const needsVix9d = allTriggerTypes.has('vix9dMove') || allTriggerTypes.has('vix9dVixRatio');
  const needsUnderlying = allTriggerTypes.has('underlyingPriceMove');

  if (needsVix) {
    vixPrices = await fetchPriceMap('VIX', firstDate, lastDate);
  }
  if (needsVix9d) {
    vix9dPrices = await fetchPriceMap('VIX9D', firstDate, lastDate);
  }
  if (needsUnderlying) {
    underlyingPrices = await fetchPriceMap(
      underlyingTicker, firstDate, lastDate,
    );
  }

  // 4. Map tool trigger params to ExitTriggerConfig[] with data maps
  const exitTriggers: ExitTriggerConfig[] = triggers.map(t => ({
    type: t.type,
    threshold: t.threshold,
    unit: t.unit,
    entryCost,
    expiry: t.expiry,
    openDate: t.openDate,
    clockTime: t.clockTime,
    trailAmount: t.trailAmount,
    spreadWidth: t.spreadWidth,
    contracts: t.contracts,
    multiplier,
    underlyingPrices,
    vixPrices,
    vix9dPrices,
  }));

  // 5. Map leg groups with their triggers
  const legGroupConfigs: LegGroupConfig[] | undefined = leg_groups?.map(g => ({
    label: g.label,
    legIndices: g.leg_indices,
    triggers: g.triggers.map(t => ({
      type: t.type,
      threshold: t.threshold,
      unit: t.unit,
      entryCost,
      expiry: t.expiry,
      openDate: t.openDate,
      clockTime: t.clockTime,
      trailAmount: t.trailAmount,
      spreadWidth: t.spreadWidth,
      contracts: t.contracts,
      multiplier,
      underlyingPrices,
      vixPrices,
      vix9dPrices,
    })),
  }));

  // 6. Run the pure analysis engine
  return analyzeExitTriggers({
    pnlPath,
    legs: replayLegs,
    triggers: exitTriggers,
    actualExitTimestamp: actual_exit_timestamp,
    legGroups: legGroupConfigs,
  });
}

// ---------------------------------------------------------------------------
// handleDecomposeGreeks
// ---------------------------------------------------------------------------

export async function handleDecomposeGreeks(
  params: z.infer<typeof decomposeGreeksSchema>,
  baseDir: string,
  injectedConn?: import("@duckdb/node-api").DuckDBConnection,
): Promise<import("../utils/greeks-decomposition.js").GreeksDecompositionResult> {
  const {
    legs: inputLegs, block_id, trade_index,
    open_date, close_date, multiplier,
    leg_groups, format,
  } = params;

  // 1. Run replay to get full P&L path with greeks
  const replayResult = await handleReplayTrade(
    {
      legs: inputLegs,
      block_id,
      trade_index,
      open_date,
      close_date,
      multiplier,
      format: 'full',
    },
    baseDir,
    injectedConn,
  );

  const pnlPath = replayResult.pnlPath;
  const replayLegs = replayResult.legs;

  // 2. Check greeks data availability
  if (pnlPath.length > 0 && !pnlPath[0].legGreeks) {
    throw new Error(
      "No greeks data available. Ensure MASSIVE_API_KEY is set and underlying price data exists."
    );
  }

  // 3. Fetch underlying prices for decomposition
  const underlyingTicker = extractUnderlyingTicker(replayLegs[0]?.occTicker ?? '');
  let underlyingPrices: Map<string, number> | undefined;

  if (pnlPath.length > 0 && underlyingTicker) {
    const firstDate = pnlPath[0].timestamp.slice(0, 10);
    const lastDate = pnlPath[pnlPath.length - 1].timestamp.slice(0, 10);

    underlyingPrices = await fetchPriceMap(
      underlyingTicker, firstDate, lastDate,
    );
  }

  // 4. Map leg groups
  const legGroupDefs: LegGroupDef[] | undefined = leg_groups?.map(g => ({
    label: g.label,
    legIndices: g.leg_indices,
  }));

  // 5. Run decomposition
  const result = decomposeGreeks({
    pnlPath,
    legs: replayLegs,
    underlyingPrices,
    legGroups: legGroupDefs,
  });

  // 6. Strip steps if format="summary"
  if (format === "summary") {
    for (const factor of result.factors) {
      factor.steps = [];
    }
    if (result.legGroupVega) {
      for (const group of result.legGroupVega) {
        group.steps = [];
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerExitAnalysisTools(
  server: McpServer,
  baseDir: string,
): void {
  server.registerTool(
    "analyze_exit_triggers",
    {
      description:
        "Analyze when exit triggers would fire on a trade replay. Runs replay internally " +
        "-- provide block_id + trade_index or explicit legs. Evaluates 14 trigger types " +
        "(profit target, stop loss, trailing stop, DTE, DIT, clock time, underlying move, " +
        "delta, VIX moves, S/L ratio) against minute-by-minute P&L path with greeks. " +
        "Requires MASSIVE_API_KEY.",
      inputSchema: analyzeExitTriggersSchema,
    },
    async (params) => {
      try {
        const result = await handleAnalyzeExitTriggers(params, baseDir);

        const summary = result.overall.summary;
        return createToolOutput(summary, result);
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error analyzing exit triggers: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "decompose_greeks",
    {
      description:
        "Decompose a trade's P&L into greek factor contributions (delta, gamma, theta, " +
        "vega, residual). Runs replay internally. Shows which factor drove P&L movement " +
        "and by how much. For calendar/double-calendar strategies, includes per-leg-group " +
        "vega attribution showing front vs back month IV divergence. Requires MASSIVE_API_KEY.",
      inputSchema: decomposeGreeksSchema,
    },
    async (params) => {
      try {
        const result = await handleDecomposeGreeks(params, baseDir);

        const summary = result.summary;
        return createToolOutput(summary, result);
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error decomposing greeks: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
