/**
 * greeks-attribution.ts
 *
 * MCP tool: get_greeks_attribution
 *
 * Decomposes a block's P&L into Greek components. Two modes:
 *   - summary: block-level attribution percentages across all trades
 *   - instance: single trade time-series of Greek P&L contributions
 */

import { z } from "zod";
import { getConnection } from "../db/connection.js";
import { handleDecomposeGreeks } from "./exit-analysis.js";
import type { FactorContribution } from "../utils/greeks-decomposition.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttributionEntry {
  factor: string;
  pnl: number;
  pct: number;
}

export interface AttributionSummaryResult {
  block_id: string;
  trades_decomposed: number;
  trades_skipped: number;
  trades_total: number;
  total_pnl: number;
  attribution: AttributionEntry[];
  precision: "high" | "low";
  hint?: string;
}

export interface AttributionStepEntry {
  date: string;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  residual: number;
  charm?: number;
  vanna?: number;
}

export interface AttributionInstanceResult {
  block_id: string;
  trade_index: number;
  trade_date: string;
  total_pnl: number;
  steps: AttributionStepEntry[];
  attribution: AttributionEntry[];
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const getGreeksAttributionSchema = z.object({
  block_id: z.string().describe("Block ID to analyze"),
  mode: z
    .enum(["summary", "instance"])
    .default("summary")
    .describe("summary: block-level attribution. instance: single trade time-series."),
  trade_index: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Trade index (required for instance mode). Use get_block_info to find trade indices."),
  skip_quotes: z
    .boolean()
    .default(true)
    .describe("Use cached bar data only (fast). Set false to fetch NBBO quotes for higher precision."),
  detailed: z
    .boolean()
    .default(false)
    .describe("false: 5 factors (delta, gamma, theta, vega, residual). true: adds charm, vanna."),
  strategy: z
    .string()
    .optional()
    .describe("Filter to trades matching this strategy name (case-insensitive)."),
});

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

const COLLAPSE_MAP: Record<string, string> = {
  charm: "delta",
  vanna: "vega",
};

const FACTOR_ORDER: string[] = ["theta", "vega", "delta", "gamma", "residual", "charm", "vanna"];

export function collapseFactors(
  factors: FactorContribution[],
  detailed: boolean,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const f of factors) {
    const targetName = (!detailed && COLLAPSE_MAP[f.factor]) || f.factor;
    totals.set(targetName, (totals.get(targetName) ?? 0) + f.totalPnl);
  }
  return totals;
}

export function computeAttribution(
  totals: Map<string, number>,
  totalPnl: number,
): AttributionEntry[] {
  const entries: AttributionEntry[] = [];
  for (const [factor, pnl] of totals) {
    entries.push({
      factor,
      pnl: Math.round(pnl * 100) / 100,
      pct: totalPnl !== 0 ? Math.round((pnl / totalPnl) * 1000) / 10 : 0,
    });
  }
  entries.sort((a, b) => {
    const ai = FACTOR_ORDER.indexOf(a.factor);
    const bi = FACTOR_ORDER.indexOf(b.factor);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return entries;
}

export function assessPrecision(
  residualPnl: number,
  totalPnl: number,
): { precision: "high" | "low"; hint?: string } {
  if (totalPnl === 0) return { precision: "high" };
  const residualPct = Math.abs(residualPnl / totalPnl) * 100;
  if (residualPct > 25) {
    return {
      precision: "low",
      hint: `Residual is ${Math.round(residualPct)}%. Re-run with skip_quotes=false for NBBO-based pricing.`,
    };
  }
  return { precision: "high" };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleGetGreeksAttribution(
  params: z.infer<typeof getGreeksAttributionSchema>,
  baseDir: string,
  injectedConn?: import("@duckdb/node-api").DuckDBConnection,
): Promise<AttributionSummaryResult | AttributionInstanceResult> {
  const { block_id, mode, trade_index, skip_quotes, detailed, strategy } = params;

  if (mode === "instance") {
    if (trade_index == null) {
      throw new Error("trade_index is required for instance mode");
    }
    return handleInstanceMode(block_id, trade_index, skip_quotes, detailed, baseDir, injectedConn);
  }

  return handleSummaryMode(block_id, skip_quotes, detailed, strategy, baseDir, injectedConn);
}

async function handleSummaryMode(
  block_id: string,
  skip_quotes: boolean,
  detailed: boolean,
  strategy: string | undefined,
  baseDir: string,
  injectedConn?: import("@duckdb/node-api").DuckDBConnection,
): Promise<AttributionSummaryResult> {
  const conn = injectedConn ?? await getConnection(baseDir);

  const strategyFilter = strategy
    ? ` AND LOWER(strategy) = LOWER('${strategy.replace(/'/g, "''")}')`
    : "";
  const countResult = await conn.runAndReadAll(
    `SELECT COUNT(*) FROM trades.trade_data WHERE block_id = '${block_id.replace(/'/g, "''")}' ${strategyFilter}`
  );
  const totalTrades = Number(countResult.getRows()[0]?.[0] ?? 0);

  if (totalTrades === 0) {
    throw new Error(
      strategy
        ? `No trades found for block "${block_id}" with strategy "${strategy}"`
        : `No trades found for block "${block_id}"`
    );
  }

  const accumulated = new Map<string, number>();
  let decomposed = 0;
  let skipped = 0;
  let totalPnl = 0;

  for (let i = 0; i < totalTrades; i++) {
    try {
      const result = await handleDecomposeGreeks(
        {
          block_id,
          trade_index: i,
          format: "summary",
          multiplier: 100,
        },
        baseDir,
        injectedConn,
      );

      for (const factor of result.factors) {
        accumulated.set(factor.factor, (accumulated.get(factor.factor) ?? 0) + factor.totalPnl);
      }
      totalPnl += result.totalPnlChange;
      decomposed++;
    } catch {
      skipped++;
    }
  }

  if (decomposed === 0) {
    return {
      block_id,
      trades_decomposed: 0,
      trades_skipped: skipped,
      trades_total: totalTrades,
      total_pnl: 0,
      attribution: [],
      precision: "low",
      hint: "No trades could be decomposed. Ensure market data is cached for the trade dates.",
    };
  }

  const collapsed = collapseFactors(
    [...accumulated.entries()].map(([factor, totalPnl]) => ({
      factor: factor as FactorContribution["factor"],
      totalPnl,
      pctOfTotal: 0,
      steps: [],
    })),
    detailed,
  );

  const attribution = computeAttribution(collapsed, totalPnl);
  const residualPnl = collapsed.get("residual") ?? 0;
  const { precision, hint } = assessPrecision(residualPnl, totalPnl);

  return {
    block_id,
    trades_decomposed: decomposed,
    trades_skipped: skipped,
    trades_total: totalTrades,
    total_pnl: Math.round(totalPnl * 100) / 100,
    attribution,
    precision,
    ...(hint ? { hint } : {}),
  };
}

/* eslint-disable @typescript-eslint/no-unused-vars */
async function handleInstanceMode(
  _block_id: string,
  _trade_index: number,
  _skip_quotes: boolean,
  _detailed: boolean,
  _baseDir: string,
  _injectedConn?: import("@duckdb/node-api").DuckDBConnection,
): Promise<AttributionInstanceResult> {
  throw new Error("Instance mode not yet implemented");
}
/* eslint-enable @typescript-eslint/no-unused-vars */
