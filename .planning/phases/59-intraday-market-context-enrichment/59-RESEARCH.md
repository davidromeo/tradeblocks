# Phase 59: Intraday Market Context Enrichment - Research

**Researched:** 2026-02-08
**Domain:** MCP tool extension / DuckDB intraday checkpoint matching / time-based trade enrichment
**Confidence:** HIGH

## Summary

This phase extends the `enrich_trades` MCP tool (built in Phase 57) with intraday market context from two DuckDB tables: `market.spx_15min` (26 price checkpoints at 15-minute intervals from 0930-1545, plus 4 percentage moves, 4 MOC moves, 1 afternoon move = 35 data fields) and `market.vix_intraday` (14 VIX checkpoints at 30-minute intervals from 0930-1545, plus 13 movement/flag metrics = 27 data fields). Both tables are keyed by date (VARCHAR, YYYY-MM-DD).

The critical design question is **temporal semantics**: unlike spx_daily where fields are classified as open/close/static, intraday checkpoints have a third temporal dimension -- each checkpoint is known at its specific timestamp. A trade entered at 09:35 can see P_0930 but not P_0945. However, the REQUIREMENTS.md Out of Scope section explicitly called out "Per-trade time-of-day awareness" as "Massive complexity for marginal benefit; most 0DTE trades open 9:30-9:45 AM." This creates a fundamental tension: the user deferred this to its own phase, suggesting they want it done, but the requirements document flags it as potentially not worth the complexity.

After thorough investigation, the recommended approach is a **practical middle ground**: rather than full per-checkpoint temporal filtering, provide two enrichment modes. The **default mode** returns day-level aggregate metrics from both tables (MOC moves, afternoon move, VIX spike/crush flags, full-day moves) that are outcome-like and clearly labeled as such. The **time-aware mode** (opt-in) uses the trade's `timeOpened` field to determine which checkpoints were known at entry time and returns only those, plus a computed "SPX price at entry" from the nearest prior checkpoint. This leverages the existing `timeOpened` field (HH:mm:ss format, Eastern Time) that every trade already has.

**Primary recommendation:** Add a new `includeIntradayContext` parameter to the existing `enrich_trades` tool (not a separate tool) that queries spx_15min and vix_intraday by date, then uses `timeOpened` to filter checkpoints to only those known at trade entry time. Day-level aggregates (MOC, afternoon move, VIX flags) go in outcomeFields since they require end-of-day data.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.0.0 | Input schema validation | Already used by enrich_trades |
| @duckdb/node-api | ^1.4.4-r.1 | DuckDB queries for market data | Existing connection manager |
| @tradeblocks/lib | workspace | Trade type (timeOpened field) | Already imported in market-data.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| field-timing.ts | internal | Existing field classification | Not directly applicable -- spx_15min/vix_intraday don't have timing annotations |
| schema-metadata.ts | internal | SCHEMA_DESCRIPTIONS | Already has spx_15min and vix_intraday table metadata |
| market-data.ts | internal | formatTradeDate(), resultToRecords(), getNum() | Reuse for date formatting and result parsing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending enrich_trades | Separate tool (e.g., enrich_trades_intraday) | More parameters on enrich_trades vs tool fragmentation; single tool is cleaner since the output is still "enriched trades" |
| Time-based checkpoint filtering in JS | DuckDB UNPIVOT + time filtering | UNPIVOT adds SQL complexity; JS filtering on wide-format columns is simpler and the data volume (1 row per trade per day) is trivial |
| Full checkpoint array per trade | Pre-computed derived metrics only | Full checkpoints enable richer downstream analysis (e.g., "what was SPX doing when I entered?") |

**Installation:** No new packages required. All dependencies already exist.

## Architecture Patterns

### Recommended Project Structure
```
packages/mcp-server/src/
  tools/
    market-data.ts          # Extend enrich_trades handler (add intraday queries)
  utils/
    schema-metadata.ts      # Already has spx_15min + vix_intraday metadata (no changes needed)
    intraday-timing.ts      # NEW: checkpoint time constants and temporal filtering logic
```

### Pattern 1: Time-Based Checkpoint Filtering
**What:** Given a trade's `timeOpened` (e.g., "09:35:00"), determine which intraday checkpoints were known at that time.
**When to use:** Building the per-trade intraday context.
**Example:**
```typescript
// Checkpoint times as HHMM integers for easy comparison
const SPX_CHECKPOINTS = [
  930, 945, 1000, 1015, 1030, 1045, 1100, 1115, 1130, 1145,
  1200, 1215, 1230, 1245, 1300, 1315, 1330, 1345, 1400, 1415,
  1430, 1445, 1500, 1515, 1530, 1545,
] as const;

const VIX_CHECKPOINTS = [
  930, 1000, 1030, 1100, 1130, 1200, 1230, 1300,
  1330, 1400, 1430, 1500, 1530, 1545,
] as const;

/**
 * Parse timeOpened "HH:mm:ss" to HHMM integer for comparison.
 * e.g., "09:35:00" -> 935, "14:30:00" -> 1430
 */
function parseTimeToHHMM(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 100 + minutes;
}

/**
 * Get checkpoint field names known at or before the given time.
 * A checkpoint at time T is known at time T (the price has printed).
 */
function getKnownSpxCheckpoints(tradeTimeHHMM: number): string[] {
  return SPX_CHECKPOINTS
    .filter(cp => cp <= tradeTimeHHMM)
    .map(cp => `P_${String(cp).padStart(4, '0')}`);
}

function getKnownVixCheckpoints(tradeTimeHHMM: number): string[] {
  return VIX_CHECKPOINTS
    .filter(cp => cp <= tradeTimeHHMM)
    .map(cp => `VIX_${String(cp).padStart(4, '0')}`);
}
```

### Pattern 2: Intraday Context Output Structure
**What:** Per-trade intraday context with clear temporal provenance.
**When to use:** Building enriched trade output when `includeIntradayContext=true`.
**Example output shape:**
```typescript
{
  // Existing enrich_trades fields...
  dateOpened: "2024-03-15",
  timeOpened: "09:35:00",
  entryContext: { sameDay: {...}, priorDay: {...} },  // existing spx_daily

  // NEW: intraday context
  intradayContext: {
    tradeEntryTime: "09:35:00",           // Echo for clarity
    tradeEntryTimeHHMM: 935,              // Parsed for programmatic use
    spx: {
      // Only checkpoints known at 09:35 (i.e., P_0930)
      knownCheckpoints: { P_0930: 5234.50 },
      // Nearest checkpoint at or before entry
      nearestCheckpoint: { time: "0930", price: 5234.50 },
      // Move from open to nearest checkpoint (if > open)
      moveFromOpen: 0.15,  // percent
    },
    vix: {
      // Only checkpoints known at 09:35 (i.e., VIX_0930)
      knownCheckpoints: { VIX_0930: 14.25 },
      nearestCheckpoint: { time: "0930", value: 14.25 },
    },
  },
}
```

### Pattern 3: Day-Level Aggregates as Outcome Fields
**What:** MOC moves, afternoon move, VIX spike/crush flags, and full-day moves are end-of-day metrics. They go in `outcomeFields` (alongside the spx_daily outcome fields) when `includeOutcomeFields=true`.
**When to use:** Post-hoc analysis of how the day played out after trade entry.
**Rationale:** Consistent with the Phase 57 outcome fields ethos -- separate structural boundary between what was known at entry and what happened after.

### Anti-Patterns to Avoid
- **Returning all 26 checkpoints regardless of entry time:** This is lookahead bias for intraday data. A trade at 09:35 should not see P_1000.
- **Treating intraday tables like spx_daily (open/close classification):** The checkpoint model is fundamentally different. Each checkpoint has its own specific timestamp, not a binary open/close classification.
- **Adding timing annotations to spx_15min/vix_intraday columns in schema-metadata.ts:** The timing property is designed for the open/close/static model of spx_daily. Checkpoints don't fit this model. Don't force them.
- **Separate DuckDB query per trade:** Query once per date, match in memory. The wide-format (1 row per date) means a single query gets all checkpoint data for a date.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date matching | Custom date logic | Existing `formatTradeDate()` | Already handles Eastern Time correctly |
| DuckDB result parsing | Custom row iteration | Existing `resultToRecords()` | Handles BigInt conversion |
| Response formatting | Manual JSON | Existing `createToolOutput()` | Universal MCP response pattern |
| Trade filtering | Custom filter | Existing `filterByStrategy()`, `filterByDateRange()` | Already tested |
| Checkpoint time constants | Hardcoded in tool handler | Extracted to `intraday-timing.ts` utility | Reusable by calculate_orb and future tools |

**Key insight:** The main new code is (1) the time parsing/comparison logic and (2) the checkpoint filtering per trade. Everything else reuses Phase 57 infrastructure.

## Common Pitfalls

### Pitfall 1: Trades With Missing or Invalid timeOpened
**What goes wrong:** Some trades might have `timeOpened` as "00:00:00" (default from trade processor when missing) or an unexpected format.
**Why it happens:** The trade processor defaults to "00:00:00" when Time Opened is empty in CSV.
**How to avoid:** When `timeOpened` is "00:00:00" or unparseable, either (a) skip intraday enrichment for that trade and set `intradayContext: null` with a note, or (b) treat it as "market open" (09:30) since 0DTE trades almost always open at or near 9:30. Option (b) is pragmatic given the user's note that "most 0DTE trades open 9:30-9:45 AM."
**Warning signs:** Trades showing no intraday context when they should have it.

### Pitfall 2: Two Extra DuckDB Queries Per Request
**What goes wrong:** Adding intraday enrichment means 2 more DuckDB queries (spx_15min + vix_intraday) on top of the existing 1-2 queries (spx_daily + optional outcome). This could slow down the tool.
**Why it happens:** Each table is separate in DuckDB.
**How to avoid:** Only run the intraday queries when `includeIntradayContext=true`. Make it opt-in like `includeOutcomeFields`. The queries themselves are fast (IN clause on date VARCHAR, returns 1 row per date).
**Warning signs:** Noticeable latency increase when all options enabled.

### Pitfall 3: Output Size Explosion
**What goes wrong:** With spx_daily (55 fields), spx_15min (35 fields), and vix_intraday (27 fields), each enriched trade could have 100+ fields of market context. At 50 trades, that's 5000+ data points.
**Why it happens:** The Phase 57 design returns "full context" for spx_daily. Doing the same for intraday would be excessive.
**How to avoid:** For intraday context, return only the checkpoints known at entry time (typically 0-1 for 9:30-9:45 entries) plus nearest checkpoint info. Day-level aggregates go in outcomeFields only when requested. This keeps the default output lean.
**Warning signs:** MCP tool responses exceeding context window limits.

### Pitfall 4: Checkpoint Column Name Format Mismatch
**What goes wrong:** SPX checkpoints use `P_HHMM` format (e.g., `P_0930`) while VIX checkpoints use `VIX_HHMM` format (e.g., `VIX_0930`). These prefixes are different.
**Why it happens:** Different table schemas from different PineScript exports.
**How to avoid:** Use separate checkpoint-to-field-name mappings for each table. The constants in `intraday-timing.ts` handle this.
**Warning signs:** Missing checkpoint values due to wrong column name lookup.

### Pitfall 5: VIX Checkpoints Are 30-Minute, Not 15-Minute
**What goes wrong:** Assuming VIX checkpoints match SPX 15-minute intervals. VIX has 14 checkpoints at 30-minute intervals (0930, 1000, 1030..., 1530, 1545), not 26 at 15-minute.
**Why it happens:** Phase description says "14 VIX checkpoints" but it's easy to assume matching granularity.
**How to avoid:** Maintain separate checkpoint arrays for SPX and VIX. The nearest-checkpoint logic must use the correct array for each table.
**Warning signs:** Null values for VIX checkpoints at odd 15-minute marks (e.g., VIX_0945 doesn't exist).

### Pitfall 6: No Timing Annotations on Intraday Tables
**What goes wrong:** Attempting to use `OPEN_KNOWN_FIELDS`/`CLOSE_KNOWN_FIELDS` patterns from `field-timing.ts` for intraday tables. These sets only cover `spx_daily`.
**Why it happens:** Phase 55 only added timing annotations to spx_daily in schema-metadata.ts. The intraday tables have no timing property on their columns.
**How to avoid:** Don't use the field-timing.ts infrastructure for intraday enrichment. The temporal logic is fundamentally different (per-checkpoint timestamps vs. open/close binary). Build separate checkpoint-timing logic in `intraday-timing.ts`.
**Warning signs:** Empty field sets if you try to filter schema-metadata by timing for non-spx_daily tables.

## Code Examples

### Example 1: Intraday Query Builder
```typescript
// Source: derived from existing patterns in market-data.ts
function buildIntradayQuery(
  table: 'market.spx_15min' | 'market.vix_intraday',
  tradeDates: string[]
): { sql: string; params: string[] } {
  const placeholders = tradeDates.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `SELECT * FROM ${table} WHERE date IN (${placeholders})`;
  return { sql, params: tradeDates };
}
```

### Example 2: Per-Trade Intraday Context Builder
```typescript
// Source: new logic combining existing patterns
function buildIntradayContext(
  tradeTimeOpened: string,
  spxData: Record<string, unknown> | null,
  vixData: Record<string, unknown> | null,
): IntradayContext | null {
  if (!spxData && !vixData) return null;

  const tradeTimeHHMM = parseTimeToHHMM(tradeTimeOpened);

  const spxContext: Record<string, unknown> = {};
  const vixContext: Record<string, unknown> = {};

  if (spxData) {
    const knownCheckpoints: Record<string, unknown> = {};
    let nearestTime = '';
    let nearestPrice: number | null = null;

    for (const cp of SPX_CHECKPOINTS) {
      if (cp <= tradeTimeHHMM) {
        const field = `P_${String(cp).padStart(4, '0')}`;
        const val = spxData[field];
        if (val !== null && val !== undefined) {
          knownCheckpoints[field] = typeof val === 'bigint' ? Number(val) : val;
          nearestTime = String(cp).padStart(4, '0');
          nearestPrice = typeof val === 'bigint' ? Number(val) : val as number;
        }
      }
    }

    spxContext.knownCheckpoints = knownCheckpoints;
    spxContext.nearestCheckpoint = nearestPrice !== null
      ? { time: nearestTime, price: nearestPrice }
      : null;

    // Move from day open to nearest checkpoint
    const openPrice = spxData['open'] as number;
    if (nearestPrice !== null && openPrice > 0) {
      spxContext.moveFromOpen = Math.round(((nearestPrice - openPrice) / openPrice) * 10000) / 100;
    }
  }

  // Similar logic for VIX...

  return {
    tradeEntryTime: tradeTimeOpened,
    tradeEntryTimeHHMM: tradeTimeHHMM,
    spx: Object.keys(spxContext).length > 0 ? spxContext : null,
    vix: Object.keys(vixContext).length > 0 ? vixContext : null,
  };
}
```

### Example 3: Extending enrich_trades Input Schema
```typescript
// Source: extending existing pattern in market-data.ts
inputSchema: z.object({
  blockId: z.string().describe("Block ID to enrich"),
  strategy: z.string().optional().describe("Filter to specific strategy (exact match)"),
  startDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
  endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
  includeOutcomeFields: z.boolean().default(false).describe(
    "Include same-day close values (lookahead). Defaults to false for safety."
  ),
  includeIntradayContext: z.boolean().default(false).describe(
    "Include intraday SPX/VIX checkpoint data. Only checkpoints known at trade entry time are returned."
  ),
  limit: z.number().min(1).max(500).default(50).describe("Max trades to return (default: 50, max: 500)"),
  offset: z.number().min(0).default(0).describe("Pagination offset (default: 0)"),
}),
```

### Example 4: Day-Level Aggregate Fields for Outcome
```typescript
// These spx_15min fields are end-of-day aggregates -> outcomeFields
const SPX_15MIN_OUTCOME_FIELDS = [
  'Pct_0930_to_1000', 'Pct_0930_to_1200', 'Pct_0930_to_1500', 'Pct_0930_to_Close',
  'MOC_15min', 'MOC_30min', 'MOC_45min', 'MOC_60min',
  'Afternoon_Move',
] as const;

// These vix_intraday fields are end-of-day aggregates -> outcomeFields
const VIX_OUTCOME_FIELDS = [
  'VIX_Day_High', 'VIX_Day_Low',
  'VIX_Morning_Move', 'VIX_Afternoon_Move', 'VIX_Power_Hour_Move',
  'VIX_Last_30min_Move', 'VIX_Full_Day_Move', 'VIX_First_Hour_Move',
  'VIX_Intraday_Range_Pct', 'VIX_Spike_From_Open', 'VIX_Spike_Flag',
  'VIX_Crush_From_Open', 'VIX_Crush_Flag', 'VIX_Close_In_Range',
] as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No intraday enrichment | enrich_trades returns only spx_daily context | Phase 57, 2026-02-08 | Foundation exists but missing 15min/VIX data |
| calculate_orb queries spx_15min directly | ORB tool exists but isn't per-trade | Phase 45 (original) | Shows the query pattern works |
| Out of Scope: per-trade time-of-day | This phase implements it | Phase 59 (this phase) | Reverses the out-of-scope decision from REQUIREMENTS.md |

**Key context changes since requirements were written:**
- `enrich_trades` now exists with a clean extension point (`entryContext` structure)
- `timeOpened` field is already present in every enriched trade output (line 777 of market-data.ts)
- The field-timing infrastructure from Phases 55-56 doesn't need to be extended (intraday uses a different temporal model)
- The "most 0DTE trades open 9:30-9:45 AM" observation actually makes time-based filtering simpler, not harder: most trades will have 0-1 known checkpoints, keeping output small

## Open Questions

1. **Should intradayContext be opt-in or always included?**
   - What we know: The Phase 57 pattern is opt-in for expensive/lookahead data. Intraday checkpoint data at entry time is NOT lookahead (it was known at entry). But it adds 2 DuckDB queries.
   - What's unclear: Whether users will always want intraday context or only sometimes.
   - Recommendation: Opt-in via `includeIntradayContext=true`. Keeps backward compatibility, avoids extra queries when not needed. The opt-in pattern is already established with `includeOutcomeFields`.

2. **How to handle trades with timeOpened="00:00:00"?**
   - What we know: Trade processor defaults to "00:00:00" for missing times. Most real trades are 09:30-09:45.
   - What's unclear: How many real trades have this default value.
   - Recommendation: Treat "00:00:00" as "before market open" -- return no intraday checkpoints but still include the context structure with `knownCheckpoints: {}`. Document this in the lagNote. Alternative: default to 09:30 since that's the most common entry time. The choice depends on whether false negatives (missing data) or false positives (assuming 9:30) are worse.

3. **Should intraday outcome fields require `includeOutcomeFields=true` or `includeIntradayContext=true`?**
   - What we know: Day-level aggregates (MOC moves, VIX flags) are outcome data (require EOD). Phase 57 has a clean outcomeFields section.
   - What's unclear: Whether intraday outcome fields should piggyback on the existing `includeOutcomeFields` flag or require both flags.
   - Recommendation: Require BOTH flags. `includeIntradayContext=true` enables the checkpoint data at entry time. `includeOutcomeFields=true` (existing) enables ALL outcome data including intraday aggregates. This keeps the outcomeFields semantic consistent: "data not available at entry time."

4. **Version bump strategy**
   - What we know: MCP server is at v1.2.0 (Phase 58). This extends an existing tool's schema.
   - Recommendation: Bump to v1.3.0 (minor: new feature, backward compatible since new params have defaults).

## Detailed Schema Reference

### market.spx_15min (35 data columns + date)
**Checkpoint columns (26):** P_0930 through P_1545 at 15-minute intervals
- These represent SPX price at each timestamp
- Each is known at its timestamp (not open/close)
- All DOUBLE type

**Percentage move columns (4):**
- Pct_0930_to_1000, Pct_0930_to_1200, Pct_0930_to_1500, Pct_0930_to_Close
- All require end-of-period data (outcome fields)

**MOC columns (4):**
- MOC_15min, MOC_30min, MOC_45min, MOC_60min
- Market-on-close moves (outcome fields)

**Other (1):**
- Afternoon_Move: 12:00 PM to close (outcome field)

### market.vix_intraday (27 data columns + date)
**Checkpoint columns (14):** VIX_0930 through VIX_1545 at ~30-minute intervals
- Note irregular spacing: 0930, 1000, 1030, ..., 1530, 1545 (1545 is only 15 min after 1530)
- Each is known at its timestamp
- All DOUBLE type

**OHLC (4):** open, high, low, close (outcome: high/low/close not known at entry)

**Aggregate metrics (13):**
- VIX_Day_High, VIX_Day_Low (outcome)
- VIX_Morning_Move, VIX_Afternoon_Move, VIX_Power_Hour_Move, VIX_Last_30min_Move, VIX_Full_Day_Move, VIX_First_Hour_Move (outcome)
- VIX_Intraday_Range_Pct (outcome)
- VIX_Spike_From_Open, VIX_Spike_Flag, VIX_Crush_From_Open, VIX_Crush_Flag (outcome)
- VIX_Close_In_Range (outcome)

### Trade timeOpened Format
- Stored as string in HH:mm:ss format (24-hour, Eastern Time)
- Examples from test data: "09:30:00", "09:35:00", "09:45:00", "10:00:00", "10:15:00", "11:00:00", "14:00:00", "15:19:00"
- Default when missing: "00:00:00"

## Sources

### Primary (HIGH confidence)
- `packages/mcp-server/src/tools/market-data.ts` -- Current enrich_trades implementation (lines 696-865), calculate_orb checkpoint handling (lines 869-1070)
- `packages/mcp-server/src/db/schemas.ts` -- spx_15min table schema (lines 195-238), vix_intraday table schema (lines 244-282)
- `packages/mcp-server/src/utils/schema-metadata.ts` -- spx_15min metadata (lines 501-666), vix_intraday metadata (lines 667-806)
- `packages/lib/models/trade.ts` -- Trade interface with timeOpened: string (line 8)
- `packages/lib/processing/trade-processor.ts` -- timeOpened default "00:00:00" (line 390)
- `.planning/phases/57-restore-enrich-trades/57-CONTEXT.md` -- Deferred intraday enrichment rationale (lines 63-68)
- `.planning/REQUIREMENTS.md` -- EXT-02, EXT-03 future requirements; Out of Scope note on per-trade time-of-day (lines 39-49)

### Secondary (MEDIUM confidence)
- `tests/data/mock-trades.ts` -- Real timeOpened values: "09:30:00", "10:15:00", "09:45:00", "11:00:00"
- `.planning/phases/57-restore-enrich-trades/57-RESEARCH.md` -- Phase 57 patterns to extend

### Tertiary (LOW confidence)
None -- all findings verified from codebase sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, all existing infrastructure
- Architecture: HIGH -- Extension of proven enrich_trades pattern with time-based filtering (new but straightforward)
- Temporal semantics: HIGH -- Clear checkpoint-at-timestamp model differs from open/close model; design handles both
- Pitfalls: HIGH -- Identified from direct code reading and schema analysis
- Output structure: MEDIUM -- Open questions about flag semantics (opt-in behavior) need user decision

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable -- no external dependencies, all internal patterns)
