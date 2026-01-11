# Phase 2: Parameter Selection UI - Context

**Gathered:** 2026-01-11
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

Phase 1 audit noted that Phases 2-3 UI may already be partially implemented in `period-selector.tsx`. Verification needed during planning/research to understand current state before building.

The user prefers extending proven patterns over introducing new UX concepts. The diversification sweep container is the reference implementation to follow.

</notes>

---

*Phase: 02-parameter-selection-ui*
*Context gathered: 2026-01-11*
