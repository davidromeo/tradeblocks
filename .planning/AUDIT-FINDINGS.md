# WFA Audit Findings

**Audit Period:** Phase 1 (01-01 through 01-03)
**Completed:** 2026-01-11

## Executive Summary

The Walk-Forward Analysis system is **well-architected** with comprehensive parameter controls, excellent HoverCard tooltips, and solid calculation foundations. However, there are **critical gaps** that affect usability:

1. **Broken diversification targets** are selectable in UI but return NEGATIVE_INFINITY
2. **Results interpretation is weak** — verdict section hidden, no actionable guidance
3. **Phases 2-3 may already be done** — parameter selection UI appears complete

## System Architecture

### Calculation Engine Flow

```
1. Config validation (IS/OOS/step days > 0)
2. Sort trades chronologically
3. Build rolling windows (cursor + stepSizeDays)
   - Each window: [IS start, IS end] → [OOS start, OOS end]
   - No anchored mode available
4. For each window:
   a. Filter trades to IS and OOS periods
   b. Skip if insufficient trades (min 10 IS, 3 OOS by default)
   c. Grid search all parameter combinations (max 20,000)
   d. For each combo: scale trades → calculate stats → check constraints → track best
   e. Apply best params to OOS trades → calculate OOS metrics
5. Aggregate: degradationFactor, parameterStability, consistencyScore
6. Calculate robustnessScore = average(efficiency, stability, consistency)
```

### State Management Architecture

```
Zustand Store (walk-forward-store.ts)
├── Configuration State
│   ├── config: WalkForwardConfig (window sizes, target, min trades)
│   ├── extendedParameterRanges: {key: [min, max, step, enabled]}
│   ├── diversificationConfig: correlation/tail risk constraints
│   ├── strategyWeightSweep: per-strategy weight ranges
│   └── performanceFloor: min thresholds for diversification targets
│
├── UI State
│   ├── selectedStrategies: string[]
│   ├── normalizeTo1Lot: boolean
│   ├── combinationEstimate: {count, breakdown, warningLevel}
│   └── autoConfigApplied: boolean
│
├── Analysis State
│   ├── isRunning: boolean
│   ├── progress: {phase, currentPeriod, totalPeriods, combinations}
│   ├── results: WalkForwardResults | null
│   ├── history: WalkForwardAnalysis[]
│   └── error: string | null
│
└── Persistence
    └── IndexedDB via loadHistory/saveAnalysis/deleteAnalysis
```

### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `lib/calculations/walk-forward-analyzer.ts` | 854 | Core calculation engine with grid search optimizer |
| `lib/calculations/walk-forward-verdict.ts` | 163 | Assessment and verdict logic with hardcoded thresholds |
| `lib/models/walk-forward.ts` | 212 | Type definitions including unused extended parameter ranges |
| `lib/stores/walk-forward-store.ts` | 671 | Zustand store with comprehensive configuration state |
| `components/walk-forward/period-selector.tsx` | 1364 | Main configuration form |
| `components/walk-forward/walk-forward-verdict.tsx` | 250 | Results interpretation |

## Gap Inventory

### Critical (Must Fix)

| Gap | Description | Current Behavior | Impact | Phase |
|-----|-------------|------------------|--------|-------|
| **Broken diversification targets** | `minAvgCorrelation`, `minTailRisk`, `maxEffectiveFactors` return `NEGATIVE_INFINITY` | Users can select these targets in dropdown; analysis runs but silently produces invalid results | High - users may make decisions based on broken analysis | Phase 5 |
| **No actionable guidance** | Verdict says "concerning" or "overfit" with no explanation | Users don't know what to do with results | High - defeats purpose of WFA if results aren't actionable | Phase 8 |

### High Priority

| Gap | Description | Current Behavior | Impact | Phase |
|-----|-------------|------------------|--------|-------|
| **Verdict buried in results** | Assessment appears below charts, not prominently | User may miss the most important information | Medium - reduces usability | Phase 6 |
| **Limited results terminology** | HoverCards in config are great; results section lacks explanations | Users understand config but not what results mean | Medium - knowledge gap | Phase 7 |

### Medium Priority

| Gap | Description | Current Behavior | Impact | Phase |
|-----|-------------|------------------|--------|-------|
| **No anchored window mode** | Only rolling windows implemented | Can't test strategies with growing training data | Low - rolling is more common | Phase 9 |
| **Magic number thresholds** | Verdict thresholds (80%, 60%, 70%, 50%) hardcoded without reference | Thresholds may not match industry standards | Low - works but unvalidated | Phase 8/9 |

### Low Priority / Out of Scope

| Gap | Description | Assessment |
|-----|-------------|------------|
| **dailyLogs parameter unused** | Reserved in API but never implemented | Future enhancement, not blocking |
| **Input validation** | Originally thought to have issues | Audit found no significant problems |

## Existing Strengths (Preserve)

1. **HoverCard tooltips** — Every parameter has clear "what" and "why" explanations
2. **Auto-configuration** — Detects trade frequency and suggests window sizes
3. **Preset system** — Quick-start configurations (Fast, Standard, Thorough)
4. **Combination estimate** — Real-time feedback on parameter sweep complexity with warnings
5. **Step size suggestions** — Warns when step sizes create too many combinations
6. **Run history** — Shows config badges, parameter ranges per historical run
7. **Conditional diversification metrics** — Only shows when diversification target used

## Roadmap Recommendations

### Confirmed: Phase 2-3 UI Appears Complete

The `period-selector.tsx` already implements:
- ✅ Checkbox to enable/disable each parameter
- ✅ Min/Max/Step inputs for each parameter with range sliders
- ✅ Real-time combination count estimation
- ✅ Step size suggestions when ranges create too many values

**Recommendation:** Verify this UI actually connects to the analyzer. If it does:
- Mark Phase 2-3 as complete or significantly reduced scope
- Reorder roadmap to tackle critical gaps first

### Suggested Phase Priority Reorder

| Priority | Phase | Rationale |
|----------|-------|-----------|
| 1 | **Phase 5: Fix Optimization Targets** | Critical - broken functionality must be fixed first |
| 2 | **Phase 6: Results Summary View** | High impact - make verdict prominent |
| 3 | **Phase 8: Interpretation Guidance** | High impact - make results actionable |
| 4 | **Phase 7: Terminology Explanations** | Medium - extend HoverCard pattern to results |
| 5 | **Phase 2-3: Parameter UI** | Verify existing; may be done |
| 6 | **Phase 4: Input Validation** | Low priority - no major issues found |
| 7 | **Phase 9: Calculation Robustness** | Medium - verify formulas, add anchored mode |
| 8 | **Phase 10: Integration & Polish** | Final - end-to-end testing |

### Complexity Reassessment

| Phase | Original Estimate | Revised | Notes |
|-------|-------------------|---------|-------|
| Phase 2 | Medium | **Very Low / Done** | UI exists |
| Phase 3 | Low-Medium | **Very Low / Done** | UI exists |
| Phase 4 | Unknown | **Very Low** | No issues found |
| Phase 5 | Medium-High | **Medium** | Fix 3 broken targets |
| Phase 6 | Unknown | **Low** | Move existing component |
| Phase 7 | Low | **Low** | Add more HoverCards |
| Phase 8 | Medium | **Medium** | Research needed for guidance |
| Phase 9 | Medium | **Medium** | Formula verification |

## Technical Debt

1. **1364-line period-selector.tsx** — Well-organized but could benefit from component extraction
2. **Hardcoded thresholds** — Should reference industry standards or be configurable
3. **Population vs sample variance** — Parameter stability uses population variance, may underestimate with few periods
4. **Terminology confusion** — Code uses `degradationFactor` which IS the efficiency ratio (OOS/IS)

## Next Steps

1. **Immediate:** Phase 1 complete — all audits done
2. **Verify:** Test if Phase 2-3 parameter UI actually affects analyzer
3. **Fix First:** Phase 5 — disable or fix broken diversification targets
4. **Then:** Phase 6 + 8 — improve results presentation and guidance

---

*Audit completed as part of Phase 1: Audit & Analysis*
*Last updated: 2026-01-11*
