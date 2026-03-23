/**
 * Batch Exit Analysis Tool
 *
 * MCP tool that evaluates a candidate exit policy across multiple trades in a
 * block. Queries trades from DuckDB, replays each one (checking market.intraday
 * cache before fetching from Massive), evaluates the candidate policy via the
 * pure batch exit analysis engine, and returns aggregate statistics with
 * per-trigger attribution.
 *
 * Tools registered:
 *   - batch_exit_analysis -- Evaluate a candidate exit policy across an entire block
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConnection } from "../db/connection.js";
import { createToolOutput } from "../utils/output-formatter.js";
import { handleReplayTrade } from "./replay.js";
import {
  analyzeBatch,
  type TradeInput,
  type BatchExitConfig,
  type BatchExitResult,
} from "../utils/batch-exit-analysis.js";
import { getProfile } from "../db/profile-schemas.js";
import type { ExitTriggerConfig, LegGroupConfig } from "../utils/exit-triggers.js";

// ---------------------------------------------------------------------------
// Shared trigger type enum (mirrors exit-analysis.ts)
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
  expiry: z.string().optional(),
  openDate: z.string().optional(),
  clockTime: z.string().optional(),
  trailAmount: z.number().optional(),
  spreadWidth: z.number().optional(),
  contracts: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

export const batchExitAnalysisSchema = z.object({
  block_id: z.string().describe("Block ID to analyze trades from"),

  strategy: z.string().optional()
    .describe("Filter trades by strategy name (case-insensitive ILIKE)"),

  date_range: z.object({
    from: z.string().optional().describe("Start date YYYY-MM-DD"),
    to: z.string().optional().describe("End date YYYY-MM-DD"),
  }).optional().describe("Filter trades by date range"),

  candidate_policy: z.array(triggerConfigSchema)
    .describe("Candidate exit policy triggers to evaluate -- same schema as analyze_exit_triggers"),

  leg_groups: z.array(z.object({
    label: z.string(),
    leg_indices: z.array(z.number()),
    triggers: z.array(triggerConfigSchema),
  })).optional().describe("Per-leg-group exit triggers for multi-structure strategies"),

  baseline_mode: z.enum(['actual', 'holdToEnd']).default('actual')
    .describe("'actual' compares candidate vs trade's actual P&L; 'holdToEnd' compares vs last replay timestamp"),

  limit: z.number().min(1).max(200).default(50)
    .describe("Max trades to analyze. Most recent trades selected"),

  min_pl: z.number().optional()
    .describe("Only include trades with actual P&L >= this value"),

  max_pl: z.number().optional()
    .describe("Only include trades with actual P&L <= this value"),

  multiplier: z.number().default(100)
    .describe("Contract multiplier (default 100)"),

  format: z.enum(['summary', 'full']).default('summary')
    .describe("'summary' returns aggregate stats + trigger attribution; 'full' adds per-trade breakdown"),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleBatchExitAnalysis(
  params: z.infer<typeof batchExitAnalysisSchema>,
  baseDir: string,
  injectedConn?: import("@duckdb/node-api").DuckDBConnection,
): Promise<BatchExitResult> {
  const {
    block_id,
    strategy,
    date_range,
    candidate_policy,
    leg_groups,
    baseline_mode,
    limit,
    min_pl,
    max_pl,
    multiplier,
    format,
  } = params;

  // 1. Query trades from DuckDB with deterministic ROW_NUMBER ordering
  const conn = injectedConn ?? await getConnection(baseDir);
  const escapedBlockId = block_id.replace(/'/g, "''");

  // Build WHERE clauses
  const whereClauses: string[] = [`block_id = '${escapedBlockId}'`];

  if (strategy) {
    const escapedStrategy = strategy.replace(/'/g, "''");
    whereClauses.push(`strategy ILIKE '%${escapedStrategy}%'`);
  }
  if (date_range?.from) {
    whereClauses.push(`date_opened >= '${date_range.from}'`);
  }
  if (date_range?.to) {
    whereClauses.push(`date_opened <= '${date_range.to}'`);
  }
  if (min_pl !== undefined) {
    whereClauses.push(`pl >= ${min_pl}`);
  }
  if (max_pl !== undefined) {
    whereClauses.push(`pl <= ${max_pl}`);
  }

  const whereStr = whereClauses.join(' AND ');

  // ROW_NUMBER uses rowid as tiebreaker for deterministic ordering when
  // multiple trades share the same date_opened.
  const query = `
    WITH numbered AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY date_opened, rowid) - 1 AS trade_idx
      FROM trades.trade_data
      WHERE ${whereStr}
    )
    SELECT trade_idx, pl, date_opened
    FROM numbered
    ORDER BY date_opened DESC
    LIMIT ${limit}
  `;

  const queryResult = await conn.runAndReadAll(query);
  const rows = queryResult.getRows();

  if (rows.length === 0) {
    const emptyResult: BatchExitResult = {
      aggregate: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnl: 0,
        avgPnl: 0,
        avgWin: 0,
        avgLoss: 0,
        maxWin: 0,
        maxLoss: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        sharpeRatio: null,
        maxWinStreak: 0,
        maxLossStreak: 0,
        baselineTotalPnl: 0,
        totalPnlDelta: 0,
        baselineWinRate: 0,
      },
      triggerAttribution: [],
      perTrade: [],
      baselineMode: baseline_mode,
      summary: 'Analyzed 0 trades: no matching trades found.',
    };
    return emptyResult;
  }

  // 2. For each trade, call handleReplayTrade and build TradeInput
  const tradeInputs: TradeInput[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    const tradeIdx = Number(row[0] ?? 0);
    const pl = Number(row[1] ?? 0);
    const dateOpened = String(row[2] ?? '');

    try {
      // Always pass format:'full' to get complete pnlPath for analyzeBatch.
      // params.format controls the batch output density, not the replay resolution.
      const replayResult = await handleReplayTrade(
        {
          block_id,
          trade_index: tradeIdx,
          multiplier,
          format: 'full',
        },
        baseDir,
        injectedConn,
      );

      const tradeInput: TradeInput = {
        tradeIndex: tradeIdx,
        dateOpened,
        actualPnl: pl,
        pnlPath: replayResult.pnlPath,
        legs: replayResult.legs,
      };
      tradeInputs.push(tradeInput);
    } catch {
      // Skip trades that fail replay (e.g., no option bars available)
      skippedCount++;
    }
  }

  // 3. Build BatchExitConfig
  const config: BatchExitConfig = {
    candidatePolicy: candidate_policy as ExitTriggerConfig[],
    legGroups: leg_groups?.map(g => ({
      label: g.label,
      legIndices: g.leg_indices,
      triggers: g.triggers as ExitTriggerConfig[],
    })) as LegGroupConfig[] | undefined,
    baselineMode: baseline_mode,
    format,
  };

  // 4. Run the pure batch analysis engine
  const result = analyzeBatch(tradeInputs, config);

  // 5. Augment summary with skip info if any trades were skipped
  if (skippedCount > 0) {
    result.summary = result.summary.replace(
      /^Analyzed (\d+) trades/,
      `Analyzed ${tradeInputs.length} trades (${skippedCount} skipped due to replay errors)`,
    );
  }

  // 6. Load profile context if strategy is specified (per D-16)
  if (strategy) {
    try {
      const profileConn = injectedConn ?? await getConnection(baseDir);
      const profile = await getProfile(profileConn, block_id, strategy);
      if (profile) {
        result.profileContext = {
          structureType: profile.structureType,
          exitRules: profile.exitRules.map(r =>
            r.description ?? `${r.type} ${r.trigger}`
          ),
        };
      }
    } catch {
      // Profile is informational context, not critical — swallow errors
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerBatchExitAnalysisTools(
  server: McpServer,
  baseDir: string,
): void {
  server.registerTool(
    "batch_exit_analysis",
    {
      description:
        "Analyze how a candidate exit policy would perform across multiple trades in a block. " +
        "Replays each matching trade, evaluates exit triggers against the minute-level P&L path, " +
        "and returns aggregate statistics (win rate, Sharpe, profit factor, drawdown) comparable " +
        "to get_statistics. Includes per-trigger attribution showing which triggers drive outcomes. " +
        "First run fetches option bars from Massive (requires MASSIVE_API_KEY); subsequent runs " +
        "use cached data from market.intraday. Use with strategy profiles to iterate on exit rules.",
      inputSchema: batchExitAnalysisSchema,
    },
    async (params) => {
      try {
        const result = await handleBatchExitAnalysis(params, baseDir);
        return createToolOutput(result.summary, result);
      } catch (error) {
        return {
          content: [{
            type: "text" as const,
            text: `Error in batch exit analysis: ${(error as Error).message}`,
          }],
          isError: true,
        };
      }
    }
  );
}
