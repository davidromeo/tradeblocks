# Roadmap: Walk-Forward Analysis Enhancement

## Overview

Transform TradeBlocks' walk-forward analysis from a rigid automatic tool into a user-controlled system with clear, understandable results. The journey moves from understanding the current state, through adding user control over parameters, to dramatically improving how results are presented and explained to users new to WFA.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Audit & Analysis** - Analyze current WFA implementation, identify gaps
- [ ] **Phase 2: Parameter Selection UI** - Let users choose which parameters participate in optimization
- [ ] **Phase 3: Parameter Range Configuration** - Custom min/max/step for each selected parameter
- [ ] **Phase 4: Input Validation Fixes** - Fix overly tight constraints on text inputs
- [ ] **Phase 5: Optimization Targets** - Audit and implement missing optimization targets
- [ ] **Phase 6: Results Summary View** - High-level overview before detailed data
- [ ] **Phase 7: Terminology Explanations** - Inline IS/OOS, windows, robustness explanations
- [ ] **Phase 8: Interpretation Guidance** - Help users understand if results are good or bad
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
- [ ] 01-03: Document findings and prioritize gaps

### Phase 2: Parameter Selection UI
**Goal**: Users can choose which parameters participate in optimization (instead of all-automatic)
**Depends on**: Phase 1
**Research**: Unlikely (internal UI using established patterns)
**Plans**: TBD

Plans:
- [ ] 02-01: Design parameter selection interface
- [ ] 02-02: Implement parameter toggle controls
- [ ] 02-03: Connect selection to analyzer engine

### Phase 3: Parameter Range Configuration
**Goal**: Users can set custom min/max/step for each selected parameter
**Depends on**: Phase 2
**Research**: Unlikely (internal UI patterns)
**Plans**: TBD

Plans:
- [ ] 03-01: Design range input UI for each parameter
- [ ] 03-02: Implement range controls with validation
- [ ] 03-03: Integrate ranges into optimization sweep

### Phase 4: Input Validation Fixes
**Goal**: Fix overly tight constraints that prevent valid smaller values
**Depends on**: Phase 3
**Research**: Unlikely (fixing existing validation code)
**Plans**: TBD

Plans:
- [ ] 04-01: Audit all WFA input validations
- [ ] 04-02: Fix constraint issues and improve input UX

### Phase 5: Optimization Targets
**Goal**: Identify what optimization targets exist vs missing, implement gaps
**Depends on**: Phase 1
**Research**: Likely (need industry-standard WFA optimization metrics)
**Research topics**: Standard WFA optimization targets (Sharpe, Sortino, profit factor, drawdown, etc.), common ranking criteria
**Plans**: TBD

Plans:
- [ ] 05-01: Audit existing optimization targets
- [ ] 05-02: Research and implement missing targets
- [ ] 05-03: Add target selection UI

### Phase 6: Results Summary View
**Goal**: High-level summary that newcomers can understand before diving into details
**Depends on**: Phase 1
**Research**: Unlikely (internal UI design)
**Plans**: TBD

Plans:
- [ ] 06-01: Design summary view layout
- [ ] 06-02: Implement key metrics summary
- [ ] 06-03: Add expandable details section

### Phase 7: Terminology Explanations
**Goal**: Inline explanations of IS/OOS, windows, robustness concepts
**Depends on**: Phase 6
**Research**: Likely (need accurate WFA educational content)
**Research topics**: Clear explanations of in-sample vs out-of-sample, walk-forward windows, robustness metrics, anchored vs rolling
**Plans**: TBD

Plans:
- [ ] 07-01: Write terminology content
- [ ] 07-02: Design and implement tooltip/info system
- [ ] 07-03: Add contextual help throughout WFA UI

### Phase 8: Interpretation Guidance
**Goal**: Help users understand if their results are good, bad, or concerning
**Depends on**: Phase 7
**Research**: Likely (need WFA best practices for guidance thresholds)
**Research topics**: WFA robustness thresholds, efficiency ratios, warning signs of curve-fitting, what constitutes "good" WFA results
**Plans**: TBD

Plans:
- [ ] 08-01: Research interpretation guidelines
- [ ] 08-02: Implement guidance indicators
- [ ] 08-03: Add warnings and recommendations

### Phase 9: Calculation Robustness
**Goal**: Ensure all WFA calculations are mathematically correct
**Depends on**: Phase 1
**Research**: Likely (verify against WFA mathematical standards)
**Research topics**: WFA calculation methodology, efficiency ratio formulas, robustness metrics formulas
**Plans**: TBD

Plans:
- [ ] 09-01: Review calculation formulas against standards
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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audit & Analysis | 2/3 | In progress | - |
| 2. Parameter Selection UI | 0/3 | Not started | - |
| 3. Parameter Range Configuration | 0/3 | Not started | - |
| 4. Input Validation Fixes | 0/2 | Not started | - |
| 5. Optimization Targets | 0/3 | Not started | - |
| 6. Results Summary View | 0/3 | Not started | - |
| 7. Terminology Explanations | 0/3 | Not started | - |
| 8. Interpretation Guidance | 0/3 | Not started | - |
| 9. Calculation Robustness | 0/3 | Not started | - |
| 10. Integration & Polish | 0/3 | Not started | - |
