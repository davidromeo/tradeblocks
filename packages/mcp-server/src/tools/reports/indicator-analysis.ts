/**
 * Indicator Analysis MCP Tool
 *
 * analyze_indicator_mcp: Server-side equivalent of the Indicator Analysis UI page.
 * Joins market.custom_indicators columns to trade P&L by date.
 *
 * Returns (matching the UI page exactly):
 *   - Summary: Spearman ρ (with significance stars), Normalized Mutual Information, KS statistic
 *   - Bin table (equal-frequency): n, avgPl, winRate, medianPl, stdDev per bin
 *   - Violin data: raw P&L values per bin (for box/violin charts)
 *   - Scatter data: {indicator, pl} points capped at 500
 *   - Rolling 30-trade Spearman correlation over time
 *
 * Data source: market.custom_indicators (DuckDB) joined to trades by date.
 * Requires custom_indicators.csv to be synced via market-sync.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadBlock } from "../../utils/block-loader.js";
import { createToolOutput } from "../../utils/output-formatter.js";
import { getConnection } from "../../db/connection.js";
import { withFullSync } from "../middleware/sync-middleware.js";
import { filterByStrategy, filterByDateRange } from "../shared/filters.js";

// ── Pure TypeScript statistics helpers ────────────────────────────────────────

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDevPop(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

/** Abramowitz & Stegun normal CDF approximation */
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-x * x)));
}

/** Compute ranks with average-rank tie handling */
function computeRanks(arr: number[]): number[] {
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length - 1 && indexed[j + 1]!.v === indexed[i]!.v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k]!.i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

/** Pearson correlation (used on ranks for Spearman) */
function pearsonR(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const mx = mean(x), my = mean(y);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx, dy = y[i]! - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : Math.max(-1, Math.min(1, num / denom));
}

/** Spearman ρ with two-tailed p-value and significance stars */
function spearmanRho(x: number[], y: number[]): { rho: number; pValue: number; stars: string } {
  const n = x.length;
  if (n < 4) return { rho: NaN, pValue: NaN, stars: "" };
  const rx = computeRanks(x), ry = computeRanks(y);
  const rho = pearsonR(rx, ry);
  const tStat = rho * Math.sqrt((n - 2) / Math.max(1 - rho * rho, 1e-12));
  const pValue = Math.min(1, 2 * (1 - normalCDF(Math.abs(tStat))));
  const stars = pValue < 0.001 ? "***" : pValue < 0.01 ? "**" : pValue < 0.05 ? "*" : "";
  return { rho, pValue, stars };
}

/** Normalized Mutual Information via equal-frequency binning (0 = independent, 1 = perfect) */
function normalizedMI(x: number[], y: number[], k: number): number {
  const n = x.length;
  if (n < 2 * k) return NaN;
  const rx = computeRanks(x), ry = computeRanks(y);
  const binOf = (rank: number) => Math.min(k - 1, Math.floor((rank / n) * k));
  const joint: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++) joint[binOf(rx[i]!)][binOf(ry[i]!)]++;
  const px = joint.map((row) => row.reduce((s, v) => s + v, 0) / n);
  const py = Array.from({ length: k }, (_, j) => joint.reduce((s, row) => s + row[j]!, 0) / n);
  let mi = 0, hy = 0;
  for (let i = 0; i < k; i++) {
    if (px[i]! > 0)
      for (let j = 0; j < k; j++) {
        const pij = joint[i]![j]! / n;
        if (pij > 0) mi += pij * Math.log2(pij / (px[i]! * py[j]!));
      }
    if (py[i]! > 0) hy -= py[i]! * Math.log2(py[i]!);
  }
  return hy > 0 ? Math.max(0, Math.min(1, mi / hy)) : 0;
}

/** Two-sample KS test splitting on indicator median */
function ksTest(xVals: number[], yVals: number[]): { d: number; pValue: number; label: string } {
  const n = xVals.length;
  if (n < 4) return { d: 0, pValue: 1, label: "n.s." };
  const sorted = [...xVals].sort((a, b) => a - b);
  const med = sorted[Math.floor(n / 2)]!;
  const g1: number[] = [], g2: number[] = [];
  for (let i = 0; i < n; i++)
    (xVals[i]! <= med ? g1 : g2).push(yVals[i]!);
  if (!g1.length || !g2.length) return { d: 0, pValue: 1, label: "n.s." };
  g1.sort((a, b) => a - b);
  g2.sort((a, b) => a - b);
  const allVals = [...new Set([...g1, ...g2])].sort((a, b) => a - b);
  const n1 = g1.length, n2 = g2.length;
  let d = 0, i1 = 0, i2 = 0;
  for (const v of allVals) {
    while (i1 < n1 && g1[i1]! <= v) i1++;
    while (i2 < n2 && g2[i2]! <= v) i2++;
    d = Math.max(d, Math.abs(i1 / n1 - i2 / n2));
  }
  const nEff = (n1 * n2) / (n1 + n2);
  const lambda = (Math.sqrt(nEff) + 0.12 + 0.11 / Math.sqrt(nEff)) * d;
  const pValue = Math.min(1, 2 * Math.exp(-2 * lambda * lambda));
  const label = pValue < 0.01 ? "p<0.01" : pValue < 0.05 ? "p<0.05" : "n.s.";
  return { d, pValue, label };
}

/** Round to 4 decimal places, null if not finite */
function r4(v: number | null | undefined): number | null {
  if (v == null || !isFinite(v)) return null;
  return Math.round(v * 10000) / 10000;
}

// ── Bin analysis ──────────────────────────────────────────────────────────────

interface BinResult {
  binLabel: string;
  range: string;
  n: number;
  avgPl: number | null;
  winRate: number | null;
  medianPl: number | null;
  stdDev: number | null;
}

interface ViolinBin {
  binLabel: string;
  values: number[];
}

function buildEqualFreqBins(
  pairs: Array<{ indicator: number; pl: number }>,
  numBins: number
): { binTable: BinResult[]; violinData: ViolinBin[] } {
  if (!pairs.length) return { binTable: [], violinData: [] };
  const sorted = [...pairs].sort((a, b) => a.indicator - b.indicator);
  const n = sorted.length;
  const chunkSize = Math.ceil(n / numBins);
  const binTable: BinResult[] = [];
  const violinData: ViolinBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, n);
    if (start >= n) break;
    const chunk = sorted.slice(start, end);
    const plVals = chunk.map((p) => p.pl);
    const xMin = chunk[0]!.indicator;
    const xMax = chunk[chunk.length - 1]!.indicator;
    const label = `Bin ${i + 1}`;
    const range = `${r4(xMin)} – ${r4(xMax)}`;
    const avgPl = r4(mean(plVals));
    const winRate = r4((plVals.filter((v) => v > 0).length / plVals.length) * 100);
    const medianPl = r4(medianOf(plVals));
    const stdDev = r4(stdDevPop(plVals));
    binTable.push({ binLabel: label, range, n: chunk.length, avgPl, winRate, medianPl, stdDev });
    violinData.push({ binLabel: label, values: plVals });
  }
  return { binTable, violinData };
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  if (typeof date === "string") {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resultToRecords(
  result: { columnCount: number; columnName(i: number): string; getRows(): Iterable<unknown[]> }
): Record<string, unknown>[] {
  const cols: string[] = [];
  for (let i = 0; i < result.columnCount; i++) cols.push(result.columnName(i));
  const rows: Record<string, unknown>[] = [];
  for (const row of result.getRows()) {
    const rec: Record<string, unknown> = {};
    cols.forEach((c, i) => {
      const v = (row as unknown[])[i];
      rec[c] = typeof v === "bigint" ? Number(v) : v;
    });
    rows.push(rec);
  }
  return rows;
}

// ── Tool registration ─────────────────────────────────────────────────────────

export function registerIndicatorAnalysisTool(server: McpServer, baseDir: string): void {
  server.registerTool(
    "analyze_indicator_mcp",
    {
      description:
        "Server-side equivalent of the Indicator Analysis UI page. " +
        "Joins a column from market.custom_indicators to trade P&L by date, then returns: " +
        "Spearman ρ (with significance stars), Normalized Mutual Information, KS statistic, " +
        "equal-frequency bin table (avgPl, winRate, medianPl, stdDev per bin), " +
        "violin chart data (raw P&L per bin), scatter data (capped at 500 points), " +
        "and rolling 30-trade Spearman correlation over time. " +
        "Requires market.custom_indicators to be populated (sync custom_indicators.csv first).",
      inputSchema: z.object({
        blockId: z.string().describe("Block folder name"),
        indicatorColumn: z
          .string()
          .describe('Column from market.custom_indicators to use as indicator (e.g. "VRP_daily", "VIX_MA_Ratio")'),
        plMetric: z
          .enum(["total", "per_contract"])
          .default("total")
          .describe('P&L metric: "total" uses trade.pl, "per_contract" uses trade.pl / numContracts'),
        numBins: z
          .number()
          .min(3)
          .max(10)
          .default(5)
          .describe("Number of equal-frequency bins (3–10, default 5)"),
        strategy: z.string().optional().describe("Filter to specific strategy name (case-insensitive)"),
        startDate: z.string().optional().describe("Filter start date (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("Filter end date (YYYY-MM-DD)"),
      }),
    },
    withFullSync(
      baseDir,
      async ({ blockId, indicatorColumn, plMetric, numBins, strategy, startDate, endDate }) => {
        try {
          // ── Load and filter trades ──────────────────────────────────────
          const block = await loadBlock(baseDir, blockId);
          let trades = block.trades;
          trades = filterByStrategy(trades, strategy);
          trades = filterByDateRange(trades, startDate, endDate);

          if (trades.length === 0) {
            return { content: [{ type: "text", text: "No trades found matching the specified filters." }] };
          }

          // ── Check market.custom_indicators exists and has the column ────
          const conn = await getConnection(baseDir);

          const tableCheck = await conn.runAndReadAll(`
            SELECT 1 FROM duckdb_tables()
            WHERE database_name = 'market' AND table_name = 'custom_indicators'
          `);
          if (tableCheck.getRows().length === 0) {
            return {
              content: [{
                type: "text",
                text: "Table market.custom_indicators not found. Sync custom_indicators.csv first.",
              }],
              isError: true,
            };
          }

          const colCheck = await conn.runAndReadAll(`
            SELECT 1 FROM duckdb_columns()
            WHERE database_name = 'market' AND table_name = 'custom_indicators'
              AND column_name = '${indicatorColumn}'
          `);
          if (colCheck.getRows().length === 0) {
            return {
              content: [{
                type: "text",
                text: `Column "${indicatorColumn}" not found in market.custom_indicators.`,
              }],
              isError: true,
            };
          }

          // ── Build trade date → P&L(s) map ──────────────────────────────
          const tradeDateMap = new Map<string, Array<{ pl: number; numContracts: number }>>();
          for (const trade of trades) {
            const d = formatDate(trade.dateOpened);
            if (!tradeDateMap.has(d)) tradeDateMap.set(d, []);
            const numContracts = (trade as Record<string, unknown>)["numContracts"];
            tradeDateMap.get(d)!.push({
              pl: trade.pl,
              numContracts: typeof numContracts === "number" && numContracts > 0 ? numContracts : 1,
            });
          }

          // ── Fetch indicator values from DuckDB ──────────────────────────
          const tradeDates = Array.from(tradeDateMap.keys());
          const dateList = tradeDates.map((d) => `'${d}'`).join(", ");
          const result = await conn.runAndReadAll(
            `SELECT "date", "${indicatorColumn}" FROM market.custom_indicators WHERE "date" IN (${dateList})`
          );
          const indMap = new Map<string, number>();
          for (const rec of resultToRecords(result)) {
            const d = String(rec["date"]);
            const v = Number(rec[indicatorColumn]);
            if (!isNaN(v)) indMap.set(d, v);
          }

          // ── Join: build matched (indicator, pl) pairs with date ─────────
          interface Point { date: string; indicator: number; pl: number }
          const points: Point[] = [];

          for (const [date, tradePls] of tradeDateMap) {
            const indVal = indMap.get(date);
            if (indVal === undefined) continue;
            for (const { pl, numContracts } of tradePls) {
              const effectivePl = plMetric === "per_contract" ? pl / numContracts : pl;
              points.push({ date, indicator: indVal, pl: effectivePl });
            }
          }

          if (points.length < 5) {
            return {
              content: [{
                type: "text",
                text: `Only ${points.length} matched data points (need ≥ 5). ` +
                  `Check that market.custom_indicators covers the trade date range.`,
              }],
            };
          }

          if (points.length < 30) {
            // Warn but continue
          }

          points.sort((a, b) => a.date.localeCompare(b.date));

          const indVals = points.map((p) => p.indicator);
          const plVals = points.map((p) => p.pl);

          // ── Summary statistics ──────────────────────────────────────────
          const spearman = spearmanRho(indVals, plVals);
          const mi = normalizedMI(indVals, plVals, numBins);
          const ks = ksTest(indVals, plVals);

          // ── Bin table + violin data ─────────────────────────────────────
          const { binTable, violinData } = buildEqualFreqBins(
            points.map((p) => ({ indicator: p.indicator, pl: p.pl })),
            numBins
          );

          // ── Scatter data (capped at 500 points) ────────────────────────
          const MAX_SCATTER = 500;
          let scatterPoints = points.map((p) => ({ indicator: r4(p.indicator)!, pl: r4(p.pl)! }));
          if (scatterPoints.length > MAX_SCATTER) {
            // Random sample preserving spread
            const step = scatterPoints.length / MAX_SCATTER;
            scatterPoints = Array.from({ length: MAX_SCATTER }, (_, i) =>
              scatterPoints[Math.round(i * step)]!
            );
          }

          // ── Rolling 30-trade Spearman ───────────────────────────────────
          const WINDOW = 30;
          const rollingCorrelation: Array<{ date: string; rho: number | null }> = [];
          for (let i = WINDOW - 1; i < points.length; i++) {
            const w = points.slice(i - WINDOW + 1, i + 1);
            const { rho } = spearmanRho(w.map((p) => p.indicator), w.map((p) => p.pl));
            rollingCorrelation.push({ date: points[i]!.date, rho: r4(rho) });
          }

          const summary =
            `${indicatorColumn} vs P&L (${plMetric}) | n=${points.length} | ` +
            `Spearman ρ=${r4(spearman.rho)}${spearman.stars} | ` +
            `NMI=${r4(mi)} | KS d=${r4(ks.d)} (${ks.label})`;

          return createToolOutput(summary, {
            blockId,
            indicatorColumn,
            plMetric,
            numBins,
            n: points.length,
            warnings: points.length < 30
              ? [`Only ${points.length} matched trades — rolling correlation requires ≥ 30`]
              : [],
            // Summary stats matching the 3 UI metric cards
            spearman: {
              rho: r4(spearman.rho),
              pValue: r4(spearman.pValue),
              stars: spearman.stars,
            },
            mutualInformation: r4(mi),
            ks: {
              d: r4(ks.d),
              pValue: r4(ks.pValue),
              label: ks.label,
            },
            // Bin analysis table
            binTable,
            // Raw P&L per bin (for violin/box charts)
            violinData,
            // Scatter points
            scatterData: scatterPoints,
            // Rolling Spearman ρ (one per trade after warmup)
            rollingCorrelation,
          });
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
            isError: true,
          };
        }
      }
    )
  );
}
