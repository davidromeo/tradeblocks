# Roadmap: TradeBlocks

## Milestones

- ✅ **v2.6 DuckDB Analytics Layer** — Phases 41-45 (shipped 2026-02-04)
- ✅ **v2.7 Edge Decay Analysis** — Phases 46-50 (shipped 2026-02-06)
- ✅ **v2.8 Market Data Consolidation** — Phases 51-54 (shipped 2026-02-07)
- ✅ **v2.9 Lookahead-Free Market Analytics** — Phases 55-59 (shipped 2026-02-09)
- ✅ **v2.1 Strategy Profiles (beta 1)** — Phases 60-63 (shipped 2026-03-06)
- 🚧 **v2.1 Profile Schema V2 & Portfolio Analysis (beta 2)** — Phases 64-65 (in progress)

See [MILESTONES.md](MILESTONES.md) for full history.

<details>
<summary>✅ v2.9 Lookahead-Free Market Analytics (Phases 55-59) — SHIPPED 2026-02-09</summary>

- [x] Phase 55: Field Classification Foundation (1/1 plans) — completed 2026-02-08
- [x] Phase 56: Fix Existing Tools (1/1 plans) — completed 2026-02-08
- [x] Phase 57: Restore enrich_trades (1/1 plans) — completed 2026-02-08
- [x] Phase 58: Schema Metadata + Documentation (1/1 plans) — completed 2026-02-08
- [x] Phase 59: Intraday Market Context Enrichment (1/1 plans) — completed 2026-02-08

</details>

<details>
<summary>✅ v2.1 Strategy Profiles — beta 1 (Phases 60-63) — SHIPPED 2026-03-06</summary>

- [x] Phase 60: Profile Storage (1/1 plans) — completed 2026-03-04
- [x] Phase 61: Profile CRUD Tools (1/1 plans) — completed 2026-03-05
- [x] Phase 62: Structure-Aware Analysis Tools (3/3 plans) — completed 2026-03-05
- [x] Phase 63: Eliminate block.json (2/2 plans) — completed 2026-03-06

</details>

## v2.1-beta.2: Profile Schema V2 & Portfolio Analysis

**Milestone Goal:** Upgrade profile schema with structured position sizing, strike selection, stop loss mechanics, and behavioral flags. Build portfolio-level analysis tools that consume the richer schema for allocation optimization, gap detection, and regime-aware recommendations.

## Phases

- [x] **Phase 64: Schema V2** - Structured fields for position sizing, legs, exits, and behavioral flags with DB migration and backward compatibility (completed 2026-03-08)
- [x] **Phase 65: Portfolio Analysis Tools** - Enhanced portfolio_health_check, enhanced what_if_scaling, and new regime_allocation_advisor with tiered degradation (completed 2026-03-08)

## Phase Details

### Phase 64: Schema V2
**Goal**: Users can profile strategies with structured position sizing, strike selection methods, stop loss mechanics, and behavioral flags
**Depends on**: Phase 63 (v2.1-beta.1 shipped)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, SCHEMA-06, SCHEMA-07, SCHEMA-08, SCHEMA-09, SCHEMA-10, SCHEMA-11, SCHEMA-12
**Success Criteria** (what must be TRUE):
  1. `profile_strategy` accepts split allocation (backtestAllocationPct, liveAllocationPct, maxContractsPerTrade) and falls back to allocationPct when split fields are absent
  2. `profile_strategy` accepts structured strike method (delta/dollar_price/offset/percentage with value) on each leg while preserving the existing strike string label
  3. `profile_strategy` accepts structured stop loss (percentage/dollar/sl_ratio/debit_percentage with value), monitoring config, and per-rule slippage on exit rules
  4. `profile_strategy` accepts underlying and behavioral flags (reEntry, capProfits, capLosses, requireTwoPricesPT, closeOnCompletion, ignoreMarginReq)
  5. `get_strategy_profile` and `list_profiles` return all new fields, and existing profiles without new fields load without error
**Plans:** 2/2 plans complete

Plans:
- [x] 64-01-PLAN.md — Extend TypeScript interfaces, Zod schemas, DB migration, and CRUD for all new fields
- [x] 64-02-PLAN.md — Unit tests for round-trip, backward compatibility, and read tool output

### Phase 65: Portfolio Analysis Tools
**Goal**: Users can analyze portfolio-level allocation health, simulate profile-aware scaling, and get regime-specific allocation recommendations
**Depends on**: Phase 64
**Requirements**: ANLYS-01, ANLYS-02, ANLYS-03, ANLYS-04, ANLYS-05, ANLYS-06, ANLYS-07, ANLYS-08, ANLYS-09, ANLYS-10, ANLYS-11, ANLYS-12, TIER-01
**Success Criteria** (what must be TRUE):
  1. `portfolio_health_check` reports regime coverage matrix, day-of-week coverage heatmap, allocation concentration by structure/underlying/DTE, correlation risk flags, and backtest-to-live scaling ratios with outlier flags
  2. `what_if_scaling` uses backtest block data for profile-aware scaling, flags margin constraints when ignoreMarginReq is true, enforces maxContractsPerTrade ceiling, and accepts multi-strategy arrays for combined impact simulation
  3. `regime_allocation_advisor` cross-references regime performance with allocations, identifies thesis violations (underperforming in expected regimes), and identifies hidden edges (outperforming in unexpected regimes)
  4. All three tools run with partial data, report what was skipped, and suggest profile upgrades when fields are missing
**Plans:** 4/4 plans complete

Plans:
- [ ] 65-01-PLAN.md — Enhanced portfolio_health_check with 5 new profile-aware grade dimensions
- [ ] 65-02-PLAN.md — Enhanced what_if_scaling with profile-aware scaling and multi-strategy mode
- [ ] 65-03-PLAN.md — New regime_allocation_advisor tool with regime vs allocation comparison
- [ ] 65-04-PLAN.md — Unit tests for all three tools

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 55. Field Classification Foundation | v2.9 | 1/1 | Complete | 2026-02-08 |
| 56. Fix Existing Tools | v2.9 | 1/1 | Complete | 2026-02-08 |
| 57. Restore enrich_trades | v2.9 | 1/1 | Complete | 2026-02-08 |
| 58. Schema Metadata + Documentation | v2.9 | 1/1 | Complete | 2026-02-08 |
| 59. Intraday Market Context Enrichment | v2.9 | 1/1 | Complete | 2026-02-08 |
| 60. Profile Storage | v2.1-b1 | 1/1 | Complete | 2026-03-04 |
| 61. Profile CRUD Tools | v2.1-b1 | 1/1 | Complete | 2026-03-05 |
| 62. Structure-Aware Analysis Tools | v2.1-b1 | 3/3 | Complete | 2026-03-05 |
| 63. Eliminate block.json | v2.1-b1 | 2/2 | Complete | 2026-03-06 |
| 64. Schema V2 | v2.1-b2 | 2/2 | Complete | 2026-03-08 |
| 65. Portfolio Analysis Tools | 4/4 | Complete   | 2026-03-08 | - |
