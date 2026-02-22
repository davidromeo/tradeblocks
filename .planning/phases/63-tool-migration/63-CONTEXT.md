# Phase 63: Tool Migration - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate four existing MCP tools (`enrich_trades`, `analyze_regime_performance`, `suggest_filters`, `calculate_orb`) plus shared query utilities (`buildLookaheadFreeQuery`, `schema-metadata.ts`, `field-timing.ts`) to work against the new normalized schema (`market.daily`, `market.context`, `market.intraday`). Tools must handle missing data gracefully, expose new enrichment fields, and be forward-compatible with any ticker/symbol.

</domain>

<decisions>
## Implementation Decisions

### Missing Data Behavior
- Return partial results when market data is partially available — never hard-fail due to missing data
- Include a warnings section explaining what's missing and how to import it
- No coverage threshold — always return whatever data is available, even if only 1 trade has matching market data
- Claude's discretion on: whether warnings are inline NULLs + separate section vs separate section only; level of detail in import instructions (specific tool call vs general guidance)

### New Field Exposure
- `enrich_trades` exposes ALL new enrichment fields (BB_Width, Realized_Vol_5D/20D, Prior_Range_vs_ATR, BB_Position) alongside existing fields like RSI_14, ATR_Pct
- `suggest_filters` includes new enrichment fields as standalone filter candidates AND generates composite filter suggestions where cross-field correlations are strong
- Claude's discretion on: whether `analyze_regime_performance` should add new segmentation dimensions (BB_Width quartile, Realized_Vol regime) or stay focused on VIX/vol regimes
- Claude's discretion on: field grouping in enrich_trades output (keep sameDay/priorDay vs split by source table vs other organization)

### ORB Tool Interface — Full Redesign
- Align with Option Omega's ORB model: opening range end time, breakout condition (High and Low, High-Only, Low-Only, No Breakout), use high-low values toggle
- Add bar resolution parameter — default to finest available resolution in market.intraday for the ticker, user can override
- Output includes ORB range levels (high/low/range) PLUS per-day breakout events (direction, time of breakout, whether entry would have triggered)
- Keep startTime/endTime HHMM format for the ORB window specification

### Backward Compatibility & Forward Compatibility
- Clean break — tools ONLY work against new schema (market.daily, market.context, market.intraday)
- Migrated tool code must NOT reference old table names (spx_daily, spx_15min, vix_intraday) — even though broader codebase cleanup is Phase 64, the tools themselves must be clean
- Add optional ticker parameter to all tools (default 'SPX'), enabling future use with any underlying
- Forward-compatible with any symbol and data that might be imported into the database
- Tool descriptions updated to reference new table names and capabilities
- Broader cleanup of old references elsewhere in codebase deferred to Phase 64

</decisions>

<specifics>
## Specific Ideas

- "Align ORB with how Option Omega has it" — the backtest platform defines ORB by window end time + breakout condition + high-low toggle
- "Make this forward compatible with all symbols and data that might make it into the database" — tools should not assume SPX-only
- "Don't reference any of the old tables since we'll be removing that in the future" — clean code in migrated tools, no legacy dependencies

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 63-tool-migration*
*Context gathered: 2026-02-22*
