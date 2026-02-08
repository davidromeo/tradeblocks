# Roadmap: TradeBlocks

## Completed Milestones

See [MILESTONES.md](MILESTONES.md) for full history (v1.0 through v2.8).

## v2.9 Lookahead-Free Market Analytics

**Milestone Goal:** Eliminate lookahead bias from market data tools, restore enrich_trades with correct join semantics, and add field-level metadata so users know which fields are available at trade entry time.

**Phase Numbering:** Continues from v2.8 (phases 51-54). v2.9 starts at phase 55.

- [x] **Phase 55: Field Classification Foundation** - Classify all 55 spx_daily columns by temporal availability and build shared lag utilities
- [x] **Phase 56: Fix Existing Tools** - Correct lookahead bias in suggest_filters and analyze_regime_performance with split join pattern
- [x] **Phase 57: Restore enrich_trades** - New MCP tool returning trades enriched with lag-aware market context
- [x] **Phase 58: Schema Metadata + Documentation** - Surface timing metadata in describe_database with lag-aware example queries
- [ ] **Phase 59: Intraday Market Context Enrichment** - Enrich trades with spx_15min and vix_intraday data via time-based checkpoint matching

## Phase Details

### Phase 55: Field Classification Foundation
**Goal**: Every spx_daily column has a verified temporal classification, and a shared utility module provides the LAG() CTE pattern consumed by all downstream tools
**Depends on**: Nothing (first phase of v2.9)
**Requirements**: BIAS-01
**Success Criteria** (what must be TRUE):
  1. Every one of the 55 spx_daily columns has a `timing` property (`open`, `close`, or `static`) on its `ColumnDescription` in schema-metadata.ts
  2. A test asserts that every column in the spx_daily schema has a timing annotation (no unclassified columns)
  3. A `field-timing.ts` utility module exports derived sets (OPEN_KNOWN_FIELDS, CLOSE_KNOWN_FIELDS, STATIC_FIELDS) and a `buildLookaheadFreeQuery()` function that produces a LAG() CTE for close-derived fields
  4. The LAG() CTE correctly handles trading calendar gaps (weekends, holidays) by operating on spx_daily row order, not calendar-day arithmetic
**Plans:** 1 plan
Plans:
- [x] 55-01-PLAN.md -- Classify columns, build field-timing utility, write completeness tests

### Phase 56: Fix Existing Tools
**Goal**: suggest_filters and analyze_regime_performance use prior-trading-day values for close-derived fields while retaining same-day joins for open-known fields, with transparent lag explanations in output
**Depends on**: Phase 55 (needs field classification and lag utilities)
**Requirements**: BIAS-02, BIAS-03, BIAS-04, BIAS-05, META-04
**Success Criteria** (what must be TRUE):
  1. suggest_filters joins 14 close-derived filter fields (Vol_Regime, RSI_14, Trend_Score, etc.) using t-1 values via LAG() CTE, while 6 open-known filters (Gap_Pct, Day_of_Week, Is_Opex, etc.) use same-day values
  2. analyze_regime_performance joins 3 close-derived segmentation options (volRegime, termStructure, trendScore) using t-1 values, while open-known options (dayOfWeek, isOpex) use same-day values
  3. New open-known filter candidates (VIX_Open, VIX_Gap_Pct) appear in suggest_filters output with correct hypothesis flags
  4. Both tools include a brief note in their output explaining which fields are lagged and why (lookahead bias prevention)
**Plans:** 1 plan
Plans:
- [x] 56-01-PLAN.md -- Fix suggest_filters and analyze_regime_performance with lag-aware queries

### Phase 57: Restore enrich_trades
**Goal**: Users can enrich trades with market context through a purpose-built MCP tool that enforces correct temporal joins by default
**Depends on**: Phase 56 (split join pattern battle-tested in existing tools)
**Requirements**: ENRICH-01, ENRICH-02, ENRICH-03, ENRICH-04
**Success Criteria** (what must be TRUE):
  1. Calling enrich_trades with a blockId returns trades with market context fields split into entry-time-available (same-day open-known + prior-day close-derived) sections
  2. enrich_trades supports blockId, strategy, and date range filters with pagination (offset/limit)
  3. When includeOutcomeFields is true, enrich_trades returns same-day close-derived fields in a separate section with a clear lookahead bias warning
  4. Each field in the output includes metadata indicating its temporal source (same-day vs prior-day) so users know what was available at trade entry
**Plans:** 1 plan
Plans:
- [x] 57-01-PLAN.md -- Implement enrich_trades tool with lag-aware market context and buildOutcomeQuery

### Phase 58: Schema Metadata + Documentation
**Goal**: Users writing run_sql queries via describe_database get correct temporal guidance so ad-hoc queries avoid the same lookahead bias that was fixed in purpose-built tools
**Depends on**: Phase 57 (all tools fixed, metadata patterns settled)
**Requirements**: META-01, META-02, META-03
**Success Criteria** (what must be TRUE):
  1. describe_database output shows a timing property (open/close/static) on each spx_daily column description
  2. Example queries in describe_database use lag-aware JOIN patterns instead of naive same-day joins
  3. A pre-built LAG() CTE template is included in describe_database output that users can copy for correct run_sql usage
**Plans:** 1 plan
Plans:
- [x] 58-01-PLAN.md -- Extend ColumnInfo with timing, update example queries with LAG CTE patterns, add lagTemplate

### Phase 59: Intraday Market Context Enrichment
**Goal:** Extend enrich_trades with intraday market context from spx_15min (26 price checkpoints) and vix_intraday (14 VIX checkpoints) via time-based matching against trade entry timestamps
**Depends on:** Phase 57 (needs enrich_trades tool as foundation)
**Requirements**: EXT-02, EXT-03
**Success Criteria** (what must be TRUE):
  1. Calling enrich_trades with includeIntradayContext=true returns per-trade intraday SPX/VIX checkpoint data filtered to only checkpoints known at trade entry time
  2. A trade entered at 09:35 sees only P_0930 (not P_0945+) and VIX_0930 (not VIX_1000+)
  3. Without includeIntradayContext, output is identical to Phase 57 (backward compatible)
  4. Intraday day-level aggregates (MOC moves, VIX spike flags) require BOTH includeIntradayContext and includeOutcomeFields
**Plans:** 1 plan
Plans:
- [ ] 59-01-PLAN.md -- Create intraday-timing utility and extend enrich_trades with checkpoint context

## Progress

**Execution Order:** 55 -> 56 -> 57 -> 58 -> 59

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 55. Field Classification Foundation | v2.9 | 1/1 | ✓ Complete | 2026-02-08 |
| 56. Fix Existing Tools | v2.9 | 1/1 | ✓ Complete | 2026-02-08 |
| 57. Restore enrich_trades | v2.9 | 1/1 | ✓ Complete | 2026-02-08 |
| 58. Schema Metadata + Documentation | v2.9 | 1/1 | ✓ Complete | 2026-02-08 |
| 59. Intraday Market Context Enrichment | v2.9 | 0/1 | Not started | - |
