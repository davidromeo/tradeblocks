# Roadmap: Walk-Forward Analysis Enhancement

## Overview

Transform TradeBlocks' walk-forward analysis from a rigid automatic tool into a user-controlled system with clear, understandable results. The journey moves from understanding the current state, through adding user control over parameters, to dramatically improving how results are presented and explained to users new to WFA.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Audit & Analysis** - Analyze current WFA implementation, identify gaps
- [x] **Phase 2: Parameter UI Polish** - Wrap parameters in collapsible containers, remove presets (MERGED: selection + ranges already exist)
- [x] **Phase 3: Input Validation Fixes** - Fix overly tight constraints on text inputs
- [x] **Phase 5: Optimization Targets** - Audit and implement missing optimization targets
- [x] **Phase 6: Results Summary View** - High-level overview before detailed data
- [x] **Phase 7: Terminology Explanations** - Inline IS/OOS, windows, robustness explanations
- [x] **Phase 8: Interpretation Guidance** - Help users understand if results are good or bad
- [ ] **Phase 9: Calculation Robustness** - Validate calculations are mathematically correct
- [ ] **Phase 10: Integration & Polish** - End-to-end testing and refinements

## Phase Details

### Phase 1: Audit & Analysis
**Goal**: Understand current WFA implementation - what works, what's missing, what's broken
**Depends on**: Nothing (first phase)
**Research**: Unlikely (internal codebase exploration)
**Plans**: TBD

Plans:
- [x] 01-01: Analyze walk-forward-analyzer.ts calculation engine
- [x] 01-02: Audit walk-forward-store.ts and UI components
- [x] 01-03: Document findings and prioritize gaps

### Phase 2: Parameter UI Polish
**Goal**: Wrap parameter controls in collapsible containers matching diversification pattern, remove preset buttons
**Depends on**: Phase 1
**Research**: None (codebase verification complete - UI already exists)
**Note**: MERGED from original Phase 2 (Parameter Selection) + Phase 3 (Range Configuration). Both features already implemented in period-selector.tsx.

Plans:
- [x] 02-01: Wrap parameters in Collapsible container + remove presets

### Phase 3: Input Validation Fixes
**Goal**: Fix overly tight constraints that prevent valid smaller values
**Depends on**: Phase 2
**Research**: Unlikely (fixing existing validation code)
**Plans**: TBD

Plans:
- [x] 03-01: Fix window config and remaining numeric inputs with free text editing
- ~~03-02: Additional validation fixes if needed~~ (Not needed - no further issues found)

### Phase 5: Optimization Targets
**Goal**: Fix broken diversification targets by removing them from UI (8 targets work, 3 are broken)
**Depends on**: Phase 1
**Research**: None (audit complete in Phase 1, fix is straightforward)
**Note**: Diversification CONSTRAINTS work correctly; only optimization TARGETS are broken. Computing diversification metrics per parameter combination is too expensive, so we remove broken targets rather than implementing them.

Plans:
- [x] 05-01: Remove broken diversification targets from dropdown, keep working constraints

### Phase 6: Results Summary View
**Goal**: High-level summary that newcomers can understand before diving into details
**Depends on**: Phase 1
**Research**: Unlikely (internal UI design)
**Plans**: TBD

Plans:
- [x] 06-01: Restructure results page with summary view and tab-based organization

### Phase 7: Terminology Explanations
**Goal**: Inline explanations of IS/OOS, windows, robustness concepts
**Depends on**: Phase 6
**Research**: Likely (need accurate WFA educational content)
**Research topics**: Clear explanations of in-sample vs out-of-sample, walk-forward windows, robustness metrics, anchored vs rolling
**Plans**: TBD

Plans:
- [x] 07-01: Terminology explanations - Enhanced tooltips and IS/OOS glossary

### Phase 8: Interpretation Guidance
**Goal**: Help users understand if their results are good, bad, or concerning
**Depends on**: Phase 7
**Research**: Likely (need WFA best practices for guidance thresholds)
**Research topics**: WFA robustness thresholds, efficiency ratios, warning signs of curve-fitting, what constitutes "good" WFA results
**Plans**: TBD

Plans:
- [x] 08-01: Interpretation logic module and Analysis tab
- [x] 08-02: Implement guidance indicators (WalkForwardAnalysis component)
- [x] 08-03: Add configuration-aware warnings (ISS-003: detect short windows, aggressive ratios)

### Phase 9: Calculation Robustness
**Goal**: Ensure all WFA calculations are mathematically correct
**Depends on**: Phase 1
**Research**: Likely (verify against WFA mathematical standards)
**Research topics**: WFA calculation methodology, efficiency ratio formulas, robustness metrics formulas
**Plans**: TBD

Plans:
- [x] 09-01: Review calculation formulas against standards
- [ ] 09-02: Add/fix unit tests for calculations
- [ ] 09-03: Fix any identified calculation issues

### Phase 10: Integration & Polish
**Goal**: End-to-end testing, refinements, edge case handling
**Depends on**: Phases 2-9
**Research**: Unlikely (internal testing)
**Plans**: TBD

Plans:
- [ ] 10-01: End-to-end integration testing
- [ ] 10-02: Edge case handling and error states
- [ ] 10-03: Final polish and cleanup

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 5 → 6 → 7 → 8 → 9 → 10
(Phase 4 merged into Phase 2)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audit & Analysis | 3/3 | Complete | 2026-01-11 |
| 2. Parameter UI Polish | 1/1 | Complete | 2026-01-11 |
| 3. Input Validation Fixes | 1/1 | Complete | 2026-01-11 |
| 5. Optimization Targets | 1/1 | Complete | 2026-01-11 |
| 6. Results Summary View | 1/1 | Complete | 2026-01-11 |
| 7. Terminology Explanations | 1/1 | Complete | 2026-01-11 |
| 8. Interpretation Guidance | 3/3 | Complete | 2026-01-11 |
| 9. Calculation Robustness | 1/3 | In progress | - |
| 10. Integration & Polish | 0/3 | Not started | - |

## Audit Notes

See `.planning/AUDIT-FINDINGS.md` for detailed findings from Phase 1.

**Key discoveries affecting roadmap:**
- ~~Phases 2-3 UI may already be complete (needs verification)~~ **VERIFIED**: Selection + ranges exist, merged into Phase 2 polish
- Phase 5 is critical: broken diversification targets
- Recommended priority: Phase 5 → Phase 6 → Phase 8
