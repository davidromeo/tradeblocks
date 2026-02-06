# Phase 50: Verdict Synthesis & Tool Registration - Research

**Researched:** 2026-02-06
**Domain:** MCP tool aggregation, data synthesis, factual observation generation for edge decay analysis
**Confidence:** HIGH

## Summary

Phase 50 builds a single `analyze_edge_decay` MCP tool that calls the 5 existing calculation engines directly (not via MCP tools), aggregates their outputs into a structured response with a top-level summary, per-signal summaries, factual observations, and supporting data. The tool follows the established `registerEdgeDecayTools(server, baseDir)` pattern in `packages/mcp-server/src/tools/edge-decay.ts`, uses the same `withSyncedBlock` middleware, `loadBlock`/`loadReportingLog` utilities, and `createToolOutput` formatter.

The primary engineering challenges are: (1) managing output size -- the rolling metrics series alone produces ~3200 data points for large blocks, so the unified tool must return summary statistics only (with a note to use the standalone tool for the full series), (2) designing the factual observation extraction logic as a pure function in `packages/lib/calculations/`, and (3) structuring the output so the LLM can reason effectively without verdicts or grades.

No new dependencies are needed. All 5 engines are already pure functions exported from `@tradeblocks/lib`. The new code is a synthesis/aggregation engine in lib (pure function) plus a thin MCP tool wrapper.

**Primary recommendation:** Create a pure synthesis engine function `synthesizeEdgeDecay()` in `packages/lib/calculations/edge-decay-synthesis.ts` that takes trades, optional reporting trades, and options, calls all 5 engines internally, extracts observations, and returns a typed result. The MCP tool in `edge-decay.ts` is a thin wrapper that loads data, calls the engine, and formats output via `createToolOutput`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Philosophy: Data, Not Interpretation
- TradeBlocks provides insights through hard data and facts
- The LLM consuming the tool output interprets the results
- No verdicts (Healthy / Severe Decay labels removed)
- No component grades (A-F removed)
- No "actionable" framing -- observations are factual, not prescriptive
- This applies retroactively: Phase 47's regime divergence classification labels (aligned / mild divergence / significant divergence / regime break) should also be revisited as a separate task

#### Requirements Revision
- VERD-01 (was: top-line verdict) -> Replaced with structured top-level summary of key numbers. Claude's discretion on exact structure.
- VERD-02 (was: component grades A-F) -> Replaced with per-signal key metrics. Claude's discretion on what to surface per category.
- VERD-03 (was: actionable flags) -> Replaced with factual observations as structured data objects (not strings). Each observation includes metric, current value, comparison value, delta -- pure math.
- VERD-04, VERD-05 stay as-is (key numbers summary and supporting data are already factual)
- API-01 through API-04 stay as-is (tool registration mechanics unchanged)

#### Factual Observations
- Format: structured data objects the LLM can reason about (not string descriptions)
- Example shape: `{metric, current, comparison, delta, ...}` -- pure numbers and facts
- Trigger logic: Claude's discretion on what warrants an observation
- Source traceability: Claude's discretion on whether to include signal category reference

### Claude's Discretion
- Call strategy: whether to call lib engines directly or MCP tools (likely direct for efficiency)
- Signal selection: whether all 5 always run or caller can pick (likely always-all with graceful skip)
- Sub-tool parameters: whether to expose MC/WF params or use defaults (likely defaults-only for simplicity)
- Response shape: by signal category vs other grouping (likely by signal category to match engines)
- Rolling metrics handling: summary stats only vs downsampled series (constraint: ~3200 points for large blocks)
- Detail level per signal: full detail vs summaries with reference to standalone tools
- Metadata section inclusion
- Top-level summary structure (key numbers + deltas likely)
- Per-signal summary structure

### Deferred Ideas (OUT OF SCOPE)
- Revisit Phase 47's regime divergence classification labels (aligned / mild / significant / regime break) to align with data-not-interpretation philosophy -- separate task outside Phase 50 scope
</user_constraints>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tradeblocks/lib | workspace | All 5 calculation engines, strategy filter, trade types | Pure functions, already tested |
| zod | ^4.0.0 | MCP tool input schema validation | Same as all other MCP tools |
| @modelcontextprotocol/sdk | ^1.11.0 | MCP server tool registration | Foundation of MCP server |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| createToolOutput | n/a (internal) | Format MCP response with text summary + JSON resource | All tool responses |
| withSyncedBlock | n/a (internal) | Sync middleware for single-block tools | Tool registration |
| loadBlock / loadReportingLog | n/a (internal) | Load trade data from filesystem | Data loading in tool wrapper |
| applyStrategyFilter | n/a (internal) | Case-insensitive strategy filtering | Shared filter before engine calls |
| calculateDefaultRecentWindow | n/a (internal) | Auto-calculate recent window size | Default for recentWindow param |

### No New Dependencies Needed
All building blocks exist in the codebase. The synthesis is pure composition.

## Architecture Patterns

### Recommended Project Structure

```
packages/lib/calculations/
  edge-decay-synthesis.ts     # NEW: Pure synthesis engine function
  period-segmentation.ts      # EXISTING: Engine 1
  rolling-metrics.ts          # EXISTING: Engine 2
  mc-regime-comparison.ts     # EXISTING: Engine 3
  walk-forward-degradation.ts # EXISTING: Engine 4
  live-alignment.ts           # EXISTING: Engine 5
  trade-matching.ts           # EXISTING: Shared utilities (applyStrategyFilter)
  index.ts                    # EXISTING: Add export for edge-decay-synthesis

packages/mcp-server/src/tools/
  edge-decay.ts               # EXISTING: Add analyze_edge_decay tool registration (Tool 6)

tests/unit/
  edge-decay-synthesis.test.ts # NEW: Unit tests for the synthesis engine
```

### Pattern 1: Thin MCP Wrapper + Pure Lib Engine

**What:** The MCP tool is a thin wrapper that loads data and delegates to a pure function in lib. This is the established pattern from Phases 46-49.
**When to use:** Always -- every edge decay tool follows this.
**Example from existing code (live alignment tool, edge-decay.ts line 536-632):**
```typescript
// MCP tool wrapper (thin)
server.registerTool("analyze_live_alignment", { ... },
  withSyncedBlock(baseDir, async ({ blockId, strategy, scaling }) => {
    const block = await loadBlock(baseDir, blockId);
    let actualTrades;
    try { actualTrades = await loadReportingLog(baseDir, blockId); } catch { ... }
    const backtestTrades = applyStrategyFilter(block.trades, strategy);
    actualTrades = applyStrategyFilter(actualTrades, strategy);

    // Call pure engine
    const output = analyzeLiveAlignment(backtestTrades, actualTrades, { scaling });

    // Format output
    return createToolOutput(summary, structuredData);
  })
);
```

### Pattern 2: Calling Engines Directly (Not MCP Tools)

**What:** The synthesis engine imports and calls the 5 lib engines directly rather than invoking MCP tools.
**Why:** The MCP tools add overhead (sync middleware, data loading, output formatting) that the synthesis engine doesn't need since it already has the loaded trades. Calling lib functions directly is ~5x more efficient and avoids re-loading the same block 5 times.
**Confidence:** HIGH -- this is the obvious choice since all engines are pure functions that take `Trade[]` and return typed results.

```typescript
// In edge-decay-synthesis.ts
import { segmentByPeriod } from './period-segmentation'
import { computeRollingMetrics } from './rolling-metrics'
import { runRegimeComparison } from './mc-regime-comparison'
import { analyzeWalkForwardDegradation } from './walk-forward-degradation'
import { analyzeLiveAlignment } from './live-alignment'
```

### Pattern 3: Always-All with Graceful Skip

**What:** All 5 signals always run. Live alignment gracefully skips when no reporting log exists (returns `{ available: false, reason: "no reporting log" }`). MC regime comparison requires >= 30 trades and gracefully skips otherwise. No caller-selectable signal subset.
**Why:** Simplifies the API (no `signals` array parameter), ensures consistent output shape, and the LLM always gets the full picture. Signals that can't run return a skip indicator with reason.
**Confidence:** HIGH -- matches the existing `LiveAlignmentSkipped` pattern.

### Pattern 4: Defaults-Only for Sub-Tool Parameters

**What:** The unified tool uses default parameters for all 5 engines. Only `blockId`, `recentWindow`, and `strategy` are exposed as tool inputs. MC simulation count, WF window sizes, etc. use their defaults.
**Why:** The unified tool is for overview. Users wanting to customize MC or WF parameters use the standalone tools. This keeps the API surface minimal.
**Confidence:** HIGH -- matches user's "likely defaults-only for simplicity" note.

### Pattern 5: Rolling Metrics -- Summary Only, No Series

**What:** The unified tool includes rolling metrics `recentVsHistorical` comparison, `seasonalAverages`, and `dataQuality` but NOT the full `series` array. The text summary mentions the standalone tool for the full rolling series.
**Why:** The series array produces ~3200 data points for large blocks (~320KB JSON). Including it would blow up the MCP response. The `recentVsHistorical` metrics contain the most decision-relevant data (deltas, structural flags).
**Confidence:** HIGH -- this is the constraint stated in the requirements.

### Pattern 6: Response Structure -- By Signal Category

**What:** The response object is organized by signal category matching the engines:
```typescript
{
  summary: { ... },         // VERD-01, VERD-04: Top-level key numbers
  observations: [ ... ],    // VERD-03: Factual observations
  signals: {
    periodMetrics: { ... },     // VERD-02, VERD-05
    rollingMetrics: { ... },    // VERD-02, VERD-05
    regimeComparison: { ... },  // VERD-02, VERD-05
    walkForward: { ... },       // VERD-02, VERD-05
    liveAlignment: { ... },     // VERD-02, VERD-05
  },
  metadata: { ... },
}
```
**Why:** Maps 1:1 to the 5 engines, making it easy for the LLM to drill into any signal. Each signal section has its own `summary` (key metrics) and `detail` (supporting data).
**Confidence:** HIGH -- matches user's "likely by signal category to match engines" note.

### Anti-Patterns to Avoid
- **Including verdict labels or grades:** The user explicitly removed these. No "Healthy", "Severe Decay", "A-F grades", or any interpretive language. Only numbers and facts.
- **Including the full rolling series:** Will exceed MCP output limits. Summary stats only.
- **Re-loading the block for each engine:** Load once, pass trades to all 5 engines.
- **Calling MCP tools instead of lib engines:** Wastes resources on sync/load/format overhead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recent window calculation | Custom recent window logic | `calculateDefaultRecentWindow()` from rolling-metrics.ts | Already tested, handles edge cases |
| Strategy filtering | Custom filter | `applyStrategyFilter()` from trade-matching.ts | Generic, case-insensitive, works with Trade and ReportingTrade |
| Period metrics | Custom per-period stats | `segmentByPeriod()` | Full engine with trends and losing streaks |
| Rolling comparison | Custom recent/historical split | `computeRollingMetrics()` (use recentVsHistorical from result) | Has structural flags, delta computation |
| MC simulation | Custom MC | `runRegimeComparison()` | Handles all MC params, divergence scoring |
| Walk-forward | Custom WF | `analyzeWalkForwardDegradation()` | Complete IS/OOS with efficiency trends |
| Live alignment | Custom matching | `analyzeLiveAlignment()` | Trade matching, direction agreement, efficiency |
| Output formatting | Custom MCP response | `createToolOutput()` | Consistent JSON-first pattern |

**Key insight:** Phase 50 is pure composition. Every calculation primitive already exists. The new code is: (1) calling all 5, (2) extracting observations from their results, (3) building the summary.

## Common Pitfalls

### Pitfall 1: Output Size Explosion
**What goes wrong:** Including full rolling series, full MC percentile arrays, or full period breakdown arrays in the unified response exceeds MCP output limits (~50KB practical limit for LLM reasoning).
**Why it happens:** Each engine returns comprehensive data designed for standalone use.
**How to avoid:** For rolling metrics, include only `recentVsHistorical`, `seasonalAverages`, and `dataQuality` -- not `series`. For MC, include statistics and comparison but not individual simulation paths. For period metrics, include yearly and quarterly summaries but consider truncating monthly to just the most recent year or a count. For WF, include periods but they're typically 5-15 items (manageable).
**Warning signs:** JSON.stringify of the response exceeds 50KB.

### Pitfall 2: Observation Trigger Thresholds That Are Interpretive
**What goes wrong:** Observations say things like "win rate is dangerously low" or use subjective thresholds.
**Why it happens:** Natural tendency to add interpretation.
**How to avoid:** Observations are pure structured data objects: `{ metric, signal, current, comparison, delta, percentChange }`. The trigger is a simple threshold crossing (e.g., recent profitFactor < 1.0 AND historical >= 1.0). No adjectives, no interpretation. The existing `StructuralFlag` interface from rolling-metrics.ts is the exact pattern to follow.
**Warning signs:** Any string field that contains an adjective.

### Pitfall 3: MC Regime Comparison Throwing on Small Blocks
**What goes wrong:** `runRegimeComparison()` throws if trades < 30. The unified tool crashes instead of gracefully skipping.
**Why it happens:** MC requires minimum sample size.
**How to avoid:** Wrap the MC call in try/catch and return `{ available: false, reason: "..." }` matching the `LiveAlignmentSkipped` pattern.
**Warning signs:** Error message "Insufficient trades for regime comparison".

### Pitfall 4: Live Alignment Reporting Log Missing
**What goes wrong:** `loadReportingLog()` throws when no reporting log CSV exists.
**Why it happens:** Not all blocks have reporting logs.
**How to avoid:** The existing live alignment MCP tool already handles this with a try/catch returning a graceful skip. The synthesis engine must do the same -- either accept `ReportingTrade[] | undefined` or catch internally.
**Warning signs:** Error message "reportinglog.csv not found".

### Pitfall 5: Walk-Forward Producing Zero Periods
**What goes wrong:** Short-history blocks produce no WF periods, resulting in empty/null results.
**Why it happens:** The WF engine requires IS+OOS window span that may exceed the block's trade history.
**How to avoid:** Check `result.dataQuality.totalPeriods === 0` and include the data quality warnings. This is not a skip -- it's a valid result with empty periods.
**Warning signs:** Empty `periods` array.

### Pitfall 6: Forgetting to Register in cli-handler.ts
**What goes wrong:** The tool works in MCP server mode but not with `--call` CLI mode.
**Why it happens:** cli-handler.ts maintains a separate tool registry from index.ts.
**How to avoid:** The tool is added inside the existing `registerEdgeDecayTools()` function which is already called from both `index.ts` AND `cli-handler.ts`. No separate registration needed -- just add it as Tool 6 in the same function.
**Warning signs:** `--call analyze_edge_decay '{...}'` returns "Tool not found".

## Code Examples

### Engine Function Signatures (Existing)

```typescript
// Period Segmentation (packages/lib/calculations/period-segmentation.ts)
export function segmentByPeriod(trades: Trade[]): PeriodSegmentationResult

// Rolling Metrics (packages/lib/calculations/rolling-metrics.ts)
export function computeRollingMetrics(trades: Trade[], options?: RollingMetricsOptions): RollingMetricsResult

// MC Regime Comparison (packages/lib/calculations/mc-regime-comparison.ts)
export function runRegimeComparison(trades: Trade[], options?: MCRegimeComparisonOptions): MCRegimeComparisonResult
// Throws if trades.length < 30

// Walk-Forward Degradation (packages/lib/calculations/walk-forward-degradation.ts)
export function analyzeWalkForwardDegradation(trades: Trade[], options?: Partial<WFDConfig>): WFDResult

// Live Alignment (packages/lib/calculations/live-alignment.ts)
export function analyzeLiveAlignment(
  backtestTrades: Trade[],
  actualTrades: ReportingTrade[],
  options?: LiveAlignmentOptions
): LiveAlignmentOutput  // LiveAlignmentResult | LiveAlignmentSkipped
```

### Default Recent Window Calculation (Existing)

```typescript
// packages/lib/calculations/rolling-metrics.ts
export function calculateDefaultRecentWindow(tradeCount: number): number {
  const twentyPercent = Math.round(tradeCount * 0.2)
  const defaultN = Math.max(twentyPercent, 200)
  return Math.min(defaultN, tradeCount)
}
```

This matches API-02: "~20% of total trades or last 200, whichever is larger".

### Recommended Synthesis Engine Shape

```typescript
// packages/lib/calculations/edge-decay-synthesis.ts

export interface EdgeDecaySynthesisOptions {
  /** Number of recent trades for comparison. Default: auto-calculated via calculateDefaultRecentWindow. */
  recentWindow?: number
}

export interface FactualObservation {
  /** Which signal category produced this observation */
  signal: string
  /** Metric name, e.g. "profitFactor", "winRate", "sharpeEfficiency" */
  metric: string
  /** Current/recent value */
  current: number
  /** Comparison/historical value */
  comparison: number
  /** current - comparison */
  delta: number
  /** Relative change as percentage, null if comparison is 0 */
  percentChange: number | null
}

export interface SignalResult<T> {
  available: boolean
  reason?: string
  summary: Record<string, number | string | null>
  detail: T | null
}

export interface EdgeDecaySynthesisResult {
  summary: { ... }  // Top-level key numbers
  observations: FactualObservation[]
  signals: {
    periodMetrics: SignalResult<...>
    rollingMetrics: SignalResult<...>
    regimeComparison: SignalResult<...>
    walkForward: SignalResult<...>
    liveAlignment: SignalResult<...>
  }
  metadata: {
    blockId: string
    strategy: string | null
    totalTrades: number
    recentWindow: number
    dateRange: { start: string; end: string }
    signalsRun: number
    signalsSkipped: number
  }
}

export function synthesizeEdgeDecay(
  trades: Trade[],
  actualTrades: ReportingTrade[] | undefined,
  options?: EdgeDecaySynthesisOptions
): EdgeDecaySynthesisResult
```

### Recommended Observation Extraction Logic

Observations are extracted from each engine's result when specific threshold crossings occur. These use the SAME thresholds already in the codebase (structural flags from rolling metrics, divergence scores from MC, etc.):

```typescript
function extractObservations(
  periodResult: PeriodSegmentationResult,
  rollingResult: RollingMetricsResult,
  regimeResult: MCRegimeComparisonResult | null,
  wfResult: WFDResult,
  liveResult: LiveAlignmentOutput,
): FactualObservation[] {
  const observations: FactualObservation[] = []

  // From rolling metrics: structural flags are already threshold crossings
  for (const flag of rollingResult.recentVsHistorical.structuralFlags) {
    observations.push({
      signal: 'rollingMetrics',
      metric: flag.metric,
      current: flag.recentValue,
      comparison: flag.historicalValue,
      delta: flag.recentValue - flag.historicalValue,
      percentChange: flag.historicalValue !== 0
        ? ((flag.recentValue - flag.historicalValue) / Math.abs(flag.historicalValue)) * 100
        : null,
    })
  }

  // From rolling metrics: any recentVsHistorical metric with > 20% relative decline
  for (const m of rollingResult.recentVsHistorical.metrics) {
    if (m.percentChange !== null && m.percentChange < -20) {
      observations.push({
        signal: 'rollingMetrics',
        metric: m.metric,
        current: m.recentValue,
        comparison: m.historicalValue,
        delta: m.delta,
        percentChange: m.percentChange,
      })
    }
  }

  // From MC: any metric comparison with >20% relative change
  if (regimeResult) {
    for (const c of regimeResult.comparison) {
      if (c.percentChange !== null && Math.abs(c.percentChange) > 20) {
        observations.push({
          signal: 'regimeComparison',
          metric: c.metric,
          current: c.recentWindowValue,
          comparison: c.fullHistoryValue,
          delta: c.delta,
          percentChange: c.percentChange,
        })
      }
    }
  }

  // From WF: efficiency delta > 0.2 between recent and historical
  // From period: negative yearly trend slope for key metrics
  // From live: low direction agreement or execution efficiency

  return observations
}
```

### Recommended MCP Tool Registration

```typescript
// Added as Tool 6 inside registerEdgeDecayTools() in edge-decay.ts
server.registerTool(
  "analyze_edge_decay",
  {
    description:
      "Run comprehensive edge decay analysis combining all 5 signal categories: period metrics, rolling metrics, Monte Carlo regime comparison, walk-forward degradation, and live alignment. Returns structured factual data for LLM interpretation -- no verdicts or grades. Use standalone tools (analyze_period_metrics, etc.) for detailed drill-down.",
    inputSchema: z.object({
      blockId: z.string().describe("Block folder name"),
      strategy: z.string().optional().describe("Filter by strategy name (case-insensitive)"),
      recentWindow: z.number().min(10).optional().describe(
        "Number of recent trades for comparison (default: auto-calculated as max(20% of trades, 200))"
      ),
    }),
  },
  withSyncedBlock(baseDir, async ({ blockId, strategy, recentWindow }) => {
    // Load data once
    const block = await loadBlock(baseDir, blockId);
    const trades = applyStrategyFilter(block.trades, strategy);

    let actualTrades: ReportingTrade[] | undefined;
    try {
      const raw = await loadReportingLog(baseDir, blockId);
      actualTrades = applyStrategyFilter(raw, strategy);
    } catch {
      actualTrades = undefined;
    }

    // Call pure synthesis engine
    const result = synthesizeEdgeDecay(trades, actualTrades, { recentWindow });

    return createToolOutput(summaryText, result);
  })
);
```

## Discretion Recommendations

Based on research of the codebase, here are recommendations for areas marked as Claude's discretion:

### Call Strategy: Direct Lib Engines
**Recommendation:** Call lib engine functions directly, not MCP tools.
**Rationale:** All 5 engines are pure functions that take `Trade[]` and options. The MCP tools add sync middleware, data re-loading, and output formatting overhead. Loading the block once and passing trades to all 5 engines is dramatically more efficient. Confirmed by code inspection: all engines are importable from `@tradeblocks/lib`.

### Signal Selection: Always-All with Graceful Skip
**Recommendation:** Always run all 5 signals. Gracefully skip when prerequisites aren't met.
**Rationale:** Simplest API, consistent output shape. Three signals can skip: (1) MC if < 30 trades, (2) Live alignment if no reporting log, (3) WF may produce empty periods if history too short. Period and rolling metrics always run if there are any trades.

### Sub-Tool Parameters: Defaults Only
**Recommendation:** Only expose `blockId`, `strategy`, and `recentWindow`. Use engine defaults for everything else (MC: 1000 sims, seed 42; WF: IS=365d, OOS=90d, step=90d).
**Rationale:** The unified tool is the overview. Custom parameters are for the standalone tools. This keeps the Zod schema simple (3 params vs 15+).

### Response Shape: By Signal Category
**Recommendation:** Organize by `signals.periodMetrics`, `signals.rollingMetrics`, etc.
**Rationale:** Maps 1:1 to engines and standalone tools. The LLM can reference specific signals when explaining findings. The user confirmed this is "likely".

### Rolling Metrics: Summary Only
**Recommendation:** Include `recentVsHistorical` (with structural flags), `seasonalAverages`, and `dataQuality` but NOT the full `series` array. Note the standalone tool for full series.
**Rationale:** The series produces ~3200 data points for large blocks. The comparison metrics contain the most decision-relevant deltas. The `seriesPointCount` can be included in metadata so the LLM knows the data exists.

### Detail Level: Full Detail Except Rolling Series
**Recommendation:** Include full `yearly`/`quarterly` period arrays (typically 3-8 items each), full `comparison` array from MC (4 items), full `periods` array from WF (typically 5-15 items), full alignment data. Only truncate rolling series.
**Rationale:** These arrays are small. Monthly periods could be large (36+ items for 3-year blocks) -- include count but truncate to last 12 months.

### Metadata Section: Include
**Recommendation:** Include a metadata section with blockId, strategy, totalTrades, recentWindow used, dateRange, signalsRun count, signalsSkipped count, and execution timing.
**Rationale:** Helps the LLM contextualize results and mention block details in its response.

### Top-Level Summary Structure
**Recommendation:** A flat object with key numbers from each signal:
```typescript
summary: {
  totalTrades: number,
  recentWindow: number,
  recentWinRate: number,
  historicalWinRate: number,
  recentProfitFactor: number,
  historicalProfitFactor: number,
  recentSharpe: number | null,
  historicalSharpe: number | null,
  mcProbabilityOfProfit: { full: number, recent: number } | null,
  wfEfficiencyTrend: { sharpe: number | null, winRate: number | null } | null,
  liveDirectionAgreement: number | null,
  liveExecutionEfficiency: number | null,
  observationCount: number,
  structuralFlagCount: number,
}
```

### Observation Trigger Logic
**Recommendation:** Surface observations for:
1. Rolling metrics structural flags (already computed by engine: win rate crossing 50%, PF crossing 1.0, Kelly going negative, payoff inversion)
2. Rolling metrics comparison: any metric with > 20% relative decline
3. MC regime comparison: any of the 4 metrics with > 20% relative change
4. WF degradation: recent avg efficiency significantly below historical (delta < -0.2 for any metric)
5. Period trends: negative yearly slope for win rate or profit factor (only if sufficient for trends)
6. Live alignment: direction agreement rate < 70% or execution efficiency < 0.8

Each observation includes: `{ signal, metric, current, comparison, delta, percentChange }`.

### Source Traceability: Include Signal Reference
**Recommendation:** Include `signal` field in each observation indicating which signal category produced it.
**Rationale:** Allows the LLM to reference the standalone tool for deeper investigation.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Verdict labels (Healthy/Severe Decay) | Structured data only | Phase 50 context discussion | No interpretive output |
| Component grades (A-F) | Per-signal key metrics | Phase 50 context discussion | Pure numbers |
| Actionable flags (strings) | Factual observations (data objects) | Phase 50 context discussion | `{metric, current, comparison, delta}` not strings |

## Open Questions

1. **Monthly period truncation**
   - What we know: Monthly periods can be 36+ items for multi-year blocks. Yearly (3-5) and quarterly (12-20) are manageable.
   - What's unclear: Whether to include all monthly periods or just recent 12 months.
   - Recommendation: Include count of all months but only last 12 months of detail. The standalone tool has full data.

2. **MC seed determinism**
   - What we know: MC uses seed 42 by default. The synthesis engine will also use seed 42.
   - What's unclear: Whether running the standalone MC tool and the unified tool should produce identical MC results.
   - Recommendation: Use same defaults so results match. Don't randomize seed.

3. **Output size budget**
   - What we know: MCP responses should stay under ~50KB for effective LLM reasoning.
   - What's unclear: Exact size of the full response with all 5 signals.
   - Recommendation: Measure during implementation. If over budget, truncate monthly periods further.

## Sources

### Primary (HIGH confidence)
- `packages/lib/calculations/period-segmentation.ts` -- Engine 1 interface and function signature
- `packages/lib/calculations/rolling-metrics.ts` -- Engine 2 interface, `calculateDefaultRecentWindow`, `StructuralFlag` pattern
- `packages/lib/calculations/mc-regime-comparison.ts` -- Engine 3 interface, throws on < 30 trades
- `packages/lib/calculations/walk-forward-degradation.ts` -- Engine 4 interface, WFDResult type
- `packages/lib/calculations/live-alignment.ts` -- Engine 5 interface, LiveAlignmentOutput union type, graceful skip pattern
- `packages/mcp-server/src/tools/edge-decay.ts` -- All 5 existing MCP tools, `registerEdgeDecayTools` function
- `packages/mcp-server/src/utils/output-formatter.ts` -- `createToolOutput` pattern
- `packages/mcp-server/src/utils/block-loader.ts` -- `loadBlock`, `loadReportingLog`
- `packages/mcp-server/src/tools/middleware/sync-middleware.ts` -- `withSyncedBlock`
- `packages/lib/calculations/index.ts` -- Export barrel file
- `.planning/phases/50-verdict-synthesis-tool-registration/50-CONTEXT.md` -- User decisions

### Secondary (MEDIUM confidence)
- `.planning/phases/46-core-calculation-engines/46-RESEARCH.md` -- Established architecture patterns
- `.planning/REQUIREMENTS.md` -- VERD-01 through API-04 requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already in project, no new installs
- Architecture: HIGH -- follows established patterns from Phases 46-49, verified by reading all 5 engines and tool wrappers
- Pitfalls: HIGH -- identified from actual code inspection (MC throw, reporting log missing, rolling series size)

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable internal architecture, no external dependencies)
