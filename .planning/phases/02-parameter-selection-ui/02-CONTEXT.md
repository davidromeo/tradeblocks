# Phase 2: Parameter UI Polish - Context

**Gathered:** 2026-01-11
**Updated:** 2026-01-11 (scope verified and merged with Phase 3)
**Status:** Ready for planning

<vision>
## How This Should Work

The existing parameter selection UX is mostly good. The main improvement is extending the container pattern used for diversification/strategy weight sweeps to other parameter groups. Users should see a consistent, organized interface where parameters are grouped into collapsible containers.

The conservative/moderate/aggressive preset toggles need to go — they make too many assumptions about what users want and don't provide real control.

If parameter selection and range configuration (min/max/step) are already combined in the existing UI, keep them together rather than artificially splitting across phases.

</vision>

<essential>
## What Must Be Nailed

- **Consistent container UX** — All parameter groups should use the same expandable container pattern as diversification sweeps. One visual pattern, applied consistently.
- **Match existing diversification container** — Don't invent new patterns; replicate what already works
- **Collapsible by default** — Reduce visual clutter by starting parameter groups collapsed

</essential>

<boundaries>
## What's Out of Scope

- New optimization targets — that's Phase 5
- The preset toggles (conservative/moderate/aggressive) — removing these, not redesigning them
- Major UX redesign — extending existing patterns, not starting over

</boundaries>

<specifics>
## Specific Ideas

- Match the diversification container pattern exactly (same expand/collapse, same styling)
- Parameter groups should start collapsed to reduce visual noise
- Remove conservative/moderate/aggressive toggles completely — they're assumption-heavy
- If range inputs (min/max/step) already exist with parameter selection, keep them together (may merge Phase 2 and 3 scope)

</specifics>

<notes>
## Additional Context

The user prefers extending proven patterns over introducing new UX concepts. The diversification sweep container is the reference implementation to follow.

</notes>

<verification>
## Codebase Verification (2026-01-11)

**Finding: Phase 2 + 3 scope already 80% implemented**

| Feature | Status | Location |
|---------|--------|----------|
| Parameter toggle checkboxes | ✅ Exists | period-selector.tsx:178-308 |
| Min/max/step range inputs | ✅ Exists | period-selector.tsx:237-282 |
| Combination estimates | ✅ Exists | period-selector.tsx:704-739 |
| Diversification container pattern | ✅ Reference | period-selector.tsx:863-1090 |
| Collapsible wrapper for parameters | ❌ Missing | Needs wrapping |
| Preset buttons (to remove) | ⚠️ Exists | period-selector.tsx:138-151, 725 |

**Actual scope:**
1. Wrap parameters in Collapsible container matching diversification pattern
2. Remove preset buttons (conservative/moderate/aggressive)
3. Default to collapsed state

**Decision:** Merged original Phase 2 (Parameter Selection) + Phase 3 (Range Configuration) into single polish task.

</verification>

---

*Phase: 02-parameter-ui-polish*
*Context gathered: 2026-01-11*
*Verification completed: 2026-01-11*
