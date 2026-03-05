# Requirements: TradeBlocks

**Defined:** 2026-03-04
**Core Value:** Accurate, trustworthy portfolio analytics

## v2.10 Requirements

Requirements for Strategy Profiles milestone. Each maps to roadmap phases.

### Profile Storage

- [x] **STOR-01**: Strategy profiles stored in DuckDB with full schema (structure type, greeks bias, legs detail, entry filters, exit rules, thesis, expected regimes, key metrics)
- [x] **STOR-02**: Profiles associated with block ID + strategy name as composite key
- [x] **STOR-03**: Profile schema supports all Option Omega strategy types (spreads, calendars, iron condors, RICs, etc.)

### Profile Management

- [x] **PROF-01**: Claude can create/update a strategy profile from a screenshot description or user conversation via `profile_strategy` tool
- [x] **PROF-02**: Claude can retrieve a stored profile for a specific strategy via `get_strategy_profile` tool
- [x] **PROF-03**: Claude can list all profiles across a block or all blocks via `list_profiles` tool

### Structure-Aware Analysis

- [x] **ANLZ-01**: `analyze_structure_fit` runs targeted regime/condition queries based on a strategy's profile (greeks bias, profit driver, key metrics) and returns a fit report
- [x] **ANLZ-02**: `validate_entry_filters` compares performance on entered days vs. filtered-out days to measure each entry filter's contribution to edge
- [x] **ANLZ-03**: `portfolio_structure_map` builds a regime x structure matrix across all profiled strategies showing coverage and blind spots

## Future Requirements

### Profile Enhancements

- **PROF-04**: Profile versioning (track parameter changes over time)
- **PROF-05**: Profile import/export (share profiles between blocks or users)
- **PROF-06**: Automated structure inference from legs strings (supplement, not replace, user-provided profiles)

### Advanced Analysis

- **ANLZ-04**: `suggest_refinements` proposes parameter or filter changes with estimated impact based on profile + performance data
- **ANLZ-05**: `find_complementary_conditions` identifies market conditions where profiled strategies underperform and suggests structure types that would fill the gap

## Out of Scope

| Feature | Reason |
|---------|--------|
| Modifying existing tool behavior based on profiles | Non-deterministic behavior would confuse users without profiles |
| Real-time profile updates from live trading | This is a backtest analytics platform |
| UI components for profile management | MCP-first — profiles managed through Claude conversation |
| Automated strategy detection without user input | Too unreliable; user confirmation required for accuracy |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STOR-01 | Phase 60 | Complete |
| STOR-02 | Phase 60 | Complete |
| STOR-03 | Phase 60 | Complete |
| PROF-01 | Phase 61 | Complete |
| PROF-02 | Phase 61 | Complete |
| PROF-03 | Phase 61 | Complete |
| ANLZ-01 | Phase 62 | Complete |
| ANLZ-02 | Phase 62 | Complete |
| ANLZ-03 | Phase 62 | Complete |

**Coverage:**
- v2.10 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*
